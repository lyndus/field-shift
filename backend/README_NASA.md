# Field Shift API — dynamic NASA environment per farm

Every farm now gets environmental data for **its own coordinates** from NASA POWER (any point on Earth),
instead of one fixed Algerian dataset.

## Run
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000      # docs: http://localhost:8000/docs
pytest -q                                      # 6 tests, offline (real NASA data replayed)
```
Front end: set `window.FS_API_URL` in `index.html` to your deployed API URL.

## Endpoints added / changed
| Method | Path | What |
|---|---|---|
| POST | `/api/farm/environment` | `{farm_id?, latitude, longitude, start_date?, end_date?, place_name?, sync?}` → 200 package (cached or `sync:true`) or 202 `{job_id, poll}` |
| GET | `/api/farm/environment/jobs/{job_id}` | `pending / running / ready (+ package) / failed (+ error)` |
| GET | `/api/farm/{farm_id}/environment` | last package computed for the farm |
| GET | `/api/geocode/search?q=&lang=` · `/api/geocode/reverse?lat=&lon=` | OpenStreetMap Nominatim, server-side, cached, 1 req/s |
| GET | `/v1/farms?device_id=` | list a device's farms (multiple farms) |
| GET/PATCH | `/v1/farms/{id}` | read with location history / rename, move (history, answers and attempts kept) |

Default period: 1995-09-01 → 2025-08-31 (30 complete Sep–Aug seasons, same as the game). Any range from
1981-01-01 to ~7 days ago is accepted; incomplete seasons are reported in `data_quality.excluded_seasons`, never filled.

## Pipeline (app/services)
1. `nasa_power.py` — real GET to `https://power.larc.nasa.gov/api/temporal/daily/point`, community AG, 8 parameters
   (T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT); date-range checks, retries, response-shape and unit checks.
2. `data_processing.py` — duplicate dates, fill value −999 → missing, impossible values → missing, unit normalisation,
   gaps ≤ 5 days interpolated (longer gaps stay missing), completeness report; monthly / seasonal / annual aggregates.
3. `agricultural_indicators.py` — FAO-56 ET0, hot days (Tmax > 31 °C), frost, heavy rain (≥ 20 mm days), sowing-rain onset,
   Theil–Sen + Kendall trends ("significant" only if p < 0.05). Ported from `build_app_data.py`: the parity test shows
   the live pipeline reproduces the bundled Sidi Bel Abbès dataset (monthly values within 1 mm/day, onset exact).
4. `soilgrids.py` (0–100 cm, Saxton & Rawls PAW), `elevation.py` (slope, Copernicus DEM GLO-90), best effort with caveats.
5. `environmental_data.py` — orchestration, cache (`env_cache`, keyed by MERRA-2 cell + point + range), background jobs (`env_job`).

`engine_location` in the response has exactly the shape of one entry of `front/data/app_data.js`, so the game,
engine and NASA report use it unchanged.

## Honesty rules built in
- POWER meteorology is a ~0.5° × 0.625° cell (~50 km): every response says so (`cell.note`).
- Missing data stays missing; incomplete seasons are dropped and listed.
- Non-significant trends come with a caveat; Sep–Aug seasons are flagged south of the equator.
- Soil/slope failures are reported, never guessed; the front end labels any fallback value.

## Production notes
- `BackgroundTasks` runs jobs in the API process; for many users move `run_job` to a queue (RQ/Celery + Redis).
- SQLite is fine for the demo; the schema maps 1:1 to PostgreSQL/PostGIS (see `sql/schema.sql`).
- Nominatim's public server is for light use; self-host or use a commercial geocoder for scale.
