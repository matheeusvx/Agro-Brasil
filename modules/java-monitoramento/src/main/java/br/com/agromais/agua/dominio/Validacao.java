package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;

/** Regras pequenas compartilhadas, sem dependências de infraestrutura. */
final class Validacao {
    private Validacao() { }

    static String texto(String valor, String campo) {
        if (valor == null || valor.isBlank()) {
            throw new DadosInvalidosException(campo + " deve ser informado.");
        }
        return valor.strip();
    }

    static void faixa(double valor, double minimo, double maximo, String campo) {
        if (!Double.isFinite(valor) || valor < minimo || valor > maximo) {
            throw new DadosInvalidosException(
                    campo + " deve ser finito e estar entre " + minimo + " e " + maximo + ".");
        }
    }
}
