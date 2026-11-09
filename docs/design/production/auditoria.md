# Produção e excedentes — auditoria anterior à integração

Referências: tela hídrica V2 e imagens mobile de barras/verde-lima examinadas. Reutilizar DashboardCard, estados, espaçamentos, cores e dashboardMotion; barras horizontais evitam rótulos comprimidos. Sem React/StageShow: animações são widgets Flutter nativos. Sem necessidade de mudar backend ou portal.

## Contratos verificados no código da API

- `/catalog`: propriedades ativas somente da organização autorizada e culturas. Propriedade fornece nome, município/UF.
- `/productions`: filtro de organização no servidor, páginas offset/limit (máximo 100), total declarado; propriedade não filtrada na rota. Usar todas as páginas e filtrar propertyId. `harvestedOn` define ano da colheita, `seasonLabel` identifica safra, `cropId` distingue culturas, `lot.id` relaciona ofertas.
- `/productions/indicators`: agrega a organização inteira; NÃO usar como total da propriedade.
- `/offers?scope=mine`: somente vendedor autorizado; relacionar lotId à produção da propriedade e sellerOrganizationId à organização da produção. `quantityKg` é original; `availableKg` já desconta aceite, retirada e recebimento não retornam saldo. Cancelamento aceito pode devolver saldo na API. Não subtrair pedidos novamente.
- `/orders`: servidor retorna vendedor OU solicitante autorizado; incluir somente offerId/lotId/vendedor das ofertas próprias da propriedade. Solicitação não aceita NÃO reserva; estados aceito/retirado/recebido são distintos. PublicOffer não expõe as colunas internas reserved/dispatched/received; não inferir estoque físico a partir da diferença.
- Disponibilidade: somente PUBLICADA, prazo UTC estritamente futuro, modo VENDA/DOACAO. RASCUNHO e prazo vencido excluídos. Filtro de ano aplica-se à produção, enquanto saldo de ofertas/ações refere-se a TODAS as colheitas da propriedade e é rotulado assim.
- Sem detecção confiável de 'oferta sem pedidos' com snapshot atômico: não será exibida. Prioridade até duas solicitações, depois ofertas com saldo e vencimento em até 72 horas.

## Isolamento e consistência

Paginar até total completo, recusar duplicações, total mutável, páginas curtas inconsistentes e limite da API; nunca exibir total parcial. API não oferece transação de leitura entre as três rotas; consultas concorrentes não equivalem a snapshot transacional. Sem alegação de atualização ao vivo.

Valores em gramas inteiros antes de somar. Cache separado por scope (origem/usuário/organização) e propriedade; sem tokens. Apenas erro de rede/5xx permite cópia local. 401/403/404 e erros de consistência invalidam a cópia. Sair remove os snapshots novos além dos antigos. Offline apresenta dados desatualizados e não convida a executar ações sobre pendências não confirmadas. Nenhum total representa estatística municipal.
