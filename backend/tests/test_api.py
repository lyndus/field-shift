import os, tempfile
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.services import power, soilgrids, gaez

def fake_daily(lat, lon, **k):
    rows, d = [], date(1991, 1, 1)
    while d <= date(2020, 12, 31):
        wet = d.month in (10, 11, 12, 1, 2, 3)
        rows.append({"date": d.strftime("%Y%m%d"), "PRECTOTCORR": 2.0 if wet else 0.2, "T2M": 15, "T2M_MAX": 36 if d.month in (4, 5) else 22,
                     "T2M_MIN": 8, "RH2M": 60, "WS2M": 2.0, "ALLSKY_SFC_SW_DWN": 15.0})
        d += timedelta(days=1)
    return rows

def setup_module():
    power.fetch_daily = fake_daily
    soilgrids.fetch_soil = lambda la, lo: {"clay": 25, "sand": 35, "silt": 40, "soc": 12, "ph": 7.8, "source": "fake"}
    gaez.suitability_for = lambda la, lo, crops=None: {"sxHr_whe": {"value": 3321, "verified": True}}

def test_flow():
    with TestClient(app) as c:
        assert c.get("/health").json() == {"ok": True}
        crops = c.get("/v1/crops").json()["crops"]
        assert any(x["crop_id"] == "chickpea" for x in crops)
        assert crops[0]["traits"]  # traits carry source/grade
        r = c.get("/v1/locations/nearest", params={"lat": 35.2, "lon": -0.65})
        assert r.status_code in (200, 202)
        r = c.get("/v1/locations/nearest", params={"lat": 35.2, "lon": -0.65})  # cached now (background task ran)
        assert r.status_code == 200
        pkg = r.json()
        assert pkg["seasons"] and "NOT a measurement" in pkg["resolution_note"]
        assert pkg["trends"]["rain_mm"]["significant"] is False  # flat series -> never claim a trend
        s = c.get("/v1/suitability", params={"lat": 35.2, "lon": -0.65, "crop": "faba", "last_crop": "wheat"}).json()
        assert s["verdict"] in ("suitable", "suitable_with_adjustments", "high_risk", "not_enough_information")
        assert any(f["flag"] == "broomrape" for f in s["flags"])
        assert c.get("/v1/suitability", params={"lat": 35.2, "lon": -0.65, "crop": "banana"}).status_code == 404
        farm = c.post("/v1/farms", json={"device_id": "abcdef123456", "lat": 35.2, "lon": -0.65, "inputs": {"soil": "clay"}}).json()
        a = c.post(f"/v1/farms/{farm['farm_id']}/attempts", json={"rotation": ["wheat", "chickpea", "barley"], "score": 71})
        assert a.status_code == 201
        assert c.post(f"/v1/farms/{farm['farm_id']}/attempts", json={"rotation": ["banana"]}).status_code == 422
        assert len(c.get(f"/v1/farms/{farm['farm_id']}/attempts").json()) == 1
        assert c.get("/v1/sources").json()["datasets"]

def test_fallback_when_live_fails():
    def boom(*a, **k): raise RuntimeError("down")
    power.fetch_daily = boom
    with TestClient(app) as c:
        r = c.get("/v1/locations/nearest", params={"lat": 35.19, "lon": -0.64})
        # first call may be 202 with fallback; second returns fallback as ready
        r = c.get("/v1/locations/nearest", params={"lat": 35.19, "lon": -0.64})
        assert r.status_code in (200, 202)
