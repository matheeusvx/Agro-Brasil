# Logística — terceiro dashboard territorial

09/11/2026. Implementado no Flutter existente. Sem commit ou push. Contratos auditados em [auditoria.md](auditoria.md).

## Acesso e resultado

Abra **Pedidos → Acompanhar logística**. A ordem da tela segue o que o produtor precisa saber:

1. **Pedidos em andamento**: número em destaque, kg somados e quantos já foram recebidos.
2. **Situação das movimentações**: barras por situação. Tocar em uma mostra os produtos daquela etapa e se a operação é direta ou com cooperativa. Abre em “Aguardando retirada”.
3. **O que precisa da sua ação**: até três pedidos, a espera mais antiga primeiro. Cada um abre só aquele pedido em Pedidos.
4. **Onde já foi confirmado**: até três municípios, só quando há retirada ou recebimento com local confirmado.

Análise por quantidade, forma de operação e lista completa de municípios ficam em **Ver análise detalhada**. Sem pedidos, o painel mostra um único cartão que leva a Ofertas, sem indicadores zerados.

## Regras aplicadas

| Regra | Implementação |
|---|---|
| Em andamento | `SOLICITADO` + `ACEITO` + `RETIRADO`. Cancelado e recebido ficam fora |
| Ação do produtor | Responder solicitação e registrar retirada de operação **direta**. Com cooperativa ou aguardando destinatário, a vez é de outro participante |
| Retirada ≠ recebimento | Retirar não altera “recebidos”. O painel diz que só o destinatário confirma |
| Quantidades | Somadas em gramas inteiras, exibidas em kg |
| Município/UF | Só eventos `RETIRADA_REGISTRADA` e `RECEBIMENTO_CONFIRMADO` do pedido, com `locationConfirmedAt`. Origem de lote não entra |
| Sem invenção | Nada de rota, distância, GPS, previsão ou “atrasado”; o contrato não tem esses dados |
| Isolamento | Só lotes da propriedade com vendedor igual à organização dona. Compras e transportes da mesma organização ficam fora |
| Cache | Por origem, usuário, organização e propriedade. Guarda só o que a tela exibe, sem IDs de terceiros nem dados pessoais. Logout remove |
| Falhas | Rede/5xx usa a cópia, marcada como desatualizada e sem ações. 401/403/404 e contrato inválido apagam a cópia e não exibem totais parciais |
| Paginação | Todas as páginas, recusando total divergente ou duplicidade. Eventos só de lotes com pedido retirado/recebido, no máximo 4 consultas simultâneas |

## Design e movimento

Reutiliza `DashboardCard`, `DashboardHeading`, `DashboardStateView`, `dashboardMotion` e os tokens existentes. Dos princípios StageShow: todo movimento tem causa e nenhum dado volta atrás sem motivo. Do Revenue-Centric Design: número principal primeiro, menos indicadores e um painel que diz o que fazer.

Entrada dos cartões em cascata de 60 ms (deslocamento de 8 px), barras crescendo do zero, seleção com fundo animado e detalhe que acomoda a altura, expansão suave. Nenhuma animação sugere produto em movimento físico. `disableAnimations` e navegação acessível zeram tudo, e um teste confirma que não sobram quadros agendados.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `apps/mobile/lib/territorial/logistics_data.dart` | Novo: consulta, validação, projeção, cache e agregações |
| `apps/mobile/lib/territorial/logistics_dashboard.dart` | Novo: tela, gráfico, ações, território, detalhes e animações |
| `apps/mobile/lib/tasks.dart` | Botão “Acompanhar logística” em Pedidos |
| `apps/mobile/lib/data.dart` | Logout remove o novo cache |
| `apps/mobile/lib/demo.dart` | Fixtures com `shipment.status` e `id` de evento, como no contrato real |
| `apps/mobile/lib/territorial/water_dashboard.dart` | **Somente** o texto “Logística · não implementado”, que ficou falso |
| `apps/mobile/test/logistics_dashboard_test.dart` | 26 testes novos |
| `apps/mobile/test/live_logistics_api.dart` | Teste HTTP real, de execução explícita |
| `docs/design/goldens-v2/Pedidos-*.png` | 2 referências atualizadas pelo botão novo |
| `scripts/serve-logistics-android.mjs` | API isolada: banco temporário, estados criados só por comandos HTTP reais |

Portal Next.js, backend, Produção/Excedentes e a lógica da Inteligência Hídrica não foram alterados.

## Validação

