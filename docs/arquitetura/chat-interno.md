# Chat interno — backend compartilhado

Implementado diretamente na main, base 0746077, em 12/11/2026. Sem push e sem
interface. [Contratos e exemplos fictícios](../requisitos/api.md).

## Modelo e autorização

- chats: UUID, organizationIds ordenados, pairKey canônica única, createdAt UTC e
  sequence. Par imutável; um chat para todas as operações das duas organizações.
- chatMessages: UUID, chatId, sequence, kind TEXT/ORDER_LINK, createdAt UTC. TEXT
  guarda senderOrganizationId, authorUserId autorizado, text e idempotencyId
  (hash de chat/organização/chave). Autor e hash não saem na projeção pública.
- chatOrders: identidade determinística chat:pedido e índice único chatId/orderId.
  Cada associação cria exatamente um ORDER_LINK, na mesma transação.
- chatRateLimits: contador por organização/minuto, com expiresAt e índice TTL.
  A expiração é limpeza; o limite depende da chave de minuto, não do tempo do TTL.

Índices: chats.pairKey único e organizationIds/data; mensagens chatId/sequence
único e idempotencyId único parcial; associações chatId/orderId único; TTL da taxa.
A criação concorrente usa upsert e unicidade no banco. Transações snapshot/majority
coordenam associação, evento e sequência. Retentativas de conflito/duplicidade não
produzem duplicação. Não existe escrita nas coleções comerciais.

Cada acesso exige usuário ativo, organização selecionada ativa e vínculo ativo.
Somente os quatro tipos de organização e ADMIN/EDITOR/LEITOR são permitidos.
ADMIN/EDITOR podem abrir/enviar; LEITOR somente consulta. Múltiplos usuários da
mesma organização compartilham a conversa, não a identidade pessoal do autor.
Não há diretório, busca de destinatários ou acesso a conversa só por conhecer UUID.

A autorização atual é comprovada em orders: um mesmo pedido não cancelado deve
conter as duas organizações entre vendedor, solicitante e transportadora designada.
Não basta ter pedidos separados com o mesmo produtor. A contraparte também precisa
estar ativa. Não são concedidas permissões permanentes na criação do chat.
Pedido concluído continua sendo relação comercial comprovada; cancelamento de
todos os pedidos comuns, remoção da designação, inativação ou revogação bloqueiam
acesso sem apagar mensagens. Requisições já em andamento seguem o snapshot; a
próxima chamada revalida, como os comandos existentes da plataforma.

## Associação de novos pedidos

É um modelo de leitura derivado: a próxima abertura, leitura ou envio do histórico
materializa os pedidos comuns elegíveis que ainda não têm associação. Não depende
dos IDs de pedido enviados pelo cliente. O evento e a associação são atômicos e
únicos. Polling concorrente não duplica o aviso. Sem hooks nas transações comerciais,
outbox, job ou acesso ao banco operacional por scripts de demonstração.

A associação é eventual por consulta, não imediata na criação do pedido. Pedido
cancelado antes da primeira sincronização não gera aviso; não é relação elegível.
Conversas nunca abertas não são criadas automaticamente. Avisos históricos já
materializados permanecem, inclusive quando uma operação é cancelada; não concedem
acesso a detalhes de pedidos nem prolongam permissão de chat por si próprios.

## Instruções para Claude — interface futura

1. Reutilizar sessão e organização selecionada. Adicionar rotas ao proxy Next.js
   somente de forma explícita; nunca colocar token no browser, URL ou storage.
   Esta entrega não altera a correção recente de autenticação/proxy.
2. Oferecer “Conversar” dentro de pedido/remessa autorizado. Enviar somente UUID da
   contraparte conhecida para POST /chats/open; o backend valida a relação.
   Não implementar busca de organizações arbitrárias.
3. Listar chats com paginação. Carregar histórico com after=0 e limite 50/100;
   enquanto hasMore, buscar nextAfter. Exibir em sequência crescente.
4. Com conversa visível, consultar mensagens a cada 3 segundos usando nextAfter.
   Não sobrepor requisições; deduplicar por id/sequence. Pausar em aba oculta,
   logout ou troca de organização; limpar estado e cursor ao trocar de escopo.
   Em erro de rede/5xx, aplicar backoff 6/12/24/30 s. Nunca transformar erro em vazio.
5. Renderizar TEXT como texto escapado (React texto, Flutter Text), sem innerHTML,
   dangerouslySetInnerHTML, HTML ou Markdown. Texto com tags é literal. Não colar
   credenciais nas mensagens; a API não copia headers de autenticação aos registros.
6. Renderizar ORDER_LINK como aviso neutro “Pedido associado à conversa”. O orderId
   permite abrir a tela existente, que volta a verificar autorização. Não inferir
   status/prazo/localização pelo aviso. Avisos são comuns ao par e não duplicados
   para cada usuário.
