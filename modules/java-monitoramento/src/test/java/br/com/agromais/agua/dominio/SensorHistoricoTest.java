package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.FonteIndisponivelException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SensorHistoricoTest {
    @Test
    void identidadeHistoricaNaoCriaNovasLeituras() {
        // Arrange
        Sensor sensor = new SensorHistorico("sensor-antigo", TipoSensor.CONSUMO, false);
        // Act
        var erro = assertThrows(FonteIndisponivelException.class, () -> Medicao.capturar(sensor));
        // Assert
        assertFalse(sensor.verificarFuncionamento());
        assertFalse(sensor.isDemonstracao());
        assertEquals(TipoSensor.CONSUMO, sensor.getTipo());
        assertTrue(erro.getMessage().contains("sensor-antigo"));
    }

    @Test
    void identidadeETipoSaoObrigatorios() {
        // Arrange
        TipoSensor tipo = TipoSensor.PRESSAO;
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new SensorHistorico(" ", tipo, true));
        assertThrows(DadosInvalidosException.class, () -> new SensorHistorico("sensor", null, true));
    }
}
