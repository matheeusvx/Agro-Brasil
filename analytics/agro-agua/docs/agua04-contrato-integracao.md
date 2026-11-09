# AGUA-04 — contrato proposto, sem endpoints

Versão **agua04-1.0**. Exemplo real e validado por regras de domínio: `outputs/agua04/integration-example.json`. É uma proposta de payload, não uma API implementada nem um serviço de previsão. Sem alterações no backend, portal ou Flutter. A validação atual é a função validate_contract de consolidate.py; não se afirma implementação de JSON Schema.

## Envelope

| Campo | Tipo | Semântica |
|---|---|---|
| schema_version | string | agua04-1.0; consumidores futuros devem recusar versões incompatíveis |
| purpose | string | snapshot_academico_retrospectivo_sem_endpoint |
| data_as_of | date | Última data do histórico, 2025-12-31; não indica atualização para hoje |
| generated_at_utc | datetime com timezone | Data de geração da consolidação |
| indicators | array | Itens com IDs únicos, mesma fonte de referência, períodos individuais |

## Cada indicador

| Campo | Tipo | Regra |
|---|---|---|
| id, name, description | strings | Identificador estável, nome legível e definição sem alegação agronômica |
| value | number ou null | Número finito; null quando indisponível, nunca string numérica ou NaN/Infinity |
| unit | string | mm, days, %, 1 (adimensional); unidade obrigatória |
| municipality | objeto | name=Mogi das Cruzes, state=SP, ibge_code=3530607; não localização de fazenda |
| reference_coordinates | objeto | latitude −23,52, longitude −46,19; role=sede_municipal_referencia; precisão municipal arredondada |
| observed_period | objeto | start/end inclusivos, time_standard=LST. Para estimativas, contém só histórico até a origem |
| source | objeto | NASA POWER, comunidade AG, frequência, URL oficial, hash do CSV diário auditado |
| source_updated_at_utc | datetime | Extração do dado-fonte; não timestamp individual de publicação NASA |
| quality | objeto | Status, completude da base, validação externa e imputação. Completude global não é confiança do indicador/modelo |
| limitations | array de strings | Restrições de espaço, tempo, qualidade e uso devem viajar com o valor |
| classification | enum | historico, informativo ou experimental |
| nature | enum | historical_observation, climate_anomaly, historical_reference ou experimental_estimate |
| operational_availability | enum | retrospectivo_sem_servico nesta versão |
| decision_authorized | boolean | false; nenhuma decisão automática de irrigação |
| informative_level | string ou null | Código do critério estatístico histórico; null para referências/anomalias sem classe própria e estimativas |
| reference_period | objeto opcional | Janela permitida de ajuste, 2000-01-01 a 2019-12-31 |
| threshold_reference | string opcional | Identifica a linha de thresholds.csv por indicador/mês; arquivo deve acompanhar a versão |
| related_level_indicator | string opcional | Total mensal que contextualiza a anomalia, sem classificar por z |
| sample_years | integer opcional | 20 no caso da referência sazonal mensal |

Campos adicionais obrigatórios para a estimativa: `origin_date`, `target_period` (start/end, LST), `archived_prediction_file`, `model_frozen_at_utc`, `model_evaluation`. O alvo começa no dia seguinte à origem e possui sete dias. A estimativa não recebe informative_level. `model_evaluation` contém métricas arquivadas e `individual_prediction_interval=null`; não transformar MAE em intervalo individual.

## Quatro datas que não devem ser confundidas

Exemplo real: dado observado até **31/12/2025**; extraído da NASA em **06/11/2026**; última estimativa experimental emitida no relógio retrospectivo ideal de **24/12/2025**, para **25–31/12/2025**; modelo congelado em **06/11/2026** antes da avaliação única do teste. Esta consolidação tem sua própria generated_at. A ordem dessas datas é natural num estudo retrospectivo, mas impede vender o exemplo como previsão emitida em tempo real em 2025.

## Regras para consumidores futuros

Exibir natureza, período LST, referência estatística e indisponibilidade operacional junto do valor. Não ocultar limitações ou renderizar null como zero. Não usar cores de emergência, texto prescritivo ou notificação de risco com base nestes quantis. Não juntar calendário LST com leitura de pluviômetro por data sem harmonização. Não usar observações finais como prova de disponibilidade original.

Uma nova versão operacional exigirá timestamps de publicação/vintage por variável, política de atrasos e expiração, validação externa/prospectiva, critérios de decisão e tratamento de indisponibilidade. Não basta atualizar data_as_of para hoje. A lista de campos adicionais e regras de compatibilidade deverá ser formalizada antes de qualquer endpoint; este incremento só fornece referência documental e exemplo local.
