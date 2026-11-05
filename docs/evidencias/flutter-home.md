# Home Flutter — execução de 05/11/2026

## Entrega

Home de tarefas para o pequeno produtor rural: saudação/propriedade; clima compacto somente com fonte válida (indisponível na configuração atual); até duas pendências; quatro atalhos; até dois lotes recentes; navegação Início, Produção, Ofertas, Pedidos, Perfil. Verde natural, creme, tons terrosos, cartões arredondados e ilustração vetorial discreta. As imagens fornecidas orientaram a linguagem visual, sem transformar textos/números de referência em dados do produto.

Telas de apoio simples conectadas aos contratos existentes: cadastro/consulta de produção, rascunho/publicação de ofertas, pedidos com aceite/cancelamento/retirada, consulta de histórico e perfil. O produtor não confirma recebimento em nome do destinatário. O backend continua verificando cada alteração; chaves idempotentes são mantidas em memória para repetição de uma requisição durante a tela.

## Arquitetura

`ApiRepository` HTTP + `HomeController` ChangeNotifier + estado local de formulários + widgets reutilizáveis. SharedPreferences guarda somente snapshot/catalogação por ator/organização/propriedade, sem token. Galeria de fixtures separada, ativada explicitamente por DEMO_GALLERY; sem gravações. Sem serviços, frameworks adicionais ou dashboards.

Backend preservado com extensões de leitura: catálogo retorna município/UF; `GET /producer-home?propertyId=<UUID>` filtra a propriedade autorizada, prioriza SOLICITADO → ACEITO → RETIRADO e limita a dois; `GET /properties/:id/weather` retorna somente observação validada ou indisponibilidade. Produção, reserva, pedidos, logística e rastreabilidade anteriores não foram substituídos.

Build web servido em `/mobile/`, mesma origem da API. CSP ajustada somente nessa rota para os requisitos do renderer Flutter (WebAssembly, estilos gerados, fontes/imagens locais); web antiga e API mantêm a política anterior. Não foi aberto CORS nem exposto servidor fora de loopback.

## Evidências executadas

- `flutter analyze`: **No issues found**.
- `flutter test`: **15 testes aprovados**, incluindo oito capturas golden, dados/cache/401, navegação e acessibilidade.
- `flutter test test/live_api.dart`: **um teste Dart HTTP real aprovado**, consulta somente leitura a sessão, catálogo, home, clima e eventos da API local.
- `flutter build web --base-href /mobile/ --no-web-resources-cdn`: build concluído, com fontes/renderer locais.
- Backend: **11 testes unitários aprovados** (seis originais e cinco do adaptador meteorológico); **32 casos de integração aprovados**, contabilizados como 34 pelo runner com dois agrupadores. Incluem os incrementos anteriores e dois novos casos de home/autorização.
- Navegador integrado: login demo, organização, home real, navegação Produção → histórico, Ofertas e Pedidos conferidos. Semântica expôs rótulos e cinco destinos da navegação. Home real mostrou nenhuma pendência; oferta tinha 4 kg disponíveis; pedidos anteriores estavam RECEBIDO. Nenhum pedido/coleta/clima foi criado para a demonstração.

Logs: `flutter-analyze.txt`, `flutter-test.txt`, `flutter-backend-unitarios.txt`, `flutter-backend-integracao.txt`. A evidência HTTP real está em `flutter-api-real.json`; as capturas dos oito estados estão em [mobile/README.md](mobile/README.md). São fixtures visuais explícitas; as respostas reais foram registradas separadamente. Os testes de provedor usam respostas simuladas de contrato, não observações meteorológicas reais.

## Limites e pendências

Sem chave OpenWeather fornecida e sem coordenadas verificadas na propriedade, clima real permanece indisponível. Documentação, plano e atribuição foram consultados; nenhuma conta/assinatura foi criada. Dados climáticos não são inteligência hídrica nem disponibilidade de irrigação.

Offline permite consulta da última home durante a sessão, com horário e sem alterações/fila. Listas completas não são cacheadas; histórico offline mostra apenas o último evento salvo. Primeira autenticação depende da API. Não foi validado login frio offline, PWA completo, Android/iOS ou leitor de tela físico; a11y verificada por testes e árvore semântica no navegador. Cache local não é criptografado e não verifica revogações enquanto offline; usar somente participantes fictícios neste ambiente.

Pendentes: toolchain Android/Windows já identificado, autenticação real, verificação com pequenos produtores rurais, integração meteorológica configurada, três dashboards e demais itens acadêmicos. Não houve Trello, publicação, commit ou alteração nos módulos Python/Java.

## Arquivos

Criados em `apps/mobile`: pubspec/lockfile, configuração Flutter web, `lib/main.dart`, `data.dart`, `home.dart`, `tasks.dart`, `demo.dart`, fontes/licença, testes de dados/widgets e smoke HTTP real. Atualizados README mobile e raiz.

Backend: novos `producer-home.mjs`, `weather.mjs`, `test/weather.test.mjs`; extensões em `app.mjs`, `test/integration.test.mjs`, script npm de testes e `.env.example` (sem alterar o `.env` real). Documentação de API/modelo e evidências atualizadas. Nenhuma dependência Node adicional.
