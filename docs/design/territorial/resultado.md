# Inteligência Hídrica — entrega do primeiro incremento

09/11/2026 · Agro+ Brasil · Flutter existente em `apps/mobile/`. Nenhum commit ou push executado.

## Resultado e acesso

O primeiro dashboard territorial está funcional. Abrir pelo **ícone de gota no cabeçalho** do aplicativo mobile ou desktop. A tela possui rota própria e botão Voltar; os cinco destinos existentes continuam iguais. A consulta hídrica independe da propriedade e funciona sem rede no Android, com arquivos incluídos no APK. A home, autenticação demonstrativa, formulários, produção, ofertas, pedidos, histórico e cache existentes foram preservados.

O painel apresenta Mogi das Cruzes/SP, NASA POWER AG e histórico 2000–2025. Permite escolher os 26 anos e os meses disponíveis, selecionar barras mensais/diárias, comparar sazonalidade, alternar acumulados de 7/30 dias e sequência de baixa chuva, consultar os indicadores da data selecionada e entender as anomalias. Valores detalhados, critérios estatísticos, fonte, qualidade e limitações ficam disponíveis sem depender de cor ou tooltip.

**Produção/Excedentes e Logística permanecem não implementados como dashboards territoriais.** A tela comercial Produção não foi reclassificada como dashboard concluído. A exigência acadêmica dos três painéis distintos ainda está parcialmente atendida: 1 de 3. Auditoria e análise das três referências: [auditoria.md](auditoria.md).

## Arquivos alterados

| Arquivo ou grupo | Mudança |
|---|---|
| `apps/mobile/lib/territorial/water_dashboard.dart` | Nova tela, filtros, indicadores, interação, interpretações e proveniência |
| `apps/mobile/lib/territorial/water_data.dart` | Adaptador tipado do contrato/CSV, validações, índices de datas e formatação brasileira |
| `apps/mobile/lib/territorial/dashboard_components.dart` | Cards/grid, cabeçalho e filtro territorial, gráfico comparativo, legenda e estados reutilizáveis |
| `apps/mobile/lib/main.dart` | Acesso no cabeçalho e rota independente; sessão e navegação existentes preservadas |
| `apps/mobile/lib/desktop.dart` | Mesmo acesso no cabeçalho desktop, sem ampliar a navegação lateral |
| `apps/mobile/pubspec.yaml`, `pubspec.lock` | Pacote de assets AGUA-04 e `intl` como dependência direta; sua versão instalada não mudou |
| `apps/mobile/assets/agua04/` | Sete cópias byte a byte dos exports auditados e um manifesto de proveniência |
| `apps/mobile/test/water_dashboard_test.dart` | 14 testes dos dados, contrato, filtros, gráficos, estados, navegação, rolagem e acessibilidade |
| `scripts/export-agua04-mobile.py` | Exportação local reproduzível, verificação de SHA-256 e modo `--check` sem escrita |
| `scripts/capture-agua04-android.ps1` | Roteiro de capturas/gravação nativas, rede desligada e restauração em `finally` |
| `scripts/smoke-mobile.mjs` | Smoke existente ampliado para abrir o painel real e voltar à home; diagnósticos sanitizados |
| `apps/mobile/README.md` | Execução, integração, acesso, estado acadêmico e limites atualizados |
| `docs/design/goldens-v2/` | 28 referências visuais atualizadas pela inclusão do ícone no cabeçalho; diff inspecionado |
| `docs/design/territorial/` | Auditoria, relatório e evidências locais |

Não houve edição do portal Next.js, do backend, do pipeline AGUA-04, de `data.dart`, do cache SharedPreferences ou dos fluxos de autenticação. As alterações pré-existentes no workspace foram mantidas.

## Integração e dados

Sem endpoint disponível. A fonte de integração é `analytics/agro-agua/outputs/agua04/`, com contrato **agua04-1.0**. O pacote embarcado contém:

