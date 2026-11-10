package br.com.agromais.agua.persistencia;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.PersistenciaException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class BancoH2Test {
    @TempDir Path temporario;

    @Test
    void criaDiretoriosArquivoETabelasEFechaConexoes() throws Exception {
        // Arrange
        Path base = temporario.resolve("subpasta/banco");
        // Act
        BancoH2 banco = new BancoH2(base);
        Connection conexao;
        try (Connection aberta = banco.abrirConexao()) {
            conexao = aberta;
            assertFalse(aberta.isClosed());
        }
        // Assert
        assertTrue(conexao.isClosed());
        assertTrue(Files.isRegularFile(temporario.resolve("subpasta/banco.mv.db")));
        assertTrue(new MedicaoDAO(banco).listarPorSensor("vazio").isEmpty());
        assertTrue(new AlertaDAO(banco).listarTodos().isEmpty());
    }

    @Test
    void reinicializarPreservaRegistrosSemDuplicarNemReiniciarChaves() {
        // Arrange
        Path base = temporario.resolve("banco");
        BancoH2 primeiraInicializacao = new BancoH2(base);
        Medicao original = new Medicao(new SensorConsumo("c"), 61.25, "L",
                OffsetDateTime.parse("2026-11-10T09:00:00.123456789-03:00"));
        long primeiroId = new MedicaoDAO(primeiraInicializacao).salvar(original);
        // Act: todas as conexões das operações anteriores já foram fechadas.
        BancoH2 segundaInicializacao = new BancoH2(base);
        MedicaoDAO reaberto = new MedicaoDAO(segundaInicializacao);
        Medicao recuperada = reaberto.listarPorSensor("c").getFirst();
        long segundoId = reaberto.salvar(original);
        new BancoH2(base); // Inicializar novamente não semeia, apaga ou duplica registros.
        // Assert
        assertTrue(segundoId > primeiroId);
        assertEquals(2, reaberto.listarPorSensor("c").size());
        assertEquals(original.getValor(), recuperada.getValor());
        assertEquals(original.getDataHora(), recuperada.getDataHora());
        assertEquals(original.isDemonstracao(), recuperada.isDemonstracao());
    }

    @Test
    void arquivosDistintosNaoCompartilhamDados() {
        // Arrange
        BancoH2 primeiro = new BancoH2(temporario.resolve("primeiro"));
        BancoH2 segundo = new BancoH2(temporario.resolve("segundo"));
        // Act
        new MedicaoDAO(primeiro).salvar(new Medicao(new SensorConsumo("c"), 50, "L", OffsetDateTime.now()));
        // Assert
        assertEquals(1, new MedicaoDAO(primeiro).listarPorSensor("c").size());
        assertTrue(new MedicaoDAO(segundo).listarPorSensor("c").isEmpty());
    }

    @Test
    void caminhoNaoPermiteInjetarOpcoesJdbc() {
        // Arrange
        Path injetado = temporario.resolve("banco;INIT=DROP ALL OBJECTS");
        // Act + Assert
        assertThrows(DadosInvalidosException.class, () -> new BancoH2(injetado));
        assertThrows(DadosInvalidosException.class, () -> new BancoH2(null));
    }

    @Test
    void erroDeInicializacaoMantemCausaESemFallbackParaMemoria() throws Exception {
        // Arrange
        Path arquivoComum = Files.writeString(temporario.resolve("nao-e-diretorio"), "teste");
        // Act
        var erro = assertThrows(PersistenciaException.class, () -> new BancoH2(arquivoComum.resolve("banco")));
        // Assert
        assertInstanceOf(java.io.IOException.class, erro.getCause());
        assertTrue(erro.getMessage().contains("inicializar"));
    }
}
