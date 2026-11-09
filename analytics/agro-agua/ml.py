"""AGUA-03: treino, congelamento, avaliação única e relatório de resultados locais."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from importlib.metadata import version
import json
from pathlib import Path
import platform

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

import eda
import pipeline as src

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "outputs/agua03"
SEED = 562765
CANDIDATES = {"ridge_1": {"family": "ridge", "alpha": 1.0},
              "ridge_100": {"family": "ridge", "alpha": 100.0},
              "hgb_7": {"family": "hgb", "max_leaf_nodes": 7},
              "hgb_15": {"family": "hgb", "max_leaf_nodes": 15}}
FOLDS = [("2009-12-31", "2010-01-01", "2012-12-31"),
         ("2012-12-31", "2013-01-01", "2015-12-31"),
         ("2015-12-31", "2016-01-01", "2019-12-31")]


def now():
    return datetime.now(timezone.utc).isoformat()


def verify_manifest(directory):
    inventory = src.strict_json((directory / "inventory.json").read_bytes())
    for item in inventory:
        path = (directory / item["file"]).resolve()
        if not path.is_relative_to(directory.resolve()):
            raise ValueError("Caminho inválido no manifesto")
        data = path.read_bytes()
        if len(data) != item["bytes"] or src.sha(data) != item["sha256"]:
            raise ValueError(f"Hash/tamanho inválido: {item['file']}")
    return len(inventory)


def build_design(daily):
    reference = daily.loc[:"2019-12-31"].groupby(daily.loc[:"2019-12-31"].index.month).mean()
    design, cols = eda.prediction_design(daily, reference, 0)
    design["past_rain_14d_mm"] = daily.PRECTOTCORR.rolling(14, min_periods=14).sum()
    cols = cols + ["past_rain_14d_mm"]
    eligible = design.loc[design.eligible].copy()
    if eligible[cols].isna().any().any() or not np.isfinite(eligible[cols]).all().all():
        raise ValueError("Atributos ausentes ou não finitos; sem imputação")
    counts = eligible.block.value_counts().to_dict()
    if counts != {"train": 7269, "validation": 1089, "test": 1089}:
        raise ValueError(f"Partições diferentes de AGUA-02: {counts}")
    return eligible, cols


def fold_masks(design, end, start_eval, end_eval):
    train = (design.index <= end) & (design.target_end <= end)
    validation = (design.index >= start_eval) & (design.index <= end_eval) & (design.target_end <= end_eval)
    return train, validation


def make_model(spec):
    if spec["family"] == "ridge":
        return make_pipeline(StandardScaler(), Ridge(alpha=spec["alpha"], solver="svd"))
    return HistGradientBoostingRegressor(loss="squared_error", learning_rate=.05, max_iter=150,
        max_leaf_nodes=spec["max_leaf_nodes"], min_samples_leaf=40, l2_regularization=10,
        early_stopping=False, random_state=SEED)


def predict(model, X):
    # Regra física prévia para todos os ML, sem ajuste com validação/teste.
    return np.maximum(0, model.predict(X))


def baseline(daily, origins, fit_end="2019-12-31"):
    past = daily.loc[:fit_end]
    reference = past.groupby(past.index.month).mean()
    return eda.climatology_baseline(origins, reference)


def scores(y, prediction, climate):
    y, prediction, climate = map(lambda x: np.asarray(x, dtype=float), (y, prediction, climate))
    if len(y) == 0 or not np.isfinite(np.concatenate([y, prediction, climate])).all():
        raise ValueError("Métricas exigem pares finitos e não vazios")
    errors = prediction-y
    mae, rmse = np.mean(abs(errors)), np.sqrt(np.mean(errors**2))
    base_mae, base_rmse = np.mean(abs(climate-y)), np.sqrt(np.mean((climate-y)**2))
    denominator = np.sum((y-y.mean())**2)
    return {"n": len(y), "mae_mm": float(mae), "rmse_mm": float(rmse), "bias_mm": float(errors.mean()),
        "r2": float(1-np.sum(errors**2)/denominator) if denominator > 0 else None,
        "gain_mae_pct": float(100*(1-mae/base_mae)) if base_mae > 0 else None,
        "gain_rmse_pct": float(100*(1-rmse/base_rmse)) if base_rmse > 0 else None}


def hash_files(paths):
    return {p.name: src.sha(p.read_bytes()) for p in paths}


def train(out=OUT):
    out = Path(out)
    if out.resolve().is_relative_to((ROOT / "data").resolve()) or out.resolve().is_relative_to((ROOT / "outputs/agua02").resolve()):
        raise ValueError("Saída deve preservar entregas anteriores")
    if (out / "frozen.json").exists() or (out / "test-opened.json").exists():
        raise FileExistsError("Execução já congelada: não sobrescrever")
    daily, audit = eda.audit_inputs()
    verify_manifest(ROOT / "outputs/agua02")
    design, cols = build_design(daily)
    # Nenhum valor de teste é usado no fitting ou na seleção.
    development = design.loc[design.block.ne("test")]
    out.mkdir(parents=True, exist_ok=True)
    model_dir = out / "models"; model_dir.mkdir(exist_ok=True)
    cv = []
    for key, spec in CANDIDATES.items():
        for fold, (end, a, b) in enumerate(FOLDS, 1):
            fit_mask, eval_mask = fold_masks(development, end, a, b)
            fit, evaluation = development.loc[fit_mask], development.loc[eval_mask]
            model = make_model(spec)
            model.fit(fit[cols], fit.target_next7_mm)
            estimate = predict(model, evaluation[cols])
            climate = baseline(daily, evaluation.index, end)
            cv.append({"candidate": key, "fold": fold, "fit_end": end, "evaluation_start": a, "evaluation_end": b,
                "n_fit": len(fit), **scores(evaluation.target_next7_mm, estimate, climate)})
    cv = pd.DataFrame(cv)
    cv.to_csv(out / "cv_metrics.csv", index=False)
    means = cv.groupby("candidate").mae_mm.mean()
    chosen = {family: min([key for key, s in CANDIDATES.items() if s["family"] == family], key=lambda k: (means[k], k)) for family in ["ridge", "hgb"]}
    fit = development.loc[development.block.eq("train")]
    q90 = float(fit.target_next7_mm.quantile(.9))
    predictions = []
    configs = {}
    for family, key in chosen.items():
        model = make_model(CANDIDATES[key]); model.fit(fit[cols], fit.target_next7_mm)
        joblib.dump(model, model_dir / f"{family}.joblib", compress=3)
        configs[family] = {"candidate": key, "spec": CANDIDATES[key], "estimator_params": model.get_params(deep=False) if family == "hgb" else {"scaler": "StandardScaler", "ridge_alpha": CANDIDATES[key]["alpha"], "solver": "svd"}}
    for block in ["train", "validation"]:
        subset = development.loc[development.block.eq(block)]
        frame = pd.DataFrame({"date": subset.index, "block": block, "y_mm": subset.target_next7_mm.to_numpy(),
            "climatology": baseline(daily, subset.index).to_numpy(), "persistence": subset.past_rain_7d_mm.to_numpy()})
        for family in chosen:
            model = joblib.load(model_dir / f"{family}.joblib")
            frame[family] = predict(model, subset[cols])
        predictions.append(frame)
    predictions = pd.concat(predictions, ignore_index=True)
    predictions.to_csv(out / "development_predictions.csv", index=False)
    metric_rows = []
    for block, frame in predictions.groupby("block"):
        for method in ["climatology", "persistence", "ridge", "hgb"]:
            metric_rows.append({"block": block, "method": method, **scores(frame.y_mm, frame[method], frame.climatology)})
    metrics = pd.DataFrame(metric_rows); metrics.to_csv(out / "development_metrics.csv", index=False)
    validation = metrics.loc[metrics.block.eq("validation") & metrics.method.isin(chosen)]
    winner = validation.sort_values(["mae_mm", "method"]).iloc[0].method
    best_reference = metrics.loc[metrics.block.eq("validation")].sort_values(["mae_mm", "method"]).iloc[0].method
    frozen = {"frozen_at_utc": now(), "selected_model": winner, "best_method_validation_including_baselines": best_reference,
        "selection_rule": "configuração por média MAE dos 3 folds; família ML por MAE validação; desempate lexical",
        "configs": configs, "features": cols, "q90_high_rain_train_mm": q90, "fit_end": "2019-12-31",
        "counts": design.block.value_counts().to_dict(), "availability_lag": 0,
        "no_early_stopping": True, "nonnegative_clip": True, "seed": SEED,
        "code_hashes": hash_files([Path(__file__), ROOT / "eda.py", ROOT / "pipeline.py", ROOT / "requirements-ml.txt"]),
        "models_sha256": hash_files(sorted(model_dir.glob("*.joblib"))),
        "data_sha256": src.sha((ROOT / "data/processed/daily.csv").read_bytes()),
        "audit": audit, "python": platform.python_version(),
        "versions": {p: version(p) for p in ["scikit-learn", "numpy", "scipy", "pandas", "joblib", "threadpoolctl"]}}
    src.write_json(out / "frozen.json", frozen)
    print(f"Congelado antes do teste: {winner}; melhor método incluindo baselines: {best_reference}")


def check_frozen(out):
    frozen = src.strict_json((out / "frozen.json").read_bytes())
    for name, expected in frozen["code_hashes"].items():
        if src.sha((ROOT / name).read_bytes()) != expected:
            raise ValueError(f"Código alterado após congelamento: {name}")
    for name, expected in frozen["models_sha256"].items():
        if src.sha((out / "models" / name).read_bytes()) != expected:
            raise ValueError("Modelo alterado após congelamento")
    return frozen


def reserve_test(out, freeze_hash):
    # Criação exclusiva; falha após abertura também exige investigação, não nova abertura automática.
    with (out / "test-opened.json").open("x", encoding="utf-8") as handle:
        json.dump({"opened_at_utc": now(), "frozen_sha256": freeze_hash, "one_batch_only": True}, handle, indent=2)


def evaluate(out=OUT):
    out = Path(out)
    frozen = check_frozen(out)
    if (out / "test-opened.json").exists():
        raise FileExistsError("Teste já aberto; use report/verify sobre previsões preservadas")
    daily, _ = eda.audit_inputs()
    if src.sha((ROOT / "data/processed/daily.csv").read_bytes()) != frozen["data_sha256"]:
        raise ValueError("Base alterada")
    design, cols = build_design(daily)
    if cols != frozen["features"]:
        raise ValueError("Features diferentes do contrato congelado")
    reserve_test(out, src.sha((out / "frozen.json").read_bytes()))
    subset = design.loc[design.block.eq("test")]
    frame = pd.DataFrame({"date": subset.index, "block": "test", "y_mm": subset.target_next7_mm.to_numpy(),
        "climatology": baseline(daily, subset.index).to_numpy(), "persistence": subset.past_rain_7d_mm.to_numpy()})
    for family in ["ridge", "hgb"]:
        frame[family] = predict(joblib.load(out / "models" / f"{family}.joblib"), subset[cols])
    frame.to_csv(out / "test_predictions.csv", index=False)
    src.write_json(out / "test-completed.json", {"completed_at_utc": now(), "n": len(frame),
        "selected_before_opening": frozen["selected_model"], "predictions_sha256": src.sha((out / "test_predictions.csv").read_bytes())})
    print("Teste avaliado uma única vez, sem refit. Previsões preservadas.")


def detailed_metrics(frame, q90):
    rows = []
    for block, part in frame.groupby("block"):
        groups = {"all": np.ones(len(part), dtype=bool),
            "wet_oct_mar": part.date.dt.month.isin([10, 11, 12, 1, 2, 3]),
            "dry_apr_sep": part.date.dt.month.isin([4, 5, 6, 7, 8, 9]), "high_gt_train_q90": part.y_mm > q90}
        groups.update({f"year_{year}": part.date.dt.year.eq(year) for year in sorted(part.date.dt.year.unique())})
        groups.update({f"weekday_origin_{day}": part.date.dt.dayofweek.eq(day) for day in range(7)})
        for group, mask in groups.items():
            selected = part.loc[mask]
            if selected.empty:
                continue
            for method in ["climatology", "persistence", "ridge", "hgb"]:
                rows.append({"block": block, "group": group, "method": method,
                    **scores(selected.y_mm, selected[method], selected.climatology)})
    return pd.DataFrame(rows)


def uncertainty(frame, method, repeats=1000):
    """Bootstrap pareado, blocos inteiramente contíguos; positivo = redução do MAE."""
    result = []
    loss_base = abs(frame.climatology-frame.y_mm).to_numpy()
    loss_model = abs(frame[method]-frame.y_mm).to_numpy()
    dates = frame.date.to_numpy(dtype="datetime64[D]")
    for width in [14, 28, 56]:
        starts = np.array([i for i in range(len(frame)-width+1) if (dates[i+width-1]-dates[i]).astype(int) == width-1])
        rng = np.random.default_rng(SEED + width)
        means = []
        for _ in range(repeats):
            draws = rng.choice(starts, size=int(np.ceil(len(frame)/width)))
            idx = (draws[:, None]+np.arange(width)).ravel()[:len(frame)]
            means.append(np.mean(loss_base[idx]-loss_model[idx]))
        lo, hi = np.quantile(means, [.025, .975])
        result.append({"block": str(frame.block.iloc[0]), "method": method, "block_days": width,
            "repeats": repeats, "mae_reduction_mm": float(np.mean(loss_base-loss_model)),
            "ci95_low_mm": float(lo), "ci95_high_mm": float(hi), "valid_block_starts": len(starts)})
    return result


def graphics(frame, metrics, winner, out):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    out.mkdir(exist_ok=True)
    methods = ["climatology", "persistence", "ridge", "hgb"]
    test = frame.loc[frame.block.eq("test")]
    fig, axes = plt.subplots(2, 2, figsize=(11, 9), layout="constrained")
    maximum = max(test.y_mm.max(), test[methods].max().max())
    for ax, method in zip(axes.flat, methods):
        ax.scatter(test.y_mm, test[method], s=8, alpha=.3)
        ax.plot([0, maximum], [0, maximum], "k--", lw=.7)
        ax.set(xlabel="Real NASA (mm/7 dias)", ylabel="Estimado (mm/7 dias)", title=method + (" • escolhido antes do teste" if method == winner else ""))
    fig.suptitle("Teste 2023–2025 • estimativas retrospectivas, sem refit")
    fig.savefig(out / "01_real_estimado.png"); plt.close(fig)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4), layout="constrained")
    limit = np.ceil(max(abs(test[m]-test.y_mm).max() for m in methods)) + 1
    for method in methods:
        axes[0].hist(test[method]-test.y_mm, bins=np.linspace(-limit, limit, 65), histtype="step", label=method)
    axes[0].set(xlabel="Erro = estimado − real (mm)", ylabel="Origens", title="Distribuição dos erros no teste"); axes[0].legend()
    errors = [test[m]-test.y_mm for m in methods]
    axes[1].boxplot(errors, tick_labels=methods); axes[1].axhline(0, color="gray", lw=.7)
    axes[1].set(ylabel="Erro (mm)", title="Erros com extremos preservados")
    fig.savefig(out / "02_erros.png"); plt.close(fig)
    fig, ax = plt.subplots(figsize=(12, 5), layout="constrained")
    groups = ["wet_oct_mar", "dry_apr_sep", "high_gt_train_q90", "year_2023", "year_2024", "year_2025"]
    for k, method in enumerate(methods):
        values = [metrics.loc[metrics.block.eq("test") & metrics.group.eq(g) & metrics.method.eq(method), "mae_mm"].iloc[0] for g in groups]
        ax.bar(np.arange(len(groups))+(k-1.5)*.2, values, width=.2, label=method)
    ax.set(xticks=range(len(groups)), xticklabels=["Chuvoso", "Seco", "Elevada >q90 treino", "2023", "2024", "2025"], ylabel="MAE (mm)", title="Teste • desempenho por período/evento • limiar fixado no treino")
    ax.legend(); fig.savefig(out / "03_periodos.png"); plt.close(fig)
    fig, ax = plt.subplots(figsize=(12, 4), layout="constrained")
    ax.plot(test.date, test.y_mm, lw=.8, label="Real NASA")
    ax.plot(test.date, test[winner], lw=.7, label=f"{winner} congelado")
    ax.plot(test.date, test.climatology, lw=.8, label="Climatologia")
    ax.set(ylabel="Precipitação (mm/7 dias)", xlabel="Origem LST", title="Teste completo • estimativas retrospectivas"); ax.legend()
    fig.savefig(out / "04_serie_teste.png"); plt.close(fig)


def report(out=OUT):
    out = Path(out)
    frozen = check_frozen(out)
    receipt = src.strict_json((out / "test-completed.json").read_bytes())
    if src.sha((out / "test_predictions.csv").read_bytes()) != receipt["predictions_sha256"]:
        raise ValueError("Previsões de teste alteradas")
    frames = [pd.read_csv(out / name, parse_dates=["date"]) for name in ["development_predictions.csv", "test_predictions.csv"]]
    frame = pd.concat(frames, ignore_index=True)
    metrics = detailed_metrics(frame, frozen["q90_high_rain_train_mm"])
    metrics.to_csv(out / "metrics.csv", index=False)
    src.write_json(out / "metrics.json", json.loads(metrics.to_json(orient="records")))
    intervals = []
    for block in ["validation", "test"]:
        part = frame.loc[frame.block.eq(block)]
        for method in ["persistence", "ridge", "hgb"]:
            intervals.extend(uncertainty(part, method))
    intervals = pd.DataFrame(intervals); intervals.to_csv(out / "uncertainty.csv", index=False)
    winner = frozen["selected_model"]
    graphics(frame, metrics, winner, out / "figures")
    rows = ["| Método | MAE mm | RMSE mm | Viés mm | R² | Ganho MAE % |", "|---|---:|---:|---:|---:|---:|"]
    all_test = metrics.loc[metrics.block.eq("test") & metrics.group.eq("all")]
    for row in all_test.itertuples():
        rows.append(f"| {row.method} | {row.mae_mm:.3f} | {row.rmse_mm:.3f} | {row.bias_mm:.3f} | {row.r2:.3f} | {row.gain_mae_pct:.2f} |")
    def metric(block, method, group="all"):
        return metrics.loc[metrics.block.eq(block) & metrics.method.eq(method) & metrics.group.eq(group)].iloc[0]
    selected = metric("test", winner)
    val = metric("validation", winner)
    fit = metric("train", winner)
    wet, dry, high = [metric("test", winner, g) for g in ["wet_oct_mar", "dry_apr_sep", "high_gt_train_q90"]]
    ci = intervals.loc[intervals.block.eq("test") & intervals.method.eq(winner) & intervals.block_days.eq(28)].iloc[0]
    text = f"""# AGUA-03 — avaliação retrospectiva de precipitação semanal

