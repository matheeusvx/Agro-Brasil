# Redesign V2 — resultado e validação

05/11/2026 · Agro+ Brasil · “Meu campo, meu dia”

Abra a [comparação visual e galeria de capturas reais](REVISAO_VISUAL_V2.html). As imagens Android foram obtidas com `adb screencap` no emulador, não são mockups nem goldens apresentados como capturas de dispositivo.

## Resultado implementado

- Cabeçalho de propriedade com fazenda original: celeiro, cercas, vegetação em planos e linhas de cultivo. Nome, município e troca de propriedade preservados.
- Clima reprojetado: temperatura em primeiro plano, condição, localidade e observação; céu ilustrado e rodapé único de atribuição. Logo oficial reduzido de 85 para 42 dp de largura, link de 48 dp e texto exigido pela OpenWeather. Sem fonte válida, mostra somente indisponibilidade. Observação offline explicitamente não atual.
- Atalhos com mini-cenários agrícolas originais, quatro superfícies contextuais e rótulos operacionais.
- Primeiro acesso com benefício e uma ação principal. Solicitação, retirada e recebimento continuam respeitando as permissões originais.
- Produção com cultura/massa em destaque e acesso claro ao histórico. Ofertas e pedidos com estados em português, sem substituir valores dos enums enviados à API.
- Cadastro real em duas etapas, dados preservados ao voltar, validação antes de avançar, confirmação de origem no envio e seletor localizado de data.
- Rastreabilidade com produto conhecido no contexto e linha do tempo de eventos confirmados, local/data e responsável quando autorizado.
- Perfil com organização, papel, propriedade e informações da sessão. Login com paisagem autoral e linguagem coerente.
- Navegação com cinco destinos; em 320 px e texto ampliado, duas linhas preservam os rótulos inteiros e o tamanho solicitado pelo usuário.

Auditoria e vínculo com **cada um dos cinco PNGs** em [AUDITORIA_V2.md](AUDITORIA_V2.md). Tokens, componentes, autoria e atribuição em [DESIGN_SYSTEM_V2.md](DESIGN_SYSTEM_V2.md).

## Antes/depois e revisão crítica

| Avaliação | Antes | V2 / evidência |
|---|---|---|
| Clima | Valor e condição pequenos; crédito com logo e outro bloco em negrito | [Home/clima Android](android-v2/home-clima-390.png): 36 dp para temperatura, condição próxima, nota de aproximação e crédito secundário |
| Personalidade agrícola | Pequeno contorno de fazenda | Cena agrícola em cores com perspectiva leve; módulos usam o mesmo vocabulário visual |
| Direção da atenção | Cartões uniformes e atalhos só com ícones genéricos | [Clima + solicitação](android-v2/clima-pendencia-390.png): botão “Responder solicitação” inteiro antes da rolagem em 390×844 dp |
| Primeira produção | Bloco de instrução sem assinatura visual | [Primeiro acesso](android-v2/primeiro-acesso-390.png): resultado explicado, ilustração e um CTA |
| Produção | Cultura/safra/UUID no mesmo ListTile | [Produção](android-v2/producao-390.png): cultura e quantidade primeiro; identificador no detalhe |
| Ofertas/pedidos | Estados técnicos sem hierarquia | [Ofertas](android-v2/ofertas-390.png), [pedidos](android-v2/pedidos-390.png): estados humanos e contexto visual |
| Histórico | Cartões soltos | [Linha do tempo](android-v2/rastreabilidade-390.png): eixo e checkpoints por evento; sem mapa fictício |
| Acessibilidade | Não basta compilar | [320 px / 200%](android-v2/home-320-texto200.png), [clima rolado](android-v2/clima-320-texto200.png), [produção](android-v2/producao-320-texto200.png) |

Problemas encontrados **e corrigidos durante a revisão**:

1. Contraste do rótulo “Clima indisponível” no teste de acessibilidade: voltou a ter peso suficiente; teste de contraste mantido e aprovado.
2. Ilustração meteorológica tocava a nota de aproximação em 320 px: reposicionada acima da nota.
3. Rótulo “Produção” quebrava no meio da palavra no Android a 200%: navegação adaptativa em duas linhas, sem reduzir a escala de texto.
4. O primeiro teste de histórico ampliado podia tocar um registro encoberto pela navegação: rolagem explicitamente posicionada, alvo verificado como clicável e título do histórico exigido pelo teste. Goldens incorretos foram substituídos somente depois da correção.
5. Os logs do Android mostraram erro preexistente ao retornar do cadastro: `setState(() => future = load())` devolvia um Future. Corrigido nos três pontos da lista; novo teste de regressão cobre Produção e Ofertas. Retorno confirmado novamente no Android, sem novos erros nos logs.

## Validação executada

