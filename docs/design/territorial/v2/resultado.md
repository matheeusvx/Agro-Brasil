# Chuvas na sua região — interface simplificada

09/11/2026. Mudança de apresentação do painel existente; sem commit ou push.

A tela principal agora tem três cards: chuva do mês com comparação natural, gráfico mensal e dias com pouca chuva. Cabeçalho identifica Mogi das Cruzes/SP, NASA POWER, histórico até 31/12/2025 e informa que o recorte não muda com a propriedade. Ano e mês continuam selecionáveis. A análise técnica começa recolhida em **Ver análise detalhada**.

Acumulados de 7/30 dias, seleção diária, sequências, anomalias, quantis, tabela mensal, metodologia, qualidade e proveniência continuam disponíveis nessa seção. Não houve mudança em adaptador, arquivos de dados, cálculos, modelos ML, backend, portal ou outros módulos Flutter. Os sete arquivos embarcados continuam idênticos aos exports auditados (`export-agua04-mobile.py --check`).

Percentuais na síntese são arredondados: −53,52% aparece como **54% menos**, mantendo a precisão nos detalhes. Diferenças menores que 1% são descritas como próximas da média, evitando “0% menos”. Não há informação atual, inferência de solo ou recomendação de irrigação.

## Arquivos deste ajuste

- `apps/mobile/lib/territorial/water_dashboard.dart`: hierarquia, linguagem, card complementar e expansão dos detalhes.
- `apps/mobile/lib/territorial/dashboard_components.dart`: instrução curta do gráfico.
- `apps/mobile/test/water_dashboard_test.dart`: abertura explícita dos detalhes nos testes de navegação, rolagem e acessibilidade; demais verificações de domínio preservadas.
- `scripts/smoke-mobile.mjs`: textos esperados da nova apresentação.
- `simplify_water*.py`: roteiros locais de autoria usados na transformação.
- Esta pasta: evidências da V2; as evidências anteriores continuam preservadas.

## Validação

- **88 testes Flutter aprovados**, incluindo dados reais, cálculos, filtros, gráficos, offline, estados de erro/vazio, retorno à sessão e análise detalhada: [tests.txt](tests.txt).
- **Análise estática sem problemas**: [analyze.txt](analyze.txt). [APK debug compilado](build.txt).
- Revisão no emulador Android 16/API 36, 390×844 dp. Também capturado em 320×844 dp, fonte Android 200%; configurações restauradas.
- Testes de contraste, alvos de toque, rótulos, movimento reduzido e texto 200% com detalhes abertos.
- Consulta e gravação com Wi-Fi/dados móveis desligados; rede restaurada. Home usa fixture explicitamente demonstrativa; painel hídrico usa os exports reais.
- Build web e smoke com API/MongoDB isolados aprovados, incluindo abertura do painel e retorno à home: [resultado](web-smoke/result.json).
- Revisão visual da hierarquia; não foi realizado estudo de tempo de leitura com produtores reais.

## Evidências reais

[Tela principal](principal.png) · [Gráfico e complemento](complementar.png) · [Detalhes abertos](detalhes.png) · [Consulta sem rede](analise-offline.png) · [Texto 200%](texto200.png).

[Gravação nativa da navegação, aproximadamente 38 segundos](navegacao.mp4) · [Metadados da mídia](video.json). A duração real registrada no arquivo é 37,60 segundos. Sem imagens sintéticas ou reconstrução da interface.

O acesso continua pelo ícone de gota no cabeçalho do app. Produção/Excedentes e Logística continuam fora deste ajuste. Os dados históricos não têm atualização em tempo real; as limitações científicas completas permanecem na análise detalhada e na documentação AGUA-04.
