# Modelo de dados — base e segundo incremento

O desenho abaixo registra a base e o segundo incremento. Os detalhes de consistência estão em [incremento-2.md](incremento-2.md): oferta e pedido são coleções reais; remessa/recebimento são embutidos no pedido; novos eventos são separados. Quantidades comerciais usam gramas inteiras.

Todos os IDs de domínio são UUID, datas de eventos ISO-8601 UTC e referências têm autorização no serviço. Campos abaixo são obrigatórios, salvo os marcados opcionais. Dados fictícios possuem `isDemonstration=true`. Documentos MongoDB usam `_id`; API usa `id`.

Extensão opcional preparada para clima: `properties.coordinates={latitude,longitude}` com números finitos dentro de [-90,90]/[-180,180], cadastrados e verificados pela administração autorizada, nunca inferidos pelo app. A propriedade demonstrativa atual mantém município/UF e não recebeu coordenadas inventadas. O endpoint meteorológico retorna indisponível enquanto faltarem configuração ou coordenadas.

## Entidades e relacionamentos

| Entidade | Campos fundamentais | Relacionamentos / validações |
|---|---|---|
| Usuário | id, displayName, status, isDemonstration | Vários vínculos; status ATIVO/INATIVO. Email único verificado é futuro, não foi coletado nesta versão. |
| Organização | id, name, type, status, isDemonstration | Tipos PEQUENO_PRODUTOR_RURAL, COOPERATIVA, INSTITUICAO, COMPRADOR_LOCAL. ATIVA/INATIVA. Documentação legal/contatos opcionais futuros. |
| Vínculo | id, userId, organizationId, role, status | Par usuário/organização único; ATIVO/INATIVO. Criação futura autorizada pelo administrador. Uma pessoa pode ter múltiplos vínculos. |
| Papel e permissão | role, permissões por recurso, escopo | Papéis ADMIN, EDITOR, LEITOR; regras no backend, sem coleção dinâmica inicialmente. ADMIN não supera restrições do tipo da organização. |
| Propriedade rural | id, organizationId, name, municipality, uf, status | Pertence a pequeno produtor rural; UF válida, município não vazio; ATIVA/INATIVA. Geometria e endereço preciso não são necessários agora. |
| Cultura | id, name, status | Catálogo de culturas ativas; sem categorias arbitrárias fornecidas pelo cliente. |
| Safra/produção | id, organizationId, propertyId, cropId, seasonLabel, quantityKg, harvestedOn, status, createdBy, createdAt | Primeiro agregado; propriedade da organização e cultura ativas. Safra representada pelo rótulo da produção; entidade Safra própria futura se exigir período/planejamento. |
| Lote agrícola | id, productionId, ownerOrganizationId, initialQuantityKg, status | Na versão inicial, um lote por registro, embutido em produção. Identidade permanece ao longo do histórico; quantidade >0, até três casas em kg. |
| Oferta de excedente | id, sellerOrganizationId, lotId, quantityGrams, availableGrams, reservedGrams, dispatchedGrams, receivedGrams, availableUntil, territory, destinationMode, unitPriceCents, status, createdAt | Uma oferta por lote, quantidade <= produção; VENDA/DOACAO; centavos/kg; reserva concorrente transacional no aceite. |
| Solicitação/pedido | id, offerId, lotId, sellerOrganizationId, requesterOrganizationId, quantityGrams, status, createdBy, createdAt | Instituição/comprador local solicita; valida saldo mas não reserva antes do aceite. Projeção compartilhada omite createdBy. |
| Remessa (embutida no pedido) | id, status, carrierOrganizationId opcional, pickedUpAt após retirada | Criada no aceite, uma por pedido. Lote, quantidade, origem e destinatário são definidos pelo pedido pai. Cooperativa opcional designada pelo vendedor. |
| Evento de rastreabilidade | id, lotId (ou lote pai), orderId quando aplicável, operationId nos novos eventos, type, occurredAt, recordedAt, responsibleUserId, responsibleOrganizationId, location, locationConfirmedBy, locationConfirmedAt, isDemonstration | Origem inicial embutida; novos eventos append-only em traceEvents, encadeados à operação. Correções compensatórias serão futuras; a API atual não edita nem apaga eventos. |
| Confirmação de recebimento (embutida na remessa) | id, receiverOrganizationId, receivedBy, receivedAt, quantityAcceptedGrams, location | Destinatário autorizado confirma quantidade integral; parcial/divergências ainda não implementados. Gera evento na mesma transação; projeção externa omite receivedBy. |

