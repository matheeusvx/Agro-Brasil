// Fixtures isoladas. Nunca inseridas no MongoDB ou apresentadas como dados reais.
import 'dart:async';

import 'data.dart';

const scenarios = [
  'solicitacao',
  'clima',
  'primeiro-acesso',
  'retirada',
  'recebimento',
  'sem-pendencias',
  'offline',
  'erro',
  'carregando',
  'clima-pendencia',
];

// Valores exclusivos da galeria, sempre sinalizada como fictícia.
Json demoWeather() => {
  'status': 'available',
  'temperatureC': 25,
  'description': 'Nublado',
  'icon': '04d',
  'observedAt': '2026-11-05T12:00:00Z',
  'locality': {'municipality': 'São Paulo', 'uf': 'SP', 'approximate': true},
};

class MemoryStore implements SnapshotStore {
  final Map<String, Json> values = {};
  @override
  Future<Json?> get(String key) async => values[key];
  @override
  Future<void> put(String key, Json value) async {
    values[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }
}

Json demoHome(String scenario) {
  final status = scenario == 'retirada'
      ? 'ACEITO'
      : scenario == 'recebimento'
      ? 'RETIRADO'
      : 'SOLICITADO';
  return {
    'property': {
      'id': 'demo-property',
      'name': 'Sítio Boa Esperança · fictício',
      'municipality': 'São Paulo',
      'uf': 'SP',
    },
    'hasProductions': scenario != 'primeiro-acesso',
    'canWrite': true,
    'isDemonstration': true,
    'fetchedAt': '2026-11-05T12:00:00Z',
    'weather': {'status': 'unavailable'},
    'pending': ['primeiro-acesso', 'sem-pendencias', 'clima'].contains(scenario)
        ? <Json>[]
        : [
            {
              'id': 'demo-order',
              'lotId': 'demo-lot',
              'status': status,
              'cropName': 'Alface',
              'quantityKg': 4,
              'shipmentId': status == 'SOLICITADO' ? null : 'demo-shipment',
            },
          ],
    'recentLots': scenario == 'primeiro-acesso'
        ? <Json>[]
        : [
            {
              'id': 'demo-lot',
              'cropName': 'Alface',
              'quantityKg': 12.5,
              'lastEvent': {
                'type': scenario == 'recebimento'
                    ? 'RETIRADA_REGISTRADA'
                    : 'ORIGEM_REGISTRADA',
                'recordedAt': '2026-11-05T12:00:00Z',
                'location': {'municipality': 'São Paulo', 'uf': 'SP'},
              },
            },
            {
              'id': 'demo-lot-2',
              'cropName': 'Tomate',
              'quantityKg': 8,
              'lastEvent': {
                'type': 'RECEBIMENTO_CONFIRMADO',
                'recordedAt': '2026-11-04T16:00:00Z',
                'location': {'municipality': 'São Paulo', 'uf': 'SP'},
              },
            },
          ],
  };
}

class DemoRepository implements Repository {
  final String scenario;
  DemoRepository(this.scenario);
  @override
  String get scope => 'fixture';
  @override
  String get organizationName => 'Pequeno produtor rural · demonstração';
  @override
  bool get demonstration => true;
  @override
  bool get fixture => true;
  @override
  Future<Json> read(String path) async {
    if (path == '/catalog') {
      return {
        'properties': [demoHome(scenario)['property']],
        'crops': [
          {'id': 'demo-crop', 'name': 'Alface'},
        ],
      };
    }
    if (scenario == 'carregando') return Completer<Json>().future;
    if (scenario == 'erro' || scenario == 'offline') {
      throw ApiFailure(
        0,
        'Não foi possível conectar ao serviço. Tente novamente.',
      );
    }
    if (path.startsWith('/producer-home')) return demoHome(scenario);
    if (path.endsWith('/weather')) {
      return scenario.startsWith('clima')
          ? demoWeather()
          : {'status': 'unavailable'};
    }
    final productions = [
      {
        'id': 'demo-production',
        'propertyId': 'demo-property',
        'cropName': 'Alface',
        'quantityKg': 12.5,
        'cropId': 'demo-crop',
        'harvestedOn': '2026-10-20',
        'seasonLabel': 'Primavera 2026',
        'lot': {'id': 'demo-lot'},
      },
      {
        'id': 'demo-production-2',
        'propertyId': 'demo-property',
        'cropName': 'Tomate',
        'quantityKg': 8,
        'cropId': 'demo-tomate',
        'harvestedOn': '2026-11-01',
        'seasonLabel': 'Primavera 2026',
        'lot': {'id': 'demo-lot-2'},
      },
    ];
    if (path.startsWith('/productions')) {
      return {'data': scenario == 'primeiro-acesso' ? <Json>[] : productions};
    }
    if (path.startsWith('/offers')) {
      return {
        'data': scenario == 'primeiro-acesso'
            ? <Json>[]
            : [
                {
                  'id': 'demo-offer',
                  'lotId': 'demo-lot',
                  'cropName': 'Alface',
                  'availableKg': 8.5,
                  'quantityKg': 12.5,
                  'destinationMode': 'VENDA',
                  'availableUntil': '2027-01-01T00:00:00Z',
                  'status': 'PUBLICADA',
                },
                {
                  'id': 'demo-offer-2',
                  'lotId': 'demo-lot-2',
                  'cropName': 'Tomate',
                  'availableKg': 8,
                  'quantityKg': 8,
                  'destinationMode': 'DOACAO',
                  'availableUntil': '2027-01-01T00:00:00Z',
                  'status': 'RASCUNHO',
                },
              ],
      };
    }
    if (path.startsWith('/orders')) {
      return {
        'data': [
          {
            'id': 'demo-order',
            'offerId': 'demo-offer',
            'lotId': 'demo-lot',
            'cropName': 'Alface',
            'quantityKg': 4,
            'status': scenario == 'retirada'
                ? 'ACEITO'
                : scenario == 'recebimento'
                ? 'RETIRADO'
                : 'SOLICITADO',
            if (scenario == 'retirada' || scenario == 'recebimento')
              'shipment': {
                'id': 'demo-shipment',
                'carrierOrganizationId': null,
              },
          },
        ],
      };
    }
    if (path.startsWith('/lots/')) {
      return {
        'data': [
          {
            'type': 'ORIGEM_REGISTRADA',
            'recordedAt': '2026-11-04T12:00:00Z',
            'location': {'municipality': 'São Paulo', 'uf': 'SP'},
          },
          {
            'type': 'OFERTA_PUBLICADA',
            'recordedAt': '2026-11-04T14:00:00Z',
            'location': {'municipality': 'São Paulo', 'uf': 'SP'},
          },
          if (scenario == 'recebimento')
            {
              'type': 'RETIRADA_REGISTRADA',
              'recordedAt': '2026-11-05T12:00:00Z',
              'location': {'municipality': 'São Paulo', 'uf': 'SP'},
            },
        ],
      };
    }

    return {
      'data': <Json>[],
      'pagination': {'total': 0},
    };
  }

  @override
  Future<Json> write(String path, Json body, {String? key}) async =>
      throw ApiFailure(403, 'A galeria é demonstrativa e não grava dados.');
}

HomeController demoController(String scenario) {
  final store = MemoryStore();
  if (scenario == 'offline') {
    store.values['fixture/demo-property'] = {
      ...demoHome('recebimento'),
      'weather': demoWeather(),
    };
  }
  return HomeController(DemoRepository(scenario), store);
}
