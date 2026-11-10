# Minha Fazenda — frontend 01 (portal)

Implementado em 10/11/2026 na branch `feat/web-minha-fazenda`, sobre o backend descrito em `docs/arquitetura/minha-fazenda-backend.md`. Sem commit/push, sem alteração em backend, Flutter ou Java.

## Auditoria inicial

Contratos, autorização, versão otimista/409, estados `UNCONFIGURED`/`EMPTY`/`CONFIGURED`, estados operacionais e paginação conferem com o documento do backend. Único bloqueio encontrado: o proxy `/api/agro` do portal aceitava só GET/POST e não listava as rotas de fazenda. Corrigido no próprio portal:

- `src/lib/security.ts`: GET em `/properties/:uuid/farm-layout` e `/farm-overview`; **PUT apenas** em `/properties/:uuid/farm-layout`.
- `src/app/api/agro/[...path]/route.ts` e `src/lib/server-session.ts`: método PUT repassado; mesmas verificações de origem, sessão e limite de 16 KiB.
- `src/lib/client-api.ts`: `RequestError` passa a carregar `code` da API (compatível com o uso existente).

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/app/minha-fazenda/page.tsx`, `farm.css` | Rota e estilos (cena, painéis, responsivo, movimento reduzido) |
| `src/lib/farm.ts` | Tipos dos contratos, projeção isométrica, validação local, conciliação, reducer do editor, `loadFarm`/`saveFarm` |
| `src/components/farm/farm-art.tsx` | Ilustrações SVG originais (diorama isométrico) por tipo de setor |
| `src/components/farm/farm-scene.tsx` | Cena interativa: câmera, zoom, arraste (mouse/toque), teclado |
| `src/components/farm/farm-panels.tsx` | Lista acessível, detalhes do setor, editor, produções paginadas |
| `src/components/farm/farm-page.tsx` | Orquestração: carga, modos, salvamento, conflito |
| `src/components/portal-shell.tsx` | Item "Minha Fazenda" na navegação e breadcrumb |
| `tests/farm.test.ts` | 20 testes de comportamento |

## Como funciona

- **Cena**: ilha isométrica 2:1 em SVG; cada elemento do layout vira um sprite posicionado por `toScreen(x,y)` e ordenado por profundidade. Sprite depende do tipo; cores dos produtos dependem das culturas vinculadas (ex.: tomate → vermelho). Fundo genérico (ilha, árvores de borda, nuvens) não representa estruturas do produtor. Aviso permanente: "Organização espacial ilustrativa, não georreferenciada."
- **Exploração**: clicar/tocar/Enter seleciona; painel lateral (gaveta inferior abaixo de 900px) com culturas indicadas, produções, quantidade registrada, lote, oferta (só "publicada" quando `PUBLICADA` e prazo futuro), pedidos por estado e links para Produção, Rastreabilidade, Ofertas e Pedidos. Armazém informa que o vínculo não é estoque físico; Coleta destaca pedidos/remessas. Selos na cena: `ACTION_PENDING` (!), `HAS_LOTS` (nº de produções), referência indisponível (?).
- **Construção** (ADMIN/EDITOR, conforme `canEdit`/`canEditLayout`): paleta com os 6 tipos, UUID v4 gerado no cliente, posição livre automática, arraste com ponteiro, setas do teclado (Shift acelera), editor de nome/tipo/culturas/produções (somente produções da propriedade), remoção com confirmação, limites 20/10/10 e 16 KiB validados antes do PUT.
- **API**: layout e overview lidos em paralelo; `layoutVersion` ≠ `version` → releitura (até 3 vezes); persistindo, dados operacionais ficam ocultos com aviso. Respostas de outra propriedade/organização são descartadas (componente remontado por chave e reducer que ignora chaves antigas). 401/403/404 não têm fallback.
- **409**: rascunho preservado, nada sobrescrito; painel mostra o que mudou na outra sessão e oferece "Juntar com a versão nova" (reaplica as alterações locais sobre a versão remota, para revisão e novo salvamento) ou "Descartar as minhas".
- **Falha de rede/5xx no PUT**: consulta o layout antes de qualquer nova tentativa; reconhece gravação aplicada, não aplicada ou conflito.

## Validação (10/11/2026)

- `npm test` (portal): 31/31 (11 existentes + 20 novos).
- `npx tsc --noEmit` e `npm run build`: aprovados; `/minha-fazenda` gerada.
- Integração real portal → proxy → API → MongoDB (banco temporário isolado, removido ao final): 16/16 — criação e movimento via PUT, 409 sem sobrescrita, overview conciliável, LEITOR 403, outra organização 404, 413, PUT fora do layout e sem Origin bloqueados.
- Roteiro headless Playwright (sem capturas): 30/30 comportamentos — primeiro acesso, adicionar/nomear/vincular, arrastar, teclado, salvar, persistência após recarregar, painel com dados reais, 409 + junção, LEITOR, 390px e 320px sem rolagem horizontal, gaveta inferior, alvos ≥ 44px. Console sem exceções JS (apenas o 401 da checagem de sessão antes do login e o 409 provocado).

## Limitações

- Revisão visual da arte feita só por código; não foram geradas capturas (pedido do incremento). Recomenda-se revisão humana em navegador.
- O teste de texto 200% foi aproximado (fonte raiz ampliada); boa parte do CSS do portal usa px.
- Novo setor entra por clique na paleta (não por arrastar da paleta).
- Trocar de propriedade com rascunho não salvo descarta o rascunho (com aviso).
- Sem atualização em tempo real; conflito só é detectado ao salvar.

## Próximo incremento sugerido

Arrastar da paleta; desfazer/refazer; filtros de produções no editor; ações comerciais rápidas no painel (publicar oferta/aceitar pedido via fluxos existentes); revisão visual com usuários e testes de leitor de tela.

---

# Frontend 02 — identidade visual v3 e fazenda imersiva (10/11/2026)

## Referências usadas
- Logo Agro+ Brasil (texto branco, "+" verde, bandeira): aplicada na sidebar verde profunda.
- Painel de referência (sidebar escura, cards brancos arredondados, destaques verde-limão, ilustrações).
- Vídeo `docs/design/referencias/3d dashboard.mp4` (analisado por quadros): cena isométrica em tela cheia, painéis flutuantes (zonas, atividade, card com cabeçalho verde), mascotes com balões, arcos entre pontos e câmera que aproxima a zona escolhida.
- Skill stageshow: princípios aplicados — cada movimento tem causa, chegadas escalonadas, números rolam até o valor real em vez de trocar, o resultado permanece na tela e há quadro estático coerente com movimento reduzido.

## O que mudou
- **Tema** (`src/app/theme.css`): sidebar verde profunda com logo, item ativo com barra verde-limão, card "Colheu hoje?" com produtor 3D, chip do usuário no cabeçalho, superfícies com raio 22–26px e sombras suaves.
- **Visão geral**: hero verde com saudação, pendência real e produtor 3D; card de clima com sol/nuvem animados (temperatura só quando a API fornece); card de acesso à Minha Fazenda; indicadores com contagem animada até o valor real; entradas escalonadas.
- **Minha Fazenda imersiva** (`farm-page.tsx`, `farm-hud.tsx`, `farm-workers.tsx`, `farm-world.css`):
  - Cena em tela cheia com painéis flutuantes: faixa de status (contagem por estado, sem somar volumes), painel de setores (vidro escuro), atividade recente (somente eventos confirmados, sem duplicar), card verde do setor selecionado e resumo da propriedade.
  - Trilhas de terra entre setores que compartilham produção; ao selecionar, arcos animados com "N lotes em comum". Ligações derivadas só de vínculos reais.
  - Câmera aproxima o setor escolhido e volta ao todo ao soltar.
  - **Bonequinhos animados** (personagens originais em SVG): andam por trilhas isométricas entre setores (preferindo setores ligados pelo mesmo lote), regam hortas, colhem em plantios e pomares, carregam caixas na coleta e conferem o armazém. Balões repetem apenas o estado real do setor (ex.: "Pedido aguardando ação!"). São ambientação ilustrativa; não representam pessoas, tarefas ou eventos registrados. Param no modo Construir e com movimento reduzido.
  - Modo Construir com dock inferior de 6 tipos (efeito de elevação), barra de salvamento flutuante e cartão de instruções.
  - Pássaros e nuvens decorativos.
- **Fazenda de exemplo** (`src/lib/farm-demo.ts`): "Sítio Esperança (exemplo)" com 10 setores (todos os 6 tipos), 8 culturas, ofertas, pedidos em vários estados e eventos. Sempre marcada como *dados simulados*, editável apenas localmente e nunca enviada à API (verificado). Acesso pelo botão "Ver exemplo", pelo primeiro acesso ou por `/minha-fazenda?exemplo=1`.
- Correção: o esqueleto de carregamento e o cabeçalho causavam rolagem horizontal em 320px durante o carregamento.

## Assets 3D
Recortados (fundo removido) a partir das imagens enviadas na conversa e salvos em `apps/portal/public/assets/3d/` e `public/brand/`: `produtor-caixa`, `produtor-forcado`, `fazenda-isometrica`, `canteiro-cenouras` e a logo. As imagens com marca d'água de banco de imagens (Adobe Stock/Freepik) **não** foram usadas. **Pendente: confirmar a licença de uso** das imagens aplicadas antes de publicação fora do contexto acadêmico.

## Validação
- `npm test`: 40/40 (20 novos de fazenda v1 mantidos + 9 novos v3: ligações, atividade, contagem por estado, rotas, preferência por setores ligados, balões com estado real, fazenda de exemplo válida, trilhas/arcos na cena, poses do personagem).
- `tsc --noEmit` e `npm run build`: aprovados.
- Roteiro headless Playwright (sem capturas) contra API e MongoDB reais em banco temporário: 36/36 — assets carregados, contagem até o valor real, exemplo com 10 setores identificado como simulado, 5 bonequinhos se movendo e executando ações, atividade, arcos, aproximação da câmera, exemplo editável sem gravar na API, construção real persistida, movimento reduzido estático, 390/320px sem rolagem horizontal, gaveta inferior, alvos ≥ 44px, sem exceções JS.

## Limitações
- Sem revisão visual por capturas (restrição do incremento anterior); recomenda-se revisão humana no navegador.
- Bonequinhos ficam em uma camada acima dos setores (sem ordenação de profundidade entre personagem e construção).


---

# Frontend 03 — versão limpa (10/11/2026)

Correção após revisão do usuário: a v3 ficou carregada demais.

- **Minha Fazenda:** removidos os bonequinhos animados, os balões, os selos grandes ("!" e contador), os painéis fixos de setores, atividade, faixa de status e resumo, além dos pássaros e da ilustração do convite inicial. Ficam a cena, as etiquetas com os nomes, as trilhas entre setores ligados, um botão compacto "Setores" (lista sob demanda, também alternativa acessível) e o painel do setor, que só aparece ao tocar. Pedido aguardando ação virou um ponto âmbar discreto dentro da etiqueta do setor; registro indisponível, um ponto vermelho. Os arcos do setor selecionado ficaram finos e sem rótulo.
- **Sidebar:** removido o card "Colheu hoje?" com o personagem; o avatar virou a inicial do nome.
- **Visão geral:** saudação curta com a pendência real e um só botão (Registrar produção); clima; um único cartão com os três indicadores, sem ícones. Removidos o card e o botão que levavam à Minha Fazenda, a ilustração 3D e os ícones genéricos dos indicadores e da lista de movimentações.
- Arquivos `farm-workers` removidos; `isoRoute` passou para `src/lib/farm.ts`.
- Validação: `npm test` 38/38, `tsc` e `build` aprovados; roteiro headless em 1440, 390 e 320px: 30/30 (sem os elementos removidos, ponto de pendência presente, menu abre o detalhe, sem rolagem horizontal, sem exceções JS).


---

# Frontend 04 — login e gráficos da Visão geral (10/11/2026)

- **Login:** painel verde profundo com a logo Agro+ Brasil, destaques verde-limão e a ilustração isométrica; formulário em cartão branco arredondado, botão verde profundo. No celular, o painel verde aparece compacto no topo (antes ficava oculto).
- **"O que você produz"** (base: `graphic-3d.tsx`): caixas isométricas por cultura, em contorno tracejado; a cultura destacada enche de verde. À esquerda, kg registrados (contagem animada), % do total e nº de registros da cultura. Passar o mouse, tocar ou usar as setas troca a cultura. Até 6 caixas; o excedente vira "Outras" sem perder o total. Sem seletor de período, porque não há série histórica.
- **"Como estão seus pedidos"** (base: `graphic-circle.tsx`): anel por situação (Solicitado, Aguardando retirada, Em entrega, Recebido, Cancelado) com núcleo desfocado e brilho; linhas por situação à esquerda; apontar ou tocar destaca o segmento e mostra quantidade e % no centro. Sem orçamento nem comparação com período anterior, pois esses dados não existem.
- A animação foi reimplementada sem anime.js (os componentes de referência dependem de bibliotecas que o portal não tem): entrada só quando o gráfico aparece na tela, respeitando movimento reduzido.
- Arquivos: `src/lib/chart-geometry.ts`, `src/components/chart-motion.ts`, `src/components/operational-charts.tsx` (reescrito), `tests/charts.test.ts`.
- Validação: `npm test` 43/43; `tsc` e `build` aprovados; roteiro headless em 1440, 390 e 320px: 27/27 (logo no login, caixas, destaque preenchido, troca por teclado, estado vazio do anel, sem rolagem horizontal, sem exceções JS). O anel com pedidos reais foi verificado por teste de renderização, não no navegador.


---

# Cenário de demonstração — pequeno produtor com alta demanda (10/11/2026)

Script `scripts/seed-busy-producer.mjs` (`npm run seed:demo:alta-demanda`, com MongoDB e API locais ativos e após `npm run seed:demo`). Tudo é criado **pela API real**, com as mesmas regras, transações e eventos de rastreabilidade; participantes e volumes são fictícios e marcados como demonstração. Tokens temporários ficam só em memória e são apagados ao final. Idempotente: uma segunda execução não altera nada (marcador em `demoScenarios`).

Conteúdo, na propriedade "Sítio fictício — DEMONSTRAÇÃO":
- 12 produções das últimas três semanas (alface, couve, rúcula, tomate, cenoura, abobrinha, milho, mandioca, laranja, banana).
- 11 ofertas: 10 publicadas (uma doação de mandioca) e 1 em rascunho.
- 15 pedidos de 7 compradores/instituições fictícios: 5 solicitados, 3 aceitos aguardando retirada, 2 em entrega, 4 recebidos e 1 cancelado, com duas cooperativas transportadoras.
- Minha Fazenda com 10 setores vinculados a essas produções (horta, estufa, raízes, milharal, mandioca, pomar, bananal, galpão, ponto de coleta, casa de sementes). **A configuração anterior da fazenda dessa propriedade (6 setores) foi substituída.**

Limitação: a API grava data/hora do servidor, então todos os eventos e pedidos têm a data de hoje; só as datas de colheita variam.

Verificado no portal (porta 3100): Visão geral (4.297,5 kg, 16 lotes, 10 pedidos em aberto, "5 solicitações aguardam sua análise"), gráficos de caixas e anel, Produção, Ofertas, Pedidos, Rastreabilidade e Minha Fazenda (10 setores, 7 com pedido aguardando ação, ponto de coleta com remessas), sem exceções JS.


---

# Gavetas e painéis laterais v4 (10/11/2026)

`apps/portal/src/app/drawers.css` (importado após `theme.css`), sem mudança de lógica:
- Gavetas (Detalhes do pedido, Nova produção e as demais que usam o mesmo componente): fundo branco, cantos arredondados de 28px, cabeçalho com leve gradiente verde-limão, título 25px em peso 800, descrição 14px, botão de fechar de 40px.
- Conteúdo: rótulos 13–14px, valores 14,5–15px, identificadores em fonte monoespaçada 12,5px; lista de detalhes em bloco cinza-esverdeado arredondado; campos de 48px com raio 14px e foco verde; confirmações e avisos em blocos de 14px; botões de 46px.
- "Propriedade de origem" em faixa verde profunda; ícones de seção de 40px.
- Painel "Detalhes da etapa" da rastreabilidade com título 22px, rótulos 13px, valores 15px e IDs em chips monoespaçados.
- Verificado no portal (1440 e 390px): o menor texto nas três telas é o rótulo em caixa alta de 11px; campos de 48px, botões de 46px, sem rolagem horizontal e sem exceções JS.


**Revisão (mais sóbria):** após feedback de que a versão anterior parecia carregada, `drawers.css` foi reescrito sem gradientes, brilhos, faixas coloridas nem blocos dentro de blocos. Fundo branco, linhas finas separando as informações, uma única cor de destaque (verde #2F6F4F), pesos 500/600 e escala tipográfica 12 · 13,5 · 15 · 22px. Campos e botões de 44px com raio de 10px, identificadores na mesma fonte do texto (sem chips monoespaçados), "Propriedade de origem" como linha neutra e ícones de seção sem fundo. Verificado no portal em 1440 e 390px: menor texto de 12px, sem rolagem horizontal e sem exceções JS.
