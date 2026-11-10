package br.com.agromais.agua.persistencia;

import br.com.agromais.agua.dominio.Medicao;
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

public final class MedicaoDAO {
    private static final String INSERIR = """
            INSERT INTO medicao(sensor_id, tipo, demonstracao, valor, unidade, data_hora)
            VALUES (?, ?, ?, ?, ?, ?)
            """;
    private static final String POR_SENSOR = """
            SELECT sensor_id, tipo, demonstracao, valor, unidade, data_hora
            FROM medicao WHERE sensor_id = ? ORDER BY data_hora, id
            """;
    private final BancoH2 banco;

    public MedicaoDAO(BancoH2 banco) {
        if (banco == null) {
            throw new DadosInvalidosException("Banco é obrigatório para o DAO de medições.");
        }
        this.banco = banco;
    }

    /** Insere uma nova linha e retorna a chave do banco; não atualiza registros anteriores. */
    public long salvar(Medicao medicao) {
        if (medicao == null) {
            throw new DadosInvalidosException("Medição é obrigatória para gravação.");
        }
        try (var conexao = banco.abrirConexao();
             var comando = conexao.prepareStatement(INSERIR, Statement.RETURN_GENERATED_KEYS)) {
            comando.setString(1, medicao.getSensorId());
            comando.setString(2, medicao.getTipo().name());
            comando.setBoolean(3, medicao.isDemonstracao());
            comando.setDouble(4, medicao.getValor());
            comando.setString(5, medicao.getUnidade());
            comando.setObject(6, medicao.getDataHora());
            comando.executeUpdate(); // Autocommit: uma inserção independente por operação.
            try (var chaves = comando.getGeneratedKeys()) {
                if (!chaves.next()) {
                    throw new SQLException("Chave da medição não retornada pelo banco.");
                }
                return chaves.getLong(1);
            }
        } catch (SQLException causa) {
            throw new PersistenciaException("Não foi possível gravar a medição.", causa);
        }
    }

    public List<Medicao> listarPorSensor(String sensorId) {
        if (sensorId == null || sensorId.isBlank()) {
            throw new DadosInvalidosException("Id do sensor é obrigatório para consultar medições.");
        }
        try (var conexao = banco.abrirConexao();
             var comando = conexao.prepareStatement(POR_SENSOR)) {
            comando.setString(1, sensorId.strip());
            try (var resultado = comando.executeQuery()) {
                List<Medicao> medicoes = new ArrayList<>();
                while (resultado.next()) {
                    medicoes.add(reconstruir(resultado));
                }
                return List.copyOf(medicoes);
            }
        } catch (SQLException | IllegalArgumentException causa) {
            throw new PersistenciaException("Não foi possível consultar ou reconstruir o histórico de medições.", causa);
        }
    }

    private Medicao reconstruir(ResultSet resultado) throws SQLException {
        var sensor = new SensorHistorico(resultado.getString("sensor_id"),
                TipoSensor.valueOf(resultado.getString("tipo")), resultado.getBoolean("demonstracao"));
        return new Medicao(sensor, resultado.getDouble("valor"), resultado.getString("unidade"),
                resultado.getObject("data_hora", OffsetDateTime.class));
    }
}
