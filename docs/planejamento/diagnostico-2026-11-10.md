# Diagnóstico e plano até a entrega — 10/11/2026

Revisão feita por leitura do código e dos documentos na branch `feat/web-minha-fazenda`
(commit `b34627b`). Nenhum teste foi executado nesta revisão e nada foi alterado.
Não foi confirmado se o repositório no GitHub está público (exigência da entrega Flutter).

Prazo Flutter: 19/11/2026 23h55 (America/Sao_Paulo). Projeto individual.

## 1. Distância entre o projeto e o propósito

O propósito descreve uma ponte entre quatro públicos, com rastreabilidade e impacto
(econômico, social, ambiental) avaliado por indicadores. O que existe hoje é um bom
aplicativo de gestão para o pequeno produtor rural.

| # | Lacuna | Evidência no código |
|---|---|---|
| P1 | Só o produtor tem interface | Portal e Flutter filtram `PEQUENO_PRODUTOR_RURAL` (`apps/portal/src/lib/server-session.ts`, `portal-shell.tsx`, `api/session/route.ts`). Os outros três públicos só existem na API e em `apps/web` |
| P2 | Nenhum indicador de impacto | Nenhuma ocorrência de benefício/impacto/desperdício em `apps/mobile/lib`, `apps/portal/src` ou `services/api/src`. Os dados já existem em `offers`: `receivedGrams`, `destinationMode`, `unitPriceCents`. "Benefício social" é item da rubrica Flutter |
| P3 | Excedente que vence não tem saída | Índice único `offers.lotId` (uma oferta por lote, `database.mjs`); só existem `POST /offers` e `POST /offers/:id/publish`. Sem cancelar, prorrogar ou converter venda em doação. Sem registro de perda. Recebimento parcial recusado (`commerce.mjs`) |
| P4 | A demanda não tem voz | Não há publicação de necessidade por instituição. `GET /offers` público não filtra por cultura, município ou modalidade. Cooperativa só atua como transportadora (`POST /orders` aceita apenas `INSTITUICAO` e `COMPRADOR_LOCAL`) |
| P5 | Sem validação com usuários | Declarado em `docs/requisitos/conformidade.md` e `docs/planejamento/execucao-inicial.md` (VAL-01 não executado) |

## 2. Falhas de entrega

| # | Falha | Detalhe |
|---|---|---|
| E1 | Três branches sem integrar | `main` (`8c2ea75`) não tem a Minha Fazenda (`feat/web-minha-fazenda`, 43 arquivos) nem o Java (`feat/poo-java`, 57 arquivos, 19 classes de teste). Nesta branch, `modules/java-monitoramento/` só tem `target/` compilado e README dizendo "sem implementação" |
| E2 | Documentação desatualizada | `README.md` diz que dashboards Flutter, modelos hídricos e Java não existem. `CLAUDE.md` dá Logística como pendente e cita 97 testes; `docs/design/logistics/resultado.md` registra a entrega em 09/11 com 123 testes. `conformidade.md` ainda lista Flutter, Data Science e Java como pendentes |
| E3 | "Alertas explicados" (rubrica Flutter) | `water_dashboard.dart` declara que não emite alertas. Os avisos existentes ("oferta vence em até 3 dias" em `production_dashboard.dart`; "O que precisa da sua ação" em `logistics_dashboard.dart`) não são apresentados como alertas com explicação |
| E4 | Software Engineering | Trello não confirmado, sem registros Scrum; pitch e vídeo pendentes |
| E5 | Higiene do repositório | Rastreados na raiz: `simplify_water.py`, `simplify_water_checks.py`, `simplify_water_copy.py`, `COMO_USAR.txt`; `apps/portal/src/components/REHEARSAL.md`. 1.376 imagens/vídeos versionados. Sem `.github/` (CI). Portal sem lint |
| E6 | Bug em aberto | Painel de Logística abriu já rolado para baixo 3 vezes no emulador, sem causa identificada (`docs/design/logistics/resultado.md`, "Observação em aberto") |
| E7 | Prioridade | A Minha Fazenda consumiu milhares de linhas num recurso ilustrativo enquanto P1 a P3 ficaram descobertos |

