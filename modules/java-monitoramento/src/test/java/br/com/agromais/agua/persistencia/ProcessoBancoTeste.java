package br.com.agromais.agua.persistencia;

import br.com.agromais.agua.dominio.*;
import java.nio.file.Path;
import java.time.OffsetDateTime;

/** Auxiliar exclusivo de teste: executado em JVMs separadas, não é um menu do produto. */
public final class ProcessoBancoTeste {
    public static void main(String[] argumentos) {
        BancoH2 banco = new BancoH2(Path.of(argumentos[1]));
        MedicaoDAO medicoes = new MedicaoDAO(banco);
        AlertaDAO alertas = new AlertaDAO(banco);
        OffsetDateTime horario = OffsetDateTime.parse("2026-11-10T09:00:00.123456789-03:00");
        String sensorId = "consumo-reinicio";
        if (argumentos[0].equals("gravar")) {
            Sensor sensor = new SensorConsumo(sensorId);
            medicoes.salvar(new Medicao(sensor, 61.25, "L", horario));
            alertas.salvar(new Alerta(NivelAlerta.ALERTA, sensor, 80, 60, "L", "Demonstracao de persistencia", horario));
            System.out.println("GRAVADO: medicoes=1; alertas=1");
        } else if (argumentos[0].equals("consultar")) {
            var historico = medicoes.listarPorSensor(sensorId);
            var emitidos = alertas.listarPorSensor(sensorId);
            if (historico.size() != 1 || emitidos.size() != 1) {
                throw new IllegalStateException("Historicos nao preservados no reinicio.");
            }
            Medicao medicao = historico.getFirst();
            Alerta alerta = emitidos.getFirst();
            if (medicao.getValor() != 61.25 || !medicao.getDataHora().equals(horario)
                    || !medicao.getSensorId().equals(sensorId) || !medicao.isDemonstracao()
                    || medicao.getTipo() != TipoSensor.CONSUMO || !medicao.getUnidade().equals("L")
                    || alerta.getNivel() != NivelAlerta.ALERTA || alerta.getPrevisao() != 80
                    || alerta.getLimiar() != 60 || !alerta.getDataHora().equals(horario)
                    || !alerta.getSensorId().equals(sensorId) || !alerta.isDemonstracao()
                    || alerta.getTipo() != TipoSensor.CONSUMO || !alerta.getUnidade().equals("L")
                    || !alerta.getJustificativa().equals("Demonstracao de persistencia")) {
                throw new IllegalStateException("Metadados ou valores alterados no reinicio.");
            }
            System.out.println("REABERTO: medicoes=1; valor=61.25 L; alertas=1; nivel=ALERTA; previsao=80.0 L; limiar=60.0 L");
            System.out.println("HORARIO_PRESERVADO: " + horario);
        } else {
            throw new IllegalArgumentException("Modo de teste desconhecido.");
        }
    }
}
