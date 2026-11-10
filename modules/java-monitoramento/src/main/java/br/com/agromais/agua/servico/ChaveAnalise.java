package br.com.agromais.agua.servico;

import br.com.agromais.agua.dominio.*;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/** Identifica o contexto da análise; não usa justificativa ou horário de execução. */
final class ChaveAnalise {
    private ChaveAnalise() { }

    static String gerar(EstrategiaPrevisao estrategia, List<Medicao> historico, DadosTerritorio dados) {
        try (var bytes = new ByteArrayOutputStream(); var saida = new DataOutputStream(bytes)) {
            texto(saida, "agro-agua-regras-v1");
            texto(saida, estrategia.getClass().getName());
            saida.writeInt(estrategia.getTamanhoJanela());
            saida.writeDouble(dados.getLimiteConsumoLitros());
            saida.writeDouble(dados.getLimiteVazaoLitrosPorMinuto());
            saida.writeDouble(dados.getPressaoMinimaBar());
            saida.writeDouble(dados.getPressaoMaximaBar());
            for (Medicao medicao : historico.subList(historico.size() - estrategia.getHistoricoMinimo(), historico.size())) {
                texto(saida, medicao.getSensorId());
                texto(saida, medicao.getTipo().name());
                texto(saida, medicao.getUnidade());
                saida.writeBoolean(medicao.isDemonstracao());
                saida.writeDouble(medicao.getValor());
                texto(saida, medicao.getDataHora().toInstant().toString());
            }
            saida.flush();
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()));
        } catch (IOException | NoSuchAlgorithmException causa) {
            throw new IllegalStateException("Não foi possível identificar o contexto da análise.", causa);
        }
    }

    private static void texto(DataOutputStream saida, String texto) throws IOException {
        byte[] bytes = texto.getBytes(StandardCharsets.UTF_8);
        saida.writeInt(bytes.length); // Comprimento explícito evita ambiguidades entre campos.
        saida.write(bytes);
    }
}
