import 'dart:convert';

import 'package:flutter/material.dart';

import 'data.dart';
import 'home.dart';

Future<List<Json>> allRows(Repository repository, String endpoint) async {
  final result = <Json>[];
  for (var offset = 0; offset < 10000; offset += 100) {
    final page = await repository.read(
      '$endpoint${endpoint.contains('?') ? '&' : '?'}limit=100&offset=$offset',
    );
    final batch = rows(page['data']);
    result.addAll(batch);
    if (batch.length < 100 ||
        result.length >=
            (page['pagination']?['total'] as num? ?? result.length)) {
      return result;
    }
  }
  throw ApiFailure(
    400,
    'Há muitos registros para esta visão inicial. Utilize o módulo web.',
  );
}

class TaskPage extends StatefulWidget {
  final HomeController controller;
  final String kind;
  final String? focusId;
  const TaskPage({
    super.key,
    required this.controller,
    required this.kind,
    this.focusId,
  });
  @override
  State<TaskPage> createState() => _TaskPageState();
}

class _TaskPageState extends State<TaskPage> {
  late Future<List<Json>> future;
  final keys = <String, String>{};
  HomeController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    future = load();
  }

  Future<List<Json>> load() async {
    if (c.offline) {
      throw ApiFailure(
        0,
        'Somente a home e suas últimas movimentações estão disponíveis offline. Reconecte para consultar a lista completa.',
      );
    }
    final productions = (await allRows(
      c.repository,
      '/productions',
    )).where((p) => p['propertyId'] == c.propertyId).toList();
    if (widget.kind == 'production' || widget.kind == 'lots') {
      return productions;
    }
    final ids = productions.map((p) => p['lot']['id']).toSet();
    final data = await allRows(
      c.repository,
      widget.kind == 'offers' ? '/offers?scope=mine' : '/orders',
    );
    return data
        .where(
          (p) =>
              ids.contains(p['lotId']) &&
              (widget.focusId == null || p['id'] == widget.focusId),
        )
        .toList();
  }

  Future<void> act(String path, {bool accept = false}) async {
    final location = await showDialog<Json>(
      context: context,
      builder: (_) => OperationDialog(controller: c, accept: accept),
    );
    if (location == null || !c.canWrite) return;
    final signature = '$path:${jsonEncode(location)}';
    final key = keys.putIfAbsent(signature, commandKey);
    try {
      await c.repository.write(path, location, key: key);
      keys.remove(signature);
      if (!mounted) return;
      setState(() => future = load());
      if (c.propertyId != null) await c.load(c.propertyId!);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Operação registrada.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.kind) {
      'production' => 'Minha produção',
      'offers' => 'Minhas ofertas',
      'orders' => 'Meus pedidos',
      _ => 'Meus lotes',
    };
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            if (c.repository.fixture)
              const InfoStrip(
                icon: Icons.science_outlined,
                text: 'Galeria de cenários fictícios. A navegação é demonstrável; gravações ficam desativadas.',
              ),
            if ((widget.kind == 'production' || widget.kind == 'offers') &&
                c.canWrite)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: FilledButton.icon(
                  onPressed: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => EntryPage(
                          controller: c,
                          kind: widget.kind == 'production'
                              ? 'production'
                              : 'offer',
                        ),
                      ),
                    );
                    if (c.propertyId != null) await c.load(c.propertyId!);
                    if (mounted) setState(() => future = load());
                  },
                  icon: const Icon(Icons.add),
                  label: Text(
                    widget.kind == 'production'
                        ? 'Cadastrar produção'
                        : 'Oferecer produtos',
                  ),
                ),
              ),
            FutureBuilder<List<Json>>(
              future: future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Padding(
                    padding: EdgeInsets.all(20),
                    child: LinearProgressIndicator(),
                  );
                }
                if (snapshot.hasError) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(snapshot.error.toString()),
                      TextButton(
                        onPressed: () => setState(() => future = load()),
                        child: const Text('Tentar novamente'),
                      ),
                    ],
                  );
                }
                final data = snapshot.data!;
                if (data.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Text(
                      'Nenhum registro disponível nesta propriedade.',
                    ),
                  );
                }
                return Column(
                  children: data.map((item) {
                    if (widget.kind == 'production' || widget.kind == 'lots') {
                      return Card(
                        child: ListTile(
                          title: Text(
                            '${item['cropName']} · ${item['quantityKg']} kg',
                          ),
                          subtitle: Text(
                            'Safra ${item['seasonLabel']}\nLote ${item['lot']['id']}',
                          ),
                          isThreeLine: true,
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => HistoryPage(
                                controller: c,
                                lotId: item['lot']['id'],
                              ),
                            ),
                          ),
                        ),
                      );
                    }
                    final offer = widget.kind == 'offers';
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              offer
                                  ? '${item['cropName']} · ${item['availableKg']} kg disponíveis'
                                  : 'Pedido de ${item['quantityKg']} kg',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Text('Estado: ${item['status']}'),
                            SelectableText(
                              'Identificador: ${item['id']}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            if (!offer && item['shipment'] != null)
                              Text(
                                item['shipment']['carrierOrganizationId'] ==
                                        null
                                    ? 'Operação direta, sem cooperativa.'
                                    : 'Cooperativa designada nesta operação.',
                              ),
                            if (c.canWrite &&
                                offer &&
                                item['status'] == 'RASCUNHO')
                              FilledButton(
                                onPressed: () =>
                                    act('/offers/${item['id']}/publish'),
                                child: const Text('Publicar oferta'),
                              ),
                            if (c.canWrite &&
                                !offer &&
                                item['status'] == 'SOLICITADO')
                              FilledButton(
                                onPressed: () => act(
                                  '/orders/${item['id']}/accept',
                                  accept: true,
                                ),
                                child: const Text(
                                  'Aceitar solicitação e reservar',
                                ),
                              ),
                            if (c.canWrite &&
                                !offer &&
                                [
                                  'SOLICITADO',
                                  'ACEITO',
                                ].contains(item['status']))
                              OutlinedButton(
                                onPressed: () =>
                                    act('/orders/${item['id']}/cancel'),
                                child: const Text('Cancelar pedido'),
                              ),
                            if (c.canWrite &&
                                !offer &&
                                item['status'] == 'ACEITO')
                              FilledButton(
                                onPressed: () => act(
                                  '/shipments/${item['shipment']['id']}/pickup',
                                ),
                                child: const Text('Registrar retirada'),
                              ),
                            if (!offer && item['status'] == 'RETIRADO')
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 12),
                                child: Text(
                                  'O destinatário deve confirmar o recebimento.',
                                ),
                              ),
                            if (!offer && item['shipment'] != null)
                              TextButton(
                                onPressed: () => Navigator.push(
                                  context,
                                  MaterialPageRoute<void>(
                                    builder: (_) => HistoryPage(
                                      controller: c,
                                      lotId: item['lotId'],
                                    ),
                                  ),
                                ),
                                child: const Text('Consultar histórico'),
                              ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class OperationDialog extends StatefulWidget {
  final HomeController controller;
  final bool accept;
  const OperationDialog({
    super.key,
    required this.controller,
    this.accept = false,
  });
  @override
  State<OperationDialog> createState() => _OperationDialogState();
}

class _OperationDialogState extends State<OperationDialog> {
  late final TextEditingController city;
  late final TextEditingController uf;
  bool confirmed = false;
  String? cooperative;
  List<Json> cooperatives = [];
  @override
  void initState() {
    super.initState();
    final property = widget.controller.home?['property'];
    city = TextEditingController(text: property?['municipality']);
    uf = TextEditingController(text: property?['uf']);
    if (widget.accept) loadCooperatives();
  }

  Future<void> loadCooperatives() async {
    try {
      final result = await widget.controller.repository.read('/cooperatives');
      if (mounted) setState(() => cooperatives = rows(result['data']));
    } on Object {
      /* Operação direta continua disponível. */
    }
  }

  @override
  void dispose() {
    city.dispose();
    uf.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Confirmar operação'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: city,
            decoration: const InputDecoration(
              labelText: 'Município da operação',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: uf,
            maxLength: 2,
            decoration: const InputDecoration(labelText: 'UF'),
          ),
          if (widget.accept)
            DropdownButtonFormField<String>(
              initialValue: '',
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Cooperativa opcional',
              ),
              items: [
                const DropdownMenuItem(
                  value: '',
                  child: Text('Operação direta'),
                ),
                ...cooperatives.map(
                  (p) => DropdownMenuItem<String>(
                    value: p['id'],
                    child: Text(p['name'], overflow: TextOverflow.ellipsis),
                  ),
                ),
              ],
              onChanged: (v) => cooperative = v,
            ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: confirmed,
            title: const Text('Confirmo a localização desta operação.'),
            onChanged: (v) => setState(() => confirmed = v == true),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Voltar'),
      ),
      FilledButton(
        onPressed: !confirmed
            ? null
            : () {
                if (city.text.trim().isEmpty || uf.text.trim().length != 2) {
                  return;
                }
                Navigator.pop(context, {
                  'location': {
                    'municipality': city.text.trim(),
                    'uf': uf.text.trim().toUpperCase(),
                  },
                  'locationConfirmed': true,
                  if (widget.accept &&
                      cooperative != null &&
                      cooperative!.isNotEmpty)
                    'cooperativeOrganizationId': cooperative,
                });
              },
        child: const Text('Confirmar'),
      ),
    ],
  );
}

