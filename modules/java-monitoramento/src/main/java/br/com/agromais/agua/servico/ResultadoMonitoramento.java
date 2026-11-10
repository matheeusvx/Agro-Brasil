package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.Alerta;
import br.com.agromais.agua.dominio.ResultadoPrevisao;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.util.Optional;

/** Uma previsão válida pode não exigir alerta; erros não são representados como resultado normal. */
public record ResultadoMonitoramento(ResultadoPrevisao previsao, Optional<Alerta> alerta) {
    public ResultadoMonitoramento {
        if (previsao == null || alerta == null) {
            throw new DadosInvalidosException("Previsão e indicação de alerta são obrigatórias no resultado.");
        }
    }
}
