import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Arte vetorial original Agro+ Brasil. Sem imagens, fontes ou rede externas.
enum FarmArt { landscape, harvest, offer, route, orders, profile, weather }

class FarmIllustration extends StatelessWidget {
  final FarmArt art;
  final double width;
  final double height;
  final String condition;
  final bool night;
  const FarmIllustration({
    super.key,
    this.art = FarmArt.landscape,
    this.width = 140,
    this.height = 100,
    this.condition = '',
    this.night = false,
  });
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      width: width,
      height: height,
      child: CustomPaint(painter: _FarmPainter(art, condition, night)),
    ),
  );
}

class _FarmPainter extends CustomPainter {
  final FarmArt art;
  final String condition;
  final bool night;
  const _FarmPainter(this.art, this.condition, this.night);
  static const forest = Color(0xFF214F3E);
  static const leaf = Color(0xFF73A760);
  static const lime = Color(0xFFB8CE79);
  static const soil = Color(0xFFC58660);
  static const sun = Color(0xFFF3C969);
  static const pale = Color(0xFFF9F5E8);
  Paint fill(Color c) => Paint()..color = c;
  void line(Canvas c, Offset a, Offset b, Color color, [double width = 2]) =>
      c.drawLine(
        a,
        b,
        Paint()
          ..color = color
          ..strokeWidth = width
          ..strokeCap = StrokeCap.round,
      );
  void box(Canvas c, Rect r, Color color, [double radius = 3]) => c.drawRRect(
    RRect.fromRectAndRadius(r, Radius.circular(radius)),
    fill(color),
  );
  void cloud(Canvas c, double x, double y, double scale, Color color) {
    c.save();
    c.translate(x, y);
    c.scale(scale);
    c.drawCircle(const Offset(15, 12), 10, fill(color));
    c.drawCircle(const Offset(28, 7), 14, fill(color));
    c.drawCircle(const Offset(43, 14), 10, fill(color));
    box(c, const Rect.fromLTWH(7, 12, 46, 12), color, 6);
    c.restore();
  }

  void tree(Canvas c, double x, double y, double scale) {
    c.save();
    c.translate(x, y);
    c.scale(scale);
    line(c, const Offset(0, -26), const Offset(0, 4), forest, 3);
    c.drawOval(const Rect.fromLTWH(-14, -43, 28, 33), fill(leaf));
    c.drawOval(const Rect.fromLTWH(-6, -47, 20, 32), fill(lime));
    line(c, const Offset(0, -15), const Offset(8, -24), forest, 1);
    c.restore();
  }

  void sprout(Canvas c, double x, double y, [double scale = 1]) {
    c.save();
    c.translate(x, y);
    c.scale(scale);
    line(c, Offset.zero, const Offset(0, -18), forest, 2.4);
    c.drawPath(
      Path()
        ..moveTo(0, -7)
        ..cubicTo(-18, -5, -18, -24, 0, -15)
        ..close(),
      fill(leaf),
    );
    c.drawPath(
      Path()
        ..moveTo(0, -12)
        ..cubicTo(2, -29, 23, -24, 12, -14)
        ..quadraticBezierTo(5, -9, 0, -12),
      fill(forest),
    );
    c.restore();
  }

  void barn(Canvas c, double x, double y, double scale) {
    c.save();
    c.translate(x, y);
    c.scale(scale);
    c.drawPath(
      Path()
        ..moveTo(0, 27)
        ..lineTo(0, 0)
        ..lineTo(22, -17)
        ..lineTo(44, 0)
        ..lineTo(44, 27)
        ..close(),
      fill(soil),
    );
    c.drawPath(
      Path()
        ..moveTo(44, 27)
        ..lineTo(60, 17)
        ..lineTo(60, -8)
        ..lineTo(44, 0)
        ..close(),
      fill(const Color(0xFFAB6849)),
    );
    c.drawPath(
      Path()
        ..moveTo(-4, 1)
        ..lineTo(22, -21)
        ..lineTo(48, 0)
        ..lineTo(65, -9)
        ..lineTo(40, -28)
        ..lineTo(22, -21),
      fill(forest),
    );
    box(c, const Rect.fromLTWH(13, 5, 19, 22), pale, 1);
    box(c, const Rect.fromLTWH(16, 8, 13, 19), forest, 1);
    line(c, const Offset(16, 8), const Offset(29, 27), pale, 1);
    line(c, const Offset(29, 8), const Offset(16, 27), pale, 1);
    box(c, const Rect.fromLTWH(18, -8, 8, 7), pale, 0);
    c.restore();
  }

