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

`GET /properties/:id/weather` é um proxy autenticado; usa somente coordenadas cadastradas naquela propriedade e pertencentes à organização. O app não recebe chave ou escolhe coordenadas do provedor. Chave ausente, integração desligada, coordenadas ausentes, falha ou dado meteorológico antigo resultam em `unavailable`. O cadastro atual tem município/UF, mas não coordenadas verificadas; geocodificação automática e edição de propriedades estão pendentes. Por isso a demonstração real apresenta **Clima indisponível**.

OpenWeather Current Weather exige chave e plano com acesso ao produto. A documentação e as condições de acesso foram consultadas em 05/11/2026: [documentação](https://openweathermap.org/api/current), [planos](https://openweathermap.org/price), [FAQ/atribuição](https://openweathermap.org/faq). Não foi criada conta, contratada assinatura ou realizada consulta meteorológica real. Antes de ativar, confirmar a chave/plano, atribuição/licença e cadastrar coordenadas autorizadas. Variáveis somente no backend: `WEATHER_ENABLED=true`, `OPENWEATHER_API_KEY`. Cache de observação por dez minutos; timeout de quatro segundos; dados com mais de duas horas são recusados. O resumo exibe fonte/horário, temperatura e umidade **do ar**, sem inferir irrigação ou umidade do solo.

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
