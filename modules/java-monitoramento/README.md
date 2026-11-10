# Agro+ Água — domínio e persistência Java, Etapas 1 e 2

Módulo acadêmico independente da FIAP Global Solution POO 2026.2, na branch `feat/poo-java`. Público: comunidades rurais e responsáveis por sistemas coletivos de água. A proposta futura é apoiar a investigação de consumo elevado e possíveis desperdícios. Esta versão entrega o domínio, sensores simulados, o modelo de alerta e persistência real H2/JDBC em arquivo. Não calcula previsões, identifica vazamentos ou emite alertas automaticamente: os alertas desta etapa são informados explicitamente pelo chamador.

## Ambiente e reprodução

Requer **JDK 21** e **Maven 3.9.x**. Não depende de Flutter, Next.js, Node.js, Express ou servidor de banco de dados. H2 é embarcado e executa dentro do processo Java. Na raiz do repositório, em PowerShell:

```powershell
Set-Location modules/java-monitoramento
java -version
mvn -version
mvn "-Dmaven.repo.local=.m2/repository" compile
mvn "-Dmaven.repo.local=.m2/repository" clean verify
```

No ambiente verificado em 10/11/2026: Oracle JDK 21.0.10; Maven 3.9.16 instalado em Downloads, fora do PATH. Nesse computador, substituir `mvn` por:

```powershell
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" compile
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" clean verify
```

O primeiro uso precisa acessar o Maven Central. O repositório de dependências fica em `.m2/repository` dentro deste módulo; ele e `target/` estão ignorados no Git. O POM fixa Java 21, JUnit Jupiter **5.11.4**, Compiler **3.13.0** e Surefire **3.5.2**. A dependência de produção é **H2 2.4.240**, sem Spring, ORM ou pool de conexões.

O build gera `target/agua-monitoramento-0.1.0-SNAPSHOT.jar`, uma biblioteca sem classe principal; não executar com `java -jar`. Os testes exercitam a captura de leituras. Para experimentar manualmente após compilar:

```powershell
jshell --class-path target/classes
```

No JShell:

```java
import br.com.agromais.agua.dominio.*;
import java.util.List;
Sensor sensor = new SensorConsumo("consumo-demo-1");
Medicao medicao = Medicao.capturar(sensor);
System.out.println("DEMONSTRAÇÃO: " + medicao.getValor() + " " + medicao.getUnidade() + " em " + medicao.getDataHora());
ComponenteTerritorial ponto = new PontoMonitoramento("ponto-demo-1", "Reservatório demonstrativo", "Região demonstrativa", List.of(sensor));
System.out.println(ponto.verificarStatus());
DadosTerritorio dados = new DadosTerritorio("Região demonstrativa", "codigo-demo", 150, 100, 1, 5);
dados.alterarLimiares("codigo-demo", 120, 90, 1, 4);
/exit
```

## Classes e responsabilidades

Arquivos em `src/main/java/br/com/agromais/agua/`, nos pacotes `dominio`, `excecao` e `persistencia`.

| Elemento | Responsabilidade |
| --- | --- |
| `ComponenteTerritorial` | Classe abstrata com id, nome, região, status e contrato `verificarStatus()`. |
| `PontoMonitoramento` | Herda o componente e verifica a disponibilidade de seus sensores. Copia a lista recebida e impede ids duplicados no ponto. |
| `Sensor` | Interface para identificação, tipo, leitura, funcionamento e origem demonstrativa. |
| `SensorConsumo` | Simula volume consumido na janela fixa de um minuto, em L. |
| `SensorVazao` | Simula vazão instantânea em L/min. |
| `SensorPressao` | Simula pressão instantânea em bar. |
| `DadosTerritorio` | Encapsula região, código de acesso e quatro limiares; alterações autorizadas e validadas em conjunto. |
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

