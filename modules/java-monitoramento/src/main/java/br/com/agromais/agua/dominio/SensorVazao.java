package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.FonteIndisponivelException;
import java.util.random.RandomGenerator;

/** Vazão instantânea simulada em litros por minuto. Todas as leituras são demonstrações. */
public final class SensorVazao implements Sensor {
    private final String id;
    private final boolean funcionando;
    private final RandomGenerator gerador;

    public SensorVazao(String id) {
        this(id, true, RandomGenerator.getDefault());
    }

    /** Permite simular indisponibilidade e repetir sequências em testes. */
    public SensorVazao(String id, boolean funcionando, RandomGenerator gerador) {
        this.id = Validacao.texto(id, "Id do sensor");
        if (gerador == null) {
            throw new DadosInvalidosException("Gerador da simulação deve ser informado.");
        }
        this.funcionando = funcionando;
        this.gerador = gerador;
    }

    @Override
    public double lerValor() {
        if (!verificarFuncionamento()) {
            throw new FonteIndisponivelException("Sensor " + id + " indisponível: leitura de demonstração não obtida.");
        }
        double valor;
        try {
            valor = gerador.nextDouble(5.0, 80.0);
        } catch (RuntimeException causa) {
            throw new FonteIndisponivelException("Gerador de demonstração do sensor " + id + " falhou.", causa);
        }
        getTipo().validarValor(valor);
        return valor;
    }

    @Override
    public String getId() { return id; }
    @Override
    public TipoSensor getTipo() { return TipoSensor.VAZAO; }
    @Override
    public boolean verificarFuncionamento() { return funcionando; }
    @Override
    public boolean isDemonstracao() { return true; }
}
