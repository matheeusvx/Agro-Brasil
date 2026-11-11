import 'package:flutter/material.dart';

import '../data.dart';
import '../design.dart';
import '../home.dart';
import 'dashboard_components.dart';
import 'impact_data.dart';
import 'water_data.dart';

String impactKg(double kg) {
  final grams = (kg * 1000).round();
  final text = waterNumber(grams / 1000, decimals: grams % 1000 == 0 ? 0 : 3);
  return grams % 1000 == 0 ? text : text.replaceFirst(RegExp(r'0+$'), '');
}

/// Destino dos excedentes da propriedade. Valores prontos da API de impacto.
class ImpactCard extends StatefulWidget {
  final HomeController controller;
  final String property;
  final bool force;
  const ImpactCard({
    super.key,
    required this.controller,
    required this.property,
    this.force = false,
  });
  @override
  State<ImpactCard> createState() => _ImpactCardState();
}

class _ImpactCardState extends State<ImpactCard> {
  late Future<ImpactResult> future;
  Future<ImpactResult> query({bool force = false}) {
    final result = ImpactRepository(widget.controller)
        .load(widget.property, force: force);
    result.ignore();
    return result;
  }

  @override
  void initState() {
    super.initState();
    future = query(force: widget.force);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<ImpactResult>(
    future: future,
    builder: (context, state) {
      if (state.connectionState != ConnectionState.done) {
        return const DashboardStateView(
          status: DashboardStatus.loading,
          message: 'Consultando o destino dos seus excedentes.',
        );
      }
      if (state.hasError) {
        final error = state.error;
        final status = error is ApiFailure ? error.status : -1;
        return DashboardStateView(
          status: DashboardStatus.error,
          message: switch (status) {
            401 => 'Sua sessão expirou. Entre novamente para consultar.',
            403 => 'Seu perfil não pode consultar este indicador.',
            404 => 'Propriedade não encontrada nesta organização.',
            0 => '$error',
            422 => '$error',
            _ =>
              'Indicador indisponível no momento. Nenhum valor foi estimado.',
          },
          onRetry: status == 401 || status == 403 || status == 404
              ? null
              : () => setState(() => future = query(force: true)),
        );
      }
      return _ImpactBody(result: state.data!, property: widget.property);
    },
  );
}

class _ImpactBody extends StatelessWidget {
  final ImpactResult result;
  final String property;
  const _ImpactBody({required this.result, required this.property});

  @override
  Widget build(BuildContext context) {
    final i = result.impact;
    final asOf = dateLabel(i.asOf.toIso8601String());
    return DashboardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DashboardHeading(
            title: 'Destino dos excedentes',
            description: 'O que foi ofertado e o que chegou ao destinatário.',
            icon: Icons.volunteer_activism_outlined,
          ),
          if (i.isDemonstration) ...[
            const SizedBox(height: 10),
            const Text(
              'Dados demonstrativos · não representam operações reais',
              style: AgroDesign.caption,
            ),
          ],
          if (result.saved) ...[
            const SizedBox(height: 10),
            InfoStrip(
              icon: Icons.cloud_off,
              text: 'Dados salvos de $asOf. Reconecte para confirmar.',
            ),
          ],
          const SizedBox(height: 14),
          if (!i.hasOffers)
            const Text(
              'Ainda não há ofertas publicadas nesta propriedade. Publique um excedente para acompanhar o destino.',
              style: AgroDesign.body,
            )
          else ...[
            IndicatorGrid(
              children: [
                _Value('Ofertado', i.funnel['published']!, null),
                _Value(
                  'Recebido',
                  i.funnel['received']!,
                  'confirmado pelo destinatário',
                ),
                _Value(
                  'Vencido sem destinação',
                  i.balances['expiredAvailable']!,
                  null,
                ),
              ],
            ),
            if (i.hasModeData) ...[
              const SizedBox(height: 14),
              for (final (mode, label, icon) in const [
                ('VENDA', 'Venda', Icons.storefront_outlined),
                ('DOACAO', 'Doação', Icons.volunteer_activism_outlined),
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(icon, size: 20, color: AgroDesign.green),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '$label: ${impactKg(i.byMode[mode]!['published']!)} kg ofertados · ${impactKg(i.byMode[mode]!['received']!)} kg recebidos',
                          style: AgroDesign.body,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
            const SizedBox(height: 6),
            Theme(
              data: Theme.of(context)
                  .copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                key: PageStorageKey('impact-details-$property'),
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(bottom: 8),
                expandedCrossAxisAlignment: CrossAxisAlignment.start,
                title: const Text('Ver todas as etapas'),
                children: [
                  const Text('Caminho do excedente', style: AgroDesign.section),
                  for (final (k, label) in const [
                    ('registered', 'Produção registrada'),
                    ('published', 'Ofertado'),
                    ('acceptedNet', 'Aceito em pedidos'),
                    ('pickedUp', 'Retirado'),
                    ('received', 'Recebido (confirmado)'),
                  ])
                    Text(
                      '$label: ${impactKg(i.funnel[k]!)} kg',
                      style: AgroDesign.body,
                    ),
                  const SizedBox(height: 10),
                  const Text(
                    'Saldos das ofertas agora',
                    style: AgroDesign.section,
                  ),
                  for (final (k, label) in const [
                    ('availableActive', 'Disponível no prazo'),
                    ('reservedNow', 'Reservado agora'),
                    ('inTransitNow', 'Em trânsito agora'),
                    ('expiredAvailable', 'Vencido sem destinação'),
                  ])
                    Text(
                      '$label: ${impactKg(i.balances[k]!)} kg',
                      style: AgroDesign.body,
                    ),
                  const SizedBox(height: 8),
                  const Text(
                    'As etapas se sobrepõem e não devem ser somadas. Produção registrada não é excedente. Saldo vencido não comprova perda.',
                    style: AgroDesign.caption,
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            result.saved
                ? 'Cópia salva · referência $asOf'
                : 'Consulta de $asOf',
            style: AgroDesign.caption,
          ),
        ],
      ),
    );
  }
}

class _Value extends StatelessWidget {
  final String label;
  final double kg;
  final String? hint;
  const _Value(this.label, this.kg, this.hint);
  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    label: '$label: ${impactKg(kg)} quilos${hint == null ? '' : ', $hint'}',
    excludeSemantics: true,
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AgroDesign.wash,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AgroDesign.caption),
          const SizedBox(height: 4),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: 4,
            children: [
              Text(
                impactKg(kg),
                style: AgroDesign.title.copyWith(fontSize: 24),
              ),
              const Text('kg', style: AgroDesign.caption),
            ],
          ),
          if (hint != null) Text(hint!, style: AgroDesign.caption),
        ],
      ),
    ),
  );
}
