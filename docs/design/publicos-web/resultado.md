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
