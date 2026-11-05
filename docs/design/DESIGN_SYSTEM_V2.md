# Agro+ Brasil — design system V2

Conceito: **Meu campo, meu dia**. Ilustração editorial agrícola original em 2D, formas orgânicas, materiais naturais, texto operacional em pt-BR.

## Tokens

Fonte única Roboto local (regular e bold), sem CDN. Título 24/1,2; seção 19/1,25; corpo 15/1,4; legenda 13/1,35. Temperatura 36/1,15. Não truncar conteúdo operacional para acomodar decoração.

| Token | Hex | Papel |
|---|---|---|
| forest | #173F32 | Estrutura, texto de destaque e ação principal |
| green | #285E45 | Ações secundárias |
| leaf | #73A760 | Vegetação e desenho, não texto pequeno |
| cream | #FAF8F1 | Fundo de leitura |
| paper | #FFFFFF | Registros e formulários |
| sky | #E2F0F4 | Superfície climática e rastreio |
| sun | #F3C969 | Luz e acentos ilustrados |
| terracotta | #C58660 | Celeiro/solo |
| wash | #ECF1E3 | Superfície agrícola suave |
| ink | #213E32 | Texto principal |
| muted | #58695D | Texto secundário |
| danger | #912F27 | Erro com texto/ícone |

Espaçamento 4/8/12/16/20/24/32 dp; gutter 20; raio 16 para controles, 22–24 para módulos. Botões primários 52 dp e links 48 dp de área mínima. Sem sombra nos cartões; a profundidade vem dos planos das ilustrações.

## Componentes e exemplos

- `FarmIllustration(art: FarmArt.landscape)`: cenário de propriedade com cultivo em perspectiva, celeiro e vegetação. Decoração excluída da semântica.
- `WeatherSummary(weather: respostaDoBackend, offline: estado)`: localidade, temperatura, condição e observação. Sem temperatura finita/data válida, só indisponibilidade. Sem umidade ou prognósticos inventados.
- `ModuleHeading(title: 'Minha produção', subtitle: 'Sua colheita, com origem registrada.', art: FarmArt.harvest)`: título editorial compacto. Ilustração lateral retirada com texto ampliado para priorizar leitura.
- `QuickAction`: caixa de colheita, caixa de oferta, percurso ou prancheta; superfícies com contexto e texto explícito.
- `CropRecord`: cultura/massa em destaque, safra secundária e acesso ao histórico. Identificador disponível no detalhe.
- `StatusPill`: estado em português, legível por texto, sem depender só de cor.
- `FormSection(number: '01', title: 'Sua colheita')`: cadastro real em duas etapas, com validação antes do avanço. Colheita/lote e quantidade primeiro; origem ou destino depois. Voltar preserva valores; trocar de etapa reposiciona a rolagem. A data usa seletor nativo localizado; envio continua no formato da API.
- `EventTimeline(events: eventosConfirmados)`: eixo vertical e checkpoints de eventos, local e data comprovados.
- `FarmEmptyState`: resultado esperado e orientação contextual, sem números simulados na versão conectada.
- `PropertyHeader`: identificação selecionada e alternância somente quando há outras propriedades autorizadas.
- `AgroNavigationBar`: cinco destinos persistentes, seleção por forma/peso/ícone/texto.

## Clima e atribuição

A fonte continua sendo exclusivamente o backend. Propriedade alterada dispara o carregamento já existente, com proteção contra respostas fora de ordem. Sem conexão, a observação salva é identificada como não atual.

O rodapé tem logo oficial a 42 dp de largura, texto “Weather data provided by OpenWeather” e link externo. Área clicável de 48 dp; texto pode quebrar em telas estreitas e com ampliação. A marca fica em uma única unidade secundária; não compete com a temperatura.

Requisito conferido na [FAQ oficial OpenWeather, seção License](https://openweathermap.org/faq#attribution) em 05/11/2026: logo, hyperlink e texto visível nos planos Free–Professional. Plano contratado e condições comerciais específicas continuam sendo responsabilidade da configuração de publicação.

## Autoria e uso de assets

`lib/illustrations.dart` contém geometria original criada para o Agro+ Brasil neste ciclo. Não é traçado ou derivação pixel a pixel dos PNGs de referência. Não depende de modelos de terceiros ou de rede. Usa a licença aplicável ao código do repositório; não altera a licença de fontes, Material Icons ou do logo oficial OpenWeather preexistentes.

A Roboto local acompanha sua licença Apache 2.0 em `assets/fonts/roboto_license.txt`. A origem e as condições da marca OpenWeather estão em `assets/weather/NOTICE.txt`; o logo oficial não herda a licença do código. Os novos desenhos são código original do projeto, sem nova dependência de assets de terceiros.

## Responsividade

Listas têm largura máxima 760 dp; formulários 680 dp; textos podem crescer e rolar. Cenário de propriedade e ilustração lateral dos títulos saem de cena quando a escala supera o limite de legibilidade. Dados essenciais e ações continuam presentes. Testar 390×844, 320×844 e escala 200%, incluindo telas secundárias, e não somente a home.

Em largura inferior a 440 dp com texto muito ampliado, os cinco destinos passam a duas linhas, com larguras proporcionais aos rótulos. Isso preserva “Produção” por inteiro e respeita a ampliação de fonte, sem encolher artificialmente o texto. A variante padrão continua em uma linha.