## Protocolo e seleção antes do teste

Alvo mantido: y(t)=Σ P(t+h), h=1…7, em mm. NASA POWER AG, diário LST, referência municipal −23,52°, −46,19°. Base local, nenhum download. Partições exatas: treino 2000–2019 (7.269), validação 2020–2022 (1.089), teste 2023–2025 (1.089). Alvos que cruzam fronteiras foram excluídos. 34 atributos: sete variáveis defasadas 0/1/2/7, acumulados 7/14/30, sequência P<1 até t, seno/cosseno mensal. Nenhuma variável posterior a t; sem imputação. Cenário ideal após encerrar t, não disponibilidade operacional.

Três folds expansivos internos do treino, com purga de rótulos, comparam Ridge alpha=1/100 e HGB com 7/15 folhas. Ridge usa StandardScaler ajustado somente no fit de cada fold e solver SVD. HGB: 150 iterações, taxa 0,05, mínimo 40 amostras/folha, L2=10, early_stopping=False, seed {SEED}; não há validação aleatória interna. Configuração por família escolhida pela média de MAE nos folds; família por MAE de validação. Previsões ML negativas são truncadas em zero por regra prévia, sem ajuste posterior.

Modelo escolhido: **{winner}**. Melhor método na validação incluindo baselines: **{frozen['best_method_validation_including_baselines']}**. Escolha e parâmetros foram gravados em frozen.json em {frozen['frozen_at_utc']}, antes da abertura do teste. Modelos treinados somente até 2019, sem refit em validação/teste. Os dois modelos e duas baselines foram avaliados num único lote de teste; os resultados do modelo não escolhido são secundários, não uma nova seleção.

