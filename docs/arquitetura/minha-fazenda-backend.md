# Minha Fazenda — backend 01

Implementado em 10/11/2026, na branch `feat/web-minha-fazenda`, criada da `main`. Incremento exclusivo da API existente, sem frontend, QR Code, Java, Flutter, commit ou push.

## Objetivo e diagnóstico

O Agro+ Brasil passa a oferecer uma configuração ilustrativa persistente por propriedade, suficiente para o frontend construir uma fazenda individual e interativa. Os três pilares aparecem no contrato: produções e origens ligam a representação à rastreabilidade; ofertas, estados de pedidos e remessas conectam comércio e logística; culturas, safras e quantidades registradas apoiam a gestão.

A API existente é Express 5 com driver oficial MongoDB, sem ORM. A autenticação atual é exclusivamente de demonstração local: Bearer opaco com hash persistido, validade e usuário ativo. `X-Organization-Id` seleciona vínculo ativo em organização ativa. Essa autenticação foi reutilizada; identidade de produção continua pendente no projeto.

`properties` pertence a uma organização; `crops` é catálogo global ativo. `productions` guarda propriedade, cultura, safra, quantidade e um lote com origem embutida, atomicamente. Cada lote admite uma oferta em `offers`; `orders` contém pedido e eventual remessa embutida; `traceEvents` contém os eventos posteriores à origem. Comércio usa transações reais e idempotência. O portal Next.js consome essa mesma API por proxy e possui tipos de produção/lote/pedido; nenhum arquivo do portal foi alterado.

Foram reutilizados `ownedProperty`, `propertyView`, UUIDs, paginação, erros, autenticação, autorização e `canWriteProduction`. O router novo é montado depois da autorização da API v1. Não há backend paralelo nem mudança de regra comercial.

## Persistência e elementos

Coleção nova: `farmLayouts`. Um documento por propriedade; `_id` é o UUID da propriedade, aproveitando o índice único nativo do MongoDB. Campos persistidos:

| Campo | Significado |
|---|---|
| `_id`, `propertyId` | UUID da propriedade autorizada |
| `organizationId` | Organização proprietária, definida no servidor |
| `schemaVersion` | Versão estrutural, atualmente 1 |
| `version` | Versão de concorrência, começa em 1 após a primeira gravação |
| `elements` | Lista completa de elementos configurados pelo produtor |
| `updatedAt`, `updatedBy` | Horário ISO UTC e usuário, definidos no servidor; usuário não exposto na resposta |

Cada elemento tem `id` (UUID estável criado pelo cliente), `name` (1–80 caracteres após trim), `type`, `position: {x,y}`, `productionIds` e `cropIds` (listas obrigatórias, podem estar vazias). Os IDs são únicos dentro do layout e as referências não podem se repetir dentro de uma lista. O frontend preserva o mesmo UUID ao renomear ou mover um elemento. O vínculo à propriedade é herdado do documento pai e da rota; não é um campo editável no elemento.

Tipos aceitos: `CULTIVATION` (área de cultivo), `VEGETABLE_GARDEN` (horta), `ORCHARD` (pomar), `STORAGE` (armazenamento), `COLLECTION` (coleta/expedição), `OTHER` (outra estrutura cadastrada). Não são criados automaticamente a partir de culturas, produções ou do tipo da organização.

Posições são números finitos entre 0 e 1, relativos à tela, sem latitude, longitude, medidas ou área física. `spatialReference: ILLUSTRATIVE_NORMALIZED` e `isGeoreferenced: false` são devolvidos pelo servidor. A interface precisa manter visível **“Organização espacial ilustrativa, não georreferenciada”**. O cadastro de um galpão é uma informação do produtor; o backend não comprova sua existência física. Dimensões de sprites são uma escolha gráfica, sem unidade física.

Até 20 elementos por propriedade e até 10 produções e 10 culturas por elemento. Corpo HTTP máximo de 16 KiB, inclusive para PUT; o limite de bytes pode ser atingido antes dos limites de listas. Não existem campos de metadados livres, indicadores persistidos, moedas ou recompensas. O documento foi mantido pequeno para permitir substituição atômica.

Todas as produções referenciadas devem pertencer à propriedade e organização da rota. Culturas devem existir e estar ativas no catálogo. Se o elemento informa culturas e produções, as culturas das produções precisam estar na lista do elemento. Uma lista de culturas vazia permite vincular produções de múltiplas culturas. Cultura sem produção é permitida e não cria produção nem lote.

