# Fontes oficiais e comparação futura — consultadas em 06/11/2026

## NASA POWER

- [Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/): ponto, até 20 parâmetros por consulta; LST padrão e UTC opcional. A configuração fixa LST, frequência diária e AG. Os sete parâmetros e unidades foram confirmados nos arquivos originais de 2000 e 2025 antes de obter os anos intermediários. Ambos têm cobertura integral por variável.
- [IBGE — mapa municipal Mogi das Cruzes](https://geoftp.ibge.gov.br/cartas_e_mapas/mapas_municipais/colecao_de_mapas_municipais/2020/SP/mogi_das_cruzes/3530607_MM.pdf): sede −23,52°, −46,19°, referência SIRGAS 2000. O ponto é referência municipal, não centroide, estação nem talhão; não se presume equivalência geodésica de precisão topográfica com a grade NASA.
- [Tutorial NASA sobre a API](https://power.larc.nasa.gov/docs/tutorials/service-data-request/api/): referência de meteorologia 0,5° × 0,625° e solar 1° × 1°. A [FAQ atual](https://power.larc.nasa.gov/docs/faqs/data/) ressalta resolução nativa da fonte. A grade regional de consulta 0,5° × 0,5° não assegura resolução física igual de todos os produtos.
- [Fontes dos fluxos solares](https://power.larc.nasa.gov/docs/methodology/data/sources_fluxes/): SRB R4-IP até 31/12/2000; CERES SYN1deg desde 01/01/2001, com FLASHFlux em trechos próximos do presente. A resposta de 2000 identifica MERRA2/SRB/POWER; 2025 identifica MERRA2/SYN1DEG/POWER. Os metadados de cada ano foram preservados. Não assumir uma série observacional homogênea nem aplicar tendência automaticamente.
- [Condições de uso/citação](https://power.larc.nasa.gov/docs/faqs/): atribuir NASA POWER e manter a identificação dos produtos de origem. Dados abertos não tornam o produto adequado a recomendações agronômicas individuais sem validação.

## INMET

Arquivos oficiais para futura validação: [Históricos anuais de estações automáticas](https://portal.inmet.gov.br/dadoshistoricos), com pacotes ZIP anuais desde 2000. Exemplo explicitamente vinculado pelo portal: [2025.zip](https://portal.inmet.gov.br/uploads/dadoshistoricos/2025.zip). Os pacotes contêm arquivos por estação e dados horários, não uma série diária municipal pronta. Não baixar todos os ZIPs até selecionar estações e períodos de interesse.

[Catálogo oficial](https://portal.inmet.gov.br/paginas/catalogoaut) e seu [JSON público](https://apitempo.inmet.gov.br/estacoes/T) (endpoint identificado no JavaScript do próprio portal). Foi coletado o catálogo real de **668 estações**, original com hash e horário, e produzido ranking de proximidade esférica em `data/comparison/inmet_nearest_stations.csv`. Distâncias por Haversine com raio terrestre médio 6371,0088 km; não são distâncias rodoviárias nem critério suficiente de representatividade.

| Estação candidata | Código | Latitude | Longitude | Altitude (m) | Distância do ponto NASA | Início informado pelo catálogo |
|---|---|---:|---:|---:|---:|---|
| Bertioga | A765 | −23,84472221 | −46,14333333 | 5 | 36,419 km | 31/01/2017 |
| São Paulo — Mirante | A701 | −23,4962888 | −46,6200666 | 785,64 | 43,931 km | 24/07/2006 |

Bertioga fica em contexto costeiro de baixa altitude, separado da região de Mogi pela Serra do Mar; proximidade não a torna a melhor referência. A resposta NASA informa altitude média de referência de 699,38 m. Mirante é urbano e distante. Não foi encontrada estação automática nomeada Mogi das Cruzes no catálogo consultado. O catálogo é um retrato atual, não prova de funcionamento contínuo em todo o histórico. Ver também [BDMEP](https://bdmep.inmet.gov.br/) para convencionais e metadados, caso necessário.

Não foram baixados pacotes meteorológicos INMET neste incremento: a seleção espacial e a janela diária exigem avaliação prévia. O catálogo foi coletado e preservado; a amostra observacional inicial foi obtida do SP Águas, abaixo.

## SP Águas (antigo DAEE)

[SIBH oficial](https://apps.spaguas.sp.gov.br/sibh/) encaminha ao banco hidrológico. O link legado `www.hidrologia.daee.sp.gov.br` apresentou erro 502 no acesso via navegador de pesquisa; foi identificado e usado o [banco oficial atual de postos pluviométricos](https://ph.spaguas.sp.gov.br/Pluviometricos). Nele há consultas distintas de **Chuvas Diárias** e **Chuvas Mensais**, com exportações TXT e XLS. Foram preservados o catálogo HTML original e os **10 postos de Mogi** identificados nele, em `spaguas_mogi_stations.json`. Cobertura não foi presumida a partir da existência dos postos.

Postos candidatos: E3-097 Estaleiro DAEE (23°31′S, 46°12′W); E3-032 Santo Angelo (23°35′S, 46°14′W); E3-093 Serra do Itapeti; E3-133 Granja Rio Acima. A seleção deve considerar relevo, bacia, altitude, mudanças de localização, manutenção e extensão da sobreposição, além da distância.

### Amostra observacional real

[Consulta oficial E3-097](https://ph.spaguas.sp.gov.br/Pluviometricos/Posto?idPosto=da39c05f-4d45-4aa5-8cb6-a383682e207f), tipo Chuvas Diárias, ano inicial/final 2000. O portal oferece anos 1961–2000 para esse posto; isso indica disponibilidade de seleção, não completude anual. [TXT oficial E3-097/2000](https://fch.spaguas.sp.gov.br/FCHP/RecuperarMedicoes/ConsultaAlturasDiariasPluviometricasTXTPortal?idPosto=da39c05f-4d45-4aa5-8cb6-a383682e207f&anoInicial=2000&anoFinal=2000).

Preservados HTML da consulta, TXT original (7.933 bytes), metadados com SHA-256, CSV separado e relatório `spaguas_sample_quality.json`. São **184 dias válidos** de 01/03 a 31/08/2000 em calendário de 366 dias. **182 ausentes**: 01/01–29/02 e 01/09–31/12. Mínimo 0 mm, máximo 70,1 mm. Campos vazios viram ausentes, nunca zero. Não foi calculada correlação, viés ou erro contra a NASA: o horário e a janela de leitura do pluviômetro não estão confirmados. O TXT é uma amostra de aquisição e qualidade, não uma validação numérica da base NASA.

## Protocolo recomendado para AGUA-02

1. Selecionar estações com sobreposição suficiente, coordenadas/altitudes auditadas e histórico de mudança/manutenção. Baixar apenas arquivos necessários; manter respostas e flags originais com SHA-256.
2. Confirmar unidades, convenção de data/hora e janela de acumulação de cada fonte. LST não é UTC nem horário civil; o dia do pluviômetro pode terminar de manhã. Sem essa confirmação, considerar agregados mensais completos como comparação preliminar, com a limitação explicitada.
3. Para dados horários INMET, definir regra de 24 horários válidos, soma de precipitação, médias/extremos de temperatura e unidade de radiação a partir dos cabeçalhos e manuais. Tratar separadamente valores ausentes e flags; não somar dias incompletos como totais. Confirmar se extremos são horários ou diários.
4. Nunca concatenar estações como uma única série. Comparar cada estação com seu ponto NASA próprio e com o ponto municipal de referência, identificando distância, célula e relevo. Comparar apenas datas/janelas harmonizadas e informar tamanho da amostra e completude de ambos os lados.
5. Inspecionar chuva máxima, sequências secas e possíveis descontinuidades/fontes antes de medir viés e erros. Completude 100% da NASA não confirma exatidão. A amostra E3-097 é curta; buscar outros postos e anos antes de generalizar.
6. Definir objetivos analíticos e critérios de qualidade para a etapa seguinte. Nenhum modelo, partição de treinamento ou recomendação de irrigação pertence a AGUA-01.
