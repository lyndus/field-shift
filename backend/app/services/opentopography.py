"""SRTM elevation/slope via OpenTopography globaldem (needs API key)."""
import httpx
from ..config import OPENTOPOGRAPHY_KEY, HTTP_TIMEOUT

URL = "https://portal.opentopography.org/API/globaldem"

def fetch_dem_ascii(lat, lon, half=0.01):
    if not OPENTOPOGRAPHY_KEY:
        raise RuntimeError("OPENTOPOGRAPHY_KEY not set")
    r = httpx.get(URL, params={"demtype": "SRTMGL1", "south": lat - half, "north": lat + half,
                               "west": lon - half, "east": lon + half, "outputFormat": "AAIGrid",
                               "API_Key": OPENTOPOGRAPHY_KEY}, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    rows = [l.split() for l in r.text.splitlines()[6:] if l.strip()]
    vals = [float(v) for row in rows for v in row if float(v) > -1000]
    return {"elevation_m": sum(vals) / len(vals) if vals else None, "source": "SRTM GL1 via OpenTopography"}
