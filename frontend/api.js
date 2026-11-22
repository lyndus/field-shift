/* Field Shift – backend API client. All NASA requests go through the backend (never from the browser). */
(function () {
  "use strict";
  const API_BASE = (window.FS_API_URL || "http://localhost:8000").replace(/\/$/, "");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const timeout = (ms) => (window.AbortSignal && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

  let deviceId = null;
  try { deviceId = localStorage.getItem("fs_device_id"); } catch (e) { }
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    try { localStorage.setItem("fs_device_id", deviceId); } catch (e) { }
  }

  async function j(method, path, body, ms = 15000) {
    const res = await fetch(API_BASE + path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: timeout(ms) });
    let data = null; try { data = await res.json(); } catch (e) { }
    if (!res.ok && res.status !== 202) { const err = new Error((data && data.detail) || `HTTP ${res.status}`); err.status = res.status; throw err; }
    return { status: res.status, data };
  }

  const API = {
    base: API_BASE, deviceId, online: false, farmId: null,

    async checkHealth() {
      try { const r = await j("GET", "/health", null, 3000); this.online = !!(r.data && r.data.ok); } catch (e) { this.online = false; }
      return this.online;
    },

    /** NASA POWER environment for a point. Resolves with the full package, or throws.
        onProgress(stage) receives: "requesting" | "queued" | "running" | "ready". */
    async getEnvironment({ lat, lon, placeName, farmId, startDate, endDate, onProgress, maxWaitMs = 150000 }) {
      const body = { latitude: Number(lat), longitude: Number(lon), place_name: placeName || null, farm_id: farmId || this.farmId || null };
      if (startDate) body.start_date = startDate; if (endDate) body.end_date = endDate;
      onProgress && onProgress("requesting");
      let r = await j("POST", "/api/farm/environment", body, 30000);
      if (r.status === 200) { onProgress && onProgress("ready"); return r.data; }
      const jid = r.data && r.data.job_id, t0 = Date.now();
      onProgress && onProgress("queued", r.data);
      while (Date.now() - t0 < maxWaitMs) {
        await sleep(((r.data && r.data.retry_after_seconds) || 3) * 1000);
        r = await j("GET", `/api/farm/environment/jobs/${jid}`, null, 15000);
        const st = r.data && r.data.status;
        if (st === "ready") { onProgress && onProgress("ready"); return r.data; }
        if (st === "failed") throw new Error(r.data.error || "NASA data could not be prepared");
        onProgress && onProgress(st || "running", r.data);
      }
      throw new Error("NASA POWER is taking too long; please try again");
    },

    async geocode(q, lang) { const r = await j("GET", `/api/geocode/search?q=${encodeURIComponent(q)}&lang=${lang || "en"}&limit=5`, null, 8000); return (r.data && r.data.results) || []; },
    async reverse(lat, lon, lang) { const r = await j("GET", `/api/geocode/reverse?lat=${lat}&lon=${lon}&lang=${lang || "en"}`, null, 8000); return r.data && r.data.result; },

    async listFarms() { const r = await j("GET", `/v1/farms?device_id=${encodeURIComponent(deviceId)}`); return r.data || []; },
    async createFarm({ lat, lon, name, placeName, inputs }) {
      const r = await j("POST", "/v1/farms", { device_id: deviceId, lat: Number(lat), lon: Number(lon), name: name || placeName || null, place_name: placeName || null, inputs: inputs || {} });
      this.farmId = r.data.farm_id; return r.data;
    },
    async updateFarm(farmId, patch) { const r = await j("PATCH", `/v1/farms/${farmId}`, { device_id: deviceId, ...patch }); return r.data; },

    /** kept for app.js: creates the farm once, then updates it (no duplicate farms). */
    async saveFarm(lat, lon, farmInputs) {
      try {
        if (this.farmId) return await this.updateFarm(this.farmId, { inputs: farmInputs || {} });
        return await this.createFarm({ lat, lon, inputs: farmInputs });
      } catch (e) { console.warn("[FieldShift API] save farm:", e.message); return null; }
    },

    async getNearestLocation(lat, lon) { // legacy endpoint, still available
      try { const r = await j("GET", `/v1/locations/nearest?lat=${lat}&lon=${lon}`); return r.status === 200 ? r.data : (r.data && r.data.fallback) || null; } catch (e) { return null; }
    },
    async recordAttempt(farmId, rotation, score, details) {
      farmId = farmId || this.farmId; if (!farmId) return null;
      try {
        const known = ["wheat", "barley", "oat", "chickpea", "lentil", "faba", "vetch", "peas", "fallow"];
        const rot = (Array.isArray(rotation) && rotation.length ? rotation : ["wheat"]).map((c) => (known.includes(c) ? c : "wheat"));
        const r = await j("POST", `/v1/farms/${farmId}/attempts`, { rotation: rot, score: score != null ? Number(score) : null, details: details || {} });
        return r.data;
      } catch (e) { return null; }
    },
    async getCropTraits(cropId) { try { const r = await j("GET", cropId ? `/v1/crops/${cropId}` : "/v1/crops"); return r.data; } catch (e) { return null; } },
    async getSuitability(lat, lon, crop, lastCrop) { try { const q = new URLSearchParams({ lat, lon, crop, last_crop: lastCrop || "" }); const r = await j("GET", `/v1/suitability?${q}`); return r.data; } catch (e) { return null; } },
  };
  window.FS_API = API;
  API.checkHealth().then((ok) => { if (ok) console.log("🌾 Field Shift connected to API at " + API_BASE); });
})();
