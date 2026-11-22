# Field Shift API (FastAPI)

Backend for the Field Shift crop-rotation app (NASA Space Apps 2026, Sidi Bel Abbès).
Scoring stays in the browser (`engine.js`). This API serves data, crops, and saves farms/attempts.

## Run
```
pip install -r requirements.txt
cp .env.example .env        # optional; POWER/SoilGrids/GAEZ need no keys
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/docs
Demo without internet: `OFFLINE=1 uvicorn app.main:app`

## Endpoints
| Method | Path | What |
|---|---|---|
| GET | /v1/locations/nearest?lat&lon | Location package. 200 = ready, 202 = being built (+ fallback) |
| GET | /v1/locations/{cell_id} | Same, by cell |
| GET | /v1/crops, /v1/crops/{id} | Crops + traits with source and grade (A/B/C/L) |
| GET | /v1/suitability?lat&lon&crop&last_crop | Verdict + flags |
| GET | /v1/sources | Datasets + references |
| POST | /v1/farms | Save a farm (anonymous device_id) |
| POST/GET | /v1/farms/{id}/attempts | Save / list game attempts |

## Honesty rules built in
- POWER cell is ~50 km, not a field measurement (stated in every package).
- A trend is only "significant" if p < 0.05 (SBA rain trend: p = 0.37 -> not significant).
- Unknown crop trait = "not in our database". Never guessed.
- Crop traits are DRAFT grade C (FAO/Ecocrop-style ranges). TEAM MUST VERIFY each row in `app/data/seed.py`.
- GAEZ: only wheat (3321) and barley (5540) verified at SBA. Chickpea/pea layer codes are not verified.
- Live failure -> static fallback (`data/grid/fallback.json`, only SBA for now). Add your 155-point grid there.

## Not finished / needs your keys
IMERG, SMAP, GLDAS, GEDI, AppEEARS, SRTM, ERA5 clients are written but untested (need Earthdata login / API keys,
put them in `.env`). They are not yet wired into the location package; add them to `services/location.py` as worker jobs.
For PostgreSQL+PostGIS, swap `db.py` and adapt `sql/schema.sql` (comments inside).

## Tests
`python -I -m pytest -q`  (network is mocked)

## Test status
Unit + API tests pass (network mocked). The live calls to POWER, SoilGrids and GAEZ were NOT tested
(blocked in the build sandbox). Run once on your laptop: `python -c "from app.services import power; print(len(power.fetch_daily(35.25,-0.75,start=20200101,end=20201231)))"`.
