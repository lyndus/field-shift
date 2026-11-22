"""Build front/data/wilayas_data.js: one NASA POWER profile per wilaya seat (same pipeline as the API).

    python -m scripts.build_wilayas_data --wilayas ../front/wilayas.js --out ../front/data/wilayas_data.js

Run from the backend folder on a machine with internet. Resumable: profiles already in --out are kept.
Sleeps between requests to stay polite to NASA POWER.
"""
import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import DEFAULT_END, DEFAULT_START  # noqa: E402
from app.services import environmental_data as env  # noqa: E402

ROW = re.compile(r'\[(\d+),\s*"([^"]+)",\s*"([^"]+)",\s*(-?[\d.]+),\s*(-?[\d.]+)\]')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wilayas", default="../front/wilayas.js")
    ap.add_argument("--out", default="../front/data/wilayas_data.js")
    ap.add_argument("--pause", type=float, default=3.0)
    a = ap.parse_args()
    rows = [(int(c), en, ar, float(la), float(lo)) for c, en, ar, la, lo in ROW.findall(Path(a.wilayas).read_text(encoding="utf-8"))]
    out_path = Path(a.out)
    data = {}
    if out_path.exists():
        m = re.search(r"window\.FS_WILAYA_DATA = (\{.*\});", out_path.read_text(encoding="utf-8"), re.S)
        if m:
            data = {int(k): v for k, v in json.loads(m.group(1)).items()}
    for code, en, ar, lat, lon in rows:
        if code in data:
            continue
        for attempt in range(3):
            try:
                pkg = env.build(lat, lon, DEFAULT_START, DEFAULT_END, en)
                loc = pkg["engine_location"]
                data[code] = {**loc, "id": f"wil_{code}", "name": en, "name_ar": ar, "built_at": pkg["fetched_at"],
                              "caveats": pkg["caveats"], "cell": pkg["cell"]["id"]}
                print(f"{code:2d} {en:22s} rain {loc['summary']['rain_mean']} mm, {len(loc['season_labels'])} seasons")
                break
            except Exception as e:  # noqa: BLE001
                print(f"{code:2d} {en}: {e} (attempt {attempt + 1})")
                time.sleep(10 * (attempt + 1))
        write(out_path, data)
        time.sleep(a.pause)
    print(f"{len(data)}/{len(rows)} wilayas in {out_path}")


def write(path, data):
    head = (f"/* NASA POWER profiles per wilaya seat (Field Shift). Built {datetime.now(timezone.utc).isoformat()} by backend/scripts/build_wilayas_data.py.\n"
            "   Source: NASA LaRC POWER daily (AG), ISRIC SoilGrids v2.0, Copernicus DEM via Open-Meteo. Used only when the farm's own point can't be fetched. */\n")
    path.write_text(head + "window.FS_WILAYA_DATA = " + json.dumps({str(k): v for k, v in sorted(data.items())}, ensure_ascii=False) + ";\n", encoding="utf-8")


if __name__ == "__main__":
    main()
