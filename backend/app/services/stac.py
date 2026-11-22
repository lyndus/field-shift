"""Landsat / Sentinel-2 scene search via public STAC (Earth Search). No key needed for search."""
import httpx
from ..config import HTTP_TIMEOUT

URL = "https://earth-search.aws.element84.com/v1/search"

def search(lat, lon, start, end, collection="sentinel-2-l2a", max_cloud=20, limit=10):
    body = {"collections": [collection], "intersects": {"type": "Point", "coordinates": [lon, lat]},
            "datetime": f"{start}/{end}", "limit": limit, "query": {"eo:cloud_cover": {"lt": max_cloud}}}
    r = httpx.post(URL, json=body, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return [{"id": f["id"], "datetime": f["properties"]["datetime"], "cloud": f["properties"].get("eo:cloud_cover")}
            for f in r.json()["features"]]
