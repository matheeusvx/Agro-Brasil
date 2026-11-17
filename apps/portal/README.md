# Agro+ Brasil — portal de gestão

**Produção, excedentes e logística em um só lugar, conectando pequenos produtores rurais, cooperativas e instituições.**

Projeto acadêmico — FIAP, Global Solution 2026.2 · desafio *Territory Predictive Insights*.

## Problema e público

Pequenos produtores têm dificuldade para encontrar destino para o excedente antes do vencimento e acompanhar sua entrega. O Agro+ Brasil organiza o registro da produção, a publicação de ofertas para venda ou doação e o acompanhamento de pedidos, remessas e recebimentos, com histórico de origem dos lotes.

O portal atende **pequenos produtores rurais, cooperativas e instituições**, com telas e permissões por perfil. O impacto esperado é reduzir excedentes sem destinação e facilitar a distribuição local de alimentos; os indicadores permitem acompanhar o que foi ofertado e o que teve recebimento confirmado.

## ODS relacionados

| ODS | Relação com a proposta |
| --- | --- |
| **2 — Fome zero e agricultura sustentável** | Facilitar o acesso a alimentos por meio de ofertas e doações locais, valorizando o pequeno produtor. |
| **12 — Consumo e produção responsáveis** | Apoiar a redução do desperdício de alimentos (meta 12.3), acompanhando os excedentes e sua destinação. |

O alinhamento aos ODS representa o objetivo do projeto; os dados de demonstração não comprovam redução real da fome ou do desperdício.

## Funcionalidades e tecnologias

- Visão geral com produção, pedidos, gráficos por cultura e situação, além do clima regional quando disponível.
- Cadastro e consulta de produção, ofertas, pedidos, destino dos excedentes e rastreabilidade.
- Remessas para cooperativas, solicitações e ofertas disponíveis para instituições, além de mensagens entre participantes autorizados.
- Interface em português, com estados de carregamento, erro e lista vazia e suporte à redução de movimento.

**Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, Radix e Recharts. O portal consome a API Agro+ Brasil, construída com Node.js, Express e MongoDB.

## Como executar

Pré-requisitos: **Node.js 22.19+**, npm e PowerShell. Execute os comandos a partir da raiz do repositório. O MongoDB local é iniciado pelo script abaixo; a primeira execução pode baixar seu binário.

```powershell
npm.cmd ci
Copy-Item .env.example .env  # se ainda não existir; preserve configurações locais
npm.cmd run db:local        # terminal 1: mantenha o MongoDB em execução
```

Em outro terminal, na raiz, prepare os dados e inicie a API:

```powershell
npm.cmd run seed:demo
npm.cmd start              # terminal 2: API em http://127.0.0.1:3000
```

Em um terceiro terminal, na raiz, inicie o portal:

```powershell
cd apps/portal
npm.cmd ci
Copy-Item .env.example .env.local  # se ainda não existir
npm.cmd run dev
```

Abra **http://127.0.0.1:3100** e entre com o token de pequeno produtor disponível em `.data/demo-sessions.json`, na raiz. Não publique esse arquivo. Selecione a organização e a propriedade autorizadas no cabeçalho. Para preparar os demais públicos, consulte os scripts e instruções no [README da raiz](../../README.md).

O arquivo `.env.local` configura `PORTAL_DEMO_ENABLED=true` e `AGRO_API_URL=http://127.0.0.1:3000`. O clima é opcional e depende de `WEATHER_ENABLED` e `OPENWEATHER_API_KEY` no `.env` do **backend**. O acesso por token é demonstrativo e local; reiniciar o servidor do portal encerra as sessões.

## Indicadores e interpretação

Os indicadores usam os registros autorizados da propriedade ou organização selecionada. Os dados operacionais do seed são fictícios.

| Indicador | Como é calculado e o que significa |
| --- | --- |
| **Produção registrada e lotes com origem** | Soma das quantidades registradas, em kg, e contagem dos registros de produção. O gráfico por cultura agrupa e soma esses quilos; produção registrada não equivale a excedente. |
| **Pedidos em aberto e por situação** | Em aberto: contagem dos pedidos `SOLICITADO`, `ACEITO` e `RETIRADO`. O gráfico agrupa a quantidade de pedidos por situação para mostrar o andamento operacional. |
| **Destino dos excedentes** | Valores calculados pela API: produção registrada → ofertado → aceito líquido → retirado → recebido. São etapas acumuladas do mesmo fluxo e não devem ser somadas. O recebimento exige confirmação do destinatário. |
| **Saldos dos excedentes** | Distribuem o ofertado entre recebido, em trânsito, reservado, disponível no prazo e vencido sem destinação. Oferta vencida com saldo não comprova perda física do alimento. |
| **Venda e doação** | Comparam os quilos ofertados e recebidos por modalidade. O percentual de recebimento é `recebido ÷ ofertado × 100`; sem oferta, não há base para interpretar a taxa. |
| **Remessas e solicitações por organização** | Totais de operações e distribuição por situação, com contagens e quilos fornecidos pela API para cooperativas e instituições. |
| **Clima hoje** | Temperatura e condições regionais fornecidas pela OpenWeather via backend. A referência pode ser aproximada do município; não é medição na propriedade nem previsão de perda da safra. |

Falhas de consulta são exibidas como indisponibilidade, sem estimar valores. Os indicadores apoiam a avaliação humana e não comprovam impacto social ou ambiental por si só.

## Validação e documentação

Em `apps/portal`, execute `npm.cmd run typecheck` e `npm.cmd test`. Para produção local: `npm.cmd run build` e `npm.cmd start` (porta 3100).

Na raiz, após instalar as dependências e gerar o build do portal, `node scripts/smoke-portal.mjs` executa a validação de ponta a ponta com banco isolado e Microsoft Edge no Windows. Para Ofertas, use `node scripts/smoke-portal.mjs --offers`.

Consulte a [documentação do portal](../../docs/design/portal/) e o [README mobile](../mobile/README.md). Projeto de uso educacional, sem garantia para produção; os avisos de licença dos assets estão em `public/`.
