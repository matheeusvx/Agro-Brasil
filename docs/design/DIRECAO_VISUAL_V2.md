# Agro+ Brasil — Direção visual e UX, versão 2

## 0. Problema real que estamos resolvendo

A versão Android atual funciona, mas parece uma coleção de cards Material: área de clima sem hierarquia, logotipo de fornecedor meteorológico grande, poucos elementos agrícolas expressivos, pouco tratamento editorial, cartões quase iguais. O redesign deve elevar PERCEPTIVELMENTE o acabamento visual, mantendo sem atritos os fluxos de produção, excedentes/ofertas, pedidos e rastreabilidade.

A identidade Agro+ Brasil não é o logo nem a identidade da fonte meteorológica. É a rotina das pessoas e da propriedade. Valor central: conectar excedentes de pequenos produtores a cooperativas, instituições e compradores, com origem/rastreabilidade e informações regionais confiáveis.

## 1. Conceito

**'Meu campo, meu dia'** — uma interface agradável de abrir, simples para agir, com cenas agrícolas originais como assinatura visual. Deve parecer aplicativo de agricultura feito sob medida, não template SaaS nem app de gamificação infantil.

- Público principal da home piloto: pequeno produtor com pouco tempo, eventualmente com conectividade ruim.
- Linguagem: pt-BR direto; rótulos operacionais, não jargão de engenharia.
- Tom: acolhedor, seguro, sem infantilização, sem pontos/recompensas fictícios.
- Referências da pasta `docs/design/referencias`: ler todas; código atual é baseline funcional, imagens de terceiros são inspiração, não assets.

## 2. Gramática visual

1. **Ilustração agrícola autoral**: pequena paisagem com linhas de cultivo, celeiro ou estufa, vegetação em planos, céu e sol estilizados. Não ocupar espaço das tarefas do dia. Preferência por SVG/Vector original ou widget CustomPainter bem-acabado e testado em telas reais.
2. **Cores contextualizadas**: verde escuro para estrutura e confiança; verde-claro para superfícies de tarefa; azul céu e amarelo sol para clima; terracota/marrom para solos e estados neutros. Evitar pintar tudo de verde. Não empregar cores que confundam estados de alerta.
3. **Hierarquia tipográfica**: 3 níveis claros — título de página, título de seção, conteúdo — com fonte legível e respiro; ícones não substituem texto.
4. **Composição**: bordas suaves, camadas moderadas, cartões editoriais que não pareçam cópias entre si; grid consistente e alinhamento de conteúdo preciso. Evitar excesso de sombras/gradientes/badges.
5. **Identidade contínua**: o mesmo vocabulário visual em Início, Produção, Ofertas, Pedidos, Rastreabilidade e Perfil, mas respeitando o objetivo de cada tela. Não inserir banners grandes em todas as telas.

## 3. Tokens visuais INICIAIS (proposta, não imposição)

Cores a testar em dispositivo e ajustar por contraste:

| Token | Valor inicial | Uso |
|---|---|---|
| `forest900` | `#173F32` | Texto e ações primárias |
| `forest700` | `#245C43` | Cabeçalho / destaque |
| `leaf500` | `#4D9B5C` | Elementos agrícolas e ações secundárias |
| `leaf100` | `#E8F2E2` | Superfícies suaves |
| `canvas` | `#FAF8F1` | Fundo claro |
| `sky100` | `#DDF1FB` | Clima / céu ilustrado |
| `sky500` | `#5FAEDB` | Detalhes do clima, mantendo contraste |
| `sun300` | `#F7D57A` | Sol e detalhes quentes |
| `soil400` | `#C88964` | Terra e elementos ilustrativos |
| `ink900` | `#21342B` | Texto principal |
| `muted600` | `#5B6A60` | Texto secundário |
| `danger` | `#A53A38` | Erros (não usar apenas cor) |

- Radius: 16 / 20 / 24 dp, proporcional ao componente.
- Espaçamento base: 4, 8, 12, 16, 24, 32 dp; evitar valores aleatórios em cada tela.
- Ação principal: >=48 dp de altura; área clicável >=48x48 dp; label claro.
- Texto: escala legível e adaptável a 200%; testar contraste WCAG AA quando aplicável; icons com labels semânticos.
- Navegação inferior: 5 itens, tap target >=48, estado selecionado distinguível também por texto/forma.
- Fonte: avaliar atual Roboto e escolher alternativa livre para títulos apenas SE houver ganho real e licença; não depender de CDN ou chamadas externas.

## 4. Estrutura da HOME do pequeno produtor (390x844 primeiro)

**Acima da primeira rolagem:** identificação da propriedade, resumo do clima (se disponível) e CTA prioritário. Se o clima deslocar CTA para fora da área visível, compactar o clima ou mover sua posição. Não há obrigação de mostrar todos os quatro atalhos sem rolar.

