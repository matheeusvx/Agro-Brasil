package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class DadosTerritorioTest {
    private DadosTerritorio dados() {
        return new DadosTerritorio("Região demonstrativa", "codigo-demo", 150, 100, 1, 5);
    }

    @Test
    void codigoCorretoPermiteAlterarConjuntoDeLimiares() {
        // Arrange
        DadosTerritorio territorio = dados();
        // Act
        territorio.alterarLimiares("codigo-demo", 120, 90, 0.5, 4);
        // Assert
        assertAll(
                () -> assertEquals(120, territorio.getLimiteConsumoLitros()),
                () -> assertEquals(90, territorio.getLimiteVazaoLitrosPorMinuto()),
                () -> assertEquals(0.5, territorio.getPressaoMinimaBar()),
                () -> assertEquals(4, territorio.getPressaoMaximaBar()));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"errado", " codigo-demo", "codigo-demo "})
    void codigoIncorretoPreservaLimiares(String codigo) {
        // Arrange
        DadosTerritorio territorio = dados();
        // Act
        assertThrows(SecurityException.class, () -> territorio.alterarLimiares(codigo, 120, 90, 0.5, 4));
        // Assert
        assertLimiaresOriginais(territorio);
    }

    @ParameterizedTest
    @CsvSource({"0,90,1,4", "-1,90,1,4", "201,90,1,4", "120,0,1,4", "120,201,1,4",
            "120,90,-1,4", "120,90,1,11", "120,90,4,4", "120,90,5,4",
            "NaN,90,1,4", "120,Infinity,1,4", "120,90,NaN,4", "120,90,1,-Infinity"})
    void limiarInvalidoRejeitaConjuntoSemAlteracaoParcial(double consumo, double vazao, double minima, double maxima) {
        // Arrange
        DadosTerritorio territorio = dados();
        // Act
        assertThrows(DadosInvalidosException.class,
                () -> territorio.alterarLimiares("codigo-demo", consumo, vazao, minima, maxima));
        // Assert
        assertLimiaresOriginais(territorio);
    }

    @Test
    void construtorTambemValidaLimiares() {
        // Arrange
        double minima = 6;
        double maxima = 4;
        // Act
        var erro = assertThrows(DadosInvalidosException.class,
                () -> new DadosTerritorio("Região demo", "codigo-demo", 120, 90, minima, maxima));
        // Assert
        assertTrue(erro.getMessage().contains("pressão mínima"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void regiaoECodigoSaoObrigatorios(String texto) {
        // Arrange
        String regiao = "Região demo";
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new DadosTerritorio(texto, "codigo", 120, 90, 1, 4));
        assertThrows(DadosInvalidosException.class, () -> new DadosTerritorio(regiao, texto, 120, 90, 1, 4));
    }

    private void assertLimiaresOriginais(DadosTerritorio territorio) {
        assertAll(
                () -> assertEquals(150, territorio.getLimiteConsumoLitros()),
                () -> assertEquals(100, territorio.getLimiteVazaoLitrosPorMinuto()),
                () -> assertEquals(1, territorio.getPressaoMinimaBar()),
                () -> assertEquals(5, territorio.getPressaoMaximaBar()));
    }
}
