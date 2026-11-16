import 'dart:convert';

import 'package:flutter/material.dart';

import 'data.dart';
import 'home.dart';
import 'design.dart';
import 'territorial/impact_card.dart';
import 'illustrations.dart';
import 'records.dart';
import 'territorial/logistics_dashboard.dart';
import 'territorial/production_dashboard.dart';

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
    final crops = {for (final p in productions) p['lot']['id']: p['cropName']};
    return data
        .where(
          (p) =>
              ids.contains(p['lotId']) &&
              (widget.focusId == null || p['id'] == widget.focusId),
        )
        // Pedidos chegam sem cultura: usa a produção do mesmo lote.
        .map((p) => {...p, 'cropName': p['cropName'] ?? crops[p['lotId']]})
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
      setState(() {
        future = load();
      });
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
            ModuleHeading(
              title: title,
              subtitle: widget.kind == 'production'
                  ? 'Sua colheita, com origem registrada.'
                  : widget.kind == 'offers'
                  ? 'Dê um destino ao que você produz.'
                  : widget.kind == 'orders'
                  ? 'Cada entrega começa com uma conexão.'
                  : 'A origem e o caminho de cada colheita.',
              art: widget.kind == 'production'
                  ? FarmArt.harvest
                  : widget.kind == 'offers'
                  ? FarmArt.offer
                  : widget.kind == 'orders'
                  ? FarmArt.orders
                  : FarmArt.route,
            ),
            if (widget.kind == 'production')
              FeatureTile(
                icon: Icons.bar_chart_rounded,
                title: 'Produção e excedentes',
                subtitle: 'Veja o que colheu e o que está ofertado',
                onTap: c.propertyId == null
                    ? null
                    : () => Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => ProductionDashboard(controller: c),
                        ),
                      ),
              ),
            if (widget.kind == 'orders' && widget.focusId == null)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: FeatureTile(
                  icon: Icons.local_shipping_outlined,
                  title: 'Acompanhar logística',
                  subtitle: 'Retiradas e recebimentos dos seus pedidos',
                  onTap: c.propertyId == null
                      ? null
                      : () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => LogisticsDashboard(controller: c),
                            ),
                          );
                          if (mounted) {
                            setState(() {
                              future = load();
                            });
                          }
                        },
                ),
              ),
            if ((widget.kind == 'production' || widget.kind == 'offers') &&
                (c.canWrite || c.repository.fixture))
              Padding(
                padding: const EdgeInsets.only(top: 16),
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
                    if (mounted) {
                      setState(() {
                        future = load();
                      });
                    }
                  },
                  icon: const Icon(Icons.add),
                  label: Text(
                    widget.kind == 'production'
                        ? 'Cadastrar produção'
                        : 'Oferecer produtos',
                  ),
                ),
              ),
            const SizedBox(height: 24),
            if (widget.kind != 'lots')
              Padding(
                padding: const EdgeInsets.only(bottom: 12, left: 2),
                child: SectionHeading(
                  title: switch (widget.kind) {
                    'production' => 'Colheitas registradas',
                    'offers' => 'Suas ofertas',
                    _ => 'Pedidos recebidos',
                  },
                ),
              ),
            FutureBuilder<List<Json>>(
              future: future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: const LinearProgressIndicator(minHeight: 4),
                    ),
                  );
                }
                if (snapshot.hasError) {
                  return AgroSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const IconBubble(
                          Icons.cloud_off_outlined,
                          background: AgroDesign.attention,
                          color: AgroDesign.earth,
                        ),
                        const SizedBox(height: 12),
                        Text(snapshot.error.toString(), style: AgroDesign.body),
                        const SizedBox(height: 8),
                        TextButton.icon(
                          onPressed: () => setState(() {
                            future = load();
                          }),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Tentar novamente'),
                        ),
                      ],
                    ),
                  );
                }
                final data = snapshot.data!;
                if (data.isEmpty) {
                  return FarmEmptyState(
                    art: widget.kind == 'offers'
                        ? FarmArt.offer
                        : widget.kind == 'orders'
                        ? FarmArt.orders
                        : FarmArt.harvest,
                    title: widget.kind == 'orders'
                        ? 'As próximas conexões chegam aqui.'
                        : widget.kind == 'offers'
                        ? 'Sua colheita pode ir mais longe.'
                        : 'O começo de uma boa colheita.',
                    message: widget.kind == 'orders'
                        ? 'Quando houver um pedido, você poderá acompanhar cada etapa.'
                        : widget.kind == 'offers'
                        ? 'Escolha um lote da sua produção e prepare sua primeira oferta.'
                        : 'Cadastre uma produção para registrar a origem do seu primeiro lote.',
                  );
                }
                return Column(
                  children: data.map((item) {
                    if (widget.kind == 'production' || widget.kind == 'lots') {
                      return CropRecord(
                        item: item,
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute<void>(
                            builder: (_) => HistoryPage(
                              controller: c,
                              lotId: item['lot']['id'],
                            ),
                          ),
                        ),
                      );
                    }
                    final offer = widget.kind == 'offers';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: AgroSurface(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                ExcludeSemantics(
                                  child: Container(
                                    width: 56,
                                    height: 56,
                                    decoration: BoxDecoration(
                                      color: offer
                                          ? const Color(0xFFF6EFDD)
                                          : const Color(0xFFF3EBE3),
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                    alignment: Alignment.center,
                                    child: FarmIllustration(
                                      art: offer
                                          ? FarmArt.offer
                                          : FarmArt.orders,
                                      width: 50,
                                      height: 38,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        offer
                                            ? '${item['cropName']} · ${kgText(item['availableKg'])} kg disponíveis'
                                            : '${item['cropName'] ?? 'Pedido'} · ${kgText(item['quantityKg'])} kg',
                                        style: AgroDesign.section,
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        'Lote ${shortLot(item['lotId'])}',
                                        style: AgroDesign.caption,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            StatusPill(item['status']),
                            if (!offer && item['shipment'] != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 10),
                                child: Text(
                                  item['shipment']['carrierOrganizationId'] ==
                                          null
                                      ? 'Operação direta, sem cooperativa.'
                                      : 'Cooperativa designada nesta operação.',
                                  style: AgroDesign.caption,
                                ),
                              ),
                            if (c.canWrite &&
                                offer &&
                                item['status'] == 'RASCUNHO')
                              _CardAction(
                                FilledButton(
                                  onPressed: () =>
                                      act('/offers/${item['id']}/publish'),
                                  child: const Text('Publicar oferta'),
                                ),
                              ),
                            if (c.canWrite &&
                                !offer &&
                                item['status'] == 'SOLICITADO')
                              _CardAction(
                                FilledButton(
                                  onPressed: () => act(
                                    '/orders/${item['id']}/accept',
                                    accept: true,
                                  ),
                                  child: const Text(
                                    'Aceitar solicitação e reservar',
                                  ),
                                ),
                              ),
                            if (c.canWrite &&
                                !offer &&
                                item['status'] == 'ACEITO')
                              _CardAction(
                                FilledButton(
                                  onPressed: () => act(
                                    '/shipments/${item['shipment']['id']}/pickup',
                                  ),
                                  child: const Text('Registrar retirada'),
                                ),
                              ),
                            if (c.canWrite &&
                                !offer &&
                                [
                                  'SOLICITADO',
                                  'ACEITO',
                                ].contains(item['status']))
                              _CardAction(
                                OutlinedButton(
                                  onPressed: () =>
                                      act('/orders/${item['id']}/cancel'),
                                  child: const Text('Cancelar pedido'),
                                ),
                              ),
                            if (!offer && item['status'] == 'RETIRADO')
                              const Padding(
                                padding: EdgeInsets.only(top: 12),
                                child: Text(
                                  'O destinatário deve confirmar o recebimento.',
                                  style: AgroDesign.body,
                                ),
                              ),
                            if (!offer && item['shipment'] != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: TextButton.icon(
                                  onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute<void>(
                                      builder: (_) => HistoryPage(
                                        controller: c,
                                        lotId: item['lotId'],
                                      ),
                                    ),
                                  ),
                                  icon: const Icon(Icons.route_outlined),
                                  label: const Text('Consultar histórico'),
                                ),
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

/// Ação de card com respiro uniforme acima do botão.
class _CardAction extends StatelessWidget {
  final Widget button;
  const _CardAction(this.button);
  @override
  Widget build(BuildContext context) =>
      Padding(padding: const EdgeInsets.only(top: 12), child: button);
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
  int step = 0;
  final pageScroll = ScrollController();
  void goToStep(int value) {
    setState(() {
      step = value;
      error = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && pageScroll.hasClients) pageScroll.jumpTo(0);
    });
  }

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
    pageScroll.dispose();
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
          controller: pageScroll,
          padding: const EdgeInsets.all(20),
          children: [
            ModuleHeading(
              title: production
                  ? 'Dê origem à sua colheita.'
                  : 'Uma nova conexão começa aqui.',
              subtitle: production
                  ? 'Registre a colheita e confirme de onde ela vem.'
                  : 'Escolha um lote, a quantidade e o destino.',
              art: production ? FarmArt.harvest : FarmArt.offer,
              eyebrow: production ? 'NOVA PRODUÇÃO' : 'NOVA OFERTA',
            ),
            if (!c.canWrite)
              const InfoStrip(
                icon: Icons.lock_outline,
                text: 'Somente consulta: sem permissão ou sem conexão. Nenhum envio será realizado.',
              ),
            if (loading)
              const LinearProgressIndicator()
            else
              Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Etapa ${step + 1} de 2', style: AgroDesign.caption),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: (step + 1) / 2,
                      minHeight: 4,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    if (step == 0) ...[
                      FormSection(
                        number: '01',
                        title: production ? 'Sua colheita' : 'Sua oferta',
                      ),
                      if (choices.isEmpty)
                        Text(
                          production ? 'Nenhuma cultura disponível.' : 'Nenhum lote disponível para nova oferta. Cadastre uma produção ou confira as ofertas existentes.',
                        ),
                      if (choices.isNotEmpty)
                        DropdownButtonFormField<String>(
                          initialValue: selection,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: production
                                ? 'O que foi colhido?'
                                : 'Lote de origem',
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
                          return number == null ||
                                  !number.isFinite ||
                                  number <= 0
                              ? 'Informe uma quantidade positiva.'
                              : null;
                        },
                      ),
                      if (production) ...[
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: season,
                          maxLength: 60,
                          decoration: const InputDecoration(
                            labelText: 'Safra',
                            hintText: 'Ex.: Verão 2026/27',
                          ),
                          validator: requiredText,
                        ),
                      ],
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: date,
                        readOnly: true,
                        onTap: () async {
                          final selectedDate = await showDatePicker(
                            context: context,
                            initialDate:
                                DateTime.tryParse(date.text) ?? DateTime.now(),
                            firstDate: DateTime(2000),
                            lastDate: production
                                ? DateTime.now()
                                : DateTime(2100),
                          );
                          if (selectedDate != null) {
                            date.text = selectedDate
                                .toIso8601String()
                                .substring(0, 10);
                          }
                        },
                        decoration: InputDecoration(
                          suffixIcon: const Icon(Icons.calendar_today_outlined),
                          labelText: production
                              ? 'Data da colheita'
                              : 'Validade da oferta',
                        ),
                        validator: (value) =>
                            DateTime.tryParse(value ?? '') == null
                            ? 'Informe uma data válida.'
                            : null,
                      ),
                    ],
                    if (step == 1) ...[
                      if (production) ...[
                        const SizedBox(height: 16),
                        const FormSection(
                          number: '02',
                          title: 'Origem da colheita',
                        ),
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
                          title: const Text(
                            'Confirmo a localização de origem.',
                          ),
                          onChanged: (v) =>
                              setState(() => confirmed = v == true),
                        ),
                      ] else ...[
                        const SizedBox(height: 16),
                        const FormSection(
                          number: '02',
                          title: 'Destino dos produtos',
                        ),
                        DropdownButtonFormField<String>(
                          initialValue: mode,
                          decoration: const InputDecoration(
                            labelText: 'Destino',
                          ),
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
                    if (step == 0)
                      FilledButton.icon(
                        onPressed: choices.isEmpty
                            ? null
                            : () {
                                if (form.currentState!.validate()) {
                                  goToStep(1);
                                }
                              },
                        icon: const Icon(Icons.arrow_forward, size: 18),
                        label: Text(
                          production
                              ? 'Continuar para a origem'
                              : 'Continuar para o destino',
                        ),
                      ),
                    if (step == 1) ...[
                      OutlinedButton(
                        onPressed: saving ? null : () => goToStep(0),
                        child: const Text('Voltar aos dados'),
                      ),
                      const SizedBox(height: 12),
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
  Json? get selectedLot =>
      rows(controller.home?['recentLots'])
          .where((lot) => lot['id'] == lotId)
          .firstOrNull;
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
        ModuleHeading(
          title: 'Da origem ao destino',
          subtitle: selectedLot == null
              ? 'Cada etapa, um registro confirmado.'
              : '${selectedLot!['cropName']} · ${selectedLot!['quantityKg']} kg · eventos confirmados',
          art: FarmArt.route,
        ),
        SelectableText('Lote: $lotId', style: AgroDesign.caption),
        if (controller.offline) ...[
          const SizedBox(height: 16),
          const InfoStrip(
            icon: Icons.cloud_off_outlined,
            text: 'Offline: somente a última movimentação salva, não o histórico completo.',
          ),
        ],
        FutureBuilder<List<Json>>(
          future: load(),
          builder: (context, snapshot) {
            if (snapshot.hasError) return Text(snapshot.error.toString());
            if (!snapshot.hasData) return const LinearProgressIndicator();
            if (snapshot.data!.isEmpty) {
              return const Text('Nenhum evento disponível nesta consulta.');
            }
            return EventTimeline(events: snapshot.data!);
          },
        ),
      ],
    ),
  );
}

/// Código curto do lote, como no portal (8 primeiros caracteres).
String shortLot(dynamic id) {
  final text = id?.toString() ?? '';
  return (text.length > 8 ? text.substring(0, 8) : text).toUpperCase();
}

/// Quantidade em kg no formato brasileiro (vírgula decimal), sem arredondar gramas.
String kgText(dynamic value) =>
    value is num ? impactKg(value.toDouble()) : '${value ?? '—'}';
