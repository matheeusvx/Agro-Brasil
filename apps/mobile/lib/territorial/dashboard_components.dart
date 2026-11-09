import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../design.dart';
import 'water_data.dart';

const dashboardLime = AgroDesign.brand;

/// Motion follows Android's remove-animation setting and web reduced motion.
Duration dashboardMotion(BuildContext context) =>
    MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context)
    ? Duration.zero
    : const Duration(milliseconds: 180);

class DashboardCard extends StatelessWidget {
  final Widget child;
  final bool dark;
  const DashboardCard({super.key, required this.child, this.dark = false});

  @override
  Widget build(BuildContext context) => Material(
    color: dark ? AgroDesign.forest : Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(24),
      side: BorderSide(color: dark ? AgroDesign.forest : AgroDesign.line),
    ),
    child: Padding(padding: const EdgeInsets.all(20), child: child),
  );
}

class DashboardHeading extends StatelessWidget {
  final String title, description;
  final IconData icon;
  const DashboardHeading({
    super.key,
    required this.title,
    required this.description,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AgroDesign.wash,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Icon(icon, color: AgroDesign.forest, size: 22),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(title, style: AgroDesign.section),
            ),
            const SizedBox(height: 5),
            Text(description, style: AgroDesign.caption),
          ],
        ),
      ),
    ],
  );
}

class TerritorialHeader extends StatelessWidget {
  final String municipality, source, period;
  const TerritorialHeader({
    super.key,
    required this.municipality,
    required this.source,
    required this.period,
  });
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('PAINEL TERRITORIAL  /  01', style: AgroDesign.eyebrow),
      const SizedBox(height: 10),
      Row(
        children: [
          const Icon(Icons.location_on_outlined, size: 20),
          const SizedBox(width: 6),
          Expanded(child: Text(municipality, style: AgroDesign.section)),
        ],
      ),
      const SizedBox(height: 7),
      Text('$source · $period', style: AgroDesign.caption),
    ],
  );
}

class TerritorialYearFilter extends StatelessWidget {
  final int year;
  final List<int> years;
  final ValueChanged<int> onChanged;
  const TerritorialYearFilter({
    super.key,
    required this.year,
    required this.years,
    required this.onChanged,
  });
  @override
  Widget build(BuildContext context) => DropdownButtonFormField<int>(
    key: ValueKey(year),
    initialValue: year,
    isExpanded: true,
    decoration: const InputDecoration(
      labelText: 'Ano do histórico',
      prefixIcon: Icon(Icons.calendar_month_outlined),
    ),
    items: years.reversed
        .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
        .toList(),
    onChanged: (value) {
      if (value != null) onChanged(value);
    },
  );
}

class IndicatorCard extends StatelessWidget {
  final String title, value, unit, contextLabel;
  final IconData icon;
  const IndicatorCard({
    super.key,
    required this.title,
    required this.value,
    required this.unit,
    required this.contextLabel,
    required this.icon,
  });
  @override
  Widget build(BuildContext context) => DashboardCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AgroDesign.green, size: 22),
        const SizedBox(height: 12),
        Text(title, style: AgroDesign.caption),
        const SizedBox(height: 6),
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 5,
          children: [
            Text(value, style: AgroDesign.title.copyWith(fontSize: 26)),
            if (value != 'Indisponível') Text(unit, style: AgroDesign.caption),
          ],
        ),
        const SizedBox(height: 8),
        Text(contextLabel, style: AgroDesign.caption),
      ],
    ),
  );
}

class IndicatorGrid extends StatelessWidget {
  final List<Widget> children;
  const IndicatorGrid({super.key, required this.children});
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final largeText = MediaQuery.textScalerOf(context).scale(14) > 21;
      final columns = largeText || box.maxWidth < 330
          ? 1
          : box.maxWidth >= 650
          ? 3
          : 2;
      final width = (box.maxWidth - (columns - 1) * 12) / columns;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final child in children) SizedBox(width: width, child: child),
        ],
      );
    },
  );
}

enum DashboardStatus { loading, empty, error, stale }

/// Historical packages do not expire as live weather. Stale is an explicit
/// adapter state for future time-sensitive dashboards, never inferred by age.
class DashboardStateView extends StatelessWidget {
  final DashboardStatus status;
  final String message;
  final VoidCallback? onRetry;
  const DashboardStateView({
    super.key,
    required this.status,
    required this.message,
    this.onRetry,
  });
  @override
  Widget build(BuildContext context) => DashboardCard(
    child: Semantics(
      liveRegion: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(switch (status) {
            DashboardStatus.loading => Icons.hourglass_top,
            DashboardStatus.empty => Icons.insert_chart_outlined,
            DashboardStatus.error => Icons.cloud_off_outlined,
            DashboardStatus.stale => Icons.history,
          }, color: AgroDesign.green),
          const SizedBox(height: 12),
          Text(switch (status) {
            DashboardStatus.loading => 'Abrindo o histórico',
            DashboardStatus.empty => 'Sem dados neste período',
            DashboardStatus.error => 'Não foi possível abrir o painel',
            DashboardStatus.stale => 'Dados desatualizados',
          }, style: AgroDesign.section),
          const SizedBox(height: 8),
          Text(message, style: AgroDesign.body),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
            ),
          ],
        ],
      ),
    ),
  );
}

class DashboardChartPoint {
  final String label, semanticLabel;
  final double? value, reference;
  const DashboardChartPoint({
    required this.label,
    required this.semanticLabel,
    required this.value,
    this.reference,
  });
}

