# Agro+ Água — Monitoramento territorial de recursos hídricos

## 1. Apresentação do Agro+ Água

O Agro+ Água é o módulo Java do projeto Agro+ Brasil, desenvolvido para a Global Solution de Programação Orientada a Objetos da FIAP, no tema Territory Predictive Insights / CitizenTech. A aplicação de console registra medições simuladas, mantém históricos em H2, executa duas estratégias de previsão e persiste alertas fundamentados nas leituras e nos limiares configurados.

O módulo está em `modules/java-monitoramento/`, na branch `main`. É independente dos demais componentes do Agro+ Brasil: não integra Flutter, portal, Express, MongoDB ou análises Python.

**Natureza da entrega:** demonstração acadêmica, sem validação operacional ou hidráulica em campo. **Resultado automatizado consolidado: 199 testes aprovados, sem falhas, erros ou testes ignorados.** Esse resultado não comprova vazamentos nem desperdício real.

## 2. Problema e público beneficiado

A proposta aborda a dificuldade de organizar registros de consumo e distribuição de água em contextos rurais. Um histórico por ponto de observação permite examinar mudanças entre amostras; alertas explicados podem destacar situações que merecem investigação, sem depender apenas de leituras isoladas.

- **Pequenos produtores rurais:** poderiam consultar o comportamento local do consumo e investigar aumentos em relação aos limites definidos para sua instalação.
- **Gestores comunitários:** poderiam utilizar registros e justificativas para organizar verificações e discutir prioridades de acompanhamento do abastecimento.
- **Responsáveis por sistemas coletivos de abastecimento:** poderiam examinar variações de vazão e pressão e relacioná-las ao contexto de operação antes de decidir por uma inspeção.
- **Comunidades dependentes da gestão eficiente dos recursos hídricos:** poderiam se beneficiar de informações organizadas e decisões humanas mais bem documentadas sobre o uso da água.

Essas são possibilidades de aplicação do recorte escolhido, não benefícios já medidos ou resultados de entrevistas. O sistema atual utiliza dados simulados e não substitui instrumentos, procedimentos ou profissionais responsáveis pelo abastecimento.

## 3. Tecnologias e arquitetura

| Tecnologia | Uso e versão configurada |
| --- | --- |
| Java | JDK 21; ambiente de validação: Oracle JDK 21.0.10. |
| Maven | Construção e execução; versão utilizada na validação: 3.9.16. |
| H2 / JDBC | H2 2.4.240, embarcado em arquivo, sem ORM. |
| JUnit 5 | JUnit Jupiter 5.11.4; testes Arrange, Act, Assert. |
| Mockito | 5.14.2; simulação dos DAOs na camada de monitoramento. |
| Plugins Maven | Compiler 3.13.0, Surefire 3.5.2 e Exec 3.5.0. |

Não há Spring Boot, API REST, interface gráfica, pool de conexões ou dependência de servidor de banco. O menu delega regras aos serviços e ao domínio. O monitoramento consulta o DAO, executa a estratégia abstrata e grava alertas quando necessário.

### Classes e responsabilidades

Arquivos em `src/main/java/br/com/agromais/agua/`, nos pacotes `dominio`, `excecao`, `persistencia` e `servico`.

| Elemento | Responsabilidade |
| --- | --- |
| `ComponenteTerritorial` | Classe abstrata com id, nome, região, status e contrato `verificarStatus()`. |
| `PontoMonitoramento` | Herda o componente e verifica a disponibilidade de seus sensores. Copia a lista recebida e impede ids duplicados no ponto. |
| `Sensor` | Interface para identificação, tipo, leitura, funcionamento e origem demonstrativa. |
| `SensorConsumo` | Simula volume consumido na janela fixa de um minuto, em L. |
| `SensorVazao` | Simula vazão instantânea em L/min. |
| `SensorPressao` | Simula pressão instantânea em bar. |
| `DadosTerritorio` | Encapsula região, código e quatro limiares; alterações autorizadas. O console persiste a configuração pelo DAO. |
| `Medicao` | Leitura imutável com sensor, id, tipo, valor, unidade, data/hora e indicação de demonstração. Copia metadados para preservar o registro. |
| `TipoSensor` | Enum com unidades e faixas admissíveis por grandeza. |
| `StatusComponente` | Enum: `SEM_SENSORES`, `OPERACIONAL`, `FONTE_INDISPONIVEL`. |
| `Validacao` | Utilitário interno para texto obrigatório e números finitos dentro de faixa. |
| `DadosInvalidosException` | Dados inválidos: texto ausente, medição incompatível, limiar inválido e configuração incoerente. |
| `FonteIndisponivelException` | Sensor desativado ou falha do gerador; mantém a causa original quando existente. |
| `Alerta` / `NivelAlerta` | Registro imutável com sensor, nível ATENCAO/ALERTA/CRITICO, previsão, limiar, unidade, justificativa e horário. |
| `SensorHistorico` | Reconstrói a identidade do sensor sem gerador ativo. Impede obter novas leituras a partir do histórico. |
| `BancoH2` | Cria diretórios, abre conexões de arquivo e inicializa tabelas e índices sem apagar registros. |
| `MedicaoDAO` | Insere medições e consulta o histórico de um sensor em ordem cronológica. |
| `AlertaDAO` | Insere alertas e consulta por sensor ou lista todos em ordem cronológica. |
| `PersistenciaException` | Traduz falha de banco ou registro armazenado inválido com mensagem contextual e causa. |
| `EstrategiaPrevisao` | Base abstrata: janela, histórico mínimo e validação comum antes dos cálculos. |
| `PrevisaoMediaMovel` / `PrevisaoComparacao` | Sobrescrevem `prever()` com cálculos distintos e inicializam a base com `super(...)`. |
| `ResultadoPrevisao` | Record validado: sensor histórico, valor, unidade e explicação. |
| `TipoPrevisao` / `FabricaPrevisao` | Configuração e criação centralizada da estratégia concreta. |
| `ServicoMonitoramento` | Consulta o DAO, executa a estratégia abstrata, classifica e grava alertas. |
| `ResultadoMonitoramento` | Record com a previsão e `Optional<Alerta>` para distinguir resultado normal sem alerta de uma falha. |
| `SistemaMonitoramento` | Loop Scanner, apresentação e captura dos erros de aplicação. |
| `HistoricoMedicoes` | Validação de consistência compartilhada entre coleta e estratégias, extraída da base sem mudar as regras. |
| `ColetaSimulada` | Gera amostras separadas por um minuto lógico e grava o lote em transação. |
| `ChaveAnalise` | Calcula SHA-256 do contexto da análise para idempotência. |
| `DadosTerritorioDAO` | Carrega e salva região e limiares; não persiste o código de acesso. |

