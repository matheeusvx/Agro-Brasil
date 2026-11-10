# Matriz rubrica → evidência

Atualizada em 10/11/2026 (etapa A do [plano](../planejamento/diagnostico-2026-11-10.md)).
Substitui a antiga lista de pendências. Uma linha por requisito; a entrega só é enviada com
nenhuma linha "Em aberto".

Os requisitos abaixo vêm da lista que este repositório já mantinha. **Conferir cada linha com o
enunciado oficial de cada disciplina antes do envio** — esta matriz não substitui a rubrica.

Status:

- **Comprovado** — executado e medido em 10/11/2026 ([resultado da etapa A](../planejamento/etapa-a-resultado.md)).
- **Indicado** — o arquivo existe e é citado, mas o requisito não foi reconferido nesta etapa.
- **Em aberto** — sem evidência; a coluna "Fecha em" diz a etapa do plano.

## Cross-Platform (Flutter) — prazo 19/11/2026 23h55

| Requisito | Status | Evidência | Fecha em |
|---|---|---|---|
| ≥ 5 telas | Indicado | `apps/mobile/lib/` (home, Produção, Ofertas, Pedidos, Histórico, 3 dashboards); `apps/mobile/README.md` | F |
| ≥ 3 dashboards territoriais | Comprovado | `apps/mobile/lib/territorial/water_dashboard.dart`, `production_dashboard.dart`, `logistics_dashboard.dart`; testes aprovados | — |
| Gráficos, históricos e tendências | Indicado | `dashboard_components.dart` (DashboardBarChart); `docs/design/territorial/resultado.md`, `docs/design/production/resultado.md`, `docs/design/logistics/resultado.md` | F |
| Alertas explicados | **Em aberto** | Avisos existem em Produção e Logística, mas não são apresentados como alertas com motivo | C |
| Estado local/global | Indicado | Global: `HomeController` (`ChangeNotifier`) em `apps/mobile/lib/data.dart`; local: `setState` em `apps/mobile/lib/tasks.dart` | F |
| Consumo de API | Comprovado | `npm run test:mobile:smoke` aprovado; `docs/design/logistics/evidencias/api-real.txt` | — |
| Funcionamento offline | Indicado | Cache por painel (`*_data.dart`); testes de offline nos três dashboards | F |
| Formulário | Indicado | Registro de produção com confirmação de origem (`apps/mobile/lib/tasks.dart`) | F |
| Acessibilidade | Comprovado | Testes de 320 dp, texto 200%, contraste, alvos de toque e movimento reduzido na suíte Flutter | — |
| Benefício social | **Em aberto** | Nenhum indicador de impacto no código | B |
| README | Comprovado | `README.md`, `apps/mobile/README.md` | — |
| Repositório público | Indicado | Informado pelo autor em 10/11; reconferir no GitHub no dia do envio | G |
| Vídeo ≤ 3 min | **Em aberto** | — | F |

## Application Development (Web + API)

| Requisito | Status | Evidência | Fecha em |
|---|---|---|---|
| Web HTML/CSS/JS | Indicado | `apps/web/` | F |
| Express GET/POST, validação, erros/404 | Comprovado | `services/api/src/`; `npm test` (27) e `npm run test:integration` (50) aprovados | — |
| MongoDB real, listagem, total e distribuição por cultura | Comprovado | `services/api/test/integration.test.mjs` | — |
| README | Comprovado | `README.md` | — |
| Pitch de 2–3 min | **Em aberto** | — | F |

## Data Science

| Requisito | Status | Evidência | Fecha em |
|---|---|---|---|
| Dados reais da RMSP, tratamento e EDA | Indicado | `analytics/agro-agua/pipeline.py`, `eda.py`, `docs/agua02-*.md` | F |
| Dois modelos avaliados | Indicado | `analytics/agro-agua/ml.py`, `docs/agua03-protocolo.md`, `docs/agua03-conclusoes.md` | F |
| Relatório e síntese executiva | Indicado | `analytics/agro-agua/docs/agua04-relatorio-final.md`, `synthesis_pdf.py` | F |

Os testes Python não foram reexecutados na etapa A e não estão no CI.

## POO Java

| Requisito | Status | Evidência | Fecha em |
|---|---|---|---|
| Implementação e padrões | Comprovado | `modules/java-monitoramento/src/main/java/` (estratégia de previsão, fábrica, DAO); build aprovado | — |
| Persistência | Comprovado | H2/JDBC em `persistencia/`; testes de reinício e H2 aprovados | — |
| Console | Indicado | `modules/java-monitoramento/README.md`, seção 7 | F |
| ≥ 5 testes JUnit com Mockito | Comprovado | 199 testes aprovados (`mvn clean verify`); Mockito em 2 classes de teste da camada de serviço | — |

As medições do módulo são simuladas; o resultado não comprova vazamento nem desperdício real.

## Software Engineering

| Requisito | Status | Evidência | Fecha em |
|---|---|---|---|
| Arquitetura e critérios | Indicado | `docs/arquitetura/`, `docs/planejamento/execucao-inicial.md` | F |
| Integração contínua | Indicado | `.github/workflows/ci.yml`; passa a Comprovado após o primeiro run verde na `main` | A |
| Quadro real (Trello), responsáveis/horas, registros Scrum | **Em aberto** | Nenhuma edição de Trello foi feita por este repositório | F |
| Capturas e PDF | **Em aberto** | — | F |

## Fora deste repositório

Aprendizado Profundo (MLP roubo/furto SP), Sistemas Operacionais/Redes (documento Windows
Server/SMB/NTFS/RAID) e Edge Computing (aguardando escopo do professor) têm controle
acadêmico separado.

## Limites

- As datas das disciplinas, exceto Flutter, precisam de confirmação.
- Este repositório não prova validação com usuários reais (VAL-01 não executado; previsto para a etapa E) nem impacto social.
- Dados de demonstração não representam impacto real.
