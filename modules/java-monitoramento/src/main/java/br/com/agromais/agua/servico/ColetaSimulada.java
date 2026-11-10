package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.persistencia.MedicaoDAO;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** Relógio lógico, sem espera real: uma amostra representa um minuto SIMULADO. */
public final class ColetaSimulada {
    public static final OffsetDateTime INICIO = OffsetDateTime.parse("2026-01-01T00:00:00-03:00");
    private final MedicaoDAO dao;

    public ColetaSimulada(MedicaoDAO dao) {
        if (dao == null) throw new DadosInvalidosException("DAO de medições é obrigatório.");
        this.dao = dao;
    }

    public List<Medicao> coletar(Sensor sensor, int quantidade) {
        if (sensor == null || sensor.getTipo() == null || !sensor.isDemonstracao()) {
            throw new DadosInvalidosException("Coleta lógica exige um sensor de demonstração válido.");
        }
        if (quantidade < 1 || quantidade > 1000) {
            throw new DadosInvalidosException("Quantidade deve estar entre 1 e 1000 amostras.");
        }
        var historico = HistoricoMedicoes.validar(sensor.getId(), dao.listarPorSensor(sensor.getId()));
        if (!historico.isEmpty()) {
            Medicao primeira = historico.getFirst();
            if (primeira.getTipo() != sensor.getTipo() || !primeira.isDemonstracao()) {
                throw new DadosInvalidosException("Id já usado por outro tipo ou origem. Use outro id; histórico preservado.");
            }
            if (historico.size() > 1 && !Duration.between(primeira.getDataHora().toInstant(),
                    historico.get(1).getDataHora().toInstant()).equals(Duration.ofMinutes(1))) {
                throw new DadosInvalidosException("Histórico não tem cadência de um minuto simulado. Use outro id; histórico preservado.");
            }
        }
        OffsetDateTime proximo = historico.isEmpty() ? INICIO : historico.getLast().getDataHora().plusMinutes(1);
        List<Medicao> lote = new ArrayList<>();
        for (int i = 0; i < quantidade; i++) {
            lote.add(new Medicao(sensor, sensor.lerValor(), sensor.getTipo().getUnidade(), proximo.plusMinutes(i)));
        }
        dao.salvarTodas(lote);
        return List.copyOf(lote);
    }
}
