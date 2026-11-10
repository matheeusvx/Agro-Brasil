package br.com.agromais.agua.dominio;

import br.com.agromais.agua.excecao.DadosInvalidosException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class PontoMonitoramento extends ComponenteTerritorial {
    private final List<Sensor> sensores;

    public PontoMonitoramento(String id, String nome, String regiao, List<Sensor> sensores) {
        super(id, nome, regiao);
        if (sensores == null) {
            throw new DadosInvalidosException("Lista de sensores deve ser informada.");
        }
        Set<String> ids = new HashSet<>();
        for (Sensor sensor : sensores) {
            if (sensor == null || !ids.add(Validacao.texto(sensor.getId(), "Id do sensor"))) {
                throw new DadosInvalidosException("Sensores devem ser não nulos e ter ids únicos no ponto.");
            }
        }
        this.sensores = List.copyOf(sensores);
        verificarStatus();
    }

    @Override
    public StatusComponente verificarStatus() {
        StatusComponente resultado = sensores.isEmpty()
                ? StatusComponente.SEM_SENSORES : StatusComponente.OPERACIONAL;
        for (Sensor sensor : sensores) {
            if (!sensor.verificarFuncionamento()) {
                resultado = StatusComponente.FONTE_INDISPONIVEL;
            }
        }
        atualizarStatus(resultado);
        return resultado;
    }

    public List<Sensor> getSensores() { return sensores; }
}
