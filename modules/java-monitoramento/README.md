# Agro+ Água — monitoramento Java, Etapas 1 a 4

Módulo acadêmico independente da FIAP Global Solution POO 2026.2, na branch `feat/poo-java`. Público: comunidades rurais e responsáveis por sistemas coletivos de água. A proposta futura é apoiar a investigação de consumo elevado e possíveis desperdícios. Esta versão entrega domínio, sensores simulados, H2/JDBC em arquivo, duas estratégias polimórficas de previsão, Factory e geração automática de alertas fundamentados. Os resultados são demonstrações didáticas e não comprovam vazamentos. O menu de console integra as operações com tratamento de erros, relógio simulado e deduplicação persistente de alertas.

## Ambiente e reprodução

Requer **JDK 21** e **Maven 3.9.x**. Não depende de Flutter, Next.js, Node.js, Express ou servidor de banco de dados. H2 é embarcado e executa dentro do processo Java. Na raiz do repositório, em PowerShell:

```powershell
Set-Location modules/java-monitoramento
java -version
mvn -version
mvn "-Dmaven.repo.local=.m2/repository" compile
mvn "-Dmaven.repo.local=.m2/repository" clean verify
mvn "-Dmaven.repo.local=.m2/repository" compile exec:java
```

No ambiente verificado em 10/11/2026: Oracle JDK 21.0.10; Maven 3.9.16 instalado em Downloads, fora do PATH. Nesse computador, substituir `mvn` por:

```powershell
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" compile
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" clean verify
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" compile exec:java
```

