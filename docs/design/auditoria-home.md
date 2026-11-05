# Auditoria pré-redesign — 05/11/2026

Referência Git preservada **antes de alterar a UI**: commit `e4cfcc7cc9414abd2e5f82b4d582b1a4b70218ce`, tag `baseline/home-pre-redesign`. Era um repositório sem commits; foi criado um checkpoint local dos arquivos existentes, sem .env real, tokens, caches ou builds. Skill instalada mantida sem reinstalação.

## Inspeção

Lidos `home.dart`, `main.dart`, `data.dart`, `demo.dart`, testes de widgets e contratos da home. Examinadas visualmente as oito capturas anteriores. Todas foram copiadas sem alterações para `antes/` (390×1450). Renderizadas adicionalmente as oito versões em 390×844 pelo Flutter antes das mudanças, com fonte/ícones reais. [Captura inicial](antes/solicitacao-390x844.png).

## Diagnóstico

- Banner demo, marca em appbar, saudação, subtítulo e seletor de propriedade consomem a parte superior. A primeira ação aparece aproximadamente em y=480; quatro atalhos ficam parcialmente abaixo da dobra em 844 px.
- Moldura de formulário no seletor e grid de botões uniformes remetem ao Material padrão. A pequena planta decorativa isolada não estabelece uma linguagem agrícola consistente.
- SOLICITADO e RETIRADO recebem botões delineados semelhantes, apesar de o segundo ser acompanhamento do destinatário. Falta explicar a próxima ação com concisão.
- Primeiro acesso contém CTA grande de cadastro e repete o mesmo CTA no grid, disputando atenção.
- Ícone de QR em “Rastrear lote” sugere leitura ainda inexistente. Lista recente repete avatar de planta e não distingue estados ou sequência do histórico.
- Offline avisa bloqueio em texto, mas atalhos usam `home.canWrite` salvo e parecem ativos. O formulário impede gravação, porém a expectativa visual é incorreta.
- Carregamento tem muito vazio e uma barra genérica; erro repete instrução e título. Clima indisponível mantém peso semelhante a informações úteis.
- Positivos preservados: fonte local, contraste, labels, limite de duas pendências/lotes, filtro por propriedade, cache segregado, autorização no backend e navegação existente.

## Componentes reaproveitados

`InfoStrip`, `WeatherSummary`, `PendingCard`, `QuickAction`, `FieldSketch`, helpers de eventos/data, `HomeController`, `Repository`, formulários e rotas do AppShell. Será extraído um conjunto de tokens e uma apresentação de histórico/propriedade, sem alterar regras ou backend.

## Aplicação contextual da skill

Skill: [revenue-centric-design](../../.agents/skills/revenue-centric-design/SKILL.md). Quatro módulos lidos; aplicação restrita à utilidade para pequenos produtores rurais:

| Módulo / princípio | Aplicação nesta home |
|---|---|
| Dashboards — remover informação para abrir espaço à direção; painel acionável | Próxima tarefa antes dos atalhos; estado e produto em destaque; nenhum gráfico/KPI novo. [Fonte](https://x.com/richardrx/status/2075623473565647202) |
| Onboarding — estado vazio orientado a uma única primeira ação / menor time-to-value | Um CTA principal para a primeira produção; cadastro no grid vira acesso secundário. Sem progresso fictício. [Fonte](https://x.com/richardrx/status/2054283657934758021) |
| Product Strategy — attention hierarchy e fazer o mesmo melhor | Hierarquia por ação/acompanhamento, limite de conteúdo mantido, nenhum recurso novo ou outro perfil. [Fonte](https://x.com/richardrx/status/2039399756452057159) |
| Checkout & Forms — esforço percebido e redução de campos/dropdowns desnecessários | Identificação de propriedade como cartão; se houver somente uma, não mostrar seletor fictício. Com várias, seleção acessível e explícita. Preservar campos/validações dos formulários. [Fonte](https://x.com/richardrx/status/2003495704849760387) |

Os princípios orientam hipóteses de design, não resultados de pesquisa com usuários. Não serão usados paywalls, urgência falsa, monetização, métricas de conversão SaaS, gamificação ou progresso inventado.

## Plano de verificação

Oito estados, 390×844 e 390×1450; largura 320; texto 200%; targets, labels, contraste, teclado, rolagem e próxima ação visível. Guardar antes/depois e revisar imagens antes de aprovar novos goldens. Nome pessoal apenas se houver valor válido disponível; os contratos atuais não retornam nome pessoal na home, portanto a saudação será genérica. Backend, contratos, idempotência e autorização permanecem intactos.
