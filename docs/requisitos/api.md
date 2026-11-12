# Contratos REST v1

Base local: `http://127.0.0.1:3000/api/v1`. JSON UTF-8. UUID para IDs; quantidade em kg com até três casas; horários em UTC. O cliente nunca define responsável ou organização proprietária no corpo.

## Endpoints implementados

Minha Fazenda: GET `/properties/:id/farm-layout`, PUT `/properties/:id/farm-layout` e GET `/properties/:id/farm-overview`. Configuração ilustrativa persistente, controle otimista de versão e dados operacionais por propriedade. Consulte [contratos, exemplos e autorização](../arquitetura/minha-fazenda-backend.md).

| Método e caminho                   | Permissão / resultado                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| GET /health (fora da base /api/v1) | Público, ping real no banco, 200 ou erro 500                                                                         |
| GET /me                            | Bearer demo válido; vínculos ativos com organizações ativas                                                          |
| GET /catalog                       | Vínculo ativo e X-Organization-Id; propriedades próprias e culturas ativas                                           |
| POST /productions                  | Pequeno produtor rural ADMIN/EDITOR; 201 com produção, lote e evento; header Location                                |
| GET /productions?limit=50&offset=0 | Vínculo ativo; apenas produção própria, ordem decrescente; limit 1–100 e offset 0–100000                             |
| GET /productions/indicators        | Total de registros e contagem/volume por cultura na organização inteira, não só página                               |
| GET /productions/:id               | Vínculo na proprietária; 200 ou 404 sem revelar registro alheio                                                      |
| GET /lots/:id                      | Proprietário ou participante autorizado de remessa; lote e eventos paginados, com projeção externa restrita; sem GPS |

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

`GET /catalog` inclui município/UF nas propriedades autorizadas, sem alterar id/name existentes. O endpoint meteorológico mantém a autorização pela organização. Consulte o contrato OpenWeather atualizado ao final deste documento.

## Comércio e logística implementados — segundo incremento

Todos os POST desta seção exigem `Idempotency-Key` (8–128 caracteres alfanuméricos, `_` ou `-`) e ADMIN/EDITOR. Cada comando comercial grava saldo/estado/evento/resultado idempotente em transação real, com snapshot e majority. Reutilização da mesma chave no mesmo usuário/organização/método/caminho com corpo diferente retorna 409. Repetição idêntica retorna o resultado original, com `Idempotency-Replayed: true`, mesmo que o recurso tenha evoluído. Use GET para o estado atual.

`local` nas entradas abaixo significa os campos `location: { municipality, uf }` e `locationConfirmed: true`. O horário da operação é do servidor; timestamps arbitrários do cliente não são aceitos. Retirada/recebimento são confirmações do participante, sem comprovação GPS.

| Método e caminho             | Entrada e regra                                                                                                                                                                                           | Saída                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| POST /offers                 | lotId, quantityKg, availableUntil (ISO UTC futuro), destinationMode VENDA/DOACAO, unitPriceCents (obrigatório na venda, zero/omitido na doação); pequeno produtor rural proprietário; uma oferta por lote | 201 RASCUNHO                                                          |
| POST /offers/:id/publish     | Proprietário; local confirmado; rascunho dentro da validade                                                                                                                                               | 200 PUBLICADA                                                         |
| GET /offers                  | Paginação; quatro públicos; somente publicadas vigentes com saldo. `scope=mine` inclui rascunhos da própria organização                                                                                   | 200 projeção comercial, sem propriedade, usuário ou histórico privado |
| GET /cooperatives            | Vínculo ativo; catálogo de cooperativas ativas, até 100                                                                                                                                                   | 200 apenas id e nome                                                  |
| POST /orders                 | offerId, quantityKg, local; instituição/comprador local; oferta vigente; não reserva antes do aceite                                                                                                      | 201 SOLICITADO                                                        |
| GET /orders                  | Contexto da organização; apenas pedidos dos participantes                                                                                                                                                 | 200 lista paginada                                                    |
| POST /orders/:id/accept      | Ofertante; local; cooperativeOrganizationId opcional/null designa cooperativa ativa. Reserva atômica                                                                                                      | 200 ACEITO com shipment PLANEJADA ou 409                              |
| POST /orders/:id/cancel      | Ofertante ou solicitante; local; apenas SOLICITADO/ACEITO                                                                                                                                                 | 200 CANCELADO; libera reserva se havia aceite, uma vez                |
| POST /shipments/:id/pickup   | Ofertante ou cooperativa designada; local; pedido ACEITO                                                                                                                                                  | 200 pedido RETIRADO, remessa RETIRADA e evento                        |
| POST /shipments/:id/receipts | Somente destinatário; quantityAcceptedKg exatamente igual ao pedido, local; retirada prévia                                                                                                               | 201 pedido RECEBIDO, remessa RECEBIDA, confirmação e evento           |
| GET /lots/:id/events         | Proprietário: todos; participante de remessa: origem e eventos de suas operações; paginação                                                                                                               | 200 eventos cronológicos e pagination                                 |

