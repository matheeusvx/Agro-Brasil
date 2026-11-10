package br.com.agromais.agua.persistencia;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class ReinicioProcessoTest {
    @TempDir Path temporario;

    @Test
    void registrosSobrevivemAoEncerramentoDaJvmEASuasReinicializacoes() throws Exception {
        // Arrange: caminho novo e exclusivo, sem acessar .data do usuário.
        Path base = temporario.resolve("persistencia-real");
        // Act: cada chamada inicia uma JVM e espera sua saída completa.
        String gravacao = executar("gravar", base, "gravacao.txt");
        String primeiraReabertura = executar("consultar", base, "reabertura-1.txt");
        String segundaReabertura = executar("consultar", base, "reabertura-2.txt");
        // Assert
        assertTrue(Files.isRegularFile(temporario.resolve("persistencia-real.mv.db")));
        assertTrue(gravacao.contains("GRAVADO: medicoes=1; alertas=1"));
        assertTrue(primeiraReabertura.contains("REABERTO: medicoes=1; valor=61.25 L; alertas=1; nivel=ALERTA; previsao=80.0 L; limiar=60.0 L"));
        assertTrue(primeiraReabertura.contains("HORARIO_PRESERVADO: 2026-11-10T09:00:00.123456789-03:00"));
        assertEquals(primeiraReabertura, segundaReabertura);
        System.out.print(gravacao);
        System.out.print(primeiraReabertura);
        System.out.println("SEGUNDA_REABERTURA: mesmos registros e metadados, sem duplicacao");
    }

    private String executar(String modo, Path base, String nomeLog) throws Exception {
        String executavel = Path.of(System.getProperty("java.home"), "bin",
                System.getProperty("os.name").startsWith("Windows") ? "java.exe" : "java").toString();
        String classpath = System.getProperty("surefire.test.class.path", System.getProperty("java.class.path"));
        Path log = temporario.resolve(nomeLog);
        Process processo = new ProcessBuilder(executavel, "-cp", classpath,
                ProcessoBancoTeste.class.getName(), modo, base.toString())
                .redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {
            assertTrue(processo.waitFor(30, TimeUnit.SECONDS), "Processo do teste não encerrou em 30 segundos.");
            String saida = Files.readString(log);
            assertEquals(0, processo.exitValue(), saida);
            return saida;
        } finally {
            if (processo.isAlive()) {
                processo.destroyForcibly().waitFor();
            }
        }
    }
}
