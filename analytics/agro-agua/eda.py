"""AGUA-02: EDA local reproduzível; sem download, ajuste de modelos ou imputação."""
from __future__ import annotations

import argparse
from importlib.metadata import version
import json
from pathlib import Path
import platform

import numpy as np
import pandas as pd

import pipeline as source
from research_sources import distance

ROOT = Path(__file__).resolve().parent
REFERENCE_END = pd.Timestamp("2019-12-31")
BLOCKS = {"train": ("2000-01-01", "2019-12-31"),
          "validation": ("2020-01-01", "2022-12-31"),
          "test": ("2023-01-01", "2025-12-31")}
UNITS = {name: rule[0] for name, rule in source.RULES.items()}


def audit_inputs(root=ROOT):
    """Verifica os bytes de AGUA-01 antes de produzir qualquer resultado."""
    data = root / "data"
    inventory = source.strict_json((data / "inventory.json").read_bytes())
    for item in inventory:
        path = (data / item["file"]).resolve()
        if not path.is_relative_to(data.resolve()):
            raise ValueError("Caminho fora do diretório de dados")
        raw = path.read_bytes()
        if len(raw) != item["bytes"] or source.sha(raw) != item["sha256"]:
            raise ValueError(f"Integridade AGUA-01: {item['file']}")
    config = source.strict_json((root / "config.json").read_bytes())
    provenance = source.strict_json((data / "provenance.json").read_bytes())
    if config != provenance["config"] or source.sha((root / "config.json").read_bytes()) != provenance["config_sha256"]:
        raise ValueError("Configuração diferente da proveniência")
    if source.sha((root / "pipeline.py").read_bytes()) != provenance["code_sha256"]:
        raise ValueError("Código de aquisição diferente da proveniência")
    if config["time_standard"] != "LST" or config["community"] != "AG":
        raise ValueError("Calendário/comunidade inesperados")
    responses = []
    for entry in provenance["responses"]:
        raw = (data / "raw" / entry["file"]).read_bytes()
        if source.sha(raw) != entry["sha256"]:
            raise ValueError("Resposta diverge da proveniência")
        response = source.strict_json(raw)
        a, b = pd.to_datetime(entry["params"]["start"], format="%Y%m%d"), pd.to_datetime(entry["params"]["end"], format="%Y%m%d")
        source.validate_response(response, config, a, b)
        responses.append(response)
    expected, quality = source.prepare(responses, config)
    daily = pd.read_csv(data / "processed/daily.csv", index_col="date", parse_dates=["date"])
    pd.testing.assert_frame_equal(daily, expected, check_freq=False, atol=1e-10, rtol=0)
    if len(daily) != 9497 or daily.isna().any().any() or quality["issues"]:
        raise ValueError("Base não corresponde à entrega íntegra AGUA-01")
    recorded = source.strict_json((data / "reports/quality.json").read_bytes())
    if recorded["variables"] != quality["variables"] or recorded["source_records"] != len(daily):
        raise ValueError("Relatório de qualidade inconsistente")
    nasa_lat, nasa_lon = config["latitude"], config["longitude"]
    station = source.strict_json((data / "comparison/spaguas_sample_quality.json").read_bytes())
    station_csv = pd.read_csv(data / "comparison/spaguas_E3-097_2000_daily.csv", parse_dates=["date"], index_col="date")
    if len(station_csv) != station["expected_days"] or station_csv.iloc[:, 0].count() != station["valid_days"]:
        raise ValueError("Amostra E3-097 diverge do relatório")
    audit = {"inventory_files_verified": len(inventory), "records": len(daily),
        "values": int(daily.size), "coverage": [str(daily.index.min().date()), str(daily.index.max().date())],
        "latitude": nasa_lat, "longitude": nasa_lon, "time_standard": "LST", "community": "AG",
        "units": UNITS, "missing_values": int(daily.isna().sum().sum()), "quality_issues": quality["issues"],
        "duplicate_dates": int(daily.index.duplicated().sum()), "source_api_versions": sorted({r["header"]["api"]["version"] for r in responses}),
        "source_products": {r["header"]["start"][:4]: r["header"]["sources"] for r in responses},
        "station": {**station, "distance_from_nasa_point_km": round(distance(station["latitude"], station["longitude"], nasa_lat, nasa_lon), 3),
            "daily_comparison_performed": False, "reason": "Janela de acumulação/leitura desconhecida; apenas seis meses em 2000."},
        "approx_native_footprint_km": {"meteorology_ns": round(111.2 * .5, 1),
            "meteorology_ew": round(111.2 * np.cos(np.deg2rad(nasa_lat)) * .625, 1),
            "solar_1degree_ns": 111.2, "solar_1degree_ew": round(111.2 * np.cos(np.deg2rad(nasa_lat)), 1)},
        "input_hashes": {str(p.relative_to(root)).replace("\\", "/"): source.sha(p.read_bytes()) for p in [
            root / "config.json", data / "inventory.json", data / "provenance.json", data / "processed/daily.csv",
            data / "reports/quality.md", root / "docs/fontes-comparacao.md"]}}
    return daily, audit


