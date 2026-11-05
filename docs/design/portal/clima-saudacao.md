# Clima integrado à saudação

Alterados: apps/portal/src/components/overview.tsx, apps/portal/src/app/globals.css e scripts/smoke-portal.mjs.

Removido o card climático e sua coluna. O subtítulo foi substituído por temperatura em Celsius e município da propriedade selecionada, com ícone pequeno, aviso de referência aproximada quando aplicável e atribuição discreta com logo oficial pequeno e link OpenWeather. Ausência ou temperatura inválida apresenta Clima indisponível. Não há GPS nem valores meteorológicos fixos no produto. Mantidos serviços/contratos existentes, box Sua rotina de até 520px e espaçamento de 20px até os indicadores. Demais componentes preservados.

Build/TypeScript e smoke em Microsoft Edge aprovados. Revisão visual em 1440x900, 1366x768 e 1024x768. Testados clima indisponível, resposta disponível, referência aproximada e alteração da propriedade com temperatura e cidade diferentes. Dados meteorológicos desses cenários são fixtures controladas somente no teste isolado; não representam medições atuais. A aplicação continua usando o endpoint meteorológico existente. Auditoria axe do cabeçalho com clima sem violações detectadas.

Capturas: evidencias/clima-saudacao-1440.png, evidencias/clima-saudacao-1366.png, evidencias/clima-saudacao-1024.png, evidencias/clima-indisponivel.png e evidencias/clima-troca-propriedade.png. Relatório automático em evidencias/result.json.

Sem alterações no backend ou Android. Sem commit ou push.