## 4. Conceitos de Programação Orientada a Objetos aplicados

- **Abstração:** `ComponenteTerritorial` define o contrato comum; `Sensor` descreve uma fonte sem expor seu gerador.
- **Herança:** `PontoMonitoramento` usa `super(...)` para inicializar a identidade territorial e sobrescreve `verificarStatus()`.
- **Polimorfismo:** o ponto e `Medicao.capturar(Sensor)` trabalham com a interface; não há `instanceof` para selecionar sensores. Os testes também verificam o ponto através de uma referência `ComponenteTerritorial`.
- **Encapsulamento:** campos privados, identidade final, lista de sensores não modificável, medições sem setters e limiares alteráveis somente por método autorizado. A lista protege sua estrutura, não congela o estado interno de implementações futuras de `Sensor`.
- **Exceções efetivas:** os construtores, a alteração de limiares e a leitura lançam as exceções personalizadas. Fonte indisponível não vira medição zero. Um valor fora de faixa continua sendo erro de dados, mesmo se veio do gerador. As falhas do gerador e da persistência são traduzidas com mensagem e causa; não há captura vazia.

O código de acesso é comparado exatamente, sem getter e sem exposição em mensagens. Código incorreto lança `SecurityException`, pois é falha de autorização, não erro numérico ou de fonte. É uma proteção didática em memória, não autenticação de produção. Todos os limiares são validados antes de qualquer atribuição, inclusive no construtor; uma tentativa inválida preserva o conjunto anterior.

Não há hierarquia extra entre os sensores: cada implementação é curta e direta. O gerador `RandomGenerator` e a disponibilidade podem ser fornecidos no construtor, permitindo sequências com semente fixa e simulação de falhas. O construtor simples cria uma fonte ativa. A disponibilidade representa a configuração da simulação; ela não é um diagnóstico físico nem testa antecipadamente o gerador.

### Factory e execução polimórfica

`FabricaPrevisao` implementa **Simple Factory**, centralizando em um único `switch` a criação por `TipoPrevisao`. Foi escolhida porque o chamador conhece a configuração desejada e não precisa conhecer construtores concretos nem repetir a escolha em vários locais. Não se trata de uma hierarquia de Factory Method.

O construtor configurado de `ServicoMonitoramento` chama a Factory de verdade. O campo e a execução do serviço usam somente `EstrategiaPrevisao` e `estrategia.prever(...)`, sem `instanceof` ou seleção por classe. Cada filha chama `super(tamanhoJanela, quantidadeJanelas)`, compartilha os invariantes da base e sobrescreve o cálculo. Um segundo construtor aceita a abstração pronta por injeção. Não foi necessário remover `final` dos DAOs para usar Mockito.

## 5. Persistência e funcionamento das previsões

### Unidades e faixas

| Tipo | Leituras geradas por chamada | Faixa aceita em uma medição |
| --- | --- | --- |
| Consumo | 20 inclusivo a 120 exclusivo L por janela de um minuto | 0 a 200 L, inclusivos |
| Vazão | 5 inclusivo a 80 exclusivo L/min | 0 a 200 L/min, inclusivos |
| Pressão | 1 inclusivo a 4 exclusivo bar | 0 a 10 bar, inclusivos |

As faixas são hipóteses didáticas plausíveis para um pequeno ponto coletivo, não limites de engenharia validados em campo. A faixa aceita é maior que a faixa normalmente gerada para permitir leituras anormais futuras. Zero pode ser uma leitura válida; falha da fonte deve lançar exceção. `NaN`, infinitos e negativos são rejeitados.

Consumo é volume da janela de um minuto, não hidrômetro acumulado. Seu limiar usa L na mesma janela; vazão usa L/min e pressão usa bar. Limites de consumo e vazão devem ser positivos e não exceder 200; pressão deve obedecer `0 <= mínima < máxima <= 10`. Valores que ultrapassem limiares configurados ainda podem ser medições válidas: a classificação usa os limiares de `DadosTerritorio`, sem confundir faixa válida da grandeza com limite de atenção.

