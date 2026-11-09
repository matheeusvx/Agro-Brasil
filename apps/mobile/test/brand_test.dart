import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/design.dart';
import 'package:agro_mais_brasil/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('logo declarada no pubspec e carregável pelo bundle', () async {
    final data = await rootBundle.load(AgroLogo.asset);
    expect(data.lengthInBytes, greaterThan(1000));
  });

  testWidgets('login apresenta a logo como título e mantém o acesso', (
    tester,
  ) async {
    await tester.pumpWidget(const AgroApp());
    await tester.pump();
    expect(find.byType(AgroLogo), findsOneWidget);
    expect(find.bySemanticsLabel('Agro+ Brasil'), findsOneWidget);
    expect(find.text('Meu campo, meu dia.'), findsOneWidget);
    expect(find.text('Verificar acesso'), findsOneWidget);
    expect(find.text('Token temporário de demonstração'), findsOneWidget);
  });

  testWidgets('cabeçalho usa a logo e preserva as ações', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(AgroApp(controller: demoController('clima')));
    await tester.pumpAndSettle();
    expect(find.byType(AgroLogo), findsOneWidget);
    expect(find.byIcon(Icons.eco), findsNothing);
    expect(find.byTooltip('Inteligência hídrica territorial'), findsOneWidget);
    expect(find.byTooltip('Atualizar informações'), findsOneWidget);
    expect(
      find.byTooltip('Sair e apagar dados salvos desta sessão'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
