# Integração OpenWeather — execução de 05/11/2026

## Resultado e dependência de ativação

Código complementado e testado; **não ativado com dados reais**, pois `.env` local não contém chave. WEATHER_ENABLED=false e OPENWEATHER_API_KEY vazia foram preservados/configurados localmente, sem credencial fictícia. [Verificação sanitizada](configuration.json) registra NOT_CONFIGURED; não contém segredo. Nenhuma consulta real à API meteorológica foi realizada; nenhuma captura com clima real foi produzida. Testes usam fixtures explícitas, sem inseri-las no banco do produto. Não houve commit ou push.

## Inspeção e reutilização

Reutilizados: adaptador `services/api/src/weather.mjs`, rota autenticada em `producer-home.mjs`, autorização de propriedade por organização, `WeatherSummary` da home e HomeController de `data.dart`. O controller já consultava clima após a propriedade selecionada, isolava cache por usuário/organização/propriedade e descartava respostas atrasadas. Esse comportamento foi preservado; não foi necessário alterar data.dart. Backend comercial, eventos, reservas e dashboards não foram modificados.

Faltavam: geocodificação com persistência, precisão e origem explícitas, controle de orçamento upstream, tratamento de ambiguidade, informação meteorológica offline e atribuição visível com logo/link.

## Localização e persistência

1. Coordenadas numéricas da propriedade com verified=true e consent=true têm precedência. Posição inválida é recusada. Flags exigem verificação/consentimento reais por processo autorizado; não foram preenchidos automaticamente.
2. Alternativa: consulta geográfica por município e país BR; a documentação aceita state_code na consulta apenas para EUA, por isso a UF brasileira é validada no resultado. Exige nome (ou local_names.pt), país BR, estado correspondente à UF e coordenadas válidas. Normaliza acentos e espaços. Sem estado verificável, sem resultado ou mais de uma posição compatível: indisponível, sem escolher arbitrariamente.
3. Coleção MongoDB weatherLocations persiste referência municipal aproximada por 30 dias; resolução negativa por 24h. Identidade inclui propriedade, organização, município e UF. Origem e precisão armazenadas. Troca da localidade resolve nova referência. Nenhuma localização GPS do telefone é solicitada.

Expiração é lógica, sem limpeza automática; edição/consentimento de coordenadas não possuem formulário/endpoint novo. O teste de persistência usa MongoDB real e duas instâncias do adaptador, com upstream simulado.

## Endpoint e resposta

`GET /api/v1/properties/:id/weather`, autenticado e autorizado por organização. Contrato direto (sem envelope data) em [API](../../requisitos/api.md).

Disponível: status, source, attributionUrl, temperatureC, humidityPercent, description, observedAt, fetchedAt, cached, locality (municipality, uf, source, precision, approximate), limitation. Datas ISO UTC; nenhum segredo ou coordenada é retornado ao app. Indisponível: status unavailable, reason e message. Erros climáticos não derrubam a home; autorização conserva 401/403/404.

Somente Current Weather + Geocoding; Forecast 5 Day/3 Hour não foi adicionado por ser opcional. Nenhuma frase sobre chuva futura, solo, necessidade de irrigação ou risco hídrico individual é derivada desses dados.

## Resiliência e UI

Cache de observação até dez minutos e nunca além de duas horas desde a observação; rejeita datas excessivamente futuras (>10min), temperaturas/umidades inválidas, condição ausente e país divergente. Até 256 escopos em memória; chamadas simultâneas do mesmo escopo são deduplicadas. Falhas ficam 60s em cache. Timeout de 4s por chamada, orçamento 50 chamadas/minuto por processo (geocodificação + clima), cooldown de 60s após 429 ou credencial rejeitada. Limites são locais ao processo e precisam ser ajustados à quota efetiva da conta; não substituem um controle distribuído de consumo.

Flutter: localidade e indicação aproximada, temperatura/condição, horário da observação e atribuição com logo original OpenWeather e link. Fonte via url_launcher, sem chaves ou URLs autenticadas. Offline mantém horário e avisa “não é uma observação atual”; não habilita gravações. Indisponibilidade segue discreta. A hierarquia da home foi preservada.

## Testes executados

- npm test: 23 aprovados, incluindo 17 meteorológicos. [Log](backend-unit.txt).
- npm run test:integration: 35 aprovados (33 casos + 2 testes agregadores), MongoDB real. Inclui persistência da geocodificação, acesso meteorológico a propriedade de outra organização recusado, concorrência/idempotência comerciais e reinício da persistência. [Log](backend-integration.txt), [evidência de regressão com dados fictícios](transacoes-regressao.json).
- flutter analyze: sem issues. [Log](flutter-analyze.txt).
- flutter test: 42 aprovados, incluindo quatro novos testes visuais/comportamentais meteorológicos; goldens dos oito estados existentes permaneceram válidos sem atualização. [Log](flutter-tests.txt).
- Testes de cache Dart reforçados e reexecutados: 4 aprovados, incluindo preservação de temperatura/horário offline e bloqueio de escrita. [Log](flutter-cache-tests.txt).
- flutter build web --release --base-href /mobile/: concluído. [Log](flutter-build.txt).
- npm run check: sintaxe JavaScript verificada.

Cobertura meteorológica: ausência de chave, coordenadas/localidade ausentes, ambiguidade, estado/país incorretos, prioridade de coordenadas consentidas, troca de município, resposta inválida, observação antiga, abort/timeout real do fetch simulado, 429, orçamento por minuto, cache, deduplicação, persistência MongoDB, apresentação offline e layout 320px/texto 200%. Fixtures não comprovam resposta real do provedor.

## Ativação e validação restante

Configurar a chave válida diretamente no `.env` local, confirmar acesso aos produtos Current Weather e Geocoding e licença/quota da conta, habilitar WEATHER_ENABLED e reiniciar API. Não colar chave em chat, commit ou Flutter. Depois consultar o endpoint autorizado para duas propriedades de municípios diferentes; conferir referência, horário, cache e trocar a seleção na home. Só então produzir captura real e registrar evidência sanitizada. Autenticação de produção e builds Android/iOS continuam fora desta execução.

## Arquivos alterados

- API: src/weather.mjs, novo src/weather-location.mjs, src/app.mjs; test/weather.test.mjs e test/integration.test.mjs.
- Flutter: lib/home.dart, pubspec.yaml/lock, test/data_test.dart, novo test/weather_test.dart, assets/weather/openweather.png e NOTICE.txt.
- Documentação: apps/mobile/README.md, docs/requisitos/api.md, docs/arquitetura/modelo-dados.md, esta pasta de evidências. `.env` local ignorado; `.env.example` já possuía os dois parâmetros e não precisou mudar.

## Fontes oficiais consultadas

- [Current Weather](https://openweathermap.org/api/current): coordenadas, chave, unidades e timestamps.
- [Geocoding](https://openweathermap.org/api/geocoding-api): campos name/local_names, state, country e limite de resultados.
- [Forecast opcional](https://openweathermap.org/api/forecast5): não implementado nesta execução.
- [FAQ e atribuição](https://openweathermap.org/faq): crédito visível, link e logo; plano/licença efetivos ainda não informados.
- [Logos oficiais](https://openweathermap.org/payload/api/files/file/logo_files.zip): apenas PNG RGB original incluído; ZIP e demais arquivos temporários permanecem ignorados em .data.
