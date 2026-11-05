import 'dart:convert';

import 'package:agro_mais_brasil/data.dart';
import 'package:agro_mais_brasil/demo.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class SwitchRepository extends DemoRepository {
  int failure = -1;
  SwitchRepository() : super('solicitacao');
  @override
  bool get fixture => false;
  @override
  Future<Json> read(String path) {
    if (failure >= 0) {
      return Future.error(ApiFailure(failure, 'falha de teste'));
    }
    return super.read(path);
  }
}

void main() {
  test('HTTP usa identidade e organização, sem chave meteorológica', () async {
    final repo = ApiRepository(
      base: Uri.parse('http://127.0.0.1:3000'),
      token: 'fixture-token',
      organizationId: 'org',
      userId: 'user',
      organizationName: 'Teste',
      client: MockClient((request) async {
        expect(request.url.path, '/api/v1/producer-home');
        expect(request.headers['Authorization'], 'Bearer fixture-token');
        expect(request.headers['X-Organization-Id'], 'org');
        expect(request.url.queryParameters.containsKey('appid'), false);
        return http.Response(jsonEncode(demoHome('solicitacao')), 200);
      }),
    );
    expect(
      (await repo.read('/producer-home?propertyId=p'))['hasProductions'],
      true,
    );
  });
  test(
    'cache é por ator, organização e propriedade; offline é somente leitura',
    () async {
      final repo = SwitchRepository();
      final store = MemoryStore();
      final controller = HomeController(repo, store);
      await controller.start();
      expect(controller.canWrite, true);
      expect(controller.offline, false);
      repo.failure = 0;
      await controller.load('demo-property');
      expect(controller.offline, true);
      expect(controller.canWrite, false);
      expect(controller.home, isNotNull);
      await controller.load('outra-propriedade');
      expect(controller.home, isNull);
      expect(controller.error, isNotNull);
      expect(
        store.values.keys.any((key) => key.contains('demo-property')),
        true,
      );
      controller.dispose();
    },
  );
  test('401 nunca reutiliza cache para contornar autorização', () async {
    final repo = SwitchRepository();
    final store = MemoryStore();
    final controller = HomeController(repo, store);
    await controller.start();
    repo.failure = 401;
    await controller.load('demo-property');
    expect(controller.home, isNull);
    expect(controller.offline, false);
    expect(store.values['fixture/demo-property'], isNull);
    controller.dispose();
  });
  test('sair remove os snapshots do escopo atual', () async {
    final store = MemoryStore();
    final controller = HomeController(SwitchRepository(), store);
    await controller.start();
    await controller.clear();
    expect(store.values, isEmpty);
    controller.dispose();
  });
}
