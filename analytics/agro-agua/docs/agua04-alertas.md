# AGUA-04 — critérios dos níveis informativos

## Finalidade e restrições

São **avisos estatísticos retrospectivos**, propostos para contextualizar o histórico NASA POWER; não são alertas oficiais de seca, inundação, falta de água ou recomendações de irrigação. Não foram validados contra danos, umidade do solo ou decisões de manejo. Nenhum aviso é emitido para o presente, nem enviado a pessoas. O snapshot termina em 31/12/2025 e não comprova disponibilidade operacional.

Limites calculados exclusivamente em **01/01/2000–31/12/2019**, antes de classificar o histórico completo. Nenhum dado de validação/teste ajusta limites, severidade ou critérios. Código: consolidate.py, função thresholds. Arquivo: outputs/agua04/thresholds.csv. Não houve novo treinamento ou calibração do modelo.

## Referências por mês de calendário

Para cada indicador e mês m, usar valores do treino cujo **dia final da janela** pertence a m:

- R7(t)=Σ P(t−j), j=0…6; R30(t)=Σ P(t−j), j=0…29, em mm. Exigem janela completa, incluem t e nunca usam futuro. No início de 2000, as primeiras 6/29 janelas ficam ausentes. São 7.299/7.276 janelas válidas de treino, respectivamente.
- D(t)=dias consecutivos com P<1 mm/dia terminando em t; zero quando o dia não é de baixa precipitação. Usa todos os 7.305 dias de treino e não antecipa o fim da sequência. Ausente quebra a sequência. Não é duração completa futura de um evento.
- A(y,m)=precipitação do mês **encerrado**, em mm. Exige todos os dias válidos; 20 totais completos por mês de referência.

Quantis empíricos q10/q25/q75/q90 com interpolação linear (pandas). Tamanhos e valores completos constam do CSV. Cada mês possui limites próprios: não comparar diretamente uma janela de inverno com a distribuição de verão. Janelas móveis e dias sucessivos são dependentes; muitos quantis podem coincidir ou ser zero. Não interpretar os nomes como probabilidade de ocorrência ou frequência exata de 10/25/75/90%. Para totais mensais, apenas 20 anos tornam as caudas particularmente incertas.

## Regras exatas, inclusive empates

Para R7, R30 e A:

| Código | Condição | Texto sugerido |
|---|---|---|
| abaixo_q10 | x < q10 | Abaixo do quantil 10 do histórico de treino deste mês |
| entre_q10_q25 | q10 ≤ x < q25 | Entre os quantis 10 e 25 |
| entre_q25_q75 | q25 ≤ x ≤ q75 | Dentro da faixa central de referência |
| entre_q75_q90 | q75 < x ≤ q90 | Entre os quantis 75 e 90 |
| acima_q90 | x > q90 | Acima do quantil 90 |
| indisponivel | valor ausente/não finito | Janela sem dados suficientes; não atribuir nível |

A implementação usa essa ordem; quantis coincidentes podem tornar uma faixa vazia. Em particular, se q10=0, zero não é estritamente abaixo de q10. Não forçar alertas nem substituir a ausência por zero para preencher uma classe.

Para D:

| Código | Condição |
|---|---|
| sem_sequencia | D=0 |
| duracao_ate_q75 | 0<D≤q75 |
| duracao_acima_q75 | q75<D≤q90 |
| duracao_acima_q90 | D>q90 |
| indisponivel | ausente/não finito |

As durações são contagens inteiras, mas os quantis podem ser fracionários; aplicar a desigualdade sem arredondar o limite. Estes quantis são calculados sobre **dias**, incluindo zeros, não sobre uma amostra de eventos independentes. Assim, sequências longas contribuem com vários valores; não alegar período de retorno de um evento.

## Anomalias e sazonalidade

Anomalias mensais usam as mesmas médias/desvios de cada mês em 2000–2019: diferença em mm; diferença percentual; z=(A−μ)/s, s amostral n−1. São valores descritivos; **não definir classes por z como se chuva fosse normal, nem chamar de SPI/SPEI**. O aviso associado vem do quantil empírico do total mensal A e é referenciado pelo item monthly_rain. A média dos 20 totais de cada mês descreve sazonalidade; não é uma normal climatológica oficial de 30 anos. Não há novos limiares para estimativas da Ridge.

## Exemplo real arquivado, não situação atual

Em 31/12/2025: R7=24,22 mm e R30=86,50 mm; D=0 dias. Limites de dezembro:

| Indicador | q10 | q25 | q75 | q90 | n de treino |
|---|---:|---:|---:|---:|---:|
| R7 (mm) | 15,575 | 25,1375 | 54,625 | 74,685 | 620 |
| R30 (mm) | 111,42 | 134,8425 | 221,38 | 253,677 | 620 |
| D (dias) | 0 | 0 | 1 | 2 | 620 |
| Total mensal (mm) | 121,161 | 126,06 | 237,14 | 267,62 | 20 |

Portanto R7 fica entre q10/q25; R30 abaixo de q10; D indica sem sequência. Dezembro/2025 tem total 86,57 mm e anomalia de −99,70 mm (−53,52%; z≈−1,551) em relação à média de dezembro do treino, 186,27 mm. São descrições de um mês passado; nenhuma delas determina água disponível, necessidade de irrigar ou risco de inundação.

## Condições para futura apresentação

Exibir período LST, referência do treino, fonte/extração, qualidade e indisponibilidade operacional junto do valor. Usar texto neutro; não atribuir cores de emergência ou instruções de manejo a estas faixas. Limiares, versões e população de referência devem acompanhar qualquer painel futuro. Antes de alertas operacionais, validar disponibilidade/vintages, estações com janela compatível e critérios de decisão com profissionais e usuários, em novo protocolo.
