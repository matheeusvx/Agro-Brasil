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
          child: Text(
            'Avisos',
            style: AgroDesign.section.copyWith(fontSize: 18),
          ),
        ),
        if (alerts.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: AgroSurface(
              child: Row(
                children: [
                  IconBubble(Icons.check, size: 40),
                  SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      'Nenhum aviso pelas regras avaliadas.',
                      style: AgroDesign.body,
                    ),
                  ),
                ],
              ),
            ),
          ),
        for (final alert in alerts)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: ExplainedAlertCard(key: ValueKey(alert.id), alert: alert),
          ),
        const SizedBox(height: 20),
      ],
    );
  }
}

class ExplainedAlertCard extends StatelessWidget {
  final ExplainedAlert alert;
  const ExplainedAlertCard({super.key, required this.alert});
  @override
  Widget build(BuildContext context) {
    final attention = alert.attention != 'Informativo';
    final low = alert.confidence.startsWith('Baixa');
    return AgroSurface(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconBubble(
                attention ? Icons.priority_high_rounded : Icons.info_outline,
                background: attention ? AgroDesign.attention : AgroDesign.mint,
                color: attention ? AgroDesign.earth : AgroDesign.forest,
                size: 40,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(alert.title, style: AgroDesign.section),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${alert.attention} · Confiança: ${low ? 'Baixa' : 'Moderada'}'
                      '${alert.outdated ? ' · situação atual não confirmada' : ''}',
                      style: AgroDesign.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
          ExpansionTile(
            key: PageStorageKey('alert-${alert.id}'),
            tilePadding: const EdgeInsets.only(left: 52),
            childrenPadding: const EdgeInsets.only(left: 52, bottom: 8),
            expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
            expansionAnimationStyle: AnimationStyle(
              duration: dashboardMotion(context),
              reverseDuration: dashboardMotion(context),
            ),
            title: const Text(
              'Entender o aviso',
              style: TextStyle(
                fontSize: 14,
                color: AgroDesign.forest,
                fontWeight: FontWeight.w700,
              ),
            ),
            children: [
              Text(alert.kind, style: AgroDesign.caption),
              const SizedBox(height: 10),
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
                        child: Text(
                          entry.key,
                          style: AgroDesign.body.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(entry.value, style: AgroDesign.caption),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
