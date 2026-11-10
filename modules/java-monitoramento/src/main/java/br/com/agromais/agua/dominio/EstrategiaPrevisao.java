package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

public abstract class EstrategiaPrevisao {
    private final int tamanhoJanela;
    private final int historicoMinimo;

    protected EstrategiaPrevisao(int tamanhoJanela, int quantidadeJanelas) {
        long minimo = (long) tamanhoJanela * quantidadeJanelas;
        if (tamanhoJanela < 5 || quantidadeJanelas < 1 || minimo > Integer.MAX_VALUE) {
            throw new DadosInvalidosException("Janela deve ter pelo menos 5 amostras e histórico mínimo representável.");
        }
        this.tamanhoJanela = tamanhoJanela;
        this.historicoMinimo = (int) minimo;
    }

    public abstract ResultadoPrevisao prever(String sensorId, List<Medicao> historico);

    public final int getTamanhoJanela() { return tamanhoJanela; }
    public final int getHistoricoMinimo() { return historicoMinimo; }

    /** Valida o histórico inteiro ANTES de qualquer cálculo ou seleção das últimas janelas. */
    protected final List<Medicao> validarHistorico(String sensorId, List<Medicao> historico) {
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
        if (copia.size() < historicoMinimo) {
            throw new DadosInvalidosException("Histórico insuficiente para " + id + ": necessárias "
                    + historicoMinimo + " medições, disponíveis " + copia.size() + ". Nenhuma previsão produzida.");
        }
        return List.copyOf(copia);
    }

    protected final double media(List<Medicao> historico, int inicio, int fim) {
        double soma = 0;
        for (int i = inicio; i < fim; i++) {
            soma += historico.get(i).getValor();
        }
        return soma / (fim - inicio);
    }

    protected final ResultadoPrevisao resultado(List<Medicao> historico, double valor, String explicacao) {
        Medicao ultima = historico.getLast();
        Sensor sensor = new SensorHistorico(ultima.getSensorId(), ultima.getTipo(), ultima.isDemonstracao());
        // A construção falha explicitamente se a projeção extrapolou a faixa do tipo.
        return new ResultadoPrevisao(sensor, valor, ultima.getUnidade(), explicacao);
    }
}