Consumo é volume da janela de um minuto, não hidrômetro acumulado. Seu limiar usa L na mesma janela; vazão usa L/min e pressão usa bar. Limites de consumo e vazão devem ser positivos e não exceder 200; pressão deve obedecer `0 <= mínima < máxima <= 10`. Valores que ultrapassem limiares configurados ainda podem ser medições válidas: a avaliação de risco fica para outra etapa.

Uma chamada representa uma amostra, sem temporizador, espera real ou agendador. Consumo, vazão e pressão são sorteados independentemente; não se deve inferir balanço hidráulico entre eles. As três implementações simuladas retornam `isDemonstracao() == true`, propagado à medição; `SensorHistorico` preserva a origem armazenada. `OffsetDateTime` guarda também o deslocamento UTC. A captura registra o horário após a leitura. O construtor permite horário explícito para testes e reconstrução pelo DAO.

O status do ponto expressa somente disponibilidade: lista vazia resulta em `SEM_SENSORES`; qualquer fonte configurada como inativa resulta em `FONTE_INDISPONIVEL`; caso contrário, `OPERACIONAL`. Não usa limiares nem classifica desperdício. `getStatus()` retorna a última verificação; `verificarStatus()` a atualiza.

## Validação automatizada

As quatro classes originais de testes JUnit 5 em `src/test/java/br/com/agromais/agua/dominio`, com Arrange, Act, Assert identificados nos métodos:

- `SensoresTest`: três tipos pela mesma interface, unidades, identificação de demonstração, mil amostras por sensor com semente fixa, indisponibilidade, falha de gerador com causa, valor não finito e gerador ausente.
- `MedicaoTest`: metadados, horário de captura, limites inclusivos, valores negativos/não finitos/fora de faixa, unidades incompatíveis e campos obrigatórios.
- `DadosTerritorioTest`: autorização, comparação exata do código, alteração válida e preservação integral dos limiares após tentativa inválida.
- `PontoMonitoramentoTest`: herança e despacho polimórfico, status, isolamento da lista, ids duplicados e dados obrigatórios.

`assertThrows` verifica as duas exceções personalizadas. Os testes de persistência usam H2 real em arquivo; Mockito para a futura lógica automática de alertas permanece pendente para a Etapa 3. Os testes parametrizados contam cada combinação como uma execução. Relatórios detalhados ficam em `target/surefire-reports/`.

Verificação em 10/11/2026 com JDK 21.0.10 e Maven 3.9.16: `compile` aprovado e verificação final `clean verify` aprovada também com `-o` (offline, após baixar dependências). Resultado: **68 testes, 0 falhas, 0 erros, 0 ignorados**, em quatro classes (23 de território, 21 de medição, 8 de ponto e 16 de sensores). O build compilou 13 arquivos de produção e 4 de teste e gerou o JAR. O executor precisou liberar o Maven das restrições de acesso do sandbox para baixar e ler os JARs; a execução final foi offline.

## Persistência H2/JDBC — Etapa 2

`new BancoH2()` usa o caminho-base `.data/agro-agua`, relativo ao diretório de execução, criando `.data/agro-agua.mv.db`. Para evitar depender do diretório atual, usar `new BancoH2(Path.of("caminho/absoluto/agro-agua"))`. O argumento é um caminho-base sem `.mv.db`, não uma URL JDBC. Diretórios ausentes são criados. `;` e caracteres de controle são rejeitados para não permitir opções JDBC no caminho.

O banco é local, embarcado, com usuário `sa` e senha vazia para esta demonstração acadêmica. Não há servidor, console H2 ou conexão externa. `BancoH2` não mantém recursos abertos: cada DAO abre e fecha sua própria conexão. Ao fechar a última conexão, o H2 encerra o banco e mantém o arquivo. Para reabrir, fornecer exatamente o mesmo caminho.

A inicialização executa somente `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`. Não usa `DROP`, `TRUNCATE`, recriação de schema, carga de demonstração ou limpeza automática. O comando Maven `clean` exclui `target/`, sem afetar `.data/`. Alterações futuras no formato das tabelas precisarão de migração explícita; `IF NOT EXISTS` não migra uma tabela já existente.

