import '../data.dart';

/// Contrato schemaVersion 1 de `GET /properties/:id/excess-impact`
/// (docs/requisitos/api.md). Os valores chegam calculados pela API; o app
/// apenas valida o formato e apresenta. Nenhuma regra de cálculo aqui.
class ExcessImpact {
  final String propertyId;
  final bool isDemonstration;
  final DateTime asOf;
  final Map<String, double> funnel, balances;
  final Map<String, Map<String, double>> byMode;
  const ExcessImpact._(
    this.propertyId,
    this.isDemonstration,
    this.asOf,
    this.funnel,
    this.balances,
    this.byMode,
  );

  static const funnelKeys = [
    'registered',
    'published',
    'acceptedNet',
    'pickedUp',
    'received',
  ];
  static const balanceKeys = [
    'availableActive',
    'reservedNow',
    'inTransitNow',
    'expiredAvailable',
  ];
  static const modes = ['VENDA', 'DOACAO'];

  static double _kg(dynamic value) {
    if (value is! num || !value.isFinite || value < 0) {
      throw const FormatException('Indicador fora do contrato');
    }
    return value.toDouble();
  }

  static Map<String, double> _group(dynamic json, List<String> keys) {
    if (json is! Map) throw const FormatException('Indicador fora do contrato');
    return {for (final k in keys) k: _kg(json[k])};
  }

  /// Recusa respostas fora do contrato em vez de exibir zero.
  factory ExcessImpact.fromJson(Json json, String property) {
    final asOf = DateTime.tryParse(json['asOf'] as String? ?? '');
    final modes = json['byModeKg'];
    if (json['schemaVersion'] != 1 ||
        json['propertyId'] != property ||
        json['isDemonstration'] is! bool ||
        asOf == null ||
        modes is! Map) {
      throw const FormatException('Indicador fora do contrato');
    }
    return ExcessImpact._(
      property,
      json['isDemonstration'] as bool,
      asOf,
      _group(json['funnelKg'], funnelKeys),
      _group(json['balancesKg'], balanceKeys),
      {
        for (final m in ExcessImpact.modes)
          m: _group(modes[m], const ['published', 'received']),
      },
    );
  }

  bool get hasOffers => funnel['published']! > 0;
  bool get hasModeData =>
      byMode['VENDA']!['published']! > 0 || byMode['DOACAO']!['published']! > 0;
}

/// Resultado da consulta: `saved` indica cópia local exibida offline.
class ImpactResult {
  final ExcessImpact impact;
  final bool saved;
  const ImpactResult(this.impact, this.saved);
}

class ImpactRepository {
  final HomeController controller;
  const ImpactRepository(this.controller);

  String key(String property) =>
      '${controller.repository.scope}/impact/$property';

  void _checkSession() {
    if (controller.sessionClosed || controller.disposed) {
      throw ApiFailure(401, 'Esta sessão foi encerrada. Entre novamente.');
    }
  }

  Future<ImpactResult> load(String property, {bool force = false}) async {
    _checkSession();
    if (!controller.properties.any((p) => p['id'] == property)) {
      throw ApiFailure(403, 'Propriedade não autorizada nesta sessão.');
    }
    try {
      if (controller.offline && !force) throw ApiFailure(0, 'Sem conexão.');
      final body = await controller.repository.read(
        '/properties/${Uri.encodeComponent(property)}/excess-impact',
      );
      _checkSession();
      final data = Map<String, dynamic>.from(body['data'] as Map? ?? {});
      final impact = ExcessImpact.fromJson(data, property);
      try {
        await controller.store.put(key(property), {
          'version': 1,
          'scope': controller.repository.scope,
          'data': data,
        });
      } on Object {
        /* Cache indisponível não impede a consulta online. */
      }
      return ImpactResult(impact, false);
    } on ApiFailure catch (e) {
      // 401/403/404 e demais recusas nunca ativam a cópia salva.
      if (e.status != 0 && e.status < 500) {
        await controller.store.remove(key(property));
        rethrow;
      }
      _checkSession();
      final cached = await controller.store.get(key(property));
      if (cached != null &&
          cached['version'] == 1 &&
          cached['scope'] == controller.repository.scope) {
        try {
          return ImpactResult(
            ExcessImpact.fromJson(
              Map<String, dynamic>.from(cached['data'] as Map),
              property,
            ),
            true,
          );
        } on Object {
          /* Cópia inválida não vira zero. */
        }
      }
      throw ApiFailure(
        0,
        'Sem conexão e sem indicador salvo para esta propriedade.',
      );
    } on FormatException {
      throw ApiFailure(
        422,
        'O indicador chegou em formato inesperado. Nenhum valor foi exibido.',
      );
    }
  }
}
