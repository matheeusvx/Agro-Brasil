# Agro+ Brasil — portal de gestão, incremento 1

## Auditoria e decisão de arquitetura

Criar `apps/portal/`, uma aplicação independente em Next.js App Router, React, TypeScript, Tailwind CSS 4, componentes shadcn/ui (Radix), Lucide e Recharts. Não adaptar o Flutter neste incremento. `apps/mobile/`, `apps/web/` e `services/api/` foram inventariados por hash antes do trabalho; o relatório de preservação permite conferir que os arquivos continuam idênticos ao estado inicial deste ciclo, inclusive alterações anteriores do usuário.

O Express/MongoDB continua sendo a única autoridade de negócio: autorização por organização, criação atômica de produção/lote/origem, quantidades, validação de localização e eventos. O Next não possui banco de domínio nem implementa saldos, reserva, pedidos ou rastreabilidade paralelos.

### Referências locais

Motiva foi localizado em `C:/Users/Sucesso/Documents/CHALLENGE CCR-MOTIVA/apps/web`. Foram examinados o manifesto, layout e AppSidebar. Foram adotados os princípios de separação entre navegação, espaços de trabalho, estado e API, sidebar contextual/retrátil e organização de interfaces operacionais. Nenhum componente, marca, asset ou regra foi copiado.

MARELI Imóveis não foi localizado nos diretórios de projetos examinados ou na lista de projetos do ambiente. Seus critérios descritos no pedido — Next, tabelas com filtros, drawers contextuais e baixa densidade — orientam a implementação. Não se afirma comparação visual com uma execução de MARELI que não estava disponível.

Os PNGs agrícolas 00–04 e as imagens 05/06 dos gráficos foram abertos visualmente. Do sistema aprovado vêm floresta, creme, folha e terracota, legibilidade operacional e formas suaves. A referência 03 orienta o uso contido de volume, sem importar seus objetos 3D. Dos gráficos vêm faces discretas das barras e composição circular limpa da rosca. Não se importam os PNGs de referência no produto.

### Skills

- `revenue-centric-design`: hierarquia da atenção, central orientada à próxima ação, redução do esforço percebido no formulário, estado vazio como orientação para o primeiro valor. Dashboard não recebe métricas sem interpretação ou ação operacional.
- `stageshow`: apenas composição, proporção, movimento com causa e revisão visual. Não foi instalada sua stack, usado seu kit ou produzida uma interface simulada. Os controles e gráficos do portal são reais.

## Limites do incremento

Páginas funcionais: **Visão geral, Produção, Perfil e configurações**. Ofertas, Pedidos e Rastreabilidade aparecem em uma seção de próximos espaços, sem links ou ações falsamente disponíveis. É possível consultar o pedido prioritário e, dentro da Produção, o lote e seus eventos. Não há edição de produção porque a API não possui essa operação. Não existem módulos Minha Fazenda ou Inteligência Hídrica.

A sessão conhece memberships dos quatro públicos, mas o espaço implementado aceita apenas vínculos de pequeno produtor. Os demais papéis não recebem uma home de produtor disfarçada. Futuras experiências poderão adicionar seus próprios contratos de apresentação sobre a mesma sessão/proxy e os endpoints já autorizados pelo backend.

## Segurança e integração

```text
Navegador → Next /api/session e /api/agro/* → Express /api/v1/* → MongoDB
                cookie HttpOnly                bearer + organização
```

O token é informado uma vez pelo usuário, validado em `/me` e armazenado somente na memória do servidor Next. O navegador recebe um identificador aleatório em cookie HttpOnly, SameSite Strict, sem token no HTML, localStorage ou sessionStorage. Logout apaga a sessão do servidor e o cookie. Sessões expiram em oito horas; expiração/revogação do token continua sendo verificada pelo Express em cada consulta.

