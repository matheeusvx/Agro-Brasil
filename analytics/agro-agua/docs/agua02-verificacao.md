# AGUA-02 — evidências de execução

Data: **06/11/2026**, America/Sao_Paulo. Trabalho iniciado aproximadamente às 11h35 e encerrado dentro do limite de cinco horas. Ambiente existente do AGUA-01: CPython 3.13.7, pandas 3.1.1, numpy 2.5.4, matplotlib 3.11.2, pytest 9.2.0. Nenhuma dependência adicional instalada; requirements.txt preservado. `pip check`: **No broken requirements found**.

## Execução reproduzível

A partir da raiz do repositório:

```powershell
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/eda.py
& analytics/agro-agua/.venv/Scripts/python.exe -m pytest analytics/agro-agua/tests -q -p no:cacheprovider --junitxml=analytics/agro-agua/docs/agua02-test-results.xml
```

O script pode ser executado de qualquer diretório, pois resolve as entradas pelo caminho de eda.py. `--output` permite outra pasta de saída para conferência, mas recusa qualquer diretório dentro de `data/`. Não executar pipeline.py, research_sources.py ou sample_spaguas.py para reproduzir AGUA-02: os arquivos locais bastam.

## Resultados das verificações

- **36 testes aprovados**: 18 testes originais de AGUA-01 e 18 casos de AGUA-02. Evidência estruturada com horário e duração: `agua02-test-results.xml`. Nenhum teste ignorado.
- Auditoria de todos os **78 arquivos** do inventário AGUA-01: tamanhos e hashes válidos. A base diária coincide numericamente com o reprocessamento dos 26 JSONs, com tolerância absoluta 1e-10; calendário, parâmetros, unidades e coordenadas confirmados.
- 9.497 registros e 66.479 valores, completos. Nenhuma aquisição da base foi realizada neste incremento.
- Fórmula do alvo verificada contra soma manual de sete dias futuros reais, excluindo o presente, inclusive em fevereiro bissexto; últimos sete rótulos permanecem ausentes.
- Testes de mudança apenas de dados futuros demonstram invariância de referências de treino, atributos e baseline; rótulos mudam como esperado. Mutações de teste existem somente em memória, sem dados artificiais de entrega.
- Fronteiras de rótulos e aquecimento confirmados para latências 0/2/7: 7.269/7.267/7.262 origens de treino; 1.089 de validação e 1.089 de teste em cada cenário. Nenhum alvo elegível cruza seu bloco.
- Baseline de referência até 2019 fica vazia nas origens de treino; datas futuras de calendário atravessam meses/anos corretamente. Baseline e alvo não entram na lista de atributos.
- Anomalias verificadas contra média/desvio amostral de cada mês do treino; lacunas não viram zeros, somas de períodos incompletos permanecem vazias; sequências respeitam limiar estrito e censura.
- O teste de integração bloqueia `socket.create_connection` e `socket.socket.connect`, executa toda a EDA numa pasta temporária e compara o manifesto com o resultado entregue: **todos os tamanhos e hashes são idênticos**, inclusive PNGs. Não apenas o CSV, mas a reprodução completa ocorre sem conexão de rede.
- O teste de integridade de AGUA-01 passa junto dos novos testes, confirmando que seus dados/inventário continuam preservados. O inventário próprio de AGUA-02 também foi verificado.

## Artefatos e inspeção visual

`outputs/agua02/` contém **31 artefatos**: oito figuras PNG, 17 tabelas CSV e seis arquivos de relatório/metadados (incluindo o inventário). Aproximadamente 14,9 MB no total; os três contratos diários de desenho preditivo são a maior parte desse volume. Tamanhos e SHA-256 exatos estão em `outputs/agua02/inventory.json`.

Figuras abertas e inspecionadas visualmente: acumulados; sazonalidade; sequências com baixa chuva; acumulados móveis; temperatura/umidade; matrizes de correlação; anomalias; persistência diária. Títulos, unidades e eixos legíveis. A barra de cores das matrizes foi reposicionada após a primeira inspeção para eliminar sobreposição. Cada figura tem interpretação no relatório técnico; legendas e fórmulas constam do dicionário.

O relatório não usa a amostra E3-097 como validação: apenas 184 dias disponíveis e janela de leitura desconhecida. Nenhuma junção ou métrica entre fontes foi calculada. Também não há MAE/RMSE, seleção de hiperparâmetros, fitting de modelos ou desempenho de validação/teste. A climatologia é uma estatística de referência ajustada no treino; suas previsões de referência não foram pontuadas neste incremento.

## Escopo preservado

Alterados/criados por AGUA-02: eda.py, tests/test_eda.py, documentação agua02, extensão do README do módulo e outputs/agua02. Os arquivos de dados, metadados e inventário de AGUA-01 foram apenas lidos. As alterações pré-existentes no portal e nas evidências de design foram preservadas, sem modificações por este incremento. Backend e Flutter não foram alterados. Nenhum commit, push ou ajuste de índice Git.

`.venv`, bytecode e caches de testes continuam ignorados. Outputs de EDA são artefatos deliberados de entrega, não caches. `git diff --check -- analytics/agro-agua` não encontrou erros de whitespace. A consulta externa foi restrita a documentação oficial NASA sobre resolução, fontes, LST e latência; nenhum endpoint de dados foi consultado por AGUA-02.
