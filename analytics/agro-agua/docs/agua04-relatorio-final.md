# Agro+ Brasil — relatório técnico final de Inteligência Hídrica

**AGUA-01 a AGUA-04 · 06/11/2026 · módulo acadêmico concluído**

## Síntese e escopo da conclusão

Foi construída uma base histórica real, auditável e reproduzível, uma EDA temporal, um experimento retrospectivo de ML e uma proposta de indicadores/contrato para futura apresentação. **A Ridge oferece vantagem média sobre a climatologia neste recorte, mas não é uma ferramenta operacional validada, especialmente para chuva elevada.** A fundamentação acadêmica está concluída dentro desse escopo; validação externa, prospectiva e de disponibilidade continuam pendentes.

AGUA-04 não treinou modelos, não inferiu novas previsões, não reabriu o teste nem alterou os experimentos anteriores. Não implementou dashboard, endpoint ou integração. Os níveis propostos são informativos e estatísticos, sem pretensão agronômica ou de alerta oficial.

## 1. Problema, dados e metodologia consolidada

Pergunta: estimar a precipitação acumulada de t+1 a t+7 em Mogi das Cruzes/SP usando somente histórico até t. Alvo em mm, calendário LST. NASA POWER Daily Point, AG; sede de referência −23,52°, −46,19°, IBGE 3530607. Histórico de 01/01/2000 a 31/12/2025: **9.497 dias, 66.479 valores, sete variáveis**. Precipitação corrigida, temperaturas média/máxima/mínima, RH, vento a 10 m e radiação solar; unidades originais preservadas. A altitude/grade NASA não é uma estação.

AGUA-01 preservou 26 respostas originais, metadados e hashes, gerou calendário pandas e verificou duplicações, fill_value, cobertura e plausibilidade. Completude de 100% por variável nesta extração, sem imputação; isso não comprova exatidão local.

AGUA-02 calculou acumulados, sazonalidade, sequências P<1 mm/dia, médias de temperatura/RH, correlações e anomalias. Todas as estatísticas utilizadas como referências foram ajustadas só em 2000–2019. São 20 anos de referência, não normal climatológica de 30 anos. A EDA descritiva expôs agregados de 2023–2025, limitação de cegamento mantida.

AGUA-03 usou 34 entradas passadas, folds expansivos de treino, padronização só no fit da Ridge e HGB sem early stopping aleatório. Partições preservadas: treino 2000–2019 **7.269 origens**, validação 2020–2022 **1.089**, teste 2023–2025 **1.089**. Rótulos que cruzam fronteiras foram excluídos. A Ridge alpha=100 foi escolhida por validação, congelada antes da única abertura do teste e não reajustada depois. AGUA-04 apenas lê as estimativas e métricas preservadas.

## 2. Resultados históricos e comparação

Média anual do produto: **1.322,27 mm**. Outubro–março concentra **73,64%** da chuva. Maior sequência P<1 mm/dia: **48 dias**, de 11/06 a 28/07/2022; baixa precipitação não significa seca de solo. Diagramas e interpretações completas permanecem em outputs/agua02 e documentos anteriores.

| Método no teste | MAE mm | RMSE mm | Viés mm | R² | Ganho MAE |
|---|---:|---:|---:|---:|---:|
| Climatologia | 15,807 | 19,528 | +7,168 | 0,096 | referência |
| Persistência | 15,960 | 22,400 | +0,281 | −0,189 | −0,97% |
| Ridge escolhida | **14,245** | **18,069** | **+5,650** | **0,226** | **+9,88%** |
| HistGradientBoosting | 15,095 | 19,039 | +6,920 | 0,141 | +4,50% |

Valores copiados das métricas arquivadas de AGUA-03, não recalibrados. A Ridge ganhou 6,87% em MAE na validação. No teste, redução absoluta média de 1,562 mm, intervalo bootstrap aproximado de 28 dias [0,695; 2,348] mm. É evidência de vantagem média neste recorte, condicionada ao procedimento, não probabilidade de acerto individual.

## 3. Por que a Ridge não sustenta operação validada

Nas chuvas elevadas, definidas antes do teste por y>q90 do treino (61,844 mm), **ganho de apenas 0,15% e MAE 37,293 mm, n=60**. Todas essas estimativas subestimaram o alvo nessa amostra. Assim, reduzir o erro médio não demonstrou capacidade de antecipar picos; alertas de risco exigiriam outra evidência. Não foi estabelecida tolerância de erro, custo de decisão, calibração probabilística ou validação de campo.

