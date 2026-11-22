"""Build a 'location package' for a grid cell: live data -> derived numbers -> cache; static fallback on failure."""
import json
from datetime import datetime
from ..config import GRID_STEP, OFFLINE, ROOT
from ..db import conn, dumps, now
from . import derive

def cell_for(lat, lon):
    la = round(round(lat / GRID_STEP) * GRID_STEP, 2)
    lo = round(round(lon / GRID_STEP) * GRID_STEP, 2)
    return f"{la}_{lo}", la, lo

def _fallback(cell_id, lat, lon):
    data = json.loads((ROOT / "data" / "grid" / "fallback.json").read_text())
    best = None
    for c in data["cells"]:
        if c["cell_id"] == cell_id:
            return {**c, "source_mode": "static_fallback"}
        d = (c["lat"] - lat) ** 2 + (c["lon"] - lon) ** 2
        if best is None or d < best[0]:
            best = (d, c)
    if best and best[0] < 1.0:
        return {**best[1], "source_mode": "static_fallback", "caveats": best[1].get("caveats", []) + ["nearest fallback point, not your cell"]}
    return None

def _seasons(daily, lat):
    """Group daily POWER rows by season (Sept 1 -> Aug 31) and derive per-season numbers."""
    seasons = {}
    for row in daily:
        y, m, d = int(row["date"][:4]), int(row["date"][4:6]), int(row["date"][6:])
        s = y if m >= 9 else y - 1
        seasons.setdefault(s, []).append((y, m, d, row))
    out = []
    for s, rows in sorted(seasons.items()):
        if len(rows) < 330:
            continue  # incomplete season (e.g. first/last) -> skip, don't guess
        rain = sum(r["PRECTOTCORR"] or 0 for *_, r in rows)
        tmax = [r["T2M_MAX"] for *_, r in rows if r["T2M_MAX"] is not None]
        tmin = [r["T2M_MIN"] for *_, r in rows if r["T2M_MIN"] is not None]
        et0 = 0.0
        for y, m, d, r in rows:
            if None in (r["T2M_MAX"], r["T2M_MIN"], r["RH2M"], r["WS2M"], r["ALLSKY_SFC_SW_DWN"]):
                continue
            doy = datetime(y, m, d).timetuple().tm_yday
            et0 += derive.et0_fao56(r["T2M_MAX"], r["T2M_MIN"], r["RH2M"], r["WS2M"], r["ALLSKY_SFC_SW_DWN"], lat, doy)
        onset = derive.sowing_onset([(i, r["PRECTOTCORR"]) for i, (*_, r) in enumerate(rows)])
        heat = sum(1 for _, m, _, r in rows if m in (3, 4, 5) and (r["T2M_MAX"] or 0) >= 35)
        out.append({"season": s, "rain_mm": round(rain, 1), "tmax_mean": round(sum(tmax) / len(tmax), 2),
                    "tmin_mean": round(sum(tmin) / len(tmin), 2), "et0_mm": round(et0, 1),
                    "onset_day": onset, "heat_days": heat})
    return out

def build_package(cell_id, lat, lon):
    from . import power, soilgrids, gaez
    pkg = {"cell_id": cell_id, "lat": lat, "lon": lon, "source_mode": "live",
           "resolution_note": "NASA POWER cell is about 50 km wide. It is NOT a measurement of your field.",
           "caveats": []}
    seasons = _seasons(power.fetch_daily(lat, lon), lat)
    pkg["seasons"] = seasons
    xs = [s["season"] for s in seasons]
    pkg["trends"] = {k: derive.theil_sen(xs, [s[k] for s in seasons]) for k in ("rain_mm", "tmax_mean", "et0_mm")}
    for k, t in pkg["trends"].items():
        if t["slope"] is not None and not t["significant"]:
            pkg["caveats"].append(f"{k} trend is not statistically significant (p={t['p']:.2f}) - do not call it a change")
    try:
        soil = soilgrids.fetch_soil(lat, lon)
        if None not in (soil["clay"], soil["sand"], soil["soc"]):
            soil["paw_mm_per_m"] = round(derive.plant_available_water(soil["clay"], soil["sand"], soil["soc"] * 1.724 / 10), 0)  # soc g/kg -> organic matter %
        pkg["soil"] = soil
    except Exception as e:
        pkg["soil"] = None
        pkg["caveats"].append(f"soil unavailable: {str(e)[:80]}")
    pkg["gaez"] = gaez.suitability_for(lat, lon)
    return pkg

def get_package(lat, lon, background=None):
    """Returns (status, package). status: 'ready' | 'pending'."""
    cell_id, la, lo = cell_for(lat, lon)
    with conn() as c:
        row = c.execute("SELECT json FROM location_summary WHERE cell_id=?", (cell_id,)).fetchone()
    if row:
        return "ready", json.loads(row["json"])
    if OFFLINE:
        fb = _fallback(cell_id, lat, lon)
        return ("ready", fb) if fb else ("failed", None)
    if background is not None:  # slow path -> job
        with conn() as c:
            c.execute("INSERT OR REPLACE INTO grid_cell VALUES (?,?,?,?,?)", (cell_id, la, lo, "pending", now()))
        background.add_task(run_job, cell_id, la, lo)
        fb = _fallback(cell_id, lat, lon)
        return "pending", fb
    return run_job(cell_id, la, lo)

def run_job(cell_id, la, lo):
    try:
        pkg = build_package(cell_id, la, lo)
        with conn() as c:
            c.execute("INSERT OR REPLACE INTO location_summary VALUES (?,?,?)", (cell_id, dumps(pkg), now()))
            c.execute("UPDATE grid_cell SET status='ready', updated_at=? WHERE cell_id=?", (now(), cell_id))
        return "ready", pkg
    except Exception:
        with conn() as c:
            c.execute("UPDATE grid_cell SET status='failed', updated_at=? WHERE cell_id=?", (now(), cell_id))
        fb = _fallback(cell_id, la, lo)
        return ("ready", fb) if fb else ("failed", None)
