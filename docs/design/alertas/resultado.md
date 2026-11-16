# Avisos explicados nos três dashboards Flutter

Validação em 16/11/2026, America/Sao_Paulo. Implementação: commit `dc8fb78`, diretamente na `main`, sem push. O README raiz alterado, o notebook excluído e a pasta `.claude/` já existiam no início e foram preservados fora dos commits deste incremento.

## Enunciado e recorte

Foi lido o PDF oficial fornecido pelo usuário, **CPAD - Global Solution 2026.2 - Territory Predictive Insights(1).pdf**. Seu critério 3, “Alertas preditivos e transparência”, admite alertas gerados por regras ou previsões e exige justificativa/evidência, confiança, limitações e decisão final humana. O PDF foi tratado como referência acadêmica, não como autorização para ações externas.

Este incremento implementa regras transparentes sobre os contratos existentes. Não executa Ridge, não altera modelos congelados e não publica previsão experimental como operacional. Não há decisão automática, nova mutação comercial, indicador científico, endpoint ou dependência. A apresentação reutiliza cores, tipografia, cards e espaçamentos atuais; não houve redesign geral.

## Implementação verificável

| Parte | Evidência no código |
| --- | --- |
| Regras puras e explicações | [explained_alert.dart](../../../apps/mobile/lib/territorial/explained_alert.dart) |
| Card reutilizável e expansão | [alert_card.dart](../../../apps/mobile/lib/territorial/alert_card.dart) |
| Histórico mensal NASA POWER | [water_dashboard.dart](../../../apps/mobile/lib/territorial/water_dashboard.dart) |
| Ofertas, saldos e pendências | [production_dashboard.dart](../../../apps/mobile/lib/territorial/production_dashboard.dart) |
| Estados logísticos registrados | [logistics_dashboard.dart](../../../apps/mobile/lib/territorial/logistics_dashboard.dart) |
| Testes específicos | [explained_alert_test.dart](../../../apps/mobile/test/explained_alert_test.dart) |

Hídrico: precipitação mensal comparada à média do mesmo mês em 2000–2019; nível de atenção quando menor que Q25. Q10 e Q25 usam comparações estritas, preservando a classificação AGUA-04. Evidência inclui acumulado, média, quantis, intervalo LST, fonte, município e corte histórico. Mês acima/igual à média tem interpretação informativa; dados/referência inválidos produzem comparação indisponível e confiança baixa. Não se infere seca, escassez, solo ou irrigação.

Produção: ofertas PUBLICADA com saldo positivo em até 72 horas, excluindo vencimento igual/anterior à avaliação; pedidos SOLICITADO; soma de availableKg nas ofertas válidas. Reutiliza `ProductionSummary`, inclusive quantidades em gramas e a janela de três dias já existente. Não transforma produção registrada em excedente, saldo vencido em perda ou pedido em reserva duplicada. Avisos operacionais abrangem todas as colheitas da propriedade, como os saldos existentes; não acompanham o filtro anual de produção.

Logística: SOLICITADO → aguardando aceite; ACEITO → aguardando retirada; RETIRADO → aguardando confirmação do destinatário. RECEBIDO/CANCELADO não geram avisos de pendência. Contagem, período das datas de criação disponíveis e horário da consulta são evidências, sem estimar transições, atraso, prazo ou rota. Sem data, a evidência informa “não informadas” e a confiança é baixa. Cooperativa e destinatário mantêm a responsabilidade por suas etapas.

Confiança é qualitativa e justificada, sem probabilidade inventada: moderada para comparação histórica com referência de 20 anos ou registros autorizados consultados; baixa com valores/referências insuficientes, data de criação ausente/inválida, demonstração, offline, consulta antiga ou relógio anterior à consulta. Isso não certifica acurácia futura nem correção do cadastro.

## Atualização, privacidade e estados

Os repositórios existentes continuam responsáveis por autorização, paginação completa, vínculo entre produção/lote/oferta/pedido e cache por origem/usuário/organização/propriedade. As regras também recusam snapshot cujo escopo ou propriedade divirjam do contexto. Não há novo armazenamento, token ou dado pessoal no card. Mantida a recusa de fallback após erros 401/403/404 e a limpeza de cópias no encerramento da sessão.

Offline ou consulta com mais de 15 minutos: os avisos usam o horário da cópia para avaliar ofertas e exibem “Dados desatualizados · situação atual não confirmada”, confiança baixa e horário explícito na evidência. Não recalculam um saldo salvo como atual. A seção reavalia a idade a cada minuto e ao retomar o app; pode haver até um minuto entre o limite e a atualização visual. Quinze minutos é política conservadora de interface, sem validação estatística e sem garantia de atualidade antes do limite. O histórico hídrico é pacote local retrospectivo, não cache meteorológico atual.

FutureBuilders preservam carregamento, erro e nova tentativa; snapshots incompletos/inválidos não viram zeros ou avisos de normalidade. Sem avisos, o texto explica que isso não garante ausência de riscos. Os testes anteriores dos repositórios continuam cobrindo isolamento, autorização, logout, paginação e ausência de cache.

O card usa texto sem altura fixa, cabeçalhos semânticos, botão de expansão rotulado, ícone e texto para o nível, sem depender só de cor. A expansão respeita movimento reduzido. A decisão final humana aparece na seção e integralmente na explicação; nenhum aviso executa ações.

## Verificações executadas

