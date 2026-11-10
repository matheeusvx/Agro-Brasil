# Etapa A — resultado (10/11/2026)

Integração de `feat/web-minha-fazenda` e `feat/poo-java` na branch `integracao/etapa-a`
(criada a partir da `main` em `8c2ea75`), com dois merges `--no-ff`. Nenhum conflito.

## Suíte executada na branch integrada

Windows 10, Flutter 3.47.2, JDK 21.0.10, Maven 3.9.16.

| Comando | Resultado |
|---|---|
| `npm.cmd run check` | Sintaxe JavaScript verificada |
| `npm.cmd test` | 27 testes, 0 falhas |
| `npm.cmd run test:integration` | 50 testes, 0 falhas |
| `apps/portal`: `npm.cmd run typecheck` | sem erros |
| `apps/portal`: `npm.cmd test` | 43 testes, 0 falhas |
| `apps/portal`: `npm.cmd run build` | build concluído, 11 páginas |
| `apps/mobile`: `flutter analyze` | No issues found |
| `apps/mobile`: `flutter test` | 126 aprovados (`+126: All tests passed!`) |
| `npm.cmd run build:mobile` | `Built build\web` |
| `npm.cmd run test:mobile:smoke` | Smoke aprovado |
| `modules/java-monitoramento`: `mvn clean verify` | 199 testes, 0 falhas, BUILD SUCCESS |

`npm ci` não foi reexecutado: nenhuma das duas branches alterou dependências ou lockfiles.
Os testes Python de `analytics/agro-agua` não foram executados nesta etapa.

## Observações

- `flutter test` registra 126 testes; `docs/design/logistics/resultado.md` registrava 123 em 09/11.
- `npm run test:integration` regrava `docs/evidencias/incremento-2-transacoes.json` a cada
  execução (novos UUIDs e horários). A alteração gerada nesta etapa foi descartada.
- Limpeza: removidos `simplify_water*.py`, `COMO_USAR.txt`,
  `apps/portal/src/components/REHEARSAL.md` e `apps/mobile/test/failures/` (agora ignorado).
  Só registros históricos em `docs/design/` citam esses nomes.

## Pendente desta etapa

- Push da `main` e primeiro run do CI (`.github/workflows/ci.yml`). O workflow ainda não foi
  executado no GitHub; o job do Flutter roda em Windows por causa dos goldens.