Climatologia: soma das médias diárias por mês de calendário de t+1…t+7, ajustadas só em 2000–2019. Persistência: soma P(t−6)…P(t), igual corte de informação. MAE é primária; RMSE, viés (estimado−real), R² e ganho percentual contra climatologia complementam. Ganho positivo significa redução de erro. Métricas de treino são aparentes/in-sample, incluindo a climatologia, e não provas de generalização.

## Teste final (uma abertura, sem reajuste)

{chr(10).join(rows)}

## Respostas interpretativas

1. **Superou a climatologia?** O modelo selecionado {winner} teve ganho MAE de {selected.gain_mae_pct:.2f}% no teste e {val.gain_mae_pct:.2f}% na validação. Valores negativos significam perda. Todos os métodos estão na tabela, sem reescolher o vencedor pelo teste.
2. **Magnitude e incerteza:** redução pareada de MAE de {ci.mae_reduction_mm:.3f} mm; intervalo bootstrap de blocos de 28 dias, 95%, [{ci.ci95_low_mm:.3f}, {ci.ci95_high_mm:.3f}] mm. Se incluir zero, não há ganho robusto demonstrado por esse procedimento. Sensibilidades 14/56 dias em uncertainty.csv. São intervalos aproximados, condicionados a esta curta amostra e sazonalidade, não probabilidades de acerto de uma previsão.
3. **Seco/chuvoso:** MAE {wet.mae_mm:.3f} mm no período outubro–março e {dry.mae_mm:.3f} mm em abril–setembro; respectivos ganhos {wet.gain_mae_pct:.2f}% e {dry.gain_mae_pct:.2f}%. Meses são classificados pela origem, mesmo quando o alvo atravessa meses. Nas chuvas elevadas (>q90 do alvo de treino, {frozen['q90_high_rain_train_mm']:.3f} mm), MAE {high.mae_mm:.3f} mm, n={int(high.n)}, ganho {high.gain_mae_pct:.2f}%. Não é limiar agronômico. Os recortes se sobrepõem; não somar contagens.
4. **Sobreajuste:** MAE aparente do escolhido no treino {fit.mae_mm:.3f}, validação {val.mae_mm:.3f} e teste {selected.mae_mm:.3f} mm. Diferença entre treino e avaliação pode indicar sobreajuste, mas também mudanças na distribuição e no regime de chuva. cv_metrics.csv, development_metrics.csv e métricas por ano permitem avaliar estabilidade, sem confundir menor erro absoluto em anos secos com maior habilidade. Não foram removidos anos difíceis.
5. **Uso prático:** estes erros não autorizam previsão operacional, alerta local ou prescrição de irrigação. Ganho pontual, se houver, deve ser confrontado com incerteza, baselines e extremos; não foi estabelecida tolerância de decisão de um usuário. O resultado mede o produto NASA histórico final, não verdade pontual. Habilidade operacional continua não demonstrada, mesmo se o escore retrospectivo melhorar.
6. **Próximos dados:** previsões numéricas de tempo arquivadas como emitidas, campos espaciais/sistemas atmosféricos, estações independentes com janela alinhada, histórico de publicação/vintages e acompanhamento prospectivo. E3-097 tem só seis meses de 2000 e janela desconhecida: não oferece validação conclusiva e não foi usada no ajuste/comparação.

