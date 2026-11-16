import 'package:flutter/material.dart';

import 'illustrations.dart';

/// Tokens locais. A hierarquia de tarefas não depende de um tema Material padrão.
abstract final class AgroDesign {
  static const forest = Color(0xFF173F32);
  static const green = Color(0xFF285E45);
  static const leaf = Color(0xFF73A760);

  /// Verde do "+" da logo. Destaque pontual: 4,7:1 sobre [forest], mas não
  /// atinge contraste de texto sobre branco ou creme.
  static const brand = Color(0xFF02BE32);
  static const brandWash = Color(0xFFD6F3DC);
  static const cream = Color(0xFFFAF8F1);
  static const sky = Color(0xFFE2F0F4);
  static const sun = Color(0xFFF3C969);
  static const terracotta = Color(0xFFC58660);
  static const paper = Color(0xFFFFFFFF);
  static const ink = Color(0xFF213E32);
  static const muted = Color(0xFF58695D);
  static const line = Color(0xFFE0E5D9);
  static const wash = Color(0xFFECF1E3);
  static const earth = Color(0xFF805527);
  static const attention = Color(0xFFF7EFD9);
  static const danger = Color(0xFF912F27);
  static const dangerWash = Color(0xFFFAEEEA);
  static const disabled = Color(0xFFEBEDE7);

  /// Fundo das telas: branco levemente esverdeado, mais limpo que o creme.
  static const canvas = Color(0xFFF5F7F2);
  static const mint = Color(0xFFEAF5EC);
  static const radius = 24.0;
  static const smallRadius = 16.0;
  static const gutter = 20.0;
  static const gap = 12.0;
  static const sectionGap = 28.0;

  /// Sombra única e suave: cards flutuam sem bordas pesadas.
  static const softShadow = [
    BoxShadow(color: Color(0x0F173F32), blurRadius: 24, offset: Offset(0, 8)),
    BoxShadow(color: Color(0x08173F32), blurRadius: 4, offset: Offset(0, 1)),
  ];
  static const display = TextStyle(
    fontSize: 28,
    height: 1.15,
    letterSpacing: -.6,
    fontWeight: FontWeight.w700,
    color: ink,
  );
  static const title = TextStyle(
    fontSize: 22,
    height: 1.2,
    letterSpacing: -.3,
    fontWeight: FontWeight.w700,
    color: ink,
  );
  static const section = TextStyle(
    fontSize: 17,
    height: 1.25,
    letterSpacing: -.1,
    fontWeight: FontWeight.w700,
    color: ink,
  );
  static const body = TextStyle(fontSize: 15, height: 1.4, color: ink);
  static const caption = TextStyle(fontSize: 13, height: 1.35, color: muted);
  static const eyebrow = TextStyle(
    fontSize: 11,
    height: 1.3,
    fontWeight: FontWeight.w700,
    letterSpacing: 1,
    color: muted,
  );
}

/// Logo oficial, com "Agro" branco: usar somente sobre superfícies escuras.
class AgroLogo extends StatelessWidget {
  static const asset = 'assets/branding/agro-brasil-logo.png';
  static const aspectRatio = 1379 / 364;
  final double height;
  const AgroLogo({super.key, this.height = 26});
  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: 'Agro+ Brasil',
    child: Image.asset(
      asset,
      height: height,
      width: height * aspectRatio,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
      excludeFromSemantics: true,
    ),
  );
}

class AgroNavigationBar extends StatelessWidget {
  final int selected;
  final ValueChanged<int> onSelected;
  const AgroNavigationBar({
    super.key,
    required this.selected,
    required this.onSelected,
  });
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) =>
        MediaQuery.textScalerOf(context).scale(12) > 18 &&
            constraints.maxWidth < 440
        ? DecoratedBox(
            decoration: const BoxDecoration(
              color: AgroDesign.paper,
              border: Border(top: BorderSide(color: AgroDesign.line)),
            ),
            child: SafeArea(
              top: false,
              child: Wrap(
                alignment: WrapAlignment.center,
                children: [
                  for (var i = 0; i < 5; i++)
                    SizedBox(
                      width: i < 3
                          ? constraints.maxWidth * [0.27, 0.43, 0.30][i]
                          : constraints.maxWidth / 2,
                      child: Semantics(
                        selected: selected == i,
                        child: TextButton(
                          onPressed: () => onSelected(i),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              vertical: 8,
                              horizontal: 4,
                            ),
                            foregroundColor: selected == i
                                ? AgroDesign.forest
                                : AgroDesign.muted,
                            backgroundColor: selected == i
                                ? AgroDesign.brandWash
                                : Colors.transparent,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                [
                                  Icons.home_outlined,
                                  Icons.grass,
                                  Icons.sell_outlined,
                                  Icons.inventory_2_outlined,
                                  Icons.person_outline,
                                ][i],
                                size: 24,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                [
                                  'Início',
                                  'Produção',
                                  'Ofertas',
                                  'Pedidos',
                                  'Perfil',
                                ][i],
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: selected == i
                                      ? FontWeight.w700
                                      : FontWeight.w400,
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
          )
        : DecoratedBox(
            decoration: const BoxDecoration(
              color: AgroDesign.paper,
              border: Border(top: BorderSide(color: AgroDesign.line)),
            ),
            child: NavigationBarTheme(
              data: NavigationBarThemeData(
                height: 72,
                elevation: 0,
                backgroundColor: Colors.transparent,
                indicatorColor: AgroDesign.brandWash,
                indicatorShape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                labelTextStyle: WidgetStateProperty.resolveWith(
                  (states) => TextStyle(
                    fontFamily: 'Roboto',
                    fontSize: 12,
                    fontWeight: states.contains(WidgetState.selected)
                        ? FontWeight.w700
                        : FontWeight.w400,
                    color: states.contains(WidgetState.selected)
                        ? AgroDesign.forest
                        : AgroDesign.muted,
                  ),
                ),
                iconTheme: WidgetStateProperty.resolveWith(
                  (states) => IconThemeData(
                    size: 24,
                    color: states.contains(WidgetState.selected)
                        ? AgroDesign.forest
                        : AgroDesign.muted,
                  ),
                ),
              ),
              child: NavigationBar(
                selectedIndex: selected,
                onDestinationSelected: onSelected,
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.home_outlined),
                    selectedIcon: Icon(Icons.home),
                    label: 'Início',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.grass_outlined),
                    label: 'Produção',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.sell_outlined),
                    label: 'Ofertas',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.inventory_2_outlined),
                    label: 'Pedidos',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.person_outline),
                    label: 'Perfil',
                  ),
                ],
              ),
            ),
          ),
  );
}

