# Indicador de impacto — frontend (portal e Flutter)

Data: 11/11/2026 · Branch: `feat/impacto-frontend` (a partir da `main` `2e228ad`, com o backend integrado)

## Integração prévia na `main` (autorizada)

| Passo | Resultado |
|---|---|
| `fix/flutter-goldens-ci` (`359b647`) | fast-forward na `main` |
| `feat/impacto-backend` (`9c07b1c`) | merge `--no-ff` `2e228ad`, sem conflitos |
| API: `check`, `test`, `test:integration` | sintaxe ok · 30/30 · 51/51 (MongoDB replica set real) |
| Portal: `typecheck`, `test`, `build` | ok · 43/43 · build ok |
| Flutter: `test` | 126/126 |
| Push `main` + GitHub Actions | run `43019709521`: **API, Portal, Flutter e Java aprovados** (correção de fuso confirmada) |

A suíte de integração regrava `docs/evidencias/incremento-2-transacoes.json`; o arquivo foi restaurado antes do push.

## Entrega

Os dois cards consomem `GET /api/v1/properties/:id/excess-impact` (contrato v1) e **não recalculam nada**: só validam o formato e apresentam os valores da API.

**Portal (Next.js)**: card "Destino dos excedentes" na visão geral, abaixo do resumo.
- `src/lib/security.ts`: só a rota `GET /properties/{uuid}/excess-impact` foi incluída. POST, PUT e DELETE continuam bloqueados (teste em `tests/security.test.ts`).
- O token fica no servidor (proxy existente `/api/agro`), e a consulta usa a propriedade selecionada (`workspace.property.id`).
- `src/lib/impact.ts` valida o contrato (versão, `propertyId` igual ao consultado, números ≥ 0, as duas modalidades) e traduz os erros 401, 403 e 404 e as falhas genéricas em mensagens. Falha nunca vira zero.
- `src/components/impact-card.tsx` mostra ofertado, recebido ("confirmado pelo destinatário") e vencido sem destinação, venda × doação (só quando há oferta publicada) e "Ver todas as etapas" (funil e saldos) dentro de `<details>`. Tem selo "Dados demonstrativos", horário da consulta, estados de carregamento, vazio e erro (com "Tentar novamente") e `aria-live`.
- `src/app/theme.css`: estilos `.ov-impact*` com os tokens existentes.

**Flutter**: card na tela "Produção e excedentes", depois de "Suas ofertas".
- `lib/territorial/impact_data.dart` tem o modelo `ExcessImpact`, que recusa respostas fora do contrato ou de outra propriedade, e o `ImpactRepository`:
  - lê via `Repository.read`;
  - recusa propriedade fora do catálogo da sessão (403 local, sem chamada);
  - verifica sessão encerrada;
  - guarda cache por escopo usuário/organização.
- Offline (status 0 ou ≥ 500): o card mostra só a cópia salva, com "Dados salvos de dd/mm às hh:mm".
- 401, 403 e 404 apagam a cópia salva e não usam cache.
- `lib/territorial/impact_card.dart` reutiliza `DashboardCard`, `DashboardHeading`, `IndicatorGrid` e `DashboardStateView`. O detalhe fica em `ExpansionTile` ("Ver todas as etapas"). O card não aparece na galeria de fixtures (`repository.fixture`), que não tem a API.
- `lib/data.dart`: `clear()` (logout) também apaga o cache do indicador.

Textos para não exagerar o impacto: "Recebido · confirmado pelo destinatário"; "As etapas se sobrepõem e não devem ser somadas. Produção registrada não é excedente. Saldo vencido não comprova perda." Os cards não falam em "alimento salvo".

## Auditoria de integração

Feita com a API local real (`npm start`, banco `agroLocal` com `seed:demo` e o cenário de alta demanda), propriedade `Sítio fictício — DEMONSTRAÇÃO`.

