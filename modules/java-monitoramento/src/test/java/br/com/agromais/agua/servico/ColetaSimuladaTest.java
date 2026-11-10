package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.*;
import br.com.agromais.agua.persistencia.*;
import java.nio.file.Path;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class ColetaSimuladaTest {
    @TempDir Path temporario;

    @Test
    void dezMinutosSaoGeradosSemEsperaEContinuamAposReabrir() {
        // Arrange
        Path arquivo = temporario.resolve("coleta");
        var dao = new MedicaoDAO(new BancoH2(arquivo));
        // Act
        new ColetaSimulada(dao).coletar(new SensorConsumo("c"), 10);
        var reaberto = new MedicaoDAO(new BancoH2(arquivo));
        new ColetaSimulada(reaberto).coletar(new SensorConsumo("c"), 2);
        var historico = reaberto.listarPorSensor("c");
        // Assert
        assertEquals(12, historico.size());
        assertEquals(ColetaSimulada.INICIO, historico.getFirst().getDataHora());
        assertEquals(ColetaSimulada.INICIO.plusMinutes(11), historico.getLast().getDataHora());
        for (int i = 1; i < historico.size(); i++) {
            assertEquals(Duration.ofMinutes(1), Duration.between(historico.get(i - 1).getDataHora(), historico.get(i).getDataHora()));
        }
        assertTrue(historico.stream().allMatch(Medicao::isDemonstracao));
    }

    @Test
    void continuaSerieLegadaValidaSemReescreverSeusHorarios() {
        // Arrange
        var dao = new MedicaoDAO(new BancoH2(temporario.resolve("legado")));
        OffsetDateTime inicioLegado = OffsetDateTime.parse("2025-01-01T08:30:00+02:00");
        dao.salvar(new Medicao(new SensorConsumo("c"), 35, "L", inicioLegado));
        // Act
        new ColetaSimulada(dao).coletar(new SensorConsumo("c"), 10);
        // Assert
        var historico = dao.listarPorSensor("c");
        assertEquals(35, historico.getFirst().getValor());
        assertEquals(inicioLegado, historico.getFirst().getDataHora());
        assertEquals(inicioLegado.plusMinutes(10), historico.getLast().getDataHora());
    }

    @Test
    void serieLegadaIrregularEOrigemIncompativelSaoPreservadas() {
        // Arrange
        var dao = new MedicaoDAO(new BancoH2(temporario.resolve("incompativel")));
        Sensor sensor = new SensorConsumo("c");
        for (int i : List.of(0, 1, 3)) {
            dao.salvar(new Medicao(sensor, 35, "L", ColetaSimulada.INICIO.plusMinutes(i)));
        }
        var coleta = new ColetaSimulada(dao);
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> coleta.coletar(sensor, 10));
        assertEquals(3, dao.listarPorSensor("c").size());
        coleta.coletar(new SensorConsumo("nova-serie"), 10);
        assertEquals(10, dao.listarPorSensor("nova-serie").size());
    }

    @Test
    void naoMisturaTipoOrigemOuCadenciaLegadaRegularDiferente() {
        // Arrange
        var dao = new MedicaoDAO(new BancoH2(temporario.resolve("tipo")));
        dao.salvar(new Medicao(new SensorPressao("p"), 2, "bar", ColetaSimulada.INICIO));
        dao.salvar(new Medicao(new SensorHistorico("real", TipoSensor.CONSUMO, false), 40, "L", ColetaSimulada.INICIO));
        dao.salvar(new Medicao(new SensorConsumo("lento"), 40, "L", ColetaSimulada.INICIO));
        dao.salvar(new Medicao(new SensorConsumo("lento"), 40, "L", ColetaSimulada.INICIO.plusMinutes(2)));
        var coleta = new ColetaSimulada(dao);
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> coleta.coletar(new SensorConsumo("p"), 1));
        assertThrows(DadosInvalidosException.class, () -> coleta.coletar(new SensorConsumo("real"), 1));
        assertThrows(DadosInvalidosException.class, () -> coleta.coletar(new SensorConsumo("lento"), 1));
        assertEquals(1, dao.listarPorSensor("p").size());
        assertEquals(2, dao.listarPorSensor("lento").size());
    }

    @Test
    void falhaDaFonteNoMeioDoLoteNaoGravaAmostrasParciais() {
        // Arrange
        var dao = new MedicaoDAO(new BancoH2(temporario.resolve("fonte")));
        Random gerador = new Random(42) {
            private int chamadas;
            @Override public double nextDouble(double origem, double limite) {
                if (++chamadas == 2) throw new IllegalStateException("Falha simulada");
                return 30;
            }
        };
        Sensor sensor = new SensorConsumo("c", true, gerador);
        // Act
        var erro = assertThrows(FonteIndisponivelException.class, () -> new ColetaSimulada(dao).coletar(sensor, 10));
        // Assert
        assertTrue(erro.getMessage().contains("falhou"));
        assertTrue(dao.listarPorSensor("c").isEmpty());
    }

    @Test
    void falhaSqlDesfazTodoLote() throws Exception {
        // Arrange: restrição exclusiva do banco temporário força falha na segunda linha.
        var banco = new BancoH2(temporario.resolve("rollback"));
        var dao = new MedicaoDAO(banco);
        try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("ALTER TABLE medicao ADD CHECK(valor < 50)")) {
            comando.executeUpdate();
        }
        Sensor sensor = new SensorConsumo("c");
        var lote = List.of(new Medicao(sensor, 30, "L", ColetaSimulada.INICIO),
                new Medicao(sensor, 100, "L", ColetaSimulada.INICIO.plusMinutes(1)));
        // Act
        assertThrows(PersistenciaException.class, () -> dao.salvarTodas(lote));
        // Assert
        assertTrue(dao.listarPorSensor("c").isEmpty());
    }

    @Test
    void quantidadeEOrigemInvalidasNaoGravamNada() {
        // Arrange
        var dao = new MedicaoDAO(new BancoH2(temporario.resolve("invalidos")));
        var coleta = new ColetaSimulada(dao);
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> coleta.coletar(new SensorConsumo("c"), 0));
        assertThrows(DadosInvalidosException.class, () -> coleta.coletar(new SensorConsumo("c"), 1001));
        assertThrows(DadosInvalidosException.class, () -> coleta.coletar(new SensorHistorico("c", TipoSensor.CONSUMO, false), 1));
        assertTrue(dao.listarSensores().isEmpty());
    }
}
