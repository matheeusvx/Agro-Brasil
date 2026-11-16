import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'data.dart';
import 'design.dart';
import 'illustrations.dart';
import 'profile.dart';

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
  final bool onDark;
  const HomeGreeting({super.key, this.userName, this.onDark = false});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        header: true,
        child: Text(
          homeGreeting(userName),
          style: AgroDesign.display.copyWith(
            color: onDark ? Colors.white : AgroDesign.ink,
          ),
        ),
      ),
      const SizedBox(height: 6),
      Text(
        'Acompanhe sua produção e sua rotina de hoje.',
        style: AgroDesign.body.copyWith(
          color: onDark ? const Color(0xFFD3E6D8) : AgroDesign.muted,
        ),
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
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
    final ready =
        !controller.loading && controller.error == null && home != null;
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
          color: AgroDesign.forest,
          onRefresh: () => controller.propertyId == null
              ? controller.start()
              : controller.load(controller.propertyId!),
          child: ListView(
            key: const ValueKey('home-scroll'),
            padding: const EdgeInsets.only(bottom: 28),
            children: [
              // Faixa verde contínua com a barra superior: saudação e clima.
              Container(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 22),
                decoration: const BoxDecoration(
                  color: AgroDesign.forest,
                  borderRadius: BorderRadius.vertical(
                    bottom: Radius.circular(32),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ValueListenableBuilder<ProfilePrefs>(
                      valueListenable: appPrefs,
                      builder: (context, prefs, _) => HomeGreeting(
                        userName: prefs.displayName.isNotEmpty
                            ? prefs.displayName
                            : home?['userName'] as String?,
                        onDark: true,
                      ),
                    ),
                    if (ready) ...[
                      const SizedBox(height: 18),
                      WeatherSummary(
                        weather: home['weather'] as Json? ?? {},
                        offline: controller.offline,
                        onDark: true,
                      ),
                    ],
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (controller.loading)
                      const LoadingHome()
                    else if (controller.error != null)
                      HomeError(
                        message: controller.error!,
                        retry: controller.start,
                      )
                    else if (home != null) ...[
                      if (controller.offline) ...[
                        InfoStrip(
                          icon: Icons.cloud_off_outlined,
                          text:
                              'Offline · somente consulta. Dados salvos em ${dateLabel(home['fetchedAt'])}. Reconecte para registrar alterações.',
                        ),
                        const SizedBox(height: 16),
                      ],
                      if (first) ...[
                        FirstProductionCard(
                          enabled: canEdit,
                          onPressed: () => onNavigate('production-new'),
                        ),
                        const SizedBox(height: 12),
                        ExpansionTile(
                          tilePadding: const EdgeInsets.symmetric(
                            horizontal: 4,
                          ),
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
                              padding: const EdgeInsets.only(bottom: 12),
                              child: PendingCard(
                                pending: p,
                                disabled:
                                    controller.offline ||
                                    (p['status'] != 'RETIRADO' && !canEdit),
                                onPressed: () => onNavigate('order:${p['id']}'),
                              ),
                            ),
                          ),
                        const SizedBox(height: 16),
                        const SectionHeading(title: 'Ações rápidas'),
                        const SizedBox(height: 12),
                        shortcuts(),
                      ],
                      if (lots.isNotEmpty) ...[
                        const SizedBox(height: AgroDesign.sectionGap),
                        const SectionHeading(
                          title: 'Caminho da sua produção',
                          subtitle: 'Últimos registros dos seus lotes',
                        ),
                        const SizedBox(height: 12),
                        ...lots.map(
                          (lot) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: RecentLotCard(
                              lot: lot,
                              onPressed: () => onNavigate('lot:${lot['id']}'),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
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
    return AgroSurface(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const IconBubble(Icons.landscape_outlined),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      label: 'Propriedade selecionada: $name',
                      child: ExcludeSemantics(
                        child: Text(name, style: AgroDesign.section),
                      ),
                    ),
                    if (municipality != null && uf != null) ...[
                      const SizedBox(height: 2),
                      Text('$municipality · $uf', style: AgroDesign.caption),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (controller.properties.length > 1) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: controller.loading
                  ? null
                  : () async {
                      final id = await showModalBottomSheet<String>(
                        context: context,
                        showDragHandle: true,
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(28),
                          ),
                        ),
                        builder: (context) => SafeArea(
                          child: ListView(
                            shrinkWrap: true,
                            children: [
                              const Padding(
                                padding: EdgeInsets.fromLTRB(20, 4, 20, 12),
                                child: Text(
                                  'Escolha a propriedade',
                                  style: AgroDesign.title,
                                ),
                              ),
                              ...controller.properties.map(
                                (p) => ListTile(
                                  minVerticalPadding: 14,
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 20,
                                  ),
                                  leading: IconBubble(
                                    p['id'] == controller.propertyId
                                        ? Icons.check
                                        : Icons.landscape_outlined,
                                    size: 40,
                                  ),
                                  title: Text(p['name']),
                                  onTap: () =>
                                      Navigator.pop(context, p['id'] as String),
                                ),
                              ),
                              const SizedBox(height: 8),
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
    );
  }
}

class SectionHeading extends StatelessWidget {
  final String title;
  final String? subtitle;
  const SectionHeading({super.key, required this.title, this.subtitle});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 2),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(title, style: AgroDesign.section.copyWith(fontSize: 18)),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(subtitle!, style: AgroDesign.caption),
        ],
      ],
    ),
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
    final accent = tracking ? AgroDesign.green : AgroDesign.earth;
    return AgroSurface(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconBubble(
                tracking
                    ? Icons.outbound_outlined
                    : requested
                    ? Icons.mark_email_unread_outlined
                    : Icons.local_shipping_outlined,
                background: tracking ? AgroDesign.mint : AgroDesign.attention,
                color: accent,
                size: 46,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tracking
                          ? 'EM ACOMPANHAMENTO'
                          : requested
                          ? 'SOLICITAÇÃO RECEBIDA'
                          : 'AGUARDANDO RETIRADA',
                      style: AgroDesign.eyebrow.copyWith(color: accent),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${pending['cropName']} · ${pending['quantityKg']} kg',
                      style: AgroDesign.title,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(detail, style: AgroDesign.caption),
          const SizedBox(height: 14),
          if (tracking)
            OutlinedButton.icon(
              onPressed: disabled ? null : onPressed,
              icon: const Icon(Icons.arrow_forward, size: 18),
              label: Text(action),
            )
          else
            FilledButton.icon(
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
        ? AgroDesign.mint
        : art == FarmArt.offer
        ? const Color(0xFFF6EFDD)
        : art == FarmArt.route
        ? AgroDesign.sky
        : const Color(0xFFF3EBE3);
    return SizedBox(
      width: width,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AgroDesign.radius),
          boxShadow: enabled ? AgroDesign.softShadow : null,
        ),
        child: OutlinedButton(
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.all(14),
            minimumSize: Size(48, compact ? 112 : 128),
            backgroundColor: enabled ? AgroDesign.paper : AgroDesign.disabled,
            foregroundColor: AgroDesign.forest,
            side: BorderSide.none,
            alignment: Alignment.topLeft,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AgroDesign.radius),
            ),
          ),
          onPressed: enabled ? onPressed : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: compact ? 52 : 60,
                    height: compact ? 46 : 54,
                    decoration: BoxDecoration(
                      color: enabled ? tint : AgroDesign.paper,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    alignment: Alignment.center,
                    child: FarmIllustration(
                      art: art,
                      width: compact ? 46 : 54,
                      height: compact ? 34 : 40,
                    ),
                  ),
                  const Spacer(),
                  Icon(
                    enabled ? Icons.arrow_outward : Icons.lock_outline,
                    size: 18,
                    color: AgroDesign.muted,
                  ),
                ],
              ),
              SizedBox(height: compact ? 10 : 14),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.25,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
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
    return AgroSurface(
      onTap: onPressed,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          IconBubble(
            received ? Icons.task_alt : Icons.eco_outlined,
            color: AgroDesign.green,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(lot['cropName'], style: AgroDesign.section),
                const SizedBox(height: 3),
                Text(
                  label,
                  style: AgroDesign.body.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: received ? AgroDesign.green : AgroDesign.earth,
                  ),
                ),
                const SizedBox(height: 1),
                Text(dateLabel(event['recordedAt']), style: AgroDesign.caption),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.chevron_right, color: AgroDesign.muted),
        ],
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
  Widget build(BuildContext context) => AgroSurface(
    padding: const EdgeInsets.all(22),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'SEU PRIMEIRO PASSO',
                style: TextStyle(
                  fontSize: 11,
                  height: 1.3,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                  color: AgroDesign.green,
                ),
              ),
            ),
            ExcludeSemantics(
              child: Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: AgroDesign.mint,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: const FarmIllustration(
                  art: FarmArt.harvest,
                  width: 54,
                  height: 40,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        const Text('Dê uma origem à sua colheita.', style: AgroDesign.title),
        const SizedBox(height: 8),
        Text(
          'Registre o que você colheu. O lote e seu primeiro registro de origem são criados juntos.',
          style: AgroDesign.body.copyWith(color: AgroDesign.muted),
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
  Widget build(BuildContext context) => const AgroSurface(
    child: Row(
      children: [
        IconBubble(
          Icons.task_alt,
          background: AgroDesign.brandWash,
          color: AgroDesign.green,
        ),
        SizedBox(width: 14),
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
              SizedBox(height: 2),
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
  final bool onDark;
  const WeatherSummary({
    super.key,
    required this.weather,
    this.offline = false,
    this.onDark = false,
  });
  static const _gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFE5F2F5), Color(0xFFEAF5E6)],
  );
  @override
  Widget build(BuildContext context) {
    final temperature = weather['temperatureC'];
    final observed = DateTime.tryParse(weather['observedAt']?.toString() ?? '');
    if (weather['status'] != 'available' ||
        temperature is! num ||
        !temperature.isFinite ||
        observed == null) {
      final tone = onDark ? const Color(0xFFD3E6D8) : AgroDesign.muted;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: onDark ? const Color(0x14FFFFFF) : AgroDesign.paper,
          borderRadius: BorderRadius.circular(AgroDesign.smallRadius),
        ),
        child: Row(
          children: [
            Icon(Icons.cloud_off_outlined, size: 18, color: tone),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Clima indisponível',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: tone,
                ),
              ),
            ),
          ],
        ),
      );
    }
    final locality = weather['locality'] as Json? ?? {};
    final condition =
        weather['description']?.toString() ?? 'Condição não informada';
    final large = MediaQuery.textScalerOf(context).scale(14) > 22;
    final stale = offline || weather['stale'] == true;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AgroDesign.radius),
      child: DecoratedBox(
        decoration: const BoxDecoration(gradient: _gradient),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              children: [
                if (!large)
                  Positioned(
                    right: -6,
                    top: 10,
                    child: FarmIllustration(
                      art: FarmArt.weather,
                      width: 128,
                      height: 86,
                      condition: condition,
                      night: weather['icon']?.toString().endsWith('n') == true,
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.location_on_outlined,
                            size: 15,
                            color: AgroDesign.ink,
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              '${locality['municipality'] ?? 'Localidade cadastrada'}${locality['uf'] == null ? '' : '/${locality['uf']}'}',
                              style: AgroDesign.caption.copyWith(
                                color: AgroDesign.ink,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Padding(
                        padding: EdgeInsets.only(right: large ? 0 : 110),
                        child: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 10,
                          children: [
                            Text(
                              '${temperature.round()} °C',
                              style: const TextStyle(
                                fontSize: 38,
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
                      const SizedBox(height: 2),
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
                border: Border(top: BorderSide(color: Color(0x1A173F32))),
              ),
              child: TextButton(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 6,
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
                      width: 38,
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
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Preparando sua rotina…', style: AgroDesign.section),
        const SizedBox(height: 14),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: const LinearProgressIndicator(minHeight: 4),
        ),
        const SizedBox(height: 18),
        ...[150.0, 96.0].map(
          (height) => Container(
            height: height,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: AgroDesign.paper,
              borderRadius: BorderRadius.circular(AgroDesign.radius),
              boxShadow: AgroDesign.softShadow,
            ),
          ),
        ),
      ],
    ),
  );
}

class HomeError extends StatelessWidget {
  final String message;
  final VoidCallback retry;
  const HomeError({super.key, required this.message, required this.retry});
  @override
  Widget build(BuildContext context) => AgroSurface(
    padding: const EdgeInsets.all(22),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Align(
          alignment: Alignment.centerLeft,
          child: IconBubble(
            Icons.cloud_off_outlined,
            background: AgroDesign.dangerWash,
            color: AgroDesign.danger,
            size: 52,
          ),
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
