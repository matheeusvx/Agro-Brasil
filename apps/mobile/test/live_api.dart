// Execução explícita e somente leitura: requer API e seed locais ativos.
import 'dart:convert';
import 'dart:io';

import 'package:agro_mais_brasil/data.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

void main() {
  test(
    'Flutter/Dart consulta home real, catálogo e eventos com autorização',
    () async {
      final sessions = jsonDecode(
        await File('../../.data/demo-sessions.json').readAsString(),
      ) as Json;
      final session = rows(sessions['sessions'])
          .firstWhere((s) => s['type'] == 'PEQUENO_PRODUTOR_RURAL');
      final client = http.Client();
      try {
        final response = await client.get(
          Uri.parse('http://127.0.0.1:3000/api/v1/me'),
          headers: {'Authorization': 'Bearer ${session['token']}'},
        );
        expect(response.statusCode, 200);
        final identity = jsonDecode(response.body) as Json;
        final repository = ApiRepository(
          base: Uri.parse('http://127.0.0.1:3000'),
          token: session['token'],
          organizationId: session['organizationId'],
          userId: identity['userId'],
          organizationName: 'Organização retornada pela sessão',
          client: client,
        );
        final catalog = await repository.read('/catalog');
        expect(rows(catalog['properties']), isNotEmpty);
        final property = rows(catalog['properties']).first;
        final home = await repository.read(
          '/producer-home?propertyId=${property['id']}',
        );
        expect(home['property']['id'], property['id']);
        expect(rows(home['pending']).length, lessThanOrEqualTo(2));
        expect(rows(home['recentLots']).length, lessThanOrEqualTo(2));
        final weather = await repository.read(
          '/properties/${property['id']}/weather',
        );
        expect(['available', 'unavailable'], contains(weather['status']));
        expect(jsonEncode(weather).contains('appid'), false);
        for (final lot in rows(home['recentLots'])) {
          final events = await repository.read('/lots/${lot['id']}/events');
          expect(rows(events['data']), isNotEmpty);
        }
        await File('../../docs/evidencias/flutter-api-real.json').writeAsString(
          const JsonEncoder.withIndent('  ').convert({
            'verifiedAt': DateTime.now().toUtc().toIso8601String(),
            'client': 'Dart HTTP real',
            'readOnly': true,
            'home': home,
            'weather': weather,
          }),
        );
      } finally {
        client.close();
      }
    },
  );
}
