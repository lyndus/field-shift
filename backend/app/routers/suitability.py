import json
from fastapi import APIRouter, HTTPException, Query
from ..db import conn
from ..services import location, suitability

router = APIRouter(prefix="/v1", tags=["suitability"])

@router.get("/suitability")
def get_suitability(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
                    crop: str = Query(...), last_crop: str | None = None):
    cell_id = location.cell_for(lat, lon)[0]
    with conn() as c:
        row = c.execute("SELECT json FROM location_summary WHERE cell_id=?", (cell_id,)).fetchone()
        t = {r["trait"]: r["value"] for r in c.execute("SELECT trait,value FROM crop_trait WHERE crop_id=?", (crop,))}
        exists = c.execute("SELECT 1 FROM crop WHERE crop_id=?", (crop,)).fetchone()
    if not exists:
        raise HTTPException(404, "crop not in our database")
    if not row:
        raise HTTPException(409, "location not ready yet: call /v1/locations/nearest first")
    t["_id"] = crop
    return {"crop": crop, "cell_id": cell_id, **suitability.evaluate(t, json.loads(row["json"]), last_crop)}
