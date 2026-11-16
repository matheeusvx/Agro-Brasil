"""Entrega FIAP: relatório A4 de nove páginas e síntese de uma página.

Somente CSV/JSON/figuras arquivados; não importa sklearn nem carrega modelos.
Python com requirements-report.txt. Fontes Arial (Windows) ou DejaVu (Linux).
"""
import csv
import json
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "outputs/entrega/output/pdf"
AUTHOR = "Matheus Morelli Rodrigues | RM 562765"
GREEN = colors.HexColor("#126053")
INK = colors.HexColor("#243b49")


def load_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def register_fonts():
    for normal, bold in [(Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf")),
                         (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))]:
        if normal.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("Agua", str(normal)))
            pdfmetrics.registerFont(TTFont("AguaBold", str(bold)))
            pdfmetrics.registerFontFamily("Agua", normal="Agua", bold="AguaBold", italic="Agua", boldItalic="AguaBold")
            return
    raise FileNotFoundError("Instale Arial ou DejaVu Sans para preservar acentos e fórmulas")


STYLES = {
    "body": ParagraphStyle("body", fontName="Agua", fontSize=10.3, leading=14.4, textColor=INK, spaceAfter=9),
    "small": ParagraphStyle("small", fontName="Agua", fontSize=8.3, leading=11.2, textColor=INK, spaceAfter=7),
    "title": ParagraphStyle("title", fontName="AguaBold", fontSize=25, leading=29, textColor=GREEN, spaceAfter=16),
    "h": ParagraphStyle("h", fontName="AguaBold", fontSize=16, leading=20, textColor=GREEN, spaceAfter=13),
    "sub": ParagraphStyle("sub", fontName="AguaBold", fontSize=11, leading=15, textColor=GREEN, spaceAfter=7),
    "cell": ParagraphStyle("cell", fontName="Agua", fontSize=8.7, leading=11.5, textColor=INK),
}


def p(text, style="body"):
    return Paragraph(text, STYLES[style])


def table(rows, widths):
    t = Table([[p(escape(str(c)), "cell") for c in row] for row in rows], colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0,0),(-1,0),colors.HexColor("#e1eee9")),
        ("VALIGN",(0,0),(-1,-1),"TOP"), ("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("TOPPADDING",(0,0),(-1,-1),7), ("LINEBELOW",(0,0),(-1,0),.6,GREEN),
        ("LINEBELOW",(0,1),(-1,-1),.25,colors.HexColor("#d8e1df"))]))
    return t


def figure(relative, width=499):
    img = Image(str(ROOT / relative))
    img.drawHeight = width * img.imageHeight / img.imageWidth
    img.drawWidth = width
    return img


def metrics_table():
    rows = [["Método", "MAE mm", "RMSE mm", "Viés mm", "R²", "Ganho %"]]
    names = {"climatology":"Climatologia", "persistence":"Persistência", "ridge":"Ridge escolhida", "hgb":"HistGradientBoosting"}
    with (ROOT / "outputs/agua03/metrics.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["block"] == "test" and r["group"] == "all":
                rows.append([names[r["method"]]] + [f"{float(r[k]):.{n}f}".replace(".",",") for k,n in [("mae_mm",3),("rmse_mm",3),("bias_mm",3),("r2",3),("gain_mae_pct",2)]])
    return table(rows, [151,69,75,70,57,77])


def footer(canvas, doc):
    canvas.setStrokeColor(GREEN)
    canvas.line(48, 40, A4[0]-48, 40)
    canvas.setFont("Agua", 8)
    canvas.setFillColor(INK)
    canvas.drawString(48, 27, "Agro+ Brasil | Data Science & Analytics | GS 2026.2")
    canvas.drawRightString(A4[0]-48, 27, f"{doc.page}")


def build(name, story, expected_pages, title):
    path = OUT / name
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=48, rightMargin=48,
        topMargin=39, bottomMargin=52, title=title, author=AUTHOR, invariant=1)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    reader = PdfReader(path)
    if len(reader.pages) != expected_pages:
        raise ValueError(f"{name}: esperado {expected_pages}, gerado {len(reader.pages)}")
    text = "\n\n".join(f"PÁGINA {i+1}\n"+page.extract_text() for i,page in enumerate(reader.pages))
    path.with_suffix(".txt").write_text(text, encoding="utf-8")
    if AUTHOR.split(" | ")[0] not in text or "562765" not in text:
        raise ValueError("Identificação ausente")
    print(f"{name}: {len(reader.pages)} páginas")


