"""Agricultural indicators from validated NASA POWER daily data.

Ported line-for-line from the project's build_app_data.py so the live API and the bundled
dataset produce the same numbers for the same input. Definitions:
  ET0            FAO-56 Penman-Monteith (Allen et al. 1998), daily, mm
  hot day        Tmax > 31 C (heat stress at flowering for wheat, Porter & Gawith 1999)
  frost day      Tmin < 0 C
  heavy rain     rain falling on days with >= 20 mm (mm per month)
  sowing onset   first day after 1 Sep whose 3-day rain total reaches 20 mm (days after 1 Sep)
  trends         Theil-Sen slope per decade + Mann-Kendall / Kendall tau p-value; "significant" only if p < 0.05
"""
from __future__ import annotations

import math

import numpy as np

from .data_processing import Daily, season_completeness

ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]   # months of an agricultural season


def et0_daily(daily: Daily, lat: float, elev: float) -> np.ndarray:
    t, tx, tn = daily.cols["T2M"], daily.cols["T2M_MAX"], daily.cols["T2M_MIN"]
    rh, u2, rs = daily.cols["RH2M"], daily.cols["WS2M"], daily.cols["ALLSKY_SFC_SW_DWN"]
    doy = np.array([d.timetuple().tm_yday for d in daily.dates], dtype=float)
    phi = math.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    dec = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    ra = 24 * 60 / np.pi * 0.082 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))
    rso = (0.75 + 2e-5 * elev) * ra
    es = (0.6108 * np.exp(17.27 * tx / (tx + 237.3)) + 0.6108 * np.exp(17.27 * tn / (tn + 237.3))) / 2
    ea = rh / 100 * es
    with np.errstate(invalid="ignore", divide="ignore"):
        rnl = 4.903e-9 * (((tx + 273.16) ** 4 + (tn + 273.16) ** 4) / 2) * (0.34 - 0.14 * np.sqrt(ea)) * \
              (1.35 * np.clip(rs / rso, 0, 1) - 0.35)
        rn = 0.77 * rs - rnl
        delta = 4098 * (0.6108 * np.exp(17.27 * t / (t + 237.3))) / (t + 237.3) ** 2
        gamma = 0.000665 * 101.3 * ((293 - 0.0065 * elev) / 293) ** 5.26
        et0 = (0.408 * delta * rn + gamma * 900 / (t + 273) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2))
    return np.clip(et0, 0, None)


def onset_index(rain: np.ndarray) -> int | None:
    """Index (days after 1 Sep) of the first day whose 3-day running total reaches 20 mm."""
    for i in range(2, len(rain)):
        w = rain[i - 2:i + 1]
        if not np.isnan(w).any() and w.sum() >= 20:
            return i
    return None


def kendall_p(x: np.ndarray, y: np.ndarray) -> float:
    try:
        from scipy.stats import kendalltau
        return float(kendalltau(x, y).pvalue)
    except Exception:  # Mann-Kendall normal approximation with tie correction
        n = len(y)
        s = sum(np.sign(y[j] - y[i]) * np.sign(x[j] - x[i]) for i in range(n) for j in range(i + 1, n))
        _, counts = np.unique(y, return_counts=True)
        var = (n * (n - 1) * (2 * n + 5) - sum(c * (c - 1) * (2 * c + 5) for c in counts)) / 18
        z = 0.0 if s == 0 or var <= 0 else (s - np.sign(s)) / math.sqrt(var)
        return math.erfc(abs(z) / math.sqrt(2))


def theil_sen(x: np.ndarray, y: np.ndarray) -> float:
    try:
        from scipy.stats import theilslopes
        return float(theilslopes(y, x)[0])
    except Exception:
        sl = [(y[j] - y[i]) / (x[j] - x[i]) for i in range(len(x)) for j in range(i + 1, len(x)) if x[j] != x[i]]
        return float(np.median(sl))


