import 'dart:async';
import 'dart:convert';

import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/main.dart';
import 'package:agro_mais_brasil/territorial/dashboard_components.dart';
import 'package:agro_mais_brasil/territorial/water_dashboard.dart';
import 'package:agro_mais_brasil/territorial/water_data.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late WaterSnapshot snapshot;
  late Map<String, String> files;

  WaterSnapshot parse({String? integration, String? daily, String? monthly}) =>
      WaterSnapshot.parse(
        integration: integration ?? files['integration-example.json']!,
        daily: daily ?? files['historical_indicators.csv']!,
        monthly: monthly ?? files['monthly_indicators.csv']!,
        seasonal: files['training_monthly_reference.csv']!,
        threshold: files['thresholds.csv']!,
        manifest: files['provenance.json']!,
      );

  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
    files = {
      for (final name in [
        'integration-example.json',
        'historical_indicators.csv',
        'monthly_indicators.csv',
        'training_monthly_reference.csv',
        'thresholds.csv',
        'provenance.json',
      ])
        name: await rootBundle.loadString('assets/agua04/$name'),
    };
    snapshot = parse();
    await (FontLoader('Roboto')
          ..addFont(rootBundle.load('assets/fonts/roboto-regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/roboto-bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });

  test('pacote real tem 312 meses, 9497 dias e referência só de treino', () {
    expect(snapshot.months.length, 312);
    expect(snapshot.days.length, 9497);
    expect(snapshot.years, List.generate(26, (i) => 2000 + i));
    expect(snapshot.days.first.date, DateTime.utc(2000, 1, 1));
    expect(snapshot.days.last.date, DateTime.utc(2025, 12, 31));
    expect(snapshot.references.every((r) => r.sampleYears == 20), true);
    expect(snapshot.thresholds.length, 48);
  });

  test('últimos agregados reproduzem contrato auditado e anomalia', () {
    final dec = snapshot.months.last;
    final last = snapshot.days.last;
    expect(last.rain7, closeTo(24.22, 1e-7));
    expect(last.rain30, closeTo(86.50, 1e-7));
    expect(last.dryRun, 0);
    expect(dec.rain, closeTo(86.57, 1e-7));
    expect(dec.anomalyMm, closeTo(-99.70, 1e-7));
    expect(dec.anomalyPercent, closeTo(-53.52, .005));
    expect(snapshot.reference(12).mean, closeTo(186.27, 1e-7));
    for (final m in snapshot.months) {
      expect(
        m.anomalyMm,
        closeTo(m.rain! - snapshot.reference(m.date.month).mean!, 1e-7),
      );
    }
  });

  test('nulos iniciais não viram zero e limiares mantêm empates corretos', () {
    expect(snapshot.days.take(6).every((d) => d.rain7 == null), true);
    expect(snapshot.days.take(29).every((d) => d.rain30 == null), true);
    expect(snapshot.days[6].rain7, isNotNull);
    expect(waterNumber(null), 'Indisponível');
    final t = snapshot.threshold('monthly_rain', 12);
    expect(t.classify(t.q10), 'entre_q10_q25');
    expect(t.classify(t.q25), 'entre_q25_q75');
    expect(t.classify(t.q75), 'entre_q25_q75');
    expect(t.classify(t.q90), 'entre_q75_q90');
    expect(t.classify(t.q90 + .0000001), 'acima_q90');
    expect(t.classify(null), 'indisponivel');
    expect(snapshot.threshold('low_run', 12).classify(0), 'sem_sequencia');
  });

  test('classes diárias auditadas respeitam limiares e precisão dos CSVs', () {
    for (final d in snapshot.days) {
      final values = [d.rain7, d.rain30, d.dryRun];
      final levels = [d.level7, d.level30, d.dryLevel];
      for (var i = 0; i < 3; i++) {
        final t = snapshot.threshold(
          ['rain_7d', 'rain_30d', 'low_run'][i],
          d.date.month,
        );
        if (t.classify(values[i]) != levels[i]) {
          // Flags precede serialization: daily CSV has 8 decimals, limits 10.
          // Preserve audited flags at rounded boundaries instead of reclassifying.
          expect(values[i], isNotNull);
          expect(
            [
              t.q10,
              t.q25,
              t.q75,
              t.q90,
            ].any((limit) => (values[i]! - limit).abs() <= 5.1e-9),
            true,
            reason: '${d.date}: ${levels[i]}',
          );
        }
      }
    }
  });

  test('recusa versão, finalidade e número não finito incompatíveis', () {
    final contract =
        jsonDecode(files['integration-example.json']!) as WaterJson;
    contract['schema_version'] = 'agua05-1.0';
    expect(
      () => parse(integration: jsonEncode(contract)),
      throwsFormatException,
    );
    contract['schema_version'] = 'agua04-1.0';
    (contract['indicators'] as List).first['decision_authorized'] = true;
    expect(
      () => parse(integration: jsonEncode(contract)),
      throwsFormatException,
    );
    expect(
      () => parse(
        daily: files['historical_indicators.csv']!.replaceFirst(
          '0.00000000',
          'NaN',
        ),
      ),
      throwsFormatException,
    );
  });

  test('formatação pt-BR e calendário LST sem deslocamento de data', () {
    expect(waterNumber(1234.5), '1.234,50');
    expect(waterNumber(-99.70), '-99,70');
    expect(waterNumber(0, decimals: 0), '0');
    expect(waterDate(DateTime(2025, 12, 31)), '31/12/2025');
  });

  Widget app({Future<WaterSnapshot> Function()? load}) => MaterialApp(
    theme: agroTheme(),
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: WaterDashboard(load: load ?? () async => snapshot),
  );

  Future<void> viewport(WidgetTester tester, Size size) async {
    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  }

  testWidgets('abre pela home inclusive offline e volta à sessão preservada', (
    tester,
  ) async {
    await viewport(tester, const Size(390, 844));
    final controller = demoController('offline');
    await tester.pumpWidget(AgroApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Inteligência hídrica territorial'));
    await tester.pumpAndSettle();
    // Asset I/O is real; yield outside the fake clock if still pending.
    if (find.text('Abrindo o histórico').evaluate().isNotEmpty) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 200)),
      );
      await tester.pumpAndSettle();
    }
    expect(find.text('Mogi das Cruzes/SP'), findsOneWidget);
    expect(find.text('86,57'), findsOneWidget);
    expect(find.textContaining('Dados históricos até'), findsOneWidget);
    await tester.tap(find.byTooltip('Voltar'));
    await tester.pumpAndSettle();
    expect(controller.offline, true);
    expect(find.byTooltip('Inteligência hídrica territorial'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('filtros e barras mudam mês e ano com números reais', (
    tester,
  ) async {
    await viewport(tester, const Size(390, 844));
    await tester.pumpWidget(app());
    await tester.pumpAndSettle();
    expect(find.text('86,57'), findsOneWidget);
    await tester.tap(find.byType(DropdownButtonFormField<int>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('2024').last);
    await tester.pumpAndSettle();
    final dec24 = snapshot.months.firstWhere(
      (m) => m.date.year == 2024 && m.date.month == 12,
    );
    expect(find.text(waterNumber(dec24.rain)), findsOneWidget);
    await tester.tap(find.byType(DropdownButtonFormField<int>).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Novembro').last);
    await tester.pumpAndSettle();
    final nov24 = snapshot.months.firstWhere(
      (m) => m.date.year == 2024 && m.date.month == 11,
    );
    expect(find.text(waterNumber(nov24.rain)), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('barras respondem ao toque e expõem ação acessível', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await viewport(tester, const Size(390, 844));
    var selected = 11;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 350,
              child: StatefulBuilder(
                builder: (context, setState) => DashboardBarChart(
                  points: [
                    for (var i = 0; i < 12; i++)
                      DashboardChartPoint(
                        label: waterMonths[i].substring(0, 3),
                        semanticLabel: 'Selecionar ${waterMonths[i]}',
                        value: snapshot.months[300 + i].rain,
                      ),
                  ],
                  selected: selected,
                  onSelected: (value) => setState(() {
                    selected = value;
                  }),
                  unit: 'mm',
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nov'));
    await tester.pumpAndSettle();
    expect(selected, 10);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Selecionar Novembro')),
      matchesSemantics(
        isButton: true,
        isSelected: true,
        hasSelectedState: true,
        hasTapAction: true,
        label: 'Selecionar Novembro',
      ),
    );
    semantics.dispose();
  });

  testWidgets('trocar série diária preserva a posição vertical do painel', (
    tester,
  ) async {
    await viewport(tester, const Size(390, 844));
    await tester.pumpWidget(app());
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Ver análise detalhada').hitTestable(),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Ver análise detalhada'));
    await tester.pumpAndSettle();
    final outer = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('30 dias').hitTestable(),
      200,
      scrollable: outer,
    );
    await tester.pumpAndSettle();
    final position = tester.state<ScrollableState>(outer).position;
    final before = position.pixels;
    await tester.tap(find.text('30 dias'));
    await tester.pumpAndSettle();
    expect(position.pixels, closeTo(before, 1));
    expect(find.text('Acumulado de 30 dias'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'selecionar dia mantém a posição da página e atualiza os indicadores',
    (tester) async {
      await viewport(tester, const Size(390, 844));
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Ver análise detalhada').hitTestable(),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Ver análise detalhada'));
      await tester.pumpAndSettle();
      final outer = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(
        find.text('30 dias').hitTestable(),
        200,
        scrollable: outer,
      );
      await tester.pumpAndSettle();
      final position = tester.state<ScrollableState>(outer).position;
      final chartFinder = find.byType(DashboardBarChart).last;
      final chart = tester.widget<DashboardBarChart>(chartFinder);
      final before = position.pixels;
      chart.onSelected(24);
      await tester.pumpAndSettle();
      expect(position.pixels, closeTo(before, 1));
      expect(tester.widget<DashboardBarChart>(chartFinder).selected, 24);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'loading, erro recuperável e vazio nunca apresentam valores fabricados',
    (tester) async {
      final completer = Completer<WaterSnapshot>();
      var attempt = 0;
      await tester.pumpWidget(
        app(
          load: () =>
              attempt++ == 0 ? completer.future : Future.value(snapshot),
        ),
      );
      await tester.pump();
      expect(find.text('Abrindo o histórico'), findsOneWidget);
      completer.completeError(const FormatException('pacote incompatível'));
      await tester.pumpAndSettle();
      expect(find.text('Não foi possível abrir o painel'), findsOneWidget);
      expect(find.text('86,57'), findsNothing);
      await tester.tap(find.text('Tentar novamente'));
      await tester.pumpAndSettle();
      expect(find.text('86,57'), findsOneWidget);
      final empty = parse(
        monthly: files['monthly_indicators.csv']!.split('\n').first,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(app(load: () async => empty));
      await tester.pumpAndSettle();
      expect(find.text('Sem dados neste período'), findsOneWidget);
    },
  );

  testWidgets('painel segue contraste, rótulos e áreas de toque Android', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await viewport(tester, const Size(390, 844));
    await tester.pumpWidget(app());
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Ver análise detalhada').hitTestable(),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Ver análise detalhada'));
    await tester.pumpAndSettle();
    for (var section = 0; section < 6; section++) {
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      await expectLater(tester, meetsGuideline(textContrastGuideline));
      await tester.drag(find.byType(ListView).first, const Offset(0, -600));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
    semantics.dispose();
  });

  testWidgets('320dp, texto 200% e movimento reduzido em todas as seções', (
    tester,
  ) async {
    await viewport(tester, const Size(320, 900));
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(
          disableAnimations: true,
          accessibleNavigation: true,
        );
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pumpWidget(app());
    await tester.pumpAndSettle();
    expect(
      dashboardMotion(tester.element(find.byType(WaterDashboard))),
      Duration.zero,
    );
    await tester.scrollUntilVisible(
      find.text('Ver análise detalhada').hitTestable(),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Ver análise detalhada'));
    await tester.pumpAndSettle();
    for (var i = 0; i < 22; i++) {
      expect(tester.takeException(), isNull);
      await tester.drag(find.byType(ListView).first, const Offset(0, -650));
      await tester.pumpAndSettle();
    }
    expect(tester.takeException(), isNull);
    expect(find.text('Próximos painéis'), findsOneWidget);
  });
}
