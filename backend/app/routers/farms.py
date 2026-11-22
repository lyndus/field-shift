import json
import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..db import conn, dumps, now
from ..services import location

router = APIRouter(prefix="/v1/farms", tags=["farms"])


class FarmIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=64)   # anonymous random id from the browser
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    name: str | None = Field(default=None, max_length=80)
    place_name: str | None = Field(default=None, max_length=120)
    inputs: dict = {}


class FarmPatch(BaseModel):
    device_id: str = Field(min_length=8, max_length=64)
    name: str | None = Field(default=None, max_length=80)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    place_name: str | None = Field(default=None, max_length=120)
    inputs: dict | None = None             # merged into the existing answers, never replaces history


class AttemptIn(BaseModel):
    rotation: list[str] = Field(min_length=1, max_length=10)
    score: float | None = None
    details: dict = {}


def _out(r):
    return {"farm_id": r["farm_id"], "name": r["name"], "place_name": r["place_name"], "lat": r["lat"], "lon": r["lon"],
            "cell_id": r["cell_id"], "inputs": json.loads(r["inputs_json"] or "{}"), "has_environment": bool(r["env_key"]),
            "created_at": r["created_at"], "updated_at": r["updated_at"]}


@router.post("", status_code=201)
def create_farm(f: FarmIn):
    fid = uuid.uuid4().hex
    cell_id = location.cell_for(f.lat, f.lon)[0]
    with conn() as c:
        c.execute("INSERT INTO farm (farm_id, device_id, lat, lon, cell_id, inputs_json, created_at, name, place_name, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                  (fid, f.device_id, f.lat, f.lon, cell_id, dumps(f.inputs), now(), f.name, f.place_name, now()))
        c.execute("INSERT INTO farm_location_history (farm_id, lat, lon, place_name, changed_at) VALUES (?,?,?,?,?)", (fid, f.lat, f.lon, f.place_name, now()))
    return {"farm_id": fid, "cell_id": cell_id}


@router.get("")
def list_farms(device_id: str = Query(..., min_length=8, max_length=64)):
    with conn() as c:
        rows = c.execute("SELECT * FROM farm WHERE device_id=? ORDER BY created_at", (device_id,)).fetchall()
    return [_out(r) for r in rows]


@router.get("/{farm_id}")
def get_farm(farm_id: str):
    with conn() as c:
        r = c.execute("SELECT * FROM farm WHERE farm_id=?", (farm_id,)).fetchone()
        if not r:
            raise HTTPException(404, "farm not found")
        hist = c.execute("SELECT lat, lon, place_name, changed_at FROM farm_location_history WHERE farm_id=? ORDER BY id", (farm_id,)).fetchall()
    return {**_out(r), "location_history": [dict(h) for h in hist]}


@router.patch("/{farm_id}")
def update_farm(farm_id: str, p: FarmPatch):
    with conn() as c:
        r = c.execute("SELECT * FROM farm WHERE farm_id=?", (farm_id,)).fetchone()
        if not r:
            raise HTTPException(404, "farm not found")
        if r["device_id"] != p.device_id:
            raise HTTPException(403, "this farm belongs to another device")
        if (p.lat is None) != (p.lon is None):
            raise HTTPException(422, "send lat and lon together")
        inputs = json.loads(r["inputs_json"] or "{}")
        if p.inputs:
            inputs.update(p.inputs)
        lat, lon = (p.lat, p.lon) if p.lat is not None else (r["lat"], r["lon"])
        moved = p.lat is not None and (round(p.lat, 5), round(p.lon, 5)) != (round(r["lat"], 5), round(r["lon"], 5))
        c.execute("UPDATE farm SET name=?, place_name=?, lat=?, lon=?, cell_id=?, inputs_json=?, env_key=?, updated_at=? WHERE farm_id=?",
                  (p.name if p.name is not None else r["name"], p.place_name if p.place_name is not None else r["place_name"],
                   lat, lon, location.cell_for(lat, lon)[0], dumps(inputs), None if moved else r["env_key"], now(), farm_id))
        if moved:   # history, soil answers, crop records and attempts are kept; only the environment is recomputed
            c.execute("INSERT INTO farm_location_history (farm_id, lat, lon, place_name, changed_at) VALUES (?,?,?,?,?)", (farm_id, lat, lon, p.place_name, now()))
        r = c.execute("SELECT * FROM farm WHERE farm_id=?", (farm_id,)).fetchone()
    return {**_out(r), "location_changed": moved}


@router.post("/{farm_id}/attempts", status_code=201)
def add_attempt(farm_id: str, a: AttemptIn):
    with conn() as c:
        if not c.execute("SELECT 1 FROM farm WHERE farm_id=?", (farm_id,)).fetchone():
            raise HTTPException(404, "farm not found")
        known = {r["crop_id"] for r in c.execute("SELECT crop_id FROM crop")}
        bad = [x for x in a.rotation if known and x not in known]
        if bad:
            raise HTTPException(422, f"unknown crops: {bad}")
        aid = uuid.uuid4().hex
        c.execute("INSERT INTO game_attempt VALUES (?,?,?,?,?,?)", (aid, farm_id, dumps(a.rotation), a.score, dumps(a.details), now()))
    return {"attempt_id": aid}


@router.get("/{farm_id}/attempts")
def list_attempts(farm_id: str):
    with conn() as c:
        rows = c.execute("SELECT * FROM game_attempt WHERE farm_id=? ORDER BY created_at DESC", (farm_id,)).fetchall()
    return [{"attempt_id": r["attempt_id"], "rotation": json.loads(r["rotation"]), "score": r["score"], "created_at": r["created_at"]} for r in rows]
