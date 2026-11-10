package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.PersistenciaException;
import br.com.agromais.agua.persistencia.AlertaDAO;
import br.com.agromais.agua.persistencia.MedicaoDAO;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Testa regras de monitoramento sem criar BancoH2, conexão ou arquivo. */
class ServicoMonitoramentoTest {
    private MedicaoDAO medicoes;
    private AlertaDAO alertas;
    private DadosTerritorio dados;

    @BeforeEach
    void preparar() {
        medicoes = mock(MedicaoDAO.class);
        alertas = mock(AlertaDAO.class);
        dados = new DadosTerritorio("Região demo", "codigo", 100, 100, 2, 6);
    }

    private List<Medicao> historico(TipoSensor tipo, double valor, int quantidade) {
        List<Medicao> historico = new ArrayList<>();
        Sensor sensor = new SensorHistorico("sensor", tipo, true);
        for (int i = 0; i < quantidade; i++) {
            historico.add(new Medicao(sensor, valor, tipo.getUnidade(),
                    OffsetDateTime.parse("2026-11-10T09:00:00-03:00").plusMinutes(i)));
        }
        return historico;
    }

    private ServicoMonitoramento servico(TipoPrevisao tipo) {
        return new ServicoMonitoramento(medicoes, alertas, dados, tipo, 5);
    }

    @ParameterizedTest
    @CsvSource({"CONSUMO,105,ATENCAO,100", "CONSUMO,110,ALERTA,100", "CONSUMO,125,CRITICO,100",
            "VAZAO,110,ATENCAO,100", "VAZAO,120,ALERTA,100", "VAZAO,150,CRITICO,100",
            "PRESSAO,6.1,ATENCAO,6", "PRESSAO,6.5,ALERTA,6", "PRESSAO,7,CRITICO,6",
            "PRESSAO,1.9,ATENCAO,2", "PRESSAO,1.5,ALERTA,2", "PRESSAO,1,CRITICO,2",
            "PRESSAO,1.6,ALERTA,2", "PRESSAO,6.4,ALERTA,6"})
    void classificaEPersisteOsTresNiveisPorTipoDeSensor(TipoSensor tipo, double previsto, NivelAlerta nivel, double limiar) {
        // Arrange: o DAO de medições é simulado, mas cálculo e classificação são reais.
        when(medicoes.listarPorSensor("sensor")).thenReturn(historico(tipo, previsto, 5));
        // Act
        ResultadoMonitoramento resultado = servico(TipoPrevisao.MEDIA_MOVEL).analisar("sensor");
        // Assert
        var captor = ArgumentCaptor.forClass(Alerta.class);
        var ordem = inOrder(medicoes, alertas);
        ordem.verify(medicoes).listarPorSensor("sensor");
        ordem.verify(alertas).salvar(captor.capture());
        Alerta gravado = captor.getValue();
        assertSame(resultado.alerta().orElseThrow(), gravado);
        assertEquals(nivel, gravado.getNivel());
        assertEquals(previsto, gravado.getPrevisao(), 1e-10);
        assertEquals(limiar, gravado.getLimiar());
        assertEquals(tipo.getUnidade(), gravado.getUnidade());
        assertTrue(gravado.getJustificativa().contains("Sensor sensor"));
        assertTrue(gravado.getJustificativa().contains("limite " + (previsto < limiar ? "inferior" : "superior")));
        assertTrue(gravado.getJustificativa().contains(limiar + " " + tipo.getUnidade()));
        assertTrue(gravado.getJustificativa().contains("DEMONSTRAÇÃO"));
        verifyNoMoreInteractions(medicoes, alertas);
    }

    @ParameterizedTest
    @CsvSource({"CONSUMO,0", "CONSUMO,90", "CONSUMO,100", "VAZAO,0", "VAZAO,100",
            "PRESSAO,2", "PRESSAO,4", "PRESSAO,6"})
    void valoresDentroDosLimitesInclusiveExtremosNaoGeramAlerta(TipoSensor tipo, double previsto) {
        // Arrange
        when(medicoes.listarPorSensor("sensor")).thenReturn(historico(tipo, previsto, 5));
        // Act
        ResultadoMonitoramento resultado = servico(TipoPrevisao.MEDIA_MOVEL).analisar("sensor");
        // Assert
        assertEquals(previsto, resultado.previsao().valor());
        assertTrue(resultado.alerta().isEmpty());
        verifyNoInteractions(alertas);
    }

    @Test
    void fronteiraDecimalDeDezPorCentoNaoRebaixaONivelPorArredondamento() {
        // Arrange: 0.11 L é exatamente 10% acima do limite didático 0.10 L.
        dados = new DadosTerritorio("Região demo", "codigo", 0.10, 100, 2, 6);
        when(medicoes.listarPorSensor("sensor")).thenReturn(historico(TipoSensor.CONSUMO, 0.11, 5));
        // Act
        var resultado = servico(TipoPrevisao.MEDIA_MOVEL).analisar("sensor");
        // Assert
        assertEquals(NivelAlerta.ALERTA, resultado.alerta().orElseThrow().getNivel());
    }

