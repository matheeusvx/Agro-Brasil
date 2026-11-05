import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

typedef Json = Map<String, dynamic>;
List<Json> rows(dynamic value) => (value as List? ?? [])
    .map((e) => Map<String, dynamic>.from(e as Map))
    .toList();

class ApiFailure implements Exception {
  final int status;
  final String message;
  ApiFailure(this.status, this.message);
  @override
  String toString() => message;
}

abstract class Repository {
  String get scope;
  String get organizationName;
  bool get demonstration;
  bool get fixture;
  Future<Json> read(String path);
  Future<Json> write(String path, Json body, {String? key});
}

class ApiRepository implements Repository {
  final Uri base;
  final String token;
  final String organizationId;
  final String userId;
  final List<Json> organizations;
  @override
  final String organizationName;
  @override
  final bool demonstration;
  final http.Client client;
  ApiRepository({
    required this.base,
    required this.token,
    required this.organizationId,
    required this.userId,
    this.organizations = const [],
    required this.organizationName,
    this.demonstration = true,
    http.Client? client,
  }) : client = client ?? http.Client() {
    if (!['127.0.0.1', 'localhost', '::1'].contains(base.host) ||
        base.scheme != 'http') {
      throw ArgumentError(
        'A identidade demonstrativa está restrita ao servidor local.',
      );
    }
  }
  @override
  bool get fixture => false;
  @override
  String get scope => '${base.origin}/$userId/$organizationId';
  Future<Json> _request(String path, Json? body, String? key) async {
    try {
      final url = base.resolve('/api/v1$path');
      final headers = {
        'Authorization': 'Bearer $token',
        'X-Organization-Id': organizationId,
        if (body != null) 'Content-Type': 'application/json',
        'Idempotency-Key': ?key,
      };
      final response =
          await (body == null
                  ? client.get(url, headers: headers)
                  : client.post(url, headers: headers, body: jsonEncode(body)))
              .timeout(const Duration(seconds: 12));
      final data = jsonDecode(response.body) as Json;
      if (response.statusCode >= 400) {
        throw ApiFailure(
          response.statusCode,
          data['error']?['message'] as String? ??
              'Não foi possível concluir a operação.',
        );
      }
      return data;
    } on ApiFailure {
      rethrow;
    } on Object {
      throw ApiFailure(
        0,
        'Não foi possível conectar ao serviço. Tente novamente.',
      );
    }
  }

  @override
  Future<Json> read(String path) => _request(path, null, null);
  @override
  Future<Json> write(String path, Json body, {String? key}) =>
      _request(path, body, key);
}

String commandKey() => List.generate(
  24,
  (_) => Random.secure().nextInt(256).toRadixString(16).padLeft(2, '0'),
).join();

abstract class SnapshotStore {
  Future<Json?> get(String key);
  Future<void> put(String key, Json value);
  Future<void> remove(String key);
}

class LocalStore implements SnapshotStore {
  @override
  Future<Json?> get(String key) async {
    final value = (await SharedPreferences.getInstance()).getString(
      'agro-home:$key',
    );
    try {
      return value == null ? null : jsonDecode(value) as Json;
    } on Object {
      return null;
    }
  }

  @override
  Future<void> put(String key, Json value) async {
    await (await SharedPreferences.getInstance()).setString(
      'agro-home:$key',
      jsonEncode(value),
    );
  }

  @override
  Future<void> remove(String key) async {
    await (await SharedPreferences.getInstance()).remove('agro-home:$key');
  }
}

class HomeController extends ChangeNotifier {
  final Repository repository;
  final SnapshotStore store;
  Json? home;
  Json catalog = {'properties': <Json>[], 'crops': <Json>[]};
  String? propertyId;
  String? error;
  bool loading = true;
  bool offline = false;
  bool disposed = false;
  int _request = 0;
  HomeController(this.repository, this.store);
  List<Json> get properties => rows(catalog['properties']);
  bool get canWrite =>
      home?['canWrite'] == true && !offline && !loading && !repository.fixture;
  void changed() {
    if (!disposed) notifyListeners();
  }

  Future<void> start() async {
    try {
      catalog = await repository.read('/catalog');
      try {
        await store.put('${repository.scope}/catalog', catalog);
      } on Object {
        /* Cache indisponível não impede consulta online. */
      }
    } on ApiFailure catch (failure) {
      if (failure.status != 0 && failure.status < 500) {
        await store.remove('${repository.scope}/catalog');
        loading = false;
        error = failure.message;
        changed();
        return;
      }
      final cached = await store.get('${repository.scope}/catalog');
      if (cached == null) {
        loading = false;
        error = failure.message;
        changed();
        return;
      }
      catalog = cached;
    }
    propertyId = properties.firstOrNull?['id'] as String?;
    if (propertyId == null) {
      loading = false;
      error = 'Nenhuma propriedade cadastrada nesta organização. Cadastre-a com o responsável antes de continuar.';
      changed();
      return;
    }
    await load(propertyId!);
  }

  Future<void> load(String id) async {
    final request = ++_request;
    propertyId = id;
    loading = true;
    error = null;
    offline = false;
    home = null;
    changed();
    final key = '${repository.scope}/$id';
    try {
      final result = await repository.read('/producer-home?propertyId=$id');
      Json weather;
      try {
        weather = await repository.read('/properties/$id/weather');
      } on ApiFailure catch (failure) {
        if (failure.status == 401 ||
            failure.status == 403 ||
            failure.status == 404) {
          rethrow;
        }
        weather = {'status': 'unavailable'};
      }
      if (request != _request || disposed) return;
      home = {...result, 'weather': weather};
      try {
        await store.put(key, home!);
      } on Object {
        /* Cache não impede uso online. */
      }
    } on ApiFailure catch (failure) {
      if (request != _request || disposed) return;
      if (failure.status == 0 || failure.status >= 500) {
        home = await store.get(key);
        offline = home != null;
      } else {
        await store.remove(key);
      }
      if (home == null) error = failure.message;
    } on Object {
      if (request == _request) {
        error = 'Não foi possível carregar a tela. Tente novamente.';
      }
    }
    if (request == _request) {
      loading = false;
      changed();
    }
  }

  Future<void> clear() async {
    ++_request;
    for (final property in properties) {
      await store.remove('${repository.scope}/${property['id']}');
    }
    await store.remove('${repository.scope}/catalog');
    home = null;
  }

  @override
  void dispose() {
    disposed = true;
    ++_request;
    super.dispose();
  }
}
