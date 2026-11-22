# Field Shift – عمّي صالح (Ammi Salah)

**NASA Space Apps Challenge 2026** — *Adapting Farms with NASA Data*  
*A mobile-first decision-support web application and backend API empowering farmers across Algeria to simulate crop rotations and withstand climate change using real NASA earth observation data.*

---

## 🌾 Overview

**Field Shift** connects real satellite data directly to farmers on the ground. Through an engaging, interactive narrative guided by **Ammi Salah (عمّي صالح)**, farmers can:
- Explore 30 seasons (1995–2025) of real NASA POWER climate data, SoilGrids v2.0 soil profiles, and NASADEM elevation models.
- Simulate crop rotations (wheat, barley, oat, lentil, chickpea, faba bean, vetch) month-by-month using a FAO-56 dual crop coefficient water-balance model.
- Test tactical farming decisions in an interactive 3D farm simulator powered by Three.js.
- Receive tailored resilience scores and scientific recommendations based on their prioritized farming goals.

---

## 🏗️ Repository Architecture

This mono-repo unites the frontend client and the backend FastAPI service:

```
veto404/
├── frontend/                     # Mobile-first web application (No build step required)
│   ├── index.html                # Entry point
│   ├── app.js                    # UI screens & state management (Arabic/English)
│   ├── api.js                    # Backend API client with offline fallback
│   ├── game.js                   # Farm adventure & levels engine
│   ├── level1_3d.js              # Three.js 3D farm harvest simulation
│   ├── engine.js                 # Agronomic engine (FAO-56 water balance, scoring)
│   ├── art.js                    # Custom SVG character artwork (Ammi Salah)
│   ├── towns.js                  # Northern Algeria municipal dataset
│   ├── styles.css / game.css     # Responsive design (390×844 px phone canvas & desktop frame)
│   ├── server.js                 # Zero-dependency local dev server
│   └── package.json              # Frontend scripts
│
├── backend/                      # FastAPI Python REST API & data pipeline
│   ├── app/                      # Application routes & services
│   │   ├── main.py               # FastAPI entry point & CORS
│   │   ├── routers/              # Endpoints (locations, crops, suitability, farms)
│   │   └── services/             # NASA POWER, SoilGrids, GAEZ, AppEEARS, ERA5
│   ├── sql/schema.sql            # SQLite / PostGIS schema
│   ├── tests/                    # Pytest test suite (100% passing)
│   └── requirements.txt          # Python dependencies
│
├── index.html                    # Root redirect for GitHub Pages deployment
├── package.json                  # Root runner scripts
└── README.md                     # Project documentation
```

---

## 🚀 Quick Start

### 1. Run Frontend
Inside the `frontend/` directory (or from root):
```bash
npm start
# or
npm run dev
```
Open **http://localhost:3030/** in your browser.

### 2. Run Backend API
Inside the `backend/` directory:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Open interactive Swagger documentation at **http://127.0.0.1:8000/docs**.

To run automated backend tests:
```bash
py -3 -m pytest -q
```

---

## 📡 NASA Datasets & Scientific Models

- **NASA POWER:** 30 years (1995–2025) of daily solar radiation, precipitation (PRECTOTCORR), temperature (T2M, T2M_MAX, T2M_MIN), dew point, and wind speed at ~50 km resolution.
- **ISRIC SoilGrids v2.0:** Clay, sand, silt fractions, organic carbon (SOC), pH, and plant-available water capacity (PAW).
- **NASA NASADEM:** 30-meter elevation and topographical slope analysis.
- **FAO-56 Water Balance:** Dynamic soil-water bucket modeling with crop-specific $K_c$ stages, rooting depths, and yield response factors ($K_y$).
- **Statistical Trends:** Theil–Sen slope estimation and Mann–Kendall significance testing ($p < 0.05$).
