import 'package:agro_mais_brasil/home.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Fixtures explícitas: não são consultas nem evidências meteorológicas reais.
Map<String, dynamic> fixture(String city) => {
  'status': 'available',
  'temperatureC': 23.4,
  'description': 'condição fictícia de teste',
  'observedAt': '2026-11-05T12:00:00Z',
  'locality': {'municipality': city, 'uf': 'SP', 'approximate': true},
};
void main() {
  testWidgets(
    'referência, condição, horário e atribuição; troca de propriedade',
    (tester) async {
      Future<void> show(String city) => tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: WeatherSummary(weather: fixture(city))),
        ),
      );
      await show('São Paulo');
      expect(find.textContaining('São Paulo/SP'), findsOneWidget);
      expect(find.textContaining('23 °C'), findsOneWidget);
      expect(find.textContaining('Observação:'), findsOneWidget);
      expect(
        find.textContaining('fornecidos pela OpenWeather'),
        findsOneWidget,
      );
      await show('Campinas');
      expect(find.textContaining('Campinas/SP'), findsOneWidget);
      expect(find.textContaining('São Paulo/SP'), findsNothing);
    },
  );
  testWidgets('cache offline não é apresentado como observação atual', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WeatherSummary(weather: fixture('Campinas'), offline: true),
        ),
      ),
    );
    expect(find.textContaining('não é uma observação atual'), findsOneWidget);
    expect(find.textContaining('Observação:'), findsOneWidget);
    expect(find.textContaining('23 °C'), findsOneWidget);
  });
  testWidgets('sem fonte válida mostra somente indisponibilidade discreta', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: WeatherSummary(weather: {'status': 'unavailable'}),
        ),
      ),
    );
    expect(find.text('Clima indisponível'), findsOneWidget);
    expect(find.textContaining('°C'), findsNothing);
  });
  testWidgets('clima em 320px com texto 200% não transborda', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: SingleChildScrollView(
              child: WeatherSummary(
                weather: fixture('São Paulo'),
                offline: true,
              ),
            ),
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
  });
}
