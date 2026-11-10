package br.com.agromais.agua.persistencia;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.PersistenciaException;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import static org.junit.jupiter.api.Assertions.*;

class MedicaoDAOTest {
    @TempDir Path temporario;
    private BancoH2 banco;
    private MedicaoDAO dao;
    private final OffsetDateTime horario = OffsetDateTime.parse("2026-11-10T09:00:00.123456789-03:00");

    @BeforeEach
    void prepararBanco() {
        banco = new BancoH2(temporario.resolve("medicoes"));
        dao = new MedicaoDAO(banco);
    }

    @ParameterizedTest
    @EnumSource(TipoSensor.class)
    void insereERecuperaTodosOsMetadadosSemPerderPrecisao(TipoSensor tipo) {
        // Arrange: preservar também origem não demonstrativa, sem conectar sensores reais.
        Sensor sensor = new SensorHistorico("sensor-'á-" + tipo, tipo, false);
        Medicao original = new Medicao(sensor, 2.123456789, tipo.getUnidade(), horario);
        // Act
        long id = dao.salvar(original);
        Medicao recuperada = dao.listarPorSensor(sensor.getId()).getFirst();
        // Assert
        assertTrue(id > 0);
        assertAll(
                () -> assertEquals(original.getSensorId(), recuperada.getSensorId()),
                () -> assertEquals(tipo, recuperada.getTipo()),
                () -> assertEquals(original.getValor(), recuperada.getValor()),
                () -> assertEquals(original.getUnidade(), recuperada.getUnidade()),
                () -> assertEquals(horario, recuperada.getDataHora()),
                () -> assertFalse(recuperada.isDemonstracao()),
                () -> assertFalse(recuperada.getSensor().verificarFuncionamento()));
    }

    @Test
    void filtraPorSensorSemMisturarHistoricos() {
        // Arrange
        dao.salvar(new Medicao(new SensorConsumo("sensor-a"), 30, "L", horario));
        dao.salvar(new Medicao(new SensorConsumo("sensor-b"), 70, "L", horario));
        // Act
        List<Medicao> historico = dao.listarPorSensor("sensor-a");
        // Assert
        assertEquals(List.of(30.0), historico.stream().map(Medicao::getValor).toList());
        assertTrue(dao.listarPorSensor("inexistente").isEmpty());
        assertEquals(70, dao.listarPorSensor("sensor-b").getFirst().getValor());
        assertTrue(historico.getFirst().isDemonstracao());
    }

    @Test
    void ordenaPorInstanteComOffsetsDiferentesENanosEDesempataPeloId() {
        // Arrange: 10h+02 é anterior a 09h-03, embora o relógio local indique o contrário.
        Sensor sensor = new SensorConsumo("c");
        OffsetDateTime primeiro = OffsetDateTime.parse("2026-11-10T10:00:00+02:00");
        dao.salvar(new Medicao(sensor, 40, "L", horario.plusNanos(1)));
        dao.salvar(new Medicao(sensor, 10, "L", primeiro));
        dao.salvar(new Medicao(sensor, 20, "L", horario));
        dao.salvar(new Medicao(sensor, 30, "L", horario));
        // Act
        List<Medicao> historico = dao.listarPorSensor("c");
        // Assert
        assertEquals(List.of(10.0, 20.0, 30.0, 40.0), historico.stream().map(Medicao::getValor).toList());
        assertEquals(primeiro, historico.getFirst().getDataHora());
    }

    @Test
    void sqlEmIdentificadorETratadoComoTextoNaGravacaoENaConsulta() {
        // Arrange
        String idMalicioso = "x'; DROP TABLE medicao; --";
        dao.salvar(new Medicao(new SensorConsumo("normal"), 25, "L", horario));
        dao.salvar(new Medicao(new SensorConsumo(idMalicioso), 45, "L", horario));
        // Act
        List<Medicao> historico = dao.listarPorSensor(idMalicioso);
        // Assert
        assertEquals(1, historico.size());
        assertEquals(idMalicioso, historico.getFirst().getSensorId());
        assertTrue(dao.listarPorSensor("' OR '1'='1").isEmpty());
        assertEquals(1, dao.listarPorSensor("normal").size());
    }

    @Test
    void recusaNulosEValoresInvalidosSemGravar() {
        // Arrange
        Sensor sensor = new SensorConsumo("c");
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> dao.salvar(null));
        assertThrows(DadosInvalidosException.class, () -> dao.listarPorSensor(null));
        assertThrows(DadosInvalidosException.class, () -> dao.listarPorSensor(" "));
        assertThrows(DadosInvalidosException.class,
                () -> dao.salvar(new Medicao(sensor, Double.NaN, "L", horario)));
        assertTrue(dao.listarPorSensor("c").isEmpty());
    }

    @Test
    void registroInvalidoInseridoPorForaDoDaoNaoEDevolvidoComoMedicaoValida() throws Exception {
        // Arrange: simula adulteração externa; validação continua nos objetos do domínio.
        dao.salvar(new Medicao(new SensorConsumo("c"), 30, "L", horario));
        try (var conexao = banco.abrirConexao();
             var comando = conexao.prepareStatement("UPDATE medicao SET valor = ? WHERE sensor_id = ?")) {
            comando.setDouble(1, -1);
            comando.setString(2, "c");
            comando.executeUpdate();
        }
        // Act
        var erro = assertThrows(PersistenciaException.class, () -> dao.listarPorSensor("c"));
        // Assert
        assertInstanceOf(DadosInvalidosException.class, erro.getCause());
    }

    @Test
    void erroSqlTemMensagemECausaSemFingirHistoricoVazio() throws Exception {
        // Arrange: somente o banco temporário é danificado deliberadamente.
        try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("DROP TABLE medicao")) {
            comando.executeUpdate();
        }
        // Act
        var consulta = assertThrows(PersistenciaException.class, () -> dao.listarPorSensor("c"));
        var gravacao = assertThrows(PersistenciaException.class,
                () -> dao.salvar(new Medicao(new SensorConsumo("c"), 30, "L", horario)));
        // Assert
        assertInstanceOf(java.sql.SQLException.class, consulta.getCause());
        assertInstanceOf(java.sql.SQLException.class, gravacao.getCause());
        assertTrue(gravacao.getMessage().contains("gravar"));
    }
}
