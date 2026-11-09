import 'dart:async';
import 'dart:convert';

import 'package:agro_mais_brasil/data.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/main.dart';
import 'package:agro_mais_brasil/tasks.dart';
import 'package:agro_mais_brasil/territorial/logistics_dashboard.dart';
import 'package:agro_mais_brasil/territorial/logistics_data.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Json production(
  int i, {
  String property = 'p',
  String organization = 'org',
  String crop = 'Alface',
}) => {
  'id': 'p$i',
  'propertyId': property,
  'organizationId': organization,
  'cropId': crop,
  'cropName': crop,
  'quantityKg': 100,
  'lot': {'id': 'lot$i'},
};

const _shipmentStatus = {
  'ACEITO': 'PLANEJADA',
  'RETIRADO': 'RETIRADA',
  'RECEBIDO': 'RECEBIDA',
};

Json order(
  int i,
  String status, {
  int? lot,
  bool cooperative = false,
  num kg = 2,
  String seller = 'org',
  String createdAt = '2026-11-01T10:00:00Z',
  bool cancelledAfterAccept = false,
}) => {
  'id': 'order$i',
  'offerId': 'offer$i',
  'lotId': 'lot${lot ?? i}',
  'sellerOrganizationId': seller,
  'requesterOrganizationId': 'buyer-secret',
  'quantityKg': kg,
  'status': status,
  'createdAt': createdAt,
  if (_shipmentStatus.containsKey(status) || cancelledAfterAccept)
    'shipment': {
      'id': 'shipment$i',
      'status': _shipmentStatus[status] ?? 'CANCELADA',
      'carrierOrganizationId': cooperative ? 'coop-secret' : null,
    },
};

Json event(
  String id,
  int orderIndex,
  String type, {
  String municipality = 'Mogi das Cruzes',
  String uf = 'SP',
  bool confirmed = true,
}) => {
  'id': id,
  'orderId': 'order$orderIndex',
  'type': type,
  'recordedAt': '2026-11-02T10:00:00Z',
  'responsibleUserId': 'person-secret',
  'location': {'municipality': municipality, 'uf': uf},
  if (confirmed) 'locationConfirmedAt': '2026-11-02T10:00:00Z',
};

const pickup = 'RETIRADA_REGISTRADA', receipt = 'RECEBIMENTO_CONFIRMADO';

class TestRepository implements Repository {
  List<Json> productions = [], orders = [];
  Map<String, List<Json>> events = {};
  int? failure, eventFailure;
  bool inconsistent = false;
  int active = 0, peak = 0;
  final List<String> calls = [];
  @override
  String scope;
  TestRepository({this.scope = 'user/org'});
  @override
  String get organizationName => 'Organização de teste';
  @override
  bool get demonstration => true;
  @override
  bool get fixture => false;
  @override
  Future<Json> read(String path) async {
    calls.add(path);
    if (failure != null) throw ApiFailure(failure!, 'Falha de teste');
    final uri = Uri.parse(path);
    if (uri.path == '/producer-home') return {'canWrite': true};
    if (uri.path.endsWith('/weather')) return {'status': 'unavailable'};
    if (uri.path.endsWith('/events')) {
      if (eventFailure != null) throw ApiFailure(eventFailure!, 'Falha');
      active++;
      peak = active > peak ? active : peak;
      await Future<void>.delayed(Duration.zero);
      active--;
    }
    final data = uri.path == '/productions'
        ? productions
        : uri.path == '/orders'
        ? orders
        : events[uri.pathSegments[1]] ?? <Json>[];
    final offset = int.parse(uri.queryParameters['offset']!);
    return {
      'data': data.skip(offset).take(100).toList(),
      'pagination': {'total': data.length + (inconsistent ? 1 : 0)},
    };
  }

  @override
  Future<Json> write(String path, Json body, {String? key}) async =>
      throw UnimplementedError();
}

class DelayedStore extends MemoryStore {
  final entered = Completer<void>(), release = Completer<void>();
  @override
  Future<void> put(String key, Json value) async {
    entered.complete();
    await release.future;
    await super.put(key, value);
  }
}

