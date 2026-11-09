import 'dart:convert';
import 'dart:async';

import 'package:agro_mais_brasil/data.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/main.dart';
import 'package:agro_mais_brasil/territorial/production_data.dart';
import 'package:agro_mais_brasil/territorial/production_dashboard.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Json production(
  int i, {
  String property = 'p',
  String crop = 'Alface',
  double kg = 10,
}) => {
  'id': 'p$i',
  'propertyId': property,
  'organizationId': 'org',
  'cropId': crop,
  'cropName': crop,
  'quantityKg': kg,
  'harvestedOn': i.isEven ? '2026-10-01' : '2025-11-01',
  'seasonLabel': 'Primavera',
  'lot': {'id': 'lot$i'},
};
Json offer(
  int i, {
  String mode = 'VENDA',
  String status = 'PUBLICADA',
  double balance = 6,
  bool expired = false,
}) => {
  'id': 'o$i',
  'lotId': 'lot$i',
  'sellerOrganizationId': 'org',
  'cropName': 'Alface',
  'quantityKg': 10,
  'availableKg': balance,
  'destinationMode': mode,
  'status': status,
  'availableUntil': expired ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
};

class TestRepository implements Repository {
  List<Json> productions = [], offers = [], orders = [];
  int? failure;
  bool inconsistent = false;
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
    final data = uri.path == '/productions'
        ? productions
        : uri.path == '/orders'
        ? orders
        : offers;
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
      ..loading = false;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('consulta atrasada não recria cache depois do logout', () async {
    final store = DelayedStore();
    final repo = TestRepository()..productions = [production(0)];
    final c = controller(repo, store);
    final r = ProductionDashboardRepository(c);
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
  test('todas as páginas, propriedade, organização e ofertas próprias; reserva não subtrai duas vezes', () async {
    final repo = TestRepository()
      ..productions = [
        for (var i = 0; i < 205; i++) production(i),
        production(300, property: 'q'),
      ]
      ..offers = [
        offer(0),
        offer(1, mode: 'DOACAO', balance: 2),
        offer(2, status: 'RASCUNHO'),
        offer(3, expired: true),
        offer(300),
        {...offer(4), 'sellerOrganizationId': 'outra'},
      ]
      ..orders = [
        {
          'id': 'r1',
          'offerId': 'o0',
          'lotId': 'lot0',
          'sellerOrganizationId': 'org',
          'status': 'ACEITO',
          'quantityKg': 4,
        },
        {
          'id': 'r2',
          'offerId': 'o300',
          'lotId': 'lot300',
          'sellerOrganizationId': 'org',
          'status': 'SOLICITADO',
          'quantityKg': 2,
        },
      ];
    final c = controller(repo);
    final (snapshot, offline) = await ProductionDashboardRepository(c)
        .load('p');
    final s = ProductionSummary(snapshot, DateTime(2026, 11, 9));
    expect(offline, false);
    expect(s.produced, 2050000);
    expect(s.sale, 6000);
    expect(s.donation, 2000);
    expect(s.offered, 20000);
    expect(snapshot.orders.length, 1);
    expect(repo.calls.any((p) => p.contains('offset=200')), true);
    expect(
      ProductionSummary(snapshot, DateTime(2026, 11, 9), year: '2025').produced,
      1020000,
    );
    expect(
      ProductionSummary(snapshot, DateTime(2026, 11, 9), year: '2025').sale,
      6000,
    );
  });
  test(
    'várias culturas, vazio e produção sem oferta não viram excedente',
    () async {
      final repo = TestRepository()
        ..productions = [
          production(0),
          production(1, crop: 'Tomate', kg: 5.125),
        ];
      final c = controller(repo);
      final r = ProductionDashboardRepository(c);
      final s = ProductionSummary((await r.load('p')).$1, DateTime.now());
      expect(s.produced, 15125);
      expect(s.crops.length, 2);
      expect(s.sale + s.donation, 0);
      expect(
        ProductionSummary((await r.load('q')).$1, DateTime.now()).produced,
        0,
      );
      expect(productionKg(5125), '5,125');
    },
  );
  test(
    'cache isolado, desatualizado, 403 sem fallback e logout remove cópia',
    () async {
      final repo = TestRepository()..productions = [production(0)];
      final c = controller(repo);
      final r = ProductionDashboardRepository(c);
      await r.load('p');
      repo.failure = 0;
      expect((await r.load('p')).$2, true);
      await expectLater(r.load('q'), throwsA(isA<ApiFailure>()));
      repo.scope = 'outro/org';
      await expectLater(r.load('p'), throwsA(isA<ApiFailure>()));
      repo.scope = 'user/org';
      repo.failure = 403;
      await expectLater(r.load('p'), throwsA(isA<ApiFailure>()));
      expect(await c.store.get(r.key('p')), isNull);
      repo.failure = null;
      await r.load('p');
      c.offline = true;
      repo.productions.add(production(1));
      expect((await r.load('p')).$2, true);
      final recovered = await r.load('p', force: true);
      expect(recovered.$2, false);
      expect(recovered.$1.productions.length, 2);
      await c.clear();
      expect(await c.store.get(r.key('p')), isNull);
    },
  );
  test(
    'inconsistências de paginação e quantidade recusam totais parciais',
    () async {
      final repo = TestRepository()
        ..productions = [production(0)]
        ..inconsistent = true;
      await expectLater(
        ProductionDashboardRepository(controller(repo)).load('p'),
        throwsA(isA<ApiFailure>()),
      );
      repo.inconsistent = false;
      repo.productions = [production(0), production(0)];
      await expectLater(
        productionPages(repo, '/productions'),
        throwsA(isA<ApiFailure>()),
      );
      expect(() => productionGrams(double.nan), throwsA(isA<ApiFailure>()));
      expect(() => productionGrams(-1), throwsA(isA<ApiFailure>()));
    },
  );
  test(
    'ApiRepository transmite identidade e scope=mine em todas as páginas',
    () async {
      final requests = <http.Request>[];
      final repo = ApiRepository(
        base: Uri.parse('http://127.0.0.1:3000'),
        token: 'test-only',
        organizationId: 'org',
        userId: 'u',
        organizationName: 'org',
        client: MockClient((req) async {
          requests.add(req);
          return http.Response(
            jsonEncode({
              'data': req.url.queryParameters['offset'] == '0'
                  ? [
                      for (var i = 0; i < 100; i++) {'id': 'o$i'},
                    ]
                  : [
                      {'id': 'last'},
                    ],
              'pagination': {'total': 101},
            }),
            200,
          );
        }),
      );
      expect((await productionPages(repo, '/offers?scope=mine')).length, 101);
      expect(
        requests.every(
          (r) =>
              r.headers['X-Organization-Id'] == 'org' &&
              r.headers['Authorization'] == 'Bearer test-only' &&
              r.url.queryParameters['scope'] == 'mine',
        ),
        true,
      );
    },
  );
  test(
    'oferta inválida não vira saldo zero e limite de vencimento é estrito',
    () {
      final now = DateTime.utc(2026, 11, 9);
      ProductionSnapshot data(List<Json> offers) => ProductionSnapshot(
        scope: 'user/org',
        property: 'p',
        fetchedAt: now,
        productions: [production(0)],
        offers: offers,
        orders: [],
      );
      expect(
        ProductionSummary(
          data([
            {...offer(0), 'availableUntil': now.toIso8601String()},
          ]),
          now,
        ).sale,
        0,
      );
      expect(
        () => ProductionSummary(
          data([
            {...offer(0), 'availableKg': 11},
          ]),
          now,
        ),
        throwsA(isA<ApiFailure>()),
      );
      expect(
        () => ProductionSummary(
          data([
            {...offer(0), 'availableUntil': null},
          ]),
          now,
        ),
        throwsA(isA<ApiFailure>()),
      );
      expect(productionKg(600), '0,6');
    },
  );
  Widget app(HomeController c) => MaterialApp(
    theme: agroTheme(),
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: ProductionDashboard(controller: c),
  );
  testWidgets('gráfico interativo, detalhes, offline e alvos de toque', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = TestRepository()
      ..productions = [production(0), production(1, crop: 'Tomate', kg: 5)]
      ..offers = [offer(0)];
    final c = controller(repo);
    await tester.pumpWidget(app(c));
    await tester.pumpAndSettle();
    expect(find.text('15 kg'), findsOneWidget);
    await tester.tap(find.byType(DropdownButtonFormField<String>).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('2025').last);
    await tester.pumpAndSettle();
    expect(find.text('5 kg'), findsOneWidget);
    await tester.tap(find.byType(DropdownButtonFormField<String>).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Todos os registros').last);
    await tester.pumpAndSettle();
    final semantics = tester.ensureSemantics();
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    semantics.dispose();
    await tester.scrollUntilVisible(
      find.text('Tomate · 5 kg').hitTestable(),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Tomate · 5 kg'));
    await tester.pumpAndSettle();
    expect(find.text('Tomate: 5 kg registrados.'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Ver análise detalhada').hitTestable(),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Ver análise detalhada'));
    await tester.pumpAndSettle();
    expect(find.text('Produção por safra'), findsOneWidget);
    repo.failure = 0;
    await tester.tap(find.byTooltip('Atualizar painel'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, 1500));
    await tester.pumpAndSettle();
    expect(find.textContaining('dados desatualizados'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(const Size(320, 844));
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(
          disableAnimations: true,
          accessibleNavigation: true,
        );
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pumpAndSettle();
    for (var i = 0; i < 9; i++) {
      expect(tester.takeException(), isNull);
      await tester.drag(find.byType(ListView), const Offset(0, -450));
      await tester.pumpAndSettle();
    }
  });
  testWidgets('320dp texto 200%, propriedade vazia e erro recuperável', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final repo = TestRepository();
    final c = controller(repo);
    await tester.pumpWidget(app(c));
    await tester.pumpAndSettle();
    for (var i = 0; i < 9; i++) {
      expect(tester.takeException(), isNull);
      await tester.drag(find.byType(ListView), const Offset(0, -450));
      await tester.pumpAndSettle();
    }
    repo.failure = 403;
    await tester.tap(find.byTooltip('Atualizar painel'));
    await tester.pumpAndSettle();
    expect(find.text('Não foi possível abrir o painel'), findsOneWidget);
    repo.failure = null;
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
