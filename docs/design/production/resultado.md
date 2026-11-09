# Produção e excedentes — segundo dashboard

09/11/2026. Implementado no Flutter existente. Sem commit ou push.

**Fechamento da integração Android:** [diagnóstico, correção e revalidação na API local normal](conexao-android.md). A falha de login foi resolvida restaurando `adb reverse tcp:3000 tcp:3000`, sem alterar o aplicativo ou expor o backend. Nesta rodada, `flutter analyze` passou, a suíte completa aprovou **97 testes** e o teste HTTP Dart real aprovou mais um. Login, home, dashboard, perda de acesso à API e recuperação foram confirmados no emulador. As capturas novas mostram os **112,5 kg da base local existente**; as evidências de 205 kg abaixo pertencem ao cenário isolado da entrega anterior.

## Acesso e resultado

Abra **Produção → Produção e excedentes**. A tela operacional e seus cadastros continuam disponíveis. O dashboard tem rota própria, escolha de propriedade e ano da colheita, total em kg/culturas, barras horizontais selecionáveis, saldos de venda/doação e até duas ações de atenção. Detalhes de safra, meses registrados e pedidos ficam recolhidos em **Ver análise detalhada**.

Verde profundo, creme, branco e os componentes da Inteligência Hídrica V2 foram reutilizados. A entrada do indicador e as barras usam animações nativas discretas, com redução de movimento respeitada. Nenhuma biblioteca foi adicionada. Cabeçalho, origem, data de consulta e mensagem territorial deixam explícito que são **registros autorizados da propriedade**, não estatísticas agrícolas municipais.

## Integração e regras verificadas

A [auditoria](auditoria.md) documenta os contratos consultados antes da integração. Produção usa todas as páginas de `/productions` e filtra `propertyId`. O agregado de organização em `/productions/indicators` não é usado como total local. Cultura é agrupada por `cropId`, safra por `seasonLabel` e período por `harvestedOn`.

Ofertas vêm de `/offers?scope=mine`, relacionadas ao lote da produção e ao vendedor autorizado. Só **PUBLICADA + prazo futuro + VENDA/DOACAO** entra na disponibilidade. `availableKg` é o saldo fornecido pela API, sem nova subtração das reservas. Produção registrada não vira automaticamente excedente. Quantidades são somadas em gramas inteiros e apresentadas em kg com formatação brasileira, sem zeros decimais desnecessários.

O filtro de ano aplica-se à **produção**. Saldos e atenção abrangem **todas as colheitas da propriedade**, com essa distinção escrita na tela. Original ofertado nos detalhes refere-se às ofertas publicadas vigentes; não inclui rascunhos/vencidas. Pedidos são vinculados por oferta/lote/vendedor, separados por estado e nunca adicionados ao saldo. A API de pedidos não traz nome da cultura: ele é obtido da produção autorizada do lote.

Atenção prioriza solicitações aguardando resposta e depois ofertas com saldo que vencem em até 72 horas. No máximo duas ações, abrindo Ofertas/Pedidos existentes. Sem pendências, há apenas texto discreto. Não foi criada uma classificação de ofertas sem pedidos. Também não foram inventadas tendências ou preenchidos meses sem registros como produção zero.

Cache de consulta separado por origem/usuário/organização/propriedade, sem token. Rede/5xx permite snapshot explicitamente desatualizado. Autorização, paginação inconsistente e contrato inválido não ativam fallback. Atualizar pode tentar reconectar mesmo com a home em estado offline. Logout remove os novos snapshots das propriedades da sessão junto dos anteriores. A autenticação inicial continua online; não foi criado login frio offline ou fila de escrita.

## Arquivos deste incremento

| Arquivo/grupo | Mudança |
|---|---|
| `apps/mobile/lib/territorial/production_data.dart` | Paginação completa, relacionamentos, agregações, validação e cache isolado |
| `apps/mobile/lib/territorial/production_dashboard.dart` | Painel, filtros, barras interativas, saldos, atenção, detalhes e animações |
| `apps/mobile/lib/tasks.dart` | Acesso contextual na tela operacional de Produção |
| `apps/mobile/lib/data.dart` | Limpeza dos novos snapshots ao sair |
| `apps/mobile/lib/demo.dart` | Campos contratuais adicionados às fixtures existentes; sem alterar quantidades/status anteriores |
| `apps/mobile/lib/territorial/water_dashboard.dart` | Somente texto de situação do painel de Produção, agora disponível; experiência hídrica preservada |
| `apps/mobile/test/production_dashboard_test.dart` | Oito testes novos com subcasos de domínio, API HTTP, cache, UI e acessibilidade |
| `apps/mobile/test/v2_flow_test.dart` | Histórico continua testado; rolagem localiza o lote após a inclusão do novo acesso |
| `docs/design/goldens-v2/Produção-*.png` | Duas referências atualizadas pelo novo botão de acesso; demais mudanças no Git pertencem aos incrementos anteriores |
| `scripts/smoke-production.mjs` | Smoke com Express/MongoDB/Edge reais e base fictícia isolada, sem mocks HTTP |
| `scripts/serve-production-android.mjs` | API isolada para validação Android com a autenticação existente; usa somente loopback |
| `scripts/prepare-production-*.py`, `scripts/refine-production*.py` | Preparadores locais dos roteiros de autoria/teste; não fazem parte do runtime do app |
| `apps/mobile/README.md`, esta pasta | Instruções, auditoria, relatório e evidências |

