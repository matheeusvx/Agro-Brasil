package br.com.agromais.agua.dominio;

/** Faixas didáticas para um pequeno ponto coletivo; não são limites técnicos universais. */
public enum TipoSensor {
    CONSUMO("L", 200),
    VAZAO("L/min", 200),
    PRESSAO("bar", 10);

    private final String unidade;
    private final double valorMaximo;

    TipoSensor(String unidade, double valorMaximo) {
        this.unidade = unidade;
        this.valorMaximo = valorMaximo;
    }

    public String getUnidade() { return unidade; }

    public void validarValor(double valor) {
        Validacao.faixa(valor, 0, valorMaximo, name() + " (" + unidade + ")");
    }
}
