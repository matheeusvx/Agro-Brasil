package br.com.agromais.agua;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.*;
import br.com.agromais.agua.persistencia.*;
import br.com.agromais.agua.servico.*;
import java.io.PrintWriter;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Random;
import java.util.Scanner;

/** Adapta entrada/saída do console; regras de domínio e JDBC permanecem nas respectivas camadas. */
public final class SistemaMonitoramento {
    public static final String CODIGO_DEMONSTRACAO = "AGRO-AGUA";
    private final Scanner entrada;
    private final PrintWriter saida;
    private final MedicaoDAO medicoes;
    private final AlertaDAO alertas;
    private final DadosTerritorioDAO territorio;
    private DadosTerritorio dados;

    public SistemaMonitoramento(Scanner entrada, PrintWriter saida, BancoH2 banco) {
        if (entrada == null || saida == null || banco == null) {
            throw new DadosInvalidosException("Entrada, saída e banco são obrigatórios.");
        }
        this.entrada = entrada;
        this.saida = saida;
        medicoes = new MedicaoDAO(banco);
        alertas = new AlertaDAO(banco);
        territorio = new DadosTerritorioDAO(banco);
        dados = territorio.carregar(CODIGO_DEMONSTRACAO);
    }

    public static void main(String[] argumentos) {
        PrintWriter saida = new PrintWriter(new OutputStreamWriter(System.out, StandardCharsets.UTF_8), true);
        try (Scanner entrada = new Scanner(System.in, StandardCharsets.UTF_8)) {
            if (argumentos.length > 1) throw new DadosInvalidosException("Informe somente o caminho-base opcional do H2.");
            BancoH2 banco = argumentos.length == 0 ? new BancoH2() : new BancoH2(Path.of(argumentos[0]));
            new SistemaMonitoramento(entrada, saida, banco).executar();
        } catch (DadosInvalidosException | PersistenciaException | java.nio.file.InvalidPathException erro) {
            saida.println("Não foi possível iniciar: " + erro.getMessage());
        }
    }

    public void executar() {
        saida.println("AGRO+ ÁGUA — DEMONSTRAÇÃO. Leituras e tempo de amostragem são SIMULADOS.");
        while (true) {
            saida.println("""

                    1. Verificar funcionamento dos sensores
                    2. Coletar medições simuladas e armazenar
                    3. Executar previsões
                    4. Consultar histórico por sensor
                    5. Consultar alertas emitidos
                    6. Gerenciar região e limiares
                    7. Exibir status completo
                    0. Encerrar""");
            try {
                switch (linha("Opção: ").strip()) {
                    case "1" -> verificarSensores();
                    case "2" -> coletar();
                    case "3" -> prever();
                    case "4" -> historico();
                    case "5" -> exibirAlertas();
                    case "6" -> configurar();
                    case "7" -> status();
                    case "0" -> { saida.println("Encerrado. Registros preservados no H2."); return; }
                    default -> saida.println("Opção inválida. Escolha um número de 0 a 7.");
                }
            } catch (DadosInvalidosException erro) {
                saida.println("Dados inválidos: " + erro.getMessage());
            } catch (FonteIndisponivelException erro) {
                saida.println("Fonte indisponível: " + erro.getMessage());
            } catch (PersistenciaException erro) {
                saida.println("Falha de persistência: " + erro.getMessage() + " Não foi confirmado sucesso da operação.");
            } catch (SecurityException erro) {
                saida.println("Acesso negado: " + erro.getMessage());
            } catch (NoSuchElementException erro) {
                saida.println("Entrada encerrada. Registros preservados no H2.");
                return;
            }
        }
    }

    private void verificarSensores() {
        List<Sensor> sensores = List.of(criarSensor(TipoSensor.CONSUMO, idPadrao(TipoSensor.CONSUMO)),
                criarSensor(TipoSensor.VAZAO, idPadrao(TipoSensor.VAZAO)), criarSensor(TipoSensor.PRESSAO, idPadrao(TipoSensor.PRESSAO)));
        ComponenteTerritorial ponto = new PontoMonitoramento("ponto-console", "Ponto demonstrativo", dados.getRegiao(), sensores);
        for (Sensor sensor : sensores) {
            saida.println(sensor.getId() + " | " + sensor.getTipo() + " | " + sensor.getTipo().getUnidade()
                    + " | funcionamento=" + sensor.verificarFuncionamento() + " | DEMONSTRAÇÃO");
        }
        saida.println("Ponto: " + ponto.verificarStatus() + ". Verificação da configuração simulada, não diagnóstico físico.");
    }

