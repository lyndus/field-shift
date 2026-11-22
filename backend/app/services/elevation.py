"""Field slope from a digital elevation model (Copernicus DEM GLO-90 via the Open-Meteo elevation API).

Five points (centre + 4 at ~100 m) give the steepest gradient. This is a local estimate at ~90 m resolution;
the game's bundled Sidi Bel Abbes point uses NASA NASADEM 30 m instead (see build_app_data.py).
"""
import math

import httpx

from ..config import ELEVATION_URL, HTTP_TIMEOUT, USER_AGENT

STEP_M = 100.0


def slope_pct(lat, lon, client=None) -> dict | None:
    dlat = STEP_M / 111_320
    dlon = STEP_M / (111_320 * max(0.1, math.cos(math.radians(lat))))
    pts = [(lat, lon), (lat + dlat, lon), (lat - dlat, lon), (lat, lon + dlon), (lat, lon - dlon)]
    own = client is None
    client = client or httpx.Client(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT})
    try:
        r = client.get(ELEVATION_URL, params={"latitude": ",".join(f"{a:.5f}" for a, _ in pts),
                                              "longitude": ",".join(f"{b:.5f}" for _, b in pts)})
        r.raise_for_status()
        z = r.json().get("elevation")
        if not z or len(z) != 5 or any(v is None for v in z):
            return None
        gy = (z[1] - z[2]) / (2 * STEP_M)
        gx = (z[3] - z[4]) / (2 * STEP_M)
        return {"slope_pct": round(math.hypot(gx, gy) * 100, 1), "elevation_m": round(z[0]),
                "source": "Copernicus DEM GLO-90 (via Open-Meteo elevation API)", "resolution_m": 90}
    finally:
        if own:
            client.close()