class EntryPage extends StatefulWidget {
  final HomeController controller;
  final String kind;
  const EntryPage({super.key, required this.controller, required this.kind});
  @override
  State<EntryPage> createState() => _EntryPageState();
}

class _EntryPageState extends State<EntryPage> {
  final form = GlobalKey<FormState>();
  final quantity = TextEditingController();
  final season = TextEditingController();
  final date = TextEditingController(
    text: DateTime.now().toIso8601String().substring(0, 10),
  );
  final city = TextEditingController();
  final uf = TextEditingController();
  final price = TextEditingController(text: '0');
  String? selection;
  String mode = 'DOACAO';
  bool confirmed = false;
  bool saving = false;
  String? error;
  List<Json> choices = [];
  bool loading = true;
  final keys = <String, String>{};
  bool get production => widget.kind == 'production';
  HomeController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    city.text = c.home?['property']?['municipality'] ?? '';
    uf.text = c.home?['property']?['uf'] ?? '';
    load();
  }

  Future<void> load() async {
    try {
      if (production) {
        choices = rows(c.catalog['crops']);
      } else if (c.offline || c.repository.fixture) {
        choices = [];
      } else {
        final offers = await allRows(c.repository, '/offers?scope=mine');
        final used = offers.map((o) => o['lotId']).toSet();
        choices = (await allRows(c.repository, '/productions'))
            .where(
              (p) =>
                  p['propertyId'] == c.propertyId &&
                  !used.contains(p['lot']['id']),
            )
            .map(
              (p) => {
                'id': p['lot']['id'],
                'name': '${p['cropName']} · ${p['quantityKg']} kg',
              },
            )
            .toList();
      }
      selection = choices.firstOrNull?['id'];
    } catch (failure) {
      error = failure.toString();
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  void dispose() {
    for (final field in [quantity, season, date, city, uf, price]) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate() || !c.canWrite || selection == null) {
      return;
    }
    if (production && !confirmed) {
      setState(() => error = 'Confirme a localização de origem.');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    final mass = double.tryParse(quantity.text.replaceAll(',', '.'));
    final body = production
        ? <String, dynamic>{
            'propertyId': c.propertyId,
            'cropId': selection,
            'seasonLabel': season.text.trim(),
            'quantityKg': mass,
            'harvestedOn': date.text.trim(),
            'location': {
              'municipality': city.text.trim(),
              'uf': uf.text.trim().toUpperCase(),
            },
            'locationConfirmed': confirmed,
          }
        : <String, dynamic>{
            'lotId': selection,
            'quantityKg': mass,
            'destinationMode': mode,
            'unitPriceCents': int.tryParse(price.text),
            'availableUntil': DateTime.tryParse('${date.text.trim()}T23:59:00')
                ?.toUtc()
                .toIso8601String(),
          };
    final endpoint = production ? '/productions' : '/offers';
    final key = keys.putIfAbsent(jsonEncode(body), commandKey);
    try {
      await c.repository.write(endpoint, body, key: key);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              production
                  ? 'Produção e lote registrados.'
                  : 'Rascunho criado. Publique-o na aba Ofertas.',
            ),
          ),
        );
        Navigator.pop(context);
      }
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(production ? 'Cadastrar produção' : 'Oferecer produtos'),
    ),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 680),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (!c.canWrite)
              const InfoStrip(
                icon: Icons.lock_outline,
                text: 'Somente consulta: sem permissão, sem conexão ou cenário demonstrativo. Nenhum envio será realizado.',
              ),
            if (loading)
              const LinearProgressIndicator()
            else
              Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (choices.isEmpty)
                      Text(
                        production ? 'Nenhuma cultura disponível.' : 'Nenhum lote disponível para nova oferta. Cadastre uma produção ou confira as ofertas existentes.',
                      ),
                    if (choices.isNotEmpty)
                      DropdownButtonFormField<String>(
                        initialValue: selection,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: production ? 'Cultura' : 'Lote',
                        ),
                        items: choices
                            .map(
                              (p) => DropdownMenuItem<String>(
                                value: p['id'],
                                child: Text(
                                  p['name'],
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => selection = v,
                      ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: quantity,
                      decoration: const InputDecoration(
                        labelText: 'Quantidade (kg)',
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      validator: (value) {
                        final number = double.tryParse(
                          (value ?? '').replaceAll(',', '.'),
                        );
                        return number == null || !number.isFinite || number <= 0
                            ? 'Informe uma quantidade positiva.'
                            : null;
                      },
                    ),
                    if (production) ...[
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: season,
                        maxLength: 60,
                        decoration: const InputDecoration(labelText: 'Safra'),
                        validator: requiredText,
                      ),
                    ],
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: date,
                      decoration: InputDecoration(
                        labelText: production
                            ? 'Data da colheita (AAAA-MM-DD)'
                            : 'Validade da oferta (AAAA-MM-DD)',
                      ),
                      validator: (value) =>
                          DateTime.tryParse(value ?? '') == null
                          ? 'Informe uma data válida.'
                          : null,
                    ),
                    if (production) ...[
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: city,
                        maxLength: 120,
                        decoration: const InputDecoration(
                          labelText: 'Município de origem',
                        ),
                        validator: requiredText,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: uf,
                        maxLength: 2,
                        decoration: const InputDecoration(labelText: 'UF'),
                        validator: requiredText,
                      ),
                      CheckboxListTile(
                        value: confirmed,
                        title: const Text('Confirmo a localização de origem.'),
                        onChanged: (v) => setState(() => confirmed = v == true),
                      ),
                    ] else ...[
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        initialValue: mode,
                        decoration: const InputDecoration(labelText: 'Destino'),
                        items: const [
                          DropdownMenuItem(
                            value: 'DOACAO',
                            child: Text('Doação'),
                          ),
                          DropdownMenuItem(
                            value: 'VENDA',
                            child: Text('Venda'),
                          ),
                        ],
                        onChanged: (v) => setState(() {
                          mode = v!;
                          if (mode == 'DOACAO') price.text = '0';
                        }),
                      ),
                      if (mode == 'VENDA') ...[
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: price,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Preço por kg em centavos',
                          ),
                          validator: (value) =>
                              (int.tryParse(value ?? '') ?? 0) <= 0
                              ? 'Informe centavos inteiros positivos.'
                              : null,
                        ),
                      ],
                    ],
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Semantics(
                          liveRegion: true,
                          child: Text(
                            error!,
                            style: const TextStyle(color: Color(0xFF9A271C)),
                          ),
                        ),
                      ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: !c.canWrite || saving || choices.isEmpty
                          ? null
                          : save,
                      child: Text(
                        saving
                            ? 'Salvando…'
                            : production
                            ? 'Registrar produção e lote'
                            : 'Criar rascunho da oferta',
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ),
  );
  String? requiredText(String? value) =>
      value == null || value.trim().isEmpty ? 'Campo obrigatório.' : null;
}

