package br.com.agromais.agua.dominio;

/** Fonte de leituras. Id e tipo devem ser estáveis durante a vida do sensor. */
public interface Sensor {
    String getId();
    TipoSensor getTipo();
    /** Valor na unidade do tipo; pode lançar exceção de dados ou de fonte indisponível. */
    double lerValor();
    /** Disponibilidade configurada da fonte; não realiza leitura nem diagnostica desperdício. */
    boolean verificarFuncionamento();
    boolean isDemonstracao();
}
