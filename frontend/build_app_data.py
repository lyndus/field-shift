"""Build app/data/app_data.js for the Field Shift game.

One record per location: 30 farming seasons (1995-96 .. 2024-25) of monthly climate from NASA POWER
(rain, FAO-56 ET0, heavy-rain mm, hot days, frost days, Tmax), sowing-rain onset, soil from SoilGrids
(Saxton & Rawls 2006 available water), GAEZ v4 attainable wheat yield, and Mann-Kendall trends.

Usage:
  python build_app_data.py                 # Sidi Bel Abbes field only (raw/power.csv + cleaned soil + slope)
  python build_app_data.py data/grid       # + every grid point in data/grid (power/*.csv, soilgrids/*.json)
"""
import json, sys, re
from pathlib import Path
import numpy as np, pandas as pd
from scipy.stats import kendalltau, theilslopes

SEASONS = list(range(1995, 2025))            # season start years -> 30 seasons
ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]


def load_power(path):
    text = Path(path).read_text()
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith("-END HEADER-")) + 1
    m = re.search(r"=\s*([\d.]+)\s*meters", text)
    elev = float(m.group(1)) if m else 500.0
    m2 = re.search(r"latitude\s+([-\d.]+)\s+longitude\s+([-\d.]+)", text)
    lat = float(m2.group(1)) if m2 else None
    p = pd.read_csv(path, skiprows=start)
    p["date"] = pd.to_datetime(p["YEAR"].astype(str), format="%Y") + pd.to_timedelta(p["DOY"] - 1, unit="D")
    p = p.replace(-999, np.nan).set_index("date").sort_index()
    p = p.rename(columns={"T2M": "t", "T2M_MAX": "tx", "T2M_MIN": "tn", "PRECTOTCORR": "rain", "RH2M": "rh",
                          "WS2M": "u2", "ALLSKY_SFC_SW_DWN": "rs", "GWETROOT": "gw"})
    p["rain"] = p["rain"].clip(lower=0)
    p = p.interpolate(limit=5)
    # FAO-56 Penman-Monteith ET0
    doy = p.index.dayofyear.values; phi = np.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365); dec = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(-np.tan(phi) * np.tan(dec))
    Ra = 24 * 60 / np.pi * 0.082 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))
    Rso = (0.75 + 2e-5 * elev) * Ra
    es = (0.6108 * np.exp(17.27 * p.tx / (p.tx + 237.3)) + 0.6108 * np.exp(17.27 * p.tn / (p.tn + 237.3))) / 2
    ea = p.rh / 100 * es
    Rnl = 4.903e-9 * (((p.tx + 273.16) ** 4 + (p.tn + 273.16) ** 4) / 2) * (0.34 - 0.14 * np.sqrt(ea)) * \
          (1.35 * np.clip(p.rs / Rso, 0, 1) - 0.35)
    Rn = 0.77 * p.rs - Rnl
    delta = 4098 * (0.6108 * np.exp(17.27 * p.t / (p.t + 237.3))) / (p.t + 237.3) ** 2
    gamma = 0.000665 * 101.3 * ((293 - 0.0065 * elev) / 293) ** 5.26
    p["et0"] = ((0.408 * delta * Rn + gamma * 900 / (p.t + 273) * p.u2 * (es - ea)) /
                (delta + gamma * (1 + 0.34 * p.u2))).clip(lower=0)
    p["season"] = np.where(p.index.month >= 9, p.index.year, p.index.year - 1)
    return p, elev


def onset_days(g, s):
    r3 = g["rain"].rolling(3).sum()
    hit = r3[r3 >= 20]
    return int((hit.index[0] - pd.Timestamp(f"{s}-09-01")).days) if len(hit) else None


