package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.FonteIndisponivelException;
import java.util.List;
import java.util.Random;
import java.util.function.BiFunction;
import java.util.random.RandomGenerator;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import static org.junit.jupiter.api.Assertions.*;

class SensoresTest {
    static Stream<BiFunction<Boolean, RandomGenerator, Sensor>> fabricas() {
        return Stream.of(
                (ativo, gerador) -> new SensorConsumo("consumo-1", ativo, gerador),
                (ativo, gerador) -> new SensorVazao("vazao-1", ativo, gerador),
                (ativo, gerador) -> new SensorPressao("pressao-1", ativo, gerador));
    }

    @Test
    void capturaTresTiposPelaMesmaInterfaceComUnidadesEIdentificacaoDeDemonstracao() {
        // Arrange
        List<Sensor> sensores = List.of(new SensorConsumo("c"), new SensorVazao("v"), new SensorPressao("p"));
        // Act
        List<Medicao> medicoes = sensores.stream().map(Medicao::capturar).toList();
        // Assert
        assertEquals(List.of(TipoSensor.CONSUMO, TipoSensor.VAZAO, TipoSensor.PRESSAO),
                medicoes.stream().map(Medicao::getTipo).toList());
        assertEquals(List.of("L", "L/min", "bar"), medicoes.stream().map(Medicao::getUnidade).toList());
        assertTrue(medicoes.stream().allMatch(Medicao::isDemonstracao));
    }

    @ParameterizedTest
    @MethodSource("fabricas")
    void sequenciaSimuladaFicaNaFaixaDidatica(BiFunction<Boolean, RandomGenerator, Sensor> fabrica) {
        // Arrange
        Sensor sensor = fabrica.apply(true, new Random(42));
        double minimo = switch (sensor.getTipo()) { case CONSUMO -> 20; case VAZAO -> 5; case PRESSAO -> 1; };
        double maximo = switch (sensor.getTipo()) { case CONSUMO -> 120; case VAZAO -> 80; case PRESSAO -> 4; };
        // Act
        double[] valores = Stream.generate(sensor::lerValor).limit(1000).mapToDouble(Double::doubleValue).toArray();
        // Assert
        for (double valor : valores) {
            assertTrue(Double.isFinite(valor) && valor >= minimo && valor < maximo);
        }
        assertTrue(java.util.Arrays.stream(valores).distinct().count() > 1);
    }

    @ParameterizedTest
    @MethodSource("fabricas")
    void fonteInativaNaoGeraMedicao(BiFunction<Boolean, RandomGenerator, Sensor> fabrica) {
        // Arrange
        Sensor sensor = fabrica.apply(false, new Random(42));
        // Act
        var erro = assertThrows(FonteIndisponivelException.class, () -> Medicao.capturar(sensor));
        // Assert
        assertFalse(sensor.verificarFuncionamento());
        assertTrue(erro.getMessage().contains(sensor.getId()));
    }

    @ParameterizedTest
    @MethodSource("fabricas")
    void falhaDoGeradorPreservaCausa(BiFunction<Boolean, RandomGenerator, Sensor> fabrica) {
        // Arrange: substituto manual pequeno, sem DAO nesta etapa.
        RuntimeException causa = new IllegalStateException("Gerador indisponível");
        RandomGenerator gerador = () -> { throw causa; };
        Sensor sensor = fabrica.apply(true, gerador);
        // Act
        var erro = assertThrows(FonteIndisponivelException.class, sensor::lerValor);
        // Assert
        assertSame(causa, erro.getCause());
        assertTrue(erro.getMessage().contains(sensor.getId()));
    }

    @ParameterizedTest
    @MethodSource("fabricas")
    void valorInvalidoDoGeradorNaoEConfundidoComIndisponibilidade(BiFunction<Boolean, RandomGenerator, Sensor> fabrica) {
        // Arrange
        RandomGenerator gerador = new Random(42) {
            @Override
            public double nextDouble(double origem, double limite) { return Double.NaN; }
        };
        Sensor sensor = fabrica.apply(true, gerador);
        // Act
        var erro = assertThrows(DadosInvalidosException.class, sensor::lerValor);
        // Assert
        assertTrue(erro.getMessage().contains("finito"));
    }

    @ParameterizedTest
    @MethodSource("fabricas")
    void rejeitaGeradorAusente(BiFunction<Boolean, RandomGenerator, Sensor> fabrica) {
        // Arrange
        RandomGenerator ausente = null;
        // Act
        var erro = assertThrows(DadosInvalidosException.class, () -> fabrica.apply(true, ausente));
        // Assert
        assertTrue(erro.getMessage().contains("Gerador"));
    }
}
