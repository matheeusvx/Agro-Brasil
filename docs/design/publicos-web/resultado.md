# Portal multi-público — produtor, cooperativa e instituição (incremento 1)

12/11/2026 · base `main` em `0ab333b` (PR #3). API não alterada.

## O que mudou

| Área | Implementação |
|---|---|
| Sessão (`server-session.ts`, `api/session`) | Aceita vínculos ativos de `PEQUENO_PRODUTOR_RURAL`, `COOPERATIVA` e `INSTITUICAO`. Produtor tem precedência como vínculo inicial. A sessão só lista vínculos atendidos (comprador local fica fora). Troca de organização valida o vínculo em `/me` a cada pedido. Token só na memória do servidor. |
| Proxy (`security.ts`, `api/agro/[...path]`) | Lista por público do vínculo ativo. Cooperativa: só `GET /cooperative-home`. Instituição: só `GET /institution-home` e `GET /offers`. Para esses dois públicos, a query aceita apenas `limit`/`offset` numéricos (bloqueia `scope=mine`). Nenhuma mutação nova. Produtor sem alteração (e sem acesso às homes novas). |
| Provider | `member`/`audience` derivados do vínculo ativo. Para cooperativa e instituição não roda `catalog`, `producer-home`, produções ou pedidos. 401 encerra a sessão; 403 descarta dados e revalida a sessão. |
| Shell | Menu por público, seletor de organização agrupado por tipo (`optgroup`), seletor de propriedade só para o produtor. Página de outro perfil não monta: mostra "Esta área não faz parte do perfil ativo." Conteúdo remontado a cada troca (`key` = organização). |
| Contratos (`organization-home.ts`) | Valida `schemaVersion` 1, `organizationId` e `organizationType` iguais ao vínculo ativo, os cinco estados, contagens/kg, até 3 prioridades e paginação coerente com `total`. Projeção explícita: campos extras descartados. Resposta inválida → erro, nunca zero. Ofertas: projeção sem IDs de organização ou de lote. |
| Cooperativa | `/visao-geral`: retiradas pendentes em destaque, 4 indicadores (designadas, retiradas pendentes, aguardando destinatário, recebimentos confirmados), "O que fazer agora" (≤3), 5 remessas recentes. `/remessas`: lista paginada (20). |
| Instituição | `/visao-geral`: confirmações pendentes em destaque, 5 indicadores (enviadas, aguardando aceite, aguardando retirada, aguardando sua confirmação, recebimentos concluídos), prioridades, histórico recente. `/solicitacoes`: histórico paginado. `/ofertas-disponiveis`: `GET /offers` paginado (12). |
| Ações futuras | Botões desabilitados "Registrar retirada", "Confirmar recebimento" e "Solicitar" (com "em breve") apenas quando `canWrite` e papel ADMIN/EDITOR. LEITOR vê "Somente consulta" e nenhum controle de escrita. |
| Visual | `publicos.css` com tokens do portal; hero verde profundo, cartões brancos, creme nas prioridades; `ag-rise` desligado com movimento reduzido; alvos de paginação de 48 px. Aviso discreto quando `isDemonstration`. |

Nenhuma conta é refeita no cliente: totais e kg vêm da API. Não há trajeto, endereço, prazo de chegada nem necessidades institucionais.

## Validação (API e MongoDB locais reais, sem mocks)

- `npm run typecheck` ✔ · `npm test` (portal): **60/60** (8 novos em `tests/publicos.test.ts`: sessão, páginas, LEITOR, proxy, contrato, troca de organização, estado vazio, ofertas) · `npm run build` ✔ · `npm run check` (raiz) ✔.
- `scripts/seed-publicos-web.mjs` (`npm run seed:demo:publicos`): cria usuário com vínculos Produtor LEITOR + Cooperativa EDITOR + Instituição LEITOR + "Instituição sem pedidos" ADMIN, e um LEITOR de cooperativa. Não cria pedidos; dados operacionais são os já existentes no banco local.
- `scripts/verify-portal-publicos.mjs` (HTTP contra `next start`): **6/6** — [verificacao-http.json](verificacao-http.json).
  1. Produtor: rotas originais 200; homes novas 404 no proxy.
  2. Cooperativa: só a própria home; `producer-home`, `catalog`, `orders`, `offers`, `institution-home` e `pickup` bloqueados.
  3. Instituição: home e ofertas; rotas do produtor, `scope=mine` e `POST /orders` bloqueados.
  4. Vínculos múltiplos: cada troca retorna o `organizationId` do novo vínculo; organização sem vínculo → 403.
  5. LEITOR: `canWrite=false`.
  6. Comprador local 403; sem sessão 401; token inválido 401.
- `scripts/capture-portal-publicos.mjs` (Edge headless): 6/6 roteiros, 0 erros de página, armazenamento do navegador vazio — [captura-publicos.json](captura-publicos.json). Comprova as requisições feitas por perfil: cooperativa só `/cooperative-home`, instituição só `/institution-home` e `/offers`.
- Estado de erro: **único caso simulado**, uma resposta 503 interceptada no navegador; os indicadores somem e aparece "Tentar novamente".

### Capturas

| Tela | Arquivos |
|---|---|
| Cooperativa | `cooperativa-home-{1440,390,320,320-texto-200}.png`, `cooperativa-remessas-1440.png`, `cooperativa-area-bloqueada.png` |
| Instituição | `instituicao-home-*.png`, `instituicao-ofertas-*.png`, `instituicao-solicitacoes-1440.png` |
| Vínculos múltiplos | `multiplo-cooperativa-1440.png`, `multiplo-instituicao-leitor-1440.png`, `multiplo-produtor-leitor-1440.png` |
| LEITOR / estados | `leitor-cooperativa-1440.png`, `estado-vazio-instituicao-1440.png`, `estado-erro-cooperativa-1440.png` |
| Produtor (regressão) | `produtor-1440.png` |

Sem rolagem horizontal em 1440, 390 e 320 px. Em 320 px com texto 200%, o conteúdo novo cabe; o único elemento acima da largura é o `skip-link` preexistente do shell (fora da tela até receber foco).

## Limitações

- Smoke completo do portal (`scripts/smoke-portal.mjs`) não foi executado: ele cria dados no banco local. A regressão do produtor foi coberta pelo roteiro de captura (menu, `producer-home`, proteção) e pelos testes unitários.
- Recursos preexistentes não alterados: barra lateral não acompanha a altura total em capturas de página inteira; `skip-link` em texto 200%.
- O nome do ofertante vem da API como foi gravado (ex.: "Produtor rural — DEMONSTRAÇÃO").
- `GET /offers` não informa `canWrite`; o controle "Solicitar" segue só o papel. A API continuará decidindo.
- Proxy usa os vínculos atualizados no último `GET /api/session` ou na última troca; a API continua a autoridade a cada requisição.

## Próximo incremento (escrita)

1. Proxy: liberar por público `POST /shipments/:id/pickup` (cooperativa), `POST /orders`, cancelamento e `POST /shipments/:id/receipts` (instituição), sempre com `Idempotency-Key`.
2. Formulários com local confirmado (`location` + `locationConfirmed`), recebimento integral e mensagens para 409/403.
3. Trocar `ActionSlot` pelos comandos reais, recarregar a home após sucesso e testar ADMIN/EDITOR/LEITOR e estados inválidos com a API real.

> Concluído no incremento 2, abaixo.

---

# Incremento 2 — operações reais, animação de entrada e correções visuais

12/11/2026 · base `main` em `25aa064`. Backend não alterado.

## Animação de entrada em todas as abas

A skill StageShow foi consultada como referência de movimento: cada movimento tem causa, a entrada é sequencial, o quadro final fica estável e o movimento reduzido é respeitado. O kit dela serve para ilustrações de UI falsa, por isso não foi usado no portal real. O padrão existente foi reaproveitado:

- `portal-shell.tsx` envolve cada página em `.ag-page`, remontada por rota e por organização.
- `theme.css` aplica o mesmo `ag-rise` (translateY 14 px, escala 0,985, opacidade, 0,5 s) aos blocos da página. Quando há um único contêiner (Produção, Ofertas, Pedidos, Excedentes, Rastreabilidade), animam os filhos dele. Ordem: cabeçalho → cards/indicadores → listas/painéis, 70 ms por bloco (`--ag-step`), limite de 280 ms.
- A Visão geral mantém o próprio escalonamento (`--i`), sem duplicação.
- Minha Fazenda (cena 3D): só opacidade (`ag-fade`), nenhum transform sobre o canvas.
- Linhas de tabelas não animam individualmente; os modais (portais) não são afetados.
- `prefers-reduced-motion: reduce` desliga todas as animações de entrada.

As 15 abas dos três públicos foram verificadas com nome e atraso da animação, e também com movimento reduzido (`operacoes/relatorio-e2e.json`, chave `animation`).

## Correções visuais

| Problema | Correção |
|---|---|
| "Ir para o conteúdo" criava rolagem horizontal a 320 px com texto 200% | Escondido por `translateY`, `max-width: calc(100vw - 40px)` e quebra de texto; ao receber foco, aparece dentro da tela (verificado no E2E) |
| Barra lateral cortada em capturas de página inteira | Fundo contínuo na coluna da grade (`.portal-frame`), com a barra ainda sticky em 100dvh e sem elementos fixos novos |
| Produção a 320 px: o botão do cabeçalho excedia 13 px | `.page-heading` quebra linha em telas ≤ 780 px |
| Linhas de Remessas/Solicitações a 320 px com texto 200% | Layout flexível empilhado |
| Contraste 4,35:1 no drawer de cadastro (axe, preexistente) | `#6b7a70` → `#5f6e64` em `drawers.css` |

## Operações

| Público | Operação | Endpoint | Quando aparece |
|---|---|---|---|
| Cooperativa | Registrar retirada | `POST /shipments/:id/pickup` | ACEITO e remessa PLANEJADA |
| Instituição | Solicitar | `POST /orders` | Ofertas disponíveis; quantidade ≤ saldo apresentado |
| Instituição | Cancelar solicitação | `POST /orders/:id/cancel` | SOLICITADO ou ACEITO |
| Instituição | Confirmar recebimento | `POST /shipments/:id/receipts` | RETIRADO e remessa RETIRADA; quantidade integral do pedido |

- Formulário único (`command-sheet.tsx`): resumo do que será confirmado, município, UF e confirmação explícita; envia `location` + `locationConfirmed: true`. Não há GPS, rota ou distância.
- `IdempotencyKeeper` (`lib/commands.ts`): a mesma chave é reutilizada após falha de rede ou 5xx com os mesmos dados. Uma nova chave só nasce após sucesso, recusa definitiva (4xx) ou mudança dos dados.
- "Enviando…" com botão e drawer travados. O toast de sucesso só aparece após 2xx da API.
- Erros: 400 (dados), 401 (encerra a sessão), 403 (perfil sem permissão; revalida a sessão), 404/409 (mensagem da API e recarga dos dados), conexão (repetir com segurança).
- Após o sucesso, a tela recarrega sem desmontar: os dados ficam visíveis até a nova resposta.
- Ações só para ADMIN/EDITOR com `canWrite`. O LEITOR vê "Somente consulta".

Proxy: cooperativa = `GET /cooperative-home` e `POST /shipments/:id/pickup`. Instituição = `GET /institution-home`, `GET /offers`, `POST /orders`, `POST /orders/:id/cancel` e `POST /shipments/:id/receipts`. Qualquer POST de LEITOR recebe 403 no próprio proxy; rota de outro público, 404. Produtor sem mudanças.

## Validação

| Execução | Resultado |
|---|---|
| `npm run typecheck` / `npm run build` (portal) | aprovados |
| `npm test` (portal) | **65/65** |
| `scripts/smoke-portal.mjs` (MongoDB descartável) | **aprovado** após atualizar seletores |
| `scripts/e2e-portal-operacoes.mjs` (MongoDB descartável, API e portal reais, Edge) | **10/10** — [relatorio-e2e.json](operacoes/relatorio-e2e.json) |
| `verify-portal-publicos.mjs` e `capture-portal-publicos.mjs` (banco local, somente leitura) | 6/6 e 6/6 |
| Contagem do banco local antes e depois | idêntica |

O E2E cobre: solicitação barrada acima do saldo e depois aceita (30 kg); cancelamento após confirmação; aceite do produtor via API; retirada com falha de rede na primeira tentativa (sem sucesso exibido e com a mesma chave na segunda); recebimento integral; conflito 409 (o produtor cancela enquanto a cooperativa confirma); LEITORes sem controles e com 403; isolamento entre públicos (404); troca de vínculos sem resíduos; animação nas 15 abas e desligada com movimento reduzido; ausência de rolagem horizontal em 390/320 px e com texto 200%; skip-link focado dentro da tela.

A única simulação é a queda de rede (`route.abort`), usada para provar a reutilização da chave.

**Smoke do portal:** os gráficos deixaram de usar Recharts e a Visão geral passou à v3. As verificações foram migradas, não removidas: seleção da cultura (`aria-pressed` e destaque), fixação de situação no anel (`data-dim`, descrição com percentual), prioridade do herói (`data-attention`, inativo quando "Tudo em dia"), categoria única, espaço herói → indicadores de 12–24 px e clima por temperatura/cidade. A asserção de LEITOR (403) foi mantida. O relatório de falha agora inclui a linha do roteiro. As evidências em `docs/design/portal/evidencias/` foram regeneradas.

Capturas em `operacoes/`: fluxos (formulários, antes/depois, 409), `leitor-*`, `aba-*-1440` (15 abas), `*-390`, `*-320`, `*-320-texto-200` e `sidebar-pagina-inteira-1440`.

## Limitações

- Não há recebimento parcial: o backend exige recebimento integral.
- Município e UF são digitados a cada operação; nada é preenchido por suposição.
- O axe roda nas telas do smoke do produtor. As telas novas foram verificadas por rótulos explícitos, teclado e alvos ≥ 44 px, sem auditoria axe própria.
- Com texto 200% a 320 px, as quantidades das listas ficam grandes, mas sem rolagem horizontal.

---

# Incremento 3 — rastreabilidade visual para cooperativas e instituições

12/11/2026. Backend não alterado.

## O que foi feito

- **Mesma experiência do produtor:** `TraceGraph` (nós, conectores, seleção por teclado, painel de detalhes, animações `trace-enter`/`trace-line` e movimento reduzido) foi exportado de `trace-page.tsx` e é usado pela nova `organization-trace.tsx`. Não existe uma segunda visualização paralela.
- **Rotas:** `/remessas/[id]` (cooperativa) e `/solicitacoes/[id]` (instituição). As listas continuam iguais; cada linha (e cada prioridade da Visão geral) abre a trajetória ("Ver trajetória"). Os botões de ação seguem separados do link.
- **Dados:**
  - a operação vem da home autorizada (mesma projeção validada das listas);
  - os eventos vêm de `GET /lots/:id/events`, que a API já restringe aos pedidos da organização;
  - o cliente filtra mais uma vez por lote e pedido.
- **Fluxo:** origem → oferta → solicitação → aceite → retirada → recebimento, com a etapa atual destacada, data/hora de cada evento e vínculo com pedido e lote.
- **Etapa não compartilhada:** a API não envia o evento "Oferta publicada" a quem não é dono do lote. Esse nó aparece como concluído e tracejado, com "Data não compartilhada" e explicação no painel; nada é estimado. O comportamento do produtor não muda (`fillWithheld` só para coop/inst).
- **Solicitação sem aceite:** a API devolve 404 no lote para a instituição. A tela mostra só a data da solicitação (da home) e um aviso.
- **Dados de terceiros:** a organização responsável aparece como "Outro participante da operação" em vez do UUID, também na visão do produtor.
- **Proxy:** somente `GET /lots/:uuid/events` foi acrescentado para coop/inst. `GET /lots/:id` e qualquer escrita continuam bloqueados.

## Validação

- `npm test`: **68/68** (etapa não compartilhada, cancelamento, proxy e permissões de página).
- Smoke do produtor: aprovado (sem regressões na rastreabilidade original).
- E2E em banco descartável: **11/11**. A nova etapa cobre:
  - cooperativa e instituição abrem a trajetória a partir da lista;
  - 6 etapas na ordem, recebimento como etapa atual, oferta tracejada e local nos detalhes;
  - nenhum UUID de outra organização na página;
  - animação `trace-enter`, e desligada com movimento reduzido;
  - sem rolagem horizontal em 390 e 320 px;
  - solicitação aguardando aceite;
  - outra cooperativa recebe "indisponível" na página e 404 no proxy;
  - a instituição não abre a rota da cooperativa.
- Capturas: `operacoes/coopEditor-trajetoria-{1440,390,320}.png`, `operacoes/instEditor-trajetoria-*.png` e `operacoes/instituicao-trajetoria-aguardando-aceite.png`.

## Contrato sugerido ao backend (para o Codex)

O frontend funciona com o contrato atual. Três lacunas impedem a trajetória completa:

1. **Evento "Oferta publicada" para participantes.** Em `lotView` (`services/api/src/commerce.mjs`), para quem não é dono, incluir também o evento `OFERTA_PUBLICADA` cujo `operationId` seja o `offerId` de um pedido da organização, com a mesma projeção restrita (`id, lotId, orderId: null, type, recordedAt, occurredAt, location{municipality,uf}, quantityGrams, isDemonstration`) e `operationId` na projeção. O nó tracejado passa a ter data automaticamente.
2. **Instituição antes do aceite.** Hoje `if (!owner && !orders.some(o => o.shipment)) missing()` nega o lote ao solicitante sem remessa. Proposta: aceitar quem é `requesterOrganizationId` de algum pedido do lote (`orders.length > 0`), mantendo a cooperativa condicionada à remessa designada. Assim a instituição vê origem e solicitação com local, em vez da data da home.
3. **Identificação legível.** A home não traz a cultura, então o resumo mostra só quantidade, pedido e lote. Proposta: incluir `cropName` em `homeOperation` (a oferta já guarda `cropName`; usar `$lookup` em `offers` por `offerId`). Não expõe dados de participantes.

Opcional: `GET /orders/:id/trace` com pedido e eventos já filtrados por participação. Evitaria varrer as páginas da home para localizar o pedido; hoje o limite é de 1.100 operações por organização.

## Limitações

- O resumo não mostra a cultura (contrato 3).
- Na solicitação sem aceite, a data exibida é a de criação do pedido, e o local aparece como "Não informado no evento".
- A trajetória é localizada varrendo até 11 páginas de 100 operações da home.
