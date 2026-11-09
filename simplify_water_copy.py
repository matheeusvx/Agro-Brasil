from pathlib import Path
p=Path('apps/mobile/lib/territorial/dashboard_components.dart');s=p.read_text(encoding='utf-8').replace('Toque nas barras para explorar · deslize para os lados','Toque em uma barra para ver o valor');p.write_text(s,encoding='utf-8')
p=Path('apps/mobile/lib/territorial/water_dashboard.dart');s=p.read_text(encoding='utf-8').replace('Média de referência: ', 'Média histórica: ');p.write_text(s,encoding='utf-8')
