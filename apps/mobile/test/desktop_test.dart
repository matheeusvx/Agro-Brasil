import 'package:agro_mais_brasil/main.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/desktop_charts.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  for (final scenario in ['primeiro-acesso', 'erro', 'offline', 'carregando']) {
    testWidgets('desktop estado $scenario', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1366, 768));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(AgroApp(controller: demoController(scenario)));
      if (scenario == 'carregando') {
        await tester.pump(const Duration(milliseconds: 100));
      } else {
        await tester.pumpAndSettle();
      }
      expect(tester.takeException(), isNull);
      if (scenario == 'primeiro-acesso') {
        expect(
          find.text('Ainda não há registros para esta distribuição.'),
          findsNWidgets(2),
        );
      }
      if (scenario == 'offline') {
        expect(
          find.textContaining(
            'Reconecte para consultar a distribuição completa.',
          ),
          findsOneWidget,
        );
      }
    });
  }
  test('agregação respeita lotes e propriedade', () async {
    final c = demoController('recebimento');
    await c.start();
    final data = await OperationalData.load(c, 'demo-property');
    expect(data.kilograms, 20.5);
    expect(data.count, 1);
    final empty = await OperationalData.load(c, 'outra');
    expect(empty.kilograms, 0);
    expect(empty.count, 0);
  });
  for (final size in [
    const Size(1440, 900),
    const Size(1366, 768),
    const Size(1024, 768),
  ]) {
    testWidgets('desktop navega e seleciona gráfico $size', (tester) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        AgroApp(controller: demoController('recebimento')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Produção por cultura'), findsOneWidget);
      await tester.tap(find.text('Produção').first);
      await tester.pumpAndSettle();
      expect(find.text('Minha produção'), findsOneWidget);
      await tester.tap(find.text('Início').first);
      await tester.pumpAndSettle();
      await Scrollable.ensureVisible(
        tester.element(find.text('Tomate · 8 kg')),
        alignment: .5,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tomate · 8 kg'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Tomate: 8 kg'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
