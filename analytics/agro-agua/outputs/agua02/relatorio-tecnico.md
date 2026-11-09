# AGUA-02 — relatório técnico

## Decisão

**GO condicional para pesquisa retrospectiva em AGUA-03; habilidade preditiva ainda não demonstrada. Uso operacional não justificado.** O alvo original de precipitação dos próximos sete dias foi mantido. Há calendário suficiente e sazonalidade/persistência a investigar, mas nenhuma correlação estabelece que um modelo superará a climatologia fora da amostra. Nenhum modelo foi ajustado; nenhum erro de validação/teste foi calculado.

## Auditoria e qualidade

Foram verificados SHA-256 e tamanhos de 78 arquivos do inventário AGUA-01, configuração/proveniência, todos os cabeçalhos NASA e igualdade do CSV com o reprocessamento dos 26 JSONs. São 9497 dias e 66479 valores de 2000–2025, LST, AG, latitude -23.52, longitude -46.19, sem ausentes, duplicações ou violações de plausibilidade. Não houve download da base nem alteração dos dados ou relatórios de qualidade de AGUA-01. Unidades: mm/day, C, %, m/s e MJ/m²/day, preservadas em audit.json. Zero ausentes não comprova acurácia.

## Resultados e leitura das figuras

1. **01_acumulados.png:** média anual de 1322.27 mm; menor total 739.28 mm em 2025; maior 1908.75 mm em 2009. A variabilidade é observada no produto NASA; não foi ajustada tendência, teste de mudança climática ou atribuição causal.
2. **02_sazonalidade.png:** outubro–março concentra 73.64% da chuva do período. Mês mais chuvoso em média: 1; menos chuvoso: 8. Caixas usam os 26 valores mensais por mês; linha de referência usa somente 2000–2019. Temperatura e RH acompanham ciclos sazonais, sem comprovar mecanismos causais.
3. **03_sequencias_baixa_chuva.png:** limiar primário P < 1 mm/dia, sensibilidade P < 0,1 e P = 0. Há 4897 dias abaixo de 1 mm e 1016 exatamente zero. Maior sequência primária: 48 dias, 2022-06-11 a 2022-07-28. Eventos contínuos cruzam anos; o gráfico anual reinicia a contagem em janeiro e está explicitamente identificado. Eventos nas bordas/ao lado de ausentes são censurados e marcados no CSV. Ausência não é dia seco.
4. **04_acumulados_moveis.png:** acumulados passados, incluindo t, não são o alvo futuro. Máximo móvel de 7 dias: 174.12 mm, terminando em 2011-03-05; de 30 dias: 399.80 mm, terminando em 2011-01-11. Primeiras 6/29 janelas ficam vazias, sem soma parcial.
5. **05_temperatura_umidade.png:** médias mensais e anuais de T2M e RH2M, com cobertura completa exigida. Média diária de todo o histórico: 20.19 °C e 79.89% RH. Maior média anual de T2M: 21.74 °C em 2024; menor média anual de RH: 73.03% em 2014. T2M_MAX_mean é média das máximas diárias, não a máxima absoluta do período. Oscilações não foram extrapoladas para prognóstico.
6. **06_relacoes_treino.png:** correlações de Spearman entre as sete variáveis, somente 2000–2019, antes/depois de subtrair as médias mensais diárias do treino. Relações incluem sazonalidade compartilhada e produtos de origem comum; não estimam causalidade ou necessidade de irrigação. A remoção de média mensal é aproximação simples e não elimina toda sazonalidade.
7. **07_anomalias.png:** chuva, temperatura e umidade mensais comparadas com média/desvio padrão de cada mês em 2000–2019. Valores z são descritivos, não probabilidades, SPI, SPEI, classificação oficial de seca ou normal climatológica de 30 anos. Meses do treino participam da própria referência; por isso essas anomalias não são escores de backtest de treino.
8. **08_persistencia_treino.png:** correlação diária P(t)/P(t−1) no treino = 0.399; após retirar a média mensal = 0.338. Na defasagem de sete dias, a correlação após retirar a média mensal cai para 0.003. A memória linear diária mais longa é fraca nesta medida; isso torna especialmente importante testar atraso de publicação e superar a baseline sazonal. Não prova impossibilidade de relações não lineares ou de previsão semanal. Dependência temporal invalida tratar milhares de dias como amostras independentes; não há p-valores iid.