def running_low(series, threshold=1.0):
    """Contagem até t, sem consultar o fim futuro da sequência. Ausente quebra a série."""
    low = series.lt(threshold) & series.notna()
    count = low.groupby((~low).cumsum()).cumsum().astype(float)
    return count.mask(series.isna())


def spell_events(series, threshold=1.0, exact_zero=False):
    low = series.eq(0) if exact_zero else series.lt(threshold)
    low = low & series.notna()
    rows, start = [], None
    for i, (date, flag) in enumerate(low.items()):
        if flag and start is None:
            start = i
        if start is not None and (not flag or i == len(series) - 1):
            last = i if flag else i - 1
            left = start == 0 or pd.isna(series.iloc[start - 1])
            right = last == len(series) - 1 or pd.isna(series.iloc[last + 1])
            rows.append({"start": series.index[start], "end": series.index[last], "days": last-start+1,
                "rule": "P == 0" if exact_zero else f"P < {threshold:g} mm/day",
                "left_censored": bool(left), "right_censored": bool(right),
                "crosses_year": series.index[start].year != series.index[last].year})
            start = None
    return pd.DataFrame(rows, columns=["start", "end", "days", "rule", "left_censored", "right_censored", "crosses_year"])


def aggregate(daily, freq):
    rows = []
    for label, frame in daily.resample(freq):
        end = label + (pd.offsets.MonthEnd(0) if freq == "MS" else pd.offsets.YearEnd(0))
        expected = len(pd.date_range(label, end))
        row = {"date": label, "expected_days": expected, "valid_rain_days": int(frame.PRECTOTCORR.count())}
        complete = len(frame) == expected and frame.PRECTOTCORR.notna().all()
        row.update(rain_total_mm=float(frame.PRECTOTCORR.sum()) if complete else np.nan,
            rain_max_day_mm=float(frame.PRECTOTCORR.max()),
            wet_days_ge1=int(frame.PRECTOTCORR.ge(1).sum()) if complete else np.nan,
            low_days_lt1=int(frame.PRECTOTCORR.lt(1).sum()) if complete else np.nan,
            zero_days=int(frame.PRECTOTCORR.eq(0).sum()) if complete else np.nan,
            max_low_run_lt1_within_period=int(running_low(frame.PRECTOTCORR).max()) if complete else np.nan)
        for col in ["T2M", "T2M_MAX", "T2M_MIN", "RH2M", "WS10M", "ALLSKY_SFC_SW_DWN"]:
            row[col + "_mean"] = float(frame[col].mean()) if len(frame) == expected and frame[col].notna().all() else np.nan
        rows.append(row)
    return pd.DataFrame(rows).set_index("date")


def reference_tables(daily, monthly, annual):
    train = daily.loc[:REFERENCE_END]
    m = monthly.loc[:REFERENCE_END]
    monthly_ref = m.groupby(m.index.month).agg(
        rain_mean_mm=("rain_total_mm", "mean"), rain_std_mm=("rain_total_mm", "std"),
        rain_n_years=("rain_total_mm", "count"), t2m_mean_C=("T2M_mean", "mean"),
        t2m_std_C=("T2M_mean", "std"), rh2m_mean_pct=("RH2M_mean", "mean"), rh2m_std_pct=("RH2M_mean", "std"))
    monthly_ref.index.name = "calendar_month"
    daily_ref = train.groupby(train.index.month).mean()
    daily_ref.index.name = "calendar_month"
    daily_ref["n_days"] = train.PRECTOTCORR.groupby(train.index.month).count()
    annual_ref = annual.loc[:REFERENCE_END][["rain_total_mm", "T2M_mean", "RH2M_mean"]].agg(["mean", "std", "count"])
    return monthly_ref, daily_ref, annual_ref


def anomalies(monthly, reference):
    result = monthly.copy()
    for col, prefix, unit in [("rain_total_mm", "rain", "mm"), ("T2M_mean", "t2m", "C"), ("RH2M_mean", "rh2m", "pct")]:
        means = pd.Series(result.index.month.map(reference[f"{prefix}_mean_{unit}"]), index=result.index)
        std = pd.Series(result.index.month.map(reference[f"{prefix}_std_{unit}"]), index=result.index)
        result[f"{prefix}_anomaly_{unit}"] = result[col] - means
        result[f"{prefix}_anomaly_z"] = (result[col] - means) / std.replace(0, np.nan)
        if prefix == "rain":
            result["rain_anomaly_percent"] = 100 * (result[col] / means.replace(0, np.nan) - 1)
    return result