- `integration-example.json`: envelope, indicadores finais, classificação, natureza e limitações originais.
- `monthly_indicators.csv`: **312 meses** (2000–2025), totais, dias de baixa chuva, maior sequência dentro do mês e anomalias.
- `historical_indicators.csv`: **9.497 dias**, acumulados móveis, sequência terminando na data e classes diárias auditadas.
- `training_monthly_reference.csv`: média histórica dos **20 anos de 2000–2019**, para cada mês.
- `thresholds.csv`: 48 referências por indicador/mês; sem ajuste com 2020–2025.
- `audit.json`, `inventory.json` e `provenance.json`: rastreabilidade, hashes e identificação da cópia local.

Os sete arquivos-fonte conferem com o inventário auditado e as cópias embarcadas. [Manifesto](../../../apps/mobile/assets/agua04/provenance.json). Revalidar da raiz:

```powershell
python scripts/export-agua04-mobile.py --check
```

| Exemplo final verificado | Valor | Período LST |
|---|---:|---|
| Chuva em 7 dias | 24,22 mm | 25–31/12/2025 |
| Chuva em 30 dias | 86,50 mm | 02–31/12/2025 |
| Sequência de baixa chuva terminando na data | 0 dias | Em 31/12/2025 |
| Total de dezembro | 86,57 mm | 01–31/12/2025 |
| Dias de baixa chuva no mês | 17 dias | Dezembro/2025 |
| Maior sequência dentro do mês | 8 dias | Dezembro/2025 |
| Média de dezembro no treino | 186,27 mm | 2000–2019 |
| Anomalia de dezembro | −99,70 mm / −53,52% | Dezembro/2025 contra dezembro do treino |

A extração NASA ocorreu em **06/11/2026**, e a consolidação em **06/11/2026 às 15:29 UTC**. O histórico continua terminando em **31/12/2025**. O painel distingue essas datas; reabrir não busca novas observações. Datas LST usam um calendário sem deslocamentos por UTC/fuso civil ou horário de verão.

Nulos iniciais de acumulados (6/29 janelas) permanecem ausentes, nunca zero. As classes diárias são usadas como exportadas: foram calculadas antes de arredondar a série CSV a oito casas, enquanto limiares têm dez. Testes admitem diferenças de reclassificação somente na precisão de serialização das fronteiras; o app preserva a classe auditada. A faixa mensal é calculada com os limiares publicados, sem arredondamento adicional. Z é apenas descritivo, não SPI/SPEI, probabilidade ou critério de risco.

## Componentes e acessibilidade

Verde profundo do Agro+, creme, branco e lima pontual; cards arredondados e números com contexto. Barras partem de zero, têm escala e legenda, selecionam o período e fornecem ações/rótulos semânticos. Gráficos horizontais mantêm **48 dp por alvo**, em vez de comprimir 12/31 controles em um telefone. Há valores textuais por mês e leitura textual do dia selecionado. Filtros e cards reorganizam-se com texto ampliado.

Movimentos próprios respeitam `MediaQuery.disableAnimations` e `accessibleNavigation` — equivalentes de remoção de animações no Android e preferências expostas pelo Flutter Web. Estados reutilizáveis: carregamento, vazio, erro com nova tentativa e dados desatualizados. O estado desatualizado fica preparado para dados temporais futuros; um pacote histórico explicitamente datado não é tratado como clima atual expirado.

## Validação executada

