# Segundo incremento — conexão, logística e rastreabilidade

## Decisão de persistência

A base standalone foi preservada para produção; para alterações entre documentos passou a ser necessário **MongoDB replica set**. `db:local` agora inicia `agroLocal`, um nó real WiredTiger no mesmo diretório `.data/mongodb`. Nenhum dado anterior foi apagado, nenhum novo serviço instalado e nenhuma dependência acrescentada. O código comercial faz `hello` e recusa standalone com 503 antes de gravar. Teste específico verifica isso.

Cada mutação usa `ClientSession.withTransaction`, `readConcern=snapshot`, `writeConcern=majority`, operações sequenciais e retries do driver para conflitos transitórios. Nenhuma chamada Promise.all executa escritas dentro da mesma transação. A decisão segue o [driver MongoDB v6](https://www.mongodb.com/docs/drivers/node/v6.x/crud/transactions/).

## Modelo implementado

- `productions`: estrutura da fundação e `lot.events[0]` preservados; não há alteração retroativa de origem.
- `offers`: UUID, lotId único, sellerOrganizationId, projeção de cultura/município, modalidade, preço inteiro em centavos/kg, validade, status RASCUNHO/PUBLICADA e quantidades inteiras em gramas.
- `orders`: UUID, offerId, lotId, vendedor, solicitante, quantidade, estado e remessa/recebimento embutidos. Uma remessa por pedido; criação junto do aceite.
- `traceEvents`: novos eventos append-only, com lotId, orderId quando aplicável, operationId, tipo, horários UTC do servidor, organização/usuário responsáveis, município/UF, confirmação e quantidade. Índice único (operationId,type).
- `commands`: hash do escopo usuário/organização/método/caminho/chave; fingerprint canônico do corpo e resultado original. Gravado na mesma transação; índice primário único impede duplicação concorrente. Sem TTL nesta etapa.

Não foi feita migração destrutiva nem copiado o evento antigo. A leitura combina a origem inicial com eventos novos, paginados; assim a produção permanece compatível e novos eventos não fazem seu documento crescer indefinidamente.

## Conservação e estados

Para cada oferta, em todos os estados confirmados:

`quantityGrams = availableGrams + reservedGrams + dispatchedGrams + receivedGrams`

Uma oferta por lote, com quantidade <= produção original, evita sobreoferta por múltiplos anúncios. A parte não ofertada continua fora da oferta. Não há alteração de quantidade do lote nem divisão/agrupamento. Conversões usam gramas inteiras com teto 1e12, abaixo do limite inteiro seguro do JavaScript.

- Solicitar: valida saldo no snapshot, mas **não reserva**. Vários pedidos pendentes podem disputar a mesma quantidade; a solicitação não garante atendimento.
- Aceitar: SOLICITADO → ACEITO; decrementa disponível e incrementa reservado, com filtro `availableGrams >= quantidade`, cria remessa PLANEJADA e evento na mesma transação. Conflitos de escrita são reavaliados pelo driver; um pedido que perdeu saldo retorna 409.
- Cancelar: SOLICITADO/ACEITO → CANCELADO. Solicitação não libera saldo; aceite libera exatamente sua reserva. Remessa existente vira CANCELADA. Proibido após retirada.
- Retirar: ACEITO → RETIRADO; remessa PLANEJADA → RETIRADA; reservado → despachado.
- Receber: RETIRADO → RECEBIDO; remessa RETIRADA → RECEBIDA; despachado → recebido, confirmação integral e evento.

Mesma chave e corpo retornam a resposta original sem repetir efeitos. Outra chave após uma transição consumida retorna 409, não repete a operação. Chave igual com conteúdo diferente retorna 409. Isso é por ator/organização/caminho: uma chave não substitui a autorização do usuário.

## Quatro públicos e autorização

Pequeno produtor rural ADMIN/EDITOR publica e aceita somente seus lotes/pedidos. Instituição e comprador local solicitam e confirmam seus recebimentos. O ofertante pode designar uma cooperativa **ativa** no aceite; essa designação autoriza a retirada e o acesso à operação, sem dar acesso a todos os dados do lote. Sem cooperativa, o produtor registra a retirada. Não há delegação genérica nem alteração do transportador após aceite.

Cooperativa não aceita pedidos em nome do produtor, não cancela em nome das partes e não confirma recebimento do destinatário. LEITOR não altera. O backend verifica tudo, independentemente dos botões exibidos.

Ofertas publicadas expõem cultura, quantidade/saldo, nome/ID da organização, território municipal, modalidade/preço e validade. Não expõem propriedade, endereço preciso, dados pessoais ou eventos. Pedido/remessa são visíveis apenas ao vendedor, destinatário e cooperativa designada. Usuário externo aceito vê origem e eventos de seus pedidos, sem usuários responsáveis de outras organizações e sem operações alheias. Cancelamento mantém acesso ao histórico da operação já autorizada para auditoria; não concede acesso a novas operações do lote.

## Roteiro demonstrativo

1. Inicie `db:local`, `seed:demo` se necessário e `npm start` conforme README. Não execute seed sobre banco externo. Use os quatro tokens fictícios locais.
2. Pequeno produtor rural: cadastre produção ou use lote existente sem oferta; informe quantidade/modalidade/preço e validade, crie rascunho. Confirme município/UF da operação e publique.
3. Instituição: acesse sua organização, confirme o local e solicite quantidade disponível.
4. Pequeno produtor rural: selecione cooperativa opcional e aceite; saldo disponível diminui.
5. Cooperativa designada: confirme o local e registre a retirada; alternativamente, o produtor faz isso em operação direta.
6. Instituição: confirme o local e o recebimento integral; consulte seu histórico autorizado.
7. Comprador local: repita o fluxo, inclusive sem cooperativa, demonstrando a segunda experiência destinatária.
8. Pequeno produtor rural: consulte o histórico consolidado do lote; origem anterior e novos eventos são preservados.

Dados são fictícios e não equivalem a venda/pagamento real ou benefício social medido. O token permanece apenas na memória da página. Chaves de repetição ficam em memória durante uma falha de rede; recarregar a página pode perdê-las. Estados e índices no servidor continuam impedindo repetição de transições.

## Limites

Replica set de um nó não tem alta disponibilidade. Não há autenticação de produção, proteção contra administrador do banco, trilha criptográfica, auditoria de acessos, rate limiting, expiração automática de reservas ou recebimento parcial. Eventos são append-only **pela API**, não invioláveis para quem escreve diretamente no MongoDB. Vínculos são verificados por requisição; não há bloqueio distribuído de revogação durante uma requisição já iniciada.

GETs paginados não fornecem snapshot único entre contagem e leitura se houver alteração simultânea; invariantes de escrita usam transação. A UI mostra até 50 ofertas/pedidos e 100 eventos, explicitando limites; paginação adicional está disponível na API. Catálogo de cooperativas é limitado a 100. Permissões de MongoDB, backups, administração real das organizações e implantação são pendentes.