Um lote pode aparecer em vários elementos (ex.: horta, galpão e coleta). Isso são diferentes acessos ao mesmo registro, sem duplicação de volume. Não some os indicadores dos elementos para obter totais da propriedade. O vínculo ao galpão não constitui uma movimentação física ou um saldo de estoque naquele edifício.

## Endpoints e autorização

Base `/api/v1`. Headers: `Authorization: Bearer <token>`, `X-Organization-Id: <uuid>`, `Content-Type: application/json` em PUT. Respostas protegidas usam `Cache-Control: no-store`.

| Método / rota | Contrato e permissão |
|---|---|
| GET `/properties/:id/farm-layout` | Vínculo ativo na organização proprietária e propriedade ativa; inclui LEITOR |
| PUT `/properties/:id/farm-layout` | Propriedade ativa própria, organização PEQUENO_PRODUTOR_RURAL, ADMIN ou EDITOR |
| GET `/properties/:id/farm-overview?limit=50&offset=0` | Mesma autorização de leitura; limit 1–100, offset 0–100000 |

GETs seguem a autorização de leitura de propriedades já existente. Organizações de outros tipos não recebem autorização de edição. `canEdit` e `canEditLayout` refletem exatamente a regra do PUT. Todas as referências de produções são novamente filtradas por propriedade e organização durante a leitura operacional.

### Consultar layout sem configuração

GET retorna HTTP 200 sem criar documento:

```json
{
  "data": {
    "propertyId": "11111111-1111-4111-8111-111111111111",
    "schemaVersion": 1,
    "version": 0,
    "state": "UNCONFIGURED",
    "spatialReference": "ILLUSTRATIVE_NORMALIZED",
    "isGeoreferenced": false,
    "elements": [],
    "updatedAt": null,
    "canEdit": true
  }
}
```

`UNCONFIGURED` significa ausência de documento. `EMPTY` significa configuração salva com lista vazia. `CONFIGURED` significa ao menos um elemento. Uma propriedade pode ter produções reais e ainda estar `UNCONFIGURED`; o frontend deve oferecer configuração inicial, sem desenhar estruturas como se fossem do produtor.

### Criar e consultar setores

Os UUIDs abaixo são exemplos sintáticos. Substitua propriedade e cultura por IDs de `/catalog`, e produção por registro real de `/productions` cuja `propertyId` corresponda à propriedade selecionada. Os dois IDs de elementos são criados pelo frontend.

PUT `/properties/11111111-1111-4111-8111-111111111111/farm-layout`:

```json
{
  "version": 0,
  "elements": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Horta Norte",
      "type": "VEGETABLE_GARDEN",
      "position": { "x": 0.2, "y": 0.4 },
      "productionIds": ["33333333-3333-4333-8333-333333333333"],
      "cropIds": ["44444444-4444-4444-8444-444444444444"]
    },
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "name": "Galpão Principal",
      "type": "STORAGE",
      "position": { "x": 0.8, "y": 0.6 },
      "productionIds": ["33333333-3333-4333-8333-333333333333"],
      "cropIds": []
    }
  ]
}
```

HTTP 200 em criação e atualização, com o mesmo envelope do GET: `data.version: 1`, `data.state: CONFIGURED`, `data.elements` contendo os elementos validados, `updatedAt` do servidor e os demais campos de layout. Consulte com GET na mesma rota para recuperar as posições salvas. Nome da propriedade vem do cadastro; o nome do setor vem dessa configuração.

Para mover Horta Norte, envie **todos** os elementos com `version: 1` e a posição alterada, preservando IDs. A resposta terá `version: 2`. PUT substitui a lista completa: omitir um elemento o remove somente da representação; `elements: []` remove todos da representação, preservando produções, lotes, ofertas e pedidos.

### Concorrência e falhas

`version` do corpo é a versão lida pelo cliente, não a versão pretendida. Na criação (`0`), insert único de `_id` garante um vencedor. Nas atualizações, `updateOne` exige `_id`, organização, propriedade e versão esperada, sem upsert. A troca dos elementos e incremento da versão ocorrem na mesma gravação atômica. Ambos os caminhos exigem `writeConcern: {w: 'majority', j: true}`: sucesso só é retornado após confirmação do journal. Este fluxo funciona também em MongoDB standalone com WiredTiger.

