package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.FonteIndisponivelException;

/** Identidade imutável reconstituída do histórico, sem conexão com uma fonte ativa. */
public final class SensorHistorico implements Sensor {
    private final String id;
    private final TipoSensor tipo;
    private final boolean demonstracao;

    public SensorHistorico(String id, TipoSensor tipo, boolean demonstracao) {
        this.id = Validacao.texto(id, "Id do sensor");
        if (tipo == null) {
            throw new DadosInvalidosException("Tipo do sensor histórico é obrigatório.");
        }
        this.tipo = tipo;
        this.demonstracao = demonstracao;
    }

    @Override
    public String getId() { return id; }
    @Override
    public TipoSensor getTipo() { return tipo; }
    @Override
    public boolean isDemonstracao() { return demonstracao; }
    @Override
    public boolean verificarFuncionamento() { return false; }
    @Override
    public double lerValor() {
        throw new FonteIndisponivelException("Sensor histórico " + id + " não é uma fonte de novas leituras.");
    }
}
