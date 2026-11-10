package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Consistência da série, compartilhada pela coleta e pelas previsões, sem exigir quantidade mínima. */
public final class HistoricoMedicoes {
    private HistoricoMedicoes() { }

    public static List<Medicao> validar(String sensorId, List<Medicao> historico) {
        String id = Validacao.texto(sensorId, "Id do sensor");
        if (historico == null) {
            throw new DadosInvalidosException("Histórico não pode ser nulo.");
        }
        List<Medicao> copia = new ArrayList<>(historico);
        Medicao anterior = null;
        Medicao primeira = null;
        Duration cadencia = null;
        for (Medicao medicao : copia) {
            if (medicao == null || medicao.getTipo() == null || medicao.getDataHora() == null) {
                throw new DadosInvalidosException("Histórico contém medição, tipo ou horário ausente.");
            }
            if (!id.equals(medicao.getSensorId())) {
                throw new DadosInvalidosException("Histórico mistura sensores; esperado: " + id + ".");
            }
            medicao.getTipo().validarValor(medicao.getValor());
            if (!medicao.getTipo().getUnidade().equals(medicao.getUnidade())) {
                throw new DadosInvalidosException("Histórico contém unidade incompatível com o tipo do sensor.");
            }
            if (primeira == null) {
                primeira = medicao;
            } else if (medicao.getTipo() != primeira.getTipo()
                    || medicao.isDemonstracao() != primeira.isDemonstracao()) {
                throw new DadosInvalidosException("Histórico mistura tipos ou origens demonstrativas/reais.");
            }
            if (anterior != null) {
                Duration intervalo = Duration.between(anterior.getDataHora().toInstant(), medicao.getDataHora().toInstant());
                if (intervalo.isZero() || intervalo.isNegative()) {
                    throw new DadosInvalidosException("Histórico deve ter instantes crescentes, sem amostras duplicadas.");
                }
                if (cadencia != null && !cadencia.equals(intervalo)) {
                    throw new DadosInvalidosException("Histórico com cadência irregular: janelas não são comparáveis.");
                }
                cadencia = intervalo;
            }
            anterior = medicao;
        }
        return List.copyOf(copia);
    }
}
