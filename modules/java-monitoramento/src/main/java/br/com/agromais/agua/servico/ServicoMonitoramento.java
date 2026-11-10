package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.persistencia.AlertaDAO;
import br.com.agromais.agua.persistencia.MedicaoDAO;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

public final class ServicoMonitoramento {
    private final MedicaoDAO medicaoDAO;
    private final AlertaDAO alertaDAO;
    private final DadosTerritorio dados;
    private final EstrategiaPrevisao estrategia;

    /** Caminho configurado: a Factory é efetivamente utilizada para construir a estratégia. */
    public ServicoMonitoramento(MedicaoDAO medicaoDAO, AlertaDAO alertaDAO, DadosTerritorio dados,
                                TipoPrevisao tipo, int tamanhoJanela) {
        this(medicaoDAO, alertaDAO, dados, FabricaPrevisao.criar(tipo, tamanhoJanela));
    }

    /** Injeção da abstração permite mudar a estratégia sem alterar a execução do serviço. */
    public ServicoMonitoramento(MedicaoDAO medicaoDAO, AlertaDAO alertaDAO,
                                DadosTerritorio dados, EstrategiaPrevisao estrategia) {
        if (medicaoDAO == null || alertaDAO == null || dados == null || estrategia == null) {
            throw new DadosInvalidosException("DAOs, dados do território e estratégia são obrigatórios.");
        }
        this.medicaoDAO = medicaoDAO;
        this.alertaDAO = alertaDAO;
        this.dados = dados;
        this.estrategia = estrategia;
    }

    public ResultadoMonitoramento analisar(String sensorId) {
        if (sensorId == null || sensorId.isBlank()) {
            throw new DadosInvalidosException("Id do sensor é obrigatório para monitoramento.");
        }
        var historico = medicaoDAO.listarPorSensor(sensorId.strip());
        // Despacho polimórfico: nenhuma verificação da classe concreta da estratégia.
        ResultadoPrevisao previsao = estrategia.prever(sensorId.strip(), historico);
        Optional<Alerta> alerta = avaliar(previsao).map(a ->
                a.comChaveIdempotencia(ChaveAnalise.gerar(estrategia, historico, dados)));
        alerta.ifPresent(alertaDAO::salvar); // Falhas de gravação são propagadas, nunca sucesso aparente.
        return new ResultadoMonitoramento(previsao, alerta);
    }

    private Optional<Alerta> avaliar(ResultadoPrevisao previsao) {
        return switch (previsao.sensor().getTipo()) {
            case CONSUMO -> avaliarSuperior(previsao, dados.getLimiteConsumoLitros(), 0.10, 0.25);
            case VAZAO -> avaliarSuperior(previsao, dados.getLimiteVazaoLitrosPorMinuto(), 0.20, 0.50);
            case PRESSAO -> avaliarPressao(previsao);
        };
    }

    private Optional<Alerta> avaliarSuperior(ResultadoPrevisao previsao, double limite,
                                            double fracaoAlerta, double fracaoCritica) {
        if (previsao.valor() <= limite) {
            return Optional.empty();
        }
        NivelAlerta nivel = nivel(previsao.valor(), limite, BigDecimal.valueOf(limite), fracaoAlerta, fracaoCritica);
        return Optional.of(criarAlerta(previsao, limite, nivel, "superior"));
    }

    private Optional<Alerta> avaliarPressao(ResultadoPrevisao previsao) {
        double minima = dados.getPressaoMinimaBar();
        double maxima = dados.getPressaoMaximaBar();
        if (previsao.valor() >= minima && previsao.valor() <= maxima) {
            return Optional.empty();
        }
        boolean abaixo = previsao.valor() < minima;
        double limite = abaixo ? minima : maxima;
        // Usar a largura da faixa como referência também funciona quando a mínima é zero.
        BigDecimal largura = BigDecimal.valueOf(maxima).subtract(BigDecimal.valueOf(minima));
        NivelAlerta nivel = nivel(previsao.valor(), limite, largura, 0.10, 0.25);
        return Optional.of(criarAlerta(previsao, limite, nivel, abaixo ? "inferior" : "superior"));
    }

    private NivelAlerta nivel(double previsto, double limite, BigDecimal referencia,
                             double fracaoAlerta, double fracaoCritica) {
        // Comparar desvio com referência × fração, sem divisão ou arredondamento decimal.
        // Ex.: pressão 1.6, mínima 2 e faixa de largura 4: desvio 0.4 = exatamente 10%.
        BigDecimal desvio = BigDecimal.valueOf(previsto).subtract(BigDecimal.valueOf(limite)).abs();
        if (desvio.compareTo(referencia.multiply(BigDecimal.valueOf(fracaoCritica))) >= 0) {
            return NivelAlerta.CRITICO;
        }
        if (desvio.compareTo(referencia.multiply(BigDecimal.valueOf(fracaoAlerta))) >= 0) {
            return NivelAlerta.ALERTA;
        }
        return NivelAlerta.ATENCAO;
    }

    private Alerta criarAlerta(ResultadoPrevisao previsao, double limite, NivelAlerta nivel, String lado) {
        String justificativa = "Sensor " + previsao.sensor().getId() + " (" + previsao.sensor().getTipo()
                + "): previsão=" + previsao.valor() + " " + previsao.unidade()
                + "; limite " + lado + " violado=" + limite + " " + previsao.unidade()
                + "; nível=" + nivel + ". " + previsao.explicacao()
                + (previsao.sensor().isDemonstracao() ? " DEMONSTRAÇÃO: dados simulados." : "");
        return new Alerta(nivel, previsao.sensor(), previsao.valor(), limite, previsao.unidade(),
                justificativa, OffsetDateTime.now());
    }
}