def report():
    pages = []
    def page(title, *items):
        if pages:
            pages.append(PageBreak())
        pages.extend([p(title,"h"), *items])
    page("Monitoramento hídrico na RMSP",
        p("Precipitação regional e limites para antecipar escassez", "title"),
        p(f"<b>{AUTHOR}</b><br/>FIAP | Global Solution 2026.2<br/>Data Science &amp; Analytics | 16 de novembro de 2026"),
        p("Resumo", "sub"),
        p("O Agro+ Brasil investiga sinais meteorológicos relevantes ao acompanhamento da vulnerabilidade hídrica na Região Metropolitana de São Paulo (RMSP). O estudo usa 9.497 dias de NASA POWER em Mogi das Cruzes (2000-2025), indicadores históricos e dois modelos já avaliados para chuva acumulada nos sete dias seguintes. A Ridge reduz o MAE médio em 9,88% frente à climatologia no teste, mas praticamente não melhora as chuvas elevadas. O estudo não valida antecipação de escassez no abastecimento."),
        p("Pergunta de pesquisa", "sub"),
        p("Em que medida o histórico meteorológico de Mogi das Cruzes permite caracterizar baixa precipitação e estimar chuva semanal, como informação complementar ao monitoramento hídrico da RMSP, e quais lacunas impedem convertê-lo em alerta de escassez?"),
        p("Recorte e relevância", "sub"),
        p("Mogi das Cruzes é um recorte territorial da RMSP; o Sistema Alto Tietê é o vínculo investigado com o abastecimento metropolitano [2-4]. Chuva é uma entrada do sistema hídrico, mas disponibilidade depende também de armazenamento, afluências, transferências, retiradas e demanda. Um ponto em grade não representa toda a bacia nem todos os sistemas produtores."),
        p("Resultado e alcance", "sub"),
        p("Foram concluídas aquisição meteorológica, limpeza, EDA, indicadores, modelagem comparativa e documentação reproduzível. A pesquisa complementar recuperou dados de volume e vazões da Sabesp, mantidos em quarentena por qualidade e janela diária não confirmadas. A solução entregue é acadêmica e retrospectiva: não determina situação atual de escassez, não envia alertas e não autoriza restrições de abastecimento."),
        p("Referência normativa: enunciado FIAP GS2026-2-DSA-FEV(2), seis páginas [1]. A matriz de conformidade acompanha os scripts e explicita atendimento parcial, em vez de equiparar análise meteorológica a gestão operacional.", "small"))
    page("1. Fontes, território e qualidade",
        p("A aquisição foi efetivamente verificada. NASA constitui a base analítica; as consultas hidrológicas são evidências separadas. Nenhuma série foi mesclada apenas por coincidir a data."),
        table([["Fonte e recorte", "Disponibilidade efetiva e decisão"],
          ["NASA POWER AG [2]\nDiário LST, 2000-2025\n-23,52°; -46,19°", "26 respostas anuais originais; 9.497 datas e 66.479 valores. Extração: 06/11/2026. Atualização da fonte sujeita a latência e revisões; série histórica final não comprova disponibilidade em t. Base admitida para experimento retrospectivo."],
          ["Sabesp / Alto Tietê [3]\nSistema 65, API v4\n2025 e 01-16/11/2026", "Oito séries, 1.524 registros: volume útil (%), vazão afluente e natural (m³/s), chuva (mm). Metadados confirmam unidades. Todas as flags isValid são false; semântica e janela diária não confirmadas. Quarentena; sem indicadores analíticos ou ML."],
          ["SP Águas [4-5]\nReservatórios e vazões", "Sala de Situação: falha de certificado TLS no cliente; SSD: HTTP 403 (automação bloqueada). Catálogo fluviométrico: HTTP 200, mas catálogo não comprova série ou cobertura. Não contornar TLS/bloqueio."],
          ["SP Águas E3-097 [5]\nPluviômetro, ano 2000", "184/366 dias válidos, março-agosto completos; 182 ausentes. Janela de leitura desconhecida. Sem comparação diária com NASA."],
          ["INMET [6]\nCatálogo de estações", "668 estações no catálogo arquivado. Bertioga e Mirante têm diferenças de relevo/ambiente e sobreposição. Sem série de validação harmonizada nesta entrega."]], [174,325]),
        Spacer(1,12),
        p("Amostras Sabesp: 365 dias por variável em 2025 e 16 em novembro/2026, sem duplicações, valores não finitos ou identidade divergente nas oito respostas. Completude não resolve a flag de qualidade. false não foi interpretado como prova de erro físico nem descartado como irrelevante."),
        p("Formato e rastreabilidade", "sub"),
        p("JSON/HTML/JS originais e metadados HTTP, URL, UTC de aquisição, bytes e SHA-256 estão em outputs/entrega/hidrologia. O script hydrology.py usa cache verificável, recorte fixo e padrão offline. Não existe integração espacial automática entre o sistema agregado e o ponto NASA; nenhuma correlação entre fontes foi calculada.") )
    page("2. Preparação e análise exploratória",
        p("pipeline.py reconstrói calendário diário, rejeita chaves/datas duplicadas, verifica fill_value (-999), finitude, faixas de plausibilidade e ordenação Tmin ≤ Tmed ≤ Tmax. Valores rejeitados geram ocorrência antes de virar ausente. Não se imputam zeros nem se removem extremos silenciosamente. Totais dependentes de cobertura só são publicados com o período completo."),
        p("A base NASA tem 100% de completude nesta extração e nenhuma ocorrência de qualidade registrada. As sete variáveis são precipitação (mm/dia), três temperaturas (°C), umidade relativa (%), vento a 10 m (m/s) e radiação (MJ/m²/dia). A unidade solar AG não é kWh/m²/dia."),
        figure("outputs/agua02/figures/02_sazonalidade.png", 390),
        p("Figura 1. Sazonalidade da precipitação NASA, 2000-2025; figura original AGUA-02. Dispersão entre anos e extremos permanecem visíveis. Fonte: eda.py e dados POWER [2].", "small"),
        p("A fração outubro-março é 73,64% da chuva acumulada do recorte. A média anual é 1.322,27 mm; mínimo anual 739,28 mm (2025), máximo 1.908,75 mm (2009). Janeiro é o mês climatologicamente mais chuvoso e agosto o mais seco neste produto. Isso justifica referências por mês: um mesmo acumulado não tem o mesmo significado no verão e no inverno."),
        p("São descrições de 26 anos, sem teste de tendência ou atribuição causal. Completude e plausibilidade não demonstram exatidão de campo; a grade NASA não é pluviômetro nem medição de reservatório.") )
    page("3. Indicadores e interpretações",
        table([["Indicador / frequência", "Definição, unidade e interpretação"],
          ["R7 e R30 / diária", "R_w(t) = soma de P(t-j), j=0...w-1, em mm. Incluem t; exigem 7/30 dias válidos. Contexto de chuva recente, sem equivalência a armazenamento."],
          ["D / diária", "D(t)=D(t-1)+1 se P(t)<1 mm/dia; zero se P(t)≥1. Ausente interrompe sequência. Duração até t em dias; não antecipa fim nem mede seca de solo."],
          ["A / mensal e anual", "Soma diária no período completo, em mm. Mês/ano só pode ser conhecido ao encerramento; não entra antecipadamente nos atributos."],
          ["Anomalias / mensal", "Δ=A-μ_m (mm); 100×(A/μ_m-1) (%); z=(A-μ_m)/s_m (adimensional). Referência 2000-2019, s amostral. μ ou s zero resulta em ausente, conforme fórmula."],
          ["Referência / mensal", "Média dos 20 totais de cada mês em 2000-2019. Não é normal oficial de 30 anos. Quantis usam interpolação linear; 20 anos limitam caudas."]], [145,354]),
        Spacer(1,10),
        figure("outputs/agua02/figures/03_sequencias_baixa_chuva.png"),
        p("Figura 2. Sequências de baixa precipitação com sensibilidades de limiar; AGUA-02. Os eventos podem cruzar meses/anos e sofrer censura em bordas. Não somar contagens de regras sobrepostas.", "small"),
        p("A maior sequência P&lt;1 mm/dia foi de 48 dias (11/06 a 28/07/2022). Ausência de chuva nesse produto é evidência meteorológica; não basta para concluir falta de água ou impacto agrícola. Persistência diária no treino diminui após remoção da sazonalidade: correlação lag1 de 0,399 para 0,338; no lag7 residual, aproximadamente 0,003. Não é teste de causalidade."),
        p("Em 31/12/2025: R7=24,22 mm; R30=86,50 mm; D=0. Dezembro totalizou 86,57 mm, contra referência de 186,27 mm: Δ=-99,70 mm, -53,52%, z≈-1,551. O mês foi pouco chuvoso em relação à referência; isso não mede disponibilidade atual de água. Fórmulas, cobertura e campos completos: docs/agua02-indicadores.md e agua04-dicionario.md.") )
    page("4. Modelagem preservada e avaliação",
        p("O alvo y(t) é a soma da precipitação de t+1 a t+7 em mm, sem incluir t. Os modelos representam evolução meteorológica complementar à análise hídrica; não são modelos de volume armazenado, vazão ou categoria de escassez."),
        p("Dois algoritmos e duas referências", "sub"),
        p("<b>Ridge:</b> regressão linear regularizada, adequada como hipótese simples de relações aproximadamente lineares e atributos correlacionados. StandardScaler é ajustado somente no treino permitido; solver SVD. Alpha 1/100 foi comparado por protocolo prévio. A configuração congelada usa alpha=100."),
        p("<b>HistGradientBoosting:</b> árvores impulsionadas para relações e interações não lineares; compara capacidade adicional à Ridge. Configuração escolhida: sete folhas, 150 iterações, learning_rate=0,05, mínimo 40 amostras/folha, L2=10, early_stopping=False, seed=562765. Não há split interno aleatório."),
        p("<b>Climatologia:</b> soma das médias diárias de cada mês do horizonte, ajustadas só em 2000-2019. <b>Persistência:</b> repete o acumulado dos sete dias anteriores. Truncar previsões ML negativas em zero foi regra anterior ao teste; não houve calibração posterior."),
        table([["Etapa", "Período e controle"],
          ["Treino", "2000-2019; 7.269 origens após aquecimento e exclusão de rótulos que cruzam fronteiras."],
          ["Folds internos", "2000-09 → 2010-12; 2000-12 → 2013-15; 2000-15 → 2016-19. Expansivos com purga de alvos."],
          ["Validação", "2020-2022; 1.089 origens. Família escolhida por menor MAE; sem refit com validação."],
          ["Teste arquivado", "2023-2025; 1.089 origens. Uma abertura em lote em 06/11/2026, após frozen.json. Nenhuma nova abertura nesta sprint."]], [120,379]),
        Spacer(1,10),
        p("34 atributos: sete variáveis em lags 0/1/2/7, acumulados passados 7/14/30 dias, sequência baixa até t e seno/cosseno do mês. Nenhum atributo contém futuro. O cenário lag0 pressupõe fechamento de t com dados já publicados: é ideal retrospectivo. Latência solar/meteorológica e vintage não foram reproduzidos; lag7 de ML não foi executado."),
        p("MAE é a métrica primária em mm; RMSE dá mais peso a erros grandes, viés mostra direção e R² compara variação explicada. Ganho=100×(1-erro_modelo/erro_climatologia). Não se usa MAPE com chuvas zero. Resultados de treino são aparentes. Protocolo: docs/agua03-protocolo.md [7-8].") )
    page("5. Resultados e incerteza",
        p("Tabela 1. Teste 2023-2025, mesmas 1.089 origens. Valores lidos de metrics.csv; nenhuma métrica foi ajustada nesta sprint.", "small"),
        metrics_table(), Spacer(1,12),
        figure("outputs/agua03/figures/03_periodos.png"),
        p("Figura 3. MAE por período e para chuva elevada; figura original AGUA-03. Recortes sobrepostos não somam amostras. Chuva elevada: alvo acima do q90 do treino (61,844 mm).", "small"),
        p("A Ridge escolhida pela validação melhora MAE em 6,87% na validação e 9,88% no teste. A redução pareada média é 1,562 mm; bootstrap em blocos de 28 dias dá intervalo aproximado de 95% [0,695; 2,348] mm. Sensibilidades 14/56 dias estão arquivadas. Janelas adjacentes compartilham seis dias e o teste contém só três anos; não são 1.089 amostras independentes."),
        p("Nas chuvas elevadas (n=60), a Ridge tem MAE de 37,293 mm e ganho de apenas 0,15%; todas as estimativas desse recorte subestimaram o alvo. O ganho médio não demonstra antecipação de picos nem de escassez. Viés geral +5,650 mm significa superestimação média de chuva; R²=0,226 deixa ampla variabilidade sem explicação."),
        p("MAE não é intervalo ±14,245 mm para cada estimativa. Não existe intervalo individual calibrado. O HGB ganhou 4,50% no teste e não foi reeleito após o teste. Discrepâncias entre treino e avaliação podem envolver sobreajuste e mudança de distribuição; nenhuma causa isolada foi demonstrada.") )
    page("6. Critérios informativos e risco",
        p("As classificações implementadas descrevem anomalias do histórico meteorológico. Não têm validação contra desabastecimento, danos ou decisões de gestão. Não se atribuem rótulos Normal/Atenção/Alerta/Crítico como se houvesse um classificador de crise validado."),
        table([["Faixa para R7, R30 e A", "Regra exata por mês de encerramento"],
          ["Abaixo q10", "x < q10"], ["Entre q10 e q25", "q10 ≤ x < q25"],
          ["Faixa central", "q25 ≤ x ≤ q75"], ["Entre q75 e q90", "q75 < x ≤ q90"],
          ["Acima q90", "x > q90"], ["Indisponível", "Valor ausente ou não finito; sem classificação"]], [210,289]),
        Spacer(1,10),
        p("Todos os quantis são ajustados exclusivamente em 2000-2019, por mês. D=0 é sem sequência; 0&lt;D≤q75 é duração até q75; q75&lt;D≤q90 e D&gt;q90 distinguem durações elevadas. Quantis de D incluem dias zero, não eventos independentes. Empates seguem as desigualdades acima; q10=0 impede classificar zero como abaixo de q10. Não forçar faixas vazias."),
        p("Aplicação ao exemplo histórico", "sub"),
        p("Dezembro/2025: R30=86,50 mm, abaixo do q10 de dezembro (111,42 mm); R7 está entre q10/q25; D=0. A leitura coerente é baixa chuva acumulada recente, embora o último dia não pertença a sequência seca. Não é evidência suficiente para diagnosticar escassez em 2025 e muito menos no presente."),
        p("Consequências dos erros", "sub"),
        p("Superestimar chuva pode produzir falsa tranquilidade se alguém usar o resultado como indicação de recuperação hídrica; subestimá-la pode aumentar chamados de atenção desnecessários. MAE simétrico não mede esses custos. Não há rótulos de escassez ou custos de decisão para calcular sensibilidade, falsos negativos ou falsos positivos de alerta. Essa lacuna impede alegar qualidade de um sistema de alertas."),
        p("Supervisão humana e comunicação", "sub"),
        p("O contrato mantém decision_authorized=false, disponibilidade retrospectivo_sem_servico e nível nulo para a estimativa experimental. Não há notificações. Qualquer avaliação preventiva deve ser humana, com volume, vazões, demanda e regras operativas confirmados. Racionamento ou restrições permanecem sob responsabilidade dos gestores competentes.") )
    page("7. Recomendações e conformidade",
        p("Conclusão científica", "sub"),
        p("O histórico caracteriza sazonalidade e episódios de baixa precipitação. A Ridge agrega vantagem média retrospectiva frente às referências, mas não oferece evidência para antecipar escassez. A pergunta foi respondida dentro desse alcance meteorológico; sua conversão em gestão de abastecimento permanece não demonstrada."),
        table([["Ação fundamentada", "Evidência e condição para avançar"],
          ["Manter contexto sazonal", "73,64% da chuva em outubro-março sustenta leitura por mês. Preservar referência e cobertura junto dos valores."],
          ["Qualificar volume e vazões", "1.524 registros Sabesp com flag não esclarecida. Confirmar isValid, janela, timezone, consistência e metadados antes de analisar ou juntar."],
          ["Validar externamente", "E3-097 cobre só seis meses de 2000. Selecionar estações com sobreposição, relevo e janela compatíveis; não alinhar só por rótulo da data."],
          ["Novo protocolo prospectivo", "Testar vintages e latência em período independente; definir custo de erro e alvo hídrico com gestores. Sem alterar o experimento congelado."],
          ["Evitar benefício presumido", "Não foram medidos economia de água, produtividade, redução de danos ou efeito social. Não reportar ganhos nessas dimensões."]], [170,329]),
        Spacer(1,12),
        p("Verificação do enunciado [1]", "sub"),
        p("Atendidos no recorte: Python, fontes reais, rastreabilidade/limpeza, EDA, fórmulas e unidades, dois modelos e baselines, avaliação temporal, visualizações, interpretação, recomendações, autoria e os dois formatos de PDF. A matriz externa cobre cada requisito das seis páginas, inclusive os nove critérios de avaliação."),
        p("<b>Atendimento parcial:</b> indicadores descrevem precipitação, sem disponibilidade hídrica integrada; dados atuais de reservatórios/vazões foram obtidos, mas não admitidos à análise. O snapshot analítico termina em 31/12/2025. Alertas de escassez, situação atual e validação operacional permanecem pendentes. Documentar dificuldades é permitido pelo enunciado, mas não prova equivalência a todos os seus objetivos."),
        p("Responsabilidade e vieses", "sub"),
        p("O recorte não representa igualmente todos os territórios da RMSP. Não há dados pessoais na base ambiental nem análise de grupos vulneráveis. A EDA já expôs agregados do teste, limitando cegamento humano. A fonte pode revisar histórico e mudar de produto; a radiação passa de SRB para CERES em 2001. Não se assumiu homogeneidade nem significância de tendência.") )
    page("8. Reprodução, artefatos e referências",
        p("A entrega acompanha scripts originais pipeline.py, eda.py, ml.py e consolidate.py, seus dados, figuras, modelos e inventários. hydrology.py audita a pesquisa complementar; academic_pdf.py gera estes documentos. verify_delivery.py executa a suíte em modo congelado, confere hashes e PDFs. Dependências científicas e de autoria ficam separadas, fixadas em requirements*.txt."),
        p("Reprodução segura (na raiz do repositório)", "sub"),
        p("1. Usar Python 3.13 e requirements-ml.txt no ambiente do módulo; autoria usa requirements-report.txt.<br/>2. Executar hydrology.py sem --online para validar o cache.<br/>3. Executar verify_delivery.py: verifica métricas e inventários, sem treinar, prever ou reabrir o teste.<br/>4. Gerar PDFs com academic_pdf.py no ambiente de autoria e renderizar com pdftoppm.<br/>5. Conferir todas as páginas e o inventário final. Comandos completos no README."),
        p("Os dois testes históricos que fazem fitting são explicitamente desmarcados. A execução de entrega bloqueia fit/predict e joblib.load. Não executar train, evaluate, a suíte histórica irrestrita ou downloads para reproduzir esta versão. Modelos, código congelado e recibos de abertura do teste são conferidos por SHA-256; não se promete novo treinamento bit a bit em outras plataformas."),
        p("Referências e fontes", "sub"),
        p("[1] FIAP. Data Science and Analytics - GS2026-2. Monitoramento e previsão de riscos hídricos na RMSP. Arquivo GS2026-2-DSA-FEV(2).pdf, 6 p. Auditoria em 16/11/2026; hash no registro de validação da entrega.", "small"),
        p('[2] NASA POWER. <link href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/">Daily Point API</link>; <link href="https://power.larc.nasa.gov/docs/faqs/data/">resolução, disponibilidade e dados</link>. Extração 06/11/2026. Coordenadas: <link href="https://geoftp.ibge.gov.br/cartas_e_mapas/mapas_municipais/colecao_de_mapas_municipais/2020/SP/mogi_das_cruzes/3530607_MM.pdf">IBGE, mapa municipal Mogi das Cruzes, 2020</link>. Metadados anuais em data/provenance.json.', "small"),
        p('[3] Sabesp. <link href="https://mananciais.sabesp.com.br/base-dados">Portal dos Mananciais: base de dados</link> e <link href="https://mananciais.sabesp.com.br/glossario">glossário</link>. Consultas em 16/11/2026, API pública v4, elemento 65; parâmetros 684/691/690/1. URLs exatas, datas e hashes nas respostas arquivadas. Atualização diária apresentada pelo portal; sem garantia de serviço da API.', "small"),
        p('[4] SP Águas. <link href="https://salasituacaosp.spaguas.sp.gov.br/sssp/reservatorios">Sala de Situação: reservatórios</link>; <link href="https://salasituacaosp.spaguas.sp.gov.br/sssp/vazoes-comparativo">comparativo de vazões</link>; <link href="https://cth.daee.sp.gov.br/ssdsp/Mananciais">SSD - Mananciais em Números</link>. Acessos automatizados registrados em 16/11/2026. Catálogo do SSD anuncia atualização diária às 9h; isso não comprova recebimento de série numérica.', "small"),
        p('[5] SP Águas. <link href="https://apps.spaguas.sp.gov.br/sibh/">SIBH</link> e <link href="https://ph.spaguas.sp.gov.br/Fluviometricos">banco fluviométrico</link>. Posto pluviométrico E3-097: amostra diária 2000 arquivada desde 06/11/2026. [6] INMET. <link href="https://portal.inmet.gov.br/dadoshistoricos">Dados históricos</link> e catálogo apitempo.inmet.gov.br/estacoes/T, consultado em 06/11/2026.', "small"),
        p('[7] scikit-learn. <link href="https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html">Ridge</link>. [8] scikit-learn. <link href="https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html">HistGradientBoostingRegressor</link>. Implementação arquivada: scikit-learn 1.9.1, protocolo e dependências do AGUA-03.', "small"),
        p("Repositório: github.com/matheeusvx/Agro-Brasil, módulo analytics/agro-agua. Relatórios históricos AGUA-01 a AGUA-04 permanecem evidência de etapas anteriores; a matriz de conformidade desta entrega prevalece para o estado de 16/11/2026.", "small") )
    return pages