O primeiro uso precisa acessar o Maven Central. O repositório de dependências fica em `.m2/repository` dentro deste módulo; ele e `target/` estão ignorados no Git. O POM fixa Java 21, JUnit Jupiter **5.11.4**, Compiler **3.13.0** e Surefire **3.5.2**. A dependência de produção é **H2 2.4.240**, sem Spring, ORM ou pool de conexões. Os testes também usam **Mockito 5.14.2**, com agente explícito no Surefire para simular os DAOs finais sem alterar essas classes no Java 21. Referência: [documentação oficial do Mockito, seção 0.3](https://github.com/mockito/mockito/blob/v5.14.2/mockito-core/src/main/java/org/mockito/Mockito.java).

O comando `compile exec:java` inicia `br.com.agromais.agua.SistemaMonitoramento` pelo Exec Maven Plugin **3.5.0**, sem JShell. O JAR comum não inclui as dependências; executar pelo Maven, que monta o classpath. Entrada e saída do programa usam UTF-8. O código de acesso **didático** é `AGRO-AGUA`; ele não representa autenticação de produção.

Por padrão, o banco é `.data/agro-agua.mv.db`, relativo ao diretório de execução. O mesmo caminho reabre o banco e aplica as migrações aditivas. Para uma demonstração separada dos dados existentes, usar um caminho-base próprio e repeti-lo ao reiniciar:

```powershell
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" "-Dexec.args=.data/apresentacao-etapa4" compile exec:java
```

O argumento não inclui a extensão `.mv.db`. Escolher outro nome de banco/sensor se uma demonstração anterior já usou esse caminho; não é necessário apagar arquivo algum.

## Classes e responsabilidades

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

## Decisões e conceitos de POO

- **Abstração:** `ComponenteTerritorial` define o contrato comum; `Sensor` descreve uma fonte sem expor seu gerador.
- **Herança:** `PontoMonitoramento` usa `super(...)` para inicializar a identidade territorial e sobrescreve `verificarStatus()`.
- **Polimorfismo:** o ponto e `Medicao.capturar(Sensor)` trabalham com a interface; não há `instanceof` para selecionar sensores. Os testes também verificam o ponto através de uma referência `ComponenteTerritorial`.
- **Encapsulamento:** campos privados, identidade final, lista de sensores não modificável, medições sem setters e limiares alteráveis somente por método autorizado. A lista protege sua estrutura, não congela o estado interno de implementações futuras de `Sensor`.
- **Exceções efetivas:** os construtores, a alteração de limiares e a leitura lançam as exceções personalizadas. Fonte indisponível não vira medição zero. Um valor fora de faixa continua sendo erro de dados, mesmo se veio do gerador. As falhas do gerador e da persistência são traduzidas com mensagem e causa; não há captura vazia.

O código de acesso é comparado exatamente, sem getter e sem exposição em mensagens. Código incorreto lança `SecurityException`, pois é falha de autorização, não erro numérico ou de fonte. É uma proteção didática em memória, não autenticação de produção. Todos os limiares são validados antes de qualquer atribuição, inclusive no construtor; uma tentativa inválida preserva o conjunto anterior.

Não há hierarquia extra entre os sensores: cada implementação é curta e direta. O gerador `RandomGenerator` e a disponibilidade podem ser fornecidos no construtor, permitindo sequências com semente fixa e simulação de falhas. O construtor simples cria uma fonte ativa. A disponibilidade representa a configuração da simulação; ela não é um diagnóstico físico nem testa antecipadamente o gerador.

## Unidades, faixas e limites da demonstração

| Tipo | Leituras geradas por chamada | Faixa aceita em uma medição |
| --- | --- | --- |
| Consumo | 20 inclusivo a 120 exclusivo L por janela de um minuto | 0 a 200 L, inclusivos |
| Vazão | 5 inclusivo a 80 exclusivo L/min | 0 a 200 L/min, inclusivos |
| Pressão | 1 inclusivo a 4 exclusivo bar | 0 a 10 bar, inclusivos |

As faixas são hipóteses didáticas plausíveis para um pequeno ponto coletivo, não limites de engenharia validados em campo. A faixa aceita é maior que a faixa normalmente gerada para permitir leituras anormais futuras. Zero pode ser uma leitura válida; falha da fonte deve lançar exceção. `NaN`, infinitos e negativos são rejeitados.

Consumo é volume da janela de um minuto, não hidrômetro acumulado. Seu limiar usa L na mesma janela; vazão usa L/min e pressão usa bar. Limites de consumo e vazão devem ser positivos e não exceder 200; pressão deve obedecer `0 <= mínima < máxima <= 10`. Valores que ultrapassem limiares configurados ainda podem ser medições válidas: a classificação usa os limiares de `DadosTerritorio`, sem confundir faixa válida da grandeza com limite de atenção.

Uma chamada ao sensor representa um valor simulado. A coleta do console atribui a cada amostra um minuto lógico explícito, sem temporizador, espera real ou agendador; não confunde chamadas instantâneas com passagem de tempo físico. Consumo, vazão e pressão são sorteados independentemente; não se deve inferir balanço hidráulico entre eles. As três implementações simuladas retornam `isDemonstracao() == true`, propagado à medição; `SensorHistorico` preserva a origem armazenada. `OffsetDateTime` guarda também o deslocamento UTC. A captura registra o horário após a leitura. O construtor permite horário explícito para testes e reconstrução pelo DAO.

O status operacional do ponto expressa somente disponibilidade: lista vazia resulta em `SEM_SENSORES`; qualquer fonte configurada como inativa resulta em `FONTE_INDISPONIVEL`; caso contrário, `OPERACIONAL`. Não usa limiares nem classifica desperdício. `getStatus()` retorna a última verificação; `verificarStatus()` a atualiza.

## Validação automatizada

As quatro classes originais de testes JUnit 5 em `src/test/java/br/com/agromais/agua/dominio`, com Arrange, Act, Assert identificados nos métodos:

- `SensoresTest`: três tipos pela mesma interface, unidades, identificação de demonstração, mil amostras por sensor com semente fixa, indisponibilidade, falha de gerador com causa, valor não finito e gerador ausente.
- `MedicaoTest`: metadados, horário de captura, limites inclusivos, valores negativos/não finitos/fora de faixa, unidades incompatíveis e campos obrigatórios.
- `DadosTerritorioTest`: autorização, comparação exata do código, alteração válida e preservação integral dos limiares após tentativa inválida.
- `PontoMonitoramentoTest`: herança e despacho polimórfico, status, isolamento da lista, ids duplicados e dados obrigatórios.

`assertThrows` verifica as duas exceções personalizadas. Os testes de persistência usam H2 real em arquivo; a Etapa 3 acrescenta Mockito para testar a lógica de alertas sem banco. Os testes parametrizados contam cada combinação como uma execução. Relatórios detalhados ficam em `target/surefire-reports/`.

Verificação em 10/11/2026 com JDK 21.0.10 e Maven 3.9.16: `compile` aprovado e verificação final `clean verify` aprovada também com `-o` (offline, após baixar dependências). Resultado: **68 testes, 0 falhas, 0 erros, 0 ignorados**, em quatro classes (23 de território, 21 de medição, 8 de ponto e 16 de sensores). O build compilou 13 arquivos de produção e 4 de teste e gerou o JAR. O executor precisou liberar o Maven das restrições de acesso do sandbox para baixar e ler os JARs; a execução final foi offline.

## Persistência H2/JDBC — Etapa 2

`new BancoH2()` usa o caminho-base `.data/agro-agua`, relativo ao diretório de execução, criando `.data/agro-agua.mv.db`. Para evitar depender do diretório atual, usar `new BancoH2(Path.of("caminho/absoluto/agro-agua"))`. O argumento é um caminho-base sem `.mv.db`, não uma URL JDBC. Diretórios ausentes são criados. `;` e caracteres de controle são rejeitados para não permitir opções JDBC no caminho.

O banco é local, embarcado, com usuário `sa` e senha vazia para esta demonstração acadêmica. Não há servidor, console H2 ou conexão externa. `BancoH2` não mantém recursos abertos: cada DAO abre e fecha sua própria conexão. Ao fechar a última conexão, o H2 encerra o banco e mantém o arquivo. Para reabrir, fornecer exatamente o mesmo caminho.

A inicialização usa `CREATE TABLE/INDEX IF NOT EXISTS` e, na Etapa 4, `ALTER TABLE alerta ADD COLUMN IF NOT EXISTS` para a chave de deduplicação. Não usa `DROP`, `TRUNCATE`, recriação de schema, carga de demonstração ou limpeza automática. O comando Maven `clean` exclui `target/`, sem afetar `.data/`. A migração aditiva implementada mantém todas as linhas antigas. Alterações futuras no formato das tabelas também precisarão de migração explícita; `CREATE TABLE IF NOT EXISTS` sozinho não migra uma tabela já existente.

### Tabelas

Todos os campos abaixo são `NOT NULL`, exceto `alerta.chave_idempotencia`, que aceita nulos para os registros legados/manuais. As chaves são `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`.

| Tabela | Colunas além de `id` |
| --- | --- |
| `medicao` | `sensor_id VARCHAR`, `tipo VARCHAR`, `demonstracao BOOLEAN`, `valor DOUBLE PRECISION`, `unidade VARCHAR`, `data_hora TIMESTAMP(9) WITH TIME ZONE` |
| `alerta` | `sensor_id VARCHAR`, `tipo VARCHAR`, `demonstracao BOOLEAN`, `nivel VARCHAR`, `previsao DOUBLE PRECISION`, `limiar DOUBLE PRECISION`, `unidade VARCHAR`, `justificativa VARCHAR`, `data_hora TIMESTAMP(9) WITH TIME ZONE`, `chave_idempotencia VARCHAR(64)` |

Medição e alerta têm índice `(sensor_id, data_hora, id)`. Alerta tem também índice único `uq_alerta_chave(chave_idempotencia)`. A tabela `territorio` possui id fixo 1, região e quatro limiares (`DOUBLE PRECISION`), todos obrigatórios; id é chave primária com `CHECK(id=1)`. Textos são Unicode, sem um limite pequeno artificial que corte identificadores ou justificativas aceitos no domínio. `DOUBLE PRECISION` corresponde ao `double` já utilizado. JDBC usa `setObject(OffsetDateTime)` e `getObject(..., OffsetDateTime.class)`, sem conversão por relógio local ou texto. A precisão 9 preserva nanossegundos e o offset original; a ordenação é pelo instante, inclusive com offsets diferentes. Empates são resolvidos pelo id crescente.

Fontes consultadas: [H2 — bancos em arquivo e fechamento](https://h2database.com/html/features.html#database_url) e [H2 — tipos de dados e TIMESTAMP WITH TIME ZONE](https://h2database.com/html/datatypes.html#timestamp_with_time_zone).

### Operações e validações

- `MedicaoDAO.salvar(Medicao)` e `AlertaDAO.salvar(Alerta)` inserem uma linha e retornam o id gerado. Cada inserção individual usa autocommit, sem alterar registros anteriores. Alertas automáticos com a mesma chave retornam o id existente; gravações manuais sem chave continuam inserções independentes para compatibilidade. `MedicaoDAO.salvarTodas` usa uma transação para o lote, com rollback em falha.
- `MedicaoDAO.listarPorSensor(String)` filtra por id. `AlertaDAO.listarPorSensor(String)` filtra por id e `listarTodos()` consulta todos. Todos retornam listas não modificáveis, em ordem cronológica crescente; histórico ausente retorna lista vazia.
- Todo SQL é fixo. Os valores entram exclusivamente por parâmetros `?` de `PreparedStatement`. A concatenação no código ocorre apenas na montagem do caminho da URL H2, não na construção de SQL com dados.
- Conexões, statements, resultados e chaves geradas usam `try-with-resources`. Erros SQL são propagados como `PersistenciaException` com a causa original, sem fallback para memória ou histórico vazio.
- Os DAOs recebem objetos já validados e reconstroem pelo construtor do domínio. As regras de faixa, unidade e conteúdo permanecem no domínio; não há cópia dessas regras numéricas em SQL. As tabelas protegem a estrutura com chave e `NOT NULL`. Escrita SQL externa pode adulterar regras de negócio; se isso ocorrer, a consulta falha explicitamente ao reconstruir o registro inválido, em vez de entregá-lo como válido.

O sensor é armazenado como um retrato de id, tipo e origem demonstrativa em cada registro. Não há cadastro/tabela de sensores ou pontos nesta etapa. Usar ids estáveis e distintos para equipamentos distintos, inclusive em regiões diferentes; o DAO não atribui um id novo ao sensor. A referência carregada é um `SensorHistorico`, que preserva os metadados e lança `FonteIndisponivelException` se alguém tentar capturar nova leitura. A disponibilidade e a semente do gerador não representam histórico e não são persistidas. Os testes originais foram mantidos. Na Etapa 4, o domínio de território ganhou alteração autorizada da região e o alerta ganhou uma chave opcional; as validações anteriores permanecem.

`Alerta` não calcula previsão nem decide nível. Na Etapa 3, o serviço passa a fornecer esses dados; a criação manual da Etapa 2 continua disponível. Nível e justificativa são obrigatórios; previsão e limiar devem ser finitos e aceitos pelo `TipoSensor`, com unidade correspondente. Não se exige `previsao > limiar`, pois pressão abaixo do mínimo também poderá motivar alerta. As estratégias e a política automática da Etapa 3 são descritas abaixo.

### Execução

A aplicação é iniciada pelo comando Maven apresentado no início deste README. O fluxo do menu e a política de continuidade estão na seção da Etapa 4 abaixo. O banco padrão só é aberto quando a aplicação é iniciada explicitamente; os testes nunca o acessam.

### Testes novos e evidência de reinício

Todos os testes novos usam `@TempDir`, caminhos únicos e bancos reais H2 em arquivo. Não usam banco em memória nem dados locais do usuário. Os diretórios temporários são gerenciados pelo JUnit.

| Classe | Execuções | Verificações |
| --- | --- | --- |
| `AlertaTest` | 15 | Níveis, campos, unidades e valores inválidos. |
| `SensorHistoricoTest` | 2 | Metadados obrigatórios e bloqueio de novas leituras. |
| `MedicaoDAOTest` | 9 | Inserção, todos os tipos, origem, nanossegundos/offset, filtro, ordenação, SQL como texto, erros e adulteração externa. |
| `AlertaDAOTest` | 10 | Todos os níveis, recuperação completa, filtros, ordenação, SQL como texto, erros e adulteração externa. |
| `BancoH2Test` | 5 | Criação automática, fechamento, reabertura, continuidade de ids, isolamento e erros de inicialização. |
| `ReinicioProcessoTest` | 1 | Escrita em uma JVM, encerramento e consultas em outras duas JVMs independentes. |

Validação de 10/11/2026: Maven 3.9.16 / JDK 21.0.10, comando `mvn "-Dmaven.repo.local=.m2/repository" clean verify`, **BUILD SUCCESS: 110 testes, 0 falhas, 0 erros, 0 ignorados**. São os 68 testes anteriores mais 42 novos; 20 arquivos de produção e 11 de teste (incluindo o auxiliar `ProcessoBancoTeste`).

Saída efetiva do teste entre processos, também registrada no XML do Surefire:

```text
GRAVADO: medicoes=1; alertas=1
REABERTO: medicoes=1; valor=61.25 L; alertas=1; nivel=ALERTA; previsao=80.0 L; limiar=60.0 L
HORARIO_PRESERVADO: 2026-11-10T09:00:00.123456789-03:00
SEGUNDA_REABERTURA: mesmos registros e metadados, sem duplicacao
```

Para reproduzir apenas essa evidência:

```powershell
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" "-Dtest=ReinicioProcessoTest" test
```

O processo escritor termina com código 0 antes do leitor iniciar, e cada operação já fechou suas conexões. O leitor confere quantidades, valores, tipo, unidade, nível, limiar, justificativa, origem demonstrativa e horário exato. Uma terceira JVM repete a consulta para verificar ausência de duplicação. Trata-se de encerramento normal, não teste de desligamento abrupto da máquina. `BancoH2Test` também reinsere após reabrir e comprova que a sequência de ids continua.

As exclusões locais cobrem `target/`, `.m2/`, `.data/`, `*.mv.db`, `*.trace.db`, `*.lock.db` e `*.temp.db`. Nenhum banco ou JAR baixado integra os arquivos de entrega.

## Previsões, Factory e alertas — Etapa 3

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

A cadência exata é uma decisão conservadora desta demonstração: uma série irregular é rejeitada, sem interpolar, preencher lacunas ou reordenar. Capturas legadas com `now()` podem ter intervalos irregulares; o console preserva esses registros e permite iniciar outra série identificada por um novo id, com cadência lógica de um minuto. Janelas são agrupamentos de N amostras, não filtros por calendário. Não há política de idade máxima do histórico nesta etapa; a estimativa se refere à sequência apresentada, sem alegar previsão atual de campo.

`DadosInvalidosException` informa histórico insuficiente com sensor, quantidade necessária e disponível. Inconsistências também geram erro explícito. Não se devolve zero ou uma previsão parcial. Uma projeção fora da faixa falha na construção de `ResultadoPrevisao`, com valor calculado, unidade e causa: **não há clamp, arredondamento corretivo ou gravação de alerta**. Exemplo: médias A=0 L e R=120 L produzem 240 L, que excedem a faixa aceita de 0 a 200 L; o serviço informa o erro e não emite alerta com valor artificialmente limitado a 200 L.

### Factory e polimorfismo

`FabricaPrevisao` implementa **Simple Factory**, centralizando em um único `switch` a criação por `TipoPrevisao`. Foi escolhida porque o chamador conhece a configuração desejada e não precisa conhecer construtores concretos nem repetir a escolha em vários locais. Não se trata de uma hierarquia de Factory Method.

O construtor configurado de `ServicoMonitoramento` chama a Factory de verdade. O campo e a execução do serviço usam somente `EstrategiaPrevisao` e `estrategia.prever(...)`, sem `instanceof` ou seleção por classe. Cada filha chama `super(tamanhoJanela, quantidadeJanelas)`, compartilha os invariantes da base e sobrescreve o cálculo. Um segundo construtor aceita a abstração pronta por injeção. Não foi necessário remover `final` dos DAOs para usar Mockito.

### Regras de alerta

`analisar(sensorId)` consulta `MedicaoDAO`, executa a previsão e compara a grandeza com o limiar correspondente de `DadosTerritorio`. Um resultado normal contém a previsão e `Optional.empty()`; limites exatos são aceitos e não geram alerta. Um erro de histórico, previsão ou persistência é propagado, sem fingir sucesso.

| Sensor | Desvio considerado | ATENCAO | ALERTA | CRITICO |
| --- | --- | --- | --- | --- |
| Consumo | Excesso sobre o limite em L, dividido pelo próprio limite | >0 e <10% | >=10% e <25% | >=25% |
| Vazão | Excesso sobre o limite em L/min, dividido pelo próprio limite | >0 e <20% | >=20% e <50% | >=50% |
| Pressão | Distância abaixo da mínima ou acima da máxima em bar, dividida pela largura `(máxima − mínima)` | >0 e <10% | >=10% e <25% | >=25% |

As faixas são hipóteses didáticas para demonstrar regras distintas: a vazão instantânea admite uma variação proporcional maior que o consumo médio; pressão pode exigir atenção nos dois extremos. Não constituem normas hidráulicas e precisam de calibração com responsáveis pela instalação. Não se infere vazamento apenas porque o consumo ou a vazão cresceram. Vazão zero não é classificada como falha automaticamente, pois não há limite mínimo de vazão no domínio atual.

A largura da faixa de pressão é positiva pelas validações existentes, mesmo quando a mínima é zero. Previsão, limiar e unidade sempre correspondem ao mesmo tipo. A classificação compara decimalmente `desvio` com `referência × fração`, usando `BigDecimal.valueOf`, sem divisão ou arredondamento. Isso corrige a fronteira em que `2 − 1.6` com `double` ficava ligeiramente abaixo de 0.4, rebaixando indevidamente 10% de desvio. Os cálculos de previsão e os valores persistidos continuam sendo `double`; não há ajuste do resultado previsto para fazê-lo caber na faixa.

O alerta inclui sensor, tipo, valor previsto, unidade, limite inferior/superior violado, nível e a explicação da estratégia. Dados simulados são identificados como **DEMONSTRAÇÃO**. O horário do alerta é o horário da análise. A gravação usa o `AlertaDAO` já existente. Se falhar, `PersistenciaException` é propagada. Uma execução confirma no máximo um alerta por contexto. A política persistente da Etapa 4 impede duplicação para o mesmo contexto e preserva o primeiro registro e seu horário.

### Demonstração automatizada das duas estratégias

`MonitoramentoH2Test` grava dez amostras em arquivo temporário: cinco de 90 L e cinco de 120 L. Com limite 100 L, a média móvel prevê **120 L / ALERTA** e a comparação prevê **150 L / CRITICO**. Cada estratégia roda em um banco isolado e o alerta é recuperado após reabrir o arquivo. O menu usa as mesmas estratégias e DAOs, sem duplicar os cálculos.

### Validação da Etapa 3

`mvn "-Dmaven.repo.local=.m2/repository" clean verify` em 10/11/2026, JDK 21.0.10 e Maven 3.9.16: **BUILD SUCCESS — 178 testes, 0 falhas, 0 erros e 0 ignorados**. Os 110 anteriores continuam aprovados; foram adicionadas 68 execuções em quatro classes:

| Classe | Execuções | Evidência |
| --- | --- | --- |
| `PrevisoesTest` | 28 | Resultados conhecidos, últimas janelas, polimorfismo, mínimos, metadados e cadência, unidades inválidas e projeções fora de faixa. |
| `FabricaPrevisaoTest` | 3 | Seleção por configuração, janela e configuração inválida. |
| `ServicoMonitoramentoTest` | 31 | Mockito simula ambos os DAOs: três níveis por tipo, limites e fronteiras decimais, ausência de alerta, falhas propagadas, alteração autorizada de limiares e captura do alerta salvo. Não abre banco. |
| `MonitoramentoH2Test` | 6 | Duas estratégias sobre H2, alerta persistido e reaberto, pressão baixa e ausência de alertas infundados. |

O teste Mockito usa `ArgumentCaptor`, verifica a ordem consulta/gravação e confirma ausência de chamadas de gravação nos casos rejeitados. Os testes são AAA. O build compilou 28 arquivos de produção e 15 de teste. Relatórios ficam em `target/surefire-reports/`, ignorados pelo Git. A única extensão de uma classe antiga foi um construtor com causa em `DadosInvalidosException`, necessário para informar a projeção inválida sem perder o erro de validação original; DAOs e as classes de dados anteriores foram preservados.

## Aplicação de console — Etapa 4

### Menu e fluxo completo de demonstração

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

Exemplo reproduzível em um banco de apresentação que ainda não tenha a série `consumo-demo-1m`:

1. Iniciar pelo comando com `-Dexec.args=.data/apresentacao-etapa4`. Usar **1** para verificar os sensores.
2. Usar **2**, tipo **1** (consumo), **Enter** para `consumo-demo-1m`, quantidade **10**. Dez minutos de amostras lógicas são gerados imediatamente. Consultar em **4**, id `consumo-demo-1m`.
3. Usar **6**, subopção **2**, código **AGRO-AGUA** e limites **10**, **100**, **2**, **6**. Isso configura 10 L por janela de consumo de um minuto, 100 L/min de vazão e 2 a 6 bar de pressão. Os valores baixos de consumo são escolhidos apenas para tornar o alerta visível na demonstração.
4. Usar **3**, id `consumo-demo-1m`, estratégia **1**, N **5**. Resultado: aproximadamente **75.8891720424875 L / CRITICO**. Repetir exatamente essa análise: não há novo registro.
5. Usar **3**, mesmo id, estratégia **2**, N **5**. Resultado: aproximadamente **78.53566310509333 L / CRITICO**. Em **5**, há **dois alertas**, um por estratégia; repetir qualquer uma mantém dois.
6. Usar **7** para o status, **0** para encerrar e executar novamente com o mesmo caminho. Consultar em **4** e **5**: dez leituras e dois alertas continuam presentes; executar as mesmas previsões mantém dois.
7. Usar **2**, tipo 1, mesmo id padrão, quantidade **1**. A nova leitura recebe o minuto lógico seguinte. Usar **3**, média móvel, N=5; **5** agora mostra um terceiro alerta. Alterar o limite de consumo para 20 L em **6** e reanalisar também permite novo alerta fundamentado, pois a configuração mudou.

A semente `Random(42)` é reiniciada a cada lote no console para tornar essa demonstração reproduzível. Ela usa as três classes de sensores existentes, dentro das faixas já documentadas. O padrão pode se repetir entre lotes: não representa observações físicas independentes ou uma série hidráulica real. O id pode ser personalizado na coleta; os ids padrão são `consumo-demo-1m`, `vazao-demo-1m` e `pressao-demo-1m`. Sensores legados são listados pelo catálogo para consulta, sem serem transformados em fontes ativas.

### Cadência e continuidade

O console usa `ColetaSimulada`: em série vazia, a primeira referência lógica é **2026-01-01T00:00:00-03:00**. Cada próxima amostra soma exatamente um minuto ao horário anterior. Para consumo, cada valor é o volume em uma janela simulada de um minuto; vazão e pressão são amostras nos mesmos passos lógicos. O horário não informa a data física em que a água foi usada. Horários dos alertas continuam sendo horários reais da execução da análise.

Ao reiniciar, a última leitura do H2 determina o próximo horário, inclusive quando uma série legada válida começou em outra data ou offset. A coleta não usa `Thread.sleep`, relógio de parede para espaçar chamadas instantâneas nem temporizadores. Valida primeiro a série completa, exige origem demonstrativa, mesmo tipo e cadência prévia de um minuto. Séries irregulares, com instantes repetidos, origem diferente ou outra cadência são preservadas e recusadas para continuação; escolher um novo id em **2** permite demonstrar sem apagar ou reescrever o histórico antigo. As previsões continuam recusando históricos inconsistentes, inclusive legados.

O lote é montado e validado antes da gravação. Fonte que falha durante a geração não grava parte do lote; erro SQL aciona rollback do lote inteiro quando possível, preservando a causa e qualquer falha de rollback. A coleta do console pressupõe **um escritor por série**; não coordena coletas simultâneas do mesmo id em processos diferentes. A unicidade de alertas, por outro lado, é garantida pelo banco também para análises concorrentes.

### Idempotência e migração

`ChaveAnalise` serializa o contexto com comprimentos explícitos de texto e calcula SHA-256. Entram na chave:

- versão das regras (`agro-agua-regras-v1`), nome da implementação da estratégia e tamanho N;
- as últimas N medições da média móvel ou 2N da comparação, em ordem: id, tipo, unidade, origem, valor e instante UTC;
- os quatro limiares de `DadosTerritorio`.

Não entram o texto da justificativa, o horário real da análise ou o nome da região. Portanto, a mesma análise permanece idempotente ao reiniciar. Novos horários/valores das leituras, outro sensor, outra estratégia, outro N ou outros limiares produzem novo contexto. Restaurar exatamente a configuração anterior, sem mudar a janela, continua sendo o contexto anterior e não duplica. Alterações apenas na região não mudam o cálculo. Os quatro limiares são considerados como uma única configuração; mudar qualquer um permite nova avaliação. A versão deve ser atualizada se uma futura revisão mudar a fórmula ou a política de níveis.

`Alerta` recebe chave opcional, preservando seu construtor anterior. O serviço preenche a chave nos alertas automáticos e chama o mesmo `AlertaDAO.salvar`. A inicialização acrescenta `chave_idempotencia VARCHAR(64)` e o índice único, sem remover ou alterar linhas antigas. Vários alertas legados podem ter chave nula. Não é possível reconstruir retroativamente estratégia e janela de alertas antigos que não guardavam esse contexto: eles são preservados; a primeira análise identificada de um contexto pode acrescentar um alerta novo, e as seguintes são deduplicadas. Chamadas manuais antigas sem chave continuam independentes; o console usa o caminho automático identificado.

A inserção concorrente é resolvida pela restrição única, sem depender de uma consulta prévia. Somente SQLState `23505`, com chave presente e alerta correspondente encontrado, é tratado como repetição e retorna o id original. Outros erros ou outro conflito de unicidade sem essa chave correspondente geram `PersistenciaException`. A operação repetida não altera o horário ou a justificativa já persistidos. A tela da análise apresenta o resultado calculado e confirma o alerta de forma neutra; a opção **5** mostra o registro persistido original.

A tabela `territorio` carrega a região e os limites ao reiniciar. O código didático não é persistido. O menu valida uma cópia da configuração, grava pelo DAO e só então troca a referência em memória; uma falha não substitui a configuração válida atual. Entrada inválida, código incorreto, histórico insuficiente, extrapolação fora de faixa, fonte indisponível e falha de banco têm mensagens próprias e devolvem o controle ao menu. Não há `catch` vazio.

### Testes e execução observada

Verificação em 10/11/2026 com JDK 21.0.10 e Maven 3.9.16: **`mvn clean verify` aprovado, 199 testes, 0 falhas, 0 erros, 0 ignorados**. Os 178 testes anteriores foram mantidos sem alteração; as 21 novas execuções são:

| Classe | Execuções | O que comprova |
| --- | --- | --- |
| `ColetaSimuladaTest` | 7 | Cadência de um minuto, continuidade após reabrir, preservação de legado, incompatibilidades, falha de fonte sem lote parcial, rollback e quantidade inválida. |
| `IdempotenciaAlertaTest` | 4 | Repetição/reabertura, mudanças legítimas de contexto, concorrência e erros de banco não mascarados. |
| `MigracaoConsoleTest` | 3 | Schema antigo sem chave migrado sem perda; configuração persistente e dados adulterados rejeitados. |
| `SistemaMonitoramentoTest` | 6 | Entrada/saída controladas: menu completo, coleta, consulta, ambas as previsões, erros, acesso incorreto, extrapolação, reabertura e EOF. |
| `ConsoleProcessoTest` | 1 | Duas JVMs executam o main real: dez leituras e dois alertas; repetição após reiniciar mantém dois; nova leitura permite o terceiro. |

Todos os testes H2 usam `@TempDir`; nenhum acessa `.data/` do usuário. O build compilou 33 arquivos de produção e 20 de teste. Também foi executado o comando `compile exec:java` com roteiro controlado e banco novo descartável em `target/`: dez leituras, média móvel 75.8891720424875 L, comparação 78.53566310509333 L e dois alertas após repetir a média móvel. Resultado **BUILD SUCCESS**, com saída UTF-8 legível. Não foram geradas capturas ou gravações.

Os arquivos de banco, cache Maven e `target/` continuam excluídos pelo `.gitignore` local do módulo. `mvn clean` remove somente os arquivos gerados em `target/`, não os bancos de `.data/`.

### Arquivos alterados nesta etapa

Criados: `SistemaMonitoramento`, `HistoricoMedicoes`, `ColetaSimulada`, `ChaveAnalise`, `DadosTerritorioDAO` e os cinco arquivos de testes listados acima. Modificados: `Alerta` (chave opcional), `DadosTerritorio` (região autorizada), `EstrategiaPrevisao` (delegação à validação extraída), `BancoH2` (migração aditiva), `MedicaoDAO` (lote e catálogo), `AlertaDAO` (deduplicação), `ServicoMonitoramento` (chave no alerta), `pom.xml` (execução) e este README. Não foram modificados outros módulos ou os testes anteriores.

## Pendências para a entrega acadêmica

Revisão humana do código e das decisões, completar os nomes/contribuições reais de participantes e preparar a apresentação seguindo o enunciado. O aluno deve conseguir explicar `super`, a execução polimórfica, a Simple Factory, a distinção entre tempo lógico e real, o rollback e por que uma restrição única garante idempotência após reiniciar. Não há compromisso de calibração física, autenticação de produção ou uso com sensores reais. Uma transação que precise vincular coleta e emissão de alertas atomicamente não foi implementada: são operações distintas do menu. Nenhum commit ou push foi realizado automaticamente.

## Reflexão sobre o recorte

Uma leitura simulada não comprova desperdício ou economia de água. Um sensor isolado tampouco representa toda a região. Antes de interpretar variações, será necessário considerar horários, duração da coleta, falhas e características da instalação. O sistema deve se abster de prever quando o histórico for insuficiente ou inconsistente; nesta versão, isso significa recusar séries insuficientes, inconsistentes ou projeções fora de faixa, sem forçar um resultado. Mesmo com histórico, os resultados devem apoiar a investigação humana e explicar os dados utilizados. As previsões e alertas atuais são heurísticas explicadas ao usuário, que deve investigar o contexto antes de agir. Não há garantia de risco real ou diagnóstico de vazamento.

## Uso de IA e revisão do aluno

O Codex foi utilizado para ler o README e o enunciado indicado, conferir o ambiente e a branch, propor a modelagem, implementar o núcleo da Etapa 1, a persistência JDBC/H2 da Etapa 2, as estratégias, Factory e serviço da Etapa 3 e o console, relógio lógico, migrações aditivas e deduplicação da Etapa 4, escrever testes (incluindo Mockito, fronteiras decimais, menu com entrada controlada, migração, concorrência e JVMs separadas), executar o Maven e documentar decisões. A verificação automatizada cobre apenas os comportamentos descritos acima; não demonstra compreensão do aluno, validação hidráulica ou conclusão da GS completa.

**Revisão do aluno: pendente.** O aluno deve revisar o código antes de assumir autoria da entrega e conseguir explicar: por que a classe base é abstrata; como os três sensores são usados pela mesma interface; como o código protege limiares sem atualização parcial; por que medição zero difere de fonte indisponível; como os parâmetros JDBC impedem SQL injetado; como o DAO reconstrói objetos validados; como o teste entre processos comprova a persistência; como as duas fórmulas diferem; por que a Factory centraliza a criação; e por que o sistema se abstém diante de dados inconsistentes ou previsões inválidas. Não foi afirmada revisão humana já realizada. Nesta etapa não há divisão de tarefas entre integrantes documentada; cabe ao aluno registrar participantes e contribuições reais na entrega final.
