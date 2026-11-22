"""AppEEARS point sample (MODIS NDVI, ECOSTRESS LST/ET, VIIRS). Needs Earthdata login. Async task API."""
import httpx
from ..config import EARTHDATA_USERNAME, EARTHDATA_PASSWORD, HTTP_TIMEOUT

BASE = "https://appeears.earthdatacloud.nasa.gov/api"

def _token():
    r = httpx.post(f"{BASE}/login", auth=(EARTHDATA_USERNAME, EARTHDATA_PASSWORD), timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return r.json()["token"]

def submit_point_task(name, lat, lon, start, end, layers):
    """layers: [{"product": "MOD13Q1.061", "layer": "_250m_16_days_NDVI"}]. start/end 'MM-DD-YYYY'."""
    if not EARTHDATA_USERNAME:
        raise RuntimeError("Earthdata credentials not set")
    body = {"task_type": "point", "task_name": name,
            "params": {"dates": [{"startDate": start, "endDate": end}], "layers": layers,
                       "coordinates": [{"latitude": lat, "longitude": lon, "id": name, "category": "field"}]}}
    r = httpx.post(f"{BASE}/task", json=body, headers={"Authorization": f"Bearer {_token()}"}, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return r.json()["task_id"]
