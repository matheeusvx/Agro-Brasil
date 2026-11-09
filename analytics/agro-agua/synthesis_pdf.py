"""Síntese acadêmica A4 de uma página; usa somente métricas e figura já arquivadas.

Executar com o Python bundled do Codex (reportlab 4.4.9, pypdf 6.10.0).
"""
import csv
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "outputs/agua04/output/pdf"


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("Agua", "C:/Windows/Fonts/arial.ttf"))
    pdfmetrics.registerFont(TTFont("AguaBold", "C:/Windows/Fonts/arialbd.ttf"))
    pdfmetrics.registerFontFamily("Agua", normal="Agua", bold="AguaBold", italic="Agua", boldItalic="AguaBold")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("BodyAgua", fontName="Agua", fontSize=9, leading=12, textColor=colors.HexColor("#233b3b"), spaceAfter=6))
    styles.add(ParagraphStyle("TitleAgua", fontName="AguaBold", fontSize=23, leading=27, textColor=colors.HexColor("#10594f"), spaceAfter=5))
    styles.add(ParagraphStyle("SmallAgua", parent=styles["BodyAgua"], fontSize=7.3, leading=9, spaceAfter=4))
    story = []
    def p(text, style="BodyAgua"):
        return Paragraph(text, styles[style])
    story += [p("AGRO+ BRASIL  /  AGUA-04  /  SÍNTESE ACADÊMICA", "SmallAgua"), p("Inteligência hídrica regional", "TitleAgua"),
        p("<b>Conclusão:</b> a Ridge melhora o erro médio retrospectivo, mas não demonstra aptidão operacional e quase não melhora a estimativa de chuvas elevadas."),
        p("<b>Problema.</b> Estimar a precipitação acumulada de t+1 a t+7 em Mogi das Cruzes/SP, usando somente histórico até o fechamento de t, em LST."),
        p("<b>Dados.</b> NASA POWER, comunidade AG; 01/01/2000 a 31/12/2025; 9.497 dias e sete variáveis, 100% completos nesta extração. Ponto de referência da sede: -23,52°, -46,19°. Dados em grade, sem equivalência a uma propriedade."),
        p("<b>Método.</b> Aquisição auditável, EDA e 34 atributos passados. Treino/validação/teste: 7.269/1.089/1.089 origens; purga de alvos nas fronteiras. Três folds cronológicos no treino; seleção por validação. Ridge alpha=100 congelada antes da abertura única do teste, sem refit."),
        Image(str(ROOT / "outputs/agua03/figures/03_periodos.png"), width=503, height=209.6),
        p("Figura reutilizada integralmente do AGUA-03. MAE em mm por janela de sete dias; recortes de teste se sobrepõem. Eventos elevados: alvo acima do q90 do treino (61,844 mm).", "SmallAgua")]
    rows = [["Teste 2023-2025", "MAE (mm)", "RMSE (mm)", "R²", "Ganho MAE"]]
    with (ROOT / "outputs/agua03/metrics.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["block"] == "test" and row["group"] == "all":
                labels = {"climatology": "Climatologia", "persistence": "Persistência", "ridge": "Ridge (escolhida)", "hgb": "HistGradientBoosting"}
                fmt = lambda key, places=3: f"{float(row[key]):.{places}f}".replace(".", ",")
                rows.append([labels[row["method"]], fmt("mae_mm"), fmt("rmse_mm"), fmt("r2"), fmt("gain_mae_pct", 2)+"%"])
    table = Table(rows, colWidths=[169, 80, 88, 65, 101])
    table.setStyle(TableStyle([("FONTNAME", (0,0),(-1,-1), "Agua"), ("FONTSIZE",(0,0),(-1,-1),8.4),
        ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#10594f")), ("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("BACKGROUND",(0,3),(-1,3),colors.HexColor("#e1f0e9")), ("FONTNAME",(0,3),(-1,3),"AguaBold"),
        ("BOTTOMPADDING",(0,0),(-1,-1),5), ("TOPPADDING",(0,0),(-1,-1),5), ("ALIGN",(1,0),(-1,-1),"RIGHT")]))
    story += [table, Spacer(1,7),
        p("<b>Resultados.</b> Ridge: MAE 14,245 mm, ganho 9,88%, R² 0,226. Em chuvas elevadas: ganho de apenas 0,15% e MAE de 37,293 mm, com subestimação dos picos. No histórico, 73,64% da chuva está em outubro-março; maior sequência P&lt;1 mm/dia: 48 dias."),
        p("<b>Indicadores e limites.</b> Acumulados de 7/30 dias, sequências de baixa chuva e anomalias têm referências exclusivas de 2000-2019. Quantis são níveis estatísticos informativos, não alertas oficiais. Não representam água no solo, reservatórios ou necessidade de irrigação."),
        p("<b>Limitações.</b> NASA possui latência, revisões e resolução regional; falta validação externa com janela alinhada e avaliação prospectiva. O teste já teve agregados expostos na EDA. MAE não é intervalo de erro de uma estimativa individual. As estimativas arquivadas são experimentais, sem serviço operacional."),
        p("<b>Aplicação futura.</b> O contrato proposto permite apresentação contextualizada no portal/Flutter, após validação de disponibilidade e qualidade. Não há endpoints ou integração nesta entrega; não foram medidos impactos em produção, economia ou água."),
        p("Fontes locais: data/provenance.json; outputs/agua02/summary.json; outputs/agua03/metrics.csv e frozen.json. Extração NASA: 06/11/2026. Síntese: AGUA-04, 06/11/2026. Documentação completa e hashes acompanham o módulo.", "SmallAgua")]
    path = OUTPUT / "sintese-executiva.pdf"
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=46, rightMargin=46, topMargin=28, bottomMargin=26,
        title="Agro+ Brasil - Síntese acadêmica de Inteligência Hídrica", author="Agro+ Brasil", invariant=1)
    doc.build(story)
    reader = PdfReader(path)
    if len(reader.pages) != 1:
        raise ValueError(f"Síntese deve ter uma página; geradas {len(reader.pages)}")
    (OUTPUT / "sintese-executiva.txt").write_text(reader.pages[0].extract_text(), encoding="utf-8")
    print(f"PDF validado: {len(reader.pages)} página; {path}")


if __name__ == "__main__":
    main()
