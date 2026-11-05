# Prompt para Codex — redesign autoral Agro+ Brasil (UI/UX V2)

Você está no monorepositório `C:\Users\Sucesso\Documents\agro+brasil`. Há um aplicativo Flutter funcional, mas a apresentação visual foi considerada muito crua e genérica, especialmente a área de clima. O solicitante aprovou este ciclo de transformação profunda. **Seu trabalho é implementar um DESIGN SYSTEM AUTORAL agrícola, não apenas trocar cores de cards.**

## Fonte principal — OBRIGATÓRIA

Leia e ABRA VISUALMENTE (não apenas nomes de arquivo):
- `docs/design/referencias/ref_00_app_atual_android.png` — baseline atual a superar;
- `docs/design/referencias/ref_01_agropulse_fazenda_ilustrada.png`;
- `docs/design/referencias/ref_02_ranch_interface_ilustrada.png`;
- `docs/design/referencias/ref_03_smart_farming_icones_3d.png`;
- `docs/design/referencias/ref_04_nusa_tan_telas_modulares.png`.

Leia os documentos `docs/design/referencias/README.md`, `docs/design/DIRECAO_VISUAL_V2.md` e `docs/design/CRITERIOS_ACEITACAO_UI_V2.md`.

Utilize a skill já instalada **revenue-centric-design**: onboarding-and-activation; dashboards-and-data-viz; product-strategy-and-features; checkout-and-forms. A skill guia clareza e ação, mas as **imagens enviadas pelo usuário** são a referência estética prioritária.

## Objetivos

1. Criar uma linguagem visual única, autoral e coerente para Agro+ Brasil: ilustrativa, rural, amigável, com alta qualidade editorial de UI, moderna e bem acabada.
2. Reprojetar completamente o **componente de clima**: compactação, hierarquia, iconografia original, localidade/condição/temperatura/horário, atribuição legal mínima e discreta. O produtor não deve ver uma propaganda da OpenWeather.
3. Aplicar essa linguagem a telas já existentes: login, home, produção, ofertas, pedidos, rastreabilidade/histórico e perfil; preservar regras e dados reais da API. Manter uma navegação consistente para quatro públicos, sem fingir telas ainda não construídas.
4. Tornar o app mais próximo do nível visual e de composição das referências **sem copiar suas marcas, personagens, ilustrações específicas ou reproduzir telas pixel a pixel**.

## Etapas (execute, não pare em explicações)

A) Documentar a auditoria visual: listar pelo menos 10 problemas com screenshots e impacto real. Qualificar quais características de cada referência são úteis. Registrar `docs/design/AUDITORIA_V2.md`.
B) Propor e IMPLEMENTAR design tokens, componentes e linguagem de ilustração original: `docs/design/DESIGN_SYSTEM_V2.md`; organizar módulos Flutter reutilizáveis sem reescrever backend.
C) Redesenhar o card climático e a home. Priorizar legibilidade em 390x844; CTA principal não pode ser encoberto por banners decorativos. A tela deve ser perceptivelmente diferente do layout atual.
D) Expandir os componentes para as demais telas Flutter existentes. Dar prioridade a rótulos, formulários, estados e fluxo funcional. Não inventar funcionalidades inexistentes.
E) Validar com o EMULADOR ANDROID REAL, Web e testes; capturar antes/depois com viewport comum; iterar até resolver problemas concretos. Nunca declarar visual revisado somente porque testes de widget passaram.

## Segurança, clima e dados

- Nunca colocar chave OpenWeather, token demo ou dados privados nos assets Flutter, no README, nos logs ou no Git.
- O backend já devolve dados climáticos e coordenadas municipais aproximadas. Preservar seu contrato, autorização, cache e indicação de atualidade.
- A licença OpenWeather Free–Professional exige logo, hyperlink e texto visível de atribuição 'Weather data provided by OpenWeather'. O crédito deve ser compacto, secundário e visualmente integrado, preferencialmente em uma só linha de rodapé com tamanho legível, sem bloco separado; validar licença vigente. https://openweathermap.org/faq .
- Não remover atribuição nem exibir logo grande repetido.
- Sem inventar chance de chuva, irrigação, umidade do solo ou GPS contínuo.
- Sem alterar regras de pedidos, lotes, pagamentos inexistentes, nomes de papéis ou permissão de movimentações.

## Entregáveis

1. Uma nova versão executável do Flutter com a melhoria visual implementada.
2. Design system com tokens e exemplos de componentes.
3. Screenshots reais do emulador Android (mínimo: home/clima, primeiro acesso, pendência, produção, oferta/pedidos, rastreabilidade) e Web quando pertinente.
4. Comparação ANTES/DEPOIS e justificativa de design com vínculo às imagens de referência.
5. Resultado de `flutter analyze`, `flutter test`, smoke Web, testes de backend relevantes e testes no Android.
6. Lista de arquivos alterados e limitações honestas.

**Não fazer commit/push automaticamente; não adicionar PNGs desta pasta ao Git remoto.** Preserve funcionalidade e código anterior; se útil, checkpoint Git local antes de começar. Evite implementar outras disciplinas acadêmicas neste ciclo.