/// Real data bars, a zero baseline, proportional heights and >=48dp targets.
/// Scroll instead of compressing 12/31 interactive targets on small phones.
class DashboardBarChart extends StatefulWidget {
  final List<DashboardChartPoint> points;
  final int selected;
  final ValueChanged<int> onSelected;
  final String unit;
  final bool comparison;
  const DashboardBarChart({
    super.key,
    required this.points,
    required this.selected,
    required this.onSelected,
    required this.unit,
    this.comparison = false,
  });
  @override
  State<DashboardBarChart> createState() => _DashboardBarChartState();
}

class _DashboardBarChartState extends State<DashboardBarChart> {
  // Selection determines the horizontal position. Never share the parent's
  // PageStorage slot with the vertical dashboard or with another chart.
  final _scroll = ScrollController(keepScrollOffset: false);
  @override
  void initState() {
    super.initState();
    _reveal();
  }

  @override
  void didUpdateWidget(DashboardBarChart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selected != widget.selected ||
        oldWidget.points.length != widget.points.length) {
      _reveal();
    }
  }

  void _reveal() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!mounted || !_scroll.hasClients) return;
    final cellWidth = math.max(
      48.0,
      MediaQuery.textScalerOf(context).scale(18) * 2.5,
    );
    final target =
        (widget.selected * cellWidth -
                _scroll.position.viewportDimension / 2 +
                cellWidth / 2)
            .clamp(0.0, _scroll.position.maxScrollExtent);
    final duration = dashboardMotion(context);
    if (duration == Duration.zero) {
      _scroll.jumpTo(target);
    } else {
      _scroll.animateTo(target, duration: duration, curve: Curves.easeOut);
    }
  });
  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final maxValue = widget.points.fold<double>(
      1,
      (max, p) => math.max(max, math.max(p.value ?? 0, p.reference ?? 0)),
    );
    final ceiling = (maxValue / 10).ceil() * 10.0;
    final textScale = MediaQuery.textScalerOf(context);
    final cellWidth = math.max(48.0, textScale.scale(18) * 2.5);
    final height = 168 + textScale.scale(14) + 22;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          spacing: 12,
          runSpacing: 4,
          children: [
            Text('0 ${widget.unit}', style: AgroDesign.caption),
            Text(
              'Escala até ${waterNumber(ceiling, decimals: 0)} ${widget.unit}',
              style: AgroDesign.caption,
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: height,
          child: Scrollbar(
            controller: _scroll,
            thumbVisibility: true,
            child: SingleChildScrollView(
              controller: _scroll,
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(bottom: 18),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var index = 0; index < widget.points.length; index++)
                    Builder(
                      builder: (context) {
                        final point = widget.points[index];
                        final selected = index == widget.selected;
                        return Semantics(
                          label: point.semanticLabel,
                          selected: selected,
                          button: true,
                          onTap: () => widget.onSelected(index),
                          child: ExcludeSemantics(
                            child: SizedBox(
                              width: cellWidth,
                              child: Material(
                                color: selected
                                    ? AgroDesign.wash
                                    : Colors.white,
                                borderRadius: BorderRadius.circular(10),
                                child: InkWell(
                                  onTap: () => widget.onSelected(index),
                                  borderRadius: BorderRadius.circular(10),
                                  child: Padding(
                                    padding: const EdgeInsets.fromLTRB(
                                      6,
                                      4,
                                      6,
                                      8,
                                    ),
                                    child: Column(
                                      children: [
                                        SizedBox(
                                          height: 140,
                                          child: DecoratedBox(
                                            decoration: const BoxDecoration(
                                              border: Border(
                                                bottom: BorderSide(
                                                  color: AgroDesign.line,
                                                ),
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment.center,
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.end,
                                              children: [
                                                if (point.value != null)
                                                  _bar(
                                                    point.value!,
                                                    ceiling,
                                                    AgroDesign.green,
                                                  )
                                                else
                                                  const Expanded(
                                                    child: Center(
                                                      child: Text('—'),
                                                    ),
                                                  ),
                                                if (widget.comparison) ...[
                                                  const SizedBox(width: 4),
                                                  if (point.reference != null)
                                                    _bar(
                                                      point.reference!,
                                                      ceiling,
                                                      dashboardLime,
                                                    )
                                                  else
                                                    const Expanded(
                                                      child: Center(
                                                        child: Text('—'),
                                                      ),
                                                    ),
                                                ],
                                              ],
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          point.label,
                                          style: AgroDesign.caption.copyWith(
                                            color: AgroDesign.ink,
                                            fontWeight: selected
                                                ? FontWeight.w700
                                                : FontWeight.w400,
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
                      },
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Toque em uma barra para ver o valor',
          style: AgroDesign.caption,
        ),
      ],
    );
  }

  Widget _bar(double value, double ceiling, Color color) => Expanded(
    child: Container(
      height: 138 * value.clamp(0, ceiling) / ceiling,
      decoration: BoxDecoration(
        color: color,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
      ),
    ),
  );
}

class ChartLegend extends StatelessWidget {
  final String label;
  final Color color;
  const ChartLegend({super.key, required this.label, required this.color});
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(3),
          border: Border.all(color: AgroDesign.green.withValues(alpha: .3)),
        ),
      ),
      const SizedBox(width: 6),
      Text(label, style: AgroDesign.caption),
    ],
  );
}
