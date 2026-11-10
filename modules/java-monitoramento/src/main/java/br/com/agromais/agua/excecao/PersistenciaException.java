package br.com.agromais.agua.excecao;

/** Falha de acesso ao banco ou de reconstrução de um registro armazenado. */
public class PersistenciaException extends RuntimeException {
    public PersistenciaException(String mensagem, Throwable causa) {
        super(mensagem, causa);
    }
}
