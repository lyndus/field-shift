"""CMR granule search for SMAP / IMERG / GLDAS / GEDI. Search is public; download needs Earthdata login
(use `earthaccess`). This module returns granule links; the worker downloads + extracts the cell value."""
import httpx
from ..config import HTTP_TIMEOUT

CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
PRODUCTS = {
    "smap": "SPL3SMP",       # SMAP L3 soil moisture, v009
    "imerg": "GPM_3IMERGDF", # IMERG daily final
    "gldas": "GLDAS_NOAH025_3H",
    "gedi": "GEDI_L4A_AGB_Density_V2_1",
}

def search(product, lat, lon, start, end, page_size=50):
    r = httpx.get(CMR, params={"short_name": PRODUCTS[product], "point": f"{lon},{lat}",
                               "temporal": f"{start},{end}", "page_size": page_size}, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return [{"id": e.get("id"), "title": e.get("title"), "time_start": e.get("time_start"),
             "links": [l["href"] for l in e.get("links", []) if l.get("href", "").startswith("http")]}
            for e in r.json()["feed"]["entry"]]