  void landscape(Canvas c) {
    c.drawCircle(const Offset(150, 27), 16, fill(sun));
    cloud(c, 65, 14, .65, pale.withValues(alpha: .9));
    cloud(c, 143, 49, .4, pale.withValues(alpha: .7));
    c.drawPath(
      Path()
        ..moveTo(0, 95)
        ..cubicTo(28, 53, 57, 88, 96, 70)
        ..cubicTo(136, 46, 163, 62, 200, 56)
        ..lineTo(200, 140)
        ..lineTo(0, 140)
        ..close(),
      fill(leaf),
    );
    c.drawPath(
      Path()
        ..moveTo(0, 107)
        ..cubicTo(52, 77, 104, 106, 200, 79)
        ..lineTo(200, 140)
        ..lineTo(0, 140)
        ..close(),
      fill(lime),
    );
    c.drawPath(
      Path()
        ..moveTo(0, 121)
        ..cubicTo(63, 91, 138, 101, 200, 117)
        ..lineTo(200, 140)
        ..lineTo(0, 140)
        ..close(),
      fill(const Color(0xFF56865A)),
    );
    for (var i = 0; i < 5; i++) {
      c.drawPath(
        Path()
          ..moveTo(38.0 + i * 28, 140)
          ..quadraticBezierTo(81 + i * 19.0, 115, 158, 109),
        Paint()
          ..color = lime
          ..strokeWidth = 3
          ..style = PaintingStyle.stroke,
      );
    }
    tree(c, 177, 85, .8);
    tree(c, 163, 88, .55);
    barn(c, 77, 86, .8);
    for (var i = 0; i < 5; i++) {
      line(c, Offset(11 + i * 10.0, 93), Offset(11 + i * 10.0, 107), pale, 2);
    }
    line(c, const Offset(9, 98), const Offset(56, 98), pale, 2);
    line(c, const Offset(9, 104), const Offset(56, 104), pale, 2);
    sprout(c, 20, 138, .75);
    sprout(c, 188, 138, .85);
  }

  void crate(Canvas c) {
    c.drawOval(
      const Rect.fromLTWH(33, 115, 138, 16),
      fill(forest.withValues(alpha: .08)),
    );
    for (var i = 0; i < 5; i++) {
      final x = 55 + i * 24.0;
      sprout(c, x, 76, 1.15);
      c.drawCircle(Offset(x, 78), 12, fill(i.isEven ? soil : lime));
    }
    c.drawPath(
      Path()
        ..moveTo(35, 78)
        ..lineTo(154, 78)
        ..lineTo(172, 66)
        ..lineTo(172, 108)
        ..lineTo(154, 122)
        ..lineTo(35, 122)
        ..close(),
      fill(const Color(0xFFBE8850)),
    );
    box(c, const Rect.fromLTWH(35, 78, 119, 44), const Color(0xFFE7B774), 2);
    for (var y = 88.0; y < 122; y += 14) {
      line(c, Offset(35, y), Offset(154, y), const Color(0xFFBC874F), 2);
    }
    box(c, const Rect.fromLTWH(46, 78, 8, 44), const Color(0xFFF3CD90), 1);
    box(c, const Rect.fromLTWH(136, 78, 8, 44), const Color(0xFFF3CD90), 1);
    box(c, const Rect.fromLTWH(82, 87, 29, 11), forest, 3);
    for (final x in [42.0, 148.0]) {
      for (final y in [85.0, 115.0]) {
        c.drawCircle(Offset(x, y), 1.5, fill(forest));
      }
    }
  }

