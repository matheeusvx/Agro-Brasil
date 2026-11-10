package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.persistencia.*;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import static org.junit.jupiter.api.Assertions.*;

class MonitoramentoH2Test {
    @TempDir Path temporario;
    private final OffsetDateTime inicio = OffsetDateTime.parse("2026-11-10T09:00:00-03:00");

    private DadosTerritorio dados() {
        return new DadosTerritorio("Região demo", "codigo", 100, 100, 2, 6);
    }

    @ParameterizedTest
    @EnumSource(TipoPrevisao.class)
    void duasEstrategiasLeemOHistoricoH2EGeramAlertaQueSobreviveAReabertura(TipoPrevisao tipo) {
        // Arrange
        Path arquivo = temporario.resolve("monitoramento");
        BancoH2 banco = new BancoH2(arquivo);
        MedicaoDAO medicoes = new MedicaoDAO(banco);
        AlertaDAO alertas = new AlertaDAO(banco);
        for (int i = 0; i < 10; i++) {
            medicoes.salvar(new Medicao(new SensorConsumo("consumo-demo"), i < 5 ? 90 : 120, "L", inicio.plusMinutes(i)));
        }
        var servico = new ServicoMonitoramento(medicoes, alertas, dados(), tipo, 5);
        // Act
        ResultadoMonitoramento resultado = servico.analisar("consumo-demo");
        BancoH2 reaberto = new BancoH2(arquivo);
        var recuperados = new AlertaDAO(reaberto).listarPorSensor("consumo-demo");
        // Assert
        double esperado = tipo == TipoPrevisao.MEDIA_MOVEL ? 120 : 150;
        NivelAlerta nivel = tipo == TipoPrevisao.MEDIA_MOVEL ? NivelAlerta.ALERTA : NivelAlerta.CRITICO;
        assertEquals(esperado, resultado.previsao().valor());
        assertEquals(1, recuperados.size());
        Alerta recuperado = recuperados.getFirst();
        assertEquals(nivel, recuperado.getNivel());
        assertEquals(esperado, recuperado.getPrevisao());
        assertEquals(100, recuperado.getLimiar());
        assertEquals("L", recuperado.getUnidade());
        assertEquals("consumo-demo", recuperado.getSensorId());
        assertTrue(recuperado.isDemonstracao());
        assertEquals(resultado.alerta().orElseThrow().getDataHora(), recuperado.getDataHora());
        assertTrue(recuperado.getJustificativa().contains(resultado.previsao().explicacao()));
        assertEquals(10, new MedicaoDAO(reaberto).listarPorSensor("consumo-demo").size());
    }

    @Test
    void pressaoBaixaPersisteLimiteInferiorNaUnidadeCorreta() {
        // Arrange
        BancoH2 banco = new BancoH2(temporario.resolve("pressao"));
        MedicaoDAO medicoes = new MedicaoDAO(banco);
        AlertaDAO alertas = new AlertaDAO(banco);
        for (int i = 0; i < 5; i++) {
            medicoes.salvar(new Medicao(new SensorPressao("p"), 1, "bar", inicio.plusMinutes(i)));
        }
        // Act
        new ServicoMonitoramento(medicoes, alertas, dados(), TipoPrevisao.MEDIA_MOVEL, 5).analisar("p");
        // Assert
        Alerta alerta = alertas.listarPorSensor("p").getFirst();
        assertEquals(NivelAlerta.CRITICO, alerta.getNivel());
        assertEquals(2, alerta.getLimiar());
        assertEquals("bar", alerta.getUnidade());
        assertTrue(alerta.getJustificativa().contains("inferior"));
    }

    @Test
    void naoPersisteAlertaParaHistoricoInsuficienteOuParaResultadoNormal() {
        // Arrange
        BancoH2 banco = new BancoH2(temporario.resolve("normal"));
        MedicaoDAO medicoes = new MedicaoDAO(banco);
        AlertaDAO alertas = new AlertaDAO(banco);
        for (int i = 0; i < 5; i++) {
            medicoes.salvar(new Medicao(new SensorConsumo("normal"), 50, "L", inicio.plusMinutes(i)));
        }
        var servico = new ServicoMonitoramento(medicoes, alertas, dados(), TipoPrevisao.MEDIA_MOVEL, 5);
        // Act
        var resultado = servico.analisar("normal");
        var erro = assertThrows(DadosInvalidosException.class, () -> servico.analisar("ausente"));
        // Assert
        assertTrue(resultado.alerta().isEmpty());
        assertTrue(erro.getMessage().contains("disponíveis 0"));
        assertTrue(alertas.listarTodos().isEmpty());
    }

    @Test
    void identidadeReutilizadaComTiposDiferentesNoBancoImpedeCalculo() {
        // Arrange: os DAOs reconstroem objetos válidos individualmente, mas a série é inconsistente.
        BancoH2 banco = new BancoH2(temporario.resolve("misturado"));
        MedicaoDAO medicoes = new MedicaoDAO(banco);
        AlertaDAO alertas = new AlertaDAO(banco);
        for (int i = 0; i < 5; i++) {
            Sensor sensor = i == 0 ? new SensorVazao("mesmo-id") : new SensorConsumo("mesmo-id");
            medicoes.salvar(new Medicao(sensor, 150, sensor.getTipo().getUnidade(), inicio.plusMinutes(i)));
        }
        // Act
        var erro = assertThrows(DadosInvalidosException.class,
                () -> new ServicoMonitoramento(medicoes, alertas, dados(), TipoPrevisao.MEDIA_MOVEL, 5).analisar("mesmo-id"));
        // Assert
        assertTrue(erro.getMessage().contains("mistura tipos"));
        assertTrue(alertas.listarTodos().isEmpty());
    }

    @Test
    void previsaoForaDeFaixaNaoDeixaAlertaNoBanco() {
        // Arrange
        BancoH2 banco = new BancoH2(temporario.resolve("extrapolacao"));
        MedicaoDAO medicoes = new MedicaoDAO(banco);
        AlertaDAO alertas = new AlertaDAO(banco);
        for (int i = 0; i < 10; i++) {
            medicoes.salvar(new Medicao(new SensorConsumo("c"), i < 5 ? 0 : 120, "L", inicio.plusMinutes(i)));
        }
        // Act
        var erro = assertThrows(DadosInvalidosException.class,
                () -> new ServicoMonitoramento(medicoes, alertas, dados(), TipoPrevisao.COMPARACAO, 5).analisar("c"));
        // Assert
        assertTrue(erro.getMessage().contains("240.0 L"));
        assertTrue(alertas.listarTodos().isEmpty());
    }
}
