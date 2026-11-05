# Design System — Agro+ Brasil Portal

Sistema operacional de desktop, com identidade agrícola e superfícies leves. Não é uma ampliação dos cards Flutter. A composição privilegia decisão → registro → consulta de origem.

## Tokens

| Token | Valor | Função |
|---|---|---|
| Floresta | #235740 | ação primária e navegação ativa |
| Texto | #213C30 | títulos e conteúdo operacional |
| Fundo | #F7F8F3 | espaço de trabalho creme |
| Superfície | #FFFFFF | tabelas, gráficos e drawers |
| Borda | #E2E7DE | separação discreta |
| Folha | #90AD79 | série secundária e detalhes de cultura |
| Terra | #C48C69 | série operacional |
| Sol | #DFBD75 | série e atenção, sem simular urgência |
| Perigo | #A53A38 | erro textual com orientação |

Fonte Roboto local, regular/bold, já licenciada no repositório. Não há dependência de Google Fonts ou CDN em execução. Título de página 28 px; seções 15–22 px; operações e campos 12–14 px; auxiliares 10–12 px. Alvos de teclado visíveis e cores de texto revisadas com axe.

Sidebar 232 px (210 px em larguras menores), recolhida 76 px. Cabeçalho com organização e propriedade e conteúdo em uma malha flexível. Margens 24–32 px, gaps 16–20 px, raios 8–11 px; sombra apenas em elementos que se sobrepõem. Drawer modal 560–580 px, corpo com rolagem e rodapé de confirmação fixo. Tabela com cabeçalho e paginação visíveis, rolagem interna quando necessário.

## Componentes

- **Button/Input/Sheet/Table/Badge/etc.** gerados pelo CLI oficial shadcn/ui e adaptados localmente; Radix oferece foco preso no modal, Escape e retorno do foco. Botão de fechar em português.
- **PortalShell:** sidebar com estado ativo, recolhimento, atalhos de teclado nativos por links/botões, seletores de contexto e saída real.
- **PriorityPanel:** resumo limitado à ação que merece atenção; consulta de pedido não promete alteração de estado.
- **Metrics:** volume registrado, lotes com origem e pedidos em aberto. Sem tendências ou diferenças percentuais fictícias.
- **OperationalCharts:** Recharts/SVG com hover, clique, legenda operável por teclado e leitura absoluta/percentual. A profundidade não altera a representação quantitativa.
- **ProductionTable:** busca por cultura/safra/lote, filtros combináveis, ordenação por colheita, seleção, exportação local CSV e paginação de apresentação. Exportação protege células contra fórmulas.
- **ProductionDetails:** consulta individual e eventos autorizados; identificador secundário copiável. Não contém edição falsa.
- **ProductionCreate:** dados da colheita e origem em grupos, contexto pré-preenchido, validação nativa/servidor e confirmação explícita. Erros mantêm os campos.
- **WorkspaceState:** skeleton durante carga, retry para falhas, orientação para propriedade ausente e estados vazios sem registros simulados.

## Movimento e acessibilidade

Transições de 150–220 ms para hover/sidebar; prefers-reduced-motion reduz animações. Gráficos não dependem de animação para comunicar valor. Legendas fornecem alternativas ao hover. Foco tem contorno explícito e o portal possui link para saltar ao conteúdo.

Ícones Lucide são usados com rótulos operacionais. Não há mascotes, fotos, marcas ou assets copiados de MARELI/Motiva. O único logo de terceiro em execução é OpenWeather, usado exclusivamente para atribuição quando há dados meteorológicos válidos.
