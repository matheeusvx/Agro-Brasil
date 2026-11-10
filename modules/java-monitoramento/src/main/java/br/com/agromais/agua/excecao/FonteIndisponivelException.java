package br.com.agromais.agua.excecao;

/** Indica que não foi possível obter uma leitura da fonte. */
public class FonteIndisponivelException extends RuntimeException {
    public FonteIndisponivelException(String mensagem) {
        super(mensagem);
    }

    public FonteIndisponivelException(String mensagem, Throwable causa) {
        super(mensagem, causa);
    }
}