def forward_rain(series, horizon=7):
    """y_t = P[t+1]+...+P[t+h]; exige todos os h dias e não inclui P[t]."""
    return pd.concat([series.shift(-h) for h in range(1, horizon + 1)], axis=1).sum(axis=1, min_count=horizon)


def climatology_baseline(index, daily_reference):
    values = np.zeros(len(index))
    for h in range(1, 8):
        months = (index + pd.Timedelta(days=h)).month
        values += months.map(daily_reference.PRECTOTCORR).to_numpy(dtype=float)
    return pd.Series(values, index=index, name="climatology_next7_mm")


def prediction_design(daily, daily_reference, availability_lag=0):
    if availability_lag < 0:
        raise ValueError("Latência não pode ser negativa")
    historical = daily.shift(availability_lag)
    result = pd.DataFrame(index=daily.index)
    result["feature_cutoff"] = result.index - pd.Timedelta(days=availability_lag)
    feature_columns = []
    for col in daily.columns:
        for lag in [0, 1, 2, 7]:
            name = f"{col}_lag{lag + availability_lag}"
            result[name] = historical[col].shift(lag)
            feature_columns.append(name)
    for width in [7, 30]:
        name = f"past_rain_{width}d_mm"
        result[name] = historical.PRECTOTCORR.rolling(width, min_periods=width).sum()
        feature_columns.append(name)
    result["low_run_so_far_lt1_days"] = running_low(historical.PRECTOTCORR)
    # Calendário do dia da emissão é conhecido sem dados meteorológicos futuros.
    result["calendar_sin"] = np.sin(2 * np.pi * (result.index.month - 1) / 12)
    result["calendar_cos"] = np.cos(2 * np.pi * (result.index.month - 1) / 12)
    feature_columns += ["low_run_so_far_lt1_days", "calendar_sin", "calendar_cos"]
    result["target_start"] = result.index + pd.Timedelta(days=1)
    result["target_end"] = result.index + pd.Timedelta(days=7)
    result["target_next7_mm"] = forward_rain(daily.PRECTOTCORR)
    # Referência ajustada até 2019 só é previsão fora da amostra a partir de 2020.
    result["climatology_next7_mm"] = climatology_baseline(result.index, daily_reference).where(result.index > REFERENCE_END)
    result["features_ready"] = result[feature_columns].notna().all(axis=1)
    result["block"] = "outside"
    result["eligible"] = False
    result["exclusion_reason"] = ""
    for block, (a, b) in BLOCKS.items():
        in_block = (result.index >= a) & (result.index <= b)
        safe_target = (result.target_start >= a) & (result.target_end <= b) & result.target_next7_mm.notna()
        result.loc[in_block, "block"] = block
        result.loc[in_block & ~safe_target, "exclusion_reason"] = "target_crosses_boundary_or_unavailable"
        result.loc[in_block & safe_target & ~result.features_ready, "exclusion_reason"] = "insufficient_past_history"
        result.loc[in_block & safe_target & result.features_ready, "eligible"] = True
    result.index.name = "origin_date"
    return result, feature_columns


def relationships(daily, design, feature_cols, daily_reference):
    train = daily.loc[:REFERENCE_END]
    deseason = train.copy()
    for col in train:
        deseason[col] = train[col] - train.index.month.map(daily_reference[col])
    target_train = design.loc[design.eligible & design.block.eq("train")]
    rows = []
    for col in feature_cols:
        rows.append({"feature": col, "spearman_with_target_next7": target_train[col].rank().corr(target_train.target_next7_mm.rank()),
            "n": len(target_train), "scope": "train_only_2000_2019"})
    # pandas Spearman requer scipy em algumas versões; ranking + Pearson evita dependência extra.
    lags = []
    for h in range(1, 31):
        for label, s in [("raw", train.PRECTOTCORR), ("monthly_demeaned", deseason.PRECTOTCORR)]:
            pair = pd.concat([s.rename("current"), s.shift(h).rename("past")], axis=1).dropna()
            lags.append({"lag_days": h, "series": label, "pearson": pair.current.corr(pair.past), "n": len(pair)})
    return train.rank().corr(), deseason.rank().corr(), train.corr(), pd.DataFrame(rows), pd.DataFrame(lags)


def save_csv(frame, path, index=True):
    frame.to_csv(path, index=index, date_format="%Y-%m-%d", float_format="%.8f", na_rep="")


