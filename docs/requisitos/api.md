# Contratos REST v1

Base local: `http://127.0.0.1:3000/api/v1`. JSON UTF-8. UUID para IDs; quantidade em kg com até três casas; horários em UTC. O cliente nunca define responsável ou organização proprietária no corpo.

## Endpoints implementados

| Método e caminho | Permissão / resultado |
|---|---|
| GET /health (fora da base /api/v1) | Público, ping real no banco, 200 ou erro 500 |
| GET /me | Bearer demo válido; vínculos ativos com organizações ativas |
| GET /catalog | Vínculo ativo e X-Organization-Id; propriedades próprias e culturas ativas |
| POST /productions | Pequeno produtor rural ADMIN/EDITOR; 201 com produção, lote e evento; header Location |
| GET /productions?limit=50&offset=0 | Vínculo ativo; apenas produção própria, ordem decrescente; limit 1–100 e offset 0–100000 |
| GET /productions/indicators | Total de registros e contagem/volume por cultura na organização inteira, não só página |
| GET /productions/:id | Vínculo na proprietária; 200 ou 404 sem revelar registro alheio |
| GET /lots/:id | Proprietário ou participante autorizado de remessa; lote e eventos paginados, com projeção externa restrita; sem GPS |

Headers protegidos: `Authorization: Bearer <token-local>`; `X-Organization-Id: <uuid-do-vínculo>`, exceto /me, que não exige organização selecionada. `Content-Type: application/json` em POST; corpo máximo 16kb. Respostas protegidas têm Cache-Control: no-store. Tokens não pertencem ao código nem a exemplos públicos.

### POST /productions

```json
{
  "propertyId": "UUID de propriedade retornada por /catalog",
  "cropId": "UUID de cultura retornada por /catalog",
  "seasonLabel": "2026/2",
  "quantityKg": 12.5,
  "harvestedOn": "2026-11-05",
  "location": { "municipality": "São Paulo", "uf": "SP" },
  "locationConfirmed": true
}
```

As descrições em `propertyId` e `cropId` são marcadores: substitua por UUIDs do seu catálogo. Safra: 1–60 caracteres; município: 1–120; massa >0 e <=1e9; data válida não futura; UF brasileira e confirmação explícita. Campos adicionais são recusados. Propriedade de outra organização e cultura inativa são recusadas. Não envia URL de QR Code nesta versão.

Resposta: `{ "data": { "id", "organizationId", "createdBy", "propertyId", "cropId", "cropName", "seasonLabel", "quantityKg", "harvestedOn", "location", "status", "createdAt", "isDemonstration", "lot": { "id", "productionId", "ownerOrganizationId", "initialQuantityKg", "status", "events": [...] } } }` (notação de campos, não JSON literal).

Listagem: `{ data: [...], pagination: { total, limit, offset } }`. Indicadores: `{ total, distribution: [{ cropId, cropName, count, quantityKg }] }`. Campos de evento estão definidos no modelo de dados.

## Home Flutter — extensões de leitura

`GET /producer-home?propertyId=<UUID>` exige organização de pequeno produtor rural e propriedade ativa dessa organização. Retorna `property`, `hasProductions`, `pending` (até duas, SOLICITADO antes de ACEITO antes de RETIRADO), `recentLots` (até dois por última movimentação), `canWrite`, `isDemonstration`, `fetchedAt`. Não retorna agregados analíticos nem agenda de coleta. Propriedade alheia retorna 404.

`GET /catalog` inclui município/UF nas propriedades autorizadas, sem alterar id/name existentes. `GET /properties/:id/weather` verifica a mesma propriedade e retorna `{status:'unavailable',reason,message}` ou observação com fonte, atribuição, horário, temperatura e umidade do ar. Apenas coordenadas cadastradas no backend são usadas. Chave, URL autenticada e erros do provedor não são retornados. Falha climática não fabrica dados nem impede o uso da home. Sem configuração válida: indisponível. Cadastro/verificação de coordenadas e credenciais permanecem pendentes.

## Comércio e logística implementados — segundo incremento

