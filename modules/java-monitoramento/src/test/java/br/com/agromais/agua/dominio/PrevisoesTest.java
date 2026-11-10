package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PrevisoesTest {
    private final OffsetDateTime inicio = OffsetDateTime.parse("2026-11-10T09:00:00-03:00");

    private List<Medicao> historico(double... valores) {
        Sensor sensor = new SensorConsumo("c");
        List<Medicao> medicoes = new ArrayList<>();
        for (int i = 0; i < valores.length; i++) {
            medicoes.add(new Medicao(sensor, valores[i], "L", inicio.plusMinutes(i)));
        }
        return medicoes;
    }

    static Stream<EstrategiaPrevisao> estrategias() {
        return Stream.of(new PrevisaoMediaMovel(5), new PrevisaoComparacao(5));
    }

    @Test
    void mediaMovelUsaSomenteAsUltimasNAmostras() {
        // Arrange: a primeira medição não pode participar da janela.
        EstrategiaPrevisao estrategia = new PrevisaoMediaMovel(5);
        List<Medicao> medicoes = historico(200, 10, 20, 30, 40, 50);
        // Act
        ResultadoPrevisao resultado = estrategia.prever("c", medicoes);
        // Assert
        assertEquals(30, resultado.valor(), 1e-10);
        assertEquals("L", resultado.unidade());
        assertEquals("c", resultado.sensor().getId());
        assertTrue(resultado.sensor().isDemonstracao());
        assertTrue(resultado.explicacao().contains("últimas 5"));
        assertEquals(6, medicoes.size());
    }

    @ParameterizedTest
    @CsvSource({"10,20,30,aumento", "20,15,10,redução", "10,10,10,estabilidade", "0,10,20,aumento", "10,5,0,redução"})
    void comparacaoProduzEstimativaETendenciaConhecidas(double anterior, double recente, double esperado, String tendencia) {
        // Arrange
        EstrategiaPrevisao estrategia = new PrevisaoComparacao(5);
        List<Medicao> medicoes = historico(anterior, anterior, anterior, anterior, anterior,
                recente, recente, recente, recente, recente);
        // Act
        ResultadoPrevisao resultado = estrategia.prever("c", medicoes);
        // Assert
        assertEquals(esperado, resultado.valor(), 1e-10);
        assertTrue(resultado.explicacao().contains(tendencia));
        assertTrue(resultado.explicacao().contains("média anterior=" + anterior));
        assertTrue(resultado.explicacao().contains("média recente=" + recente));
    }

    @Test
    void comparacaoIgnoraAmostrasAnterioresAsDuasUltimasJanelas() {
        // Arrange
        EstrategiaPrevisao estrategia = new PrevisaoComparacao(5);
        var medicoes = historico(200, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20);
        // Act
        var resultado = estrategia.prever("c", medicoes);
        // Assert
        assertEquals(30, resultado.valor());
    }

    @Test
    void mesmaAbstracaoExecutaAlgoritmosDiferentesSemInspecionarTipos() {
        // Arrange
        var medicoes = historico(10, 10, 10, 10, 10, 20, 20, 20, 20, 20);
        List<EstrategiaPrevisao> estrategias = List.of(new PrevisaoMediaMovel(5), new PrevisaoComparacao(5));
        // Act
        var valores = estrategias.stream().map(e -> e.prever("c", medicoes).valor()).toList();
        // Assert
        assertEquals(List.of(20.0, 30.0), valores);
    }

    @ParameterizedTest
    @MethodSource("estrategias")
    void historicoInsuficienteInformaQuantidadeNecessaria(EstrategiaPrevisao estrategia) {
        // Arrange
        List<Medicao> medicoes = historico(10, 20, 30, 40);
        // Act
        var erro = assertThrows(DadosInvalidosException.class, () -> estrategia.prever("c", medicoes));
        // Assert
        assertTrue(erro.getMessage().contains("necessárias " + estrategia.getHistoricoMinimo()));
        assertTrue(erro.getMessage().contains("disponíveis 4"));
    }

    @Test
    void comparacaoExigeDuasJanelasCompletas() {
        // Arrange
        var medicoes = historico(10, 10, 10, 10, 10, 20, 20, 20, 20);
        // Act
        var erro = assertThrows(DadosInvalidosException.class, () -> new PrevisaoComparacao(5).prever("c", medicoes));
        // Assert
        assertTrue(erro.getMessage().contains("necessárias 10"));
    }

    @ParameterizedTest
    @CsvSource({"0,120,240", "100,0,-100", "0,200,400"})
    void extrapolacaoForaDaFaixaFalhaSemCortarOuSubstituirValor(double anterior, double recente, double calculado) {
        // Arrange
        var medicoes = historico(anterior, anterior, anterior, anterior, anterior,
                recente, recente, recente, recente, recente);
        // Act
        var erro = assertThrows(DadosInvalidosException.class, () -> new PrevisaoComparacao(5).prever("c", medicoes));
        // Assert
        assertTrue(erro.getMessage().contains("Previsão calculada inválida"));
        assertTrue(erro.getMessage().contains(Double.toString(calculado)));
        assertInstanceOf(DadosInvalidosException.class, erro.getCause());
    }

    @ParameterizedTest
    @MethodSource("estrategias")
    void inconsistenciasMesmoForaDaJanelaImpedemQualquerCalculo(EstrategiaPrevisao estrategia) {
        // Arrange: índice zero fica fora das últimas janelas usadas pelos dois algoritmos.
        List<Medicao> consistente = historico(10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20);
        Sensor outro = new SensorConsumo("outro");
        Sensor tipoDiferente = new SensorVazao("c");
        Sensor origemDiferente = new SensorHistorico("c", TipoSensor.CONSUMO, false);
        List<Medicao> primeirasInvalidas = java.util.Arrays.asList(null,
                new Medicao(outro, 10, "L", inicio),
                new Medicao(tipoDiferente, 10, "L/min", inicio),
                new Medicao(origemDiferente, 10, "L", inicio));
        // Act + Assert
        for (Medicao invalida : primeirasInvalidas) {
            var historico = new ArrayList<>(consistente);
            historico.set(0, invalida);
            assertThrows(DadosInvalidosException.class, () -> estrategia.prever("c", historico));
        }
    }

    @ParameterizedTest
    @MethodSource("estrategias")
    void rejeitaInstantesDuplicadosDesordenadosOuCadenciaIrregular(EstrategiaPrevisao estrategia) {
        // Arrange
        List<Medicao> consistente = historico(10, 10, 10, 10, 10, 20, 20, 20, 20, 20);
        // Act + Assert
        for (OffsetDateTime horario : List.of(inicio.plusMinutes(8), inicio.minusMinutes(1), inicio.plusMinutes(10))) {
            var medicoes = new ArrayList<>(consistente);
            medicoes.set(9, new Medicao(new SensorConsumo("c"), 20, "L", horario));
            assertThrows(DadosInvalidosException.class, () -> estrategia.prever("c", medicoes));
        }
    }

    @ParameterizedTest
    @MethodSource("estrategias")
    void rejeitaValorNaoFinitoEUnidadeInvalidaAntesDoCalculo(EstrategiaPrevisao estrategia) {
        // Arrange: Mockito simula retorno incorreto de um DAO; os construtores reais já proíbem esses dados.
        Medicao invalida = mock(Medicao.class);
        when(invalida.getSensorId()).thenReturn("c");
        when(invalida.getTipo()).thenReturn(TipoSensor.CONSUMO);
        when(invalida.getDataHora()).thenReturn(inicio);
        when(invalida.getValor()).thenReturn(Double.NaN);
        var medicoes = historico(10, 10, 10, 10, 10, 20, 20, 20, 20, 20);
        medicoes.set(0, invalida);
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> estrategia.prever("c", medicoes));
        when(invalida.getValor()).thenReturn(10.0);
        when(invalida.getUnidade()).thenReturn("kg");
        assertThrows(DadosInvalidosException.class, () -> estrategia.prever("c", medicoes));
    }

    @ParameterizedTest
    @MethodSource("estrategias")
    void comparaInstantesComOffsetsDiferentes(EstrategiaPrevisao estrategia) {
        // Arrange: horários locais diferentes, mas cadência de um minuto em instantes UTC.
        var medicoes = historico(10, 10, 10, 10, 10, 10, 10, 10, 10, 10);
        Medicao ultima = medicoes.getLast();
        medicoes.set(9, new Medicao(new SensorConsumo("c"), 10, "L",
                ultima.getDataHora().withOffsetSameInstant(java.time.ZoneOffset.ofHours(2))));
        // Act
        ResultadoPrevisao resultado = estrategia.prever("c", medicoes);
        // Assert
        assertEquals(10, resultado.valor());
    }

    @ParameterizedTest
    @MethodSource("estrategias")
    void rejeitaHistoricoNuloVazioOuSensorAusente(EstrategiaPrevisao estrategia) {
        // Arrange
        List<Medicao> vazio = List.of();
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> estrategia.prever("c", null));
        assertThrows(DadosInvalidosException.class, () -> estrategia.prever("c", vazio));
        assertThrows(DadosInvalidosException.class, () -> estrategia.prever(" ", vazio));
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 4})
    void construtoresNaoAceitamJanelaInsuficiente(int janela) {
        // Arrange + Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new PrevisaoMediaMovel(janela));
        assertThrows(DadosInvalidosException.class, () -> new PrevisaoComparacao(janela));
    }

    @Test
    void resultadoNaoAceitaUnidadeIncompativelOuValorInvalido() {
        // Arrange
        Sensor sensor = new SensorConsumo("c");
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new ResultadoPrevisao(sensor, 10, "bar", "Explicação"));
        assertThrows(DadosInvalidosException.class, () -> new ResultadoPrevisao(sensor, Double.NaN, "L", "Explicação"));
        assertThrows(DadosInvalidosException.class, () -> new ResultadoPrevisao(sensor, 10, "L", " "));
    }
}
