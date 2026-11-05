# Agro+ Brasil — Design System da home v1

Implementação em `apps/mobile/lib/design.dart` e componentes em `home.dart`. Referências agrícolas fornecidas orientam paisagem discreta, verdes naturais, superfícies leves e legibilidade. Não foram copiadas marcas, métricas, pessoas ou funções dessas referências.

## Tokens

| Papel | Token / valor | Aplicação |
|---|---|---|
| Marca | forest #173E2C | Identificação da propriedade, CTA principal, marca |
| Ação / sucesso | green #285B3E | Ícones e registros confirmados |
| Fundo | cream #F8F7F1; papel #FFFFFF | Superfícies claras; fundo existente do shell preservado |
| Texto | ink #20392C; muted #536453 | Hierarquia principal/secundária |
| Natural | wash #EEF3E7 | Atalhos, acompanhamento e sucesso discreto |
| Atenção | earth #805527; attention #F7EFD9 | Solicitação, avisos e indisponibilidade |
| Erro | danger #912F27; dangerWash #FAEEEA | Falha com recuperação explícita |
| Borda / indisponível | line #DCE4D7; disabled #EBEDE7 | Contorno e ações bloqueadas |
| Tipografia | Roboto local 400/700 | Sem fonte externa ou nova dependência |
| Título | 23 px / 1.2 / 700 | Propriedade, produto da próxima ação |
| Seção | 20 px / 1.25 / 700 | Agrupamentos da rotina |
| Corpo | 15 px / 1.4 | Instrução objetiva |
| Legenda | 13 px / 1.35 | Horário, fonte, informação secundária |
| Rótulo de estado | 11 px / 1.3 / 700, tracking 1.2 | Texto curto acompanhado de ícone, nunca só cor |
| Espaçamento | margem 20; gap 12; seção 24 | Ritmo consistente; ajustes locais de 4/8/16/20/26 |
| Cantos | 22 principal; 16–18 secundário | Sem sombras pesadas ou gradientes |

Os tokens expressam papéis semânticos; não há plano de monetização, gamificação ou indicadores de engajamento na home. `cream` fica disponível para novas superfícies; não foi necessário alterar o tema global dos formulários.

## Componentes e comportamento

- **PropertyHeader:** saudação, nome completo da propriedade e município/UF reais quando disponíveis. Paisagem vetorial pequena, excluída da semântica. Sem imagem grande. Uma propriedade não exibe dropdown sem alternativas; várias propriedades abrem seleção acessível com opção atual destacada.
- **PendingCard:** produto e quantidade primeiro; rótulo descreve o que aconteceu; texto explica o próximo passo. SOLICITADO/ACEITO têm CTA preenchido; RETIRADO tem acompanhamento delineado e explica que o destinatário confirma. Máximo de duas entradas, mantendo a ordenação da API.
- **QuickAction:** quatro atalhos com ícone + texto, foco por contorno, superfície natural e alvo grande. Rastreabilidade usa rota/histórico, nunca ícone de scanner QR. Ações indisponíveis têm fundo cinza, cadeado e callback desativado.
- **FirstProductionCard:** um CTA principal no primeiro acesso. Atalhos ficam em “Outras ações”, expandidos a pedido, preservando acesso sem duplicar a ação primária na abertura.
- **RecentLotCard:** produto, evento, data/hora e acesso ao histórico. Confirmações e outros movimentos têm ícones/marcadores distintos, sempre com texto. Até dois lotes, sem posição GPS ou localização nova.
- **WeatherSummary:** estado indisponível em uma linha secundária; observação válida mantém fonte/horário e o contrato anterior. Não se infere clima da ilustração.
- **AllClearCard / LoadingHome / HomeError:** sucesso discreto, estrutura de carregamento sem dados fictícios e recuperação explícita com “Tentar novamente”.
- **InfoStrip:** aviso de offline/cache com horário e leitura apenas; mesma interface anterior. Mensagem de demonstração na home passa a linha compacta, sempre explícita.
- **AgroNavigationBar:** mesmos cinco destinos e semântica de abas; seleção por forma, ícone e peso tipográfico. Marca do shell ganhou sinal verde próprio. Nenhuma rota foi removida.

## Acessibilidade e responsividade

Grid 2 colunas em telefone e 4 em largura >=580; nomes, estados e instruções quebram linha. Layout sem alturas fixas para texto. Testados 390×844, 390×1450 e 320×844 com escala de texto 200% nos oito estados, incluindo rolagem. O texto climático foi colocado em Expanded após um teste encontrar overflow em fonte ampliada. Alvos Android, labels e contraste passaram pelas guidelines do Flutter; teclado Enter ativa a ação prioritária. Não se oculta texto ampliado nem se fixa escala.

O nome pessoal só é usado se vier disponível e válido; na API atual não vem, portanto há saudação genérica. Não se usa o nome do autor do projeto como se fosse o usuário autenticado.

## Aplicação da skill

Conforme a auditoria: attention hierarchy e remoção de ruído (Dashboards), uma primeira ação útil/TTV (Onboarding), feature discipline e melhoria do núcleo (Product Strategy), menor esforço percebido e seletor apenas quando há escolha (Forms). Não foram aplicadas as sugestões comerciais, estatísticas SaaS, progresso artificial, urgência ou paywalls.
