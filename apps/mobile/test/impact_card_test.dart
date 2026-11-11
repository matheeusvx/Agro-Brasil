import 'package:agro_mais_brasil/data.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/territorial/impact_card.dart';
import 'package:agro_mais_brasil/territorial/impact_data.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

// Exemplo fictício do contrato v1 (docs/requisitos/api.md).
Json sample({String property = 'p', double expired = 1}) => {
  'schemaVersion': 1,
  'propertyId': property,
  'isDemonstration': true,
  'asOf': '2026-11-11T15:00:00.000Z',
  'funnelKg': {
    'registered': 20,
    'published': 10,
    'acceptedNet': 6,
    'pickedUp': 4,
    'received': 3,
  },
  'balancesKg': {
    'availableActive': 3,
    'reservedNow': 2,
    'inTransitNow': 1,
    'expiredAvailable': expired,
  },
  'byModeKg': {
    'VENDA': {'published': 6, 'received': 1},
    'DOACAO': {'published': 4, 'received': 2},
  },
};

class ImpactRepo implements Repository {
  Json? body;
  int? failure;
  final calls = <String>[];
  @override
  String get scope => 'user/org';
  @override
  String get organizationName => 'Org';
  @override
  bool get demonstration => true;
  @override
  bool get fixture => false;
  @override
  Future<Json> read(String path) async {
    calls.add(path);
    if (failure != null) throw ApiFailure(failure!, 'Sem conexão.');
    return {'data': body};
  }

  @override
  Future<Json> write(String path, Json body, {String? key}) =>
      throw UnimplementedError();
}

HomeController ctl(ImpactRepo repo, [MemoryStore? store]) =>
    HomeController(repo, store ?? MemoryStore())
      ..catalog = {
        'properties': [
          {'id': 'p', 'name': 'Sítio A'},
        ],
      }
      ..propertyId = 'p'
      ..loading = false;

