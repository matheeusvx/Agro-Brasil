import 'package:agro_mais_brasil/main.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/home.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('saudação da home usa primeiro nome cadastrado ou fallback', () {
    expect(homeGreeting('Matheus Morelli Rodrigues'), 'Olá, Matheus');
    expect(homeGreeting('  Ana   Maria Silva  '), 'Olá, Ana');
    expect(homeGreeting('João'), 'Olá, João');
    expect(homeGreeting(null), 'Olá, produtor');
    expect(homeGreeting('   '), 'Olá, produtor');
  });
  testWidgets('home exibe somente texto de saudação antes do clima', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final controller = demoController('clima');
    await tester.pumpWidget(AgroApp(controller: controller));
    await tester.pumpAndSettle();
    controller.home!['userName'] = 'Matheus Morelli Rodrigues';
    controller.changed();
    await tester.pumpAndSettle();
    expect(find.text('Olá, Matheus'), findsOneWidget);
    expect(
      find.text('Acompanhe sua produção e sua rotina de hoje.'),
      findsOneWidget,
    );
    expect(find.byType(PropertyHeader), findsNothing);
    expect(
      find.descendant(
        of: find.byType(HomeGreeting),
        matching: find.byType(Icon),
      ),
      findsNothing,
    );
    expect(
      tester.getRect(find.byType(HomeGreeting)).bottom,
      lessThan(tester.getRect(find.byType(WeatherSummary)).top),
    );
    expect(find.text('25 °C'), findsOneWidget);
  });
  testWidgets('clima válido mantém a pendência acionável antes da rolagem', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      AgroApp(controller: demoController('clima-pendencia')),
    );
    await tester.pumpAndSettle();
    expect(find.text('25 °C'), findsOneWidget);
    final action = find.text('Responder solicitação');
    expect(
      tester.getRect(action).bottom,
      lessThan(tester.getRect(find.byType(NavigationBar)).top),
    );
    expect(action.hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
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
  test('saudação só utiliza nome pessoal válido disponível', () {
    expect(producerGreeting(null), 'Olá, pequeno produtor!');
    expect(producerGreeting(''), 'Olá, pequeno produtor!');
    expect(producerGreeting('Fictício Teste'), 'Olá, pequeno produtor!');
    expect(producerGreeting('Maria Silva'), 'Olá, Maria!');
  });
  testWidgets('offline apresenta todos os atalhos de rede desativados', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 1450));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(AgroApp(controller: demoController('offline')));
    await tester.pumpAndSettle();
    final actions = tester.widgetList<QuickAction>(find.byType(QuickAction));
    expect(actions.length, 4);
    expect(actions.every((a) => !a.enabled), true);
    expect(tester.widget<PendingCard>(find.byType(PendingCard)).disabled, true);
  });
  testWidgets('primeiro acesso tem uma ação principal sem duplicação no grid', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      AgroApp(controller: demoController('primeiro-acesso')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cadastrar minha primeira produção'), findsOneWidget);
    expect(find.byType(QuickAction), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Outras ações'),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Outras ações'));
    await tester.pumpAndSettle();
    expect(find.byType(QuickAction), findsNWidgets(4));
    expect(find.byIcon(Icons.qr_code_2), findsNothing);
  });
  testWidgets('primeira ação está visível em 390x844 e responde ao teclado', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(AgroApp(controller: demoController('solicitacao')));
    await tester.pumpAndSettle();
    final label = find.text('Responder solicitação');
    expect(tester.getRect(label).center.dy, lessThan(500));
    Focus.of(tester.element(label)).requestFocus();
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(find.text('Meus pedidos'), findsOneWidget);
  });
  testWidgets('uma propriedade não exige abrir seletor sem alternativas', (
    tester,
  ) async {
    await tester.pumpWidget(
      AgroApp(controller: demoController('sem-pendencias')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Trocar propriedade'), findsNothing);
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);
  });
  testWidgets('troca entre propriedades continua disponível e separa o cache', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 1450));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final controller = demoController('sem-pendencias');
    await tester.pumpWidget(AgroApp(controller: controller));
    await tester.pumpAndSettle();
    (controller.catalog['properties'] as List).add({
      'id': 'second-property',
      'name': 'Outra propriedade fictícia',
    });
    controller.changed();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Perfil').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Trocar propriedade'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Outra propriedade fictícia'));
    await tester.pumpAndSettle();
    expect(controller.propertyId, 'second-property');
    expect(await controller.store.get('fixture/second-property'), isNotNull);
    expect(find.text('Outra propriedade fictícia'), findsOneWidget);
  });
  testWidgets('perfil de leitura não recebe ações de alteração habilitadas', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 1450));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final controller = demoController('solicitacao');
    await tester.pumpWidget(AgroApp(controller: controller));
    await tester.pumpAndSettle();
    controller.home!['canWrite'] = false;
    controller.changed();
    await tester.pumpAndSettle();
    final actions = tester
        .widgetList<QuickAction>(find.byType(QuickAction))
        .toList();
    expect(actions.take(2).every((a) => !a.enabled), true);
    expect(actions.skip(2).every((a) => a.enabled), true);
    expect(tester.widget<PendingCard>(find.byType(PendingCard)).disabled, true);
  });
  for (final scenario in scenarios) {
    testWidgets('320px, texto 200%, rolagem: $scenario', (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await tester.pumpWidget(AgroApp(controller: demoController(scenario)));
      if (scenario == 'carregando') {
        await tester.pump(const Duration(milliseconds: 100));
      } else {
        await tester.pumpAndSettle();
      }
      expect(tester.takeException(), isNull);
      for (var i = 0; i < 3; i++) {
        await tester.drag(
          find.byKey(const ValueKey('home-scroll')),
          const Offset(0, -450),
        );
        await tester.pump(const Duration(milliseconds: 200));
        expect(tester.takeException(), isNull);
      }
    });
  }
}
