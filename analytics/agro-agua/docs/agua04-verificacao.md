# AGUA-04 — evidências de conclusão

Executado em **06/11/2026**, America/Sao_Paulo, iniciado aproximadamente às 12h19, dentro do limite de cinco horas. Ambiente científico anterior preservado: CPython 3.13.7, pandas 3.1.1, numpy 2.5.4, scikit-learn 1.9.1. Não foram instaladas novas dependências nesse ambiente. PDF criado com o runtime já disponível do Codex: ReportLab 4.4.9 e PyPDF 6.10.0, versões registradas em requirements-report.txt. Sem downloads meteorológicos.

## Validação executada

1. `consolidate.py`: auditou tamanho/SHA-256 dos 78 itens de AGUA-01, 30 de AGUA-02 e 17 de AGUA-03, além dos controles de proveniência e igualdade do CSV diário com os JSONs originais. Criou 48 linhas de limites (quatro indicadores ×12 meses), série de 9.497 dias, 312 meses e nove itens no contrato. Sem fit, joblib/load, predict, train ou evaluate.
2. Síntese PDF gerada com uma página A4; contagem confirmada com PyPDF. Página renderizada com Poppler e aberta para conferência visual. Título, conteúdo, gráfico original, tabela, fontes e rodapé legíveis, sem cortes/sobreposições. Texto extraído ao lado para acessibilidade. Não foram alterados os gráficos anteriores.
3. Suíte: **53 passed, 2 deselected**, zero falhas/erros/testes ignorados, duração aproximada de 32 s; evidência completa em agua04-test-results.xml. As duas exclusões são detalhadas abaixo, sem alterar os testes originais.
4. Novos testes de AGUA-04 verificam invariância dos limites quando somente o futuro é alterado, quantis e contagens de treino, limites estritos/inclusivos e empates, tratamento de ausentes, contrato com estimativa realmente arquivada, recusa de alegações operacionais e de horizonte incorreto, saída que preserva entregas anteriores, inventário e presença do PDF/preview.
5. Teste de reprodução completo de AGUA-04 bloqueia socket.connect, Ridge.fit, HistGradientBoostingRegressor.fit, joblib.load, ml.train, ml.evaluate e ml.predict. Reproduz os quatro CSVs com bytes idênticos em pasta temporária e confirma os hashes de **todos os arquivos** de data/, outputs/agua02 e outputs/agua03 antes/depois. Nenhum modelo foi treinado ou carregado nessa reprodução.
6. O contrato foi validado por regras semânticas de domínio: campos obrigatórios, enums, finitude, unidade, coordenadas, timezone, ordenação de períodos, ausência de autorização operacional, alvo t+1…t+7 e ausência de nível estatístico na estimativa. Não se afirma validação por JSON Schema.
7. Verificação das métricas preservadas de AGUA-03 executada sem nova inferência ou fitting. Registros de abertura/conclusão, código congelado e modelos permanecem com os hashes anteriores. Os avisos já existentes de depreciação `dayofweek` (21 na suíte) não são erros e foram preservados junto do código congelado.

## Exclusões exigidas pela restrição de AGUA-04

O usuário proibiu treinar novos modelos e alterar experimentos. Dois testes antigos executam fitting em memória ou em pasta temporária e, portanto, foram **deselecionados explicitamente**, sem editar seus arquivos:

- tests/test_ml.py::test_scaler_fit_and_early_stopping
- tests/test_ml.py::test_reproduce_training_and_selection_offline

Esses testes passaram em AGUA-03, como registra agua03-test-results.xml, mas não foram repetidos agora. Todos os demais casos anteriores e os 12 novos casos de consolidação foram executados. O teste antigo que chama evaluate verifica somente a recusa de segunda abertura antes de inferir; nenhum registro foi removido ou reaberto.

## Comandos de reprodução offline

Na raiz do repositório, com o ambiente anterior:

```powershell
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/consolidate.py
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/ml.py verify
& analytics/agro-agua/.venv/Scripts/python.exe -m pytest analytics/agro-agua/tests -q -p no:cacheprovider --deselect=analytics/agro-agua/tests/test_ml.py::test_scaler_fit_and_early_stopping --deselect=analytics/agro-agua/tests/test_ml.py::test_reproduce_training_and_selection_offline --junitxml=analytics/agro-agua/docs/agua04-test-results.xml
```

Não executar comandos train ou evaluate de AGUA-03 neste incremento. A reprodução de métricas usa estimativas preservadas. `consolidate.py` não acessa rede e recusa saída dentro de data/, outputs/agua02 ou outputs/agua03. generated_at_utc identifica cada geração do exemplo JSON; os CSVs numéricos são idênticos entre execuções.

Para regenerar a síntese com o runtime local usado nesta entrega:

```powershell
& 'C:/Users/Sucesso/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' analytics/agro-agua/synthesis_pdf.py
pdftoppm -singlefile -scale-to 1600 -png analytics/agro-agua/outputs/agua04/output/pdf/sintese-executiva.pdf analytics/agro-agua/outputs/agua04/output/pdf/sintese-executiva
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/consolidate.py --inventory-only
```

Em outro ambiente, instalar requirements-report.txt em um ambiente separado e usar o mesmo script. Isso é preparação de ambiente, não necessária para verificar os artefatos já entregues; a reprodução de consolidação e métricas é offline. PDF depende de fontes Arial do Windows e Poppler para renderização; portabilidade a outros sistemas não foi testada. A contagem de uma página é validada pelo próprio gerador. Após qualquer regeneração de PDF/preview, atualizar o inventário com --inventory-only.

## Entrega e preservação

outputs/agua04 contém dez artefatos: quatro CSVs, exemplo JSON, auditoria JSON, inventário, PDF, texto extraído e preview PNG. Tamanhos e SHA-256 exatos estão em inventory.json. Relatório final, dicionário, critérios, contrato e evidências estão em docs/agua04-*.md. O código científico e modelos de AGUA-01/02/03 não foram alterados; README recebeu apenas a seção da conclusão atual.

`git diff --check` sem erros de whitespace. .venv, caches e bytecode continuam ignorados. Não houve modificação do portal, backend, Flutter ou outros módulos por AGUA-04. Alterações pré-existentes fora do módulo permanecem preservadas. Nenhum commit, push ou mudança de índice Git foi realizado.
