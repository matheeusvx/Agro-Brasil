# Pedidos — pequeno produtor

Incremento entregue dentro do limite de cinco horas. Rota `/pedidos` liberada na navegação. Home, Ofertas, Flutter e backend não foram alterados.

## Funcionalidades

Tabela por propriedade autorizada com cultura, lote, quantidade, situação, data, pesquisa e filtro de situação; oito registros por página. Drawer com detalhes, aceite com cooperativa opcional, cancelamento antes da retirada e registro de retirada em remessa planejada. As condições visuais orientam as ações; a API continua validando permissões, estados, saldo, organização e localização.

Endpoints: GET `/orders`, GET `/cooperatives`, POST `/orders/:id/accept`, POST `/orders/:id/cancel`, POST `/shipments/:id/pickup`. Nenhum endpoint novo de negócio. O proxy libera somente esses caminhos/métodos adicionais, exige `Idempotency-Key` e preserva o isolamento e a sessão HttpOnly existentes.

Cada comando mantém corpo e chave para repetir uma resposta incerta. Campos ficam bloqueados durante envio/confirmacão incerta. O contexto é descartado na mudança de organização/propriedade. As chaves são mantidas no componente, sem persistência entre recarregamentos: após sair da tela, consultar o estado antes de repetir uma operação. A atualização após sucesso mantém as linhas visíveis e consulta novamente a API, sem substituir a tabela pelo spinner.

## Referência e aplicação visual

Arquivo exato: **`docs/design/referencias/skill animação.mp4`**, 24 segundos. A análise visual foi feita decodificando o vídeo em sequência de frames cobrindo seus 24 segundos, não apenas lendo metadados. Os três painéis `referencia-0/1/2.png` registram essa inspeção. StageShow: lidos `SKILL.md` e materiais de motion. A thread do X retornou HTTP 403; nenhum conteúdo foi atribuído a ela.

Técnicas concretas observadas:

1. **Mudanças de estado dentro do mesmo controle:** o botão azul alterna Publish/Live com confirmação. Aplicação: o botão de confirmação permanece montado durante envio, e o estado do pedido muda no mesmo local com entrada suave do texto/badge.
2. **Seleção com transição de superfície:** tabs Day/Week/Month e opções ganham realce discreto. Aplicação: linhas selecionadas e botões usam transições de cor de 180 ms, sem deslocar a tabela.
3. **Entradas ancoradas e movimento coordenado:** o menu Weekly/Daily/Monthly abre junto ao controle, enquanto os objetos do painel mantêm sua organização durante mudanças. Aplicação: drawer preso à direita, detalhes em sequência com atrasos de 70/120 ms e confirmações em sua própria região, sem animações de página inteira.

Curvas StageShow de deslocamento `(.45,0,.1,1)` e chegada `(.25,.8,.25,1)`, drawer de 320 ms/saída de 200 ms, feedback de 260 ms. Sem loops, cursores fictícios, atrasos artificiais da API ou dados simulados no produto. `prefers-reduced-motion` reduz duração e elimina atrasos.

## Gravação e revisão

[MP4 real do portal](pedidos-demonstracao.mp4): abertura do drawer, aceite, transição para Aceito, retirada, fechamento e cancelamento de outro pedido. Capturado por screencast do Chromium e codificado em MP4, com timestamps reais. Dados pertencem exclusivamente à fixture MongoDB isolada. O FFmpeg foi instalado apenas em `.data/pedidos-tools`, sem dependência adicional do portal.

Comparando as sequências decodificadas da referência e da gravação: foram mantidos resposta local à ação, ancoragem e transições de seleção. O portal usa menos movimento simultâneo para priorizar leitura e segurança. A revisão da primeira gravação identificou a troca desnecessária da tabela por carregamento após a operação; isso foi corrigido e a gravação regenerada. A revisão final está em `revisao-gravacao-final.jpg`.

## Testes

- Build e TypeScript aprovados; oito testes do portal aprovados.
- `node scripts/smoke-portal.mjs --orders`: aprovado com Express/MongoDB replica set isolado.
- Aceite real com cooperativa opcional selecionada, resposta perdida após gravação e replay com a mesma chave: um único evento de aceite.
- Retirada e cancelamento reais, filtro de situação, LEITOR com escrita rejeitada e redução de movimento verificados.
- Auditorias axe de lista e detalhes sem violações detectadas; nenhum erro JavaScript capturado.
- Capturas reais em 1440×900, 1366×768 e 1024×768: `../evidencias/pedidos-lista-{largura}.png`; detalhes, aceite, retirada e cancelamento no mesmo diretório.
- Resultado automático: `../evidencias/pedidos-result.json`.

## Arquivos alterados

`apps/portal/src/app/pedidos/page.tsx`, `src/components/orders.tsx`, `src/components/portal-shell.tsx`, `src/app/globals.css`, `src/lib/security.ts`, `src/app/api/agro/[...path]/route.ts`, `tests/orders.test.ts`; `scripts/portal-orders-browser.mjs` e `scripts/smoke-portal.mjs`; documentação/evidências de Pedidos.

## Limites

Foco no produtor que recebe pedidos. Não há criação de pedidos por compradores/instituições nem confirmação de recebimento neste incremento. Detalhes são derivados da consulta autorizada, sem endpoint individual inventado. Cooperativas indisponíveis permitem aceite sem vínculo, com aviso explícito. Listagem segue o limite paginado de 10 mil registros do portal. Não houve testes Safari/Firefox; a validação e gravação foram feitas em Edge. Não foram implementados os módulos futuros.

Sem commit ou push.