Se outro editor salvou antes, retorna HTTP 409 `LAYOUT_VERSION_CONFLICT`. O cliente deve recarregar e apresentar a divergência para reconciliação; não deve sobrescrever automaticamente com a versão nova. Não há idempotency key nesse PUT: se a resposta se perder, consulte o layout para verificar se a alteração foi aplicada. Falhas do MongoDB não viram sucesso ou lista vazia; são HTTP 500 sanitizado. A falha de validação do banco foi testada preservando byte a byte os campos do documento anterior. Em falha de rede após confirmação da gravação, o estado é incerto para o cliente e requer GET.

## Overview e interações

GET `farm-overview` retorna `{ "data": { ... } }` com:

| Campo | Conteúdo |
|---|---|
| `property` | `{id,name,municipality,uf}` da propriedade autorizada |
| `layoutVersion`, `layoutState` | Versão e estado usados na leitura dos setores |
| `isGeoreferenced` | Sempre false |
| `summary` | `productionCount`, `registeredQuantityKg` e `crops: [{cropId,name,productionCount,registeredQuantityKg}]` da propriedade inteira; no máximo 100 culturas, com `cropsTruncated` explícito |
| `productions` | Página de produções reais da propriedade, ordenada por createdAt e UUID decrescentes |
| `pagination` | `{limit,offset,total}`; total de produções da propriedade |
| `elements` | Estados e operações dos setores, identificados pelo mesmo UUID do layout |
| `canEditLayout`, `isDemonstration`, `fetchedAt` | Permissão de editar, origem demonstrativa e horário de leitura |

