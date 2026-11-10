package br.com.agromais.agua.persistencia;

import br.com.agromais.agua.dominio.Alerta;
import br.com.agromais.agua.dominio.NivelAlerta;
import br.com.agromais.agua.dominio.SensorHistorico;
import br.com.agromais.agua.dominio.TipoSensor;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.PersistenciaException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public final class AlertaDAO {
    private static final String INSERIR = """
            INSERT INTO alerta(sensor_id, tipo, demonstracao, nivel, previsao, limiar, unidade, justificativa, data_hora)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
    private static final String POR_SENSOR = """
            SELECT * FROM alerta WHERE sensor_id = ? ORDER BY data_hora, id
            """;
    private static final String TODOS = "SELECT * FROM alerta ORDER BY data_hora, id";
    private final BancoH2 banco;

    public AlertaDAO(BancoH2 banco) {
        if (banco == null) {
            throw new DadosInvalidosException("Banco é obrigatório para o DAO de alertas.");
        }
        this.banco = banco;
    }

    public long salvar(Alerta alerta) {
        if (alerta == null) {
            throw new DadosInvalidosException("Alerta é obrigatório para gravação.");
        }
        try (var conexao = banco.abrirConexao();
             var comando = conexao.prepareStatement(INSERIR, Statement.RETURN_GENERATED_KEYS)) {
            comando.setString(1, alerta.getSensorId());
            comando.setString(2, alerta.getTipo().name());
            comando.setBoolean(3, alerta.isDemonstracao());
            comando.setString(4, alerta.getNivel().name());
            comando.setDouble(5, alerta.getPrevisao());
            comando.setDouble(6, alerta.getLimiar());
            comando.setString(7, alerta.getUnidade());
            comando.setString(8, alerta.getJustificativa());
            comando.setObject(9, alerta.getDataHora());
            comando.executeUpdate();
            try (var chaves = comando.getGeneratedKeys()) {
                if (!chaves.next()) {
                    throw new SQLException("Chave do alerta não retornada pelo banco.");
                }
                return chaves.getLong(1);
            }
        } catch (SQLException causa) {
            throw new PersistenciaException("Não foi possível gravar o alerta.", causa);
        }
    }

    public List<Alerta> listarPorSensor(String sensorId) {
        if (sensorId == null || sensorId.isBlank()) {
            throw new DadosInvalidosException("Id do sensor é obrigatório para consultar alertas.");
        }
        return consultar(POR_SENSOR, sensorId.strip());
    }

    public List<Alerta> listarTodos() {
        return consultar(TODOS, null);
    }

    /** sqlFixo vem exclusivamente das constantes da classe, nunca do chamador externo. */
    private List<Alerta> consultar(String sqlFixo, String sensorId) {
        try (var conexao = banco.abrirConexao();
             var comando = conexao.prepareStatement(sqlFixo)) {
            if (sensorId != null) {
                comando.setString(1, sensorId);
            }
            try (var resultado = comando.executeQuery()) {
                List<Alerta> alertas = new ArrayList<>();
                while (resultado.next()) {
                    alertas.add(reconstruir(resultado));
                }
                return List.copyOf(alertas);
            }
        } catch (SQLException | IllegalArgumentException causa) {
            throw new PersistenciaException("Não foi possível consultar ou reconstruir o histórico de alertas.", causa);
        }
    }

    private Alerta reconstruir(ResultSet resultado) throws SQLException {
        var sensor = new SensorHistorico(resultado.getString("sensor_id"),
                TipoSensor.valueOf(resultado.getString("tipo")), resultado.getBoolean("demonstracao"));
        return new Alerta(NivelAlerta.valueOf(resultado.getString("nivel")), sensor,
                resultado.getDouble("previsao"), resultado.getDouble("limiar"), resultado.getString("unidade"),
                resultado.getString("justificativa"), resultado.getObject("data_hora", OffsetDateTime.class));
    }
}