def climate_block(p):
    out = {k: [] for k in ["rain", "et0", "heavy", "hot", "frost", "tx", "gw"]}
    onset, tmean, rain_om, et0_om, aut, hotfl, frost_tot = [], [], [], [], [], [], []
    for s in SEASONS:
        g = p[p.season == s]
        mo = g.groupby(g.index.month)
        for k, fn in [("rain", lambda x: x.rain.sum()), ("et0", lambda x: x.et0.sum()),
                      ("heavy", lambda x: x.rain[x.rain >= 20].sum()), ("hot", lambda x: int((x.tx > 31).sum())),
                      ("frost", lambda x: int((x.tn < 0).sum())), ("tx", lambda x: x.tx.mean()),
                      ("gw", lambda x: x.gw.mean())]:
            vals = [fn(mo.get_group(m)) for m in ORDER]
            out[k].append([round(float(v), 1 if k in ("tx",) else (3 if k == "gw" else 0)) for v in vals])
        onset.append(onset_days(g, s))
        grow = g[(g.index.month >= 10) | (g.index.month <= 5)]
        rain_om.append(grow.rain.sum()); et0_om.append(grow.et0.sum()); tmean.append(g.t.mean())
        aut.append(g[g.index.month.isin([9, 10, 11])].rain.sum())
        hotfl.append(int(((g.tx > 31) & g.index.month.isin([4, 5])).sum())); frost_tot.append(int((g.tn < 0).sum()))
    y = np.array(SEASONS)

    def trend(vals):
        v = np.array([np.nan if x is None else x for x in vals], dtype=float); ok = ~np.isnan(v)
        sl = theilslopes(v[ok], y[ok])[0]; pv = kendalltau(y[ok], v[ok]).pvalue
        early = np.nanmean(v[(y < 2005)]); late = np.nanmean(v[(y >= 2015)])
        return {"early": round(float(early), 1), "late": round(float(late), 1),
                "per_decade": round(float(sl * 10), 2), "p": round(float(pv), 3)}

    trends = {"rain": trend(rain_om), "autumn_rain": trend(aut), "et0": trend(et0_om), "onset": trend(onset),
              "tmean": trend(tmean), "hot_flowering": trend(hotfl), "frost": trend(frost_tot)}
    order = np.argsort(rain_om)[:3]
    return out, onset, trends, {"rain_oct_may": [round(float(r)) for r in rain_om],
                                "driest": [int(i) for i in sorted(order)], "rain_mean": round(float(np.mean(rain_om)))}


def soil_from_layers(layers):
    """layers: dict depth -> dict(clay, sand, silt, soc g/kg, ph, cec, bdod). Returns summary or None."""
    thick = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15, "30-60cm": 30, "60-100cm": 40}
    paw, prof = 0.0, []
    for d, t in thick.items():
        L = layers.get(d)
        if not L or L.get("clay") is None:
            return None
        S, C = L["sand"] / 100, L["clay"] / 100; OM = min(L["soc"] * 1.724 / 10, 8)
        t15 = -0.024*S + 0.487*C + 0.006*OM + 0.005*S*OM - 0.013*C*OM + 0.068*S*C + 0.031
        wp = t15 + (0.14*t15 - 0.02)
        t33 = -0.251*S + 0.195*C + 0.011*OM + 0.006*S*OM - 0.027*C*OM + 0.452*S*C + 0.299
        fc = t33 + (1.283*t33**2 - 0.374*t33 - 0.015)
        aw = max(fc - wp, 0) * t * 10; paw += aw; prof.append(round(aw, 1))
    top = layers["0-5cm"]
    return {"texture": usda_texture(top["sand"], top["silt"], top["clay"]), "paw100": round(paw),
            "paw_layers": prof, "clay": round(top["clay"]), "sand": round(top["sand"]), "silt": round(top["silt"]),
            "soc": round(top["soc"], 1), "ph": round(top["ph"], 1), "cec": round(top["cec"], 1), "source": "SoilGrids v2.0"}


