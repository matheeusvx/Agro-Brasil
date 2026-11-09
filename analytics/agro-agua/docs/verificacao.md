# Verificação AGUA-01 — 06/11/2026

Execução inicial iniciada aproximadamente às 11h17 (America/Sao_Paulo), concluída dentro do teto de cinco horas. Todos os comandos abaixo foram executados na raiz do repositório com o interpretador `.venv/Scripts/python.exe` do módulo, CPython 3.13.7.

## Aquisição e qualidade

1. `pipeline.py --preflight-only`: respostas de 2000 e 2025 obtidas da API oficial e preservadas. Parâmetros, unidades, cabeçalhos, coordenadas, padrão LST e cobertura das extremidades aprovados.
2. `pipeline.py`: reutilizou os dois anos, baixou os outros 24 sequencialmente e gerou a entrega. Última resposta em 06/11/2026 11h21min49s (14h21min49s UTC). Não houve repetição dos anos extremos nem preenchimento de dados.
3. `research_sources.py`: coletou o catálogo INMET de 668 estações e o catálogo SP Águas; identificou 10 postos de Mogi. Ranking de proximidade salvo separadamente.
4. `sample_spaguas.py`: consulta oficial somente de leitura e TXT E3-097/2000. 184 dias válidos, 182 ausentes, todos os vazios preservados. Não calculou validação numérica contra NASA.
5. `research_sources.py --offline`, `sample_spaguas.py --offline` e `pipeline.py --offline`: concluídos com sucesso usando arquivos locais, hashes verificados e sem downloads. A execução final offline gerou o inventário incluindo os dados opcionais.

NASA: 9.497 registros esperados, 9.497 da fonte, 9.497 tratados, 66.479 valores, 100% válidos por variável. Zero datas ausentes, duplicadas, valores `−999`, não numéricos/não finitos, fora das faixas ou temperaturas inconsistentes. `issues.csv` contém somente o cabeçalho. Cabeçalhos da API não trouxeram mensagens de alerta. Estatísticas completas e períodos de ausência por variável estão no relatório JSON.

## Testes

`python -m pip check`: **No broken requirements found**.

```powershell
& analytics/agro-agua/.venv/Scripts/python.exe -m pytest analytics/agro-agua/tests -q -p no:cacheprovider --junitxml=analytics/agro-agua/docs/test-results.xml
```

Resultado final: **18 passed in 1.34s**, zero erros, falhas ou testes ignorados. Evidência: `test-results.xml`, execução em 06/11/2026 11h29min42s −03:00.

Cobertura dos testes: contrato de unidades, coordenadas, tempo e período; ano bissexto; códigos ausentes; valor inválido, não finito e fora da faixa; ordem das temperaturas; datas ausentes (globais e por variável); períodos contíguos; duplicação de chaves JSON/datas; agregação com período completo e recusa de total quando incompleto; cache sem repetição, adulteração detectada, ausência offline; timeout com três tentativas; erro permanente 422 sem repetição; recuperação em 429/500/503; rejeição de parâmetro inteiramente ausente na pré-coleta; parsing real da amostra SP Águas sem confundir zero com vazio.

O teste de entrega verifica tamanho e SHA-256 de **todos** os arquivos do inventário, calendário completo, 312 meses, e igualdade numérica das sete colunas do CSV final contra o reprocessamento de todos os JSONs originais (tolerância absoluta 1e-10). Os testes não acessam a rede nem geram séries meteorológicas artificiais persistidas.

## Artefatos e inspeção

| Artefato | Tamanho (bytes) |
|---|---:|
| 26 JSONs originais NASA (soma) | 1.128.853 |
| 26 JSONs + 26 metadados de aquisição (soma) | 1.179.465 |
| processed/daily.csv | 626.082 |
| processed/precipitation_annual.csv | 1.514 |
| processed/precipitation_monthly.csv | 14.613 |
| reports/quality.json | 4.304 |
| reports/quality.md | 3.172 |
| reports/issues.csv | 37 |
| reports/figures/precipitacao_anual.png | 32.453 |
| reports/figures/ciclo_mensal.png | 26.650 |
| reports/figures/series_diarias.png | 329.690 |
| reports/figures/distribuicao_chuva.png | 30.480 |
| provenance.json | 95.522 |
| preflight.json | 4.610 |
| inventory.json | 13.939 |
| comparison/spaguas_E3-097_2000_daily.txt | 7.933 |

O inventário registra os demais arquivos individualmente e seus SHA-256. Seu próprio hash não é incluído nele. As quatro figuras PNG foram abertas e conferidas visualmente: títulos, eixos, unidades e conteúdo legíveis, sem cortes de texto. Os gráficos exploratórios não provam tendência, acurácia local ou causalidade.

`git diff --check -- analytics/agro-agua` sem erros de whitespace. `git check-ignore` confirmou exclusão de `.venv`, `__pycache__` e `.pytest_cache`. O status Git final preserva as alterações pré-existentes do portal/design; AGUA-01 só acrescentou/modificou arquivos dentro do módulo. Nenhum commit/push ou alteração do portal, API ou Flutter por este incremento.
