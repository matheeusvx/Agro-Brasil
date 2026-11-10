package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.PersistenciaException;
import br.com.agromais.agua.persistencia.*;
import java.nio.file.Path;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class IdempotenciaAlertaTest {
    @TempDir Path temporario;
    private DadosTerritorio dados() { return new DadosTerritorio("Região", "codigo", 10, 100, 2, 6); }

    private ServicoMonitoramento servico(BancoH2 banco, DadosTerritorio dados, TipoPrevisao tipo, int janela) {
        return new ServicoMonitoramento(new MedicaoDAO(banco), new AlertaDAO(banco), dados, tipo, janela);
    }

    @Test
    void repeticaoEReaberturaMantemUmAlertaENovosContextosPermitemOutros() {
        // Arrange
        Path arquivo = temporario.resolve("repeticao");
        var banco = new BancoH2(arquivo);
        var medicoes = new MedicaoDAO(banco);
        // Valores constantes para evitar extrapolação fora de faixa neste teste de idempotência.
        Sensor sensor = new SensorConsumo("c", true, new java.util.Random(42) {
            @Override public double nextDouble(double inicio, double fim) { return 60; }
        });
        new ColetaSimulada(medicoes).coletar(sensor, 12);
        var dados = dados();
        var servico = servico(banco, dados, TipoPrevisao.MEDIA_MOVEL, 5);
        // Act
        servico.analisar("c");
        var primeiro = new AlertaDAO(banco).listarTodos().getFirst();
        servico.analisar("c");
        var reaberto = new BancoH2(arquivo);
        servico(reaberto, dados, TipoPrevisao.MEDIA_MOVEL, 5).analisar("c");
        // Assert: repetição mantém registro e horário originais.
        assertEquals(1, new AlertaDAO(reaberto).listarTodos().size());
        assertEquals(primeiro.getDataHora(), new AlertaDAO(reaberto).listarTodos().getFirst().getDataHora());
        assertNotNull(primeiro.getChaveIdempotencia());
        // Act + Assert: estratégia, N, limites e novas amostras distinguem contextos legítimos.
        servico(reaberto, dados, TipoPrevisao.COMPARACAO, 5).analisar("c");
        servico(reaberto, dados, TipoPrevisao.MEDIA_MOVEL, 6).analisar("c");
        assertEquals(3, new AlertaDAO(reaberto).listarTodos().size());
        dados.alterarLimiares("codigo", 20, 100, 2, 6);
        servico(reaberto, dados, TipoPrevisao.MEDIA_MOVEL, 5).analisar("c");
        assertEquals(4, new AlertaDAO(reaberto).listarTodos().size());
        new ColetaSimulada(new MedicaoDAO(reaberto)).coletar(sensor, 1);
        servico(reaberto, dados, TipoPrevisao.MEDIA_MOVEL, 5).analisar("c");
        assertEquals(5, new AlertaDAO(reaberto).listarTodos().size());
    }

    @Test
    void execucoesConcorrentesDoMesmoContextoNaoDuplicam() throws Exception {
        // Arrange
        var banco = new BancoH2(temporario.resolve("concorrencia"));
        new ColetaSimulada(new MedicaoDAO(banco)).coletar(new SensorConsumo("c"), 10);
        var executor = Executors.newFixedThreadPool(2);
        try {
            // Act
            var primeira = executor.submit(() -> servico(banco, dados(), TipoPrevisao.MEDIA_MOVEL, 5).analisar("c"));
            var segunda = executor.submit(() -> servico(banco, dados(), TipoPrevisao.MEDIA_MOVEL, 5).analisar("c"));
            assertTrue(primeira.get(15, TimeUnit.SECONDS).alerta().isPresent());
            assertTrue(segunda.get(15, TimeUnit.SECONDS).alerta().isPresent());
            // Assert
            assertEquals(1, new AlertaDAO(banco).listarTodos().size());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void violacaoDeOutraRestricaoUnicaNaoEFingidaComoAlertaJaRegistrado() throws Exception {
        // Arrange: uma restrição adicional temporária simula outro erro de integridade.
        var banco = new BancoH2(temporario.resolve("outra-restricao"));
        var medicoes = new MedicaoDAO(banco);
        var coleta = new ColetaSimulada(medicoes);
        coleta.coletar(new SensorConsumo("c"), 10);
        var servico = servico(banco, dados(), TipoPrevisao.MEDIA_MOVEL, 5);
        servico.analisar("c");
        try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("ALTER TABLE alerta ADD UNIQUE(sensor_id)")) {
            comando.executeUpdate();
        }
        coleta.coletar(new SensorConsumo("c"), 1);
        // Act
        var erro = assertThrows(PersistenciaException.class, () -> servico.analisar("c"));
        // Assert
        assertTrue(erro.getMessage().contains("sem alerta correspondente"));
        assertEquals(1, new AlertaDAO(banco).listarTodos().size());
    }

    @Test
    void falhaDoBancoNaoEViradaEmDuplicataConfirmada() throws Exception {
        // Arrange
        var banco = new BancoH2(temporario.resolve("erro"));
        new ColetaSimulada(new MedicaoDAO(banco)).coletar(new SensorConsumo("c"), 10);
        var servico = servico(banco, dados(), TipoPrevisao.MEDIA_MOVEL, 5);
        servico.analisar("c");
        try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("DROP TABLE alerta")) {
            comando.executeUpdate();
        }
        // Act + Assert
        assertThrows(PersistenciaException.class, () -> servico.analisar("c"));
    }
}
