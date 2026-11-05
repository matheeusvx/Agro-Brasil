# Correção da box Sua rotina

Restaurado o card verde original, com confirmação, título, mensagem e texto de ausência de pendências. Largura máxima de 520 px, altura natural em torno de 100 px, padding de 16 por 18 px e ícone de 18 px. Aviso com pendências usa a mesma composição compacta e mantém a consulta real do pedido. Removidos o status textual e os deslocamentos negativos introduzidos no refinamento anterior. Indicadores separados da região superior por 20 px.

Arquivos de implementação alterados: apps/portal/src/components/overview.tsx e apps/portal/src/app/globals.css. Validação atualizada em scripts/smoke-portal.mjs.

Build com TypeScript aprovado. Smoke em Microsoft Edge aprovado: cenários com e sem pendências, consulta de pedido, navegação e Produção. Box verde visível, largura até 520 px, altura até 120 px e distância até os indicadores entre 16 e 24 px verificadas automaticamente nas três resoluções. Auditorias axe sem violações detectadas. Capturas revisadas visualmente em 1440x900, 1366x768 e 1024x768.

Capturas: evidencias/rotina-restaurada-1440.png, evidencias/rotina-restaurada-1366.png e evidencias/rotina-restaurada-1024.png. Dados das capturas pertencem exclusivamente ao banco isolado do teste. Clima, gráficos, indicadores, sidebar, API e Android não foram alterados neste ajuste. Legenda compacta, remoção do aviso da sidebar e remoção do rodapé permanecem.

Sem commit ou push.
