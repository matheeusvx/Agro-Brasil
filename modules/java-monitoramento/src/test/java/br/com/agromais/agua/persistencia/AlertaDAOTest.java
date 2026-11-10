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

class AlertaDAOTest {
    @TempDir Path temporario;
    private BancoH2 banco;
    private AlertaDAO dao;
    private final OffsetDateTime horario = OffsetDateTime.parse("2026-11-10T09:00:00.987654321-03:00");

    @BeforeEach
    void prepararBanco() {
        banco = new BancoH2(temporario.resolve("alertas"));
        dao = new AlertaDAO(banco);
    }

    private Alerta alerta(String sensorId, double previsao, OffsetDateTime dataHora) {
        return new Alerta(NivelAlerta.ALERTA, new SensorConsumo(sensorId), previsao, 60,
                "L", "Consumo projetado acima do limiar demonstrativo", dataHora);
    }

    @ParameterizedTest
    @EnumSource(NivelAlerta.class)
    void recuperaTodosOsCamposENiveis(NivelAlerta nivel) {
        // Arrange
        Alerta original = new Alerta(nivel, new SensorPressao("pressão-demo"), 0.5, 1,
                "bar", "Pressão baixa; verificar a instalação", horario);
        // Act
        long id = dao.salvar(original);
        Alerta recuperado = dao.listarTodos().getFirst();
        // Assert
        assertTrue(id > 0);
        assertAll(
                () -> assertEquals(original.getSensorId(), recuperado.getSensorId()),
                () -> assertEquals(nivel, recuperado.getNivel()),
                () -> assertEquals(TipoSensor.PRESSAO, recuperado.getTipo()),
                () -> assertEquals("bar", recuperado.getUnidade()),
                () -> assertTrue(recuperado.isDemonstracao()),
                () -> assertEquals(0.5, recuperado.getPrevisao()),
                () -> assertEquals(1, recuperado.getLimiar()),
                () -> assertEquals(original.getJustificativa(), recuperado.getJustificativa()),
                () -> assertEquals(horario, recuperado.getDataHora()));
    }

    @Test
    void preservaOrigemNaoDemonstrativaSemFonteAtiva() {
        // Arrange
        Sensor sensor = new SensorHistorico("v-antigo", TipoSensor.VAZAO, false);
        Alerta original = new Alerta(NivelAlerta.ATENCAO, sensor, 90, 80, "L/min", "Dado de teste", horario);
        // Act
        dao.salvar(original);
        Alerta recuperado = dao.listarPorSensor("v-antigo").getFirst();
        // Assert
        assertFalse(recuperado.isDemonstracao());
        assertFalse(recuperado.getSensor().verificarFuncionamento());
        assertEquals(TipoSensor.VAZAO, recuperado.getTipo());
        assertEquals("L/min", recuperado.getUnidade());
    }

    @Test
    void filtraSemMisturarSensoresEOrdenaPorInstanteComDesempate() {
        // Arrange
        OffsetDateTime antes = OffsetDateTime.parse("2026-11-10T10:00:00+02:00");
        dao.salvar(alerta("a", 90, horario.plusNanos(1)));
        dao.salvar(alerta("b", 65, antes));
        dao.salvar(alerta("a", 70, horario));
        dao.salvar(alerta("a", 80, horario));
        // Act
        List<Alerta> doSensor = dao.listarPorSensor("a");
        List<Alerta> todos = dao.listarTodos();
        // Assert
        assertEquals(List.of(70.0, 80.0, 90.0), doSensor.stream().map(Alerta::getPrevisao).toList());
        assertEquals(List.of(65.0, 70.0, 80.0, 90.0), todos.stream().map(Alerta::getPrevisao).toList());
        assertEquals(1, dao.listarPorSensor("b").size());
        assertTrue(dao.listarPorSensor("inexistente").isEmpty());
    }

    @Test
    void identificadorEJustificativaComSqlSaoApenasTexto() {
        // Arrange
        String sensorId = "x'; DROP TABLE alerta; --";
        String justificativa = "D'água; DELETE FROM medicao; -- é apenas texto";
        Alerta original = new Alerta(NivelAlerta.CRITICO, new SensorConsumo(sensorId), 90, 60,
                "L", justificativa, horario);
        dao.salvar(alerta("normal", 80, horario));
        // Act
        dao.salvar(original);
        List<Alerta> recuperados = dao.listarPorSensor(sensorId);
        // Assert
        assertEquals(1, recuperados.size());
        assertEquals(sensorId, recuperados.getFirst().getSensorId());
        assertEquals(justificativa, recuperados.getFirst().getJustificativa());
        assertTrue(dao.listarPorSensor("' OR '1'='1").isEmpty());
        assertEquals(2, dao.listarTodos().size());
    }

    @Test
    void invalidosNaoSaoGravados() {
        // Arrange
        Sensor sensor = new SensorConsumo("c");
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> dao.salvar(null));
        assertThrows(DadosInvalidosException.class, () -> dao.listarPorSensor(null));
        assertThrows(DadosInvalidosException.class, () -> dao.listarPorSensor(" "));
        assertThrows(DadosInvalidosException.class,
                () -> dao.salvar(new Alerta(NivelAlerta.ALERTA, sensor, -1, 60, "L", "Motivo", horario)));
        assertTrue(dao.listarTodos().isEmpty());
    }

    @Test
    void adulteracaoDeUnidadeERejeitadaPeloDominioNaLeitura() throws Exception {
        // Arrange
        dao.salvar(alerta("c", 80, horario));
        try (var conexao = banco.abrirConexao();
             var comando = conexao.prepareStatement("UPDATE alerta SET unidade = ? WHERE sensor_id = ?")) {
            comando.setString(1, "kg");
            comando.setString(2, "c");
            comando.executeUpdate();
        }
        // Act
        var erro = assertThrows(PersistenciaException.class, dao::listarTodos);
        // Assert
        assertInstanceOf(DadosInvalidosException.class, erro.getCause());
    }

    @Test
    void nivelDesconhecidoNoBancoNaoEViradoEmNivelPadrao() throws Exception {
        // Arrange
        dao.salvar(alerta("c", 80, horario));
        try (var conexao = banco.abrirConexao();
             var comando = conexao.prepareStatement("UPDATE alerta SET nivel = ? WHERE sensor_id = ?")) {
            comando.setString(1, "DESCONHECIDO");
            comando.setString(2, "c");
            comando.executeUpdate();
        }
        // Act
        var erro = assertThrows(PersistenciaException.class, () -> dao.listarPorSensor("c"));
        // Assert
        assertInstanceOf(IllegalArgumentException.class, erro.getCause());
    }

    @Test
    void falhasSqlDeConsultaEGravacaoMantemCausa() throws Exception {
        // Arrange: somente o banco temporário é danificado deliberadamente.
        try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("DROP TABLE alerta")) {
            comando.executeUpdate();
        }
        // Act
        var consulta = assertThrows(PersistenciaException.class, dao::listarTodos);
        var gravacao = assertThrows(PersistenciaException.class, () -> dao.salvar(alerta("c", 80, horario)));
        // Assert
        assertInstanceOf(java.sql.SQLException.class, consulta.getCause());
        assertInstanceOf(java.sql.SQLException.class, gravacao.getCause());
    }
}
