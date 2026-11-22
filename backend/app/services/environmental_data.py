"""Location -> environmental profile.

fetch NASA POWER (live) -> validate & normalise -> indicators -> soil & slope (best effort) -> cache.
The result carries everything the frontend needs:
  * engine_location: the exact object the browser engine/game reads (same shape as data/app_data.js)
  * aggregates: monthly / seasonal (Sep-Aug) / annual summaries
  * indicators: headline numbers with significance wording
  * data_quality, source metadata, caveats
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date, datetime, timedelta, timezone

from ..config import CACHE_RECENT_DAYS, CACHE_RECENT_TTL_HOURS, DEFAULT_END, DEFAULT_START, MAX_SPAN_YEARS
from ..db import conn, dumps, now
from . import agricultural_indicators as ind
from . import data_processing as dp
from . import nasa_power

SCHEMA_VERSION = 2


def resolve_range(start: date | None, end: date | None) -> tuple[date, date]:
    start = start or DEFAULT_START
    end = end or DEFAULT_END
    lo, hi = nasa_power.available_range()
    if end > hi:
        raise ValueError(f"end_date {end} is after the latest NASA POWER daily data (~{hi})")
    if start < lo:
        raise ValueError(f"start_date {start} is before NASA POWER daily data begins ({lo})")
    if start >= end:
        raise ValueError("start_date must be before end_date")
    if (end - start).days > MAX_SPAN_YEARS * 366:
        raise ValueError(f"date range longer than {MAX_SPAN_YEARS} years")
    return start, end


def cache_key(lat: float, lon: float, start: date, end: date) -> str:
    cell = nasa_power.cell_of(lat, lon)["id"]
    # soil & slope are per point, so the key keeps the point to ~1 km as well as the POWER cell
    raw = f"v{SCHEMA_VERSION}|{cell}|{round(lat, 2)}|{round(lon, 2)}|{start}|{end}|{','.join(nasa_power.PARAMETERS)}"
    return hashlib.sha1(raw.encode()).hexdigest()[:20]


def get_cached(key: str, end: date) -> dict | None:
    with conn() as c:
        row = c.execute("SELECT json, fetched_at FROM env_cache WHERE cache_key=?", (key,)).fetchone()
    if not row:
        return None
    if (date.today() - end).days <= CACHE_RECENT_DAYS:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(row["fetched_at"])
        if age > timedelta(hours=CACHE_RECENT_TTL_HOURS):
            return None
    pkg = json.loads(row["json"])
    pkg["cache"] = {"hit": True, "fetched_at": row["fetched_at"]}
    return pkg


def build(lat: float, lon: float, start: date, end: date, name: str | None = None) -> dict:
    caveats: list[str] = []
    resp = nasa_power.fetch_daily(lat, lon, start, end)
    daily, quality = dp.normalize(resp)
    elev = resp.elevation_m if resp.elevation_m is not None else 0.0
    if resp.elevation_m is None:
        caveats.append("NASA POWER returned no cell elevation; ET0 uses sea-level pressure")
    et0 = ind.et0_daily(daily, lat, elev)
    engine = ind.engine_block(daily, et0)
    if not engine["season_labels"]:
        raise nasa_power.PowerError("no complete agricultural season (Sep-Aug) in the requested range")
    if engine["excluded_seasons"]:
        caveats.append(f"{len(engine['excluded_seasons'])} incomplete season(s) left out, not filled in")
    for k, t in (engine["trends"] or {}).items():
        if t and not t["significant"]:
            caveats.append(f"{k}: no statistically significant trend (p={t['p']}); do not call it a change")
    if lat < 0:
        caveats.append("Seasons run Sep-Aug (Northern Hemisphere winter cropping); interpret with care south of the equator")
    # soil & slope: best effort, never invented
    soil, slope = None, None
    try:
        from . import soilgrids
        soil = soilgrids.fetch_profile(lat, lon)
        if soil is None:
            caveats.append("SoilGrids has no soil data at this point (water, urban or masked area)")
    except Exception as e:  # noqa: BLE001
        caveats.append(f"soil unavailable right now (SoilGrids: {str(e)[:60]}); the game uses the farmer's own soil answer")
    try:
        from . import elevation
        slope = elevation.slope_pct(lat, lon)
    except Exception as e:  # noqa: BLE001
        caveats.append(f"slope unavailable ({str(e)[:60]}); the game uses a default 3.5% and says so")
    gaez = None
    try:
        from . import gaez as gz  # optional module in the repo
        gaez = gz.suitability_for(lat, lon)
    except Exception:
        pass
    cell = nasa_power.cell_of(lat, lon)
    period = f"{engine['season_labels'][0]} to {engine['season_labels'][-1]}"
    engine_location = {
        "id": f"live_{cell['id']}_{round(lat, 2)}_{round(lon, 2)}", "name": name, "lat": round(lat, 4), "lon": round(lon, 4),
        "elev": round(elev), **{k: engine[k] for k in ("rain", "et0", "heavy", "hot", "frost", "tx", "gw", "onset", "trends", "summary")},
        "soil": soil, "slope": slope["slope_pct"] if slope else None,
        "slope_source": slope["source"] if slope else None, "gaez_wheat": gaez if isinstance(gaez, (int, float)) else None,
        "season_labels": engine["season_labels"], "period_label": period, "live": True,
    }
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "ready",
        "request": {"latitude": lat, "longitude": lon, "start_date": start.isoformat(), "end_date": end.isoformat()},
        "cell": cell,
        "source": {"name": "NASA POWER", "community": "AG (Agroclimatology)", "endpoint": resp.url,
                   "api_version": resp.api_version, "upstream_sources": resp.sources,
                   "parameters": resp.parameters, "fill_value": resp.fill_value,
                   "resolution": "meteorology ~0.5 x 0.625 deg (MERRA-2); solar ~1 deg (CERES)",
                   "citation": "NASA Langley Research Center POWER Project, funded through the NASA Earth Science Applied Science Program"},
        "period": {"start": start.isoformat(), "end": end.isoformat(), "seasons": engine["season_labels"], "label": period},
        "data_quality": {**quality, "excluded_seasons": engine["excluded_seasons"]},
        "aggregates": dp.aggregate(daily, et0),
        "indicators": ind.headline_indicators(engine),
        "soil": soil, "slope": slope,
        "engine_location": engine_location,
        "caveats": caveats,
        "fetched_at": now(),
        "cache": {"hit": False},
    }


def store(key: str, lat: float, lon: float, start: date, end: date, pkg: dict) -> None:
    with conn() as c:
        c.execute("INSERT OR REPLACE INTO env_cache (cache_key, cell_id, lat, lon, start_date, end_date, json, fetched_at) VALUES (?,?,?,?,?,?,?,?)",
                  (key, pkg["cell"]["id"], lat, lon, start.isoformat(), end.isoformat(), dumps(pkg), pkg["fetched_at"]))


# ---------------------------------------------------------------- jobs (background build)
def create_job(key: str, farm_id: str | None, lat: float, lon: float, start: date, end: date) -> str:
    jid = uuid.uuid4().hex
    with conn() as c:
        c.execute("INSERT INTO env_job (job_id, cache_key, farm_id, lat, lon, start_date, end_date, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                  (jid, key, farm_id, lat, lon, start.isoformat(), end.isoformat(), "pending", now(), now()))
    return jid


def run_job(jid: str, name: str | None = None) -> None:
    with conn() as c:
        j = c.execute("SELECT * FROM env_job WHERE job_id=?", (jid,)).fetchone()
        c.execute("UPDATE env_job SET status='running', updated_at=? WHERE job_id=?", (now(), jid))
    try:
        s, e = date.fromisoformat(j["start_date"]), date.fromisoformat(j["end_date"])
        pkg = build(j["lat"], j["lon"], s, e, name)
        store(j["cache_key"], j["lat"], j["lon"], s, e, pkg)
        with conn() as c:
            c.execute("UPDATE env_job SET status='ready', updated_at=? WHERE job_id=?", (now(), jid))
            if j["farm_id"]:
                c.execute("UPDATE farm SET env_key=?, updated_at=? WHERE farm_id=?", (j["cache_key"], now(), j["farm_id"]))
    except Exception as ex:  # noqa: BLE001
        with conn() as c:
            c.execute("UPDATE env_job SET status='failed', error=?, updated_at=? WHERE job_id=?", (str(ex)[:300], now(), jid))


def job_status(jid: str) -> dict | None:
    with conn() as c:
        j = c.execute("SELECT * FROM env_job WHERE job_id=?", (jid,)).fetchone()
    if not j:
        return None
    out = {"job_id": jid, "status": j["status"], "error": j["error"], "updated_at": j["updated_at"]}
    if j["status"] == "ready":
        pkg = get_cached(j["cache_key"], date.fromisoformat(j["end_date"]))
        if pkg:
            out.update(pkg)
            out["status"] = "ready"
            out["job_id"] = jid
    return out
