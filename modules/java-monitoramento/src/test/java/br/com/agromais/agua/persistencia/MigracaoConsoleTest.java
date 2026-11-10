package br.com.agromais.agua.persistencia;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.*;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class MigracaoConsoleTest {
    @TempDir Path temporario;

    @Test
    void schemaAnteriorRecebeColunaSemExcluirDadosEInicializacaoPodeSerRepetida() throws Exception {
        // Arrange: arquivo temporário com exatamente a tabela de alertas das etapas anteriores.
        Path arquivo = temporario.resolve("legado");
        String url = "jdbc:h2:file:" + arquivo.toAbsolutePath().toString().replace('\\', '/');
        OffsetDateTime horario = OffsetDateTime.parse("2026-11-10T09:00:00.123456789-03:00");
        try (var conexao = DriverManager.getConnection(url, "sa", ""); var schema = conexao.prepareStatement("""
                CREATE TABLE alerta (
                    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    sensor_id VARCHAR NOT NULL, tipo VARCHAR NOT NULL, demonstracao BOOLEAN NOT NULL,
                    nivel VARCHAR NOT NULL, previsao DOUBLE PRECISION NOT NULL, limiar DOUBLE PRECISION NOT NULL,
                    unidade VARCHAR NOT NULL, justificativa VARCHAR NOT NULL, data_hora TIMESTAMP(9) WITH TIME ZONE NOT NULL)
                """)) {
            schema.executeUpdate();
            try (var inserir = conexao.prepareStatement("""
                    INSERT INTO alerta(sensor_id,tipo,demonstracao,nivel,previsao,limiar,unidade,justificativa,data_hora)
                    VALUES (?,?,?,?,?,?,?,?,?)
                    """)) {
                inserir.setString(1, "legado"); inserir.setString(2, "CONSUMO"); inserir.setBoolean(3, true);
                inserir.setString(4, "ALERTA"); inserir.setDouble(5, 120); inserir.setDouble(6, 100);
                inserir.setString(7, "L"); inserir.setString(8, "Justificativa legada"); inserir.setObject(9, horario);
                inserir.executeUpdate();
            }
        }
        // Act
        BancoH2 banco = new BancoH2(arquivo);
        new BancoH2(arquivo);
        var dao = new AlertaDAO(banco);
        Alerta antigo = dao.listarTodos().getFirst();
        String chave = "a".repeat(64);
        long id = dao.salvar(antigo.comChaveIdempotencia(chave));
        long repetido = dao.salvar(antigo.comChaveIdempotencia(chave));
        // Assert
        assertEquals(id, repetido);
        assertEquals(2, dao.listarTodos().size());
        assertNull(antigo.getChaveIdempotencia());
        assertEquals("Justificativa legada", antigo.getJustificativa());
        assertEquals(horario, antigo.getDataHora());
        assertEquals(120, antigo.getPrevisao());
        assertEquals(1, dao.listarTodos().stream().filter(a -> chave.equals(a.getChaveIdempotencia())).count());
    }

    @Test
    void regiaoELimiaresSobrevivemAReaberturaComValidacaoDoDominio() {
        // Arrange
        Path arquivo = temporario.resolve("territorio");
        var dao = new DadosTerritorioDAO(new BancoH2(arquivo));
        var dados = dao.carregar("codigo");
        String regiao = "D'água; DROP TABLE territorio; --";
        dados.alterarRegiao("codigo", regiao);
        dados.alterarLimiares("codigo", 30, 40, 1, 5);
        // Act
        dao.salvar(dados);
        var recuperados = new DadosTerritorioDAO(new BancoH2(arquivo)).carregar("codigo");
        // Assert
        assertEquals(regiao, recuperados.getRegiao());
        assertEquals(30, recuperados.getLimiteConsumoLitros());
        assertEquals(40, recuperados.getLimiteVazaoLitrosPorMinuto());
        assertEquals(1, recuperados.getPressaoMinimaBar());
        assertEquals(5, recuperados.getPressaoMaximaBar());
        assertThrows(SecurityException.class, () -> recuperados.alterarRegiao("errado", "Outra"));
        assertThrows(DadosInvalidosException.class, () -> recuperados.alterarRegiao("codigo", " "));
        assertEquals(regiao, recuperados.getRegiao());
    }

    @Test
    void configuracaoAdulteradaOuTabelaAusenteSaoErrosExplicitos() throws Exception {
        // Arrange
        var banco = new BancoH2(temporario.resolve("adulterado"));
        var dao = new DadosTerritorioDAO(banco);
        dao.salvar(dao.carregar("codigo"));
        try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("UPDATE territorio SET pressao_minima = 9")) {
            comando.executeUpdate();
        }
        // Act + Assert
        assertThrows(PersistenciaException.class, () -> dao.carregar("codigo"));
        try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("DROP TABLE territorio")) {
            comando.executeUpdate();
        }
        assertThrows(PersistenciaException.class, () -> dao.salvar(new DadosTerritorio("Região", "codigo", 10, 10, 1, 5)));
    }
}