### Tabelas

Todos os campos abaixo são `NOT NULL`. As chaves são `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`.

| Tabela | Colunas além de `id` |
| --- | --- |
| `medicao` | `sensor_id VARCHAR`, `tipo VARCHAR`, `demonstracao BOOLEAN`, `valor DOUBLE PRECISION`, `unidade VARCHAR`, `data_hora TIMESTAMP(9) WITH TIME ZONE` |
| `alerta` | `sensor_id VARCHAR`, `tipo VARCHAR`, `demonstracao BOOLEAN`, `nivel VARCHAR`, `previsao DOUBLE PRECISION`, `limiar DOUBLE PRECISION`, `unidade VARCHAR`, `justificativa VARCHAR`, `data_hora TIMESTAMP(9) WITH TIME ZONE` |

Cada tabela tem um índice `(sensor_id, data_hora, id)`. Textos são Unicode, sem um limite pequeno artificial que corte identificadores ou justificativas aceitos no domínio. `DOUBLE PRECISION` corresponde ao `double` já utilizado. JDBC usa `setObject(OffsetDateTime)` e `getObject(..., OffsetDateTime.class)`, sem conversão por relógio local ou texto. A precisão 9 preserva nanossegundos e o offset original; a ordenação é pelo instante, inclusive com offsets diferentes. Empates são resolvidos pelo id crescente.

