import 'package:flutter/material.dart';

import '../data.dart';
import '../design.dart';
import '../home.dart';
import '../motion.dart';
import '../tasks.dart';
import 'dashboard_components.dart';
import 'alert_card.dart';
import 'explained_alert.dart';
import 'logistics_data.dart';
import 'production_dashboard.dart';
import 'production_data.dart';

const logisticsLabels = {
  'SOLICITADO': 'Aguardando sua resposta',
  'ACEITO': 'Aguardando retirada',
  'RETIRADO': 'Retirado, aguardando confirmação',
  'RECEBIDO': 'Recebido pelo destinatário',
  'CANCELADO': 'Cancelado',
};
const _visibleActions = 3, _visibleOrders = 4, _visiblePlaces = 3;

String _orders(int count) => count == 1 ? '1 pedido' : '$count pedidos';
String _orderKg(Json order) =>
    '${productionKg(productionGrams(order['quantityKg']))} kg';
String _placeCounts(LogisticsPlace place) => [
  if (place.pickups > 0)
    '${place.pickups} ${place.pickups == 1 ? 'retirada' : 'retiradas'}',
  if (place.receipts > 0)
    '${place.receipts} ${place.receipts == 1 ? 'recebimento' : 'recebimentos'}',
].join(' · ');

class LogisticsDashboard extends StatefulWidget {
  final HomeController controller;
  const LogisticsDashboard({super.key, required this.controller});
  @override
  State<LogisticsDashboard> createState() => _LogisticsDashboardState();
}

class _LogisticsDashboardState extends State<LogisticsDashboard> {
  HomeController get c => widget.controller;
  late String property;
  String? selected;
  late Future<(LogisticsSnapshot, bool)> future;

