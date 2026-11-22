/* Field Shift – dynamic NASA environment per farm location.
   Flow: location chosen (GPS / map click / search / coordinates) -> backend POST /api/farm/environment
   -> NASA POWER profile for THAT point -> registered as the game's location (engine + NASA report use it).
   If the backend is unreachable the phone fetches NASA POWER itself (nasa_direct.js, same pipeline); failing that it
   uses a profile already saved for the same NASA cell, then the wilaya's NASA profile (data/wilayas_data.js),
   always labelled with where the numbers come from (never presented as the exact point when they are not). */
(function () {
  "use strict";
  const A = window.FS_APP, API = window.FS_API, DATA = window.FS_DATA, TOWNS = window.FS_TOWNS || [];
  if (!A || !DATA) return;
  const S = () => A.S, esc = A.esc;
  const L = (ar, en) => (S().lang === "en" ? en : ar);
  const FAO_TYPICAL_PAW = 140; // mm/m, FAO-56 Table 19 range for loam; used ONLY when SoilGrids has no value, and labelled

  const km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
  const nearestTown = (lat, lon) => { let best = null, bd = 1e9; TOWNS.forEach((x) => { const d = (x[2] - lat) ** 2 + (x[3] - lon) ** 2; if (d < bd) { bd = d; best = x; } }); return best && Math.sqrt(bd) < 0.6 ? (S().lang === "en" ? best[0] : best[1]) : null; };
  const validCoord = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  // ---------------------------------------------------------------- activation
  function activate(pkg, placeName) {
    const rec = pkg.engine_location;
    rec.name = placeName || rec.name;
    if (!rec.soil) rec.soil = { texture: null, paw100: FAO_TYPICAL_PAW, clay: null, sand: null, silt: null, soc: null, ph: null, cec: null, estimated: true,
      source: "FAO-56 typical value (SoilGrids had no data here)" };
    const i = DATA.locations.findIndex((l) => l.id === rec.id);
    if (i >= 0) DATA.locations[i] = rec; else DATA.locations.push(rec);
    if (rec.season_labels && rec.season_labels.length) DATA.seasons = rec.season_labels.slice();
    const s = S();
    s.locId = rec.id;
    s.dataMeta = { mode: "live", cellId: pkg.cell && pkg.cell.id, period: pkg.period && pkg.period.label, seasons: rec.season_labels.length,
      cached: !!(pkg.cache && pkg.cache.hit), fetchedAt: pkg.fetched_at, caveats: pkg.caveats || [], cellNote: pkg.cell && pkg.cell.note,
      soilEstimated: !!rec.soil.estimated, slopeDefault: rec.slope == null };
    A.save();
  }
  function useFallback(lat, lon) {
    let best = null, bd = 1e9;
    DATA.locations.filter((l) => !l.live).forEach((l) => { const d = km(lat, lon, l.lat, l.lon); if (d < bd) { bd = d; best = l; } });
    if (!best) return false;
    const s = S();
    s.locId = best.id;
    s.dataMeta = { mode: "fallback", fallbackName: best.name || L("نقطة محفوظة", "a saved point"), distanceKm: Math.round(bd), period: "1995-96 to 2024-25" };
    A.save();
    return true;
  }

  // ---------------------------------------------------------------- entry point used by app.js useLocation()
  function select(lat, lon, town) {
    lat = Number(lat); lon = Number(lon);
    if (!validCoord(lat, lon)) { alert(L("إحداثيات غير صحيحة: خط العرض بين −90 و90، وخط الطول بين −180 و180.", "Invalid coordinates: latitude must be −90…90 and longitude −180…180.")); return false; }
    const s = S();
    // app.js names map/coordinate picks after the nearest ALGERIAN town; far from it, that name is wrong -> reverse-geocode instead
    let named = !!town;
    if (town && TOWNS.length) { let bd = 1e9, bn = null; TOWNS.forEach((x) => { const d = (x[2] - lat) ** 2 + (x[3] - lon) ** 2; if (d < bd) { bd = d; bn = x; } });
      if (bn && (town === bn[0] || town === bn[1]) && Math.sqrt(bd) > 0.15) { named = false; town = nearestTown(lat, lon); } }
    s.realLat = lat; s.realLon = lon;
    s.locName = town || `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
    s.pendingEnv = { lat, lon, town: s.locName, named };
    A.save(); A.go("envload");
    return true;
  }

  // ---------------------------------------------------------------- loading screen
  const STEPS = () => [["requesting", L("الاتصال بناسا POWER", "Contacting NASA POWER")], ["running", L("فحص البيانات اليومية وتنظيفها", "Checking and cleaning daily data")],
    ["soil", L("حساب المؤشرات الزراعية والتربة", "Computing farm indicators and soil")], ["ready", L("ملف مزرعتك جاهز", "Your farm profile is ready")]];
  let RUN = 0;
  A.SCREENS.envload = () => {
    const p = S().pendingEnv || {};
    return `<div class="screen envload">
      <div class="top in">${A.backBtn("location")}<h1 style="font-size:20px;font-weight:800">${L("بيانات ناسا لأرضك", "NASA data for your land")}</h1></div>
      <div class="sat-scene pop d1" aria-hidden="true">
        <svg viewBox="0 0 340 170" width="100%" height="170"><circle cx="170" cy="300" r="190" fill="#9ca047"/><circle cx="170" cy="300" r="190" fill="none" stroke="#7d8136" stroke-width="3"/>
          <g class="sat-orbit"><g transform="translate(60 54)"><rect x="-10" y="-10" width="20" height="20" rx="3" fill="#516d77"/><rect x="-34" y="-6" width="20" height="12" rx="2" fill="#e8e8bc"/><rect x="14" y="-6" width="20" height="12" rx="2" fill="#e8e8bc"/></g></g>
          <g class="beam"><path d="M170 60 L150 128 L190 128 Z" fill="#e8e8bc" opacity=".55"/></g>
          <g class="pin"><path d="M170 128 C162 116 154 108 154 98 C154 89 161 82 170 82 C179 82 186 89 186 98 C186 108 178 116 170 128 Z" fill="#840000"/><circle cx="170" cy="98" r="6" fill="#fbfbef"/></g></svg>
        <div class="sat-salah">${A.salah(74, "wave1")}</div>
      </div>
      <div class="card in d2" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px">
        <b style="font-size:17px">📍 ${esc(p.town || "")}</b>
        <span class="muted" dir="ltr" style="font-size:12.5px">${p.lat != null ? `${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°` : ""}</span>
      </div>
      <ol class="envsteps in d3" id="envSteps">${STEPS().map(([k, t]) => `<li data-k="${k}"><span class="dot"></span>${t}</li>`).join("")}</ol>
      <div id="envMsg" class="in d4" aria-live="polite"></div>
      <div class="spacer"></div>
      <div id="envBtns"></div>
    </div>`;
  };
  A.AFTER.envload = () => { run(++RUN); };
  function stage(k) {
    const order = STEPS().map((x) => x[0]), idx = order.indexOf(k === "queued" ? "requesting" : k === "pending" ? "running" : k);
    document.querySelectorAll("#envSteps li").forEach((li, i) => { li.classList.toggle("done", i < idx || k === "ready"); li.classList.toggle("cur", i === idx && k !== "ready"); });
  }
  // ---------------------------------------------------------------- where the data comes from, in order:
  // 1. Field Shift server (NASA POWER, cached, saved farm)      2. NASA POWER straight from this phone (same pipeline)
  // 3. a profile this phone already built for the same NASA cell 4. the wilaya's NASA profile (data/wilayas_data.js)
  // 5. only then: the bundled example point, offered with its distance, never as the farmer's own data
  const WLIST = window.FS_WILAYA_LIST || [];
  const wilayaFor = (lat, lon) => { let best = null, bd = 1e9; WLIST.forEach((w) => { const d = km(lat, lon, w[3], w[4]); if (d < bd) { bd = d; best = w; } }); return best ? { code: best[0], en: best[1], ar: best[2], lat: best[3], lon: best[4], km: Math.round(bd) } : null; };
  const wName = (w) => (S().lang === "en" ? w.en : w.ar);
  const setTown = (p, name) => { if (!name) return; p.town = name; S().locName = name; const b = document.querySelector(".envload .card b"); if (b) b.textContent = "📍 " + name; };

  async function run(id) {
    const p = S().pendingEnv; if (!p) return A.go("location");
    const errors = [];
    stage("requesting");
    const online = API ? await API.checkHealth() : false;
    if (id !== RUN) return;
    // 1. server
    if (online) {
      try {
        if (!p.named) { try { const r = await API.reverse(p.lat, p.lon, S().lang === "en" ? "en" : "ar"); if (r && r.name) setTown(p, r.name); } catch (e) { } }
        if (API.farmId) await API.updateFarm(API.farmId, { lat: p.lat, lon: p.lon, place_name: p.town, inputs: S().farm });
        else { const f = await API.createFarm({ lat: p.lat, lon: p.lon, placeName: p.town, inputs: S().farm }); S().farmId = f.farm_id; }
        setTimeout(() => id === RUN && stage("soil"), 2500);
        const pkg = await API.getEnvironment({ lat: p.lat, lon: p.lon, placeName: p.town, farmId: API.farmId, onProgress: (k) => id === RUN && stage(k) });
        if (id !== RUN) return;
        activate(pkg, p.town); rememberFarm(p, pkg); return ready(pkg, "server");
      } catch (e) { if (id !== RUN) return; errors.push(e.message); }
    }
    // 2. NASA POWER directly from the phone
    const N = window.FS_NASA;
    if (N) {
      try {
        if (!p.named) { const w = wilayaFor(p.lat, p.lon); setTown(p, (await N.reverseName(p.lat, p.lon, S().lang === "en" ? "en" : "ar")) || nearestTown(p.lat, p.lon) || (w && w.km < 150 ? wName(w) : p.town)); }
        if (id !== RUN) return;
        const pkg = await N.build(p.lat, p.lon, { name: p.town, onProgress: (k) => id === RUN && stage(k) });
        if (id !== RUN) return;
        activate(pkg, p.town); rememberFarm(p, pkg); return ready(pkg, pkg.cache && pkg.cache.hit ? "phone-cache" : "direct");
      } catch (e) { if (id !== RUN) return; errors.push(e.message); }
      // 3. same NASA cell already on this phone (identical weather data)
      const same = N.cachedSameCell(p.lat, p.lon)[0];
      if (same) { activate(same, p.town); rememberFarm(p, same); return ready(same, "cell-cache"); }
    }
    // 4. the wilaya's NASA profile
    const w = wilayaFor(p.lat, p.lon), WD = window.FS_WILAYA_DATA || {};
    if (w && w.km <= 250 && WD[w.code]) { useWilaya(p, w, WD[w.code]); return wilayaReady(w, errors); }
    // 5. NASA unreachable from here and no wilaya profile: ERA5 reanalysis (clearly labelled, not NASA)
    if (N && N.buildEra5) {
      try { const pkg = await N.buildEra5(p.lat, p.lon, { name: p.town, onProgress: (k) => id === RUN && stage(k) });
        if (id !== RUN) return; activate(pkg, p.town); S().dataMeta.source = "ERA5"; rememberFarm(p, pkg); return ready(pkg, "era5");
      } catch (e) { if (id !== RUN) return; errors.push(e.message); }
    }
    // 6. nothing reachable
    offline(online ? L(`تعذّر جلب بيانات ناسا: ${esc(errors[errors.length - 1] || "")}`, `Couldn't get NASA data: ${esc(errors[errors.length - 1] || "")}`)
      : L("لا يمكن الوصول إلى خادم Field Shift ولا إلى ناسا POWER الآن (تحقق من الإنترنت).", "Neither the Field Shift server nor NASA POWER can be reached right now (check the internet connection)."));
  }
  function ready(pkg, how) {
    stage("ready");
    const msg = document.getElementById("envMsg"), btns = document.getElementById("envBtns");
    const loc = pkg.engine_location, tr = loc.trends || {};
    const via = { server: "", direct: L("جُلبت مباشرة من ناسا على هاتفك", "fetched straight from NASA on this phone"), "phone-cache": L("محفوظة على هاتفك", "saved on this phone"),
      "cell-cache": L("نفس خلية ناسا (محفوظة على هاتفك)", "same NASA cell, saved on this phone"), era5: "" }[how];
    const era5 = how === "era5";
    if (how === "cell-cache") S().dataMeta.cellShared = true;
    S().dataMeta.via = how; A.save();
    msg.innerHTML = `<div class="envok pop"><b>${era5 ? L("وصلت بيانات المناخ لأرضك (ERA5)", "Climate data for your land is here (ERA5)") : L("وصلت بيانات ناسا لأرضك!", "NASA data for your land is here!")}</b>
      <div class="envkpis"><span><small>${L("مطر أكتوبر–ماي", "Oct–May rain")}</small><b>${loc.summary.rain_mean} ${L("ملم", "mm")}</b></span>
      <span><small>${L("مواسم", "Seasons")}</small><b>${loc.season_labels.length}</b></span>
      <span><small>${L("تربة", "Soil")}</small><b>${(loc.soil && loc.soil.texture) || L("غير متوفرة", "n/a")}</b></span></div>
      ${era5 ? `<div class="note">⚠ ${L("تعذّر الوصول إلى ناسا POWER من هذا الهاتف، فاستعملنا إعادة تحليل ERA5 (كوبرنيكوس/ECMWF، ~25 كم) عبر Open-Meteo. ليست بيانات ناسا؛ أعد المحاولة لاحقًا.", "NASA POWER couldn't be reached from this phone, so we used ERA5 reanalysis (Copernicus/ECMWF, ~25 km) via Open-Meteo. This is not NASA data; try again later.")}</div>` : ""}
      <div class="note">${era5 ? "🌍 ERA5 · " + esc(pkg.period.label) : `🛰️ NASA POWER · ${esc(pkg.period.label)} · ${L("خلية ~50 كم، ليست قياسًا لحقلك", "~50 km cell, not a field measurement")}`}${pkg.cache && pkg.cache.hit && how === "server" ? " · " + L("من الذاكرة", "cached") : ""}${via ? " · " + via : ""}</div>
      ${tr.onset && tr.onset.significant ? `<div class="note">${L(`مطر البذر يتأخر ${Math.round(tr.onset.per_decade)} يومًا كل عقد (دال إحصائيًا).`, `Sowing rain arrives ${Math.round(tr.onset.per_decade)} days later per decade (significant).`)}</div>` : ""}</div>`;
    btns.innerHTML = `<button class="primary pop" data-act="envDone">${L("تابع", "Continue")} ${A.fwd()}</button>`;
  }
  function useWilaya(p, w, rec0) {
    const rec = JSON.parse(JSON.stringify(rec0));
    rec.id = "wil_" + w.code; rec.name = p.town || wName(w); rec.live = true; rec.wilaya = w.code;
    const i = DATA.locations.findIndex((l) => l.id === rec.id); if (i >= 0) DATA.locations[i] = rec; else DATA.locations.push(rec);
    if (rec.season_labels && rec.season_labels.length) DATA.seasons = rec.season_labels.slice();
    if (!rec.soil) rec.soil = { texture: null, paw100: FAO_TYPICAL_PAW, clay: null, sand: null, silt: null, soc: null, ph: null, cec: null, estimated: true, source: "FAO-56 typical value" };
    const s = S(); s.locId = rec.id;
    s.dataMeta = { mode: "wilaya", wilaya: w.code, wilayaEn: w.en, wilayaAr: w.ar, distanceKm: w.km, period: rec.period_label, seasons: rec.season_labels.length,
      soilEstimated: !!rec.soil.estimated, slopeDefault: rec.slope == null };
    A.save();
  }
  function wilayaReady(w, errors) {
    stage("ready");
    const loc = A.loc();
    document.getElementById("envMsg").innerHTML = `<div class="envok pop"><b>${L(`نستعمل بيانات ناسا لولاية ${w.ar}`, `Using NASA data for the wilaya of ${w.en}`)}</b>
      <div class="envkpis"><span><small>${L("مطر أكتوبر–ماي", "Oct–May rain")}</small><b>${loc.summary.rain_mean} ${L("ملم", "mm")}</b></span>
      <span><small>${L("مواسم", "Seasons")}</small><b>${loc.season_labels.length}</b></span>
      <span><small>${L("مقر الولاية", "Wilaya seat")}</small><b>${w.km} ${L("كم", "km")}</b></span></div>
      <div class="note">⚠ ${L(`لم نصل إلى ناسا لنقطتك بالضبط، فنستعمل ملف ناسا POWER لمقر ولاية ${w.ar} (على بُعد ${w.km} كم). أعد المحاولة لاحقًا لبيانات أرضك.`, `NASA couldn't be reached for your exact point, so we use the NASA POWER profile of the ${w.en} wilaya seat (${w.km} km away). Try again later for your own point.`)}</div></div>`;
    document.getElementById("envBtns").innerHTML = `<div style="display:flex;flex-direction:column;gap:8px"><button class="primary pop" data-act="envDone">${L("تابع", "Continue")} ${A.fwd()}</button>
      <button class="secondary" data-act="envRetry">${L("أعد المحاولة مع ناسا", "Try NASA again")}</button></div>`;
  }
  // farms remembered on this phone (used when the server can't list saved farms)
  const LF = "fs_local_farms";
  function localFarms() { try { return JSON.parse(localStorage.getItem(LF) || "[]"); } catch (e) { return []; } }
  function rememberFarm(p, pkg) {
    try { const list = localFarms().filter((f) => !(Math.abs(f.lat - p.lat) < 1e-4 && Math.abs(f.lon - p.lon) < 1e-4));
      list.unshift({ id: "local_" + Date.now().toString(36), lat: p.lat, lon: p.lon, name: p.town, period: pkg.period && pkg.period.label, at: new Date().toISOString(), farm: S().farm });
      localStorage.setItem(LF, JSON.stringify(list.slice(0, 12))); } catch (e) { }
  }
  function offline(text) {
    const p = S().pendingEnv;
    let best = null, bd = 1e9; DATA.locations.filter((l) => !l.live).forEach((l) => { const d = km(p.lat, p.lon, l.lat, l.lon); if (d < bd) { bd = d; best = l; } });
    document.getElementById("envMsg").innerHTML = `<div class="envwarn pop">⚠ ${text}</div>`;
    document.getElementById("envBtns").innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
      <button class="primary" data-act="envRetry">${L("أعد المحاولة", "Try again")}</button>
      ${best ? `<button class="secondary" data-act="envFallback">${L(`تابع ببيانات محفوظة لنقطة أخرى (${Math.round(bd)} كم)`, `Continue with saved data from another point (${Math.round(bd)} km away)`)}</button>` : ""}
      <button class="secondary" data-act="go" data-to="manual">${L("غيّر الموقع", "Change location")}</button></div>`;
  }
  A.ACT.envRetry = () => A.go("envload");
  A.ACT.envFallback = () => { const p = S().pendingEnv; if (useFallback(p.lat, p.lon)) finishFlow(); };
  A.ACT.envDone = () => finishFlow();
  function finishFlow() {
    const s = S(), to = s.envReturn || (s.name && s.name.trim() ? "farm" : "profile");
    s.envReturn = null; s.pendingEnv = null; A.save();
    if (to === "farm" && s.step == null) s.step = 0;
    A.go(to);
  }

  async function directSearch(q, lang) { // OpenStreetMap Nominatim, only when our server is down (low volume, attributed)
    try { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${lang}&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      const j = await r.json(); return (j || []).map((x) => ({ lat: +x.lat, lon: +x.lon, name: x.name || (x.display_name || "").split(",")[0], display_name: x.display_name })); } catch (e) { return []; }
  }
  // ---------------------------------------------------------------- manual screen: worldwide search + coordinate checks
  const origAfterManual = A.AFTER.manual;
  A.AFTER.manual = () => {
    origAfterManual && origAfterManual();
    const inp = document.getElementById("town"), box = document.getElementById("sugg");
    let timer = null, q0 = "";
    inp && inp.addEventListener("input", () => {
      clearTimeout(timer);
      const q = inp.value.trim(); if (q.length < 3) return;
      timer = setTimeout(async () => {
        q0 = q;
        try {
          const lang = S().lang === "en" ? "en" : "ar";
          const res = (API && (API.online || (await API.checkHealth()))) ? await API.geocode(q, lang) : await directSearch(q, lang);
          if (q0 !== inp.value.trim() || !res.length) return;
          box.style.display = "block";
          box.insertAdjacentHTML("beforeend", res.map((r) => `<button class="reveal" data-act="town" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${esc(r.name || r.display_name)}"><span>🌍 ${esc(r.name || "")}<small class="muted" style="display:block;font-size:11px;font-weight:600">${esc((r.display_name || "").slice(0, 70))}</small></span><span class="muted" style="font-size:12px" dir="ltr">${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}</span></button>`).join("") + `<div class="osm-attr">© OpenStreetMap</div>`);
        } catch (e) { }
      }, 600);
    });
    ["lat", "lon"].forEach((id) => { const el = document.getElementById(id); el && el.addEventListener("input", () => {
      const la = parseFloat(document.getElementById("lat").value), lo = parseFloat(document.getElementById("lon").value), m = document.getElementById("manMsg");
      if (!m) return;
      if ((document.getElementById("lat").value && !(la >= -90 && la <= 90)) || (document.getElementById("lon").value && !(lo >= -180 && lo <= 180)))
        m.textContent = L("خط العرض بين −90 و90، وخط الطول بين −180 و180.", "Latitude must be −90…90 and longitude −180…180.");
      else m.textContent = "";
    }); });
    if (S().envReturn === "hub") { const h = document.querySelector(".screen h1"); if (h) h.textContent = L("غيّر موقع هذه المزرعة", "Change this farm's location"); }
  };

  // ---------------------------------------------------------------- hub: farm switcher + data badge
  const origHub = A.SCREENS.hub;
  A.SCREENS.hub = () => {
    const html = origHub(), m = S().dataMeta || {};
    const badge = m.mode === "live" && m.source === "ERA5" ? `<span class="envbadge warn">🌍 ${L("بيانات ERA5 لموقعك (ناسا غير متاحة)", "ERA5 data for your location (NASA unavailable)")} · ${esc(m.period || "")}</span>`
      : m.mode === "live" ? `<span class="envbadge live">🛰️ ${L("بيانات ناسا لموقعك", "NASA data for your location")} · ${esc(m.period || "")}</span>`
      : m.mode === "wilaya" ? `<span class="envbadge warn">🛰️ ${L(`بيانات ناسا لولاية ${esc(m.wilayaAr || "")} (المقر على ${m.distanceKm} كم)`, `NASA data for ${esc(m.wilayaEn || "")} wilaya (seat ${m.distanceKm} km away)`)}</span>`
      : m.mode === "fallback" ? `<span class="envbadge warn">⚠ ${L(`بيانات محفوظة من نقطة على بُعد ${m.distanceKm} كم، وليست موقعك`, `Saved data from a point ${m.distanceKm} km away, not your location`)}</span>`
      : `<span class="envbadge warn">⚠ ${L("بيانات تجريبية", "Demo data")}</span>`;
    const bar = `<div class="farmbar in"><button class="farmbtn" data-act="farmsOpen" aria-haspopup="dialog">🌾 <b>${esc(S().locName || L("مزرعتي", "My farm"))}</b><span>▾</span></button>${badge}</div>`;
    return html.replace('<div class="gscreen hub">', '<div class="gscreen hub">' + bar);
  };
  A.ACT.farmsOpen = async () => {
    const ov = document.createElement("div"); ov.className = "riskov fade"; ov.id = "farmsOv";
    ov.innerHTML = `<div class="riskcard sheet farmsheet"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:18px">${L("مزارعي", "My farms")}</b><button class="x3x" data-f="close" aria-label="${L("إغلاق", "Close")}">✕</button></div><div id="farmList" class="muted">${L("جارٍ التحميل…", "Loading…")}</div>
      <button class="secondary" data-f="edit">📍 ${L("غيّر موقع هذه المزرعة", "Change this farm's location")}</button>
      <button class="primary" data-f="add">＋ ${L("أضف مزرعة جديدة", "Add a new farm")}</button></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]"); if (!b && e.target !== ov) return; const k = b ? b.dataset.f : "close";
      if (k === "close") return ov.remove();
      if (k === "edit") { ov.remove(); S().envReturn = "hub"; return A.go("manual"); }
      if (k === "add") { ov.remove(); API && (API.farmId = null); const s = S(); s.farmId = null; s.envReturn = null; s.step = 0;
        s.farm = { area: 5, system: null, soil: null, irrig: null, water: null, history: ["unknown", "unknown", "unknown"], current: null, intent: null, focus: null, prios: [] }; return A.go("location"); }
      if (k === "switch") { ov.remove(); switchTo(b.dataset.id); }
    });
    const list = document.getElementById("farmList");
    if (!API || !(await API.checkHealth())) {
      const lf = localFarms(); RT_FARMS = lf.map((f) => ({ farm_id: f.id, lat: f.lat, lon: f.lon, name: f.name, inputs: f.farm, local: true }));
      list.innerHTML = lf.length ? `<div class="note" style="margin-bottom:6px">${L("المزارع المحفوظة على هذا الهاتف:", "Farms saved on this phone:")}</div>` + RT_FARMS.map((f) => `<button class="farmrow" data-f="switch" data-id="${f.farm_id}"><span>🌾</span><span style="flex:1"><b>${esc(f.name || L("مزرعة", "Farm"))}</b><small dir="ltr">${f.lat.toFixed(3)}°, ${f.lon.toFixed(3)}°</small></span></button>`).join("")
        : L("لا توجد مزارع محفوظة بعد.", "No saved farms yet.");
      return;
    }
    try {
      const farms = await API.listFarms(); RT_FARMS = farms;
      list.innerHTML = farms.length ? farms.map((f) => `<button class="farmrow ${f.farm_id === API.farmId ? "on" : ""}" data-f="switch" data-id="${f.farm_id}"><span>🌾</span><span style="flex:1"><b>${esc(f.name || f.place_name || L("مزرعة", "Farm"))}</b><small dir="ltr">${f.lat.toFixed(3)}°, ${f.lon.toFixed(3)}°</small></span>${f.farm_id === API.farmId ? `<span class="tag">${L("الحالية", "Current")}</span>` : ""}</button>`).join("")
        : L("لا توجد مزارع محفوظة بعد.", "No saved farms yet.");
    } catch (e) { list.textContent = e.message; }
  };
  let RT_FARMS = [];
  function switchTo(id) {
    const f = RT_FARMS.find((x) => x.farm_id === id); if (!f) return;
    const s = S(); if (!f.local) { API.farmId = f.farm_id; s.farmId = f.farm_id; }
    if (f.inputs && Object.keys(f.inputs).length) s.farm = Object.assign({}, s.farm, f.inputs);
    s.envReturn = "hub";
    select(f.lat, f.lon, f.place_name || f.name);
  }

  // ---------------------------------------------------------------- NASA report: no blank soil / GAEZ panels
  const origNasa = A.SCREENS.nasa;
  if (origNasa) A.SCREENS.nasa = () => {
    let html = origNasa(); const l = A.loc(), m = S().dataMeta || {};
    const cut = (marker, repl) => { const i = html.indexOf(marker); if (i < 0) return; const start = html.lastIndexOf('<div class="panel2', i); let depth = 0, pos = start;
      while (pos < html.length) { const o = html.indexOf("<div", pos + 1), c = html.indexOf("</div>", pos + 1); if (c < 0) return; if (o >= 0 && o < c) { depth++; pos = o; } else { if (depth === 0) { html = html.slice(0, start) + repl + html.slice(c + 6); return; } depth--; pos = c; } } };
    if (l && l.soil && l.soil.estimated) cut(L("تربتك (SoilGrids)", "Your soil (SoilGrids)"), `<div class="panel2"><b>${L("التربة", "Soil")}</b><div class="note">${L("لا توجد قيم SoilGrids لهذه النقطة؛ يستعمل اللعب قيمة FAO-56 النموذجية لسعة الماء (140 ملم/م) أو جوابك عن نوع التربة.", "SoilGrids has no values at this point; the game uses the FAO-56 typical water capacity (140 mm/m) or your own soil answer.")}</div></div>`);
    if (l && l.live) html = html.split("NASADEM (30 m)").join(l.slope_source ? "Copernicus DEM (90 m)" : L("الانحدار غير متوفر", "slope n/a")).split(">NASADEM<").join(">" + (l.slope_source ? "Copernicus DEM" : L("قيمة افتراضية", "default value")) + "<");
    if (l && l.data_source === "ERA5") html = html.split("NASA POWER ·").join("ERA5 (ECMWF/Copernicus, Open-Meteo) ·");
    if (l && !l.gaez_wheat) cut(L("مؤشر FAO GAEZ v4", "FAO GAEZ v4 benchmark"), "");
    const banner = m.mode === "live" && m.source === "ERA5" ? `<div class="envbadge warn" style="align-self:flex-start">🌍 ERA5 (ECMWF/Copernicus) via Open-Meteo · ${esc(m.period || "")} · ${L("ليست بيانات ناسا", "not NASA data")}</div>`
      : m.mode === "wilaya" ? `<div class="envbadge warn" style="align-self:flex-start">🛰️ NASA POWER · ${L(`ولاية ${esc(m.wilayaAr || "")}، مقرها على ${m.distanceKm} كم`, `${esc(m.wilayaEn || "")} wilaya seat, ${m.distanceKm} km away`)} · ${esc(m.period || "")}</div>`
      : m.mode === "live" ? `<div class="envbadge live" style="align-self:flex-start">🛰️ NASA POWER · ${esc(m.period || "")} · ${L("خلية", "cell")} ${esc(m.cellId || "")}</div>`
      : `<div class="envbadge warn" style="align-self:flex-start">⚠ ${m.mode === "fallback" ? L(`بيانات نقطة أخرى على بُعد ${m.distanceKm} كم`, `Data from another point ${m.distanceKm} km away`) : L("بيانات المثال", "Example data")}</div>`;
    return html.replace(/(<div class="ghead in">[\s\S]*?<\/h1><\/div>)/, `$1${banner}`);
  };

  window.FS_ENV = { select, activate, useFallback };
})();
