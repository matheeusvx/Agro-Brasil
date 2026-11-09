# AGUA-02 — dicionário de indicadores

Fonte de todos os indicadores meteorológicos: NASA POWER Daily Point, comunidade AG, LST, ponto −23,52°, −46,19°, dados locais auditados do AGUA-01. Série diária de 01/01/2000 a 31/12/2025. Não são medidas de solo, reservatório ou necessidade de irrigação. Código executável: `eda.py`; resultados em `outputs/agua02/tables`.

## Convenções

P(t) = PRECTOTCORR, unidade da API mm/day; como o intervalo é um dia, P(t)×1 dia representa altura diária em mm. T(t) = T2M (°C), RH(t) = RH2M (%). T2M_MAX/T2M_MIN são extremos diários a 2 m; WS10M é velocidade do vento a 10 m (m/s); ALLSKY_SFC_SW_DWN é radiação incidente diária (MJ/m²/day), não kWh/m²/day.

O índice é data LST, não timestamp UTC nem horário civil de São Paulo. Agregados são rotulados pelo primeiro dia do mês/ano, embora só possam ser conhecidos ao encerrar o período. Não usar esses agregados como atributos no início do mês/ano. Denominador diário segue calendário real, inclusive 29/02. Nenhum preenchimento é feito: ausente é vazio nos CSVs, e não zero. Desvio padrão usa n−1 (`ddof=1`). CSVs têm oito casas decimais; JSONs retêm precisão numérica de cálculo.

## Indicadores descritivos

| Campos/indicador | Fórmula e unidade | Cobertura, interpretação e uso |
|---|---|---|
| `rain_total_mm` mensal/anual | Σ P(t)×1 dia, para t no período; mm | Só com todos os dias presentes e válidos. Não corrigido por número de dias. `monthly.csv`, `annual.csv`. |
| `rain_max_day_mm` | max P(t)×1 dia; mm | Máximo diário observado no mês/ano. Na base auditada os períodos são completos; com lacuna seria apenas máximo observado, não extremo completo. |
| `wet_days_ge1` | Σ 1[P(t)≥1]; dias | Limiar de descrição, não necessidade hídrica agronômica. Exige período completo. |
| `low_days_lt1` | Σ 1[P(t)<1]; dias | Precipitação baixa inclui traços não nulos. Complemento dos dias ≥1 somente quando cobertura completa. |
| `zero_days` | Σ 1[P(t)=0]; dias | Zero na precisão publicada, não prova de ausência física de qualquer gota. Não inclui valores ausentes. |
| `max_low_run_lt1_within_period` | máximo comprimento de sequência P<1 dentro do mês/ano; dias | Reinicia no começo do período. Pode ser menor que uma sequência contínua que cruza a fronteira. |
| Eventos de baixa chuva | intervalos contíguos com P<1; sensibilidade P<0,1 e P=0; dias | `low_rain_events.csv`: início, fim, duração inclusiva, regra, cruzamento de ano e censura de borda. Não reinicia em janeiro. Ausente quebra o evento; início/fim ao lado de lacuna ou borda são censurados. Regras se sobrepõem e suas contagens não devem ser somadas. |
| `past_rain_7d_mm`, `past_rain_30d_mm` | R_w(t)=Σ de j=0…w−1 P(t−j)×1 dia; mm | Inclui t. Rolling passado, nunca janela centralizada. Exige w dias válidos; primeiras 6/29 linhas ficam vazias. Na tabela de desenho com latência L, substitui t por t−L. |
| `T2M_mean` | média aritmética diária no período; °C | Exige todos os dias válidos. É temperatura média mensal/anual, sem peso agronômico específico. |
| `T2M_MAX_mean`, `T2M_MIN_mean` | média dos extremos diários no período; °C | Não são o maior/menor valor absoluto do mês/ano. |
| `RH2M_mean` | média aritmética diária; % | Não é umidade do solo; diferença de RH entre períodos em pontos percentuais. |
| `WS10M_mean`, `ALLSKY_SFC_SW_DWN_mean` | médias diárias no período; m/s e MJ/m²/day | Não converter soma de velocidade em indicador hídrico; radiação média diária não é radiação mensal acumulada. |
| Sazonalidade mensal | distribuição de 26 totais/médias para cada mês do calendário | Boxplots: mediana, quartis, bigodes até 1,5×IQR e pontos externos. Pontos não foram removidos da base. Não é normal climatológica oficial. |
| Fração outubro–março | Σ P nos meses {10,11,12,1,2,3} / Σ P de 2000–2025; fração ou % | Agrupamento descritivo por meses, não média de estações hidrológicas completas. Não há divisão de verão em anos artificiais. |

## Referência histórica e anomalias

**Referência congelada: 2000–2019 exclusivamente.** Não se usam 2020–2025 para ajustar médias, desvios, quantis ou transformações. É referência de 20 anos, não normal WMO de 30 anos. As estatísticas de EDA de todos os 26 anos não são entregues como transformadores de modelos.

Para mês m, seja A(y,m) o total de chuva mensal completo e n_m=20:

- μ_P(m) = média entre anos de A(y,m); σ_P(m) = desvio padrão amostral entre anos. Unidades: mm.
- Anomalia absoluta mensal: ΔP(y,m)=A(y,m)−μ_P(m), em mm.
- Anomalia percentual: 100×[A(y,m)/μ_P(m)−1], em %. Se μ=0, fica ausente.
- Anomalia padronizada: z_P=(A−μ_P)/σ_P, adimensional. Se σ=0, fica ausente. Distribuição de chuva pode ser assimétrica; z não é probabilidade, SPI ou diagnóstico oficial de seca.
- Para T/RH: primeiro média diária do mês em cada ano, depois média/desvio entre os 20 anos daquele mês. ΔT em °C; ΔRH em **pontos percentuais** (`rh2m_anomaly_pct`); z adimensional. Não confundir diferença de RH com variação percentual relativa.
- Referência anual: média/desvio amostral dos 20 totais anuais ou das 20 médias anuais de T/RH; anomalias em `annual_anomalies.csv`. Anos bissextos contribuem com seu total efetivo; comparação de totais não corrige duração.
- Referência diária por mês: média de todos os valores diários do treino naquele mês, ponderada pelo número de dias; `reference_daily_by_month_2000_2019.csv`. Usada na baseline e para remover média mensal de relações diárias. Não é a mesma estatística que a média dos totais mensais.

As linhas de 2000–2019 participam das próprias referências descritivas. Não interpretar essas anomalias como avaliação fora da amostra. Em cada fold futuro de AGUA-03, refazer toda estatística usando somente o passado permitido daquele fold. `monthly_anomalies.csv` e `annual_anomalies.csv` são **outputs de EDA**, não tabelas prontas de atributos para um backtest.

## Relações exploratórias

Pearson = cov(X,Y)/(s_X s_Y). Spearman = Pearson dos postos médios de X e Y; empates recebem posto médio. Relações das sete variáveis usam apenas dias de 2000–2019. `spearman_monthly_demeaned_train.csv` calcula postos depois de subtrair a média diária de cada variável/mês ajustada no treino. ACF diária em `rain_autocorrelation_train.csv`: Pearson de P(t) com P(t−k), para k=1…30, após alinhar e remover pares incompletos; também sobre P sem a média mensal. `n` é quantidade de pares, não número de amostras estatisticamente independentes.

Correlação de candidatos com alvo é Spearman, somente origens elegíveis do treino, com rótulos inteiramente em 2000–2019. Não há comparação pontual com E3-097, causalidade, ajuste de regressão, seleção automática de atributos, significância baseada em iid ou escore de habilidade em validação/teste.

Legenda curta da matriz: P=PRECTOTCORR; Tmed=T2M; Tmax=T2M_MAX; Tmin=T2M_MIN; RH=RH2M; WS10=WS10M; Solar=ALLSKY_SFC_SW_DWN. Nos mapas de anomalias, vermelho significa desvio positivo e azul negativo; as escalas de cores estão identificadas individualmente por variável.

## Campos do desenho preditivo

| Campo | Definição |
|---|---|
| `origin_date` | Dia t de referência da emissão, após encerramento do dia LST no cenário retrospectivo. Não comprova que NASA publicou o dado até esse instante. |
| `feature_cutoff` | Último dia admitido nos atributos: t−L, L∈{0,2,7} dias. L=0 é cenário ideal retrospectivo; L=2 e 7 são sensibilidades, não SLA validado. |
| `<variável>_lagK` | Valor publicado para t−K. Todas as sete variáveis, K=L+{0,1,2,7}; nenhuma consulta a dados depois de t−L. |
| `low_run_so_far_lt1_days` | Número de dias consecutivos P<1 terminando no corte t−L, calculado sem conhecer o fim futuro da sequência. Não confundir com duração total do evento de EDA. |
| `calendar_sin`, `calendar_cos` | sin/cos[2π(mês(t)−1)/12]; adimensionais, sem ajuste estatístico. Calendário é conhecido antecipadamente. |
| `target_start`, `target_end` | t+1 e t+7, inclusive, LST. |
| `target_next7_mm` | y(t)=Σ de h=1…7 P(t+h)×1 dia; mm. Exige os sete dias; últimas sete origens ficam sem rótulo. P(t) não entra em y(t). |
| `climatology_next7_mm` | Σ de h=1…7 média diária de P do mês(t+h), ajustada só em 2000–2019; mm. Só emitida para origens ≥2020. Linhas de treino vazias; não é atributo de modelo nesta entrega. |
| `features_ready` | Todos os candidatos passados necessários disponíveis. Não depende de y futuro. |
| `block` | train, validation ou test, conforme o ano de origem proposto. |
| `eligible` | Histórico completo e alvo inteiramente dentro do mesmo bloco cronológico. Não usar esse campo como preditor. |
| `exclusion_reason` | Falta de histórico ou alvo que cruza fronteira/não está disponível. Não preencher rótulos ausentes. |

Somente as colunas listadas como `feature_columns_by_lag` em `split_manifest.json` são candidatas a entrada. Datas-alvo, alvo, baseline, elegibilidade, razão e bloco são metadados/avaliação, nunca atributos. Arquivos de desenho não foram usados para ajustar modelos. O plano formal de emissão, latência, splits e avaliação está em `agua02-problema-preditivo.md`.
