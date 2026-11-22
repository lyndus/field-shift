from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import JSONResponse
from ..db import conn
from ..services import location

router = APIRouter(prefix="/v1/locations", tags=["locations"])

@router.get("/nearest")
def nearest(background: BackgroundTasks, lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    status, pkg = location.get_package(lat, lon, background)
    if status == "ready":
        return pkg
    if status == "pending":
        cell_id = location.cell_for(lat, lon)[0]
        return JSONResponse(status_code=202, content={"status": "pending", "cell_id": cell_id,
                            "retry_after_seconds": 20, "fallback": pkg})
    raise HTTPException(503, "No live data and no fallback for this location")

@router.get("/{cell_id}")
def by_id(cell_id: str):
    import json
    with conn() as c:
        row = c.execute("SELECT json FROM location_summary WHERE cell_id=?", (cell_id,)).fetchone()
        g = c.execute("SELECT status FROM grid_cell WHERE cell_id=?", (cell_id,)).fetchone()
    if row:
        return json.loads(row["json"])
    if g:
        return JSONResponse(status_code=202, content={"status": g["status"], "cell_id": cell_id})
    raise HTTPException(404, "unknown cell")