| Verificação | Resultado |
|---|---|
| Resposta da API | `published 3330 · received 496 · expiredAvailable 4 · registered 4297,5 · acceptedNet 1046 · pickedUp 736`; saldos `2280/310/240/4`; venda `2720/340`, doação `610/156`; `isDemonstration: true`; `Cache-Control: no-store` |
| Reconciliação | 2280 + 4 + 310 + 240 + 496 = 3330 ✓; aceito = 310 + 240 + 496 = 1046 ✓; retirado = 240 + 496 = 736 ✓; venda + doação = 3330 ✓ |
| Autorização | cooperativa, instituição e comprador → 403 `FORBIDDEN`; sem token → 401 |
| Portal × API | valores idênticos (`captura.json`) |
| Flutter × API | valores idênticos (`captura-flutter.json` e capturas) |
| Coerência com o painel existente | "Suas ofertas" no Flutter (venda 1.830 + doação 450 = 2.280 kg) é igual a `availableActive` da API |

Portal e Flutter mostram os mesmos números para a mesma propriedade e o mesmo estado do banco.

## Testes executados (branch `feat/impacto-frontend`)

- Portal: `typecheck` ok; `npm test` **47/47** (+4: contrato, vazio/modalidade, mensagens de erro, rota do proxy só GET); `npm run build` ok.
- Flutter: `flutter analyze` sem problemas; `flutter test` **133/133** (+7 em `test/impact_card_test.dart`): propriedade selecionada, propriedade não autorizada sem chamada, contrato inválido, offline com cópia salva, 401/403/404 sem cache, valores e modalidades no card, vazio e erro sem zero inventado, botão "Ver todas as etapas" acessível, 320 px com texto 200% sem estouro.
- `npm run build:mobile` + `npm run test:mobile:smoke`: aprovado.
- `scripts/smoke-portal.mjs` (banco isolado): **passa por login, visão geral e auditoria axe WCAG 2.2 AA da home com o card**, e depois falha em `getByLabel('Distribuição da produção')`, rótulo que não existe no portal desde `b34627b` (10/11). Ou seja, a falha já existia antes desta branch e o CI não roda esse smoke. Ver pendências.

Ajustes que o smoke e o axe provocaram:
- `scripts/smoke-portal.mjs`: o seletor "Produção registrada" ficou restrito à região "Resumo da propriedade", porque o card também usa esse termo.
- Contraste: rótulos do card (`#4d5c52`, 6,4:1) e rótulos do eixo do gráfico operacional `.cx-axis` (`#8a978e` 3,04:1 → `#5f6d63` 5,6:1). O problema do eixo já existia, mas o axe só o pegava conforme o tempo da animação.

## Evidências visuais (`docs/design/impacto/frontend/`)

| Arquivo | Conteúdo |
|---|---|
| `destino-*.png` (revisão 2) | página Destino nos tamanhos suportados |
| `flutter-390.png`, `flutter-320.png` | Flutter web, card na tela Produção e excedentes |
| `flutter-320-texto-200.png` | Flutter web com fonte raiz 200% |
| `captura-destino.json`, `captura-flutter.json` | textos extraídos do DOM e da árvore de acessibilidade (sem token) |

Na captura do portal, cabeçalho fixo e link "pular para o conteúdo" foram tornados estáticos só para recortar o card. O etapas expandido do Flutter está coberto pelos testes de widget, não por captura web.

## Divergências e observações para o Codex (contrato)

Nenhuma divergência bloqueante. Observações:
1. `isDemonstration` vem do contexto de autenticação (hoje sempre `true`). Quando houver identidade de produção, vale confirmar que a flag reflete a origem dos dados.
2. `byModeKg` traz só `published` e `received`. Para mostrar "vencido" ou "em trânsito" por modalidade, o contrato teria de crescer (os cards não exigem isso).
3. O vazio é inferido por `funnelKg.published === 0`. Um campo explícito não é necessário.

