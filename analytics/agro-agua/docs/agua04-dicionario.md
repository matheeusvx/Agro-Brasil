# AGUA-04 — dicionário consolidado

Dados: NASA POWER AG, sete variáveis diárias, LST, Mogi das Cruzes/SP, ponto −23,52°, −46,19°. Histórico 2000–2025; referência estatística **somente 2000–2019**. PRECTOTCORR vem em mm/day; multiplicar pelo intervalo de um dia resulta em altura diária em mm, somada nos acumulados. Fontes, bytes e hashes originais preservados em data/ e nos inventários AGUA-02/03.

## Naturezas distintas

| Natureza | Classificação do contrato | Significado |
|---|---|---|
| historical_observation | historico | Valor do produto histórico NASA ou agregação dele; não medição de estação/propriedade |
| climate_anomaly | informativo | Desvio de um agregado em relação à referência do treino |
| historical_reference | informativo | Estatística histórica de referência, não previsão |
| experimental_estimate | experimental | Estimativa já arquivada da Ridge; não previsão operacional |

Disponibilidade é um eixo separado: todos os exemplos usam `retrospectivo_sem_servico` e `decision_authorized=false`. Nenhuma natureza acima significa disponibilidade em tempo real ou autorização para manejo.

## Indicadores do contrato e arquivos

| ID/campos | Fórmula | Unidade | Período e requisitos |
|---|---|---|---|
| rain_7d / rain_7d_mm | Σ P(t−j), j=0…6 | mm | Sete dias completos, inclui t. Primeiras seis janelas ausentes |
| rain_30d / rain_30d_mm | Σ P(t−j), j=0…29 | mm | 30 dias completos, inclui t. Primeiras 29 janelas ausentes |
| low_run / low_run_days | comprimento acumulado da sequência P<1 terminando em t | days | Ausente quebra contagem; zero não é ausente. Observed_period identifica o histórico inspecionado desde 2000; value informa a duração até o fim, não duração de todo esse período |
| monthly_rain / rain_total_mm | Σ P no mês encerrado | mm | Exige todos os dias do mês, inclusive fevereiro bissexto |
| monthly_anomaly_absolute / rain_anomaly_mm | A(y,m)−μ(m) | mm | μ=média dos 20 totais mensais daquele mês no treino |
| monthly_anomaly_relative / rain_anomaly_percent | 100×[A(y,m)/μ(m)−1] | % | Se μ=0, valor ausente, nunca infinito |
| monthly_anomaly_standardized / rain_anomaly_z | [A(y,m)−μ(m)]/s(m) | 1 | s amostral n−1 entre anos; se s=0, ausente. Não é SPI ou probabilidade |
| monthly_seasonal_reference | μ(m) dos totais mensais do treino | mm | 20 anos por mês; no exemplo, dezembro. Demais meses em training_monthly_reference.csv |
| ridge_archived_next7 | estimativa arquivada de y(t)=Σ P(t+h), h=1…7 | mm | Origem e período-alvo separados. Sem nova inferência, sem nível estatístico de alerta |

No contrato, os três acumulados/durações finais são de 31/12/2025; mensal/anomalias são de dezembro/2025. A última estimativa Ridge arquivada tem origem 24/12/2025 e alvo 25–31/12, reapresentada como experimento passado. Sua entrada observed_period descreve a história disponível até a origem; não inclui o alvo futuro. O exemplo não é uma consulta de condição atual.

## Qualidade, níveis e precisão

- `informative_level`: posição estatística segundo os quantis do treino, documentados em agua04-alertas.md. Não é categoria de risco oficial. Nível de anomalia é contextualizado pelo total mensal relacionado, não inventado por z.
- `threshold_reference`: linha (indicador,mês) em thresholds.csv; limites sem arredondamento na classificação.
- Qualidade da base: 9.497 registros, 100% completos por variável nesta extração, sem imputação e com integridade verificada. Completude não mede acurácia de campo. Na integração, dados ausentes devem ser null e ter status indisponivel; não virar zero.
- Ridge: MAE de 14,245 mm, ganho MAE 9,88%, R²=0,226; chuvas elevadas: ganho 0,15%, MAE 37,293 mm. Métricas agregadas de 1.089 origens de teste, não erro garantido de cada estimativa. MAE não é intervalo de confiança, margem ±14,245 ou probabilidade individual de acerto.
- `source_updated_at_utc` é a data de extração do dado NASA, não a data observada e não o instante de publicação original de cada dia. `generated_at_utc` é a geração desta consolidação. `model_frozen_at_utc` identifica o experimento; não confundir com atualização operacional.

Dados de temperatura (°C), RH (%), vento (m/s) e radiação (MJ/m²/day) continuam no dicionário AGUA-02. Não foram criados índices de água no solo, vazão, reservatórios, evapotranspiração ou prescrição de irrigação. Não houve estimativa de impacto em produtividade, economia ou consumo de água.
