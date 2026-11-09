from pathlib import Path
p=Path('apps/mobile/lib/territorial/water_dashboard.dart')
s=p.read_text(encoding='utf-8').replace("title: const Text('Inteligência hídrica', maxLines: 2)","title: const Text('Chuvas na sua região', maxLines: 2)")
a=s.index('            const TerritorialHeader(',s.index("key: const PageStorageKey('water-dashboard-scroll')")); b=s.index('            LayoutBuilder(',a)
s=s[:a]+'''            const Text('Mogi das Cruzes/SP', style: AgroDesign.section),
            const SizedBox(height: 4),
            Text('Dados históricos até ${waterDate(data.dataAsOf)} · NASA POWER', style: AgroDesign.caption),
            const SizedBox(height: 6),
            const Text('Somente Mogi das Cruzes/SP, mesmo se sua propriedade estiver em outro município.', style: AgroDesign.caption),
            const SizedBox(height: 16),
'''+s[b:]
s=s.replace("? 'Igual à média de referência deste mês'","? 'Choveu o mesmo que a média histórica'").replace("'${waterNumber(anomaly.abs())}% ${anomaly < 0 ? 'abaixo' : 'acima'} da média deste mês'","'Choveu ${waterNumber(anomaly.abs(), decimals: 0)}% ${anomaly < 0 ? 'menos' : 'mais'} que a média histórica'")
s=s.replace("'Referência 2000–2019: ${waterNumber(reference.mean)} mm'","'Média deste mês: ${waterNumber(reference.mean)} mm (2000–2019)'")
a=s.index('                  const SizedBox(height: 14),',s.index("'Média deste mês:"));b=s.index('\n                ],',a);s=s[:a]+s[b:]
s=s.replace("'Compare os meses do ano com a referência histórica.'","'Chuva de cada mês e o que costuma chover.'").replace("label: 'Histórico de $year'","label: 'Chuva em $year'").replace("label: 'Média 2000–2019'","label: 'Média histórica'").replace("'Média de referência: ${waterNumber(reference.mean)} mm.'","'Média histórica: ${waterNumber(reference.mean)} mm.'")
a=s.index('                  const SizedBox(height: 8),',s.index("'Média histórica: ${waterNumber(reference.mean)} mm.'"));b=s.index('\n                ],',a);s=s[:a]+s[b:]
a=s.index('            const DashboardHeading(\n              title: \'Acumulados');s=s[:a]+'''            DashboardCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${waterNumber(selectedMonth.dryDays, decimals: 0)} dias com pouca chuva', style: AgroDesign.section),
              const SizedBox(height: 6),
              Text('${selectedMonth.label} · menos de 1 mm por dia. Isso não significa, por si só, seca agrícola.', style: AgroDesign.caption),
            ])),
            const SizedBox(height: 16),
            Material(color: Colors.white, borderRadius: BorderRadius.circular(24), child: ExpansionTile(
              key: const PageStorageKey('water-detailed-analysis'),
              maintainState: true,
              title: const Text('Ver análise detalhada', style: AgroDesign.section),
              subtitle: const Text('Acumulados, sequências e origem dos dados', style: AgroDesign.caption),
              childrenPadding: const EdgeInsets.all(12),
              children: [
                _dataTable(yearMonths),
                const SizedBox(height: 16),
'''+s[a:]
a=s.index('\n          ],\n        ),\n      ),\n    );',s.index("key: const PageStorageKey('water-detailed-analysis')"));s=s[:a]+'''\n              ],
            )),'''+s[a:]
p.write_text(s,encoding='utf-8')
# Existing domain and regression assertions stay intact; reveal the new secondary section.
p=Path('apps/mobile/test/water_dashboard_test.dart');s=p.read_text(encoding='utf-8').replace("find.textContaining('sem atualização em tempo real')","find.textContaining('Dados históricos até')")
needle="      final outer = find.byType(Scrollable).first;"
# indentation differs after formatting; inject before every outer scroll finder
s=s.replace('    final outer = find.byType(Scrollable).first;',"    await tester.scrollUntilVisible(find.text('Ver análise detalhada').hitTestable(), 200, scrollable: find.byType(Scrollable).first);\n    await tester.tap(find.text('Ver análise detalhada'));\n    await tester.pumpAndSettle();\n    final outer = find.byType(Scrollable).first;")
s=s.replace("    expect(find.text('Próximos painéis'), findsOneWidget);","    expect(find.text('Ver análise detalhada'), findsOneWidget);")
p.write_text(s,encoding='utf-8')