| Comando / procedimento | Resultado |
|---|---|
| `flutter analyze` | Sem apontamentos |
| `flutter test --reporter expanded` **sem** `--update-goldens` | **64 testes aprovados** |
| Goldens V2 em pasta nova | Estados da home em 390×844/390×1450; telas secundárias em 390×844 e 320×844 com texto 200%; baseline anterior preservada |
| `npm test` | **23 testes aprovados**, incluindo dados meteorológicos, validade, localização e proteção da chave |
| `npm run test:integration` | **35 testes aprovados**, MongoDB e transações reais, quatro públicos, autorizações, saldos e rastreabilidade |
| `flutter build apk --debug` | APK padrão gerado |
| `flutter build apk --debug --dart-define=DEMO_GALLERY=true` | APK de avaliação instalado e executado no Android |
| Android 17 / API 37 / `emulator-5556` | Capturas 780×1688 a 320 dpi = **390×844 dp**; também 640×1688 = **320×844 dp** e fonte do sistema **2,0** |
| Smoke Android por adb | Galeria, cinco abas, acesso ao histórico, estados, digitação, avanço à origem e retorno do formulário. Sem gravações na galeria |
| `flutter build web --base-href /mobile/ --no-web-resources-cdn` | Build final gerado |
| `npm run test:mobile:smoke` | Autenticação e API reais em banco fictício isolado, home, reload, fontes locais e WebAssembly; sem erros de console/requisições. [Resultado](web-v2/result.json) |
| `git diff --check` | Sem erros de whitespace |

As capturas de produção/pedidos/ofertas da galeria são **fixtures identificadas**, sem escrita, não uma simulação silenciosa de dados reais. Os 25 °C exibidos são exclusivamente o cenário visual fictício, nunca fallback da versão conectada. O smoke Web valida o estado meteorológico real `NOT_CONFIGURED`, sem exigir chave ou consultar o provedor. Não foi feita verificação meteorológica ao vivo com chave comercial.

O fuso do emulador é GMT e o ambiente de golden usa o fuso local do computador; horários de exemplo diferem por essa razão. O aplicativo converte a observação para o fuso do dispositivo, como antes. Não houve alteração do contrato meteorológico.

## Como avaliar e executar

O emulador foi deixado na versão de avaliação. Dados fictícios estão identificados; alterações são bloqueadas. Os binários ficam em `.data/` (ignorada pelo Git):

- `agro-v2-review.apk`: galeria independente de servidor, com cenários de clima, pendências, offline e primeiro acesso.
- `agro-v2-api.apk`: versão padrão que utiliza a API local existente.

Na pasta `apps/mobile`, execute `flutter run -d emulator-5556 --dart-define=DEMO_GALLERY=true` para a avaliação. Para a API local, use o build padrão e o encaminhamento `adb -s emulator-5556 reverse tcp:3000 tcp:3000`, com o backend/seed existentes iniciados. Nenhuma credencial foi incluída nos artefatos.

Roteiro das capturas principais: [scripts/capture-android-v2.ps1](../../scripts/capture-android-v2.ps1). É específico para a galeria e as coordenadas verificadas neste emulador; não representa automação genérica de qualquer dispositivo.

## Arquivos alterados neste ciclo

- `apps/mobile/lib/design.dart`: tokens, navegação adaptativa, cabeçalhos, estados e superfícies.
- `apps/mobile/lib/illustrations.dart` (novo): sete tipos de cena vetorial original, com variação meteorológica.
- `apps/mobile/lib/records.dart` (novo): cartão de produção, seção de formulário e linha do tempo.
- `apps/mobile/lib/home.dart`: propriedade, clima, atalhos e primeiro acesso.
- `apps/mobile/lib/main.dart`: tema e login.
- `apps/mobile/lib/tasks.dart`: listas, cadastro em etapas, histórico, perfil e correção de atualização da lista.
- `apps/mobile/lib/demo.dart`: fixtures explícitas de avaliação, sem gravações.
- Testes `design_behavior_test.dart`, `weather_test.dart`, `widget_test.dart`, `redesign_test.dart` e novo `v2_flow_test.dart`.
- Documentação V2, galeria HTML, capturas Android, goldens V2, evidências Web/backend e roteiro de captura.

Os arquivos Android ainda não rastreados, `.metadata`, `analysis_options.yaml`, documentos de direção/referências e `COMO_USAR.txt` já tinham alterações no início. Não foram descartados. As capturas antigas não foram sobrescritas. O resultado gerado pela integração foi salvo em `backend-v2-transacoes.json`, preservando o relatório anterior.

## Limitações

- A experiência Flutter existente atende pequeno produtor. As homes dos outros três públicos e autenticação de produção continuam fora do escopo funcional existente; não foram fingidas.
- A validação Android foi feita com fixtures em emulador; não em telefone físico ou com produtor em teste de campo.
- Os goldens verificam estabilidade e overflow, não substituem avaliação estética humana. A página comparativa permite essa avaliação.
- A atribuição segue a [FAQ oficial OpenWeather](https://openweathermap.org/faq#attribution); condições específicas do plano devem ser conferidas na publicação comercial.
- APKs de debug são artefatos de avaliação, sem assinatura comercial de publicação.

Backend, regras comerciais e fonte de clima preservados. Nenhum commit ou push foi executado. PNGs de referência continuam ignorados pelo Git e não são assets do aplicativo.
