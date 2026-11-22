from fastapi import APIRouter, HTTPException, Query

from ..services import geocode

router = APIRouter(prefix="/api/geocode", tags=["geocode"])


@router.get("/search")
def search(q: str = Query(..., min_length=2, max_length=120), lang: str = "en", limit: int = Query(5, ge=1, le=10)):
    try:
        return {"results": geocode.search(q, lang[:5], limit), "attribution": "© OpenStreetMap contributors (Nominatim)"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"geocoding unavailable: {str(e)[:80]}")


@router.get("/reverse")
def reverse(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), lang: str = "en"):
    try:
        return {"result": geocode.reverse(round(lat, 5), round(lon, 5), lang[:5]), "attribution": "© OpenStreetMap contributors (Nominatim)"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"geocoding unavailable: {str(e)[:80]}")
