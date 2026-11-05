import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'data.dart';
import 'design.dart';
import 'tasks.dart';

class OperationalData {
  final Map<String, double> crops;
  final Map<String, double> orders;
  const OperationalData(this.crops, this.orders);
  double get kilograms => crops.values.fold(0, (a, b) => a + b);
  double get count => orders.values.fold(0, (a, b) => a + b);
  static Future<OperationalData> load(HomeController c, String property) async {
    if (c.offline) {
      throw ApiFailure(0, 'Reconecte para consultar a distribuição completa.');
    }
    final productions = (await allRows(
      c.repository,
      '/productions',
    )).where((p) => p['propertyId'] == property);
    final crops = <String, double>{};
    final lots = <String>{};
    for (final p in productions) {
      final name = p['cropName'] as String;
      crops[name] = (crops[name] ?? 0) + (p['quantityKg'] as num).toDouble();
      lots.add(p['lot']['id'] as String);
    }
    final orders = <String, double>{};
    for (final o in await allRows(c.repository, '/orders')) {
      if (lots.contains(o['lotId'])) {
        final status = statusLabel(o['status']);
        orders[status] = (orders[status] ?? 0) + 1;
      }
    }
    return OperationalData(crops, orders);
  }
}

String chartNumber(double n) =>
    n.toStringAsFixed(n == n.roundToDouble() ? 0 : 1).replaceAll('.', ',');
const chartColors = [
  AgroDesign.green,
  Color(0xFF8BA969),
  Color(0xFFC58660),
  Color(0xFFE1BC66),
  Color(0xFF648B98),
  Color(0xFF827866),
];

class OperationalChart extends StatefulWidget {
  final String title, unit;
  final Map<String, double> values;
  final bool donut;
  const OperationalChart({
    super.key,
    required this.title,
    required this.unit,
    required this.values,
    this.donut = false,
  });
  @override
  State<OperationalChart> createState() => _OperationalChartState();
}

class _OperationalChartState extends State<OperationalChart> {
  int selected = 0;
  void select(int i) {
    if (selected != i) setState(() => selected = i);
  }

