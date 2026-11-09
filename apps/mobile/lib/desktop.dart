import 'package:flutter/material.dart';

import 'data.dart';
import 'design.dart';
import 'home.dart';
import 'desktop_charts.dart';

class DesktopShell extends StatelessWidget {
  final HomeController controller;
  final int selected;
  final ValueChanged<int> onSelected;
  final ValueChanged<String> onNavigate;
  final ValueChanged<String>? onOrganization;
  final Widget content;
  final VoidCallback? onLogout;
  const DesktopShell({
    super.key,
    required this.controller,
    required this.selected,
    required this.onSelected,
    required this.onNavigate,
    required this.content,
    this.onOrganization,
    this.onLogout,
  });
  @override
  Widget build(BuildContext context) {
    final repo = controller.repository;
    final organizations = repo is ApiRepository ? repo.organizations : <Json>[];
    return Row(
      children: [
        Container(
          width: 216,
          color: AgroDesign.forest,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: AgroLogo(height: 36),
                    ),
                  ),
                  const Text(
                    'MEU CAMPO, MEU DIA',
                    style: TextStyle(
                      color: Color(0xFFDAE7D3),
                      fontSize: 11,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 32),
                  for (var i = 0; i < 6; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: TextButton.icon(
                        style: TextButton.styleFrom(
                          alignment: Alignment.centerLeft,
                          minimumSize: const Size(48, 52),
                          foregroundColor: Colors.white,
                          backgroundColor: selected == i
                              ? const Color(0xFF35614C)
                              : null,
                        ),
                        onPressed: () => onSelected(i),
                        icon: Icon(
                          [
                            Icons.home_outlined,
                            Icons.grass,
                            Icons.sell_outlined,
                            Icons.inventory_2_outlined,
                            Icons.person_outline,
                            Icons.route_outlined,
                          ][i],
                          size: 21,
                        ),
                        label: Text(
                          [
                            'Início',
                            'Produção',
                            'Ofertas',
                            'Pedidos',
                            'Perfil',
                            'Rastreabilidade',
                          ][i],
                        ),
                      ),
                    ),
                  const Spacer(),
                  const Text(
                    'Pequeno produtor rural',
                    style: TextStyle(color: Color(0xFFDAE7D3), fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 28,
                  vertical: 16,
                ),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AgroDesign.line)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: organizations.length > 1
                          ? DropdownButtonFormField<String>(
                              initialValue:
                                  (repo as ApiRepository).organizationId,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Organização',
                              ),
                              items: organizations
                                  .map(
                                    (o) => DropdownMenuItem(
                                      value: o['organizationId'] as String,
                                      child: Text(
                                        o['name'],
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: controller.loading
                                  ? null
                                  : (id) {
                                      if (id != null) onOrganization?.call(id);
                                    },
                            )
                          : Text(repo.organizationName, style: AgroDesign.body),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        key: ValueKey(controller.propertyId),
                        initialValue: controller.propertyId,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Propriedade',
                        ),
                        items: controller.properties
                            .map(
                              (p) => DropdownMenuItem(
                                value: p['id'] as String,
                                child: Text(
                                  p['name'],
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: controller.loading
                            ? null
                            : (id) {
                                if (id != null) controller.load(id);
                              },
                      ),
                    ),
                    IconButton(
                      tooltip: 'Inteligência hídrica territorial',
                      onPressed: () => onNavigate('water-dashboard'),
                      icon: const Icon(Icons.water_drop_outlined),
                    ),
                    IconButton(
                      tooltip: 'Atualizar informações',
                      onPressed:
                          controller.loading || controller.propertyId == null
                          ? null
                          : () => controller.load(controller.propertyId!),
                      icon: const Icon(Icons.refresh),
                    ),
                    IconButton(
                      tooltip: 'Sair e apagar dados salvos desta sessão',
                      onPressed: onLogout,
                      icon: const Icon(Icons.logout),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: selected == 0
                    ? DesktopHome(
                        controller: controller,
                        onNavigate: onNavigate,
                      )
                    : content,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class DesktopHome extends StatelessWidget {
  final HomeController controller;
  final ValueChanged<String> onNavigate;
  const DesktopHome({
    super.key,
    required this.controller,
    required this.onNavigate,
  });
  @override
  Widget build(BuildContext context) {
    final home = controller.home;
    final pending = rows(home?['pending']);
    Widget next() => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeading(title: 'Sua próxima ação'),
        const SizedBox(height: 14),
        if (home?['hasProductions'] != true)
          FirstProductionCard(
            enabled: controller.canWrite,
            onPressed: () => onNavigate('production-new'),
          )
        else if (pending.isEmpty)
          const AllClearCard()
        else
          PendingCard(
            pending: pending.first,
            disabled:
                controller.offline ||
                (!controller.canWrite && pending.first['status'] != 'RETIRADO'),
            onPressed: () => onNavigate('order:${pending.first['id']}'),
          ),
      ],
    );
    return SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (controller.repository.demonstration)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text(
                'Demonstração · dados fictícios',
                style: AgroDesign.caption,
              ),
            ),
          HomeGreeting(userName: home?['userName']),
          const SizedBox(height: 24),
          if (controller.loading)
            const LoadingHome()
          else if (controller.error != null)
            HomeError(message: controller.error!, retry: controller.start)
          else if (home != null) ...[
            if (controller.offline)
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: InfoStrip(
                  icon: Icons.cloud_off_outlined,
                  text: 'Offline · consulta do último snapshot. Reconecte para atualizar os gráficos.',
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: next()),
                const SizedBox(width: 24),
                Expanded(
                  flex: 2,
                  child: WeatherSummary(
                    weather: home['weather'] as Json? ?? {},
                    offline: controller.offline,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            DesktopAnalytics(
              key: ValueKey(
                '${controller.propertyId}:${home['fetchedAt']}:${controller.offline}',
              ),
              controller: controller,
            ),
            const SizedBox(height: 24),
            const SectionHeading(
              title: 'Movimentações recentes',
              subtitle: 'Últimos registros confirmados · não representa o histórico completo',
            ),
            const SizedBox(height: 14),
            if (rows(home['recentLots']).isEmpty)
              const Text(
                'Os registros aparecerão aqui após sua primeira produção.',
                style: AgroDesign.body,
              ),
            for (final lot in rows(home['recentLots']))
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: RecentLotCard(
                  lot: lot,
                  onPressed: () => onNavigate('lot:${lot['id']}'),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class DesktopAnalytics extends StatefulWidget {
  final HomeController controller;
  const DesktopAnalytics({super.key, required this.controller});
  @override
  State<DesktopAnalytics> createState() => _DesktopAnalyticsState();
}

class _DesktopAnalyticsState extends State<DesktopAnalytics> {
  late Future<OperationalData> future;
  @override
  void initState() {
    super.initState();
    future = load();
  }

  Future<OperationalData> load() =>
      OperationalData.load(widget.controller, widget.controller.propertyId!);
  @override
  Widget build(BuildContext context) => FutureBuilder<OperationalData>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(snapshot.error.toString(), style: AgroDesign.body),
            TextButton(
              onPressed: () {
                setState(() {
                  future = load();
                });
              },
              child: const Text('Tentar novamente'),
            ),
          ],
        );
      }
      if (!snapshot.hasData) {
        return const LinearProgressIndicator(
          semanticsLabel: 'Carregando distribuições operacionais',
        );
      }
      final data = snapshot.data!;
      Widget metric(String title, String value) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AgroDesign.wash,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: AgroDesign.caption),
            const SizedBox(height: 8),
            Text(value, style: AgroDesign.title),
          ],
        ),
      );
      return Column(
        children: [
          Row(
            children: [
              Expanded(
                child: metric(
                  'Produção registrada',
                  '${chartNumber(data.kilograms)} kg',
                ),
              ),
              const SizedBox(width: 24),
              Expanded(
                child: metric(
                  'Pedidos vinculados aos lotes',
                  chartNumber(data.count),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          LayoutBuilder(
            builder: (context, c) {
              final charts = [
                OperationalChart(
                  title: 'Produção por cultura',
                  unit: 'kg',
                  values: data.crops,
                ),
                OperationalChart(
                  title: 'Pedidos por situação',
                  unit: 'pedidos',
                  values: data.orders,
                  donut: true,
                ),
              ];
              return c.maxWidth >= 850
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: charts[0]),
                        const SizedBox(width: 24),
                        Expanded(child: charts[1]),
                      ],
                    )
                  : Column(
                      children: [
                        charts[0],
                        const SizedBox(height: 24),
                        charts[1],
                      ],
                    );
            },
          ),
        ],
      );
    },
  );
}
