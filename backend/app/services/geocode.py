"""Place search and reverse geocoding through OpenStreetMap Nominatim (server-side, cached, 1 req/s).

Usage policy: https://operations.osmfoundation.org/policies/nominatim/ (identify the app, max 1 request/s, cache results).
"""
import threading
import time
from functools import lru_cache

import httpx

from ..config import HTTP_TIMEOUT, NOMINATIM_URL, USER_AGENT

_lock = threading.Lock()
_last = [0.0]


def _get(path: str, params: dict) -> list | dict:
    with _lock:                                     # respect 1 request per second
        wait = 1.0 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
    r = httpx.get(f"{NOMINATIM_URL}/{path}", params={**params, "format": "jsonv2"},
                  headers={"User-Agent": USER_AGENT}, timeout=HTTP_TIMEOUT / 3)
    r.raise_for_status()
    return r.json()


def _place(d: dict) -> dict:
    a = d.get("address") or {}
    name = d.get("name") or a.get("city") or a.get("town") or a.get("village") or a.get("municipality") or a.get("county") or a.get("state")
    return {"name": name, "display_name": d.get("display_name"), "lat": float(d["lat"]), "lon": float(d["lon"]),
            "country_code": (a.get("country_code") or "").upper() or None, "type": d.get("type"),
            "source": "OpenStreetMap Nominatim"}


@lru_cache(maxsize=512)
def search(q: str, lang: str = "en", limit: int = 5) -> list[dict]:
    q = q.strip()
    if len(q) < 2:
        return []
    res = _get("search", {"q": q, "limit": max(1, min(limit, 10)), "addressdetails": 1, "accept-language": lang})
    return [_place(d) for d in res if "lat" in d]


@lru_cache(maxsize=512)
def reverse(lat: float, lon: float, lang: str = "en") -> dict | None:
    d = _get("reverse", {"lat": round(lat, 5), "lon": round(lon, 5), "zoom": 12, "addressdetails": 1, "accept-language": lang})
    if not isinstance(d, dict) or "lat" not in d:
        return None
    return _place(d)
