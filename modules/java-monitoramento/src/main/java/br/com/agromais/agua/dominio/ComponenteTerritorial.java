package br.com.agromais.agua.dominio;

public abstract class ComponenteTerritorial {
    private final String id;
    private final String nome;
    private final String regiao;
    private StatusComponente status = StatusComponente.SEM_SENSORES;

    protected ComponenteTerritorial(String id, String nome, String regiao) {
        this.id = Validacao.texto(id, "Id");
        this.nome = Validacao.texto(nome, "Nome");
        this.regiao = Validacao.texto(regiao, "Região");
    }

    public abstract StatusComponente verificarStatus();

    protected final void atualizarStatus(StatusComponente status) { this.status = status; }
    public String getId() { return id; }
    public String getNome() { return nome; }
    public String getRegiao() { return regiao; }
    /** Último status verificado; chamar verificarStatus() para atualizar. */
    public StatusComponente getStatus() { return status; }
}
