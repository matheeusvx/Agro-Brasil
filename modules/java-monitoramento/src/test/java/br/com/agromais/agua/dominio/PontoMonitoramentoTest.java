package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class PontoMonitoramentoTest {
    @Test
    void verificaStatusPorReferenciaDaClasseAbstrata() {
        // Arrange
        ComponenteTerritorial ponto = new PontoMonitoramento("p1", "Reservatório demo", "Região demo",
                List.of(new SensorConsumo("c"), new SensorVazao("v"), new SensorPressao("p")));
        // Act
        StatusComponente status = ponto.verificarStatus();
        // Assert
        assertEquals(StatusComponente.OPERACIONAL, status);
        assertEquals(status, ponto.getStatus());
        assertEquals("p1", ponto.getId());
    }

    @Test
    void sensorInativoTornaPontoIndisponivel() {
        // Arrange
        Sensor inativo = new SensorVazao("v", false, new Random(42));
        ComponenteTerritorial ponto = new PontoMonitoramento("p1", "Ponto demo", "Região demo",
                List.of(new SensorConsumo("c"), inativo));
        // Act
        StatusComponente status = ponto.verificarStatus();
        // Assert
        assertEquals(StatusComponente.FONTE_INDISPONIVEL, status);
        assertEquals(status, ponto.getStatus());
    }

    @Test
    void pontoVazioNaoEConsideradoOperacional() {
        // Arrange
        ComponenteTerritorial ponto = new PontoMonitoramento("p1", "Ponto demo", "Região demo", List.of());
        // Act
        StatusComponente status = ponto.verificarStatus();
        // Assert
        assertEquals(StatusComponente.SEM_SENSORES, status);
    }

    @Test
    void listaDeSensoresNaoPodeSerAlteradaPorFora() {
        // Arrange
        List<Sensor> origem = new ArrayList<>(List.of(new SensorConsumo("c")));
        PontoMonitoramento ponto = new PontoMonitoramento("p1", "Ponto demo", "Região demo", origem);
        // Act
        origem.clear();
        // Assert
        assertEquals(1, ponto.getSensores().size());
        assertThrows(UnsupportedOperationException.class, () -> ponto.getSensores().clear());
        assertEquals(StatusComponente.OPERACIONAL, ponto.verificarStatus());
    }

    @Test
    void rejeitaSensoresNulosOuIdsDuplicados() {
        // Arrange
        List<Sensor> duplicados = List.of(new SensorConsumo("mesmo-id"), new SensorPressao("mesmo-id"));
        List<Sensor> comNulo = Arrays.asList(new SensorConsumo("c"), null);
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new PontoMonitoramento("p1", "Ponto", "Região", duplicados));
        assertThrows(DadosInvalidosException.class, () -> new PontoMonitoramento("p1", "Ponto", "Região", comNulo));
        assertThrows(DadosInvalidosException.class, () -> new PontoMonitoramento("p1", "Ponto", "Região", null));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void identificacaoTerritorialESensorNaoAceitamTextoAusente(String texto) {
        // Arrange
        List<Sensor> sensores = List.of();
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new PontoMonitoramento(texto, "Ponto", "Região", sensores));
        assertThrows(DadosInvalidosException.class, () -> new PontoMonitoramento("p1", texto, "Região", sensores));
        assertThrows(DadosInvalidosException.class, () -> new PontoMonitoramento("p1", "Ponto", texto, sensores));
        assertThrows(DadosInvalidosException.class, () -> new SensorConsumo(texto));
        assertThrows(DadosInvalidosException.class, () -> new SensorVazao(texto));
        assertThrows(DadosInvalidosException.class, () -> new SensorPressao(texto));
    }
}