def plots(daily, monthly, annual, anomalies_table, monthly_reference, events, correlations, lags, out):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    out.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"font.size": 10, "figure.dpi": 145, "axes.spines.top": False, "axes.spines.right": False})
    def finish(fig, name):
        fig.tight_layout(); fig.savefig(out / name); plt.close(fig)
    def heat(ax, table, title, cmap, center=False):
        pivot = table.copy(); pivot["year"] = pivot.index.year; pivot["month"] = pivot.index.month
        grid = pivot.pivot(index="year", columns="month", values=table.columns[0])
        options = {"vmin": -max(3, abs(grid.to_numpy()).max()), "vmax": max(3, abs(grid.to_numpy()).max())} if center else {}
        im = ax.imshow(grid, aspect="auto", cmap=cmap, **options)
        ax.set(xticks=range(12), xticklabels=range(1, 13), yticks=range(0, len(grid), 2), yticklabels=grid.index[::2], xlabel="Mês", ylabel="Ano", title=title)
        return im
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    axes[0].bar(annual.index.year, annual.rain_total_mm, color="#16756b")
    axes[0].set(xlabel="Ano LST", ylabel="mm", title="Acumulados anuais • todos os dias válidos")
    im = heat(axes[1], monthly[["rain_total_mm"]], "Acumulados mensais (mm)", "YlGnBu")
    fig.colorbar(im, ax=axes[1], label="mm")
    finish(fig, "01_acumulados.png")
    fig, axes = plt.subplots(3, 1, figsize=(11, 9))
    for ax, col, refcol, label in zip(axes, ["rain_total_mm", "T2M_mean", "RH2M_mean"], ["rain_mean_mm", "t2m_mean_C", "rh2m_mean_pct"], ["Chuva (mm/mês)", "Temperatura média (°C)", "Umidade média (%)"]):
        arrays = [monthly.loc[monthly.index.month == m, col].dropna().to_numpy() for m in range(1, 13)]
        ax.boxplot(arrays, tick_labels=range(1, 13), showfliers=True)
        ax.plot(range(1, 13), monthly_reference[refcol], color="#d16c20", marker="o", label="Média de referência 2000–2019")
        ax.set(ylabel=label, xlabel="Mês LST")
    axes[0].set_title("Sazonalidade • caixas: 26 valores mensais por mês (2000–2025)")
    axes[0].legend(fontsize=8)
    finish(fig, "02_sazonalidade.png")
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
    axes[0].bar(annual.index.year, annual.max_low_run_lt1_within_period, color="#af7432")
    axes[0].set(xlabel="Ano", ylabel="Dias", title="Maior sequência P < 1 mm/dia dentro de cada ano")
    for rule, group in events.groupby("rule"):
        axes[1].hist(group.days, bins=np.arange(.5, events.days.max() + 1.5), histtype="step", label=rule)
    axes[1].set(xlabel="Duração (dias)", ylabel="Número de eventos (log)", yscale="log", title="Eventos contínuos • não reiniciam em janeiro")
    axes[1].legend(fontsize=8)
    finish(fig, "03_sequencias_baixa_chuva.png")
    fig, axes = plt.subplots(2, 1, figsize=(12, 6), sharex=True)
    for ax, w in zip(axes, [7, 30]):
        ax.plot(daily.index, daily.PRECTOTCORR.rolling(w, min_periods=w).sum(), lw=.55, color="#16756b")
        ax.set(ylabel="mm", title=f"Acumulado móvel retrospectivo de {w} dias • inclui o dia t")
    axes[-1].set_xlabel("Data LST")
    finish(fig, "04_acumulados_moveis.png")
    fig, axes = plt.subplots(2, 1, figsize=(11, 6), sharex=True)
    axes[0].plot(monthly.index, monthly.T2M_mean, color="#dc8b39", lw=.75, label="Média mensal")
    axes[0].plot(annual.index, annual.T2M_mean, color="#8a3d13", marker="o", label="Média anual")
    axes[0].set(ylabel="°C", title="Temperatura e umidade • estatísticas descritivas, sem ajuste de tendência")
    axes[1].plot(monthly.index, monthly.RH2M_mean, color="#569bb7", lw=.75)
    axes[1].plot(annual.index, annual.RH2M_mean, color="#1d5266", marker="o")
    axes[1].set(ylabel="Umidade relativa (%)", xlabel="Período LST")
    axes[0].legend()
    finish(fig, "05_temperatura_umidade.png")
    fig, axes = plt.subplots(1, 2, figsize=(13, 5), layout="constrained")
    for ax, corr, title in zip(axes, correlations, ["Spearman diário bruto", "Spearman após retirar média de cada mês"]):
        im = ax.imshow(corr, vmin=-1, vmax=1, cmap="RdBu_r")
        labels = ["P", "Tmed", "Tmax", "Tmin", "RH", "WS10", "Solar"]
        ax.set(xticks=range(7), yticks=range(7), xticklabels=labels, yticklabels=labels, title=title + "\nSomente treino 2000–2019")
        for (i, j), value in np.ndenumerate(corr.to_numpy()):
            ax.text(j, i, f"{value:.2f}", ha="center", va="center", fontsize=8, color="white" if abs(value) > .7 else "black")
    fig.colorbar(im, ax=axes.ravel().tolist(), shrink=.6, label="Correlação por postos")
    fig.savefig(out / "06_relacoes_treino.png"); plt.close(fig)
    fig, axes = plt.subplots(1, 3, figsize=(14, 7))
    for ax, col, title in zip(axes, ["rain_anomaly_z", "t2m_anomaly_z", "rh2m_anomaly_z"], ["Precipitação", "Temperatura", "Umidade relativa"]):
        im = heat(ax, anomalies_table[[col]], title, "RdBu_r", center=True)
        fig.colorbar(im, ax=ax, label="Desvios padrão (z)", shrink=.7)
    fig.suptitle("Anomalias mensais • referência fixa 2000–2019 • não é SPI nem normal de 30 anos")
    finish(fig, "07_anomalias.png")
    fig, ax = plt.subplots(figsize=(10, 4))
    for label, group in lags.groupby("series"):
        ax.plot(group.lag_days, group.pearson, marker=".", label=label)
    ax.axhline(0, color="gray", lw=.7)
    ax.set(xlabel="Defasagem (dias)", ylabel="Correlação de Pearson", title="Persistência diária da chuva • somente 2000–2019 • sem significância inferencial")
    ax.legend()
    finish(fig, "08_persistencia_treino.png")


