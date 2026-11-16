import 'dart:async';

import 'package:flutter/material.dart';

import '../design.dart';
import 'dashboard_components.dart';
import 'explained_alert.dart';

/// Re-evaluate freshness while the dashboard stays open, also after resume.
class DashboardAlerts extends StatefulWidget {
  final List<ExplainedAlert> Function(DateTime now) evaluate;
  const DashboardAlerts({super.key, required this.evaluate});
  @override
  State<DashboardAlerts> createState() => _DashboardAlertsState();
}

class _DashboardAlertsState extends State<DashboardAlerts>
    with WidgetsBindingObserver {
  Timer? timer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    timer = Timer.periodic(const Duration(minutes: 1), (_) => setState(() {}));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) setState(() {});
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alerts = widget.evaluate(DateTime.now().toUtc());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: const Text('Avisos explicados', style: AgroDesign.section),
        ),
        const SizedBox(height: 8),
        const Text('A decisão final é humana.', style: AgroDesign.caption),
        if (alerts.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'Nenhum aviso pelas regras avaliadas. Isso não garante ausência de riscos.',
              style: AgroDesign.body,
            ),
          ),
        for (final alert in alerts)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: ExplainedAlertCard(key: ValueKey(alert.id), alert: alert),
          ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class ExplainedAlertCard extends StatelessWidget {
  final ExplainedAlert alert;
  const ExplainedAlertCard({super.key, required this.alert});
  @override
  Widget build(BuildContext context) => DashboardCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            const Icon(Icons.info_outline, color: AgroDesign.forest),
            Text(alert.attention, style: AgroDesign.eyebrow),
            Text(alert.kind, style: AgroDesign.caption),
          ],
        ),
        const SizedBox(height: 8),
        if (alert.outdated)
          const Text(
            'Dados desatualizados · situação atual não confirmada',
            style: AgroDesign.caption,
          ),
        Semantics(
          header: true,
          child: Text(alert.title, style: AgroDesign.section),
        ),
        const SizedBox(height: 8),
        Text(
          'Confiança: ${alert.confidence.startsWith('Baixa') ? 'Baixa · confira a origem e a atualização dos dados' : 'Moderada · confira os limites da evidência'}',
          style: AgroDesign.caption,
        ),
        ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(bottom: 8),
          expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
          expansionAnimationStyle: AnimationStyle(
            duration: dashboardMotion(context),
            reverseDuration: dashboardMotion(context),
          ),
          title: const Text(
            'Entender o aviso',
            style: TextStyle(
              color: AgroDesign.forest,
              fontWeight: FontWeight.w700,
            ),
          ),
          children: [
            for (final entry in <String, String>{
              'Justificativa': alert.reason,
              'Evidência': alert.evidence,
              'Confiança e fundamento': alert.confidence,
              'Limitações': alert.limitations,
              'Avaliação humana': humanDecision,
            }.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(entry.key, style: AgroDesign.section),
                    ),
                    const SizedBox(height: 4),
                    Text(entry.value, style: AgroDesign.body),
                  ],
                ),
              ),
          ],
        ),
      ],
    ),
  );
}
