# Auditoria visual V2 — Meu campo, meu dia

Data: 05/11/2026. Inspeção visual direta dos cinco PNGs, antes da implementação.
Baseline adicional: captura do emulador antes da instalação, [antes-real.png](android-v2/antes-real.png).

## Problemas observados

Todos os itens 1–9 são verificáveis na [captura Android anterior](android-v2/antes-real.png) e em `referencias/ref_00_app_atual_android.png`.

1. Temperatura com o mesmo peso da descrição: a leitura principal do clima se perde.
2. Logo meteorológico centralizado entre linhas: fragmenta o percurso de leitura.
3. Atribuição em outro bloco, em negrito: fornecedor compete com a informação da propriedade.
4. Card climático monocromático e ícone genérico: não cria conexão com o cenário rural.
5. Nome da propriedade e saudação em um bloco escuro sem composição ilustrada: grande área de peso visual e pouco contexto.
6. Desenho anterior pequeno e só de contorno: assinatura agrícola quase ausente.
7. Os quatro atalhos têm a mesma superfície, peso e ícones de catálogo: pouco reconhecimento visual.
8. “Tudo em dia” tem tratamento semelhante ao de pendência: consome atenção sem ação necessária.
9. Primeira dobra termina cortando atalhos; grandes blocos se empilham sem ritmo editorial.
10. [Primeiro acesso anterior](antes/primeiro-acesso-390x844.png): um bloco de instrução textual, sem representar o resultado da primeira produção.
11. Produção anterior (`TaskPage`, auditada no código): ListTile mistura cultura, massa, safra e identificador interno; UUID recebe peso excessivo.
12. Ofertas/pedidos anteriores: estados da API em maiúsculas, pouca distinção entre informação de estado e CTA.
13. Histórico anterior: cartões independentes, sem continuidade visual que explique o caminho do lote.
14. Perfil anterior: texto corrido, sem hierarquia entre organização, papel e contexto da propriedade.
15. Cadastro anterior: sequência de campos sem agrupamento; safra sem exemplo, data exige digitação técnica.

Os itens 11–15 derivam da inspeção do código anterior; não são apresentados como capturas Android anteriores dessas telas.

## Correspondência com as referências

| PNG examinado visualmente | O que foi observado | Decisão autoral |
|---|---|---|
| ref_00_app_atual_android | Bloco verde, clima creme com marca grande, atalhos uniformes | Novo desenho completo do cabeçalho e do clima; fornecedor em rodapé único; atalhos com cenas próprias |
| ref_01_agropulse_fazenda_ilustrada | Céu azul, fazenda com planos de profundidade, módulos sobre paisagem | Celeiro terracota, cercas, árvores e curvas de cultivo desenhados em CustomPainter; propriedade legível à esquerda |
| ref_02_ranch_interface_ilustrada | Superfície meteorológica integrada, vegetação orgânica e ícones ilustrados | Cena meteorológica com sol/nuvens/chuva conforme condição recebida; mini-ilustrações reconhecíveis nos atalhos |
| ref_03_smart_farming_icones_3d | Caixas de hortaliças e pranchetas com volume e materiais reconhecíveis | Caixa original com tábuas, pregos, folhas e sombra discreta; prancheta e percurso. Perspectiva leve, preservando linguagem 2D |
| ref_04_nusa_tan_telas_modulares | Sistema inteiro consistente, módulos compactos com funções distintas | ModuleHeading, CropRecord, StatusPill, FormSection e EventTimeline repetem tokens sem repetir banners em todas as telas |

Nenhum PNG de referência é importado no Flutter, recortado ou convertido em asset.

## Princípios da skill aplicados

- **Hierarquia da atenção** (`product-strategy-and-features`): prioridade à próxima ação; sem adicionar indicadores ou módulos comerciais.
- **Dashboard orientado à ação** (`dashboards-and-data-viz`): propriedade e clima contextualizam o dia; cada pendência informa o próximo passo.
- **Estado vazio como onboarding** (`onboarding-and-activation`): benefício explícito e uma ação de primeira produção; demais ações continuam recolhidas.
- **Esforço percebido** (`checkout-and-forms`): campos agrupados por colheita e origem; exemplo de safra e teclados apropriados, mantendo validações e contrato.

## Limites preservados

O aplicativo Flutter existente implementa a experiência do pequeno produtor. Não foram inventadas homes para os demais públicos, pagamentos, previsões futuras, QR ou GPS contínuo. As regras dos quatro públicos continuam verificadas no backend.
