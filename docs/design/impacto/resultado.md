# Etapa B — indicador de impacto: backend

Implementado em 11/11/2026 na branch `feat/impacto-backend`, criada da `main` atualizada por `git fetch origin main` (fast-forward sem alterações pendentes).

## Entrega

`GET /api/v1/properties/:id/excess-impact`: contrato v1 e exemplo fictício em `docs/requisitos/api.md`. Funil de destinação, saldos atuais e publicado/recebido por venda e doação. Autenticação e propriedade reutilizam os mecanismos existentes; ADMIN, EDITOR e LEITOR do pequeno produtor podem consultar. Sem alterações Flutter/Next.js, esquemas, coleções, índices ou regras comerciais.

Uma agregação com snapshot percorre somente as produções da propriedade/organização, associa a oferta pelo índice único do lote e soma inteiros. As ofertas publicadas são a autoridade dos saldos. Não soma pedidos nem eventos; cancelamentos já devolvem as reservas pelo domínio existente. Aplicação recebe somente uma linha agregada e converte gramas para kg na serialização. Reconciliação e limite inteiro seguro são conferidos antes de responder.

## Evidências executadas

- `npm.cmd run check`: sintaxe JavaScript verificada.
- `npm.cmd test`: 30 testes aprovados, zero falhas/ignorados.
- `npm.cmd run test:integration`: 51 testes aprovados, zero falhas/ignorados, MongoDB replica set real.
- Integração comercial existente verifica o indicador durante rascunho, publicação, reserva, cancelamento, retirada e recebimento. Compara aceito líquido, retirado e recebido com saldos persistidos, e reconcilia em gramas após as operações.
- Cenário adicional verifica venda fracionária recebida, doação, saldo vencido, outra propriedade com oferta publicada, propriedade alheia, ausência de dados, mais de 100 produções, ADMIN/EDITOR/LEITOR, vínculo inativo, UUID inválido, ausência de token, no-store e ausência de alteração nas ofertas pela leitura.
- Unitários verificam zeros, contrato, conversão, funil e recusa de inconsistência, negativos e totais sem precisão inteira segura.

Logs locais não versionados: `.data/impact-check.log`, `.data/impact-unit.log`, `.data/impact-integration.log`. O relatório histórico `incremento-2-transacoes.json`, regravado pela suíte, foi restaurado para evitar IDs e horários novos sem relação com esta entrega.

## Limitações

Requer MongoDB com suporte a snapshot (replica set já usado pela plataforma). `asOf` é o corte UTC para os prazos capturado antes da agregação, não uma consulta histórica; o snapshot contém os dados confirmados no início da leitura MongoDB. Totais além de Number.MAX_SAFE_INTEGER gramas falham explicitamente. Saldo vencido não prova desperdício; não há estimativa financeira/social, resgate ou recebimento parcial. Sem teste de carga; usa os índices existentes e não executa consultas N+1 na aplicação.
