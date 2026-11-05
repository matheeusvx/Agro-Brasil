# Ofertas — incremento funcional

P0 e P1 concluídos dentro do limite de cinco horas. Pesquisa, filtros por situação/modalidade e paginação também entregues. Não foram implementados outros módulos. Home, Android, backend e contratos existentes não foram modificados.

## Operações e contratos

- `/ofertas`: tabela com consulta da propriedade selecionada, pesquisa por cultura/lote, filtros e oito registros por página. O catálogo autorizado associa os lotes à propriedade.
- `GET /offers?scope=mine&limit=100&offset=…`: paginação completa do contrato atual. Sem inventar um endpoint de detalhe: o drawer usa o registro dessa consulta. O cabeçalho permite atualizar a consulta.
- `POST /offers`: lote autorizado, quantidade em kg, VENDA/DOACAO, preço em centavos por kg e prazo local convertido para ISO UTC. O backend valida quantidade, organização, prazo, preço e uma oferta por lote. Lotes já ofertados não aparecem no seletor.
- `POST /offers/:id/publish`: município/UF e confirmação explícita; a API publica o rascunho e grava o evento de origem. Sem GPS automático.

O adaptador Next libera somente essas duas mutações adicionais; demais ações de negócio permanecem bloqueadas. `Idempotency-Key` é obrigatório e validado no proxy, encaminhado ao Express. `Idempotency-Replayed` retorna ao cliente. Credenciais e organização continuam definidas pela sessão no servidor; cookies HttpOnly e verificação de Origin preservados.

Cada tentativa guarda seu corpo e chave no componente. Durante envio ou resposta incerta, campos são bloqueados e a confirmação reutiliza exatamente o mesmo comando. O teste interrompe a resposta depois da gravação e verifica replay, uma oferta por lote e um único evento de publicação. Uma rejeição confirmada permite corrigir o formulário. Chaves não são persistidas entre recarregamentos/navegação: depois disso, consultar a lista antes de repetir; a unicidade e as regras da API continuam protegendo a operação.

## StageShow aplicada

Foram lidos `.agents/skills/stageshow/SKILL.md`, `references/motion.md` e `references/craft.md`. A [thread indicada](https://x.com/benjitaylor/status/2116593247854453244) retornou HTTP 403. Não foi possível analisar seu conteúdo; nenhum princípio é atribuído à thread.

A skill foi aplicada como motion design de produto real, usando os componentes Radix/shadcn existentes e CSS local. Não foi introduzido kit de demonstrações, cursor fictício, dado simulado na aplicação ou reprodução automática de tarefas.

| Princípio | Aplicação real |
|---|---|
| Todo movimento tem causa | abrir/fechar drawer, apontar linha, selecionar oferta e receber resposta da API |
| Deslocamento com chegada suave | drawer de 280 ms, `cubic-bezier(.45,0,.1,1)`; saída de 180 ms |
| Entrada distinta do deslocamento | conteúdo/feedback com opacidade e deslocamento de 6 px, 180–220 ms, `cubic-bezier(.25,.8,.25,1)` |
| Feedback imediato | hover de 150 ms, pressão de botão de 120 ms; carregamento imediato, sem aguardar animação para enviar |
| Preservar identidade e ancoragem | mesmo botão durante envio; Sheet retém o conteúdo até terminar a saída; ações fixas no rodapé do drawer |
| Resultado permanece legível | confirmação inline e estado atualizado depois de resposta real; sem pulsos ou movimentos repetidos |
| Acessibilidade | foco/Escape do Radix, rótulos de campos, alertas, estados vivos e `prefers-reduced-motion` com movimento praticamente instantâneo |

CSS de motion restrito ao módulo/drawers de Ofertas. A lista e os outros módulos não recebem animações globais novas. A validação de movimento usou frames reais do navegador, não o renderizador de cenas fictícias da skill. Rehearsal complementar: `apps/portal/src/components/REHEARSAL.md`.

## Arquivos

- `apps/portal/src/app/ofertas/page.tsx`: rota.
- `apps/portal/src/components/offers.tsx`: tabela, estado, drawers, comandos e confirmação.
- `apps/portal/src/components/portal-shell.tsx`: navegação e breadcrumb.
- `apps/portal/src/app/globals.css`: composição e motion com escopo de Ofertas.
- `apps/portal/src/lib/security.ts`: allowlist restrita.
- `apps/portal/src/lib/server-session.ts`: transporte da chave ao backend.
- `apps/portal/src/app/api/agro/[...path]/route.ts`: exigência da chave e retorno do replay.
- `apps/portal/tests/offers.test.ts`: limites do proxy.
- `scripts/portal-offers-browser.mjs` e `scripts/smoke-portal.mjs`: teste real isolado, com opção `--offers`.

## Validação

Build, TypeScript, sete testes do portal e 23 testes de API/clima aprovados. Smoke de Ofertas aprovado em Edge 156, com Express/MongoDB replica set isolado. Dados fictícios existem somente na fixture, sem tocar o banco configurado da aplicação.

Testados: criação de venda e doação, preço em centavos, publicação confirmada, perda de resposta e replay das duas operações, pesquisa, filtros, paginação com nove ofertas, erro de consulta/recuperação, quantidade zero, preço inválido, prazo passado, lote estrangeiro, oferta duplicada, chave ausente, LEITOR sem escrita e redução de movimento. Auditorias axe da lista, criação e publicação sem violações detectadas. Nenhum erro JavaScript capturado.

Capturas reais revisadas em 1440×900, 1366×768 e 1024×768:

- [Listagem 1440](evidencias/ofertas-lista-1440.png), [1366](evidencias/ofertas-lista-1366.png), [1024](evidencias/ofertas-lista-1024.png).
- [Criação](evidencias/ofertas-criacao.png).
- [Confirmação de localização](evidencias/ofertas-confirmar-publicacao.png).
- [Publicação concluída](evidencias/ofertas-publicada.png).
- [Rascunhos filtrados](evidencias/ofertas-rascunhos.png), [erro recuperável](evidencias/ofertas-erro.png), [LEITOR e estado vazio](evidencias/ofertas-leitor-vazio.png).
- Movimento: [entrada 1](evidencias/ofertas-motion-0.png), [entrada 2](evidencias/ofertas-motion-1.png), [entrada 3](evidencias/ofertas-motion-2.png).
- [Resultado automatizado](evidencias/ofertas-result.json).

Na revisão foram corrigidos largura dos botões de paginação, contraste na linha selecionada e posição da ação de publicação. O botão final permanece visível enquanto o conteúdo do drawer rola.

## Limites

Não há edição, cancelamento ou endpoint individual de oferta no contrato usado; não foram criadas ações falsas. As listas são filtradas e paginadas no cliente após paginação da API, com o limite explícito de 10 mil registros já adotado no portal. Dados dos detalhes são uma fotografia da consulta, atualizável pelo cabeçalho. A autenticação continua demonstrativa e restrita ao ambiente local.

Sem commit ou push.
