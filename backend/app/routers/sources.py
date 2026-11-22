from fastapi import APIRouter
from ..db import conn

router = APIRouter(prefix="/v1", tags=["sources"])

DATASETS = [
    {"name": "NASA POWER", "use": "daily rain, temperature, humidity, wind, radiation -> ET0, trends", "access": "REST, no key", "status": "live"},
    {"name": "SoilGrids (ISRIC)", "use": "clay/sand/silt/SOC/pH -> plant-available water", "access": "REST, no key", "status": "live"},
    {"name": "FAO GAEZ v4", "use": "crop suitability index (wheat, barley verified)", "access": "ArcGIS ImageServer", "status": "live (2 crops verified)"},
    {"name": "GPM IMERG", "use": "rain cross-check vs POWER (0.5x-2x)", "access": "CMR + Earthdata login", "status": "worker (needs login)"},
    {"name": "SMAP SPL3SMP v009", "use": "soil moisture", "access": "CMR + Earthdata login", "status": "worker (needs login)"},
    {"name": "GLDAS", "use": "soil moisture / ET proxy", "access": "CMR + Earthdata login", "status": "worker (needs login)"},
    {"name": "GEDI L4", "use": "biomass context", "access": "CMR + Earthdata login", "status": "worker (needs login)"},
    {"name": "MODIS / VIIRS / ECOSTRESS", "use": "NDVI, land-surface temperature, ET", "access": "AppEEARS API", "status": "worker (needs login)"},
    {"name": "SRTM", "use": "elevation, slope", "access": "OpenTopography (API key)", "status": "needs key"},
    {"name": "Landsat / Sentinel-2", "use": "scene search, NDVI", "access": "public STAC", "status": "search works"},
    {"name": "ERA5", "use": "gap-filler / cross-check", "access": "CDS API key", "status": "needs key"},
]

@router.get("/sources")
def sources():
    with conn() as c:
        refs = [dict(r) for r in c.execute("SELECT * FROM reference")]
    return {"datasets": DATASETS, "references": refs}
