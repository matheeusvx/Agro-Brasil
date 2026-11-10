# CLAUDE.md — Agro+ Brasil

Projeto acadêmico FIAP Global Solution CitizenTech 2026.2 (case *Territory Predictive Insights*). Plataforma que conecta excedentes de pequenos produtores rurais à demanda de cooperativas, instituições e compradores locais. **Público principal do app: pequeno produtor rural.** Linguagem simples, pt-BR; telas operacionais não viram relatórios técnicos.

Pilares: oferta x demanda; gestão da produção/excedentes; logística e rastreabilidade (origem → recebimento); informação acessível; inteligência hídrica como recurso complementar.

## Arquitetura (monorepo, não reconstruir)

| Caminho | O que é |
|---|---|
| `apps/mobile/` | Flutter/Dart (Android + Flutter Web). `lib/territorial/` = dashboards |
| `apps/portal/` | Portal de gestão Next.js/TypeScript (porta 3100) |
| `apps/web/` | Protótipo HTML/CSS/JS acadêmico |
| `services/api/` | API Express 5 + MongoDB (replica set; porta API 3000, Mongo 27017) |
| `analytics/agro-agua/` | Python: pipeline, EDA e ML (AGUA-02..04), exports auditados |
| `modules/java-monitoramento/` | Java 21/Maven: console Agro+ Água, H2/JDBC, medições simuladas; independente do resto |
| `docs/` | Requisitos, arquitetura, design system V2, evidências |
| `scripts/` | Mongo local, seed, smoke tests, capturas Android |

`.agents/` e `skills-lock.json` são ferramentas locais (gitignored).

## Estado atual

- Tudo integrado na `main` em 10/11/2026 (Minha Fazenda e Java incluídos); CI em `.github/workflows/ci.yml`.
- Portal: Visão geral, Produção, Ofertas, Pedidos, Rastreabilidade visual, Minha Fazenda.
- Flutter: home personalizada, Produção, Ofertas, Pedidos, Histórico, auth demonstrativa, cache offline, **Inteligência Hídrica V2** (`water_dashboard.dart`), **Produção e Excedentes V1** (`production_dashboard.dart`), **Logística** (`logistics_dashboard.dart`).
- **Pendente (plano em `docs/planejamento/diagnostico-2026-11-10.md`):** indicador de impacto/benefício social, alertas explicados, vídeo/pitch. Fora de escopo: QR Code, auth de produção, telas dos outros públicos, iOS/dispositivo físico.
- Última validação (10/11/2026, `docs/planejamento/etapa-a-resultado.md`): 126 testes Flutter, `flutter analyze` limpo, 27 + 50 testes da API, 43 do portal, 199 do Java, build web e smoke. Prazo Flutter: 19/11/2026 23h55 (America/Sao_Paulo).

## Decisões de UX (preservar)

- Verde profundo (#173F32), creme (#FAF8F1), branco; minimalista; cards com hierarquia clara; animações suaves e intencionais; respeitar `disableAnimations`; alvos ≥ 48 dp; testar 390×844, 320×844 e texto 200%.
- Reutilizar `dashboard_components.dart` (DashboardCard, IndicatorCard, DashboardBarChart, DashboardStateView, TerritorialHeader…) e tokens de `design.dart` / `docs/design/DESIGN_SYSTEM_V2.md`.
- Mostrar primeiro o que importa ao produtor; explicação técnica fica recolhida em "Ver análise detalhada". A 1ª versão hídrica era complexa; a V2 tem 3 cards na tela principal. Não criar cards/gráficos sem propósito.
- Pedido de "reduzir/simplificar" ≠ remover componentes.

## Regras de integridade

- Só dados reais do backend ou demonstrativos **claramente identificados**. Nada de estatísticas municipais inventadas.
- Produção registrada ≠ excedente. Excedente = `availableKg` de ofertas PUBLICADAS com prazo futuro (já descontadas reservas).
- Retirada ≠ recebimento confirmado (recebimento cabe ao destinatário).
- Não inventar trajetos, GPS, distâncias, horários ou eventos logísticos; só eventos confirmados pela API.
- Preservar autorização por usuário/organização/propriedade; API é a autoridade. 401/403/404 não ativam fallback de cache.
- Nunca expor tokens/credenciais (`.env`, `.data/demo-sessions.json` ficam fora de commits, prints e logs). Token só em memória.
- Não alterar regras comerciais sem necessidade comprovada. Hídrico: nada de "condição atual", solo, irrigação ou previsão; Ridge não é apresentado como previsão.

## Ambiente (Windows/PowerShell) — conferir `package.json` antes de rodar

```powershell
npm.cmd ci --cache .cache/npm ; Copy-Item .env.example .env
npm.cmd run db:local        # terminal 1: mongod real (replica set agroLocal)
npm.cmd run seed:demo ; npm.cmd start   # terminal 2: API em 127.0.0.1:3000
npm.cmd run check ; npm.cmd test ; npm.cmd run test:integration
cd apps/mobile ; flutter analyze ; flutter test
cd apps/portal ; npm.cmd run typecheck ; npm.cmd test
cd modules/java-monitoramento ; mvn "-Dmaven.repo.local=.m2/repository" clean verify   # Maven fora do PATH: ver README do módulo
npm.cmd run build:mobile ; npm.cmd run test:mobile:smoke
./scripts/connect-android-local.ps1 -Device emulator-5554   # adb reverse tcp:3000 tcp:3000
```

Portal: `cd apps/portal; $env:PORTAL_DEMO_ENABLED='true'; $env:AGRO_API_URL='http://127.0.0.1:3000'; npm run dev`.
Atualizar goldens só de forma deliberada (`flutter test --update-goldens`, ver `docs/design/goldens-v2/`).

## Documentos-chave

`README.md` · `apps/mobile/README.md` · `docs/requisitos/api.md` · `docs/requisitos/conformidade.md` (matriz rubrica → evidência) · `docs/planejamento/diagnostico-2026-11-10.md` · `docs/arquitetura/` · `docs/design/DESIGN_SYSTEM_V2.md` · `docs/design/territorial/` (hídrico) · `docs/design/production/` · `docs/design/logistics/` · `docs/design/minha-fazenda/` · `modules/java-monitoramento/README.md` · `analytics/agro-agua/docs/agua04-contrato-integracao.md`.

## Processo

Sem commit/push automático. Documentar mudanças em `docs/design/<área>/resultado.md` com evidências reais.