def usda_texture(sand, silt, clay):
    if clay >= 40: return "clay" if silt < 40 and sand <= 45 else ("silty clay" if silt >= 40 else "sandy clay")
    if clay >= 27: return "silty clay loam" if sand <= 20 else ("clay loam" if sand <= 45 else "sandy clay loam")
    if clay >= 20 and sand > 45 and silt < 28: return "sandy clay loam"
    if silt >= 80 and clay < 12: return "silt"
    if silt >= 50: return "silt loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52: return "loam"
    if sand >= 85: return "sand"
    if sand >= 70: return "loamy sand"
    return "sandy loam"


def soil_from_json(path):
    j = json.loads(Path(path).read_text())
    layers = {}
    names = {"clay": "clay", "sand": "sand", "silt": "silt", "soc": "soc", "phh2o": "ph", "cec": "cec", "bdod": "bdod"}
    for layer in j["properties"]["layers"]:
        n = names.get(layer["name"]); f = layer["unit_measure"]["d_factor"]
        if not n: continue
        for d in layer["depths"]:
            v = d["values"].get("mean")
            layers.setdefault(d["label"], {})[n] = None if v is None else v / f
    return soil_from_layers(layers)


def soil_from_csv(path):
    raw = pd.read_csv(path); layers = {}
    names = {"clay": "clay", "sand": "sand", "silt": "silt", "soc": "soc", "phh2o": "ph", "cec": "cec", "bdod": "bdod"}
    for _, r in raw.iterrows():
        n = names.get(r["property"])
        if n: layers.setdefault(r["depth"], {})[n] = r["mean_raw"] / r["d_factor"]
    return soil_from_layers(layers)


def gaez_at(lat, lon):
    try:
        import rasterio
        with rasterio.open("raw/gaez/ylHr_whe.tif") as r:
            v = list(r.sample([(lon, lat)]))[0][0]
        return int(v) if v > 0 else None
    except Exception:
        return None


def record(pid, name, lat, lon, power_path, soil, slope=None, extra=None):
    p, elev = load_power(power_path)
    clim, onset, trends, summ = climate_block(p)
    rec = {"id": pid, "name": name, "lat": lat, "lon": lon, "elev": round(elev), **clim, "onset": onset,
           "trends": trends, "summary": summ, "soil": soil, "slope": slope, "gaez_wheat": gaez_at(lat, lon)}
    if extra: rec.update(extra)
    return rec


if __name__ == "__main__":
    recs = []
    slope = float(pd.read_csv("cleaned/srtm_sba_field_slope.csv").iloc[0].filter(like="slope").iloc[0]) \
        if Path("cleaned/srtm_sba_field_slope.csv").exists() else None
    recs.append(record("sba_field", "Sidi Bel Abbès – Karim's field", 35.2059, -0.6762, "raw/power.csv",
                       soil_from_csv("raw/soilgrids.csv"), slope=round(slope, 1) if slope else None,
                       extra={"demo": True, "slope_source": "NASA NASADEM 30 m"}))
    if len(sys.argv) > 1:
        g = Path(sys.argv[1]); pts = pd.read_csv(g / "grid_points.csv")
        for _, r in pts.iterrows():
            if r.id == "sba_field": continue
            pp, sp = g / "power" / f"{r.id}.csv", g / "soilgrids" / f"{r.id}.json"
            if not pp.exists() or not sp.exists(): continue
            soil = soil_from_json(sp)
            if soil is None: continue                     # sea / no soil data
            try:
                recs.append(record(r.id, None, float(r.lat), float(r.lon), pp, soil))
            except Exception as e:
                print("skip", r.id, e)
    out = Path("app/data"); out.mkdir(parents=True, exist_ok=True)
    js = "window.FS_DATA = " + json.dumps({"built": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
                                            "seasons": [f"{s}-{str(s+1)[-2:]}" for s in SEASONS],
                                            "locations": recs}, separators=(",", ":")) + ";"
    (out / "app_data.js").write_text(js)
    print(len(recs), "locations,", round(len(js) / 1024), "KB")
