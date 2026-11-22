"""POST /api/farm/environment -> NASA POWER environmental profile for a farm location.

200 = ready (from cache, or built synchronously when sync=true)
202 = building in the background; poll GET /api/farm/environment/jobs/{job_id}
"""
from datetime import date

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..db import conn, now
from ..services import environmental_data as env
from ..services import nasa_power

router = APIRouter(prefix="/api/farm", tags=["environment"])


class EnvRequest(BaseModel):
    farm_id: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    start_date: date | None = None          # default 1995-09-01 (30 complete Sep-Aug seasons)
    end_date: date | None = None            # default 2025-08-31
    place_name: str | None = Field(default=None, max_length=120)
    sync: bool = False                      # true = build in this request (10-60 s); false = background job


@router.post("/environment")
def farm_environment(req: EnvRequest, background: BackgroundTasks):
    if req.farm_id:
        with conn() as c:
            if not c.execute("SELECT 1 FROM farm WHERE farm_id=?", (req.farm_id,)).fetchone():
                raise HTTPException(404, "farm not found")
    try:
        start, end = env.resolve_range(req.start_date, req.end_date)
        nasa_power.check_request(req.latitude, req.longitude, start, end)
    except ValueError as e:
        raise HTTPException(422, str(e))
    key = env.cache_key(req.latitude, req.longitude, start, end)
    pkg = env.get_cached(key, end)
    if pkg:
        _link_farm(req.farm_id, key)
        if req.place_name:
            pkg["engine_location"]["name"] = req.place_name
        return pkg
    if req.sync:
        try:
            pkg = env.build(req.latitude, req.longitude, start, end, req.place_name)
        except nasa_power.PowerError as e:
            raise HTTPException(502, f"NASA POWER: {e}")
        env.store(key, req.latitude, req.longitude, start, end, pkg)
        _link_farm(req.farm_id, key)
        return pkg
    jid = env.create_job(key, req.farm_id, req.latitude, req.longitude, start, end)
    background.add_task(env.run_job, jid, req.place_name)
    return JSONResponse(status_code=202, content={"status": "pending", "job_id": jid,
                                                  "poll": f"/api/farm/environment/jobs/{jid}", "retry_after_seconds": 3,
                                                  "cell": nasa_power.cell_of(req.latitude, req.longitude)})


@router.get("/environment/jobs/{job_id}")
def job(job_id: str):
    st = env.job_status(job_id)
    if not st:
        raise HTTPException(404, "unknown job")
    code = 200 if st["status"] == "ready" else 500 if st["status"] == "failed" else 202
    return JSONResponse(status_code=code if code != 500 else 200, content=st)


@router.get("/{farm_id}/environment")
def farm_latest(farm_id: str):
    import json
    with conn() as c:
        f = c.execute("SELECT env_key FROM farm WHERE farm_id=?", (farm_id,)).fetchone()
        if not f:
            raise HTTPException(404, "farm not found")
        row = c.execute("SELECT json, fetched_at FROM env_cache WHERE cache_key=?", (f["env_key"],)).fetchone() if f["env_key"] else None
    if not row:
        raise HTTPException(404, "no environment computed for this farm yet")
    pkg = json.loads(row["json"])
    pkg["cache"] = {"hit": True, "fetched_at": row["fetched_at"]}
    return pkg


def _link_farm(farm_id, key):
    if farm_id:
        with conn() as c:
            c.execute("UPDATE farm SET env_key=?, updated_at=? WHERE farm_id=?", (key, now(), farm_id))
