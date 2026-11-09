# AGUA-03 — protocolo prévio à avaliação

Registrado em 06/11/2026, antes de treino/validação/teste de modelos AGUA-03. Dados e relatórios anteriores preservados. Limite de execução: cinco horas.

## Desenho congelável

Alvo original em mm: soma de P(t+1)…P(t+7), sem incluir P(t). Base NASA AG diária LST, ponto −23,52°, −46,19°. Usar exatamente 7.269 origens de treino, 1.089 de validação e 1.089 de teste, conforme AGUA-02 lag0. Remover origens com janela de rótulo cruzando fronteiras; não usar split aleatório. Não imputar observações ausentes. Não alterar a base nem consultar endpoints de dados.

Entradas previamente fixadas: sete variáveis defasadas em 0,1,2,7 dias; acumulados passados 7,14,30 dias, incluindo t; contagem consecutiva P<1 até t; seno/cosseno do mês. São 34 entradas, sem seleções posteriores. Nenhum atributo contém valores depois de t. O dia t é considerado encerrado em LST: hipótese retrospectiva ideal, sem comprovação de disponibilidade NASA. A sensibilidade ML lag7 de AGUA-02 não será executada no protocolo principal porque mudaria a contagem de treino exigida; fica como limitação e estudo futuro, sem alegação de robustez à latência.

Baselines obrigatórias: (1) climatologia mensal diária, média somente do treino, somada para cada dia de calendário futuro do alvo; (2) persistência, soma P(t−6)…P(t). Ambas usam o mesmo relógio de informação ideal. Não atualizar climatologia com validação/teste. Métricas de treino são aparentes/in-sample, não backtest.

Modelos/configurações, sem busca extensa:

- Ridge com StandardScaler e solver SVD, alpha em {1,100}. Scaler ajustado apenas no respectivo treino de cada fold/fit.
- HistGradientBoostingRegressor: loss squared_error; max_leaf_nodes em {7,15}; learning_rate=0,05; max_iter=150; min_samples_leaf=40; l2_regularization=10; early_stopping=False; random_state=562765. Early stopping automático fica desativado para evitar separação aleatória interna.
- Para todos os ML, truncar estimativas negativas em zero, regra física fixada previamente; sem transformação de alvo ou calibração pós-teste.

Três folds expansivos internos: 2000–2009→2010–2012; 2000–2012→2013–2015; 2000–2015→2016–2019. Em cada um, excluir rótulos com fim após a fronteira de fit ou de avaliação. Escolher configuração de cada família pela média não ponderada de MAE nos três folds. Treinar as duas configurações escolhidas em todas as 7.269 origens de treino e escolher família pela menor MAE na validação. Desempate lexical. Registrar também se a melhor baseline supera ambos; não forçar uma conclusão favorável ao ML.

Gravar modelos, parâmetros, métricas de desenvolvimento e frozen.json (hashes de código, modelos, dados, versões, instante e escolha), **antes** de acessar desempenho no teste. Não reajustar com validação nem após abrir o teste.

## Avaliação única

Uma única abertura em lote do teste de 2023–2025, para climatologia, persistência e os dois modelos congelados. Modelo principal é o já escolhido pela validação; o outro é comparador secundário, sem reeleição pelo teste. Criação exclusiva de test-opened.json antes de prever; novas aberturas recusadas mesmo em caso de falha, para investigar sem retentar silenciosamente. test-completed.json registra conclusão e hash das estimativas. Relatórios subsequentes usam as mesmas estimativas, sem fitting/predict/reabertura.

Métricas: MAE primária; RMSE; viés estimado−real; R²; ganhos percentuais MAE/RMSE =100×(1−erro_método/erro_climatologia). Reportar zero denominador como indefinido. Sem MAPE. Recortes fixos: outubro–março, abril–setembro, ano de origem, alvos acima do q90 ajustado só no treino. Meses definidos pela origem, mesmo quando o horizonte cruza meses. Nenhum desses recortes é limiar de risco agronômico.

Incerteza: diferença pareada de erros absolutos, bootstrap de blocos contíguos de 28 dias, sensibilidades 14/56, 1.000 reamostragens, seed fixa. Blocos não atravessam lacunas das exclusões de fim de ano. Intervalos percentis 95%; amostra curta e sazonalidade limitam essa aproximação. Sete alinhamentos por dia da semana complementam o diagnóstico de sobreposição dos rótulos. Relatar diferenças por ano e eventos; não ocultar extremos. Não tratar milhares de origens como amostras independentes.

## Decisão e limites

Ganho pontual positivo não basta: confrontar validação, teste, épocas, extremos e intervalos. Se o intervalo da diferença de MAE incluir zero, concluir ausência de ganho robusto pelo procedimento. Não escolher ou ajustar modelo com métricas de teste. Sobreajuste deve ser discutido com erros aparentes, folds e erros temporais, sem atribuir toda diferença a um único mecanismo.

Agregados do teste foram expostos na EDA; não há cegamento humano absoluto. NASA possui latência, revisões e resolução regional; o dado final de t pode ser publicado dias depois de t. O alvo é o produto NASA final, não pluviômetro ou água no solo/reservatório. A estação E3-097 não será usada como validação sem janela comum e cobertura adequada. Não há prescrição automática de irrigação, operação em tempo real ou integração com apps.

Referências técnicas consultadas: [Ridge](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html) e [HistGradientBoostingRegressor](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html), documentação oficial scikit-learn 1.9.1. Dependências adicionais fixadas em requirements-ml.txt, mantendo requirements.txt anterior.