  Future<(LogisticsSnapshot, bool)> query({bool force = false}) {
    final result = LogisticsDashboardRepository(c).load(property, force: force);
    // A very fast authorization failure may arrive before the next build.
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

  Future<void> open(String kind, [String? focusId]) async {
    await Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(kind == 'offers' ? 'Ofertas' : 'Pedidos')),
          body: TaskPage(controller: c, kind: kind, focusId: focusId),
        ),
      ),
    );
    if (mounted) refresh();
  }

  void changeProperty(String? id) {
    if (id == null) return;
    setState(() {
      property = id;
      selected = null;
      future = Future(() async {
        // Pedidos reads the controller's property; both must stay in step.
        await c.load(id);
        return LogisticsDashboardRepository(c).load(id);
      });
      future.ignore();
    });
  }

  /// Opens on what the producer most often looks for, what still has to leave.
  String _activeStatus(LogisticsSummary summary) {
    final present = summary.presentStatuses;
    if (selected != null && present.contains(selected)) return selected!;
    return present.contains('ACEITO') ? 'ACEITO' : present.first;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Logística', maxLines: 2),
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
        child: FutureBuilder<(LogisticsSnapshot, bool)>(
          future: future,
          builder: (context, state) {
            final ready =
                state.connectionState == ConnectionState.done && state.hasData;
            final place = c.properties.where((p) => p['id'] == property).first;
            final offline = ready && state.data!.$2;
            final snapshot = ready ? state.data!.$1 : null;
            final summary = snapshot == null
                ? null
                : LogisticsSummary(snapshot);
            final list = ListView(
              padding: EdgeInsets.fromLTRB(20, ready ? 3 : 4, 20, 32),
              children: [
                // Marcador de carregamento concluído (usado em testes): 1 dp
                // no topo para nunca ser tratado como fora da tela.
                if (ready)
                  const SizedBox(height: 1, key: ValueKey('logistics-ready')),
                _Entrance(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        header: true,
                        child: const Text(
                          'Seus pedidos',
                          style: AgroDesign.display,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Acompanhe seus pedidos até o recebimento.',
                        style: AgroDesign.body.copyWith(
                          color: AgroDesign.muted,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${place['municipality']}/${place['uf']} · somente pedidos desta propriedade',
                        style: AgroDesign.caption,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                _propertyPicker(),
                const SizedBox(height: 16),
                if (!ready)
                  DashboardStateView(
                    status: state.hasError
                        ? DashboardStatus.error
                        : DashboardStatus.loading,
                    message: state.hasError
                        ? '${state.error}'
                        : 'Consultando seus pedidos autorizados.',
                    onRetry: state.hasError ? refresh : null,
                  ),
                if (ready) ...[
                  if (offline)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: InfoStrip(
                        icon: Icons.cloud_off,
                        text: 'Offline · dados desatualizados. As situações salvas podem ter mudado; reconecte para confirmar.',
                      ),
                    ),
                  if (summary!.total == 0)
                    _empty()
                  else
                    ..._content(summary, offline, _alerts(snapshot!, offline)),
                  if (summary.total == 0) _alerts(snapshot!, offline),
                  const SizedBox(height: 16),
                  Text(
                    'Origem: registros autorizados da API Agro+ Brasil · ${c.repository.organizationName}.${offline ? '\nCópia local de ${dateLabel(snapshot!.fetchedAt.toIso8601String())}, desatualizada.' : ''}',
                    style: AgroDesign.caption,
                  ),
                ],
              ],
            );
            return list;
          },
        ),
      ),
    ),
  );

  Widget _alerts(LogisticsSnapshot snapshot, bool offline) => DashboardAlerts(
    key: ValueKey('alerts-$property'),
    evaluate: (now) => logisticsAlerts(
      snapshot,
      AlertContext(
        scope: c.repository.scope,
        property: property,
        now: now,
        offline: offline || c.offline,
        demonstration: c.repository.demonstration,
      ),
    ),
  );

  Widget _propertyPicker() => DropdownButtonFormField<String>(
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
    decoration: const InputDecoration(
      labelText: 'Propriedade',
      prefixIcon: Icon(Icons.landscape_outlined),
    ),
    items: c.properties
        .map(
          (p) => DropdownMenuItem(
            value: p['id'] as String,
            child: Text(p['name']),
          ),
        )
        .toList(),
    onChanged: changeProperty,
  );

  Widget _empty() => _Entrance(
    child: AgroSurface(
      padding: const EdgeInsets.all(22),
      child: Column(
        children: [
          const IconBubble(Icons.inbox_outlined, size: 64),
          const SizedBox(height: 14),
          const Text(
            'Nenhum pedido nesta propriedade',
            style: AgroDesign.title,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            'Quando alguém solicitar uma oferta sua, você acompanha cada etapa aqui.',
            style: AgroDesign.body.copyWith(color: AgroDesign.muted),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => open('offers'),
            icon: const Icon(Icons.sell_outlined, size: 18),
            label: const Text('Ver ofertas'),
          ),
        ],
      ),
    ),
  );

  List<Widget> _content(LogisticsSummary summary, bool offline, Widget alerts) {
    final active = _activeStatus(summary);
    return [
      _Entrance(child: _Hero(summary: summary)),
      const SizedBox(height: 16),

      _Entrance(
        order: 1,
        child: DashboardCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                header: true,
                child: const Text(
                  'Situação das movimentações',
                  style: AgroDesign.section,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Toque em uma situação para ver os produtos.',
                style: AgroDesign.caption,
              ),
              const SizedBox(height: 12),
              ..._bars(summary, active),
              const Divider(height: 24, color: AgroDesign.line),
              AnimatedSize(
                duration: dashboardMotion(context),
                curve: Curves.easeOutCubic,
                alignment: Alignment.topCenter,
                child: AnimatedSwitcher(
                  duration: dashboardMotion(context),
                  layoutBuilder: (current, previous) => Stack(
                    alignment: Alignment.topLeft,
                    children: [...previous, ?current],
                  ),
                  child: KeyedSubtree(
                    key: ValueKey('detail-$active'),
                    child: _statusDetail(summary, active, offline),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
      _Entrance(order: 2, child: _actions(summary, offline)),
      const SizedBox(height: 16),
      alerts,
      if (summary.places.isNotEmpty) ...[
        const SizedBox(height: 16),
        _Entrance(order: 3, child: _territory(summary)),
      ],
      const SizedBox(height: 16),
      _details(summary),
    ];
  }

  List<Widget> _bars(LogisticsSummary summary, String active) {
    final present = summary.presentStatuses;
    final maximum = present
        .map((s) => summary.byStatus[s]!.length)
        .reduce((a, b) => a > b ? a : b);
    return [
      for (final status in present)
        _StatusBar(
          key: ValueKey('bar-$status'),
          label: logisticsLabels[status]!,
          count: summary.byStatus[status]!.length,
          maximum: maximum,
          selected: status == active,
          muted: status == 'CANCELADO',
          onTap: () => setState(() => selected = status),
        ),
    ];
  }

  Widget _statusDetail(LogisticsSummary s, String status, bool offline) {
    final orders = s.byStatus[status]!;
    final waitingCooperative = status == 'ACEITO'
        ? orders.where((o) => o['cooperative'] == true).length
        : 0;
    final note = switch (status) {
      'SOLICITADO' => 'Ainda não reserva quantidade da oferta.',
      'ACEITO' when waitingCooperative > 0 =>
        'A cooperativa designada pode registrar a retirada.',
      'RETIRADO' => 'Somente o destinatário confirma o recebimento.',
      'RECEBIDO' => 'Recebimento confirmado pelo destinatário.',
      'CANCELADO' => 'Cancelados não contam como em andamento.',
      _ => null,
    };
    return Semantics(
      liveRegion: true,
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '${logisticsLabels[status]}: ${productionKg(s.grams[status]!)} kg',
            style: AgroDesign.body.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          for (final order in orders.take(_visibleOrders))
            _OrderLine(
              title: '${order['cropName']} · ${_orderKg(order)}',
              trailing: switch (order['cooperative']) {
                true => 'Com cooperativa',
                false => 'Direto',
                _ => null,
              },
              onTap: offline ? null : () => open('orders', '${order['id']}'),
            ),
          if (orders.length > _visibleOrders && !offline)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => open('orders'),
                child: Text('Ver todos os ${orders.length} em Pedidos'),
              ),
            ),
          if (orders.length > _visibleOrders && offline)
            Text(
              'E mais ${orders.length - _visibleOrders}. Reconecte para consultar.',
              style: AgroDesign.caption,
            ),
          if (note != null) ...[
            const SizedBox(height: 6),
            Text(note, style: AgroDesign.caption),
          ],
        ],
      ),
    );
  }

  Widget _actions(LogisticsSummary s, bool offline) {
    final readOnly = !offline && c.home?['canWrite'] == false;
    return DashboardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: const Text(
              'O que precisa da sua ação',
              style: AgroDesign.section,
            ),
          ),
          const SizedBox(height: 8),
          if (offline)
            const Text(
              'Reconecte para confirmar o que ainda depende de você.',
              style: AgroDesign.caption,
            )
          else if (s.actions.isEmpty)
            const Row(
              children: [
                IconBubble(
                  Icons.check,
                  background: AgroDesign.brandWash,
                  color: AgroDesign.green,
                  size: 40,
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Nada depende de você nesta consulta.',
                    style: AgroDesign.body,
                  ),
                ),
              ],
            )
          else ...[
            for (final order in s.actions.take(_visibleActions))
              _ActionLine(
                title: order['status'] == 'SOLICITADO'
                    ? 'Responder solicitação'
                    : 'Registrar retirada',
                subtitle: '${order['cropName']} · ${_orderKg(order)}',
                icon: order['status'] == 'SOLICITADO'
                    ? Icons.mail_outline
                    : Icons.outbox_outlined,
                urgent: order['status'] == 'SOLICITADO',
                onTap: () => open('orders', '${order['id']}'),
              ),
            if (s.actions.length > _visibleActions)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => open('orders'),
                  child: Text(
                    'Ver mais ${s.actions.length - _visibleActions} em Pedidos',
                  ),
                ),
              ),
            if (readOnly)
              const Text(
                'Seu perfil é de consulta. Quem registra é um responsável pela organização.',
                style: AgroDesign.caption,
              ),
          ],
        ],
      ),
    );
  }

  Widget _territory(LogisticsSummary s) => DashboardCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: const Text(
            'Onde já foi confirmado',
            style: AgroDesign.section,
          ),
        ),
        const SizedBox(height: 12),
        for (final place in s.places.take(_visiblePlaces)) _placeLine(place),
        const SizedBox(height: 4),
        const Text(
          'Município informado em cada retirada e recebimento. Não indica trajeto.',
          style: AgroDesign.caption,
        ),
      ],
    ),
  );

  Widget _placeLine(LogisticsPlace place) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      children: [
        const IconBubble(Icons.location_on_outlined, size: 40),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${place.municipality}/${place.uf}',
                style: AgroDesign.body.copyWith(fontWeight: FontWeight.w700),
              ),
              Text(_placeCounts(place), style: AgroDesign.caption),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _details(LogisticsSummary s) => AgroSurface(
    padding: EdgeInsets.zero,
    child: ExpansionTile(
      key: PageStorageKey('logistics-details-$property'),
      leading: const IconBubble(Icons.insights_outlined, size: 40),
      title: const Text('Ver análise detalhada', style: AgroDesign.section),
      subtitle: const Text(
        'Quantidades, forma de operação e municípios',
        style: AgroDesign.caption,
      ),
      shape: const Border(),
      collapsedShape: const Border(),
      expansionAnimationStyle: dashboardMotion(context) == Duration.zero
          ? AnimationStyle.noAnimation
          : AnimationStyle(
              duration: dashboardMotion(context),
              curve: Curves.easeOutCubic,
            ),
      childrenPadding: const EdgeInsets.all(16),
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Quantidade por situação', style: AgroDesign.section),
        const SizedBox(height: 6),
        for (final status in s.presentStatuses)
          Text(
            '${logisticsLabels[status]}: ${_orders(s.byStatus[status]!.length)}, ${productionKg(s.grams[status]!)} kg',
            style: AgroDesign.body,
          ),
        if (s.direct + s.cooperative > 0) ...[
          const SizedBox(height: 12),
          const Text('Forma de operação', style: AgroDesign.section),
          const SizedBox(height: 6),
          Text('Direta: ${_orders(s.direct)}', style: AgroDesign.body),
          Text(
            'Com cooperativa: ${_orders(s.cooperative)}',
            style: AgroDesign.body,
          ),
        ],
        if (s.places.length > _visiblePlaces) ...[
          const SizedBox(height: 12),
          const Text('Todos os municípios', style: AgroDesign.section),
          const SizedBox(height: 8),
          for (final place in s.places) _placeLine(place),
        ],
        if (s.unlocated > 0) ...[
          const SizedBox(height: 8),
          Text(
            s.unlocated == 1
                ? '1 operação confirmada sem município disponível não aparece na lista.'
                : '${s.unlocated} operações confirmadas sem município disponível não aparecem na lista.',
            style: AgroDesign.caption,
          ),
        ],
        const SizedBox(height: 10),
        const Text(
          'Retirada é registrada pelo produtor ou pela cooperativa designada; recebimento, somente pelo destinatário. Este painel não mostra rota, distância, GPS ou previsão de entrega.',
          style: AgroDesign.caption,
        ),
      ],
    ),
  );
}

