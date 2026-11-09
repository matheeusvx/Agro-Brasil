# AGUA-02 — definição formal e plano de AGUA-03

## Pergunta e parecer

**É possível estimar a precipitação acumulada dos próximos sete dias em Mogi das Cruzes utilizando apenas dados meteorológicos históricos disponíveis até a data da previsão?**

Mantido o alvo original. Parecer: **viável construir um experimento retrospectivo controlado; ainda não demonstrada viabilidade preditiva ou operacional.** A EDA mostra sazonalidade e alguma persistência, mas isso também pode ser explicado por uma baseline sazonal simples. É necessário verificar ganho fora da amostra. Nenhum treinamento ou cálculo de desempenho em validação/teste ocorreu em AGUA-02.

No treino, a correlação linear diária após subtrair a média mensal cai de aproximadamente 0,338 na defasagem de um dia para 0,003 em sete dias. A correlação de Spearman do acumulado semanal futuro com o cosseno do mês é aproximadamente 0,569, e com chuva passada de sete dias 0,419. São associações exploratórias, não medidas de habilidade incremental. A memória linear de uma semana parece fraca nesta análise; atrasos de publicação podem tornar o problema mais difícil. Isso reforça a necessidade de um benchmark sazonal forte e permite rejeitar a utilidade prática se o ganho fora da amostra não aparecer.

## Estimando e relógio de informação

P(t) é a altura diária de chuva do **produto NASA POWER no ponto −23,52°, −46,19°**, não precipitação medida em toda Mogi nem num talhão. A emissão retrospectiva ideal é feita após fechar o dia t em LST. Alvo de regressão não negativa:

`y(t) = P(t+1) + P(t+2) + ... + P(t+7)`, em mm.

Horizonte fixo de sete dias, excluindo o dia t. Origem diária; alvos consecutivos compartilham seis dias, portanto não são amostras independentes. Última origem com rótulo completo: **24/12/2025**. As origens 25–31/12/2025 permanecem sem y, nunca viram zero.

Em emissão operacional D, o corte correto seria `c(D)`, a última data efetivamente publicada **para cada variável** até D. O alvo continuaria D+1…D+7; não se pode mudar a origem para a data do último dado e chamar uma previsão vencida de previsão atual. As tabelas lag2/lag7 mantêm o alvo ancorado em t e recuam somente os atributos.

