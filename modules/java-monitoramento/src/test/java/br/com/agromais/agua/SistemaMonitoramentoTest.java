package br.com.agromais.agua;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.persistencia.*;
import br.com.agromais.agua.servico.ColetaSimulada;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Path;
import java.util.Scanner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class SistemaMonitoramentoTest {
    @TempDir Path temporario;

    private String executar(BancoH2 banco, String roteiro) {
        var texto = new StringWriter();
        try (var entrada = new Scanner(roteiro)) {
            new SistemaMonitoramento(entrada, new PrintWriter(texto, true), banco).executar();
        }
        return texto.toString();
    }

    @Test
    void fluxoCompletoColetaConsultaPreveDuasVezesEPreservaAposReabrir() {
        // Arrange
        Path arquivo = temporario.resolve("console");
        var banco = new BancoH2(arquivo);
        String previsoes = "3\nconsumo-demo-1m\n1\n5\n3\nconsumo-demo-1m\n2\n5\n";
        String roteiro = "1\n2\n1\n\n10\n4\nconsumo-demo-1m\n6\n2\nAGRO-AGUA\n10\n100\n2\n6\n"
                + previsoes + previsoes + "5\n7\n0\n";
        // Act
        String saida = executar(banco, roteiro);
        var reaberto = new BancoH2(arquivo);
        String outraSessao = executar(reaberto, previsoes + "5\n0\n");
        // Assert
        assertTrue(saida.contains("Ponto: OPERACIONAL"));
        assertTrue(saida.contains("Gravadas 10 leituras"));
        assertTrue(saida.contains("Histórico de consumo-demo-1m: 10 leituras"));
        assertTrue(saida.contains("MEDIA_MOVEL"));
        assertTrue(saida.contains("COMPARACAO"));
        assertTrue(saida.contains("DEMONSTRAÇÃO"));
        assertTrue(saida.contains("minuto SIMULADO"));
        assertTrue(saida.contains("Alertas persistidos: 2"));
        assertTrue(saida.contains("Encerrado. Registros preservados"));
        assertFalse(saida.contains("Dados inválidos:"), saida);
        assertFalse(outraSessao.contains("Dados inválidos:"), outraSessao);
        assertEquals(10, new MedicaoDAO(reaberto).listarPorSensor("consumo-demo-1m").size());
        assertEquals(2, new AlertaDAO(reaberto).listarTodos().size());
        assertEquals(10, new DadosTerritorioDAO(reaberto).carregar("AGRO-AGUA").getLimiteConsumoLitros());
    }

    @Test
    void entradasInvalidasHistoricoInsuficienteECodigoIncorretoNaoEncerramLoop() {
        // Arrange
        var banco = new BancoH2(temporario.resolve("erros"));
        String roteiro = "99\n2\nx\n2\n1\n\nabc\n3\nausente\n1\n5\n"
                + "6\n1\nerrado\nNova região\n6\n2\nAGRO-AGUA\nNaN\n100\n2\n6\n7\n0\n";
        // Act
        String saida = executar(banco, roteiro);
        // Assert
        assertTrue(saida.contains("Opção inválida"));
        assertTrue(saida.contains("número inteiro válido"));
        assertTrue(saida.contains("Histórico insuficiente"));
        assertTrue(saida.contains("Acesso negado"));
        assertTrue(saida.contains("deve ser finito"));
        assertTrue(saida.contains("Encerrado. Registros preservados"));
        assertTrue(new MedicaoDAO(banco).listarSensores().isEmpty());
    }

    @Test
    void extrapolacaoForaDeFaixaEMostradaSemGravarAlerta() {
        // Arrange
        var banco = new BancoH2(temporario.resolve("fora"));
        var dao = new MedicaoDAO(banco);
        for (int i = 0; i < 10; i++) {
            dao.salvar(new Medicao(new SensorConsumo("fora"), i < 5 ? 0 : 120, "L", ColetaSimulada.INICIO.plusMinutes(i)));
        }
        // Act
        String saida = executar(banco, "3\nfora\n2\n5\n0\n");
        // Assert
        assertTrue(saida.contains("240.0 L"));
        assertTrue(saida.contains("Previsão calculada inválida"));
        assertTrue(saida.contains("Encerrado"));
        assertTrue(new AlertaDAO(banco).listarTodos().isEmpty());
    }

    @Test
    void falhaSqlNoMenuEExibidaEPermiteSair() throws Exception {
        // Arrange: construir o menu antes de danificar somente o banco temporário.
        var banco = new BancoH2(temporario.resolve("sql"));
        var texto = new StringWriter();
        try (var entrada = new Scanner("4\nsensor\n0\n")) {
            var sistema = new SistemaMonitoramento(entrada, new PrintWriter(texto, true), banco);
            try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("DROP TABLE medicao")) {
                comando.executeUpdate();
            }
            // Act
            sistema.executar();
        }
        // Assert
        assertTrue(texto.toString().contains("Falha de persistência"));
        assertTrue(texto.toString().contains("Encerrado"));
    }

    @Test
    void regiaoPersisteEConfigInvalidaNaoSubstituiConfiguracaoSalva() {
        // Arrange
        Path arquivo = temporario.resolve("regiao");
        var banco = new BancoH2(arquivo);
        // Act
        String saida = executar(banco, "6\n1\nAGRO-AGUA\nRegião do teste\n6\n2\nAGRO-AGUA\n10\n100\n8\n6\n0\n");
        String reabertura = executar(new BancoH2(arquivo), "6\n0\n0\n");
        // Assert
        assertTrue(saida.contains("Dados inválidos"));
        assertTrue(reabertura.contains("Região do teste"));
        var dados = new DadosTerritorioDAO(new BancoH2(arquivo)).carregar("AGRO-AGUA");
        assertEquals(100, dados.getLimiteConsumoLitros());
        assertEquals(2, dados.getPressaoMinimaBar());
    }

    @Test
    void fimDeEntradaNoMenuOuDuranteOperacaoEncerraComMensagem() {
        // Arrange
        var banco = new BancoH2(temporario.resolve("eof"));
        // Act + Assert
        assertTrue(executar(banco, "").contains("Entrada encerrada"));
        assertTrue(executar(banco, "2\n1\n").contains("Entrada encerrada"));
        assertTrue(new MedicaoDAO(banco).listarSensores().isEmpty());
    }
}
