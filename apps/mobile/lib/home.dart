import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'data.dart';
import 'design.dart';
import 'illustrations.dart';

const green = AgroDesign.green;
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

String producerGreeting(dynamic name) {
  if (name is String &&
      name.trim().length >= 2 &&
      name.trim().length <= 60 &&
      !RegExp(r'[0-9@<>]').hasMatch(name) &&
      !name.toLowerCase().contains('fict')) {
    return 'Olá, ${name.trim().split(RegExp(r'\s+')).first}!';
  }
  return 'Olá, pequeno produtor!';
}

String homeGreeting(dynamic name) {
  final fullName = name is String ? name.trim() : '';
  final firstName = fullName.isEmpty
      ? 'produtor'
      : fullName.split(RegExp(r'\s+')).first;
  return 'Olá, $firstName';
}

class HomeGreeting extends StatelessWidget {
  final String? userName;
  const HomeGreeting({super.key, this.userName});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(homeGreeting(userName), style: AgroDesign.title),
      const SizedBox(height: 6),
      Text(
        'Acompanhe sua produção e sua rotina de hoje.',
        style: AgroDesign.body.copyWith(color: AgroDesign.muted),
      ),
    ],
  );
}

class InfoStrip extends StatelessWidget {
  final IconData icon;
  final String text;
  const InfoStrip({super.key, required this.icon, required this.text});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AgroDesign.attention,
      borderRadius: BorderRadius.circular(AgroDesign.smallRadius),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: AgroDesign.earth),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: AgroDesign.caption.copyWith(color: AgroDesign.earth),
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
    final first = home != null && home['hasProductions'] != true;
    final canEdit =
        home?['canWrite'] == true && !controller.offline && !controller.loading;
    final pending = rows(home?['pending']).take(2).toList();
    final lots = rows(home?['recentLots']).take(2).toList();
    Widget shortcuts({bool compact = false}) => LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 580 ? 4 : 2;
        final width =
            (constraints.maxWidth - (columns - 1) * AgroDesign.gap) / columns;
        return Wrap(
          spacing: AgroDesign.gap,
          runSpacing: AgroDesign.gap,
          children: [
            QuickAction(
              width: width,
              icon: Icons.add_circle_outline,
              label: 'Cadastrar produção',
              enabled: canEdit,
              compact: compact,
              onPressed: () => onNavigate('production-new'),
            ),
            QuickAction(
              width: width,
              icon: Icons.sell_outlined,
              label: 'Oferecer produtos',
              enabled: canEdit,
              compact: compact,
              onPressed: () => onNavigate('offer-new'),
            ),
            QuickAction(
              width: width,
              icon: Icons.route_outlined,
              label: 'Rastrear lote',
              enabled: !controller.offline,
              compact: compact,
              onPressed: () => onNavigate('lots'),
            ),
            QuickAction(
              width: width,
              icon: Icons.receipt_long_outlined,
              label: 'Ver pedidos',
              enabled: !controller.offline,
              compact: compact,
              onPressed: () => onNavigate('orders'),
            ),
          ],
        );
      },
    );
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: RefreshIndicator(
          onRefresh: () => controller.propertyId == null
              ? controller.start()
              : controller.load(controller.propertyId!),
          child: ListView(
            key: const ValueKey('home-scroll'),
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: [
              if (controller.repository.demonstration)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.science_outlined,
                        size: 15,
                        color: AgroDesign.earth,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          controller.repository.fixture
                              ? 'Demonstração · dados fictícios · sem gravações'
                              : 'Demonstração · dados fictícios',
                          style: AgroDesign.caption.copyWith(
                            fontSize: 12,
                            color: AgroDesign.earth,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              HomeGreeting(userName: home?['userName'] as String?),
              const SizedBox(height: 20),
              if (controller.loading)
                const LoadingHome()
              else if (controller.error != null)
                HomeError(message: controller.error!, retry: controller.start)
              else if (home != null) ...[
                if (controller.offline) ...[
                  InfoStrip(
                    icon: Icons.cloud_off_outlined,
                    text:
                        'Offline · somente consulta. Dados salvos em ${dateLabel(home['fetchedAt'])}. Reconecte para registrar alterações.',
                  ),
                  const SizedBox(height: 12),
                ],
                WeatherSummary(
                  weather: home['weather'] as Json? ?? {},
                  offline: controller.offline,
                ),
                const SizedBox(height: 20),
                if (first) ...[
                  FirstProductionCard(
                    enabled: canEdit,
                    onPressed: () => onNavigate('production-new'),
                  ),
                  const SizedBox(height: 16),
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: const Text(
                      'Outras ações',
                      style: AgroDesign.section,
                    ),
                    subtitle: const Text(
                      'Produção, ofertas, histórico e pedidos',
                      style: AgroDesign.caption,
                    ),
                    children: [shortcuts(compact: true)],
                  ),
                ] else ...[
                  SectionHeading(
                    title: pending.isEmpty
                        ? 'Sua rotina, em dia'
                        : pending.every((p) => p['status'] == 'RETIRADO')
                        ? 'Acompanhe seus pedidos'
                        : 'Sua próxima ação',
                  ),
                  const SizedBox(height: 12),
                  if (pending.isEmpty)
                    const AllClearCard()
                  else
                    ...pending.map(
                      (p) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: PendingCard(
                          pending: p,
                          disabled:
                              controller.offline ||
                              (p['status'] != 'RETIRADO' && !canEdit),
                          onPressed: () => onNavigate('order:${p['id']}'),
                        ),
                      ),
                    ),
                  const SizedBox(height: 20),
                  const SectionHeading(title: 'Ações rápidas'),
                  const SizedBox(height: 12),
                  shortcuts(),
                ],
                if (lots.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  const SectionHeading(
                    title: 'Caminho da sua produção',
                    subtitle: 'Últimos registros dos seus lotes',
                  ),
                  const SizedBox(height: 12),
                  ...lots.map(
                    (lot) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: RecentLotCard(
                        lot: lot,
                        onPressed: () => onNavigate('lot:${lot['id']}'),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                Text(
                  'Atualizado em ${dateLabel(home['fetchedAt'])}',
                  style: AgroDesign.caption,
                ),
                const SizedBox(height: 4),
                const Text(
                  'Rastreabilidade por eventos confirmados, sem GPS contínuo.',
                  style: AgroDesign.caption,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class PropertyHeader extends StatelessWidget {
  final HomeController controller;
  const PropertyHeader({super.key, required this.controller});
  @override
  Widget build(BuildContext context) {
    final property = controller.properties
        .where((p) => p['id'] == controller.propertyId)
        .firstOrNull;
    final home = controller.home;
    final name = property?['name'] as String? ?? 'Minha propriedade';
    final municipality =
        property?['municipality'] ?? home?['property']?['municipality'];
    final uf = property?['uf'] ?? home?['property']?['uf'];
    final large = MediaQuery.textScalerOf(context).scale(14) > 22;
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: ColoredBox(
        color: AgroDesign.forest,
        child: Stack(
          children: [
            if (!large)
              const Positioned(
                right: -16,
                bottom: 0,
                child: FarmIllustration(width: 174, height: 124),
              ),
            Padding(
              padding: EdgeInsets.fromLTRB(18, 16, large ? 18 : 112, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    producerGreeting(home?['userName']),
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFFE8F1DE),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Semantics(
                    label: 'Propriedade selecionada: $name',
                    child: ExcludeSemantics(
                      child: Text(
                        name,
                        style: const TextStyle(
                          fontSize: 22,
                          height: 1.12,
                          letterSpacing: -.5,
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  if (municipality != null && uf != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      '$municipality · $uf',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFFE8F1DE),
                      ),
                    ),
                  ],
                  if (controller.properties.length > 1) ...[
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0xFFB5C8A8)),
                      ),
                      onPressed: controller.loading
                          ? null
                          : () async {
                              final id = await showModalBottomSheet<String>(
                                context: context,
                                showDragHandle: true,
                                builder: (context) => SafeArea(
                                  child: ListView(
                                    shrinkWrap: true,
                                    children: [
                                      const Padding(
                                        padding: EdgeInsets.all(20),
                                        child: Text(
                                          'Escolha a propriedade',
                                          style: AgroDesign.section,
                                        ),
                                      ),
                                      ...controller.properties.map(
                                        (p) => ListTile(
                                          minVerticalPadding: 14,
                                          leading: Icon(
                                            p['id'] == controller.propertyId
                                                ? Icons.check_circle
                                                : Icons.landscape_outlined,
                                          ),
                                          title: Text(p['name']),
                                          onTap: () => Navigator.pop(
                                            context,
                                            p['id'] as String,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                              if (id != null) await controller.load(id);
                            },
                      icon: const Icon(Icons.swap_horiz),
                      label: const Text('Trocar propriedade'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SectionHeading extends StatelessWidget {
  final String title;
  final String? subtitle;
  const SectionHeading({super.key, required this.title, this.subtitle});
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: AgroDesign.section),
      if (subtitle != null) ...[
        const SizedBox(height: 4),
        Text(subtitle!, style: AgroDesign.caption),
      ],
    ],
  );
}

class PendingCard extends StatelessWidget {
  final Json pending;
  final VoidCallback onPressed;
  final bool disabled;
  const PendingCard({
    super.key,
    required this.pending,
    required this.onPressed,
    this.disabled = false,
  });
  @override
  Widget build(BuildContext context) {
    final tracking = pending['status'] == 'RETIRADO';
    final requested = pending['status'] == 'SOLICITADO';
    final action = requested
        ? 'Responder solicitação'
        : tracking
        ? 'Acompanhar pedido'
        : 'Registrar retirada';
    final detail = requested
        ? 'Aceite ou cancele para responder.'
        : tracking
        ? 'Produto retirado. O destinatário confirma a chegada.'
        : 'Pedido aceito. Confirme a saída dos produtos.';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tracking ? AgroDesign.wash : AgroDesign.paper,
        border: Border.all(
          color: requested ? const Color(0xFFD8C69A) : AgroDesign.line,
        ),
        borderRadius: BorderRadius.circular(AgroDesign.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                tracking
                    ? Icons.outbound_outlined
                    : requested
                    ? Icons.mark_email_unread_outlined
                    : Icons.local_shipping_outlined,
                size: 20,
                color: tracking ? AgroDesign.green : AgroDesign.earth,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tracking
                      ? 'EM ACOMPANHAMENTO'
                      : requested
                      ? 'SOLICITAÇÃO RECEBIDA'
                      : 'AGUARDANDO RETIRADA',
                  style: AgroDesign.eyebrow.copyWith(
                    color: tracking ? AgroDesign.green : AgroDesign.earth,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${pending['cropName']} · ${pending['quantityKg']} kg',
            style: AgroDesign.title,
          ),
          const SizedBox(height: 8),
          Text(detail, style: AgroDesign.caption),
          const SizedBox(height: 16),
          if (tracking)
            OutlinedButton.icon(
              onPressed: disabled ? null : onPressed,
              icon: const Icon(Icons.arrow_forward, size: 18),
              label: Text(action),
            )
          else
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: AgroDesign.forest,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AgroDesign.disabled,
                disabledForegroundColor: AgroDesign.muted,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                minimumSize: const Size(48, 50),
              ),
              onPressed: disabled ? null : onPressed,
              icon: const Icon(Icons.arrow_forward, size: 18),
              label: Text(action),
            ),
        ],
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
  final bool compact;
  const QuickAction({
    super.key,
    required this.width,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.enabled = true,
    this.compact = false,
  });
  @override
  Widget build(BuildContext context) {
    final art = label == 'Cadastrar produção'
        ? FarmArt.harvest
        : label == 'Oferecer produtos'
        ? FarmArt.offer
        : label == 'Rastrear lote'
        ? FarmArt.route
        : FarmArt.orders;
    final tint = art == FarmArt.harvest
        ? AgroDesign.wash
        : art == FarmArt.offer
        ? const Color(0xFFF5ECD8)
        : art == FarmArt.route
        ? AgroDesign.sky
        : const Color(0xFFF0E7DF);
    return SizedBox(
      width: width,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.all(12),
          minimumSize: const Size(48, 100),
          backgroundColor: enabled ? tint : AgroDesign.disabled,
          foregroundColor: AgroDesign.forest,
          side: const BorderSide(color: Colors.transparent),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        onPressed: enabled ? onPressed : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                FarmIllustration(
                  art: art,
                  width: 68,
                  height: compact ? 40 : 48,
                ),
                const Spacer(),
                Icon(enabled ? Icons.north_east : Icons.lock_outline, size: 16),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                height: 1.25,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class RecentLotCard extends StatelessWidget {
  final Json lot;
  final VoidCallback onPressed;
  const RecentLotCard({super.key, required this.lot, required this.onPressed});
  @override
  Widget build(BuildContext context) {
    final event = lot['lastEvent'] as Json;
    final received = event['type'] == 'RECEBIMENTO_CONFIRMADO';
    final label = eventLabel(event['type']);
    return Material(
      color: AgroDesign.paper,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AgroDesign.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AgroDesign.wash,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      received ? Icons.task_alt : Icons.eco_outlined,
                      color: AgroDesign.green,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(lot['cropName'], style: AgroDesign.section),
                  ),
                  const Icon(Icons.chevron_right, color: AgroDesign.muted),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 5),
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: received ? AgroDesign.green : AgroDesign.earth,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          style: AgroDesign.body.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          dateLabel(event['recordedAt']),
                          style: AgroDesign.caption,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Histórico',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AgroDesign.green,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class FirstProductionCard extends StatelessWidget {
  final bool enabled;
  final VoidCallback onPressed;
  const FirstProductionCard({
    super.key,
    required this.enabled,
    required this.onPressed,
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      color: AgroDesign.wash,
      borderRadius: BorderRadius.circular(AgroDesign.radius),
      border: Border.all(color: AgroDesign.line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Row(
          children: [
            Expanded(
              child: Text('SEU PRIMEIRO PASSO', style: AgroDesign.eyebrow),
            ),
            FarmIllustration(art: FarmArt.harvest, width: 72, height: 48),
          ],
        ),
        const SizedBox(height: 12),
        const Text('Dê uma origem à sua colheita.', style: AgroDesign.title),
        const SizedBox(height: 10),
        const Text(
          'Registre o que você colheu. O lote e seu primeiro registro de origem são criados juntos.',
          style: AgroDesign.body,
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: enabled ? onPressed : null,
          icon: const Icon(Icons.add),
          label: const Text('Cadastrar minha primeira produção'),
        ),
      ],
    ),
  );
}

class AllClearCard extends StatelessWidget {
  const AllClearCard({super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: AgroDesign.wash,
      borderRadius: BorderRadius.circular(18),
    ),
    child: const Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.task_alt, color: AgroDesign.green),
        SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tudo em dia por aqui.',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AgroDesign.forest,
                ),
              ),
              SizedBox(height: 4),
              Text(
                'Nenhuma pendência nesta propriedade.',
                style: AgroDesign.caption,
              ),
            ],
          ),
        ),
      ],
    ),
  );
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
    final temperature = weather['temperatureC'];
    final observed = DateTime.tryParse(weather['observedAt']?.toString() ?? '');
    if (weather['status'] != 'available' ||
        temperature is! num ||
        !temperature.isFinite ||
        observed == null) {
      return const Row(
        children: [
          Icon(Icons.cloud_off_outlined, size: 16, color: AgroDesign.muted),
          SizedBox(width: 7),
          Expanded(
            child: Text(
              'Clima indisponível',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AgroDesign.muted,
              ),
            ),
          ),
        ],
      );
    }
    final locality = weather['locality'] as Json? ?? {};
    final condition =
        weather['description']?.toString() ?? 'Condição não informada';
    final large = MediaQuery.textScalerOf(context).scale(14) > 22;
    final stale = offline || weather['stale'] == true;
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: ColoredBox(
        color: AgroDesign.sky,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              children: [
                if (!large)
                  Positioned(
                    right: -10,
                    top: 8,
                    child: FarmIllustration(
                      art: FarmArt.weather,
                      width: 132,
                      height: 88,
                      condition: condition,
                      night: weather['icon']?.toString().endsWith('n') == true,
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${locality['municipality'] ?? 'Localidade cadastrada'}${locality['uf'] == null ? '' : '/${locality['uf']}'}',
                        style: AgroDesign.caption.copyWith(
                          color: AgroDesign.ink,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Padding(
                        padding: EdgeInsets.only(right: large ? 0 : 110),
                        child: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 10,
                          children: [
                            Text(
                              '${temperature.round()} °C',
                              style: const TextStyle(
                                fontSize: 36,
                                height: 1.15,
                                letterSpacing: -1.5,
                                fontWeight: FontWeight.w700,
                                color: AgroDesign.forest,
                              ),
                            ),
                            Text(condition, style: AgroDesign.body),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Observação: ${dateLabel(weather['observedAt'])}',
                        style: AgroDesign.caption,
                      ),
                      if (locality['approximate'] == true)
                        const Text(
                          'Referência aproximada do município',
                          style: AgroDesign.caption,
                        ),
                      if (stale)
                        const Text(
                          'Salvo · não é uma observação atual',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AgroDesign.earth,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            Container(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFC9DDE1))),
              ),
              child: TextButton(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  minimumSize: const Size(48, 48),
                  foregroundColor: AgroDesign.muted,
                  shape: const RoundedRectangleBorder(),
                ),
                onPressed: () async {
                  try {
                    final opened = await launchUrl(
                      Uri.https('openweathermap.org', '/'),
                      mode: LaunchMode.externalApplication,
                    );
                    if (opened || !context.mounted) return;
                  } on Object {
                    if (!context.mounted) return;
                  }
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Fonte: https://openweathermap.org/'),
                      ),
                    );
                  }
                },
                child: Row(
                  children: [
                    Image.asset(
                      'assets/weather/openweather.png',
                      width: 42,
                      semanticLabel: 'OpenWeather',
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Weather data provided by OpenWeather',
                        style: TextStyle(fontSize: 11, height: 1.25),
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.open_in_new, size: 13),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LoadingHome extends StatelessWidget {
  const LoadingHome({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    label: 'Carregando sua propriedade',
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Preparando sua rotina…', style: AgroDesign.section),
          const SizedBox(height: 16),
          const LinearProgressIndicator(),
          const SizedBox(height: 16),
          ...[150.0, 84.0].map(
            (height) => Container(
              height: height,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: AgroDesign.wash,
                borderRadius: BorderRadius.circular(18),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class HomeError extends StatelessWidget {
  final String message;
  final VoidCallback retry;
  const HomeError({super.key, required this.message, required this.retry});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      color: AgroDesign.dangerWash,
      borderRadius: BorderRadius.circular(22),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(
          Icons.cloud_off_outlined,
          color: AgroDesign.danger,
          size: 32,
        ),
        const SizedBox(height: 14),
        const Text('Vamos tentar de novo?', style: AgroDesign.title),
        const SizedBox(height: 8),
        Semantics(
          liveRegion: true,
          child: Text(message, style: AgroDesign.body),
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: retry,
          icon: const Icon(Icons.refresh),
          label: const Text('Tentar novamente'),
        ),
      ],
    ),
  );
}