| Verificação | Resultado e evidência final |
|---|---|
| Análise estática | **Sem problemas** — [flutter-analyze.txt](evidencias/flutter-analyze.txt) |
| Suíte Flutter completa, sem atualizar goldens | **88 testes aprovados** — [flutter-all-tests.txt](evidencias/flutter-all-tests.txt) |
| Dados reais e domínio | Contagens, últimas observações, anomalias dos 312 meses, classes dos 9.497 dias, empates, nulos, versão e finalidade |
| Interface | Filtros de ano/mês, toque e ação acessível nas barras, leitura offline, retorno à sessão, carregamento, erro recuperável e vazio |
| Regressão de rolagem | Troca de série e seleção de data preservam a posição no teste de widgets |
| Acessibilidade | Android tap target, rótulos, contraste, 320 dp, texto 200% e movimento reduzido |
| APK Android debug | Compilado, instalado e navegado no emulador — [flutter-build-android.txt](evidencias/flutter-build-android.txt) |
| Flutter Web | Build sem CDN aprovado — [flutter-build-web.txt](evidencias/flutter-build-web.txt) |
| Smoke web real | Express + MongoDB isolados + Edge: login, home, painel com 86,57 mm/−53,52%, volta e reload; sem erros e com rede externa bloqueada — [result.json](evidencias/web-smoke/result.json), [log](evidencias/flutter-web-smoke.txt) |
| Integridade do pacote | Exportador em `--check`: sete cópias idênticas aos arquivos auditados |
| Gravação | H.264, 780×1688, **35,96 s**; mídia nativa sem cortes ou quadros sintéticos, decodificação completa sem erros — [metadados](evidencias/video-validation.json) |

O emulador usado foi **Medium_Phone_API_36.1, Android 16/API 36**, dispositivo `emulator-5554`, 390×844 dp e densidade 320. Também foi revisado em 320×844 dp com `font_scale=2.0`. A gravação foi feita com Wi-Fi e dados móveis desligados; ambos foram restaurados. [Metadados Android](evidencias/android-capture-metadata.json). A home da galeria é uma fixture identificada; o dashboard usa dados reais do pacote AGUA-04, inclusive nessa galeria.

## Capturas reais e gravação

- [Entrada pela home offline](evidencias/android-home-sem-rede.png) e [painel sem rede](evidencias/android-painel-sem-rede.png).
- [Resumo histórico](evidencias/android-painel-topo.png), [sazonalidade](evidencias/android-sazonalidade.png) e [novembro selecionado pelo gráfico](evidencias/android-selecao-novembro.png).
- [Acumulado de 7 dias](evidencias/android-acumulados.png), [30 dias](evidencias/android-30-dias.png) e [sequência de baixa chuva](evidencias/android-baixa-chuva.png).
- [Quatro indicadores](evidencias/android-indicadores.png), [anomalias](evidencias/android-anomalias.png), [fonte/limites](evidencias/android-fontes.png) e [320 dp/texto 200%](evidencias/android-320-texto200.png).
- [Gravação Android, aproximadamente 36 segundos](evidencias/agua04-navegacao-android.mp4).
- [Painel no navegador real](evidencias/web-smoke/water-dashboard.png).

## Limitações e próximos incrementos

Produção/Excedentes e Logística ainda precisam de fontes, contrato, agregações e telas próprias. A base compartilhada está preparada; isso não equivale à implementação desses painéis. O pacote hídrico não oferece atualização ao vivo, medição de fazenda, validação externa, água no solo ou recomendação de irrigação. Ridge não é executado nem exibido nesta interface; não há previsão operacional ou decisão automática. Completude de 100% não é acurácia de campo.

Autenticação real de produção, login frio offline, iOS, benchmark em aparelho físico intermediário e validação com pequenos produtores não foram cobertos. O modo normal mantém as exigências de API/autenticação existentes. O teste offline nativo comprova a consulta do pacote histórico, não uma nova política de login ou de sincronização.

A revisão automática rejeitou a limpeza dos artefatos intermediários por considerar sua exclusão destrutiva sem autorização explícita. Eles foram preservados, incluindo `apps/mobile/test/failures/` e diagnósticos de tentativas anteriores. Esses arquivos não representam o resultado final: as referências válidas são o log da suíte com 88 aprovações e `web-smoke/result.json`, que inclui `waterDashboardVerified=true`.
