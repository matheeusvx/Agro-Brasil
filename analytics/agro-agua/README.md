# Agro+ Brasil — Inteligência Hídrica

## AGUA-04 — consolidação acadêmica final

Fundamentação acadêmica concluída: base real auditada, EDA, comparação retrospectiva de ML, indicadores e contrato documental para futura apresentação. **Não há ferramenta operacional validada:** a Ridge tem MAE 14,245 mm e ganho médio de 9,88%, mas apenas 0,15% de ganho nas chuvas elevadas. Nenhum treinamento, nova inferência, reabertura do teste, endpoint ou mudança nos aplicativos nesta etapa.

- [Relatório técnico final](docs/agua04-relatorio-final.md).
- [Síntese executiva em uma página](outputs/agua04/output/pdf/sintese-executiva.pdf).
- [Dicionário consolidado](docs/agua04-dicionario.md) e [critérios dos avisos estatísticos](docs/agua04-alertas.md).
- [Contrato proposto](docs/agua04-contrato-integracao.md) e [exemplo real arquivado](outputs/agua04/integration-example.json).
- [Evidências de validação/reprodução](docs/agua04-verificacao.md).

Os níveis usam quantis por mês ajustados **somente em 2000–2019**. Distinguem observação histórica NASA, anomalia, referência e estimativa experimental; todos têm disponibilidade `retrospectivo_sem_servico`, sem autorização para decisões. O exemplo termina em dezembro/2025 e não representa condição atual. Não mede água no solo/reservatórios ou necessidade de irrigação.

Na raiz, reprodução offline sem novos modelos:

```powershell
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/consolidate.py
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/ml.py verify
# Exclui explicitamente dois testes antigos que fazem fitting; preserva seus arquivos:
& analytics/agro-agua/.venv/Scripts/python.exe -m pytest analytics/agro-agua/tests -q -p no:cacheprovider --deselect=analytics/agro-agua/tests/test_ml.py::test_scaler_fit_and_early_stopping --deselect=analytics/agro-agua/tests/test_ml.py::test_reproduce_training_and_selection_offline
```

Não usar o comando de treino da seção histórica AGUA-03 para validar AGUA-04. `synthesis_pdf.py` gera a síntese com ReportLab/PyPDF no runtime local já disponível; versões adicionais em requirements-report.txt e comando exato nas evidências. O gerador valida uma página; a imagem original do AGUA-03 é reutilizada integralmente. Dados, modelos, registros de abertura e relatórios anteriores preservados. Sem commit/push.

---

## AGUA-03 — avaliação retrospectiva de Machine Learning

Ridge e HistGradientBoosting avaliados contra climatologia e persistência. **Ridge alpha=100 escolhida antes do teste**: MAE 14,245 mm contra 15,807 mm da climatologia, ganho de 9,88% no teste; nas chuvas elevadas, ganho de apenas 0,15%, MAE 37,293 mm. Há vantagem média retrospectiva neste recorte, sem comprovação operacional ou suporte a irrigação automática. Partições preservadas: 7.269/1.089/1.089 origens.

Documentos: [protocolo anterior ao teste](docs/agua03-protocolo.md), [relatório gerado](outputs/agua03/relatorio-tecnico.md), [conclusões e interpretação dos quatro gráficos](docs/agua03-conclusoes.md), [execução e testes](docs/agua03-verificacao.md). Artefatos e hashes: `outputs/agua03/inventory.json`. Dados/relatórios anteriores preservados.

```powershell
# Instalação inicial das dependências ML no ambiente do módulo:
& analytics/agro-agua/.venv/Scripts/python.exe -m pip install -r analytics/agro-agua/requirements-ml.txt
# Reprodução offline das métricas arquivadas, sem prever de novo no teste:
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/ml.py verify
# Regenera gráficos/relatório a partir dos CSVs, sem fitting/predict:
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/ml.py report
& analytics/agro-agua/.venv/Scripts/python.exe -m pytest analytics/agro-agua/tests -q -p no:cacheprovider
# Reproduz só treino/validação em outra pasta, preservando a entrega:
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/ml.py train --output analytics/agro-agua/outputs/agua03-repro
```

