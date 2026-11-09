import 'dart:math' as math;

import '../data.dart';
import 'production_data.dart';

/// Commercial states in flow order; the API is the authority for transitions.
const logisticsStatuses = [
  'SOLICITADO',
  'ACEITO',
  'RETIRADO',
  'RECEBIDO',
  'CANCELADO',
];
const logisticsOpenStatuses = {'SOLICITADO', 'ACEITO', 'RETIRADO'};
const _shipmentByStatus = {
  'ACEITO': 'PLANEJADA',
  'RETIRADO': 'RETIRADA',
  'RECEBIDO': 'RECEBIDA',
};
const _pickup = 'RETIRADA_REGISTRADA', _receipt = 'RECEBIMENTO_CONFIRMADO';

/// Keeps only what this screen renders: no organization ids, users or receipts
/// reach the on-device copy.
Json _orderView(Json order, String cropName, bool fixture) {
  final status = order['status'];
  final shipment = order['shipment'] as Map?;
  if (!logisticsStatuses.contains(status)) {
    throw ApiFailure(422, 'Pedido com situação desconhecida. Tente atualizar.');
  }
  final expected = _shipmentByStatus[status];
  final valid = status == 'CANCELADO'
      ? shipment == null || shipment['status'] == 'CANCELADA'
      : expected == null
      ? shipment == null
      : shipment?['status'] == expected;
  if (!fixture && !valid) {
    throw ApiFailure(
      422,
      'Pedido e remessa em situações diferentes. Tente atualizar.',
    );
  }
  productionGrams(order['quantityKg']);
  return {
    'id': order['id'],
    'lotId': order['lotId'],
    'status': status,
    'quantityKg': order['quantityKg'],
    'cropName': cropName,
    'createdAt': order['createdAt'],
    // Null means no shipment exists yet: neither direct nor cooperative.
    'cooperative': shipment == null
        ? null
        : shipment['carrierOrganizationId'] != null,
  };
}

/// Only pickups and receipts whose municipality/UF were explicitly confirmed.
Json? _eventView(Json event, Map<String, String> statusByOrder) {
  final type = event['type'];
  final orderStatus = statusByOrder[event['orderId']];
  final location = event['location'];
  if (orderStatus == null || (type != _pickup && type != _receipt)) return null;
  // Orders are read first: a receipt confirmed in between must not contradict
  // the status displayed for that same order.
  if (type == _receipt && orderStatus != 'RECEBIDO') return null;
  if (location is! Map || event['locationConfirmedAt'] is! String) return null;
  final municipality = location['municipality'];
  final uf = location['uf'];
  if (municipality is! String ||
      municipality.trim().isEmpty ||
      uf is! String ||
      !RegExp(r'^[A-Z]{2}$').hasMatch(uf)) {
    return null;
  }
  return {
    'id': event['id'],
    'orderId': event['orderId'],
    'type': type,
    'municipality': municipality.trim(),
    'uf': uf,
  };
}

class LogisticsSnapshot {
  final String scope, property;
  final DateTime fetchedAt;
  final List<Json> orders, events;
  const LogisticsSnapshot({
    required this.scope,
    required this.property,
    required this.fetchedAt,
    required this.orders,
    required this.events,
  });
  Json toJson() => {
    'version': 1,
    'scope': scope,
    'property': property,
    'fetchedAt': fetchedAt.toIso8601String(),
    'orders': orders,
    'events': events,
  };
  factory LogisticsSnapshot.fromJson(Json j) {
    if (j['version'] != 1) throw const FormatException('Snapshot incompatível');
    return LogisticsSnapshot(
      scope: j['scope'],
      property: j['property'],
      fetchedAt: DateTime.parse(j['fetchedAt']),
      orders: rows(j['orders']),
      events: rows(j['events']),
    );
  }
}

class LogisticsDashboardRepository {
  /// Each moved lot is one paginated request; do not flood the local API.
  static const concurrentLots = 4;
  final HomeController controller;
  const LogisticsDashboardRepository(this.controller);
  void checkSession() {
    if (controller.sessionClosed || controller.disposed) {
      throw ApiFailure(401, 'Esta sessão foi encerrada. Entre novamente.');
    }
  }

  String key(String property) =>
      '${controller.repository.scope}/logistics-dashboard/$property';

  Future<List<Json>> _events(Repository repo, Set<String> lots) async {
    final result = <Json>[];
    final pending = lots.iterator;
    Future<void> worker() async {
      while (pending.moveNext()) {
        result.addAll(
          await productionPages(repo, '/lots/${pending.current}/events'),
        );
      }
    }

    await Future.wait(
      List.generate(math.min(concurrentLots, lots.length), (_) => worker()),
    );
    return result;
  }