Não há POST /shipments separado: o aceite cria uma remessa por pedido atomicamente. GET /lots/:id também foi ampliado: proprietário mantém seus metadados; participante externo recebe somente id/eventos autorizados. Ambos são paginados (limit padrão 50, máximo 100). A origem embutida é o primeiro evento, seguida dos eventos novos. Pedidos ainda não aceitos não concedem acesso à origem. O ofertante vê as solicitações do próprio lote; um destinatário não vê pedidos de outra organização. Dados pessoais `createdBy`/`receivedBy` são omitidos da projeção de pedido.

Pendentes: QR Code, fechamento/cancelamento de oferta, republicação, múltiplas ofertas por lote, recebimento parcial/divergências, múltiplas remessas por pedido. Não existe endpoint genérico de inserção/edição/exclusão de eventos.

## Erros

Formato atual: `{ "error": { "code": "INVALID_INPUT", "message": "Descrição compreensível" } }`.

400 entrada/referência/paginação/JSON/chave inválidos; 401 identidade ausente, inválida ou expirada; 403 vínculo/papel/tipo não permitido; 404 recurso não acessível; 409 conflito de saldo, estado ou idempotência; 413 corpo grande; 500 falha interna sem stack/URI; 503 identidade não configurada ou TRANSACTIONS_REQUIRED em MongoDB standalone. Não há fallback para falsa atomicidade.

Sem autenticação demo habilitada, a API protegida falha fechada com 503. Cadastro de usuários e login de produção não são endpoints desta entrega.

## OpenWeather — contrato atualizado

`GET /api/v1/properties/:id/weather` conserva autenticação/autorização por organização. Resposta direta, sem envelope data:

- Indisponível: `{status: "unavailable", reason, message: "Clima indisponível"}`.
- Disponível: `{status: "available", source: "OpenWeather", attributionUrl: "https://openweathermap.org/", temperatureC, humidityPercent, description, observedAt, fetchedAt, cached, locality: {municipality, uf, source, precision, approximate}, limitation}`.

Datas ISO UTC, temperatura °C, umidade relativa do ar em %. `precision`: property ou municipality; município geocodificado sempre aproximado. Chave e coordenadas não são retornadas. Não há previsão de chuva.

Razões: NOT_CONFIGURED, PROPERTY_LOCALITY_REQUIRED, INVALID_PROPERTY_COORDINATES, AMBIGUOUS_LOCALITY, LOCALITY_NOT_FOUND, INVALID_GEOCODING_RESPONSE, INVALID_OBSERVATION, TIMEOUT, RATE_LIMITED, PROVIDER_UNAVAILABLE. Falhas climáticas retornam HTTP 200 indisponível; autorização conserva 401/403/404. Esta seção substitui a descrição anterior sobre uso exclusivo de coordenadas cadastradas. [Detalhes](../evidencias/openweather/relatorio.md).

## Indicador de destinação dos excedentes — schemaVersion 1

