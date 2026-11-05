# Primeira versão desktop — decisão antes da implementação

## Auditoria e arquitetura

Manter Flutter em apps/mobile, com shell específico a partir de 1000 dp. Abaixo disso, conservar shell mobile, inclusive em tablets estreitos. apps/web permanece independente e intacto para Application Development. Compartilhar Repository, HomeController, autenticação, tokens, formulários, WeatherSummary, PendingCard e RecentLotCard. Não alterar contratos nem regras comerciais.

O shell desktop recebe destinos e callbacks, sem possuir regras de autorização. A primeira experiência continua restrita aos vínculos de pequeno produtor já aceitos pelo login; futuros shells dos demais públicos podem consumir os mesmos componentes, mas não existem destinos falsamente funcionais. Minha Fazenda e Inteligência Hídrica não aparecem como módulos.

Organizações são exclusivamente as memberships retornadas na autenticação. A troca recria o Repository com o contexto selecionado e limpa o snapshot anterior. Propriedades vêm de /catalog, já filtrado pelo servidor. Nenhum ID arbitrário é aceito pelo seletor. Cache e permissão de escrita continuam no controlador existente.

## Hierarquia e componentes

1. Menu lateral persistente: Início, Produção, Ofertas, Pedidos, Rastreabilidade e Perfil.
2. Saudação textual, organização e propriedade autorizadas.
3. Próxima ação à esquerda; clima compacto à direita. Sem hero ilustrado de boas-vindas.
4. No máximo dois indicadores: produção registrada (kg) e pedidos (contagem).
5. Dois gráficos; movimentos recentes no fim. Páginas secundárias reutilizam os módulos Flutter.

Componentes novos: DesktopShell, DesktopHome, OperationalCharts e gráfico vetorial interativo. Tokens continuam em AgroDesign. Superfícies brancas sobre creme, floresta para estrutura, folha/terracota/dourado para séries. Interações por hover, foco, clique e teclado; valores disponíveis em legenda textual acessível. Reduzir animação conforme acessibilidade do sistema.

Aplicação da skill revenue-centric-design: hierarquia da atenção e dashboard orientado à ação, removendo indicadores sem decisão operacional associada. Estados vazios orientam o primeiro registro, sem dados fictícios de produção na versão conectada. Não é necessário stageshow: o trabalho é produto funcional, não uma demonstração simulada.

## Análise visual das referências

Na pasta foram localizados gráfico 3d.txt e gráfico pizza.txt (fontes React de referência). Não há PNGs desses dois gráficos na pasta; as duas imagens anexadas ao pedido foram abertas visualmente pelos caminhos do clipboard. São referências estéticas, não instruções executáveis nem dependências a instalar.

Para tornar a comparação local reprodutível, os anexos foram posteriormente copiados para `referencias/ref_05_barras.png` e `referencias/ref_06_rosca.png`. Permanecem ignorados pelo Git e nunca são assets Flutter.

Barras: cartão branco horizontal, muito respiro, poucas categorias, coluna selecionada verde preenchida, faces superior/lateral com luz suave e alternativas em contorno. Adaptar a profundidade com faces de poucos pixels, mantendo a altura frontal proporcional ao kg, origem zero e escala comum. Diferentemente do exemplo, categorias não selecionadas continuam preenchidas para leitura quantitativa; sem receita, metas ou meses inventados.

Rosca: composição circular com furo amplo, segmentos destacados, volume por sombra e legenda inferior. Usar ângulo proporcional à contagem, sem perspectiva, sem alterar o raio por categoria ou deslocamentos que distorçam a leitura. Seleção por borda/realce e legenda, com tooltip absoluto e percentual. Paleta natural substitui azul/laranja/violeta saturados. Evitar porcentagem arredondada que pareça somar exatamente 100 quando houver arredondamentos.

## Contratos e interpretação

| Gráfico | Pergunta | Fonte | Unidade / agregação | Período e limitações |
|---|---|---|---|---|
| Produção por cultura | O que está registrado nesta propriedade? | GET /productions paginado; propertyId, cropName, quantityKg, lot.id | Soma de quantityKg por cropName, em kg | Todos os registros retornados; não é estoque disponível nem produtividade por hectare. Sem filtro de data nesta versão |
| Pedidos por situação | Como se distribuem os pedidos ligados aos lotes? | GET /orders paginado; lotId e status; lotes obtidos das produções da propriedade | Contagem por status, participação no total | Estado atual de todos os pedidos retornados, incluindo encerrados; não é fluxo mensal, saldo nem volume entregue |

Indicadores usam as mesmas coleções completas, não os dois lotes recentes ou as duas pendências da home. Paginação com limite de proteção gera erro explícito, jamais total parcial disfarçado. Offline não calcula gráficos com snapshot incompleto. Falha não vira zero. Respostas atrasadas de outra propriedade são descartadas pelo FutureBuilder vinculado à chave do contexto. Nenhum endpoint novo necessário.

## Plano de implementação e validação

Separar shell, home e gráficos em arquivos Flutter. Conectar seleção à navegação existente. Acrescentar memberships ao Repository sem exigir mudança de API. Testar agregação, seleção, vazio e layout desktop; executar suíte mobile existente. Build Web servido pelo Express, navegador real em 1440×900, 1366×768, 1024×768 e larguras menores, com capturas e exercício de interações. Comparação local lado a lado com os anexos, sem publicar referências como assets do aplicativo.
