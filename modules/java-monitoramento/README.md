# Agro+ Água — monitoramento Java, Etapas 1 a 3

Módulo acadêmico independente da FIAP Global Solution POO 2026.2, na branch `feat/poo-java`. Público: comunidades rurais e responsáveis por sistemas coletivos de água. A proposta futura é apoiar a investigação de consumo elevado e possíveis desperdícios. Esta versão entrega domínio, sensores simulados, H2/JDBC em arquivo, duas estratégias polimórficas de previsão, Factory e geração automática de alertas fundamentados. Os resultados são demonstrações didáticas e não comprovam vazamentos. O menu de console permanece para a Etapa 4.

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

O primeiro uso precisa acessar o Maven Central. O repositório de dependências fica em `.m2/repository` dentro deste módulo; ele e `target/` estão ignorados no Git. O POM fixa Java 21, JUnit Jupiter **5.11.4**, Compiler **3.13.0** e Surefire **3.5.2**. A dependência de produção é **H2 2.4.240**, sem Spring, ORM ou pool de conexões. Os testes também usam **Mockito 5.14.2**, com agente explícito no Surefire para simular os DAOs finais sem alterar essas classes no Java 21. Referência: [documentação oficial do Mockito, seção 0.3](https://github.com/mockito/mockito/blob/v5.14.2/mockito-core/src/main/java/org/mockito/Mockito.java).

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

Arquivos em `src/main/java/br/com/agromais/agua/`, nos pacotes `dominio`, `excecao`, `persistencia` e `servico`.

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
| `EstrategiaPrevisao` | Base abstrata: janela, histórico mínimo e validação comum antes dos cálculos. |
| `PrevisaoMediaMovel` / `PrevisaoComparacao` | Sobrescrevem `prever()` com cálculos distintos e inicializam a base com `super(...)`. |
| `ResultadoPrevisao` | Record validado: sensor histórico, valor, unidade e explicação. |
| `TipoPrevisao` / `FabricaPrevisao` | Configuração e criação centralizada da estratégia concreta. |
| `ServicoMonitoramento` | Consulta o DAO, executa a estratégia abstrata, classifica e grava alertas. |
| `ResultadoMonitoramento` | Record com a previsão e `Optional<Alerta>` para distinguir resultado normal sem alerta de uma falha. |

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

Uma chamada representa uma amostra, sem temporizador, espera real ou agendador. Consumo, vazão e pressão são sorteados independentemente; não se deve inferir balanço hidráulico entre eles. As três implementações simuladas retornam `isDemonstracao() == true`, propagado à medição; `SensorHistorico` preserva a origem armazenada. `OffsetDateTime` guarda também o deslocamento UTC. A captura registra o horário após a leitura. O construtor permite horário explícito para testes e reconstrução pelo DAO.

O status do ponto expressa somente disponibilidade: lista vazia resulta em `SEM_SENSORES`; qualquer fonte configurada como inativa resulta em `FONTE_INDISPONIVEL`; caso contrário, `OPERACIONAL`. Não usa limiares nem classifica desperdício. `getStatus()` retorna a última verificação; `verificarStatus()` a atualiza.

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

`Alerta` não calcula previsão nem decide nível. Na Etapa 3, o serviço passa a fornecer esses dados; a criação manual da Etapa 2 continua disponível. Nível e justificativa são obrigatórios; previsão e limiar devem ser finitos e aceitos pelo `TipoSensor`, com unidade correspondente. Não se exige `previsao > limiar`, pois pressão abaixo do mínimo também poderá motivar alerta. As estratégias e a política automática da Etapa 3 são descritas abaixo.

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

A cadência exata é uma decisão conservadora desta demonstração: uma série irregular é rejeitada, sem interpolar, preencher lacunas ou reordenar. Capturas manuais com `now()` podem ter intervalos irregulares; a futura rotina de demonstração deverá fornecer horários de amostragem coerentes ou definir explicitamente uma política de reamostragem. Janelas são agrupamentos de N amostras, não filtros por calendário. Não há política de idade máxima do histórico nesta etapa; a estimativa se refere à sequência apresentada, sem alegar previsão atual de campo.

`DadosInvalidosException` informa histórico insuficiente com sensor, quantidade necessária e disponível. Inconsistências também geram erro explícito. Não se devolve zero ou uma previsão parcial. Uma projeção fora da faixa falha na construção de `ResultadoPrevisao`, com valor calculado, unidade e causa: **não há clamp, arredondamento corretivo ou gravação de alerta**. Exemplo: médias A=0 L e R=120 L produzem 240 L, que excedem a faixa aceita de 0 a 200 L; o serviço informa o erro e não emite alerta com valor artificialmente limitado a 200 L.

### Factory e polimorfismo

`FabricaPrevisao` implementa **Simple Factory**, centralizando em um único `switch` a criação por `TipoPrevisao`. Foi escolhida porque o chamador conhece a configuração desejada e não precisa conhecer construtores concretos nem repetir a escolha em vários locais. Não se trata de uma hierarquia de Factory Method.

O construtor configurado de `ServicoMonitoramento` chama a Factory de verdade. O campo e a execução do serviço usam somente `EstrategiaPrevisao` e `estrategia.prever(...)`, sem `instanceof` ou seleção por classe. Cada filha chama `super(tamanhoJanela, quantidadeJanelas)`, compartilha os invariantes da base e sobrescreve o cálculo. Um segundo construtor aceita a abstração pronta por injeção. Não foi necessário remover `final` ou reescrever os DAOs para usar Mockito.

### Regras de alerta

`analisar(sensorId)` consulta `MedicaoDAO`, executa a previsão e compara a grandeza com o limiar correspondente de `DadosTerritorio`. Um resultado normal contém a previsão e `Optional.empty()`; limites exatos são aceitos e não geram alerta. Um erro de histórico, previsão ou persistência é propagado, sem fingir sucesso.

| Sensor | Desvio considerado | ATENCAO | ALERTA | CRITICO |
| --- | --- | --- | --- | --- |
| Consumo | Excesso sobre o limite em L, dividido pelo próprio limite | >0 e <10% | >=10% e <25% | >=25% |
| Vazão | Excesso sobre o limite em L/min, dividido pelo próprio limite | >0 e <20% | >=20% e <50% | >=50% |
| Pressão | Distância abaixo da mínima ou acima da máxima em bar, dividida pela largura `(máxima − mínima)` | >0 e <10% | >=10% e <25% | >=25% |

As faixas são hipóteses didáticas para demonstrar regras distintas: a vazão instantânea admite uma variação proporcional maior que o consumo médio; pressão pode exigir atenção nos dois extremos. Não constituem normas hidráulicas e precisam de calibração com responsáveis pela instalação. Não se infere vazamento apenas porque o consumo ou a vazão cresceram. Vazão zero não é classificada como falha automaticamente, pois não há limite mínimo de vazão no domínio atual.

A largura da faixa de pressão é positiva pelas validações existentes, mesmo quando a mínima é zero. Previsão, limiar e unidade sempre correspondem ao mesmo tipo. A classificação compara decimalmente `desvio` com `referência × fração`, usando `BigDecimal.valueOf`, sem divisão ou arredondamento. Isso corrige a fronteira em que `2 − 1.6` com `double` ficava ligeiramente abaixo de 0.4, rebaixando indevidamente 10% de desvio. Os cálculos de previsão e os valores persistidos continuam sendo `double`; não há ajuste do resultado previsto para fazê-lo caber na faixa.

O alerta inclui sensor, tipo, valor previsto, unidade, limite inferior/superior violado, nível e a explicação da estratégia. Dados simulados são identificados como **DEMONSTRAÇÃO**. O horário do alerta é o horário da análise. A gravação usa o `AlertaDAO` já existente. Se falhar, `PersistenciaException` é propagada. Uma execução grava no máximo um alerta por sensor; executar novamente pode criar outro alerta para a mesma série. Deduplicação e prevenção de repetição ficam para uma política explícita futura.

### Uso sem menu

Com H2 no classpath do JShell mostrado acima, este exemplo opcional consulta o banco local existente e grava alerta somente quando fundamentado:

```java
import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.persistencia.*;
import br.com.agromais.agua.servico.*;
BancoH2 banco = new BancoH2();
DadosTerritorio dados = new DadosTerritorio("Região demo", "codigo-demo", 100, 100, 2, 6);
ServicoMonitoramento servico = new ServicoMonitoramento(new MedicaoDAO(banco), new AlertaDAO(banco), dados, TipoPrevisao.COMPARACAO, 5);
// Exige dez medições consistentes já gravadas para esse id; não insere amostras automaticamente.
ResultadoMonitoramento resultado = servico.analisar("consumo-manual-demo");
System.out.println(resultado.previsao().explicacao());
System.out.println(resultado.alerta().map(Alerta::getJustificativa).orElse("Sem alerta: previsão dentro dos limites."));
```

Se o banco contiver apenas a amostra do exemplo da Etapa 2, a análise falhará claramente por histórico insuficiente. Para uma demonstração completa reproduzível, sem popular ou modificar `.data/`, executar o teste H2:

```powershell
& "$env:USERPROFILE/Downloads/apache-maven-3.9.16/bin/mvn.cmd" "-Dmaven.repo.local=.m2/repository" "-Dtest=MonitoramentoH2Test" test
```

Esse teste grava dez amostras em arquivo temporário: cinco de 90 L e cinco de 120 L. Com limite 100 L, a média móvel prevê **120 L / ALERTA** e a comparação prevê **150 L / CRITICO**. Cada estratégia roda em um banco isolado e o alerta é recuperado após reabrir o arquivo. Também são testados pressão baixa, resultado normal, ausência de histórico, identidade reutilizada com tipo diferente e extrapolação inválida, sem alerta indevido.

### Validação da Etapa 3

`mvn "-Dmaven.repo.local=.m2/repository" clean verify` em 10/11/2026, JDK 21.0.10 e Maven 3.9.16: **BUILD SUCCESS — 178 testes, 0 falhas, 0 erros e 0 ignorados**. Os 110 anteriores continuam aprovados; foram adicionadas 68 execuções em quatro classes:

| Classe | Execuções | Evidência |
| --- | --- | --- |
| `PrevisoesTest` | 28 | Resultados conhecidos, últimas janelas, polimorfismo, mínimos, metadados e cadência, unidades inválidas e projeções fora de faixa. |
| `FabricaPrevisaoTest` | 3 | Seleção por configuração, janela e configuração inválida. |
| `ServicoMonitoramentoTest` | 31 | Mockito simula ambos os DAOs: três níveis por tipo, limites e fronteiras decimais, ausência de alerta, falhas propagadas, alteração autorizada de limiares e captura do alerta salvo. Não abre banco. |
| `MonitoramentoH2Test` | 6 | Duas estratégias sobre H2, alerta persistido e reaberto, pressão baixa e ausência de alertas infundados. |

O teste Mockito usa `ArgumentCaptor`, verifica a ordem consulta/gravação e confirma ausência de chamadas de gravação nos casos rejeitados. Os testes são AAA. O build compilou 28 arquivos de produção e 15 de teste. Relatórios ficam em `target/surefire-reports/`, ignorados pelo Git. A única extensão de uma classe antiga foi um construtor com causa em `DadosInvalidosException`, necessário para informar a projeção inválida sem perder o erro de validação original; DAOs e as classes de dados anteriores foram preservados.

## Preparação para Etapa 4

Integrar o menu de console para configurar a estratégia, capturar medições, consultar histórico e analisar sensores. Capturar exceções com mensagens úteis, sem engolir erros. A demonstração de série deve usar cadência coerente; definir também a política de repetição de alertas e a exibição das limitações do histórico. Não há menu ou agendador nesta entrega. As gravações JDBC continuam independentes; uma operação futura que precise gravar medição e alerta atomicamente exigirá transação compartilhada.

## Reflexão sobre o recorte

Uma leitura simulada não comprova desperdício ou economia de água. Um sensor isolado tampouco representa toda a região. Antes de interpretar variações, será necessário considerar horários, duração da coleta, falhas e características da instalação. O sistema deve se abster de prever quando o histórico for insuficiente ou inconsistente; nesta versão, isso significa recusar séries insuficientes, inconsistentes ou projeções fora de faixa, sem forçar um resultado. Mesmo com histórico, os resultados devem apoiar a investigação humana e explicar os dados utilizados. As previsões e alertas atuais são heurísticas explicadas ao usuário, que deve investigar o contexto antes de agir. Não há garantia de risco real ou diagnóstico de vazamento.

## Uso de IA e revisão do aluno

O Codex foi utilizado para ler o README e o enunciado indicado, conferir o ambiente e a branch, propor a modelagem, implementar o núcleo da Etapa 1, a persistência JDBC/H2 da Etapa 2 e as estratégias, Factory e serviço da Etapa 3, escrever testes (incluindo Mockito, fronteiras decimais e JVMs separadas), executar o Maven e documentar decisões. A verificação automatizada cobre apenas os comportamentos descritos acima; não demonstra compreensão do aluno, validação hidráulica ou conclusão da GS completa.

**Revisão do aluno: pendente.** O aluno deve revisar o código antes de assumir autoria da entrega e conseguir explicar: por que a classe base é abstrata; como os três sensores são usados pela mesma interface; como o código protege limiares sem atualização parcial; por que medição zero difere de fonte indisponível; como os parâmetros JDBC impedem SQL injetado; como o DAO reconstrói objetos validados; como o teste entre processos comprova a persistência; como as duas fórmulas diferem; por que a Factory centraliza a criação; e por que o sistema se abstém diante de dados inconsistentes ou previsões inválidas. Não foi afirmada revisão humana já realizada. Nesta etapa não há divisão de tarefas entre integrantes documentada; cabe ao aluno registrar participantes e contribuições reais na entrega final.
