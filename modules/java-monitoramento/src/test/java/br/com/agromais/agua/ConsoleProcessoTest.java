package br.com.agromais.agua;

import br.com.agromais.agua.persistencia.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class ConsoleProcessoTest {
    @TempDir Path temporario;

    @Test
    void aplicacaoRealReiniciaSemPerderConfiguracaoHistoricoOuDeduplicacao() throws Exception {
        // Arrange
        Path arquivo = temporario.resolve("console-real");
        String previsoes = "3\nconsumo-demo-1m\n1\n5\n3\nconsumo-demo-1m\n2\n5\n";
        // Act: processos independentes executam o main real, com entrada controlada.
        String primeira = executar(arquivo, "primeira.txt", "6\n2\nAGRO-AGUA\n10\n100\n2\n6\n2\n1\n\n10\n"
                + previsoes + previsoes + "5\n0\n");
        String segunda = executar(arquivo, "segunda.txt", previsoes + "5\n2\n1\n\n1\n3\nconsumo-demo-1m\n1\n5\n5\n0\n");
        // Assert
        assertTrue(primeira.contains("Alertas persistidos: 2"), primeira);
        assertTrue(segunda.contains("Alertas persistidos: 2"), segunda);
        assertTrue(segunda.contains("Alertas persistidos: 3"), segunda);
        assertFalse(primeira.contains("Dados inválidos:"), primeira);
        assertFalse(segunda.contains("Dados inválidos:"), segunda);
        var banco = new BancoH2(arquivo);
        assertEquals(11, new MedicaoDAO(banco).listarPorSensor("consumo-demo-1m").size());
        assertEquals(3, new AlertaDAO(banco).listarTodos().size());
        assertEquals(10, new DadosTerritorioDAO(banco).carregar("AGRO-AGUA").getLimiteConsumoLitros());
        System.out.println("CONSOLE_REINICIADO: 10 leituras / 2 alertas; repetição mantém 2; nova leitura permite alerta 3.");
    }

    private String executar(Path arquivo, String nomeLog, String roteiro) throws Exception {
        String java = Path.of(System.getProperty("java.home"), "bin",
                System.getProperty("os.name").startsWith("Windows") ? "java.exe" : "java").toString();
        String classpath = System.getProperty("surefire.test.class.path", System.getProperty("java.class.path"));
        Path log = temporario.resolve(nomeLog);
        Process processo = new ProcessBuilder(java, "-cp", classpath, SistemaMonitoramento.class.getName(), arquivo.toString())
                .redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {
            try (var entrada = processo.getOutputStream()) {
                entrada.write(roteiro.getBytes(StandardCharsets.UTF_8));
            }
            assertTrue(processo.waitFor(30, TimeUnit.SECONDS), "Console não encerrou em 30 segundos.");
            String saida = Files.readString(log);
            assertEquals(0, processo.exitValue(), saida);
            assertTrue(saida.contains("Encerrado. Registros preservados"), saida);
            return saida;
        } finally {
            if (processo.isAlive()) processo.destroyForcibly().waitFor(5, TimeUnit.SECONDS);
        }
    }
}