O fluxo original executado foi `train` → `evaluate` → `report`. **Não executar evaluate novamente nesta entrega:** a abertura única já está registrada e a ferramenta recusa repetição. Reprodução confirmatória usa `verify` e as estimativas com hash preservado; `report` apenas recalcula métricas/figuras desses mesmos CSVs. Instalar dependências pode exigir rede; treino, inferência e verificação não usam serviços externos. Não é preciso refazer AGUA-01/02. No ambiente já preparado, os comandos de reprodução são offline.

Modelos em `models/*.joblib`, configurações/versões/seed e hashes em frozen.json. Carregar apenas artefatos locais próprios verificados; persistência joblib depende das versões de bibliotecas fixadas. O código foi congelado antes do teste; um aviso de depreciação `dayofweek` do pandas permanece documentado e não afeta resultados. Sem commit/push ou alterações nos aplicativos.

---

## AGUA-02 — análise exploratória e desenho preditivo

**Atualização:** EDA concluída sobre os mesmos 9.497 registros locais, sem novo download e sem treinamento. Parecer: avançar apenas para um experimento retrospectivo controlado; habilidade preditiva e uso operacional ainda não demonstrados. Referências de climatologia/anomalias ajustadas exclusivamente em 2000–2019. Os dados e o inventário de AGUA-01 permanecem intactos.

```powershell
# Na raiz do repositório, com o mesmo ambiente do AGUA-01:
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/eda.py
& analytics/agro-agua/.venv/Scripts/python.exe -m pytest analytics/agro-agua/tests -q -p no:cacheprovider
```

Não exige novas dependências nem rede. Resultados ficam em `outputs/agua02/`, separados de `data/`; a execução recusa saída dentro de `data/`. O script audita tamanhos/hashes dos 78 arquivos do inventário anterior e compara a base diária com os JSONs originais antes de analisar. `outputs/agua02/inventory.json` contém os produtos da EDA; não executar `pipeline.py` para reproduzir AGUA-02.

- [Relatório técnico com interpretação das oito figuras](outputs/agua02/relatorio-tecnico.md).
- [Dicionário dos indicadores, fórmulas, unidades e cobertura](docs/agua02-indicadores.md).
- [Qualidade, representatividade e limites de comparação com E3-097](docs/agua02-representatividade.md).
- [Pergunta preditiva, baseline, disponibilidade, splits e plano AGUA-03](docs/agua02-problema-preditivo.md).
- [Evidências de execução e testes](docs/agua02-verificacao.md).

Principais resultados: 73,64% da chuva de outubro a março; sequência máxima de 48 dias com P<1 mm/dia; média anual 1.322,27 mm. Anomalias são relativas à referência fixa de 20 anos, não SPI ou normal climatológica oficial. Calendário LST não equivale à janela do pluviômetro E3-097; não foram calculadas correlações ou erros entre fontes.

As tabelas `prediction_design_lag0/2/7.csv` contêm um **contrato de dados**, não previsões de modelo. O alvo é soma de t+1…t+7; atributos só usam passado até t−L. O cenário lag0 é retrospectivo ideal; lag2/7 simulam atrasos sem garantir a disponibilidade real. Climatologia só é emitida a partir de 2020; não há escores de validação/teste. No cenário lag0: 7.269/1.089/1.089 origens elegíveis em treino/validação/teste, após aquecimento e exclusão dos rótulos que cruzam fronteiras. O teste 2023–2025 já teve agregados inspecionados na EDA, limitação de cegamento documentada.

Não há medições de água no solo/reservatórios ou prescrição de irrigação. Nenhuma alteração no portal, backend ou Flutter, commit ou push.

---

## AGUA-01 — aquisição e qualidade (entrega preservada)

Pipeline reproduzível de aquisição, tratamento e validação de dados reais NASA POWER. Sem ML, dashboard ou integração com os aplicativos. Entrega restrita a este módulo.

## Base entregue