- **`flutter analyze`: sem problemas** — [log](evidencias/analyze.txt).
- **`flutter test`: 123 testes aprovados** (97 anteriores + 26 novos) — [log](evidencias/tests.txt).
- **Teste HTTP real aprovado** contra Express/MongoDB com transações — [log](evidencias/api-real.txt).
- **APK debug** e **Flutter Web** compilados — [Android](evidencias/build-android.txt), [Web](evidencias/build-web.txt).

| Caso pedido | Verificação | Evidência |
|---|---|---|
| Pedidos em diferentes estados | API real: 2 solicitados, 2 aceitos, 2 retirados, 3 recebidos, 2 cancelados; 6 em andamento, 35,5 kg | [principal](evidencias/principal.png) |
| Fluxos direto e com cooperativa | 4 diretos e 3 com cooperativa, retirada pela cooperativa real; cooperativa não vira ação do produtor | [detalhes](evidencias/analise-detalhada.png) |
| Cancelados | Antes e depois do aceite, fora do andamento; somente cancelados mostra zero e nada pendente | Testes e [detalhes](evidencias/analise-detalhada.png) |
| Movimentações confirmadas | Mogi 3 e Suzano 2 retiradas; São Paulo 2 e Guarulhos 1 recebimentos | [território](evidencias/territorio.png) |
| Ação de ponta a ponta | Retirada registrada pelo app: aguardando retirada 2→1, retirados 2→3, em andamento segue 6, Mogi 3→4 | [antes](evidencias/acao-pedido.png), [depois](evidencias/apos-retirada.png) |
| Propriedade sem pedidos | Troca real para Suzano/SP sem herdar totais; volta restaura os números | [vazia](evidencias/propriedade-vazia.png), [volta](evidencias/volta-propriedade.png) |
| Alternância de organização | Mesmo usuário, organização B: só 1 pedido, 20 kg | [organização B](evidencias/organizacao-b.png) |
| Isolamento | Testes com outra propriedade, organização, comprador e transportadora; propriedade alheia retorna 403 na API real; cache sem dados de terceiros | Testes e [log](evidencias/api-real.txt) |
| API indisponível e offline | Encaminhamento removido: cópia com aviso, sem ações nem atalhos; religado, recupera | [offline](evidencias/offline.png), [sem ações](evidencias/offline-acoes.png), [recuperado](evidencias/recuperado.png) |
| Emulador Android | `emulator-5554`, Android 16, modo normal do app, login e API reais | [gravação](evidencias/navegacao-android.mp4) |
| Texto ampliado e tela pequena | 320 dp com fonte Android 200%, sem cortes; 2 testes com movimento reduzido | [topo](evidencias/texto200-topo.png), [gráfico](evidencias/texto200-grafico.png), [ações](evidencias/texto200-acoes.png) |

A [gravação nativa](evidencias/navegacao-android.mp4) tem 14,6 s, H.264, 780×1688, 256 quadros, sem quadros sintéticos ([metadados](evidencias/video.json)). Mostra entrada, troca de situação e rolagem até ações e municípios. A expansão dos detalhes não entrou no vídeo; está na [captura](evidencias/analise-detalhada.png) e nos testes.

Todos os números são **dados demonstrativos identificados**, criados em banco temporário já removido. O token ficou em memória e em arquivo ignorado pelo Git, apagado ao final. A entrada foi feita antes da gravação, e a captura mostra o campo mascarado.

## Observação em aberto

Nas primeiras aberturas no emulador, o painel apareceu 3 vezes já rolado para baixo. Depois disso não ocorreu em 22 aberturas seguidas, 10 delas com registro de toques e rolagem, e 12 no APK limpo. O painel não tem nenhuma rolagem programática. A causa não foi identificada; uma entrada externa no emulador é possível, mas não foi comprovada. Vale observar durante o uso.

## Limites

- As consultas de pedidos e eventos não formam um snapshot transacional. A tela informa o horário da consulta, e um recebimento confirmado entre as leituras só conta na próxima atualização.
- Lotes com pedido retirado ou recebido geram uma consulta de eventos cada, pois a API não tem leitura em lote. Com muitos lotes, o carregamento fica mais lento.
- A tela de Pedidos já existente mostra “Pedido · 12 kg”, sem cultura; não foi alterada. O painel mostra a cultura.
- A build Web foi compilada, mas o painel não foi percorrido no navegador. Aparelho físico e estudo com produtores reais não fizeram parte desta etapa.
- O painel existe no app do produtor; as telas dos demais públicos continuam fora de escopo.
