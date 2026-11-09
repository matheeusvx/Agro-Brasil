import '../data.dart';

/// Fixed-point grams match the commerce domain; never sum floating kg balances.
int productionGrams(dynamic value) {
  if (value is! num ||
      !value.isFinite ||
      value < 0 ||
      (value * 1000 - (value * 1000).round()).abs() > .00001) {
    throw ApiFailure(
      422,
      'Quantidade inválida. Atualize os registros antes de consultar.',
    );
  }
  return (value * 1000).round();
}

Future<List<Json>> productionPages(Repository repo, String path) async {
  final result = <Json>[];
  final ids = <String>{};
  int? total;
  for (var offset = 0; offset <= 100000; offset += 100) {
    final page = await repo.read(
      '$path${path.contains('?') ? '&' : '?'}limit=100&offset=$offset',
    );
    final batch = rows(page['data']);
    final count = page['pagination']?['total'];
    if (count is! int && !repo.fixture) {
      throw ApiFailure(
        422,
        'Paginação indisponível; nenhum total parcial foi exibido.',
      );
    }
    if (count is int && (count < 0 || (total != null && total != count))) {
      throw ApiFailure(
        409,
        'Os registros mudaram durante a consulta. Tente novamente.',
      );
    }
    total ??= count as int?;
    for (final item in batch) {
      if (item['id'] is! String || !ids.add(item['id'] as String)) {
        throw ApiFailure(409, 'Páginas inconsistentes. Tente atualizar.');
      }
    }
    result.addAll(batch);
    if (total == null || result.length == total) return result;
    if (result.length > total || batch.length != 100) {
      throw ApiFailure(409, 'Consulta incompleta. Tente atualizar.');
    }
  }
  throw ApiFailure(
    422,
    'Consulta excede a paginação disponível; nenhum total parcial foi exibido.',
  );
}

class ProductionSnapshot {
  final String scope, property;
  final DateTime fetchedAt;
  final List<Json> productions, offers, orders;
  const ProductionSnapshot({
    required this.scope,
    required this.property,
    required this.fetchedAt,
    required this.productions,
    required this.offers,
    required this.orders,
  });
  Json toJson() => {
    'version': 1,
    'scope': scope,
    'property': property,
    'fetchedAt': fetchedAt.toIso8601String(),
    'productions': productions,
    'offers': offers,
    'orders': orders,
  };
  factory ProductionSnapshot.fromJson(Json j) {
    if (j['version'] != 1) throw const FormatException('Snapshot incompatível');
    return ProductionSnapshot(
      scope: j['scope'],
      property: j['property'],
      fetchedAt: DateTime.parse(j['fetchedAt']),
      productions: rows(j['productions']),
      offers: rows(j['offers']),
      orders: rows(j['orders']),
    );
  }
}

class ProductionDashboardRepository {
  final HomeController controller;
  const ProductionDashboardRepository(this.controller);
  void checkSession() {
    if (controller.sessionClosed || controller.disposed) {
      throw ApiFailure(401, 'Esta sessão foi encerrada. Entre novamente.');
    }
  }

