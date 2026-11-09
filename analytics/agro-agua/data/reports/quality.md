# AGUA-01 — qualidade NASA POWER

Extração: 2026-11-06T14:21:49.397740+00:00
Ponto: Mogi das Cruzes/SP — sede municipal (IBGE 3530607); lat -23.52, lon -46.19; AG / diário / LST.
Solicitado: 2000-01-01 a 2025-12-31. Disponível: 2000-01-01 a 2025-12-31.
Registros da fonte: 9497; esperados: 9497; tratados: 9497.
Duplicações: 0; períodos sem data: 0; ocorrências de qualidade: 0.

| Variável | Unidade | Válidos | Ausentes | Completude % | Mínimo | Máximo | Média | Desvio padrão |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| PRECTOTCORR | mm/day | 9497 | 0 | 100.0 | 0.0000 | 122.2900 | 3.6200 | 6.2773 |
| T2M | C | 9497 | 0 | 100.0 | 8.1600 | 30.7500 | 20.1922 | 3.2623 |
| T2M_MAX | C | 9497 | 0 | 100.0 | 10.2600 | 38.8500 | 26.0675 | 3.9172 |
| T2M_MIN | C | 9497 | 0 | 100.0 | 2.6700 | 24.3200 | 15.9166 | 3.3093 |
| RH2M | % | 9497 | 0 | 100.0 | 28.5800 | 96.5700 | 79.8931 | 9.1177 |
| WS10M | m/s | 9497 | 0 | 100.0 | 1.0600 | 12.0600 | 3.3555 | 1.1523 |
| ALLSKY_SFC_SW_DWN | MJ/m^2/day | 9497 | 0 | 100.0 | 1.6700 | 32.1300 | 16.3312 | 5.9016 |

Mensagens da API: nenhuma.

## Tratamento e lacunas

Códigos fill_value do cabeçalho, valores não numéricos/não finitos, valores fora das faixas de triagem e temperatura fora de ordem são convertidos em ausentes, com valor original registrado em issues.csv. Nenhuma interpolação ou preenchimento. Datas ausentes são inseridas apenas como linhas vazias no calendário esperado.
quality.json contém os períodos contíguos afetados por variável, contagens, faixas de triagem e estatísticas (incluindo quartis). As faixas são verificações amplas de plausibilidade física, não garantia de precisão local. Extremos válidos são preservados.
Totais anuais/mensais oficiais neste incremento só são calculados com todos os dias válidos; observed_sum_mm identifica a soma parcial. Dia chuvoso: ≥1 mm; seco: <1 mm. Sequências secas são restritas ao período de agregação.

## Limitações

Dados em grade de reanálise/satélite, não observações de estação ou propriedade. Meteorologia MERRA-2 tem resolução nativa aproximada de 0,5° × 0,625°; fluxos solares dependem da fonte, com CERES SYN1deg em 1° × 1°. A geometria devolvida identifica o ponto solicitado, não os centros de todas as células. Não interpretar a grade regional 0,5° da API como resolução física de todos os produtos.
A radiação troca de SRB (até 2000) para CERES (desde 2001); mudanças de produto e revisões podem afetar homogeneidade. Completude não mede exatidão. LST é horário solar por faixa de longitude, diferente de America/Sao_Paulo e de UTC; não comparar acumulados diários diretamente com estações sem alinhar as janelas.
PRECTOTCORR é precipitação corrigida derivada da fonte; extremos convectivos e relevo local podem ser suavizados. WS10M refere-se a 10 m; T2M e RH2M a 2 m. Não inferir irrigação, vazão ou nível de reservatório a partir desta base.
Metadados originais, versões, fontes, URLs, horários e SHA-256 estão em raw/ e provenance.json. Ver docs/fontes-comparacao.md para INMET/SP Águas e próximos passos.