A Ridge ainda superestima em média em +5,650 mm; seu R²=0,226 deixa grande parte da variabilidade sem explicação no teste. MAE é média de erros absolutos, não margem ±14,245 mm em torno de cada valor. Não existe intervalo individual validado; o contrato mantém esse campo null. O HGB teve maior ganho aparente no treino que na validação, indício de menor generalização, também sujeito a mudança de distribuição. Nenhum ajuste pós-teste foi feito.

NASA tem resolução regional, latências típicas de 2–3 dias para meteorologia e 5–7 dias para solar segundo a documentação registrada, revisões e mudanças de produto (SRB/CERES). O valor final até t pode não ter sido publicado em t. A análise lag0 supõe dados até o fechamento de t e não mede disponibilidade operacional; a sensibilidade ML lag7 não foi executada no protocolo principal. Não se reconstruiu vintage de emissão. LST difere de UTC/fuso civil.

Falta validação externa: E3-097 tem só março–agosto/2000 completos, 184/366 dias no ano e janela de leitura desconhecida. Não foi feita comparação numérica com datas potencialmente incompatíveis. Também falta avaliação prospectiva em período independente da inspeção prévia.

## 4. Indicadores e níveis informativos

Consolidam-se R7/R30 passados, duração P<1 até o dia, total mensal, anomalias absoluta/percentual/padronizada e referência sazonal. Quantis q10/q25/q75/q90 são calculados **somente em 2000–2019**, por mês de encerramento da janela; sequências usam q75/q90 da distribuição diária, incluindo zeros. O total mensal tem 20 amostras/quantil por mês. Critérios e empates são documentados em agua04-alertas.md; não se chama z de SPI/SPEI nem se supõe distribuição normal da chuva.

Exemplo histórico em 31/12/2025: R7=24,22 mm, R30=86,50 mm, D=0 dias. Dezembro/2025 totalizou 86,57 mm, desvio −99,70 mm (−53,52%; z≈−1,551) da referência de dezembro/2000–2019. As faixas descrevem posição relativa num produto histórico, sem inferir água no solo, reservatórios ou necessidade individual de irrigação. Não há alerta estatístico sobre a estimativa experimental.

## 5. Contrato e aplicações futuras no Agro+ Brasil

O contrato versionado agua04-1.0 identifica nome/descrição, valor/unidade, município/coordenadas, período LST, fonte/extração, qualidade, limitações e classificação. Campo nature separa observação histórica, anomalia, referência e estimativa experimental. Disponibilidade operacional é independente: retrospectivo_sem_servico; decision_authorized=false. Origem e período-alvo da Ridge ficam separados dos dados observados. O exemplo reproduz estimativa já arquivada, sem joblib/load, fitting ou predict.

Uso futuro possível: painéis educativos/históricos e contexto regional, preservando período, referência, qualidade e limitações junto de cada valor. Antes de funcionalidade operacional: timestamps de publicação/vintage, política de expiração/atrasos, validação com estações e avaliação prospectiva; para solo/reservatórios, medições e outro problema. Nenhum endpoint, envio de notificações ou mudança no portal/Flutter/backend neste incremento. Não foram inventados indicadores de economia de água, produtividade, impacto social ou retorno financeiro.

## 6. Evidências, arquivos e reprodução

- Síntese de uma página: outputs/agua04/output/pdf/sintese-executiva.pdf, com visualização original do AGUA-03, tabela dos modelos e fontes locais; PDF renderizado e conferido, texto acessível ao lado.
- Dicionário e níveis: docs/agua04-dicionario.md e agua04-alertas.md.
- Contrato proposto: docs/agua04-contrato-integracao.md e outputs/agua04/integration-example.json.
- Tabelas: historical_indicators.csv, monthly_indicators.csv, training_monthly_reference.csv e thresholds.csv; sem alterar arquivos anteriores.
- Auditoria, tamanhos e SHA-256: outputs/agua04/audit.json e inventory.json.
- Execução/testes: docs/agua04-verificacao.md e agua04-test-results.xml.

`python consolidate.py` reproduz a consolidação a partir dos arquivos locais; `python ml.py verify` confirma as métricas preservadas sem novo fit/predict. Executar a suíte conforme a evidência, excluindo explicitamente os dois testes antigos que ajustam modelos, para respeitar a proibição deste incremento. Modelos, registros de abertura única e experimentos anteriores permanecem íntegros. Nenhum commit ou push.