/// Cabeçalho de módulo: título forte, subtítulo curto e uma ilustração
/// pequena em círculo suave.
class ModuleHeading extends StatelessWidget {
  final String title;
  final String subtitle;
  final String eyebrow;
  final FarmArt? art;
  const ModuleHeading({
    super.key,
    required this.title,
    required this.subtitle,
    this.art,
    this.eyebrow = 'MEU CAMPO, MEU DIA',
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 4, bottom: 20),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(title, style: AgroDesign.display),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: AgroDesign.body.copyWith(color: AgroDesign.muted),
              ),
            ],
          ),
        ),
        if (art != null && MediaQuery.textScalerOf(context).scale(14) < 22) ...[
          const SizedBox(width: 12),
          ExcludeSemantics(
            child: Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AgroDesign.mint,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: FarmIllustration(art: art!, width: 60, height: 52),
            ),
          ),
        ],
      ],
    ),
  );
}

/// Superfície branca padrão: cantos amplos, sombra suave e sem borda.
class AgroSurface extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color color;
  final double radius;
  const AgroSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.onTap,
    this.color = AgroDesign.paper,
    this.radius = AgroDesign.radius,
  });
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(radius),
      boxShadow: AgroDesign.softShadow,
    ),
    child: Material(
      color: color,
      borderRadius: BorderRadius.circular(radius),
      clipBehavior: Clip.antiAlias,
      child: onTap == null
          ? Padding(padding: padding, child: child)
          : InkWell(
              onTap: onTap,
              child: Padding(padding: padding, child: child),
            ),
    ),
  );
}

/// Ícone dentro de um círculo suave, como nos atalhos das referências.
class IconBubble extends StatelessWidget {
  final IconData icon;
  final Color background;
  final Color color;
  final double size;
  const IconBubble(
    this.icon, {
    super.key,
    this.background = AgroDesign.mint,
    this.color = AgroDesign.forest,
    this.size = 44,
  });
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: background, shape: BoxShape.circle),
    child: Icon(icon, color: color, size: size * .5),
  );
}

/// Atalho em linha para telas de apoio (ícone, título, apoio e seta).
class FeatureTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  const FeatureTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
  });
  @override
  Widget build(BuildContext context) => AgroSurface(
    onTap: onTap,
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    child: Row(
      children: [
        IconBubble(icon),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AgroDesign.section),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle!, style: AgroDesign.caption),
              ],
            ],
          ),
        ),
        const SizedBox(width: 8),
        const Icon(Icons.chevron_right, color: AgroDesign.muted),
      ],
    ),
  );
}

String statusLabel(dynamic value) => switch (value) {
  'SOLICITADO' => 'Solicitação recebida',
  'ACEITO' => 'Aguardando retirada',
  'RETIRADO' => 'Aguardando destinatário',
  'RECEBIDO' => 'Recebimento confirmado',
  'CANCELADO' => 'Cancelado',
  'RASCUNHO' => 'Rascunho',
  'PUBLICADA' || 'PUBLICADO' => 'Oferta publicada',
  'ATIVA' || 'ATIVO' => 'Ativo',
  'ESGOTADA' => 'Esgotada',
  'SUSPENSA' => 'Suspensa',
  _ => value?.toString() ?? 'Registro disponível',
};

class StatusPill extends StatelessWidget {
  final dynamic status;
  const StatusPill(this.status, {super.key});
  @override
  Widget build(BuildContext context) {
    final attention = ['SOLICITADO', 'ACEITO', 'RASCUNHO'].contains(status);
    final color = attention ? AgroDesign.earth : AgroDesign.forest;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: attention ? AgroDesign.attention : AgroDesign.mint,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                statusLabel(status),
                style: AgroDesign.caption.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class FarmEmptyState extends StatelessWidget {
  final FarmArt art;
  final String title;
  final String message;
  const FarmEmptyState({
    super.key,
    required this.art,
    required this.title,
    required this.message,
  });
  @override
  Widget build(BuildContext context) => AgroSurface(
    padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
    child: Column(
      children: [
        ExcludeSemantics(
          child: Container(
            width: 120,
            height: 120,
            decoration: const BoxDecoration(
              color: AgroDesign.mint,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: FarmIllustration(art: art, width: 104, height: 80),
          ),
        ),
        const SizedBox(height: 18),
        Text(title, style: AgroDesign.title, textAlign: TextAlign.center),
        const SizedBox(height: 8),
        Text(
          message,
          style: AgroDesign.body.copyWith(color: AgroDesign.muted),
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}
