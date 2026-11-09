from pathlib import Path
p=Path('apps/mobile/lib/territorial/production_dashboard.dart');s=p.read_text(encoding='utf-8');start=s.index('                  DashboardCard(\n                    dark: true,');end=s.index('                  const SizedBox(height: 16),',start);block=s[start:end];block=block.replace('DashboardCard(', '_ProductionEntrance(child: DashboardCard(',1);i=block.rfind('),');block=block[:i]+')),'+block[i+2:];s=s[:start]+block+s[end:];s+='''
class _ProductionEntrance extends StatelessWidget {
  final Widget child;
  const _ProductionEntrance({required this.child});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: 1), duration: dashboardMotion(context), child: child,
    builder: (context, value, child) => Opacity(opacity: value,
      child: Transform.translate(offset: Offset(0, 8 * (1 - value)), child: child)),
  );
}
''';p.write_text(s,encoding='utf-8')
