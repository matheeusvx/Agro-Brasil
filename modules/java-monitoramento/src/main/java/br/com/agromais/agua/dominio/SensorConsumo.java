package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.FonteIndisponivelException;
import java.util.random.RandomGenerator;

/** Volume em litros consumido durante uma janela simulada de um minuto; não é total acumulado. Todas as leituras são demonstrações. */
public final class SensorConsumo implements Sensor {
    private final String id;
    private final boolean funcionando;
    private final RandomGenerator gerador;

    public SensorConsumo(String id) {
        this(id, true, RandomGenerator.getDefault());
    }

    /** Permite simular indisponibilidade e repetir sequências em testes. */
    public SensorConsumo(String id, boolean funcionando, RandomGenerator gerador) {
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
            valor = gerador.nextDouble(20.0, 120.0);
        } catch (RuntimeException causa) {
            throw new FonteIndisponivelException("Gerador de demonstração do sensor " + id + " falhou.", causa);
        }
        getTipo().validarValor(valor);
        return valor;
    }

    @Override
    public String getId() { return id; }
    @Override
    public TipoSensor getTipo() { return TipoSensor.CONSUMO; }
    @Override
    public boolean verificarFuncionamento() { return funcionando; }
    @Override
    public boolean isDemonstracao() { return true; }
}
