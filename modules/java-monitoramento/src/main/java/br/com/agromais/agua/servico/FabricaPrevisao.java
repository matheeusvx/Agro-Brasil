package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.DadosInvalidosException;

/** Simple Factory: concentra a escolha da implementação sem expô-la ao serviço. */
public final class FabricaPrevisao {
    private FabricaPrevisao() { }

    public static EstrategiaPrevisao criar(TipoPrevisao tipo) {
        return criar(tipo, 5);
    }

    public static EstrategiaPrevisao criar(TipoPrevisao tipo, int tamanhoJanela) {
        if (tipo == null) {
            throw new DadosInvalidosException("Tipo da previsão deve ser informado.");
        }
        return switch (tipo) {
            case MEDIA_MOVEL -> new PrevisaoMediaMovel(tamanhoJanela);
            case COMPARACAO -> new PrevisaoComparacao(tamanhoJanela);
        };
    }
}
