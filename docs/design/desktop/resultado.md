# Primeira versão desktop — entrega

Implementação na aplicação Flutter existente, sem terceira stack. Build Web em `apps/mobile/build/web`, servido na rota `/mobile/` do Express existente. `apps/web/` não foi alterado. Nenhum contrato de API ou regra comercial foi alterado neste ciclo.

Veja [arquitetura, hierarquia, análise das referências e fontes de dados](arquitetura.md) e a [galeria com comparação lado a lado](comparacao.html).

## Funcionamento

- Shell lateral a partir de 1000 dp; layout mobile preservado abaixo disso. Em 1024, os gráficos ficam empilhados; nas larguras maiores, em duas colunas.
- Saudação personalizada, organização autenticada e seletor de propriedade autorizada. Quando há mais de uma membership de produtor autorizada, aparece seletor de organização; a troca limpa o snapshot e recria o contexto autenticado. Os outros públicos continuam sem telas próprias, como no aplicativo existente.
- Próxima ação usa a prioridade entregue pelo backend e mantém bloqueios de escrita. Clima reutiliza a apresentação aprovada e suas indicações de indisponibilidade/cache.
- Dois indicadores e dois gráficos sobre dados paginados da API, filtrados por propriedade/lotes. Não se utilizam os dois itens do resumo para extrapolar totais.
- Barras em kg com origem comum, faces leves, destaque e tooltip. Rosca por contagem de pedidos com ângulos proporcionais, cores distintas, legenda com valores/percentuais, seleção por mouse, toque e teclado. Detalhes selecionados também estão em texto acessível.
- Paginação incompleta, falha e offline não se transformam em zeros. Estados vazios orientam sem inventar registros.
- Páginas de Produção, Ofertas, Pedidos, Perfil e Rastreabilidade continuam usando os módulos existentes. Minha Fazenda e Inteligência Hídrica não foram implementados nem simulados.

## Revisão visual realizada

Os dois anexos foram abertos visualmente antes da implementação. Na comparação final, os gráficos preservam a linguagem de profundidade sutil, superfície branca, respiro, categoria selecionada e composição circular, com adaptações agrícolas e geometria quantitativa.

Diferenças intencionais: três culturas no banco de teste, em vez de seis meses fictícios; nenhum indicador financeiro; barras não selecionadas continuam visíveis; legenda da rosca descreve situações reais de pedidos. Não há segmentos inclinados, perspectiva ou raio variável que alterem percentuais.

Correções durante a inspeção: remoção de fonte externa acionada por símbolo textual, remoção de hover em formato de pílula excessivamente grande sobre as colunas, legenda escura com marcadores vetoriais de cor, percentuais explícitos e mesma altura reservada aos rótulos das barras. Capturas foram refeitas esperando o término das consultas, evitando apresentar carregamento como resultado final.

## Validação

- `flutter analyze`: sem apontamentos.
- Suíte Flutter: 74 testes aprovados, incluindo os goldens mobile existentes sem atualização automática neste ciclo. Os oito testes novos cobrem agregação por propriedade, navegação/seleção em 1440, 1366 e 1024, vazio, erro, offline e carregamento. Após o refinamento final dos gráficos, os oito testes desktop passaram novamente.
- Backend: 23 testes unitários e 36 testes de integração aprovados, com banco e transações reais. Relatório de transações deste ciclo salvo separadamente para preservar a evidência anterior.
- Web: build final e navegador Edge real. Smoke usa Express, banco isolado e autorização reais, sem mocks de HTTP. Produções de teste são criadas pela API; pedidos são fixtures inseridas somente no banco isolado para exercitar estados. Nenhum desses dados é fallback do produto.
- Viewports: 1440×900, 1366×768, 1024×768, 768×1024 e 390×844. Capturas da home, gráficos, seleção, Produção, vazio e perfil de leitura. Smoke verifica autenticação, navegação, hover/clique, bloqueio de cadastro do LEITOR e reload, sem erros de console nem dependências externas.
- Android: build executado no emulador; captura real `evidencias/android.png`. Layout mobile segue com saudação simples e navegação inferior.

Roteiro repetível: `node scripts/smoke-desktop.mjs`, após `npm run build:mobile`. Ele cria e encerra seu banco de teste isolado. Resultados em `evidencias/result.json`. As capturas são evidência de interface renderizada, não mockups.

## Arquivos deste ciclo

- `apps/mobile/lib/desktop.dart`: shell, home, seletores, indicadores e estados.
- `apps/mobile/lib/desktop_charts.dart`: agregação autorizada, barras e rosca interativas.
- `apps/mobile/lib/main.dart`: seleção do shell por largura e troca de contexto.
- `apps/mobile/lib/data.dart`: memberships autorizadas no Repository.
- `apps/mobile/test/desktop_test.dart`: oito testes novos.
- `scripts/smoke-desktop.mjs`: navegador/API reais, resoluções e capturas.
- Documentação e evidências em `docs/design/desktop/`.

## Limites desta versão

Não é uma aplicação Windows nativa: a versão desktop validada é Flutter Web em navegador. Não há filtro temporal porque os gráficos representam todo o conjunto operacional autorizado retornado pelos endpoints atuais. A soma de kg é produção registrada, não estoque atual ou produtividade. O gráfico de pedidos conta situações atuais, não evolução histórica.

A validação usa organizações fictícias identificadas. Não foi usada chave meteorológica comercial; o smoke verifica indisponibilidade honesta. Organização com múltiplas memberships é suportada pelo código, mas o smoke utiliza uma organização; autorização entre organizações é coberta pelos testes backend. Não houve teste com usuários em campo ou leitor de tela externo.

Sem commit ou push automático. Referências não foram publicadas como assets.