def summarize(daily, monthly, annual, anomaly_table, events, designs, target_corr, lags):
    primary = events.loc[events.rule.eq("P < 1 mm/day")]
    longest = primary.loc[primary.days.idxmax()]
    seasonal = monthly.groupby(monthly.index.month).rain_total_mm.mean()
    split_counts = {}
    for latency, design in designs.items():
        split_counts[str(latency)] = {}
        for block in BLOCKS:
            selected = design.loc[design.block.eq(block)]
            eligible = selected.loc[selected.eligible]
            split_counts[str(latency)][block] = {"origin_dates": len(selected), "eligible": len(eligible),
                "first_eligible": str(eligible.index.min().date()), "last_eligible": str(eligible.index.max().date()),
                "excluded_by_reason": selected.loc[~selected.eligible].exclusion_reason.value_counts().to_dict()}
    train_corr = target_corr.set_index("feature").spearman_with_target_next7
    result = {"reference_period": ["2000-01-01", "2019-12-31"], "eda_period": ["2000-01-01", "2025-12-31"],
        "annual_rain_mean_mm": float(annual.rain_total_mm.mean()),
        "annual_rain_min": {"year": int(annual.rain_total_mm.idxmin().year), "mm": float(annual.rain_total_mm.min())},
        "annual_rain_max": {"year": int(annual.rain_total_mm.idxmax().year), "mm": float(annual.rain_total_mm.max())},
        "oct_mar_fraction_of_total": float(daily.loc[daily.index.month.isin([10, 11, 12, 1, 2, 3]), "PRECTOTCORR"].sum() / daily.PRECTOTCORR.sum()),
        "rainiest_calendar_month": int(seasonal.idxmax()), "driest_calendar_month": int(seasonal.idxmin()),
        "zero_days": int(daily.PRECTOTCORR.eq(0).sum()), "low_days_lt1": int(daily.PRECTOTCORR.lt(1).sum()),
        "longest_low_spell": {"start": str(longest.start.date()), "end": str(longest.end.date()), "days": int(longest.days),
                              "left_censored": bool(longest.left_censored), "right_censored": bool(longest.right_censored)},
        "daily_rain_max": {"date": str(daily.PRECTOTCORR.idxmax().date()), "mm": float(daily.PRECTOTCORR.max())},
        "max_trailing_7d": {"end": str(daily.PRECTOTCORR.rolling(7).sum().idxmax().date()), "mm": float(daily.PRECTOTCORR.rolling(7).sum().max())},
        "max_trailing_30d": {"end": str(daily.PRECTOTCORR.rolling(30).sum().idxmax().date()), "mm": float(daily.PRECTOTCORR.rolling(30).sum().max())},
        "target_correlations_train_only": {name: float(train_corr[name]) for name in ["past_rain_7d_mm", "past_rain_30d_mm", "RH2M_lag0", "calendar_sin", "calendar_cos"]},
        "daily_rain_lag1_corr_train": float(lags.loc[(lags.lag_days == 1) & lags.series.eq("raw"), "pearson"].iloc[0]),
        "daily_rain_lag1_demeaned_corr_train": float(lags.loc[(lags.lag_days == 1) & lags.series.eq("monthly_demeaned"), "pearson"].iloc[0]),
        "daily_rain_lag7_demeaned_corr_train": float(lags.loc[(lags.lag_days == 7) & lags.series.eq("monthly_demeaned"), "pearson"].iloc[0]),
        "temperature_mean_C": float(daily.T2M.mean()), "rh_mean_pct": float(daily.RH2M.mean()),
        "warmest_annual_mean": {"year": int(annual.T2M_mean.idxmax().year), "C": float(annual.T2M_mean.max())},
        "lowest_annual_rh": {"year": int(annual.RH2M_mean.idxmin().year), "pct": float(annual.RH2M_mean.min())},
        "split_counts_by_availability_lag": split_counts,
        "no_model_trained": True, "no_validation_or_test_skill_computed": True,
        "decision": "GO condicional para experimento retrospectivo; habilidade preditiva não demonstrada; uso operacional ainda não justificado."}
    return result


