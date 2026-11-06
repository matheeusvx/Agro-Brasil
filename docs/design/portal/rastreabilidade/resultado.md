# Rastreabilidade interativa — incremento

Entrega dentro do limite de cinco horas. Rotas `/rastreabilidade` e `/rastreabilidade/[id]` disponíveis. Interface de consulta com cards conectados por curvas SVG, fundo pontilhado discreto, sequência em duas linhas no desktop, etapa atual destacada e painel de metadados. Em 1024 px o fluxo reorganiza os cards verticalmente, mantendo as conexões e o painel ao lado; em larguras menores o painel fica abaixo.

## Contratos e isolamento

Endpoints existentes, sem alteração do Express/MongoDB:

- GET `/orders?limit=100&offset=…`: pedidos autorizados; a apresentação limita ao vendedor autenticado e aos lotes da propriedade selecionada.
- GET `/lots/:id`: confirmação do lote autorizado.
- GET `/lots/:id/events?limit=100&offset=…`: eventos paginados, até o limite explícito de consulta adotado pelo portal.

O endpoint do lote retorna ao proprietário todos os eventos do lote. O domínio de apresentação filtra explicitamente: origem sem vínculo a outro pedido; publicação cujo `operationId` é a oferta do pedido; demais operações com `orderId` igual ao pedido selecionado. Eventos de retirada, recebimento ou cancelamento de outros pedidos não entram no gráfico. A ordenação usa data de registro; em empates, a sequência do domínio resolve a ordem.

Etapas concluídas são derivadas exclusivamente dos eventos. Status isolado não cria registros. Etapas posteriores aparecem como possibilidades, sem datas ou localização inventadas. Cancelamento encerra o caminho e elimina etapas futuras. Não há nó adicional de criação do lote. Quantidade do evento só aparece quando o contrato a fornece; o cabeçalho mostra a quantidade do pedido. Organizações são identificadas pelos dados autorizados: nome do vínculo atual quando conhecido, identificador retornado pela API nos demais casos. Nenhum nome é inferido.

## Funcionalidades

Listagem pesquisável por cultura/pedido/lote, filtro de situação e paginação de oito registros; metadados do pedido e lote; seleção de nós por clique/Tab/Enter e setas, Home/End; painel de detalhes com horário, local, organização e quantidade disponíveis. Conexões e posições recalculam ao redimensionar a área. Não há ferramentas de edição, drag, criação de evento ou transição de negócio no diagrama.

Pedidos recebe apenas o link “Rastrear pedido”. Produção recebe um atalho para os pedidos daquele lote, mantendo a consulta de origem existente. Ofertas recebe um link para o lote na Produção. Esses módulos não foram redesenhados nem tiveram suas regras alteradas. Home, Android e protótipo acadêmico não foram editados.

## Referências e motion

As duas imagens fornecidas orientaram cards com portas, conexões curvas, superfícies claras, profundidade discreta e fundo pontilhado. Sem marcas, cores ou textos das plataformas originais nos assets do produto.

Vídeo principal: **`docs/design/referencias/skill animação.mp4`**, 24 segundos. Inspeção visual por sequência de frames decodificados ao longo dos 24 segundos, registrada em `referencia-0/1/2.jpg`; não foi uma análise apenas de nome/metadados. StageShow: lidos `SKILL.md` e materiais de motion. Não foi importado kit de demonstração ou criado cursor fictício no aplicativo.

Técnicas observadas e aplicadas:

1. Realce de seleção nos controles Day/Week/Month: seleção de cards por transição de superfície/borda, com foco de teclado explícito.
2. Movimento coordenado de objetos e conteúdo: entrada de cards com intervalos de 100 ms; conexões desenhadas progressivamente com início sobreposto ao movimento do nó. Concluída a montagem, as linhas param.
3. Menus e mudanças de conteúdo mantendo sua âncora: atualização do painel no mesmo lugar, transição curta de 240 ms, sem mover o canvas ou esticar texto.

Curva de chegada `cubic-bezier(.25,.8,.25,1)`, pequenos deslocamentos de 8 px e duração de 360 ms por card. Conexões de 420 ms, com direção indicada por setas; futuro tracejado/neutro e cancelamento em vermelho discreto. Nenhuma animação contínua. `prefers-reduced-motion` elimina atrasos e reduz durações.

## Gravação e revisão

[MP4 real do portal](rastreabilidade-demonstracao.mp4), capturado no Edge por screencast e codificado com timestamps reais. Demonstra acesso, seleção de pedido, montagem, seleção de nós, teclado, detalhes e estados solicitado, aceito, retirado, recebido e cancelado. Dados das capturas pertencem somente à fixture MongoDB isolada.

[Comparação local dos vídeos](comparacao.html). A gravação foi inspecionada por sequência de frames decodificados e comparada à referência. O portal preserva seleção ancorada e sequenciamento, com menos movimentos simultâneos que a composição demonstrativa do vídeo. A revisão corrigiu duplicação do item de navegação, direção das conexões e o estado vazio durante troca de pedido, substituído por placeholders na geometria do fluxo. A gravação final foi regenerada após os ajustes.

## Validação

- Build e TypeScript aprovados; 11 testes do portal aprovados.
- `node scripts/smoke-portal.mjs --trace`: aprovado com Express e MongoDB replica set isolado.
- Teste com dois pedidos reais do mesmo lote: cancelamento de um excluído do fluxo do outro.
- Estados solicitado, aceito, retirado, recebido e cancelado verificados; recebimento criado pelo endpoint real de recebimento na fixture, sem inventar registros na aplicação.
- Organização diferente sem acesso ao lote e ao pedido: bloqueio confirmado.
- Navegação por teclado, redução de movimento e ausência de transbordamento horizontal em 1440×900, 1366×768 e 1024×768 verificados.
- Auditoria axe do fluxo sem violações detectadas e nenhum erro JavaScript capturado.
- Evidência automática: `../evidencias/rastreabilidade-result.json`.
- Capturas: `../evidencias/rastreabilidade-{1440,1366,1024}.png`, `rastreabilidade-solicitado.png`, `rastreabilidade-aceito.png`, `rastreabilidade-retirado.png`, `rastreabilidade-recebido.png` e `rastreabilidade-cancelado.png` no mesmo diretório.

## Arquivos alterados

Novos: `apps/portal/src/app/rastreabilidade/page.tsx`, `src/app/rastreabilidade/[id]/page.tsx`, `src/components/trace-page.tsx`, `src/lib/trace-flow.ts`, `tests/trace.test.ts`, `scripts/portal-trace-browser.mjs`.

Integração: `src/components/portal-shell.tsx`, `orders.tsx`, `offers.tsx`, `production-details.tsx`, `src/app/globals.css` e `scripts/smoke-portal.mjs`. A allowlist existente já suportava os GETs necessários; nenhum endpoint comercial novo foi liberado.

## Limites e futuro

Foco nos vínculos de pequeno produtor já aceitos pelo portal. Compradores/instituições precisam de um workspace próprio; não existe link público, QR Code ou desvio de autenticação. A sessão continua demonstrativa/local. Consultas acima de 10 mil registros geram erro explícito; agregação no servidor é uma possível evolução. Não foi introduzida biblioteca de editor: SVG e botões nativos atendem ao fluxo somente de leitura. Validação em Edge; sem avaliação Safari/Firefox neste ciclo. Erros de consulta, pedido inexistente ou fora da propriedade são explícitos e oferecem nova tentativa.

Sem commit ou push.