Não houve edição de backend, portal Next.js ou modelos/dados de ML. Home, sessão, ofertas, pedidos, histórico, rastreabilidade e Inteligência Hídrica V2 continuam cobertos pela suíte. As alterações pré-existentes no workspace foram preservadas.

## Validação final

- **`flutter analyze`: sem problemas** — [log](evidencias/analyze.txt).
- **`flutter test`: 96 testes aprovados**, sem atualizar goldens na rodada final — [log](evidencias/tests.txt).
- **APK Android debug compilado**, inclusive modo normal integrado à API — [build](evidencias/build-android-api.txt).
- **Build Flutter Web aprovado** — [log](evidencias/build-web.txt).
- **Smoke real aprovado**: autenticação, home, hídrico, produção com 205 registros paginados, venda/doação, troca para propriedade vazia e reload; sem erros de console e sem requisições externas — [resultado](evidencias/web-smoke/result.json), [log](evidencias/web-smoke.txt).
- **Emulador Android 16/API 36**: navegação contextual, consulta autenticada pela API isolada via encaminhamento ADB local, seleção de cultura, saldos, acesso a Ofertas, detalhes, propriedade vazia e perda real do acesso à API.
- **320×844 dp e fonte Android 200%** revisados; filtros longos passam a indicar truncamento com reticências. Testes com dados completos, vazio, contraste, alvos Android, rótulos e movimento reduzido também foram executados.

| Caso solicitado | Verificação |
|---|---|
| Várias culturas | API/Android: 103 kg de alface + 102 kg de tomate = 205 kg |
| Propriedade vazia | Troca real para Suzano/SP, 0 kg/0 culturas e saldos zero, sem aproveitar totais da primeira propriedade |
| Produção sem ofertas | Teste: 15,125 kg registrados, duas culturas, disponibilidade zero |
| Venda e doação | API/Android: 0,6 kg venda e 0,2 kg doação |
| Expiradas e rascunhos | Base de teste contém ambas, cada uma com saldo de 1 kg; ficam fora dos 0,8 kg disponíveis |
| Saldo parcialmente reservado/movimentado | Oferta original de 1 kg com 0,4 kg reservado conserva saldo de 0,6 kg; outra com 0,8 kg recebido conserva 0,2 kg. Não houve desconto duplicado |
| Organização/propriedade | Scope e headers testados; cache não cruza usuário/organização/propriedade; troca de propriedade confirmada na API/web/Android |
| Paginação e consistência | Três páginas na API; teste com 206 produções inclui uma de outra propriedade, agrega só 205. Duplicação, total divergente, número inválido e página incompleta recusam totais parciais |
| Offline/desatualização | ADB teve o acesso à API removido: snapshot de 205 kg permanece com aviso de desatualizado. 403 invalida cache; botão Atualizar pode recuperar conexão |
| Telas pequenas/acessibilidade | 320 dp/200%, dados completos e vazios, erro recuperável, semântica, contraste e movimento reduzido |

Os números da validação são **dados demonstrativos identificados**, criados em banco isolado. As capturas Android de integração usam o modo normal do app e respostas reais da API, não valores inseridos diretamente na interface. Eles não representam produção regional real nem dados privados do usuário. Tokens ficam apenas na memória do app e em arquivo temporário de teste sob `.data/`, ignorado pelo Git; não aparecem nos logs ou na gravação.

## Capturas e gravação

- [Total e culturas — API autenticada](evidencias/api-principal.png).
- [Venda, doação e atenção](evidencias/api-saldos.png).
- [Análise detalhada](evidencias/api-analise-detalhada.png).
- [Propriedade vazia em outro município](evidencias/api-propriedade-vazia.png).
- [Snapshot desatualizado após perda da API](evidencias/api-offline.png).
- [320 dp/texto 200%](evidencias/api-texto200.png).
- [Painel e saldos no navegador real](evidencias/web-smoke/production-balances.png).
- [Gravação nativa de aproximadamente 15 segundos](evidencias/navegacao-android.mp4), [metadados](evidencias/video.json). H.264, 780×1688, duração real 14,87 s; decodificação completa sem erros. Mostra atualização, seleção da cultura e acesso aos módulos existentes; sem quadros sintéticos.

## Limites

Sem mudança de backend: as três consultas não são um snapshot transacional. Mudanças de quantidade entre rotas podem ocorrer durante a leitura; o painel mostra a data da consulta e exige atualização, enquanto o backend continua sendo a autoridade das operações. Paginação é recusada se incompleta ou inconsistente; não há promessa de suportar mais que o limite de offset da API.

A análise é por propriedade autorizada, identificada por município/UF. Não foi criado agregado municipal, pois isso poderia confundir registros particulares com estatística regional. A evolução só lista meses com registros suficientes, sem crescimento estimado. Quantidades internas de reserva/retirada/recebimento não são inferidas por diferença do saldo; pedidos são apresentados separadamente quando vinculados.

Primeira autenticação offline, autenticação de produção, benchmark em aparelho físico e estudo de usabilidade com produtores reais continuam fora desta etapa. Logística permanece não implementada. Os roteiros de teste usam bases e processos isolados e não substituem a configuração normal da API do projeto.
