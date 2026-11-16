import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/main.dart';
import 'package:agro_mais_brasil/profile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('preferências do perfil fazem ida e volta em JSON', () {
    const prefs = ProfilePrefs(
      displayName: 'Ana',
      about: 'Hortaliças',
      crops: ['Alface'],
      avatarTone: 3,
      largerText: true,
      reduceMotion: true,
    );
    final back = ProfilePrefs.fromJson(prefs.toJson());
    expect(back.displayName, 'Ana');
    expect(back.crops, ['Alface']);
    expect(back.avatarTone, 3);
    expect(back.largerText, true);
    expect(ProfilePrefs.fromJson({'avatarTone': 99}).avatarTone, 4);
    expect(profileInitials('Maria da Silva'), 'MD');
    expect(profileInitials('  '), 'A+');
  });

  testWidgets('perfil sem ilustração ao lado do título e com edição', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final controller = demoController('clima');
    await tester.pumpWidget(AgroApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Perfil').last);
    await tester.pumpAndSettle();
    expect(find.text('Meu perfil'), findsOneWidget);
    expect(find.text('Editar perfil'), findsOneWidget);
    expect(find.text('Texto maior'), findsOneWidget);
    expect(find.textContaining('somente nesta sessão'), findsNothing);
    expect(find.textContaining('Demonstração local'), findsNothing);

    await tester.tap(find.text('Editar perfil'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Joana Lima');
    await tester.pump();
    expect(find.text('JL'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Cor 3'));
    await tester.ensureVisible(find.text('Salvar alterações'));
    await tester.tap(find.text('Salvar alterações'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Perfil salvo'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();

    expect(find.text('Joana Lima'), findsOneWidget);
    expect(appPrefs.value.avatarTone, 2);
    expect(
      await controller.store.get('${controller.repository.scope}/profile'),
      isNotNull,
    );
    await tester.tap(find.text('Início').last);
    await tester.pumpAndSettle();
    expect(find.text('Olá, Joana'), findsOneWidget);
  });

  testWidgets('texto maior e reduzir animações valem para o app', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(AgroApp(controller: demoController('clima')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Perfil').last);
    await tester.pumpAndSettle();
    final context = tester.element(find.text('Meu perfil'));
    final before = MediaQuery.textScalerOf(context).scale(10);
    await tester.tap(find.text('Texto maior'));
    await tester.tap(find.text('Reduzir animações'));
    await tester.pumpAndSettle();
    expect(appPrefs.value.largerText, true, reason: 'prefs');
    final after = tester.element(find.text('Meu perfil'));
    expect(MediaQuery.textScalerOf(after).scale(10), greaterThan(before));
    expect(MediaQuery.disableAnimationsOf(after), true);
    expect(tester.takeException(), isNull);
  });
}
