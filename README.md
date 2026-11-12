# Agro+ Brasil

Fundação técnica CitizenTech / Territory Predictive Insights — FIAP Global Solution 2026.2.
Projeto individual: **Matheus Morelli Rodrigues — RM 562765**.

Atualização documental: **12/11/2026**, referência `main` em `89d6f30c` ([PR #1 integrado](https://github.com/matheeusvx/Agro-Brasil/pull/1)).

Uma plataforma para **pequenos produtores rurais, cooperativas, instituições e compradores locais**, com três pilares: conexão de excedentes à demanda e logística; rastreabilidade; gestão da produção e inteligência hídrica. As necessidades desses públicos são hipóteses a investigar, não resultados de validação já obtidos.

## O que esta versão entrega

- Web HTML/CSS/JavaScript e API Node.js/Express 5 com MongoDB real em replica set.
- Cadastro e consulta de produção, com safra, cultura, propriedade e quantidade em kg.
- Lote UUID e evento de origem criados atomicamente junto da produção.
- Histórico inicial com horário do registro, responsável e município/UF confirmados pelo participante; sem GPS.
- Total de registros e distribuição por cultura, restritos à organização autorizada.
- Identidade demonstrativa local, vínculos múltiplos, papéis e autorização no backend.
- Testes unitários e integração com processo MongoDB real, incluindo reinício e isolamento.
- Ofertas, solicitações, aceite/reserva, cancelamento, retirada e recebimento integral com transações reais.
- Cooperativa opcional designada no aceite; histórico compartilhado restrito às operações autorizadas.

**Flutter (`apps/mobile/`):** home personalizada, Produção, Ofertas, Pedidos, Histórico, consulta offline e três dashboards territoriais — Inteligência Hídrica, Produção e Excedentes e Logística. Consulte [apps/mobile/README.md](apps/mobile/README.md). Preview local: http://127.0.0.1:3000/mobile/ após compilar.

**Portal de gestão (`apps/portal/`):** Next.js com Visão Geral, Produção, Ofertas, Pedidos, Excedentes (`/destino`), Rastreabilidade visual e Minha Fazenda ([resultado](docs/design/minha-fazenda/resultado.md)).

**Data Science (`analytics/agro-agua/`):** pipeline, EDA e dois modelos avaliados sobre dados regionais reais ([relatório final](analytics/agro-agua/docs/agua04-relatorio-final.md)). O modelo Ridge não é apresentado como previsão.

**Java (`modules/java-monitoramento/`):** aplicação de console Agro+ Água com H2/JDBC, previsões polimórficas e alertas, sobre medições **simuladas** ([README do módulo](modules/java-monitoramento/README.md)). É independente da API, do portal e do Flutter.

### Quatro públicos e interfaces

| Público                    | Operações implementadas na API                                                                                 | Interface disponível                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Pequenos produtores rurais | Produção/lotes, ofertas VENDA/DOACAO, aceite/reserva, cancelamento de pedidos, retirada e histórico autorizado | Portal Next.js e Flutter concentrados neste perfil; também `apps/web` |
| Cooperativas               | Retirada quando designadas no aceite; consulta dos pedidos e eventos autorizados                               | Jornada demonstrativa em `apps/web`; sem portal/app próprio completo  |
| Instituições               | Solicitar ofertas, cancelar pedidos permitidos e confirmar recebimento como destinatárias                      | Jornada demonstrativa em `apps/web`; sem versão completa dedicada     |
| Compradores locais         | Solicitar ofertas, cancelar pedidos permitidos e confirmar recebimento como destinatários                      | Jornada demonstrativa em `apps/web`; sem versão completa dedicada     |

A autorização considera usuário, vínculo ativo com organização e papel. Mutações exigem ADMIN/EDITOR conforme o contrato. Solicitar não reserva: o aceite reserva atomicamente; cancelar devolve a reserva quando aplicável. Retirada não equivale ao recebimento, confirmado somente pelo destinatário. Transações, `Idempotency-Key` e eventos mantêm consistência e rastreabilidade. Não há pagamentos, publicação de necessidades por instituições ou gestão própria de demanda das cooperativas.

### Destino dos excedentes

`GET /api/v1/properties/:id/excess-impact` consulta o funil registrado → ofertado → aceito líquido → retirado → recebido, os saldos atuais e a separação VENDA/DOACAO. É somente leitura, exige vínculo ativo de pequeno produtor rural, papel ADMIN/EDITOR/LEITOR e propriedade ativa da organização. O portal apresenta os valores em **Excedentes**, com atalhos filtrados para Ofertas e Pedidos; o Flutter apresenta o indicador em **Produção e excedentes**.

O backend agrega gramas inteiras com snapshot e reconciliação, sem escritas. Requer replica set; não há filtro temporal, consulta histórica, estimativa financeira ou de pessoas beneficiadas, nem teste de carga. `asOf` é o corte para prazos. As etapas se sobrepõem e não devem ser somadas. Produção registrada não é excedente; saldo vencido não comprova desperdício. Implementação técnica comprovada em ambiente demonstrativo não significa impacto social real medido. Veja [contrato](docs/requisitos/api.md), [testes backend](docs/design/impacto/resultado.md) e [integração e capturas](docs/design/impacto/frontend/resultado.md).

### Offline no Flutter

A home operacional e os dashboards Produção e Logística usam cópias previamente autorizadas, com horário e isolamento por usuário/organização/propriedade. O indicador admite cache em falhas de rede/5xx; 401/403/404 invalidam sua cópia e não ativam fallback. Logout limpa os caches da sessão. O hídrico lê exports históricos embarcados de Mogi das Cruzes (2000–2025), independentes da propriedade e sem previsão operacional.

Primeira autenticação/carga, listas completas, formulários e mutações exigem conexão. Não há fila de envio offline; o histórico offline limita-se à última movimentação salva. Revogação não pode ser verificada offline. O portal não tem modo offline. Veja [limites Flutter](apps/mobile/README.md).

## Limitações e próximos incrementos

- Autenticação de produção, implantação pública, QR Code e divisão/agrupamento de lotes pendentes; identidade atual demonstrativa local.
- Uma oferta por lote e uma remessa por pedido, com recebimento integral. Sem prorrogação, conversão de venda em doação, republicação ou registro de perda; resgate depende de decisão de regra comercial.
- Alertas explicados Flutter em aberto. Acessibilidade verificada em recortes de testes/capturas, sem certificação integral; iOS e aparelho físico sem validação.
- Smoke geral do portal com falha conhecida em seletores antigos, incluindo “Distribuição da produção”; CI verde não comprova smoke completo aprovado.
- Sem validação com usuários reais ou impacto social medido. Pitch **EM PRODUÇÃO**, conforme informado pelo autor; arquivo final, duração e envio ainda não comprovados.
- Evolução planejada para **cooperativas e instituições**, com backend próprio para as necessidades de cada perfil, reutilizando autenticação, autorização, organizações e operações existentes. Expansão não concluída; esta branch documental não adiciona endpoints.

## Estrutura

```text
apps/web/                       formulário e consulta, sem framework
apps/mobile/                    Flutter: telas do produtor e dashboards territoriais
apps/portal/                    portal de gestão Next.js/TypeScript (porta 3100)
services/api/src/               Express, autorização, domínio e MongoDB
services/api/test/              testes unitários e integração real
analytics/agro-agua/            Python: pipeline, EDA e modelos com dados regionais reais
modules/java-monitoramento/    Java: console Agro+ Água, H2/JDBC, sensores simulados
.github/workflows/              integração contínua (API, portal, Flutter, Java)
docs/arquitetura/               decisões e modelo de dados
docs/requisitos/                API e rastreabilidade acadêmica
docs/planejamento/              sprints e relação com cartões propostos
docs/evidencias/                resultados de verificações, sem tokens
scripts/                       MongoDB local, seed e verificação
```

O diretório atual é a raiz do monorepositório; não há uma pasta adicional aninhada. A raiz tem o package.json e o lockfile da API e dos scripts; o portal tem os seus em `apps/portal/`. Não foram adicionados microsserviços.

## Executar no Windows / PowerShell

Requer Node.js >=22.19 e npm. Use `npm.cmd` se a política do PowerShell bloquear `npm.ps1`.

```powershell
npm.cmd ci --cache .cache/npm
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run db:local
```

Mantenha o MongoDB em um terminal. Em outro, na raiz:

```powershell
npm.cmd run seed:demo
npm.cmd start
```

Abra **http://127.0.0.1:3000**. Consulte localmente `.data/demo-sessions.json`, copie o token do perfil `PEQUENO_PRODUTOR_RURAL` e cole no campo da página. Escolha a organização, preencha o formulário e confirme a origem. Após salvar, confira a listagem, os indicadores e o histórico do lote.

O seed cria quatro organizações e participantes **fictícios**, uma propriedade e três culturas. Não cria safras, produções, ofertas ou entregas supostamente reais. Executá-lo novamente preserva as produções e substitui somente os tokens demo, que expiram em 24 horas. Não exiba esse arquivo em vídeos, screenshots, commits ou relatórios. Tokens são armazenados como hash no banco e apenas em memória na página. Para a jornada comercial, alterne esses quatro tokens; consulte o [roteiro do segundo incremento](docs/arquitetura/incremento-2.md).

`db:local` usa `mongodb-memory-server-core` para iniciar **mongod real com WiredTiger, replica set de um nó agroLocal e diretório persistente**, apesar do nome da biblioteca. O replica set é necessário às transações entre oferta, pedido, evento e comando idempotente. O primeiro uso baixa um binário oficial de `fastdl.mongodb.org` (Windows: aproximadamente 756 MB compactados para a versão utilizada); não instala serviço. Cache em `.cache/mongodb-binaries`, dados em `.data/mongodb`. Ctrl+C encerra preservando os dados. A porta 27017 precisa estar livre. Encerre a instância anterior antes de iniciar; não exclua locks nem dados para resolver conflitos. O diretório da primeira versão foi preservado na conversão local.

Como alternativa, use um MongoDB replica set já disponível em `MONGODB_URI` e dispense `db:local`. MongoDB standalone mantém o cadastro de produção, mas as mutações comerciais retornam 503 sem gravações. O seed é restrito a MongoDB local sem credenciais para evitar população acidental de banco externo. O backend não recorre a memória ou JSON se MongoDB falhar: a inicialização falha explicitamente.

O modo demo só é habilitado com `DEMO_AUTH_ENABLED=true` e o servidor recusa bind fora de loopback nesse modo. Não publique, faça túnel ou use proxy para expor essa demonstração. Autenticação real, limitação de tentativas e configuração de implantação permanecem pendentes.

## Testes

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:integration
```

A integração inicia seu próprio MongoDB em porta livre e base isolada; não depende de `db:local`, `.env` ou seed. Testa API HTTP, persistência, reinício, permissões, erros e entrega dos arquivos web. Seus dados fictícios ficam em `.data/integration-<uuid>` para inspeção local, sem serem versionados. Uma falha de download ou execução é reportada como falha, nunca como teste aprovado ou ignorado. O teste unitário não exige MongoDB.

A suíte comercial inicia replica set real em `.data/commerce-<uuid>` e testa concorrência, rollback, idempotência, estados, privacidade e operação direta/com cooperativa. Evidências desta etapa usam o prefixo `incremento-2`, preservando os relatórios históricos da fundação.

### Portal, Flutter e Java

```powershell
Push-Location apps/portal
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:PORTAL_DEMO_ENABLED='true'
$env:AGRO_API_URL='http://127.0.0.1:3000'
npm.cmd run dev  # http://127.0.0.1:3100; API e MongoDB ativos
# Após Ctrl+C:
Pop-Location

Push-Location apps/mobile
flutter pub get
flutter analyze
flutter test
Pop-Location

Push-Location modules/java-monitoramento
mvn "-Dmaven.repo.local=.m2/repository" clean verify
mvn "-Dmaven.repo.local=.m2/repository" compile exec:java
Pop-Location
```

Execute a partir da raiz. Java requer JDK 21/Maven 3.9.x; Flutter no PATH (CI: 3.47.2). Instalação e reprodução Python: [README Data Science](analytics/agro-agua/README.md); não reabrir o teste dos modelos congelados para seleção.

O [workflow](.github/workflows/ci.yml) roda em pushes e PRs para `main`: API (sintaxe, unitários e integração MongoDB), portal (typecheck, testes e build), Flutter (analyze e testes) e Java (Maven verify). Os quatro jobs passaram após o merge do PR #1 em `89d6f30c`: [execução 43034289710](https://github.com/matheeusvx/Agro-Brasil/actions/runs/43034289710). Python e smoke geral do portal não estão nesse CI.

Resultados históricos: [etapa A, 10/11](docs/planejamento/etapa-a-resultado.md); [backend do indicador, 11/11](docs/design/impacto/resultado.md), 30 unitários/51 integrações; [frontend, revisão 5, 11/11](docs/design/impacto/frontend/resultado.md), 133 Flutter/52 portal; Java, 199 testes registrados. As suítes funcionais e os testes Python não foram reexecutados nesta atualização exclusivamente documental.

## Documentação e evidências

- [Auditoria do ambiente](docs/arquitetura/auditoria-ambiente.md)
- [Arquitetura e decisões](docs/arquitetura/arquitetura.md)
- [Modelo de dados e estados](docs/arquitetura/modelo-dados.md)
- [Contratos da API](docs/requisitos/api.md)
- [Matriz rubrica → evidência](docs/requisitos/conformidade.md)
- [Diagnóstico e plano até a entrega](docs/planejamento/diagnostico-2026-11-10.md)
- [Planejamento e referências Trello](docs/planejamento/execucao-inicial.md)
- [Relatório de verificação](docs/evidencias/verificacao.md)
- [Segundo incremento: consistência e roteiro](docs/arquitetura/incremento-2.md)
- [Verificação do segundo incremento](docs/evidencias/incremento-2.md)

Sem credenciais no repositório: `.env`, `.data`, `.cache` e `node_modules` são ignorados. O lockfile fixa a resolução das dependências. Não há integração nem atualização automática de Trello.

## Redesign da home

A home do pequeno produtor rural possui estados de primeiro acesso, pendências, erro e consulta offline. Veja [Design System](docs/design/design-system.md), [auditoria](docs/design/auditoria-home.md) e [comparação antes/depois](docs/design/comparacao.md). A skill de apoio à autoria é local e não é distribuída neste repositório.

## Build e smoke test do Flutter Web

Na raiz, use `npm.cmd run build:mobile`: mantém `/mobile/` e inclui CanvasKit local com `--no-web-resources-cdn`, compatível com a CSP restrita à própria origem. A instalação do Flutter precisa estar no PATH. O build gerado continua ignorado pelo Git.

Depois execute `npm.cmd run test:mobile:smoke`. O teste usa playwright-core e Edge/Chrome instalado, inicia Express e MongoDB isolados e verifica renderização, login, home, reload, fontes e WebAssembly com acessos externos bloqueados. Não precisa da API da porta 3000 nem de chave meteorológica. Para outro Chromium, configure `SMOKE_BROWSER_PATH`. Evidências padrão ficam em `.data/mobile-smoke`; `SMOKE_EVIDENCE_DIR` permite escolher outra pasta.

Para validar a API demonstrativa já ativa na porta 3000: `npm.cmd run test:mobile:smoke -- --existing`; exige `.data/demo-sessions.json` com sessão válida. Tokens não são registrados. [Diagnóstico e capturas](docs/evidencias/flutter-web-startup/relatorio.md).
