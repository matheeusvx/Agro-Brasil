# Verificação da entrega acadêmica — 16/11/2026

Matheus Morelli Rodrigues, RM 562765. Ambiente científico existente: CPython 3.13.7 Windows x64, dependências de `requirements-ml.txt`. O acesso ao interpretador da .venv exigiu execução autorizada fora do sandbox; não houve instalação global. Autoria PDF usa o Python do runtime local Codex, ReportLab 4.4.9 e pypdf 6.21.4. Renderização: Poppler instalado no runtime.

A primeira tentativa teve 50 testes aprovados e nove erros de setup por acesso negado à pasta temporária padrão do Windows. Nenhuma asserção científica falhou nessa execução. O runner foi corrigido para usar pasta temporária única dentro do módulo, limpa ao terminar e ignorada pelo Git; a suíte foi repetida com as mesmas asserções e guardas. A versão efetiva de pypdf foi conferida (6.21.4) e fixada nas dependências da autoria atual; versões dos experimentos científicos não foram alteradas.

## Comandos de validação e arquivos

Na raiz do repositório:

```powershell
# Verificação e reprodução científica offline, SEM fitting/predict:
& analytics/agro-agua/.venv/Scripts/python.exe -X utf8 analytics/agro-agua/verify_delivery.py
# Somente pesquisa arquivada, sem rede:
& analytics/agro-agua/.venv/Scripts/python.exe -X utf8 analytics/agro-agua/hydrology.py
# Gerar PDFs no ambiente de autoria, com requirements-report.txt:
python analytics/agro-agua/academic_pdf.py
# Renderizar todas as páginas:
pdftoppm -r 110 -png analytics/agro-agua/outputs/entrega/output/pdf/relatorio-academico.pdf analytics/agro-agua/outputs/entrega/output/pdf/relatorio
pdftoppm -r 120 -singlefile -png analytics/agro-agua/outputs/entrega/output/pdf/sintese-executiva.pdf analytics/agro-agua/outputs/entrega/output/pdf/sintese-executiva
```

Não executar `ml.py train`, `ml.py evaluate` ou a suíte histórica irrestrita para validar esta entrega. Dois testes de treinamento são desmarcados por `--frozen-only`, não apagados nem contados como aprovados. O modo bloqueia métodos fit/predict de Ridge/HGB, joblib.load e conexão de rede nos testes. A guarda de abertura única é exercitada em diretório temporário; o recibo original permanece byte a byte idêntico.

O resultado executado está em `outputs/entrega/test-results.xml` e `checks.json`; o documento não presume sucesso antes desses registros. `outputs/entrega/inventory.json` contém bytes/SHA-256 dos produtos, fontes novas, scripts e documentos desta entrega, exceto o próprio inventário e os dois registros de checks regeneráveis. `preservacao-inicial.json` guarda 131 hashes anteriores. Mudanças nos documentos finais exigem regenerar inventário e repetir a verificação antes do commit.

Resultado final: **59 testes aprovados, 2 desmarcados por fitting**, sem falhas. Permanecem 21 avisos de depreciação `Series.dt.dayofweek` em `ml.py`, código congelado que não foi alterado. `pip check`: `No broken requirements found`. SHA-256 dos 131 arquivos preservados idênticos antes/depois. Atributos Git locais ao módulo impedem normalização de fins de linha; blobs conferidos contra o snapshot original. Os arquivos de dados continuam completos e os modelos/recibos originais não sofreram nenhuma mudança local.

## Revisão dos PDFs

O gerador valida exatamente nove páginas no relatório e uma na síntese, título/metadados e presença de autor/RM; texto extraído acompanha os dois arquivos. Todas as páginas foram renderizadas em PNG e inspecionadas individualmente para legibilidade, acentos, margens, tabelas, figuras, ausência de cortes/sobreposição, numeração e coerência das interpretações. Resultados e autoria estão legíveis; não há página extra, texto fora da área útil ou título isolado.

| Página | Conferência |
|---|---|
| Relatório 1 | Autor/RM, pergunta, escopo RMSP e resumo; conclusão limitada à evidência. |
| Relatório 2 | Tabela de fontes e quarentena; unidades, cobertura e problemas de acesso legíveis. |
| Relatório 3 | Limpeza, sazonalidade e Figura 1 completas; legenda e eixos preservados. |
| Relatório 4 | Fórmulas/unidades e Figura 2; distinção entre pouca chuva e falta de água. |
| Relatório 5 | Dois modelos, baselines, folds/splits, alvo e latência sem alterações no protocolo. |
| Relatório 6 | Quatro métodos e métricas originais; Figura 3, erros elevados e incerteza visíveis. |
| Relatório 7 | Desigualdades/empates, exemplo histórico, custos dos erros e supervisão humana. |
| Relatório 8 | Recomendações, atendimento parcial e vieses, sem benefícios inventados. |
| Relatório 9 | Reprodução e referências; links e rodapé sem cortes. |
| Síntese 1 | Uma página, autor/RM, pergunta/dados/indicadores/modelos/riscos/recomendações; tabela clara. |

O relatório não afirma atualidade dos indicadores de 2025. A consulta Sabesp atual é evidência de disponibilidade de aquisição, não de validade para diagnóstico. Nenhuma série em quarentena ganhou figura analítica ou rótulo de risco.

## Notebook executado acrescentado a pedido do aluno

`notebook_delivery.py` foi executado com nbclient 0.11.0, nbformat 5.11.1 e ipykernel 7.4.0, em kernel Python 3.13.7 real e temporários isolados no módulo. O suporte Jupyter foi instalado na .venv existente com restrições de `requirements-ml.txt`; o próprio notebook confirma as versões originais de numpy/pandas/scipy/scikit-learn/joblib/threadpoolctl. Dependências adicionais em `requirements-notebook.txt`. Não houve instalação global ou registro global de kernel.

Arquivo: `Agro-Brasil-DSA-GS2026-2-RM562765.ipynb`. **15 células de código executadas com contagens sequenciais, 12 imagens PNG incorporadas, 27 saídas HTML de tabelas/código e zero erros.** Todas as células têm timestamps do kernel; `allow_errors=False`. O gerador valida o schema nbformat, decodifica/verifica todas as imagens e só grava o notebook final após sucesso completo. O hash e os metadados da execução estão em `outputs/entrega/notebook-execution.json`.

A execução real reconstruiu a base a partir das respostas originais, conferiu agregados mensais/anuais, correlações, limiares e todas as métricas/recortes arquivados com tolerâncias de precisão publicadas. Exibiu o código original da construção dos dois algoritmos e a seleção anterior. Treinamento/inferência/abertura do teste e requisições HTTP são bloqueados; os 131 hashes anteriores foram conferidos no começo e fim. A suíte da sprint é apresentada como registro lido, não como testes executados dentro do kernel. As limitações de alerta/escassez e qualidade da Sabesp foram mantidas.

Para envio pela opção notebook: `.ipynb` com suas saídas salvas, síntese de uma página e pacote de apoio. Para ler os resultados, não é necessária uma nova execução; para reproduzir, extrair a estrutura completa e usar o ambiente notebook. PDFs anteriores não foram alterados nesta complementação.
