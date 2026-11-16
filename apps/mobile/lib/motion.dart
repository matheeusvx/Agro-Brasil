import 'package:flutter/material.dart';

/// Movimento do app, traduzido das regras de animação de produto:
/// chegada suave (sem quique), toque rápido, entradas escalonadas em ordem
/// de leitura e estado que muda "no próprio lugar". Tudo respeita
/// `disableAnimations` e navegação acessível.
abstract final class AgroMotion {
  /// Chegada de algo que aparece: começo firme, desaceleração longa.
  static const arrive = Cubic(0.25, 0.8, 0.25, 1);

  /// Resposta a um toque dentro do app.
  static const respond = Cubic(0.3, 0.75, 0.1, 1);

  /// Deslocamento de algo já visível.
  static const travel = Cubic(0.45, 0, 0.1, 1);

  static const arriveDuration = Duration(milliseconds: 520);
  static const respondDuration = Duration(milliseconds: 320);
  static const stateDuration = Duration(milliseconds: 160);

  /// Intervalo entre itens de um mesmo grupo, em ordem de leitura.
  static const stagger = Duration(milliseconds: 60);

  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) == true ||
      MediaQuery.maybeAccessibleNavigationOf(context) == true;

  static Duration of(BuildContext context, Duration value) =>
      reduced(context) ? Duration.zero : value;
}

/// Entrada com fade e leve subida (12 dp), atrasada por [index] × stagger.
class Reveal extends StatefulWidget {
  final Widget child;
  final int index;
  final double offset;
  const Reveal({
    super.key,
    required this.child,
    this.index = 0,
    this.offset = 12,
  });
  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  // O atraso faz parte da própria animação (Interval), sem timers soltos.
  late final Duration _delay = AgroMotion.stagger * widget.index.clamp(0, 8);
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _delay + AgroMotion.arriveDuration,
  );
  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: Interval(
      _delay.inMilliseconds /
          (_delay + AgroMotion.arriveDuration).inMilliseconds,
      1,
      curve: AgroMotion.arrive,
    ),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (AgroMotion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _curve,
    child: widget.child,
    builder: (context, child) => Opacity(
      opacity: _curve.value,
      alwaysIncludeSemantics: true,
      child: Transform.translate(
        offset: Offset(0, widget.offset * (1 - _curve.value)),
        child: child,
      ),
    ),
  );
}

/// Leve compressão (0,965) enquanto o dedo está sobre o elemento.
class PressScale extends StatefulWidget {
  final Widget child;
  const PressScale({super.key, required this.child});
  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool _down = false;
  void _set(bool value) {
    if (_down != value) setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: (_) => _set(true),
    onPointerUp: (_) => _set(false),
    onPointerCancel: (_) => _set(false),
    child: AnimatedScale(
      scale: _down ? .965 : 1,
      duration: AgroMotion.of(context, AgroMotion.stateDuration),
      curve: AgroMotion.respond,
      child: widget.child,
    ),
  );
}
