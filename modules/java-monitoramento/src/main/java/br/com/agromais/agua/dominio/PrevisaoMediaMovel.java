package br.com.agromais.agua.dominio;

import java.util.List;

public final class PrevisaoMediaMovel extends EstrategiaPrevisao {
    public PrevisaoMediaMovel(int tamanhoJanela) {
        super(tamanhoJanela, 1);
    }

    @Override
    public ResultadoPrevisao prever(String sensorId, List<Medicao> historico) {
        List<Medicao> validado = validarHistorico(sensorId, historico);
        double valor = media(validado, validado.size() - getTamanhoJanela(), validado.size());
        return resultado(validado, valor, "Média móvel: soma das últimas " + getTamanhoJanela()
                + " medições / " + getTamanhoJanela() + " = " + valor + " " + validado.getLast().getUnidade()
                + ". Estimativa da média da próxima janela com a mesma cadência.");
    }
}