`GET /api/v1/properties/:id/excess-impact` (caminho relativo à base: `/properties/:id/excess-impact`). Somente leitura, sem corpo e sem paginação. Exige os headers protegidos, vínculo ativo em organização `PEQUENO_PRODUTOR_RURAL`, papel `ADMIN`, `EDITOR` ou `LEITOR` e propriedade ativa dessa organização. `Cache-Control: no-store`, inclusive nos erros.

Exemplo inteiramente fictício:

```json
{
  "data": {
    "schemaVersion": 1,
    "propertyId": "10000000-0000-4000-8000-000000000001",
    "isDemonstration": true,
    "asOf": "2026-11-11T15:00:00.000Z",
    "funnelKg": {
      "registered": 20,
      "published": 10,
      "acceptedNet": 6,
      "pickedUp": 4,
      "received": 3
    },
    "balancesKg": {
      "availableActive": 3,
      "reservedNow": 2,
      "inTransitNow": 1,
      "expiredAvailable": 1
    },
    "byModeKg": {
      "VENDA": { "published": 6, "received": 1 },
      "DOACAO": { "published": 4, "received": 2 }
    }
  }
}
```

Contrato:

- `schemaVersion`: inteiro fixo 1; `propertyId`: UUID consultado; `isDemonstration`: contexto autenticado existente (atualmente true); `asOf`: instante UTC capturado no início do cálculo e usado para classificar prazos.
- `funnelKg.registered`: toda a produção registrada na propriedade, inclusive sem oferta ou com rascunho. Cada quantidade persistida em kg é arredondada para gramas inteiras antes da soma.
- `published`: quantidade inicial das ofertas `PUBLICADA`, inclusive vencidas. Rascunhos não contribuem para nenhum indicador de oferta.
- `acceptedNet`: `reservedGrams + dispatchedGrams + receivedGrams`; cancelamentos deixam de contribuir porque o domínio existente devolve a reserva ao saldo disponível. Solicitação sem aceite não contribui.
- `pickedUp`: `dispatchedGrams + receivedGrams`, acumulado de retiradas; não significa recebimento.
- `received`: somente `receivedGrams`, recebimento integral efetivamente confirmado pelo destinatário.
- `availableActive`: `availableGrams` com `availableUntil > asOf`; `expiredAvailable`: somente `availableGrams` com `availableUntil <= asOf`. A igualdade já é indisponível segundo a regra comercial existente. Prazo vencido não retira reservas, trânsito ou recebimentos do funil.
- `reservedNow` e `inTransitNow`: saldos atuais reservado e despachado. `byModeKg` contém `published` e `received` por `VENDA` e `DOACAO`, sempre com ambas as chaves.

Sem dados, todos os indicadores são zero. Não há filtro temporal, paginação parcial, valores financeiros, estimativas de pessoas beneficiadas ou desperdício comprovado. O funil não deve ser somado: seus estágios se sobrepõem. Produção registrada não é sinônimo de excedente e saldo vencido não é prova de perda.

Reconciliação obrigatória das ofertas publicadas, em gramas antes da serialização:

`published = availableActive + expiredAvailable + reservedNow + inTransitNow + received`

A consulta usa uma agregação MongoDB com leitura snapshot (replica set existente), filtrando a produção por organização/propriedade e consultando ofertas pelo índice único `lotId`, também restritas ao vendedor. Não consulta pedidos/eventos, não carrega coleções na aplicação nem executa escritas. Cada lote/oferta contribui uma única vez. Valores são inteiros em gramas durante a agregação; kg numéricos aparecem apenas na resposta. Clientes que verificarem igualdades devem reconverter kg para gramas com arredondamento, evitando erros binários de ponto flutuante.

Erros seguem `{ "error": { "code", "message" } }`: 400 `INVALID_INPUT` para UUID inválido; 401 `UNAUTHORIZED`; 403 `FORBIDDEN` para vínculo/perfil não autorizado; 404 `NOT_FOUND` para propriedade inexistente, inativa ou alheia; 500 `INTERNAL_ERROR` para falha de consulta, saldos sem reconciliação ou totais além do limite inteiro seguro. Não há correção automática de dados. Mantém-se o 503 `AUTH_NOT_CONFIGURED` global quando a identidade não está configurada.

