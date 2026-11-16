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
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(AgroDesign.radius),
      boxShadow: dark ? null : AgroDesign.softShadow,
    ),
    child: Material(
      color: dark ? AgroDesign.forest : Colors.white,
      borderRadius: BorderRadius.circular(AgroDesign.radius),
      child: Padding(padding: const EdgeInsets.all(20), child: child),
    ),
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
        decoration: const BoxDecoration(
          color: AgroDesign.mint,
          shape: BoxShape.circle,
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
        IconBubble(icon, size: 38),
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
          }, color: AgroDesign.forest),
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
    final labelHeight = textScale.scale(13) * 1.5;
    const plot = 150.0;
    final height = plot + labelHeight * 2 + 44;
    final grow =
        MediaQuery.disableAnimationsOf(context) ||
            MediaQuery.accessibleNavigationOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 520);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: height,
          child: Scrollbar(
            controller: _scroll,
            child: SingleChildScrollView(
              controller: _scroll,
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(bottom: 10),
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
                              child: InkWell(
                                onTap: () => widget.onSelected(index),
                                borderRadius: BorderRadius.circular(14),
                                child: AnimatedContainer(
                                  duration: grow == Duration.zero
                                      ? Duration.zero
                                      : const Duration(milliseconds: 160),
                                  decoration: BoxDecoration(
                                    color: selected
                                        ? AgroDesign.mint
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  padding: const EdgeInsets.fromLTRB(
                                    4,
                                    6,
                                    4,
                                    8,
                                  ),
                                  child: Column(
                                    children: [
                                      SizedBox(
                                        height: labelHeight,
                                        child: selected && point.value != null
                                            ? FittedBox(
                                                child: Text(
                                                  waterNumber(
                                                    point.value,
                                                    decimals:
                                                        point.value! >= 100
                                                        ? 0
                                                        : 1,
                                                  ),
                                                  style: AgroDesign.caption
                                                      .copyWith(
                                                        color:
                                                            AgroDesign.forest,
                                                        fontWeight:
                                                            FontWeight.w700,
                                                      ),
                                                ),
                                              )
                                            : null,
                                      ),
                                      const SizedBox(height: 4),
                                      SizedBox(
                                        height: plot,
                                        child: TweenAnimationBuilder<double>(
                                          tween: Tween(begin: 0, end: 1),
                                          duration: grow,
                                          curve: const Cubic(
                                            0.25,
                                            0.8,
                                            0.25,
                                            1,
                                          ),
                                          builder: (context, t, _) => Stack(
                                            alignment: Alignment.bottomCenter,
                                            children: [
                                              const Positioned(
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                child: Divider(
                                                  height: 1,
                                                  thickness: 1,
                                                  color: AgroDesign.line,
                                                ),
                                              ),
                                              if (point.value == null)
                                                const Center(
                                                  child: Text(
                                                    '—',
                                                    style: AgroDesign.caption,
                                                  ),
                                                )
                                              else
                                                Container(
                                                  width: 18,
                                                  height: math.max(
                                                    3,
                                                    plot *
                                                        t *
                                                        point.value!.clamp(
                                                          0,
                                                          ceiling,
                                                        ) /
                                                        ceiling,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: selected
                                                        ? AgroDesign.forest
                                                        : _barRest,
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                          9,
                                                        ),
                                                  ),
                                                ),
                                              if (widget.comparison &&
                                                  point.reference != null)
                                                Positioned(
                                                  bottom:
                                                      plot *
                                                          t *
                                                          point.reference!
                                                              .clamp(
                                                                0,
                                                                ceiling,
                                                              ) /
                                                          ceiling -
                                                      1.5,
                                                  child: Container(
                                                    width: 30,
                                                    height: 3,
                                                    decoration: BoxDecoration(
                                                      color: AgroDesign.earth,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            2,
                                                          ),
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        point.label,
                                        style: AgroDesign.caption.copyWith(
                                          color: selected
                                              ? AgroDesign.forest
                                              : AgroDesign.muted,
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
                        );
                      },
                    ),
                ],
              ),
            ),
          ),
        ),
        Text(
          'Toque em uma barra para ver o valor · escala 0–${waterNumber(ceiling, decimals: 0)} ${widget.unit}',
          style: AgroDesign.caption,
        ),
      ],
    );
  }

  static const _barRest = Color(0xFF6E9C7E);
}

class ChartLegend extends StatelessWidget {
  final String label;
  final Color color;
  final bool line;
  const ChartLegend({
    super.key,
    required this.label,
    required this.color,
    this.line = false,
  });
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: line ? 16 : 10,
        height: line ? 3 : 10,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(line ? 2 : 5),
        ),
      ),
      const SizedBox(width: 6),
      Text(label, style: AgroDesign.caption.copyWith(color: AgroDesign.ink)),
    ],
  );
}