Uma chamada ao sensor representa um valor simulado. A coleta do console atribui a cada amostra um minuto lógico explícito, sem temporizador, espera real ou agendador; não confunde chamadas instantâneas com passagem de tempo físico. Consumo, vazão e pressão são sorteados independentemente; não se deve inferir balanço hidráulico entre eles. As três implementações simuladas retornam `isDemonstracao() == true`, propagado à medição; `SensorHistorico` preserva a origem armazenada. `OffsetDateTime` guarda também o deslocamento UTC. A captura registra o horário após a leitura. O construtor permite horário explícito para testes e reconstrução pelo DAO.

O status operacional do ponto expressa somente disponibilidade: lista vazia resulta em `SEM_SENSORES`; qualquer fonte configurada como inativa resulta em `FONTE_INDISPONIVEL`; caso contrário, `OPERACIONAL`. Não usa limiares nem classifica desperdício. `getStatus()` retorna a última verificação; `verificarStatus()` a atualiza.

### Banco em arquivo e JDBC

`new BancoH2()` usa o caminho-base `.data/agro-agua`, relativo ao diretório de execução, criando `.data/agro-agua.mv.db`. Para evitar depender do diretório atual, usar `new BancoH2(Path.of("caminho/absoluto/agro-agua"))`. O argumento é um caminho-base sem `.mv.db`, não uma URL JDBC. Diretórios ausentes são criados. `;` e caracteres de controle são rejeitados para não permitir opções JDBC no caminho.

O banco é local, embarcado, com usuário `sa` e senha vazia para esta demonstração acadêmica. Não há servidor, console H2 ou conexão externa. `BancoH2` não mantém recursos abertos: cada DAO abre e fecha sua própria conexão. Ao fechar a última conexão, o H2 encerra o banco e mantém o arquivo. Para reabrir, fornecer exatamente o mesmo caminho.

A inicialização usa `CREATE TABLE/INDEX IF NOT EXISTS` e `ALTER TABLE alerta ADD COLUMN IF NOT EXISTS` para a chave de deduplicação. Não usa `DROP`, `TRUNCATE`, recriação de schema, carga de demonstração ou limpeza automática. O comando Maven `clean` exclui `target/`, sem afetar `.data/`. A migração aditiva implementada mantém todas as linhas antigas. Alterações futuras no formato das tabelas também precisarão de migração explícita; `CREATE TABLE IF NOT EXISTS` sozinho não migra uma tabela já existente.

#### Tabelas

Todos os campos abaixo são `NOT NULL`, exceto `alerta.chave_idempotencia`, que aceita nulos para os registros legados/manuais. As chaves de `medicao` e `alerta` são `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`.

| Tabela | Colunas além de `id` |
| --- | --- |
| `medicao` | `sensor_id VARCHAR`, `tipo VARCHAR`, `demonstracao BOOLEAN`, `valor DOUBLE PRECISION`, `unidade VARCHAR`, `data_hora TIMESTAMP(9) WITH TIME ZONE` |
| `alerta` | `sensor_id VARCHAR`, `tipo VARCHAR`, `demonstracao BOOLEAN`, `nivel VARCHAR`, `previsao DOUBLE PRECISION`, `limiar DOUBLE PRECISION`, `unidade VARCHAR`, `justificativa VARCHAR`, `data_hora TIMESTAMP(9) WITH TIME ZONE`, `chave_idempotencia VARCHAR(64)` |

Medição e alerta têm índice `(sensor_id, data_hora, id)`. Alerta tem também índice único `uq_alerta_chave(chave_idempotencia)`. A tabela `territorio` possui id fixo 1, região e quatro limiares (`DOUBLE PRECISION`), todos obrigatórios; id é chave primária com `CHECK(id=1)`. Textos são Unicode, sem um limite pequeno artificial que corte identificadores ou justificativas aceitos no domínio. `DOUBLE PRECISION` corresponde ao `double` já utilizado. JDBC usa `setObject(OffsetDateTime)` e `getObject(..., OffsetDateTime.class)`, sem conversão por relógio local ou texto. A precisão 9 preserva nanossegundos e o offset original; a ordenação é pelo instante, inclusive com offsets diferentes. Empates são resolvidos pelo id crescente.