class HistoryPage extends StatelessWidget {
  final HomeController controller;
  final String lotId;
  const HistoryPage({super.key, required this.controller, required this.lotId});
  Future<List<Json>> load() async {
    if (controller.offline) {
      final lot = rows(controller.home?['recentLots'])
          .where((l) => l['id'] == lotId)
          .firstOrNull;
      return lot == null ? [] : [lot['lastEvent'] as Json];
    }
    return allRows(controller.repository, '/lots/$lotId/events');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Histórico do lote')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        SelectableText(lotId),
        const SizedBox(height: 16),
        InfoStrip(
          icon: Icons.route_outlined,
          text: controller.offline
              ? 'Offline: somente a última movimentação salva, não o histórico completo.'
              : 'Eventos confirmados pelos participantes. Não é GPS em tempo real.',
        ),
        FutureBuilder<List<Json>>(
          future: load(),
          builder: (context, snapshot) {
            if (snapshot.hasError) return Text(snapshot.error.toString());
            if (!snapshot.hasData) return const LinearProgressIndicator();
            if (snapshot.data!.isEmpty) {
              return const Text('Nenhum evento disponível nesta consulta.');
            }
            return Column(
              children: snapshot.data!
                  .map(
                    (e) => Card(
                      child: ListTile(
                        leading: const Icon(
                          Icons.check_circle_outline,
                          color: green,
                        ),
                        title: Text(eventLabel(e['type'])),
                        subtitle: Text(
                          '${dateLabel(e['recordedAt'])}\n${e['location']?['municipality'] ?? ''}/${e['location']?['uf'] ?? ''}${e['responsibleOrganizationId'] != null ? '\nOrganização responsável: ${e['responsibleOrganizationId']}' : ''}',
                        ),
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ],
    ),
  );
}

class ProfilePage extends StatelessWidget {
  final HomeController controller;
  const ProfilePage({super.key, required this.controller});
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      Text('Meu perfil', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 16),
      Text(controller.repository.organizationName),
      const SizedBox(height: 12),
      const Text(
        'Experiência do pequeno produtor rural. A organização e as permissões são verificadas pelo servidor.',
      ),
      const SizedBox(height: 16),
      const InfoStrip(
        icon: Icons.privacy_tip_outlined,
        text: 'O token fica somente em memória. Ao sair, os dados da home salvos por esta sessão são removidos. Acesso real de produção ainda não está implementado.',
      ),
    ],
  );
}
