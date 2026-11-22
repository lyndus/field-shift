/* Field Shift – 3D shell for levels 2–11 and the crop-failure chapter.
   Rules, texts, hints, risk cards and scoring stay in game.js (LEVELS[id]); this file is the playing layer:
   a full-screen 3D farm, a compact control dock (no page scroll) and observation data behind a Show/Hide button. */
(function () {
  "use strict";
  if (!window.THREE || !window.FS3D) return;
  const A = window.FS_APP, GM = window.FS_GAME, X = window.FS3D, L = GM.L, D = window.FS_DATA;
  const S = () => A.S, LVd = () => GM.LV, st = () => GM.LV.st, LEV = (id) => GM.LEVELS[id];
  const $ = (id) => document.getElementById(id);
  const CROPS = ["wheat", "barley", "oat", "lentil", "chickpea", "faba", "vetch"];
  const pct = GM.pct, cname = GM.cname, mName = GM.mName;
  const std = X.std;

  // ------------------------------------------------------------ textures (white base, tinted by material colour)
  function tex(kind) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    if (kind === "furrow") for (let i = 0; i < 8; i++) { g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(0, i * 16 + 10, 128, 5); g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(0, i * 16 + 6, 128, 2); }
    if (kind === "crack") { g.strokeStyle = "rgba(40,25,10,.55)"; g.lineWidth = 2; [[10, 20, 40, 34, 36, 60, 60, 70], [70, 10, 66, 40, 90, 52, 86, 80], [20, 90, 46, 84, 60, 110], [96, 90, 120, 100, 110, 124]].forEach((p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]); g.stroke(); }); }
    if (kind === "salt") for (let i = 0; i < 70; i++) { g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 1.5 + Math.random() * 4, 0, 7); g.fill(); }
    if (kind === "dots") for (let i = 0; i < 26; i++) { g.fillStyle = "rgba(255,250,225,.95)"; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2.5, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ------------------------------------------------------------ decor pieces placed on a plot
  function decor(kind) {
    const g = new THREE.Group();
    const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    if (kind === "sprinkler") { add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), std(X.PAL.jeanD)), 1.5, 0.9, 1.5); add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), std(X.PAL.jean)), 1.5, 1.8, 1.5); }
    if (kind === "drip") for (let k = -1; k <= 1; k++) { const t = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 6), std(0x1e2e33)), 0, 0.06, k * 1.3); t.rotation.z = Math.PI / 2; }
    if (kind === "flood") add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.8), std(0x4fb2f0, { roughness: 0.15, metalness: 0.3 })), 0, 0.05, -1.6);
    if (kind === "nbag") { add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), std(X.PAL.core)), -1.3, 0.5, -1.3); add(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.25, 0.52), std(X.PAL.jean)), -1.3, 0.75, -1.3); }
    if (kind === "manure" || kind === "compost") [[-1, -0.8], [0.9, 0.4], [-0.3, 1.2], [1.2, -1.2]].forEach(([x, z]) => { const m = add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(kind === "manure" ? 0x4a3220 : 0x6e4527, { flatShading: true })), x, 0, z); m.scale.y = 0.55; });
    if (kind === "barrier") for (let k = -3; k <= 3; k++) { const b = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), std(k % 2 ? X.PAL.appleD : X.PAL.apple, { flatShading: true })), k * 0.6, 0.35, 1.7); b.scale.y = 1.2; }
    if (kind === "contour") { const r = add(new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.28, 0.35), std(0x5f7d36, { flatShading: true })), 0, 0.14, 0); r.receiveShadow = true; }
    if (kind === "ring") { const r = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); r.rotation.x = Math.PI / 2; r.position.y = 0.25; g.add(r); g.userData.spin = r; }
    if (kind === "smoke") g.userData.smoke = true;
    return g;
  }

  // ------------------------------------------------------------ field with per-plot crops, health, soil and decor
  class Field2 {
    constructor(w, o) {
      this.w = w; this.cols = o.cols; this.rows = o.rows; this.P = 4.2; this.gap = 0.45;
      const P = this.P, G = this.gap, W = this.W = this.cols * (P + G) - G, Dd = this.D = this.rows * (P + G) - G, n = this.n = this.cols * this.rows;
      this.slope = o.slope || 0;
      this.texs = { furrow: tex("furrow"), flat: tex("flat"), crack: tex("crack"), salt: tex("salt"), dots: tex("dots") };
      const bed = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, 0.22, Dd + 1.4), std(0x8a5a33, { roughness: 1 })); bed.position.y = 0.11; bed.receiveShadow = true; w.scene.add(bed);
      this.soilHex = X.SOILC[S().farm.soil] || 0xb8743f;
      this.plots = []; this.centers = []; this.decor = []; this.decorKey = []; this.soilKey = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const h = 0.3 + this.slope * (this.rows - 1 - r);
        const m = new THREE.Mesh(new THREE.BoxGeometry(P, h, P), new THREE.MeshStandardMaterial({ map: this.texs.furrow, color: this.soilHex, roughness: 1 }));
        const x = -W / 2 + P / 2 + c * (P + G), z = -Dd / 2 + P / 2 + r * (P + G);
        m.position.set(x, 0.17 + h / 2, z); m.receiveShadow = true; m.castShadow = this.slope > 0; m.userData.plot = this.plots.length; w.scene.add(m);
        this.plots.push(m); this.centers.push(new THREE.Vector3(x, 0.17 + h, z));
        const dg = new THREE.Group(); dg.position.set(x, 0.17 + h, z); w.scene.add(dg); this.decor.push(dg); this.decorKey.push(""); this.soilKey.push("");
      }
      this.crop = Array(n).fill(null); this.health = new Float32Array(n).fill(1); this.hShow = new Float32Array(n).fill(1); this.growth = new Float32Array(n).fill(1);
      this.sets = []; this.dummy = new THREE.Object3D(); this.m4 = new THREE.Matrix4(); this.tTop = new THREE.Matrix4(); this.col = new THREE.Color(); this.col2 = new THREE.Color();
      // straw
      const SN = 24 * n; this.straw = new THREE.InstancedMesh(new THREE.BoxGeometry(0.75, 0.035, 0.07), std(0xf5cf6a), SN); this.straw.receiveShadow = true; w.scene.add(this.straw);
      this.strawBase = []; this.strawVis = new Float32Array(n); this.strawShow = new Float32Array(n);
      this.centers.forEach((c) => { for (let k = 0; k < 24; k++) this.strawBase.push({ x: c.x + (Math.random() - 0.5) * (P - 0.5), z: c.z + (Math.random() - 0.5) * (P - 0.5), ry: Math.random() * 3.14, y: c.y + 0.02 + Math.random() * 0.04 }); });
      this.dirty = true;
      w.updaters.push((dt, t) => this.step(dt, t));
    }
    plotOf(o) { return o && o.userData && o.userData.plot != null ? o.userData.plot : -1; }
    setCrops(fn) {
      const want = this.crop.map((_, i) => fn(i) || null);
      if (want.every((k, i) => k === this.crop[i])) return;
      want.forEach((k, i) => { if (k !== this.crop[i]) this.growth[i] = k ? 0.02 : 1; });
      this.crop = want;
      this.sets.forEach((s) => { [s.stems, s.heads].forEach((m) => { this.w.scene.remove(m); m.geometry.dispose(); m.material.dispose(); m.dispose && m.dispose(); }); });
      this.sets = [];
      [...new Set(want.filter(Boolean))].forEach((crop) => {
        const plots = want.map((k, i) => (k === crop ? i : -1)).filter((i) => i >= 0), cer = X.CEREAL.includes(crop), per = cer ? 36 : 20, N = per * plots.length;
        const stemG = cer ? new THREE.CylinderGeometry(0.03, 0.045, 1.25, 4) : new THREE.CylinderGeometry(0.04, 0.05, 0.5, 4); stemG.translate(0, cer ? 0.625 : 0.25, 0);
        const headG = cer ? new THREE.CapsuleGeometry(0.11, 0.42, 2, 6) : new THREE.IcosahedronGeometry(0.4, 0);
        const stems = new THREE.InstancedMesh(stemG, std(0xffffff), N), heads = new THREE.InstancedMesh(headG, std(0xffffff, { flatShading: !cer }), N);
        [stems, heads].forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.w.scene.add(m); });
        const base = []; const side = Math.round(Math.sqrt(per));
        plots.forEach((pi) => { const c = this.centers[pi]; for (let k = 0; k < per; k++) { const gx = (k % side + 0.5) / side - 0.5, gz = (Math.floor(k / side) + 0.5) / Math.ceil(per / side) - 0.5; base.push({ pi, x: c.x + gx * (this.P - 0.6) + (Math.random() - 0.5) * 0.25, y: c.y, z: c.z + gz * (this.P - 0.6) + (Math.random() - 0.5) * 0.25, ry: Math.random() * 6, s: 0.85 + Math.random() * 0.3, ph: Math.random() * 6, lean: (Math.random() - 0.5) * 0.12 }); } });
        this.sets.push({ crop, cer, stems, heads, base, stemC: new THREE.Color(cer ? 0xb59a45 : 0x6f7a34), headC: new THREE.Color(X.HEADC[crop] || 0xffc83a), stemH: cer ? 1.25 : 0.5 });
      });
      this.dirty = true;
    }
    setHealth(fn) { for (let i = 0; i < this.n; i++) this.health[i] = Math.max(0, Math.min(1, fn(i))); }
    setStraw(i, v) { this.strawVis[i] = v; }
    setSoil(i, color, texKind) {
      const key = color + "|" + texKind; if (this.soilKey[i] === key) return; this.soilKey[i] = key;
      const m = this.plots[i].material; m.map = this.texs[texKind] || this.texs.furrow; m.color.setHex(color); m.needsUpdate = true;
    }
    setDecor(i, kinds) {
      const key = (kinds || []).join(","); if (this.decorKey[i] === key) return; this.decorKey[i] = key;
      const g = this.decor[i]; while (g.children.length) { const c = g.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
      (kinds || []).forEach((k) => { const d = decor(k); d.scale.setScalar(0.01); d.userData.grow = 0; g.add(d); });
    }
    step(dt, t) {
      let anim = this.dirty; this.dirty = false;
      for (let i = 0; i < this.n; i++) {
        if (this.growth[i] < 1) { this.growth[i] = Math.min(1, this.growth[i] + dt * 0.9); anim = true; }
        const d = this.health[i] - this.hShow[i]; if (Math.abs(d) > 0.004) { this.hShow[i] += d * Math.min(1, dt * 2.5); anim = true; }
        this.strawShow[i] += (this.strawVis[i] - this.strawShow[i]) * Math.min(1, dt * 4);
        this.decor[i].children.forEach((c) => { if (c.userData.grow < 1) { c.userData.grow = Math.min(1, c.userData.grow + dt * 2.5); const e = 1 - Math.pow(1 - c.userData.grow, 3); c.scale.setScalar(Math.max(0.01, e * (1 + Math.sin(e * Math.PI) * 0.15))); } if (c.userData.spin) c.userData.spin.rotation.z += dt; });
      }
      const dm = this.dummy, wind = 1 + Math.sin(t * 0.4) * 0.4;
      this.sets.forEach((s) => {
        s.base.forEach((b, k) => {
          const g = this.growth[b.pi], h = this.hShow[b.pi], dead = 1 - h;
          const sway = Math.sin(t * 1.7 + b.ph + b.x * 0.25) * 0.07 * wind * h;
          const droop = h < 0.6 ? (k % 2 ? 1 : -1) * (0.6 - h) * 1.6 : 0;
          const sc = b.s * Math.max(0.02, g) * (0.65 + 0.35 * h);
          dm.position.set(b.x, b.y, b.z); dm.rotation.set(sway * 0.6 + b.lean, b.ry, sway + droop); dm.scale.set(sc, sc, sc); dm.updateMatrix(); s.stems.setMatrixAt(k, dm.matrix);
          this.m4.copy(dm.matrix); this.tTop.makeTranslation(0, s.cer ? s.stemH + 0.12 : s.stemH, 0); this.m4.multiply(this.tTop); s.heads.setMatrixAt(k, this.m4);
          if (anim) { this.col.copy(s.stemC).lerp(this.col2.setHex(0xa8915a), dead * 0.95); s.stems.setColorAt(k, this.col); this.col.copy(s.headC).lerp(this.col2.setHex(0xc9a66a), dead * 0.95); s.heads.setColorAt(k, this.col); }
        });
        s.stems.instanceMatrix.needsUpdate = true; s.heads.instanceMatrix.needsUpdate = true;
        if (anim && s.stems.instanceColor) { s.stems.instanceColor.needsUpdate = true; s.heads.instanceColor.needsUpdate = true; }
      });
      this.strawBase.forEach((b, k) => { const pi = Math.floor(k / 24), v = this.strawShow[pi], show = v > 0.05 && (k % 24) / 24 < Math.min(1, v);
        dm.position.set(b.x, show ? b.y + (v > 1.2 ? 0.05 * (k % 3) : 0) : -5, b.z); dm.rotation.set(0, b.ry, 0); dm.scale.set(1, v > 1.2 ? 2.2 : 1, v > 1.2 ? 1.6 : 1); dm.updateMatrix(); this.straw.setMatrixAt(k, dm.matrix); });
      this.straw.instanceMatrix.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------ small UI helpers
  const ch = (a, v, on, txt, extra = "") => `<button class="x3chip ${on ? "on" : ""}" data-act="g" data-a="${a}" data-v="${v}" ${extra}>${on ? '<span class="ck"></span>' : ""}${txt}</button>`;
  const lab = (t) => `<span class="x3lab">${t}</span>`;
  const go = (a, txt, enabled = true) => enabled ? `<button class="x3go x3full" data-act="x3end" data-a="${a}">${txt} ${A.fwd()}</button>` : `<button class="x3go x3full" disabled>${txt}</button>`;
  const step = (a, txt, enabled = true) => enabled ? `<button class="x3go x3full alt" data-act="g" data-a="${a}">${txt} ${A.fwd()}</button>` : `<button class="x3go x3full" disabled>${txt}</button>`;
  const stat = (k, v, cls = "") => `<span class="x3stat ${cls}"><small>${k}</small><b>${v}</b></span>`;
  const obs = () => `<span class="obs">${L("رصد ناسا", "NASA observed")}</span>`, hyp = () => `<span class="hyp">${L("افتراضي", "Hypothetical")}</span>`;
  const cropIco = (k) => { const cer = X.CEREAL.includes(k), c = { wheat: "#ffc83a", barley: "#dcc770", oat: "#b5ea86", lentil: "#6cc04a", chickpea: "#9be070", faba: "#58ad38", vetch: "#7a5fa0" }[k];
    return `<svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true">${cer ? [8, 17, 26].map((x) => `<path d="M${x} 29V12" stroke="#d9a93a" stroke-width="2"/><ellipse cx="${x}" cy="9" rx="3" ry="7" fill="${c}"/>`).join("") : `<path d="M17 29V16" stroke="#6f7a34" stroke-width="2"/><circle cx="11" cy="16" r="7" fill="#4a9e2f"/><circle cx="22" cy="13" r="8" fill="${c}"/><circle cx="16" cy="8" r="6" fill="#9be070"/>`}</svg>`; };
  const prevOf = (i, plan) => (i === 0 ? GM.lastCrop() : plan[0] || GM.lastCrop());

  // ============================================================ LEVEL DEFINITIONS (scene + dock + data)
  const DEF = {};

  DEF["2"] = {
    grid: [4, 3], weather: "day",
    goal: () => L("اختر محصولَي الموسمين القادمين", "Pick the crops for the next two seasons"),
    sync(f) { const s = st(), k = s.plan[s.active] || s.plan[0]; f.setCrops(() => k); f.setHealth(() => 1); for (let i = 0; i < f.n; i++) f.setStraw(i, k ? 0 : 1); },
    ctl() {
      const s = st();
      return `<div class="x3slots">${[0, 1].map((i) => `<button class="x3slot ${s.active === i ? "on" : ""} ${s.plan[i] ? "full" : ""}" data-act="g" data-a="slot" data-i="${i}"><small>${L("الموسم", "Season")} ${i + 1}</small><b>${s.plan[i] ? cname(s.plan[i]) : L("اختر…", "Pick…")}</b></button>`).join("")}</div>
        <div class="x3row x3cards">${CROPS.map((k) => { const su = GM.suitability(k, prevOf(s.active, s.plan)); return `<button class="x3crop ${s.plan[s.active] === k ? "on" : ""}" data-act="g" data-a="open" data-v="${k}">${cropIco(k)}<b>${cname(k)}</b>${GM.lvlBadge(su.level)}</button>`; }).join("")}</div>
        ${go("end", L("ثبّت الخطة", "Lock in the plan"), s.plan[0] && s.plan[1])}`;
    },
    data() {
      const s = st(), prev = prevOf(s.active, s.plan);
      return `<b>${L("الماء الكافي من المطر لكل محصول", "Share of water needs met by rain")} ${obs()}</b><div class="note">${L(`بعد ${cname(prev)} · 30 موسمًا (1995–2025) · نقطة ناسا POWER واحدة`, `After ${cname(prev).toLowerCase()} · 30 seasons (1995–2025) · one NASA POWER point`)}</div>
        <table class="x3tab"><tr><th></th><th>${L("متوسط", "Average")}</th><th>${L("سنوات جافة", "Dry years")}</th><th>${L("الحاجة", "Need")}</th></tr>${CROPS.map((k) => { const su = GM.suitability(k, prev); return `<tr><td>${cname(k)}</td><td>${pct(su.st.ws)}</td><td>${pct(su.st.dry)}</td><td>${GM.demandMm(k)} ${L("ملم", "mm")}</td></tr>`; }).join("")}</table>`;
    },
  };

  DEF["3"] = {
    grid: [4, 3], weather: "dry",
    goal: () => L("وزّع 3 حصص ماء لإنقاذ المحصول", "Spend 3 water shares to save the crop"),
    sync(f, rt) {
      const s = st(), y = LEV("3").calc(s), used = Object.values(s.alloc).reduce((a, b) => a + b, 0);
      f.setCrops(() => s.crop); f.setHealth(() => Math.min(1, y * 1.35));
      for (let i = 0; i < f.n; i++) { f.setSoil(i, f.soilHex, y < 0.3 ? "crack" : "furrow"); f.setStraw(i, s.mulch ? 1.6 : 0);
        f.setDecor(i, used ? (s.method === "drip" ? ["drip"] : s.method === "sprinkler" ? (i % 3 === 1 ? ["sprinkler"] : []) : i % 4 === 0 ? ["flood"] : []) : []); }
      if (rt.lastUsed != null && used > rt.lastUsed) f.centers.forEach((c) => rt.parts.emit(c.x, 3.5, c.z, 14, 0x4fb2f0, 3, 0.5, 12, 0.9));
      rt.lastUsed = used;
    },
    ctl() {
      const s = st(), rec = s.mulch ? s.mul : s.base, eff = { drip: 0.9, sprinkler: 0.75, flood: 0.6 }[s.method], used = Object.values(s.alloc).reduce((a, b) => a + b, 0);
      const ms = rec.months.map((mo, m) => ({ mo, m })).filter((o) => o.mo.kc !== null), mx = Math.max(...ms.map((o) => o.mo.demand), 1);
      const y = LEV("3").calc(s), y0 = LEV("3").calc({ ...s, alloc: {}, mulch: false });
      return `<div class="x3stats">${stat(L("المردود", "Yield"), pct(y), y > 0.5 ? "good" : y > 0.3 ? "warn" : "bad")}${stat(L("بدون ماء", "No water"), pct(y0))}${stat(L("الحصص", "Shares"), `${s.tokens - used}/${s.tokens}`)}</div>
        <div class="x3months">${ms.map(({ mo, m }) => { const add = (s.alloc[m] || 0) * 30 * eff, got = Math.min(mo.demand, mo.aet + add), base = Math.min(mo.aet, mo.demand);
          return `<button class="x3m ${m === rec.flowerMonth ? "fl" : ""}" data-act="g" data-a="tok" data-m="${m}" aria-label="${mName(m)}"><span class="tk">${s.alloc[m] ? "💧".repeat(s.alloc[m]) : ""}</span><span class="bar" style="height:${Math.round(mo.demand / mx * 100)}%"><i style="height:${Math.round(base / mo.demand * 100)}%"></i><i class="w" style="height:${Math.round((got - base) / mo.demand * 100)}%"></i></span><small>${mName(m).slice(0, 3)}</small></button>`; }).join("")}</div>
        <div class="x3row">${ch("method", "drip", s.method === "drip", L("تنقيط", "Drip"))}${ch("method", "sprinkler", s.method === "sprinkler", L("رش", "Sprinkler"))}${ch("method", "flood", s.method === "flood", L("غمر", "Flood"))}${ch("mulch", "1", s.mulch, L("غطاء تبن", "Mulch"))}<button class="x3chip" data-act="g" data-a="clear">${L("مسح", "Clear")}</button></div>
        ${go("run", L("شغّل الموسم", "Run the season"), used > 0)}`;
    },
    data() {
      const s = st(), l = GM.loc(), rec = s.mulch ? s.mul : s.base;
      return `<b>${L(`موسم ${D.seasons[s.s]}`, `Season ${D.seasons[s.s]}`)} ${obs()}</b><div class="note">${L(`مطر أكتوبر–ماي ${l.summary.rain_oct_may[s.s]} ملم مقابل متوسط ${l.summary.rain_mean} ملم. الحصص (30 ملم) افتراضية. الكفاءة: تنقيط 90%، رش 75%، غمر 60%.`, `Oct–May rain ${l.summary.rain_oct_may[s.s]} mm vs ${l.summary.rain_mean} mm average. Water shares (30 mm) are hypothetical. Efficiency: drip 90%, sprinkler 75%, flood 60%.`)}</div>
        <table class="x3tab"><tr><th></th><th>${L("الحاجة", "Need")}</th><th>${L("من المطر والتربة", "From rain & soil")}</th><th>${L("العجز", "Deficit")}</th></tr>${rec.months.map((mo, m) => mo.kc === null ? "" : `<tr${m === rec.flowerMonth ? ' class="fl"' : ""}><td>${mName(m)}${m === rec.flowerMonth ? " 🌼" : ""}</td><td>${Math.round(mo.demand)}</td><td>${Math.round(Math.min(mo.aet, mo.demand))}</td><td>${Math.round(Math.max(0, mo.demand - mo.aet))}</td></tr>`).join("")}</table><div class="note">${L("ملم · محرك الماء FAO-56/FAO-33", "mm · FAO-56 / FAO-33 water engine")}</div>`;
    },
  };

  DEF["4"] = {
    grid: [4, 3], weather: "heat",
    goal: () => L("أبعد الإزهار عن موجة الحر", "Keep flowering away from the heatwave"),
    sync(f, rt) { const s = st(), r = LEV("4").run(s); f.setCrops(() => s.crop); f.setHealth(() => Math.min(1, r.yieldIdx * 1.3)); for (let i = 0; i < f.n; i++) f.setSoil(i, f.soilHex, r.yieldIdx < 0.3 ? "crack" : "furrow"); rt.haze = true; },
    ctl() {
      const s = st(), r = LEV("4").run(s);
      return `<div class="x3stats">${stat(L("ضرر الحر", "Heat damage"), pct(r.heat), r.heat > 0.1 ? "bad" : "good")}${stat(L("المردود", "Yield"), pct(r.yieldIdx), r.yieldIdx > 0.5 ? "good" : "warn")}${stat(L("الإزهار", "Flowers"), r.flowerMonth != null ? mName(r.flowerMonth) : "—")}</div>
        ${lab(L("المحصول", "Crop"))}<div class="x3row">${s.crops.map((k) => ch("crop", k, s.crop === k, cname(k))).join("")}</div>
        ${lab(L("موعد البذر", "Sowing"))}<div class="x3row">${ch("sow", "early", s.sowing === "early", L("مبكر · أكتوبر", "Early · Oct"))}${ch("sow", "normal", s.sowing === "normal", L("عادي · نوفمبر", "Normal · Nov"))}${ch("sow", "late", s.sowing === "late", L("متأخر · ديسمبر", "Late · Dec"))}${GM.farmE().water ? ch("water", "1", s.water, L("سقية عند الإزهار", "Water at flowering")) : ""}</div>
        ${go("lock", L("ثبّت الخطة", "Lock in the plan"))}`;
    },
    data() {
      const s = st(), l = GM.loc(), r = LEV("4").run(s), hot = l.hot[s.s].slice(0, 10), mx = Math.max(...hot, 1);
      const start = r.months.findIndex((x) => x.kc !== null), end = r.months.reduce((a, x, i) => (x.kc !== null ? i : a), start);
      return `<b>${L(`أيام فوق 31° · ${D.seasons[s.s]}`, `Days above 31°C · ${D.seasons[s.s]}`)} ${obs()}</b>
        <div class="x3heat">${hot.map((h, m) => `<div><span class="hb" style="height:${Math.round(h / mx * 52) + 2}px;background:${h >= 10 ? "#e8483d" : h >= 4 ? "#ff9a3d" : "#e8d9a8"}"></span><span class="cb" style="background:${m >= start && m <= end ? (m === r.flowerMonth ? "#e8552f" : "#6cc04a") : "transparent"}"></span><small>${mName(m).slice(0, 3)}</small><em>${h}</em></div>`).join("")}</div>
        <div class="legend2"><span><i style="background:#6cc04a"></i>${L("المحصول في الحقل", "Crop in field")}</span><span><i style="background:#e8552f"></i>${L("الإزهار", "Flowering")}</span></div>
        <div class="note">${L("الملاءمة الحرارية = المحصول يناسب مناخك عمومًا. إجهاد الحر = الحر يصادف مرحلة حساسة كالإزهار.", "Temperature suitability = the crop fits your climate overall. Heat stress = heat hits a sensitive stage like flowering.")}</div>`;
    },
  };

  DEF["5"] = {
    grid: [5, 4], weather: "day", slope: 0.28, tap: (i) => GM.LEVELS["5"].on("tile", { i: String(i) }),
    goal: () => L("احمِ القطع المنحدرة قبل العاصفة", "Protect the steep plots before the storm"),
    sync(f, rt) {
      const s = st(), d5 = LEV("5"), colr = (v) => (v > 0.9 ? 0xb5674a : v > 0.6 ? 0xc98e62 : v > 0.4 ? 0xc9b37a : 0x9fb46a);
      f.setCrops((i) => (s.prot[i] === "cover" ? "vetch" : null)); f.setHealth(() => 1);
      for (let i = 0; i < f.n; i++) { const r = Math.floor(i / 5), v = d5.tileRisk(s, i); f.setSoil(i, colr(v), "furrow"); f.setStraw(i, s.prot[i] === "mulch" ? 1.6 : 0); f.setDecor(i, [...(s.prot[i] === "barrier" ? ["barrier"] : []), ...(s.contour[r] ? ["contour"] : [])]); }
      if (s.stormed && rt.w.weather !== "storm") rt.w.setWeather("storm");
      rt.rain = !!s.stormed; rt.runoff = s.stormed ? f.centers.map((c, i) => (d5.tileRisk(s, i) > 0.6 ? c : null)).filter(Boolean) : null;
    },
    ctl() {
      const s = st(), left = s.budget - LEV("5").used(s), T = [["mulch", "🌾", L("غطاء تبن", "Mulch"), 1], ["cover", "🌱", L("غطاء نباتي", "Cover crop"), 1], ["barrier", "🌳", L("حاجز", "Barrier"), 1], ["contour", "〰", L("كنتوري (صف)", "Contour (row)"), 2]];
      return `<div class="x3stats">${stat(L("نقاط العمل", "Action points"), `${left}/${s.budget}`, left ? "" : "warn")}${stat(L("الهدف", "Goal"), L("المس القطع", "Tap plots"))}</div>
        ${s.stormed ? "" : `<div class="x3row">${T.map(([k, e, n, c]) => `<button class="x3tool2 ${s.tool === k ? "on" : ""}" data-act="g" data-a="tool" data-v="${k}"><span>${e}</span>${n}<small>${c} ${L("نقطة", "pt")}</small></button>`).join("")}</div>`}
        ${s.stormed ? go("end", L("النتيجة", "See the result")) : step("storm", L("أطلق العاصفة", "Start the storm"))}`;
    },
    data() { const s = st(), l = GM.loc(); return `<b>${L("العاصفة", "The storm")} ${hyp()}</b><div class="note">${L(`أعلى مطر غزير سجّلته ناسا في شهر واحد هنا: ${s.maxHeavy} ملم ${""}. الانحدار ${l.slope}% (NASADEM). الصف الخلفي هو الأعلى والأكثر انحدارًا. الألوان مستويات خطر نسبية وليست قياسًا.`, `Highest heavy rain NASA recorded here in one month: ${s.maxHeavy} mm. Slope ${l.slope}% (NASADEM). The back row is highest and steepest. Colours are relative risk levels, not measurements.`)}</div>
      <div class="legend2"><span><i style="background:#b5674a"></i>${L("خطر عالٍ", "High")}</span><span><i style="background:#c9b37a"></i>${L("متوسط", "Medium")}</span><span><i style="background:#9fb46a"></i>${L("منخفض", "Low")}</span></div>`; },
  };

  DEF["6"] = {
    grid: [4, 3], weather: "day",
    goal: () => L("وازن الإنتاج والآزوت والماء بـ100 نقطة", "Balance yield, nitrogen and water with 100 points"),
    sync(f) { const s = st(); f.setCrops((i) => s.seq[Math.floor(i / 4)]); f.setHealth(() => 0.95);
      for (let i = 0; i < f.n; i++) { const r = Math.floor(i / 4), inp = s.inp[r]; f.setDecor(i, inp === "n" && i % 4 === 0 ? ["nbag"] : inp === "manure" && i % 2 === 0 ? ["manure"] : inp === "drip" ? ["drip"] : []); } },
    ctl() {
      const s = st(), d6 = LEV("6"), spent = s.inp.reduce((a, k) => a + d6.cost[k], 0), sc = d6.eval(s);
      const IN = [["none", "—"], ["n", "N"], ["manure", "🐄"], ["drip", "💧"]];
      return `<div class="x3stats">${stat(L("الميزانية", "Budget"), `${spent}/100`, spent > 100 ? "bad" : "")}${stat(L("إنتاج", "Yield"), sc.production)}${stat(L("آزوت", "N"), sc.fertilizer)}${stat(L("ماء", "Water"), sc.water)}</div>
        ${s.seq.map((k, i) => `<div class="x3seas"><button class="x3cyc" data-act="x3cycle" data-i="${i}" aria-label="${L("غيّر المحصول", "Change crop")}">${cropIco(k)}<span><small>${L("الموسم", "Season")} ${i + 1}</small><b>${cname(k)} ↻</b></span></button>${IN.map(([v, t]) => `<button class="x3in ${s.inp[i] === v ? "on" : ""}" data-act="g" data-a="inp" data-i="${i}" data-v="${v}" title="${v}">${t}${d6.cost[v] ? `<small>${d6.cost[v]}</small>` : ""}</button>`).join("")}</div>`).join("")}
        ${go("end", L("ثبّت الخطة", "Lock in the plan"), spent <= 100)}`;
    },
    data() { return `<b>${L("المدخلات", "Inputs")}</b><div class="note">${L("N = سماد آزوتي (30)، 🐄 = سماد عضوي (25)، 💧 = تنقيط (35). المؤشرات من المحرك على 30 موسمًا من ناسا. لا أسعار، والبقوليات لا تعوّض كل العناصر.", "N = nitrogen fertilizer (30), 🐄 = manure (25), 💧 = drip (35). Indicators come from the engine over 30 NASA seasons. No prices, and legumes do not replace every nutrient.")}</div>`; },
  };

  DEF["7"] = {
    grid: [4, 3], weather: "day",
    goal: () => L("3 مواسم حقيقية بطقس مخفي: تكيّف!", "3 real seasons, hidden weather: adapt!"),
    sync(f, rt) {
      const s = st(), last = s.results[s.results.length - 1];
      if (!last) { f.setCrops(() => s.pick.crop); f.setHealth(() => 0.95); if (rt.w.weather !== "day") rt.w.setWeather("day"); rt.haze = false; return; }
      const fresh = rt.lastRound !== s.round; rt.lastRound = s.round;
      const env = last.rec.heat > 0.1 ? "heat" : last.y < 0.45 ? "dry" : "day";
      if (s.round < 3 && !fresh) { f.setCrops(() => s.pick.crop); f.setHealth(() => 0.95); return; }
      f.setCrops(() => last.crop); f.setHealth(() => Math.min(1, last.y * 1.3)); rt.w.setWeather(env); rt.haze = env === "heat";
      for (let i = 0; i < f.n; i++) f.setSoil(i, f.soilHex, last.y < 0.3 ? "crack" : "furrow");
      if (fresh) setTimeout(() => { if (RT && st().round < 3) { f.setCrops(() => st().pick.crop); f.setHealth(() => 0.95); rt.w.setWeather("day"); rt.haze = false; for (let i = 0; i < f.n; i++) f.setSoil(i, f.soilHex, "furrow"); } }, 3200);
    },
    ctl() {
      const s = st();
      const pills = `<div class="x3row">${s.results.map((r, i) => `<span class="x3pill ${r.y > 0.5 ? "good" : r.y > 0.3 ? "warn" : "bad"}">${i + 1} · ${cname(r.crop)} ${pct(r.y)}</span>`).join("")}</div>`;
      if (s.round >= 3) return `${pills}${go("end", L("النتيجة النهائية", "Final result"))}`;
      const p = s.pick;
      return `<div class="x3stats">${stat(L("الجولة", "Round"), `${s.round + 1}/3`)}${stat(L("الموسم", "Season"), D.seasons[s.seasons[s.round]])}${stat(L("قبلها", "Before"), cname(s.prev))}</div>${s.results.length ? pills : ""}
        <div class="x3row">${CROPS.map((k) => ch("crop", k, p.crop === k, cname(k))).join("")}</div>
        <div class="x3row">${ch("sow", "early", p.sowing === "early", L("مبكر", "Early"))}${ch("sow", "normal", p.sowing === "normal", L("عادي", "Normal"))}${ch("sow", "late", p.sowing === "late", L("متأخر", "Late"))}${s.tokens ? ch("water", "1", p.water, `💧 ${s.tokens}`) : ""}</div>
        ${step("play", L("اكشف الموسم", "Reveal the season"))}`;
    },
    data() { const s = st(); return `<b>${L("المواسم المكشوفة", "Revealed seasons")} ${obs()}</b>${s.results.length ? `<table class="x3tab">${s.results.map((r) => `<tr><td>${D.seasons[r.s]}</td><td>${cname(r.crop)}</td><td>${pct(r.y)}</td><td>${r.events}</td></tr>`).join("")}</table>` : `<div class="note">${L("الطقس مخفي حتى تقرّر. المواسم الثلاثة الأخيرة المرصودة من ناسا.", "Weather stays hidden until you decide. The last three observed NASA seasons.")}</div>`}`; },
  };

  DEF["F"] = {
    grid: [4, 3], weather: "dusk",
    goal: () => (st().phase === "investigate" ? L("حقّق: ما الأسباب التي تدعمها الأدلة؟", "Investigate: which causes does the evidence support?") : L("ابنِ خطة التعافي", "Build a recovery plan")),
    sync(f, rt) {
      const s = st();
      if (s.phase === "investigate") { f.setCrops(() => s.crop); f.setHealth(() => 0.03); for (let i = 0; i < f.n; i++) f.setSoil(i, 0xa98a62, "crack"); rt.dust = true; return; }
      const r2 = GM.seasonRun(s.fix.crop, s.s, { prev: s.prev, sowing: s.fix.sowing, residue: s.fix.residue }); rt.dust = false;
      if (rt.w.weather !== (r2.yieldIdx > 0.4 ? "day" : "dry")) rt.w.setWeather(r2.yieldIdx > 0.4 ? "day" : "dry");
      f.setCrops(() => s.fix.crop); f.setHealth(() => Math.min(1, r2.yieldIdx * 1.4));
      for (let i = 0; i < f.n; i++) { f.setSoil(i, f.soilHex, r2.yieldIdx < 0.3 ? "crack" : "furrow"); f.setStraw(i, s.fix.residue === "kept" ? 1 : 0); }
    },
    ctl() {
      const s = st();
      if (s.phase === "investigate") return `<div class="x3stats">${stat(L("الموسم", "Season"), D.seasons[s.s])}${stat(cname(s.crop), pct(s.rec.yieldIdx), "bad")}</div>
        <div class="x3ev">${s.ev.map((e) => `<button class="x3evb ${s.sel[e.k] ? "on" : ""}" data-act="x3ev" data-v="${e.k}" aria-pressed="${!!s.sel[e.k]}">${s.sel[e.k] ? '<span class="ck"></span>' : ""}${e.t}</button>`).join("")}</div>
        <div class="note x3hint">${L("المس دليلًا ليقرأه عمّي صالح ويختاره. الأرقام كاملة في «البيانات».", "Tap a clue: Ammi Salah reads it and marks it. Full numbers are under Data.")}</div>
        ${step("conclude", L("أكّد التحقيق", "Confirm the investigation"), Object.values(s.sel).some(Boolean))}`;
      const r2 = GM.seasonRun(s.fix.crop, s.s, { prev: s.prev, sowing: s.fix.sowing, residue: s.fix.residue });
      return `<div class="x3stats">${stat(L("قبل", "Before"), pct(s.rec.yieldIdx), "bad")}${stat(L("بعد خطتك", "With your plan"), pct(r2.yieldIdx), r2.yieldIdx > s.rec.yieldIdx ? "good" : "bad")}</div>
        <div class="x3row">${CROPS.map((k) => ch("fcrop", k, s.fix.crop === k, cname(k))).join("")}</div>
        <div class="x3row">${ch("fsow", "early", s.fix.sowing === "early", L("مبكر", "Early"))}${ch("fsow", "normal", s.fix.sowing === "normal", L("عادي", "Normal"))}${ch("fsow", "late", s.fix.sowing === "late", L("متأخر", "Late"))}${ch("fres", "kept", s.fix.residue === "kept", L("ترك البقايا", "Keep residue"))}${ch("fres", "removed", s.fix.residue === "removed", L("إزالة", "Remove"))}</div>
        ${go("end", L("ثبّت خطة التعافي", "Confirm the recovery plan"))}`;
    },
    data() { const s = st(); return `<b>${L("الأدلة", "Evidence")} ${obs()}</b>${s.ev.map((e) => `<div class="x3evd"><b>${e.t}</b><span>${e.v}</span></div>`).join("")}`; },
  };

  DEF["8"] = {
    grid: [4, 4], weather: "soil", tap: (i) => GM.LEVELS["8"].on("tile", { i: String(i) }),
    goal: () => L("عالج القطع المُنهكة (النقاط البيضاء)", "Treat the tired plots (white dots)"),
    sync(f) {
      const s = st(), map = { legume: "lentil", diverse: "faba", same: "wheat" };
      f.setCrops((i) => map[s.act[i]] || null); f.setHealth((i) => (s.act[i] === "same" ? 0.55 : 1));
      for (let i = 0; i < f.n; i++) { const t = s.act[i], tired = s.tired.has(i); f.setSoil(i, tired && !t ? 0xc2a87a : t && t !== "same" && t !== "moreN" ? 0x7a5638 : f.soilHex, tired && !t ? "dots" : "furrow"); f.setDecor(i, t === "compost" ? ["compost"] : t === "moreN" ? ["nbag"] : []); }
    },
    ctl() {
      const s = st(), T = LEV("8").tools(), used = Object.keys(s.act).length, em = { legume: "🌱", compost: "🍂", diverse: "🔀", moreN: "N", same: "🌾" };
      return `<div class="x3stats">${stat(L("التدخلات", "Actions"), `${used}/8`)}${stat(L("قطع مُنهكة", "Tired plots"), s.tired.size)}</div>
        <div class="x3row">${T.map(([k, n, v]) => `<button class="x3tool2 ${s.tool === k ? "on" : ""}" data-act="g" data-a="tool" data-v="${k}"><span>${em[k]}</span>${n}<small class="${v > 0 ? "pos" : v < 0 ? "neg" : ""}">${v > 0 ? L("إيجابي", "positive") : v < 0 ? L("سلبي", "negative") : L("محايد", "neutral")}</small></button>`).join("")}</div>
        ${go("end", L("قيّم خطتي", "Evaluate my plan"), used > 0)}`;
    },
    data() { const s = st(); return `<b>${L("لماذا هذه القطع؟", "Why these plots?")}</b><div class="note">${L(`تاريخك فيه ${s.cereals} موسم حبوب من ${s.known}. القطع المُنهكة تقدير نوعي من تاريخ محاصيلك، وليست تحليل تربة. التأثيرات نوعية لأننا لا نملك نموذجًا ديناميكيًا للتربة.`, `Your history has ${s.cereals} cereal seasons out of ${s.known}. Tired plots are a qualitative estimate from your crop history, not a soil test. Effects are qualitative because we have no dynamic soil model.`)}</div>`; },
  };

  DEF["9"] = {
    grid: [4, 3], weather: "storm",
    goal: () => L("غطِّ التربة قبل أمطار الخريف الغزيرة", "Cover the soil before heavy autumn rain"),
    sync(f, rt) {
      const s = st(), sc = LEV("9").ev(s).scores.erosion, fallow = s.plan.includes("fallow");
      f.setCrops((i) => (s.cover && fallow && i % 2 === 0 ? "vetch" : null)); f.setHealth(() => 1);
      for (let i = 0; i < f.n; i++) { f.setSoil(i, f.soilHex, s.till ? "furrow" : "flat"); f.setStraw(i, s.residue === "kept" ? 1.4 : s.residue === "grazed" ? 0.5 : 0); }
      rt.rain = true; rt.runoff = sc < 55 ? f.centers.filter((_, i) => i % 3 !== 1) : null;
    },
    ctl() {
      const s = st(), sc = LEV("9").ev(s).scores;
      return `<div class="x3stats">${stat(L("حماية التربة", "Soil protection"), `${sc.erosion}/100`, sc.erosion > 60 ? "good" : sc.erosion > 40 ? "warn" : "bad")}${stat(L("صحة التربة", "Soil health"), sc.soil)}</div>
        ${lab(L("بعد الحصاد", "After harvest"))}<div class="x3row">${ch("res", "kept", s.residue === "kept", L("ترك البقايا", "Keep residue"))}${ch("res", "grazed", s.residue === "grazed", L("رعي معتدل", "Light grazing"))}${ch("res", "removed", s.residue === "removed", L("إزالة كاملة", "Remove all"))}</div>
        <div class="x3row">${ch("till", "1", s.till, L("حرث قبل الخريف", "Plough before autumn"))}${ch("till", "0", !s.till, L("بدون حرث", "No-till"))}${s.plan.includes("fallow") ? ch("cover", s.cover ? "0" : "1", s.cover, L("غطاء نباتي للبور", "Cover the fallow")) : ""}</div>
        ${go("end", L("ثبّت الخطة", "Lock in the plan"))}`;
    },
    data() {
      const l = GM.loc(), n = l.rain.length, hv = Array(12).fill(0); for (let s2 = 0; s2 < n; s2++) for (let m = 0; m < 12; m++) hv[m] += l.heavy[s2][m] / n; const mx = Math.max(...hv, 1);
      return `<b>${L("المطر الغزير حسب الشهر", "Heavy rain by month")} ${obs()}</b><div class="x3heat">${hv.map((h, m) => `<div><span class="hb" style="height:${Math.round(h / mx * 52) + 2}px;background:#2b8fe0"></span><small>${mName(m).slice(0, 3)}</small><em>${Math.round(h)}</em></div>`).join("")}</div><div class="note">${L(`متوسط 30 موسمًا (ملم) · الانحدار ${l.slope}% (NASADEM). الانجراف يبدأ عندما يلتقي المطر الغزير بتربة عارية.`, `30-season average (mm) · slope ${l.slope}% (NASADEM). Erosion starts when heavy rain meets bare soil.`)}</div>`;
    },
  };

  DEF["10"] = {
    grid: [4, 3], weather: "soil",
    goal: () => L("اختر 3 ممارسات تبني المادة العضوية", "Pick 3 practices that build organic matter"),
    sync(f, rt) {
      const sel = st().sel, burn = sel.includes("burn");
      f.setCrops((i) => (sel.includes("cover") && i % 2 === 0 ? "vetch" : sel.includes("legume") && i % 2 ? "lentil" : null)); f.setHealth(() => 1);
      for (let i = 0; i < f.n; i++) { f.setSoil(i, burn ? 0x3a332c : f.soilHex, sel.includes("notill") || sel.includes("residue") ? "flat" : "furrow"); f.setStraw(i, sel.includes("residue") ? 1.4 : 0); f.setDecor(i, sel.includes("manure") && i % 3 === 0 ? ["manure"] : []); }
      if (rt.w.weather !== (burn ? "dusk" : "soil")) rt.w.setWeather(burn ? "dusk" : "soil"); rt.smoke = burn;
    },
    ctl() {
      const s = st(), P = LEV("10").P();
      return `<div class="x3stats">${stat(L("المختار", "Chosen"), `${s.sel.length}/3`)}</div>
        <div class="x3wrap">${P.map(([k, n, v, tr]) => `<button class="x3chip ${s.sel.includes(k) ? "on" : ""} ${v < 0 ? "neg" : ""}" data-act="g" data-a="sel" data-v="${k}" title="${tr}">${s.sel.includes(k) ? '<span class="ck"></span>' : ""}${n}</button>`).join("")}</div>
        ${go("end", L("ثبّت الخطة", "Lock in the plan"), s.sel.length === 3)}`;
    },
    data() { const so = GM.loc().soil, v = [1, 0.57, 0.44, 0.3, 0.17]; return `<b>${L("الكربون العضوي (SoilGrids)", "Organic carbon (SoilGrids)")} ${obs()}</b><div class="x3heat">${v.map((k, i) => `<div><span class="hb" style="height:${Math.round(k * 52)}px;background:#6e4527"></span><small>${["0–5", "5–15", "15–30", "30–60", "60–100"][i]}</small></div>`).join("")}</div><div class="note">${L(`السطح ≈ ${so.soc} غ/كغ (خلية 250 م)، والشكل تقريبي. التأثيرات نوعية؛ لا نموذج ديناميكي للكربون.`, `Topsoil ≈ ${so.soc} g/kg (250 m cell); depth shape approximate. Effects are qualitative; no dynamic carbon model.`)}</div>`; },
  };

  DEF["11"] = {
    grid: [3, 2], weather: "salt", tap: (i) => { RT.selPlot = i % 3; RT.api.render(); },
    goal: () => L("اختر محاصيل تتحمّل الملوحة (سيناريو افتراضي)", "Choose crops that cope with salt (hypothetical)"),
    sync(f) {
      const s = st(), d11 = LEV("11");
      f.setCrops((i) => s.plots[i % 3]); f.setHealth((i) => (s.plots[i % 3] ? Math.min(1, d11.yieldAt(s.plots[i % 3], s.ec) * 1.3) : 1));
      for (let i = 0; i < f.n; i++) { f.setSoil(i, s.ec >= 6 ? 0xd2c7ae : f.soilHex, s.ec >= 4 ? "salt" : "furrow"); f.setDecor(i, i % 3 === RT.selPlot && i < 3 ? ["ring"] : []); }
    },
    ctl() {
      const s = st(), sel = RT.selPlot, d11 = LEV("11");
      const mgs = [["monitor", L("مراقبة EC", "Monitor EC"), true], ["leach", L("غسيل الأملاح", "Leach salts"), GM.farmE().water], ["drain", L("تحسين الصرف", "Drainage"), true], ["more", L("سقي أكثر بماء مالح", "More salty water"), true]];
      return `<div class="x3stats"><span class="x3stat"><small>${L("الملوحة", "Salinity")} ${hyp()}</small><b><button class="x3pm" data-act="x3ec" data-d="-1">−</button> ${s.ec} dS/m <button class="x3pm" data-act="x3ec" data-d="1">+</button></b></span></div>
        <div class="x3slots three">${[0, 1, 2].map((i) => `<button class="x3slot ${sel === i ? "on" : ""} ${s.plots[i] ? "full" : ""}" data-act="x3plot" data-i="${i}"><small>${L("قطعة", "Plot")} ${i + 1}</small><b>${s.plots[i] ? `${cname(s.plots[i])} ${pct(d11.yieldAt(s.plots[i], s.ec))}` : L("اختر…", "Pick…")}</b></button>`).join("")}</div>
        <div class="x3row">${CROPS.map((k) => `<button class="x3chip ${s.plots[sel] === k ? "on" : ""}" data-act="g" data-a="plot" data-i="${sel}" data-v="${k}">${cname(k)}</button>`).join("")}</div>
        <div class="x3row">${mgs.map(([k, n, ok]) => `<button class="x3chip ${s.mg.includes(k) ? "on" : ""}" data-act="g" data-a="mg" data-v="${k}" ${ok ? "" : "disabled"}>${s.mg.includes(k) ? '<span class="ck"></span>' : ""}${n}</button>`).join("")}</div>
        ${go("end", L("قيّم خطتي", "Evaluate my plan"), s.plots.every(Boolean))}`;
    },
    data() { const s = st(), d11 = LEV("11"); return `<b>${L("المردود عند هذه الملوحة", "Yield at this salinity")} ${hyp()}</b><table class="x3tab">${CROPS.map((k) => `<tr><td>${cname(k)}</td><td>${pct(d11.yieldAt(k, s.ec))}</td></tr>`).join("")}</table><div class="note">${L("عتبات الملوحة من Maas & Hoffman 1977 وFAO-29 (تقريبية). الدورة وحدها لا تزيل الملوحة.", "Salt thresholds from Maas & Hoffman 1977 and FAO-29 (approximate). Rotation alone does not remove salinity.")}</div>`; },
  };

  // ============================================================ the shared 3D screen
  let RT = null;
  const TITLE_ICON = '<svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2z M7 3v12 M13 5v12" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>';
  const screen = () => {
    const id = LVd().id, def = LEV(id);
    return `<div class="x3 x3lv" id="x3">
      <canvas id="x3c" tabindex="0" aria-label="${L("مزرعتك ثلاثية الأبعاد", "Your 3D farm")}"></canvas><div class="x3vign"></div>
      <div class="x3top">
        <button class="x3b" data-act="g" data-a="leave" aria-label="${L("الخريطة", "Map")}">${TITLE_ICON}</button>
        <div class="x3title"><small>${id === "F" ? L("فصل خاص", "Special chapter") : L("المستوى", "Level") + " " + id}</small><b>${def.title()}</b></div>
        <button class="x3b" data-act="x3data" id="x3db" aria-expanded="false" aria-label="${L("البيانات", "Data")}">📊</button>
        <button class="x3b x3tea" data-act="g" data-a="hint" aria-label="${L("تلميح", "Hint")}"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10h2a2 2 0 0 1 0 4h-2 M8 3c0 2 2 2 2 4 M12 3c0 2 2 2 2 4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></button>
        <button class="x3b" data-act="x3mute" id="x3mute" aria-label="${L("الصوت", "Sound")}">${GM.G().mute ? "🔇" : "🔊"}</button>
      </div>
      <div class="x3goal" id="x3goal"></div>
      <div class="x3data" id="x3data" hidden></div>
      <div class="x3bub" id="x3bub" aria-live="polite"></div>
      <div class="x3cam"><button data-act="x3cam" data-d="-0.6" aria-label="${L("تدوير", "Rotate")}">↺</button><button data-act="x3cam" data-d="0.6" aria-label="${L("تدوير", "Rotate")}">↻</button></div>
      <div class="x3dock" id="x3dock"></div>
    </div>`;
  };
  const after = () => {
    cleanup();
    const id = LVd().id, def = LEV(id), D3 = DEF[id];
    def.init && def.init();
    document.body.classList.add("x3on");
    const w = new X.World($("x3c")); w.setWeather(D3.weather);
    const f = new Field2(w, { cols: D3.grid[0], rows: D3.grid[1], slope: D3.slope });
    const parts = new X.Particles(w, 900, 0.16), big = new X.Particles(w, 220, 1.0, 0.4);
    X.house(w, -f.W / 2 - 9, 2); const ir = S().farm.irrig; if (ir && ir !== "rain") X.tank(w, f.W / 2 + 6, -f.D / 2 + 1);
    w.tree(-f.W / 2 - 5, -f.D / 2 - 5, 1.3); w.tree(f.W / 2 + 5, f.D / 2 + 6, 1.1);
    const salah = new X.Salah(w, -f.W / 2 - 3, f.D / 2 + 1.5);
    RT = { id, w, f, parts, big, salah, selPlot: 0, rain: false, runoff: null, haze: false, dust: false, smoke: false, dataOpen: false };
    window.__say3 = (text, mood, tone, silent) => { salah.setMood(mood || "happy"); if (tone === "good") salah.play("celebrate", 1.4); else if (tone !== "hint" && mood === "happy") salah.play("talk", 2.2); X.bubble(text, tone || "n"); if (!silent) GM.speak(text); };
    const render = () => { if (!RT) return; $("x3dock").innerHTML = D3.ctl(); $("x3goal").textContent = D3.goal(); if (RT.dataOpen) $("x3data").innerHTML = `<button class="x3x" data-act="x3data" aria-label="${L("إخفاء", "Hide")}">✕</button>` + D3.data(); D3.sync(f, RT); };
    RT.api = { render };
    window.__draw3 = render;
    // camera framing: field in the upper part, dock below
    const span = Math.max(f.W, f.D);
    w.orb.radius = span * 4; w.orb.phi = 0.45; w.orb.theta = -0.5;
    w.flyTo({ radius: 14 + span * 1.05, phi: 0.92, theta: 0.7, target: new THREE.Vector3(0, 0.5, f.D * 0.42) }, 1.1);
    salah.play("wave", 3);
    render();
    setTimeout(() => { if (RT && RT.w === w) GM.say(def.intro(), "happy", "n"); }, X.RM ? 50 : 1200);
    // effects
    w.updaters.push(() => {
      if (!RT) return;
      if (RT.rain) for (let k = 0; k < 6; k++) parts.emit((Math.random() - 0.5) * (f.W + 8), 14, (Math.random() - 0.5) * (f.D + 8), 1, 0x7fa6c9, 0.2, -6, 30, 0.8);
      if (RT.runoff && Math.random() < 0.5) RT.runoff.forEach((c) => parts.emit(c.x, c.y + 0.1, c.z, 1, 0x6b3f1f, 1.2, 0.3, 2, 1.6, 0, 3.2));
      if (RT.haze && Math.random() < 0.4) parts.emit((Math.random() - 0.5) * f.W, 0.6, (Math.random() - 0.5) * f.D, 1, 0xffb36b, 0.6, 1.2, -0.6, 2.2);
      if (RT.dust && Math.random() < 0.3) big.emit((Math.random() - 0.5) * f.W, 0.6, (Math.random() - 0.5) * f.D, 1, 0xc8b08a, 2, 0.6, -0.2, 3, 1.2, 0);
      if (RT.smoke && Math.random() < 0.5) big.emit((Math.random() - 0.5) * f.W, 0.8, (Math.random() - 0.5) * f.D, 1, 0x5f5a55, 1, 1.4, -0.4, 3);
    });
    // input: orbit by drag, tap a plot or Ammi Salah
    const cv = $("x3c"); let drag = null;
    cv.addEventListener("pointerdown", (ev) => { cv.setPointerCapture(ev.pointerId); drag = { x: ev.clientX, y: ev.clientY, th: w.orbGoal.theta, ph: w.orbGoal.phi, moved: 0 }; });
    cv.addEventListener("pointermove", (ev) => { if (!drag) return; drag.moved = Math.max(drag.moved, Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y)); if (drag.moved > 6) { w.orbGoal.theta = drag.th - (ev.clientX - drag.x) * 0.006; w.orbGoal.phi = Math.max(0.4, Math.min(1.3, drag.ph - (ev.clientY - drag.y) * 0.004)); w.flySpeed = 9; } });
    cv.addEventListener("pointerup", (ev) => { const d = drag; drag = null; if (!d || d.moved > 6) return;
      const hits = w.pick(ev, [salah.hit, ...f.plots]); if (!hits.length) return; const o = hits[0].object;
      if (o === salah.hit) { salah.play("wave", 1.5); GM.say(D3.goal() + L(" · زر الشاي للتلميح!", " · The teapot gives hints!"), "happy", "n"); return; }
      const i = f.plotOf(o); if (i < 0) return;
      const c = f.centers[i]; parts.emit(c.x, c.y + 0.3, c.z, 10, 0xffe9a8, 2, 2, 6, 0.6); GM.snd("tap");
      if (D3.tap) D3.tap(i); else { salah.lookAt = c; salah.play("point", 1.6); }
    });
    cv.addEventListener("wheel", (ev) => { ev.preventDefault(); w.orbGoal.radius = Math.max(14, Math.min(70, w.orbGoal.radius + ev.deltaY * 0.03)); w.flySpeed = 6; }, { passive: false });
    // loop
    let last = performance.now();
    const loop = (now) => {
      if (!RT || RT.w !== w) return;
      if ($("x3c") !== w.canvas) { cleanup(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; w.frame(dt);
      const bb = $("x3bub"), dock = $("x3dock");
      if (bb && dock) { const p = w.project(salah.headPos()), bw = bb.offsetWidth, bh = bb.offsetHeight, maxTop = dock.getBoundingClientRect().top - bh - 12;
        bb.style.left = Math.max(8, Math.min(window.innerWidth - bw - 62, p.x - bw / 2)) + "px"; bb.style.top = Math.max(108, Math.min(maxTop, p.y - bh - 10)) + "px"; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  function cleanup() { if (!RT) return; try { RT.w.dispose(); } catch (e) { } RT = null; window.__say3 = null; window.__draw3 = null; document.body.classList.remove("x3on"); }

  Object.keys(DEF).forEach((id) => { A.SCREENS["l" + id + "x"] = screen; A.AFTER["l" + id + "x"] = after; });

  // ---------------- actions specific to the shell
  A.ACT.x3data = () => { if (!RT) return; RT.dataOpen = !RT.dataOpen; const el = $("x3data"), b = $("x3db"); el.hidden = !RT.dataOpen; b.setAttribute("aria-expanded", RT.dataOpen); b.classList.toggle("on", RT.dataOpen); $("x3goal").hidden = RT.dataOpen; GM.snd("tap"); RT.api.render(); };
  A.ACT.x3end = (d) => {
    if (!RT) return; const w = RT.w, id = RT.id; RT.salah.play("celebrate", 2.4); GM.snd("level");
    [0x6cc04a, 0xe8552f, 0x2f9bd6, 0xffe9a8].forEach((c) => RT.parts.emit(0, 8, 0, 90, c, 16, 5, 5, 2.2));
    w.flyTo({ radius: w.orbGoal.radius * 1.25, phi: 0.75, theta: w.orbGoal.theta + 1.2 }, 1.4);
    $("x3dock").classList.add("leaving");
    setTimeout(() => { if (RT && RT.w === w) A.ACT.g({ a: d.a }); }, X.RM ? 100 : 1500);
  };
  A.ACT.x3cycle = (d) => { if (!RT) return; const s = st(), i = +d.i, k = CROPS[(CROPS.indexOf(s.seq[i]) + 1) % CROPS.length]; GM.snd("tap"); GM.LEVELS["6"].on("crop", { i: String(i), v: k }); };
  A.ACT.x3ev = (d) => { if (!RT) return; const e = st().ev.find((x) => x.k === d.v); GM.snd("tap"); GM.LEVELS["F"].on("sel", { v: d.v }); if (e && st().sel[d.v]) GM.say(`<b>${e.t}:</b> ${e.v}`, e.unknown ? "worried" : "happy", "info"); };
  A.ACT.x3plot = (d) => { if (!RT) return; RT.selPlot = +d.i; GM.snd("tap"); RT.api.render(); };
  A.ACT.x3ec = (d) => { if (!RT) return; const s = st(); s.ec = Math.max(2, Math.min(10, s.ec + Number(d.d))); GM.snd("tap"); RT.api.render(); };
})();