  Future<(LogisticsSnapshot, bool)> load(
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
        productionPages(repo, '/orders'),
      ]);
      checkSession();
      final productions = {
        for (final p in lists[0])
          if (p['propertyId'] == property) p['lot']['id'] as String: p,
      };
      // /orders also lists operations where this organization is the buyer or
      // carrier. Only sales of this property's own lots belong to this panel.
      final orders = lists[1]
          .where((o) {
            final production = productions[o['lotId']];
            return production != null &&
                (repo.fixture ||
                    o['sellerOrganizationId'] == production['organizationId']);
          })
          .map(
            (o) => _orderView(
              o,
              productions[o['lotId']]!['cropName'] as String,
              repo.fixture,
            ),
          )
          .toList();
      final moved = orders
          .where((o) => o['status'] == 'RETIRADO' || o['status'] == 'RECEBIDO')
          .toList();
      final statusByOrder = {
        for (final o in moved) o['id'] as String: o['status'] as String,
      };
      final events = (await _events(
        repo,
        moved.map((o) => o['lotId'] as String).toSet(),
      )).map((e) => _eventView(e, statusByOrder)).nonNulls.toList();
      checkSession();
      final snapshot = LogisticsSnapshot(
        scope: repo.scope,
        property: property,
        fetchedAt: DateTime.now().toUtc(),
        orders: orders,
        events: events,
      );
      // Validate before caching. Failed/partial queries never replace a good snapshot.
      LogisticsSummary(snapshot);
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
          final snapshot = LogisticsSnapshot.fromJson(cached);
          if (snapshot.scope == repo.scope && snapshot.property == property) {
            LogisticsSummary(snapshot);
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

class LogisticsPlace {
  final String municipality, uf;
  int pickups = 0, receipts = 0;
  LogisticsPlace(this.municipality, this.uf);
  int get total => pickups + receipts;
}

class LogisticsSummary {
  final Map<String, List<Json>> byStatus = {
    for (final status in logisticsStatuses) status: <Json>[],
  };
  final Map<String, int> grams = {
    for (final status in logisticsStatuses) status: 0,
  };

  /// Orders only this producer can move forward: answer a request, or record
  /// the pickup of a direct operation. A designated cooperative or the
  /// recipient acting next is not a pending task for the producer.
  final List<Json> actions = [];
  final List<LogisticsPlace> places = [];
  int direct = 0, cooperative = 0;

  /// Confirmed operations whose municipality could not be displayed.
  int unlocated = 0;

  LogisticsSummary(LogisticsSnapshot snapshot) {
    var expected = 0;
    for (final order in snapshot.orders) {
      final status = order['status'] as String;
      byStatus[status]!.add(order);
      grams[status] = grams[status]! + productionGrams(order['quantityKg']);
      if (status == 'RETIRADO') expected += 1;
      if (status == 'RECEBIDO') expected += 2;
      if (status != 'CANCELADO' && order['cooperative'] == true) cooperative++;
      if (status != 'CANCELADO' && order['cooperative'] == false) direct++;
      if (status == 'SOLICITADO' ||
          (status == 'ACEITO' && order['cooperative'] != true)) {
        actions.add(order);
      }
    }
    int rank(Json o) => o['status'] == 'SOLICITADO' ? 0 : 1;
    actions.sort((a, b) {
      final byRank = rank(a) - rank(b);
      if (byRank != 0) return byRank;
      // Longest-waiting first.
      return '${a['createdAt']}'.compareTo('${b['createdAt']}');
    });
    final grouped = <String, LogisticsPlace>{};
    final seen = <String>{};
    for (final event in snapshot.events) {
      if (!seen.add('${event['id']}')) continue;
      final place = grouped.putIfAbsent(
        '${(event['municipality'] as String).toLowerCase()}/${event['uf']}',
        () => LogisticsPlace(
          event['municipality'] as String,
          event['uf'] as String,
        ),
      );
      if (event['type'] == _pickup) {
        place.pickups++;
      } else {
        place.receipts++;
      }
    }
    places
      ..addAll(grouped.values)
      ..sort((a, b) {
        final byTotal = b.total - a.total;
        return byTotal != 0
            ? byTotal
            : a.municipality.compareTo(b.municipality);
      });
    unlocated = math.max(0, expected - seen.length);
  }

  int get inProgress => logisticsOpenStatuses.fold(
    0,
    (sum, status) => sum + byStatus[status]!.length,
  );
  int get inProgressGrams =>
      logisticsOpenStatuses.fold(0, (sum, status) => sum + grams[status]!);
  int get received => byStatus['RECEBIDO']!.length;
  int get total => byStatus.values.fold(0, (sum, list) => sum + list.length);
  List<String> get presentStatuses =>
      logisticsStatuses.where((s) => byStatus[s]!.isNotEmpty).toList();
}