def technical_report(summary, audit, out):
    s = summary
    longest = s["longest_low_spell"]
    text = f"""# AGUA-02 — relatório técnico

## Decisão

**GO condicional para pesquisa retrospectiva em AGUA-03; habilidade preditiva ainda não demonstrada. Uso operacional não justificado.** O alvo original de precipitação dos próximos sete dias foi mantido. Há calendário suficiente e sazonalidade/persistência a investigar, mas nenhuma correlação estabelece que um modelo superará a climatologia fora da amostra. Nenhum modelo foi ajustado; nenhum erro de validação/teste foi calculado.

## Auditoria e qualidade

Foram verificados SHA-256 e tamanhos de {audit['inventory_files_verified']} arquivos do inventário AGUA-01, configuração/proveniência, todos os cabeçalhos NASA e igualdade do CSV com o reprocessamento dos 26 JSONs. São {audit['records']} dias e {audit['values']} valores de 2000–2025, LST, AG, latitude {audit['latitude']}, longitude {audit['longitude']}, sem ausentes, duplicações ou violações de plausibilidade. Não houve download da base nem alteração dos dados ou relatórios de qualidade de AGUA-01. Unidades: mm/day, C, %, m/s e MJ/m²/day, preservadas em audit.json. Zero ausentes não comprova acurácia.

## Resultados e leitura das figuras

1. **01_acumulados.png:** média anual de {s['annual_rain_mean_mm']:.2f} mm; menor total {s['annual_rain_min']['mm']:.2f} mm em {s['annual_rain_min']['year']}; maior {s['annual_rain_max']['mm']:.2f} mm em {s['annual_rain_max']['year']}. A variabilidade é observada no produto NASA; não foi ajustada tendência, teste de mudança climática ou atribuição causal.
2. **02_sazonalidade.png:** outubro–março concentra {100*s['oct_mar_fraction_of_total']:.2f}% da chuva do período. Mês mais chuvoso em média: {s['rainiest_calendar_month']}; menos chuvoso: {s['driest_calendar_month']}. Caixas usam os 26 valores mensais por mês; linha de referência usa somente 2000–2019. Temperatura e RH acompanham ciclos sazonais, sem comprovar mecanismos causais.
3. **03_sequencias_baixa_chuva.png:** limiar primário P < 1 mm/dia, sensibilidade P < 0,1 e P = 0. Há {s['low_days_lt1']} dias abaixo de 1 mm e {s['zero_days']} exatamente zero. Maior sequência primária: {longest['days']} dias, {longest['start']} a {longest['end']}. Eventos contínuos cruzam anos; o gráfico anual reinicia a contagem em janeiro e está explicitamente identificado. Eventos nas bordas/ao lado de ausentes são censurados e marcados no CSV. Ausência não é dia seco.
4. **04_acumulados_moveis.png:** acumulados passados, incluindo t, não são o alvo futuro. Máximo móvel de 7 dias: {s['max_trailing_7d']['mm']:.2f} mm, terminando em {s['max_trailing_7d']['end']}; de 30 dias: {s['max_trailing_30d']['mm']:.2f} mm, terminando em {s['max_trailing_30d']['end']}. Primeiras 6/29 janelas ficam vazias, sem soma parcial.
5. **05_temperatura_umidade.png:** médias mensais e anuais de T2M e RH2M, com cobertura completa exigida. Média diária de todo o histórico: {s['temperature_mean_C']:.2f} °C e {s['rh_mean_pct']:.2f}% RH. Maior média anual de T2M: {s['warmest_annual_mean']['C']:.2f} °C em {s['warmest_annual_mean']['year']}; menor média anual de RH: {s['lowest_annual_rh']['pct']:.2f}% em {s['lowest_annual_rh']['year']}. T2M_MAX_mean é média das máximas diárias, não a máxima absoluta do período. Oscilações não foram extrapoladas para prognóstico.
6. **06_relacoes_treino.png:** correlações de Spearman entre as sete variáveis, somente 2000–2019, antes/depois de subtrair as médias mensais diárias do treino. Relações incluem sazonalidade compartilhada e produtos de origem comum; não estimam causalidade ou necessidade de irrigação. A remoção de média mensal é aproximação simples e não elimina toda sazonalidade.
7. **07_anomalias.png:** chuva, temperatura e umidade mensais comparadas com média/desvio padrão de cada mês em 2000–2019. Valores z são descritivos, não probabilidades, SPI, SPEI, classificação oficial de seca ou normal climatológica de 30 anos. Meses do treino participam da própria referência; por isso essas anomalias não são escores de backtest de treino.
8. **08_persistencia_treino.png:** correlação diária P(t)/P(t−1) no treino = {s['daily_rain_lag1_corr_train']:.3f}; após retirar a média mensal = {s['daily_rain_lag1_demeaned_corr_train']:.3f}. Na defasagem de sete dias, a correlação após retirar a média mensal cai para {s['daily_rain_lag7_demeaned_corr_train']:.3f}. A memória linear diária mais longa é fraca nesta medida; isso torna especialmente importante testar atraso de publicação e superar a baseline sazonal. Não prova impossibilidade de relações não lineares ou de previsão semanal. Dependência temporal invalida tratar milhares de dias como amostras independentes; não há p-valores iid.

As tabelas de correlação com y(t) usam exclusivamente origens elegíveis do treino, com rótulos encerrados até 31/12/2019. Spearman com chuva passada em 7 dias = {s['target_correlations_train_only']['past_rain_7d_mm']:.3f}; em 30 dias = {s['target_correlations_train_only']['past_rain_30d_mm']:.3f}. Essas relações misturam sazonalidade e memória meteorológica; não justificam seleção automática de atributos nem prometem habilidade em 2020–2025.

## Referências e integridade temporal

Climatologia e referências de anomalias são ajustadas exclusivamente em 2000–2019. A baseline é soma, para t+1…t+7, das médias diárias históricas de cada mês do treino, emitida somente para origens a partir de 2020; suas linhas de treino ficam vazias para evitar uma falsa previsão usando referência futura. O calendário futuro é conhecido; a chuva futura nunca entra nos atributos. prediction_design_lag0.csv é um contrato retrospectivo: presume acesso a todos os valores do dia t. As versões lag2 e lag7 são cenários de sensibilidade de disponibilidade, não garantias do SLA da NASA. Não foi demonstrada disponibilidade em tempo real dos arquivos históricos revisados.

Os sete últimos dias de origem de cada bloco são excluídos quando seus rótulos cruzam a fronteira (ou não existem no fim da série). As primeiras 29 origens do treino não têm janela passada de 30 dias no cenário lag0. Datas, cortes, razões de exclusão e contagens estão em split_manifest.json e nas tabelas de desenho. Histórico de dezembro pode alimentar janeiro da validação/teste porque seria passado já observado, sem ajustar referências nos blocos futuros.

A EDA descritiva solicitada expõe agregados de 2023–2025. Esse período permanece o teste cronológico final proposto, mas já não é um conjunto absolutamente cego em relação à inspeção humana. Nenhum critério, atributo ou limiar de evento foi escolhido para maximizar seu desempenho. Congelar o protocolo antes de AGUA-03 e, para confirmação independente, reservar um período futuro ainda não inspecionado e com vintages verificáveis.

## Representatividade e E3-097

Distância do ponto de referência NASA ao posto: {audit['station']['distance_from_nasa_point_km']:.3f} km (Haversine). Isso é pequeno frente à escala meteorológica nativa aproximada de {audit['approx_native_footprint_km']['meteorology_ns']} × {audit['approx_native_footprint_km']['meteorology_ew']} km na latitude local; para fonte solar de 1°, aproximadamente {audit['approx_native_footprint_km']['solar_1degree_ns']} × {audit['approx_native_footprint_km']['solar_1degree_ew']} km. Esses tamanhos são aproximações de escala, não um polígono de célula identificado. A geometria NASA é o ponto pedido, não um pluviômetro.

A E3-097 oferece apenas 184 dias válidos de março–agosto/2000 (182 ausentes). Horário de leitura/acumulação desconhecido: **nenhuma correlação, viés, erro, junção diária ou equivalência de acumulados foi calculada**. Nem mesmo totais mensais são tratados como equivalentes sem confirmar o fechamento dos meses. Os seis meses não cobrem um ciclo anual e não validam extremos/sazonalidade de 26 anos. Buscar documentação da janela, continuidade e metadados de outros postos no próximo incremento, antes de validar numericamente.

Relevo, tempestades locais e a diferença entre médias de grade e medições pontuais limitam representatividade. A radiação muda de SRB (2000) para CERES (2001 em diante), sem teste de homogeneidade neste incremento. A altitude de grade de 699,38 m não substitui altitude de estação. Os dados não medem água no solo, reservatórios, vazão ou demanda hídrica da cultura.

## Reprodução e arquivos

Executar `python eda.py` no módulo (ou caminho completo a partir da raiz); sem acesso à rede. Resultados em outputs/agua02, com manifesto de arquivos, hashes de código/entradas e versões de bibliotecas. Dicionário: docs/agua02-indicadores.md. Problema formal e plano de AGUA-03: docs/agua02-problema-preditivo.md. Fontes oficiais e parecer espacial: docs/agua02-representatividade.md. Estatísticas numéricas não arredondadas no summary.json; CSVs com oito casas decimais. Não foram executados treinamento, seleção de modelos ou avaliação no teste.
"""
    (out / "relatorio-tecnico.md").write_text(text, encoding="utf-8")


