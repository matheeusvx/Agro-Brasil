package br.com.agromais.agua.dominio;

import java.util.List;

public final class PrevisaoComparacao extends EstrategiaPrevisao {
    public PrevisaoComparacao(int tamanhoJanela) {
        super(tamanhoJanela, 2);
    }

    @Override
    public ResultadoPrevisao prever(String sensorId, List<Medicao> historico) {
        List<Medicao> validado = validarHistorico(sensorId, historico);
        int fim = validado.size();
        double anterior = media(validado, fim - 2 * getTamanhoJanela(), fim - getTamanhoJanela());
        double recente = media(validado, fim - getTamanhoJanela(), fim);
        double variacao = recente - anterior;
        double estimativa = recente + variacao;
        String tendencia = variacao > 0 ? "aumento" : variacao < 0 ? "redução" : "estabilidade";
        String unidade = validado.getLast().getUnidade();
        return resultado(validado, estimativa, "Comparação de duas janelas de " + getTamanhoJanela()
                + " amostras: média anterior=" + anterior + " " + unidade + "; média recente=" + recente
                + " " + unidade + "; variação=" + variacao + " " + unidade + " (" + tendencia
                + "). Estimativa=2 × recente − anterior=" + estimativa + " " + unidade
                + " para a média da próxima janela com a mesma cadência. Extrapolação didática.");
    }
}
