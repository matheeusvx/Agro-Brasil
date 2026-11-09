# Logística — auditoria de contratos

09/11/2026. Leitura de `services/api/src/commerce.mjs`, `commerce-domain.mjs`, `domain.mjs` e `app.mjs`, antes da integração. Nenhum endpoint foi criado ou alterado.

## O que cada contrato oferece

| Contrato | Campos relevantes | Uso no painel |
|---|---|---|
| `GET /productions` | `propertyId`, `organizationId`, `cropName`, `lot.id` | Liga lote à propriedade autorizada e dá o nome da cultura, que `/orders` não traz |
| `GET /orders` | `status`, `quantityKg`, `lotId`, `sellerOrganizationId`, `createdAt`, `shipment` | Fonte dos estados, quantidades e operação direta/cooperativa |
| `GET /lots/:id/events` | `type`, `orderId`, `location`, `locationConfirmedAt`, `recordedAt` | Município/UF confirmados de retirada e recebimento |
| `GET /offers?scope=mine` | saldo e prazo da oferta | **Não consumido**: o pedido já identifica lote e vendedor. Saldos pertencem ao painel de Produção |
| Remessa | Embutida em `order.shipment`; não há `GET /shipments` | Lida pelo pedido. `PLANEJADA`, `RETIRADA`, `RECEBIDA`, `CANCELADA` |

## Máquina de estados real

| Pedido | Remessa | Quem age a seguir | No painel |
|---|---|---|---|
| `SOLICITADO` | ausente | Produtor aceita ou cancela | Em andamento, **ação do produtor** |
| `ACEITO` direto | `PLANEJADA`, `carrierOrganizationId: null` | Produtor registra retirada | Em andamento, **ação do produtor** |
| `ACEITO` com cooperativa | `PLANEJADA`, com cooperativa | Cooperativa designada ou produtor | Em andamento, sem ação obrigatória |
| `RETIRADO` | `RETIRADA` | Somente o destinatário | Em andamento, sem ação do produtor |
| `RECEBIDO` | `RECEBIDA`, com `receipt` | Encerrado | Recebido |
| `CANCELADO` | ausente ou `CANCELADA` | Encerrado | Fora do andamento |

A API permite ao produtor registrar a retirada mesmo com cooperativa. O painel não a cobra como pendência porque a responsabilidade foi designada, mas a tela de Pedidos segue oferecendo o botão.

## Pontos que orientaram a implementação

- **`/orders` retorna mais do que o painel deve mostrar.** O filtro inclui operações em que a organização é vendedora, solicitante ou transportadora. O painel aceita só pedidos de lotes da propriedade escolhida, com `sellerOrganizationId` igual à organização dona da produção.
- **Local confirmado só existe nos eventos.** `shipment` guarda `pickedUpAt`, mas nenhum município de retirada. Por isso os eventos são consultados, apenas nos lotes com pedido `RETIRADO` ou `RECEBIDO`.
- **Eventos do proprietário trazem dados pessoais** (`responsibleUserId`, `locationConfirmedBy`). A projeção salva no aparelho descarta esses campos, IDs de organização e o `receipt`.
- **Paginação dos eventos** soma o evento de origem ao total (`count + 1`). `productionPages` é compatível: exige `id` em cada item, e o evento de origem tem `id`. Limite de 100 por página.
- **Consultas não são um snapshot transacional.** Um recebimento pode ser confirmado entre a leitura de `/orders` e a de eventos. O evento só conta se o pedido lido já estiver `RECEBIDO`, para município e situação não se contradizerem.
- **Sem campos de rota.** O contrato não tem distância, trajeto, GPS, previsão ou prazo logístico; `availableUntil` é validade da oferta. O painel não calcula nem sugere nenhum deles.
- **Atraso não é detectável.** Sem prazo combinado no contrato, “pedido atrasado” seria invenção. A atenção se limita ao que depende do produtor.
- **Nome da cooperativa** exigiria outra consulta e pode não resolver se ela ficar inativa. O painel diz apenas “Com cooperativa”, como a tela de Pedidos.