## Estados e invariantes

- Produção: `REGISTRADA`. Data de colheita YYYY-MM-DD contra UTC; regra de fuso da propriedade deve ser refinada antes de uso real.
- Lote: `IDENTIFICADO`, identidade preservada. Como um lote pode abastecer pedidos distintos, o estado logístico é de cada pedido/remessa, não um único estado global.
- Oferta: `RASCUNHO → PUBLICADA`; listagem pública exige validade e saldo. ENCERRADA/CANCELADA e republicação permanecem futuras.
- Pedido: `SOLICITADO → ACEITO → RETIRADO → RECEBIDO`; cancelamento somente SOLICITADO/ACEITO, com liberação de reserva uma única vez.
- Remessa: `PLANEJADA → RETIRADA → RECEBIDA`; cancelamento antes da retirada gera CANCELADA.
- Recebimento: integral e idempotente; repetição não duplica volume nem evento. Parcial/divergências exigirão contrato próprio.
- Conservação: quantidade da oferta = disponível + reservada + despachada + recebida, em gramas inteiras. Quantidade ofertada não supera a produção original. O restante não ofertado permanece fora do saldo comercial.
- Não dividir/agrupar lotes agora. Futuramente manter arestas de origem e quantidades, sem ciclos nem perda de procedência.
- Histórico não comprova qualidade, segurança alimentar, localização contínua nem desperdício evitado.

## Permissões

| Ação | Pequeno produtor rural | Cooperativa | Instituição | Comprador local |
|---|---|---|---|---|
| Criar produção própria (atual) | ADMIN/EDITOR | Não | Não | Não |
| Ler produção/lote privado (atual) | Vínculo ativo na organização proprietária | Apenas dados da própria organização; sem acesso a terceiros | Igual | Igual |
| Publicar oferta | Organização proprietária ADMIN/EDITOR | Não | Não | Não |
| Solicitar oferta | Não no fluxo mínimo | Não | ADMIN/EDITOR | ADMIN/EDITOR |
| Registrar retirada | Expedidor ADMIN/EDITOR | ADMIN/EDITOR se designada | Não | Não |
| Confirmar recebimento | Não no fluxo mínimo | Não | Destinatária ADMIN/EDITOR | Destinatário ADMIN/EDITOR |
| Consultar trajetória compartilhada | Proprietário de origem | Operação designada | Próprios pedidos com remessa | Próprios pedidos com remessa |

LEITOR nunca altera. ADMIN gerencia apenas a própria organização; não é administrador global. Acesso a uma nova organização não herda automaticamente permissões de outra. Implementação atual verifica usuário ativo, vínculo ativo e organização ativa a cada chamada.

## Armazenamento atual

Coleções da base: `users`, `organizations`, `memberships`, `properties`, `crops`, `demoTokens`, `productions`. Segundo incremento: `offers`, `orders`, `traceEvents`, `commands`. `productions.lot.events` preserva somente o evento inicial. `demoTokens` guarda hash e expiração; não compõe autenticação de produção. Novos índices únicos limitam uma oferta por lote, uma remessa por ID e um evento por operação/tipo. Validadores MongoDB para escrita fora da API permanecem pendentes; alterações diretas no banco não são protegidas pelas regras do serviço.

## Referência meteorológica complementar

Propriedade: município/UF já existentes; `coordinates` opcional `{latitude, longitude, verified, consent}`. Usar posição precisa apenas com ambos os flags verdadeiros e coordenadas numéricas nos intervalos [-90,90]/[-180,180]. Verificação e consentimento precisam ser obtidos por processo autorizado; não inferir de coordenadas legadas. Não foi criado endpoint de edição.

Coleção `weatherLocations`: `_id` SHA-256 de propriedade/organização/município normalizado/UF; `location` com latitude, longitude, `source: OpenWeather Geocoding`, `precision: municipality`, `approximate: true`; município, UF, `resolvedAt` ISO e `expiresAt` epoch ms. Upsert de um documento; validade de 30 dias conferida pelo adaptador. Falhas ambíguas/sem resultado ficam 24h com `reason` e sem localização. Troca de município/UF altera a identidade. Expiração lógica, sem TTL ou limpeza automática nesta versão. Não guarda chave nem observações; cache de condições em memória limitado a 256 escopos.