- Ponto: sede de Mogi das Cruzes/SP, IBGE 3530607, **latitude −23,52°, longitude −46,19°**. Coordenadas arredondadas publicadas no [mapa municipal IBGE](https://geoftp.ibge.gov.br/cartas_e_mapas/mapas_municipais/colecao_de_mapas_municipais/2020/SP/mogi_das_cruzes/3530607_MM.pdf), SIRGAS 2000. Não se presume localização de uma propriedade nem precisão subquilométrica.
- Fonte: [NASA POWER Daily Point API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/), comunidade **AG**, frequência diária, **LST explícito** (horário solar local por faixa, distinto do fuso civil).
- Período: **01/01/2000–31/12/2025**, inclusive; **9.497 dias**, **66.479 valores**, 7 variáveis; 100% completos nesta extração. API v2.10.3; extração em 06/11/2026, aproximadamente 11h20–11h22, America/Sao_Paulo; timestamps exatos em UTC nos metadados.
- Sem datas ausentes, duplicações, `−999`, valores não finitos, violações das faixas de triagem ou inconsistências entre temperaturas mínima/média/máxima.
- 26 respostas anuais originais, sem reserialização, com URL, parâmetros, cabeçalhos HTTP, horário, bytes e SHA-256. `preflight.json` registra a validação dos anos extremos **antes** dos demais downloads, incluindo cobertura por variável. Nenhuma imputação.

| Parâmetro | Unidade original AG | Mínimo observado | Máximo observado |
|---|---|---:|---:|
| PRECTOTCORR | mm/day | 0,00 | 122,29 |
| T2M | C | 8,16 | 30,75 |
| T2M_MAX | C | 10,26 | 38,85 |
| T2M_MIN | C | 2,67 | 24,32 |
| RH2M | % | 28,58 | 96,57 |
| WS10M | m/s | 1,06 | 12,06 |
| ALLSKY_SFC_SW_DWN | MJ/m^2/day | 1,67 | 32,13 |

Radiação na comunidade AG é **MJ/m²/dia**, conforme a própria resposta; não converter implicitamente para kWh/m²/dia. `C` representa °C. Unidades e nomes originais constam de `provenance.json` e das respostas.

## Reprodução (PowerShell, a partir da raiz do repositório)

Ambiente testado: CPython **3.13.7**, Windows x64. O `.venv` já existente foi reutilizado. Para uma instalação nova, com Python 3.13 no PATH:

```powershell
python -m venv analytics/agro-agua/.venv
& analytics/agro-agua/.venv/Scripts/python.exe -m pip install -r analytics/agro-agua/requirements.txt
& analytics/agro-agua/.venv/Scripts/python.exe -m pip check
```

Coleta/validação e geração dos produtos:

```powershell
# Opcional: somente os anos extremos, antes da coleta completa
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/pipeline.py --preflight-only
# Completa o período e reutiliza tudo que já foi obtido
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/pipeline.py
# Reprocessa os mesmos bytes sem usar rede
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/pipeline.py --offline
# Pesquisa opcional de catálogos e amostra oficial, sem mesclar séries
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/research_sources.py
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/sample_spaguas.py
# Atualiza inventário, incluindo os arquivos opcionais
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/pipeline.py --offline
# Testes offline com dados reais incluídos na entrega
& analytics/agro-agua/.venv/Scripts/python.exe -m pytest analytics/agro-agua/tests -q -p no:cacheprovider
```

Não exige ativar o ambiente, instalar pacotes globalmente ou usar credenciais. Linux/macOS: trocar `.venv/Scripts/python.exe` por `.venv/bin/python`. As dependências diretas e transitivas estão fixadas em `requirements.txt`; a portabilidade dessas versões para outros sistemas não foi testada.

O coletor usa `requests`, timeout de conexão/leitura de **15/120 s**, até **3 tentativas** para falhas transitórias (rede, 429, 5xx e JSON malformado), espera limitada e requisições sequenciais com pausa. Erros HTTP permanentes interrompem sem repetição. Cache é identificado pela configuração inteira da consulta e validado por hash; cache corrompido interrompe a execução. `--offline` recusa qualquer resposta ausente.

Para uma extração independente futura, use `--output analytics/agro-agua/data-nova-extracao`; isso consulta a fonte novamente de maneira explícita e preserva esta entrega. Não apague os originais para atualizar silenciosamente. A fonte pode revisar dados históricos. Uma falha retorna código 1 e não deve ser registrada como execução concluída; produtos anteriores eventualmente existentes pertencem à execução anterior. Não executar dois processos simultâneos no mesmo diretório de saída.

## Arquivos

```text
config.json                       recorte, coordenadas, comunidade, tempo e variáveis
pipeline.py                       aquisição, validação, indicadores e gráficos
research_sources.py               catálogos reais INMET/SP Águas (opcional)
sample_spaguas.py                  amostra diária oficial E3-097/2000 (opcional)
requirements.txt                  dependências fixadas
tests/test_pipeline.py            contrato, qualidade, cache, retries e integridade
docs/auditoria.md                 auditoria de escopo e ambiente
docs/fontes-comparacao.md         fontes oficiais e método para AGUA-02
docs/verificacao.md               evidências dos testes e reprodução
data/raw/*.json                   26 respostas originais + 26 metadados de aquisição
data/processed/daily.csv          calendário diário, 7 variáveis, ausentes vazios
data/processed/precipitation_annual.csv   26 linhas
data/processed/precipitation_monthly.csv  312 linhas
data/reports/quality.json         contagens, quartis, faixas, lacunas e ocorrências
data/reports/quality.md           relatório legível, método e limitações
data/reports/issues.csv           ocorrências com valor original (só cabeçalho nesta coleta)
data/reports/figures/*.png         quatro gráficos exploratórios
data/comparison/                  catálogos e amostra SP Águas, separados
data/preflight.json               evidência da verificação anterior à coleta completa
data/provenance.json              metadados completos, versões e hashes do código/config
data/inventory.json               tamanho e SHA-256 de cada produto em data/
```

Dados e relatórios são artefatos deliberados da entrega; `.venv`, bytecode, cache do pytest e temporários estão ignorados. Nenhum commit ou push foi realizado.

## Qualidade, indicadores e limitações

[Relatório de qualidade](data/reports/quality.md) e [estatísticas completas](data/reports/quality.json). As faixas de triagem são amplas e explicitadas por variável; completude e plausibilidade não comprovam exatidão de campo. Valores rejeitados são registrados antes de virarem ausentes. Datas faltantes são linhas vazias no calendário esperado. Chaves JSON e datas duplicadas interrompem a execução. Não há interpolação, preenchimento com zero ou remoção silenciosa de extremos.

Indicadores: acumulados mensais/anuais, máximo diário, dias chuvosos (≥1 mm) e maior sequência de dias secos (<1 mm), restrita a cada mês/ano. Totais e contagens dependentes de cobertura só são publicados para períodos completos; `observed_sum_mm` identifica soma parcial. Média do total anual nesta extração: aproximadamente **1.322,27 mm**. Este número descreve o produto NASA, sem validação contra pluviômetros.

Gráficos: [anuais](data/reports/figures/precipitacao_anual.png), [ciclo mensal](data/reports/figures/ciclo_mensal.png), [sete séries diárias](data/reports/figures/series_diarias.png) e [distribuição da chuva](data/reports/figures/distribuicao_chuva.png). Ciclo mensal: médias de meses completos, barras de erro são desvio padrão entre anos, sem inferência de tendência.

Meteorologia e radiação vêm de grades com resoluções/fontes distintas; não são medições na sede nem em uma fazenda. Radiação muda de SRB em 2000 para CERES desde 2001. O período tem 26 anos, não uma normal climatológica de 30 anos. Ver referências oficiais, limitações de representatividade, diferenças de janela diária e plano de comparação em [fontes-comparacao.md](docs/fontes-comparacao.md). AGUA-02 deve priorizar validação espacial/temporal com estações, inspeção de extremos e homogeneidade antes de qualquer modelagem.
