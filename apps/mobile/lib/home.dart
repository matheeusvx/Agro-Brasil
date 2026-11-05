import 'package:flutter/material.dart';

import 'data.dart';

const green = Color(0xFF24563C);
String eventLabel(String? type) => switch (type) {
  'RETIRADA_REGISTRADA' => 'Retirada registrada',
  'RECEBIMENTO_CONFIRMADO' => 'Recebimento confirmado',
  'PEDIDO_SOLICITADO' => 'Solicitação recebida',
  'PEDIDO_ACEITO' => 'Pedido aceito',
  'PEDIDO_CANCELADO' => 'Pedido cancelado',
  'OFERTA_PUBLICADA' => 'Oferta publicada',
  _ => 'Origem registrada',
};
String dateLabel(dynamic value) {
  final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
  if (date == null) return 'Horário indisponível';
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')} às ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

class InfoStrip extends StatelessWidget {
  final IconData icon;
  final String text;
  const InfoStrip({super.key, required this.icon, required this.text});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFFF0EAD9),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: const Color(0xFF665136)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              height: 1.4,
              color: Color(0xFF51432D),
            ),
          ),
        ),
      ],
    ),
  );
}

class HomeScreen extends StatelessWidget {
  final HomeController controller;
  final void Function(String) onNavigate;
  const HomeScreen({
    super.key,
    required this.controller,
    required this.onNavigate,
  });
  @override
  Widget build(BuildContext context) {
    final home = controller.home;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: RefreshIndicator(
          onRefresh: () => controller.propertyId == null
              ? controller.start()
              : controller.load(controller.propertyId!),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              if (controller.repository.demonstration) ...[
                InfoStrip(
                  icon: Icons.science_outlined,
                  text: controller.repository.fixture
                      ? 'Cenário demonstrativo · dados fictícios · sem gravações'
                      : 'Ambiente demonstrativo · dados fictícios',
                ),
                const SizedBox(height: 16),
              ],
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Olá, pequeno produtor!',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 5),
                        const Text(
                          'Vamos cuidar do que importa hoje.',
                          style: TextStyle(color: Color(0xFF586452)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const ExcludeSemantics(
                    child: SizedBox(
                      width: 62,
                      height: 62,
                      child: CustomPaint(painter: FieldSketch()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              if (controller.properties.isNotEmpty)
                DropdownButtonFormField<String>(
                  key: ValueKey(controller.propertyId),
                  initialValue: controller.propertyId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Propriedade selecionada',
                    prefixIcon: Icon(Icons.place_outlined),
                  ),
                  items: controller.properties
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
                  onChanged: controller.loading
                      ? null
                      : (id) {
                          if (id != null) controller.load(id);
                        },
                ),
              const SizedBox(height: 16),
              if (controller.loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 36),
                  child: Column(
                    children: [
                      LinearProgressIndicator(),
                      SizedBox(height: 16),
                      Text('Carregando sua propriedade…'),
                    ],
                  ),
                )
              else if (controller.error != null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.cloud_off_outlined, color: green),
                        const SizedBox(height: 12),
                        Text(
                          'Não foi possível atualizar',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Semantics(
                          liveRegion: true,
                          child: Text(controller.error!),
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: controller.start,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Tentar novamente'),
                        ),
                      ],
                    ),
                  ),
                )
              else if (home != null) ...[
                if (controller.offline) ...[
                  InfoStrip(
                    icon: Icons.cloud_off_outlined,
                    text:
                        'Sem acesso ao serviço · somente consulta. Dados salvos em ${dateLabel(home['fetchedAt'])}. Ações de alteração estão desativadas.',
                  ),
                  const SizedBox(height: 14),
                ],
                WeatherSummary(
                  weather: home['weather'] as Json? ?? {},
                  offline: controller.offline,
                ),
                const SizedBox(height: 22),
                if (home['hasProductions'] != true)
                  Card(
                    color: const Color(0xFFE9F0DD),
                    child: Padding(
                      padding: const EdgeInsets.all(22),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.spa_outlined,
                            size: 34,
                            color: green,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Seu primeiro registro começa aqui',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Cadastre o que você colheu. A produção ganha um lote e uma origem para acompanhar cada próximo passo.',
                          ),
                          const SizedBox(height: 18),
                          FilledButton(
                            onPressed: home['canWrite'] == true
                                ? () => onNavigate('production-new')
                                : null,
                            child: const Text(
                              'Cadastrar minha primeira produção',
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else ...[
                  Text(
                    'O que precisa da sua atenção',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  if (rows(home['pending']).isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(18),
                        child: Row(
                          children: [
                            Icon(Icons.check_circle_outline, color: green),
                            SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Tudo em dia por aqui.\nNenhuma pendência nesta propriedade.',
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    ...rows(home['pending'])
                        .take(2)
                        .map(
                          (p) => PendingCard(
                            pending: p,
                            onPressed: () => onNavigate('order:${p['id']}'),
                          ),
                        ),
                ],
                const SizedBox(height: 24),
                Text(
                  'Ações rápidas',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = constraints.maxWidth >= 580 ? 4 : 2;
                    final width =
                        (constraints.maxWidth - (columns - 1) * 12) / columns;
                    return Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        QuickAction(
                          width: width,
                          icon: Icons.add_circle_outline,
                          label: 'Cadastrar produção',
                          enabled: home['canWrite'] == true,
                          onPressed: () => onNavigate('production-new'),
                        ),
                        QuickAction(
                          width: width,
                          icon: Icons.sell_outlined,
                          label: 'Oferecer produtos',
                          enabled: home['canWrite'] == true,
                          onPressed: () => onNavigate('offer-new'),
                        ),
                        QuickAction(
                          width: width,
                          icon: Icons.qr_code_2,
                          label: 'Rastrear lote',
                          onPressed: () => onNavigate('lots'),
                        ),
                        QuickAction(
                          width: width,
                          icon: Icons.receipt_long_outlined,
                          label: 'Ver pedidos',
                          onPressed: () => onNavigate('orders'),
                        ),
                      ],
                    );
                  },
                ),
                if (rows(home['recentLots']).isNotEmpty) ...[
                  const SizedBox(height: 26),
                  Text(
                    'Últimas movimentações',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 10),
                  ...rows(home['recentLots'])
                      .take(2)
                      .map(
                        (lot) => Card(
                          child: ListTile(
                            minVerticalPadding: 14,
                            leading: const CircleAvatar(
                              backgroundColor: Color(0xFFE8EEDC),
                              child: Icon(Icons.grass, color: green),
                            ),
                            title: Text(
                              lot['cropName'],
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            subtitle: Text(
                              '${eventLabel(lot['lastEvent']['type'])}\n${dateLabel(lot['lastEvent']['recordedAt'])}',
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => onNavigate('lot:${lot['id']}'),
                          ),
                        ),
                      ),
                ],
                const SizedBox(height: 18),
                Text(
                  'Atualizado em ${dateLabel(home['fetchedAt'])} · histórico por eventos, sem GPS contínuo.',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF586452),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class WeatherSummary extends StatelessWidget {
  final Json weather;
  final bool offline;
  const WeatherSummary({
    super.key,
    required this.weather,
    this.offline = false,
  });
  @override
  Widget build(BuildContext context) {
    if (weather['status'] != 'available' || offline) {
      return const Row(
        children: [
          Icon(Icons.cloud_off_outlined, size: 18, color: Color(0xFF647064)),
          SizedBox(width: 8),
          Text(
            'Clima indisponível',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF344C3B),
            ),
          ),
        ],
      );
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF4EAD0),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          const Icon(Icons.wb_cloudy_outlined, color: Color(0xFF785D2C)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${(weather['temperatureC'] as num).round()} °C · ${weather['description']}',
                ),
                Text(
                  'Umidade do ar: ${weather['humidityPercent']}% · ${dateLabel(weather['observedAt'])}',
                  style: const TextStyle(fontSize: 12),
                ),
                const Text(
                  'Fonte: OpenWeather · openweathermap.org',
                  style: TextStyle(fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PendingCard extends StatelessWidget {
  final Json pending;
  final VoidCallback onPressed;
  const PendingCard({
    super.key,
    required this.pending,
    required this.onPressed,
  });
  @override
  Widget build(BuildContext context) {
    final status = pending['status'];
    final (title, action, icon) = switch (status) {
      'SOLICITADO' => (
        'Solicitação aguardando resposta',
        'Responder solicitação',
        Icons.mark_email_unread_outlined,
      ),
      'ACEITO' => (
        'Pedido aguardando retirada',
        'Registrar retirada',
        Icons.local_shipping_outlined,
      ),
      _ => (
        'Aguardando recebimento',
        'Acompanhar pedido',
        Icons.inventory_2_outlined,
      ),
    };
    return Card(
      color: status == 'SOLICITADO' ? const Color(0xFFF6EDD9) : Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: green),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 17,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text('${pending['cropName']} · ${pending['quantityKg']} kg'),
            if (status == 'RETIRADO')
              const Text(
                'A confirmação deve ser feita pelo destinatário.',
                style: TextStyle(fontSize: 13),
              ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.arrow_forward, size: 18),
              label: Text(action),
            ),
          ],
        ),
      ),
    );
  }
}

class QuickAction extends StatelessWidget {
  final double width;
  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool enabled;
  const QuickAction({
    super.key,
    required this.width,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.enabled = true,
  });
  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: OutlinedButton(
      onPressed: enabled ? onPressed : null,
      style: OutlinedButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: green,
        padding: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        side: const BorderSide(color: Color(0xFFD6E1CB)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 28),
          const SizedBox(height: 10),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, height: 1.3),
          ),
        ],
      ),
    ),
  );
}

class FieldSketch extends CustomPainter {
  const FieldSketch();
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawCircle(
      Offset(size.width / 2, size.height / 2),
      30,
      Paint()..color = const Color(0xFFE8EEDC),
    );
    final p = Paint()
      ..color = green
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    canvas.drawLine(const Offset(30, 49), const Offset(30, 23), p);
    canvas.drawOval(
      const Rect.fromLTWH(30, 13, 19, 12),
      Paint()..color = const Color(0xFF66874C),
    );
    canvas.drawOval(
      const Rect.fromLTWH(12, 24, 19, 12),
      Paint()..color = const Color(0xFF94AA6E),
    );
    canvas.drawArc(const Rect.fromLTWH(10, 42, 42, 16), 3.3, 2.8, false, p);
  }

  @override
  bool shouldRepaint(covariant FieldSketch oldDelegate) => false;
}