  String key(String property) =>
      '${controller.repository.scope}/production-dashboard/$property';
  Future<(ProductionSnapshot, bool)> load(
    String property, {
    bool force = false,
  }) async {
    final repo = controller.repository;
    checkSession();
    if (!controller.properties.any((p) => p['id'] == property)) {
      throw ApiFailure(403, 'Propriedade não autorizada nesta sessão.');
    }
    try {
      if (controller.offline && !force) throw ApiFailure(0, 'Sem conexão.');
      final lists = await Future.wait([
        productionPages(repo, '/productions'),
        productionPages(repo, '/offers?scope=mine'),
        productionPages(repo, '/orders'),
      ]);
      checkSession();
      final productions = lists[0]
          .where((p) => p['propertyId'] == property)
          .toList();
      final lots = productions.map((p) => p['lot']['id']).toSet();
      final offers = lists[1]
          .where(
            (o) =>
                lots.contains(o['lotId']) &&
                productions.any(
                  (p) =>
                      p['lot']['id'] == o['lotId'] &&
                      (repo.fixture ||
                          p['organizationId'] == o['sellerOrganizationId']),
                ),
          )
          .toList();
      final offerIds = offers.map((o) => o['id']).toSet();
      final linkedOrders = lists[2]
          .where(
            (o) =>
                lots.contains(o['lotId']) &&
                offerIds.contains(o['offerId']) &&
                offers.any(
                  (offer) =>
                      offer['id'] == o['offerId'] &&
                      offer['lotId'] == o['lotId'] &&
                      (repo.fixture ||
                          offer['sellerOrganizationId'] ==
                              o['sellerOrganizationId']),
                ),
          )
          .toList();
      final orders = linkedOrders
          .map(
            (o) => <String, dynamic>{
              ...o,
              'cropName': productions.firstWhere(
                (p) => p['lot']['id'] == o['lotId'],
              )['cropName'],
            },
          )
          .toList();
      final snapshot = ProductionSnapshot(
        scope: repo.scope,
        property: property,
        fetchedAt: DateTime.now().toUtc(),
        productions: productions,
        offers: offers,
        orders: orders,
      );
      // Validate before caching. Failed/partial queries never replace a good snapshot.
      ProductionSummary(snapshot, DateTime.now());
      try {
        await controller.store.put(key(property), snapshot.toJson());
      } on Object {
        /* Read still succeeds. */
      }
      checkSession();
      return (snapshot, false);
    } on ApiFailure catch (e) {
      if (e.status != 0 && e.status < 500) {
        await controller.store.remove(key(property));
        rethrow;
      }
      checkSession();
      final cached = await controller.store.get(key(property));
      checkSession();
      if (cached != null) {
        try {
          final snapshot = ProductionSnapshot.fromJson(cached);
          if (snapshot.scope == repo.scope && snapshot.property == property) {
            ProductionSummary(snapshot, DateTime.now());
            return (snapshot, true);
          }
        } on Object {
          /* Invalid caches do not become zero totals. */
        }
      }
      throw ApiFailure(
        0,
        'Sem conexão e sem painel salvo para esta propriedade.',
      );
    }
  }
}

class ProductionSummary {
  final Map<String, int> crops = {}, seasons = {}, months = {};
  final Map<String, String> names = {};
  final List<Json> activeOffers = [], pending = [], expiring = [];
  int produced = 0, sale = 0, donation = 0, offered = 0;
  ProductionSummary(
    ProductionSnapshot snapshot,
    DateTime now, {
    String year = 'all',
  }) {
    for (final p in snapshot.productions) {
      final grams = productionGrams(p['quantityKg']);
      final date = p['harvestedOn'] as String?;
      if (year != 'all' && (date == null || !date.startsWith('$year-'))) {
        continue;
      }
      final id = (p['cropId'] ?? p['cropName']) as String;
      names[id] = p['cropName'] as String;
      crops[id] = (crops[id] ?? 0) + grams;
      produced += grams;
      final season = p['seasonLabel'] as String? ?? 'Safra não informada';
      seasons[season] = (seasons[season] ?? 0) + grams;
      if (date != null && date.length >= 7) {
        final month = date.substring(0, 7);
        months[month] = (months[month] ?? 0) + grams;
      }
    }
    // Availability is current property stock, independent of harvest-year filter.
    for (final o in snapshot.offers) {
      if (o['status'] != 'PUBLICADA') continue;
      final end = DateTime.tryParse(o['availableUntil'] as String? ?? '');
      if (end == null || !['VENDA', 'DOACAO'].contains(o['destinationMode'])) {
        throw ApiFailure(
          422,
          'Oferta publicada sem prazo ou modalidade válida.',
        );
      }
      if (!end.isAfter(now)) continue;
      final initial = productionGrams(o['quantityKg']);
      final balance = productionGrams(o['availableKg']);
      if (balance > initial) {
        throw ApiFailure(422, 'Saldo de oferta inconsistente.');
      }
      activeOffers.add(o);
      offered += initial;
      if (o['destinationMode'] == 'VENDA') {
        sale += balance;
      } else {
        donation += balance;
      }
      if (balance > 0 && end.difference(now) <= const Duration(days: 3)) {
        expiring.add(o);
      }
    }
    pending.addAll(snapshot.orders.where((o) => o['status'] == 'SOLICITADO'));
    for (final order in snapshot.orders) {
      productionGrams(order['quantityKg']);
    }
    expiring.sort(
      (a, b) => (a['availableUntil'] as String).compareTo(
        b['availableUntil'] as String,
      ),
    );
  }
}
