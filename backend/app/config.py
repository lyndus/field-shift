import os
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = os.getenv("DATABASE_PATH", str(ROOT / "fieldshift.db"))
OFFLINE = os.getenv("OFFLINE", "0") == "1"
GRID_STEP = 0.5  # NASA POWER cell is ~0.5 deg (~50 km) -> be honest about it
EARTHDATA_USERNAME = os.getenv("EARTHDATA_USERNAME", "")
EARTHDATA_PASSWORD = os.getenv("EARTHDATA_PASSWORD", "")
OPENTOPOGRAPHY_KEY = os.getenv("OPENTOPOGRAPHY_KEY", "")
CDSAPI_KEY = os.getenv("CDSAPI_KEY", "")
HTTP_TIMEOUT = 60

# ---- NASA POWER (no key needed) -------------------------------------------------
POWER_DAILY_URL = os.getenv("POWER_DAILY_URL", "https://power.larc.nasa.gov/api/temporal/daily/point")
POWER_COMMUNITY = "AG"                       # Agroclimatology community
POWER_EARLIEST = date(1981, 1, 1)            # first day of POWER daily meteorology
POWER_LATENCY_DAYS = int(os.getenv("POWER_LATENCY_DAYS", "7"))
# default analysis window = 30 complete agricultural seasons (Sep 1995 -> Aug 2025), same as the game's bundled data
DEFAULT_START = date.fromisoformat(os.getenv("ENV_DEFAULT_START", "1995-09-01"))
DEFAULT_END = date.fromisoformat(os.getenv("ENV_DEFAULT_END", "2025-08-31"))
MAX_SPAN_YEARS = 45
# cached historical data never changes; ranges that touch the last 120 days are refreshed daily
CACHE_RECENT_DAYS = 120
CACHE_RECENT_TTL_HOURS = 24

# ---- other services ---------------------------------------------------------------
SOILGRIDS_URL = os.getenv("SOILGRIDS_URL", "https://rest.isric.org/soilgrids/v2.0/properties/query")
ELEVATION_URL = os.getenv("ELEVATION_URL", "https://api.open-meteo.com/v1/elevation")   # Copernicus DEM GLO-90
NOMINATIM_URL = os.getenv("NOMINATIM_URL", "https://nominatim.openstreetmap.org")
# Nominatim policy: identify the application; 1 request per second max
USER_AGENT = os.getenv("USER_AGENT", "FieldShift/0.2 (NASA Space Apps 2026; contact via repository)")
