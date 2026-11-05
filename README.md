# Agro+ Brasil

Fundação técnica CitizenTech / Territory Predictive Insights — FIAP Global Solution 2026.2.
Projeto individual: **Matheus Morelli Rodrigues — RM 562765**.

Uma plataforma para **pequenos produtores rurais, cooperativas, instituições e compradores locais**, com três pilares: conexão de excedentes à demanda e logística; rastreabilidade; gestão da produção e inteligência hídrica. As necessidades desses públicos são hipóteses a investigar, não resultados de validação já obtidos.

## O que esta versão entrega

- Web HTML/CSS/JavaScript e API Node.js/Express com MongoDB real.
- Cadastro e consulta de produção, com safra, cultura, propriedade e quantidade em kg.
- Lote UUID e evento de origem criados atomicamente junto da produção.
- Histórico inicial com horário do registro, responsável e município/UF confirmados pelo participante; sem GPS.
- Total de registros e distribuição por cultura, restritos à organização autorizada.
- Identidade demonstrativa local, vínculos múltiplos, papéis e autorização no backend.
- Testes unitários e integração com processo MongoDB real, incluindo reinício e isolamento.
- Ofertas, solicitações, aceite/reserva, cancelamento, retirada e recebimento integral com transações reais.
- Cooperativa opcional designada no aceite; histórico compartilhado restrito às operações autorizadas.

**Flutter:** home de tarefas, telas básicas e consulta offline da última home implementadas. Consulte [apps/mobile/README.md](apps/mobile/README.md) e [evidências da home](docs/evidencias/flutter-home.md). Preview local: http://127.0.0.1:3000/mobile/ após compilar.

**Ainda não implementados:** QR Code, divisão/agrupamento de lotes, autenticação de produção, dashboards Flutter, modelos hídricos e sistema Java. Dados de demonstração não representam impacto social real. O segundo incremento limita cada lote a uma oferta e cada pedido a uma remessa com recebimento integral, sem pagamentos.

## Estrutura

```text
apps/web/                       formulário e consulta, sem framework
apps/mobile/                    home Flutter e telas básicas de tarefas
services/api/src/               Express, autorização, domínio e MongoDB
services/api/test/              testes unitários e integração real
analytics/agro-agua/            escopo Python com dados regionais reais
modules/java-monitoramento/    escopo Java independente e sensores simulados
docs/arquitetura/               decisões e modelo de dados
docs/requisitos/                API e rastreabilidade acadêmica
docs/planejamento/              sprints e relação com cartões propostos
docs/evidencias/                resultados de verificações, sem tokens
scripts/                       MongoDB local, seed e verificação
```

O diretório atual é a raiz do monorepositório; não há uma pasta adicional aninhada. Um único package.json e lockfile gerenciam as dependências JavaScript. Não foram adicionados microsserviços.

## Executar no Windows / PowerShell

Requer Node.js >=22.19 e npm. Use `npm.cmd` se a política do PowerShell bloquear `npm.ps1`.

```powershell
npm.cmd ci --cache .cache/npm
Copy-Item .env.example .env
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

## Documentação e evidências

- [Auditoria do ambiente](docs/arquitetura/auditoria-ambiente.md)
- [Arquitetura e decisões](docs/arquitetura/arquitetura.md)
- [Modelo de dados e estados](docs/arquitetura/modelo-dados.md)
- [Contratos da API](docs/requisitos/api.md)
- [Requisitos acadêmicos e limites](docs/requisitos/conformidade.md)
- [Planejamento e referências Trello](docs/planejamento/execucao-inicial.md)
- [Relatório de verificação](docs/evidencias/verificacao.md)
- [Segundo incremento: consistência e roteiro](docs/arquitetura/incremento-2.md)
- [Verificação do segundo incremento](docs/evidencias/incremento-2.md)

Sem credenciais no repositório: `.env`, `.data`, `.cache` e `node_modules` são ignorados. O lockfile fixa a resolução das dependências. Não há integração nem atualização automática de Trello.
