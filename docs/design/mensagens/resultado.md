# Mensagens — chat interno no portal (incremento 1)

12/11/2026 · base `main` em `5fba0a2` (backend do chat). Backend não alterado.

## Interface

- **Aba Mensagens** (`/mensagens`) no menu dos três públicos.
- **Desktop:** conversas à esquerda, com pesquisa, nome e tipo da organização, última mensagem, horário e indicador de novas. O histórico fica à direita: balões enviados (verde profundo, à direita) e recebidos (brancos, à esquerda), e o campo de texto fixo no rodapé.
- **Mobile (≤ 780 px):** a lista é a tela inicial; a conversa ocupa a largura toda e tem o botão "Voltar às conversas" (44 px).
- **Aviso de pedido:** `ORDER_LINK` aparece como pílula neutra "Pedido associado à conversa · #XXXX", com link para a tela já existente (rastreabilidade do produtor, `/remessas/:id` ou `/solicitacoes/:id`), que volta a verificar a autorização. Não deduz status nem prazo.
- **"Enviar mensagem":** disponível em Pedidos (detalhe do produtor), Remessas, Solicitações e nas três trajetórias. A rota de servidor `/api/chat-target` consulta `GET /orders` (já restrito pela API) e devolve ao navegador só os IDs e papéis das outras partes do pedido. Com mais de uma parte, a pessoa escolhe com quem falar. Depois disso, `POST /chats/open` reutiliza ou cria a conversa única do par, e só se a API autorizar. Não há conversas por lote, propriedade ou pedido.

## Comportamento

- **Histórico:** é lido com `after=0`, em páginas de 100 enquanto `hasMore`, e exibido em sequência crescente. A cada 3 s, a conversa aberta é consultada com `nextAfter`.
  - Uma consulta só começa depois da anterior; o resultado é deduplicado por id e por sequência.
  - Pausa com a aba oculta.
  - Rede ou 5xx aplicam espera de 6/12/24/30 s e mostram "Reconectando…".
  - 401, 403 e 404 retiram o histórico da tela e encerram as consultas.
  - Erro nunca vira lista vazia.
- **Envio:** o balão aparece com "Enviando…".
  - Falha de rede mostra "Tentar de novo" e "Descartar". Repetir reaproveita a mesma `Idempotency-Key` (`IdempotencyKeeper`); editar o texto gera outra chave.
  - 409 e 429 têm mensagem própria.
  - O sucesso só aparece com a resposta da API.
  - O texto é renderizado como texto React (`pre-wrap`), sem HTML nem Markdown.
- **LEITOR:** lê as conversas, não vê o campo de texto nem os botões "Enviar mensagem"; o proxy devolve 403 a POST.
- **Troca de organização:** o portal esconde o conteúdo na hora (`switching`), remove `?conversa=` e recria a página: lista e histórico recomeçam vazios.
- **Rolagem:** só acompanha o fim se a pessoa já estava no fim ou acabou de enviar. Lendo acima, nada se move; aparece a pílula "N novas mensagens".

## Movimento (StageShow como referência)

Cada movimento tem uma causa e dura entre 150 e 250 ms:
- lista com `ag-rise` em 220 ms, escalonada 35 ms por item (máx. 6);
- conversa entra com fade e 4 px (200 ms);
- só balões novos sobem 6 px com fade (200 ms); o histórico inicial e as atualizações não reanimam o que já existe;
- envio com opacidade e spinner; falha com contorno vermelho e ações;
- botão de envio com escala ao toque.

`prefers-reduced-motion` desliga tudo isso. O kit da skill não foi usado, porque é para ilustrações de UI falsa.

## Validação (API e MongoDB reais, banco descartável)

| Execução | Resultado |
|---|---|
| `npm run typecheck` / `npm run build` | aprovados |
| `npm test` (portal) | **74/74** (6 novos: contrato, deduplicação, espera, texto, proxy) |
| `scripts/e2e-portal-chat.mjs` | **8/8** — [relatorio-e2e-chat.json](relatorio-e2e-chat.json) |
| Regressão: `smoke-portal.mjs` e `e2e-portal-operacoes.mjs` | aprovado e 11/11 |

O E2E de chat cobre:
1. A instituição escolhe "Produtor do pedido" e envia. Uma falha de rede é seguida de reenvio com a mesma chave e um único registro. Tags HTML aparecem literalmente.
2. O produtor responde e a instituição recebe pelas consultas periódicas (latência no relatório). Só o balão novo anima.
3. Com 25 mensagens, quem está lendo acima não tem a rolagem alterada; a pílula leva ao fim.
4. Um segundo pedido do mesmo par reutiliza a conversa (1 chat no banco) e acrescenta um segundo aviso de pedido.
5. LEITOR: sem campo de texto nem botões; `POST` de mensagem e de abertura recebem 403.
6. Organização sem relação: 404 no histórico e na abertura; a tela mostra "Conversa indisponível".
7. Usuário com cooperativa e instituição: ao trocar, o histórico some e a lista mostra só as conversas do novo contexto.
8. Mobile 390: lista → conversa → voltar. 320 px e 320 px com texto 200% sem rolagem horizontal. Movimento reduzido sem animação. axe sem violações sérias ou críticas (contraste das horas corrigido durante a validação).

Capturas nesta pasta: `desktop-1440`, `instituicao-conversa-1440`, `produtor-conversa-1440`, `instituicao-escolher-contraparte`, `instituicao-envio-falhou`, `instituicao-nova-mensagem-lendo`, `conversa-reutilizada-aviso-pedido`, `leitor-somente-consulta`, `acesso-cruzado-indisponivel`, `mobile-390-lista`, `mobile-390-conversa`, `mobile-320-conversa`, `mobile-320-conversa-texto-200`.

## Limitações e contrato sugerido ao backend (Codex)

`GET /chats` devolve só `{id, organizationIds, createdAt}`. O portal compensa assim:

- **Nome da contraparte:** vem dos próprios vínculos e de `GET /cooperatives`. Produtores e instituições aparecem como "Organização parceira #XXXXXX", ou como "Produtor rural #…" quando a conversa foi aberta por "Enviar mensagem" nesta aba.
- **Última mensagem:** lida pelo histórico com cursor incremental por conversa (até 30 conversas, a cada 20 s). Essa leitura também materializa avisos de pedido, como o backend prevê para leituras.
- **Novas:** o ponto verde só considera mensagens que chegaram durante esta sessão do navegador. Não existe contador persistente nem confirmação de leitura.

Contrato sugerido (o portal já aceita esses campos opcionais em `parseChats`):

```json
{
  "id": "uuid",
  "organizationIds": ["uuid", "uuid"],
  "createdAt": "ISO",
  "counterpart": { "id": "uuid", "name": "Instituição X", "type": "INSTITUICAO" },
  "lastMessage": { "kind": "TEXT", "text": "…", "createdAt": "ISO", "sequence": 12, "fromSelf": false }
}
```

- `counterpart`: nome e tipo da outra organização ativa do par (dados que a relação comercial já comprova).
- `lastMessage`: último evento do chat, sem o autor pessoal.
- Para não lidas reais: `POST /chats/:id/read {sequence}` por organização e `unreadCount` na listagem.
- A ordenação da lista por `lastMessage.createdAt` no backend evitaria ler o histórico de cada conversa.

Fora do escopo desta versão: anexos, áudio, ligações, grupos, IA, WebSocket, edição e exclusão.