## 3. O que está sólido (preservar)

- API: transações reais, idempotência por `Idempotency-Key`, autorização por organização, saldos em gramas inteiras.
- Data Science: protocolo com teste aberto uma única vez e limites declarados (Ridge não é previsão).
- Flutter: três dashboards com cache isolado, acessibilidade e testes.
- Regras de integridade do `CLAUDE.md`.

## 4. Metodologias a adotar

1. **Matriz rubrica → evidência**: uma linha por requisito de cada disciplina, com o arquivo ou vídeo que o comprova. Substitui `conformidade.md`.
2. **Funil do excedente** como métrica de impacto: kg registrado → ofertado → reservado → retirado → recebido → vencido, separando venda de doação. Recebido é o único estágio que conta como alimento aproveitado.
3. **Integração contínua**: tudo na `main`; GitHub Actions com `npm test`, `flutter analyze` e `flutter test`.
4. **Congelamento de escopo em 17/11**, como já previsto em `execucao-inicial.md`.
5. **Validação enxuta**: 3 a 5 conversas de 15 minutos com roteiro fixo, registradas de forma anônima.

## 5. Plano até 19/11

| Quando | Etapa | Critério de pronto |
|---|---|---|
| 10–11/11 | **A. Integração e documentação**: unir as três branches na `main`; atualizar README, CLAUDE.md; criar a matriz de rubrica; ligar o CI | `main` contém portal, Flutter, Java e analytics; suíte completa aprovada; docs descrevem o estado real |
| 12–13/11 | **B. Indicador de impacto**: endpoint somente leitura com o funil do excedente; um card no Flutter e um no portal | Números batem com os saldos das ofertas em teste de integração; dados demonstrativos identificados; nada tratado como impacto real |
| 14/11 | **C. Alertas explicados e bug de rolagem** | Avisos existentes apresentados como alertas com o motivo; bug reproduzido ou descartado com evidência |
| 15–16/11 | **D. Resgate do excedente e filtros**: converter em doação ou prorrogar oferta perto do prazo; filtros na lista pública de ofertas | **Depende de decisão do autor** (altera regra comercial). Transação, idempotência e evento de rastreabilidade como nas demais operações |
| 17/11 | **E. Congelamento**: suíte completa; jornada dos quatro públicos ensaiada com `apps/web`; conversas de validação | Nenhuma funcionalidade nova depois desta data |
| 18/11 | **F. Entrega**: vídeo de até 3 min, pitch, evidências, Trello | Matriz de rubrica sem linha em aberto |
| 19/11 | **G. Envio** até o meio-dia | Folga para o prazo das 23h55 |

Fora do plano: telas próprias para cooperativa, instituição e comprador. Não cabem no prazo, e `apps/web` já demonstra a jornada completa.

## 6. Decisões em aberto

- **Etapa D**: fazer o resgate do excedente (muda regra comercial) ou ficar só com o indicador de impacto, que já cobre a rubrica.
- **Etapa A**: ordem e forma de integrar as branches (merge ou rebase) e se a limpeza do E5 entra no mesmo passo.
- **Repositório público**: confirmar no GitHub.

## 7. Errata (conferência de 10/11, antes da etapa A)

As evidências de P1 a P5, E1 a E3 e E6 foram conferidas no código e batem. Diferenças:

- **E5, mídias:** são 1.381 imagens/vídeos versionados, não 1.376; 1.031 estão em `docs/design/portal`.
- **E5, higiene:** faltou `apps/mobile/test/failures/` (artefatos de falha de golden versionados). Removido na etapa A.
- **E1, Java nesta branch:** no git só havia o README; `target/` e `.m2/` eram arquivos locais não rastreados.
- **E1, branches:** existe também `codex/fundacao-agro-brasil`, já contida na `main`.
- **E2, testes Flutter:** a suíte integrada registrou 126 testes em 10/11 (o log de 09/11 registrava 123).
- **Repositório público:** informado pelo autor; reconferir no GitHub no dia do envio.

Resultado da etapa A: [etapa-a-resultado.md](etapa-a-resultado.md).
