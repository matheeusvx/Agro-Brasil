# Capturas da home Flutter

PNGs produzidos pelo renderer Flutter em testes de widget, com fonte Roboto e ícones carregados. **São cenários fictícios identificados, não pedidos ou validações reais.** As capturas não são mockups de imagem nem arquivos desenhados por IA. Dimensão de teste: 390 × 1450; o conteúdo rola em telas menores. Também foi testada largura 320 com texto em 200%.

| Estado | Captura |
|---|---|
| Solicitação aguardando resposta | [solicitacao.png](solicitacao.png) |
| Primeiro acesso, sem produção | [primeiro-acesso.png](primeiro-acesso.png) |
| Pedido aceito aguardando retirada | [retirada.png](retirada.png) |
| Retirado aguardando recebimento | [recebimento.png](recebimento.png) |
| Nenhuma pendência | [sem-pendencias.png](sem-pendencias.png) |
| Serviço indisponível, cópia offline | [offline.png](offline.png) |
| Erro sem cópia disponível | [erro.png](erro.png) |
| Carregamento | [carregando.png](carregando.png) |

Os testes golden comparam os pixels dessas capturas. O arquivo `flutter-api-real.json`, na pasta acima, registra separadamente a consulta Dart real da propriedade e pedidos já existentes. Nenhum dado foi criado no banco real para fabricar estados de tela nesta etapa.
