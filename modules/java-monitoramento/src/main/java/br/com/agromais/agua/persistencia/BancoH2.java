package br.com.agromais.agua.persistencia;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.PersistenciaException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/** H2 embarcado em arquivo. Não mantém conexão aberta nem apaga dados na inicialização. */
public final class BancoH2 {
    private static final String CRIAR_MEDICAO = """
            CREATE TABLE IF NOT EXISTS medicao (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                sensor_id VARCHAR NOT NULL,
                tipo VARCHAR NOT NULL,
                demonstracao BOOLEAN NOT NULL,
                valor DOUBLE PRECISION NOT NULL,
                unidade VARCHAR NOT NULL,
                data_hora TIMESTAMP(9) WITH TIME ZONE NOT NULL
            )
            """;
    private static final String CRIAR_ALERTA = """
            CREATE TABLE IF NOT EXISTS alerta (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                sensor_id VARCHAR NOT NULL,
                tipo VARCHAR NOT NULL,
                demonstracao BOOLEAN NOT NULL,
                nivel VARCHAR NOT NULL,
                previsao DOUBLE PRECISION NOT NULL,
                limiar DOUBLE PRECISION NOT NULL,
                unidade VARCHAR NOT NULL,
                justificativa VARCHAR NOT NULL,
                data_hora TIMESTAMP(9) WITH TIME ZONE NOT NULL
            )
            """;
    private final String url;

    /** Caminho relativo ao diretório de execução; usar sempre o mesmo para reabrir os dados. */
    public BancoH2() {
        this(Path.of(".data", "agro-agua"));
    }

    /** Recebe o caminho-base, sem a extensão .mv.db; não aceita uma URL JDBC arbitrária. */
    public BancoH2(Path arquivo) {
        if (arquivo == null || arquivo.toString().isBlank() || arquivo.getFileName() == null) {
            throw new DadosInvalidosException("Caminho-base do banco é obrigatório.");
        }
        Path absoluto = arquivo.toAbsolutePath().normalize();
        String caminho = absoluto.toString().replace('\\', '/');
        if (caminho.contains(";") || caminho.chars().anyMatch(Character::isISOControl)) {
            throw new DadosInvalidosException("Caminho do banco não pode conter opções JDBC ou controles.");
        }
        // Sem DB_CLOSE_DELAY: fechar a última conexão encerra o banco em arquivo.
        url = "jdbc:h2:file:" + caminho;
        try {
            Files.createDirectories(absoluto.getParent());
            inicializar();
        } catch (IOException | SQLException causa) {
            throw new PersistenciaException("Não foi possível inicializar o banco H2 em arquivo.", causa);
        }
    }

    /** O chamador é responsável por fechar a conexão com try-with-resources. */
    public Connection abrirConexao() throws SQLException {
        return DriverManager.getConnection(url, "sa", "");
    }

    private void inicializar() throws SQLException {
        try (Connection conexao = abrirConexao()) {
            executar(conexao, CRIAR_MEDICAO);
            executar(conexao, CRIAR_ALERTA);
            executar(conexao, "CREATE INDEX IF NOT EXISTS idx_medicao_sensor_data ON medicao(sensor_id, data_hora, id)");
            executar(conexao, "CREATE INDEX IF NOT EXISTS idx_alerta_sensor_data ON alerta(sensor_id, data_hora, id)");
        }
    }

    private void executar(Connection conexao, String sqlFixo) throws SQLException {
        try (var comando = conexao.prepareStatement(sqlFixo)) {
            comando.executeUpdate();
        }
    }
}
