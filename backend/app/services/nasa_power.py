"""NASA POWER daily point API client (Agroclimatology community).

Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
Endpoint: GET https://power.larc.nasa.gov/api/temporal/daily/point
No API key is required. One request returns a whole daily series for up to 20 parameters.

Nothing here invents data: a value NASA reports as fill (-999) stays missing, and the caller
decides what to do with incomplete periods.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

import httpx

from ..config import HTTP_TIMEOUT, POWER_COMMUNITY, POWER_DAILY_URL, POWER_EARLIEST, POWER_LATENCY_DAYS

# parameter -> (expected unit as POWER reports it, plausible min, plausible max, meaning)
PARAMETERS: dict[str, tuple[str, float, float, str]] = {
    "T2M": ("C", -70, 60, "Air temperature at 2 m, daily mean"),
    "T2M_MAX": ("C", -70, 65, "Air temperature at 2 m, daily maximum"),
    "T2M_MIN": ("C", -80, 50, "Air temperature at 2 m, daily minimum"),
    "PRECTOTCORR": ("mm/day", 0, 600, "Bias-corrected total precipitation"),
    "RH2M": ("%", 0, 100, "Relative humidity at 2 m"),
    "WS2M": ("m/s", 0, 60, "Wind speed at 2 m"),
    "ALLSKY_SFC_SW_DWN": ("MJ/m^2/day", 0, 45, "All-sky surface shortwave downward irradiance"),
    "GWETROOT": ("1", 0, 1, "Root-zone soil wetness (0 = dry, 1 = saturated)"),
}
FILL_VALUE = -999.0


class PowerError(RuntimeError):
    """NASA POWER could not deliver usable data (network, HTTP, or response shape)."""


@dataclass
class PowerResponse:
    lat: float
    lon: float
    elevation_m: float | None
    start: date
    end: date
    parameters: dict[str, dict]               # name -> {"units", "longname"} as reported by POWER
    daily: dict[str, dict[str, float]]        # name -> {"YYYYMMDD": value}
    fill_value: float = FILL_VALUE
    api_version: str | None = None
    sources: list[str] = field(default_factory=list)
    url: str = POWER_DAILY_URL


def available_range(today: date | None = None) -> tuple[date, date]:
    """Dates NASA POWER daily can serve. Recent days arrive with a lag, so we stop short of today."""
    today = today or date.today()
    return POWER_EARLIEST, today - timedelta(days=POWER_LATENCY_DAYS)


def check_request(lat: float, lon: float, start: date, end: date) -> None:
    if not (-90 <= lat <= 90):
        raise ValueError("latitude must be between -90 and 90")
    if not (-180 <= lon <= 180):
        raise ValueError("longitude must be between -180 and 180")
    lo, hi = available_range()
    if start > end:
        raise ValueError("start_date must be before end_date")
    if start < lo:
        raise ValueError(f"NASA POWER daily data starts on {lo.isoformat()}")
    if end > hi:
        raise ValueError(f"NASA POWER daily data is only available up to about {hi.isoformat()}")


def fetch_daily(lat: float, lon: float, start: date, end: date, params: list[str] | None = None,
                client: httpx.Client | None = None, retries: int = 2) -> PowerResponse:
    """One real HTTP request to NASA POWER (with retries on timeouts and 5xx)."""
    check_request(lat, lon, start, end)
    params = params or list(PARAMETERS)
    if len(params) > 20:
        raise ValueError("NASA POWER allows at most 20 parameters per point request")
    query = {
        "parameters": ",".join(params), "community": POWER_COMMUNITY,
        "latitude": round(lat, 4), "longitude": round(lon, 4),
        "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"), "format": "JSON",
    }
    own = client is None
    client = client or httpx.Client(timeout=HTTP_TIMEOUT * 3)
    last_err: Exception | None = None
    try:
        for attempt in range(retries + 1):
            try:
                r = client.get(POWER_DAILY_URL, params=query)
                if r.status_code == 429:
                    raise PowerError("NASA POWER rate limit reached; try again in a minute")
                if 500 <= r.status_code < 600:
                    raise httpx.HTTPStatusError(f"server error {r.status_code}", request=r.request, response=r)
                if r.status_code >= 400:
                    raise PowerError(f"NASA POWER rejected the request ({r.status_code}): {r.text[:200]}")
                return parse_payload(r.json(), params, start, end)
            except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError) as e:
                last_err = e
                time.sleep(1.5 * (attempt + 1))
        raise PowerError(f"NASA POWER unreachable after {retries + 1} attempts: {last_err}")
    finally:
        if own:
            client.close()


def parse_payload(payload: dict, params: list[str], start: date, end: date) -> PowerResponse:
    """Validate the JSON shape POWER returns and keep its own metadata (units, version, sources)."""
    try:
        props = payload["properties"]["parameter"]
        coords = payload["geometry"]["coordinates"]
    except (KeyError, TypeError) as e:
        raise PowerError(f"unexpected NASA POWER response shape: missing {e}") from e
    missing = [p for p in params if p not in props]
    if missing:
        raise PowerError(f"NASA POWER response lacks parameters {missing}")
    header = payload.get("header", {}) or {}
    meta = payload.get("parameters", {}) or {}
    for p in params:
        if not props[p]:
            raise PowerError(f"NASA POWER returned no values for {p}")
    return PowerResponse(
        lon=float(coords[0]), lat=float(coords[1]),
        elevation_m=float(coords[2]) if len(coords) > 2 and coords[2] is not None else None,
        start=start, end=end,
        parameters={p: {"units": (meta.get(p) or {}).get("units", PARAMETERS.get(p, ("?",))[0]),
                        "longname": (meta.get(p) or {}).get("longname", PARAMETERS.get(p, ("", 0, 0, ""))[3])} for p in params},
        daily={p: props[p] for p in params},
        fill_value=float(header.get("fill_value", FILL_VALUE)),
        api_version=((header.get("api") or {}).get("version") if isinstance(header.get("api"), dict) else None),
        sources=list(header.get("sources", []) or []),
    )


def cell_of(lat: float, lon: float) -> dict:
    """The MERRA-2 cell (0.5 deg lat x 0.625 deg lon) that POWER meteorology comes from."""
    # MERRA-2 grid centres sit at -90 + 0.5*i (lat) and -180 + 0.625*j (lon)
    i = int(round((lat + 90) / 0.5))
    j = int(round((lon + 180) / 0.625)) % 576
    clat, clon = -90 + i * 0.5, -180 + j * 0.625
    return {"id": f"m2_{i}_{j}", "lat": clat, "lon": clon, "lat_min": clat - 0.25, "lat_max": clat + 0.25,
            "lon_min": clon - 0.3125, "lon_max": clon + 0.3125,
            "note": "NASA POWER meteorology is a ~0.5 x 0.625 degree cell (about 50 x 55 km): not a field measurement."}


def yyyymmdd(d: str) -> date:
    return datetime.strptime(d, "%Y%m%d").date()