## Pendências

- `scripts/smoke-portal.mjs` falha a partir de "Distribuição da produção" (já existia na `main`). É preciso realinhar o smoke aos rótulos atuais dos gráficos.
- O portal não tem modo offline nem cache; em falha de rede mostra "Indicador indisponível", sem valores.
- Nenhum merge de `feat/impacto-frontend` foi feito, aguardando aprovação.

## Revisão 2 — página "Destino dos excedentes" (11/11/2026)

A pedido do produtor/autor, o card saiu da visão geral e virou a página `/destino`, no grupo **Logística** da barra lateral (entre Pedidos e Rastreabilidade).

- **KPIs:** ofertado; recebido (% do ofertado, confirmado); em andamento (reservado + em trânsito, com a divisão visível); vencido sem destinação (% do ofertado, destaque de atenção quando > 0).
- **"Para onde foi o que você ofertou":** barra 100% empilhada com as cinco partes disjuntas que a API reconcilia (recebido, em trânsito, reservado, disponível, vencido) e legenda com kg e %.
- **"O que fazer agora":** sugestões geradas a partir dos saldos, com atalho para Ofertas ou Pedidos. Nunca falam em perda ou desperdício.
- **"Caminho do excedente":** funil acumulado com a conversão entre etapas e o aviso "não some os valores".
- **"Venda e doação":** barra de ofertado com a parte recebida preenchida e a taxa de recebimento.
- **Estados:** esqueleto de carregamento, erro com "Tentar novamente", vazio com atalho para criar oferta. Movimento reduzido é respeitado.

Percentuais e a soma reservado + trânsito são só apresentação dos valores da API (`src/lib/impact.ts`, testados). Nenhuma regra de cálculo do domínio foi copiada.

Capturas: `destino-1440.png`, `destino-1024.png`, `destino-390.png`, `destino-320.png`, `destino-320-texto-200.png` (sem rolagem horizontal; `captura-destino.json`). Valores da consulta: 3.330 ofertados = 496 recebidos + 360 em trânsito + 310 reservados + 2.160 disponíveis + 4 vencidos.

## Revisão 3 — gráficos e acabamento (11/11/2026)

- **"Para onde foi o que você ofertou":** virou um medidor de traços, baseado no `graphic-barra-horizontal`.
  - Cada parte começa com um traço alto, com nome, kg e %, e tem tons claro → forte da paleta: recebido verde, em trânsito azul, reservado amarelo, disponível roxo, vencido laranja.
  - Ao passar o mouse, a parte sobe e as outras esmaecem, com uma dica de kg, % e significado. Clique fixa a parte; o teclado funciona como slider.
  - Uma legenda abaixo sempre mostra os kg de todas as partes, inclusive as estreitas demais para ter rótulo.
- **"Caminho do excedente":** trilhos com barra verde brilhante, baseados no `graphic-barra-vertical`, com eixo em kg e etiqueta de valor ao passar o mouse, focar ou clicar (kg e % da etapa anterior). Tem varredura de luz e navegação por setas.
- **Topo da página:** saíram o selo "Dados demonstrativos" e o botão Atualizar. A página recarrega com o botão de atualizar do topo do portal, e o horário da consulta fica na linha de apoio.
- **Entrada:** fade-in escalonado `ag-rise`, igual às outras abas.
- **Texto:** o item do menu virou "Excedentes" (antes não cabia em negrito e ficava espremido); espaçamento de letras e altura de linha mais folgados na página.
- Os componentes foram portados para React + CSS, sem `animejs` (o portal não tem essa dependência). Respeitam movimento reduzido.

Testes: portal 51/51 (+2: divisão de traços e eixo), typecheck e build ok. Capturas: `destino-*.png`, `destino-hover-medidor.png`, `destino-hover-caminho.png`, sem rolagem horizontal em 1440, 1024, 390, 320 e 320 px com texto 200%.
