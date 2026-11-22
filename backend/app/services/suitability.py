"""Server-side mirror of the browser engine's rules (the browser engine.js stays the source of truth for the game).
Verdicts: suitable | suitable_with_adjustments | high_risk | not_enough_information."""
import re

def _rng(v):
    m = re.match(r"^(\d+)-(\d+)$", v or "")
    return (int(m[1]), int(m[2])) if m else None

def evaluate(crop_traits, pkg, last_crop=None):
    """crop_traits: dict trait->value (None = unknown). pkg: location package."""
    flags, missing = [], []
    seasons = (pkg or {}).get("seasons") or []
    if not seasons:
        return {"verdict": "not_enough_information", "flags": [], "missing": ["climate data for this location"]}
    recent = seasons[-10:]
    rain = sorted(s["rain_mm"] for s in recent)
    dry_year_rain = rain[1] if len(rain) > 2 else rain[0]   # ~ 2nd driest of last 10
    need = _rng(crop_traits.get("water_need_mm"))
    if need is None:
        missing.append("water_need_mm")
    elif dry_year_rain < need[0]:
        flags.append({"flag": "water", "text": f"Dry years (~{dry_year_rain:.0f} mm) fall below the crop's minimum ({need[0]} mm). Rain only, no irrigation."})
    heat_lim = crop_traits.get("heat_limit_tmax_c")
    if heat_lim is None:
        missing.append("heat_limit_tmax_c")
    else:
        hd = sum(s["heat_days"] for s in recent) / len(recent)
        if hd >= 5 and float(heat_lim) <= 32:
            flags.append({"flag": "heat", "text": f"~{hd:.0f} days/yr reach 35 C in Mar-May; crop is sensitive above {heat_lim} C."})
    if last_crop and last_crop == crop_traits.get("_id"):
        flags.append({"flag": "rotation", "text": "Same crop as last season: disease/pest build-up risk."})
    if crop_traits.get("broomrape_risk") == "high":
        flags.append({"flag": "broomrape", "text": "Broomrape (Orobanche) risk: check local fields first."})
    soil = (pkg or {}).get("soil") or {}
    if soil.get("ph") is not None and not (5.5 <= soil["ph"] <= 8.5):
        flags.append({"flag": "range", "text": f"Soil pH {soil['ph']:.1f} is outside the usual crop range."})
    if len(missing) >= 2:
        verdict = "not_enough_information"
    elif any(f["flag"] in ("water", "heat") for f in flags) and len(flags) >= 2:
        verdict = "high_risk"
    elif flags:
        verdict = "suitable_with_adjustments"
    else:
        verdict = "suitable"
    return {"verdict": verdict, "flags": flags, "missing": missing,
            "note": "Decision support only. A farmer or local agronomist must confirm."}
