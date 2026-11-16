# Matriz de conformidade — FIAP Data Science & Analytics GS2026-2

Revisão: 16/11/2026. Autor: **Matheus Morelli Rodrigues, RM 562765**. Referência: `GS2026-2-DSA-FEV(2).pdf`, 6 páginas. O hash do documento fornecido consta de `outputs/entrega/enunciado.json`. A numeração abaixo cobre orientações, seções 1–8 e os nove critérios da seção 9. O documento foi lido como requisito acadêmico; não como autorização para alterar outros módulos, reabrir teste ou publicar resultados.

**Parecer: entrega documental e experimento retrospectivo concluídos; aderência temática parcial.** Não declarar atendimento integral: falta caracterização validada da disponibilidade hídrica atual e alertas de escassez. A permissão de documentar dificuldades de acesso (p. 1) foi usada, sem presumir dispensa desses objetivos. Não há novos dados simulados em substituição à base real. Testes de falha usam cópias de dados reais, identificadas como testes.

A seção 3 apresenta exemplos de fontes, não exige usar todas elas: piezometria e HidroApp foram considerados alternativas do enunciado, não requisitos independentes. Notebook executado e PDF são opções alternativas; esta entrega segue PDF + scripts. Não foi presumida obrigação de notebook, dashboard ou aplicativo operacional.

