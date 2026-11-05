# Critérios de aceitação para o redesign UI/UX

## Mínimos não negociáveis

- [ ] Codex visualizou e analisou TODOS os cinco PNGs de `docs/design/referencias/` e registrou correspondência entre cada referência e decisão autoral.
- [ ] A tela do Android mudou PERCEPTIVELMENTE: composição, ilustrações autorais, proporções, ícones, tipografia, apresentação do clima. Não basta cor ou borda.
- [ ] Home de produtor respeita hierarquia operacional validada; pendência e CTA visíveis antes de qualquer excesso decorativo.
- [ ] Clima apresenta temperatura, condição, localidade e observação clara, sem logo gigante; crédito OpenWeather correto, discreto, legível, acessível e linkado, conforme licença.
- [ ] Mudança de propriedade altera a informação climática; sem dado válido, não há clima inventado.
- [ ] Sem porcentagem de chuva futura sem API Forecast; sem umidade do solo simulada.
- [ ] Todos os estados: primeiro acesso, solicitação, retirada, recebimento, sem pendências, carregamento, erro, offline.
- [ ] Regras de permissão preservadas. Consultas offline com cache continuam acessíveis; mutações exigem backend.
- [ ] Componentes compartilhados e tokens centralizados, documentados, reutilizados nas telas existentes.
- [ ] Fluxos de Produção, Ofertas, Pedidos, Histórico e Perfil intactos, em Android e Web.
- [ ] Sem overflow em 320 de largura ou com texto a 200%; toque >=48 dp; contraste adequado; navegação por teclado quando aplicável.
- [ ] `flutter analyze`, testes Flutter, smoke Web e backend executados. Falhas relatadas com causa e estado.
- [ ] Screenshots reais do Android em tela usual (não só viewport 390x1450), incluindo zoom e prova de interação.
- [ ] Comparação lado a lado com captura anterior + comentários objetivos, sem aprovar automaticamente todos os goldens.
- [ ] Nenhuma referência PNG publicada como asset do app ou adicionada por acidente ao GitHub.
- [ ] Não realizar commits/push automático sem conferir diff e aprovação explícita.

## Perguntas de teste de uso

1. Em cinco segundos, o pequeno produtor sabe em que propriedade está e qual ação precisa fazer?
2. A informação meteorológica responde claramente 'onde está a propriedade?' e 'como está o tempo?' sem chamar mais atenção que a pendência?
3. Com dado climático ausente, a interface continua visualmente equilibrada?
4. O usuário consegue cadastrar uma produção sem entender os termos internos da API?
5. 'Rastrear lote' não promete GPS e apresenta última movimentação confirmada?
6. O projeto parece uma identidade visual própria agrícola ou apenas um conjunto de templates Material?
7. O usuário consegue utilizar as funções com o telefone no bolso/ambiente rural, dedos e conexão instável?