| Comando / cenário | Resultado |
| --- | --- |
| `flutter analyze --no-pub` | Sem problemas; [log](analise.txt) |
| `flutter test --reporter expanded` | **150 testes aprovados**; [log completo](testes.txt) |
| `flutter test test/explained_alert_test.dart --reporter expanded` | **17 testes específicos aprovados**, incluídos nos 150 |
| `flutter build apk --debug --dart-define=DEMO_GALLERY=true` | APK gerado e instalado; [log](build-android.txt) |
| `flutter build web --release --dart-define=DEMO_GALLERY=true` | Build Web gerado; [log](build-web.txt) |
| `python scripts/export-agua04-mobile.py --check` | `OK: 7 embedded files match audited exports and provenance.` |
| `git diff --check` | Sem erros |

Os 17 testes cobrem os três dashboards abrindo suas explicações; limite de 72 horas e vencimento exato; oferta sem saldo/cancelada/sem prazo; produção sem oferta; pendências; estados abertos e terminais; responsabilidade de cooperativa/destinatário; datas ausentes; igualdade nos quantis/média e referência ausente; confiança demonstrativa/offline/antiga; isolamento de escopo/propriedade; ausência de avisos; atualização da seção; 320/900 dp com texto 200%; contraste, rótulos e alvos Android. A suíte completa inclui carregamento, erro, vazio, isolamento de cache e acessibilidade dos dashboards.

Há um aviso preexistente na suíte: `impact_card_test.dart`, teste “320 px com texto 200% sem estouro”, tenta tocar “Ver todas as etapas” fora da tela. O teste passa, mas esse toque não comprova sua expansão. Os novos testes de expansão dos alertas usam rolagem e toques efetivos e passaram; o indicador de impacto não foi alterado neste incremento.

O primeiro build Android encontrou arquivos de shader bloqueados por compilação concorrente no mesmo checkout. A repetição sequencial passou. O emulador inicialmente manteve imagem antiga/congelada; foi reiniciado sem snapshot com renderização por software e Vulkan desativado. As capturas abaixo foram conferidas após a recuperação. Não houve alteração no código para contornar esses problemas de ambiente.

## Capturas e conferência Android

Emulador **Medium Phone API 36.1**, viewport 780×1688 px, densidade 320 dpi (390 dp), fonte 100%. Também testado em 640×1688 px (320 dp), `font_scale=2.0`; o Android pode aplicar escala não linear. A fonte e o viewport foram restaurados aos valores anteriores após a conferência. Não foram observadas exceções Flutter/AndroidRuntime, textos sobrepostos ou overflow nos cenários conferidos.

| Cenário | Captura |
| --- | --- |
| Chuva mensal real abaixo da referência | [Card histórico](../../../apps/mobile/assets/screenshots/alertas/agua-aviso.png) |
| Fonte, período, confiança, limites e decisão humana | [Explicação hídrica](../../../apps/mobile/assets/screenshots/alertas/agua-explicacao.png) |
| Pendências e disponibilidade nas ofertas | [Cards de produção](../../../apps/mobile/assets/screenshots/alertas/producao-avisos.png) |
| Evidência das solicitações e limites de excedente/perda | [Explicação de produção](../../../apps/mobile/assets/screenshots/alertas/producao-explicacao.png) |
| Pedido SOLICITADO | [Aguardando aceite](../../../apps/mobile/assets/screenshots/alertas/logistica-aviso.png) |
| Pedido ACEITO | [Aguardando retirada](../../../apps/mobile/assets/screenshots/alertas/logistica-retirada-aviso.png) |
| Evidência de data ausente e supervisão humana | [Explicação logística final](../../../apps/mobile/assets/screenshots/alertas/logistica-retirada-explicacao.png) |
| Explicação em 320 dp, fonte ampliada, com rolagem | [320 dp / texto 200%](../../../apps/mobile/assets/screenshots/alertas/logistica-retirada-320-texto-200.png) |

[Manifesto e SHA-256 das capturas](capturas.json). São capturas do renderer Android, sem montagem. A galeria é fictícia e sem gravações; NASA POWER/AGUA-04 usa o pacote real mesmo na galeria. Para reproduzir: compilar com `DEMO_GALLERY=true`, instalar o APK, abrir os cenários `solicitacao`/`retirada`, acessar a gota no cabeçalho, Produção → Produção e excedentes ou Pedidos → Acompanhar logística, rolar até Avisos explicados e expandir Entender o aviso. A galeria não publica nem altera pedidos.

## Limitações da evidência

- Dados operacionais de capturas são demonstrativos; não houve sessão com propriedade de usuário real nem avaliação em produção. A integração normal usa os contratos e permissões existentes da API. Testes usam dados controlados e repositórios/HTTP de teste.
- Offline, cache e isolamento foram exercitados nos testes automatizados; as capturas Android operacionais usam a galeria. Não representam ensaio de revogação de acesso offline, impossível de confirmar sem rede.
- Validação Android visual e semântica extraída via UI Automator; contraste/alvos/rótulos verificados automaticamente. Sem auditoria integral de acessibilidade, ensaio completo com TalkBack ou estudo com usuários.
- Build Android **debug** e Web **release**. Não foi produzido APK release assinado, publicado artefato remoto ou executado push. Builds permanecem ignorados pelo Git.
- Não há previsão operacional validada, serviço AGUA-04 ao vivo, detecção de perdas, classificação de risco agronômico ou decisões automáticas. Os avisos apoiam avaliação humana e não garantem ausência de risco.

Aderência técnica demonstrada ao critério de alertas e transparência no recorte implementado; atribuição de nota e conformidade acadêmica integral continuam sob avaliação do professor.
