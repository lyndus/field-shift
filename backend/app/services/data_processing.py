"""Validate and normalise NASA POWER daily data before anything else uses it.

Steps (each one counted in a quality report the API returns):
  1. parse dates (YYYYMMDD) and sort; drop duplicate dates (first one kept)
  2. fill value (-999) -> missing
  3. physically impossible values -> missing (ranges in nasa_power.PARAMETERS)
  4. unit check / normalisation to the units the engine expects
  5. short gaps (<= 5 consecutive days) filled by linear interpolation, longer gaps stay missing
  6. completeness per parameter and per agricultural season
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

import numpy as np

from .nasa_power import PARAMETERS, PowerResponse, yyyymmdd

MAX_GAP_FILL = 5        # same rule as the original build_app_data.py pipeline
SEASON_START_MONTH = 9  # agricultural season Sep -> Aug (Mediterranean winter cropping)
MIN_SEASON_DAYS = 330   # a season with fewer valid days is reported, not used

# unit conversions to the engine's units
UNIT_FIX = {
    ("ALLSKY_SFC_SW_DWN", "kW-hr/m^2/day"): 3.6,      # kWh -> MJ
    ("PRECTOTCORR", "mm day-1"): 1.0,
}


class Daily:
    """Columnar daily table: dates + one float array (NaN = missing) per parameter."""

    def __init__(self, dates: list[date], cols: dict[str, np.ndarray]):
        self.dates = dates
        self.cols = cols

    def __len__(self):
        return len(self.dates)

    def months(self) -> np.ndarray:
        return np.array([d.month for d in self.dates])

    def years(self) -> np.ndarray:
        return np.array([d.year for d in self.dates])

    def seasons(self) -> np.ndarray:
        return np.array([d.year if d.month >= SEASON_START_MONTH else d.year - 1 for d in self.dates])


def normalize(resp: PowerResponse) -> tuple[Daily, dict]:
    params = list(resp.daily)
    report: dict = {"parameters": {}, "duplicate_dates": 0, "unparseable_dates": 0, "unit_conversions": []}
    # 1. dates
    seen: dict[date, str] = {}
    for key in resp.daily[params[0]]:
        try:
            d = yyyymmdd(key)
        except ValueError:
            report["unparseable_dates"] += 1
            continue
        if d in seen:
            report["duplicate_dates"] += 1
            continue
        seen[d] = key
    dates = sorted(seen)
    # expected continuous calendar
    expected = (resp.end - resp.start).days + 1
    report["days_expected"] = expected
    report["days_received"] = len(dates)
    report["missing_dates"] = expected - len([d for d in dates if resp.start <= d <= resp.end])
    cols = {}
    for p in params:
        unit = resp.parameters.get(p, {}).get("units", "")
        exp_unit, lo, hi, _ = PARAMETERS.get(p, ("", -np.inf, np.inf, ""))
        factor = 1.0
        if unit and exp_unit and unit != exp_unit:
            factor = UNIT_FIX.get((p, unit))
            if factor is None:
                raise ValueError(f"{p}: unexpected unit '{unit}' (expected '{exp_unit}')")
            report["unit_conversions"].append({"parameter": p, "from": unit, "to": exp_unit, "factor": factor})
        raw = resp.daily[p]
        v = np.array([raw.get(seen[d], np.nan) for d in dates], dtype=float)
        n_fill = int(np.sum(v <= resp.fill_value + 1e-6))
        v[v <= resp.fill_value + 1e-6] = np.nan
        v = v * factor
        bad = (v < lo) | (v > hi)
        if p == "PRECTOTCORR":            # tiny negative rain from bias correction -> 0, not invalid
            tiny = (v < 0) & (v > -0.5)
            v[tiny] = 0.0
            bad = bad & ~tiny
        n_bad = int(np.sum(bad))
        v[bad] = np.nan
        v, n_filled = fill_short_gaps(v, MAX_GAP_FILL)
        report["parameters"][p] = {"units": PARAMETERS.get(p, (unit,))[0], "fill_values": n_fill, "out_of_range": n_bad,
                                   "gap_filled": n_filled, "still_missing": int(np.isnan(v).sum()),
                                   "completeness": round(1 - float(np.isnan(v).mean()) if len(v) else 0, 4)}
        cols[p] = v
    return Daily(dates, cols), report


def fill_short_gaps(v: np.ndarray, limit: int) -> tuple[np.ndarray, int]:
    """Linear interpolation of interior NaN runs no longer than `limit` days."""
    v = v.copy()
    n = len(v)
    filled = 0
    i = 0
    while i < n:
        if np.isnan(v[i]):
            j = i
            while j < n and np.isnan(v[j]):
                j += 1
            run = j - i
            if 0 < i and j < n and run <= limit:
                a, b = v[i - 1], v[j]
                for k in range(run):
                    v[i + k] = a + (b - a) * (k + 1) / (run + 1)
                filled += run
            i = j
        else:
            i += 1
    return v, filled


def season_completeness(daily: Daily) -> dict[int, dict]:
    out = {}
    seas = daily.seasons()
    core = ["PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN"]
    for s in sorted(set(seas.tolist())):
        m = seas == s
        days = int(m.sum())
        valid = int(np.all([~np.isnan(daily.cols[p][m]) for p in core if p in daily.cols], axis=0).sum()) if days else 0
        months = len({d.month for d, ok in zip(daily.dates, m) if ok})
        out[s] = {"days": days, "valid_days": valid, "months": months,
                  "complete": valid >= MIN_SEASON_DAYS and months == 12}
    return out


def _agg(values: np.ndarray, how: str):
    ok = values[~np.isnan(values)]
    if not len(ok):
        return None
    return float(ok.sum() if how == "sum" else ok.mean())


def aggregate(daily: Daily, et0: np.ndarray) -> dict:
    """Monthly, seasonal (Sep-Aug) and calendar-year summaries for display and export."""
    rain, tx, tn, t = (daily.cols[k] for k in ("PRECTOTCORR", "T2M_MAX", "T2M_MIN", "T2M"))
    rh, ws, rs = (daily.cols[k] for k in ("RH2M", "WS2M", "ALLSKY_SFC_SW_DWN"))
    years, months, seasons = daily.years(), daily.months(), daily.seasons()

    def block(mask) -> dict:
        n = int(mask.sum())
        return {
            "days": n,
            "rain_mm": _r(_agg(rain[mask], "sum"), 1), "et0_mm": _r(_agg(et0[mask], "sum"), 1),
            "tmean_c": _r(_agg(t[mask], "mean"), 2), "tmax_mean_c": _r(_agg(tx[mask], "mean"), 2), "tmin_mean_c": _r(_agg(tn[mask], "mean"), 2),
            "rh_mean_pct": _r(_agg(rh[mask], "mean"), 1), "wind_mean_ms": _r(_agg(ws[mask], "mean"), 2), "solar_mean_mj": _r(_agg(rs[mask], "mean"), 2),
            "hot_days_31c": int(np.nansum(tx[mask] > 31)), "hot_days_35c": int(np.nansum(tx[mask] >= 35)),
            "frost_days": int(np.nansum(tn[mask] < 0)), "heavy_rain_days_20mm": int(np.nansum(rain[mask] >= 20)),
            "missing_rain_days": int(np.isnan(rain[mask]).sum()),
        }

    monthly = []
    for (y, m) in sorted({(d.year, d.month) for d in daily.dates}):
        monthly.append({"year": y, "month": m, **block((years == y) & (months == m))})
    seasonal = [{"season": f"{s}-{str(s + 1)[-2:]}", "start_year": int(s), **block(seasons == s)} for s in sorted(set(seasons.tolist()))]
    annual = [{"year": int(y), **block(years == y)} for y in sorted(set(years.tolist()))]
    return {"monthly": monthly, "seasonal": seasonal, "annual": annual}


def _r(v, n):
    return None if v is None else round(v, n)


def iter_days(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def group_index(keys: np.ndarray) -> dict:
    out = defaultdict(list)
    for i, k in enumerate(keys.tolist()):
        out[k].append(i)
    return out
