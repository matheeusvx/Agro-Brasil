package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class AlertaTest {
    private final Sensor sensor = new SensorPressao("pressao-demo");
    private final OffsetDateTime horario = OffsetDateTime.parse("2026-11-10T09:00:00.123456789-03:00");

    @ParameterizedTest
    @EnumSource(NivelAlerta.class)
    void preservaNivelGrandezasJustificativaEHorario(NivelAlerta nivel) {
        // Arrange: queda de pressão também pode motivar um alerta, sem exigir previsão > limiar.
        double previsao = 0.5;
        // Act
        Alerta alerta = new Alerta(nivel, sensor, previsao, 1, "bar", "Pressão abaixo do limite", horario);
        // Assert
        assertAll(
                () -> assertEquals(nivel, alerta.getNivel()),
                () -> assertSame(sensor, alerta.getSensor()),
                () -> assertEquals("pressao-demo", alerta.getSensorId()),
                () -> assertEquals(TipoSensor.PRESSAO, alerta.getTipo()),
                () -> assertEquals("bar", alerta.getUnidade()),
                () -> assertTrue(alerta.isDemonstracao()),
                () -> assertEquals(0.5, alerta.getPrevisao()),
                () -> assertEquals(1, alerta.getLimiar()),
                () -> assertEquals("Pressão abaixo do limite", alerta.getJustificativa()),
                () -> assertEquals(horario, alerta.getDataHora()));
    }

    @ParameterizedTest
    @CsvSource({"-1,1", "11,1", "NaN,1", "Infinity,1", "1,-1", "1,11", "1,NaN", "1,-Infinity"})
    void rejeitaValoresInvalidosPelasRegrasDoTipo(double previsao, double limiar) {
        // Arrange
        NivelAlerta nivel = NivelAlerta.ATENCAO;
        // Act + Assert
        assertThrows(DadosInvalidosException.class,
                () -> new Alerta(nivel, sensor, previsao, limiar, "bar", "Justificativa", horario));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void justificativaEObrigatoria(String justificativa) {
        // Arrange
        NivelAlerta nivel = NivelAlerta.ALERTA;
        // Act + Assert
        assertThrows(DadosInvalidosException.class,
                () -> new Alerta(nivel, sensor, 2, 1, "bar", justificativa, horario));
    }

    @Test
    void camposObrigatoriosEUnidadeSaoValidados() {
        // Arrange
        NivelAlerta nivel = NivelAlerta.CRITICO;
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new Alerta(null, sensor, 2, 1, "bar", "Motivo", horario));
        assertThrows(DadosInvalidosException.class, () -> new Alerta(nivel, null, 2, 1, "bar", "Motivo", horario));
        assertThrows(DadosInvalidosException.class, () -> new Alerta(nivel, sensor, 2, 1, "bar", "Motivo", null));
        assertThrows(DadosInvalidosException.class, () -> new Alerta(nivel, sensor, 2, 1, "L", "Motivo", horario));
        assertThrows(DadosInvalidosException.class, () -> new Alerta(nivel, sensor, 2, 1, null, "Motivo", horario));
    }
}