Widget host(HomeController c, {double scale = 1}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(
      size: const Size(320, 844),
      textScaler: TextScaler.linear(scale),
      disableAnimations: true,
    ),
    child: Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [ImpactCard(controller: c, property: 'p')],
      ),
    ),
  ),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    await (FontLoader('Roboto')
          ..addFont(rootBundle.load('assets/fonts/roboto-regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/roboto-bold.ttf')))
        .load();
  });

  test('usa a propriedade selecionada e o contrato sem recalcular', () async {
    final repo = ImpactRepo()..body = sample();
    final r = await ImpactRepository(ctl(repo)).load('p');
    expect(repo.calls, ['/properties/p/excess-impact']);
    expect(r.saved, false);
    expect(r.impact.funnel['received'], 3);
    expect(r.impact.balances['expiredAvailable'], 1);
    expect(r.impact.byMode['DOACAO']!['published'], 4);
  });

  test('propriedade fora do catálogo nem é consultada', () async {
    final repo = ImpactRepo()..body = sample();
    await expectLater(
      ImpactRepository(ctl(repo)).load('outra'),
      throwsA(isA<ApiFailure>().having((e) => e.status, 's', 403)),
    );
    expect(repo.calls, isEmpty);
  });

  test(
    'resposta de outra propriedade ou fora do contrato é recusada',
    () async {
      for (final body in [
        sample(property: 'q'),
        {...sample(), 'schemaVersion': 2},
        {...sample(), 'funnelKg': null},
      ]) {
        final repo = ImpactRepo()..body = body;
        await expectLater(
          ImpactRepository(ctl(repo)).load('p'),
          throwsA(isA<ApiFailure>().having((e) => e.status, 's', 422)),
        );
      }
    },
  );

  test(
    'offline usa só a cópia salva; 401/403/404 apagam e não usam cache',
    () async {
      final store = MemoryStore();
      final repo = ImpactRepo()..body = sample();
      await ImpactRepository(ctl(repo, store)).load('p');
      repo.failure = 0;
      final saved = await ImpactRepository(ctl(repo, store)).load('p');
      expect(saved.saved, true);
      expect(saved.impact.asOf, DateTime.parse('2026-11-11T15:00:00.000Z'));
      for (final status in [401, 403, 404]) {
        repo
          ..failure = null
          ..body = sample();
        await ImpactRepository(ctl(repo, store)).load('p');
        repo.failure = status;
        await expectLater(
          ImpactRepository(ctl(repo, store)).load('p'),
          throwsA(isA<ApiFailure>().having((e) => e.status, 's', status)),
        );
        expect(await store.get('user/org/impact/p'), isNull);
      }
      repo.failure = 503;
      await expectLater(
        ImpactRepository(ctl(repo, store)).load('p'),
        throwsA(isA<ApiFailure>().having((e) => e.status, 's', 0)),
      );
    },
  );

  testWidgets('card mostra ofertado, recebido, vencido, modalidades e demo', (
    tester,
  ) async {
    await tester.pumpWidget(host(ctl(ImpactRepo()..body = sample())));
    await tester.pumpAndSettle();
    expect(find.text('Destino dos excedentes'), findsOneWidget);
    expect(find.textContaining('Dados demonstrativos'), findsOneWidget);
    expect(
      find.bySemanticsLabel(RegExp('^Ofertado: 10 quilos')),
      findsOneWidget,
    );
    expect(
      find.bySemanticsLabel(RegExp('^Recebido: 3 quilos, confirmado')),
      findsOneWidget,
    );
    expect(
      find.bySemanticsLabel(RegExp('^Vencido sem destinação: 1 quilos')),
      findsOneWidget,
    );
    expect(find.text('Venda: 6 kg ofertados · 1 kg recebidos'), findsOneWidget);
    expect(
      find.text('Doação: 4 kg ofertados · 2 kg recebidos'),
      findsOneWidget,
    );
    expect(find.textContaining('salvo'), findsNothing);
    final handle = tester.ensureSemantics();
    expect(
      tester.getSemantics(find.text('Ver todas as etapas')),
      isSemantics(
        label: 'Ver todas as etapas',
        hasTapAction: true,
        isFocusable: true,
      ),
    );
    handle.dispose();
    await tester.tap(find.text('Ver todas as etapas'));
    await tester.pumpAndSettle();
    expect(find.text('Aceito em pedidos: 6 kg'), findsOneWidget);
    expect(find.text('Em trânsito agora: 1 kg'), findsOneWidget);
  });

  testWidgets('sem ofertas, falha e offline não mostram zero inventado', (
    tester,
  ) async {
    final empty = sample()
      ..['funnelKg'] = {
        'registered': 5,
        'published': 0,
        'acceptedNet': 0,
        'pickedUp': 0,
        'received': 0,
      };
    await tester.pumpWidget(host(ctl(ImpactRepo()..body = empty)));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Ainda não há ofertas publicadas'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(host(ctl(ImpactRepo()..failure = 500)));
    await tester.pumpAndSettle();
    expect(find.text('Não foi possível abrir o painel'), findsOneWidget);
    expect(find.textContaining(' kg'), findsNothing);
    expect(find.text('Tentar novamente'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(host(ctl(ImpactRepo()..failure = 401)));
    await tester.pumpAndSettle();
    expect(find.textContaining('sessão expirou'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);

    final store = MemoryStore();
    final repo = ImpactRepo()..body = sample();
    await ImpactRepository(ctl(repo, store)).load('p');
    repo.failure = 0;
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(host(ctl(repo, store)));
    await tester.pumpAndSettle();
    expect(find.textContaining('Dados salvos de'), findsOneWidget);
    expect(find.textContaining('Cópia salva · referência'), findsOneWidget);
  });

  testWidgets('320 px com texto 200% sem estouro', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(host(ctl(ImpactRepo()..body = sample()), scale: 2));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ver todas as etapas'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