Todos os POST desta seção exigem `Idempotency-Key` (8–128 caracteres alfanuméricos, `_` ou `-`) e ADMIN/EDITOR. Cada comando comercial grava saldo/estado/evento/resultado idempotente em transação real, com snapshot e majority. Reutilização da mesma chave no mesmo usuário/organização/método/caminho com corpo diferente retorna 409. Repetição idêntica retorna o resultado original, com `Idempotency-Replayed: true`, mesmo que o recurso tenha evoluído. Use GET para o estado atual.

`local` nas entradas abaixo significa os campos `location: { municipality, uf }` e `locationConfirmed: true`. O horário da operação é do servidor; timestamps arbitrários do cliente não são aceitos. Retirada/recebimento são confirmações do participante, sem comprovação GPS.

| Método e caminho | Entrada e regra | Saída |
|---|---|---|
| POST /offers | lotId, quantityKg, availableUntil (ISO UTC futuro), destinationMode VENDA/DOACAO, unitPriceCents (obrigatório na venda, zero/omitido na doação); pequeno produtor rural proprietário; uma oferta por lote | 201 RASCUNHO |
| POST /offers/:id/publish | Proprietário; local confirmado; rascunho dentro da validade | 200 PUBLICADA |
| GET /offers | Paginação; quatro públicos; somente publicadas vigentes com saldo. `scope=mine` inclui rascunhos da própria organização | 200 projeção comercial, sem propriedade, usuário ou histórico privado |
| GET /cooperatives | Vínculo ativo; catálogo de cooperativas ativas, até 100 | 200 apenas id e nome |
| POST /orders | offerId, quantityKg, local; instituição/comprador local; oferta vigente; não reserva antes do aceite | 201 SOLICITADO |
| GET /orders | Contexto da organização; apenas pedidos dos participantes | 200 lista paginada |
| POST /orders/:id/accept | Ofertante; local; cooperativeOrganizationId opcional/null designa cooperativa ativa. Reserva atômica | 200 ACEITO com shipment PLANEJADA ou 409 |
| POST /orders/:id/cancel | Ofertante ou solicitante; local; apenas SOLICITADO/ACEITO | 200 CANCELADO; libera reserva se havia aceite, uma vez |
| POST /shipments/:id/pickup | Ofertante ou cooperativa designada; local; pedido ACEITO | 200 pedido RETIRADO, remessa RETIRADA e evento |
| POST /shipments/:id/receipts | Somente destinatário; quantityAcceptedKg exatamente igual ao pedido, local; retirada prévia | 201 pedido RECEBIDO, remessa RECEBIDA, confirmação e evento |
| GET /lots/:id/events | Proprietário: todos; participante de remessa: origem e eventos de suas operações; paginação | 200 eventos cronológicos e pagination |

Não há POST /shipments separado: o aceite cria uma remessa por pedido atomicamente. GET /lots/:id também foi ampliado: proprietário mantém seus metadados; participante externo recebe somente id/eventos autorizados. Ambos são paginados (limit padrão 50, máximo 100). A origem embutida é o primeiro evento, seguida dos eventos novos. Pedidos ainda não aceitos não concedem acesso à origem. O ofertante vê as solicitações do próprio lote; um destinatário não vê pedidos de outra organização. Dados pessoais `createdBy`/`receivedBy` são omitidos da projeção de pedido.

Pendentes: QR Code, fechamento/cancelamento de oferta, republicação, múltiplas ofertas por lote, recebimento parcial/divergências, múltiplas remessas por pedido. Não existe endpoint genérico de inserção/edição/exclusão de eventos.

## Erros

Formato atual: `{ "error": { "code": "INVALID_INPUT", "message": "Descrição compreensível" } }`.

400 entrada/referência/paginação/JSON/chave inválidos; 401 identidade ausente, inválida ou expirada; 403 vínculo/papel/tipo não permitido; 404 recurso não acessível; 409 conflito de saldo, estado ou idempotência; 413 corpo grande; 500 falha interna sem stack/URI; 503 identidade não configurada ou TRANSACTIONS_REQUIRED em MongoDB standalone. Não há fallback para falsa atomicidade.

Sem autenticação demo habilitada, a API protegida falha fechada com 503. Cadastro de usuários e login de produção não são endpoints desta entrega.
