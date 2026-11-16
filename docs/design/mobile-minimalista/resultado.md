# Redesign minimalista do app mobile — resultado (16/11/2026)

Pedido: deixar o app Flutter mais minimalista, moderno e intuitivo, mantendo o público (pequeno produtor rural), a paleta verde/branco, a logo e a navegação inferior. Referências visuais: apps de bem-estar e nutrição com cartões brancos limpos e um app de gestão de fazenda com cartão de clima e grade de atalhos (somente como direção de estilo; nenhum asset copiado).

## O que mudou

| Área | Antes | Depois |
|---|---|---|
| Tokens (`lib/design.dart`) | Creme, cartões sem sombra, títulos 24 | Fundo `canvas` #F5F7F2, `mint` #EAF5EC, `display` 28, sombra suave única |
| Tema (`lib/main.dart`) | Botões com raio 16 | Botões em pílula 54 dp, foco do campo em `forest`, snackbar flutuante |
| Entrada (`SessionPage`) | Faixa "Demonstração local · participantes fictícios" | Removida; logo + ilustração em cartão arredondado, título centralizado |
| Home (`lib/home.dart`) | Linha "Demonstração · dados fictícios", rodapé "Atualizado em" e "sem GPS contínuo" | Removidos; faixa verde com saudação e clima em gradiente, card de próxima ação, atalhos 2×2, lotes em lista |
| Abas (`lib/tasks.dart`) | Faixa "Demonstração · sem gravações", botões contornados para painéis | Removida; `FeatureTile` para "Produção e excedentes" e "Acompanhar logística", cartões de oferta/pedido com sombra |
| Perfil | Faixa "Seu acesso fica somente nesta sessão" e texto "Demonstração local…" | Removidos; avatar com iniciais, permissão em cartão próprio, propriedade |
| Histórico do lote | Faixa "Não é GPS em tempo real" | Removida (o aviso offline continua) |
| Painéis | Rótulos "Demonstração · registros fictícios" e "Consultado em …" | Removidos; origem dos dados mantida; data aparece só na cópia offline |
| Navegação inferior | — | Inalterada (5 abas, sem barra lateral) |

Mantidos: avisos funcionais (offline, erro, somente consulta), atribuição OpenWeather, horário de observação do clima, alvos ≥ 48 dp, `disableAnimations`, regras de integridade dos dados (nenhum número novo foi criado).

Observação: os nomes de organização/propriedade das fixtures e do seed (ex.: "Sítio Boa Esperança · fictício") são dados, não blocos da interface, e não foram alterados.

## Evidências

- `flutter analyze`: sem problemas.
- `flutter test`: 150 testes passando (inclui contraste, alvos de toque, 320 dp e texto 200%).
- Goldens regenerados deliberadamente em `docs/design/goldens-v2/` (home em todos os cenários, Produção, Ofertas, Pedidos, Perfil e Histórico em 390×844 e 320/200%).
- Testes ajustados: `widget_test.dart` passa a exigir a **ausência** de "dados fictícios", "Atualizado em" e "sem GPS" na home; `impact_card_test.dart` exige ausência de "Dados demonstrativos"; `logistics_dashboard_test.dart` usa um marcador invisível `logistics-ready` em vez do rótulo removido.

## Etapa 2 — Inteligência hídrica, perfil editável e animações (16/11/2026)

Pedido: refazer a tela hídrica (letras verde-claro, gráficos ruins, avisos com texto demais), tirar a ilustração do sítio ao lado de "Meu perfil" e permitir editar/personalizar o perfil, com animações suaves.

