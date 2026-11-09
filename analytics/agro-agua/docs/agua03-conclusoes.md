# AGUA-03 — conclusões e leitura dos gráficos

## Parecer

**Há vantagem retrospectiva média da Ridge sobre a climatologia neste recorte, sem habilidade operacional demonstrada e praticamente sem ganho nas chuvas elevadas.** Não se recomenda usar esta entrega para alertas, irrigação ou decisão individual. O alvo é o produto NASA histórico revisado, não a chuva medida numa propriedade.

## 1. Algum modelo superou a climatologia?

Sim. A Ridge alpha=100, escolhida pela validação antes de abrir o teste, reduziu o MAE em **6,87% na validação** e **9,88% no teste**. A configuração foi escolhida em folds exclusivamente de treino; não houve refit após 2019. HGB de sete folhas teve ganhos de 1,07% e 4,50%, respectivamente, mas não substituiu a escolha principal após o teste. Persistência perdeu 0,97% em MAE e 14,71% em RMSE no teste.

## 2. Qual a magnitude do ganho?

Teste de 1.089 origens: MAE da climatologia **15,806937 mm**, da Ridge **14,244647 mm**, redução **1,562290 mm**. RMSE: 19,527847→18,068547 mm, ganho **7,47%**. R² da Ridge **0,226383**, contra 0,096376 da climatologia. Viés da Ridge **+5,650266 mm**: ainda superestima em média, embora menos que o +7,168237 mm da climatologia.

Bootstrap pareado em blocos de 28 dias, 1.000 repetições: IC aproximado 95% da redução de MAE **[0,694533; 2,347989] mm**. Sensibilidades de 14 e 56 dias também ficaram acima de zero ([0,756613; 2,250573] e [0,599079; 2,324622] mm). Isso sustenta uma melhora média neste teste pelo procedimento usado; não prova habilidade em outros regimes, localizações ou dados disponíveis em tempo real. Os sete alinhamentos semanais também tiveram ganhos pontuais positivos, de 6,87% a 12,64%, sem serem sete amostras independentes.

## 3. O desempenho muda por época e ano?

| Recorte da Ridge no teste | n | MAE (mm) | Ganho sobre climatologia |
|---|---:|---:|---:|
| Chuvoso: outubro–março | 540 | 18,721 | 8,31% |
| Seco: abril–setembro | 549 | 9,842 | 12,68% |
| Elevada: y > 61,844 mm (q90 de treino) | 60 | 37,293 | 0,15% |
| 2023 | 365 | 15,218 | 8,10% |
| 2024 | 366 | 14,637 | 2,31% |
| 2025 | 358 | 12,851 | 19,09% |

O resultado agregado esconde heterogeneidade: ganho muito menor em 2024 e quase nulo nas chuvas elevadas. Nesse último recorte, viés **−37,293 mm**: a Ridge subestima todos os 60 alvos classificados como elevados nesta amostra (o viés tem magnitude igual ao MAE). Reduzir o erro médio não equivale a capturar extremos. O recorte usa q90 de treino, não q90 de teste nem um limiar de dano agrícola. Os últimos sete dias de origem de 2025 não entram porque não há alvo completo. Recortes sazonais usam o mês da origem e podem ter horizonte atravessando o mês seguinte.

## 4. Há evidência de sobreajuste?

Não há evidência simples de degradação global da Ridge compatível com forte sobreajuste: MAE aparente de treino 15,455 mm, validação 12,924 e teste 14,245 mm. Isso **não comprova ausência** de sobreajuste: distribuições de chuva diferem e erros absolutos não são diretamente intercambiáveis entre períodos.

HGB reduz MAE aparente de treino em 9,33% contra climatologia, mas só 1,07% na validação; os folds mostram instabilidade, inclusive perda frente à climatologia em 2013–2015. Esse contraste é compatível com maior ajuste a particularidades do treino e motivou manter a Ridge escolhida pela regra prévia. Mudança de distribuição também pode contribuir. Não houve ajuste corretivo ou nova busca depois do teste.

## 5. Algum uso prático está sustentado?

O ganho médio permite continuar a pesquisa como benchmark retrospectivo. O erro semanal médio de 14,245 mm, viés positivo, forte subestimação dos extremos e R² de 0,226 não sustentam aplicações de risco ou prescrição automática. Não existe tolerância de decisão, custo de erro ou validação de campo definida. A base final NASA contém revisões e pode não estar disponível no dia t; a análise principal ideal lag0 não mede esse efeito. Não foi realizada análise ML com atraso de sete dias para não alterar o protocolo principal de contagens. A latência continua sendo requisito aberto para evoluir.

A amostra E3-097 é curta e sua janela diária desconhecida; não foi usada como verdade observada. Exposição dos agregados de teste na EDA reduz o cegamento humano, embora a seleção/modelos tenham sido congelados antes da abertura única das métricas de teste.

## 6. Como evoluir?

Priorizar snapshots de publicação e vintages, avaliação prospectiva sem inspeção prévia, séries de estações com janela alinhada e representatividade conhecida, previsões numéricas de tempo arquivadas como emitidas e informação espacial sobre sistemas meteorológicos. Avaliar cortes de disponibilidade por variável e uma análise separada com latência conservadora, sem apresentar o resultado ideal atual como previsão operacional. Para estudar água disponível no solo/reservatórios seriam necessárias medições e outro problema, explicitamente definido.

## Leitura das figuras

- **01_real_estimado.png:** a diagonal é acerto perfeito; os dois ML concentram estimativas e deixam os maiores alvos abaixo da diagonal. A Ridge foi escolhida antes do teste. Pontos próximos da diagonal não quantificam incerteza individual.
- **02_erros.png:** erro positivo é superestimação; negativos muito grandes mostram subestimação de chuvas elevadas. Histogramas e boxplots preservam extremos. Não se interpretam bins como probabilidades operacionais.
- **03_periodos.png:** a vantagem depende de época/ano e é quase inexistente nos eventos altos; os recortes se sobrepõem e não devem ser somados. Barras não são intervalos de confiança.
- **04_serie_teste.png:** a série completa evidencia estimativas suavizadas, com pouca capacidade de seguir picos; não foram selecionadas apenas semanas favoráveis. Janelas adjacentes compartilham seis dias e são dependentes.

Fonte dos números: outputs/agua03/metrics.csv, development_metrics.csv, cv_metrics.csv, uncertainty.csv e previsões preservadas. O relatório gerado automaticamente está em outputs/agua03/relatorio-tecnico.md; este documento explicita a conclusão substantiva a partir dos mesmos artefatos, sem novos ajustes.