  @override
  Widget build(BuildContext context) {
    final entries = widget.values.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final total = entries.fold<double>(0, (s, e) => s + e.value);
    final index = selected.clamp(0, math.max(0, entries.length - 1)).toInt();
    final active = entries.isEmpty ? null : entries[index];
    final description = active == null
        ? ''
        : '${active.key}: ${chartNumber(active.value)} ${widget.unit} · ${(active.value / total * 100).toStringAsFixed(1).replaceAll('.', ',')}%';
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.title, style: AgroDesign.section),
          const SizedBox(height: 4),
          const Text(
            'Propriedade selecionada · todos os registros',
            style: AgroDesign.caption,
          ),
          const SizedBox(height: 16),
          if (total <= 0)
            const SizedBox(
              height: 240,
              child: Center(
                child: Text('Ainda não há registros para esta distribuição.'),
              ),
            )
          else ...[
            Semantics(
              liveRegion: true,
              child: Text(
                description,
                style: AgroDesign.body.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 12),
            if (widget.donut)
              Center(
                child: SizedBox(
                  width: 230,
                  height: 230,
                  child: MouseRegion(
                    cursor: SystemMouseCursors.click,
                    onHover: (e) => hit(e.localPosition, entries),
                    child: GestureDetector(
                      onTapUp: (e) => hit(e.localPosition, entries),
                      child: Tooltip(
                        message: description,
                        child: CustomPaint(
                          painter: _Ring(
                            entries.map((e) => e.value).toList(),
                            index,
                          ),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  chartNumber(total),
                                  style: AgroDesign.title,
                                ),
                                const Text(
                                  'pedidos',
                                  style: AgroDesign.caption,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            else
              LayoutBuilder(
                builder: (context, box) => SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: SizedBox(
                    width: math.max(box.maxWidth, entries.length * 82.0),
                    height: 230,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        for (var i = 0; i < entries.length; i++)
                          Expanded(
                            child: Tooltip(
                              message:
                                  '${entries[i].key}: ${chartNumber(entries[i].value)} ${widget.unit}',
                              child: TextButton(
                                onHover: (hover) {
                                  if (hover) select(i);
                                },
                                onFocusChange: (focus) {
                                  if (focus) select(i);
                                },
                                onPressed: () => select(i),
                                style: TextButton.styleFrom(
                                  overlayColor: Colors.transparent,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                  ),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    Text(
                                      chartNumber(entries[i].value),
                                      style: AgroDesign.caption,
                                    ),
                                    const SizedBox(height: 6),
                                    AnimatedContainer(
                                      duration:
                                          MediaQuery.disableAnimationsOf(
                                            context,
                                          )
                                          ? Duration.zero
                                          : const Duration(milliseconds: 220),
                                      width: 42,
                                      height: math.max(
                                        2,
                                        150 *
                                            entries[i].value /
                                            entries
                                                .map((e) => e.value)
                                                .reduce(math.max),
                                      ),
                                      child: CustomPaint(
                                        painter: _Bar(
                                          i == index
                                              ? AgroDesign.green
                                              : const Color(0xFFB5C6A5),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    SizedBox(
                                      height: 36,
                                      child: Text(
                                        entries[i].key,
                                        textAlign: TextAlign.center,
                                        style: AgroDesign.caption,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                for (var i = 0; i < entries.length; i++)
                  Tooltip(
                    message:
                        '${entries[i].key}: ${chartNumber(entries[i].value)} ${widget.unit} · ${(entries[i].value / total * 100).toStringAsFixed(1)}%',
                    child: TextButton(
                      onHover: (v) {
                        if (v) select(i);
                      },
                      onFocusChange: (v) {
                        if (v) select(i);
                      },
                      onPressed: () => select(i),
                      style: TextButton.styleFrom(
                        overlayColor: Colors.transparent,
                        backgroundColor: i == index ? AgroDesign.wash : null,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (widget.donut) ...[
                            Icon(
                              Icons.circle,
                              size: 8,
                              color: chartColors[i % chartColors.length],
                            ),
                            const SizedBox(width: 8),
                          ],
                          Flexible(
                            child: Text(
                              '${entries[i].key} · ${chartNumber(entries[i].value)} ${widget.unit}${widget.donut ? ' · ${(entries[i].value / total * 100).toStringAsFixed(1)}%' : ''}',
                              style: TextStyle(
                                color: AgroDesign.ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  void hit(Offset p, List<MapEntry<String, double>> entries) {
    final d = p - const Offset(115, 115);
    if (d.distance < 70 || d.distance > 110) return;
    final angle = (math.atan2(d.dy, d.dx) + math.pi / 2) % (2 * math.pi);
    final total = entries.fold<double>(0, (s, e) => s + e.value);
    var end = 0.0;
    for (var i = 0; i < entries.length; i++) {
      end += entries[i].value / total * 2 * math.pi;
      if (angle < end) {
        select(i);
        return;
      }
    }
  }
}

class _Bar extends CustomPainter {
  final Color color;
  const _Bar(this.color);
  @override
  void paint(Canvas c, Size s) {
    c.drawRect(
      Rect.fromLTWH(0, 0, s.width - 6, s.height),
      Paint()..color = color,
    );
    c.drawPath(
      Path()
        ..moveTo(s.width - 6, 0)
        ..lineTo(s.width, -5)
        ..lineTo(s.width, s.height - 5)
        ..lineTo(s.width - 6, s.height)
        ..close(),
      Paint()..color = Color.lerp(color, AgroDesign.forest, .2)!,
    );
    c.drawPath(
      Path()
        ..moveTo(0, 0)
        ..lineTo(6, -5)
        ..lineTo(s.width, -5)
        ..lineTo(s.width - 6, 0)
        ..close(),
      Paint()..color = Color.lerp(color, Colors.white, .3)!,
    );
  }

  @override
  bool shouldRepaint(covariant _Bar old) => old.color != color;
}

class _Ring extends CustomPainter {
  final List<double> values;
  final int selected;
  const _Ring(this.values, this.selected);
  @override
  void paint(Canvas c, Size s) {
    final rect = Rect.fromCircle(center: s.center(Offset.zero), radius: 89);
    final total = values.fold<double>(0, (a, b) => a + b);
    var start = -math.pi / 2;
    c.drawCircle(
      s.center(const Offset(0, 3)),
      89,
      Paint()
        ..color = const Color(0x15000000)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 39
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    for (var i = 0; i < values.length; i++) {
      final sweep = values[i] / total * 2 * math.pi;
      c.drawArc(
        rect,
        start,
        sweep,
        false,
        Paint()
          ..color = chartColors[i % chartColors.length]
          ..style = PaintingStyle.stroke
          ..strokeWidth = 36,
      );
      if (i == selected) {
        c.drawArc(
          rect.inflate(19),
          start,
          sweep,
          false,
          Paint()
            ..color = AgroDesign.forest
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _Ring old) => true;
}