## Homes de cooperativa e instituição — schemaVersion 1

`GET /cooperative-home` e `GET /institution-home` são leituras autenticadas com
`X-Organization-Id`. Exigem respectivamente COOPERATIVA e INSTITUICAO, vínculo e
organização ativos, e ADMIN, EDITOR ou LEITOR. Outros tipos recebem 403.
Reutilizam authenticate/authorizeOrganization; Cache-Control: no-store.

Ambos aceitam `limit` (1–100, padrão 50) e `offset` (0–100000, padrão 0),
com a validação comercial existente (400 INVALID_INPUT). Não recebem IDs de
organizações no corpo. Erros de autenticação preservam 401; falhas de consulta
retornam 500 INTERNAL_ERROR sanitizado, nunca indicadores zerados.

Resposta (exemplo fictício de instituição sem pedidos):

```json
{
  "data": {
    "schemaVersion": 1,
    "organizationId": "10000000-0000-4000-8000-000000000001",
    "organizationType": "INSTITUICAO",
    "fetchedAt": "2026-11-12T15:00:00.000Z",
    "isDemonstration": true,
    "canWrite": false,
    "total": 0,
    "byStatus": {
      "SOLICITADO": { "count": 0, "quantityKg": 0 },
      "ACEITO": { "count": 0, "quantityKg": 0 },
      "RETIRADO": { "count": 0, "quantityKg": 0 },
      "RECEBIDO": { "count": 0, "quantityKg": 0 },
      "CANCELADO": { "count": 0, "quantityKg": 0 }
    },
    "pending": [],
    "operations": []
  },
  "pagination": { "limit": 50, "offset": 0, "total": 0 }
}
```

- `total`/`pagination.total`: todos os pedidos do escopo, inclusive cancelados;
  na cooperativa, corresponde a pedidos com remessa designada (uma por pedido).
- `byStatus`: contagem e soma das quantidades dos pedidos de cada estado atual,
  em kg. Não somar esses valores como etapas acumuladas ou impacto real.
- Cooperativa: escopo exclusivo `shipment.carrierOrganizationId`; ACEITO significa
  retirada pendente, RETIRADO aguarda destinatário, RECEBIDO concluído.
- Instituição: escopo exclusivo `requesterOrganizationId`; SOLICITADO aguarda
  aceite, ACEITO aguarda retirada, RETIRADO aguarda confirmação e RECEBIDO concluído.
- `operations`: página de pedidos, mais novos primeiro (`createdAt`, desempate por
  ID decrescente). `pending`: até três, independente da página, mais antigos primeiro
  dentro da prioridade; cooperativa ACEITO → RETIRADO; instituição RETIRADO → ACEITO
  → SOLICITADO. Inclui ações e acompanhamentos, sem inventar prazos ou urgência.
- Cada operação contém somente `id`, `lotId`, `offerId`, `status`, `quantityKg`,
  `createdAt` e `shipment` nulo ou `{id, status}`. Sem usuário, endereço, token,
  dados de recebimento ou identificação de outros participantes.
- `canWrite` informa ADMIN/EDITOR, não autoriza todas as ações: endpoints existentes
  continuam verificando tipo, participação e estado. LEITOR nunca altera.
- `fetchedAt`: início da consulta UTC, não consulta histórica; uma agregação snapshot
  mantém contagens, página e prioridades coerentes dentro da resposta. Requer replica set.

Não foram adicionadas mutações: instituição solicita por `POST /orders`, cancela
pelos endpoints existentes e recebe por `POST /shipments/:id/receipts`;
cooperativa designada retira por `POST /shipments/:id/pickup`.
`GET /offers` permanece inalterado, inclusive VENDA/DOACAO para instituições;
filtros adicionais de modalidade/cultura/território não foram implementados.
[Arquitetura, permissões e validação](../arquitetura/publicos-cooperativas-instituicoes.md).