7. Gerar uma chave por tentativa lógica de envio e reutilizá-la após timeout.
   Gerar nova chave ao editar o texto. 409 exige resolver o conflito; 429 exige
   aguardar a próxima janela de minuto. Desabilitar envio/abertura para LEITOR.
8. Em 401/403/404, retirar histórico da tela e encerrar polling. Sem fallback para
   cache privado após revogação. Não há recibos de leitura, presença ou não lidas;
   não apresentar esses indicadores como existentes.

## Limites de segurança e operação

- Texto máximo 2000 unidades UTF-16, corpo Express 16 KiB, somente campos permitidos,
  controles recusados, normalização Unicode NFC e LF. Não há anexos ou HTML executável.
- 30 novos textos por minuto por organização, com contador MongoDB transacional;
  compartilhado entre usuários, conversas e instâncias. Janela fixa permite rajada
  na borda. Replays não gastam cota; alteração de texto com mesma chave é conflito.
- Não há autenticação de produção, criptografia ponta a ponta, moderação automática,
  edição/exclusão, retenção automatizada, mensagens particulares entre usuários,
  notificações, WebSocket ou contador de não lidas.
- Sem benchmark de carga. Listagem faz lookup da relação antes de paginar;
  sincronização examina os pedidos/associações do par. Para volumes grandes,
  avaliar custo/planos, limitação de aberturas e projeção assíncrona/outbox antes
  de implantação pública. Eventos são limitados por página e polling usa cursor.
- Idempotência é guardada com a mensagem, sem expiração. Histórico é preservado,
  mas só participantes atualmente autorizados podem consultá-lo.

## Testes e evidências

Fixtures apenas em MongoDB 8.0.16 real, replica set WiredTiger de um nó, banco
chat_test e pasta .data/chat-UUID. Sem seed nem dados do banco operacional.
O teste reinicia Express, conexão e o processo MongoDB no mesmo diretório/porta,
preservando configuração do replica set e histórico.

Testes chat.test.mjs cobrem chave/texto, consultas vazias, oito aberturas concorrentes
nos dois sentidos, seis reenvios concorrentes, par único, segundo pedido, aviso
único sob polling concorrente, cooperativa com produtor e instituição, terceiro
sem designação, comprador, dois usuários da mesma organização, autor privado,
LEITOR, usuário/organização inativos, vínculo revogado e mudança de transportadora,
IDs inválidos, paginação/cursor, texto inválido, conflito de chave, limite/replay,
cancelamento sem perda do histórico e persistência/idempotência após reinício.

Resultados executados:

| Verificação                              | Resultado                                            |
| ---------------------------------------- | ---------------------------------------------------- |
| npm run check                            | Aprovado                                             |
| npm test                                 | 32 aprovados                                         |
| npm run test:integration, execução final | 86 aprovados, zero falhas/ignorados/cancelados       |
| Portal: typecheck/test/build             | Aprovados; 68 testes                                 |
| E2E portal em banco descartável          | 11 verificações aprovadas                            |
| Smoke geral portal                       | Aprovado                                             |
| Flutter analyze/test                     | Sem problemas; 133 testes aprovados                  |
| Java Maven clean verify                  | 199 aprovados, BUILD SUCCESS                         |
| Python, protocolo AGUA-04                | 53 aprovados, 2 deselected, 21 avisos de depreciação |

[Evidência consolidada com hashes dos logs locais](../evidencias/chat-interno-2026-11-12.json).
Os logs ficam em .data/chat-*.log, ignorados pelo Git. Os dois testes Python
excluídos são os previstos em AGUA-04 para não retreinar os modelos congelados.
Nenhuma aquisição de dados ou alteração de modelos foi feita.

Ressalvas: execuções intermediárias da regressão completa falharam no subteste
preexistente de reinício API/MongoDB de integration.test.mjs (data indefinido;
o subteste e seu pai são contabilizados como duas falhas). Execuções posteriores,
inclusive a final de 86 testes, passaram sem modificar esse teste. A causa dessa
intermitência segue em aberto. O teste novo de reinício do chat passou.

As restrições iniciais de acesso aos SDKs Flutter/Java e à pasta TEMP do Python
foram contornadas com execução autorizada dos SDKs e pasta temporária descartável
no workspace. Não são reportadas como testes aprovados antes da execução final.
Relatórios/capturas históricos regenerados pelos roteiros foram restaurados; a
evidência desta tarefa é separada. auth.mjs e a correção de sessão/proxy do portal
permanecem inalterados. README.md e .claude/ já pendentes foram preservados.

Os testes de mensagens usam fixtures explícitas em banco descartável. Nenhuma
mensagem ou pedido fictício foi inserido no banco operacional.