  void route(Canvas c) {
    c.drawPath(
      Path()
        ..moveTo(25, 111)
        ..cubicTo(70, 130, 56, 62, 104, 74)
        ..cubicTo(165, 92, 133, 29, 174, 36),
      Paint()
        ..color = leaf
        ..strokeWidth = 7
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
    for (final o in [
      const Offset(25, 109),
      const Offset(103, 74),
      const Offset(172, 36),
    ]) {
      c.drawCircle(o, 10, fill(pale));
      c.drawCircle(o, 5, fill(forest));
    }
    barn(c, 9, 82, .48);
    sprout(c, 175, 119, 1.5);
    box(c, const Rect.fromLTWH(91, 20, 32, 35), soil, 4);
    line(c, const Offset(99, 37), const Offset(105, 43), pale, 3);
    line(c, const Offset(105, 43), const Offset(116, 31), pale, 3);
  }

  void clipboard(Canvas c) {
    c.save();
    c.translate(58, 22);
    c.rotate(-.08);
    box(c, const Rect.fromLTWH(0, 0, 80, 104), soil, 8);
    box(c, const Rect.fromLTWH(6, 6, 68, 92), pale, 5);
    box(c, const Rect.fromLTWH(24, -5, 32, 15), forest, 4);
    for (var i = 0; i < 3; i++) {
      final y = 30 + i * 23.0;
      c.drawCircle(Offset(22, y), 7, fill(lime));
      line(c, Offset(19, y), Offset(22, y + 3), forest, 1.6);
      line(c, Offset(22, y + 3), Offset(26, y - 3), forest, 1.6);
      line(c, Offset(38, y), Offset(61, y), leaf, 3);
    }
    c.restore();
    sprout(c, 154, 127, 1.25);
  }

  void weather(Canvas c) {
    final rainy = RegExp('chuva|rain|garoa|tempest')
        .hasMatch(condition.toLowerCase());
    final cloudy =
        rainy ||
        RegExp('nuv|cloud|nublado|nevo').hasMatch(condition.toLowerCase());
    if (night) {
      c.drawCircle(const Offset(113, 41), 23, fill(pale));
      c.drawCircle(const Offset(123, 31), 21, fill(const Color(0xFFDCECF0)));
    } else {
      for (var i = 0; i < 8; i++) {
        final a = i * math.pi / 4;
        line(
          c,
          Offset(111 + 29 * math.cos(a), 44 + 29 * math.sin(a)),
          Offset(111 + 35 * math.cos(a), 44 + 35 * math.sin(a)),
          sun,
          2.5,
        );
      }
      c.drawCircle(const Offset(111, 44), 22, fill(sun));
    }
    if (cloudy) {
      cloud(c, 81, 46, 1.25, rainy ? const Color(0xFF93B4BF) : Colors.white);
    }
    if (rainy) {
      for (var i = 0; i < 4; i++) {
        line(
          c,
          Offset(96 + i * 13.0, 83),
          Offset(92 + i * 13.0, 94),
          const Color(0xFF548CA6),
          2,
        );
      }
    }
    c.drawPath(
      Path()
        ..moveTo(0, 125)
        ..quadraticBezierTo(80, 91, 200, 113)
        ..lineTo(200, 140)
        ..lineTo(0, 140)
        ..close(),
      fill(lime),
    );
    c.drawPath(
      Path()
        ..moveTo(0, 139)
        ..quadraticBezierTo(92, 106, 200, 126)
        ..lineTo(200, 140)
        ..close(),
      fill(leaf),
    );
    sprout(c, 169, 129, .65);
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 200, size.height / 140);
    switch (art) {
      case FarmArt.landscape:
        landscape(canvas);
      case FarmArt.harvest:
        crate(canvas);
      case FarmArt.offer:
        crate(canvas);
        box(canvas, const Rect.fromLTWH(139, 37, 38, 27), forest, 6);
        line(canvas, const Offset(149, 50), const Offset(165, 50), pale, 2);
      case FarmArt.route:
        route(canvas);
      case FarmArt.orders:
        clipboard(canvas);
      case FarmArt.profile:
        landscape(canvas);
      case FarmArt.weather:
        weather(canvas);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _FarmPainter oldDelegate) =>
      oldDelegate.art != art ||
      oldDelegate.condition != condition ||
      oldDelegate.night != night;
}