| Área | Antes | Depois |
|---|---|---|
| Tela hídrica (`water_dashboard.dart`) | Card escuro com textos em verde-claro, sobretítulo técnico, card "Próximos painéis" | Cabeçalho limpo; cartão claro "Chuva no mês" com número grande, frase de comparação em pílula e duas barras animadas (este mês × média); dias secos em um cartão curto; análise detalhada recolhida |
| Gráfico (`DashboardBarChart`) | Barras duplas finas, verde-claro como média, duas legendas de escala | Barras arredondadas que crescem ao abrir, média como traço terroso, valor sobre o mês selecionado, uma linha de rodapé |
| Avisos (`alert_card.dart`) | Título "Avisos explicados", frase extra, ícone + selo + tipo + confiança em várias linhas | "Avisos": ícone em círculo, título e uma linha (atenção · confiança); explicação completa em "Entender o aviso" |
| Perfil (`lib/profile.dart`) | Só leitura; ilustração ao lado do título; propriedade com desenho do sítio | Sem ilustração; avatar com iniciais e cor escolhida, nome, sobre e culturas; propriedade em cartão simples; preferências "Texto maior" e "Reduzir animações" (valem para o app todo); "Sair da conta" |
| Editar perfil | — | Nome de exibição (usado na saudação da home), sobre a produção, culturas do catálogo, cor do avatar; botão confirma "Perfil salvo" no próprio lugar e volta |
| Animações (`lib/motion.dart`) | — | Entrada com fade + subida de 12 dp escalonada em 60 ms (curva `Cubic(0.25, 0.8, 0.25, 1)`), resposta a toque `Cubic(0.3, 0.75, 0.1, 1)`, compressão 0,965 ao pressionar; tudo desligado com `disableAnimations` ou "Reduzir animações" |

Integridade: a API não tem edição de perfil; a personalização fica salva **neste aparelho** (por usuário e organização) e não altera dados oficiais. Organização e vínculo aparecem bloqueados na edição. Textos de limite do painel hídrico (sem solo, irrigação ou previsão) continuam na análise detalhada.

Evidências: `flutter analyze` sem problemas; `flutter test` com 153 testes passando, incluindo o novo `test/profile_test.dart` (edição, persistência, saudação, texto maior e animação reduzida). Goldens de Perfil regenerados em `docs/design/goldens-v2/`. Conferido no navegador em 390×844: tela hídrica, gráfico, perfil e fluxo de edição.

## Etapa 3 — Logística e Produção e excedentes (16/11/2026)

Pedido: aplicar na Logística o mesmo tratamento da tela hídrica. Aplicado também em "Produção e excedentes", que tinha o mesmo cartão escuro com título verde-claro.

| Tela | Antes | Depois |
|---|---|---|
| Logística (`logistics_dashboard.dart`) | Texto solto no topo; cartão escuro com "Pedidos em andamento" em verde-claro; barras sem trilho; ações e municípios com ícones soltos | Título "Seus pedidos" + subtítulo; cartão claro com ícone, número grande em verde-escuro e pílula "N já recebidos"; barras com trilho e contagem em pílula; ações em linhas com ícone em círculo (solicitação em tom de atenção); municípios com ícone em círculo; análise detalhada em cartão com ícone |
| Produção e excedentes (`production_dashboard.dart`) | Mesmo cartão escuro com "Minha produção" em verde-claro | Título "Sua produção"; cartão claro com total em verde-escuro e pílula de culturas; Venda e Doação com ícone em círculo |

Entrada escalonada dos blocos mantida curta (≤ 400 ms, exigência do teste de movimento) com a curva de chegada `Cubic(0.25, 0.8, 0.25, 1)`.

Evidências: `flutter analyze` sem problemas; `flutter test` com 153 testes passando. O marcador de teste `logistics-ready` passou a ter 1 dp no topo da lista (com 0 dp ele era tratado como fora da tela com texto em 200%). Conferido no navegador em 390×844.

## Etapa 4 — Tela de entrada (16/11/2026)

Pedido: login clean e minimalista.

| Antes | Depois |
|---|---|
| Cartão com logo e ilustração do sítio empilhados; título, campo e botão soltos abaixo; rótulo "Token temporário de demonstração" | Fundo `forest` com a logo, uma frase curta ("Produção, ofertas e entregas em um só lugar.") e três pílulas discretas, centralizados no espaço livre; folha clara de cantos arredondados com "Meu campo, meu dia.", campo **"Código de acesso"** (ícone de chave e botão mostrar/ocultar), botão em pílula com indicador de carregamento; erro em aviso vermelho suave; após verificar, "Acesso verificado" + organização + "Entrar na minha propriedade". Em telas largas, a folha vira um cartão centralizado |

Animação: logo, frase, pílulas e folha entram em sequência (`Reveal`); botões com `PressScale`. `Reveal` passou a manter a semântica durante o fade (leitores de tela leem o conteúdo desde o primeiro quadro).

Também alterado: `scripts/smoke-desktop.mjs` usa o novo rótulo "Código de acesso".

Evidências: `flutter analyze` sem problemas; `flutter test` com 156 testes passando (novos testes de login em 320×700 com texto 200%, 390×844 e 1280×800). Conferido no navegador em 390×844, inclusive o estado de erro.
