# AGUA-03 — avaliação retrospectiva de precipitação semanal

## Protocolo e seleção antes do teste

Alvo mantido: y(t)=Σ P(t+h), h=1…7, em mm. NASA POWER AG, diário LST, referência municipal −23,52°, −46,19°. Base local, nenhum download. Partições exatas: treino 2000–2019 (7.269), validação 2020–2022 (1.089), teste 2023–2025 (1.089). Alvos que cruzam fronteiras foram excluídos. 34 atributos: sete variáveis defasadas 0/1/2/7, acumulados 7/14/30, sequência P<1 até t, seno/cosseno mensal. Nenhuma variável posterior a t; sem imputação. Cenário ideal após encerrar t, não disponibilidade operacional.

Três folds expansivos internos do treino, com purga de rótulos, comparam Ridge alpha=1/100 e HGB com 7/15 folhas. Ridge usa StandardScaler ajustado somente no fit de cada fold e solver SVD. HGB: 150 iterações, taxa 0,05, mínimo 40 amostras/folha, L2=10, early_stopping=False, seed 562765; não há validação aleatória interna. Configuração por família escolhida pela média de MAE nos folds; família por MAE de validação. Previsões ML negativas são truncadas em zero por regra prévia, sem ajuste posterior.

Modelo escolhido: **ridge**. Melhor método na validação incluindo baselines: **ridge**. Escolha e parâmetros foram gravados em frozen.json em 2026-11-06T15:02:46.571458+00:00, antes da abertura do teste. Modelos treinados somente até 2019, sem refit em validação/teste. Os dois modelos e duas baselines foram avaliados num único lote de teste; os resultados do modelo não escolhido são secundários, não uma nova seleção.

Climatologia: soma das médias diárias por mês de calendário de t+1…t+7, ajustadas só em 2000–2019. Persistência: soma P(t−6)…P(t), igual corte de informação. MAE é primária; RMSE, viés (estimado−real), R² e ganho percentual contra climatologia complementam. Ganho positivo significa redução de erro. Métricas de treino são aparentes/in-sample, incluindo a climatologia, e não provas de generalização.

## Teste final (uma abertura, sem reajuste)

| Método | MAE mm | RMSE mm | Viés mm | R² | Ganho MAE % |
|---|---:|---:|---:|---:|---:|
| climatology | 15.807 | 19.528 | 7.168 | 0.096 | 0.00 |
| persistence | 15.960 | 22.400 | 0.281 | -0.189 | -0.97 |
| ridge | 14.245 | 18.069 | 5.650 | 0.226 | 9.88 |
| hgb | 15.095 | 19.039 | 6.920 | 0.141 | 4.50 |

## Respostas interpretativas

1. **Superou a climatologia?** O modelo selecionado ridge teve ganho MAE de 9.88% no teste e 6.87% na validação. Valores negativos significam perda. Todos os métodos estão na tabela, sem reescolher o vencedor pelo teste.
2. **Magnitude e incerteza:** redução pareada de MAE de 1.562 mm; intervalo bootstrap de blocos de 28 dias, 95%, [0.695, 2.348] mm. Se incluir zero, não há ganho robusto demonstrado por esse procedimento. Sensibilidades 14/56 dias em uncertainty.csv. São intervalos aproximados, condicionados a esta curta amostra e sazonalidade, não probabilidades de acerto de uma previsão.
3. **Seco/chuvoso:** MAE 18.721 mm no período outubro–março e 9.842 mm em abril–setembro; respectivos ganhos 8.31% e 12.68%. Meses são classificados pela origem, mesmo quando o alvo atravessa meses. Nas chuvas elevadas (>q90 do alvo de treino, 61.844 mm), MAE 37.293 mm, n=60, ganho 0.15%. Não é limiar agronômico. Os recortes se sobrepõem; não somar contagens.
4. **Sobreajuste:** MAE aparente do escolhido no treino 15.455, validação 12.924 e teste 14.245 mm. Diferença entre treino e avaliação pode indicar sobreajuste, mas também mudanças na distribuição e no regime de chuva. cv_metrics.csv, development_metrics.csv e métricas por ano permitem avaliar estabilidade, sem confundir menor erro absoluto em anos secos com maior habilidade. Não foram removidos anos difíceis.
5. **Uso prático:** estes erros não autorizam previsão operacional, alerta local ou prescrição de irrigação. Ganho pontual, se houver, deve ser confrontado com incerteza, baselines e extremos; não foi estabelecida tolerância de decisão de um usuário. O resultado mede o produto NASA histórico final, não verdade pontual. Habilidade operacional continua não demonstrada, mesmo se o escore retrospectivo melhorar.
6. **Próximos dados:** previsões numéricas de tempo arquivadas como emitidas, campos espaciais/sistemas atmosféricos, estações independentes com janela alinhada, histórico de publicação/vintages e acompanhamento prospectivo. E3-097 tem só seis meses de 2000 e janela desconhecida: não oferece validação conclusiva e não foi usada no ajuste/comparação.

## Limitações e riscos

Os agregados de 2023–2025 já foram inspecionados em AGUA-01/02: teste cronológico preservado, mas sem cegamento humano completo. Não houve escolha pós-teste. Datas LST diferem de UTC/fuso civil. NASA tem latência típica de dias, revisões e grade de dezenas de quilômetros; valores finais até t podem não estar disponíveis em t. Não foi executada sensibilidade ML lag7 neste protocolo principal, para manter exatamente as origens exigidas: é limitação adicional, não evidência de robustez operacional. Dados não medem água no solo ou reservatórios.

Janelas consecutivas compartilham seis dias. Bootstrap usa blocos pareados contíguos, evitando atravessar lacunas de exclusão nas bordas dos anos; 1.000 reamostragens com seed fixo. Teste tem apenas três anos. metrics.csv inclui sete alinhamentos semanais não sobrepostos em cada alinhamento, anos, épocas e eventos; não interpretar dias como observações independentes. Histogramas/boxplots mantêm extremos; distribuições podem mudar com o clima e o produto.

## Artefatos e reprodução

Modelos locais em models/*.joblib, parâmetros completos e hashes em frozen.json; carregar apenas esses artefatos próprios verificados. cv_metrics.csv documenta os folds. test-opened.json registra abertura exclusiva e test-completed.json os hashes das estimativas preservadas. `report` apenas reprocessa CSVs, sem prever ou ajustar novamente. `verify` verifica hashes e métricas arquivadas sem abrir de novo o teste. requirements-ml.txt fixa dependências adicionais. Inventário separado, preservando AGUA-01/02.
