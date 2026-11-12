# Cooperativas e instituições — primeiro incremento compartilhado

12/11/2026. Base: main acfbf7d. Nenhuma interface Next.js/Flutter implementada.

## Auditoria e decisões

A API já permite instituições solicitarem VENDA ou DOACAO, cancelarem antes da
retirada e confirmarem recebimento integral como destinatárias. Cooperativas
ativas podem ser designadas no aceite e registrar retirada; pedidos, lotes e
eventos já possuem leituras autorizadas por participação. As regras permanecem
em commerce.mjs/commerce-domain.mjs, com transação, idempotência e eventos.

organization-home.mjs adiciona somente dois modelos de leitura, registrados após
a autenticação e autorização compartilhadas em app.mjs. Não cria coleções, não
altera saldos, aceite ou recebimento. Um índice em carrierOrganizationId e data/ID
apoia o escopo da cooperativa; a instituição reutiliza o índice do solicitante.

## Modelos de leitura

[Contrato e exemplo fictício](../requisitos/api.md). Cada home faz uma agregação
com filtro da organização antes de $facet: totais por estado, página de operações
e até três prioridades. Snapshot evita discrepância entre as três partes na mesma
consulta. A página não limita os totais. Sem cache, fallback ou captura de erro
para fabricar zeros. Uma projeção explícita omite dados pessoais e de terceiros.

## Permissões

| Perfil                               | Consulta da própria home                     | Mutações existentes                                                 |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------- |
| Cooperativa ADMIN/EDITOR             | Somente remessas designadas                  | Retirada se designada, conforme estado                              |
| Instituição ADMIN/EDITOR             | Somente pedidos solicitados pela organização | Solicitação, cancelamento permitido e recebimento como destinatária |
| LEITOR de cada tipo                  | Mesmo escopo, canWrite=false                 | Nenhuma                                                             |
| Produtor/comprador local             | 403 nas novas homes                          | Regras anteriores preservadas                                       |
| Usuário inativo/token inválido       | 401                                          | Negadas                                                             |
| Vínculo revogado/organização inativa | 403                                          | Negadas                                                             |

ADMIN não é administrador global. Cada requisição usa o vínculo da organização
selecionada, inclusive para usuário com múltiplos vínculos. As homes não fornecem
IDs privados dos demais participantes. IDs de pedido/remessa permitem usar os
comandos existentes, que continuam sendo a autoridade de autorização.

## Limites

- Sem necessidades institucionais, pagamentos, compra própria por cooperativas,
  consolidação de lotes, GPS ou autenticação de produção.
- Filtros opcionais de ofertas avaliados e adiados: a consulta comercial permanece
  vigente, com paginação e exclusão de rascunho/vencida/sem saldo no escopo público.
- Sem teste de carga, cursor ou consulta histórica. Offset máximo 100000 e página
  máxima 100. Facet agrega todo o escopo; organizações muito grandes exigirão
  avaliação de plano/custo e limites MongoDB antes de implantação real.
- Quantidades descrevem pedidos por estado; cancelados não são recebimentos.
  Dados demonstrativos não medem impacto social real.

## Validação executada

MongoDB 8.0.16 real, WiredTiger, replica set de um nó, portas livres, banco
homes_test e diretório .data/homes-UUID. Nenhum dado do banco local foi usado.
Fixtures incluem duas cooperativas e duas instituições, compartilhando um usuário
com múltiplos vínculos para verificar a seleção por requisição: organização 1
vê apenas seus cinco pedidos/quatro remessas, organização 2 somente sua operação
de 9 kg. Valores de 1,25 kg por estado conferidos contra a resposta, com página
limitada a um item sem reduzir os totais.

Testes cobrem vazio, paginação, prioridades, projeção, tipos incorretos, ADMIN,
EDITOR e LEITOR, revogação, organização inativa e falha de consulta retornando 500
sem dados ou detalhes internos. Uma quantidade inconsistente também resulta em 500. Unitários verificam projeção e filtro anterior à agregação.

Resultados: npm run check aprovado; npm test: 32 aprovados. Integração completa
inicial: 57 aprovados; após acrescentar o caso EDITOR/falha de consulta, suíte
específica: 7 aprovados. Execução final completa: **58 testes aprovados, zero falhas, cancelados ou ignorados** (aproximadamente 9,1 s); log local ignorado em .data/homes-final-integration.log.
A regressão inclui os fluxos existentes, concorrência, idempotência, rollback,
persistência/reinício, Minha Fazenda e produtor. Suites de interfaces, Java e
Python não foram executadas: não houve alterações nesses módulos.

O relatório incremento-2-transacoes.json gerado pela regressão é restaurado ao
conteúdo anterior para evitar versionar novos IDs/horários sem necessidade.
README.md tinha alteração preparada antes desta tarefa, preservada fora do commit.

## Revisão do PR #3 — quantidades individuais

A leitura valida cada quantityGrams do escopo antes da soma: somente BSON
int/long/double, positivo, inteiro e até 1e12 gramas (limite de 1e9 kg do domínio).
Decimal128, ausente, null, strings, arrays, objetos, booleanos, frações, NaN,
infinidades e valores fora do limite são recusados. A condição numérica protege
$trunc contra tipos incompatíveis. Uma faceta detecta qualquer documento inválido
antes de serializar a resposta, mesmo fora da página e das prioridades; nada é
silenciosamente descartado. A validação de segurança do total permanece ativa.

Testes novos verificam 15 cenários inválidos nas duas homes, incluindo negativos
compensados por positivos e duas frações somando inteiro. Também confirmam
limites válidos de 1 e 1e12 gramas, resposta 500 sanitizada/no-store, ausência de
indicadores e preservação da consulta de outra organização sem dados corrompidos.

Validação nesta revisão: check aprovado; 32 unitários aprovados. Primeira execução
completa: 72 aprovados/2 falhas contabilizadas (um subteste e seu pai), no teste
preexistente de persistência após reinício da API/MongoDB, com data indefinido.
Sem alterar esse teste, a segunda execução completa aprovou os 74 testes, zero
falhas/ignorados/cancelados. A causa da primeira falha não foi determinada.
Logs locais ignorados: .data/pr3-check.log, pr3-unit.log, pr3-integration.log e
pr3-integration-retry.log. Nenhuma interface ou regra de mutação foi alterada.
