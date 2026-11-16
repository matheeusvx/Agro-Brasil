import 'package:agro_mais_brasil/territorial/explained_alert.dart';
import 'package:agro_mais_brasil/territorial/alert_card.dart';
import 'package:agro_mais_brasil/territorial/production_data.dart';
import 'package:agro_mais_brasil/territorial/logistics_data.dart';
import 'package:agro_mais_brasil/territorial/water_data.dart';
import 'package:agro_mais_brasil/data.dart';
import 'package:agro_mais_brasil/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:agro_mais_brasil/territorial/production_dashboard.dart';
import 'package:agro_mais_brasil/territorial/logistics_dashboard.dart';
import 'package:agro_mais_brasil/territorial/water_dashboard.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'production_dashboard_test.dart' as p;
import 'logistics_dashboard_test.dart' as l;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final now = DateTime.utc(2026, 11, 16, 12);
  AlertContext context({
    bool offline = false,
    bool demo = false,
    String scope = 'org',
    String property = 'p',
    DateTime? at,
  }) => AlertContext(
    scope: scope,
    property: property,
    now: at ?? now,
    offline: offline,
    demonstration: demo,
  );
  ProductionSnapshot production(
    List<Json> offers, {
    List<Json> orders = const [],
    DateTime? fetched,
  }) => ProductionSnapshot(
    scope: 'org',
    property: 'p',
    fetchedAt: fetched ?? now,
    productions: [p.production(0)],
    offers: offers,
    orders: orders,
  );
  Json offer(
    Duration delta, {
    double balance = 6,
    String status = 'PUBLICADA',
  }) => {
    ...p.offer(0, balance: balance, status: status),
    'availableUntil': now.add(delta).toIso8601String(),
  };
  LogisticsSnapshot logistics(List<Json> orders) => LogisticsSnapshot(
    scope: 'org',
    property: 'p',
    fetchedAt: now,
    orders: orders,
    events: [],
  );
  Json order(String status, {String? created = '2026-11-15T10:00:00Z'}) => {
    'id': status,
    'status': status,
    'quantityKg': 2,
    'cooperative': true,
    'createdAt': created,
  };
  late WaterSnapshot preparedWater;
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
    preparedWater = await const WaterRepository().load();
    await (FontLoader('Roboto')
          ..addFont(rootBundle.load('assets/fonts/roboto-regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/roboto-bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });

  for (final name in ['água', 'produção', 'logística']) {
    testWidgets('dashboard $name abre a explicação dos dados consultados', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final c = p.controller(
        p.TestRepository()
          ..productions = [p.production(0)]
          ..offers = [p.offer(0)]
          ..orders = [
            {
              'id': 'pedido',
              'offerId': 'o0',
              'lotId': 'lot0',
              'sellerOrganizationId': 'org',
              'status': 'SOLICITADO',
              'quantityKg': 1,
            },
          ],
      );
      final lc = l.controller(l.fullRepository());
      await tester.pumpWidget(
        MaterialApp(
          theme: agroTheme(),
          locale: const Locale('pt', 'BR'),
          supportedLocales: const [Locale('pt', 'BR')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: switch (name) {
            'água' => WaterDashboard(load: () async => preparedWater),
            'produção' => ProductionDashboard(controller: c),
            _ => LogisticsDashboard(controller: lc),
          },
        ),
      );
      await tester.pumpAndSettle();
      for (
        var i = 0;
        i < 40 && find.text('Entender o aviso').evaluate().isEmpty;
        i++
      ) {
        await tester.drag(find.byType(ListView).first, const Offset(0, -250));
        await tester.pumpAndSettle();
      }
      await tester.ensureVisible(find.text('Entender o aviso').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Entender o aviso').first);
      await tester.pumpAndSettle();
      expect(find.text('Evidência'), findsOneWidget);
      expect(find.text('Confiança e fundamento'), findsOneWidget);
      expect(find.text('Avaliação humana'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
      lc.dispose();
    });
  }

  testWidgets('card tem alvos rotulados, contraste e área de toque Android', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
      MaterialApp(
        theme: agroTheme(),
        home: Scaffold(
          body: SingleChildScrollView(
            child: ExplainedAlertCard(
              alert: productionAlerts(
                production([offer(const Duration(days: 5))]),
                context(),
              ).single,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    semantics.dispose();
    await tester.pumpWidget(const SizedBox());
  });

  test('vencimento: 72h inclusivo, zero e fora da janela excluídos', () {
    for (final delta in [
      Duration.zero,
      const Duration(seconds: -1),
      const Duration(hours: 72, seconds: 1),
    ]) {
      expect(
        productionAlerts(
          production([offer(delta)]),
          context(),
        ).where((a) => a.id == 'expiring'),
        isEmpty,
      );
    }
    for (final delta in [
      const Duration(seconds: 1),
      const Duration(hours: 72),
    ]) {
      expect(
        productionAlerts(production([offer(delta)]), context()).first.id,
        'expiring',
      );
    }
    expect(
      productionAlerts(
        production([offer(const Duration(hours: 1), balance: 0)]),
        context(),
      ),
      isEmpty,
    );
    expect(
      productionAlerts(
        production([offer(const Duration(hours: 1), status: 'CANCELADA')]),
        context(),
      ),
      isEmpty,
    );
  });
  test('produção não é excedente e saldo não comprova perdas', () {
    expect(productionAlerts(production([]), context()), isEmpty);
    final alert = productionAlerts(
      production([offer(const Duration(days: 5))]),
      context(),
    ).single;
    expect(alert.id, 'available');
    expect(alert.evidence, contains('6,000 kg'));
    expect(alert.limitations, contains('não comprovam perda'));
    expect(alert.confidence, startsWith('Moderada'));
  });
  test('prazo ausente não vira zero nem aviso de segurança', () {
    expect(
      () => productionAlerts(
        production([
          {...p.offer(0), 'availableUntil': null},
        ]),
        context(),
      ),
      throwsA(isA<ApiFailure>()),
    );
  });
  test('pendência só SOLICITADO', () {
    final alerts = productionAlerts(
      production([], orders: [order('SOLICITADO'), order('CANCELADO')]),
      context(),
    );
    expect(alerts.single.id, 'pending');
    expect(alerts.single.evidence, contains('· 1.'));
  });
  test('offline congela avaliação na consulta e reduz confiança', () {
    final data = production([offer(const Duration(hours: 1))]);
    final alert = productionAlerts(
      data,
      context(offline: true, at: now.add(const Duration(days: 2))),
    ).first;
    expect(alert.id, 'expiring');
    expect(alert.evidence, contains(alertTime(now)));
    expect(alert.evidence, contains('Dados desatualizados'));
    expect(alert.confidence, startsWith('Baixa'));
  });
  test('limite de atualização e relógio futuro não inventam atualidade', () {
    expect(context(at: now.add(const Duration(minutes: 15))).stale(now), false);
    expect(
      context(at: now.add(const Duration(minutes: 15, seconds: 1))).stale(now),
      true,
    );
    expect(context().stale(now.add(const Duration(seconds: 1))), true);
    expect(context(demo: true).confidence(now), contains('demonstração'));
  });
  test('isolamento por escopo e propriedade em ambos os motores', () {
    for (final other in [context(scope: 'outra'), context(property: 'q')]) {
      expect(
        productionAlerts(production([offer(const Duration(hours: 1))]), other),
        isEmpty,
      );
      expect(logisticsAlerts(logistics([order('ACEITO')]), other), isEmpty);
    }
  });
  test('logística: só estados abertos, sem inventar atraso ou horários', () {
    final alerts = logisticsAlerts(
      logistics([for (final status in logisticsStatuses) order(status)]),
      context(),
    );
    expect(alerts.length, 3);
    expect(alerts.last.reason, contains('destinatário'));
    expect(alerts[1].reason, contains('cooperativa'));
    for (final a in alerts) {
      expect(a.evidence, contains('2026-11-15T10:00:00.000Z'));
      expect(a.limitations, contains('não é horário de aceite'));
      expect(a.evidence, isNot(contains('atraso')));
    }
  });
  test('data ausente reduz confiança; offline também', () {
    final a = logisticsAlerts(
      logistics([order('ACEITO', created: null)]),
      context(),
    ).single;
    expect(a.confidence, startsWith('Baixa'));
    expect(a.evidence, isNot(contains('null')));
    expect(
      logisticsAlerts(
        logistics([order('ACEITO')]),
        context(offline: true),
      ).single.confidence,
      startsWith('Baixa'),
    );
  });
  test('AGUA-04 real: média e quantis, igualdade, dado ausente', () async {
    final data = await const WaterRepository().load();
    final ref = data.reference(1),
        threshold = data.threshold('monthly_rain', 1);
    WaterMonth month(double? rain) => WaterMonth({
      'date': '2025-01-01',
      'rain_total_mm': rain?.toString() ?? '',
    });
    final low = waterAlert(data, month(threshold.q10 - .01));
    expect(low.attention, 'Atenção');
    expect(low.reason, contains('Abaixo do quantil 10'));
    expect(
      waterAlert(data, month(threshold.q10)).reason,
      contains('Entre os quantis 10 e 25'),
    );
    expect(waterAlert(data, month(threshold.q25)).attention, 'Informativo');
    expect(
      waterAlert(data, month(ref.mean)).title,
      'Chuva sem sinal abaixo da média',
    );
    expect(low.kind, 'Aviso histórico');
    expect(low.evidence, contains('NASA POWER'));
    expect(low.limitations, contains('Não é previsão operacional'));
    expect(waterAlert(data, month(null)).confidence, startsWith('Baixa'));
    data.thresholds.removeWhere((t) => t.month == 1);
    expect(waterAlert(data, month(0)).attention, 'Dados insuficientes');
  });

  for (final width in [320.0, 900.0]) {
    testWidgets('explicação acessível, texto 200%, largura $width', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(Size(width, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final semantics = tester.ensureSemantics();

      await tester.pumpWidget(
        MaterialApp(
          theme: agroTheme(),
          home: MediaQuery(
            data: MediaQueryData(
              size: Size(width, 900),
              textScaler: TextScaler.linear(2),
              disableAnimations: true,
            ),
            child: Scaffold(
              body: SingleChildScrollView(
                child: DashboardAlerts(
                  evaluate: (_) => productionAlerts(
                    production([offer(const Duration(hours: 1))]),
                    context(offline: true),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      final button = find.text('Entender o aviso').first;
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
      expect(find.text('Evidência'), findsOneWidget);
      expect(find.text('Limitações'), findsOneWidget);
      expect(find.text('Avaliação humana'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      semantics.dispose();
    });
  }
  testWidgets('estado sem avisos e atualização automática de confiança', (
    tester,
  ) async {
    var current = <ExplainedAlert>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: DashboardAlerts(evaluate: (_) => current),
          ),
        ),
      ),
    );
    expect(find.textContaining('Nenhum aviso pelas regras'), findsOneWidget);
    current = productionAlerts(
      production([offer(const Duration(hours: 1))]),
      context(offline: true),
    );
    await tester.pump(const Duration(minutes: 1));
    expect(find.textContaining('Confiança: Baixa'), findsWidgets);
    await tester.pumpWidget(const SizedBox());
  });
}
