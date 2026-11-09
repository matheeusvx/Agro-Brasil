import 'package:flutter/material.dart';

import '../data.dart';
import '../design.dart';
import '../home.dart';
import '../tasks.dart';
import 'dashboard_components.dart';
import 'production_data.dart';
import 'water_data.dart';

String productionKg(int grams) {
  final text = waterNumber(grams / 1000, decimals: grams % 1000 == 0 ? 0 : 3);
  return grams % 1000 == 0 ? text : text.replaceFirst(RegExp(r'0+$'), '');
}

class ProductionDashboard extends StatefulWidget {
  final HomeController controller;
  const ProductionDashboard({super.key, required this.controller});
  @override
  State<ProductionDashboard> createState() => _ProductionDashboardState();
}

class _ProductionDashboardState extends State<ProductionDashboard> {
  HomeController get c => widget.controller;
  late String property;
  String year = 'all';
  String? selected;
  late Future<(ProductionSnapshot, bool)> future;
  Future<(ProductionSnapshot, bool)> query({bool force = false}) {
    final result = ProductionDashboardRepository(c)
        .load(property, force: force);
    // A very fast authorization failure may arrive before the next build.
    // Keep the error for FutureBuilder while registering an immediate listener.
    result.ignore();
    return result;
  }

  @override
  void initState() {
    super.initState();
    property = c.propertyId ?? c.properties.first['id'];
    future = query();
  }