A [NASA informa latências típicas de 2–3 dias para meteorologia e 5–7 para solar](https://power.larc.nasa.gov/docs/faqs/data/#latency), consultada em 06/11/2026. Há revisões e mudanças de produto. Esses intervalos não garantem disponibilidade por variável/dia. A base coletada em 2026 contém história revisada e não possui snapshots de publicação passada. Assim, `lag0` é hipótese ideal de retrospectiva; `lag2` e `lag7` são sensibilidades fixas, sem simular com fidelidade vintages reais. O cenário lag2 com todas as variáveis pode ser otimista para radiação. Para investigação conservadora inicial, usar lag7 em todas e compará-lo com versões sem radiação e com cortes individuais auditados quando existirem snapshots. Nem lag7 substitui evidência de disponibilidade real.

**Condição de uso operacional futuro:** registrar horário de publicação/vintage, provar disponibilidade até a emissão, definir fallback para atraso e testar prospectivamente. Sem isso, os resultados só responderão sobre previsibilidade no produto histórico final, não sobre um serviço de previsão em tempo real.

## Entradas candidatas (sem seleção neste incremento)

Conjunto fixado antes de AGUA-03: sete variáveis originais, defasadas em L+{0,1,2,7}; acumulados passados de 7 e 30 dias terminando em t−L; comprimento da sequência P<1 até o corte; sin/cos do mês de emissão. Todas constam de `feature_columns_by_lag` em `split_manifest.json`. Nenhuma previsão meteorológica externa, observação futura ou atributo computado com o fim futuro de um evento é permitido.

No cenário L=0, valores de todo o dia t são conhecidos apenas depois de seu encerramento e publicação. Não usar T2M_MAX do próprio dia numa emissão matinal. Variáveis com tempos de disponibilização diferentes precisam de cortes distintos em um protocolo operacional. Histórico pré-2020 pode alimentar features em janeiro/2020 e pré-2023 em janeiro/2023: é passado conhecido, sem refazer estatísticas nos blocos de avaliação.

Não são entradas: `target_next7_mm`, datas-alvo, elegibilidade, bloco, acumulado futuro, totais do mês ainda não encerrado, anomalias de EDA calculadas após o período, duração total futura de um evento, nem climatologia ajustada com validação/teste. Eventual padronização, imputação, transformação logarítmica ou seleção de atributos será ajustada só no treino permitido de cada fold. Se `log1p(y)` for experimentado, avaliar previsões reconvertidas em mm e tratar o viés da reconversão; não comparar apenas perdas na escala log.

## Baselines previamente especificadas

**Primária implementada como referência, sem avaliação de habilidade:** climatologia mensal diária do treino 2000–2019. μ_d(m)=média de todos os dias do mês m nesse treino. Para origem t, `b(t)=Σ(h=1…7) μ_d(mês(t+h))`. Usa só calendário conhecido e referências do treino; atravessa meses/anos corretamente. Janeiro tem 620 dias de referência e fevereiro 565 (inclui anos bissextos). É média condicionada ao mês, sem suposição de tendência, e pode ser fraca para eventos convectivos. Para origens do treino o campo foi deixado vazio, evitando tratá-lo como previsão sem informação futura; backtests internos devem recalcular a referência em cada fold.

**Comparadores propostos para AGUA-03, ainda não avaliados:** persistência do acumulado dos últimos sete dias disponíveis (mesmo corte de dados do candidato); previsão constante ajustada só no treino; mediana do alvo semanal por mês de origem ajustada em rótulos de treino completos, útil como referência para MAE. A média é natural para perda quadrática; a mediana é natural para perda absoluta. Não escolher baseline após observar o teste e não compará-la com um candidato de dados mais recentes.

Baseline fit até 2019 permanece fixa nas avaliações 2020–2025 do protocolo inicial. Não atualizar com validação antes do teste nesse protocolo. Um futuro cenário de refit até 2022 deve ser declarado como experimento separado, com candidato e baseline reajustados simetricamente, antes de abrir o teste.

## Divisão cronológica e purga de rótulos

| Bloco | Origem solicitada | Regra de rótulo | Origens elegíveis lag0 | Origens elegíveis lag7 |
|---|---|---|---:|---:|
| Treino | 2000–2019 | t+7≤31/12/2019, histórico completo | 7.269 | 7.262 |
| Validação | 2020–2022 | t+7≤31/12/2022 | 1.089 | 1.089 |
| Teste final retrospectivo | 2023–2025 | t+7≤31/12/2025 | 1.089 | 1.089 |

Primeira origem de treino lag0: 30/01/2000; lag7: 06/02/2000. Última origem elegível de cada bloco: 24/12 do último ano. São retiradas as origens de 25–31/12 nas duas fronteiras internas, para seus rótulos não atravessarem o bloco seguinte. As sete últimas origens do arquivo não têm alvo completo. `split_manifest.json` lista também lag2 (7.267 origens de treino) e os motivos de exclusão. A purga é aplicada ao intervalo inteiro do alvo, não só ao timestamp de origem.

Protocolo de desenvolvimento proposto: folds expansivos internos exclusivamente em 2000–2019, por exemplo treino 2000–2009 → avaliação 2010–2012; treino 2000–2012 → 2013–2015; treino 2000–2015 → 2016–2019. Em cada fronteira purgar rótulos de sete dias, aplicar aquecimento de histórico e ajustar referências/transformadores somente no treino daquele fold. Depois usar 2020–2022 para uma confirmação/configuração final com poucas alternativas pré-registradas; congelar tudo antes de uma única avaliação em 2023–2025.

**Limitação de cegamento:** AGUA-01 e a EDA descritiva de AGUA-02 já expuseram agregados e padrões de 2023–2025. O corte cronológico foi preservado, mas o teste não é totalmente cego à inspeção humana. Nenhuma métrica de candidato foi calculada nele. Registrar escolhas e não adaptar modelos às anomalias observadas. Confirmação independente forte exigirá futuro ainda não inspecionado, com snapshots de publicação. Não descartar anos difíceis nem redesenhar o alvo para aumentar resultados.

## Métricas, incerteza e decisão — a executar somente em AGUA-03

Para erros e_i = previsão_i − y_i, unidade mm:

- **Primária:** MAE = média |e_i|; também skill_MAE = 1−MAE_candidato/MAE_climatologia. Baseline com MAE=0 torna o skill indefinido, não infinito.
- **Secundárias:** RMSE = √média(e_i²), sensível a grandes chuvas; viés = média e_i; mediana de |e_i|. R² apenas complementar, nunca critério único. Não usar MAPE por zeros e acumulados pequenos.
- Relatar n, cobertura, por ano, meses e agrupamentos outubro–março/abril–setembro, sem reescolher esses grupos a partir dos resultados. Reportar MAE/RMSE para y acima do percentil 90 **ajustado apenas no treino permitido**, sem denominar isso limiar de risco agrícola. Não remover extremos por piorarem a métrica.
- Comparar nas mesmas origens elegíveis de candidato e baseline, com cortes de informação iguais. Erros em janelas sobrepostas são dependentes; intervalos iid aleatórios são inadequados.
- Planejar intervalos de incerteza da diferença pareada de perdas com bootstrap de blocos contíguos de 28 dias, sensibilidades de 14/56 dias, mantendo pares candidato/baseline e relatando influência sazonal. Complementar com origens espaçadas de sete dias em sete alinhamentos e resultados por ano. O tamanho de bloco é uma escolha prévia, não garantia universal; três anos de teste limitam inferência sobre extremos raros.

**Critério para justificar continuidade:** skill_MAE positivo na validação, resultado consistente frente às baselines e cenários de latência, sem depender de um único ano ou ocultar degradação importante nos extremos. Intervalos que incluam ausência de ganho exigem conclusão inconclusiva. A decisão confirmatória vem da avaliação final congelada e de limitações explicitadas; não é permitido garantir viabilidade só pela correlação de treino. Se não houver ganho robusto, rejeitar a utilidade dos históricos isolados para este objetivo e registrar o resultado. Não fabricar previsão para demonstração.

## Plano de execução de AGUA-03

1. Congelar alvo, conjuntos de entrada, latências, baselines, métricas, folds e protocolo antes de ajustar qualquer modelo. Verificar novamente hashes; não rebaixar a qualidade dos dados para aumentar a amostra.
2. Criar pipeline estritamente temporal, com referência/fitting por fold e testes de vazamento. Manter análise ideal lag0 separada da aproximação mais conservadora lag7. Excluir dados que não seriam publicados em tempo, quando houver vintages.
3. Só então experimentar um conjunto pequeno de modelos, justificar complexidade e custo frente às baselines. Sem shuffle ou split aleatório; sem acesso a 2023–2025 para seleção.
4. Avaliar fora da amostra, revisar estabilidade, erros extremos e latência; publicar resultados negativos e incerteza. Não converter previsão de produto NASA em acurácia de estação sem validação independente.
5. Para aplicação real, resolver primeiro disponibilidade/vintages e validação espacial/temporal com postos de superfície. Modelar água no solo, reservatórios ou irrigação exigiria outras medições e outro problema explicitamente autorizado.

## Limitações do que pode ser previsto

Meteorologia local depende de dinâmica atmosférica que não está totalmente contida nas sete séries passadas de um único ponto em grade. Sem previsões numéricas de tempo, campos espaciais ou informação de sistemas em aproximação, o ganho além da sazonalidade pode ser modesto. O alvo representa o produto final NASA (com reanálise/correções), não uma verdade observacional pontual. Não se estimou limite teórico de habilidade nem se concluiu impossibilidade física. A EDA sustenta apenas um experimento testável e controlado, sem prescrição de irrigação e sem promessa operacional.
