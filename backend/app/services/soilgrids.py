"""ISRIC SoilGrids v2.0 REST: 0-100 cm profile -> texture, organic carbon, pH, CEC and plant-available water.

The REST API is a beta service that ISRIC may pause; callers must treat a failure as "soil unknown".
Values come back as integers with a d_factor per property; we divide by it (never hard-code the factor).
Plant-available water: Saxton & Rawls (2006), layer by layer, same as build_app_data.py.
"""
import httpx

from ..config import HTTP_TIMEOUT, SOILGRIDS_URL, USER_AGENT

DEPTHS = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15, "30-60cm": 30, "60-100cm": 40}
PROPS = {"clay": "clay", "sand": "sand", "silt": "silt", "soc": "soc", "phh2o": "ph", "cec": "cec"}


def fetch_profile(lat, lon, client=None) -> dict:
    params = [("lat", round(lat, 5)), ("lon", round(lon, 5)), ("value", "mean")]
    params += [("property", p) for p in PROPS] + [("depth", d) for d in DEPTHS]
    own = client is None
    client = client or httpx.Client(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT})
    try:
        r = client.get(SOILGRIDS_URL, params=params)
        r.raise_for_status()
        return parse_profile(r.json())
    finally:
        if own:
            client.close()


def parse_profile(j: dict) -> dict | None:
    layers: dict[str, dict] = {}
    for layer in j["properties"]["layers"]:
        n = PROPS.get(layer["name"])
        if not n:
            continue
        f = (layer.get("unit_measure") or {}).get("d_factor", 10) or 10
        for d in layer["depths"]:
            v = d["values"].get("mean")
            layers.setdefault(d["label"], {})[n] = None if v is None else v / f
    return soil_from_layers(layers)


def soil_from_layers(layers: dict) -> dict | None:
    paw, prof = 0.0, []
    for d, t in DEPTHS.items():
        L = layers.get(d)
        if not L or L.get("clay") is None or L.get("sand") is None or L.get("soc") is None:
            return None                                     # sea, urban mask or no data -> unknown
        S, C = L["sand"] / 100, L["clay"] / 100
        OM = min(L["soc"] * 1.724 / 10, 8)                 # SOC g/kg -> organic matter %
        t15 = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031
        wp = t15 + (0.14 * t15 - 0.02)
        t33 = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299
        fc = t33 + (1.283 * t33 ** 2 - 0.374 * t33 - 0.015)
        aw = max(fc - wp, 0) * t * 10
        paw += aw
        prof.append(round(aw, 1))
    top = layers["0-5cm"]
    return {"texture": usda_texture(top["sand"], top["silt"], top["clay"]), "paw100": round(paw), "paw_layers": prof,
            "clay": round(top["clay"]), "sand": round(top["sand"]), "silt": round(top["silt"]),
            "soc": round(top["soc"], 1), "ph": round(top["ph"], 1) if top.get("ph") is not None else None,
            "cec": round(top["cec"], 1) if top.get("cec") is not None else None,
            "source": "ISRIC SoilGrids v2.0 (250 m)", "method": "Saxton & Rawls 2006"}


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


def fetch_soil(lat, lon):
    """Backward-compatible shape used by services/location.py (0-30 cm means)."""
    p = fetch_profile(lat, lon)
    if not p:
        return {"clay": None, "sand": None, "silt": None, "soc": None, "ph": None, "source": "ISRIC SoilGrids 2.0"}
    return {"clay": p["clay"], "sand": p["sand"], "silt": p["silt"], "soc": p["soc"], "ph": p["ph"], "source": "ISRIC SoilGrids 2.0"}
