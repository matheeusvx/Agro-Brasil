# AGUA-02 — qualidade, espaço, tempo e disponibilidade

## Evidência local auditada

Os 78 arquivos enumerados no inventário AGUA-01 tiveram tamanho e SHA-256 verificados, sem download. O CSV diário foi comparado numericamente com o reprocessamento dos 26 JSONs originais; unidades, fill_value, cobertura, tempo LST e coordenadas foram conferidos em cada cabeçalho. A configuração coincide com a proveniência. O código original de aquisição também coincide com o hash registrado. Resultado detalhado em `outputs/agua02/audit.json`.

São 9.497 dias/66.479 valores, completos por variável, sem duplicação ou ausentes. A validação de faixas é triagem ampla de plausibilidade, não ensaio de precisão local. Um produto preenchido por assimilação/modelagem pode ter cobertura integral mesmo onde uma estação apresenta lacunas. Não se corrigiu o dado NASA com os dados de estação.

## Representatividade espacial

O ponto solicitado (−23,52°, −46,19°) é a referência da sede municipal no [mapa IBGE preservado como fonte](https://geoftp.ibge.gov.br/cartas_e_mapas/mapas_municipais/colecao_de_mapas_municipais/2020/SP/mogi_das_cruzes/3530607_MM.pdf). Não é centroide, coordenada de uma propriedade ou posição de estação. SIRGAS 2000 e as coordenadas arredondadas dão referência municipal; não há pretensão topográfica.

O [tutorial NASA](https://power.larc.nasa.gov/docs/tutorials/service-data-request/api/) informa meteorologia de referência em 0,5°×0,625° e solar em 1°×1°; a [FAQ NASA](https://power.larc.nasa.gov/docs/faqs/data/#resolution) ressalta resolução nativa de cada produto. Na latitude local, usando aproximação 111,2 km/grau e longitude×cos(latitude), são cerca de 55,6×63,7 km para meteorologia e 111,2×102,0 km para uma grade solar de 1°. Esses números expressam escala, não limites/célula oficial identificada nem pegada homogênea de todos os parâmetros ao longo do tempo. A consulta regional em 0,5° não aumenta a resolução física dos dados de origem.

Relevo e precipitação convectiva variam dentro dessa escala. Altitude de 699,38 m na resposta NASA representa o dado médio de grade, não uma medição da estação. A [FAQ sobre elevação](https://power.larc.nasa.gov/docs/faqs/data/#quality) explica que a média da célula pode diferir substancialmente de um local em terreno complexo. Proximidade entre coordenadas de consulta e estação não elimina erro de representatividade.

Meteorologia tem origem MERRA2 nos metadados da entrega. A [documentação dos fluxos](https://power.larc.nasa.gov/docs/methodology/data/sources_fluxes/) e os cabeçalhos mostram SRB em 2000 e SYN1DEG/CERES desde 2001. Mudança de produto pode introduzir descontinuidades; EDA de correlação/temperatura/radiação não é teste formal de homogeneidade, tendência ou atribuição climática. Fontes de referência foram conferidas em 06/11/2026; não houve nova consulta aos endpoints de dados.

## Viabilidade da E3-097

Estaleiro DAEE, E3-097: latitude −23,5166667°, longitude −46,2°, aproximadamente **1,085 km** do ponto NASA (Haversine, raio 6371,0088 km; valor calculado em audit.json é a referência exata). Foram usados apenas os arquivos do AGUA-01: TXT oficial, CSV e metadados.

O calendário solicitado é 2000, mas só **184/366 dias (50,27%)** estão preenchidos, de 01/03 a 31/08. Janeiro/fevereiro e setembro–dezembro ficam ausentes. Não há ciclo anual completo nem múltiplos anos para validar sazonalidade, tendência, extremos ou estabilidade. O cadastro do posto não demonstra operação contínua, horário de coleta, consistência instrumental ou homogeneidade da localização. Não se conhece altitude da estação nos arquivos utilizados; não foi inventada.

As datas NASA são LST. A data do posto pode identificar leitura ou dia hidrológico com fechamento diferente; essa convenção **não foi confirmada** nos metadados locais. Sem uma janela temporal comum, juntar por data e calcular correlação/MAE/viés seria metodologicamente inadequado. O mesmo cuidado vale para acumulados mensais, que podem diferir nas bordas de fechamento. Por isso **nenhuma comparação numérica, junção ou correção** NASA–E3-097 foi executada.

É uma fonte candidata para inspeção futura, condicionada a: confirmar janela de leitura, flags, unidade, instrumento e mudanças; obter série com sobreposição e cobertura adequadas; definir regras de agregação/completude iguais; avaliar cada estação separadamente. A amostra atual não oferece validação conclusiva. Ver também o catálogo de outros 10 postos de Mogi e a discussão de INMET no documento original `fontes-comparacao.md`, preservado.

## Tempo da previsão versus tempo do dado

[NASA POWER — latência](https://power.larc.nasa.gov/docs/faqs/data/#latency), consultada em 06/11/2026: 2–3 dias meteorologia e 5–7 dias solar, como tempos típicos do arquivo, não SLA garantido por parâmetro. [Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/#time-standards) define LST por faixas solares de 15°, distinto de UTC/fuso civil. Os fluxos podem trocar produto conforme maturação e ser revisados.

O snapshot AGUA-01 foi extraído em novembro/2026 para 2000–2025. Não registra o que estava publicado no dia de cada previsão histórica. Um backtest que usa valor final do dia t antes de sua publicação teria vazamento de disponibilidade, mesmo sem `shift` negativo. Em AGUA-02 as tabelas lag0 são explicitamente ideais retrospectivas; lag2/lag7 simulam atraso fixo, sem alegar reconstrução de vintages. A definição operacional precisa de disponibilidade por variável e data de emissão; esse requisito segue aberto.

## Restrições de interpretação

As variáveis caracterizam condições meteorológicas regionais. Não medem água disponível no solo, nível de reservatório, vazão, evapotranspiração efetiva, capacidade de campo, tipo de solo, cultura ou manejo. Acumulado baixo não determina necessidade individual de irrigação. Nenhum indicador foi rotulado como alerta agronômico ou recomendação automática. Correlações e anomalias são exploratórias; não provam causalidade ou risco específico de uma propriedade.
