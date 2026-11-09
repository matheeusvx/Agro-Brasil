import 'package:agro_mais_brasil/data.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/main.dart';
import 'package:agro_mais_brasil/tasks.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

class RecordingRepository extends DemoRepository {
  final List<Json> writes = [];
  RecordingRepository() : super('solicitacao');
  @override
  bool get fixture => false;
  @override
  Future<Json> read(String path) => path.startsWith('/offers')
      ? Future.value({'data': <Json>[]})
      : super.read(path);
  @override
  Future<Json> write(String path, Json body, {String? key}) async {
    writes.add({'path': path, 'body': body, 'key': key});
    return {};
  }
}

void main() {
  for (final kind in ['production', 'offer']) {
    testWidgets('duas etapas de $kind em 320px e texto 200%', (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final c = HomeController(RecordingRepository(), MemoryStore());
      await c.start();
      await tester.pumpWidget(
        MaterialApp(
          theme: agroTheme(),
          home: EntryPage(controller: c, kind: kind),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Quantidade (kg)'),
        '2',
      );
      if (kind == 'production') {
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Safra'),
          'Primavera 2026',
        );
      }
      final next = find.text(
        kind == 'production'
            ? 'Continuar para a origem'
            : 'Continuar para o destino',
      );
      await Scrollable.ensureVisible(tester.element(next), alignment: .5);
      await tester.pumpAndSettle();
      expect(next.hitTestable(), findsOneWidget);
      await tester.tap(next);
      await tester.pumpAndSettle();
      expect(find.text('Etapa 2 de 2'), findsOneWidget);
      for (var i = 0; i < 5; i++) {
        await tester.drag(find.byType(ListView).first, const Offset(0, -350));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
    });
  }
  testWidgets('voltar do cadastro atualiza a lista sem Future no setState', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      AgroApp(controller: demoController('sem-pendencias')),
    );
    await tester.pumpAndSettle();
    for (final destination in ['Produção', 'Ofertas']) {
      await tester.tap(find.text(destination).last);
      await tester.pumpAndSettle();
      await tester.tap(
        find.text(
          destination == 'Produção'
              ? 'Cadastrar produção'
              : 'Oferecer produtos',
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Etapa 1 de 2'), findsOneWidget);
      await tester.tap(find.byTooltip('Voltar'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
        find.text(
          destination == 'Produção' ? 'Minha produção' : 'Minhas ofertas',
        ),
        findsOneWidget,
      );
    }
  });
  setUpAll(() async {
    await (FontLoader('Roboto')
          ..addFont(rootBundle.load('assets/fonts/roboto-regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/roboto-bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });

  testWidgets('cadastro em etapas preserva dados, origem e envio idempotente', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = RecordingRepository();
    final c = HomeController(repository, MemoryStore());
    await c.start();
    await tester.pumpWidget(
      MaterialApp(
        theme: agroTheme(),
        home: EntryPage(controller: c, kind: 'production'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continuar para a origem'));
    await tester.pumpAndSettle();
    expect(find.text('Informe uma quantidade positiva.'), findsOneWidget);
    expect(repository.writes, isEmpty);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Quantidade (kg)'),
      '12,5',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Safra'),
      'Verão 2026/27',
    );
    await tester.ensureVisible(find.text('Continuar para a origem'));
    await tester.tap(find.text('Continuar para a origem'));
    await tester.pumpAndSettle();
    expect(find.text('Origem da colheita'), findsOneWidget);
    await tester.tap(find.text('Voltar aos dados'));
    await tester.pumpAndSettle();
    expect(find.text('12,5'), findsOneWidget);
    expect(find.text('Verão 2026/27'), findsOneWidget);
    await tester.ensureVisible(find.text('Continuar para a origem'));
    await tester.tap(find.text('Continuar para a origem'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Registrar produção e lote'));
    await tester.tap(find.text('Registrar produção e lote'));
    await tester.pumpAndSettle();
    expect(find.text('Confirme a localização de origem.'), findsOneWidget);
    expect(repository.writes, isEmpty);
    await tester.tap(find.byType(CheckboxListTile));
    await tester.tap(find.text('Registrar produção e lote'));
    await tester.pumpAndSettle();
    expect(repository.writes, hasLength(1));
    final command = repository.writes.single;
    expect(command['path'], '/productions');
    expect(command['key'], isNotEmpty);
    expect(command['body'], containsPair('quantityKg', 12.5));
    expect(command['body'], containsPair('seasonLabel', 'Verão 2026/27'));
    expect(command['body'], containsPair('locationConfirmed', true));
    expect(command['body']['location'], {
      'municipality': 'São Paulo',
      'uf': 'SP',
    });
  });

  for (final large in [false, true]) {
    for (final destination in [
      'Produção',
      'Ofertas',
      'Pedidos',
      'Perfil',
      'histórico',
    ]) {
      testWidgets(
        'tela $destination em ${large ? '320 e texto 200%' : '390x844'}',
        (tester) async {
          await tester.binding.setSurfaceSize(Size(large ? 320 : 390, 844));
          addTearDown(() => tester.binding.setSurfaceSize(null));
          tester.platformDispatcher.textScaleFactorTestValue = large ? 2 : 1;
          addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
          await tester.pumpWidget(
            RepaintBoundary(
              key: const ValueKey('v2-capture'),
              child: AgroApp(controller: demoController('recebimento')),
            ),
          );
          await tester.pumpAndSettle();
          if (destination == 'histórico') {
            await tester.tap(find.text('Produção').last);
            await tester.pumpAndSettle();
            await tester.scrollUntilVisible(
              find.text('Alface').hitTestable(),
              150,
              scrollable: find.byType(Scrollable).first,
            );
            await tester.pumpAndSettle();
            expect(find.text('Alface').hitTestable(), findsOneWidget);
            await tester.tap(find.text('Alface'));
          } else {
            await tester.tap(find.text(destination).last);
          }
          await tester.pumpAndSettle();
          expect(
            find.text(switch (destination) {
              'Produção' => 'Minha produção',
              'Ofertas' => 'Minhas ofertas',
              'Pedidos' => 'Meus pedidos',
              'Perfil' => 'Meu perfil',
              _ => 'Histórico do lote',
            }),
            findsOneWidget,
          );
          expect(tester.takeException(), isNull);
          await expectLater(
            find.byKey(const ValueKey('v2-capture')),
            matchesGoldenFile(
              '../../../docs/design/goldens-v2/$destination-${large ? '320-200' : '390x844'}.png',
            ),
          );
          for (var i = 0; i < 3; i++) {
            await tester.drag(
              find.byType(ListView).first,
              const Offset(0, -400),
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
          }
        },
      );
    }
  }
}