Fontes consultadas: [H2 — bancos em arquivo e fechamento](https://h2database.com/html/features.html#database_url) e [H2 — tipos de dados e TIMESTAMP WITH TIME ZONE](https://h2database.com/html/datatypes.html#timestamp_with_time_zone).

#### Operações e validações

- `MedicaoDAO.salvar(Medicao)` e `AlertaDAO.salvar(Alerta)` inserem uma linha e retornam o id gerado. Cada inserção individual usa autocommit, sem alterar registros anteriores. Alertas automáticos com a mesma chave retornam o id existente; gravações manuais sem chave continuam inserções independentes para compatibilidade. `MedicaoDAO.salvarTodas` usa uma transação para o lote, com rollback em falha.
- `MedicaoDAO.listarPorSensor(String)` filtra por id. `AlertaDAO.listarPorSensor(String)` filtra por id e `listarTodos()` consulta todos. Todos retornam listas não modificáveis, em ordem cronológica crescente; histórico ausente retorna lista vazia.
- Todo SQL é fixo. Os valores entram exclusivamente por parâmetros `?` de `PreparedStatement`. A concatenação no código ocorre apenas na montagem do caminho da URL H2, não na construção de SQL com dados.
- Conexões, statements, resultados e chaves geradas usam `try-with-resources`. Erros SQL são propagados como `PersistenciaException` com a causa original, sem fallback para memória ou histórico vazio.
- Os DAOs recebem objetos já validados e reconstroem pelo construtor do domínio. As regras de faixa, unidade e conteúdo permanecem no domínio; não há cópia dessas regras numéricas em SQL. As tabelas protegem a estrutura com chave e `NOT NULL`. Escrita SQL externa pode adulterar regras de negócio; se isso ocorrer, a consulta falha explicitamente ao reconstruir o registro inválido, em vez de entregá-lo como válido.

O sensor é armazenado como um retrato de id, tipo e origem demonstrativa em cada registro. Não há tabela cadastral de sensores ou pontos. Usar ids estáveis e distintos para equipamentos distintos, inclusive em regiões diferentes; o DAO não atribui um id novo ao sensor. A referência carregada é um `SensorHistorico`, que preserva os metadados e lança `FonteIndisponivelException` se alguém tentar capturar nova leitura. A disponibilidade e a semente do gerador não representam histórico e não são persistidas. A região pode ser alterada mediante código e o alerta tem chave opcional de idempotência.

`Alerta` não calcula previsão nem decide nível: o serviço fornece esses dados; a criação manual também está disponível. Nível e justificativa são obrigatórios; previsão e limiar devem ser finitos e aceitos pelo `TipoSensor`, com unidade correspondente. Não se exige `previsao > limiar`, pois pressão abaixo do mínimo também poderá motivar alerta. As estratégias e a política automática são descritas abaixo.

### Relógio e cadência simulados

O console usa `ColetaSimulada`: em série vazia, a primeira referência lógica é **2026-01-01T00:00:00-03:00**. Cada próxima amostra soma exatamente um minuto ao horário anterior. Para consumo, cada valor é o volume em uma janela simulada de um minuto; vazão e pressão são amostras nos mesmos passos lógicos. O horário não informa a data física em que a água foi usada. Horários dos alertas continuam sendo horários reais da execução da análise.

Ao reiniciar, a última leitura do H2 determina o próximo horário, inclusive quando uma série legada válida começou em outra data ou offset. A coleta não usa `Thread.sleep`, relógio de parede para espaçar chamadas instantâneas nem temporizadores. Valida primeiro a série completa, exige origem demonstrativa, mesmo tipo e cadência prévia de um minuto. Séries irregulares, com instantes repetidos, origem diferente ou outra cadência são preservadas e recusadas para continuação; escolher um novo id em **2** permite demonstrar sem apagar ou reescrever o histórico antigo. As previsões continuam recusando históricos inconsistentes, inclusive legados.

O lote é montado e validado antes da gravação. Fonte que falha durante a geração não grava parte do lote; erro SQL aciona rollback do lote inteiro quando possível, preservando a causa e qualquer falha de rollback. A coleta do console pressupõe **um escritor por série**; não coordena coletas simultâneas do mesmo id em processos diferentes. A unicidade de alertas, por outro lado, é garantida pelo banco também para análises concorrentes.

### Matemática e horizonte

`prever(sensorId, historico)` devolve `ResultadoPrevisao`, com acessores `sensor()`, `valor()`, `unidade()` e `explicacao()`. O sensor é um retrato histórico imutável. O valor estima **a média da próxima janela de N amostras**, supondo a mesma cadência; não é um volume acumulado nem uma previsão para um número arbitrário de dias.

- **Média móvel:** `estimativa = soma das últimas N medições / N`. Exemplo: últimas cinco leituras de 10, 20, 30, 40 e 50 L resultam em **30 L**. Requer pelo menos N medições.
- **Comparação:** calcular A, média da janela anterior, e R, média da janela recente. `variação = R − A`; `estimativa = R + variação = 2R − A`. Exemplo: A=90 L e R=120 L indicam aumento de 30 L e estimativa de **150 L**. Requer pelo menos 2N medições. As janelas são consecutivas, sem sobreposição e com o mesmo tamanho. A explicação distingue aumento, redução ou estabilidade pela diferença entre as médias, sem divisão pela média anterior; portanto A=0 também é tratado.

O padrão da Factory é **N=5**; uma configuração explícita aceita N>=5. Não há descarte de medições inválidas para completar a quantidade mínima. Registros mais antigos não participam do cálculo das últimas janelas, mas ainda passam pela validação de consistência da série inteira.

As fórmulas são heurísticas acadêmicas, sem modelo de Machine Learning ou fonte externa. A média móvel supõe manutenção do patamar recente; a comparação supõe que a diferença entre as duas médias se repetirá na janela seguinte. Não se atribui probabilidade ou confiabilidade estatística ao resultado.

### Consistência antes do cálculo e erros

As duas implementações chamam a validação comum herdada antes de somar qualquer valor. A lista é copiada para não alterá-la. É obrigatório que:

1. Histórico, elementos, tipo e horários sejam não nulos, e o id informado seja válido.
2. Todas as medições pertençam ao sensor solicitado, com o mesmo tipo, unidade correspondente e mesma origem demonstrativa ou não demonstrativa.
3. Cada valor seja finito e aceito por `TipoSensor`, mesmo se veio de um DAO simulado.
4. Os instantes UTC sejam estritamente crescentes, sem duplicatas, com cadência constante. Offsets diferentes são aceitos quando os instantes preservam a cadência.
5. A quantidade mínima da estratégia seja atendida.

A cadência exata é uma decisão conservadora desta demonstração: uma série irregular é rejeitada, sem interpolar, preencher lacunas ou reordenar. Capturas legadas com `now()` podem ter intervalos irregulares; o console preserva esses registros e permite iniciar outra série identificada por um novo id, com cadência lógica de um minuto. Janelas são agrupamentos de N amostras, não filtros por calendário. Não há política de idade máxima do histórico; a estimativa se refere à sequência apresentada, sem alegar previsão atual de campo.

`DadosInvalidosException` informa histórico insuficiente com sensor, quantidade necessária e disponível. Inconsistências também geram erro explícito. Não se devolve zero ou uma previsão parcial. Uma projeção fora da faixa falha na construção de `ResultadoPrevisao`, com valor calculado, unidade e causa: **não há clamp, arredondamento corretivo ou gravação de alerta**. Exemplo: médias A=0 L e R=120 L produzem 240 L, que excedem a faixa aceita de 0 a 200 L; o serviço informa o erro e não emite alerta com valor artificialmente limitado a 200 L.

### Classificação e justificativa dos alertas

`analisar(sensorId)` consulta `MedicaoDAO`, executa a previsão e compara a grandeza com o limiar correspondente de `DadosTerritorio`. Um resultado normal contém a previsão e `Optional.empty()`; limites exatos são aceitos e não geram alerta. Um erro de histórico, previsão ou persistência é propagado, sem fingir sucesso.

| Sensor | Desvio considerado | ATENCAO | ALERTA | CRITICO |
| --- | --- | --- | --- | --- |
| Consumo | Excesso sobre o limite em L, dividido pelo próprio limite | >0 e <10% | >=10% e <25% | >=25% |
| Vazão | Excesso sobre o limite em L/min, dividido pelo próprio limite | >0 e <20% | >=20% e <50% | >=50% |
| Pressão | Distância abaixo da mínima ou acima da máxima em bar, dividida pela largura `(máxima − mínima)` | >0 e <10% | >=10% e <25% | >=25% |

As faixas são hipóteses didáticas para demonstrar regras distintas: a vazão instantânea admite uma variação proporcional maior que o consumo médio; pressão pode exigir atenção nos dois extremos. Não constituem normas hidráulicas e precisam de calibração com responsáveis pela instalação. Não se infere vazamento apenas porque o consumo ou a vazão cresceram. Vazão zero não é classificada como falha automaticamente, pois não há limite mínimo de vazão no domínio atual.

A largura da faixa de pressão é positiva pelas validações existentes, mesmo quando a mínima é zero. Previsão, limiar e unidade sempre correspondem ao mesmo tipo. A classificação compara decimalmente `desvio` com `referência × fração`, usando `BigDecimal.valueOf`, sem divisão ou arredondamento. Isso corrige a fronteira em que `2 − 1.6` com `double` ficava ligeiramente abaixo de 0.4, rebaixando indevidamente 10% de desvio. Os cálculos de previsão e os valores persistidos continuam sendo `double`; não há ajuste do resultado previsto para fazê-lo caber na faixa.

O alerta inclui sensor, tipo, valor previsto, unidade, limite inferior/superior violado, nível e a explicação da estratégia. Dados simulados são identificados como **DEMONSTRAÇÃO**. O horário do alerta é o horário da análise. A gravação usa o `AlertaDAO` já existente. Se falhar, `PersistenciaException` é propagada. Uma execução confirma no máximo um alerta por contexto. A política persistente de idempotência impede duplicação para o mesmo contexto e preserva o primeiro registro e seu horário.

### Idempotência e migração

`ChaveAnalise` serializa o contexto com comprimentos explícitos de texto e calcula SHA-256. Entram na chave:

- versão das regras (`agro-agua-regras-v1`), nome da implementação da estratégia e tamanho N;
- as últimas N medições da média móvel ou 2N da comparação, em ordem: id, tipo, unidade, origem, valor e instante UTC;
- os quatro limiares de `DadosTerritorio`.

Não entram o texto da justificativa, o horário real da análise ou o nome da região. Portanto, a mesma análise permanece idempotente ao reiniciar. Novos horários/valores das leituras, outro sensor, outra estratégia, outro N ou outros limiares produzem novo contexto. Restaurar exatamente a configuração anterior, sem mudar a janela, continua sendo o contexto anterior e não duplica. Alterações apenas na região não mudam o cálculo. Os quatro limiares são considerados como uma única configuração; mudar qualquer um permite nova avaliação. A versão deve ser atualizada se uma futura revisão mudar a fórmula ou a política de níveis.

`Alerta` recebe chave opcional, preservando seu construtor anterior. O serviço preenche a chave nos alertas automáticos e chama o mesmo `AlertaDAO.salvar`. A inicialização acrescenta `chave_idempotencia VARCHAR(64)` e o índice único, sem remover ou alterar linhas antigas. Vários alertas legados podem ter chave nula. Não é possível reconstruir retroativamente estratégia e janela de alertas antigos que não guardavam esse contexto: eles são preservados; a primeira análise identificada de um contexto pode acrescentar um alerta novo, e as seguintes são deduplicadas. Chamadas manuais antigas sem chave continuam independentes; o console usa o caminho automático identificado.

A inserção concorrente é resolvida pela restrição única, sem depender de uma consulta prévia. Somente SQLState `23505`, com chave presente e alerta correspondente encontrado, é tratado como repetição e retorna o id original. Outros erros ou outro conflito de unicidade sem essa chave correspondente geram `PersistenciaException`. A operação repetida não altera o horário ou a justificativa já persistidos. A tela da análise apresenta o resultado calculado e confirma o alerta de forma neutra; a opção **5** mostra o registro persistido original.

A tabela `territorio` carrega a região e os limites ao reiniciar. O código didático não é persistido. O menu valida uma cópia da configuração, grava pelo DAO e só então troca a referência em memória; uma falha não substitui a configuração válida atual. Entrada inválida, código incorreto, histórico insuficiente, extrapolação fora de faixa, fonte indisponível e falha de banco têm mensagens próprias e devolvem o controle ao menu. Não há `catch` vazio.

## 6. Instalação e execução

### Instruções portáveis

Instalar **Git, JDK 21 e Maven 3.9.x**, disponíveis no PATH. A validação registrada utilizou Maven 3.9.16. O primeiro uso precisa de acesso ao Maven Central para obter dependências e plugins. Em outro computador, executar em um terminal:

```sh
git clone https://github.com/matheeusvx/Agro-Brasil.git
cd Agro-Brasil/modules/java-monitoramento
java -version
mvn -version
mvn "-Dmaven.repo.local=.m2/repository" compile
mvn "-Dmaven.repo.local=.m2/repository" clean verify
mvn "-Dmaven.repo.local=.m2/repository" compile exec:java
```

Se o repositório já foi clonado, acessar `modules/java-monitoramento/` no checkout da branch indicada. `compile exec:java` inicia `br.com.agromais.agua.SistemaMonitoramento`, montando o classpath sem depender de JShell. O JAR comum em `target/` não inclui as dependências; usar o comando Maven para executar. Entrada e saída do programa usam UTF-8.

O cache de dependências fica em `.m2/repository` dentro do módulo. Cache, `target/`, `.data/` e arquivos `*.mv.db`, `*.trace.db`, `*.lock.db` e `*.temp.db` estão ignorados no Git. `mvn clean` remove os gerados em `target/`, sem remover bancos de `.data/`. Após baixar as dependências necessárias, `-o` permite execução Maven offline; não dispensa o download inicial.

Para demonstrar separadamente do banco padrão, sem apagar dados existentes:

```sh
mvn "-Dmaven.repo.local=.m2/repository" "-Dexec.args=.data/apresentacao" compile exec:java
```

O argumento é o caminho-base **sem `.mv.db`**. Repetir o mesmo caminho e diretório de execução para reabrir o mesmo banco. Pode-se usar caminho absoluto; caminhos com espaços devem chegar ao programa como um único argumento, com aspas adequadas ao terminal. Se um banco/sensor já foi usado, escolher outro nome para uma demonstração inicial, sem excluir arquivos.

O código de acesso didático é **`AGRO-AGUA`**, sem pretensão de autenticação de produção.

### Alternativa específica do ambiente de desenvolvimento

No Windows utilizado no desenvolvimento, o Maven 3.9.16 está em Downloads, fora do PATH. Esta é apenas uma alternativa local aos comandos genéricos:

```powershell
# Executar dentro de modules/java-monitoramento/
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" compile
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" clean verify
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" compile exec:java
```

Referência técnica utilizada na implementação: [Mockito — instrumentação no Java 21, seção 0.3](https://github.com/mockito/mockito/blob/v5.14.2/mockito-core/src/main/java/org/mockito/Mockito.java). O POM configura o agente no Surefire para simular DAOs finais sem remover `final` dessas classes.

## 7. Demonstração das funcionalidades


| Opção | Operação real |
| --- | --- |
| 1 | Verifica três sensores simulados e o `PontoMonitoramento`; não consome uma leitura. |
| 2 | Escolhe tipo e id, coleta de 1 a 1000 amostras e grava o lote no H2. Enter escolhe 10 amostras. |
| 3 | Escolhe sensor, estratégia e N; consulta histórico, prevê e confirma alerta idempotente quando necessário. |
| 4 | Lista histórico cronológico por id, com valor, tipo, unidade, horário e origem. |
| 5 | Lista alertas persistidos, níveis, previsões, limiares, justificativas e horário real da análise. |
| 6 | Exibe configuração; subopção 1 altera região, 2 altera os quatro limiares, 0 volta. Exige código. |
| 7 | Mostra região, limites, funcionamento, quantidades e última leitura por sensor, qualidade da série e total de alertas. |
| 0 | Encerra sem apagar registros. EOF também encerra com mensagem, inclusive durante uma operação. |

### Roteiro completo

Exemplo reproduzível em um banco de apresentação que ainda não tenha a série `consumo-demo-1m`:

1. Iniciar pelo comando com `-Dexec.args=.data/apresentacao`. Usar **1** para verificar os sensores.
2. Usar **2**, tipo **1** (consumo), **Enter** para `consumo-demo-1m`, quantidade **10**. Dez minutos de amostras lógicas são gerados imediatamente. Consultar em **4**, id `consumo-demo-1m`.
3. Usar **6**, subopção **2**, código **AGRO-AGUA** e limites **10**, **100**, **2**, **6**. Isso configura 10 L por janela de consumo de um minuto, 100 L/min de vazão e 2 a 6 bar de pressão. Os valores baixos de consumo são escolhidos apenas para tornar o alerta visível na demonstração.
4. Usar **3**, id `consumo-demo-1m`, estratégia **1**, N **5**. Resultado: aproximadamente **75.8891720424875 L / CRITICO**. Repetir exatamente essa análise: não há novo registro.
5. Usar **3**, mesmo id, estratégia **2**, N **5**. Resultado: aproximadamente **78.53566310509333 L / CRITICO**. Em **5**, há **dois alertas**, um por estratégia; repetir qualquer uma mantém dois.
6. Usar **7** para o status, **0** para encerrar e executar novamente com o mesmo caminho. Consultar em **4** e **5**: dez leituras e dois alertas continuam presentes; executar as mesmas previsões mantém dois.
7. Usar **2**, tipo 1, mesmo id padrão, quantidade **1**. A nova leitura recebe o minuto lógico seguinte. Usar **3**, média móvel, N=5; **5** agora mostra um terceiro alerta. Alterar o limite de consumo para 20 L em **6** e reanalisar também permite novo alerta fundamentado, pois a configuração mudou.

A semente `Random(42)` é reiniciada a cada lote no console para tornar essa demonstração reproduzível. Ela usa as três classes de sensores existentes, dentro das faixas já documentadas. O padrão pode se repetir entre lotes: não representa observações físicas independentes ou uma série hidráulica real. O id pode ser personalizado na coleta; os ids padrão são `consumo-demo-1m`, `vazao-demo-1m` e `pressao-demo-1m`. Sensores legados são listados pelo catálogo para consulta, sem serem transformados em fontes ativas.

## 8. Testes automatizados e validação

**Resultado consolidado registrado em 10/11/2026: 199 testes JUnit 5 aprovados, 0 falhas, 0 erros e 0 ignorados**, com Java 21.0.10 e Maven 3.9.16. Os testes seguem Arrange, Act, Assert; cada combinação parametrizada conta como uma execução.

| Classe | Execuções | Cobertura principal |
| --- | --- | --- |
| `SensoresTest` | 16 | Tipos, unidades, demonstração, faixas com mil amostras por tipo e falhas de fonte/gerador. |
| `MedicaoTest` | 21 | Metadados, horários, extremos, valores inválidos, unidades e obrigatoriedade. |
| `DadosTerritorioTest` | 23 | Código exato, autorização, limites e ausência de atualização parcial. |
| `PontoMonitoramentoTest` | 8 | Herança, polimorfismo, status, lista protegida, ids e campos obrigatórios. |
| `AlertaTest` | 15 | Níveis, campos, unidades e valores. |
| `SensorHistoricoTest` | 2 | Identidade e bloqueio de novas leituras. |
| `MedicaoDAOTest` | 9 | H2 real, recuperação, isolamento, ordem, nanossegundos/offset e SQL como texto. |
| `AlertaDAOTest` | 10 | Campos, níveis, filtros, ordenação, erros e adulteração externa. |
| `BancoH2Test` | 5 | Criação, fechamento, reabertura, continuidade de ids e isolamento. |
| `ReinicioProcessoTest` | 1 | Escrita em uma JVM e consultas em duas JVMs independentes. |
| `PrevisoesTest` | 28 | Resultados conhecidos, janelas, polimorfismo, mínimos, consistência e projeções inválidas. |
| `FabricaPrevisaoTest` | 3 | Seleção, tamanho da janela e configurações inválidas. |
| `ServicoMonitoramentoTest` | 31 | Mockito: níveis por sensor, fronteiras decimais, ausência de alerta, limites e falhas. |
| `MonitoramentoH2Test` | 6 | Duas estratégias sobre H2, alertas persistidos/reabertos e rejeições. |
| `ColetaSimuladaTest` | 7 | Cadência, legado, continuidade, incompatibilidades, fonte, rollback e quantidade. |
| `IdempotenciaAlertaTest` | 4 | Repetição/reabertura, novos contextos, concorrência e erros não mascarados. |
| `MigracaoConsoleTest` | 3 | Schema antigo preservado, configuração persistente e adulteração. |
| `SistemaMonitoramentoTest` | 6 | Menu controlado, coleta, previsões, erros, acesso, reabertura e EOF. |
| `ConsoleProcessoTest` | 1 | Reinício do main real, configuração, dez leituras/dois alertas e terceiro após nova leitura. |

Mockito simula os DAOs para testar a lógica sem banco, usando `ArgumentCaptor`, verificação de ordem e confirmação de ausência de gravação indevida. Testes JDBC usam H2 real em arquivo, com `@TempDir`, sem acessar `.data/` do usuário. Relatórios ficam em `target/surefire-reports/`; o build consolidado compilou 33 arquivos de produção e 20 de teste, incluindo o auxiliar `ProcessoBancoTeste`.

As evidências verificam valores, unidades, origem, horários e registros após reabrir. `ReinicioProcessoTest` confere quantidades, valores, nível, limiar, justificativa e horário exato em JVMs distintas. `ConsoleProcessoTest` confirma dez leituras e dois alertas, manutenção de dois após repetição e reinício e possibilidade de terceiro após nova leitura. São testes de encerramento normal, não de desligamento abrupto da máquina. Também foi registrado o fluxo `compile exec:java` com banco descartável, ambas as previsões e repetição sem alerta duplicado.

Para reproduzir a suíte ou evidências específicas, dentro do módulo:

```sh
mvn "-Dmaven.repo.local=.m2/repository" clean verify
mvn "-Dmaven.repo.local=.m2/repository" "-Dtest=MonitoramentoH2Test" test
mvn "-Dmaven.repo.local=.m2/repository" "-Dtest=ReinicioProcessoTest" test
mvn "-Dmaven.repo.local=.m2/repository" "-Dtest=ConsoleProcessoTest" test
```

**Revisão humana:** conforme declaração de Matheus Morelli Rodrigues, a revisão do código, a execução pessoal dos testes e a conferência dos resultados foram concluídas. **Auditoria independente:** conforme relato fornecido pelo aluno, o Claude analisou o projeto, executou build/testes e verificou os fluxos de console e persistência, emitindo **APTO COM RESSALVAS**, concentradas na documentação. Esses registros são distintos dos testes automatizados e não constituem aprovação definitiva do professor ou validação física dos sensores.

Esta revisão editorial não reexecutou a suíte: documenta os resultados já registrados, sem modificar código, testes, configuração de build ou banco. A reorganização do README não equivale a um novo parecer do auditor.

## 9. Limitações e reflexão crítica

### Limitações da implementação

A coleta pressupõe um escritor por série; não coordena coletas simultâneas do mesmo id em processos diferentes. A unicidade de alertas é protegida pelo banco também em análises concorrentes. Coleta e emissão de alertas são operações distintas: não há transação única vinculando ambas. Não há política de idade máxima do histórico; as janelas agrupam amostras, não períodos de calendário. O código de acesso é demonstrativo, e não há conexão com sensores reais, serviços externos ou os demais módulos. As regras exigiriam calibração e avaliação próprias antes de qualquer uso operacional.

### Reflexão crítica

**Quando o sistema deve evitar realizar previsões?** A existência de algumas leituras não garante que uma estimativa seja adequada. A média móvel exige pelo menos N medições, com N mínimo de 5; a comparação exige duas janelas completas, isto é, 2N medições e no mínimo dez quando N=5. O sistema também deve se abster quando a série mistura sensores, tipos, unidades ou origens, contém valores inválidos, instantes repetidos ou fora de ordem, ou não mantém a cadência exigida. Essas condições comprometem a comparabilidade das amostras. Uma projeção fora da faixa admitida deve ser apresentada como erro, sem recortar o valor ou gerar um alerta artificial. Mesmo um histórico aceito apenas satisfaz as regras didáticas implementadas: a quantidade mínima não demonstra confiabilidade estatística nem garante que dados antigos descrevam o presente.

**Por que um sensor não representa toda uma região?** Cada ponto de observação está associado a uma instalação e a condições locais. Posição do equipamento, características da tubulação, capacidade de abastecimento, horários de utilização e particularidades do uso da água podem influenciar a leitura. Não se pode generalizar o comportamento de um reservatório ou trecho de rede para todas as propriedades e comunidades de uma região. Nesta demonstração, há ainda uma limitação anterior à representatividade espacial: os valores são gerados artificialmente, e um minuto lógico não corresponde a uma observação física realizada durante um minuto real. A repetição de padrões e a geração independente das grandezas impedem alegações de representação hidráulica da comunidade ou de balanço real de água.

**Por que os alertas apoiam decisões humanas, mas não substituem a análise de um responsável?** O alerta identifica uma violação dos limites configurados e explica quais dados e regras sustentaram o resultado. Uma variação ou anomalia numérica, mesmo interpretada como estatística, não comprova vazamento, desperdício efetivo ou defeito na rede; as heurísticas usadas tampouco estabelecem significância estatística. A avaliação deve considerar contexto, mudanças legítimas de demanda, condições da instalação e qualidade da fonte, com verificações por responsáveis pelo sistema. O papel do software é organizar indícios e tornar a investigação compreensível e rastreável, sem determinar sozinho uma intervenção. Assim, os resultados devem ser apresentados como apoio à decisão e não como diagnóstico operacional ou evidência de impacto social já alcançado.

## 10. Equipe, responsabilidades e utilização de Inteligência Artificial

### Execução individual e responsabilidade acadêmica

**Aluno responsável:** Matheus Morelli Rodrigues — **RM 562765**.

O projeto foi desenvolvido individualmente, com assistência de IA declarada abaixo. Não há outros integrantes ou divisão fictícia de tarefas. O enunciado menciona equipes de três integrantes; esta entrega registra a execução individual e não declara autorização formal do professor para essa organização.

**Matheus Morelli Rodrigues — Desenvolvimento, implementação, revisão e validação.** Conforme declaração do aluno, foram concluídas:

- Definição do escopo, orientação do trabalho assistido, organização da solução e acompanhamento de sua evolução.
- Implementação do sistema Java com assistência de IA e aplicação dos conceitos de Programação Orientada a Objetos.
- Acompanhamento das decisões técnicas e revisão do código-fonte e das decisões de implementação.
- Execução pessoal dos testes automatizados, conferência dos resultados e validação do funcionamento demonstrativo.
- Organização do repositório e preparação da documentação para entrega acadêmica.

A revisão e a execução dos testes pelo aluno são registradas como **concluídas**, conforme informado por Matheus. Sua responsabilidade abrange entender as funcionalidades e explicar a modelagem, os cálculos, o JDBC, a cadência e a idempotência durante a apresentação acadêmica.

### Codex — Apoio ao desenvolvimento e à revisão técnica

O Codex foi utilizado na análise da estrutura, sugestões de implementação, revisão técnica, identificação de inconsistências, documentação e elaboração de testes. Sua participação incluiu efetivamente **geração e implementação de código Java e testes**, além de configuração Maven, modelagem H2/JDBC, integração do console e execução de validações automatizadas; não se limitou a sugestões de texto.

O uso teve caráter de assistência técnica, sob definição de escopo, acompanhamento e revisão por Matheus. O aluno declarou concluídas sua revisão e validação pessoal. A ferramenta contribuiu para a realização do projeto, sem substituir a responsabilidade do aluno pelo entendimento e pela apresentação do código.

### Claude — Auditoria técnica final

Conforme relato da auditoria fornecido pelo aluno, o Claude realizou uma auditoria independente após a conclusão das funcionalidades, abrangendo arquitetura e conceitos de POO, aderência ao enunciado, estratégias de previsão, persistência e alertas. A auditoria incluiu execução do build e dos testes automatizados, verificação prática do menu e da persistência, e identificação de melhorias documentais e acadêmicas.