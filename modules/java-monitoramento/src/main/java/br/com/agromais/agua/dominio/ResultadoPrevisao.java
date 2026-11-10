package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;

/** Estimativa da média da próxima janela de amostras, não uma certeza sobre o futuro. */
public record ResultadoPrevisao(Sensor sensor, double valor, String unidade, String explicacao) {
    public ResultadoPrevisao {
        if (sensor == null || sensor.getTipo() == null) {
            throw new DadosInvalidosException("Sensor e tipo são obrigatórios na previsão.");
        }
        // Snapshot: o resultado não depende de alterações posteriores na fonte ativa.
        sensor = new SensorHistorico(sensor.getId(), sensor.getTipo(), sensor.isDemonstracao());
        try {
            sensor.getTipo().validarValor(valor); // Sem cortar, arredondar ou substituir previsão fora de faixa.
        } catch (DadosInvalidosException causa) {
            throw new DadosInvalidosException("Previsão calculada inválida para " + sensor.getId()
                    + ": " + valor + " " + unidade + ". " + causa.getMessage(), causa);
        }
        if (!sensor.getTipo().getUnidade().equals(unidade)) {
            throw new DadosInvalidosException("Unidade incompatível na previsão de " + sensor.getId() + ".");
        }
        explicacao = Validacao.texto(explicacao, "Explicação da previsão");
    }
}
