package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.time.OffsetDateTime;

/** Leitura imutável, com metadados copiados da fonte e horário com deslocamento UTC. */
public final class Medicao {
    private final Sensor sensor;
    private final String sensorId;
    private final TipoSensor tipo;
    private final double valor;
    private final String unidade;
    private final OffsetDateTime dataHora;
    private final boolean demonstracao;

    public Medicao(Sensor sensor, double valor, String unidade, OffsetDateTime dataHora) {
        if (sensor == null || sensor.getTipo() == null || dataHora == null) {
            throw new DadosInvalidosException("Sensor, tipo e data/hora são obrigatórios.");
        }
        this.sensorId = Validacao.texto(sensor.getId(), "Id do sensor");
        this.tipo = sensor.getTipo();
        tipo.validarValor(valor);
        if (!tipo.getUnidade().equals(unidade)) {
            throw new DadosInvalidosException("Unidade esperada para " + tipo + ": " + tipo.getUnidade() + ".");
        }
        this.sensor = sensor;
        this.valor = valor;
        this.unidade = unidade;
        this.dataHora = dataHora;
        this.demonstracao = sensor.isDemonstracao();
    }

    /** Obtém uma leitura agora. Falhas da fonte são propagadas, sem inventar valor zero. */
    public static Medicao capturar(Sensor sensor) {
        if (sensor == null || sensor.getTipo() == null) {
            throw new DadosInvalidosException("Sensor e tipo são obrigatórios para capturar a medição.");
        }
        double valor = sensor.lerValor();
        return new Medicao(sensor, valor, sensor.getTipo().getUnidade(), OffsetDateTime.now());
    }

    public Sensor getSensor() { return sensor; }
    public String getSensorId() { return sensorId; }
    public TipoSensor getTipo() { return tipo; }
    public double getValor() { return valor; }
    public String getUnidade() { return unidade; }
    public OffsetDateTime getDataHora() { return dataHora; }
    public boolean isDemonstracao() { return demonstracao; }
}
