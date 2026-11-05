# Aplicativo Flutter / Dart

Home Flutter orientada às tarefas do pequeno produtor rural, com telas básicas de produção, ofertas, pedidos, histórico e perfil. Interface em português, fonte Roboto local, navegação inferior com cinco destinos e árvore semântica habilitada na web. Sem dashboards analíticos nesta etapa.

## Executar

Com o MongoDB/API da raiz ativos, nesta pasta:

```powershell
flutter pub get
flutter analyze
flutter test
flutter build web --base-href /mobile/ --no-web-resources-cdn
```

Abra **http://127.0.0.1:3000/mobile/**. A API Express serve o build e o Flutter consulta `/api/v1` na mesma origem, sem abrir CORS. Se o servidor estava executando uma versão anterior, reinicie `npm.cmd start` na raiz. Não substitua seu `.env` existente.

Use o token fictício PEQUENO_PRODUTOR_RURAL de `.data/demo-sessions.json`, verifique o acesso e selecione uma organização autorizada. A propriedade pode ser alterada na home. Token apenas em memória: não usar token em dart-define, URL, assets ou armazenamento local. Login real de produção permanece pendente.

Os quatro atalhos abrem cadastro real de produção, criação de rascunho da oferta, listagem/histórico de lotes e pedidos. A aba Ofertas permite publicar o rascunho. Pedidos permitem aceite com cooperativa opcional, cancelamento e retirada conforme backend; confirmação de recebimento cabe ao destinatário, não ao pequeno produtor rural. Cada alteração exige confirmação de localização. A API continua sendo a autoridade de permissões e estados.

## Estados, cache e limites

Home: primeiro acesso, solicitação aguardando resposta, aceite aguardando retirada, retirada aguardando recebimento, nenhuma pendência, carregamento, erro e acesso ao serviço indisponível com cache. Há no máximo duas pendências, ordenadas pelo backend (ação antes de acompanhamento), e dois lotes recentes por propriedade. Sem contadores zerados, coletas agendadas ou clima inventados.

O cache SharedPreferences guarda somente catálogo e snapshot da home por origem/usuário/organização/propriedade. Nunca guarda tokens. Na perda de acesso ao serviço durante a sessão, mostra a última cópia e seu horário, sem alterações ou fila de envio. O histórico offline contém apenas a última movimentação salva; listas completas e formulários exigem conexão. 401/403/404 não ativam fallback de cache. Sair remove os snapshots da sessão. Revogação não pode ser verificada offline: cache é somente consulta local previamente autorizada. Primeira autenticação/carga ainda exige acesso à API; não há promessa de login frio offline ou PWA instalável completa.

## Clima

O endpoint autenticado `GET /properties/:id/weather` prioriza coordenadas da propriedade com `verified: true` e `consent: true`. Sem elas, resolve município/UF/BR com OpenWeather Geocoding, validando nome, país e estado. Resultados ambíguos são recusados. A referência municipal é identificada como aproximada e persiste no MongoDB por 30 dias, inclusive entre reinícios. Não há uso automático do GPS.

Configuração exclusivamente no backend: `WEATHER_ENABLED=true` e `OPENWEATHER_API_KEY` no `.env` ignorado pelo Git; depois reiniciar a API. Não colocar chave no Dart, assets, URLs do aplicativo ou logs. Sem chave a integração continua desabilitada. Cadastro e verificação de coordenadas ainda não possuem interface.

Cache de até dez minutos, limitado à validade da observação (duas horas), timeout de quatro segundos por chamada e orçamento de 50 chamadas upstream/minuto por processo (inclui geocodificação). Ajustar o construtor conforme quota do plano; não é limitador distribuído. O resumo exibe localidade, temperatura, condição, horário e atribuição com logo/link oficiais. Offline apresenta a cópia salva explicitamente como não atual. Umidade do ar permanece no contrato, sem inferir solo ou irrigação. Não há previsão de chuva nesta etapa.

Não havia chave configurada nesta execução: consulta meteorológica real e captura com dados do provedor permanecem pendentes. [Relatório e logs](../../docs/evidencias/openweather/relatorio.md). Documentação: [Current Weather](https://openweathermap.org/api/current), [Geocoding](https://openweathermap.org/api/geocoding-api), [atribuição](https://openweathermap.org/faq). Confirmar produtos, quota e licença da conta antes de ativar.
## Demonstração e testes

Capturas reais do renderer Flutter, com fixtures identificadas: [oito estados](../../docs/evidencias/mobile/README.md). Fixtures nunca são inseridas no MongoDB. Galeria opcional, exclusivamente demonstrativa e sem gravações:

```powershell
flutter run -d chrome --dart-define=DEMO_GALLERY=true
```

O modo normal conecta a API; a galeria tem Repository separado. Para regenerar as capturas, executar `flutter test --update-goldens`. Para o teste Dart HTTP **real**, somente leitura e com API/seed ativos: `flutter test test/live_api.dart`. O comando não imprime tokens e salva `docs/evidencias/flutter-api-real.json`.

Os testes cobrem navegação, oito estados, snapshot offline, isolamento do cache, erro de autorização, contraste, rótulos, alvo de toque e layout 320 px/texto 200%. A análise estática e o build web foram executados. Android/iOS não foram compilados nesta etapa; permanecem os bloqueios do toolchain registrados na auditoria. A fonte Roboto foi copiada do SDK Flutter com sua licença em `assets/fonts/roboto_license.txt`.

## Fora desta execução

Três dashboards territoriais, análises hídricas, alertas preditivos, indicador de benefício social completo, QR Code, autenticação de produção, aplicativo dos outros três públicos e telas avançadas. Prazo Flutter informado: 19/11/2026 23h55, America/Sao_Paulo. Esta home não encerra a entrega acadêmica inteira.

O backend demo vincula-se a loopback por segurança. Emulador/dispositivo requer configuração específica; não mudar bind nem expor tokens demo para atender ao dispositivo. Definir identidade e acesso adequados antes da integração fora da máquina.

## Validação de inicialização no navegador

Da raiz: `npm.cmd run build:mobile` e `npm.cmd run test:mobile:smoke`. O primeiro comando fixa o build sem CDN; o segundo inicia servidor Express real e MongoDB isolado, usa navegador Chromium instalado e verifica autenticação/home renderizadas, com rede externa bloqueada. O smoke falha diante de erro JavaScript, CSP, recurso ausente ou falha de renderização. Detalhes e modo `--existing`: README da raiz. Não basta executar apenas testes de widgets para validar a entrega web.
