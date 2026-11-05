import 'package:flutter/material.dart';

/// Tokens locais. A hierarquia de tarefas não depende de um tema Material padrão.
abstract final class AgroDesign {
  static const forest = Color(0xFF173E2C);
  static const green = Color(0xFF285B3E);
  static const leaf = Color(0xFF60804D);
  static const cream = Color(0xFFF8F7F1);
  static const paper = Color(0xFFFFFFFF);
  static const ink = Color(0xFF20392C);
  static const muted = Color(0xFF536453);
  static const line = Color(0xFFDCE4D7);
  static const wash = Color(0xFFEEF3E7);
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
    fontSize: 23,
    height: 1.2,
    fontWeight: FontWeight.w700,
    color: ink,
  );
  static const section = TextStyle(
    fontSize: 20,
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
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      color: AgroDesign.paper,
      border: Border(top: BorderSide(color: AgroDesign.line)),
    ),
    child: NavigationBarTheme(
      data: NavigationBarThemeData(
        height: 76,
        elevation: 0,
        backgroundColor: Colors.transparent,
        indicatorColor: AgroDesign.wash,
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
  );
}
