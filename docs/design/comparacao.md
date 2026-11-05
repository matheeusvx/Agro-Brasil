# Home — antes e depois

Capturas produzidas pelo renderer Flutter, não mockups. Todas as cenas abaixo são **fixtures explicitamente identificadas**, sem pedidos ou clima fabricados na base operacional. A versão real foi conferida separadamente com a API local.

| Estado | Antes · 390×844 | Depois · 390×844 | Antes · 390×1450 | Depois · 390×1450 |
|---|---|---|---|---|
| Solicitação | [antes](antes/solicitacao-390x844.png) | [depois](depois/solicitacao-390x844.png) | [antes](antes/solicitacao.png) | [depois](../evidencias/mobile/solicitacao.png) |
| Primeiro acesso | [antes](antes/primeiro-acesso-390x844.png) | [depois](depois/primeiro-acesso-390x844.png) | [antes](antes/primeiro-acesso.png) | [depois](../evidencias/mobile/primeiro-acesso.png) |
| Retirada | [antes](antes/retirada-390x844.png) | [depois](depois/retirada-390x844.png) | [antes](antes/retirada.png) | [depois](../evidencias/mobile/retirada.png) |
| Recebimento | [antes](antes/recebimento-390x844.png) | [depois](depois/recebimento-390x844.png) | [antes](antes/recebimento.png) | [depois](../evidencias/mobile/recebimento.png) |
| Sem pendências | [antes](antes/sem-pendencias-390x844.png) | [depois](depois/sem-pendencias-390x844.png) | [antes](antes/sem-pendencias.png) | [depois](../evidencias/mobile/sem-pendencias.png) |
| Carregamento | [antes](antes/carregando-390x844.png) | [depois](depois/carregando-390x844.png) | [antes](antes/carregando.png) | [depois](../evidencias/mobile/carregando.png) |
| Erro | [antes](antes/erro-390x844.png) | [depois](depois/erro-390x844.png) | [antes](antes/erro.png) | [depois](../evidencias/mobile/erro.png) |
| Offline | [antes](antes/offline-390x844.png) | [depois](depois/offline-390x844.png) | [antes](antes/offline.png) | [depois](../evidencias/mobile/offline.png) |

## Revisão visual intencional

As oito imagens originais foram examinadas antes de editar. Uma primeira renderização do redesign foi revista e corrigida: texto repetido do estado tornava o cartão alto; removida duplicação, e reduzida a identificação redundante acima do nome da propriedade. A primeira ação ficou inteiramente visível em 390×844; teste verifica centro do CTA de solicitação abaixo de y=500. Os quatro atalhos permanecem disponíveis com rolagem.

Revisadas novamente as oito cenas em 390×844 e as versões longas: nenhum estado de acompanhamento recebeu promessa de ação do destinatário; primeiro acesso tem somente um CTA principal; offline apresenta os quatro atalhos de rede bloqueados, enquanto movimentações salvas continuam consultáveis; clima permanece indisponível sem ocupar cartão dominante.

Os goldens em `docs/evidencias/mobile/` foram atualizados deliberadamente após essas inspeções. Em seguida a suíte foi executada **sem** `--update-goldens`, confirmando comparação de pixels, comportamento e acessibilidade. Isso comprova renderização e regressão técnica, não uma pesquisa de usabilidade com pequenos produtores rurais.