  void refresh() => setState(() {
    future = query(force: true);
  });
  Future<void> open(String kind) async {
    await Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(kind == 'offers' ? 'Ofertas' : 'Pedidos')),
          body: TaskPage(controller: c, kind: kind),
        ),
      ),
    );
    if (mounted) refresh();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Produção e excedentes', maxLines: 2),
      toolbarHeight: MediaQuery.textScalerOf(context).scale(18) > 27 ? 96 : 64,
      actions: [
        IconButton(
          tooltip: 'Atualizar painel',
          onPressed: refresh,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: FutureBuilder<(ProductionSnapshot, bool)>(
          future: future,
          builder: (context, state) {
            final ready =
                state.connectionState == ConnectionState.done && state.hasData;
            final snapshot = ready ? state.data!.$1 : null;
            final offline = ready && state.data!.$2;
            final place = c.properties.where((p) => p['id'] == property).first;
            final years =
                snapshot?.productions
                    .map(
                      (p) =>
                          (p['harvestedOn'] as String? ?? '').split('-').first,
                    )
                    .where((y) => RegExp(r'^\d{4}$').hasMatch(y))
                    .toSet()
                    .toList() ??
                <String>[];
            years.sort((a, b) => b.compareTo(a));
            final activeYear = years.contains(year) ? year : 'all';
            final summary = snapshot == null
                ? null
                : ProductionSummary(snapshot, DateTime.now(), year: activeYear);
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Text(
                  'Acompanhe o que você produz e disponibiliza.',
                  style: AgroDesign.body,
                ),
                const SizedBox(height: 12),
                Text(
                  '${place['municipality']}/${place['uf']} · somente registros desta propriedade',
                  style: AgroDesign.caption,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  key: ValueKey('property-$property'),
                  initialValue: property,
                  isExpanded: true,
                  itemHeight: null,
                  selectedItemBuilder: (context) => c.properties
                      .map(
                        (p) => Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            p['name'],
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  decoration: const InputDecoration(labelText: 'Propriedade'),
                  items: c.properties
                      .map(
                        (p) => DropdownMenuItem(
                          value: p['id'] as String,
                          child: Text(p['name']),
                        ),
                      )
                      .toList(),
                  onChanged: (id) async {
                    if (id == null) return;
                    setState(() {
                      property = id;
                      year = 'all';
                      selected = null;
                      future = Future(() async {
                        await c.load(id);
                        return ProductionDashboardRepository(c).load(id);
                      });
                      future.ignore();
                    });
                  },
                ),
                const SizedBox(height: 12),
                if (!ready)
                  DashboardStateView(
                    status: state.hasError
                        ? DashboardStatus.error
                        : DashboardStatus.loading,
                    message: state.hasError
                        ? '${state.error}'
                        : 'Consultando todos os registros autorizados.',
                    onRetry: state.hasError ? refresh : null,
                  ),
                if (ready) ...[
                  if (c.repository.demonstration)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Text(
                        'Demonstração · registros fictícios identificados',
                        style: AgroDesign.caption,
                      ),
                    ),
                  if (offline)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: InfoStrip(
                        icon: Icons.cloud_off,
                        text: 'Offline · dados desatualizados. Saldos salvos podem ter mudado; reconecte para confirmar.',
                      ),
                    ),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    itemHeight: null,
                    selectedItemBuilder: (context) => ['all', ...years]
                        .map(
                          (y) => Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              y == 'all' ? 'Todos os registros' : y,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    key: ValueKey('year-$property-$activeYear'),
                    initialValue: activeYear,
                    decoration: const InputDecoration(
                      labelText: 'Período da colheita',
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: 'all',
                        child: Text('Todos os registros'),
                      ),
                      for (final y in years)
                        DropdownMenuItem(value: y, child: Text(y)),
                    ],
                    onChanged: (y) => setState(() {
                      year = y!;
                      selected = null;
                    }),
                  ),
                  const SizedBox(height: 16),
                  _ProductionEntrance(
                    child: DashboardCard(
                      dark: true,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Minha produção',
                            style: TextStyle(
                              color: dashboardLime,
                              fontWeight: FontWeight.w700,
                              fontSize: 17,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${productionKg(summary!.produced)} kg',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 36,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${summary.crops.length} culturas · ${activeYear == 'all' ? 'todos os registros' : 'colheitas de $activeYear'}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  DashboardCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'O que você produz',
                          style: AgroDesign.section,
                        ),
                        const SizedBox(height: 12),
                        if (summary.crops.isEmpty)
                          const Text(
                            'Nenhuma produção registrada neste período.',
                            style: AgroDesign.body,
                          ),
                        ..._bars(summary),
                        if (selected != null &&
                            summary.crops.containsKey(selected))
                          Semantics(
                            liveRegion: true,
                            child: Text(
                              '${summary.names[selected]}: ${productionKg(summary.crops[selected]!)} kg registrados.',
                              style: AgroDesign.body,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  DashboardCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Suas ofertas', style: AgroDesign.section),
                        const SizedBox(height: 12),
                        Text(
                          'Venda: ${productionKg(summary.sale)} kg',
                          style: AgroDesign.section,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Doação: ${productionKg(summary.donation)} kg',
                          style: AgroDesign.section,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          '${offline ? 'Saldos salvos' : 'Saldos disponíveis'} da propriedade, de todas as colheitas. Somente ofertas publicadas e dentro do prazo.',
                          style: AgroDesign.caption,
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Produção registrada não significa produto disponível para venda ou doação.',
                          style: AgroDesign.caption,
                        ),
                        TextButton(
                          onPressed: () => open('offers'),
                          child: const Text('Ver ofertas'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'O que precisa de atenção?',
                    style: AgroDesign.section,
                  ),
                  const SizedBox(height: 8),
                  if (offline)
                    const Text(
                      'Reconecte para confirmar pendências e saldos.',
                      style: AgroDesign.caption,
                    )
                  else
                    ..._attention(summary),
                  const SizedBox(height: 16),
                  Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    child: ExpansionTile(
                      key: PageStorageKey('production-details-$property'),
                      title: const Text('Ver análise detalhada'),
                      childrenPadding: const EdgeInsets.all(16),
                      children: [
                        const Text(
                          'Produção por safra',
                          style: AgroDesign.section,
                        ),
                        for (final entry in summary.seasons.entries)
                          Text(
                            '${entry.key}: ${productionKg(entry.value)} kg',
                            style: AgroDesign.body,
                          ),
                        if (summary.months.length >= 2) ...[
                          const SizedBox(height: 12),
                          const Text(
                            'Colheitas registradas por mês',
                            style: AgroDesign.section,
                          ),
                          for (final month
                              in (summary.months.keys.toList()..sort()))
                            Text(
                              '$month: ${productionKg(summary.months[month]!)} kg',
                              style: AgroDesign.body,
                            ),
                          const Text(
                            'Meses sem registro não indicam produção zero. Não foi calculada tendência.',
                            style: AgroDesign.caption,
                          ),
                        ],
                        const SizedBox(height: 12),
                        Text(
                          'Ofertado originalmente nas ofertas vigentes: ${productionKg(summary.offered)} kg. Saldo: ${productionKg(summary.sale + summary.donation)} kg.',
                          style: AgroDesign.body,
                        ),
                        const Text(
                          'Ofertas de todas as colheitas da propriedade. O saldo já desconta pedidos aceitos; solicitações ainda não aceitas não reservam estoque. Rascunhos e ofertas vencidas não entram no saldo.',
                          style: AgroDesign.caption,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Pedidos vinculados (todas as colheitas)',
                          style: AgroDesign.section,
                        ),
                        for (final status in [
                          'SOLICITADO',
                          'ACEITO',
                          'RETIRADO',
                          'RECEBIDO',
                          'CANCELADO',
                        ])
                          if (snapshot!.orders.any(
                            (o) => o['status'] == status,
                          ))
                            Text(
                              '${statusLabel(status)}: ${productionKg(snapshot.orders.where((o) => o['status'] == status).fold<int>(0, (sum, o) => sum + productionGrams(o['quantityKg'])))} kg',
                              style: AgroDesign.body,
                            ),
                        const Text(
                          'Quantidades por estado do pedido; não são somadas ao saldo da oferta. Não representam estoque físico inventariado.',
                          style: AgroDesign.caption,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Origem: registros autorizados da API Agro+ Brasil · ${c.repository.organizationName}.\nConsultado em ${dateLabel(snapshot!.fetchedAt.toIso8601String())}. ${offline ? 'Cópia local desatualizada.' : 'Atualize para consultar novas movimentações.'}',
                    style: AgroDesign.caption,
                  ),
                  const Text(
                    'Este painel não representa toda a produção agrícola do município.',
                    style: AgroDesign.caption,
                  ),
                ],
              ],
            );
          },
        ),
      ),
    ),
  );
  List<Widget> _bars(ProductionSummary summary) {
    final entries = summary.crops.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final maximum = entries.isEmpty ? 1 : entries.first.value;
    return [
      for (final e in entries)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TextButton(
            onPressed: () => setState(() {
              selected = e.key;
            }),
            style: TextButton.styleFrom(
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.all(10),
              backgroundColor: selected == e.key ? AgroDesign.wash : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${summary.names[e.key]} · ${productionKg(e.value)} kg',
                  style: AgroDesign.body,
                ),
                const SizedBox(height: 8),
                TweenAnimationBuilder<double>(
                  duration: dashboardMotion(context),
                  tween: Tween(
                    begin: 0,
                    end: maximum == 0 ? 0 : e.value / maximum,
                  ),
                  builder: (context, value, _) => Align(
                    alignment: Alignment.centerLeft,
                    child: FractionallySizedBox(
                      widthFactor: value,
                      child: Container(
                        height: 12,
                        decoration: BoxDecoration(
                          color: AgroDesign.green,
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
    ];
  }

  List<Widget> _attention(ProductionSummary s) {
    final widgets = <Widget>[];
    for (final o in s.pending.take(2)) {
      widgets.add(
        TextButton.icon(
          onPressed: () => open('orders'),
          icon: const Icon(Icons.mail_outline),
          label: Text(
            'Responder solicitação · ${o['cropName']} · ${productionKg(productionGrams(o['quantityKg']))} kg',
          ),
        ),
      );
    }
    for (final o in s.expiring.take(2 - widgets.length)) {
      widgets.add(
        TextButton.icon(
          onPressed: () => open('offers'),
          icon: const Icon(Icons.schedule),
          label: Text('${o['cropName']}: oferta vence em até 3 dias'),
        ),
      );
    }
    if (widgets.isEmpty) {
      widgets.add(
        const Text(
          'Nenhuma pendência identificada nesta consulta.',
          style: AgroDesign.caption,
        ),
      );
    }
    return widgets;
  }
}

class _ProductionEntrance extends StatelessWidget {
  final Widget child;
  const _ProductionEntrance({required this.child});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: 1),
    duration: dashboardMotion(context),
    child: child,
    builder: (context, value, child) => Opacity(
      opacity: value,
      child: Transform.translate(
        offset: Offset(0, 8 * (1 - value)),
        child: child,
      ),
    ),
  );
}
