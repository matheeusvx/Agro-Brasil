# Resultado do primeiro ciclo de redesign

## Escopo e referência

Home do pequeno produtor rural e identidade do shell compartilhado por suas cinco abas. Nenhum outro perfil redesenhado. Baseline local: `e4cfcc7cc9414abd2e5f82b4d582b1a4b70218ce`, tag `baseline/home-pre-redesign`. A skill já instalada foi lida e aplicada sem reinstalação. [Auditoria](auditoria-home.md), [Design System](design-system.md), [comparação visual](comparacao.md).

## O que melhorou

Identificação da propriedade integrada a um cartão de marca; instrução de ação destacada pelo produto e CTA; acompanhamento com menor peso; primeiro acesso sem CTA duplicado na abertura; seletor somente quando há alternativas; quatro atalhos com foco/estado desativado; histórico mais legível por evento/data/status; erro, carregamento e offline próprios. O ícone de QR foi substituído por rota/histórico sem acrescentar leitor inexistente.

O diagnóstico não se limitou à paleta: composição, densidade, hierarquia tipográfica, microcopy, primeira ação, interação por teclado e comportamento do primeiro acesso foram alterados. Nenhum nome, agenda de coleta, resultado meteorológico ou indicador foi inventado. As referências anexadas serviram de direção estética.

## Arquivos de implementação

- `apps/mobile/lib/design.dart` — tokens semânticos e navegação.
- `apps/mobile/lib/home.dart` — componentes de propriedade, ações, pendências, histórico e estados; helpers e interfaces reutilizados.
- `apps/mobile/lib/main.dart` — marca e navegação do shell; rotas e funções de autenticação preservadas.
- `apps/mobile/test/redesign_test.dart` — oito comparações em 390×844.
- `apps/mobile/test/design_behavior_test.dart` — teclado, primeira ação, primeiro acesso, leitura/offline, saudação, troca de propriedade e oito estados em 320/texto 200%.
- Goldens existentes atualizados e imagens anteriores preservadas em `docs/design/antes/`; documentação e logs nesta pasta.

`data.dart`, `tasks.dart`, dependências/pubspec/lockfile e todo `services/api` ficaram idênticos ao baseline (verificação por git diff). Não houve alteração de contrato, regra comercial, rastreabilidade, reserva, idempotência ou autorização. Nenhuma nova dependência foi instalada para estética.

## Verificações reais

| Verificação | Resultado |
|---|---|
| flutter analyze | No issues found |
| flutter test, sem atualizar goldens | 38 testes aprovados, zero falhas |
| Dart HTTP real, somente leitura | 1 teste aprovado, catálogo/home/clima/eventos da API local |
| Backend de integração | 32 casos aprovados; runner contabiliza 34 com os dois agrupadores |
| flutter build web | Compilação concluída, sem publicar |
| Viewports | Oito estados em 390×844 e 390×1450; oito estados em 320×844/texto 200% com rolagem sem overflow |
| Acessibilidade | Labels, contraste e alvos Android; Enter na ação principal; semântica no navegador |
| Navegador local | Login demo, home com propriedade real da sessão e nenhuma pendência; atalho Rastrear lote → lote existente → histórico preservado |

Logs: `flutter-analyze.txt`, `flutter-test.txt`, `flutter-build.txt`, `testes-backend.txt`, `teste-api-real.txt`; consultas reais em `api-real.json`. A suíte backend usa sua base isolada; resultados anteriores foram preservados, e o registro desta execução está em `transacoes-verificadas.json`.

Em protótipos de teste foram detectados e corrigidos excesso de texto vertical, quebra de linha no clima em fonte ampliada e teste de rolagem que buscava item ainda não construído pela lista. As falhas não foram tratadas como aprovações. A última suíte passou sem regravar snapshots.

## Limitações

Ainda não houve avaliação com pequenos produtores rurais reais ou teste com leitor de tela físico. As capturas dos oito cenários são fixtures identificadas, não dados inseridos na API. Clima real depende das mesmas credenciais/coordenadas pendentes; saudação genérica porque a API não fornece nome pessoal. Offline é a consulta do cache existente, sem escrita ou fila; os atalhos das listas completas ficam bloqueados, e os lotes recentes permitem consultar o último evento salvo.

Android/iOS não foram recompilados neste ciclo; a validação usa Flutter widgets e build web. Em 200% de texto a rolagem aumenta deliberadamente, sem reduzir fonte. Os atalhos e o histórico abaixo da dobra continuam acessíveis por rolagem.

## Recomendações para o próximo ciclo

Validar a compreensão de “solicitação”, “retirada” e “recebimento” com pequenos produtores rurais; medir tempo até encontrar a próxima ação sem afirmar melhoria estatística agora. Depois aplicar os tokens aos formulários de produção/oferta, revisar feedback de envio e confirmação, e melhorar a leitura das listas de pedidos. Manter os outros três perfis fora deste ciclo até essa validação.