def trend(years: np.ndarray, vals: list) -> dict | None:
    v = np.array([np.nan if x is None else x for x in vals], dtype=float)
    ok = ~np.isnan(v)
    if ok.sum() < 8:
        return None
    k = max(3, min(10, len(years) // 3))     # default 30 seasons -> first/last 10 (1995-2004 vs 2015-2024)
    sl = theil_sen(years[ok], v[ok])
    p = kendall_p(years[ok], v[ok])
    return {"early": round(float(np.nanmean(v[:k])), 1), "late": round(float(np.nanmean(v[-k:])), 1),
            "early_period": f"{int(years[0])}-{int(years[k - 1])}", "late_period": f"{int(years[-k])}-{int(years[-1])}",
            "per_decade": round(sl * 10, 2), "p": round(p, 3), "significant": bool(p < 0.05), "n": int(ok.sum())}


def engine_block(daily: Daily, et0: np.ndarray) -> dict:
    """The per-season monthly arrays the browser engine (engine.js) reads, for complete seasons only."""
    comp = season_completeness(daily)
    seasons_all = daily.seasons()
    months = daily.months()
    use = [s for s, c in comp.items() if c["complete"]]
    excluded = [{"season": f"{s}-{str(s + 1)[-2:]}", **c} for s, c in comp.items() if not c["complete"]]
    rain, tx, tn, t = (daily.cols[k] for k in ("PRECTOTCORR", "T2M_MAX", "T2M_MIN", "T2M"))
    gw = daily.cols.get("GWETROOT")
    out = {k: [] for k in ("rain", "et0", "heavy", "hot", "frost", "tx", "gw")}
    onset, tmean, rain_om, et0_om, aut, hotfl, frost_tot = [], [], [], [], [], [], []
    for s in use:
        m = seasons_all == s
        r, e, x, n_, tt, mo = rain[m], et0[m], tx[m], tn[m], t[m], months[m]
        g = gw[m] if gw is not None else None
        row = {k: [] for k in out}
        for M in ORDER:
            mm = mo == M
            row["rain"].append(round(float(np.nansum(r[mm]))))
            row["et0"].append(round(float(np.nansum(e[mm]))))
            row["heavy"].append(round(float(np.nansum(np.where(r[mm] >= 20, r[mm], 0)))))
            row["hot"].append(int(np.nansum(x[mm] > 31)))
            row["frost"].append(int(np.nansum(n_[mm] < 0)))
            row["tx"].append(round(float(np.nanmean(x[mm])), 1))
            row["gw"].append(round(float(np.nanmean(g[mm])), 3) if g is not None and np.any(~np.isnan(g[mm])) else None)
        for k in out:
            out[k].append(row[k])
        onset.append(onset_index(r))
        grow = (mo >= 10) | (mo <= 5)
        rain_om.append(float(np.nansum(r[grow]))); et0_om.append(float(np.nansum(e[grow]))); tmean.append(float(np.nanmean(tt)))
        aut.append(float(np.nansum(r[np.isin(mo, [9, 10, 11])])))
        hotfl.append(int(np.nansum((x > 31) & np.isin(mo, [4, 5])))); frost_tot.append(int(np.nansum(n_ < 0)))
    y = np.array(use, dtype=float)
    trends = {k: trend(y, v) for k, v in (("rain", rain_om), ("autumn_rain", aut), ("et0", et0_om), ("onset", onset),
                                          ("tmean", tmean), ("hot_flowering", hotfl), ("frost", frost_tot))} if len(use) else {}
    driest = sorted(int(i) for i in np.argsort(rain_om)[:3]) if len(rain_om) >= 3 else []
    return {
        **out, "onset": onset, "trends": trends,
        "summary": {"rain_oct_may": [round(v) for v in rain_om], "driest": driest,
                    "rain_mean": round(float(np.mean(rain_om))) if rain_om else None},
        "season_labels": [f"{s}-{str(s + 1)[-2:]}" for s in use],
        "excluded_seasons": excluded,
    }


def headline_indicators(engine: dict) -> dict:
    """Short, honest summary for the UI: values + whether each trend is statistically supported."""
    tr = engine.get("trends") or {}

    def item(k, label, unit):
        t = tr.get(k)
        if not t:
            return None
        return {"label": label, "unit": unit, "early": t["early"], "late": t["late"], "per_decade": t["per_decade"],
                "p": t["p"], "significant": t["significant"],
                "wording": "statistically significant change" if t["significant"] else "no statistically significant change (do not call it a trend)"}

    s = engine.get("summary") or {}
    return {
        "seasons_used": len(engine.get("season_labels", [])),
        "rain_oct_may_mean_mm": s.get("rain_mean"),
        "driest_seasons": [engine["season_labels"][i] for i in s.get("driest", [])],
        "trends": {k: v for k, v in {
            "rain": item("rain", "Oct-May rain", "mm/season"),
            "et0": item("et0", "Oct-May reference evapotranspiration (ET0)", "mm/season"),
            "onset": item("onset", "Sowing-rain onset", "days after 1 Sep"),
            "tmean": item("tmean", "Mean temperature", "C"),
            "hot_flowering": item("hot_flowering", "Hot days (Tmax > 31 C) in Apr-May", "days"),
            "frost": item("frost", "Frost days", "days"),
        }.items() if v},
    }
