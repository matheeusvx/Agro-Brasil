package br.com.agromais.agua.persistencia;

import br.com.agromais.agua.dominio.DadosTerritorio;
import br.com.agromais.agua.excecao.DadosInvalidosException;
import br.com.agromais.agua.excecao.PersistenciaException;
import java.sql.SQLException;

/** Configuração única do console; código didático é fornecido pela aplicação, não gravado no banco. */
public final class DadosTerritorioDAO {
    private final BancoH2 banco;

    public DadosTerritorioDAO(BancoH2 banco) {
        if (banco == null) throw new DadosInvalidosException("Banco do território é obrigatório.");
        this.banco = banco;
    }

    public DadosTerritorio carregar(String codigo) {
        try (var conexao = banco.abrirConexao();
             var comando = conexao.prepareStatement("SELECT * FROM territorio WHERE id = 1");
             var resultado = comando.executeQuery()) {
            if (!resultado.next()) return new DadosTerritorio("Região demonstrativa", codigo, 100, 100, 2, 6);
            return new DadosTerritorio(resultado.getString("regiao"), codigo, resultado.getDouble("consumo"),
                    resultado.getDouble("vazao"), resultado.getDouble("pressao_minima"), resultado.getDouble("pressao_maxima"));
        } catch (SQLException | IllegalArgumentException causa) {
            throw new PersistenciaException("Não foi possível carregar a configuração do território.", causa);
        }
    }

    public void salvar(DadosTerritorio dados) {
        if (dados == null) throw new DadosInvalidosException("Dados do território são obrigatórios.");
        try (var conexao = banco.abrirConexao(); var comando = conexao.prepareStatement("""
                MERGE INTO territorio (id, regiao, consumo, vazao, pressao_minima, pressao_maxima)
                KEY(id) VALUES (1, ?, ?, ?, ?, ?)
                """)) {
            comando.setString(1, dados.getRegiao());
            comando.setDouble(2, dados.getLimiteConsumoLitros());
            comando.setDouble(3, dados.getLimiteVazaoLitrosPorMinuto());
            comando.setDouble(4, dados.getPressaoMinimaBar());
            comando.setDouble(5, dados.getPressaoMaximaBar());
            comando.executeUpdate();
        } catch (SQLException causa) {
            throw new PersistenciaException("Não foi possível salvar a configuração do território.", causa);
        }
    }
}
