package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;

/** Configuração local em memória. O código é uma barreira didática, não autenticação de produção. */
public final class DadosTerritorio {
    private final String regiao;
    private final String codigoAcesso;
    private double limiteConsumoLitros;
    private double limiteVazaoLitrosPorMinuto;
    private double pressaoMinimaBar;
    private double pressaoMaximaBar;

    public DadosTerritorio(String regiao, String codigoAcesso, double limiteConsumo,
                           double limiteVazao, double pressaoMinima, double pressaoMaxima) {
        this.regiao = Validacao.texto(regiao, "Região");
        // Não normalizar o código: espaços fazem parte da comparação exata.
        Validacao.texto(codigoAcesso, "Código de acesso");
        this.codigoAcesso = codigoAcesso;
        definirLimiares(limiteConsumo, limiteVazao, pressaoMinima, pressaoMaxima);
    }

    public void alterarLimiares(String codigo, double limiteConsumo, double limiteVazao,
                                double pressaoMinima, double pressaoMaxima) {
        if (!codigoAcesso.equals(codigo)) {
            throw new SecurityException("Código de acesso inválido: limiares preservados.");
        }
        definirLimiares(limiteConsumo, limiteVazao, pressaoMinima, pressaoMaxima);
    }

    private void definirLimiares(double consumo, double vazao, double minima, double maxima) {
        TipoSensor.CONSUMO.validarValor(consumo);
        TipoSensor.VAZAO.validarValor(vazao);
        TipoSensor.PRESSAO.validarValor(minima);
        TipoSensor.PRESSAO.validarValor(maxima);
        if (consumo == 0 || vazao == 0 || minima >= maxima) {
            throw new DadosInvalidosException(
                    "Limites de consumo e vazão devem ser positivos; pressão mínima deve ser menor que a máxima.");
        }
        // Só altera depois de validar o conjunto inteiro, evitando atualização parcial.
        limiteConsumoLitros = consumo;
        limiteVazaoLitrosPorMinuto = vazao;
        pressaoMinimaBar = minima;
        pressaoMaximaBar = maxima;
    }

    public String getRegiao() { return regiao; }
    /** Limite de volume em L na janela fixa simulada de um minuto. */
    public double getLimiteConsumoLitros() { return limiteConsumoLitros; }
    public double getLimiteVazaoLitrosPorMinuto() { return limiteVazaoLitrosPorMinuto; }
    public double getPressaoMinimaBar() { return pressaoMinimaBar; }
    public double getPressaoMaximaBar() { return pressaoMaximaBar; }
}
