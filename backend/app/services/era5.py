"""ERA5 via Copernicus CDS (needs CDSAPI_KEY + `pip install cdsapi`). Used only as a gap-filler/cross-check."""
from ..config import CDSAPI_KEY

def request_monthly(lat, lon, year):
    if not CDSAPI_KEY:
        raise RuntimeError("CDSAPI_KEY not set")
    import cdsapi  # lazy import, optional dependency
    c = cdsapi.Client()
    return c.retrieve("reanalysis-era5-single-levels-monthly-means", {
        "product_type": "monthly_averaged_reanalysis", "variable": ["total_precipitation", "2m_temperature"],
        "year": str(year), "month": [f"{m:02d}" for m in range(1, 13)], "time": "00:00",
        "area": [lat + 0.25, lon - 0.25, lat - 0.25, lon + 0.25], "format": "netcdf"})