def synthesis():
    return [p("AGRO+ BRASIL | FIAP GS 2026.2 | 16/11/2026", "small"),
        p("Síntese executiva", "title"), p(AUTHOR, "small"),
        p("<b>Problema e pergunta.</b> O histórico meteorológico de Mogi das Cruzes permite caracterizar baixa precipitação e estimar chuva semanal como apoio complementar ao monitoramento hídrico da RMSP? Quais lacunas impedem convertê-lo em alerta de escassez?"),
        p("<b>Dados e método.</b> NASA POWER AG diário LST, 2000-2025: 9.497 dias, sete variáveis, 100% completos nesta extração, sem imputação. Grade regional, não estação. Dois modelos congelados: Ridge e HistGradientBoosting; climatologia e persistência como referências. Separação temporal 2000-2019 / 2020-2022 / 2023-2025, sem reajuste após teste."),
        metrics_table(), Spacer(1,10),
        p("Fonte da tabela: AGUA-03, metrics.csv. MAE em mm por janela de sete dias. Chuva elevada: alvo >q90 de treino, 61,844 mm.", "small"),
        p("<b>Indicadores.</b> Acumulados 7/30 dias, dias consecutivos P&lt;1 mm/dia e anomalias mensais têm referência exclusiva de 2000-2019. Outubro-março concentra 73,64% da chuva; maior sequência baixa: 48 dias. Em 31/12/2025, R30=86,50 mm, abaixo do q10 mensal; é um sinal meteorológico histórico."),
        p("<b>Modelos e riscos.</b> Ridge: ganho médio 9,88%, mas só 0,15% nas chuvas elevadas (MAE 37,293 mm). Ganho médio não valida alerta de escassez. Superestimar chuva pode gerar falsa tranquilidade; custos de erro e classes de crise não foram validados. Quantis são avisos estatísticos, sem diagnóstico de reservatórios."),
        p("<b>Atualidade e limites.</b> Sabesp/Alto Tietê: oito séries históricas/atuais recuperadas (1.524 registros), com isValid=false e janela diária não confirmada. Permanecem em quarentena. Não há situação atual de escassez validada; NASA analítica termina em 2025. Latência, revisões e falta de validação externa/prospectiva limitam os modelos."),
        p("<b>Recomendações.</b> Confirmar qualidade e janela das séries de volume/vazões; validar estações e disponibilidade real; definir custos e critérios com gestores em novo protocolo independente. Manter período, fonte e incerteza visíveis. Decisões de restrição exigem validação humana. Não foram medidos economia de água ou benefícios sociais."),
        p("Fontes: NASA POWER Daily API; Sabesp Portal dos Mananciais/API v4; SP Águas. Referências completas, URLs e hashes no relatório e nos arquivos. Aderência parcial ao objetivo de disponibilidade/alertas; entrega acadêmica retrospectiva, sem serviço operacional.", "small")]


def main():
    register_fonts()
    OUT.mkdir(parents=True, exist_ok=True)
    build("relatorio-academico.pdf", report(), 9, "Agro+ Brasil - Monitoramento hídrico na RMSP")
    build("sintese-executiva.pdf", synthesis(), 1, "Agro+ Brasil - Síntese executiva")


if __name__ == "__main__":
    main()
