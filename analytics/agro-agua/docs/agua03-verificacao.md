# AGUA-03 — execução e testes

Executado em **06/11/2026**, America/Sao_Paulo, iniciado aproximadamente às 11h57, dentro do limite de cinco horas. Ambiente CPython 3.13.7/Windows x64. Dados meteorológicos locais: nenhum novo download. Instalação isolada de bibliotecas ML no `.venv`, conforme requirements-ml.txt; dependências anteriores preservadas. `pip check`: No broken requirements found.

## Ordem observada

1. Lidos os quatro documentos exigidos do AGUA-02; auditadas as entradas e preservados inventários anteriores. Criado `agua03-protocolo.md` antes do treino/teste.
2. Testes iniciais de fórmula, purga, atributos passados, scaler de treino, early stopping desativado e abertura exclusiva aprovados antes de treinar.
3. `ml.py train`: 12 fits de CV (4 configurações ×3 folds), dois fits finais exclusivamente nas 7.269 origens de treino. Escolhidas Ridge alpha=100 e HGB de sete folhas. Família Ridge escolhida pelo MAE de validação, inclusive melhor que as baselines.
4. `frozen.json` gravado em **12h02min46s −03:00**, com hashes do código/dados/modelos, parâmetros, versões, escolha e instante. Nenhum modelo foi reajustado depois.
5. `ml.py evaluate`: abertura exclusiva do teste em **12h03min16s −03:00**; os quatro métodos foram executados em um único lote de 1.089 origens. Conclusão e hash dos CSVs registrados. Nenhuma reabertura do teste.
6. `ml.py report`: métricas/intervalos/gráficos gerados somente das estimativas preservadas. Não usa fit ou predict. Interpretação substantiva adicional em `agua03-conclusoes.md`.
7. Suíte completa: **43 passed**, zero falhas e zero testes ignorados; evidência JUnit em `agua03-test-results.xml`. `ml.py verify` também executado: verifica artefatos e recalcula métricas das estimativas arquivadas, sem reavaliar modelos no teste.

## Testes relevantes

Os 36 testes anteriores de aquisição/EDA continuam passando, incluindo igualdade da base com os JSONs originais e reprodução da EDA com hashes idênticos. Sete casos AGUA-03 adicionais verificam:

- Exatidão das partições 7.269/1.089/1.089, alvo t+1…t+7, acumulado passado de 14 dias, 34 atributos sem alvo/baseline e purga em cada fold.
- Alterações em meteorologia futura não afetam atributos presentes nem climatologia do treino (mutações somente em memória).
- StandardScaler ajustado exclusivamente nas 7.269 origens de treino e early_stopping=False no HGB.
- Fórmulas e sinal de métricas/ganhos, denominador zero e recusa de dados não finitos.
- Registro de abertura exclusiva recusa segunda abertura.
- Verificação de entrega com rede/predict/reabertura bloqueados; tentativa de evaluate após conclusão recusa antes de inferir novamente.
- Reprodução completa de treino/CV/seleção em diretório temporário, com rede e abertura de teste bloqueadas: mesmos parâmetros, **mesmos hashes binários dos dois modelos**, e mesmas métricas/previsões de desenvolvimento (tolerância 1e-10). Não há inferência no teste nessa reprodução.

O treino e a reprodução usam uma thread numérica e seed fixa. A portabilidade bit a bit para outras versões/sistemas não foi afirmada; versões e plataforma estão registradas em frozen.json. `joblib` deve carregar apenas artefatos próprios com hash verificado, no ambiente fixado.

## Aviso preservado

Pandas 3.1.1 emite aviso de depreciação de `Series.dt.dayofweek`, utilizado somente no recorte de métricas por alinhamento semanal. A função segue válida nesta versão: **21 avisos, nenhum erro** na suíte. O código congelado foi preservado depois do teste; não foi alterado para silenciar o aviso. Uma atualização futura deve trocar para `day_of_week` em uma nova versão identificada, sem reabrir o teste para seleção.

## Artefatos e QA

`outputs/agua03` contém **18 arquivos, 1.556.470 bytes**: dois modelos joblib, quatro PNGs, métricas/previsões CSV e JSON, relatórios e registros de congelamento/abertura. `inventory.json` lista tamanho e SHA-256 de cada arquivo, exceto o próprio inventário. Exemplos: ridge.joblib 2.020 bytes; hgb.joblib 58.133 bytes; test_predictions.csv 109.919 bytes.

As quatro figuras foram abertas e conferidas visualmente: títulos, unidades e eixos legíveis, diagonal de referência, extremos preservados, períodos identificados e série completa sem seleção de semanas favoráveis. Figura de erros usa limites calculados de todos os métodos, sem truncar caudas. Nenhuma imagem de dashboard foi produzida.

`git diff --check` sem erro de whitespace. `.venv`, caches e bytecode continuam ignorados. Artefatos ML são entregas intencionais, não caches. Alterações de AGUA-03 restritas ao módulo: ml.py, requirements-ml.txt, tests/test_ml.py, documentação agua03, README e outputs/agua03. Os dados/inventários AGUA-01/02 e as alterações pré-existentes no portal/design foram preservados. Nenhuma alteração de backend, portal ou Flutter por esta etapa; nenhum commit, push ou ajuste de índice.

## Reprodução offline

Na raiz do repositório, após instalar requirements-ml.txt no ambiente virtual:

```powershell
# Confirma hashes/métricas salvas e integridade das entregas anteriores:
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/ml.py verify
# Regenera relatórios/figuras dos mesmos CSVs, sem nova previsão:
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/ml.py report
# Reproduz treino/CV/seleção em outra pasta, sem abrir o teste:
& analytics/agro-agua/.venv/Scripts/python.exe analytics/agro-agua/ml.py train --output analytics/agro-agua/outputs/agua03-repro
# Testes, incluindo reprodução offline em diretório temporário:
& analytics/agro-agua/.venv/Scripts/python.exe -m pytest analytics/agro-agua/tests -q -p no:cacheprovider
```

O fluxo original `train → evaluate → report` já foi concluído. Não remover registros para reexecutar evaluate. O teste permanece encerrado; análises subsequentes usam as estimativas preservadas. Para novos experimentos, registrar outra pergunta/protocolo e reservar futura confirmação independente, sem converter o teste conhecido em ferramenta de seleção.