HomeController controller(TestRepository repo, [MemoryStore? store]) =>
    HomeController(repo, store ?? MemoryStore())
      ..catalog = {
        'properties': [
          {
            'id': 'p',
            'name': 'Sítio A',
            'municipality': 'Mogi das Cruzes',
            'uf': 'SP',
          },
          {'id': 'q', 'name': 'Sítio B', 'municipality': 'Suzano', 'uf': 'SP'},
        ],
      }
      ..propertyId = 'p'
      ..home = {'canWrite': true}
      ..loading = false;

/// One order in every commercial state, direct and through a cooperative.
TestRepository fullRepository() => TestRepository()
  ..productions = [
    production(0),
    production(1, crop: 'Tomate'),
    production(2, crop: 'Mandioca'),
    production(3, crop: 'Banana'),
    production(4, crop: 'Couve'),
    production(5, crop: 'Milho'),
    production(6, crop: 'Abóbora'),
  ]
  ..orders = [
    order(0, 'SOLICITADO', kg: .1, createdAt: '2026-11-03T10:00:00Z'),
    order(1, 'SOLICITADO', kg: .2, createdAt: '2026-11-01T10:00:00Z'),
    order(2, 'ACEITO', kg: 12),
    order(3, 'ACEITO', kg: 8, cooperative: true),
    order(4, 'RETIRADO', kg: 3, cooperative: true),
    order(5, 'RECEBIDO', kg: 5),
    order(6, 'CANCELADO', kg: 9, cancelledAfterAccept: true),
  ]
  ..events = {
    'lot4': [
      {
        'id': 'origin',
        'type': 'ORIGEM_REGISTRADA',
        'location': {'municipality': 'Biritiba Mirim', 'uf': 'SP'},
        'locationConfirmedAt': '2026-10-01T10:00:00Z',
      },
      event('e4', 4, pickup, municipality: 'Suzano'),
    ],
    'lot5': [
      event('e5a', 5, pickup),
      event('e5b', 5, receipt, municipality: 'São Paulo'),
    ],
  };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<LogisticsSummary> summarize(TestRepository repo) async {
    final c = controller(repo);
    return LogisticsSummary(
      (await LogisticsDashboardRepository(c).load('p')).$1,
    );
  }

  test('estados diferentes, kg em gramas e recebidos separados', () async {
    final s = await summarize(fullRepository());
    expect(s.inProgress, 5);
    expect(s.received, 1);
    expect(s.total, 7);
    expect(s.grams['SOLICITADO'], 300);
    expect(s.inProgressGrams, 23300);
    expect(s.presentStatuses, logisticsStatuses);
  });

  test('ação só quando depende do produtor; mais antiga primeiro', () async {
    final s = await summarize(fullRepository());
    expect(s.actions.map((o) => o['id']), ['order1', 'order0', 'order2']);
    expect(s.direct, 2);
    expect(s.cooperative, 2);
    expect(s.byStatus['ACEITO']!.last['cooperative'], true);
  });

  test('cancelados não contam em andamento nem geram ação', () async {
    final repo = TestRepository()
      ..productions = [production(0), production(1)]
      ..orders = [
        order(0, 'CANCELADO'),
        order(1, 'CANCELADO', cancelledAfterAccept: true, cooperative: true),
      ];
    final s = await summarize(repo);
    expect(s.inProgress, 0);
    expect(s.actions, isEmpty);
    expect(s.cooperative + s.direct, 0);
    expect(s.byStatus['CANCELADO']!.length, 2);
    expect(repo.calls.where((c) => c.contains('/events')), isEmpty);
  });

  test('retirada não vira recebimento e município é só o confirmado', () async {
    final repo = TestRepository()
      ..productions = [production(0), production(1), production(2)]
      ..orders = [
        order(0, 'RETIRADO'),
        order(1, 'RECEBIDO'),
        order(2, 'SOLICITADO'),
      ]
      ..events = {
        // Receipt confirmed after the orders page was read.
        'lot0': [
          event('a', 0, pickup, municipality: 'Suzano'),
          event('b', 0, receipt, municipality: 'Santos'),
        ],
        'lot1': [
          event('c', 1, pickup, municipality: 'SUZANO'),
          event('d', 1, receipt, confirmed: false),
          event('x', 99, pickup, municipality: 'Campinas'),
        ],
      };
    final s = await summarize(repo);
    expect(s.received, 1);
    expect(s.places.single.municipality, 'Suzano');
    expect(s.places.single.pickups, 2);
    expect(s.places.single.receipts, 0);
    expect(s.unlocated, 1);
    expect(repo.calls.where((c) => c.contains('lot2/events')), isEmpty);
  });

  test('isolamento: outra propriedade, comprador, cooperativa e organização', () async {
    final repo = fullRepository()
      ..productions.addAll([
        production(7, property: 'q'),
        production(8, organization: 'outra'),
      ])
      ..orders.addAll([
        order(7, 'RECEBIDO'),
        order(8, 'RECEBIDO'),
        // The same org appears in /orders as a buyer of someone else's lot.
        order(9, 'RECEBIDO', seller: 'vendedor-externo'),
      ]);
    final c = controller(repo);
    final r = LogisticsDashboardRepository(c);
    final snapshot = (await r.load('p')).$1;
    expect(snapshot.orders.length, 7);
    expect(repo.calls.where((p) => p.contains('lot7')), isEmpty);
    expect(repo.calls.where((p) => p.contains('lot8')), isEmpty);
    expect(repo.calls.where((p) => p.contains('lot9')), isEmpty);
    final saved = jsonEncode(await c.store.get(r.key('p')));
    for (final secret in [
      'buyer-secret',
      'coop-secret',
      'person-secret',
      'sellerOrganizationId',
    ]) {
      expect(saved.contains(secret), false, reason: secret);
    }
    final other = (await r.load('q')).$1;
    expect(other.orders.single['id'], 'order7');
    await expectLater(r.load('fora'), throwsA(isA<ApiFailure>()));
  });

  test('propriedade sem pedidos fica zerada e sem consultar eventos', () async {
    final repo = TestRepository()..productions = [production(0)];
    final s = await summarize(repo);
    expect(s.total, 0);
    expect(s.places, isEmpty);
    expect(repo.calls.where((p) => p.contains('/events')), isEmpty);
  });

  test('paginação completa e eventos com concorrência limitada', () async {
    final repo = TestRepository()
      ..productions = [for (var i = 0; i < 205; i++) production(i)]
      ..orders = [for (var i = 0; i < 205; i++) order(i, 'RETIRADO')]
      ..events = {
        for (var i = 0; i < 205; i++)
          'lot$i': [event('e$i', i, pickup)],
      };
    final s = await summarize(repo);
    expect(s.inProgress, 205);
    expect(s.places.single.pickups, 205);
    expect(repo.peak, lessThanOrEqualTo(4));
    expect(repo.peak, greaterThan(1));
    expect(
      repo.calls.where((p) => p.startsWith('/orders')).length,
      greaterThanOrEqualTo(3),
    );
  });

  test('contrato inválido e paginação inconsistente recusam totais parciais', () async {
    Future<void> rejects(TestRepository repo) => expectLater(
      LogisticsDashboardRepository(controller(repo)).load('p'),
      throwsA(isA<ApiFailure>().having((e) => e.status, 'status', isNonZero)),
    );
    await rejects(
      TestRepository()
        ..productions = [production(0)]
        ..orders = [order(0, 'EM_ROTA')],
    );
    await rejects(
      TestRepository()
        ..productions = [production(0)]
        ..orders = [
          {...order(0, 'RETIRADO'), 'shipment': null},
        ],
    );
    await rejects(
      TestRepository()
        ..productions = [production(0)]
        ..orders = [
          {...order(0, 'SOLICITADO'), 'quantityKg': -1},
        ],
    );
    await rejects(
      TestRepository()
        ..productions = [production(0)]
        ..orders = [order(0, 'SOLICITADO'), order(0, 'SOLICITADO')],
    );
    await rejects(
      TestRepository()
        ..productions = [production(0)]
        ..inconsistent = true,
    );
  });

  test('offline usa cópia isolada; 401/403/404 nunca usam cache', () async {
    final repo = fullRepository();
    final c = controller(repo);
    final r = LogisticsDashboardRepository(c);
    await r.load('p');
    repo.failure = 0;
    expect((await r.load('p')).$2, true);
    repo.failure = 503;
    expect((await r.load('p')).$2, true);
    await expectLater(r.load('q'), throwsA(isA<ApiFailure>()));
    repo.scope = 'outro/org';
    await expectLater(r.load('p'), throwsA(isA<ApiFailure>()));
    repo.scope = 'user/org';
    for (final status in [401, 403, 404]) {
      repo.failure = null;
      await r.load('p');
      repo.failure = status;
      await expectLater(r.load('p'), throwsA(isA<ApiFailure>()));
      expect(await c.store.get(r.key('p')), isNull, reason: '$status');
    }
    repo.failure = null;
    await r.load('p');
    await c.clear();
    expect(await c.store.get(r.key('p')), isNull);
  });

  test('falha em eventos não troca a cópia boa nem mostra totais pela metade', () async {
    final repo = fullRepository();
    final c = controller(repo);
    final r = LogisticsDashboardRepository(c);
    final first = (await r.load('p')).$1;
    repo.orders = repo.orders.sublist(0, 5);
    repo.eventFailure = 0;
    final (stale, offline) = await r.load('p');
    expect(offline, true);
    expect(stale.orders.length, first.orders.length);
  });

  test('home offline usa cópia; forçar atualização tenta reconectar', () async {
    final repo = fullRepository();
    final c = controller(repo);
    final r = LogisticsDashboardRepository(c);
    await r.load('p');
    c.offline = true;
    repo.orders = [order(0, 'SOLICITADO')];
    expect((await r.load('p')).$1.orders.length, 7);
    final recovered = await r.load('p', force: true);
    expect(recovered.$2, false);
    expect(recovered.$1.orders.length, 1);
  });

  test('consulta atrasada não recria cache depois do logout', () async {
    final store = DelayedStore();
    final c = controller(fullRepository(), store);
    final r = LogisticsDashboardRepository(c);
    final future = r.load('p');
    final expectation = expectLater(
      future,
      throwsA(isA<ApiFailure>().having((e) => e.status, 'status', 401)),
    );
    await store.entered.future;
    await c.clear();
    store.release.complete();
    await expectation;
    expect(await store.get(r.key('p')), isNull);
  });

  test('ApiRepository envia identidade também nos eventos', () async {
    final requests = <http.Request>[];
    final repo = ApiRepository(
      base: Uri.parse('http://127.0.0.1:3000'),
      token: 'test-only',
      organizationId: 'org',
      userId: 'u',
      organizationName: 'org',
      client: MockClient((req) async {
        requests.add(req);
        final data = req.url.path.endsWith('/productions')
            ? [production(0)]
            : req.url.path.endsWith('/orders')
            ? [order(0, 'RETIRADO')]
            : [event('e', 0, pickup)];
        return http.Response(
          jsonEncode({
            'data': data,
            'pagination': {'total': 1},
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    final c = HomeController(repo, MemoryStore())
      ..catalog = {
        'properties': [
          {'id': 'p', 'name': 'A', 'municipality': 'X', 'uf': 'SP'},
        ],
      };
    final snapshot = (await LogisticsDashboardRepository(c).load('p')).$1;
    expect(snapshot.events.single['municipality'], 'Mogi das Cruzes');
    expect(requests.map((r) => r.url.path), contains('/api/v1/lots/lot0/events'));
    expect(
      requests.every(
        (r) =>
            r.headers['X-Organization-Id'] == 'org' &&
            r.headers['Authorization'] == 'Bearer test-only',
      ),
      true,
    );
  });

  test('galeria mantém o contrato da remessa e do evento confirmado', () async {
    final c = demoController('recebimento');
    await c.start();
    final s = LogisticsSummary(
      (await LogisticsDashboardRepository(c).load('demo-property')).$1,
    );
    expect(s.byStatus['RETIRADO']!.single['cropName'], 'Alface');
    expect(s.places.single.municipality, 'São Paulo');
    c.dispose();
  });

  Widget app(Widget home) => MaterialApp(
    theme: agroTheme(),
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: home,
  );
  Widget dashboard(HomeController c) => app(LogisticsDashboard(controller: c));

  Future<void> untilLoaded(WidgetTester tester) async {
    final ready = find.text('Demonstração · registros fictícios identificados');
    for (var i = 0; i < 40 && ready.evaluate().isEmpty; i++) {
      await tester.pump(const Duration(milliseconds: 1));
    }
    expect(ready, findsOneWidget);
  }

  Future<void> reveal(WidgetTester tester, Finder target) =>
      tester.scrollUntilVisible(
        target.hitTestable(),
        150,
        scrollable: find.byType(Scrollable).first,
      );

  testWidgets('indicador, seleção, ações, território e detalhes', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(dashboard(controller(fullRepository())));
    await tester.pumpAndSettle();
    expect(find.text('Pedidos em andamento'), findsOneWidget);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('23,3 kg nessas operações'), findsOneWidget);
    expect(find.text('1 já recebido pelo destinatário'), findsOneWidget);
    // Opens on what still has to leave the property.
    expect(find.text('Mandioca · 12 kg'), findsOneWidget);
    expect(find.text('Banana · 8 kg'), findsOneWidget);
    expect(find.text('Com cooperativa'), findsOneWidget);
    final semantics = tester.ensureSemantics();
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    semantics.dispose();
    await reveal(tester, find.text('Retirado, aguardando confirmação'));
    await tester.tap(find.text('Retirado, aguardando confirmação'));
    await tester.pumpAndSettle();
    expect(find.text('Couve · 3 kg'), findsOneWidget);
    // Banana is cooperative-led, so it left with the "aguardando retirada" list.
    expect(find.text('Banana · 8 kg'), findsNothing);
    expect(
      find.text('Somente o destinatário confirma o recebimento.'),
      findsOneWidget,
    );
    await reveal(tester, find.text('O que precisa da sua ação'));
    expect(find.text('Responder solicitação'), findsNWidgets(2));
    expect(find.text('Registrar retirada'), findsOneWidget);
    await reveal(tester, find.text('Onde já foi confirmado'));
    expect(find.text('Suzano/SP'), findsOneWidget);
    expect(find.text('São Paulo/SP'), findsOneWidget);
    expect(find.text('Biritiba Mirim/SP'), findsNothing);
    await reveal(tester, find.text('Ver análise detalhada'));
    await tester.tap(find.text('Ver análise detalhada'));
    await tester.pumpAndSettle();
    expect(find.text('Forma de operação'), findsOneWidget);
    expect(find.text('Direta: 2 pedidos'), findsOneWidget);
    expect(find.text('Cancelado: 1 pedido, 9 kg'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ação abre somente o pedido escolhido em Pedidos', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = fullRepository();
    final c = controller(repo);
    await tester.pumpWidget(dashboard(c));
    await tester.pumpAndSettle();
    await reveal(tester, find.text('Registrar retirada'));
    await tester.tap(find.text('Registrar retirada'));
    await tester.pumpAndSettle();
    expect(find.byType(TaskPage), findsOneWidget);
    expect(find.textContaining('order2'), findsOneWidget);
    expect(find.textContaining('order0'), findsNothing);
    expect(find.text('Acompanhar logística'), findsNothing);
    final before = repo.calls.length;
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(repo.calls.length, greaterThan(before));
  });

  testWidgets('Pedidos abre o painel e volta atualizado', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = fullRepository();
    await tester.pumpWidget(
      app(
        Scaffold(
          body: TaskPage(controller: controller(repo), kind: 'orders'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Acompanhar logística'));
    await tester.pumpAndSettle();
    expect(find.byType(LogisticsDashboard), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(LogisticsDashboard), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('alternar propriedade não mistura totais', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = fullRepository();
    final c = controller(repo);
    await tester.pumpWidget(dashboard(c));
    await tester.pumpAndSettle();
    expect(find.text('Pedidos em andamento'), findsOneWidget);
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sítio B').last);
    await tester.pumpAndSettle();
    expect(c.propertyId, 'q');
    expect(find.text('Pedidos em andamento'), findsNothing);
    expect(find.text('Nenhum pedido nesta propriedade'), findsOneWidget);
    expect(find.text('Suzano/SP · somente pedidos desta propriedade'), findsOneWidget);
    expect(find.text('Ver ofertas'), findsOneWidget);
  });

  testWidgets('perfil de consulta é informado sem esconder a situação', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final c = controller(fullRepository())..home = {'canWrite': false};
    await tester.pumpWidget(dashboard(c));
    await tester.pumpAndSettle();
    await reveal(tester, find.textContaining('Seu perfil é de consulta'));
    expect(find.textContaining('Seu perfil é de consulta'), findsOneWidget);
  });

  testWidgets('somente cancelados: zero em andamento e nada pendente', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = TestRepository()
      ..productions = [production(0)]
      ..orders = [order(0, 'CANCELADO')];
    await tester.pumpWidget(dashboard(controller(repo)));
    await tester.pumpAndSettle();
    expect(find.text('0'), findsOneWidget);
    expect(find.text('Cancelados não contam como em andamento.'), findsOneWidget);
    await reveal(tester, find.text('Nada depende de você nesta consulta.'));
    expect(find.text('Onde já foi confirmado'), findsNothing);
    expect(find.text('Direta: 1 pedido'), findsNothing);
  });

  testWidgets('sem território quando nada foi confirmado', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = TestRepository()
      ..productions = [production(0)]
      ..orders = [order(0, 'ACEITO')];
    await tester.pumpWidget(dashboard(controller(repo)));
    await tester.pumpAndSettle();
    await reveal(tester, find.text('Ver análise detalhada'));
    expect(find.text('Onde já foi confirmado'), findsNothing);
  });

  testWidgets('API indisponível mostra cópia sem ações de escrita', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = fullRepository();
    await tester.pumpWidget(dashboard(controller(repo)));
    await tester.pumpAndSettle();
    repo.failure = 0;
    await tester.tap(find.byTooltip('Atualizar painel'));
    await tester.pumpAndSettle();
    expect(find.textContaining('dados desatualizados'), findsOneWidget);
    expect(find.text('Pedidos em andamento'), findsOneWidget);
    await reveal(tester, find.text('O que precisa da sua ação'));
    expect(
      find.text('Reconecte para confirmar o que ainda depende de você.'),
      findsOneWidget,
    );
    expect(find.text('Responder solicitação'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('sem conexão e sem cópia oferece nova tentativa', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = fullRepository()..failure = 0;
    await tester.pumpWidget(dashboard(controller(repo)));
    await tester.pumpAndSettle();
    expect(
      find.text('Sem conexão e sem painel salvo para esta propriedade.'),
      findsOneWidget,
    );
    repo.failure = null;
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('Pedidos em andamento'), findsOneWidget);
  });

  for (final (name, build) in <(String, TestRepository Function())>[
    ('completo', fullRepository),
    ('vazio', TestRepository.new),
  ]) {
    testWidgets('320dp, texto 200% e movimento reduzido: $name', (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(
            disableAnimations: true,
            accessibleNavigation: true,
          );
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      await tester.pumpWidget(dashboard(controller(build())));
      await untilLoaded(tester);
      await tester.pump();
      // No frames are scheduled once data is on screen: motion is really off.
      expect(tester.binding.hasScheduledFrame, false);
      for (var i = 0; i < 12; i++) {
        expect(tester.takeException(), isNull);
        await tester.drag(find.byType(ListView), const Offset(0, -450));
        await tester.pumpAndSettle();
      }
    });
  }

  testWidgets('animação é curta e termina sem deixar quadros pendentes', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(dashboard(controller(fullRepository())));
    await untilLoaded(tester);
    await tester.pump();
    expect(tester.binding.hasScheduledFrame, true);
    await tester.pump(const Duration(milliseconds: 400));
    expect(tester.binding.hasScheduledFrame, false);
  });
}
