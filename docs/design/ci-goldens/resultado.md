# CI — falhas de golden no Flutter (run 42887095025)

Data: 11/11/2026 · Branch: `fix/flutter-goldens-ci`

## Sintoma

Run `42887095025` (commit `099c8ed`, `windows-latest`, Flutter 3.47.2): 112 testes aprovados,
14 falhas de comparação visual em `redesign_test.dart`, `v2_flow_test.dart` e `widget_test.dart`.
Localmente (mesmo Flutter 3.47.2, Windows) os 126 testes passam.

## Investigação

| Hipótese | Resultado |
|---|---|
| Versão do Flutter | Descartada: CI fixa `3.47.2`, igual à local (rev. `d3b14c8769`). |
| Fontes | Descartada: os testes carregam Roboto do próprio repositório (`assets/fonts`) e `MaterialIcons` do SDK fixado. |
| Renderização/runner | Descartada: mesmo SO (Windows) dos goldens. |
| Diferença real de UI | Descartada: a única diferença nos diffs é o texto da hora. |
| **Fuso horário** | **Confirmada.** `dateLabel()` (`apps/mobile/lib/home.dart:18`) usa `DateTime.toLocal()`. As fixtures têm horários UTC (`2026-11-05T12:00:00Z`). Goldens gerados em America/Sao_Paulo exibem `09:00`; o runner GitHub usa UTC e exibe `12:00`. |

Reprodução: substituí temporariamente `toLocal()` por `toUtc()` (simulando o runner, sem
commitar) e rodei os três arquivos: **exatamente 14 falhas**, as mesmas telas (clima, clima-pendencia,
offline, primeiro-acesso nas duas alturas; recebimento, retirada, sem-pendencias, solicitacao em
390x1450; histórico 390x844 e 320-200). Diffs de 0,02–0,12 % restritos aos dígitos da hora.

Evidência (`offline-390x844`): `offline-390x844_isolatedDiff.png` (só os dígitos da hora),
`offline-390x844_testImage.png` (UTC: "05/11 às 12:00") e `offline-390x844_masterImage.png` (golden: "09:00").

## Correção

`.github/workflows/ci.yml`: novo passo no job Flutter que fixa o fuso do runner em
`E. South America Standard Time` (America/Sao_Paulo), fuso oficial do projeto.

Não houve: atualização de goldens, aumento de tolerância, desativação de testes nem mudança no app
(exibir hora local ao produtor é o comportamento correto).

## Validação local

- `flutter analyze`: sem problemas.
- `flutter test`: 126 aprovados.
- Pendente: confirmação no GitHub Actions após push (não feito sem autorização).