## Limitações e riscos

Os agregados de 2023–2025 já foram inspecionados em AGUA-01/02: teste cronológico preservado, mas sem cegamento humano completo. Não houve escolha pós-teste. Datas LST diferem de UTC/fuso civil. NASA tem latência típica de dias, revisões e grade de dezenas de quilômetros; valores finais até t podem não estar disponíveis em t. Não foi executada sensibilidade ML lag7 neste protocolo principal, para manter exatamente as origens exigidas: é limitação adicional, não evidência de robustez operacional. Dados não medem água no solo ou reservatórios.

Janelas consecutivas compartilham seis dias. Bootstrap usa blocos pareados contíguos, evitando atravessar lacunas de exclusão nas bordas dos anos; 1.000 reamostragens com seed fixo. Teste tem apenas três anos. metrics.csv inclui sete alinhamentos semanais não sobrepostos em cada alinhamento, anos, épocas e eventos; não interpretar dias como observações independentes. Histogramas/boxplots mantêm extremos; distribuições podem mudar com o clima e o produto.

## Artefatos e reprodução

Modelos locais em models/*.joblib, parâmetros completos e hashes em frozen.json; carregar apenas esses artefatos próprios verificados. cv_metrics.csv documenta os folds. test-opened.json registra abertura exclusiva e test-completed.json os hashes das estimativas preservadas. `report` apenas reprocessa CSVs, sem prever ou ajustar novamente. `verify` verifica hashes e métricas arquivadas sem abrir de novo o teste. requirements-ml.txt fixa dependências adicionais. Inventário separado, preservando AGUA-01/02.
"""
    (out / "relatorio-tecnico.md").write_text(text, encoding="utf-8")
    inventory = [{"file": p.relative_to(out).as_posix(), "bytes": p.stat().st_size, "sha256": src.sha(p.read_bytes())}
        for p in sorted(out.rglob("*")) if p.is_file() and p.name != "inventory.json"]
    src.write_json(out / "inventory.json", inventory)
    print(all_test.to_string(index=False))


def verify(out=OUT):
    out = Path(out)
    count = verify_manifest(out)
    check_frozen(out)
    eda.audit_inputs(); verify_manifest(ROOT / "outputs/agua02")
    frames = [pd.read_csv(out / name, parse_dates=["date"]) for name in ["development_predictions.csv", "test_predictions.csv"]]
    frozen = src.strict_json((out / "frozen.json").read_bytes())
    actual = detailed_metrics(pd.concat(frames, ignore_index=True), frozen["q90_high_rain_train_mm"])
    expected = pd.read_csv(out / "metrics.csv")
    pd.testing.assert_frame_equal(actual, expected, check_dtype=False, atol=1e-10, rtol=1e-10)
    print(f"{count} artefatos verificados; métricas idênticas; sem fitting/predict/reabertura do teste")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["train", "evaluate", "report", "verify"])
    parser.add_argument("--output", type=Path, default=OUT)
    args = parser.parse_args()
    with threadpool_limits(limits=1):
        globals()[args.stage](args.output)
