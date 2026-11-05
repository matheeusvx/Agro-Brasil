# Refinamento pontual da home

Alterados: src/components/overview.tsx (status sem card e aviso limitado a 600px), src/components/operational-charts.tsx (legenda textual compacta), src/components/portal-shell.tsx (remoção do bloco demonstrativo e rodapé), src/app/globals.css (composição e espaçamento), scripts/smoke-portal.mjs (cenários adicionais).

A identificação demonstrativa permanece no acesso e na sessão/perfil. Clima, cálculos dos gráficos e contratos da API foram preservados. Android e backend não foram editados.

Validação: build/TypeScript aprovados, 6 testes unitários aprovados e smoke em Edge aprovado. Cenários com/sem pendências, categoria única/múltipla, sidebar recolhida/expandida e páginas sem rodapé. Home revisada em 1440x900, 1366x768 e 1024x768. Auditorias axe da home, lista, detalhes, cadastro e home sem pendências sem violações detectadas. Fixture adicional existe somente no banco isolado do teste.

Capturas em evidencias/: home-1440.png, home-1366.png, home-1024.png, sidebar-recolhida.png e sem-pendencias-categoria-unica-{1440,1366,1024}.png. Resultado automatizado em evidencias/result.json.

Sem commit ou push.
