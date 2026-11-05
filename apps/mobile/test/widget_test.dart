import 'package:agro_mais_brasil/main.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/home.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final font = FontLoader('Roboto')
      ..addFont(rootBundle.load('assets/fonts/roboto-regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/roboto-bold.ttf'));
    await font.load();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });
  for (final scenario in scenarios) {
    testWidgets('captura Flutter real: $scenario (fixture identificada)', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(390, 1450));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        RepaintBoundary(
          key: const ValueKey('capture'),
          child: AgroApp(controller: demoController(scenario)),
        ),
      );
      if (scenario == 'carregando') {
        await tester.pump(const Duration(milliseconds: 100));
      } else {
        await tester.pumpAndSettle();
      }
      expect(tester.takeException(), isNull);
      expect(find.textContaining('dados fictícios'), findsOneWidget);
      expect(find.byType(PendingCard).evaluate().length, lessThanOrEqualTo(2));
      await expectLater(
        find.byKey(const ValueKey('capture')),
        matchesGoldenFile('../../../docs/evidencias/mobile/$scenario.png'),
      );
    });
  }
  testWidgets(
    'atalho cadastrar abre formulário e navegação inferior funciona',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        AgroApp(controller: demoController('primeiro-acesso')),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(
        find.text('Cadastrar minha primeira produção'),
      );
      await tester.tap(find.text('Cadastrar minha primeira produção'));
      await tester.pumpAndSettle();
      expect(find.text('Registrar produção e lote'), findsOneWidget);
      await tester.tap(find.byTooltip('Voltar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Perfil').last);
      await tester.pumpAndSettle();
      expect(find.text('Meu perfil'), findsOneWidget);
      await tester.tap(find.text('Pedidos').last);
      await tester.pumpAndSettle();
      expect(find.text('Meus pedidos'), findsOneWidget);
    },
  );
  testWidgets('alvos e rótulos acessíveis', (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.binding.setSurfaceSize(const Size(390, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(AgroApp(controller: demoController('solicitacao')));
    await tester.pumpAndSettle();
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    semantics.dispose();
  });
  testWidgets('layout estreito e texto em 200% sem overflow', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(AgroApp(controller: demoController('solicitacao')));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(ListView).first, const Offset(0, -600));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