`PORTAL_DEMO_ENABLED=true` precisa ser configurado explicitamente. API e portal devem usar loopback; comandos de desenvolvimento/produção ligam em `127.0.0.1`. O proxy recusa destinos remotos, caminhos fora da allowlist, redirecionamentos e operações não implementadas. Requisições de mutação exigem Origin igual ao host local da requisição; cabeçalhos de organização enviados pelo navegador são ignorados. Organização é definida pela sessão, e revalidada em `/me` na troca. Backend ainda valida todos os vínculos, inclusive revogados.

Somente POST `/productions` é encaminhado neste incremento. Corpos são limitados a 16 KiB, respostas não são armazenadas em cache e consultas têm timeout. Não há repetição automática de criação: como o contrato existente não oferece idempotência para produção, falha de confirmação exige conferir a lista antes de reenviar.

Este adaptador demonstrativo não é autenticação de produção nem é adequado para múltiplas instâncias: a memória é perdida ao reiniciar o Next. Autenticação real, armazenamento distribuído de sessão e publicação serão um incremento separado. Não publicar este modo atrás de proxy público.

## Estrutura de pastas

```text
apps/portal/
  src/app/
    layout.tsx                  providers, fonte/tema local
    visao-geral/page.tsx         central operacional
    producao/page.tsx            listagem e fluxos de Produção
    perfil/page.tsx              organização, propriedade e sessão
    api/session/route.ts         adaptador de sessão demonstrativa
    api/agro/[...path]/route.ts  proxy restrito para API existente
  src/components/
    portal-provider.tsx         carregamento, contexto, erros, sessão
    portal-shell.tsx            sidebar retrátil e contexto autorizado
    overview.tsx                próxima ação, indicadores, movimentos
    operational-charts.tsx     barras e rosca sobre dados autorizados
    productions.tsx             pesquisa, filtros, seleção, CSV, paginação
    production-details.tsx      drawer e linha do tempo
    production-create.tsx       cadastro contextual e confirmação
    ui/                         componentes oficiais shadcn adaptados
  src/lib/
    server-session.ts           token somente no servidor
    security.ts                 validação de loopback/allowlist
    client-api.ts               chamadas e paginação, sem regras comerciais
    operational.ts              agregações e filtros de apresentação
    types.ts                    tipos do contrato existente
  public/fonts/                 Roboto local com licença Apache 2.0
  public/weather/               logo oficial e NOTICE existentes
  tests/                        agregação, filtros e limites do proxy
```

## Contratos utilizados

| Endpoint existente | Uso |
|---|---|
| GET `/me` | identidade e memberships, apenas no servidor Next |
| GET `/catalog` | propriedades autorizadas e culturas |
| GET `/producer-home?propertyId=…` | nome, permissão de escrita, prioridade e eventos recentes |
| GET `/properties/:id/weather` | clima regional e atribuição, se disponível |
| GET `/productions?limit=100&offset=…` | paginação completa por organização, filtrada na apresentação pela propriedade |
| GET `/productions/:id` | detalhe autorizado, consultado ao abrir drawer |
| POST `/productions` | produção, lote e origem atômicos, contrato intacto |
| GET `/lots/:id/events?limit=100&offset=…` | eventos confirmados e paginados |
| GET `/orders?limit=100&offset=…` | distribuição atual e contexto de prioridade, filtrados pelos lotes da propriedade |

### Gráficos e interpretação

**Produção por cultura:** soma de `quantityKg` dos registros da propriedade, em kg; todos os registros disponíveis, sem recorte mensal fictício. Não representa estoque, produtividade ou saldo de ofertas. Barras com faces de poucos pixels, baseline comum, eixo e valores acessíveis na legenda.

**Pedidos por situação:** contagem por `status`, incluindo encerrados, dos pedidos cujos `lotId` pertencem às produções da propriedade. Percentual relativo ao total dessa consulta. Não é série histórica, quantidade entregue nem indicador financeiro. Rosca sem perspectiva ou variação de raio; seleção por cor/legenda, valores e percentuais em tooltip e texto.

Nenhum total é extrapolado dos dois lotes recentes. O limite de paginação gera erro explícito, não total parcial. Requisições atrasadas são abortadas e resultados de contexto anterior são descartados. Erro não vira zero; vazio significa consulta autorizada sem registros.
