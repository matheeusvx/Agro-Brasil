package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import static org.junit.jupiter.api.Assertions.*;

class MedicaoTest {
    private final OffsetDateTime instante = OffsetDateTime.parse("2026-11-10T09:00:00-03:00");

    private Sensor sensor(TipoSensor tipo) {
        return switch (tipo) {
            case CONSUMO -> new SensorConsumo("c");
            case VAZAO -> new SensorVazao("v");
            case PRESSAO -> new SensorPressao("p");
        };
    }

    @Test
    void preservaValorSensorUnidadeEHorarioInformados() {
        // Arrange
        Sensor sensor = new SensorPressao("pressao-1");
        // Act
        Medicao medicao = new Medicao(sensor, 2.5, "bar", instante);
        // Assert
        assertAll(
                () -> assertSame(sensor, medicao.getSensor()),
                () -> assertEquals("pressao-1", medicao.getSensorId()),
                () -> assertEquals(2.5, medicao.getValor()),
                () -> assertEquals("bar", medicao.getUnidade()),
                () -> assertEquals(instante, medicao.getDataHora()),
                () -> assertTrue(medicao.isDemonstracao()));
    }

    @ParameterizedTest
    @CsvSource({"CONSUMO,-1", "CONSUMO,201", "VAZAO,-1", "VAZAO,201", "PRESSAO,-1", "PRESSAO,11",
            "CONSUMO,NaN", "VAZAO,Infinity", "PRESSAO,-Infinity"})
    void valorInvalidoNaoSeTornaMedicao(TipoSensor tipo, double valor) {
        // Arrange
        Sensor sensor = sensor(tipo);
        // Act
        var erro = assertThrows(DadosInvalidosException.class,
                () -> new Medicao(sensor, valor, tipo.getUnidade(), instante));
        // Assert
        assertTrue(erro.getMessage().contains(tipo.getUnidade()));
    }

    @ParameterizedTest
    @CsvSource({"CONSUMO,0", "CONSUMO,200", "VAZAO,0", "VAZAO,200", "PRESSAO,0", "PRESSAO,10"})
    void aceitaExtremosDaFaixaDeMedicao(TipoSensor tipo, double valor) {
        // Arrange
        Sensor sensor = sensor(tipo);
        // Act
        Medicao medicao = new Medicao(sensor, valor, tipo.getUnidade(), instante);
        // Assert
        assertEquals(valor, medicao.getValor());
    }

    @ParameterizedTest
    @EnumSource(TipoSensor.class)
    void unidadeIncompativelOuAusenteERejeitada(TipoSensor tipo) {
        // Arrange
        Sensor sensor = sensor(tipo);
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new Medicao(sensor, 2, "kg", instante));
        assertThrows(DadosInvalidosException.class, () -> new Medicao(sensor, 2, null, instante));
    }

    @Test
    void sensorEHorarioSaoObrigatorios() {
        // Arrange
        Sensor sensor = new SensorConsumo("c");
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new Medicao(null, 20, "L", instante));
        assertThrows(DadosInvalidosException.class, () -> new Medicao(sensor, 20, "L", null));
        assertThrows(DadosInvalidosException.class, () -> Medicao.capturar(null));
    }

    @Test
    void capturaRegistraHorarioDaLeitura() {
        // Arrange
        Sensor sensor = new SensorConsumo("c");
        OffsetDateTime antes = OffsetDateTime.now();
        // Act
        Medicao medicao = Medicao.capturar(sensor);
        OffsetDateTime depois = OffsetDateTime.now();
        // Assert
        assertFalse(medicao.getDataHora().isBefore(antes));
        assertFalse(medicao.getDataHora().isAfter(depois));
    }
}
