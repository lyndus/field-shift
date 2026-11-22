# Field Shift – farmer app (front end)

Mobile-first web app with Ammi Salah, Arabic (MSA) / English, live animated farm and a month-by-month season simulation on real NASA POWER data.

No build step. Open `index.html` in a browser, or publish the folder with GitHub Pages.

Files
- `index.html`, `styles.css`, `app.js` – the app (screens, animations, text in Arabic and English)
- `art.js` – Ammi Salah and the avatars (original SVG artwork)
- `engine.js` – simulation and scoring engine (FAO-56 soil-water model, 10 scores, priorities)
- `data/app_data.js` – NASA POWER + SoilGrids + NASADEM data per location (build with `build_app_data.py`)
- `towns.js` – northern Algeria towns for the location search

To add all of northern Algeria: run `fetch_algeria_grid.py`, then `python build_app_data.py data/grid`, and copy the new `app/data/app_data.js` to `data/app_data.js` here.
