"""Field Shift - download NASA POWER + SoilGrids for a grid over northern Algeria.

Grid: every 0.5 deg, lat 33.5-36.5 N, lon 2.0 W - 8.5 E (154 points, ~ POWER's native cell size).
No login needed (both APIs are open). Safe to stop and re-run: finished points are skipped.

Output:
  data/grid/power/<id>.csv        NASA POWER daily 1995-2025 (same format as power_sba_daily_*.csv)
  data/grid/soilgrids/<id>.json   SoilGrids v2.0 point query (sea points have null values)
  data/grid/grid_points.csv       id, lat, lon
Run:  python fetch_algeria_grid.py
"""
import json, time, threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests

OUT = Path("data/grid")
(OUT / "power").mkdir(parents=True, exist_ok=True)
(OUT / "soilgrids").mkdir(parents=True, exist_ok=True)

LATS = [33.5 + 0.5 * i for i in range(7)]          # 33.5 ... 36.5
LONS = [-2.0 + 0.5 * i for i in range(22)]         # -2.0 ... 8.5
POINTS = [(f"p{la:.1f}_{lo:.1f}".replace("-", "m"), la, lo) for la in LATS for lo in LONS]
POINTS.append(("sba_field", 35.2059, -0.6762))     # Karim's field

with open(OUT / "grid_points.csv", "w") as f:
    f.write("id,lat,lon\n")
    for pid, la, lo in POINTS:
        f.write(f"{pid},{la},{lo}\n")

PARAMS = "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN,GWETROOT,GWETTOP"
lock = threading.Lock()
done = {"power": 0, "soil": 0}


def log(msg):
    with lock:
        print(msg, flush=True)


def power_one(p):
    pid, la, lo = p
    out = OUT / "power" / f"{pid}.csv"
    if out.exists() and out.stat().st_size > 100_000:
        return
    url = ("https://power.larc.nasa.gov/api/temporal/daily/point"
           f"?parameters={PARAMS}&community=AG&longitude={lo}&latitude={la}"
           "&start=19950101&end=20251231&format=CSV")
    for attempt in range(5):
        try:
            r = requests.get(url, timeout=300)
            if r.status_code == 200 and b"-END HEADER-" in r.content:
                out.write_bytes(r.content)
                with lock:
                    done["power"] += 1
                log(f"[POWER] {done['power']}/{len(POINTS)} {pid}")
                return
            log(f"[POWER] {pid} HTTP {r.status_code}, retry {attempt + 1}")
        except Exception as e:
            log(f"[POWER] {pid} {type(e).__name__}, retry {attempt + 1}")
        time.sleep(10 * (attempt + 1))
    log(f"[POWER] FAILED {pid}")


def soil_all():
    props = ["clay", "sand", "silt", "soc", "phh2o", "bdod", "cec", "nitrogen"]
    depths = ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm"]
    for pid, la, lo in POINTS:
        out = OUT / "soilgrids" / f"{pid}.json"
        if out.exists():
            continue
        params = [("lon", lo), ("lat", la), ("value", "mean")]
        params += [("property", p) for p in props] + [("depth", d) for d in depths]
        for attempt in range(5):
            try:
                r = requests.get("https://rest.isric.org/soilgrids/v2.0/properties/query", params=params, timeout=120)
                if r.status_code == 200:
                    out.write_text(r.text)
                    done["soil"] += 1
                    log(f"[SoilGrids] {done['soil']}/{len(POINTS)} {pid}")
                    break
                log(f"[SoilGrids] {pid} HTTP {r.status_code}, retry {attempt + 1}")
            except Exception as e:
                log(f"[SoilGrids] {pid} {type(e).__name__}, retry {attempt + 1}")
            time.sleep(30 * (attempt + 1))
        time.sleep(12)          # SoilGrids fair use: about 5 requests per minute


if __name__ == "__main__":
    t = threading.Thread(target=soil_all)
    t.start()
    with ThreadPoolExecutor(max_workers=4) as ex:   # POWER: 4 at a time
        list(ex.map(power_one, POINTS))
    t.join()
    print("ALL DONE. Zip the folder data/grid and send it.")
