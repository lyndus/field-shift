"""End-to-end tests for the NASA environment pipeline.

NASA POWER and SoilGrids are replayed from REAL downloads for Sidi Bel Abbes (tests/fixtures), in the exact
JSON shape those APIs return, so the tests run offline. The parity test checks that the live pipeline
reproduces the numbers of the game's bundled dataset (front/data/app_data.js) for the same input.
Run:  pytest -q   (from the backend folder)
"""
import json
import os
import re
from pathlib import Path

import httpx
import pytest
import respx

HERE = Path(__file__).parent
os.environ["DATABASE_PATH"] = str(HERE / "test.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.config import ELEVATION_URL, POWER_DAILY_URL, SOILGRIDS_URL  # noqa: E402
from app.main import app  # noqa: E402

POWER = json.loads((HERE / "fixtures" / "power_sba_daily.json").read_text())
SOIL = json.loads((HERE / "fixtures" / "soilgrids_sba.json").read_text())
BODY = {"latitude": 35.19, "longitude": -0.64, "start_date": "1995-09-01", "end_date": "2025-08-31", "sync": True}


@pytest.fixture(autouse=True)
def fresh_db():
    db = HERE / "test.db"
    if db.exists():
        db.unlink()
    yield


def mock_upstreams(router, power=POWER, power_status=200):
    router.get(POWER_DAILY_URL).mock(return_value=httpx.Response(power_status, json=power))
    router.get(SOILGRIDS_URL).mock(return_value=httpx.Response(200, json=SOIL))
    # elevation fixture: a plane rising 4.4 m per 100 m northwards -> 4.4 % slope (synthetic, test only)
    router.get(ELEVATION_URL).mock(return_value=httpx.Response(200, json={"elevation": [500.0, 504.4, 495.6, 500.0, 500.0]}))


def bundled_sba():
    # the Sidi Bel Abbes record of the game's bundled data/app_data.js (built by build_app_data.py)
    return json.loads((HERE / "fixtures" / "bundled_sba.json").read_text())


def test_parity_with_bundled_dataset():
    with TestClient(app) as c, respx.mock(assert_all_called=False) as r:
        mock_upstreams(r)
        res = c.post("/api/farm/environment", json=BODY)
    assert res.status_code == 200, res.text
    pkg = res.json()
    loc, ref = pkg["engine_location"], bundled_sba()
    assert len(loc["rain"]) == 30 and loc["season_labels"][0] == "1995-96" and loc["season_labels"][-1] == "2024-25"
    for k in ("rain", "et0", "heavy", "hot", "frost"):
        diff = max(abs(a - b) for ra, rb in zip(loc[k], ref[k]) for a, b in zip(ra, rb))
        assert diff <= 1, f"{k} differs from bundled data by {diff}"
    assert loc["onset"] == ref["onset"]
    assert loc["summary"]["rain_oct_may"] == ref["summary"]["rain_oct_may"]
    assert loc["summary"]["driest"] == ref["summary"]["driest"]
    for k in ("onset", "et0", "tmean", "rain"):
        assert loc["trends"][k]["per_decade"] == pytest.approx(ref["trends"][k]["per_decade"], abs=0.05)
        assert loc["trends"][k]["p"] == pytest.approx(ref["trends"][k]["p"], abs=0.01)
    assert loc["trends"]["onset"]["significant"] and not loc["trends"]["rain"]["significant"]
    assert loc["soil"]["paw100"] == ref["soil"]["paw100"] and loc["soil"]["texture"] == ref["soil"]["texture"]
    assert loc["slope"] == pytest.approx(4.4, abs=0.1)
    # metadata & honesty
    assert pkg["source"]["name"] == "NASA POWER" and pkg["source"]["parameters"]["PRECTOTCORR"]["units"] == "mm/day"
    assert pkg["cell"]["note"].startswith("NASA POWER meteorology is a ~0.5")
    assert any("no statistically significant trend" in c for c in pkg["caveats"])
    assert len(pkg["aggregates"]["annual"]) >= 30 and pkg["aggregates"]["monthly"][0]["year"] == 1995


def test_cache_hit_second_call_makes_no_nasa_request():
    with TestClient(app) as c, respx.mock(assert_all_called=False) as r:
        mock_upstreams(r)
        assert c.post("/api/farm/environment", json=BODY).status_code == 200
        calls = r.calls.call_count
        res = c.post("/api/farm/environment", json=BODY)
        assert res.status_code == 200 and res.json()["cache"]["hit"] is True
        assert r.calls.call_count == calls


def test_background_job_then_poll():
    with TestClient(app) as c, respx.mock(assert_all_called=False) as r:
        mock_upstreams(r)
        res = c.post("/api/farm/environment", json={**BODY, "sync": False})
        assert res.status_code == 202
        jid = res.json()["job_id"]
        st = c.get(f"/api/farm/environment/jobs/{jid}").json()   # TestClient runs background tasks before returning
        assert st["status"] == "ready" and st["engine_location"]["rain"]


def test_missing_values_are_not_invented():
    bad = json.loads(json.dumps(POWER))
    rain = bad["properties"]["parameter"]["PRECTOTCORR"]
    keys = sorted(rain)
    for k in keys[100:140]:          # 40-day hole in season 1995-96 (too long to interpolate)
        rain[k] = -999.0
    rain[keys[500]] = -999.0          # 1-day hole: filled
    rain[keys[600]] = 9999.0          # impossible value: rejected
    with TestClient(app) as c, respx.mock(assert_all_called=False) as r:
        mock_upstreams(r, power=bad)
        pkg = c.post("/api/farm/environment", json=BODY).json()
    q = pkg["data_quality"]["parameters"]["PRECTOTCORR"]
    assert q["fill_values"] == 41 and q["out_of_range"] == 1 and q["still_missing"] == 40
    assert pkg["engine_location"]["season_labels"][0] == "1996-97"       # 1995-96 dropped, not filled
    assert any(s["season"] == "1995-96" for s in pkg["data_quality"]["excluded_seasons"])


def test_validation_and_upstream_errors():
    with TestClient(app) as c, respx.mock(assert_all_called=False) as r:
        assert c.post("/api/farm/environment", json={**BODY, "latitude": 95}).status_code == 422
        assert c.post("/api/farm/environment", json={**BODY, "start_date": "1975-01-01"}).status_code == 422
        assert c.post("/api/farm/environment", json={**BODY, "end_date": "2099-01-01"}).status_code == 422
        assert c.post("/api/farm/environment", json={**BODY, "farm_id": "nope"}).status_code == 404
        r.get(POWER_DAILY_URL).mock(return_value=httpx.Response(200, json={"messages": ["bad request"]}))
        res = c.post("/api/farm/environment", json=BODY)
        assert res.status_code == 502 and "NASA POWER" in res.json()["detail"]


def test_farms_multiple_and_location_change_keeps_history():
    with TestClient(app) as c, respx.mock(assert_all_called=False) as r:
        mock_upstreams(r)
        dev = "dev_test_123456"
        a = c.post("/v1/farms", json={"device_id": dev, "lat": 35.19, "lon": -0.64, "name": "Field A", "inputs": {"soil": "clay", "history": ["wheat"]}}).json()
        c.post("/v1/farms", json={"device_id": dev, "lat": 34.85, "lon": 5.73, "name": "Biskra plot"})
        assert len(c.get("/v1/farms", params={"device_id": dev}).json()) == 2
        c.post("/api/farm/environment", json={**BODY, "farm_id": a["farm_id"]})
        assert c.get(f"/api/farm/{a['farm_id']}/environment").status_code == 200
        p = c.patch(f"/v1/farms/{a['farm_id']}", json={"device_id": dev, "lat": 36.19, "lon": 5.41, "place_name": "Setif"}).json()
        assert p["location_changed"] and p["inputs"]["history"] == ["wheat"] and not p["has_environment"]
        full = c.get(f"/v1/farms/{a['farm_id']}").json()
        assert len(full["location_history"]) == 2
        assert c.patch(f"/v1/farms/{a['farm_id']}", json={"device_id": "dev_someone_else", "name": "x"}).status_code == 403