class _Hero extends StatelessWidget {
  final LogisticsSummary summary;
  const _Hero({required this.summary});
  @override
  Widget build(BuildContext context) {
    final received = summary.received;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AgroDesign.radius),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFE5F2F5), Color(0xFFEAF5E6)],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const IconBubble(
                  Icons.local_shipping_outlined,
                  background: AgroDesign.paper,
                  size: 40,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Pedidos em andamento',
                    style: AgroDesign.section.copyWith(fontSize: 16),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            AnimatedSwitcher(
              duration: dashboardMotion(context),
              child: Text(
                '${summary.inProgress}',
                key: ValueKey(summary.inProgress),
                style: const TextStyle(
                  color: AgroDesign.forest,
                  fontSize: 48,
                  height: 1.05,
                  letterSpacing: -1.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${productionKg(summary.inProgressGrams)} kg nessas operações',
              style: AgroDesign.body,
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: AgroDesign.paper,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    received > 0 ? Icons.task_alt : Icons.schedule,
                    size: 16,
                    color: AgroDesign.forest,
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      received == 1
                          ? '1 já recebido pelo destinatário'
                          : '$received já recebidos pelo destinatário',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AgroDesign.forest,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBar extends StatelessWidget {
  final String label;
  final int count, maximum;
  final bool selected, muted;
  final VoidCallback onTap;
  const _StatusBar({
    super.key,
    required this.label,
    required this.count,
    required this.maximum,
    required this.selected,
    required this.muted,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) {
    final motion = dashboardMotion(context);
    final fill = muted ? AgroDesign.muted : AgroDesign.forest;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Semantics(
        button: true,
        selected: selected,
        label: '$label: ${_orders(count)}',
        onTap: onTap,
        excludeSemantics: true,
        child: AnimatedContainer(
          duration: motion,
          curve: AgroMotion.respond,
          decoration: BoxDecoration(
            color: selected ? AgroDesign.mint : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Text(
                            label,
                            style: AgroDesign.body.copyWith(
                              fontWeight: selected
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          constraints: const BoxConstraints(minWidth: 28),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: selected
                                ? AgroDesign.paper
                                : AgroDesign.mint,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '$count',
                            textAlign: TextAlign.center,
                            style: AgroDesign.body.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AgroDesign.forest,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: ColoredBox(
                        color: selected ? AgroDesign.paper : AgroDesign.mint,
                        child: TweenAnimationBuilder<double>(
                          duration: motion,
                          curve: AgroMotion.arrive,
                          tween: Tween(begin: 0, end: count / maximum),
                          builder: (context, value, _) => Align(
                            alignment: Alignment.centerLeft,
                            child: FractionallySizedBox(
                              widthFactor: value,
                              child: Container(
                                height: 10,
                                decoration: BoxDecoration(
                                  color: fill,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderLine extends StatelessWidget {
  final String title;
  final String? trailing;
  final VoidCallback? onTap;
  const _OrderLine({required this.title, this.trailing, this.onTap});
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(10),
    child: ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AgroDesign.body),
                  if (trailing != null)
                    Text(trailing!, style: AgroDesign.caption),
                ],
              ),
            ),
            if (onTap != null)
              const Icon(Icons.chevron_right, color: AgroDesign.muted),
          ],
        ),
      ),
    ),
  );
}

class _ActionLine extends StatelessWidget {
  final String title, subtitle;
  final IconData icon;
  final bool urgent;
  final VoidCallback onTap;
  const _ActionLine({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.urgent = false,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Material(
      color: AgroDesign.canvas,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              IconBubble(
                icon,
                background: urgent ? AgroDesign.attention : AgroDesign.mint,
                color: urgent ? AgroDesign.earth : AgroDesign.forest,
                size: 42,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AgroDesign.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(subtitle, style: AgroDesign.caption),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AgroDesign.muted),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Soft staggered arrival; a position change, never a depiction of cargo moving.
class _Entrance extends StatelessWidget {
  final int order;
  final Widget child;
  const _Entrance({required this.child, this.order = 0});
  @override
  Widget build(BuildContext context) {
    final motion = dashboardMotion(context);
    if (motion == Duration.zero) return child;
    final lead = 60 * order;
    final total = motion.inMilliseconds + lead;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: total),
      curve: Interval(lead / total, 1, curve: AgroMotion.arrive),
      child: child,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 12 * (1 - value)),
          child: child,
        ),
      ),
    );
  }
}
