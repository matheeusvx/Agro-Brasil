# Entrega — portal de gestão, primeiro incremento

Implementação em `apps/portal/`, sem adaptar Flutter e sem alterar contratos ou regras do Express. Os 72 arquivos inventariados de mobile, web acadêmico e API mantêm os hashes iniciais. Alterações anteriores do checkout foram preservadas. Sem commit ou push.

## Arquitetura e organização

[Decisões, estrutura de pastas, segurança e endpoints](arquitetura.md). [Design System](design-system.md). [Como executar e reproduzir os testes](../../../apps/portal/README.md). [Galeria e comparação visual](revisao-visual.html).

Next App Router funciona como aplicação e adaptador restrito para o Express. Token demonstrativo só na memória do servidor; cookie de sessão HttpOnly/SameSite Strict; contexto de organização autorizado; proteção de origem e proxy com allowlist. Nenhuma persistência em localStorage/sessionStorage. Modo demonstrativo explicitamente habilitado e restrito a loopback.

## Páginas implementadas

| Área | Funcionalidade entregue |
|---|---|
| Acesso | token demonstrativo existente, erro de autenticação, sessão e logout |
| Visão geral | saudação, organização/propriedade, prioridade real, consulta contextual do pedido, três indicadores, dois gráficos, movimentações e clima quando disponível |
| Produção | listagem, busca por cultura/safra/lote, filtros combinados, ordenação por colheita, seleção, CSV e paginação |
| Detalhes | consulta autorizada da produção, identificador copiável, origem e timeline dos eventos confirmados |
| Cadastro | drawer com validação, localização pré-preenchida e confirmação; grava produção/lote/origem na operação atômica existente |
| Perfil e configurações | consulta do contexto e permissões; mudança de contexto no cabeçalho e saída na sidebar |

A navegação contém somente páginas implementadas. Próximos espaços são identificados como indisponíveis, sem botões falsos. Minha Fazenda e Inteligência Hídrica não foram implementados.

## Gráficos e revisão visual

As referências agrícolas 00–04 e as duas imagens de gráficos foram examinadas visualmente. Motiva foi estudado no código local; MARELI não foi localizado, portanto não se afirma comparação com sua execução.

**Barras:** a referência usa prismas finos, destaque verde e grande área de respiro. O portal usa topo/lateral de poucos pixels, verde profundo na cultura selecionada, cores suaves nas demais, grid discreto e a mesma baseline. Os kg continuam representados pela altura frontal; há eixo, legenda por teclado, hover/clique e tooltip real. Em vez da receita fictícia da referência, soma-se a produção em kg por cultura da propriedade. Percentual informativo com uma casa decimal.

**Rosca:** a referência usa anel espesso, separação visual, sombra e seleção destacada. O portal adapta para tons agrícolas, anel sem perspectiva, sombra discreta, contagem central e legenda lateral com valor absoluto e percentual. A seleção altera ênfase, preservando ângulos e proporções. Hover mostra contagem e percentual. Não há alocação financeira simulada.

A [galeria](revisao-visual.html) apresenta referência e implementação lado a lado. Diferenças deliberadas: sem dinheiro ou tendências inventadas; sem distorção de raio/perspectiva; prioridade à leitura operacional; sem copiar imagens ou marcas. O efeito de profundidade é menos pronunciado para manter proporções e legibilidade.

Na revisão foram corrigidos textos auxiliares pequenos/foscos, contraste dos filtros e metadados, densidade e paginação da tabela, largura do clima indisponível, superfícies do drawer, espessura da rosca e precisão excessiva dos percentuais. Também foi corrigida uma falha de pintura do cabeçalho fixo ao recolher a sidebar no Chromium, mantendo os seletores de contexto visíveis. Os dois gráficos empilham em 1024 px, em vez de comprimir as legendas. O portal respeita redução de movimento.

## Evidências e testes

Capturas reais do Microsoft Edge 156.0.4314.58, build de produção, com viewport de 1440×900, 1366×768 e 1024×768. Dados das capturas são fictícios de teste, persistidos exclusivamente em banco isolado através dos fluxos reais do Express/MongoDB. O aplicativo em execução consulta a API configurada, sem seed embutido nem fallback de números demonstrativos.

| Verificação | Resultado |
|---|---|
| `npm run build` no portal | aprovado |
| `npm run typecheck` no portal | aprovado |
| `npm test` no portal | 6 aprovados |
| `npm test` da raiz, API/clima | 23 aprovados |
| `npm run test:integration` da raiz | 36 aprovados |
| `node scripts/smoke-portal.mjs` | aprovado, navegação e fluxos persistidos |
| axe, home/lista/detalhes/cadastro | zero violações detectadas nas regras WCAG A/AA selecionadas |
| JavaScript no navegador | nenhum erro de execução capturado |
| Resoluções solicitadas | sem transbordamento horizontal da página |
| Preservação | 72 hashes verificados, nenhum alterado |

O roteiro também verifica cookie HttpOnly, ausência de token em HTML/storage, origem externa rejeitada, allowlist, organização inválida, propriedade vazia, leitura e escrita cruzadas rejeitadas, LEITOR sem cadastro, logout, paginação, CSV, carregamento e recuperação de erro. Auditoria automática não substitui revisão manual de acessibilidade.

Arquivos comprobatórios: [browser](evidencias/result.json), [preservação](preservacao-resultado.json), [API/clima](testes-backend-unit.txt), [integração](testes-backend-integration.txt). Também foram capturadas [Produção em 1366 px](evidencias/producao-1366.png), [Produção em 1024 px](evidencias/producao-1024.png), [cadastro em 1366 px](evidencias/cadastro-1366.png) e [cadastro em 1024 px](evidencias/cadastro-1024.png). Comparações renderizadas: [barras](evidencias/comparacao-barras.png) e [rosca](evidencias/comparacao-rosca.png). Nenhum teste Flutter ou emulador Android foi executado neste incremento: o mobile foi preservado, não modificado.

## Limitações e próximos incrementos

1. Substituir o acesso demonstrativo local por autenticação real e sessão distribuída antes de publicação. Sessões atuais se encerram ao reiniciar o Next.
2. Implementar gestão de Ofertas e Pedidos sobre os endpoints atuais, com fluxos contextuais e testes de idempotência pertinentes.
3. Criar workspace completo de Rastreabilidade; hoje os eventos são consultados pelo drawer do lote.
4. Desenvolver experiências próprias de cooperativas, instituições e compradores, sem reutilizar a home do produtor indiscriminadamente.
5. Propor agregação/filtros na API se o volume superar o limite local de consulta, sem alterar contratos silenciosamente.
6. Validar clima disponível com a configuração real do provedor. Nas evidências deste ciclo, o provedor esteve desativado no banco isolado; o estado indisponível foi validado sem inventar observações.

MARELI não disponível para inspeção local; não foram copiados componentes de Motiva. As referências continuam apenas na documentação local e não entram em `public/`.