Cada item de `productions`, inclusive dentro dos elementos, tem:

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "cropId": "44444444-4444-4444-8444-444444444444",
  "cropName": "Alface",
  "seasonLabel": "2026/2",
  "harvestedOn": "2026-11-01",
  "registeredQuantityKg": 10,
  "lot": {
    "id": "66666666-6666-4666-8666-666666666666",
    "status": "IDENTIFICADO",
    "recentEvents": [{ "id": "77777777-7777-4777-8777-777777777777", "type": "ORIGEM_REGISTRADA", "recordedAt": "2026-11-01T12:00:00.000Z", "orderId": null }]
  },
  "offer": null,
  "orderStates": [],
  "recentOrders": [],
  "actions": {
    "viewProduction": true,
    "viewLot": true,
    "viewOrders": true,
    "createOffer": true,
    "publishOffer": false,
    "acceptOrders": false,
    "pickupOrders": false
  }
}
```

Quando houver oferta, `offer` contém `{id,status,quantityKg,availableKg,reservedKg,dispatchedKg,receivedKg,availableUntil}`. São os saldos comerciais existentes, em kg. `availableKg` é saldo da oferta, inclusive quando ela for rascunho ou estiver vencida; verifique `status` e `availableUntil` antes de apresentá-lo como oferta ativa. Não representa estoque físico total nem comprova venda. O overview não cria um saldo de estoque próprio.

`orderStates` agrupa todos os pedidos do lote por `{status,count,quantityKg}`. SOLICITADO é solicitação sem reserva; ACEITO é aceite com reserva; RETIRADO registra expedição; somente RECEBIDO indica recebimento confirmado. CANCELADO permanece no histórico. `recentOrders` contém até três pedidos por lote, ordenados por createdAt e UUID decrescentes: `{id,status,quantityKg,shipmentId,shipmentStatus,carrierOrganizationId}`. Os três últimos campos são null quando ausentes. Não inclui usuário nem recibo privado. Use os IDs para selecionar o pedido na experiência comercial existente.

`lot.recentEvents` contém até três eventos posteriores à origem por recordedAt e UUID decrescentes; quando não há eventos externos, contém a origem embutida. Consulte `/lots/:id` ou `/lots/:id/events` paginados para histórico completo, incluindo origem. O estado do lote `IDENTIFICADO` descreve o cadastro do lote; entregas são descritas nos pedidos/remessas/eventos, sem inferir que todo o lote foi entregue.

Os booleanos `actions` são orientações de navegação conforme perfil e estado observado: criação de oferta quando não existe; publicação de rascunho vigente; consulta de solicitações para aceite; consulta de aceitos para retirada. Os POSTs comerciais existentes continuam validando saldo, validade, vínculo, local confirmado e estado transacional no momento da execução. Uma indicação de aceite não garante saldo para todos os pedidos. O vendedor não recebe ação de confirmar recebimento, que é do destinatário. LEITOR recebe todas as ações de escrita como false.

Cada elemento operacional contém `{id,scope,productionCount,missingProductionIds,state,productions}`. `scope` é sempre `LINKED_PRODUCTIONS`: armazém e coleta não incluem automaticamente todos os lotes da organização ou propriedade. Vincule explicitamente as produções desejadas. As produções do elemento são retornadas mesmo se não estiverem na página principal do overview.

Estados derivados, sem recompensas fictícias:

- `NO_LINKED_PRODUCTIONS`: nenhum registro vinculado e acessível. Uma cultura pode estar configurada mesmo nesse estado.
- `HAS_LOTS`: existem produções reais com seus lotes e nenhum pedido SOLICITADO/ACEITO nesses lotes.
- `ACTION_PENDING`: existe pedido SOLICITADO ou ACEITO em algum lote vinculado. O indicador pode ser visto por LEITOR, que não ganha permissão de agir.

`missingProductionIds` identifica referências configuradas que deixaram de estar acessíveis àquela propriedade. Nome, cultura, lote, pedidos e quantidades dessas produções não são expostos. O layout permanece salvo para permitir correção explícita pelo produtor; o overview não apaga personalizações silenciosamente.

## Erros HTTP

Formato existente: `{"error":{"code":"INVALID_INPUT","message":"Descrição"}}`.

| HTTP | Códigos / situação |
|---|---|
| 200 | Consultas e PUT concluído |
| 400 | INVALID_INPUT: UUID, nome, tipo, coordenada, versão ou campos inválidos; INVALID_REFERENCE: cultura/produção inexistente, alheia ou incompatível; paginação inválida |
| 401 | UNAUTHORIZED: identidade ausente, expirada ou usuário inativo |
| 403 | FORBIDDEN: vínculo/organização inativos ou edição sem perfil permitido |
| 404 | NOT_FOUND: propriedade inexistente, inativa ou pertencente a outra organização |
| 409 | LAYOUT_VERSION_CONFLICT: versão antiga, criação duplicada ou versão positiva sem layout existente |
| 413 | PAYLOAD_TOO_LARGE: corpo acima de 16 KiB |
| 500 | INTERNAL_ERROR: falha de leitura/gravação, sem stack ou detalhes do banco |
| 503 | AUTH_NOT_CONFIGURED: autenticação demo desabilitada, regra existente da API |

## Consultas e limites técnicos

São realizadas consultas em lote, sem uma consulta por elemento ou por produção. Overview faz nove leituras de dados de quantidade constante: valida propriedade, lê layout, agrega totais/culturas, lê página, lê referências, lê ofertas, agrega estados de pedidos, agrega eventos recentes e agrega pedidos recentes. As consultas de autenticação e vínculo existentes são adicionais. São materializadas até 100 produções da página mais 200 referências de setores. Ofertas são limitadas naturalmente a uma por lote pelo índice único existente; pedidos/eventos são agregados no banco com projeções restritas e `$topN` de três por lote. Não se carrega uma coleção inteira em memória.

Índices novos: `productions {organizationId,propertyId,createdAt:-1,_id:-1}` e `orders {sellerOrganizationId,lotId,status}`. São criados idempotentemente em `connectDatabase`; os índices existentes de lote, ofertas e eventos permanecem. A coleção de layouts usa seu índice único nativo. Não há migração, seed ou escrita em dados operacionais para ativar Minha Fazenda; a coleção surge na primeira gravação.

As leituras do overview são próximas no tempo, mas não constituem snapshot transacional de todas as coleções. Um pedido pode mudar entre consultas. O frontend deve atualizar após operações e tratar conflitos de negócio. Não existe DELETE/movimentação de produção nos endpoints atuais; se isso for acrescentado, deve preservar essa validação de referências e isolamento.

## Verificação

Banco de teste exclusivo: `farm_isolated`, em processo mongod real e diretório `.data/farm-test-<uuid>`, independente de MONGODB_URI/MONGODB_DATABASE operacionais. As suítes preexistentes usam suas próprias bases isoladas. Sem alteração ou exclusão de dados operacionais.

- `farm.test.mjs`: estado inicial/vazio, todos os tipos, posições de borda, trim, campos/IDs/listas/versões inválidos e propagação de falha de persistência.
- `farm-integration.test.mjs`: propriedade sem layout/produção; cultura sem produção; criação e atualização de setores; associação válida; bloqueio entre propriedades da mesma organização e entre organizações; culturas inválidas/incompatíveis; leitor, editor e vínculo revogado; validação HTTP e 413; concorrência de criação e atualização; múltiplas culturas; totais independentes da página; saldos de oferta separados dos registros; pedidos/remessas/eventos; referência indisponível; erro real de validação MongoDB sem perda do documento anterior; reinicialização de API e processo MongoDB preservando layout; esvaziamento explícito preservando produção.
- `npm test`: testes unitários antigos e novos.
- `npm run test:integration`: suítes antigas de produção, comércio, logística, isolamento e persistência, mais Minha Fazenda.
- `npm run check`: sintaxe dos arquivos JavaScript abrangidos pelo verificador existente.
- `npm test --prefix apps/portal`: testes existentes do consumidor web, sem modificação do frontend.

Resultado final em 10/11/2026: 27/27 testes unitários, 50/50 testes de integração (incluindo os testes pais contabilizados pelo runner), 11/11 testes do portal, verificação de sintaxe e `npm run typecheck --prefix apps/portal` aprovados. Nenhum teste ignorado. As falhas intermediárias de retomada foram corrigidas com confirmação de journal e não permanecem na execução final.

Arquivos criados: `services/api/src/farm-domain.mjs`, `services/api/src/farm.mjs`, `services/api/test/farm.test.mjs`, `services/api/test/farm-integration.test.mjs` e este documento. Arquivos alterados: `services/api/src/app.mjs` (montagem do router), `services/api/src/database.mjs` (índices), `package.json` (inclusão nas suítes) e `docs/requisitos/api.md` (referência aos contratos).

Os testes de falhas cobrem erro real de escrita e propagação de exceção do driver. No Windows, a parada do MongoMemoryServer standalone termina o processo abruptamente: a verificação de reinício detectou perda de versões reconhecidas sem journal explícito; as gravações do layout passaram a exigir `j: true`. A fixture também confirma no journal a remoção do validador temporário de falhas antes de reiniciar. Não são simulados desligamento físico da máquina, particionamento de rede ou falha de disco. Os processos de teste não limpam seus diretórios automaticamente, seguindo as suítes existentes do projeto.

## Orientações para o Claude

1. Reutilizar sessão, seleção de organização e propriedade, proxy e cliente API do portal. Acrescentar tipos dos contratos novos; não criar API paralela.
2. Consultar layout e overview da mesma propriedade; conciliar `layoutVersion` com `version` antes de combinar os dados. Se divergirem, recarregar. Descartar respostas antigas ao trocar propriedade.
3. Para UNCONFIGURED ou EMPTY, mostrar estado inicial e ação de configuração conforme `canEdit`. Mostrar as produções reais como opções de vinculação, sem criar setores automaticamente como fatos. O catálogo de culturas não significa que todas estão cultivadas na propriedade.
4. Criar sprites/ilustrações e navegação por elementos, convertendo x/y em coordenadas do canvas relativo. A arte é gráfica e não topográfica. Nome, tipo, posições e referências vêm do layout; cultura/safra/volume e estados vêm do overview.
5. Implementar adicionar, nomear, vincular e mover setores com UUIDs estáveis e PUT da lista inteira. Salvar explicitamente, exibir progresso/erro e tratar 409 sem apagar edição local silenciosamente.
6. No clique, usar o UUID do elemento para obter seus registros operacionais. Apresentar culturas de `cropIds` pelo catálogo e culturas efetivas pelos registros; diferenciar quantidade registrada, oferta, pedido e recebimento.
7. Abrir fluxos existentes de produção, lote, oferta e pedido/remessa. Os resumos recentes são limitados: paginar as consultas existentes para histórico completo. A interface de seleção de produção deve filtrar `propertyId`, pois `/productions` lista a organização inteira.
8. Respeitar LEITOR e as permissões retornadas; garantir que os próprios endpoints continuem sendo a autoridade. Mostrar referências indisponíveis para correção sem inventar detalhes.
9. Manter aviso de representação ilustrativa e origem de demonstração. Não inferir dimensões físicas, estoque por galpão, colheitas futuras, vendas, entrega completa ou existência verificada de estruturas.

O backend está pronto para o protótipo da experiência personalizada. Restam no frontend renderização, editor, interação, tratamento de concorrência e integração às telas existentes. Autenticação de produção, georreferenciamento, inventário físico por estrutura e atualizações em tempo real estão fora deste incremento.
