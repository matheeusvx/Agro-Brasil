# Execução inicial e continuidade

Responsável informado: **Matheus Morelli Rodrigues, RM 562765**, projeto individual. Não há outras pessoas ou atribuições presumidas. Disponibilidade em horas e capacidade ainda precisam ser informadas.

## Sprints aprovadas

- **S1 — 05–11/11/2026:** validar problema com os quatro públicos; fundação técnica, produção, identificação do lote e oferta mínima; iniciar Flutter/dados/Java conforme capacidade.
- **S2 — 12–19/11/2026:** solicitação por instituição ou comprador local, retirada, confirmação e histórico; cooperativa intermediadora opcional; requisitos acadêmicos. Meta de funcionalidades obrigatórias até 17/11, correções/evidências em 18/11, conferência/submissão em 19/11. Flutter vence 19/11 às 23h55 de São Paulo.

O fluxo implementado nesta execução cobre cadastro → identificação do lote → consulta da origem. Oferta → pedido → retirada → recebimento permanece pendente. A inteligência hídrica não substitui a missão de conectar excedentes à demanda.

## Relação com identificadores Trello propostos

Os IDs abaixo vêm do planejamento aprovado, **não foram confirmados como cartões existentes no Trello**. Não há links de cartões, commits ou movimentações inventadas.

| ID proposto | Trabalho relacionado | Estado desta execução |
|---|---|---|
| ARQ-01 | Arquitetura, dados, permissões e fronteiras | Documentado; autorização inicial implementada e testada |
| PROD-01 | Cadastro/listagem de produção e indicadores | Implementado e testado; vídeo e revisão acadêmica ainda pendentes |
| RAST-01 | Identificação e trajetória do lote | Parcial: UUID e origem; QR, transferências e histórico compartilhado pendentes |
| QA-01 | Testes dos fluxos críticos | Testes desta etapa executados; cobertura do produto completo pendente |
| ENT-01 | Documentação e execução | README e documentação técnica; pacotes/vídeos finais pendentes |
| OFER-01 / LOG-01 | Oferta e operação logística | Apenas modelo/contratos, sem implementação |
| VAL-01 / IMP-01 | Validação e benefício social | Não executados; não inferir resultados dos dados fictícios |

## Prioridades e próxima seleção

Separar a natureza (obrigação acadêmica / indispensável MVP / evolução) da prioridade. P0 só para o caminho crítico que desbloqueia a jornada ou prazo; P1 continua necessário no seu prazo; P2 para evolução. Não assumir todos os itens como compromisso simultâneo para uma pessoa.

Próximos passos: validar escopo e horas; revisar esta base; implementar oferta e pedido com reserva concorrente, depois retirada/recebimento idempotentes e histórico compartilhado; desenvolver Flutter e Data Science em janelas explícitas; proteger tempo para Java e entregas independentes.

Validação: buscar conversa exploratória com representantes dos quatro públicos, anonimizar registros e explicitar lacunas. Benefício social: medir kg de excedente com recebimento confirmado, período, origem e denominador; separar demonstração de impacto observado. Cadastro de produção não é alimento recebido nem desperdício evitado.

## Critérios de aceitação desta etapa

- Registro via formulário/API cria produção e lote com origem, em MongoDB real.
- Consulta e indicadores respeitam a organização; cliente não escolhe responsável arbitrário.
- Entrada inválida e acesso indevido são recusados no backend.
- Registro sobrevive a reinício do banco/API no teste de persistência.
- Documentos distinguem código executado, simulações e trabalho planejado.

Definition of Done herdada: critérios verificados, evidência real e instruções reproduzíveis, sem credenciais, falhas impeditivas resolvidas e limitações declaradas. Esta execução não encerra cartões amplos sem atender seus critérios restantes. Revisão/replanejamento devem usar os resultados documentados; nenhuma reunião foi inventada.
