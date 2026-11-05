import 'package:flutter/material.dart';

import 'illustrations.dart';

/// Tokens locais. A hierarquia de tarefas não depende de um tema Material padrão.
abstract final class AgroDesign {
  static const forest = Color(0xFF173F32);
  static const green = Color(0xFF285E45);
  static const leaf = Color(0xFF73A760);
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
  static const radius = 22.0;
  static const smallRadius = 16.0;
  static const gutter = 20.0;
  static const gap = 12.0;
  static const sectionGap = 24.0;
  static const title = TextStyle(
    fontSize: 24,
    height: 1.2,
    fontWeight: FontWeight.w700,
    color: ink,
  );
  static const section = TextStyle(
    fontSize: 19,
    height: 1.25,
    fontWeight: FontWeight.w700,
    color: ink,
  );
  static const body = TextStyle(fontSize: 15, height: 1.4, color: ink);
  static const caption = TextStyle(fontSize: 13, height: 1.35, color: muted);
  static const eyebrow = TextStyle(
    fontSize: 11,
    height: 1.3,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.2,
    color: muted,
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
                                ? AgroDesign.wash
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
                indicatorColor: const Color(0xFFDEEACC),
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

/// Compact module identity: each screen has its own job and a shared grammar.
class ModuleHeading extends StatelessWidget {
  final String title;
  final String subtitle;
  final String eyebrow;
  final FarmArt art;
  const ModuleHeading({
    super.key,
    required this.title,
    required this.subtitle,
    required this.art,
    this.eyebrow = 'MEU CAMPO, MEU DIA',
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(eyebrow, style: AgroDesign.eyebrow),
              const SizedBox(height: 8),
              Text(title, style: AgroDesign.title),
              const SizedBox(height: 6),
              Text(subtitle, style: AgroDesign.caption),
            ],
          ),
        ),
        if (MediaQuery.textScalerOf(context).scale(14) < 22) ...[
          const SizedBox(width: 8),
          Container(
            decoration: BoxDecoration(
              color: AgroDesign.wash,
              borderRadius: BorderRadius.circular(24),
            ),
            child: FarmIllustration(art: art, width: 88, height: 86),
          ),
        ],
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
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: attention ? AgroDesign.attention : AgroDesign.wash,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          statusLabel(status),
          style: AgroDesign.caption.copyWith(
            color: attention ? AgroDesign.earth : AgroDesign.forest,
            fontWeight: FontWeight.w700,
          ),
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
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Column(
      children: [
        FarmIllustration(art: art, width: 156, height: 110),
        const SizedBox(height: 12),
        Text(title, style: AgroDesign.section, textAlign: TextAlign.center),
        const SizedBox(height: 8),
        Text(message, style: AgroDesign.body, textAlign: TextAlign.center),
      ],
    ),
  );
}