    private void coletar() {
        int opcao = inteiro("Tipo: 1=consumo, 2=vazão, 3=pressão: ", -1);
        TipoSensor tipo = switch (opcao) {
            case 1 -> TipoSensor.CONSUMO;
            case 2 -> TipoSensor.VAZAO;
            case 3 -> TipoSensor.PRESSAO;
            default -> throw new DadosInvalidosException("Tipo de sensor deve ser 1, 2 ou 3.");
        };
        String id = linha("Id do sensor (Enter=" + idPadrao(tipo) + "): ").strip();
        if (id.isEmpty()) id = idPadrao(tipo);
        int quantidade = inteiro("Quantidade de minutos/amostras SIMULADOS (Enter=10; máximo 1000): ", 10);
        var lote = new ColetaSimulada(medicoes).coletar(criarSensor(tipo, id), quantidade);
        saida.println("Gravadas " + lote.size() + " leituras de DEMONSTRAÇÃO. Cadência: 1 minuto SIMULADO; sem espera real.");
        lote.forEach(this::exibirMedicao);
    }

    private void prever() {
        catalogo();
        String id = linha("Id do sensor: ").strip();
        TipoPrevisao tipo = switch (inteiro("Estratégia: 1=média móvel, 2=comparação: ", -1)) {
            case 1 -> TipoPrevisao.MEDIA_MOVEL;
            case 2 -> TipoPrevisao.COMPARACAO;
            default -> throw new DadosInvalidosException("Estratégia deve ser 1 ou 2.");
        };
        int janela = inteiro("Amostras por janela N (Enter=5; mínimo 5): ", 5);
        var resultado = new ServicoMonitoramento(medicoes, alertas, dados, tipo, janela).analisar(id);
        var previsao = resultado.previsao();
        saida.println("Sensor " + id + " | " + tipo + " | leituras=" + medicoes.listarPorSensor(id).size()
                + " | estimativa=" + previsao.valor() + " " + previsao.unidade()
                + " | origem=" + (previsao.sensor().isDemonstracao() ? "DEMONSTRAÇÃO" : "não demonstrativa"));
        saida.println(previsao.explicacao());
        resultado.alerta().ifPresentOrElse(a -> {
            saida.println("Alerta confirmado no H2 (análise repetida não duplica o registro): " + a.getNivel());
            saida.println(a.getJustificativa());
        }, () -> saida.println("Sem alerta: previsão dentro dos limites."));
    }

    private void historico() {
        catalogo();
        String id = linha("Id do sensor: ").strip();
        var registros = medicoes.listarPorSensor(id);
        saida.println("Histórico de " + id + ": " + registros.size() + " leituras.");
        registros.forEach(this::exibirMedicao);
    }

    private void exibirMedicao(Medicao medicao) {
        saida.println(medicao.getSensorId() + " | " + medicao.getTipo() + " | " + medicao.getValor() + " "
                + medicao.getUnidade() + " | tempo da amostra=" + medicao.getDataHora()
                + " | " + (medicao.isDemonstracao() ? "DEMONSTRAÇÃO / tempo simulado ou legado" : "origem não demonstrativa"));
    }

    private void exibirAlertas() {
        var registros = alertas.listarTodos();
        saida.println("Alertas persistidos: " + registros.size());
        for (Alerta alerta : registros) {
            saida.println(alerta.getSensorId() + " | " + alerta.getNivel() + " | previsão=" + alerta.getPrevisao()
                    + " " + alerta.getUnidade() + " | limiar=" + alerta.getLimiar() + " " + alerta.getUnidade()
                    + " | horário REAL da análise=" + alerta.getDataHora()
                    + " | " + (alerta.isDemonstracao() ? "DEMONSTRAÇÃO" : "não demonstrativo"));
            saida.println(alerta.getJustificativa());
        }
    }

