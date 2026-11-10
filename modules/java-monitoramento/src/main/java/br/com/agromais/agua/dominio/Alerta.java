package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.time.OffsetDateTime;

/** Registro imutável de um alerta informado pelo chamador; não calcula previsão nem escolhe nível. */
public final class Alerta {
    private final NivelAlerta nivel;
    private final Sensor sensor;
    private final String sensorId;
    private final TipoSensor tipo;
    private final String unidade;
    private final boolean demonstracao;
    private final double previsao;
    private final double limiar;
    private final String justificativa;
    private final OffsetDateTime dataHora;

    public Alerta(NivelAlerta nivel, Sensor sensor, double previsao, double limiar,
                  String unidade, String justificativa, OffsetDateTime dataHora) {
        if (nivel == null || sensor == null || sensor.getTipo() == null || dataHora == null) {
            throw new DadosInvalidosException("Nível, sensor, tipo e data/hora do alerta são obrigatórios.");
        }
        this.sensorId = Validacao.texto(sensor.getId(), "Id do sensor");
        this.tipo = sensor.getTipo();
        tipo.validarValor(previsao);
        tipo.validarValor(limiar);
        if (!tipo.getUnidade().equals(unidade)) {
            throw new DadosInvalidosException("Unidade esperada para " + tipo + ": " + tipo.getUnidade() + ".");
        }
        this.justificativa = Validacao.texto(justificativa, "Justificativa");
        this.nivel = nivel;
        this.sensor = sensor;
        this.unidade = unidade;
        this.demonstracao = sensor.isDemonstracao();
        this.previsao = previsao;
        this.limiar = limiar;
        this.dataHora = dataHora;
    }

    public NivelAlerta getNivel() { return nivel; }
    public Sensor getSensor() { return sensor; }
    public String getSensorId() { return sensorId; }
    public TipoSensor getTipo() { return tipo; }
    public String getUnidade() { return unidade; }
    public boolean isDemonstracao() { return demonstracao; }
    public double getPrevisao() { return previsao; }
    public double getLimiar() { return limiar; }
    public String getJustificativa() { return justificativa; }
    public OffsetDateTime getDataHora() { return dataHora; }
}
