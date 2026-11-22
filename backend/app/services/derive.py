"""Derived climate numbers. All pure functions -> easy to test.
Honest by design: a trend is only called significant when p < 0.05."""
import math
import numpy as np

FILL = -999.0

def clean(v):
    """POWER uses -999 as 'no data'. Turn it into None."""
    return None if v is None or v <= FILL + 1 else v

def et0_fao56(tmax, tmin, rh, wind2, rs_mj, lat_deg, doy, elev=0.0):
    """Daily reference evapotranspiration (mm/day), FAO-56 Penman-Monteith.
    rs_mj = shortwave radiation MJ/m2/day (POWER ALLSKY_SFC_SW_DWN already in MJ)."""
    tmean = (tmax + tmin) / 2
    p = 101.3 * ((293 - 0.0065 * elev) / 293) ** 5.26
    gamma = 0.000665 * p
    es = (0.6108 * math.exp(17.27 * tmax / (tmax + 237.3)) + 0.6108 * math.exp(17.27 * tmin / (tmin + 237.3))) / 2
    ea = es * rh / 100
    delta = 4098 * (0.6108 * math.exp(17.27 * tmean / (tmean + 237.3))) / (tmean + 237.3) ** 2
    # extraterrestrial radiation
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)
    d = 0.409 * math.sin(2 * math.pi * doy / 365 - 1.39)
    ws = math.acos(max(-1, min(1, -math.tan(phi) * math.tan(d))))
    ra = (24 * 60 / math.pi) * 0.0820 * dr * (ws * math.sin(phi) * math.sin(d) + math.cos(phi) * math.cos(d) * math.sin(ws))
    rso = (0.75 + 2e-5 * elev) * ra
    rns = (1 - 0.23) * rs_mj
    ratio = min(1.0, rs_mj / rso) if rso > 0 else 0.5
    rnl = 4.903e-9 * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * math.sqrt(max(ea, 0))) * (1.35 * ratio - 0.35)
    rn = rns - rnl
    num = 0.408 * delta * rn + gamma * (900 / (tmean + 273)) * wind2 * (es - ea)
    den = delta + gamma * (1 + 0.34 * wind2)
    return max(0.0, num / den)

def sowing_onset(daily, start_doy_offset=0, thresh_mm=20.0, window=3, min_day=0):
    """daily: list of (day_index_from_sept1, rain_mm). First day d (>= min_day) where
    the next `window` days sum to >= thresh_mm. Returns day index or None."""
    vals = [r if r is not None else 0.0 for _, r in daily]
    for i in range(min_day, len(vals) - window + 1):
        if vals[i] > 0 and sum(vals[i:i + window]) >= thresh_mm:
            return daily[i][0]
    return None

def theil_sen(xs, ys):
    pts = [(x, y) for x, y in zip(xs, ys) if y is not None]
    if len(pts) < 5:
        return {"slope": None, "p": None, "n": len(pts), "significant": False}
    x = np.array([p[0] for p in pts], float)
    y = np.array([p[1] for p in pts], float)
    n = len(x)
    slopes = [(y[j] - y[i]) / (x[j] - x[i]) for i in range(n) for j in range(i + 1, n) if x[j] != x[i]]
    slope = float(np.median(slopes))
    # Mann-Kendall (no tie correction beyond basic)
    s = sum(np.sign(y[j] - y[i]) for i in range(n) for j in range(i + 1, n))
    var = n * (n - 1) * (2 * n + 5) / 18
    z = 0.0 if s == 0 else (s - np.sign(s)) / math.sqrt(var)
    p = math.erfc(abs(z) / math.sqrt(2))
    return {"slope": slope, "p": float(p), "n": n, "significant": bool(p < 0.05)}

def plant_available_water(clay_pct, sand_pct, om_pct):
    """Saxton & Rawls (2006): returns mm of PAW per metre of soil (theta33 - theta1500)."""
    S, C, OM = sand_pct / 100, clay_pct / 100, om_pct
    t1500t = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031
    t1500 = t1500t + (0.14 * t1500t - 0.02)
    t33t = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299
    t33 = t33t + (1.283 * t33t ** 2 - 0.374 * t33t - 0.015)
    return max(0.0, (t33 - t1500) * 1000)

def validate_vs_reference(a, b, lo=0.5, hi=2.0):
    """Cross-check (e.g. POWER rain vs IMERG rain). Ratio must fall in [0.5x, 2x]."""
    if not a or not b:
        return {"ok": None, "ratio": None}
    r = a / b
    return {"ok": lo <= r <= hi, "ratio": round(r, 2)}
