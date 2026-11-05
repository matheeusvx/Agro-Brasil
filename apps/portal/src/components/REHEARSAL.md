# Ofertas — motion rehearsal

Referências: StageShow `references/motion.md` (pace/easing, feedback, whole arrivals, retained exits) e `references/craft.md` (hierarquia, alinhamento e contraste). Thread do X indisponível com HTTP 403. Não foi copiado um gold/kit de UI fictícia: o pedido exige implementar o comportamento no produto real e reutilizar seus componentes existentes.

O foco é lote → rascunho → confirmação → oferta publicada. Não há movimentos sem ação ou resposta correspondente. Entrada do drawer: 280 ms; saída: 180 ms; feedback: 120–220 ms. Mesmos componentes mantidos durante envio. Resultado fica em tela. Radix mantém foco e ciclo de saída.

Verificado em Edge com movimento normal e reduzido; frames reais `ofertas-motion-0/1/2.png`, em `docs/design/portal/evidencias/`. Capturas da lista e drawers em 1440 e 1366, lista também em 1024. O teste verifica duração reduzida e animação nomeada da abertura. Hover e seleção usam transições de superfície, sem deslocar a tabela. Sem timers para atrasar API ou loops decorativos.

Revisão: controle de paginação ajustado para texto, confirmação de publicação fixada no rodapé do drawer, contraste da linha selecionada corrigido. Não foram executados os gates para cenas do kit fictício; a validação usa navegador e API reais. Sem avaliação em Safari/Firefox neste incremento.