    @Test
    void pressaoComMinimaZeroNaoDividePorZero() {
        // Arrange
        dados = new DadosTerritorio("Região demo", "codigo", 100, 100, 0, 4);
        when(medicoes.listarPorSensor("sensor")).thenReturn(historico(TipoSensor.PRESSAO, 5, 5));
        // Act
        var resultado = servico(TipoPrevisao.MEDIA_MOVEL).analisar("sensor");
        // Assert
        assertEquals(NivelAlerta.CRITICO, resultado.alerta().orElseThrow().getNivel());
        assertEquals(4, resultado.alerta().orElseThrow().getLimiar());
    }

    @Test
    void insuficienciaNaoGeraPrevisaoNemPersisteAlerta() {
        // Arrange
        when(medicoes.listarPorSensor("sensor")).thenReturn(historico(TipoSensor.CONSUMO, 150, 4));
        // Act
        var erro = assertThrows(DadosInvalidosException.class,
                () -> servico(TipoPrevisao.MEDIA_MOVEL).analisar("sensor"));
        // Assert
        assertTrue(erro.getMessage().contains("Histórico insuficiente"));
        verifyNoInteractions(alertas);
    }

    @Test
    void inconsistenciasDeIdentidadeTipoOuOrigemNaoGeramAlertas() {
        // Arrange
        var original = historico(TipoSensor.CONSUMO, 150, 5);
        var invalidadoras = List.of(new SensorHistorico("outro", TipoSensor.CONSUMO, true),
                new SensorHistorico("sensor", TipoSensor.VAZAO, true),
                new SensorHistorico("sensor", TipoSensor.CONSUMO, false));
        // Act + Assert
        for (Sensor invalidadora : invalidadoras) {
            var misturado = new ArrayList<>(original);
            misturado.set(0, new Medicao(invalidadora, 150, invalidadora.getTipo().getUnidade(), original.getFirst().getDataHora()));
            when(medicoes.listarPorSensor("sensor")).thenReturn(misturado);
            assertThrows(DadosInvalidosException.class, () -> servico(TipoPrevisao.MEDIA_MOVEL).analisar("sensor"));
        }
        verifyNoInteractions(alertas);
    }

    @Test
    void previsaoForaDeFaixaNaoEViradaEmAlertaNoLimite() {
        // Arrange
        var medicoesSimuladas = new ArrayList<>(historico(TipoSensor.CONSUMO, 0, 10));
        for (int i = 5; i < 10; i++) {
            medicoesSimuladas.set(i, new Medicao(new SensorConsumo("sensor"), 120, "L",
                    medicoesSimuladas.get(i).getDataHora()));
        }
        when(medicoes.listarPorSensor("sensor")).thenReturn(medicoesSimuladas);
        // Act
        var erro = assertThrows(DadosInvalidosException.class, () -> servico(TipoPrevisao.COMPARACAO).analisar("sensor"));
        // Assert
        assertTrue(erro.getMessage().contains("240.0 L"));
        verifyNoInteractions(alertas);
    }

    @Test
    void falhaDeConsultaEPropagadaSemGerarAlerta() {
        // Arrange
        var falha = new PersistenciaException("Banco indisponível", new java.sql.SQLException("Falha de teste"));
        when(medicoes.listarPorSensor("sensor")).thenThrow(falha);
        // Act
        var recebido = assertThrows(PersistenciaException.class, () -> servico(TipoPrevisao.MEDIA_MOVEL).analisar("sensor"));
        // Assert
        assertSame(falha, recebido);
        verifyNoInteractions(alertas);
    }

    @Test
    void falhaDeGravacaoNaoRetornaSucessoAparente() {
        // Arrange
        when(medicoes.listarPorSensor("sensor")).thenReturn(historico(TipoSensor.CONSUMO, 150, 5));
        var falha = new PersistenciaException("Falha ao salvar", new java.sql.SQLException("Falha de teste"));
        when(alertas.salvar(any(Alerta.class))).thenThrow(falha);
        // Act
        var recebido = assertThrows(PersistenciaException.class, () -> servico(TipoPrevisao.MEDIA_MOVEL).analisar("sensor"));
        // Assert
        assertSame(falha, recebido);
        verify(alertas).salvar(any(Alerta.class));
    }

    @Test
    void alteracaoAutorizadaDosLimiaresEUsadaNaProximaAnalise() {
        // Arrange
        when(medicoes.listarPorSensor("sensor")).thenReturn(historico(TipoSensor.CONSUMO, 105, 5));
        var servico = servico(TipoPrevisao.MEDIA_MOVEL);
        // Act
        var antes = servico.analisar("sensor");
        dados.alterarLimiares("codigo", 120, 100, 2, 6);
        var depois = servico.analisar("sensor");
        // Assert
        assertTrue(antes.alerta().isPresent());
        assertTrue(depois.alerta().isEmpty());
        verify(alertas, times(1)).salvar(any(Alerta.class));
    }

    @Test
    void rejeitaConfiguracaoAusenteESensorVazioSemConsultarDao() {
        // Arrange
        var estrategia = FabricaPrevisao.criar(TipoPrevisao.MEDIA_MOVEL);
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new ServicoMonitoramento(null, alertas, dados, estrategia));
        assertThrows(DadosInvalidosException.class, () -> servico(TipoPrevisao.MEDIA_MOVEL).analisar(" "));
        verifyNoInteractions(medicoes, alertas);
    }
}