    private void configurar() {
        exibirDados();
        String opcao = linha("1=alterar região, 2=alterar limiares, 0=voltar: ").strip();
        if (opcao.equals("0")) return;
        if (!opcao.equals("1") && !opcao.equals("2")) throw new DadosInvalidosException("Opção de configuração inválida.");
        String codigo = linha("Código de acesso da demonstração: ");
        var proposta = new DadosTerritorio(dados.getRegiao(), CODIGO_DEMONSTRACAO,
                dados.getLimiteConsumoLitros(), dados.getLimiteVazaoLitrosPorMinuto(), dados.getPressaoMinimaBar(), dados.getPressaoMaximaBar());
        if (opcao.equals("1")) {
            proposta.alterarRegiao(codigo, linha("Nova região: "));
        } else {
            proposta.alterarLimiares(codigo, numero("Limite consumo (L na janela de um minuto): "),
                    numero("Limite vazão (L/min): "), numero("Pressão mínima (bar): "), numero("Pressão máxima (bar): "));
        }
        territorio.salvar(proposta); // Só troca a configuração em memória após confirmar a gravação.
        dados = proposta;
        saida.println("Configuração salva no H2.");
        exibirDados();
    }

    private void exibirDados() {
        saida.println("Região: " + dados.getRegiao() + " | consumo=" + dados.getLimiteConsumoLitros()
                + " L/minuto simulado | vazão=" + dados.getLimiteVazaoLitrosPorMinuto() + " L/min"
                + " | pressão=" + dados.getPressaoMinimaBar() + " a " + dados.getPressaoMaximaBar() + " bar");
    }

    private void catalogo() {
        saida.println("Sugestões: consumo-demo-1m, vazao-demo-1m, pressao-demo-1m.");
        for (Sensor sensor : medicoes.listarSensores()) {
            saida.println("Sensor persistido: " + sensor.getId() + " | " + sensor.getTipo()
                    + " | " + (sensor.isDemonstracao() ? "DEMONSTRAÇÃO" : "não demonstrativo"));
        }
    }

    private void status() {
        exibirDados();
        verificarSensores();
        for (Sensor sensor : medicoes.listarSensores()) {
            var registros = medicoes.listarPorSensor(sensor.getId());
            saida.println("Sensor persistido " + sensor.getId() + " | " + sensor.getTipo().getUnidade()
                    + " | leituras=" + registros.size() + " | última amostra=" + registros.getLast().getDataHora());
            try {
                HistoricoMedicoes.validar(sensor.getId(), registros);
                saida.println("Série consistente; mínimos: média móvel N, comparação 2N (N>=5).");
            } catch (DadosInvalidosException erro) {
                saida.println("Série inconsistente, preservada: " + erro.getMessage());
            }
        }
        saida.println("Alertas persistidos: " + alertas.listarTodos().size());
    }

    private static String idPadrao(TipoSensor tipo) { return tipo.name().toLowerCase(Locale.ROOT) + "-demo-1m"; }

    private static Sensor criarSensor(TipoSensor tipo, String id) {
        // Semente fixa por lote: demonstração reproduzível, sem alegar dados físicos independentes.
        return switch (tipo) {
            case CONSUMO -> new SensorConsumo(id, true, new Random(42));
            case VAZAO -> new SensorVazao(id, true, new Random(42));
            case PRESSAO -> new SensorPressao(id, true, new Random(42));
        };
    }

    private String linha(String mensagem) {
        saida.print(mensagem);
        saida.flush();
        if (!entrada.hasNextLine()) throw new NoSuchElementException("Fim da entrada.");
        return entrada.nextLine();
    }

    private int inteiro(String mensagem, int padrao) {
        String valor = linha(mensagem).strip();
        if (valor.isEmpty()) return padrao;
        try {
            return Integer.parseInt(valor);
        } catch (NumberFormatException causa) {
            throw new DadosInvalidosException("Informe um número inteiro válido.", causa);
        }
    }

    private double numero(String mensagem) {
        try {
            return Double.parseDouble(linha(mensagem).strip().replace(',', '.'));
        } catch (NumberFormatException causa) {
            throw new DadosInvalidosException("Informe um número decimal válido, sem separador de milhar.", causa);
        }
    }
}
