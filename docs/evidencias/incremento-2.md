# Segundo incremento — relatório de execução

Data: 05/11/2026. Projeto individual de Matheus Morelli Rodrigues, RM 562765. Escopo: conectar pequenos produtores rurais, cooperativas, instituições e compradores locais por ofertas, pedidos, logística e rastreabilidade. Nenhuma automação ou atualização Trello foi feita.

## Resultado implementado

Criação/publicação de oferta de lote próprio; catálogo comercial sem propriedade/dados pessoais; solicitação por instituição/comprador local; aceite com reserva segura, remessa criada atomicamente e cooperativa opcional; cancelamento antes da retirada; retirada por produtor/cooperativa designada; recebimento integral pelo destinatário; histórico de origem e movimentações com autorização por operação.

O primeiro agregado de produção foi preservado. As novas coleções `offers`, `orders`, `traceEvents`, `commands` usam transações reais. Dados comerciais em gramas inteiras; índices únicos e estados impedem dupla oferta do mesmo lote, dupla reserva/liberação ou repetição de movimentações. Nenhuma escrita multi-documento é simulada em standalone.

## Testes executados

| Comando | Resultado |
|---|---|
| `npm.cmd test` | 6 testes unitários da fundação aprovados |
| `npm.cmd run test:integration` | 30 casos aprovados: 16 comerciais novos e 14 da base (inclui novo bloqueio em standalone). O runner conta 32 ao incluir os dois agrupadores. Zero falhas/ignorados na execução final. |
| `npm.cmd run check` | Sintaxe JavaScript aprovada |
| `npm.cmd run verify:commerce -- <lote>` | Leitura real dos quatro perfis, pedidos recebidos e projeções de eventos; JSON sem tokens |

Casos comerciais: oferta acima do lote, massa inválida, preço/data inválidos, idempotência de criação e conteúdo divergente, rascunho privado, proteção de propriedades e usuários, quantidade acima do saldo, pedidos/aceites concorrentes, organização alheia, transição inválida, cooperativa designada, retirada concorrente repetida, recebimento repetido, cancelamentos concorrentes, operação direta, conservação de gramas, rollback provocado, preservação/paginação dos eventos, papel LEITOR, localização sem confirmação e reinício da aplicação com replay idempotente persistido. O teste antigo continua reiniciando também o processo MongoDB e verificando persistência da produção.

Arquivos de evidência:

- `incremento-2-unitarios.txt`: saída real dos testes unitários.
- `incremento-2-integracao.txt`: saída final da integração.
- `incremento-2-transacoes.json`: IDs e saldos reais do banco isolado da suíte, não registros de negócio reais.
- `incremento-2-interface.json`: leitura HTTP somente de consulta dos registros fictícios criados na interface.

## Demonstração na interface

Foram utilizados os quatro tokens demo já existentes, sem copiá-los para relatórios, código ou screenshots. O lote da primeira execução foi reaproveitado, com 12,5 kg de produção original; uma oferta de 10 kg foi criada e publicada. A parte não ofertada, 2,5 kg, não integra o saldo comercial.

| Operação fictícia | Quantidade | Participação | Resultado observado |
|---|---|---|---|
| Instituição | 4 kg | Pequeno produtor rural aceita; cooperativa designada registra retirada; instituição recebe | Pedido RECEBIDO e remessa RECEBIDA |
| Comprador local | 2 kg | Pequeno produtor rural aceita e registra retirada diretamente; comprador recebe | Pedido RECEBIDO e remessa RECEBIDA, sem cooperativa |

Saldo comercial final: **10 kg = 4 kg disponíveis + 0 reservados + 0 em trânsito + 6 kg recebidos**. O produtor consultou dez eventos: origem inicial preservada, publicação e quatro eventos por pedido. Instituição e comprador veem origem e os quatro eventos de seu pedido; cooperativa vê apenas a operação designada e a origem. Os IDs concretos e horários constam do JSON, obtidos do servidor.

Após reiniciar a API local, a verificação HTTP dos quatro perfis foi executada novamente: ambos os pedidos continuaram RECEBIDO; produtor recebeu 10 eventos e cada outro perfil recebeu 5 eventos autorizados. A evidência de interface foi atualizada por essa leitura, sem novas gravações comerciais.

Esta demonstração é fictícia. Não representa alimento real entregue, receita, pagamento ou benefício social medido. Os relatórios da primeira execução foram preservados como histórico; suas limitações refletem aquele momento, não o estado atual.

## Arquivos modificados e adicionados

| Grupo | Arquivos |
|---|---|
| Backend alterado | `services/api/src/app.mjs`, `database.mjs` |
| Backend novo | `services/api/src/commerce.mjs`, `commerce-domain.mjs` |
| Testes | Novo `services/api/test/commerce.test.mjs`; ampliado `integration.test.mjs`; `unit.test.mjs` preservado |
| Web | Alterados `apps/web/index.html`, `app.js`; novo `commerce.js`; CSS preservado |
| Execução | Alterados `scripts/mongo-local.mjs`, `package.json`, comentários de `.env.example`; novo `scripts/verify-commerce-demo.mjs` |
| Documentação | Atualizados README, arquitetura, modelo de dados e contratos REST; novo `docs/arquitetura/incremento-2.md` e este relatório/evidências |

Nenhuma dependência npm adicional foi necessária. O código da primeira execução ainda estava sem commit; o estado Git mostra arquivos não rastreados, portanto a comparação lógica foi feita pela inspeção dos arquivos existentes e pelos testes, sem inventar um commit de referência. Não houve commit, remoto ou alterações nos módulos Flutter/Python/Java.

## Limites e continuidade

Identidade e banco continuam restritos à demonstração local. Um replica set de um nó permite transações, mas não tolera perda de nó. Eventos não têm proteção contra administrador do banco. Apenas uma oferta por lote, uma remessa e recebimento integral por pedido. Sem pagamentos, QR, divergências, devoluções, divisão/agrupamento de lotes, expiração automática de reservas ou mudança de cooperativa após aceite. GETs paginados não têm snapshot único entre contagem e conteúdo. Localização é confirmada pelo participante, sem GPS ou validação externa.

Próxima etapa recomendada: revisão com os quatro públicos e ajuste da jornada; depois integração Flutter e indicadores com a API, preservando o cronograma de Data Science/Java. Priorizar identidade/gestão de vínculos e ambiente de implantação antes de qualquer exposição fora de loopback. Não expandir logística avançada neste período sem capacidade demonstrada.

## Relação com Trello

- **OFER-01:** escopo de oferta/consulta e solicitação demonstrado nesta etapa.
- **LOG-01:** retirada e recebimento integral demonstrados, com cooperativa opcional.
- **RAST-01:** origem e movimentações autorizadas verificadas; QR Code permanece pendente se fizer parte do cartão original.
- **QA-01:** regressão e integridade deste incremento verificadas; não equivale à verificação de todo o produto acadêmico.
- **ARQ-01:** decisão de replica set/transações, entidades, permissões e contratos atualizados.

Esses são os identificadores de planejamento informados, sem confirmação de IDs internos ou links de cartões. Nenhum cartão foi marcado como concluído; critérios adicionais dos cartões reais precisam ser conferidos antes de encerramento.