def run(output=None, root=ROOT):
    out = Path(output) if output else root / "outputs/agua02"
    if out.resolve().is_relative_to((root / "data").resolve()):
        raise ValueError("A saída AGUA-02 deve preservar o diretório data/ de AGUA-01")
    daily, audit = audit_inputs(root)
    out.mkdir(parents=True, exist_ok=True)
    tables = out / "tables"; tables.mkdir(exist_ok=True)
    monthly, annual = aggregate(daily, "MS"), aggregate(daily, "YS")
    monthly_ref, daily_ref, annual_ref = reference_tables(daily, monthly, annual)
    anomaly_table = anomalies(monthly, monthly_ref)
    annual_anomalies = annual.copy()
    for col in annual_ref:
        annual_anomalies[col + "_anomaly"] = annual[col] - annual_ref.loc["mean", col]
        annual_anomalies[col + "_anomaly_z"] = (annual[col] - annual_ref.loc["mean", col]) / annual_ref.loc["std", col]
    events = pd.concat([spell_events(daily.PRECTOTCORR, t) for t in [1, .1]] + [spell_events(daily.PRECTOTCORR, exact_zero=True)], ignore_index=True)
    rolling = pd.DataFrame({f"past_rain_{w}d_mm": daily.PRECTOTCORR.rolling(w, min_periods=w).sum() for w in [7, 30]})
    designs, feature_sets = {}, {}
    for lag in [0, 2, 7]:
        designs[lag], feature_sets[lag] = prediction_design(daily, daily_ref, lag)
        save_csv(designs[lag], tables / f"prediction_design_lag{lag}.csv")
    raw_corr, adjusted_corr, pearson, target_corr, lags = relationships(daily, designs[0], feature_sets[0], daily_ref)
    summary = summarize(daily, monthly, annual, anomaly_table, events, designs, target_corr, lags)
    for name, frame in {"monthly": monthly, "annual": annual, "monthly_anomalies": anomaly_table,
        "annual_anomalies": annual_anomalies, "reference_monthly_2000_2019": monthly_ref,
        "reference_daily_by_month_2000_2019": daily_ref, "reference_annual_2000_2019": annual_ref,
        "rolling_rain": rolling, "spearman_train": raw_corr, "spearman_monthly_demeaned_train": adjusted_corr,
        "pearson_train": pearson}.items():
        save_csv(frame, tables / f"{name}.csv")
    save_csv(events, tables / "low_rain_events.csv", index=False)
    save_csv(target_corr, tables / "target_feature_correlations_train.csv", index=False)
    save_csv(lags, tables / "rain_autocorrelation_train.csv", index=False)
    source.write_json(out / "audit.json", audit)
    source.write_json(out / "summary.json", summary)
    source.write_json(out / "split_manifest.json", {"blocks": BLOCKS, "target": "sum(P[t+1:t+7])",
        "reference_fit_period": ["2000-01-01", "2019-12-31"], "counts": summary["split_counts_by_availability_lag"],
        "feature_columns_by_lag": {str(k): v for k, v in feature_sets.items()}, "no_models_trained": True})
    plots(daily, monthly, annual, anomaly_table, monthly_ref, events, [raw_corr, adjusted_corr], lags, out / "figures")
    technical_report(summary, audit, out)
    source.write_json(out / "provenance.json", {"python": platform.python_version(), "dependencies": {p: version(p) for p in ["pandas", "numpy", "matplotlib"]},
        "reference_period": ["2000-01-01", "2019-12-31"], "inputs": audit["input_hashes"],
        "code_sha256": source.sha(Path(__file__).read_bytes()), "no_network": True,
        "notes": "EDA completa é descritiva; correlações com alvo somente no treino; nenhuma avaliação de habilidade em validação/teste."})
    inventory = [{"file": p.relative_to(out).as_posix(), "bytes": p.stat().st_size, "sha256": source.sha(p.read_bytes())}
        for p in sorted(out.rglob("*")) if p.is_file() and p.name != "inventory.json"]
    source.write_json(out / "inventory.json", inventory)
    print(json.dumps({"records": audit["records"], "output": str(out), "files": len(inventory) + 1, "decision": summary["decision"]}, ensure_ascii=False))
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    run(args.output)
