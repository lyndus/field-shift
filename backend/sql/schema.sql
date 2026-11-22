-- Field Shift schema (SQLite demo version of the plan's PostGIS schema).
-- For PostgreSQL+PostGIS: replace lat/lon with geometry(Point,4326) and TEXT json with JSONB.

CREATE TABLE IF NOT EXISTS grid_cell (
  cell_id      TEXT PRIMARY KEY,          -- e.g. "35.25_-0.75"
  lat          REAL NOT NULL,
  lon          REAL NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | ready | failed
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS season_series (
  cell_id      TEXT NOT NULL,
  season       INTEGER NOT NULL,          -- year the season starts (Sept 1)
  rain_mm      REAL,
  tmax_mean    REAL,
  tmin_mean    REAL,
  et0_mm       REAL,
  onset_doy    INTEGER,                   -- sowing-rain onset day-of-season
  heat_days    INTEGER,                   -- days Tmax >= 35 C in Mar-May
  PRIMARY KEY (cell_id, season)
);

CREATE TABLE IF NOT EXISTS soil_profile (
  cell_id      TEXT PRIMARY KEY,
  clay REAL, sand REAL, silt REAL, soc REAL, ph REAL,
  paw_mm_per_m REAL,                      -- plant-available water (Saxton & Rawls 2006)
  source       TEXT
);

CREATE TABLE IF NOT EXISTS location_summary (
  cell_id      TEXT PRIMARY KEY,
  json         TEXT NOT NULL,             -- full "location package"
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS reference (
  ref_id       TEXT PRIMARY KEY,
  citation     TEXT NOT NULL,
  url          TEXT
);

CREATE TABLE IF NOT EXISTS crop (
  crop_id      TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  name_ar      TEXT,
  kind         TEXT                        -- cereal | legume | oilseed | fodder | fallow
);

CREATE TABLE IF NOT EXISTS crop_trait (
  crop_id      TEXT NOT NULL,
  trait        TEXT NOT NULL,              -- e.g. water_need_mm_min
  value        TEXT,                       -- NULL = "not in our database"
  unit         TEXT,
  ref_id       TEXT,
  locator      TEXT,                       -- page / table / URL fragment
  grade        TEXT NOT NULL DEFAULT 'L',  -- A | B | C | L(ocal, unverified)
  verified_by  TEXT,
  PRIMARY KEY (crop_id, trait)
);

CREATE TABLE IF NOT EXISTS farm (
  farm_id      TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,              -- anonymous
  lat          REAL, lon REAL,
  cell_id      TEXT,
  inputs_json  TEXT,                       -- farmer inputs (soil answers, last crop, water source...)
  created_at   TEXT
);

CREATE TABLE IF NOT EXISTS game_attempt (
  attempt_id   TEXT PRIMARY KEY,
  farm_id      TEXT NOT NULL,
  rotation     TEXT NOT NULL,              -- JSON list of crop_ids by year
  score        REAL,
  details_json TEXT,
  created_at   TEXT
);

CREATE TABLE IF NOT EXISTS decision_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id      TEXT,
  crop_id      TEXT,
  verdict      TEXT,
  flags_json   TEXT,
  created_at   TEXT
);

-- ---------------------------------------------------------------------------
-- Dynamic NASA environment (added). Existing tables above are unchanged; new farm
-- columns (name, env_key, updated_at) are added by app/db.py:migrate() on start-up.

CREATE TABLE IF NOT EXISTS env_cache (
  cache_key    TEXT PRIMARY KEY,            -- POWER cell + point (~1 km) + date range + parameter set
  cell_id      TEXT NOT NULL,               -- MERRA-2 cell, e.g. "m2_250_287"
  lat REAL, lon REAL,
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  json         TEXT NOT NULL,               -- full environment package (engine_location + aggregates + quality)
  fetched_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS env_cache_cell ON env_cache(cell_id);

CREATE TABLE IF NOT EXISTS env_job (
  job_id       TEXT PRIMARY KEY,
  cache_key    TEXT NOT NULL,
  farm_id      TEXT,
  lat REAL, lon REAL,
  start_date   TEXT, end_date TEXT,
  status       TEXT NOT NULL,               -- pending | running | ready | failed
  error        TEXT,
  created_at   TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS farm_location_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id      TEXT NOT NULL,
  lat REAL, lon REAL,
  place_name   TEXT,
  changed_at   TEXT
);
