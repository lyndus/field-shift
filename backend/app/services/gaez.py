"""FAO GAEZ v4 - point value via ArcGIS ImageServer Identify.
Layer naming: sxHr_<crop> = suitability index, rainfed, high input (Mosaic Rule by layer name).
VERIFIED at SBA: wheat (whe)=3321, barley (brl)=5540. Others MUST be checked (chickpea returned a stale wheat value)."""
import json
import httpx
from ..config import HTTP_TIMEOUT

IMAGE_SERVER = "https://gaez-services.fao.org/server/rest/services/res05/ImageServer"
VERIFIED = {"sxHr_whe": "wheat", "sxHr_brl": "barley"}

def identify(lat, lon, layer):
    r = httpx.get(f"{IMAGE_SERVER}/identify", params={
        "geometry": json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}}),
        "geometryType": "esriGeometryPoint", "returnGeometry": "false", "returnCatalogItems": "false",
        "mosaicRule": json.dumps({"mosaicMethod": "esriMosaicAttribute",
                                  "where": f"name='{layer}'"}),
        "f": "json"}, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    v = r.json().get("value")
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def suitability_for(lat, lon, crops=("sxHr_whe", "sxHr_brl")):
    out = {}
    for layer in crops:
        try:
            out[layer] = {"value": identify(lat, lon, layer), "verified": layer in VERIFIED}
        except Exception as e:  # network / format issues must never crash the API
            out[layer] = {"value": None, "verified": False, "error": str(e)[:100]}
    return out
