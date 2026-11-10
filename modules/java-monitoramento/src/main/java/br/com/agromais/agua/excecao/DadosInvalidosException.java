package br.com.agromais.agua.excecao;

/** Indica que um dado viola as regras do domínio. */
public class DadosInvalidosException extends IllegalArgumentException {
    public DadosInvalidosException(String mensagem) {
        super(mensagem);
    }

    public DadosInvalidosException(String mensagem, Throwable causa) {
        super(mensagem, causa);
    }
}