| ID / origem | Requisito verificado | Estado | Evidência e limite |
|---|---|---|---|
| O1 / p.1 | Individual, dupla ou trio; nomes de todos | Atendido | Projeto individual confirmado pelo autor; nome e RM nos dois PDFs. |
| O2 / p.1 | Uma pessoa realiza a entrega | Ação do aluno | Arquivos preparados; envio ao ambiente FIAP não executado nem autorizado. |
| O3 / p.1 e §8 | PDF de no máximo 10 páginas + scripts, ou notebook executado | Atendido | `outputs/entrega/output/pdf/relatorio-academico.pdf`, 9 páginas; scripts originais e gerador incluídos. Optou-se por PDF; notebook não é requisito adicional. |
| O4 / p.1 | Dados reais, fontes identificáveis e limitações de acesso | Atendido | NASA original + proveniência; aquisição Sabesp/SP Águas com bytes e hashes; nenhuma simulação no estudo. |
| P1 / §1–2 | Pergunta clara e relacionada a risco hídrico na RMSP | Parcial | Relatório p.1: pergunta explícita; Mogi/RMSP e Alto Tietê. O alvo congelado é chuva, não disponibilidade/escassez; vínculo indireto explicitado. |
| P2 / §1–2 | Dados históricos e atuais; reservatórios, precipitação e vazões | Parcial | NASA 2000–2025; Sabesp volume/chuva/vazões 2025 e 01–16/11/2026 recuperados, mas em quarentena (`isValid=false`, janela não confirmada). Sem situação atual validada. |
| P3 / §2–3 | Investigar disponibilidade efetiva, formatos, períodos e uso das fontes | Atendido | `hydrology.py`, `outputs/entrega/hidrologia/quality.json`, respostas/metadados e auditoria final. API v4 localizada no cliente público oficial; não se confunde HTML de catálogo com série utilizável. |
| P4 / §2 | Origem, abrangência, atualização, variáveis, limitações | Atendido | Relatório p.2 e 9; `data/provenance.json`, `docs/fontes-comparacao.md`, metadados de aquisição. Frequência anunciada não é SLA de disponibilidade. |
| D1 / §4 | Carregar/processar em Python, organizar, limpar e verificar qualidade | Atendido | `pipeline.py`; 9.497 dias, 7 variáveis; sem imputação, chaves/datas duplicadas e fill_value controlados. Inventários e suíte offline. |
| D2 / §4 | Critérios para integrar fontes por data, janela, local/identidade | Atendido por não integração fundamentada | NASA LST e sistema agregado Sabesp não foram unidos. E3-097 sem janela e só 184 dias/2000; ausência não vira zero. Sem validação externa implícita. |
| E1 / §4 | Estatística descritiva e EDA com interpretação | Atendido no recorte | `eda.py`, 8 figuras, summary e tabelas. Relatório p.3–4 inclui sazonalidade, dispersão e sequências; sem causalidade ou tendência inferida. |
| I1 / §5 | Indicadores: definição, justificativa, fórmula, unidade, periodicidade, interpretação | Atendido no recorte | Relatório p.4 e 7; dicionários AGUA-02/04. R7/R30/D/total/anomalias e quantis por mês; cobertura explícita. |
| I2 / §5 | Indicadores da disponibilidade/evolução e identificação de escassez | Parcial | Indicadores meteorológicos calculados; sem armazenamento/vazão validados. Não são SPI/SPEI, seca de solo ou confirmação de crise. |
| M1 / §6 | Pelo menos dois modelos ML implementados, justificados e avaliados | Atendido | Ridge + HistGradientBoosting congelados, baselines, 34 atributos, folds expansivos, validação/teste cronológicos; relatório p.5–6 e protocolo anterior. |
| M2 / §6 | Métricas adequadas e consequências distintas dos erros | Atendido com limite | MAE/RMSE/viés/R², bootstrap em blocos, recortes por estação/ano/chuva alta. Relatório p.7 discute falsa tranquilidade por superestimação de chuva. Sem custos/rótulos de escassez para medir falsos negativos de alerta. |
| A1 / §6, alertas | Critérios de criticidade documentados e incerteza | Parcial | Quantis de treino implementados, empates/ausentes testados. Avisos estatísticos históricos; sem validação de criticidade de abastecimento. Os quatro níveis exemplificados pelo enunciado não são algoritmos obrigatórios nem rótulos inventados. |
| A2 / §1 e §6 | Alertas para avaliação humana; restrições decididas por gestores | Atendido | `decision_authorized=false`, sem serviço/notificação; relatório p.7 e síntese. Nenhuma decisão de racionamento automatizada. |
| C1 / §7 | Visualizações adequadas e compreensíveis | Atendido no recorte | Figuras originais com eixos/unidades/fontes, tabela de modelos, legendas e interpretação nos PDFs. Renderização de todas as 10 páginas revisada; detalhes em verificacao-final.md. |
| C2 / §7 | Compreender situação atual, histórico e previsões | Parcial | Histórico e estimativas arquivadas comunicados; snapshot em 31/12/2025. Dados atuais recuperados não foram considerados confiáveis para diagnóstico. Não há previsão atual inventada. |
| C3 / §7 | Conclusões ligadas à pergunta, sem previsões não validadas | Atendido | Vantagem média e fracasso relativo em picos informados; sem extrapolação para segurança hídrica. Teste já exposto na EDA explicitado. |
| C4 / §7 | Recomendações sustentadas por evidências | Atendido | Confirmar qualidade/janela de volume/vazões, validar estações e vintages, novo protocolo prospectivo; relatório p.8. Sem benefícios sociais/econômicos alegados. |
| X1 / §8 | Síntese executiva de uma página com todos os tópicos pedidos | Atendido | PDF 1 página: problema/pergunta, dados, indicadores, resultados, avaliação dos limites de risco e recomendações. |
| V1 / §9 | Definição do problema e qualidade dos dados | Parcial | P1–P4: pergunta clara, fontes rastreáveis; falta disponibilidade validada, abrangência limitada à meteorologia de um ponto. |
| V2 / §9 | Preparação e tratamento | Atendido | D1–D2, testes e hashes. |
| V3 / §9 | Análise exploratória e estatística | Atendido no recorte | E1, indicadores, dependência temporal e ausência de inferência causal explicitadas. |
| V4 / §9 | Indicadores hídricos | Parcial | I1–I2: cálculo correto, mas sem indicador integrado de disponibilidade/escassez. |
| V5 / §9 | Modelagem e avaliação | Atendido no recorte | M1–M2; preservação dos dois modelos e métricas; sem reeleição pelo teste. |
| V6 / §9 | Riscos e alertas | Parcial | A1–A2; critérios históricos claros, sem prova de antecipação de escassez. |
| V7 / §9 | Visualizações gráficas | Atendido no recorte | C1; figuras arquivadas e PDFs revisados. |
| V8 / §9 | Comunicação e recomendações | Atendido | C3–C4 e X1; resultados desfavoráveis e pendências visíveis. |
| V9 / §9 | Reprodução, responsabilidade, vieses, privacidade e supervisão | Atendido com limite | Scripts/dependências fixadas; dados ambientais sem dados pessoais; recorte espacial e cegamento parcial discutidos; supervisão humana. Portabilidade não validada fora do ambiente registrado. |

## Pendências reais para ampliar a investigação

1. Confirmar com a documentação/provedor a semântica de `isValid`, janela de agregação e timezone da Sabesp; não transformar flag false em dado validado por conveniência.
2. Validar séries de volume e vazão, seus identificadores, metadados de operação e mudanças de capacidade; definir integração espacial e temporal explícita.
3. Atualizar indicadores somente com série aprovada e registrar vintage/latência. A data de aquisição não torna o histórico NASA de 2025 uma condição atual.
4. Definir alvo hídrico e critérios/custos com gestores; validar prospectivamente em novo protocolo e período, sem reutilizar o teste congelado para escolher mudanças.
5. O aluno deve enviar os arquivos. Não foi feito push nem entrega na plataforma FIAP.
