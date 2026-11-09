# Incremento 1 — auditoria e direção visual

Data: 09/11/2026. Escopo limitado a cinco horas; sem commit/push. Portal Next.js e alterações pré-existentes do pipeline fora do escopo.

## Referências examinadas antes da implementação

As três imagens anexadas foram abertas e preservadas localmente em `docs/design/referencias/territorial-01-barras.png`, `territorial-02-modulos.png` e `territorial-03-verde-lima.png`. São referências, nunca assets do aplicativo. A regra local mantém imagens de inspiração fora do Git.

- 01: barras comparativas, seleção contextual, informação detalhada sob demanda. Adotar comparação histórico/referência, sem perspectiva 3D, marcas ou microtexto.
- 02: hierarquia modular, cards brancos, bloco verde de síntese, ritmos consistentes. Adotar uma coluna móvel e indicadores que se reorganizam com texto ampliado.
- 03: verde profundo, destaque lima, números legíveis e formas arredondadas. Adotar o verde do Agro+ e lima pontual; sem métricas comerciais, roscas decorativas ou marcas alheias.

A skill revenue-centric-design, referência dashboards-and-data-viz, orienta reduzir ruído e anexar significado aos números. Neste estudo retrospectivo, interpretar dados não autoriza manejo ou alertas operacionais.

## Flutter existente

`main.dart`: SessionPage (token demo em memória), Gallery opcional, AppShell com cinco destinos móveis (Início, Produção, Ofertas, Pedidos, Perfil), formulários, lotes e histórico via Navigator. DesktopShell tem navegação lateral própria. `home.dart` oferece saudação, clima OpenWeather, pendências, atalhos, estados e registros recentes. `tasks.dart`/`records.dart` implementam operações existentes. `design.dart` contém tokens, navegação e cabeçalhos. `desktop_charts.dart` atende comparações comerciais existentes, com semântica própria; não representa os três painéis territoriais acadêmicos.

`data.dart`: ApiRepository + HomeController + SnapshotStore/SharedPreferences; cache por origem/usuário/organização/propriedade; sem tokens; leitura offline e bloqueio de escrita. Nenhuma substituição desses componentes é necessária. O pacote de dados hídricos é público, regional e embarcado; não pertence ao cache privado da propriedade.

## Requisitos acadêmicos

`docs/requisitos/conformidade.md` exige pelo menos três dashboards territoriais distintos, gráficos/históricos/tendências, alertas explicados, estado, API, offline, formulário e acessibilidade. A tela comercial Produção existente não encerra o painel territorial Produção/Excedentes. Este incremento entrega somente Inteligência Hídrica; Produção/Excedentes e Logística permanecem pendentes. As faixas estatísticas históricas não são alertas oficiais.

## Dados auditados

Contrato agua04-1.0, sem endpoint. Histórico regional NASA POWER AG em LST, 01/01/2000–31/12/2025. Referência exclusivamente 2000–2019 (20 amostras por mês). Inventário inclui hashes dos agregados, contrato e auditoria; verificar bytes antes de copiar. Usar todos os 312 meses e 9.497 dias, incluindo nulos iniciais de janelas móveis. Nunca converter ausente em zero. Valores finais do contrato: R7 24,22 mm; R30 86,50 mm; sequência final 0 dias; dezembro 86,57 mm; referência 186,27 mm; anomalia −99,70 mm/−53,52%.

Datas de extração (06/11/2026), geração e observação são distintas. Não existe atualização ao vivo. Produto em grade na sede municipal, sem pluviômetro de fazenda, validação externa, água no solo ou decisão automática de irrigação. Ridge fica fora da primeira interface para manter a leitura focada; não haverá inferência ou treinamento.
