from fastapi import APIRouter, HTTPException
from ..db import conn

router = APIRouter(prefix="/v1", tags=["crops"])

def crop_traits(crop_id):
    with conn() as c:
        rows = c.execute("SELECT t.*, r.citation, r.url FROM crop_trait t LEFT JOIN reference r USING(ref_id) WHERE crop_id=?", (crop_id,)).fetchall()
    return rows

@router.get("/crops")
def list_crops():
    with conn() as c:
        crops = [dict(r) for r in c.execute("SELECT * FROM crop ORDER BY name")]
    for cr in crops:
        cr["traits"] = {}
        for t in crop_traits(cr["crop_id"]):
            cr["traits"][t["trait"]] = {"value": t["value"] if t["value"] is not None else "not in our database",
                                        "unit": t["unit"], "grade": t["grade"], "source": t["citation"],
                                        "locator": t["locator"], "verified": t["verified_by"] is not None}
    return {"crops": crops, "note": "Grade C = general FAO/Ecocrop range, not verified for Algeria."}

@router.get("/crops/{crop_id}")
def one_crop(crop_id: str):
    allc = list_crops()["crops"]
    for c in allc:
        if c["crop_id"] == crop_id:
            return c
    raise HTTPException(404, "crop not in our database")
