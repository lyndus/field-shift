/* Field Shift – NASA POWER straight from the browser.
   Used when the Field Shift server can't be reached: the phone itself downloads the daily NASA POWER
   series for the farm (POWER allows browser requests, no key needed) and runs the SAME pipeline as the
   backend (app/services/*.py, ported line for line): clean -999 / impossible values, fill gaps of <= 5 days,
   drop incomplete Sep–Aug seasons, FAO-56 ET0, monthly engine arrays, onset, Theil–Sen + Kendall trends.
   Soil (ISRIC SoilGrids) and slope (Copernicus DEM via Open-Meteo) are best effort, as on the server.
   Every profile built here is kept on the phone (localStorage), so a farm that loaded once keeps working offline. */
(function () {
  "use strict";
  const POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
  const SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query";
  const ELEV_URL = "https://api.open-meteo.com/v1/elevation";
  const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
  const DEFAULT_START = "1995-09-01", DEFAULT_END = "2025-08-31";
  const PARAMS = { // name -> [unit, min, max]
    T2M: ["C", -70, 60], T2M_MAX: ["C", -70, 65], T2M_MIN: ["C", -80, 50], PRECTOTCORR: ["mm/day", 0, 600],
    RH2M: ["%", 0, 100], WS2M: ["m/s", 0, 60], ALLSKY_SFC_SW_DWN: ["MJ/m^2/day", 0, 45], GWETROOT: ["1", 0, 1],
  };
  const UNIT_FIX = { "ALLSKY_SFC_SW_DWN|kW-hr/m^2/day": 3.6, "PRECTOTCORR|mm day-1": 1 };
  const CORE = ["PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN"];
  const ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
  const MAX_GAP = 5, MIN_SEASON_DAYS = 330;
  const CACHE_PREFIX = "fs_env_v2_";

  // ---------------------------------------------------------------- small numeric helpers (Python semantics)
  const isN = (v) => typeof v === "number" && !Number.isNaN(v);
  function pyRound(x, n = 0) { // Python round(): correctly rounded on the exact binary value, exact ties to even
    if (x == null || !Number.isFinite(x)) return null;
    let r;
    if (n === 0) { const f = Math.floor(x); r = x - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Number(x.toFixed(0)); }
    else r = Number(x.toFixed(n)); // toFixed works on the exact value, like Python
    return Object.is(r, -0) ? 0 : r;
  }
  const nansum = (a) => { let s = 0; for (const v of a) if (isN(v)) s += v; return s; };
  const nanmean = (a) => { let s = 0, n = 0; for (const v of a) if (isN(v)) { s += v; n++; } return n ? s / n : NaN; };
  const countIf = (a, f) => { let n = 0; for (const v of a) if (isN(v) && f(v)) n++; return n; };
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const erfc = (x) => { // Numerical Recipes erfc, |err| < 1.2e-7
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  };
  const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };

  // ---------------------------------------------------------------- dates
  const parseKey = (k) => { if (!/^\d{8}$/.test(k)) return null; const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8))); return Number.isNaN(+d) ? null : d; };
  const isoToDate = (s) => new Date(s + "T00:00:00Z");
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const doyOf = (d) => Math.round((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1;

  function cellOf(lat, lon) { // MERRA-2 cell (0.5° x 0.625°), centre-based like the backend
    const i = Math.round((lat + 90) / 0.5), j = ((Math.round((lon + 180) / 0.625) % 576) + 576) % 576;
    const clat = -90 + i * 0.5, clon = -180 + j * 0.625;
    return { id: `m2_${i}_${j}`, lat: clat, lon: clon, lat_min: clat - 0.25, lat_max: clat + 0.25, lon_min: clon - 0.3125, lon_max: clon + 0.3125,
      note: "NASA POWER meteorology is a ~0.5 x 0.625 degree cell (about 50 x 55 km): not a field measurement." };
  }
  function availableEnd() { const d = new Date(); d.setUTCDate(d.getUTCDate() - 7); return d; }
  function resolveRange(start, end) {
    let s = isoToDate(start || DEFAULT_START), e = isoToDate(end || DEFAULT_END);
    const hi = availableEnd();
    if (e > hi) { // keep whole Sep–Aug seasons ending before the POWER lag
      const y = hi.getUTCMonth() >= 7 && hi.getUTCDate() >= 31 ? hi.getUTCFullYear() : hi.getUTCFullYear() - 1;
      e = isoToDate(`${y}-08-31`); s = isoToDate(`${y - 30}-09-01`);
    }
    if (s < isoToDate("1981-01-01")) s = isoToDate("1981-01-01");
    if (s >= e) throw new Error("start date must be before end date");
    return [s, e];
  }

  // ---------------------------------------------------------------- 1. clean & normalise
  function fillShortGaps(v, limit) {
    let filled = 0, i = 0; const n = v.length;
    while (i < n) {
      if (!isN(v[i])) {
        let j = i; while (j < n && !isN(v[j])) j++;
        const run = j - i;
        if (i > 0 && j < n && run <= limit) { const a = v[i - 1], b = v[j]; for (let k = 0; k < run; k++) v[i + k] = a + (b - a) * (k + 1) / (run + 1); filled += run; }
        i = j;
      } else i++;
    }
    return filled;
  }
  function normalize(payload, start, end) {
    let props, coords;
    try { props = payload.properties.parameter; coords = payload.geometry.coordinates; } catch (e) { throw new Error("unexpected NASA POWER response shape"); }
    if (!props || !coords) throw new Error("unexpected NASA POWER response shape");
    const names = Object.keys(PARAMS);
    const missing = names.filter((p) => !props[p] || !Object.keys(props[p]).length);
    if (missing.length) throw new Error("NASA POWER response lacks " + missing.join(", "));
    const header = payload.header || {}, meta = payload.parameters || {};
    const fill = Number(header.fill_value != null ? header.fill_value : -999);
    const report = { parameters: {}, duplicate_dates: 0, unparseable_dates: 0, unit_conversions: [] };
    const seen = new Map();
    for (const key of Object.keys(props[names[0]])) {
      const d = parseKey(key); if (!d) { report.unparseable_dates++; continue; }
      if (seen.has(+d)) { report.duplicate_dates++; continue; }
      seen.set(+d, key);
    }
    const stamps = [...seen.keys()].sort((a, b) => a - b), dates = stamps.map((t) => new Date(t));
    report.days_expected = Math.round((end - start) / 864e5) + 1;
    report.days_received = dates.length;
    const cols = {};
    for (const p of names) {
      const [expU, lo, hi] = PARAMS[p], unit = (meta[p] && meta[p].units) || "";
      let factor = 1;
      if (unit && unit !== expU) {
        factor = UNIT_FIX[p + "|" + unit];
        if (factor == null) throw new Error(`${p}: unexpected unit '${unit}' (expected '${expU}')`);
        report.unit_conversions.push({ parameter: p, from: unit, to: expU, factor });
      }
      const raw = props[p], v = new Array(dates.length);
      let nFill = 0, nBad = 0;
      for (let i = 0; i < dates.length; i++) {
        let x = raw[seen.get(stamps[i])];
        x = x == null ? NaN : Number(x);
        if (isN(x) && x <= fill + 1e-6) { nFill++; x = NaN; }
        if (isN(x)) x *= factor;
        if (isN(x)) {
          if (p === "PRECTOTCORR" && x < 0 && x > -0.5) x = 0; // bias-correction noise
          else if (x < lo || x > hi) { nBad++; x = NaN; }
        }
        v[i] = x;
      }
      const nFilled = fillShortGaps(v, MAX_GAP), still = v.filter((x) => !isN(x)).length;
      report.parameters[p] = { units: expU, fill_values: nFill, out_of_range: nBad, gap_filled: nFilled, still_missing: still,
        completeness: v.length ? pyRound(1 - still / v.length, 4) : 0 };
      cols[p] = v;
    }
    const elev = coords.length > 2 && coords[2] != null ? Number(coords[2]) : null;
    return { dates, cols, report, elev, pLon: Number(coords[0]), pLat: Number(coords[1]), sources: header.sources || [], api_version: header.api && header.api.version };
  }

  // ---------------------------------------------------------------- 2. indicators
  function et0Daily(D, lat, elev) {
    const { T2M: t, T2M_MAX: tx, T2M_MIN: tn, RH2M: rh, WS2M: u2, ALLSKY_SFC_SW_DWN: rs } = D.cols;
    const phi = lat * Math.PI / 180, out = new Array(D.dates.length);
    const gamma = 0.000665 * 101.3 * ((293 - 0.0065 * elev) / 293) ** 5.26;
    for (let i = 0; i < out.length; i++) {
      const J = doyOf(D.dates[i]);
      const dr = 1 + 0.033 * Math.cos(2 * Math.PI * J / 365), dec = 0.409 * Math.sin(2 * Math.PI * J / 365 - 1.39);
      const ws = Math.acos(Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(dec))));
      const ra = 24 * 60 / Math.PI * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
      const rso = (0.75 + 2e-5 * elev) * ra;
      const es = (0.6108 * Math.exp(17.27 * tx[i] / (tx[i] + 237.3)) + 0.6108 * Math.exp(17.27 * tn[i] / (tn[i] + 237.3))) / 2;
      const ea = rh[i] / 100 * es;
      const rnl = 4.903e-9 * (((tx[i] + 273.16) ** 4 + (tn[i] + 273.16) ** 4) / 2) * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * Math.min(1, Math.max(0, rs[i] / rso)) - 0.35);
      const rn = 0.77 * rs[i] - rnl;
      const delta = 4098 * (0.6108 * Math.exp(17.27 * t[i] / (t[i] + 237.3))) / (t[i] + 237.3) ** 2;
      const e = (0.408 * delta * rn + gamma * 900 / (t[i] + 273) * u2[i] * (es - ea)) / (delta + gamma * (1 + 0.34 * u2[i]));
      out[i] = isN(e) ? Math.max(0, e) : NaN;
    }
    return out;
  }
  function onsetIndex(r) {
    for (let i = 2; i < r.length; i++) { const a = r[i - 2], b = r[i - 1], c = r[i]; if (isN(a) && isN(b) && isN(c) && a + b + c >= 20) return i; }
    return null;
  }
  function kendallP(x, y) { // scipy.stats.kendalltau (tau-b, method="auto", two-sided)
    const n = x.length, tot = n * (n - 1) / 2;
    let dis = 0, conc = 0, xtie = 0, ytie = 0, ntie = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = Math.sign(x[j] - x[i]), dy = Math.sign(y[j] - y[i]);
      if (dx === 0 && dy === 0) { ntie++; xtie++; ytie++; } else if (dx === 0) xtie++; else if (dy === 0) ytie++; else if (dx === dy) conc++; else dis++;
    }
    if (xtie === tot || ytie === tot) return NaN;
    const cmd = tot - xtie - ytie + ntie - 2 * dis;
    if (xtie === 0 && ytie === 0 && (n <= 33 || Math.min(dis, tot - dis) <= 1)) { // exact (Kendall 1970)
      const c = Math.min(tot - dis, dis);
      let prob;
      if (n <= 2) prob = 1;
      else if (c === 0) prob = 2 / fact(n);
      else if (c === 1) prob = 2 / fact(n - 1);
      else if (4 * c === n * (n - 1)) prob = 1;
      else {
        let nw = new Array(c + 1).fill(0); nw[0] = 1; nw[1] = 1;
        for (let j = 3; j <= n; j++) {
          const cs = new Array(c + 1); let acc = 0; for (let k = 0; k <= c; k++) { acc += nw[k]; cs[k] = acc; }
          if (j <= c) { const old = cs.slice(); for (let k = j; k <= c; k++) cs[k] -= old[k - j]; }
          nw = cs;
        }
        prob = 2 * nansum(nw) / fact(n);
      }
      return Math.min(1, Math.max(0, prob));
    }
    const tieStats = (a) => { const m = new Map(); a.forEach((v) => m.set(v, (m.get(v) || 0) + 1)); let t0 = 0, t1 = 0; m.forEach((c) => { if (c > 1) { t0 += c * (c - 1) * (c - 2); t1 += c * (c - 1) * (2 * c + 5); } }); return [t0, t1]; };
    const [x0, x1] = tieStats(x), [y0, y1] = tieStats(y), m = n * (n - 1);
    const v = (m * (2 * n + 5) - x1 - y1) / 18 + (2 * xtie * ytie) / m + x0 * y0 / (9 * m * (n - 2));
    return erfc(Math.abs(cmd / Math.sqrt(v)) / Math.SQRT2);
  }
  function theilSen(x, y) { const s = []; for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) if (x[j] !== x[i]) s.push((y[j] - y[i]) / (x[j] - x[i])); return median(s); }
  function trend(years, vals) {
    const v = vals.map((x) => (x == null ? NaN : x)), okI = v.map((x, i) => (isN(x) ? i : -1)).filter((i) => i >= 0);
    if (okI.length < 8) return null;
    const k = Math.max(3, Math.min(10, Math.floor(years.length / 3)));
    const xs = okI.map((i) => years[i]), ys = okI.map((i) => v[i]);
    const sl = theilSen(xs, ys), p = kendallP(xs, ys);
    return { early: pyRound(nanmean(v.slice(0, k)), 1), late: pyRound(nanmean(v.slice(-k)), 1),
      early_period: `${years[0]}-${years[k - 1]}`, late_period: `${years[years.length - k]}-${years[years.length - 1]}`,
      per_decade: pyRound(sl * 10, 2), p: pyRound(p, 3), significant: p < 0.05, n: okI.length };
  }
  const label = (s) => `${s}-${String(s + 1).slice(-2)}`;
  function engineBlock(D, et0) {
    const n = D.dates.length, months = D.dates.map((d) => d.getUTCMonth() + 1), years = D.dates.map((d) => d.getUTCFullYear());
    const seas = months.map((m, i) => (m >= 9 ? years[i] : years[i] - 1));
    const idx = new Map(); seas.forEach((s, i) => { if (!idx.has(s)) idx.set(s, []); idx.get(s).push(i); });
    const comp = new Map();
    [...idx.keys()].sort((a, b) => a - b).forEach((s) => {
      const I = idx.get(s); let valid = 0;
      I.forEach((i) => { if (CORE.every((p) => isN(D.cols[p][i]))) valid++; });
      const ms = new Set(I.map((i) => months[i])).size;
      comp.set(s, { days: I.length, valid_days: valid, months: ms, complete: valid >= MIN_SEASON_DAYS && ms === 12 });
    });
    const use = [...comp.keys()].filter((s) => comp.get(s).complete);
    const excluded = [...comp.keys()].filter((s) => !comp.get(s).complete).map((s) => ({ season: label(s), ...comp.get(s) }));
    const { PRECTOTCORR: rain, T2M_MAX: tx, T2M_MIN: tn, T2M: t, GWETROOT: gw } = D.cols;
    const out = { rain: [], et0: [], heavy: [], hot: [], frost: [], tx: [], gw: [] };
    const onset = [], tmean = [], rainOM = [], et0OM = [], aut = [], hotfl = [], frostTot = [];
    for (const s of use) {
      const I = idx.get(s), pick = (a, f) => I.filter((i) => f(months[i])).map((i) => a[i]);
      const row = { rain: [], et0: [], heavy: [], hot: [], frost: [], tx: [], gw: [] };
      for (const M of ORDER) {
        const is = (m) => m === M, r = pick(rain, is), g = pick(gw, is);
        row.rain.push(pyRound(nansum(r))); row.et0.push(pyRound(nansum(pick(et0, is))));
        row.heavy.push(pyRound(nansum(r.map((v) => (v >= 20 ? v : 0)))));
        row.hot.push(countIf(pick(tx, is), (v) => v > 31)); row.frost.push(countIf(pick(tn, is), (v) => v < 0));
        row.tx.push(pyRound(nanmean(pick(tx, is)), 1));
        row.gw.push(g.some(isN) ? pyRound(nanmean(g), 3) : null);
      }
      Object.keys(out).forEach((k) => out[k].push(row[k]));
      onset.push(onsetIndex(I.map((i) => rain[i])));
      const grow = (m) => m >= 10 || m <= 5;
      rainOM.push(nansum(pick(rain, grow))); et0OM.push(nansum(pick(et0, grow))); tmean.push(nanmean(I.map((i) => t[i])));
      aut.push(nansum(pick(rain, (m) => m >= 9 && m <= 11)));
      hotfl.push(countIf(pick(tx, (m) => m === 4 || m === 5), (v) => v > 31)); frostTot.push(countIf(I.map((i) => tn[i]), (v) => v < 0));
    }
    const trends = {};
    if (use.length) [["rain", rainOM], ["autumn_rain", aut], ["et0", et0OM], ["onset", onset], ["tmean", tmean], ["hot_flowering", hotfl], ["frost", frostTot]]
      .forEach(([k, v]) => { trends[k] = trend(use, v); });
    const driest = rainOM.length >= 3 ? rainOM.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 3).map((x) => x[1]).sort((a, b) => a - b) : [];
    return { ...out, onset, trends, summary: { rain_oct_may: rainOM.map((v) => pyRound(v)), driest, rain_mean: rainOM.length ? pyRound(rainOM.reduce((a, b) => a + b, 0) / rainOM.length) : null },
      season_labels: use.map(label), excluded_seasons: excluded };
  }

  // ---------------------------------------------------------------- soil & slope (best effort, never invented)
  const DEPTHS = { "0-5cm": 5, "5-15cm": 10, "15-30cm": 15, "30-60cm": 30, "60-100cm": 40 };
  const SPROPS = { clay: "clay", sand: "sand", silt: "silt", soc: "soc", phh2o: "ph", cec: "cec" };
  function usdaTexture(sand, silt, clay) {
    if (clay >= 40) return silt < 40 && sand <= 45 ? "clay" : (silt >= 40 ? "silty clay" : "sandy clay");
    if (clay >= 27) return sand <= 20 ? "silty clay loam" : (sand <= 45 ? "clay loam" : "sandy clay loam");
    if (clay >= 20 && sand > 45 && silt < 28) return "sandy clay loam";
    if (silt >= 80 && clay < 12) return "silt";
    if (silt >= 50) return "silt loam";
    if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam";
    if (sand >= 85) return "sand";
    if (sand >= 70) return "loamy sand";
    return "sandy loam";
  }
  function soilFromPayload(j) {
    const layers = {};
    for (const layer of (j.properties && j.properties.layers) || []) {
      const nm = SPROPS[layer.name]; if (!nm) continue;
      const f = (layer.unit_measure && layer.unit_measure.d_factor) || 10;
      for (const d of layer.depths) { const v = d.values && d.values.mean; (layers[d.label] = layers[d.label] || {})[nm] = v == null ? null : v / f; }
    }
    let paw = 0; const prof = [];
    for (const [d, th] of Object.entries(DEPTHS)) {
      const L = layers[d]; if (!L || L.clay == null || L.sand == null || L.soc == null) return null;
      const S = L.sand / 100, C = L.clay / 100, OM = Math.min(L.soc * 1.724 / 10, 8);
      const t15 = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031, wp = t15 + (0.14 * t15 - 0.02);
      const t33 = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299, fc = t33 + (1.283 * t33 ** 2 - 0.374 * t33 - 0.015);
      const aw = Math.max(fc - wp, 0) * th * 10; paw += aw; prof.push(pyRound(aw, 1));
    }
    const top = layers["0-5cm"];
    return { texture: usdaTexture(top.sand, top.silt, top.clay), paw100: pyRound(paw), paw_layers: prof, clay: pyRound(top.clay), sand: pyRound(top.sand), silt: pyRound(top.silt),
      soc: pyRound(top.soc, 1), ph: top.ph != null ? pyRound(top.ph, 1) : null, cec: top.cec != null ? pyRound(top.cec, 1) : null,
      source: "ISRIC SoilGrids v2.0 (250 m)", method: "Saxton & Rawls 2006" };
  }
  const tmo = (ms) => (window.AbortSignal && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
  async function getJSON(url, ms) { const r = await fetch(url, { signal: tmo(ms) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
  async function fetchSoil(lat, lon) {
    const q = new URLSearchParams([["lat", lat.toFixed(5)], ["lon", lon.toFixed(5)], ["value", "mean"], ...Object.keys(SPROPS).map((p) => ["property", p]), ...Object.keys(DEPTHS).map((d) => ["depth", d])]);
    return soilFromPayload(await getJSON(`${SOIL_URL}?${q}`, 25000));
  }
  async function fetchSlope(lat, lon) {
    const step = 100, dlat = step / 111320, dlon = step / (111320 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
    const pts = [[lat, lon], [lat + dlat, lon], [lat - dlat, lon], [lat, lon + dlon], [lat, lon - dlon]];
    const j = await getJSON(`${ELEV_URL}?latitude=${pts.map((p) => p[0].toFixed(5)).join(",")}&longitude=${pts.map((p) => p[1].toFixed(5)).join(",")}`, 12000);
    const z = j.elevation; if (!z || z.length !== 5 || z.some((v) => v == null)) return null;
    const gy = (z[1] - z[2]) / (2 * step), gx = (z[3] - z[4]) / (2 * step);
    return { slope_pct: pyRound(Math.hypot(gx, gy) * 100, 1), elevation_m: pyRound(z[0]), source: "Copernicus DEM GLO-90 (via Open-Meteo elevation API)", resolution_m: 90 };
  }
  async function reverseName(lat, lon, lang) {
    try {
      const j = await getJSON(`${NOMINATIM}?format=jsonv2&zoom=10&accept-language=${lang || "en"}&lat=${lat}&lon=${lon}`, 8000);
      const a = j.address || {};
      const place = a.city || a.town || a.village || a.municipality || a.county || a.state_district;
      return [place, a.state, a.country].filter(Boolean).slice(0, 2).join(", ") || null;
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- the package (same shape as POST /api/farm/environment)
  function packageFrom(payload, lat, lon, start, end, name, extras = {}) {
    const D = normalize(payload, start, end);
    const caveats = [];
    const elev = D.elev != null ? D.elev : 0;
    if (D.elev == null) caveats.push("NASA POWER returned no cell elevation; ET0 uses sea-level pressure");
    const et0 = et0Daily(D, lat, elev), eng = engineBlock(D, et0);
    if (!eng.season_labels.length) throw new Error("no complete agricultural season (Sep–Aug) in the NASA record");
    if (eng.excluded_seasons.length) caveats.push(`${eng.excluded_seasons.length} incomplete season(s) left out, not filled in`);
    Object.entries(eng.trends).forEach(([k, t]) => { if (t && !t.significant) caveats.push(`${k}: no statistically significant trend (p=${t.p}); do not call it a change`); });
    if (lat < 0) caveats.push("Seasons run Sep–Aug (Northern Hemisphere winter cropping); interpret with care south of the equator");
    const soil = extras.soil || null, slope = extras.slope || null;
    (extras.caveats || []).forEach((c) => caveats.push(c));
    const cell = cellOf(lat, lon), period = `${eng.season_labels[0]} to ${eng.season_labels[eng.season_labels.length - 1]}`;
    const engine_location = {
      id: `live_${cell.id}_${pyRound(lat, 2)}_${pyRound(lon, 2)}`, name, lat: pyRound(lat, 4), lon: pyRound(lon, 4), elev: pyRound(elev),
      rain: eng.rain, et0: eng.et0, heavy: eng.heavy, hot: eng.hot, frost: eng.frost, tx: eng.tx, gw: eng.gw, onset: eng.onset, trends: eng.trends, summary: eng.summary,
      soil, slope: slope ? slope.slope_pct : null, slope_source: slope ? slope.source : null, gaez_wheat: null,
      season_labels: eng.season_labels, period_label: period, live: true,
    };
    return {
      schema_version: 2, status: "ready", built_by: "browser",
      request: { latitude: lat, longitude: lon, start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) },
      cell, source: { name: "NASA POWER", community: "AG (Agroclimatology)", endpoint: POWER_URL, api_version: D.api_version || null, upstream_sources: D.sources,
        citation: "NASA Langley Research Center POWER Project, funded through the NASA Earth Science Applied Science Program" },
      period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), seasons: eng.season_labels, label: period },
      data_quality: { ...D.report, excluded_seasons: eng.excluded_seasons },
      soil, slope, engine_location, caveats, fetched_at: new Date().toISOString(), cache: { hit: false },
    };
  }

  // ---------------------------------------------------------------- phone cache (so a farm keeps working offline)
  function cacheKey(lat, lon, s, e) { return `${CACHE_PREFIX}${cellOf(lat, lon).id}_${pyRound(lat, 2)}_${pyRound(lon, 2)}_${ymd(s)}_${ymd(e)}`; }
  function cacheGet(key) { try { const t = localStorage.getItem(key); if (!t) return null; const p = JSON.parse(t); p.cache = { hit: true, fetched_at: p.fetched_at }; return p; } catch (e) { return null; } }
  function cachePut(key, pkg) {
    const slim = { ...pkg, data_quality: { excluded_seasons: pkg.data_quality.excluded_seasons } };
    for (let tries = 0; tries < 6; tries++) {
      try { localStorage.setItem(key, JSON.stringify(slim)); return true; } catch (e) { // full: drop the oldest saved profile
        const old = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => { try { return [k, JSON.parse(localStorage.getItem(k)).fetched_at || ""]; } catch (x) { return [k, ""]; } }).sort((a, b) => (a[1] < b[1] ? -1 : 1));
        if (!old.length) return false; localStorage.removeItem(old[0][0]);
      }
    }
    return false;
  }
  /** Saved profiles whose NASA cell is the same as this point's (same weather data), nearest first. */
  function cachedSameCell(lat, lon) {
    const id = cellOf(lat, lon).id, out = [];
    try { Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX + id + "_") && !k.endsWith("_era5")).forEach((k) => { const p = cacheGet(k); if (p) out.push(p); }); } catch (e) { }
    return out;
  }

  async function fetchPower(lat, lon, s, e, retries = 2) {
    const q = new URLSearchParams({ parameters: Object.keys(PARAMS).join(","), community: "AG", latitude: lat.toFixed(4), longitude: lon.toFixed(4), start: ymd(s), end: ymd(e), format: "JSON" });
    let last;
    for (let a = 0; a <= retries; a++) {
      try {
        const r = await fetch(`${POWER_URL}?${q}`, { signal: tmo(90000) });
        if (r.status === 429) throw Object.assign(new Error("NASA POWER is busy (rate limit); try again in a minute"), { fatal: true });
        if (r.status >= 400 && r.status < 500) { let t = ""; try { t = (await r.text()).slice(0, 160); } catch (x) { } throw Object.assign(new Error(`NASA POWER rejected the request (${r.status}) ${t}`), { fatal: true }); }
        if (!r.ok) throw new Error(`NASA POWER server error ${r.status}`);
        return await r.json();
      } catch (err) { last = err; if (err.fatal) break; await new Promise((res) => setTimeout(res, 1500 * (a + 1))); }
    }
    throw new Error(last && last.name === "TypeError" ? "no internet connection to NASA POWER" : (last && last.message) || "NASA POWER unreachable");
  }

  /** Build the farm environment in the browser. onProgress: "requesting" | "running" | "soil" | "ready". */
  async function build(lat, lon, opts = {}) {
    const [s, e] = resolveRange(opts.start, opts.end), key = cacheKey(lat, lon, s, e);
    const hit = !opts.noCache && cacheGet(key);
    if (hit) { opts.onProgress && opts.onProgress("ready"); return hit; }
    opts.onProgress && opts.onProgress("requesting");
    const extrasP = Promise.allSettled([fetchSoil(lat, lon), fetchSlope(lat, lon)]); // in parallel with NASA
    const payload = await fetchPower(lat, lon, s, e);
    opts.onProgress && opts.onProgress("running");
    await new Promise((r) => setTimeout(r, 30)); // let the UI paint
    opts.onProgress && opts.onProgress("soil");
    const [so, sl] = await extrasP, caveats = [];
    if (so.status === "rejected") caveats.push(`soil unavailable right now (SoilGrids: ${String(so.reason && so.reason.message).slice(0, 60)}); the game uses the farmer's own soil answer`);
    else if (so.value == null) caveats.push("SoilGrids has no soil data at this point (water, urban or masked area)");
    if (sl.status === "rejected") caveats.push("slope unavailable; the game uses a default 3.5% and says so");
    const pkg = packageFrom(payload, lat, lon, s, e, opts.name || null, { soil: so.status === "fulfilled" ? so.value : null, slope: sl.status === "fulfilled" ? sl.value : null, caveats });
    cachePut(key, pkg);
    opts.onProgress && opts.onProgress("ready");
    return pkg;
  }


  // ---------------------------------------------------------------- last-resort backup: ERA5 reanalysis (NOT NASA)
  // Only when NASA POWER itself can't be reached from this phone. Open-Meteo serves ECMWF ERA5 daily values from any
  // browser; we reshape them like a POWER response (wind 10 m -> 2 m with the FAO-56 log law, soil wetness left
  // missing) and run the identical pipeline. The package is labelled ERA5 everywhere it is shown.
  const ERA5_URL = "https://archive-api.open-meteo.com/v1/archive";
  function era5ToPowerShape(j) {
    const d = j.daily, P = { T2M: {}, T2M_MAX: {}, T2M_MIN: {}, PRECTOTCORR: {}, RH2M: {}, WS2M: {}, ALLSKY_SFC_SW_DWN: {}, GWETROOT: {} };
    const u2f = 4.87 / Math.log(67.8 * 10 - 5.42);
    d.time.forEach((t, i) => {
      const k = t.replace(/-/g, ""), v = (a, f = 1) => (a && a[i] != null ? a[i] * f : -999);
      P.T2M[k] = v(d.temperature_2m_mean); P.T2M_MAX[k] = v(d.temperature_2m_max); P.T2M_MIN[k] = v(d.temperature_2m_min);
      P.PRECTOTCORR[k] = v(d.precipitation_sum); P.RH2M[k] = v(d.relative_humidity_2m_mean); P.WS2M[k] = v(d.wind_speed_10m_mean, u2f);
      P.ALLSKY_SFC_SW_DWN[k] = v(d.shortwave_radiation_sum); P.GWETROOT[k] = -999;
    });
    return { geometry: { coordinates: [j.longitude, j.latitude, j.elevation] }, properties: { parameter: P },
      header: { fill_value: -999, sources: ["ERA5 (ECMWF / Copernicus) via Open-Meteo"] }, parameters: {} };
  }
  async function buildEra5(lat, lon, opts = {}) {
    const [s, e] = resolveRange(opts.start, opts.end), key = cacheKey(lat, lon, s, e) + "_era5";
    const hit = cacheGet(key); if (hit) return hit;
    opts.onProgress && opts.onProgress("requesting");
    const q = new URLSearchParams({ latitude: lat.toFixed(4), longitude: lon.toFixed(4), start_date: s.toISOString().slice(0, 10), end_date: e.toISOString().slice(0, 10),
      daily: "temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_mean,shortwave_radiation_sum",
      wind_speed_unit: "ms", timezone: "GMT" });
    const [j, ex] = await Promise.all([getJSON(`${ERA5_URL}?${q}`, 90000), Promise.allSettled([fetchSoil(lat, lon), fetchSlope(lat, lon)])]);
    opts.onProgress && opts.onProgress("soil");
    const pkg = packageFrom(era5ToPowerShape(j), lat, lon, s, e, opts.name || null, { soil: ex[0].status === "fulfilled" ? ex[0].value : null, slope: ex[1].status === "fulfilled" ? ex[1].value : null,
      caveats: ["NASA POWER was unreachable: these numbers are ERA5 reanalysis (ECMWF/Copernicus, ~25 km) via Open-Meteo, not NASA data", "root-zone soil wetness not available from this source"] });
    pkg.source = { name: "ERA5 (ECMWF / Copernicus) via Open-Meteo", endpoint: ERA5_URL, citation: "Hersbach et al. (2020) ERA5; Open-Meteo.com (CC BY 4.0)" };
    pkg.engine_location.id = pkg.engine_location.id.replace("live_", "era5_"); pkg.engine_location.data_source = "ERA5";
    cachePut(key, pkg);
    opts.onProgress && opts.onProgress("ready");
    return pkg;
  }

  window.FS_NASA = { buildEra5, era5ToPowerShape, build, packageFrom, normalize, engineBlock, et0Daily, kendallP, theilSen, trend, soilFromPayload, usdaTexture, cellOf, resolveRange,
    fetchSoil, fetchSlope, reverseName, cacheGet, cachePut, cachedSameCell, pyRound, POWER_URL };
})();