Fontes consultadas: [H2 — bancos em arquivo e fechamento](https://h2database.com/html/features.html#database_url) e [H2 — tipos de dados e TIMESTAMP WITH TIME ZONE](https://h2database.com/html/datatypes.html#timestamp_with_time_zone).

### Operações e validações

- `MedicaoDAO.salvar(Medicao)` e `AlertaDAO.salvar(Alerta)` inserem uma linha e retornam o id gerado. Cada chamada usa autocommit, sem alterar registros anteriores; chamadas repetidas representam inserções distintas.
- `MedicaoDAO.listarPorSensor(String)` filtra por id. `AlertaDAO.listarPorSensor(String)` filtra por id e `listarTodos()` consulta todos. Todos retornam listas não modificáveis, em ordem cronológica crescente; histórico ausente retorna lista vazia.
- Todo SQL é fixo. Os valores entram exclusivamente por parâmetros `?` de `PreparedStatement`. A concatenação no código ocorre apenas na montagem do caminho da URL H2, não na construção de SQL com dados.
- Conexões, statements, resultados e chaves geradas usam `try-with-resources`. Erros SQL são propagados como `PersistenciaException` com a causa original, sem fallback para memória ou histórico vazio.
- Os DAOs recebem objetos já validados e reconstroem pelo construtor do domínio. As regras de faixa, unidade e conteúdo permanecem no domínio; não há cópia dessas regras numéricas em SQL. As tabelas protegem a estrutura com chave e `NOT NULL`. Escrita SQL externa pode adulterar regras de negócio; se isso ocorrer, a consulta falha explicitamente ao reconstruir o registro inválido, em vez de entregá-lo como válido.

O sensor é armazenado como um retrato de id, tipo e origem demonstrativa em cada registro. Não há cadastro/tabela de sensores ou pontos nesta etapa. Usar ids estáveis e distintos para equipamentos distintos, inclusive em regiões diferentes; o DAO não atribui um id novo ao sensor. A referência carregada é um `SensorHistorico`, que preserva os metadados e lança `FonteIndisponivelException` se alguém tentar capturar nova leitura. A disponibilidade e a semente do gerador não representam histórico e não são persistidas. As classes originais da Etapa 1 e seus quatro arquivos de testes foram mantidos.

`Alerta` não calcula previsão nem decide nível. O chamador fornece nível e justificativa obrigatórios; previsão e limiar devem ser finitos e aceitos pelo `TipoSensor`, com unidade correspondente. Não se exige `previsao > limiar`, pois pressão abaixo do mínimo também poderá motivar alerta. Nenhuma estratégia ou política automática de alerta foi implementada.

### Exemplo manual em duas sessões

Após compilar, iniciar JShell com H2 no classpath, a partir da pasta deste módulo:

```powershell
jshell --class-path "target/classes;.m2/repository/com/h2database/h2/2.4.240/h2-2.4.240.jar"
```

Primeira sessão (grava dados demonstrativos no arquivo local, sem apagar o que já existir):

```java
import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.persistencia.*;
import java.time.OffsetDateTime;
BancoH2 banco = new BancoH2();
Sensor sensor = new SensorConsumo("consumo-manual-demo");
new MedicaoDAO(banco).salvar(new Medicao(sensor, 61.25, "L", OffsetDateTime.now()));
new AlertaDAO(banco).salvar(new Alerta(NivelAlerta.ALERTA, sensor, 80, 60, "L", "DEMONSTRAÇÃO: projeção informada manualmente", OffsetDateTime.now()));
/exit
```

Iniciar JShell novamente com o mesmo classpath e diretório. Segunda sessão:

```java
import br.com.agromais.agua.persistencia.*;
BancoH2 banco = new BancoH2();
new MedicaoDAO(banco).listarPorSensor("consumo-manual-demo").forEach(m -> System.out.println("DEMONSTRAÇÃO: " + m.getValor() + " " + m.getUnidade() + " em " + m.getDataHora()));
new AlertaDAO(banco).listarPorSensor("consumo-manual-demo").forEach(a -> System.out.println(a.getNivel() + ": " + a.getPrevisao() + " / " + a.getLimiar() + " " + a.getUnidade() + " — " + a.getJustificativa()));
/exit
```

O exemplo manual é opcional; a validação automatizada não o executa nem acessa `.data/` do usuário. Não há menu completo ou entrypoint de produção.

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

## Preparação para Etapa 3

Os DAOs e os objetos recuperados estão prontos para uma camada de serviço consultar histórico e persistir os futuros alertas. Ainda faltam as estratégias polimórficas de previsão, a política de níveis/limiares, o padrão criacional justificado, o teste Mockito da lógica sem banco e o menu com tratamento de erros. Não foram antecipados nesta entrega. Se houver uma operação futura que precise salvar medição e alerta de forma atômica, ela precisará compartilhar uma conexão e controlar uma transação: hoje as gravações são independentes.

## Reflexão sobre o recorte

Uma leitura simulada não comprova desperdício ou economia de água. Um sensor isolado tampouco representa toda a região. Antes de interpretar variações, será necessário considerar horários, duração da coleta, falhas e características da instalação. O sistema deve se abster de prever quando o histórico for insuficiente ou inconsistente; os critérios serão definidos junto das estratégias futuras. Mesmo com histórico, os resultados devem apoiar a investigação humana e explicar os dados utilizados. Nesta versão não há cálculo de previsão ou recomendação automática; o alerta armazenado é um registro informado explicitamente.

## Uso de IA e revisão do aluno

O Codex foi utilizado para ler o README e o enunciado indicado, conferir o ambiente e a branch, propor a modelagem, implementar o núcleo da Etapa 1 e a persistência JDBC/H2 da Etapa 2, escrever testes (incluindo JVMs separadas), executar o Maven e documentar decisões. A verificação automatizada cobre apenas os comportamentos descritos acima; não demonstra compreensão do aluno, validação hidráulica ou conclusão da GS completa.

**Revisão do aluno: pendente.** O aluno deve revisar o código antes de assumir autoria da entrega e conseguir explicar: por que a classe base é abstrata; como os três sensores são usados pela mesma interface; como o código protege limiares sem atualização parcial; por que medição zero difere de fonte indisponível; como os parâmetros JDBC impedem SQL injetado; como o DAO reconstrói objetos validados; e como o teste entre processos comprova a persistência. Não foi afirmada revisão humana já realizada. Nesta etapa não há divisão de tarefas entre integrantes documentada; cabe ao aluno registrar participantes e contribuições reais na entrega final.