1. Top bar compacta: Agro+ Brasil + refresh/sair; áreas de toque adequadas.
2. Identidade da propriedade: saudação e propriedade selecionada, cidade/UF em linguagem humana; **ilustração original** como camada lateral/de fundo sem prejudicar leitura. Se outra propriedade for selecionada, alterar contexto.
3. **Clima local (ver seção seguinte)**: componente editorial compacto com céu/sol/nuvens autorais; localidade + 25 °C em destaque (VALOR MERAMENTE ILUSTRATIVO, nunca dado de produção) + condição; observação/atualização. Exibir só quando houver dado real válido. Distinção entre clima de município aproximado e coordenadas verificadas.
4. **Sua próxima ação**: solicitação recebida, retirada, recebimento ou 'Tudo em dia'. Conteúdo objetivo e CTA único quando acionável; até duas pendências reais e priorizadas.
5. Ações rápidas: Cadastrar produção, Oferecer produtos, Rastrear lote, Ver pedidos, com ícones autorais coerentes; cards menores e harmônicos.
6. Caminho da sua produção: até 2 lotes recentes e último checkpoint confirmado; consulta detalhada em tela separada.
7. Bottom bar persistente: Início, Produção, Ofertas, Pedidos, Perfil.

### 4.1. Clima — refazer por completo, sem mexer na API

**Problema atual:** um card largo com conteúdo desalinhado, microinformações sem hierarquia e uma marca de provedor desproporcional. O dado relevante (temperatura + condição + localidade) não domina.

**Novo comportamento:**
- Em 1 olhar, saber **onde** e **como** está o tempo. No máximo 2–3 linhas principais.
- Layout proposto: superfícies sky100/creme, ilustração meteorológica original vetorial alinhada à direita, localidade pequena, número da temperatura grande, descrição curta; horário 'Atualizado às HH:mm' e nota 'Referência aproximada do município', quando aplicável.
- Evitar exibir umidade do ar na home se competir com informação principal; colocar em detalhes ao toque. Não confundir umidade do ar com do solo.
- Não afirmar chuva futura sem forecast real; API Current Weather não contém probabilidade de precipitação futura.
- Não expor chave no Flutter; backend continua fonte de dados. Não mostrar cidade diferente da propriedade selecionada.
- Falha/sem chave: ocultar o grande card e deixar acessível estado de indisponibilidade discreto, se necessário. Offline: mostrar última observação com data e identificação inequívoca de defasagem; nunca chamar cache antigo de 'agora'.
- **Atribuição obrigatória sob planos Free–Professional da OpenWeather:** FAQ exige texto 'Weather data provided by OpenWeather', hyperlink para https://openweathermap.org/ e logotipo oficial. Integrar em **uma única linha/rodapé visual discreto, legível e clicável**, dentro da área do clima ou em seção de detalhes visível e acessível. Não remover os créditos, não usar logotipo enorme, não repetir atribuição em dois blocos. Consultar condições específicas do plano antes da publicação comercial. Documentação: https://openweathermap.org/faq#attribution e https://openweathermap.org/faq .

### 4.2. Estados do produtor

- Primeiro acesso: cenário agradável com ilustração simples e um CTA 'Cadastrar minha primeira produção'; ações secundárias recolhidas.
- Solicitação: destaque principal e aceite/cancelamento claramente descritos, sem prometer ação que perfil não pode fazer.
- Retirada: ação coerente com permissão do usuário/organização; se não for permitida, apenas acompanhamento.
- Recebimento: status 'Aguardando confirmação do destinatário', sem CTA de confirmação para produtor.
- Sem pendências: estado leve e com personalidade, não ocupa o espaço de um alerta grande.
- Carregamento: skeleton com geometria semelhante ao layout, sem flashes enormes.
- Falha: erro útil + retry, sem perder acesso ao cache quando autorizado.
- Offline: visualização de snapshot claramente identificada; bloqueios SOMENTE de alterações e de consultas não armazenadas. Não prometer histórico completo offline.

## 5. Outras telas existentes

- **Produção**: visual de cultura/fazenda com ilustração original pequena, cadastro em etapas simples e validações inline; rótulos sem ambiguidade para quantidade, safra, origem e propriedade.
- **Ofertas**: produto, quantidade disponível, pedido/estado, CTA de publicar/suspender conforme API; não inventar preços ou pagamentos.
- **Pedidos**: estados legíveis, destaque do próximo passo por perfil, identificação de destinatário/transportador conforme autorização.
- **Rastreabilidade**: linha do tempo, produto, origem e última movimentação comprovada; nunca mapa GPS contínuo nem QR funcional se ainda não implementado.
- **Perfil**: organização, papel e alternância de contexto; sem expor dados sensíveis.
- **Cooperativas / instituições / compradores locais**: componentes visuais reutilizáveis, homes/ações contextualizadas, sem mostrar ações exclusivas de outro papel. Não fingir que funcionalidades de um perfil estão implementadas se ainda não estão.

## 6. Barreiras contra design genérico

- NÃO resolver só com alterar `ThemeData`, trocar verde, aumentar radius ou pôr sombra.
- NÃO copiar dashboard web para mobile.
- NÃO substituir clima por um banner publicitário do provedor.
- NÃO utilizar componentes todos com o mesmo card rectangular e mesmo ícone em outline.
- NÃO mostrar dados inventados como produção, clima, pontuação/gamificação, status de umidade do solo ou prognóstico hídrico.
- NÃO gerar personagens/ilustrações copiadas dos exemplos; criar desenho autoral/licenciado.
- NÃO aceitar 'passou flutter analyze' como prova de excelência visual.

## 7. Qualidade esperada

O Codex deve gerar screenshots do **Android Emulator real**, além dos golden tests Flutter, em 390x844 e 320px e com texto ampliado; comparar COM AS REFERÊNCIAS e justificar por que cada tela melhorou em composição, estética, simplicidade e coerência entre módulos.