As tabelas de correlação com y(t) usam exclusivamente origens elegíveis do treino, com rótulos encerrados até 31/12/2019. Spearman com chuva passada em 7 dias = 0.419; em 30 dias = 0.466. Essas relações misturam sazonalidade e memória meteorológica; não justificam seleção automática de atributos nem prometem habilidade em 2020–2025.

## Referências e integridade temporal

Climatologia e referências de anomalias são ajustadas exclusivamente em 2000–2019. A baseline é soma, para t+1…t+7, das médias diárias históricas de cada mês do treino, emitida somente para origens a partir de 2020; suas linhas de treino ficam vazias para evitar uma falsa previsão usando referência futura. O calendário futuro é conhecido; a chuva futura nunca entra nos atributos. prediction_design_lag0.csv é um contrato retrospectivo: presume acesso a todos os valores do dia t. As versões lag2 e lag7 são cenários de sensibilidade de disponibilidade, não garantias do SLA da NASA. Não foi demonstrada disponibilidade em tempo real dos arquivos históricos revisados.

Os sete últimos dias de origem de cada bloco são excluídos quando seus rótulos cruzam a fronteira (ou não existem no fim da série). As primeiras 29 origens do treino não têm janela passada de 30 dias no cenário lag0. Datas, cortes, razões de exclusão e contagens estão em split_manifest.json e nas tabelas de desenho. Histórico de dezembro pode alimentar janeiro da validação/teste porque seria passado já observado, sem ajustar referências nos blocos futuros.

A EDA descritiva solicitada expõe agregados de 2023–2025. Esse período permanece o teste cronológico final proposto, mas já não é um conjunto absolutamente cego em relação à inspeção humana. Nenhum critério, atributo ou limiar de evento foi escolhido para maximizar seu desempenho. Congelar o protocolo antes de AGUA-03 e, para confirmação independente, reservar um período futuro ainda não inspecionado e com vintages verificáveis.

## Representatividade e E3-097

Distância do ponto de referência NASA ao posto: 1.085 km (Haversine). Isso é pequeno frente à escala meteorológica nativa aproximada de 55.6 × 63.7 km na latitude local; para fonte solar de 1°, aproximadamente 111.2 × 102.0 km. Esses tamanhos são aproximações de escala, não um polígono de célula identificado. A geometria NASA é o ponto pedido, não um pluviômetro.

A E3-097 oferece apenas 184 dias válidos de março–agosto/2000 (182 ausentes). Horário de leitura/acumulação desconhecido: **nenhuma correlação, viés, erro, junção diária ou equivalência de acumulados foi calculada**. Nem mesmo totais mensais são tratados como equivalentes sem confirmar o fechamento dos meses. Os seis meses não cobrem um ciclo anual e não validam extremos/sazonalidade de 26 anos. Buscar documentação da janela, continuidade e metadados de outros postos no próximo incremento, antes de validar numericamente.

Relevo, tempestades locais e a diferença entre médias de grade e medições pontuais limitam representatividade. A radiação muda de SRB (2000) para CERES (2001 em diante), sem teste de homogeneidade neste incremento. A altitude de grade de 699,38 m não substitui altitude de estação. Os dados não medem água no solo, reservatórios, vazão ou demanda hídrica da cultura.

## Reprodução e arquivos

Executar `python eda.py` no módulo (ou caminho completo a partir da raiz); sem acesso à rede. Resultados em outputs/agua02, com manifesto de arquivos, hashes de código/entradas e versões de bibliotecas. Dicionário: docs/agua02-indicadores.md. Problema formal e plano de AGUA-03: docs/agua02-problema-preditivo.md. Fontes oficiais e parecer espacial: docs/agua02-representatividade.md. Estatísticas numéricas não arredondadas no summary.json; CSVs com oito casas decimais. Não foram executados treinamento, seleção de modelos ou avaliação no teste.
