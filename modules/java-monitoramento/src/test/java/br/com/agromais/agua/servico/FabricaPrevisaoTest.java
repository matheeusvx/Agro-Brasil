package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class FabricaPrevisaoTest {
    @Test
    void configuracaoSelecionaComportamentoSemExporClassesAoChamador() {
        // Arrange
        List<Medicao> medicoes = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            medicoes.add(new Medicao(new SensorConsumo("c"), i < 5 ? 10 : 20, "L",
                    OffsetDateTime.parse("2026-11-10T09:00:00-03:00").plusMinutes(i)));
        }
        EstrategiaPrevisao media = FabricaPrevisao.criar(TipoPrevisao.MEDIA_MOVEL);
        EstrategiaPrevisao comparacao = FabricaPrevisao.criar(TipoPrevisao.COMPARACAO);
        // Act
        double valorMedia = media.prever("c", medicoes).valor();
        double valorComparacao = comparacao.prever("c", medicoes).valor();
        // Assert
        assertEquals(20, valorMedia);
        assertEquals(30, valorComparacao);
        assertEquals(5, media.getHistoricoMinimo());
        assertEquals(10, comparacao.getHistoricoMinimo());
    }

    @Test
    void respeitaJanelaConfigurada() {
        // Arrange
        int janela = 6;
        // Act
        EstrategiaPrevisao estrategia = FabricaPrevisao.criar(TipoPrevisao.COMPARACAO, janela);
        // Assert
        assertEquals(6, estrategia.getTamanhoJanela());
        assertEquals(12, estrategia.getHistoricoMinimo());
    }

    @Test
    void rejeitaConfiguracaoInvalidaInclusiveOverflowDaJanelaDupla() {
        // Arrange + Act + Assert
        assertThrows(DadosInvalidosException.class, () -> FabricaPrevisao.criar(null));
        assertThrows(DadosInvalidosException.class, () -> FabricaPrevisao.criar(TipoPrevisao.MEDIA_MOVEL, 0));
        assertThrows(DadosInvalidosException.class,
                () -> FabricaPrevisao.criar(TipoPrevisao.COMPARACAO, Integer.MAX_VALUE));
    }
}
