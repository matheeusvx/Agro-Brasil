// Execução explícita: requer `node scripts/serve-logistics-android.mjs` ativo.
// Valida o painel contra Express/MongoDB reais, sem mock HTTP.
import 'dart:convert';
import 'dart:io';

import 'package:agro_mais_brasil/data.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:agro_mais_brasil/territorial/logistics_data.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

void main() {
  test('painel lê pedidos e eventos reais, isolados por organização', () async {
    final session =
        jsonDecode(
              await File(
                '../../.data/logistics-android/session.json',
              ).readAsString(),
            )
            as Json;
    final client = http.Client();
    HomeController open(String organization) => HomeController(
      ApiRepository(
        base: Uri.parse('http://127.0.0.1:${session['port']}'),
        token: session['token'],
        organizationId: organization,
        userId: session['userId'],
        organizationName: 'Teste',
        client: client,
      ),
      MemoryStore(),
    );
    try {
      final a = open(session['organizationId']);
      a.catalog = await a.repository.read('/catalog');
      final repository = LogisticsDashboardRepository(a);
      final main = LogisticsSummary(
        (await repository.load(session['mainPropertyId'])).$1,
      );
      expect(main.inProgress, 6);
      expect(main.inProgressGrams, 35500);
      expect(main.received, 3);
      expect(main.byStatus['SOLICITADO']!.length, 2);
      expect(main.byStatus['ACEITO']!.length, 2);
      expect(main.byStatus['RETIRADO']!.length, 2);
      expect(main.byStatus['CANCELADO']!.length, 2);
      expect(main.actions.map((o) => o['status']).toList(), [
        'SOLICITADO',
        'SOLICITADO',
        'ACEITO',
      ]);
      expect(main.direct, 4);
      expect(main.cooperative, 3);
      expect(main.unlocated, 0);
      final places = {
        for (final p in main.places)
          '${p.municipality}/${p.uf}': [p.pickups, p.receipts],
      };
      expect(places, {
        'Mogi das Cruzes/SP': [3, 0],
        'Suzano/SP': [2, 0],
        'São Paulo/SP': [0, 2],
        'Guarulhos/SP': [0, 1],
      });
      final empty = LogisticsSummary(
        (await repository.load(session['emptyPropertyId'])).$1,
      );
      expect(empty.total, 0);
      // Property of another organization is unknown in this session.
      await expectLater(
        repository.load(session['otherPropertyId']),
        throwsA(isA<ApiFailure>().having((e) => e.status, 'status', 403)),
      );
      final b = open(session['otherOrganizationId']);
      b.catalog = await b.repository.read('/catalog');
      final other = LogisticsSummary(
        (await LogisticsDashboardRepository(
          b,
        ).load(session['otherPropertyId'])).$1,
      );
      expect(other.total, 1);
      expect(other.received, 1);
      expect(other.places.map((p) => p.municipality).toSet(), {
        'Ibiúna',
        'Sorocaba',
      });
    } finally {
      client.close();
    }
  });
}
