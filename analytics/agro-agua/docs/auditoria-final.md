# Auditoria final AGUA-01 a AGUA-04 — 16/11/2026

Autor: Matheus Morelli Rodrigues, RM 562765. Escopo exclusivo: `analytics/agro-agua/`, branch `main`, sem push. O estado inicial tinha `README.md` da raiz modificado e `.claude/` não versionado; ambos preservados e excluídos dos commits desta sprint. Não havia mudanças iniciais no módulo. Não foram encontrados AGENTS.md aplicáveis na raiz/módulo.

## Diagnóstico e correções

AGUA-01 já continha base NASA real, coleta auditada, limpeza e inventário. AGUA-02 continha EDA, indicadores e desenho temporal. AGUA-03 continha os dois modelos treinados, métricas e recibos de abertura única. AGUA-04 continha contrato retrospectivo, critérios de quantis e síntese antiga, mas não o relatório acadêmico PDF com limite de páginas, identificação completa nem matriz contra o enunciado fornecido nesta sprint.

As declarações anteriores de “concluído” eram relativas à fundamentação meteorológica. Não provavam aderência plena à disponibilidade hídrica na RMSP. A entrega atual corrige essa comunicação no README e nos dois PDFs, sem editar as evidências históricas. Foram acrescentados relatório de 9 páginas, síntese de 1 página, autoria, pesquisa complementar real, matriz completa, scripts de geração/validação e evidências de revisão.

Foi capturado um snapshot SHA-256 inicial de 131 arquivos: tudo em `data/`, `outputs/agua02/`, `outputs/agua03/` e `pipeline.py`, `eda.py`, `ml.py`. A entrega também verifica o inventário anterior AGUA-04. Não se carregou joblib, não se treinou nem se fez nova inferência; o teste original não foi reaberto. `verify` apenas confirma métricas de estimativas já arquivadas. Os dois testes antigos com fitting ficam explicitamente desmarcados; os demais rodam com guarda de fit/predict/load/rede.

## Investigação hidrológica real

Consultados os endpoints indicados no enunciado, em 16/11/2026:

- Sabesp `base-dados`: HTTP 200, aplicação cliente. O JavaScript público indicou `/api/v4/elementos/{id}/dados/{parametro}/diario/{inicio}/{fim}`. Os bytes do cliente, HTML e metadados foram preservados. Não há autenticação nem credenciais utilizadas.
- Metadados oficiais confirmam sistema Alto Tietê (`id=65`) e parâmetros volume útil 684 (%), vazão afluente 691 e natural 690 (m³/s), chuva 1 (mm).
- Oito respostas: quatro variáveis em 2025 e em 01–16/11/2026, total de **1.524 registros**, todos com datas únicas, valores finitos e identidade correta, cobertura calendárica de 100% nas janelas consultadas. Todas as flags retornam `isValid=false`.
- A semântica dessa flag não foi confirmada; não presumir que significa erro físico, nem que seja irrelevante. Timestamps não têm timezone; a janela de acumulação não foi estabelecida. **Séries em quarentena: não foram incorporadas em EDA, modelos, indicadores ou níveis.** A decisão é de qualidade/compatibilidade, não de desempenho do modelo.
- Sala de Situação SP Águas: o cliente Python encontrou erro de verificação de certificado TLS nos links de reservatórios/vazões. Verificação TLS foi preservada. O navegador de pesquisa também teve falha de acesso; resultados indexados não substituem respostas numéricas.
- SSD SP Águas: HTTP 403 com bloqueio de acesso automatizado. Não foi contornado. O catálogo visível na pesquisa anuncia volume, afluência/defluência, chuva e CSV; essa informação não demonstra obtenção de série.
- Banco fluviométrico SP Águas: catálogo HTML retornou 200; não foi promovido a série. Amostra pluviométrica E3-097 anterior continua com 184/366 dias e janela desconhecida.

Registro verificável: `outputs/entrega/hidrologia/raw/` e `quality.json`. `hydrology.py` valida cache/hash, unidades e qualidade, e é offline por padrão. `--online` é só para aquisição explícita de arquivos ausentes; respostas existentes não são substituídas. Atualização futura exige novo protocolo/recorte e diretório, não sobrescrever a entrega.

## Revisão científica

Limpeza e cobertura foram revisadas; nenhum preenchimento foi necessário. Faixas de plausibilidade não equivalem à validação de campo. Sazonalidade, sequências baixas, correlações restritas ao treino e anomalias estão documentadas; não se inferiu causalidade ou tendência.

Ridge: MAE 14,245 mm, ganho 9,88%, R² 0,226. Nas chuvas elevadas: ganho 0,15% e MAE 37,293 mm. Esses resultados foram mantidos, inclusive viés positivo e limitações. Quantis não foram recalibrados. Falsos negativos/positivos de escassez não são mensuráveis sem rótulos e custos de decisão; a discussão explicita o risco de falsa tranquilidade ao superestimar chuva, sem inventar uma matriz de confusão.

O alvo continua precipitação semanal NASA, não volume ou seca no abastecimento. Há aderência parcial à temática ampla; nenhuma integração de reservatórios foi declarada. As limitações atuais não podem ser resolvidas reabrindo o teste ou fabricando classificação de crise. A matriz lista cada exigência e pendência, sem esconder a diferença entre entrega documental pronta e objetivo operacional não demonstrado.

## Preservação no Git

Foi identificada conversão automática `core.autocrlf=true`: muitos arquivos tinham LF no índice Git e CRLF nos bytes locais auditados. Isso podia invalidar inventários em um novo checkout, inclusive do código congelado em Windows. Uma `.gitattributes` restrita ao módulo define `* -text` para preservar bytes. Os artefatos anteriores foram adicionados novamente ao índice com seus bytes locais já auditados, sem reescrever os arquivos, recalcular métricas ou alterar os hashes congelados. A diferença de armazenamento no Git é deliberada; o snapshot de 131 arquivos permanece idêntico. A conferência dos blobs versionados é registrada em `outputs/entrega/git-integrity.json`.
