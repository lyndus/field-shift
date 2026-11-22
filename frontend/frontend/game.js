/* Field Shift – the farm adventure (levels 1–11 + crop-failure chapter).
   Game rules live here; every agronomic number comes from FSEngine (engine.js) and FS_DATA (NASA POWER, SoilGrids, NASADEM). */
(function () {
  "use strict";
  const A = window.FS_APP, E = window.FSEngine, DATA = window.FS_DATA, ART = window.FS_ART;
  const S = () => A.S;
  const L = (ar, en) => (S().lang === "en" ? en : ar);
  const esc = A.esc;
  const CK = A.CK;
  const CROPS = ["wheat", "barley", "oat", "lentil", "chickpea", "faba", "vetch"];
  const M12 = { ar: ["سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر", "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت"], en: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"] };
  const mName = (m) => M12[S().lang === "en" ? "en" : "ar"][m];
  const cname = (k) => A.t().crops[k] || k;
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const pct = (v) => Math.round(v * 100) + "%";
  const G = () => { const s = S(); if (!s.game) s.game = { levels: {}, plan: [], mute: false, risks: [] }; return s.game; };
  const loc = () => A.loc();
  const pname = () => (S().name || "").trim() || L("يا صديقي", "my friend");

  // ---------------------------------------------------------------- farm & engine helpers
  function farmE(ecOverride) {
    const f = S().farm, l = loc();
    return { paw100: { sandy: 60, clay: 130, loam: 150 }[f.soil] || l.soil.paw100, slope: l.slope != null ? l.slope : 3.5,
      water: ["medium", "high"].includes(f.water) && !!f.irrig && f.irrig !== "rain", ec: ecOverride != null ? ecOverride : null };
  }
  function lastCrop() {
    const f = S().farm;
    if (f.current && f.current !== "none" && CROPS.includes(f.current)) return f.current;
    const h = f.history.find((x) => x && x !== "unknown" && x !== "fallow");
    return h || "wheat";
  }
  const planCrop = (i) => (G().plan && G().plan[i]) || (i === 0 ? (lastCrop() === "wheat" ? "lentil" : "wheat") : "barley");
  // one crop in one real season, after a given previous crop
  function seasonRun(crop, s, o = {}) {
    const prev = o.prev && o.prev !== crop ? o.prev : (o.prev === crop ? crop : "fallow");
    const st = { seq: [CK[prev] || "fallow_grazed", CK[crop]], sowing: o.sowing || "normal", residue: o.residue || "grazed", irrigation: !!o.irr };
    const fm = o.farm || farmE(o.ec);
    if (o.irr) fm.water = true;
    const phase = (1 - (s % 2) + 2) % 2;
    return E.simulate(loc(), st, fm, phase)[s];
  }
  // 30-season statistics of a crop following `prev`
  function cropStats(crop, prev, ec) {
    const l = loc(), fm = farmE(ec), st = { seq: [CK[prev] || "fallow_grazed", CK[crop]], sowing: "normal", residue: "grazed", irrigation: fm.water };
    const ys = [], wss = [], dry = [], recs = []; let heat = 0, salt = 0, rot = 1;
    [0, 1].forEach((ph) => E.simulate(l, st, fm, ph).forEach((r, s) => {
      if ((s + ph) % 2 !== 1) return;
      ys.push(r.yieldIdx); wss.push(r.ws); recs.push(r); if (r.heat > 0.1) heat++; salt = Math.max(salt, r.salt || 0); rot = Math.min(rot, r.rotPen);
      if (l.summary.driest.includes(s)) dry.push(r.yieldIdx);
    }));
    const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    return { y: mean(ys), ws: mean(wss), heatRisk: heat / ys.length, dry: mean(dry), salt, rotPen: rot, n: ys.length };
  }
  function demandMm(crop) {
    const l = loc(), c = E.CROPS[CK[crop]]; let tot = 0;
    for (let s = 0; s < l.et0.length; s++) c.kc.forEach((k, i) => { const m = c.sow + i; if (m <= 9) tot += k * l.et0[s][m]; });
    return Math.round(tot / l.et0.length);
  }
  function suitability(crop, prev) {
    const st = cropStats(crop, prev), c = E.CROPS[CK[crop]], pc = E.CROPS[CK[prev]] || {};
    const flags = [];
    if (S().farm.system === "green") return { level: "na", st, flags: ["system"] };
    if (st.y < 0.45) flags.push("water");
    if (st.heatRisk > 0.35) flags.push("heat");
    if (st.rotPen < 1) flags.push("rotation");
    if (c.host >= 1 && pc.host >= 1) flags.push("broomrape");
    if (st.salt > 0.1) flags.push("salt");
    let level = "ok";
    if (flags.length >= 2 || st.y < 0.35) level = "high"; else if (flags.length === 1 || st.y < 0.55) level = "adj";
    return { level, st, flags };
  }
  const LVLNAME = { ok: ["مناسب", "Suitable"], adj: ["مناسب مع تعديلات", "Suitable with adjustments"], high: ["مخاطرة عالية", "High risk"], na: ["معلومات غير كافية", "Not enough information"] };
  const lvlBadge = (lv) => `<span class="badge b-${lv === "ok" ? "ok" : lv === "adj" ? "adj" : lv === "high" ? "high" : "na"}">${L(LVLNAME[lv][0], LVLNAME[lv][1])}</span>`;

  // ---------------------------------------------------------------- sound & calm ambient music
  let AC = null;
  function snd(type) {
    if (G().mute) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const now = AC.currentTime, tone = (f, t0, d, wave = "sine", vol = 0.12, f2) => {
        const o = AC.createOscillator(), g = AC.createGain(); o.type = wave; o.frequency.setValueAtTime(f, now + t0);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t0 + d);
        g.gain.setValueAtTime(vol, now + t0); g.gain.exponentialRampToValueAtTime(0.001, now + t0 + d); o.connect(g); g.connect(AC.destination); o.start(now + t0); o.stop(now + t0 + d + 0.02);
      };
      const noise = (t0, d, vol = 0.2) => { const b = AC.createBuffer(1, AC.sampleRate * d, AC.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
        const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(AC.destination); s.start(now + t0); };
      if (type === "tap") tone(660, 0, 0.06, "triangle", 0.08);
      if (type === "cut") { noise(0, 0.12, 0.12); tone(300, 0, 0.1, "square", 0.04, 150); }
      if (type === "good") { tone(523, 0, 0.12, "triangle"); tone(784, 0.1, 0.18, "triangle"); }
      if (type === "bad") { tone(260, 0, 0.18, "sawtooth", 0.07, 180); tone(196, 0.15, 0.25, "sawtooth", 0.06, 120); }
      if (type === "whoosh") noise(0, 0.5, 0.15);
      if (type === "crack") { noise(0, 0.25, 0.4); tone(90, 0, 0.3, "square", 0.1, 40); }
      if (type === "level") [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, "triangle", 0.1));
      if (type === "rain") noise(0, 1.2, 0.05);
    } catch (e) { }
  }

  // ---------------------------------------------------------------- Background game audio
  // Plays user-provided game audio (game_audio.mp3) during game screens only, respecting mute.
  const GAME_SCREENS = /^(lvl|l\d+x|lfx|map|lvlResult|report)$/;
  let gameAudio = null;

  function initGameAudio() {
    if (!gameAudio) {
      gameAudio = new Audio("game_audio.mp3");
      gameAudio.loop = true;
      gameAudio.volume = 0.45;
      gameAudio.preload = "auto";
    }
    return gameAudio;
  }

  function playCalmMusic() {
    const scr = (A.S && A.S.screen) || (S() && S().screen) || "";
    if (G().mute || !GAME_SCREENS.test(scr)) {
      return stopCalmMusic();
    }
    try {
      const audio = initGameAudio();
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } catch (e) {}
  }

  function stopCalmMusic() {
    try {
      if (gameAudio && !gameAudio.paused) {
        gameAudio.pause();
      }
    } catch (e) {}
  }

  function syncAudio(screen) {
    const scr = screen || (A.S && A.S.screen) || (S() && S().screen) || "";
    if (GAME_SCREENS.test(scr) && !G().mute) {
      playCalmMusic();
    } else {
      stopCalmMusic();
    }
  }

  document.addEventListener("pointerdown", () => {
    const scr = (A.S && A.S.screen) || (S() && S().screen) || "";
    if (GAME_SCREENS.test(scr) && !G().mute) {
      playCalmMusic();
    }
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (gameAudio && !gameAudio.paused) gameAudio.pause();
    } else {
      const scr = (A.S && A.S.screen) || (S() && S().screen) || "";
      if (GAME_SCREENS.test(scr) && !G().mute && gameAudio && gameAudio.paused) {
        gameAudio.play().catch(() => {});
      }
    }
  });

  function startAmbient() { }
  function stopAmbient() { }
  const pan = (x) => { if (!AC.createStereoPanner) return null; const p = AC.createStereoPanner(); p.pan.value = x; return p; };
  function out(node, x) { const p = pan(x); if (p) { node.connect(p); p.connect(ambBus); } else node.connect(ambBus); }
  function bird() { // 2–5 quick whistles, random pitch and side
    const now = AC.currentTime + 0.05, base = 2300 + Math.random() * 1800, n = 2 + (Math.random() * 4 | 0), x = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < n; i++) {
      const o = AC.createOscillator(), g = AC.createGain(), t0 = now + i * (0.09 + Math.random() * 0.07), d = 0.06 + Math.random() * 0.06;
      o.type = "sine"; o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t0); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t0 + d * 0.6); o.frequency.exponentialRampToValueAtTime(base * 0.85, t0 + d);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.012, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); out(g, x); o.start(t0); o.stop(t0 + d + 0.02);
    }
  }
  function crickets() {
    const now = AC.currentTime, x = Math.random() * 1.2 - 0.6, f = 4200 + Math.random() * 600;
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) {
      const o = AC.createOscillator(), g = AC.createGain(), t0 = now + k * 0.32 + i * 0.035;
      o.type = "square"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.0025, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
      o.connect(g); out(g, x); o.start(t0); o.stop(t0 + 0.03);
    }
  }
  function sheep() { // distant "baa": buzzy tone with vibrato through a vowel-ish band-pass
    const now = AC.currentTime, o = AC.createOscillator(), vib = AC.createOscillator(), vg = AC.createGain(), bp = AC.createBiquadFilter(), g = AC.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(340, now); o.frequency.linearRampToValueAtTime(300, now + 0.7);
    vib.frequency.value = 7; vg.gain.value = 14; vib.connect(vg); vg.connect(o.frequency);
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 3;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    o.connect(bp); bp.connect(g); out(g, Math.random() * 1.4 - 0.7); o.start(now); vib.start(now); o.stop(now + 0.8); vib.stop(now + 0.8);
  }
  function hen() { // a few soft clucks
    const now = AC.currentTime, x = Math.random() * 1.4 - 0.7;
    for (let i = 0; i < 3; i++) { const o = AC.createOscillator(), g = AC.createGain(), t0 = now + i * 0.18;
      o.type = "triangle"; o.frequency.setValueAtTime(700, t0); o.frequency.exponentialRampToValueAtTime(380, t0 + 0.08);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.008, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      o.connect(g); out(g, x); o.start(t0); o.stop(t0 + 0.1); }
  }
  function rainHiss() {
    const now = AC.currentTime, s = AC.createBufferSource(), hp = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf(5.5); hp.type = "highpass"; hp.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.02, now + 1); g.gain.exponentialRampToValueAtTime(0.0001, now + 5.3);
    s.connect(hp); hp.connect(g); out(g, 0); s.start(now); s.stop(now + 5.5);
  }

  function speak(text) {
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { }
    // Talking effect removed as requested; calm ambient music used instead.
  }

  // ---------------------------------------------------------------- Ammi Salah with moods
  function salahM(size, mood) {
    let s = ART.salah.replace(/__S__/g, size);
    if (mood === "angry") s = s.replace("M106 146 q14 12 28 0", "M106 152 q14 -10 28 0").replace("M86 92 q12 -9 24 -1", "M86 86 q12 8 24 12").replace("M130 91 q12 -8 24 1", "M130 98 q12 -4 24 -12").replace('fill="#e07c64" opacity="0.4"', 'fill="#d9472f" opacity="0.75"').replace('fill="#e07c64" opacity="0.4"', 'fill="#d9472f" opacity="0.75"');
    if (mood === "worried") s = s.replace("M106 146 q14 12 28 0", "M110 150 q10 -6 20 0").replace("M86 92 q12 -9 24 -1", "M86 94 q12 -2 24 -10").replace("M130 91 q12 -8 24 1", "M130 84 q12 2 24 10");
    return s;
  }

  // ---------------------------------------------------------------- level runtime & 60s timer
  let LV = null;
  const LEVELS = {};
  const ORDER = ["1", "2", "3", "4", "5", "6", "7", "F", "8", "9", "10", "11"];
  const CHAPTER = { 1: "start", 2: "start", 3: "climate", 4: "climate", 5: "climate", 6: "climate", 7: "climate", F: "failure", 8: "soil", 9: "soil", 10: "soil", 11: "soil" };

  let levelTimerInterval = null;
  function stopLevelTimer() {
    if (levelTimerInterval) { clearInterval(levelTimerInterval); levelTimerInterval = null; }
  }
  function startLevelTimer() {
    stopLevelTimer();
    LV.timeLeft = 60;
    LV.totalTime = 60;
    levelTimerInterval = setInterval(() => {
      if (!LV || LV.done) return stopLevelTimer();
      LV.timeLeft = Math.max(0, LV.timeLeft - 1);
      const txt = document.getElementById("timer-txt");
      const bar = document.getElementById("timer-bar");
      const box = document.getElementById("timer-box");
      const pill = document.getElementById("timer-pill");
      const m = Math.floor(LV.timeLeft / 60);
      const s = LV.timeLeft % 60;
      const str = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
      if (txt) txt.textContent = str;
      if (bar) bar.style.width = (LV.timeLeft / 60 * 100) + "%";
      if (pill) {
        if (LV.timeLeft <= 15) pill.classList.add("urgent");
        else pill.classList.remove("urgent");
      }
      if (box) {
        if (LV.timeLeft <= 15) box.classList.add("timer-urgent");
        else box.classList.remove("timer-urgent");
      }
      // Dynamic farm visual changes across the 60s
      const elapsed = 60 - LV.timeLeft;
      const stressLvl = Math.min(3, Math.floor(elapsed / 15));
      document.querySelectorAll(".b3d").forEach(b => { b.dataset.stress = stressLvl; });
      if (LV.timeLeft === 0) {
        stopLevelTimer();
        say(L("انتهت الدقيقة! اشتدت الظروف وتغيّرت التربة، اتخذ قرارك الآن لحماية مزرعتك!", "One minute passed! Conditions intensified and the soil changed—make your decision now to protect your farm!"), "worried", "warn");
      }
    }, 1000);
  }

  function startLevel(id) {
    const g = G();
    stopLevelTimer();
    LV = { id, hints: 0, hintStage: 0, good: [], risky: [], missed: [], st: {}, done: false, axeAt: 0, axeN: 0, timeLeft: 60, totalTime: 60, showNasa: false };
    startLevelTimer();
    if (!G().mute) playCalmMusic();
    if (window.THREE && A.SCREENS["l" + id + "x"]) return A.go("l" + id + "x");
    A.go("lvl");
  }
  const goodLog = (t) => LV.good.push(t), riskyLog = (t) => LV.risky.push(t), missLog = (t) => LV.missed.push(t);

  function head(def) {
    const nm = def.title();
    return `<div class="plug-head in">
      <button class="iconbtn mini" data-act="g" data-a="leave" aria-label="${L("الخريطة", "Map")}"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2z M7 3v12 M13 5v12" stroke="#2f9bd6" stroke-width="2" fill="none" stroke-linejoin="round"/></svg></button>
      <div class="plug-title">
        <b>${nm}</b>
        <span class="timer-pill" id="timer-pill">⏱ <span id="timer-txt">01:00</span></span>
      </div>
      <div class="plug-tools">
        <button type="button" class="nasapill" data-act="g" data-a="toggleNasa" title="${L("بيانات ناسا", "NASA Data")}">📊 ${L("رصد ناسا", "NASA")}</button>
        <button class="iconbtn mini" data-act="g" data-a="hint" aria-label="${L("تلميح", "Hint")}" title="${L("تلميح", "Hint")}"><svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true"><path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10h2a2 2 0 0 1 0 4h-2 M8 3c0 2 2 2 2 4 M12 3c0 2 2 2 2 4" stroke="#e8552f" stroke-width="2" fill="none" stroke-linecap="round"/></svg></button>
        <button class="iconbtn mini" data-act="g" data-a="mute" aria-label="${G().mute ? L("تشغيل الموسيقى", "Unmute Music") : L("كتم الموسيقى", "Mute Music")}">${G().mute
          ? '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3v10l-4-3H3z M13 7l5 6 M18 7l-5 6" stroke="#2f9bd6" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3v10l-4-3H3z M13 7a4 4 0 0 1 0 6 M15.5 5a7 7 0 0 1 0 10" stroke="#2f9bd6" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>'}</button>
      </div>
    </div>
    <div class="plug-salah in d1">
      <div class="who-mini" id="who">${salahM(28, "happy")}</div>
      <div class="say-mini tone-n" id="say" aria-live="polite"></div>
    </div>`;
  }
  let lastSay = "";
  function say(text, mood = "happy", tone = "n", silent) {
    lastSay = text;
    if (window.__say3) return window.__say3(text, mood, tone, silent);
    const who = document.getElementById("who"), el = document.getElementById("say");
    if (!who || !el) return;
    const isMini = who.classList.contains("who-mini") || (who.parentElement && who.parentElement.classList.contains("plug-salah"));
    who.innerHTML = salahM(isMini ? 28 : 80, mood) + (mood === "angry" ? '<span class="steam">~</span>' : "");
    who.className = (isMini ? "who-mini" : "who") + " mood-" + mood; void who.offsetWidth;
    el.className = (isMini ? "say-mini" : "say") + " msg tone-" + tone;
    el.innerHTML = text;
    if (!silent) speak(text);
  }
  function hint() {
    const def = LEVELS[LV.id], hs = def.hints();
    const i = Math.min(LV.hintStage, hs.length - 1);
    const label = [L("تلميح صغير", "A little clue"), L("تلميح أقوى", "A stronger clue"), L("الشرح الكامل", "The full explanation")][i];
    if (LV.hintStage < hs.length) { LV.hints++; LV.hintStage++; }
    snd("tap");
    say(`<b>${label}:</b> ${hs[i]}`, "happy", "hint");
  }
  const QUIPS = () => [L("فكّر جيدًا يا صديقي، الماء لا ينبت على الأشجار!", "Think carefully, my friend. Water doesn't grow on trees!"),
    L("همم… لا أظن أن محاصيلك ستشكرك على هذا القرار.", "Hmm… I don't think your crops are going to thank you for that decision."),
    L("أشعر أنك نسيت شيئًا مهمًا عن تربتك.", "I have a feeling you forgot something important about your soil."),
    L("انتظر! قبل أن تفعل ذلك، هل راجعت تاريخ محاصيلك؟", "Wait! Before you do that, have you checked your crop history?")];

  // risk feedback card (mandatory after important decisions)
  // risk feedback card (mandatory after important decisions)
  function risk(o, onContinue, onChange) {
    const lvl = o.level || "moderate";
    if (lvl !== "low") {
      G().risks.push({
        lvl: LV && LV.id,
        t: o.title,
        level: lvl,
        why: o.why || "",
        cons: o.cons || "",
        mitig: o.mitig || "",
        decision: o.decision || ""
      });
      A.save();
    }
    // Intermediate risk score cards withheld until the final report as requested
    onContinue && onContinue();
  }

  // axe gag when the player leaves level 1 too early
  function axe() {
    const now = Date.now();
    const lines = [L(`أنت يا ${pname()}! إلى أين؟ لم تُنهِ الحصاد بعد! عُد وأكمل عملك!`, `HEY, ${pname()}! Where are you going? You haven't finished harvesting yet! Come back and finish your work!`),
      L(`${pname()}! الحقل لا يحصد نفسه بنفسه!`, `${pname()}! The field won't harvest itself!`),
      L(`مرة أخرى يا ${pname()}؟ السنابل تنتظرك!`, `Again, ${pname()}? The wheat is still waiting for you!`)];
    if (now - LV.axeAt < 12000) { say(L(`قلت لك يا ${pname()}: أكمل الحصاد أولًا. بقي ${LV.st.left} مربعات.`, `I told you, ${pname()}: finish the harvest first. ${LV.st.left} plots left.`), "angry", "bad"); snd("bad"); return; }
    LV.axeAt = now; LV.axeN++;
    const ov = document.createElement("div"); ov.className = "axe-ov";
    ov.innerHTML = `<div class="flash"></div>
      <svg class="crack" viewBox="0 0 390 844" preserveAspectRatio="none" aria-hidden="true"><g stroke="#3a2a18" stroke-width="3" fill="none" stroke-linecap="round"><path d="M195 380 L120 300 L80 310 L20 240 M195 380 L260 290 L330 270 L380 200 M195 380 L170 470 L110 520 L60 640 M195 380 L250 460 L300 470 L360 600 M195 380 L215 330 L205 260 M195 380 L140 420 L40 430"/></g><g stroke="#fff" stroke-width="1.2" opacity=".8" fill="none"><path d="M197 382 L262 292 L332 272 M193 382 L118 302 L78 312"/></g></svg>
      <div class="ang">${salahM(150, "angry")}</div>
      <svg class="axe" viewBox="0 0 100 100" aria-hidden="true"><rect x="46" y="20" width="8" height="74" rx="4" fill="#9a6a3c"/><path d="M50 18 C70 10 86 18 88 34 C76 32 64 36 54 44 Z" fill="#b9c4c9" stroke="#2f9bd6" stroke-width="2"/><path d="M50 18 C36 14 26 20 24 30 C34 30 44 34 50 40Z" fill="#9aa7ad"/></svg>`;
    document.body.appendChild(ov);
    app.classList.add("shake-all");
    snd("whoosh"); setTimeout(() => snd("crack"), 1200);
    setTimeout(() => { ov.remove(); app.classList.remove("shake-all"); say(lines[(LV.axeN - 1) % lines.length], "angry", "bad"); }, 2700);
  }
  const app = document.getElementById("app");

  // ---------------------------------------------------------------- finishing a level
  function finish(o) {
    const learn = clamp(o.score - Math.min(15, LV.hints * 5));
    const score = Math.round(clamp(o.score)), stars = learn >= 85 ? 3 : learn >= 65 ? 2 : learn >= 40 ? 1 : 0;
    const g = G(), rec = g.levels[LV.id] || { best: 0, attempts: [] };
    rec.attempts.push({ score, learn: Math.round(learn), hints: LV.hints, stars, at: new Date().toISOString().slice(0, 16) });
    rec.best = Math.max(rec.best, Math.round(learn)); rec.stars = Math.max(rec.stars || 0, stars);
    g.levels[LV.id] = rec;
    if (o.strategy) g.finalStrategy = o.strategy;
    LV.result = Object.assign({ learn: Math.round(learn), stars, score }, o);
    if (window.FS_API) {
      window.FS_API.recordAttempt(S().farmId, [lastCrop()], score, { level: LV.id, stars, learn: Math.round(learn) }).catch(() => {});
    }
    A.save(); A.go("lvlResult");
  }

  // Intermediate result screen: scoring and risk analysis hidden until final report; Ammi Salah comments preserved
  A.SCREENS.lvlResult = () => {
    const r = LV.result, def = LEVELS[LV.id], next = ORDER[ORDER.indexOf(LV.id) + 1];
    return `<div class="gscreen">
      <div class="pop" style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:10px">
        <div style="width:115px;height:115px">${salahM(115, "happy")}</div>
        <div style="font-size:14px;font-weight:800;color:var(--mute)">${L("المستوى", "Level")} ${LV.id === "F" ? "" : LV.id} · ${def.title()}</div>
        <div style="font-size:22px;font-weight:900;color:var(--ink)">${L("تمت الخطوة بنجاح!", "Step Completed!")}</div>
      </div>
      
      <div class="dock in d1" style="margin:8px 0;background:var(--paper);border-radius:18px;border:1.5px solid #d4dec4;padding:16px">
        <div style="font-size:13px;font-weight:900;color:#2f9bd6;margin-bottom:6px">🌾 ${L("تعليق عمّي صالح:", "Ammi Salah's comments:")}</div>
        <div style="font-size:15px;line-height:1.65;color:#3a2a18;font-weight:600">
          ${r.explain || L(`أحسنت يا ${pname()}! سجّلتُ قراراتك لهذا الموسم. خطوة جيدة إلى الأمام، وسنكتشف صمود المزرعة الشامل وتحليل المخاطر عند إكمال باقي التحديات.`, `Well done, ${pname()}! I recorded your decisions for this season. A solid step forward; your full farm resilience score and risk breakdown will be revealed once all challenges are completed.`)}
        </div>
      </div>

      <div class="panel2 in d2" style="display:flex;align-items:center;gap:12px;background:#fffdf4;border:1.5px dashed #e6c27e;border-radius:16px;padding:12px 14px">
        <span style="font-size:24px">🛡️</span>
        <div style="font-size:12px;line-height:1.5;color:#2f9bd6;font-weight:700">
          ${L("نقاط التقييم، تفاصيل المخاطر، والأدلة العلمية محجوبة الآن، وستظهر بالتفصيل في تقرير صمود المزرعة النهائي بعد إنهاء كل التحديات.", "Scores, risk breakdowns, and evidence are withheld now, and will be displayed in full in the final Farm Resilience Report upon finishing all challenges.")}
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="secondary" data-act="go" data-to="map" style="flex:1">${L("الخريطة", "Challenges Map")}</button>
        ${next ? `<button class="primary" data-act="g" data-a="start" data-id="${next}" style="flex:2">${L("التحدي التالي", "Next Challenge")} ${A.fwd()}</button>` : `<button class="primary" data-act="go" data-to="report" style="flex:2">${L("عرض التقرير النهائي", "View Final Report")} ${A.fwd()}</button>`}
      </div>
    </div>`;
  };
  A.AFTER.lvlResult = () => {
    stopLevelTimer();
    snd("good");
  };

  // ---------------------------------------------------------------- generic level screen & NASA toggle
  function renderNasaModal() {
    const l = loc();
    if (!l) return "";
    return `<div class="riskov fade" id="nasaModal" style="display:${LV.showNasa ? "flex" : "none"}">
      <div class="sheet pop" style="max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #f0dcb0;padding-bottom:8px">
          <span style="font-weight:900;font-size:15px;color:#2f9bd6">📊 ${L("تقرير رصد ناسا الحقيقي للموقع", "Real NASA Observation Report")}</span>
          <button type="button" class="secondary" style="width:auto;min-height:32px;padding:3px 10px;font-size:12px" data-act="g" data-a="toggleNasa">❌ ${L("إخفاء", "Hide")}</button>
        </div>
        <div style="font-size:12px;color:var(--mute)">📍 ${esc(A.placeName())} (${l.lat ? l.lat.toFixed(2) : ""}°, ${l.lon ? l.lon.toFixed(2) : ""}°) · ⛰️ ${Math.round(l.elev || 450)}m (${L("الارتفاع", "elevation")})</div>
        <div class="nasa-drawer-grid">
          <div class="nasa-cell-box">
            <small>${L("متوسط أمطار الموسم (أكتوبر–ماي)", "Mean Season Rain (Oct–May)")}</small>
            <b>${l.summary.rain_mean} mm</b>
          </div>
          <div class="nasa-cell-box">
            <small>${L("أيام الحر عند الإزهار", "Hot Days at Flowering")}</small>
            <b>${l.trends && l.trends.hot_flowering ? l.trends.hot_flowering.late : 4} ${L("أيام", "days")}</b>
          </div>
          <div class="nasa-cell-box">
            <small>${L("نوع التربة (SoilGrids)", "Soil Texture (SoilGrids)")}</small>
            <b>${l.soil.texture === "clay loam" ? L("طميية طينية", "Clay loam") : l.soil.texture}</b>
          </div>
          <div class="nasa-cell-box">
            <small>${L("سعة احتفاظ الماء (PAW100)", "Plant-Available Water (PAW100)")}</small>
            <b>${l.soil.paw100} mm/m</b>
          </div>
        </div>
        <div class="nasa-citation">
          📊 <b>${L("المصدر العلمي:", "Scientific Sources:")}</b> NASA POWER 0.5° (1995–2025) · ISRIC SoilGrids 250m · NASADEM.
        </div>
        <button type="button" class="primary" style="margin-top:6px;min-height:42px" data-act="g" data-a="toggleNasa">${L("إخفاء والعودة للعبة", "Hide & Return to Game")}</button>
      </div>
    </div>`;
  }

  A.SCREENS.lvl = () => `<div class="gscreen plugged">${head(LEVELS[LV.id])}<div id="lv" style="display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;overflow:hidden"></div>${renderNasaModal()}</div>`;
  A.AFTER.lvl = () => { const d = LEVELS[LV.id]; d.init && d.init(); draw(); setTimeout(() => say(d.intro(), "happy", "n"), 450); if (!G().mute) playCalmMusic(); };
  const draw = () => {
    if (window.__draw3) window.__draw3();
    const el = document.getElementById("lv");
    if (!el) return;
    let content = LEVELS[LV.id].view();
    
    // Separate primary action button into fixed plug-foot
    let footHtml = "";
    const btnRegex = /<button class="primary[^"]*"[^>]*>[\s\S]*?<\/button>\s*$/;
    const btnMatch = content.match(btnRegex);
    if (btnMatch) {
      footHtml = `<div class="plug-foot">${btnMatch[0]}</div>`;
      content = content.slice(0, btnMatch.index);
    }
    
    // Separate the 3D board from the control deck
    const b3dIdx = content.indexOf('<div class="b3d');
    if (b3dIdx !== -1) {
      let depth = 0, b3dEnd = -1;
      for (let pos = b3dIdx; pos < content.length; ) {
        const nextOpen = content.indexOf('<div', pos + 1);
        const nextClose = content.indexOf('</div>', pos + 1);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          pos = nextOpen;
        } else {
          if (depth === 0) {
            b3dEnd = nextClose + 6;
            break;
          }
          depth--;
          pos = nextClose;
        }
      }
      if (b3dEnd !== -1) {
        let start = b3dIdx;
        const prefix = content.slice(0, b3dIdx);
        const wrapMatch = prefix.match(/<div class="in [^"]*">\s*$/);
        if (wrapMatch) {
          start = wrapMatch.index;
          const closeWrap = content.indexOf('</div>', b3dEnd);
          if (closeWrap !== -1 && closeWrap - b3dEnd < 15) b3dEnd = closeWrap + 6;
        }
        const boardHtml = `<div class="plug-board in d2">${content.slice(b3dIdx, b3dEnd)}</div>`;
        const deckHtml = `<div class="plug-deck in d3">${content.slice(0, start) + content.slice(b3dEnd)}</div>`;
        el.innerHTML = boardHtml + deckHtml + footHtml;
      } else {
        el.innerHTML = `<div class="plug-deck in d2">${content}</div>${footHtml}`;
      }
    } else {
      el.innerHTML = `<div class="plug-deck in d2">${content}</div>${footHtml}`;
    }
    
    const modalEl = document.getElementById("nasaModal");
    if (modalEl) modalEl.style.display = LV.showNasa ? "flex" : "none";
    
    LEVELS[LV.id].after && LEVELS[LV.id].after();
    if (!el.dataset.first) { el.dataset.first = 1; setTimeout(() => el.classList.add("settled"), 900); }
  };

  A.ACT.g = (d) => {
    const a = d.a;
    if (a === "start") return startLevel(d.id);
    if (a === "mute") {
      G().mute = !G().mute;
      A.save();
      if (G().mute) stopCalmMusic();
      else playCalmMusic();
      return A.render();
    }
    if (a === "replay") return say(lastSay, "happy", "n", true);
    if (a === "hint") return hint();
    if (a === "retry") return startLevel(LV.id);
    if (a === "toggleNasa") {
      LV.showNasa = !LV.showNasa;
      draw();
      return;
    }
    if (a === "leave") {
      const def = LEVELS[LV.id];
      if (def && def.mustFinish && !LV.done) return axe();
      stopLevelTimer();
      return A.go("map");
    }
    if (a === "tile") {
      const tileEl = document.querySelector(`.t3[data-i="${d.i}"]`);
      if (tileEl) {
        tileEl.classList.remove("pop-anim");
        void tileEl.offsetWidth;
        tileEl.classList.add("pop-anim");
      }
      snd("tap");
      if (LEVELS[LV.id] && LEVELS[LV.id].on) {
        LEVELS[LV.id].on("tile", d);
      }
      return;
    }
    snd("tap");
    if (!G().mute) playCalmMusic();
    LEVELS[LV.id].on(a, d);
  };

  // ---------------------------------------------------------------- 3D farm board (CSS 3D, drag to rotate)
  const T3 = 50, YARD = 34;
  let FLAT_FURROW = "";
  let RZ = -38, DRAG = null, DRAGGED = false, AMB_ENV = "day";
  const setRZ = (v) => { RZ = v; document.documentElement.style.setProperty("--rz", RZ + "deg"); };
  setRZ(RZ);
  const mixC = (a, b, t) => { const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A2 = h(a), B2 = h(b); return "#" + A2.map((v, i) => Math.round(v + (B2[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const soilCol = () => ({ sandy: "#e8b878", clay: "#a65f34", loam: "#b8743f" }[S().farm.soil] || "#b8743f");
  const SKY_APP = { day: ["#bcd3da", "#eaf7dc"], harvest: ["#f1d79a", "#f6efd2"], drought: ["#f3dcae", "#f8f1dc"], heat: ["#f2a65a", "#f8dcb0"], storm: ["#7f8f96", "#c4ccc9"], dead: ["#b8a58a", "#e2d8c2"], soil: ["#cdbfa0", "#efe8d2"], salt: ["#d9e2e4", "#f4f4ea"] }; // original look (hub)
  const SKY = { day: ["#45b8f0", "#dff5ff"], harvest: ["#56bff2", "#fff0c8"], drought: ["#ffcf7a", "#fff1d6"], heat: ["#ff9a4d", "#ffe0b0"], storm: ["#7f9aab", "#cfdde6"], dead: ["#c9a97a", "#f1e3c8"], soil: ["#8fd0f0", "#f6ecd2"], salt: ["#9fdcf5", "#f4fbff"] };
  function board3d(cols, rows, tile, o = {}) {
    let tiles = "";
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, t = tile(i, c, r);
      tiles += `<div class="t3 ${t.cls || ""}" style="left:${c * T3}px;top:${r * T3}px;--h:${t.h || 0}px" data-act="${o.act || "g"}" data-a="${o.action || "tile"}" data-i="${i}" role="button" tabindex="0" aria-label="${t.label || ""}">
        <div class="tp" style="background:${t.fill}">${t.flat ? `<svg class="fl" viewBox="0 0 50 50" aria-hidden="true">${t.flat}</svg>` : ""}</div>
        ${t.deco ? `<div class="up"><svg viewBox="-24 -31 48 35" width="64" height="46" aria-hidden="true">${t.deco}</svg></div>` : ""}</div>`;
    }
    const W = cols * T3, H = rows * T3, sky = (GAME_LOOK.test(A.S.screen || "") ? SKY : SKY_APP)[o.env || "day"]; AMB_ENV = o.env || "day";
    let slabs = "";
    for (let k = 7; k >= 0; k--) slabs += `<div class="slab" style="left:${-YARD}px;top:${-YARD}px;width:${W + 2 * YARD}px;height:${H + 2 * YARD}px;transform:translateZ(${-k * 3 - 1}px);background:${k === 0 ? (o.yard || "#6cc04a") : k < 2 ? "#4a9e2f" : k < 4 ? "#9a5b2e" : "#6e4527"}"></div>`;
    const xtra = (o.extras || []).map((x) => `<div class="up xtra" style="left:${x.x}px;top:${x.y}px"><svg viewBox="-26 -36 52 40" width="${(x.w || 64) * 1.3}" height="${(x.w || 64) * 1.3 * 40 / 52}" style="margin-inline-start:${-(x.w || 64) * 0.15}px" aria-hidden="true">${x.svg}</svg></div>`).join("");
    const clouds = ["storm", "day", "soil", "dead", "salt"].includes(o.env) ? [0, 1, 2].map((k) => `<span class="cloud3" style="top:${12 + k * 22}px;animation-duration:${26 + k * 9}s;animation-delay:${-k * 8}s;${o.env === "storm" ? "background:#5f6d72;opacity:.85" : ""}"></span>`).join("") : "";
    const sun = ["day", "harvest", "drought", "heat", "salt"].includes(o.env || "day") ? `<span class="sun3 ${o.env === "heat" || o.env === "drought" ? "hot" : ""}"></span>` : "";
    const rain = o.rain ? `<div class="rain3" aria-hidden="true">${Array.from({ length: 46 }, (_, k) => `<i style="left:${(k * 37) % 100}%;animation-delay:${((k * 13) % 10) / 10}s;animation-duration:${0.55 + (k % 5) * 0.08}s"></i>`).join("")}</div>` : "";
    return `<div class="b3d env-${o.env || "day"}" style="--s1:${sky[0]};--s2:${sky[1]};height:${o.height || 270}px" data-w="${W + 2 * YARD}" data-h="${H + 2 * YARD}" role="group" aria-label="${o.label || ""}">
      ${sun}${clouds}${o.env === "heat" ? '<span class="haze3"></span>' : ""}
      <div class="world" style="width:${W}px;height:${H}px">${slabs}${tiles}${xtra}</div>${rain}
      ${o.badge ? `<span class="b3badge">${o.badge}</span>` : ""}
      <div class="rot3"><button data-act="rot3" data-d="-35" aria-label="${L("تدوير لليسار", "Rotate left")}">↺</button><button data-act="rot3" data-d="35" aria-label="${L("تدوير لليمين", "Rotate right")}">↻</button></div>
      <span class="drag3">${L("اسحب لتدوير المزرعة", "Drag to turn the farm")}</span></div>`;
  }
  function fit3d() {
    document.querySelectorAll(".b3d").forEach((b) => {
      const w = b.clientWidth, h = b.clientHeight, W = +b.dataset.w, H = +b.dataset.h, d = Math.hypot(W, H);
      b.style.setProperty("--fit", Math.min(1.25, (w - 16) / d, (h - 10) / (d * 0.62)).toFixed(3));
    });
  }
  new MutationObserver(() => { if (document.querySelector(".b3d")) fit3d(); }).observe(document.getElementById("app"), { childList: true, subtree: true });
  window.addEventListener("resize", fit3d);
  document.addEventListener("pointerdown", (e) => { const b = e.target.closest(".b3d"); if (!b || e.target.closest(".rot3")) return; DRAG = { x: e.clientX, y: e.clientY, rz: RZ, on: false }; });
  document.addEventListener("pointermove", (e) => {
    if (!DRAG) return; const dx = e.clientX - DRAG.x;
    if (!DRAG.on && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(e.clientY - DRAG.y)) { DRAG.on = true; document.documentElement.classList.add("dragging3d"); }
    if (DRAG.on) setRZ(Math.round(DRAG.rz + dx * 0.45));
  });
  const endDrag = () => { if (DRAG && DRAG.on) { DRAGGED = true; setTimeout(() => (DRAGGED = false), 60); } DRAG = null; document.documentElement.classList.remove("dragging3d"); };
  document.addEventListener("pointerup", endDrag); document.addEventListener("pointercancel", endDrag);
  document.addEventListener("click", (e) => { if (DRAGGED) { e.stopPropagation(); e.preventDefault(); DRAGGED = false; } }, true);
  A.ACT.rot3 = (d) => { snd("whoosh"); setRZ(RZ + Number(d.d)); };

  // plants: health 1 = green & upright, 0 = brown & drooping
  FLAT_FURROW = '<path d="M0 8h50M0 19h50M0 30h50M0 41h50" stroke="#6e4527" stroke-width="2.4" opacity=".55"/>';
  const plantDeco = (crop, n = 5, cls = "", hl = 1) => {
    const cer = ["wheat", "barley", "oat"].includes(crop), base = { wheat: "#ffc83a", barley: "#f5d76e", oat: "#b5ea86", lentil: "#6cc04a", chickpea: "#9be070", faba: "#6cc04a", vetch: "#8a4fbf" }[crop] || "#6cc04a";
    const h = Math.max(0, Math.min(1, hl)), dead = 1 - h, col = mixC(base, "#c9a66a", dead * 0.9), leaf = mixC("#4a9e2f", "#a8915a", dead), stem = mixC("#d9a93a", "#a8915a", dead);
    let s = "";
    for (let k = 0; k < n; k++) {
      const dx = (k - (n - 1) / 2) * 8, dy = (k % 2) * 4 - 2, lean = h < 0.55 ? (k % 2 ? 1 : -1) * dead * 55 : 0;
      s += `<g class="${cls}" style="animation-delay:${k * 0.05}s"><g transform="rotate(${lean.toFixed(0)} ${dx} ${dy})"><g class="sway" style="animation-delay:${k * 0.1}s">` + (cer
        ? `<path d="M${dx} ${dy} v-16" stroke="${stem}" stroke-width="1.6"/><path d="M${dx} ${dy - 6} q-5 -2 -7 -7 M${dx} ${dy - 9} q5 -2 6 -7" stroke="${leaf}" stroke-width="1.3" fill="none"/><ellipse cx="${dx}" cy="${dy - 18}" rx="2.2" ry="5.2" fill="${col}"/>`
        : `<path d="M${dx} ${dy} v-8" stroke="${leaf}" stroke-width="1.5"/><circle cx="${dx - 3}" cy="${dy - 7}" r="4" fill="${leaf}"/><circle cx="${dx + 3}" cy="${dy - 9}" r="4.2" fill="${mixC(base, "#c9a66a", dead)}"/><circle cx="${dx}" cy="${dy - 13}" r="3.4" fill="${mixC("#9be070", "#c9a66a", dead)}"/>`) + `</g></g></g>`;
    }
    return s;
  };
  const stubble = () => `<path d="M-14 0 v-4 M-7 3 v-4 M0 -2 v-4 M7 2 v-4 M14 -1 v-4" stroke="#f2c94c" stroke-width="1.6"/>`;
  const FLAT = {
    straw: '<path d="M4 12 l14 -4 M10 26 l16 -5 M24 14 l14 -3 M30 34 l15 -4 M6 40 l13 -3 M20 44 l14 -4" stroke="#f5cf6a" stroke-width="3" stroke-linecap="round"/>',
    cracks: '<path d="M6 10 l10 8 l-3 9 l9 6 M30 6 l-4 12 l10 6 l-2 10 M22 40 l8 -6 l10 6" stroke="#8a5a33" stroke-width="1.2" fill="none" opacity=".7"/>',
    salt: '<g fill="#fffdf4" opacity=".85"><circle cx="9" cy="12" r="3"/><circle cx="30" cy="9" r="2"/><circle cx="40" cy="30" r="3.5"/><circle cx="18" cy="36" r="2.5"/><circle cx="27" cy="24" r="1.8"/></g>',
    drip: '<path d="M0 16h50M0 34h50" stroke="#2b8fe0" stroke-width="1.6" stroke-dasharray="4 3"/>',
    flood: '<rect x="0" y="0" width="50" height="7" fill="#4fb2f0" opacity=".75"/>',
    dots: '<g fill="#fff3d6" opacity=".85"><circle cx="12" cy="14" r="2"/><circle cx="36" cy="18" r="2"/><circle cx="20" cy="34" r="2"/><circle cx="40" cy="40" r="2"/></g>',
    runoff: '<path class="runoff" d="M8 6 C16 18 30 22 44 44" stroke="#6b3f1f" stroke-width="3" fill="none" stroke-linecap="round"/>',
    mulch: '<path d="M2 10 q8 -4 16 0 t16 0 t16 0 M2 24 q8 -4 16 0 t16 0 t16 0 M2 38 q8 -4 16 0 t16 0 t16 0" stroke="#f5cf6a" stroke-width="5" fill="none"/>',
    contour: '<path d="M0 25 h50" stroke="#5f7d36" stroke-width="6" stroke-dasharray="3 5" stroke-linecap="round"/>',
    manure: '<g fill="#4a3220"><ellipse cx="14" cy="16" rx="6" ry="3"/><ellipse cx="34" cy="30" rx="7" ry="3.4"/><ellipse cx="18" cy="38" rx="5" ry="2.6"/></g>',
  };
  const XTRA = {
    house: '<path d="M-20 4 v-20 h28 v20 z" fill="#ffe9a8" stroke="#e6c27e"/><path d="M-24 -15 L-6 -32 L12 -15 z" fill="#e8552f"/><rect x="-11" y="-6" width="8" height="10" fill="#2f9bd6"/><rect x="0" y="-12" width="6" height="6" fill="#a6e1ff"/>',
    tank: '<rect x="-9" y="-30" width="18" height="30" rx="3" fill="#2f9bd6"/><ellipse cx="0" cy="-30" rx="9" ry="3" fill="#6f8b95"/><path d="M-9 -18 h18" stroke="#1f78ab"/><path d="M9 -6 h10" stroke="#2f9bd6" stroke-width="3"/>',
    tree: '<rect x="-2" y="-12" width="4" height="14" fill="#9a5b2e"/><circle cx="0" cy="-20" r="11" fill="#4a9e2f"/><circle cx="-6" cy="-14" r="7" fill="#6cc04a"/><circle cx="6" cy="-15" r="7" fill="#58ad38"/>',
    sprinkler: '<path d="M0 4 v-12" stroke="#2f9bd6" stroke-width="2"/><g class="spray"><path d="M0 -9 q-10 -8 -18 0 M0 -9 q10 -8 18 0" stroke="#4fb2f0" stroke-width="1.4" fill="none" stroke-dasharray="2 2"/></g>',
    sheep: '<ellipse cx="0" cy="-7" rx="9" ry="6" fill="#fffdf4" stroke="#e6c27e"/><circle cx="9" cy="-10" r="3.5" fill="#3f3a30"/><path d="M-5 -2 v5 M4 -2 v5" stroke="#3f3a30" stroke-width="1.6"/>',
  };
  // the player's own farm: soil colour, irrigation, house, tank, trees from onboarding answers
  function farmExtras(cols, rows) {
    const f = S().farm, ex = [{ x: -22, y: rows * T3 * 0.55, svg: XTRA.house, w: 56 }, { x: cols * T3 + 16, y: -12, svg: XTRA.tree }, { x: -16, y: rows * T3 + 14, svg: XTRA.tree, w: 52 }];
    if (f.irrig && f.irrig !== "rain") ex.push({ x: cols * T3 + 16, y: rows * T3 * 0.6, svg: XTRA.tank, w: 56 });
    if ((f.history || []).includes("fallow") || f.system === "mixed") ex.push({ x: cols * T3 * 0.5, y: rows * T3 + 18, svg: XTRA.sheep, w: 44 });
    return ex;
  }
  const irrigFlat = (c, r) => { const ir = S().farm.irrig; return ir === "drip" ? FLAT.drip : ir === "flood" && c === 0 ? FLAT.flood : ""; };
  const irrigDeco = (c, r) => (S().farm.irrig === "sprinkler" && (r + c) % 3 === 1 ? XTRA.sprinkler : "");
  function fieldBoard(crop, health, o = {}) {
    const cols = o.cols || 4, rows = o.rows || 3;
    return board3d(cols, rows, (i, c, r) => {
      const hl = typeof health === "function" ? health(i, c, r) : health;
      return { fill: mixC(soilCol(), "#c9b38a", Math.max(0, 0.6 - hl) * 0.8), flat: (o.flat ? o.flat(i, c, r) : "") + (hl < 0.35 ? FLAT.cracks : "") + (o.noIrrig ? "" : irrigFlat(c, r)),
        deco: (crop ? plantDeco(typeof crop === "function" ? crop(i, c, r) : crop, 4, "", hl) : "") + (o.noIrrig ? "" : irrigDeco(c, r)) + (o.deco ? o.deco(i, c, r) : ""), label: o.label || "" };
    }, Object.assign({ extras: farmExtras(cols, rows), act: "g", action: "tile" }, o));
  }
  A.ACT.noop = () => { };
  const cropArt = (k, w = 120) => {
    const cer = ["wheat", "barley", "oat"].includes(k), col = { wheat: "#ffc83a", barley: "#f5d76e", oat: "#b5ea86", lentil: "#6cc04a", chickpea: "#ffe9a8", faba: "#fffdf4", vetch: "#8a4fbf" }[k];
    let s = `<svg width="${w}" height="60" viewBox="0 0 120 60" aria-hidden="true"><path d="M0 52 C40 46 80 50 120 46 L120 60 L0 60Z" fill="#6cc04a"/>`;
    for (let i = 0; i < 6; i++) { const x = 15 + i * 18;
      s += cer ? `<g class="sway" style="animation-delay:${i * 0.15}s;transform-box:fill-box;transform-origin:50% 100%"><path d="M${x} 52 V24 M${x - 4} 52 V30" stroke="#d9a93a" stroke-width="2"/><ellipse cx="${x}" cy="20" rx="3" ry="7" fill="${col}"/><ellipse cx="${x - 4}" cy="27" rx="2.4" ry="6" fill="${col}"/></g>`
        : `<g class="sway" style="animation-delay:${i * 0.15}s;transform-box:fill-box;transform-origin:50% 100%"><path d="M${x} 52 V36" stroke="#4a9e2f" stroke-width="2"/><circle cx="${x - 5}" cy="40" r="6" fill="#4a9e2f"/><circle cx="${x + 5}" cy="38" r="6.5" fill="#6cc04a"/><circle cx="${x}" cy="31" r="6" fill="#9be070"/><circle cx="${x + 2}" cy="32" r="2.2" fill="${col}"/></g>`; }
    return s + "</svg>";
  };

  // ================================================================ LEVEL 1 – harvest
  LEVELS["1"] = {
    title: () => L("تعرّف على مزرعتك: الحصاد", "Meet your farm: the harvest"),
    intro: () => L(`آه، مرحبًا يا ${pname()}! إذن أنت من سيعتني بهذه المزرعة؟ لنرَ ما لدينا! أولًا: احصد ${cname(LV.st.crop)} قبل الموسم الجديد. اختر الأداة المناسبة ثم اضغط على كل قطعة.`,
      `Ah, welcome, ${pname()}! So you're the one who's going to take care of this farm? Let's see what we're working with! First: harvest the ${cname(LV.st.crop).toLowerCase()} before the new season. Pick the right tool, then tap every plot.`),
    hints: () => [L("ليست كل الأدوات للحصاد. أيّ أداة تقطع السيقان؟", "Not every tool is for harvesting. Which one cuts stems?"),
      L("المنجل يناسب القطع الصغيرة، والحصادة تناسب الحقول الكبيرة وتحصد أسرع.", "A sickle suits small plots; a combine suits big fields and harvests faster."),
      L(`حقلك ${S().farm.area} هكتار: ${S().farm.area >= 5 ? "الحصادة هي الخيار الأذكى" : "المنجل يكفي"}. بعد الحصاد، قرّر ماذا تفعل بالتبن: تركه يحمي التربة، وحرقه يضرّها.`, `Your field is ${S().farm.area} ha: ${S().farm.area >= 5 ? "the combine is the smarter choice" : "a sickle is enough"}. After the harvest, decide what to do with the straw: leaving it protects the soil, burning it harms it.`)],
    init() { LV.st = { crop: lastCrop(), tool: null, done: new Set(), wrong: 0, straw: null, left: 16 }; },
    view() {
      const st = LV.st, big = S().farm.area >= 5, n = 16;
      st.left = n - st.done.size;
      const tools = [["sickle", L("منجل", "Sickle"), L("قطع صغيرة", "small plots")], ["combine", L("حصادة", "Combine"), L("حقول كبيرة", "big fields")], ["plough", L("محراث", "Plough"), L("للحرث", "tillage")], ["can", L("مرشّة", "Watering can"), L("للسقي", "watering")]];
      const icon = { sickle: '<path d="M6 22 L14 14 M14 14 C14 6 22 4 26 8 C20 8 16 12 16 16" stroke="#1f78ab" stroke-width="2.4" fill="none" stroke-linecap="round"/>', combine: '<rect x="4" y="12" width="18" height="9" rx="2" fill="#e8552f"/><rect x="14" y="6" width="8" height="7" rx="1" fill="#ff7a45"/><circle cx="8" cy="22" r="3" fill="#24506a"/><circle cx="19" cy="22" r="3" fill="#24506a"/><path d="M2 14h-0 M2 12v8" stroke="#f2c94c" stroke-width="3"/>', plough: '<path d="M4 8 L20 8 L24 20 L10 20 Z" fill="#9aa7ad"/><path d="M4 8 L2 4" stroke="#7a5236" stroke-width="2"/>', can: '<rect x="6" y="10" width="13" height="11" rx="2" fill="#2f9bd6"/><path d="M19 13 L26 8" stroke="#2f9bd6" stroke-width="2.4"/><path d="M8 10 q4 -6 9 0" stroke="#2f9bd6" stroke-width="2" fill="none"/>' };
      const field = board3d(4, 4, (i, c, r) => {
        const h = st.done.has(i), strawF = h && st.straw ? ({ keep: FLAT.straw, graze: FLAT.straw, burn: '<rect width="50" height="50" fill="#3a2e26" opacity=".75"/>', bale: "" }[st.straw] || "") : "";
        return { fill: h ? "#e8b878" : "#cf8f52", h: h ? 0 : 2, flat: strawF + irrigFlat(c, r), deco: (h ? (st.just === i ? `<g>${stubble()}${[-10, -2, 6, 12].map((dx, k) => `<circle class="chaff" style="--dx:${dx}px;animation-delay:${k * 0.05}s" cx="${dx / 2}" cy="-8" r="1.8" fill="#ffc83a"/>`).join("")}</g>` : stubble()) : plantDeco(st.crop, 5)) + (h && st.straw === "graze" && i % 5 === 0 ? XTRA.sheep : "") + irrigDeco(c, r), label: h ? L("محصود", "harvested") : L("جاهز للحصاد", "ready to harvest") };
      }, { env: "harvest", extras: farmExtras(4, 4), label: L("حقلك", "Your field"), badge: `${S().farm.area} ${L("هكتار", "ha")} · ${cname(st.crop)}` });
      return `<div class="in d2">${field}</div>
        <div class="in d3"><div class="pbar"><i style="width:${Math.round(st.done.size / n * 100)}%"></i></div>
          <div class="note" style="margin-top:3px">${L("تم حصاد", "Harvested")} ${st.done.size}/${n} · ${S().farm.area} ${L("هكتار", "ha")} · ${cname(st.crop)}</div></div>
        <div class="toolbar in d4" role="radiogroup">${tools.map((t) => `<button class="tool ${st.tool === t[0] ? "on" : ""}" role="radio" aria-checked="${st.tool === t[0]}" data-act="g" data-a="tool" data-v="${t[0]}"><svg width="30" height="28" viewBox="0 0 28 28" aria-hidden="true">${icon[t[0]]}</svg>${t[1]}<small>${t[2]}</small></button>`).join("")}</div>
        ${st.done.size === n ? `<div class="panel2 reveal"><b>${L("ماذا تفعل بالتبن والبقايا؟", "What do you do with the straw?")}</b>
          <div class="chiprow" style="margin-top:6px">${[["keep", L("أتركه على التربة", "Leave it on the soil")], ["graze", L("ترعاه الأغنام", "Let sheep graze it")], ["bale", L("أجمعه للبيع", "Bale it for sale")], ["burn", L("أحرقه", "Burn it")]].map((o) => `<button class="chip ${st.straw === o[0] ? "on" : ""}" data-act="g" data-a="straw" data-v="${o[0]}">${o[1]}</button>`).join("")}</div></div>` : ""}
        <div class="spacer"></div>
        ${st.done.size === n && st.straw ? `<button class="primary pop" data-act="g" data-a="end">${L("أنهِ المستوى", "Finish the level")} ${A.fwd()}</button>` : `<button class="primary" disabled>${st.done.size < n ? L(`بقي ${n - st.done.size} قطعة`, `${n - st.done.size} plots left`) : L("قرّر مصير التبن", "Decide about the straw")}</button>`}`;
    },
    on(a, d) {
      const st = LV.st, big = S().farm.area >= 5;
      if (a === "tool") {
        st.tool = d.v;
        if (d.v === "plough" || d.v === "can") { st.wrong++; say(d.v === "plough" ? L("محراث؟ الحصاد أولًا، والحرث بعده! السنابل ما زالت واقفة.", "A plough? Harvest first, plough later! The crop is still standing.") : L("مرشّة؟ المحصول ناضج وجاف، لا يحتاج ماءً الآن!", "A watering can? The crop is ripe and dry, it doesn't need water now!"), "angry", "bad"); snd("bad"); }
        else if (d.v === "sickle" && big) say(L("المنجل يعمل… لكن حقلك كبير. ستتعب كثيرًا!", "The sickle works… but your field is big. You'll be tired!"), "worried", "warn");
        else say(d.v === "combine" ? L("الحصادة! سريعة وقوية. هيا!", "The combine! Fast and strong. Go!") : L("المنجل مناسب لحقل صغير. ابدأ!", "A sickle suits a small field. Start!"), "happy", "good");
        draw(); return;
      }
      if (a === "tile") {
        const i = +d.i;
        if (!st.tool) { say(L("اختر أداة أولًا!", "Pick a tool first!"), "worried", "warn"); return; }
        if (st.tool === "plough" || st.tool === "can") { st.wrong++; snd("bad"); say(QUIPS()[st.wrong % 4], "angry", "bad"); return; }
        if (st.done.has(i)) return;
        const add = st.tool === "combine" ? [i, i % 4 < 3 ? i + 1 : null].filter((x) => x != null) : [i];
        add.forEach((x) => st.done.add(x)); st.just = i; snd("cut");
        if (st.done.size === 16) { LV.done = true; snd("good"); say(L(`أحسنت يا ${pname()}! الحقل محصود. الآن، ماذا نفعل بالتبن؟`, `Well done, ${pname()}! The field is harvested. Now, what do we do with the straw?`), "happy", "good"); }
        draw(); return;
      }
      if (a === "straw") {
        st.straw = d.v;
        const R = {
          keep: { level: "low", title: L("ترك التبن على التربة", "Leaving the straw on the soil"), why: L("البقايا تغطي التربة في الصيف والخريف.", "Residue covers the soil through summer and autumn."), cons: L("حماية من الانجراف وتبخّر أقل وزيادة بطيئة للمادة العضوية.", "Less erosion, less evaporation and slowly more organic matter."), mitig: L("قد تحتاج آلة بذر مناسبة لبذر الموسم القادم مباشرة.", "You may need a suitable drill to sow directly next season.") },
          graze: { level: "low", title: L("رعي التبن", "Grazing the straw"), why: L("الأغنام تستفيد والبقايا تبقى جزئيًا.", "Sheep benefit and part of the residue stays."), cons: L("غطاء أقل من الترك الكامل، والرعي الزائد يكشف التربة.", "Less cover than leaving it all; overgrazing exposes the soil."), mitig: L("لا ترعَ حتى تصبح التربة عارية تمامًا.", "Don't graze until the soil is bare.") },
          bale: { level: "moderate", title: L("جمع التبن للبيع", "Baling the straw"), why: L("دخل إضافي، لكن التربة تبقى عارية.", "Extra income, but the soil stays bare."), cons: L("تزيد مخاطر الانجراف مع أمطار الخريف الغزيرة.", "Higher erosion risk with heavy autumn rain."), mitig: L("اترك جزءًا من البقايا أو ازرع غطاءً نباتيًا.", "Leave part of the residue or plant a cover crop.") },
          burn: { level: "high", title: L("حرق التبن", "Burning the straw"), why: L("الحرق يزيل الغطاء والمادة العضوية.", "Burning removes the cover and the organic matter."), cons: L("تربة عارية، فقدان المادة العضوية، دخان وخطر حرائق.", "Bare soil, lost organic matter, smoke and fire risk."), mitig: L("اترك التبن أو ارعه بدل حرقه.", "Leave or graze the straw instead of burning it.") },
        }[d.v];
        R.decision = R.title; R.kind = "science";
        risk(R, () => { draw(); say(d.v === "burn" ? L("همم… النار تأكل خصوبة تربتك يا صديقي.", "Hmm… fire eats your soil's fertility, my friend.") : L("قرار جيد. التربة تحب الغطاء.", "Good decision. Soil loves a cover."), d.v === "burn" ? "worried" : "happy", d.v === "burn" ? "bad" : "good"); }, () => { st.straw = null; draw(); });
        return;
      }
      if (a === "end") {
        const big2 = S().farm.area >= 5, toolOk = big2 ? st.tool === "combine" : true;
        if (toolOk) goodLog(L("استعملت الأداة المناسبة لحجم حقلك.", "You used the right tool for your field size.")); else missLog(L("حقلك كبير: الحصادة أسرع من المنجل.", "Your field is big: a combine is faster than a sickle."));
        if (st.wrong) riskyLog(L(`جرّبت أداة غير مناسبة ${st.wrong} مرة.`, `You tried an unsuitable tool ${st.wrong} time(s).`));
        const strawPts = { keep: 30, graze: 25, bale: 10, burn: 0 }[st.straw];
        if (st.straw === "keep" || st.straw === "graze") goodLog(L("حافظت على غطاء التربة بعد الحصاد.", "You kept the soil covered after harvest.")); else missLog(L("ترك البقايا يحمي التربة ويزيد مادتها العضوية.", "Leaving residue protects the soil and builds organic matter."));
        if (st.straw === "burn") riskyLog(L("حرق البقايا.", "Burning the residue."));
        if (LV.axeN) riskyLog(L(`حاولت المغادرة قبل الإنهاء ${LV.axeN} مرة (عمّي صالح لم ينسَ!).`, `You tried to leave early ${LV.axeN} time(s) (Ammi Salah remembers!).`));
        finish({ score: 50 + (toolOk ? 20 : 10) + strawPts - Math.min(20, st.wrong * 5), dims: { [L("إدارة التربة", "Soil management")]: strawPts / 30 * 100, [L("كفاءة الموارد", "Resource efficiency")]: toolOk ? 100 : 60, [L("اتخاذ القرار", "Decision-making")]: 100 - st.wrong * 15 },
          explain: L("بعد الحصاد تبقى التربة مكشوفة عدة أشهر قبل البذر. البقايا هي أرخص غطاء يحميها من الانجراف ومن تبخّر الماء.", "After harvest, the soil stays exposed for months before sowing. Residue is the cheapest cover against erosion and evaporation."),
          improve: L("اختر الأداة حسب مساحة حقلك، واترك جزءًا من التبن على التربة.", "Match the tool to your field size and leave part of the straw on the soil.") });
      }
    },
  };

  // ================================================================ LEVEL 2 – choose crops
  LEVELS["2"] = {
    title: () => L("اختر محاصيلك", "Choose your crops"),
    intro: () => L(`الآن نخطّط للموسمين القادمين. افتح بطاقة أي محصول لترى خصائصه، ثم ضعه في الموسم 1 أو 2. سأخبرك برأيي بصراحة!`, `Now we plan the next two seasons. Open any crop card to see its traits, then put it in season 1 or 2. I'll tell you honestly what I think!`),
    hints: () => [L("انظر إلى ما زرعته قبل. هل تريد تكرار نفس العائلة؟", "Look at what you grew before. Do you want to repeat the same family?"),
      L("تبديل الحبوب بالبقوليات يكسر دورة الأمراض ويترك بعض الآزوت للموسم التالي.", "Alternating cereals and legumes breaks disease cycles and leaves some nitrogen for the next season."),
      L(`في موقعك، المحاصيل القصيرة الدورة أو التي تُحش مبكرًا تتجنّب جزءًا من حرّ ماي. قارن نسبة "الماء الكافي" في البطاقات.`, `At your location, short-cycle crops or those cut early avoid part of the May heat. Compare the "water met" values on the cards.`)],
    init() { LV.st = { plan: [null, null], active: 0, open: null, confirm: null }; },
    view() {
      const st = LV.st, prev0 = lastCrop();
      const prevFor = (i) => (i === 0 ? prev0 : st.plan[0] || prev0);
      const cards = CROPS.map((k) => { return `<button class="ccard" data-act="g" data-a="open" data-v="${k}"><div class="art">${cropArt(k)}</div><b>${cname(k)}</b><small>${E.CROPS[CK[k]].family === "cereal" ? L("حبوب", "Cereal") : E.CROPS[CK[k]].family === "legume" ? L("بقوليات", "Legume") : L("خليط", "Mix")}</small></button>`; }).join("");
      return `<div class="slotbar in d2">${[0, 1].map((i) => `<button class="slotc ${st.plan[i] ? "full" : ""} ${st.active === i ? "active" : ""}" data-act="g" data-a="slot" data-i="${i}"><span>${L("الموسم", "Season")} ${i + 1}</span><b style="font-size:15px">${st.plan[i] ? cname(st.plan[i]) : L("اختر محصولًا", "Pick a crop")}</b></button>`).join("")}</div>
        <div class="note in d2">${L("قبل ذلك", "Before")}: ${cname(prev0)} · ${L("التقييم على 30 موسمًا من بيانات ناسا لموقعك", "Rated over 30 NASA seasons at your location")}</div>
        <div class="cgrid stagger">${cards}</div>
        <div class="spacer"></div>
        ${st.plan[0] && st.plan[1] ? `<button class="primary pop" data-act="g" data-a="end">${L("ثبّت الخطة", "Confirm the plan")} ${A.fwd()}</button>` : `<button class="primary" disabled>${L("املأ الموسمين", "Fill both seasons")}</button>`}`;
    },
    detail(k, prevArg, pick = true) {
      const prev = prevArg || (LV.st.active === 0 ? lastCrop() : LV.st.plan[0] || lastCrop()), c = E.CROPS[CK[k]], su = suitability(k, prev), salt = E.SALT[CK[k]];
      const fam = c.family === "cereal" ? L("حبوب (Poaceae)", "Cereal (Poaceae)") : c.family === "legume" ? L("بقوليات (Fabaceae)", "Legume (Fabaceae)") : L("خليط حبوب وبقوليات", "Cereal–legume mix");
      const harvestM = Math.min(9, c.sow + c.kc.length - 1);
      const fact = (t, v, na) => `<div class="fact ${na ? "na" : ""}">${t}<b>${v}</b></div>`;
      const why = { water: L("قد يحتاج ماءً أكثر مما يوفّره مطرك وتربتك عادة.", "It may need more water than your rain and soil usually provide."), heat: L("إزهاره يقع غالبًا في أيام حارة في موقعك.", "Its flowering often meets hot days at your location."), rotation: L(`من نفس عائلة ${cname(prev)}: خطر تراكم الأمراض.`, `Same family as ${cname(prev).toLowerCase()}: disease build-up risk.`), broomrape: L("بقولي بعد بقولي: خطر الهالوك (Orobanche).", "Legume after legume: broomrape (Orobanche) risk."), salt: L("حساس للملوحة.", "Sensitive to salinity."), system: L("النتائج مصمّمة للحقل المفتوح فقط.", "Results are designed for open fields only.") };
      return `<div class="riskcard sheet" role="dialog">
        <div style="display:flex;gap:10px;align-items:center"><div style="width:120px;border-radius:14px;overflow:hidden;background:linear-gradient(#cdeeff,#eaf7dc)">${cropArt(k)}</div><div style="flex:1"><div style="font-size:20px;font-weight:900">${cname(k)}</div></div></div>
        <div class="facts">
          ${fact(L("العائلة", "Family"), fam)}
          ${fact(L("موسم النمو", "Growing season"), `${mName(c.sow)} → ${mName(harvestM)}`)}
          ${fact(L("حاجة الماء (موسم متوسط هنا)", "Water need (avg season here)"), `≈ ${demandMm(k)} ${L("ملم", "mm")}`)}
          ${fact(L("الماء الكافي من المطر", "Water met by rain"), `${pct(su.st.ws)} · ${L("سنوات الجفاف", "dry years")} ${pct(su.st.dry)}`)}
          ${fact(L("عمق الجذور", "Root depth"), `${c.root} ${L("سم", "cm")}`)}
          ${fact(L("حساسية المردود لنقص الماء (Ky)", "Yield response to water (Ky)"), `${c.ky} ${c.ky > 1.05 ? L("· حساس", "· sensitive") : L("· متوسط", "· moderate")}`)}
          ${fact(L("الحساسية للحر عند الإزهار", "Heat sensitivity at flowering"), c.flower < 0 ? L("يُحش قبل الإزهار", "cut before flowering") : c.heat >= 0.9 ? L("عالية", "High") : c.heat >= 0.5 ? L("متوسطة", "Medium") : L("منخفضة", "Low"))}
          ${fact(L("تثبيت الآزوت", "Nitrogen fixation"), c.n ? L(`نعم (مؤشر ${c.n})`, `Yes (index ${c.n})`) : L("لا، يستهلك الآزوت", "No, it uses nitrogen"))}
          ${fact(L("تحمّل الملوحة (تقريبي)", "Salt tolerance (approx.)"), salt ? `${salt[0]} dS/m` : "—")}
          ${fact(L("المنتَج", "Product"), c.product === "forage" ? L("علف", "Forage") : L("حبوب", "Grain"))}
          ${fact(L("متطلبات الحرارة والـ pH والعناصر", "Temperature, pH & nutrient needs"), L("غير متوفرة في قاعدة بياناتنا بعد", "Not in our database yet"), true)}
          ${fact(L("ملاحظة الدورة", "Rotation note"), c.host >= 1 ? L("عائل للهالوك", "Broomrape host") : c.family === "cereal" ? L("لا تكرّره بعد حبوب", "Don't repeat after a cereal") : L("يكسر دورة أمراض الحبوب", "Breaks cereal disease cycles"))}
        </div>
        ${su.flags.length ? `<div class="panel2" style="background:#fff6e6"><b>${L("نقاط الانتباه", "Watch-outs")}</b><ul style="margin:4px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.6">${su.flags.map((f) => `<li>${why[f]}</li>`).join("")}</ul></div>` : ""}
        <div class="note">${L("المصادر: معاملات المحاصيل FAO-56، استجابة المردود للماء FAO-33/66، بيانات ناسا POWER 1995–2025 لموقعك. القيم تقديرية للموقع وليست قياسًا لحقلك.", "Sources: FAO-56 crop coefficients, FAO-33/66 yield response to water, NASA POWER 1995–2025 at your location. Location estimates, not field measurements.")}</div>
        <div style="display:flex;gap:8px"><button class="secondary" data-r="close" style="flex:1">${L("إغلاق", "Close")}</button>${pick ? `<button class="primary" data-r="pick" style="flex:1">${L("ضعه في الموسم", "Put in season")} ${LV.st.active + 1}</button>` : ""}</div></div>`;
    },
    on(a, d) {
      const st = LV.st;
      if (a === "tile") {
        const i = +d.i;
        const currentCrop = st.plan[st.active] || lastCrop();
        snd("good");
        say(L(`القطعة ${i + 1}: زرعت ${cname(currentCrop)} على الحقل مباشرة! 🌱`, `Plot ${i + 1}: planted ${cname(currentCrop)} directly on the field! 🌱`), "happy", "good");
        draw();
        return;
      }
      if (a === "slot") { st.active = +d.i; draw(); return; }
      if (a === "open") {
        const k = d.v, ov = document.createElement("div"); ov.className = "riskov fade"; ov.innerHTML = this.detail(k); document.body.appendChild(ov);
        ov.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (!b && e.target !== ov) return; ov.remove(); if (b && b.dataset.r === "pick") this.choose(k); });
        return;
      }
      if (a === "end") {
        const prev = lastCrop(), s1 = suitability(st.plan[0], prev), s2 = suitability(st.plan[1], st.plan[0]);
        const pts = { ok: 100, adj: 75, high: 45, na: 60 };
        const fam = (k) => E.CROPS[CK[k]].family, diverse = fam(st.plan[0]) !== fam(st.plan[1]) && fam(st.plan[0]) !== fam(prev);
        if (diverse) goodLog(L("نوّعت عائلات المحاصيل في الدورة.", "You diversified crop families in the rotation.")); else missLog(L("تنويع العائلات (حبوب ← بقوليات) يكسر دورة الأمراض.", "Alternating families (cereal ↔ legume) breaks disease cycles."));
        [[st.plan[0], s1], [st.plan[1], s2]].forEach(([k, s]) => { if (s.level === "ok") goodLog(L(`${cname(k)} مناسب لموقعك.`, `${cname(k)} suits your location.`)); else riskyLog(L(`${cname(k)}: ${LVLNAME[s.level][0]}.`, `${cname(k)}: ${LVLNAME[s.level][1].toLowerCase()}.`)); });
        if ([st.plan[0], st.plan[1]].some((k) => E.CROPS[CK[k]].n > 0)) goodLog(L("أدخلت بقوليًا يساهم في إدارة الآزوت.", "You included a legume that helps nitrogen management."));
        G().plan = st.plan.slice();
        const sc = (pts[s1.level] + pts[s2.level]) / 2 * 0.8 + (diverse ? 20 : 5);
        finish({ score: sc, dims: { [L("جودة الدورة", "Rotation quality")]: diverse ? 100 : 50, [L("التكيّف المناخي", "Climate adaptation")]: (pts[s1.level] + pts[s2.level]) / 2, [L("إدارة الماء", "Water management")]: (s1.st.ws + s2.st.ws) * 50 },
          explain: L("الملاءمة ليست نعم أو لا: المحصول قد يناسب مناخك لكنه يخاطر بعد نفس العائلة، أو يحتاج ماءً أكثر في السنوات الجافة.", "Suitability isn't yes/no: a crop may fit your climate yet carry risks after the same family, or need more water in dry years."),
          improve: L("ابحث عن محصولين من عائلتين مختلفتين، بنسبة \"الماء الكافي\" مرتفعة في سنوات الجفاف.", "Look for two crops from different families with high \"water met\" in dry years."), strategy: [lastCrop(), ...st.plan] });
      }
    },
    choose(k) {
      const st = LV.st, i = st.active, prev = i === 0 ? lastCrop() : st.plan[0] || lastCrop(), su = suitability(k, prev);
      const place = () => { st.plan[i] = k; if (i === 0 && !st.plan[1]) st.active = 1; draw(); };
      const c = E.CROPS[CK[k]];
      if (su.level === "ok") {
        place(); snd("good");
        risk({ level: "low", kind: "science", title: L(`${cname(k)}: اختيار جيد`, `${cname(k)}: a good choice`), decision: L(`زراعة ${cname(k)} في الموسم ${i + 1}`, `Growing ${cname(k).toLowerCase()} in season ${i + 1}`),
          why: L(`يغطي المطر ${pct(su.st.ws)} من حاجته في المتوسط.`, `Rain covers ${pct(su.st.ws)} of its needs on average.`),
          cons: c.n ? L("قد يساهم في إدارة الآزوت في دورتك.", "This legume may contribute to nitrogen management in your rotation.") : L("أداء جيد في أغلب المواسم.", "Good performance in most seasons."),
          mitig: L(`في سنوات الجفاف ينخفض إلى ${pct(su.st.dry)}: راقب مطر الخريف.`, `In dry years it drops to ${pct(su.st.dry)}: watch the autumn rain.`) });
        return;
      }
      // risky or high: are you sure?
      const why = su.flags.map((f) => ({ water: L("قد يحتاج ماءً أكثر مما يوفّره حقلك عادة", "it may need more water than your farm can comfortably provide"), heat: L("إزهاره يصادف أيامًا حارة", "its flowering meets hot days"), rotation: L(`من نفس عائلة ${cname(prev)}`, `it's the same family as ${cname(prev).toLowerCase()}`), broomrape: L("بقولي بعد بقولي (خطر الهالوك)", "legume after legume (broomrape risk)"), salt: L("حساس للملوحة", "sensitive to salinity"), system: L("النظام غير مدعوم", "system not supported") }[f])).join(L("، و", ", and "));
      const ov = document.createElement("div"); ov.className = "riskov fade";
      ov.innerHTML = `<div class="riskcard sheet"><div style="display:flex;gap:10px;align-items:center"><span style="flex:none;width:64px;height:64px">${salahM(64, "worried")}</span><div style="font-size:17px;font-weight:800">${L(`هل أنت متأكد من ${cname(k)}؟ ${why ? "ف" + why + "." : ""}`, `Are you sure about ${cname(k).toLowerCase()}? ${why ? "It's because " + why + "." : ""}`)}</div></div>
        ${lvlBadge(su.level)}<div style="display:flex;gap:8px"><button class="secondary" data-r="no" style="flex:1">${L("لا، أخبرني أكثر", "No, tell me more")}</button><button class="primary" data-r="yes" style="flex:1">${L("نعم، أنا متأكد", "Yes, I'm sure")}</button></div></div>`;
      document.body.appendChild(ov); snd("tap"); speak(L(`هل أنت متأكد من ${cname(k)}؟`, `Are you sure about ${cname(k)}?`));
      ov.addEventListener("click", (e) => {
        const b = e.target.closest("[data-r]"); if (!b) return; ov.remove();
        if (b.dataset.r === "yes") {
          const lvl = su.level === "high" ? "high" : "moderate";
          risk({ level: lvl, kind: "science", title: L("قبل أن تثبّت قرارك…", "Before you lock it in…"), decision: L(`${cname(k)} في الموسم ${i + 1}`, `${cname(k)} in season ${i + 1}`),
            why: L(`${why}. يغطي المطر ${pct(su.st.ws)} من حاجته، و${pct(su.st.dry)} في سنوات الجفاف.`, `${why}. Rain covers ${pct(su.st.ws)} of its needs, ${pct(su.st.dry)} in dry years.`),
            cons: su.flags.includes("rotation") ? L("لم نزرع هذه العائلة هنا للتو؟ فكّر في فوائد تنويع دورتك. قد تتراكم الأمراض وينخفض المردود.", "Didn't we just grow that family here? Think about the benefits of diversifying. Diseases may build up and yields drop.") : L("حذارِ! هذا المحصول قد يزيد الضغط على مخزون الماء ويقل مردوده في السنوات الجافة.", "Careful! This crop may put additional pressure on your water reserves and yield less in dry years."),
            mitig: L("تلميح: البذر المبكر، ترك البقايا، أو سقية واحدة عند الإزهار تقلّل الخطر.", "Hint: early sowing, keeping residue, or one watering at flowering lowers the risk."), okLabel: L("أؤكد اختياري", "I confirm my choice") },
          () => { place(); riskyLog(L(`اخترت ${cname(k)} رغم التحذير (${LVLNAME[su.level][0]}).`, `You chose ${cname(k).toLowerCase()} despite the warning (${LVLNAME[su.level][1].toLowerCase()}).`)); say(L("حسنًا، قرارك. سنرى ما سيحدث!", "Alright, your call. We'll see what happens!"), "worried", "warn"); }, () => { });
        } else {
          const alts = CROPS.filter((x) => x !== k).map((x) => ({ x, s: suitability(x, prev) })).filter((o) => o.s.level === "ok").sort((a2, b2) => b2.s.st.y - a2.s.st.y).slice(0, 2);
          say(L(`${cname(k)}: ${why}. ${alts.length ? "جرّب بدلًا منه " + alts.map((o) => cname(o.x)).join(" أو ") + "، يغطي المطر " + pct(alts[0].s.st.ws) + " من حاجته." : "افتح البطاقات وقارن \"الماء الكافي\"."}`, `${cname(k)}: ${why}. ${alts.length ? "Consider " + alts.map((o) => cname(o.x).toLowerCase()).join(" or ") + " instead; rain covers " + pct(alts[0].s.st.ws) + " of its needs." : "Open the cards and compare \"water met\"."}`), "happy", "warn");
        }
      });
    },
  };

  // ================================================================ LEVEL 3 – drought crisis
  LEVELS["3"] = {
    title: () => L("أزمة الجفاف", "The drought crisis"),
    intro: () => { const l = loc(), s = LV.st.s; return L(`موسم ${DATA.seasons[s]} كان حقيقيًا وقاسيًا: ${l.summary.rain_oct_may[s]} ملم فقط من أكتوبر إلى ماي، والمتوسط ${l.summary.rain_mean}. لديك ${LV.st.tokens} حصص ماء (30 ملم لكل حصة). وزّعها على الأشهر بذكاء.`, `Season ${DATA.seasons[s]} was real and harsh: only ${l.summary.rain_oct_may[s]} mm Oct–May against a ${l.summary.rain_mean} mm average. You have ${LV.st.tokens} water shares (30 mm each). Spread them wisely.`); },
    hints: () => [L("ليست كل الأشهر متساوية. متى يحتاج المحصول الماء أكثر؟", "Not all months are equal. When does the crop need water most?"),
      L("نقص الماء عند الإزهار وامتلاء الحبوب يضرّ المردود أكثر من بداية النمو (FAO-33).", "Water shortage at flowering and grain filling hurts yield more than early growth (FAO-33)."),
      L(`ضع الحصص في الأشهر ذات العجز الأكبر حول ${mName(LV.st.base.flowerMonth != null ? LV.st.base.flowerMonth : 7)}، واختر التنقيط لأن كفاءته أعلى، وجرّب الغطاء (Mulch).`, `Put the shares in the months with the biggest deficit around ${mName(LV.st.base.flowerMonth != null ? LV.st.base.flowerMonth : 7)}, choose drip for its higher efficiency, and try mulch.`)],
    init() {
      const l = loc(), dr = l.summary.driest.slice().sort((a, b) => l.summary.rain_oct_may[a] - l.summary.rain_oct_may[b])[0];
      let crop = planCrop(0); if (crop === "fallow") crop = "wheat";
      const prev = lastCrop() === crop ? "fallow" : lastCrop();
      const base = seasonRun(crop, dr, { prev }), mul = seasonRun(crop, dr, { prev, residue: "kept" });
      LV.st = { s: dr, crop, prev, base, mul, tokens: 3, alloc: {}, method: "flood", mulch: false, ran: false };
    },
    calc(st) {
      const rec = st.mulch ? st.mul : st.base, c = E.CROPS[CK[st.crop]], eff = { drip: 0.9, sprinkler: 0.75, flood: 0.6 }[st.method];
      let D = 0, Aet = 0; rec.months.forEach((mo, m) => { if (mo.kc === null) return; D += mo.demand; Aet += Math.min(mo.demand, mo.aet + (st.alloc[m] || 0) * 30 * eff); });
      const lost = rec.ws > 0 ? rec.aet / rec.ws - rec.demand : 0;
      const ws = Aet / (D + Math.max(0, lost));
      return Math.max(0, Math.min(1, 1 - c.ky * (1 - ws))) * (1 - rec.heat - rec.frost) * rec.rotPen * (1 - (rec.salt || 0));
    },
    best(st) {
      let best = 0;
      ["drip"].forEach((method) => [false, true].forEach((mulch) => {
        const s2 = { ...st, method, mulch, alloc: {} }, rec = mulch ? st.mul : st.base, eff = 0.9;
        for (let t = 0; t < st.tokens; t++) { let bm = null, bd = 0; rec.months.forEach((mo, m) => { if (mo.kc === null) return; const def = mo.demand - mo.aet - (s2.alloc[m] || 0) * 30 * eff; if (def > bd) { bd = def; bm = m; } }); if (bm == null) break; s2.alloc[bm] = (s2.alloc[bm] || 0) + 1; }
        best = Math.max(best, this.calc(s2));
      }));
      return best;
    },
    view() {
      const st = LV.st, rec = st.mulch ? st.mul : st.base, used = Object.values(st.alloc).reduce((a, b) => a + b, 0), eff = { drip: 0.9, sprinkler: 0.75, flood: 0.6 }[st.method];
      const months = rec.months.map((mo, m) => ({ mo, m })).filter((o) => o.mo.kc !== null);
      const maxD = Math.max(...months.map((o) => o.mo.demand), 1);
      const y = this.calc(st), y0 = this.calc({ ...st, alloc: {}, mulch: false });
      const bars = months.map(({ mo, m }) => { const add = (st.alloc[m] || 0) * 30 * eff, got = Math.min(mo.demand, mo.aet + add);
        return `<button class="mbar ${m === rec.flowerMonth ? "flower" : ""}" data-act="g" data-a="tok" data-m="${m}" aria-label="${mName(m)}"><span class="tok">${st.alloc[m] ? "+" + st.alloc[m] : ""}</span>
          <span class="stack" style="height:${Math.round(mo.demand / maxD * 110)}px"><i style="height:${Math.round(Math.min(mo.aet, mo.demand) / mo.demand * 100)}%;background:#6cc04a"></i><i style="height:${Math.round((got - Math.min(mo.aet, mo.demand)) / mo.demand * 100)}%;background:#2b8fe0"></i></span>
          <span>${mName(m).slice(0, S().lang === "en" ? 3 : 4)}</span></button>`; }).join("");
      return `<div class="panel2 in d2"><div style="display:flex;justify-content:space-between;align-items:center"><b>${cname(st.crop)} · ${DATA.seasons[st.s]}</b><span class="obs">${L("موسم حقيقي من ناسا", "Real NASA season")}</span></div>
          <div class="mbars">${bars}</div>
          <div class="legend2"><span><i style="background:#6cc04a"></i>${L("ماء من المطر والتربة", "Water from rain & soil")}</span><span><i style="background:#2b8fe0"></i>${L("سقيك", "Your watering")}</span><span><i style="background:#fbeccc"></i>${L("عجز", "Deficit")}</span><span style="color:#e8552f">● ${L("شهر الإزهار", "flowering month")}</span></div>
          <div class="note">${L("اضغط على شهر لإضافة حصة ماء، واضغط مطوّلًا مرة ثانية بعد امتلاء الحصص لإزالتها.", "Tap a month to add a water share; tap again when all shares are used to remove one.")} <span class="hyp">${L("الحصص افتراضية", "Water budget is hypothetical")}</span></div></div>
        <div class="panel2 in d3" style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between"><b>${L("حصص الماء", "Water shares")}: ${st.tokens - used}/${st.tokens}</b><button class="chip" data-act="g" data-a="clear" style="min-height:36px;padding:4px 12px">${L("مسح", "Clear")}</button></div>
          <div class="chiprow">${[["drip", L("تنقيط 90%", "Drip 90%")], ["sprinkler", L("رش 75%", "Sprinkler 75%")], ["flood", L("غمر 60%", "Flood 60%")]].map((o) => `<button class="chip ${st.method === o[0] ? "on" : ""}" data-act="g" data-a="method" data-v="${o[0]}">${o[1]}</button>`).join("")}</div>
          <button class="chip ${st.mulch ? "on" : ""}" data-act="g" data-a="mulch" style="align-self:flex-start">${st.mulch ? '<span class="ck"></span>' : ""}${L("غطاء تبن (Mulch) يقلّل التبخّر", "Straw mulch reduces evaporation")}</button>
          <div class="note">${L("نسب الكفاءة تقديرية لطرق الري (FAO).", "Efficiencies are typical values for irrigation methods (FAO).")}</div></div>
        <div class="panel2 in d4 gauge"><svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="32" fill="none" stroke="#ece7dc" stroke-width="9"/><circle cx="40" cy="40" r="32" fill="none" stroke="${y > 0.5 ? "#4a9e2f" : y > 0.3 ? "#f5a623" : "#e8483d"}" stroke-width="9" stroke-dasharray="${201 * y} 201" transform="rotate(-90 40 40)" stroke-linecap="round" style="transition:stroke-dasharray .6s"/><text x="40" y="45" text-anchor="middle" font-size="16" font-weight="900" fill="#3a2a18">${pct(y)}</text></svg>
          <div><b>${L("المردود المتوقع (من الممكن)", "Expected yield (of possible)")}</b><div class="note">${L("بدون سقي", "Without water")}: ${pct(y0)} · ${L("مؤشر من محرك الماء (FAO-33)", "Index from the water engine (FAO-33)")}</div></div></div>
        <div class="spacer"></div>
        ${used > 0 ? `<button class="primary pop" data-act="g" data-a="run">${L("شغّل الموسم", "Run the season")} ${A.fwd()}</button>` : `<button class="primary" disabled>${L("وزّع حصة ماء واحدة على الأقل", "Place at least one water share")}</button>`}`;
    },
    on(a, d) {
      const st = LV.st, used = Object.values(st.alloc).reduce((x, y) => x + y, 0);
      if (a === "tile") {
        const i = +d.i;
        st.watered = st.watered || {};
        st.watered[i] = !st.watered[i];
        snd("good");
        say(st.watered[i] ? L("سقيت هذه القطعة مباشرة! رطوبة التربة ترتفع.", "Directly watered this plot! Soil moisture rises.") : L("أوقفت السقي عن هذه القطعة.", "Stopped watering this plot."), "happy", "good");
        draw();
        return;
      }
      if (a === "tok") {
        const m = +d.m, rec = st.mulch ? st.mul : st.base, mo = rec.months[m];
        if (used >= st.tokens) { if (st.alloc[m]) { st.alloc[m]--; if (!st.alloc[m]) delete st.alloc[m]; } else say(L("انتهت حصصك! اضغط على شهر فيه حصة لإزالتها.", "You're out of shares! Tap a month with a share to remove it."), "worried", "warn"); draw(); return; }
        st.alloc[m] = (st.alloc[m] || 0) + 1; snd("tap");
        const def = mo.demand - mo.aet;
        if (def < 10) say(L(`${mName(m)}؟ المحصول لا يعاني كثيرًا هذا الشهر. الماء لا ينبت على الأشجار!`, `${mName(m)}? The crop isn't short of water this month. Water doesn't grow on trees!`), "worried", "warn");
        else if (m === rec.flowerMonth || m === rec.flowerMonth - 1) say(L("ممتاز! الإزهار هو الوقت الحرج.", "Excellent! Flowering is the critical time."), "happy", "good");
        else say(L(`عجز ${mName(m)} حوالي ${Math.round(def)} ملم.`, `${mName(m)} deficit is about ${Math.round(def)} mm.`), "happy", "n");
        draw(); return;
      }
      if (a === "clear") { st.alloc = {}; draw(); return; }
      if (a === "method") {
        st.method = d.v; draw();
        if (d.v === "flood") risk({ level: "moderate", kind: "science", title: L("الري بالغمر في الجفاف", "Flood irrigation in a drought"), decision: L("اختيار الغمر", "Choosing flood"), why: L("جزء كبير من الماء يضيع بالتسرّب والتبخّر.", "Much of the water is lost to drainage and evaporation."), cons: L("حوالي 40% من حصصك لا يصل للمحصول.", "About 40% of your shares never reach the crop."), mitig: L("التنقيط يوصل حوالي 90%.", "Drip delivers about 90%.") });
        return;
      }
      if (a === "mulch") { st.mulch = !st.mulch; const gain = this.calc({ ...st, mulch: true }) - this.calc({ ...st, mulch: false }); say(st.mulch ? (gain > 0.005 ? L(`الغطاء يحفظ ماء التربة: +${pct(gain)} في المردود.`, `Mulch keeps soil water: +${pct(gain)} yield.`) : L("في هذا الموسم الجاف جدًا، الغطاء لا يغيّر المردود كثيرًا، لكنه يحمي التربة.", "In this very dry season mulch barely changes yield, but it still protects the soil.")) : L("أزلت الغطاء.", "Mulch removed."), "happy", "n"); draw(); return; }
      if (a === "run") {
        const y = this.calc(st), y0 = this.calc({ ...st, alloc: {}, mulch: false }), yb = this.best(st), rec = st.mulch ? st.mul : st.base;
        const crit = Object.keys(st.alloc).filter((m) => +m === rec.flowerMonth || +m === rec.flowerMonth - 1).length;
        if (crit) goodLog(L("سقيت في الفترة الحرجة حول الإزهار.", "You watered in the critical period around flowering.")); else missLog(L("الماء عند الإزهار يعطي أكبر فائدة.", "Water at flowering gives the biggest benefit."));
        if (st.method === "drip") goodLog(L("اخترت التنقيط، الأعلى كفاءة.", "You chose drip, the most efficient method.")); else riskyLog(L(`الري بـ${st.method === "flood" ? "الغمر" : "الرش"} يضيّع جزءًا من الماء.`, `${st.method === "flood" ? "Flood" : "Sprinkler"} irrigation loses part of the water.`));
        if (st.mulch) goodLog(L("استعملت الغطاء لتقليل التبخّر.", "You used mulch to cut evaporation."));
        const eff = yb > y0 ? (y - y0) / (yb - y0) : 1;
        finish({ score: 25 + 75 * eff, dims: { [L("إدارة الماء", "Water management")]: eff * 100, [L("كفاءة الموارد", "Resource efficiency")]: { drip: 100, sprinkler: 70, flood: 45 }[st.method], [L("التكيّف المناخي", "Climate adaptation")]: y * 100 },
          explain: L(`بدون ماء: ${pct(y0)}، بقراراتك: ${pct(y)}، وأفضل توزيع ممكن: ${pct(yb)}. نفس الكمية من الماء تعطي نتائج مختلفة حسب التوقيت والطريقة.`, `No water: ${pct(y0)}; your plan: ${pct(y)}; best possible: ${pct(yb)}. The same water gives different results depending on timing and method.`),
          improve: L("ضع الحصص حيث العجز الأكبر قرب الإزهار، واستعمل التنقيط.", "Put shares where the deficit is largest near flowering, and use drip.") });
      }
    },
  };

  // ================================================================ LEVEL 4 – heatwave
  LEVELS["4"] = {
    title: () => L("موجة الحر", "The heatwave"),
    intro: () => L(`في موسم ${DATA.seasons[LV.st.s]} سجّلت ناسا ${LV.st.hot} يومًا فوق 31° في أفريل وماي، وقت الإزهار. اختر المحصول وموعد البذر لتحمي الإزهار من الحر.`, `In season ${DATA.seasons[LV.st.s]}, NASA recorded ${LV.st.hot} days above 31°C in April–May, right at flowering. Choose the crop and sowing date to protect flowering from the heat.`),
    hints: () => [L("انظر أين تقع علامة الإزهار على شريط الحرارة.", "Look where the flowering marker sits on the heat strip."),
      L("المحصول قد يناسب مناخك عمومًا لكنه يتضرّر إذا صادف الحر مرحلة حساسة كالإزهار.", "A crop may suit your climate overall yet suffer if heat hits a sensitive stage like flowering."),
      L("البذر المبكر يقدّم الإزهار شهرًا. الشعير يتحمّل الحر أكثر من القمح، والحمص يُزهر متأخرًا في ماي.", "Early sowing moves flowering a month earlier. Barley tolerates heat better than wheat; chickpea flowers late, in May.")],
    init() {
      const l = loc(); let s = 0, best = -1;
      l.hot.forEach((row, i) => { const h = row[7] + row[8]; if (h > best) { best = h; s = i; } });
      const opts = [...new Set([planCrop(0) === "fallow" ? "wheat" : planCrop(0), "wheat", "barley", "chickpea"])].slice(0, 3);
      LV.st = { s, hot: best, crops: opts, crop: opts[0], sowing: "normal", water: false, ran: null, tries: 0 };
    },
    run(st, o = {}) { const r = seasonRun(o.crop || st.crop, st.s, { prev: lastCrop(), sowing: o.sowing || st.sowing, irr: o.water != null ? o.water : st.water }); return r; },
    view() {
      const st = LV.st, l = loc(), rec = this.run(st), c = E.CROPS[CK[st.crop]];
      const start = rec.months.findIndex((x) => x.kc !== null), end = rec.months.reduce((a, x, i) => (x.kc !== null ? i : a), start);
      const hmax = Math.max(...l.hot[st.s].slice(0, 10), 1);
      const strip = l.hot[st.s].slice(0, 10).map((h, m) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;height:60px;display:flex;align-items:flex-end"><div style="width:100%;height:${Math.round(h / hmax * 56) + 2}px;border-radius:4px 4px 0 0;background:${h >= 10 ? "#e8483d" : h >= 4 ? "#ff9a3d" : "#e8d9a8"};transition:height .4s"></div></div>
        <div style="width:100%;height:12px;background:${m >= start && m <= end ? (m === rec.flowerMonth ? "#e8552f" : "#6cc04a") : "transparent"};border-radius:3px;transition:background .4s"></div>
        <span style="font-size:9.5px;font-weight:700;color:#6a5440">${mName(m).slice(0, S().lang === "en" ? 3 : 4)}</span></div>`).join("");
      return `<div class="panel2 in d2"><div style="display:flex;justify-content:space-between"><b>${L("أيام الحر (>31°) لكل شهر", "Hot days (>31°C) per month")}</b><span class="obs">${L("مُرصود · ناسا", "Observed · NASA")} ${DATA.seasons[st.s]}</span></div>
          <div style="display:flex;gap:3px;margin-top:6px">${strip}</div>
          <div class="legend2" style="margin-top:4px"><span><i style="background:#6cc04a"></i>${L("المحصول في الحقل", "Crop in the field")}</span><span><i style="background:#e8552f"></i>${L("الإزهار", "Flowering")}</span></div>
          <div class="note">${c.flower < 0 ? L("هذا المحصول يُحش علفًا قبل الإزهار.", "This crop is cut for forage before flowering.") : L(`الإزهار في ${rec.flowerMonth != null ? mName(rec.flowerMonth) : "—"}: ${rec.flowerMonth != null ? l.hot[st.s][rec.flowerMonth] : 0} يوم حار.`, `Flowering in ${rec.flowerMonth != null ? mName(rec.flowerMonth) : "—"}: ${rec.flowerMonth != null ? l.hot[st.s][rec.flowerMonth] : 0} hot days.`)}</div></div>
        <div class="panel2 in d3" style="display:flex;flex-direction:column;gap:8px">
          <b>${L("المحصول", "Crop")}</b><div class="chiprow">${st.crops.map((k) => `<button class="chip ${st.crop === k ? "on" : ""}" data-act="g" data-a="crop" data-v="${k}">${cname(k)}</button>`).join("")}</div>
          <b>${L("موعد البذر", "Sowing date")}</b><div class="chiprow">${[["early", L("مبكر (أكتوبر)", "Early (Oct)")], ["normal", L("عادي (نوفمبر)", "Normal (Nov)")], ["late", L("متأخر (ديسمبر)", "Late (Dec)")]].map((o) => `<button class="chip ${st.sowing === o[0] ? "on" : ""}" data-act="g" data-a="sow" data-v="${o[0]}">${o[1]}</button>`).join("")}</div>
          ${farmE().water ? `<button class="chip ${st.water ? "on" : ""}" data-act="g" data-a="water" style="align-self:flex-start">${st.water ? '<span class="ck"></span>' : ""}${L("سقية عند الإزهار", "One watering at flowering")}</button>` : `<div class="note">${L("لا ماء إضافي لديك: السقي غير متاح.", "No extra water on your farm: watering is not available.")}</div>`}
        </div>
        <div class="panel2 in d4" style="display:flex;gap:12px;align-items:center"><div style="flex:1"><b>${L("ضرر الحر عند الإزهار", "Heat damage at flowering")}</b><div class="pbar" style="margin-top:4px"><i style="width:${Math.round(rec.heat / 0.35 * 100)}%;background:#e8483d"></i></div></div>
          <div style="text-align:center"><div style="font-size:24px;font-weight:900;color:#e8552f">${pct(rec.yieldIdx)}</div><div class="note">${L("المردود", "yield")}</div></div></div>
        <div class="spacer"></div>
        <button class="primary" data-act="g" data-a="lock">${L("ثبّت الخطة", "Lock in the plan")} ${A.fwd()}</button>`;
    },
    on(a, d) {
      const st = LV.st;
      if (a === "tile") {
        st.mist = !st.mist;
        snd("good");
        say(st.mist ? L("رذاذ تبريد خفيف على الحقل يخفّف حرارة الظهيرة!", "Cooling mist spray on the field eases midday heat!") : L("أوقفت رذاذ التبريد.", "Turned off cooling mist."), "happy", "good");
        draw();
        return;
      }
      if (a === "crop" || a === "sow" || a === "water") {
        const before = this.run(st);
        if (a === "crop") st.crop = d.v; if (a === "sow") st.sowing = d.v; if (a === "water") st.water = !st.water;
        const after = this.run(st);
        say(after.heat < before.heat - 0.01 ? L("الإزهار ابتعد عن الحر. أحسنت!", "Flowering moved away from the heat. Nice!") : after.heat > before.heat + 0.01 ? L("أوه! الإزهار صار في قلب الحر.", "Oh! Flowering is now in the heat's peak.") : after.yieldIdx > before.yieldIdx + 0.01 ? L("أفضل قليلًا.", "A bit better.") : L("لا فرق كبير. جرّب شيئًا آخر.", "Not much difference. Try something else."), after.heat > before.heat + 0.01 ? "worried" : "happy", after.heat > before.heat + 0.01 ? "warn" : "n");
        if (a === "sow" && d.v === "late") risk({ level: "moderate", kind: "science", title: L("البذر المتأخر", "Late sowing"), decision: L("البذر في ديسمبر", "Sowing in December"), why: L("الدورة تتأخر شهرًا.", "The cycle shifts a month later."), cons: L("الإزهار وامتلاء الحبوب يقعان في ماي الأشد حرًا وجفافًا.", "Flowering and grain filling land in hotter, drier May."), mitig: L("ابذر في الموعد أو مبكرًا إذا سمح مطر الخريف.", "Sow on time or early if autumn rain allows.") });
        draw(); return;
      }
      if (a === "lock") {
        let best = 0, bestO = null;
        st.crops.forEach((cr) => ["early", "normal", "late"].forEach((sw) => [false, farmE().water].forEach((w) => { const r = this.run(st, { crop: cr, sowing: sw, water: w }); if (r.yieldIdx > best) { best = r.yieldIdx; bestO = { cr, sw }; } })));
        const r = this.run(st);
        if (r.heat < 0.08) goodLog(L("أبعدت الإزهار عن أيام الحر.", "You kept flowering away from the hot days.")); else missLog(L("الإزهار بقي في فترة حارة.", "Flowering stayed in a hot period."));
        if (st.sowing === "late") riskyLog(L("البذر المتأخر زاد التعرّض للحر.", "Late sowing increased heat exposure."));
        if (st.sowing === "early") goodLog(L("البذر المبكر قدّم الإزهار قبل الحر.", "Early sowing brought flowering before the heat."));
        finish({ score: best ? 100 * r.yieldIdx / best : 50, dims: { [L("التكيّف المناخي", "Climate adaptation")]: 100 - r.heat / 0.35 * 100, [L("اتخاذ القرار", "Decision-making")]: best ? 100 * r.yieldIdx / best : 50 },
          explain: L(`ملاءمة المحصول للحرارة تعني أنه ينمو جيدًا في مناخك عمومًا، أما إجهاد الحر فيحدث عندما يصادف الحر مرحلة حساسة. أفضل خيار هنا: ${cname(bestO.cr)} بذر ${bestO.sw === "early" ? "مبكر" : bestO.sw === "late" ? "متأخر" : "عادي"} (${pct(best)}).`, `Temperature suitability means the crop grows well in your climate overall; heat stress happens when heat hits a sensitive stage. Best option here: ${cname(bestO.cr).toLowerCase()}, ${bestO.sw} sowing (${pct(best)}).`),
          improve: L("قارن موعد الإزهار مع أشهر الحر قبل اختيار المحصول والموعد.", "Compare flowering time with the hot months before choosing crop and date.") });
      }
    },
  };

  // ================================================================ LEVEL 5 – unexpected rainfall
  LEVELS["5"] = {
    title: () => L("المطر المفاجئ", "The unexpected rainfall"),
    intro: () => L(`عاصفة مطرية قوية قادمة على حقلك المكشوف بعد الحصاد (حدث افتراضي). ناسا سجّلت عندك حتى ${LV.st.maxHeavy} ملم من المطر الغزير في شهر واحد. لديك ${LV.st.budget} نقاط عمل. احمِ القطع الأكثر عرضة!`, `A strong storm is coming onto your bare field after harvest (hypothetical event). NASA recorded up to ${LV.st.maxHeavy} mm of heavy rain in a single month here. You have ${LV.st.budget} action points. Protect the most vulnerable plots!`),
    hints: () => [L("ليست كل القطع متساوية. أين ينحدر الحقل أكثر؟", "Not all plots are equal. Where is the field steepest?"),
      L("الماء يجري من الأعلى إلى الأسفل. الحاجز في الأعلى يحمي ما تحته، والغطاء يحمي القطعة نفسها.", "Water runs downhill. A barrier up top protects what's below; cover protects the plot itself."),
      L("ابدأ بالصفوف العليا الشديدة الانحدار: خط كنتوري (يحمي صفًا كاملًا) أو غطاء تبن على القطع الحمراء.", "Start with the steep top rows: a contour line (protects a whole row) or straw mulch on red plots.")],
    init() {
      const l = loc(), maxHeavy = Math.round(Math.max(...l.heavy.flat()));
      const sl = farmE().slope;
      LV.st = { budget: 6, tool: "mulch", prot: {}, contour: {}, maxHeavy, slopes: [1.4, 1.15, 0.9, 0.7].map((f) => f * Math.max(1, sl) / 4.4), stormed: false };
    },
    tileRisk(st, i) {
      const r = Math.floor(i / 5), c = i % 5; let f = st.slopes[r];
      const p = st.prot[i]; if (p === "mulch") f *= 0.5; if (p === "cover") f *= 0.65; if (p === "barrier") f *= 0.6;
      if (st.contour[r]) f *= 0.7;
      if (r > 0 && st.prot[(r - 1) * 5 + c] === "barrier") f *= 0.6;
      return f;
    },
    total(st) { let s = 0; for (let i = 0; i < 20; i++) s += this.tileRisk(st, i); return s; },
    used(st) { return Object.keys(st.prot).length + Object.keys(st.contour).length * 2; },
    bestRatio(st) {
      const s2 = { ...st, prot: {}, contour: {} }; const base = this.total(s2);
      for (let k = 0; k < 10; k++) {
        let best = null, gain = 0;
        for (let i = 0; i < 20; i++) ["mulch", "barrier"].forEach((t) => { if (s2.prot[i] || this.used(s2) + 1 > st.budget) return; const b = this.total(s2); s2.prot[i] = t; const g = b - this.total(s2); delete s2.prot[i]; if (g > gain) { gain = g; best = ["p", i, t]; } });
        for (let r = 0; r < 4; r++) { if (s2.contour[r] || this.used(s2) + 2 > st.budget) continue; const b = this.total(s2); s2.contour[r] = 1; const g = (b - this.total(s2)) / 2; delete s2.contour[r]; if (g > gain) { gain = g; best = ["c", r]; } }
        if (!best) break; if (best[0] === "p") s2.prot[best[1]] = best[2]; else s2.contour[best[1]] = 1;
      }
      return 1 - this.total(s2) / base;
    },
    view() {
      const st = LV.st, left = st.budget - this.used(st);
      const colr = (v) => v > 0.9 ? "#b5674a" : v > 0.6 ? "#c98e62" : v > 0.4 ? "#c9b37a" : "#9fb46a";
      const field = board3d(5, 4, (i, c, r) => { const p = st.prot[i];
        return { fill: colr(this.tileRisk(st, i)), h: (3 - r) * 7, flat: (p === "mulch" ? FLAT.mulch : "") + (st.contour[r] ? FLAT.contour : "") + (st.stormed && this.tileRisk(st, i) > 0.6 ? FLAT.runoff : ""),
          deco: p === "cover" ? plantDeco("vetch", 4, "grow") : p === "barrier" ? `<g class="grow"><path d="M-18 2 L18 2" stroke="#5f7d36" stroke-width="7" stroke-linecap="round"/><circle cx="-10" cy="-3" r="5" fill="#4a9e2f"/><circle cx="2" cy="-5" r="5" fill="#6cc04a"/><circle cx="13" cy="-3" r="4" fill="#4a9e2f"/></g>` : "", label: L("قطعة", "plot") }; },
        { env: "storm", rain: st.stormed, label: L("حقل منحدر: الصف الأول هو الأعلى", "Sloped field: the first row is the highest"), badge: L(`انحدار ${farmE().slope}% · الأعلى في الخلف`, `Slope ${farmE().slope}% · top row at the back`) });
      const tools = [["mulch", L("غطاء تبن", "Mulch"), "1"], ["cover", L("غطاء نباتي", "Cover crop"), "1"], ["barrier", L("حاجز نباتي", "Veg. barrier"), "1"], ["contour", L("خط كنتوري (صف)", "Contour (row)"), "2"]];
      return `<div class="in d2">${field}<div class="legend2" style="padding:4px 6px"><span><i style="background:#b5674a"></i>${L("خطر عالٍ", "High risk")}</span><span><i style="background:#c9b37a"></i>${L("متوسط", "Medium")}</span><span><i style="background:#9fb46a"></i>${L("منخفض", "Low")}</span><span class="hyp">${L("عاصفة افتراضية · مستويات نسبية", "Hypothetical storm · relative levels")}</span></div></div>
        <div class="toolbar in d3">${tools.map((t) => `<button class="tool ${st.tool === t[0] ? "on" : ""}" data-act="g" data-a="tool" data-v="${t[0]}">${t[1]}<small>${t[2]} ${L("نقطة", "pt")}</small></button>`).join("")}</div>
        <div class="note">${st.tool === "contour" ? L("اضغط على أي قطعة لوضع خط كنتوري على صفّها.", "Tap any plot to put a contour line across its row.") : L("اضغط على قطعة لوضع الأداة، واضغط مرة أخرى لإزالتها.", "Tap a plot to place the tool, tap again to remove it.")} · ${L("النقاط المتبقية", "Points left")}: <b>${left}</b> · ${L("الغطاء النباتي يحتاج وقتًا لينمو فيحمي أقل في عاصفة مبكرة.", "A cover crop needs time to grow, so it protects less in an early storm.")}</div>
        <div class="spacer"></div>
        ${st.stormed ? `<button class="primary pop" data-act="g" data-a="end">${L("النتيجة", "See the result")} ${A.fwd()}</button>` : `<button class="primary" data-act="g" data-a="storm">${L("أطلق العاصفة", "Start the storm")} ${A.fwd()}</button>`}`;
    },
    on(a, d) {
      const st = LV.st;
      if (a === "tool") { st.tool = d.v; draw(); return; }
      if (a === "tile" && !st.stormed) {
        const i = +d.i, r = Math.floor(i / 5);
        if (st.tool === "contour") { if (st.contour[r]) delete st.contour[r]; else if (this.used(st) + 2 <= st.budget) { st.contour[r] = 1; snd("tap"); } else say(L("لا نقاط كافية!", "Not enough points!"), "worried", "warn"); draw(); return; }
        if (st.prot[i]) delete st.prot[i]; else if (this.used(st) + 1 <= st.budget) { st.prot[i] = st.tool; snd("tap"); if (r >= 3 && !Object.keys(st.prot).some((k) => +k < 10)) say(L("الأسفل أقل انحدارًا… هل نسيت أعلى الحقل؟", "The bottom is less steep… did you forget the top?"), "worried", "warn"); } else say(L("انتهت نقاطك! أزل أداة لتضعها في مكان آخر.", "Out of points! Remove a tool to move it."), "worried", "warn");
        draw(); return;
      }
      if (a === "storm") { st.stormed = true; snd("rain"); draw(); say(L("ها هي العاصفة! انظر أين يجري الماء ويحمل التربة.", "Here it comes! Watch where the water runs and carries soil."), "worried", "warn"); return; }
      if (a === "end") {
        const base = this.total({ ...st, prot: {}, contour: {} }), ratio = 1 - this.total(st) / base, best = this.bestRatio(st);
        const top = Object.keys(st.prot).filter((k) => +k < 10).length + Object.keys(st.contour).filter((r) => +r < 2).length;
        if (top) goodLog(L("حميت الجزء الأشد انحدارًا.", "You protected the steepest part.")); else missLog(L("أعلى الحقل هو الأكثر عرضة للانجراف.", "The top of the field is most at risk."));
        if (Object.values(st.prot).includes("cover")) riskyLog(L("الغطاء النباتي لم ينمُ بعد عند عاصفة مبكرة.", "The cover crop hadn't grown yet for an early storm."));
        if (this.used(st) < st.budget) missLog(L("بقيت نقاط عمل غير مستعملة.", "Some action points were left unused."));
        finish({ score: 100 * Math.min(1, ratio / best), dims: { [L("إدارة التربة", "Soil management")]: ratio * 100, [L("كفاءة الموارد", "Resource efficiency")]: this.used(st) / st.budget * 100 },
          explain: L(`قلّلت الخطر النسبي بـ${pct(ratio)} (الأفضل الممكن بنفس النقاط: ${pct(best)}). الانحدار والتربة العارية بعد الحصاد يحدّدان أين يبدأ الانجراف. هذه مستويات نسبية للتوضيح وليست قياسًا.`, `You cut the relative risk by ${pct(ratio)} (best possible with the same points: ${pct(best)}). Slope and bare soil after harvest decide where erosion starts. These are illustrative relative levels, not measurements.`),
          improve: L("ابدأ بأعلى الحقل والصفوف الأكثر انحدارًا، واستعمل الخطوط الكنتورية للصفوف الطويلة.", "Start at the top and steepest rows; use contour lines for long rows.") });
      }
    },
  };

  // ================================================================ LEVEL 6 – nutrient & water balance
  LEVELS["6"] = {
    title: () => L("توازن العناصر والماء", "The nutrient and water balance"),
    intro: () => L("لديك 100 نقطة ميزانية. ابنِ دورة من 3 مواسم واختر مدخلات كل موسم. وازن بين الإنتاج والآزوت والماء.", "You have a 100-point budget. Build a 3-season rotation and pick the input for each season. Balance production, nitrogen and water."),
    hints: () => [L("هل تحتاج كل المحاصيل سماد الآزوت؟", "Does every crop need nitrogen fertilizer?"),
      L("البقوليات تثبّت جزءًا من الآزوت بنفسها؛ السماد عليها يضيع غالبًا. الحبوب بعد بقولي تحتاج أقل.", "Legumes fix part of their own nitrogen; fertilizer on them is mostly wasted. A cereal after a legume needs less."),
      L("جرّب: حبوب ← بقولي ← حبوب، مع سماد خفيف أو سماد عضوي للحبوب فقط، والتنقيط فقط إذا كان لديك ماء.", "Try cereal → legume → cereal, light or organic fertilizer on cereals only, and drip only if you have water.")],
    init() { LV.st = { seq: [planCrop(0), planCrop(1), "wheat"].map((x) => (x === "fallow" ? "wheat" : x)), inp: ["none", "none", "none"], open: null }; },
    cost: { none: 0, n: 30, manure: 25, drip: 35 },
    eval(st) {
      const fm = farmE(), anyDrip = st.inp.includes("drip") && fm.water;
      const ev = E.evaluate(loc(), { seq: st.seq.map((k) => CK[k]), sowing: "normal", residue: "grazed", irrigation: anyDrip }, fm);
      return ev.scores;
    },
    view() {
      const st = LV.st, spent = st.inp.reduce((a, k) => a + this.cost[k], 0), sc = this.eval(st);
      const inputs = [["none", L("لا شيء", "None"), 0], ["n", L("سماد آزوتي", "N fertilizer"), 30], ["manure", L("سماد عضوي", "Manure"), 25], ["drip", L("تنقيط", "Drip"), 35]];
      return `<div class="panel2 in d2" style="display:flex;flex-direction:column;gap:10px">${st.seq.map((k, i) => `<div>
          <div style="display:flex;align-items:center;gap:8px"><b style="width:70px">${L("الموسم", "Season")} ${i + 1}</b><button class="chip on" data-act="g" data-a="open" data-i="${i}">${cname(k)}</button></div>
          ${st.open === i ? `<div class="chiprow reveal" style="margin:6px 0">${CROPS.map((x) => `<button class="chip ${x === k ? "on" : ""}" data-act="g" data-a="crop" data-i="${i}" data-v="${x}">${cname(x)}</button>`).join("")}</div>` : ""}
          <div class="chiprow" style="margin-top:6px">${inputs.map((o) => `<button class="chip ${st.inp[i] === o[0] ? "on" : ""}" style="min-height:38px;padding:4px 10px;font-size:13px" data-act="g" data-a="inp" data-i="${i}" data-v="${o[0]}">${o[1]}${o[2] ? " · " + o[2] : ""}</button>`).join("")}</div></div>`).join("")}</div>
        <div class="panel2 in d3" style="display:flex;flex-direction:column;gap:6px">
          <div class="dimrow"><span style="width:110px">${L("الميزانية", "Budget")}</span><span class="pbar"><i style="width:${Math.min(100, spent)}%;background:${spent > 100 ? "#e8483d" : "#2f9bd6"}"></i></span><span dir="ltr">${spent}/100</span></div>
          <div class="dimrow"><span style="width:110px">${L("الإنتاجية", "Productivity")}</span><span class="pbar"><i style="width:${sc.production}%"></i></span><span dir="ltr">${sc.production}</span></div>
          <div class="dimrow"><span style="width:110px">${L("استقلالية الآزوت", "N independence")}</span><span class="pbar"><i style="width:${sc.fertilizer}%"></i></span><span dir="ltr">${sc.fertilizer}</span></div>
          <div class="dimrow"><span style="width:110px">${L("توفير الماء", "Water")}</span><span class="pbar"><i style="width:${sc.water}%"></i></span><span dir="ltr">${sc.water}</span></div>
          <div class="note">${L("المؤشرات من المحرك على 30 موسمًا. لا نقدّر الأسعار ولا ندّعي أن البقوليات تعوّض كل العناصر.", "Indicators from the engine over 30 seasons. No prices, and we don't claim legumes restore every nutrient.")}</div></div>
        <div class="spacer"></div>
        ${spent <= 100 ? `<button class="primary" data-act="g" data-a="end">${L("ثبّت الخطة", "Lock in the plan")} ${A.fwd()}</button>` : `<button class="primary" disabled>${L("تجاوزت الميزانية", "Over budget")}</button>`}`;
    },
    on(a, d) {
      const st = LV.st, i = +d.i;
      if (a === "tile") {
        const r = Math.min(3, Math.floor(i / 4));
        const cycle = [null, "manure", "drip", "n"];
        const cur = cycle.indexOf(st.inp[r]);
        st.inp[r] = cycle[(cur + 1) % cycle.length];
        snd("tap");
        const names = { manure: L("سماد عضوي", "manure"), drip: L("ري بالتنقيط", "drip"), n: L("سماد آزوتي", "N fertilizer") };
        say(st.inp[r] ? L(`الموسم ${r + 1}: أضفت ${names[st.inp[r]]}.`, `Season ${r + 1}: added ${names[st.inp[r]]}.`) : L(`الموسم ${r + 1}: بدون مدخلات إضافية.`, `Season ${r + 1}: no extra inputs.`), "happy", "n");
        draw();
        return;
      }
      if (a === "open") { st.open = st.open === i ? null : i; draw(); return; }
      if (a === "crop") { st.seq[i] = d.v; st.open = null; if (i > 0 && E.CROPS[CK[st.seq[i - 1]]].family === E.CROPS[CK[d.v]].family) say(L("لم نزرع هذه العائلة هنا للتو؟ فكّر في فوائد تنويع دورتك.", "Didn't we just grow that family here? Think about diversifying your rotation."), "worried", "warn"); draw(); return; }
      if (a === "inp") {
        const k = st.seq[i], c = E.CROPS[CK[k]]; st.inp[i] = d.v;
        if (d.v === "n" && c.n > 0) risk({ level: "moderate", kind: "science", title: L("سماد آزوتي على بقولي", "Nitrogen fertilizer on a legume"), decision: L(`سماد آزوتي على ${cname(k)}`, `N fertilizer on ${cname(k).toLowerCase()}`), why: L("البقوليات تثبّت جزءًا من آزوتها بنفسها.", "Legumes fix part of their own nitrogen."), cons: L("تكلفة بلا فائدة كبيرة، وقد يقلّل التثبيت الطبيعي.", "Cost with little benefit; it can even reduce natural fixation."), mitig: L("ضع السماد على الحبوب، خاصة إذا لم يسبقها بقولي.", "Put fertilizer on cereals, especially when no legume came before.") });
        else if (d.v === "drip" && !farmE().water) risk({ level: "high", kind: "science", title: L("تنقيط بلا ماء", "Drip without water"), decision: L("التنقيط", "Drip"), why: L("أجبت أن الماء لديك منخفض أو أن الحقل مطري.", "You said your water is low or the field is rainfed."), cons: L("ستدفع ثمن الشبكة ولن تجد ماءً تشغّلها به.", "You'd pay for the system with no water to run it."), mitig: L("استثمر في الغطاء أو البقوليات بدلًا منه.", "Invest in cover or legumes instead.") });
        else if (d.v === "n" && i > 0 && E.CROPS[CK[st.seq[i - 1]]].n > 0) say(L("حبوب بعد بقولي: تحتاج آزوتًا أقل. ربما يكفي سماد خفيف.", "A cereal after a legume needs less nitrogen. A lighter dose may be enough."), "happy", "n");
        draw(); return;
      }
      if (a === "end") {
        const sc = this.eval(st), spent = st.inp.reduce((x, k) => x + this.cost[k], 0);
        let waste = 0;
        st.inp.forEach((k, j) => { const c = E.CROPS[CK[st.seq[j]]]; if (k === "n" && c.n > 0) { waste++; riskyLog(L(`سماد آزوتي على ${cname(st.seq[j])}.`, `N fertilizer on ${cname(st.seq[j]).toLowerCase()}.`)); } if (k === "drip" && !farmE().water) { waste++; riskyLog(L("تنقيط بلا ماء متاح.", "Drip with no water available.")); } });
        if (st.seq.some((k) => E.CROPS[CK[k]].n > 0)) goodLog(L("الدورة فيها بقولي يساهم في الآزوت.", "The rotation includes a legume that helps with nitrogen.")); else missLog(L("لا بقولي في الدورة: كل الآزوت من السماد.", "No legume: all nitrogen must come from fertilizer."));
        if (st.inp.includes("manure")) goodLog(L("استعملت سمادًا عضويًا.", "You used organic manure."));
        const sameFam = st.seq.some((k, j) => j > 0 && E.CROPS[CK[k]].family === E.CROPS[CK[st.seq[j - 1]]].family);
        if (sameFam) riskyLog(L("نفس العائلة متتالية في الدورة.", "The same family back-to-back."));
        finish({ score: 0.35 * sc.production + 0.25 * sc.fertilizer + 0.25 * sc.water + 0.15 * (100 - spent) - waste * 10, dims: { [L("جودة الدورة", "Rotation quality")]: sameFam ? 50 : 100, [L("الإنتاجية", "Productivity")]: sc.production, [L("إدارة العناصر", "Nutrient management")]: sc.fertilizer, [L("كفاءة الموارد", "Resource efficiency")]: 100 - spent - waste * 15 },
          explain: L("العائلات تساهم بشكل مختلف: البقوليات تترك بعض الآزوت وتكسر أمراض الحبوب، والحبوب تنتج أكثر لكنها تستهلك الآزوت. البقوليات لا تعوّض الفوسفور أو البوتاسيوم.", "Families contribute differently: legumes leave some nitrogen and break cereal diseases; cereals produce more but use nitrogen. Legumes don't replace phosphorus or potassium."),
          improve: L("ضع السماد حيث يفيد (الحبوب)، وأدخل بقوليًا، ولا تنفق على ري بلا ماء.", "Put fertilizer where it helps (cereals), include a legume, and don't spend on irrigation without water."), strategy: st.seq.slice() });
      }
    },
  };

  // ================================================================ LEVEL 7 – climate gamble
  LEVELS["7"] = {
    title: () => L("مقامرة المناخ", "The climate gamble"),
    intro: () => L(`ثلاثة مواسم حقيقية متتالية من ناسا تنتظرك، لا تعرف طقسها مسبقًا. في كل جولة اختر المحصول والموعد، ولديك حصّتا ماء فقط للمواسم الثلاثة.`, `Three real consecutive NASA seasons await, and you don't know their weather ahead. Each round, choose the crop and date. You have only two water shares for all three seasons.`),
    hints: () => [L("لا تراهن على محصول واحد. فكّر فيما قد يحدث لو كان الموسم جافًا أو حارًا.", "Don't bet on one crop. Think about what happens if the season is dry or hot."),
      L("محاصيل مختلفة تتحمّل مخاطر مختلفة: الشعير للحر والجفاف، البقوليات للآزوت، والعلف يُحش قبل حر ماي.", "Different crops handle different risks: barley for heat and drought, legumes for nitrogen, forage cut before May heat."),
      L("نوّع العائلات بين الجولات، احتفظ بحصة ماء لموسم يتأخر فيه المطر، واختر البذر المبكر إذا جاء مطر الخريف مبكرًا.", "Alternate families, keep a water share for a season with late rain, and sow early when autumn rain comes early.")],
    init() { const n = loc().rain.length; LV.st = { seasons: [n - 3, n - 2, n - 1], round: 0, prev: lastCrop(), pick: { crop: "barley", sowing: "normal", water: false }, tokens: 2, results: [] }; },
    view() {
      const st = LV.st, l = loc();
      const done = st.results.map((r, i) => `<div class="result" style="background:#fff"><span style="flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#fff;background:${r.y > 0.5 ? "#4a9e2f" : r.y > 0.3 ? "#f5a623" : "#e8483d"}">${i + 1}</span><span style="flex:1;font-size:13px"><b>${DATA.seasons[r.s]} · ${cname(r.crop)}</b><br>${r.events}</span><b style="font-size:18px">${pct(r.y)}</b></div>`).join("");
      if (st.round >= 3) return `<div class="stagger" style="display:flex;flex-direction:column;gap:8px">${done}</div><div class="spacer"></div><button class="primary pop" data-act="g" data-a="end">${L("النتيجة النهائية", "Final result")} ${A.fwd()}</button>`;
      const s = st.seasons[st.round], p = st.pick;
      return `<div style="display:flex;flex-direction:column;gap:8px">${done}</div>
        <div class="panel2 in d2" style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between"><b>${L("الجولة", "Round")} ${st.round + 1}/3 · ${L("الموسم", "Season")} ${DATA.seasons[s]}</b><span class="obs">${L("الطقس مخفي حتى تقرّر", "Weather hidden until you decide")}</span></div>
          <div class="note">${L("قبلها", "Before")}: ${cname(st.prev)}</div>
          <b>${L("المحصول", "Crop")}</b><div class="chiprow">${CROPS.map((k) => `<button class="chip ${p.crop === k ? "on" : ""}" data-act="g" data-a="crop" data-v="${k}">${cname(k)}</button>`).join("")}</div>
          <b>${L("البذر", "Sowing")}</b><div class="chiprow">${[["early", L("مبكر", "Early")], ["normal", L("عادي", "Normal")], ["late", L("متأخر", "Late")]].map((o) => `<button class="chip ${p.sowing === o[0] ? "on" : ""}" data-act="g" data-a="sow" data-v="${o[0]}">${o[1]}</button>`).join("")}</div>
          <button class="chip ${p.water ? "on" : ""}" ${st.tokens ? "" : "disabled"} data-act="g" data-a="water" style="align-self:flex-start">${p.water ? '<span class="ck"></span>' : ""}${L("استعمل حصة ماء عند الإزهار", "Use a water share at flowering")} (${st.tokens} ${L("متبقية", "left")})</button>
        </div>
        <div class="spacer"></div>
        <button class="primary" data-act="g" data-a="play">${L("اكشف الموسم", "Reveal the season")} ${A.fwd()}</button>`;
    },
    on(a, d) {
      const st = LV.st, p = st.pick;
      if (a === "tile") {
        snd("tap");
        if (st.round < 3) return this.on("play", d);
        return;
      }
      if (a === "crop") { p.crop = d.v; if (E.CROPS[CK[d.v]].family === E.CROPS[CK[st.prev]].family) say(L(`${cname(st.prev)} قبله… نفس العائلة؟ همم.`, `${cname(st.prev)} before it… same family? Hmm.`), "worried", "warn"); draw(); return; }
      if (a === "sow") { p.sowing = d.v; draw(); return; }
      if (a === "water") { p.water = !p.water; draw(); return; }
      if (a === "play") {
        const s = st.seasons[st.round], l = loc();
        const rec = seasonRun(p.crop, s, { prev: st.prev, sowing: p.sowing });
        let y = rec.yieldIdx;
        if (p.water && st.tokens) { st.tokens--; const fm = rec.flowerMonth; const c = E.CROPS[CK[p.crop]]; let D = 0, Aet = 0; rec.months.forEach((mo, m) => { if (mo.kc === null) return; D += mo.demand; Aet += Math.min(mo.demand, mo.aet + (m === fm ? 30 * 0.9 : 0)); }); const lost = rec.ws > 0 ? rec.aet / rec.ws - rec.demand : 0; const ws = Aet / (D + Math.max(0, lost)); y = Math.max(0, Math.min(1, 1 - c.ky * (1 - ws))) * (1 - rec.heat - rec.frost) * rec.rotPen; }
        const ev = [];
        const r = l.summary.rain_oct_may[s]; ev.push(L(`مطر ${r} ملم`, `${r} mm rain`) + (r < l.summary.rain_mean * 0.75 ? L(" (جاف)", " (dry)") : ""));
        if (l.onset[s] == null || l.onset[s] > 75) ev.push(L("مطر البذر متأخر", "late sowing rain"));
        if (rec.heat > 0.1) ev.push(L("حر عند الإزهار", "heat at flowering"));
        if (rec.rotPen < 1) ev.push(L("نفس العائلة", "same family"));
        st.results.push({ s, crop: p.crop, y, events: ev.join(" · "), sowing: p.sowing, water: p.water, rec });
        st.prev = p.crop; st.round++; p.water = false;
        snd(y > 0.5 ? "good" : "bad");
        say(y > 0.5 ? L(`موسم ${DATA.seasons[s]}: ${pct(y)}! قرار موفق.`, `Season ${DATA.seasons[s]}: ${pct(y)}! Good call.`) : L(`موسم ${DATA.seasons[s]} كان صعبًا: ${ev.join("، ")}. عدّل خطتك للجولة التالية.`, `Season ${DATA.seasons[s]} was tough: ${ev.join(", ")}. Adapt your plan next round.`), y > 0.5 ? "happy" : "worried", y > 0.5 ? "good" : "warn");
        draw(); return;
      }
      if (a === "end") {
        let bestSum = 0; st.results.forEach((r, i) => { const prev = i === 0 ? lastCrop() : st.results[i - 1].crop; let b = 0; CROPS.forEach((k) => ["early", "normal"].forEach((sw) => { b = Math.max(b, seasonRun(k, r.s, { prev, sowing: sw }).yieldIdx); })); bestSum += b; });
        const mean = st.results.reduce((x, r) => x + r.y, 0) / 3, bestMean = bestSum / 3;
        const fams = st.results.map((r) => E.CROPS[CK[r.crop]].family); const repeats = fams.filter((f, i) => i > 0 && f === fams[i - 1]).length;
        const tokUse = st.results.filter((r) => r.water).length, tokGood = st.results.filter((r) => r.water && r.y < 0.6).length;
        if (!repeats) goodLog(L("نوّعت العائلات بين المواسم.", "You alternated families between seasons.")); else riskyLog(L(`كرّرت نفس العائلة ${repeats} مرة.`, `You repeated a family ${repeats} time(s).`));
        if (tokUse === 0) missLog(L("لم تستعمل حصص الماء.", "You didn't use your water shares."));
        st.results.forEach((r) => { if (r.y < 0.3) riskyLog(L(`${cname(r.crop)} في ${DATA.seasons[r.s]}: ${pct(r.y)}.`, `${cname(r.crop)} in ${DATA.seasons[r.s]}: ${pct(r.y)}.`)); });
        G().lastGamble = st.results.map((r) => r.crop);
        finish({ score: 70 * Math.min(1, mean / (bestMean || 1)) + (repeats ? 5 : 20) + (tokUse ? 10 : 0), dims: { [L("التكيّف المناخي", "Climate adaptation")]: 100 * mean / (bestMean || 1), [L("جودة الدورة", "Rotation quality")]: repeats ? 40 : 100, [L("كفاءة الموارد", "Resource efficiency")]: tokUse ? 100 * tokGood / tokUse : 0 },
          explain: L(`متوسط مردودك ${pct(mean)} مقابل ${pct(bestMean)} لو عرفت الطقس مسبقًا. الدورة الصامدة لا تكون الأفضل في سنة واحدة، بل الأقل خسارة عبر سنوات مختلفة.`, `Your average yield was ${pct(mean)} vs ${pct(bestMean)} with perfect foresight. A resilient rotation isn't the best in one year; it loses least across different years.`),
          improve: L("نوّع العائلات، واحتفظ بالماء للسنة التي يتأخر فيها المطر.", "Alternate families and save water for the year the rain comes late."), strategy: st.results.map((r) => r.crop) });
      }
    },
  };

  // ================================================================ CHAPTER F – crop failure & recovery
  LEVELS["F"] = {
    title: () => L("فصل فشل المحصول", "The crop failure chapter"),
    intro: () => L(`أوه لا! انظر ماذا حدث للحقل في موسم ${DATA.seasons[LV.st.s]}! لكن لا تستسلم يا ${pname()}. لنفهم لماذا حدث هذا قبل أن نزرع من جديد. اختر الأسباب التي تدعمها الأدلة.`, `Oh no! Look at what happened to the field in season ${DATA.seasons[LV.st.s]}! But don't give up, ${pname()}. Let's understand why this happened before planting again. Pick the causes the evidence supports.`),
    hints: () => [L("لا تتّهم سببًا واحدًا. افحص كل دليل بالأرقام.", "Don't blame one cause. Check each piece of evidence with the numbers."),
      L("السبب يكون مدعومًا عندما يكون الرقم بعيدًا عن العادة: مطر أقل بكثير، بذر متأخر، أيام حر كثيرة عند الإزهار.", "A cause is supported when the number is far from normal: much less rain, late sowing, many hot days at flowering."),
      L("الآفات والأمراض لا تظهر في بيانات ناسا: لا يمكن تأكيدها ولا نفيها من هنا.", "Pests and diseases don't show in NASA data: we can neither confirm nor rule them out from here.")],
    init() {
      let crop = planCrop(0); if (crop === "fallow") crop = "wheat";
      const prev = lastCrop(), l = loc(); let s = 0, worst = 2;
      for (let i = 0; i < l.rain.length; i++) { const r = seasonRun(crop, i, { prev }); if (r.yieldIdx < worst) { worst = r.yieldIdx; s = i; } }
      const rec = seasonRun(crop, s, { prev });
      const onsetMed = l.onset.filter((x) => x != null).sort((a, b) => a - b)[Math.floor(l.onset.filter((x) => x != null).length / 2)];
      const sowM = rec.months.findIndex((x) => x.kc !== null);
      const ev = [
        { k: "water", ico: "drop", t: L("نقص الماء", "Water shortage"), v: L(`مطر ${l.summary.rain_oct_may[s]} ملم (المتوسط ${l.summary.rain_mean})، المحصول أخذ ${pct(rec.ws)} من حاجته`, `${l.summary.rain_oct_may[s]} mm rain (avg ${l.summary.rain_mean}); the crop got ${pct(rec.ws)} of its need`), ok: rec.ws < 0.6 },
        { k: "onset", ico: "cal", t: L("تأخّر مطر البذر", "Late sowing rain"), v: L(`أول مطر كافٍ بعد ${l.onset[s] == null ? "—" : l.onset[s]} يومًا من 1 سبتمبر (العادة ${onsetMed})`, `First good rain ${l.onset[s] == null ? "never" : l.onset[s] + " days"} after 1 Sep (usual ${onsetMed})`), ok: l.onset[s] == null || l.onset[s] > onsetMed + 25 },
        { k: "heat", ico: "sun", t: L("حرارة شديدة", "Extreme heat"), v: L(`ضرر الحر عند الإزهار: ${pct(rec.heat)} من المردود`, `Heat damage at flowering: ${pct(rec.heat)} of yield`), ok: rec.heat > 0.1 },
        { k: "soil", ico: "soil", t: L("تربة بلا ماء عند البذر", "Dry soil at sowing"), v: L(`ماء التربة عند البذر ${Math.round(sowM >= 0 ? rec.months[sowM].S : 0)} ملم من ${farmE().paw100}`, `Soil water at sowing ${Math.round(sowM >= 0 ? rec.months[sowM].S : 0)} of ${farmE().paw100} mm`), ok: sowM >= 0 && rec.months[sowM].S < farmE().paw100 * 0.25 },
        { k: "rotation", ico: "rot", t: L("اختيار المحصول والدورة", "Crop choice & rotation"), v: rec.rotPen < 1 ? L(`${cname(crop)} بعد ${cname(prev)}: نفس العائلة`, `${cname(crop)} after ${cname(prev).toLowerCase()}: same family`) : L(`${cname(crop)} بعد ${cname(prev)}: عائلتان مختلفتان`, `${cname(crop)} after ${cname(prev).toLowerCase()}: different families`), ok: rec.rotPen < 1 },
        { k: "pest", ico: "bug", t: L("آفات أو أمراض", "Pests or disease"), v: L("لا توجد بيانات عنها في ناسا: لا يمكن التأكيد", "No data on this in NASA records: cannot be confirmed"), ok: false, unknown: true },
      ];
      LV.st = { crop, prev, s, rec, ev, sel: {}, phase: "investigate", fix: { crop: crop === "barley" ? "chickpea" : "barley", sowing: "early", residue: "kept" } };
    },
    scene(dead) {
      if (dead) return board3d(4, 3, (i) => {
        const rev = LV.st.revived && LV.st.revived[i];
        return { fill: rev ? "#7a5638" : "#a98a62", flat: rev ? "" : FLAT.cracks, deco: rev ? plantDeco("lentil", 4, "grow") : `<g>${[...Array(4)].map((_, k) => `<g class="wilt" style="animation-delay:${(i * 0.08 + k * 0.05).toFixed(2)}s"><path d="M${-12 + k * 8} 0 v-14" stroke="#a8915a" stroke-width="1.6"/><ellipse cx="${-12 + k * 8}" cy="-16" rx="2" ry="4" fill="#c9a66a"/></g>`).join("")}</g>` };
      }, { env: "dead", act: "g", action: "tile", height: 165, extras: farmExtras(4, 3), label: L("حقل جاف ومحاصيل ميتة", "Dry field with dead crops"), badge: `${cname(LV.st.crop)} · ${pct(LV.st.rec.yieldIdx)}` });
      const r2 = seasonRun(LV.st.fix.crop, LV.st.s, { prev: LV.st.prev, sowing: LV.st.fix.sowing, residue: LV.st.fix.residue });
      return fieldBoard(LV.st.fix.crop, Math.min(1, r2.yieldIdx * 1.4), { env: r2.yieldIdx > 0.4 ? "day" : "drought", height: 165, act: "g", action: "tile", flat: () => (LV.st.fix.residue === "kept" ? FLAT.straw : ""), label: L("الحقل بعد خطة التعافي", "The field after the recovery plan"), badge: `${cname(LV.st.fix.crop)} · ${pct(r2.yieldIdx)}` });
    },
    view() {
      const st = LV.st;
      const icons = { drop: '<path d="M11 3 C7 9 5 12 5 15 a6 6 0 0 0 12 0 C17 12 15 9 11 3z" fill="#2f9bd6"/>', cal: '<rect x="3" y="5" width="16" height="14" rx="2" stroke="#2f9bd6" stroke-width="2" fill="none"/><path d="M3 9h16 M7 3v4 M15 3v4" stroke="#2f9bd6" stroke-width="2"/>', sun: '<circle cx="11" cy="11" r="5" fill="#ff9a3d"/><path d="M11 1v3 M11 18v3 M1 11h3 M18 11h3 M4 4l2 2 M16 16l2 2 M4 18l2-2 M16 6l2-2" stroke="#ff9a3d" stroke-width="2"/>', soil: '<path d="M2 14 h18 v5 h-18z" fill="#b8743f"/><path d="M5 14 l3 -3 l3 3 l4 -4 l4 4" stroke="#4a9e2f" stroke-width="2" fill="none"/>', rot: '<path d="M5 11 a6 6 0 0 1 11 -3 M17 11 a6 6 0 0 1 -11 3" stroke="#2f9bd6" stroke-width="2" fill="none"/><path d="M16 4 v4 h-4 M6 18 v-4 h4" stroke="#2f9bd6" stroke-width="2" fill="none"/>', bug: '<ellipse cx="11" cy="12" rx="5" ry="6" fill="#7a3f2a"/><path d="M6 9 l-3 -2 M16 9 l3 -2 M6 14 h-4 M16 14 h4" stroke="#7a3f2a" stroke-width="1.6"/>' };
      if (st.phase === "investigate") return `<div class="in d2">${this.scene(true)}<div class="note" style="padding:4px 6px">${cname(st.crop)} · ${DATA.seasons[st.s]} · ${L("المردود", "Yield")} ${pct(st.rec.yieldIdx)} <span class="obs">${L("موسم حقيقي", "Real season")}</span></div></div>
          <b class="in d3">${L("التحقيق: اختر الأسباب المدعومة بالأدلة", "Investigation: pick the causes the evidence supports")}</b>
          <div class="stagger" style="display:flex;flex-direction:column;gap:8px">${st.ev.map((e) => `<button class="evc ${st.sel[e.k] ? "on" : ""}" aria-pressed="${!!st.sel[e.k]}" data-act="g" data-a="sel" data-v="${e.k}"><span class="ico"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">${icons[e.ico]}</svg></span><span><b>${e.t}</b><small>${e.v}</small></span></button>`).join("")}</div>
          <div class="spacer"></div><button class="primary" data-act="g" data-a="conclude" ${Object.values(st.sel).some(Boolean) ? "" : "disabled"}>${L("أكّد التحقيق", "Confirm the investigation")} ${A.fwd()}</button>`;
      const fx = st.fix, r2 = seasonRun(fx.crop, st.s, { prev: st.prev, sowing: fx.sowing, residue: fx.residue });
      return `<div class="in d2">${this.scene(false)}</div>
        <div class="panel2 in d3" style="display:flex;flex-direction:column;gap:8px"><b>${L("خطة التعافي لنفس الموسم", "Recovery plan for the same season")}</b>
          <div class="chiprow">${CROPS.map((k) => `<button class="chip ${fx.crop === k ? "on" : ""}" data-act="g" data-a="fcrop" data-v="${k}">${cname(k)}</button>`).join("")}</div>
          <div class="chiprow">${[["early", L("بذر مبكر", "Early sowing")], ["normal", L("بذر عادي", "Normal sowing")], ["late", L("بذر متأخر", "Late sowing")]].map((o) => `<button class="chip ${fx.sowing === o[0] ? "on" : ""}" data-act="g" data-a="fsow" data-v="${o[0]}">${o[1]}</button>`).join("")}</div>
          <div class="chiprow">${[["kept", L("ترك البقايا", "Keep residue")], ["grazed", L("رعي البقايا", "Graze residue")], ["removed", L("إزالة البقايا", "Remove residue")]].map((o) => `<button class="chip ${fx.residue === o[0] ? "on" : ""}" data-act="g" data-a="fres" data-v="${o[0]}">${o[1]}</button>`).join("")}</div></div>
        <div class="panel2 in d4" style="display:flex;justify-content:space-around;text-align:center"><div><div class="note">${L("قبل", "Before")}</div><div style="font-size:24px;font-weight:900;color:#e8483d">${pct(st.rec.yieldIdx)}</div></div><div><div class="note">${L("بعد خطتك", "With your plan")}</div><div style="font-size:24px;font-weight:900;color:${r2.yieldIdx > st.rec.yieldIdx ? "#4a9e2f" : "#e8483d"}">${pct(r2.yieldIdx)}</div></div></div>
        <div class="spacer"></div><button class="primary" data-act="g" data-a="end">${L("ثبّت خطة التعافي", "Confirm the recovery plan")} ${A.fwd()}</button>`;
    },
    on(a, d) {
      const st = LV.st;
      if (a === "tile") { const i = +d.i; st.revived = st.revived || {}; st.revived[i] = true; snd("good"); say(L("أنبتّ برعمًا أخضر جديدًا في هذه القطعة! 🌱", "Sprouted a new green shoot in this plot! 🌱"), "happy", "good"); draw(); return; }
      if (a === "sel") { st.sel[d.v] = !st.sel[d.v]; draw(); return; }
      if (a === "conclude") {
        let right = 0, wrong = 0; st.ev.forEach((e) => { const s = !!st.sel[e.k]; if (e.unknown) { if (s) { wrong++; riskyLog(L("الآفات: لا دليل عليها في البيانات.", "Pests: no evidence in the data.")); } } else if (s && e.ok) { right++; goodLog(L(`${e.t}: سبب مدعوم بالأدلة.`, `${e.t}: supported by evidence.`)); } else if (s && !e.ok) { wrong++; riskyLog(L(`${e.t}: الأدلة لا تدعمه هنا.`, `${e.t}: not supported by the evidence here.`)); } else if (!s && e.ok) missLog(L(`فاتك سبب: ${e.t}.`, `You missed a cause: ${e.t}.`)); });
        const supported = st.ev.filter((e) => e.ok).length;
        st.inv = supported ? Math.max(0, (right - wrong * 0.5) / supported) : (wrong ? 0.5 : 1);
        st.phase = "recover"; snd("tap");
        say(L(`الأسباب المدعومة: ${st.ev.filter((e) => e.ok).map((e) => e.t).join("، ") || "لا شيء واضح"}. الآن ابنِ خطة تعافٍ.`, `Supported causes: ${st.ev.filter((e) => e.ok).map((e) => e.t.toLowerCase()).join(", ") || "nothing clear"}. Now build a recovery plan.`), "happy", "n");
        draw(); return;
      }
      if (["fcrop", "fsow", "fres"].includes(a)) { st.fix[{ fcrop: "crop", fsow: "sowing", fres: "residue" }[a]] = d.v; draw(); const r2 = seasonRun(st.fix.crop, st.s, { prev: st.prev, sowing: st.fix.sowing, residue: st.fix.residue }); say(r2.yieldIdx > st.rec.yieldIdx + 0.05 ? L("هذا أفضل! الحقل يتعافى.", "That's better! The field is recovering.") : L("ما زال صعبًا. جرّب محصولًا أو موعدًا آخر.", "Still hard. Try another crop or date."), r2.yieldIdx > st.rec.yieldIdx + 0.05 ? "happy" : "worried", r2.yieldIdx > st.rec.yieldIdx + 0.05 ? "good" : "warn"); return; }
      if (a === "end") {
        const r2 = seasonRun(st.fix.crop, st.s, { prev: st.prev, sowing: st.fix.sowing, residue: st.fix.residue });
        let best = 0; CROPS.forEach((k) => ["early", "normal"].forEach((sw) => { best = Math.max(best, seasonRun(k, st.s, { prev: st.prev, sowing: sw, residue: "kept" }).yieldIdx); }));
        const rec = best > st.rec.yieldIdx ? clamp((r2.yieldIdx - st.rec.yieldIdx) / (best - st.rec.yieldIdx), 0, 1) : 1;
        if (r2.yieldIdx > st.rec.yieldIdx) goodLog(L(`خطة التعافي رفعت المردود من ${pct(st.rec.yieldIdx)} إلى ${pct(r2.yieldIdx)}.`, `The recovery plan raised yield from ${pct(st.rec.yieldIdx)} to ${pct(r2.yieldIdx)}.`)); else missLog(L("خطة التعافي لم تحسّن المردود.", "The recovery plan didn't improve yield."));
        finish({ score: 50 * st.inv + 50 * rec, dims: { [L("التحقيق", "Investigation")]: st.inv * 100, [L("التعافي", "Recovery")]: rec * 100 },
          explain: L("الفشل نادرًا ما يكون له سبب واحد. البيانات تكشف الماء والحر والتوقيت، لكنها لا ترى الآفات. والتعافي يعني تغيير ما يمكن تغييره: المحصول، الموعد، وغطاء التربة.", "Failure rarely has one cause. The data reveals water, heat and timing, but not pests. Recovery means changing what you can: crop, date and soil cover."),
          improve: L("اختر فقط الأسباب التي تدعمها الأرقام، وجرّب محصولًا أقصر دورة مع بذر مبكر.", "Pick only causes the numbers support, and try a shorter-cycle crop sown early.") });
      }
    },
  };

  // ================================================================ SOIL LEVELS 8–11
  const QUAL = (v) => v > 0 ? `<span class="badge b-ok">${L("إيجابي", "Positive")}${v > 1 ? " ++" : ""}</span>` : v < 0 ? `<span class="badge b-high">${L("سلبي", "Negative")}</span>` : `<span class="badge b-na">${L("محايد", "Neutral")}</span>`;
  LEVELS["8"] = {
    title: () => L("التربة المُنهكة", "The depleted soil"),
    intro: () => { const n = LV.st.cereals; return L(`تاريخك فيه ${n} موسم حبوب من ${LV.st.known}. القطع المحددة بالنقاط أُرهقت من تكرار الحبوب (تقدير نوعي، لا تحليل تربة). لديك 8 تدخلات.`, `Your history has ${n} cereal seasons out of ${LV.st.known}. The dotted plots are tired from repeated cereals (a qualitative estimate, not a soil test). You have 8 actions.`); },
    hints: () => [L("ما الذي يحدث لتربة تزرع نفس العائلة كل سنة؟", "What happens to soil that grows the same family every year?"),
      L("البقوليات تساهم في الآزوت، والسماد العضوي يغذي التربة، والتنويع يكسر الأمراض. زيادة السماد الكيميائي تعطي مردودًا قصير المدى فقط.", "Legumes help nitrogen, organic amendments feed the soil, diversity breaks disease. More chemical N only gives a short-term yield."),
      L("ضع البقوليات والسماد العضوي على القطع المُنهكة، ولا تضع نفس الأداة في كل مكان: التنويع مهم.", "Put legumes and organic amendments on the tired plots, and don't use the same tool everywhere: diversity matters.")],
    init() {
      const h = S().farm.history.filter((x) => x && x !== "unknown"), cer = h.filter((x) => ["wheat", "barley", "oat"].includes(x)).length;
      const tired = new Set(); const nT = Math.min(12, Math.max(4, Math.round(cer / Math.max(1, h.length) * 14)));
      for (let i = 0; i < 16 && tired.size < nT; i++) if ((i * 7) % 3 !== 1 || tired.size < nT - 2) tired.add((i * 5) % 16);
      LV.st = { tired, tool: "legume", act: {}, cereals: cer, known: h.length || 0 };
    },
    tools: () => [["legume", L("بقولي", "Legume"), 2], ["compost", L("سماد عضوي", "Compost/manure"), 2], ["diverse", L("تنويع المحصول", "Diversify"), 1], ["moreN", L("سماد آزوتي إضافي", "Extra N fertilizer"), 0], ["same", L("نفس الحبوب", "Same cereal"), -1]],
    view() {
      const st = LV.st, used = Object.keys(st.act).length, T = this.tools();
      const field = board3d(4, 4, (i) => { const t = st.act[i], tired = st.tired.has(i), v = t ? T.find((x) => x[0] === t)[2] : 0;
        return { fill: t ? (v > 0 ? "#7a5638" : v < 0 ? "#c2a87a" : "#b39566") : tired ? "#c2a87a" : "#9a7a52", h: t && v > 0 ? 3 : 0, flat: (tired && !t ? FLAT.dots : "") + (t === "compost" ? FLAT.manure : ""),
          deco: (t === "legume" ? plantDeco("lentil", 4, "grow") : t === "compost" ? `<g class="grow"><ellipse cx="0" cy="-2" rx="14" ry="5" fill="#6e4527"/><circle cx="-4" cy="-5" r="2" fill="#4a9e2f"/></g>` : t === "diverse" ? plantDeco("faba", 3, "grow") + plantDeco("barley", 2, "grow") : t === "moreN" ? `<g class="grow"><rect x="-6" y="-14" width="12" height="12" rx="2" fill="#ffe9a8" stroke="#2f9bd6"/><text x="0" y="-5" text-anchor="middle" font-size="7" font-weight="900" fill="#2f9bd6">N</text></g>` : t === "same" ? plantDeco("wheat", 4, "grow") : ""),
          label: tired ? L("قطعة مُنهكة", "tired plot") : L("قطعة", "plot") }; }, { env: "soil", extras: farmExtras(4, 4), label: L("حقلك", "Your field") });
      return `<div class="in d2">${field}<div class="note" style="padding:4px 6px">${L("النقاط البيضاء = قطعة مُنهكة (تقدير من تاريخ محاصيلك)", "White dots = tired plot (estimated from your crop history)")} · ${L("التدخلات", "Actions")}: ${used}/8</div></div>
        <div class="toolbar in d3">${T.map((t) => `<button class="tool ${st.tool === t[0] ? "on" : ""}" data-act="g" data-a="tool" data-v="${t[0]}">${t[1]}<small>${QUAL(t[2]).replace(/<[^>]+>/g, "")}</small></button>`).join("")}</div>
        <div class="note">${L("التأثيرات نوعية (إيجابي/محايد/سلبي) لأننا لا نملك نموذجًا ديناميكيًا للتربة.", "Effects are qualitative (positive/neutral/negative) because we have no dynamic soil model.")}</div>
        <div class="spacer"></div><button class="primary" data-act="g" data-a="end" ${used ? "" : "disabled"}>${L("قيّم خطتي", "Evaluate my plan")} ${A.fwd()}</button>`;
    },
    on(a, d) {
      const st = LV.st;
      if (a === "tool") { st.tool = d.v; if (d.v === "moreN") risk({ level: "moderate", kind: "science", title: L("سماد آزوتي إضافي", "Extra nitrogen fertilizer"), decision: L("زيادة السماد على القطع المُنهكة", "More fertilizer on tired plots"), why: L("يعطي الآزوت للمحصول الحالي فقط.", "It feeds the current crop only."), cons: L("لا يعالج تراكم الأمراض ولا المادة العضوية، ويزيد التكلفة.", "It doesn't fix disease build-up or organic matter, and costs more."), mitig: L("اجمعه مع بقولي أو سماد عضوي.", "Combine with a legume or organic amendment.") }); if (d.v === "same") say(L("نفس الحبوب مرة أخرى؟ التربة تتنهّد!", "The same cereal again? The soil sighs!"), "angry", "bad"); draw(); return; }
      if (a === "tile") { const i = +d.i; if (st.act[i]) delete st.act[i]; else if (Object.keys(st.act).length < 8) { st.act[i] = st.tool; snd("tap"); } else say(L("انتهت تدخلاتك.", "No actions left."), "worried", "warn"); draw(); return; }
      if (a === "end") {
        const T = this.tools(), val = (t) => T.find((x) => x[0] === t)[2];
        let onTired = 0, good = 0, bad = 0; Object.entries(st.act).forEach(([i, t]) => { const v = val(t); if (st.tired.has(+i)) { onTired++; if (v > 0) good++; } if (v < 0) bad++; });
        const kinds = new Set(Object.values(st.act).filter((t) => val(t) > 0));
        if (kinds.size >= 2) goodLog(L("نوّعت الحلول بين البقوليات والسماد العضوي والتنويع.", "You mixed legumes, organic amendments and diversity.")); else missLog(L("الجمع بين عدة حلول أقوى من حل واحد.", "Combining several practices beats a single one."));
        if (bad) riskyLog(L(`${bad} تدخلات قد تُرهق التربة أكثر.`, `${bad} action(s) may tire the soil further.`));
        if (good < st.tired.size / 2) missLog(L("بقيت قطع مُنهكة دون علاج مناسب.", "Some tired plots got no suitable treatment."));
        const ev = E.evaluate(loc(), { seq: ["wheat", "lentil"], sowing: "normal", residue: "grazed" }, farmE());
        finish({ score: 100 * Math.min(1, good / Math.max(1, Math.min(8, st.tired.size))) * 0.7 + (kinds.size >= 2 ? 30 : 15) - bad * 10, dims: { [L("إدارة التربة", "Soil management")]: 100 * good / Math.max(1, st.tired.size), [L("التنويع", "Diversity")]: kinds.size / 3 * 100 },
          explain: L(`الحبوب المتكررة تستهلك الآزوت وتراكم الأمراض. إدخال بقولي (مثل قمح ← عدس يرفع مؤشر الآزوت في المحرك إلى ${ev.scores.fertilizer}/100) والسماد العضوي يحسّنان إدارة العناصر، لكن لا نعطي أرقامًا لتحسّن التربة لأننا لا نقيسه.`, `Repeated cereals use nitrogen and build disease. Adding a legume (wheat → lentil raises the engine's nitrogen index to ${ev.scores.fertilizer}/100) and organic amendments improve nutrient management; we give no numbers for soil improvement because we don't measure it.`),
          improve: L("ركّز على القطع المُنهكة وامزج البقوليات بالسماد العضوي. حلّل التربة (pH، الفوسفور، البوتاسيوم، المادة العضوية).", "Focus on tired plots and mix legumes with organic amendments. Test the soil (pH, P, K, organic matter).") });
      }
    },
  };

  LEVELS["9"] = {
    title: () => L("تهديد الانجراف", "The erosion threat"),
    intro: () => L(`على مدار السنة، متى تكون تربتك عارية تحت المطر الغزير؟ الساعة تُظهر أشهر المطر الغزير (من ناسا) وغطاء التربة في دورتك. غطِّ الأشهر الخطرة.`, `Through the year, when is your soil bare under heavy rain? The clock shows heavy-rain months (from NASA) and soil cover in your rotation. Cover the risky months.`),
    hints: () => [L("أين يلتقي اللون البني (تربة عارية) مع الأزرق الغامق (مطر غزير)؟", "Where does brown (bare soil) meet dark blue (heavy rain)?"),
      L("أمطار الخريف الغزيرة تأتي قبل نمو المحصول الجديد. البقايا المتروكة والغطاء النباتي يحميان هذه الفترة.", "Heavy autumn rain arrives before the new crop grows. Kept residue and cover crops protect that window."),
      L("اترك البقايا، واستبدل البور بغطاء نباتي (بيقية)، وتجنّب الحرث قبل الخريف.", "Keep the residue, replace fallow with a cover crop (vetch), and avoid ploughing before autumn.")],
    init() { const plan = [planCrop(0), planCrop(1)]; LV.st = { plan, residue: "grazed", cover: false, till: true }; },
    ev(st) {
      const seq = st.plan.map((k) => (k === "fallow" ? (st.cover ? "vetch" : "fallow") : k)).map((k) => (k === "fallow" ? "fallow_grazed" : CK[k]));
      return E.evaluate(loc(), { seq, sowing: "normal", residue: st.till ? (st.residue === "kept" ? "grazed" : "removed") : st.residue }, farmE());
    },
    view() {
      const st = LV.st, ev = this.ev(st), l = loc(), n = l.rain.length;
      const cov = Array(12).fill(0), heavy = Array(12).fill(0);
      ev.runs.forEach((run) => run.forEach((r) => r.months.forEach((mo, m) => { cov[m] += mo.cover / (n * ev.runs.length); })));
      for (let s = 0; s < n; s++) for (let m = 0; m < 12; m++) heavy[m] += l.heavy[s][m] / n;
      const hmax = Math.max(...heavy, 1), C = 90, R = 76;
      const arc = (r0, r1, a0, a1, col) => { const p = (r, a) => `${C + r * Math.sin(a)},${C - r * Math.cos(a)}`; return `<path d="M${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z" fill="${col}" stroke="#fff" stroke-width="1" style="transition:fill .5s"/>`; };
      let svg = `<svg viewBox="0 0 180 180" width="210" height="210" aria-hidden="true">`;
      for (let m = 0; m < 12; m++) { const a0 = m / 12 * 2 * Math.PI, a1 = (m + 1) / 12 * 2 * Math.PI, am = (m + 0.5) / 12 * 2 * Math.PI;
        svg += arc(R - 12, R, a0, a1, `rgba(31,95,168,${0.08 + 0.9 * heavy[m] / hmax})`);
        const c = cov[m]; svg += arc(R - 40, R - 14, a0, a1, c < 0.3 ? "#3f8f4a" : c < 0.55 ? "#a7b65a" : c < 0.8 ? "#c49a63" : "#8f5a33");
        svg += `<text x="${C + (R + 8) * Math.sin(am)}" y="${C - (R + 8) * Math.cos(am) + 3}" text-anchor="middle" font-size="8" fill="#33402f">${mName(m).slice(0, S().lang === "en" ? 1 : 3)}</text>`; }
      svg += `<text x="${C}" y="${C}" text-anchor="middle" font-size="20" font-weight="900" fill="#3a2a18">${ev.scores.erosion}</text><text x="${C}" y="${C + 13}" text-anchor="middle" font-size="7.5" fill="#6a5440">${L("حماية /100", "protection /100")}</text></svg>`;
      const chip = (a, v, on, txt) => `<button class="chip ${on ? "on" : ""}" data-act="g" data-a="${a}" data-v="${v}">${on ? '<span class="ck"></span>' : ""}${txt}</button>`;
      return `<div class="panel2 in d2" style="display:flex;flex-direction:column;align-items:center">${svg}
          <div class="legend2"><span><i style="background:#1f5fa8"></i>${L("مطر غزير (ناسا)", "Heavy rain (NASA)")}</span><span><i style="background:#3f8f4a"></i>${L("مغطاة", "Covered")}</span><span><i style="background:#8f5a33"></i>${L("عارية", "Bare")}</span></div>
          <div class="note">${L("الدورة", "Rotation")}: ${st.plan.map(cname).join(A.arrow())} · ${L("الانحدار", "slope")} ${farmE().slope}%</div></div>
        <div class="panel2 in d3" style="display:flex;flex-direction:column;gap:8px">
          <b>${L("بعد الحصاد", "After harvest")}</b><div class="chiprow">${chip("res", "kept", st.residue === "kept", L("ترك البقايا", "Keep residue"))}${chip("res", "grazed", st.residue === "grazed", L("رعي معتدل", "Moderate grazing"))}${chip("res", "removed", st.residue === "removed", L("إزالة كاملة", "Remove all"))}</div>
          <b>${L("الحرث", "Tillage")}</b><div class="chiprow">${chip("till", "1", st.till, L("حرث قبل الخريف", "Plough before autumn"))}${chip("till", "0", !st.till, L("بدون حرث / بذر مباشر", "No-till / direct seeding"))}</div>
          ${st.plan.includes("fallow") ? `<b>${L("سنة البور", "Fallow year")}</b><div class="chiprow">${chip("cover", "1", st.cover, L("غطاء نباتي (بيقية)", "Cover crop (vetch)"))}${chip("cover", "0", !st.cover, L("بور مكشوف", "Bare fallow"))}</div>` : ""}
          <div class="note">${L("الحماية محسوبة بالمحرك: نسبة المطر الغزير الذي يسقط على تربة محمية × الانحدار.", "Protection computed by the engine: share of heavy rain falling on protected soil × slope.")}</div></div>
        <div class="spacer"></div><button class="primary" data-act="g" data-a="end">${L("ثبّت الخطة", "Lock in the plan")} ${A.fwd()}</button>`;
    },
    on(a, d) {
      const st = LV.st, before = this.ev(st).scores.erosion;
      if (a === "tile") {
        st.residue = st.residue === "kept" ? "grazed" : "kept";
        snd("tap");
        say(st.residue === "kept" ? L("تركت التبن لحماية التربة من الانجراف!", "Kept residue to shield soil from runoff!") : L("رعت الأغنام التبن.", "Sheep grazed residue."), "happy", "n");
        draw();
        return;
      }
      if (a === "res") st.residue = d.v; if (a === "till") st.till = d.v === "1"; if (a === "cover") st.cover = d.v === "1";
      if (a === "res" || a === "till" || a === "cover") { const after = this.ev(st).scores.erosion; say(after > before ? L(`الحماية ارتفعت إلى ${after}. التربة تشكرك!`, `Protection rose to ${after}. The soil thanks you!`) : after < before ? L(`الحماية انخفضت إلى ${after}. التربة صارت مكشوفة أكثر.`, `Protection fell to ${after}. More soil is exposed.`) : L("لا تغيير.", "No change."), after >= before ? "happy" : "worried", after > before ? "good" : after < before ? "warn" : "n"); if (a === "res" && d.v === "removed") risk({ level: "high", kind: "science", title: L("إزالة كل البقايا", "Removing all residue"), decision: L("إزالة البقايا", "Removing residue"), why: L("أمطار الخريف الغزيرة تسقط قبل نمو المحصول.", "Heavy autumn rain falls before the crop grows."), cons: L("تربة عارية تنجرف على الانحدار.", "Bare soil washes away on the slope."), mitig: L("اترك ثلث البقايا على الأقل.", "Leave at least a third of the residue.") }); draw(); return; }
      if (a === "end") {
        const sc = this.ev(st).scores, base = this.ev({ ...st, residue: "removed", till: true, cover: false }).scores.erosion, best = this.ev({ ...st, residue: "kept", till: false, cover: true }).scores.erosion;
        if (st.residue === "kept") goodLog(L("تركت البقايا لتغطية الخريف.", "You kept residue for autumn cover.")); else missLog(L("البقايا المتروكة أرخص حماية.", "Kept residue is the cheapest protection."));
        if (!st.till) goodLog(L("تجنّبت الحرث قبل أمطار الخريف.", "You avoided ploughing before autumn rain.")); else riskyLog(L("الحرث يكشف التربة قبل المطر الغزير.", "Ploughing exposes soil before heavy rain."));
        if (st.plan.includes("fallow") && st.cover) goodLog(L("غطيت سنة البور بنبات.", "You covered the fallow year with plants."));
        finish({ score: best > base ? 100 * (sc.erosion - base) / (best - base) : 100, dims: { [L("إدارة التربة", "Soil management")]: sc.erosion, [L("صحة التربة", "Soil health")]: sc.soil },
          explain: L("الانجراف يحدث عندما يلتقي المطر الغزير بتربة عارية على منحدر. في موقعك، أغلب المطر الغزير يأتي في الخريف والشتاء، فتغطية هذه الفترة هي الأهم.", "Erosion happens when heavy rain meets bare soil on a slope. At your location most heavy rain comes in autumn and winter, so covering that window matters most."),
          improve: L("اترك البقايا، قلّل الحرث، وغطِّ سنوات البور.", "Keep residue, reduce tillage and cover fallow years.") });
      }
    },
  };

  LEVELS["10"] = {
    title: () => L("تحدّي المادة العضوية", "The organic matter challenge"),
    intro: () => { const s = loc().soil; return L(`حسب SoilGrids، الكربون العضوي في سطح تربتك حوالي ${s.soc} غ/كغ، وينخفض بسرعة مع العمق. اختر 3 ممارسات لخطة طويلة المدى تحافظ عليه.`, `According to SoilGrids, your topsoil organic carbon is about ${s.soc} g/kg and drops fast with depth. Choose 3 practices for a long-term plan to maintain it.`); },
    hints: () => [L("المادة العضوية تأتي من الجذور والبقايا… وتضيع بالحرق والحرث والانجراف.", "Organic matter comes from roots and residue… and is lost by burning, tillage and erosion."),
      L("كل ممارسة لها ثمن: ترك البقايا يقلّل علف الأغنام، والسماد العضوي يحتاج مصدرًا.", "Every practice has a cost: kept residue means less sheep feed; manure needs a source."),
      L("أقوى مجموعة عادة: ترك البقايا + تقليل الحرث + غطاء نباتي أو سماد عضوي.", "The strongest set is usually: keep residue + reduce tillage + cover crop or manure.")],
    init() { LV.st = { sel: [] }; },
    P: () => [["residue", L("ترك البقايا", "Keep residue"), 2, L("أقل علف للأغنام", "less sheep feed")], ["notill", L("تقليل الحرث", "Reduce tillage"), 2, L("يحتاج آلة بذر مناسبة", "needs a suitable drill")], ["cover", L("غطاء نباتي", "Cover crop"), 2, L("يستهلك بعض ماء التربة", "uses some soil water")], ["manure", L("سماد عضوي/كومبوست", "Manure/compost"), 2, L("يحتاج مصدرًا ونقلًا", "needs a source and transport")], ["legume", L("بقولي في الدورة", "Legume in rotation"), 1, L("مردود أقل في سنة البقولي", "lower output in the legume year")], ["burn", L("حرق البقايا", "Burn residue"), -2, L("يزيل المادة العضوية", "removes organic matter")], ["sell", L("بيع كل التبن", "Sell all straw"), -1, L("دخل الآن، تربة أفقر لاحقًا", "income now, poorer soil later")]],
    view() {
      const st = LV.st, s = loc().soil;
      return `<div class="panel2 in d2"><b>${L("الكربون العضوي حسب العمق (SoilGrids)", "Organic carbon by depth (SoilGrids)")}</b>
          <div style="display:flex;align-items:flex-end;gap:6px;height:70px;margin-top:6px">${[s.soc, s.soc * 0.57, s.soc * 0.44, s.soc * 0.3, s.soc * 0.17].map((v, i) => `<div style="flex:1;text-align:center"><div style="height:${Math.round(v / s.soc * 56)}px;background:#6e4527;border-radius:4px 4px 0 0"></div><span class="note">${["0–5", "5–15", "15–30", "30–60", "60–100"][i]}</span></div>`).join("")}</div>
          <div class="note">${L("الشكل تقريبي بنسب ملف التربة؛ القيمة العليا من SoilGrids لموقعك، وليست تحليلًا لحقلك.", "Shape approximated from the profile; the top value is SoilGrids for your location, not a test of your field.")}</div></div>
        <b class="in d3">${L("اختر 3 ممارسات", "Choose 3 practices")} (${st.sel.length}/3)</b>
        <div class="stagger" style="display:flex;flex-direction:column;gap:8px">${this.P().map((p) => `<button class="evc ${st.sel.includes(p[0]) ? "on" : ""}" aria-pressed="${st.sel.includes(p[0])}" data-act="g" data-a="sel" data-v="${p[0]}"><span style="flex:1"><b>${p[1]}</b><small>${L("الثمن", "Trade-off")}: ${p[3]}</small></span>${st.sel.includes(p[0]) ? QUAL(p[2]) : ""}</button>`).join("")}</div>
        <div class="spacer"></div><button class="primary" data-act="g" data-a="end" ${st.sel.length === 3 ? "" : "disabled"}>${L("ثبّت الخطة", "Lock in the plan")} ${A.fwd()}</button>`;
    },
    on(a, d) {
      const st = LV.st;
      if (a === "tile") {
        if (!st.sel.includes("residue")) st.sel.push("residue");
        else if (!st.sel.includes("cover")) st.sel.push("cover");
        else st.sel = st.sel.filter(x => x !== "burn");
        snd("tap");
        say(L("تطبيق ممارسات حماية المادة العضوية على القطعة!", "Applying organic matter conservation to plot!"), "happy", "good");
        draw();
        return;
      }
      if (a === "sel") { const i = st.sel.indexOf(d.v); if (i >= 0) st.sel.splice(i, 1); else if (st.sel.length < 3) { st.sel.push(d.v); const p = this.P().find((x) => x[0] === d.v); if (p[2] < 0) say(d.v === "burn" ? L("حرق؟! المادة العضوية تتحوّل دخانًا يا صديقي.", "Burning?! Your organic matter turns into smoke, my friend.") : L("دخل اليوم… وتربة أفقر غدًا.", "Income today… poorer soil tomorrow."), "angry", "bad"); else say(L(`${p[1]}: إيجابي، لكن ${p[3]}.`, `${p[1]}: positive, but ${p[3]}.`), "happy", "good"); } draw(); return; }
      if (a === "end") {
        const P = this.P(), sum = st.sel.reduce((x, k) => x + P.find((p) => p[0] === k)[2], 0);
        st.sel.forEach((k) => { const p = P.find((q) => q[0] === k); if (p[2] > 0) goodLog(p[1]); else riskyLog(p[1]); });
        if (!st.sel.includes("residue")) missLog(L("ترك البقايا هو أبسط مصدر للمادة العضوية.", "Keeping residue is the simplest organic matter source."));
        finish({ score: clamp(sum / 6 * 100), dims: { [L("صحة التربة", "Soil health")]: clamp(sum / 6 * 100) },
          explain: L("المادة العضوية تتغيّر ببطء على مدى سنوات. نعطي تأثيرات نوعية فقط لأننا لا نملك نموذجًا ديناميكيًا للكربون في التربة.", "Organic matter changes slowly over years. We show qualitative effects only because we don't have a dynamic soil carbon model."),
          improve: L("اجمع ترك البقايا وتقليل الحرث مع غطاء نباتي أو سماد عضوي، وأعد قياس الكربون كل بضع سنوات.", "Combine kept residue and reduced tillage with a cover crop or manure, and re-measure carbon every few years.") });
      }
    },
  };

  LEVELS["11"] = {
    title: () => L("تحدّي الملوحة", "The salinity challenge"),
    intro: () => L(`لا نعرف ملوحة حقلك، لذلك هذا سيناريو افتراضي: ماء ري أو تربة بملوحة ${LV.st.ec} dS/m. اختر محصولًا لكل قطعة وطريقة إدارة.`, `We don't know your field's salinity, so this is a hypothetical scenario: irrigation water or soil at ${LV.st.ec} dS/m. Choose a crop for each plot and a management approach.`),
    hints: () => [L("كل محصول له عتبة ملوحة يبدأ بعدها المردود بالانخفاض.", "Each crop has a salinity threshold after which yield starts to fall."),
      L("الشعير من أكثر الحبوب تحمّلًا، والبقوليات (عدس، حمص، فول) حساسة.", "Barley is among the most tolerant cereals; legumes (lentil, chickpea, faba) are sensitive."),
      L("اختر الشعير أو القمح للقطع، وأضف المراقبة. الغسيل بالماء يحتاج ماءً وصرفًا جيدًا. الدورة وحدها لا تزيل الملوحة.", "Choose barley or wheat, and add monitoring. Leaching needs water and good drainage. Rotation alone can't remove salinity.")],
    init() { LV.st = { ec: 6, plots: [null, null, null], mg: [] }; },
    yieldAt(k, ec) { const l = loc(); let s = 0, n = 0; for (let i = 0; i < l.rain.length; i += 3) { s += seasonRun(k, i, { prev: "fallow", ec }).yieldIdx; n++; } return s / n; },
    view() {
      const st = LV.st;
      const mgs = [["monitor", L("مراقبة الملوحة (قياس EC)", "Monitor salinity (EC tests)"), true], ["leach", L("غسيل الأملاح بماء إضافي", "Leach salts with extra water"), farmE().water], ["drain", L("تحسين الصرف", "Improve drainage"), true], ["more", L("سقي أكثر بنفس الماء المالح", "More irrigation with the same salty water"), true]];
      return `<div class="panel2 in d2"><div style="display:flex;justify-content:space-between;align-items:center"><b>${L("الملوحة", "Salinity")}: ${st.ec} dS/m</b><span class="hyp">${L("سيناريو افتراضي", "Hypothetical scenario")}</span></div>
          <input type="range" min="2" max="10" step="1" value="${st.ec}" data-ec style="width:100%" aria-label="EC"></div>
        <div class="stagger" style="display:flex;flex-direction:column;gap:8px">${st.plots.map((k, i) => `<div class="panel2"><b>${L("القطعة", "Plot")} ${i + 1}</b>${k ? ` · ${cname(k)} · ${L("المردود", "yield")} <b>${pct(this.yieldAt(k, st.ec))}</b>` : ""}
          <div class="chiprow" style="margin-top:6px">${CROPS.map((x) => `<button class="chip ${k === x ? "on" : ""}" style="min-height:38px;padding:4px 10px;font-size:13px" data-act="g" data-a="plot" data-i="${i}" data-v="${x}">${cname(x)} <small style="opacity:.7">${E.SALT[CK[x]] ? E.SALT[CK[x]][0] : "—"}</small></button>`).join("")}</div></div>`).join("")}</div>
        <div class="panel2 in d3"><b>${L("الإدارة", "Management")}</b><div class="chiprow" style="margin-top:6px">${mgs.map((m) => `<button class="chip ${st.mg.includes(m[0]) ? "on" : ""}" ${m[2] ? "" : "disabled"} data-act="g" data-a="mg" data-v="${m[0]}">${st.mg.includes(m[0]) ? '<span class="ck"></span>' : ""}${m[1]}</button>`).join("")}</div>
          <div class="note">${L("الأرقام الصغيرة = عتبة الملوحة التقريبية (dS/m) في المحرك. الدورة لا تزيل الملوحة وحدها.", "Small numbers = approximate salinity threshold (dS/m) in the engine. Rotation alone doesn't remove salinity.")}</div></div>
        <div class="spacer"></div><button class="primary" data-act="g" data-a="end" ${st.plots.every(Boolean) ? "" : "disabled"}>${L("قيّم خطتي", "Evaluate my plan")} ${A.fwd()}</button>`;
    },
    after() { const r = document.querySelector("[data-ec]"); if (r) r.addEventListener("change", () => { LV.st.ec = +r.value; draw(); }); },
    on(a, d) {
      const st = LV.st;
      if (a === "tile") {
        const i = +d.i, c = i % 3;
        const crops = ["barley", "oat", "vetch", "wheat"];
        const curIdx = crops.indexOf(st.plots[c] || "barley");
        st.plots[c] = crops[(curIdx + 1) % crops.length];
        snd("good");
        const y = this.yieldAt(st.plots[c], st.ec);
        say(L(`القطعة ${c + 1}: ${cname(st.plots[c])} (المردود المتوقع: ${pct(y)})`, `Plot ${c + 1}: ${cname(st.plots[c])} (expected yield: ${pct(y)})`), y > 0.6 ? "happy" : "worried", y > 0.6 ? "good" : "warn");
        draw();
        return;
      }
      if (a === "plot") { st.plots[+d.i] = d.v; const th = E.SALT[CK[d.v]][0]; if (st.ec > th) say(L(`${cname(d.v)} يبدأ بالتضرّر فوق ${th} dS/m تقريبًا. انتبه!`, `${cname(d.v)} starts to suffer above about ${th} dS/m. Careful!`), "worried", "warn"); else say(L(`${cname(d.v)} يتحمّل هذه الملوحة.`, `${cname(d.v)} tolerates this salinity.`), "happy", "good"); draw(); return; }
      if (a === "mg") { const i = st.mg.indexOf(d.v); if (i >= 0) st.mg.splice(i, 1); else { st.mg.push(d.v); if (d.v === "more") risk({ level: "high", kind: "science", title: L("سقي أكثر بماء مالح", "More irrigation with salty water"), decision: L("زيادة السقي بنفس الماء", "Watering more with the same water"), why: L("كل سقية تضيف أملاحًا.", "Each watering adds salts."), cons: L("بدون صرف جيد تتراكم الأملاح في منطقة الجذور.", "Without good drainage salts build up in the root zone."), mitig: L("الغسيل يعمل فقط مع صرف جيد وماء أقل ملوحة.", "Leaching only works with good drainage and less salty water.") }); } draw(); return; }
      if (a === "end") {
        const ys = st.plots.map((k) => this.yieldAt(k, st.ec)), best = Math.max(...CROPS.map((k) => this.yieldAt(k, st.ec)));
        const mean = ys.reduce((x, y) => x + y, 0) / 3;
        st.plots.forEach((k, i) => { if (st.ec > E.SALT[CK[k]][0] + 2) riskyLog(L(`${cname(k)} حساس عند ${st.ec} dS/m.`, `${cname(k)} is sensitive at ${st.ec} dS/m.`)); else goodLog(L(`${cname(k)} مناسب لهذه الملوحة.`, `${cname(k)} suits this salinity.`)); });
        let mgPts = 0; if (st.mg.includes("monitor")) { mgPts += 10; goodLog(L("أضفت مراقبة الملوحة.", "You added salinity monitoring.")); } else missLog(L("المراقبة المنتظمة أساس إدارة الملوحة.", "Regular monitoring is the basis of salinity management."));
        if (st.mg.includes("drain")) mgPts += 5; if (st.mg.includes("leach") && st.mg.includes("drain")) mgPts += 5; if (st.mg.includes("more")) { mgPts -= 15; riskyLog(L("سقي إضافي بماء مالح بدون صرف.", "Extra salty irrigation without drainage.")); }
        finish({ score: 80 * (best ? mean / best : 1) + mgPts, dims: { [L("اختيار المحاصيل", "Crop choice")]: 100 * (best ? mean / best : 1), [L("الإدارة", "Management")]: clamp(mgPts / 20 * 100) },
          explain: L("تحت الملوحة، اختيار محصول متحمّل يحمي المردود، لكن الدورة وحدها لا تزيل الأملاح. الحل الدائم يحتاج قياسًا وصرفًا وماءً جيدًا.", "Under salinity, a tolerant crop protects yield, but rotation alone won't remove salts. A lasting fix needs measurement, drainage and good water."),
          improve: L("اختر الشعير أو القمح، أضف المراقبة، ولا تزد السقي بماء مالح دون صرف.", "Choose barley or wheat, add monitoring, and don't add salty irrigation without drainage.") });
      }
    },
  };

  // ---------------------------------------------------------------- map
  const LTITLE = (id) => LEVELS[id].title();
  A.SCREENS.map = () => {
    const g = G(), done = (id) => !!(g.levels[id] && g.levels[id].attempts && g.levels[id].attempts.length);
    const unlocked = () => true;
    const nextId = ORDER.find((id) => !done(id));
    const allDone = ORDER.every(done);
    const chapters = { start: L("البداية", "Getting started"), climate: L("تحديات المناخ", "Climate challenges"), failure: L("فصل خاص", "Special chapter"), soil: L("تحديات التربة", "Soil challenges") };
    let cur = "", html = "";
    ORDER.forEach((id, k) => {
      if (CHAPTER[id] !== cur) { cur = CHAPTER[id]; html += `<div class="chap">${chapters[cur]}</div>`; }
      const isDone = done(id), isUnlocked = unlocked(id), rec = g.levels[id];
      let statusLabel = L("مغلق", "Locked");
      let icon = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="4" y="8" width="10" height="8" rx="2" fill="#fffdf4"/><path d="M6 8V6a3 3 0 0 1 6 0v2" stroke="#fffdf4" stroke-width="2" fill="none"/></svg>';
      if (isDone) {
        statusLabel = L("✓ تم الإنجاز", "✓ Completed");
        icon = (id === "F" ? "!" : id);
      } else if (isUnlocked) {
        statusLabel = L("جاهز للبدء", "Ready to play");
        icon = (id === "F" ? "!" : id);
      }
      html += `<button class="node zig ${isUnlocked ? "" : "locked"} ${isDone ? "done" : ""} ${id === nextId ? "next" : ""} in" style="animation-delay:${k * 0.05}s" ${isUnlocked ? `data-act="g" data-a="start" data-id="${id}"` : 'aria-disabled="true"'}>
        <span class="num">${icon}</span>
        <span style="flex:1"><b>${LTITLE(id)}</b><small>${statusLabel}</small></span>
        ${rec ? `<span class="stars">${[0, 1, 2].map((i) => `<span class="${i < (rec.stars || 0) ? "" : "off"}">★</span>`).join("")}</span>` : ""}
      </button>`;
    });
    return `<div class="gscreen">
      <div class="ghead in"><button class="iconbtn" data-act="go" data-to="hub" aria-label="${L("رجوع", "Back")}">${S().lang === "en" ? '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 4l-5 5 5 5" stroke="#2f9bd6" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>' : '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4l5 5-5 5" stroke="#2f9bd6" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>'}</button>
        <h1><small>${esc(A.placeName())} · ${esc(pname())}</small>${L("مغامرة المزرعة", "The farm adventure")}</h1></div>
      <div class="dock in d1"><div class="who">${salahM(80, "happy")}</div><div class="say tone-n">${L("اختر أي مستوى لتبدأ التحدي مباشرة! أكمل التحديات لبناء تقرير صمود مزرعتك الشامل.", "Pick any level to start the challenge directly! Complete challenges to build your comprehensive Farm Resilience Report.")}</div></div>
      <div class="mapw">${html}</div>
      <button class="primary" data-act="go" data-to="report">${L("تقرير صمود المزرعة", "Farm Resilience Report")} ${A.fwd()}</button>
      <div class="note">${L("البيانات: ناسا POWER 1995–2025 لنقطة واحدة قرب حقلك، SoilGrids، NASADEM.", "Data: NASA POWER 1995–2025 for one point near your field, SoilGrids, NASADEM.")}</div>
    </div>`;
  };
  A.AFTER.map = () => { if (!G().mute) playCalmMusic(); };

  // ---------------------------------------------------------------- final report (Reveals all scores, risks & evidence)
  A.SCREENS.report = () => {
    const g = G(), l = loc(), recs = ORDER.map((id) => ({ id, r: g.levels[id] })).filter((x) => x.r);
    const overall = recs.length ? Math.round(recs.reduce((s, x) => s + x.r.best, 0) / recs.length) : 0;
    const initSeq = A.currentSeq(), finSeq = g.finalStrategy || g.plan || initSeq;
    const evS = (seq) => { const fm = farmE(); const ev = E.evaluate(l, { seq: seq.map((k) => CK[k] || "fallow_grazed"), sowing: "normal", residue: "grazed", irrigation: fm.water }, fm); return E.total(ev.scores, [...new Set((S().farm.prios || []).map((p) => A.PK[p] || (E.PRIORITIES.includes(p) ? p : null)).filter(Boolean))].slice(0, 3)); };
    const tr = l.trends;
    const vul = [];
    if (tr.onset && tr.onset.p < 0.05) vul.push(L(`مطر البذر يتأخر ${Math.round(tr.onset.per_decade)} يومًا كل عقد (دال إحصائيًا).`, `Sowing rain arrives ${Math.round(tr.onset.per_decade)} days later per decade (significant).`));
    if (tr.et0 && tr.et0.p < 0.05) vul.push(L(`حاجة المحاصيل للماء ترتفع ${Math.round(tr.et0.per_decade)} ملم كل عقد.`, `Crop water demand rises ${Math.round(tr.et0.per_decade)} mm per decade.`));
    if (tr.hot_flowering && tr.hot_flowering.per_decade > 0) vul.push(L(`أيام الحر عند الإزهار: ${tr.hot_flowering.early} ← ${tr.hot_flowering.late}.`, `Hot days at flowering: ${tr.hot_flowering.early} → ${tr.hot_flowering.late}.`));
    if (l.summary && l.summary.driest) vul.push(L(`أجف 3 مواسم: ${l.summary.driest.map((i) => DATA.seasons[i]).join("، ")}.`, `3 driest seasons: ${l.summary.driest.map((i) => DATA.seasons[i]).join(", ")}.`));

    // Full risks analysis with evidence & consequences
    const allRisks = (g.risks || []).slice(-8);

    return `<div class="gscreen">
      <div class="ghead in"><button class="iconbtn" data-act="go" data-to="map" aria-label="${L("الخريطة", "Map")}"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2z" stroke="#2f9bd6" stroke-width="1.7" fill="none"/></svg></button><h1><small>${esc(pname())} · ${esc(A.placeName())}</small>${L("تقرير صمود المزرعة", "Farm Resilience Report")}</h1></div>
      <div class="panel2 pop" style="display:flex;align-items:center;gap:14px"><div style="width:90px;height:90px">${salahM(90, overall >= 65 ? "happy" : "worried")}</div><div><div class="note">${L("النتيجة الإجمالية لصمود المزرعة", "Overall Resilience Score")}</div><div class="bigscore" style="font-size:52px">${overall}</div><div class="note">${recs.length}/${ORDER.length} ${L("مستويات مكتملة", "completed levels")}</div></div></div>
      <div class="panel2 in d2" style="display:flex;flex-direction:column;gap:5px"><b>📊 ${L("تقييم الأداء حسب المستوى", "Level-by-level resilience scores")}</b>${recs.map((x) => `<div class="dimrow"><span style="width:150px;font-size:12px">${LTITLE(x.id)}</span><span class="pbar"><i style="width:${x.r.best}%"></i></span><span dir="ltr">${x.r.best}/100</span></div>`).join("")}</div>
      <div class="panel2 in d3"><b>🔍 ${L("تحليل المخاطر والأدلة العلمية لقراراتك", "Full Risk Analysis & Evidence")}</b>
        ${allRisks.length ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${allRisks.map(r => `
          <div style="background:#fff;border:1px solid #f0dcb0;border-radius:12px;padding:10px;font-size:12.5px;line-height:1.5">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <b>${r.t}</b>
              <span class="rlvl rl-${r.level || 'moderate'}" style="font-size:10.5px">${r.level === 'high' ? L('خطر مرتفع', 'High Risk') : L('خطر متوسط', 'Moderate Risk')}</span>
            </div>
            ${r.cons ? `<div style="margin-top:3px;color:#2f9bd6"><b>${L("العواقب:", "Consequences:")}</b> ${r.cons}</div>` : ""}
            ${r.mitig ? `<div style="margin-top:2px;color:#24506a"><b>${L("كيف تخفف الخطر:", "Mitigation:")}</b> ${r.mitig}</div>` : ""}
          </div>
        `).join("")}</div>` : `<p style="font-size:12.5px;color:#2f9bd6;margin:4px 0">${L("لم تُسجّل أي مخاطر حرجة أثناء التحديات.", "No critical risks registered.")}</p>`}
      </div>
      <div class="panel2 in d3"><b>🛰️ ${L("نقاط ضعف مزرعتك المناخية (بيانات ناسا POWER 1995–2025)", "Climate vulnerabilities (NASA POWER 1995–2025)")}</b><ul style="margin:4px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.6">${vul.map((v) => `<li>${v}</li>`).join("")}</ul></div>
      <div class="panel2 in d4"><b>🌾 ${L("استراتيجيتك الزراعية: البداية مقابل النهاية", "Your farming strategy: start vs end")}</b>
        <div class="result" style="margin-top:6px"><span style="flex:1">${L("الدورة المبدئية", "Initial")}: ${initSeq.map(cname).join(A.arrow())}</span><b>${evS(initSeq)}</b></div>
        <div class="result" style="margin-top:6px"><span style="flex:1">${L("الدورة المقترحة", "Final")}: ${finSeq.map(cname).join(A.arrow())}</span><b style="color:#4a9e2f">${evS(finSeq)}</b></div>
        <div class="note">${L("التقييم من 100 محسوب حسب أولوياتك على 30 موسمًا حقيقيًا.", "Score /100 calculated against your farm priorities over 30 real NASA seasons.")}</div></div>
      <div class="panel2 in d5"><b>🌱 ${L("توصيات عمّي صالح العلمية للتحسين", "Ammi Salah's scientific recommendations")}</b><ul style="margin:4px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.6">
        <li>${L("نوّع العائلات (حبوب ← بقوليات) لتكسر الأمراض وتساعد إدارة الآزوت.", "Alternate families (cereal ↔ legume) to break disease and help nitrogen.")}</li>
        <li>${L("اترك البقايا وغطِّ التربة في الخريف ضد المطر الغزير.", "Keep residue and cover the soil in autumn against heavy rain.")}</li>
        <li>${L("راقب موعد مطر البذر وابذر مبكرًا عندما يسمح ذلك لتتجنّب حر ماي.", "Watch the sowing-rain date and sow early when possible to avoid May heat.")}</li>
        <li>${L("حلّل التربة (pH، الملوحة، المادة العضوية، الفوسفور والبوتاسيوم) لتأكيد التقديرات.", "Test the soil (pH, salinity, organic matter, P and K) to confirm the estimates.")}</li></ul></div>
      <div class="note">${L("البيانات: ناسا POWER 1995–2025، SoilGrids، NASADEM، FAO-56/33.", "Data: NASA POWER 1995–2025, SoilGrids, NASADEM, FAO-56/33.")}</div>
      <button class="primary" data-act="go" data-to="map">${L("العودة للخريطة", "Back to the map")}</button>
    </div>`;
  };

  // ---------------------------------------------------------------- live 3D scenes on top of every level
  const NBAG = '<g class="grow"><rect x="-8" y="-18" width="16" height="18" rx="3" fill="#ffe9a8" stroke="#2f9bd6"/><text x="0" y="-6" text-anchor="middle" font-size="9" font-weight="900" fill="#2f9bd6">N</text></g>';
  const SCENE = {
    2: () => { const st = LV.st, k = st.plan[st.active] || st.plan[0];
      return fieldBoard(k || null, 1, { env: "day", rows: 2, height: 165, act: "g", action: "tile", flat: () => (k ? "" : FLAT.straw), badge: k ? `${L("الموسم", "Season")} ${st.plan[st.active] ? st.active + 1 : 1} · ${cname(k)}` : L("المس الحقل للبذر", "Touch field to sow") }); },
    3: () => { const st = LV.st, y = LEVELS["3"].calc(st), w = Object.keys(st.alloc).length;
      return fieldBoard(st.crop, Math.min(1, y * 1.35), { env: "drought", noIrrig: true, height: 165, act: "g", action: "tile", badge: `${cname(st.crop)} · ${L("المردود", "yield")} ${pct(y)}`,
        flat: (i, c) => (st.mulch ? FLAT.mulch : "") + (st.watered && st.watered[i] ? '<rect width="50" height="50" fill="#3a5a70" opacity=".45"/>' : "") + (w ? (st.method === "drip" ? FLAT.drip : st.method === "flood" && c === 0 ? FLAT.flood : "") : ""),
        deco: (i, c, r) => (st.watered && st.watered[i] ? '<g class="splash"><circle cx="0" cy="-10" r="4" fill="#3a8ac9"/><circle cx="-8" cy="-6" r="2.5" fill="#58a6de"/><circle cx="8" cy="-6" r="2.5" fill="#58a6de"/></g>' : "") + (w && st.method === "sprinkler" && (r + c) % 3 === 1 ? XTRA.sprinkler : "") }); },
    4: () => { const st = LV.st, rec = LEVELS["4"].run(st);
      return fieldBoard(st.crop, Math.min(1, rec.yieldIdx * 1.3), { env: st.mist ? "day" : "heat", height: 165, act: "g", action: "tile", badge: `${L("ضرر الحر", "Heat damage")} ${pct(rec.heat)} · ${pct(rec.yieldIdx)}` }); },
    6: () => { const st = LV.st;
      return board3d(4, 3, (i, c, r) => ({ fill: soilCol(), flat: (st.inp[r] === "manure" ? FLAT.manure : "") + (st.inp[r] === "drip" ? FLAT.drip : ""), deco: plantDeco(st.seq[r], 4) + (st.inp[r] === "n" && c === 0 ? NBAG : ""), label: `${L("الموسم", "Season")} ${r + 1}` }),
        { env: "day", act: "g", action: "tile", height: 165, extras: farmExtras(4, 3), badge: L("المس أي صف لتغيير التسميد", "Touch any row to change inputs") }); },
    7: () => { const st = LV.st, last = st.results[st.results.length - 1];
      if (!last) return fieldBoard(st.pick.crop, 0.9, { env: "day", height: 165, act: "g", action: "tile", badge: L("المس الحقل لبدء الموسم", "Touch field to start season") });
      const env = last.rec.heat > 0.1 ? "heat" : last.y < 0.45 ? "drought" : "day";
      return fieldBoard(last.crop, Math.min(1, last.y * 1.3), { env, height: 165, act: "g", action: "tile", badge: `${DATA.seasons[last.s]} · ${cname(last.crop)} · ${pct(last.y)}` }); },
    9: () => { const st = LV.st, sc = LEVELS["9"].ev(st).scores.erosion;
      return fieldBoard(null, 1, { env: "storm", rain: sc < 50, height: 165, noIrrig: true, act: "g", action: "tile", badge: `${L("الحماية", "Protection")} ${sc}/100`,
        flat: (i) => (st.till ? FLAT_FURROW : "") + (st.residue === "kept" ? FLAT.straw : st.residue === "grazed" && i % 2 ? FLAT.straw : "") + (sc < 50 && i % 3 === 0 ? FLAT.runoff : ""),
        deco: (i) => (st.cover && st.plan.includes("fallow") && i % 2 === 0 ? plantDeco("vetch", 3) : st.residue === "kept" ? stubble() : "") }); },
    10: () => { const sel = LV.st.sel;
      return fieldBoard(null, 1, { env: sel.includes("burn") ? "dead" : "soil", height: 165, noIrrig: true, act: "g", action: "tile",
        flat: (i) => (sel.includes("residue") ? FLAT.straw : "") + (sel.includes("manure") && i % 2 ? FLAT.manure : "") + (sel.includes("burn") ? '<rect width="50" height="50" fill="#3a2e26" opacity=".7"/>' : "") + (!sel.includes("notill") && !sel.includes("residue") ? FLAT_FURROW : ""),
        deco: (i) => (sel.includes("cover") && i % 2 === 0 ? plantDeco("vetch", 3, "grow") : sel.includes("legume") && i % 2 ? plantDeco("lentil", 3, "grow") : "") }); },
    11: () => { const st = LV.st;
      return board3d(3, 2, (i, c) => { const k = st.plots[c], y = k ? LEVELS["11"].yieldAt(k, st.ec) : 1;
        return { fill: mixC(soilCol(), "#d9d2bd", Math.min(1, st.ec / 10)), flat: st.ec >= 4 ? FLAT.salt : "", deco: k ? plantDeco(k, 4, "", Math.min(1, y * 1.3)) : "", label: `${L("القطعة", "Plot")} ${c + 1}` }; },
        { env: "salt", act: "g", action: "tile", height: 165, extras: farmExtras(3, 2), badge: `${st.ec} dS/m · ${L("المس لتغيير المحصول", "Touch to switch crop")}` }); },
  };
  Object.keys(SCENE).forEach((id) => { const v = LEVELS[id].view; LEVELS[id].view = function () { return `<div class="in d2">${SCENE[id]()}</div>` + v.call(this); }; });

  // ---------------------------------------------------------------- HUB: three doors after onboarding
  const ICO = {
    sat: '<svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"><rect x="17" y="17" width="12" height="12" rx="2" fill="#fffdf4" transform="rotate(45 23 23)"/><rect x="3" y="19" width="12" height="8" rx="1" fill="#ffe9a8" transform="rotate(45 23 23)"/><rect x="31" y="19" width="12" height="8" rx="1" fill="#ffe9a8" transform="rotate(45 23 23)"/><path d="M30 38 a10 10 0 0 0 8 -8 M30 43 a15 15 0 0 0 13 -13" stroke="#fffdf4" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
    sprout: '<svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"><path d="M23 42 V22" stroke="#fffdf4" stroke-width="3" stroke-linecap="round"/><path d="M23 26 C10 26 6 16 8 8 C18 8 24 14 23 26Z" fill="#fffdf4"/><path d="M23 22 C34 22 39 14 38 6 C28 6 22 12 23 22Z" fill="#ffe9a8"/></svg>',
    play: '<svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="19" fill="none" stroke="#fffdf4" stroke-width="3"/><path d="M18 14 L33 23 L18 32Z" fill="#fffdf4"/></svg>',
  };
  const progress = () => { const g = G(), ids = ORDER.filter((id) => g.levels[id] && g.levels[id].attempts.length); return { n: ids.length, stars: ids.reduce((a, id) => a + (g.levels[id].stars || 0), 0) }; };
  A.SCREENS.hub = () => {
    const f = S().farm, l = loc() || {}, pr = progress(), crop = lastCrop(), area = +f.area || 5, cols = area < 2 ? 3 : area < 15 ? 4 : 5;
    const irr = { rain: L("مطري", "Rainfed"), drip: L("تنقيط", "Drip"), sprinkler: L("رش", "Sprinkler"), flood: L("غمر", "Flood") }[f.irrig] || "—";
    const soilN = { sandy: L("رملية", "Sandy"), clay: L("طينية", "Clay"), loam: L("طميية", "Loam") }[f.soil] || (l.soil && l.soil.texture) || L("طميية", "Loam");
    const slopeVal = l.slope != null ? l.slope : 3.5;
    const rainMeanVal = (l.summary && l.summary.rain_mean) != null ? l.summary.rain_mean : 350;
    return `<div class="gscreen hub">
      <div class="ghead in">${A.backBtn("farm").replace('class="back"', 'class="iconbtn"')}
        <h1><small>${esc(A.placeName())}</small>${L(`مزرعة ${esc(pname())}`, `${esc(pname())}'s farm`)}</h1>
        <button class="iconbtn" data-act="editFarm" aria-label="${L("تعديل معلومات المزرعة", "Edit farm answers")}"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17h4l9-9-4-4-9 9z M11 5l4 4" stroke="#516d77" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg></button>
        <button class="iconbtn" data-act="g" data-a="mute" aria-label="${G().mute ? L("تشغيل الصوت", "Unmute") : L("كتم الصوت", "Mute")}">${G().mute ? "🔇" : "🔊"}</button></div>
      <div class="in d1">${fieldBoard(crop, 1, { cols, rows: 3, env: "day", act: "hub3", height: 250, badge: `${area} ${L("هكتار", "ha")} · ${cname(crop)}` })}</div>
      <div class="farmchips in d2"><span>${soilN}</span><span>${irr}</span><span>${L("ماء", "Water")}: ${{ low: L("قليل", "low"), medium: L("متوسط", "medium"), high: L("كافٍ", "good") }[f.water] || "—"}</span><span>${L("انحدار", "Slope")} ${slopeVal}%</span></div>
      <div class="dock in d2"><div class="who" id="who">${salahM(80, "happy")}</div><div class="say tone-n" id="say"><div>${L(`أهلًا يا ${esc(pname())}! هذه مزرعتك. اسحبها لتدور، واضغط على الحقل لأخبرك عنه. من أين نبدأ؟`, `Welcome, ${esc(pname())}! This is your farm. Drag it to turn it, tap the field and I'll tell you about it. Where do we start?`)}</div></div></div>
      <div class="hubgrid">
        <button class="hubc tilt c-nasa in d3" data-act="go" data-to="nasa"><span class="hico">${ICO.sat}</span><span class="htx"><small>1</small><b>${L("تقرير ناسا لموقعك", "Your NASA location report")}</b><span>${L(`30 موسمًا من المطر والحرارة والتربة · المتوسط ${rainMeanVal} ملم`, `30 seasons of rain, heat and soil · ${rainMeanVal} mm average`)}</span></span></button>
        <button class="hubc tilt c-crop in d4" data-act="go" data-to="crops"><span class="hico">${ICO.sprout}</span><span class="htx"><small>2</small><b>${L("خصائص المحاصيل", "Crop characteristics")}</b><span>${L(`${CROPS.length} محاصيل · مدى ملاءمتها لمزرعتك`, `${CROPS.length} crops · how each one fits your farm`)}</span></span></button>
        <button class="hubc tilt c-game in d5" data-act="go" data-to="map"><span class="hico">${ICO.play}</span><span class="htx"><small>3</small><b>${pr.n ? L("أكمل مغامرة المزرعة", "Continue the farm adventure") : L("ابدأ اتخاذ القرارات: اللعبة", "Start making decisions: the game")}</b><span>${pr.n}/${ORDER.length} ${L("مستويات", "levels")} · ★ ${pr.stars}</span></span>
          <span class="hring"><svg viewBox="0 0 36 36" width="44" height="44" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="4"/><circle cx="18" cy="18" r="15" fill="none" stroke="#e8e8bc" stroke-width="4" stroke-dasharray="${(94 * pr.n / ORDER.length).toFixed(1)} 94" transform="rotate(-90 18 18)" stroke-linecap="round"/></svg></span></button>
      </div>
    </div>`;
  };
  A.AFTER.hub = () => { lastSay = ""; };
  A.ACT.editFarm = () => { S().step = 0; A.save(); A.go("farm"); };
  A.ACT.hub3 = (d) => {
    const f = S().farm, l = loc(), facts = [
      L(`تربتك حسب SoilGrids: ${l.soil.texture === "clay loam" ? "طميية طينية" : l.soil.texture}، تخزن حوالي ${l.soil.paw100} ملم من الماء المتاح في المتر الأول.`, `Your soil per SoilGrids: ${l.soil.texture}, holding about ${l.soil.paw100} mm of plant-available water in the top metre.`),
      L(`متوسط المطر من أكتوبر إلى ماي هنا ${l.summary.rain_mean} ملم، لكن آخر 3 مواسم كانت الأجف في 30 سنة.`, `Rain from October to May averages ${l.summary.rain_mean} mm here, but the last 3 seasons were the driest in 30 years.`),
      L(`مطر البذر صار يتأخر حوالي ${Math.round(l.trends.onset.per_decade)} يومًا كل عقد. الصبر صار مهارة زراعية!`, `The sowing rain now comes about ${Math.round(l.trends.onset.per_decade)} days later each decade. Patience is a farming skill now!`),
      L(`انحدار حقلك حوالي ${l.slope}% حسب NASADEM: الماء يجري ويحمل التربة إذا كانت عارية.`, `Your field slopes about ${l.slope}% per NASADEM: water runs off and carries bare soil with it.`),
      f.irrig && f.irrig !== "rain" ? L("عندك نظام ري، لكن تذكّر: الماء لا ينبت على الأشجار!", "You have irrigation, but remember: water doesn't grow on trees!") : L("حقلك مطري: كل قطرة من السماء ثمينة.", "Your field is rainfed: every drop from the sky counts."),
    ];
    const el = document.querySelectorAll(".b3d .t3")[+d.i]; if (el) { el.classList.remove("bounce3"); void el.offsetWidth; el.classList.add("bounce3"); }
    snd("tap"); say(facts[(+d.i) % facts.length], "happy", "n");
  };

  // ---------------------------------------------------------------- NASA REPORT
  const sig = (p) => p < 0.05 ? `<span class="sig s-yes">✔ ${L("دال إحصائيًا", "Significant")}</span>` : p < 0.1 ? `<span class="sig s-weak">~ ${L("دليل ضعيف", "Weak evidence")}</span>` : `<span class="sig s-no">✕ ${L("غير دال", "Not significant")}</span>`;
  function chartSeasons() {
    const l = loc(), v = l.summary.rain_oct_may, n = v.length, W = 340, H = 150, P = 26, mx = Math.max(...v) * 1.05, bw = (W - P - 6) / n;
    let b = "";
    v.forEach((x, i) => { const h = x / mx * (H - 22), dry = l.summary.driest.includes(i);
      b += `<rect class="gbar" style="animation-delay:${i * 0.02}s" x="${(P + i * bw + 1).toFixed(1)}" y="${(H - 16 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${dry ? "#840000" : "#9ca047"}" data-tip="${DATA.seasons[i]}: ${x} ${L("ملم", "mm")}${dry ? " · " + L("من الأجف", "among the driest") : ""}"/>`; });
    const ym = H - 16 - l.summary.rain_mean / mx * (H - 22);
    const ticks = [0, 200, 400, 600, 800].filter((t) => t < mx).map((t) => { const y = H - 16 - t / mx * (H - 22); return `<line x1="${P}" x2="${W}" y1="${y}" y2="${y}" stroke="#e3e3bf" stroke-width="1"/><text x="${P - 4}" y="${y + 3}" text-anchor="end" font-size="8" fill="#6b706a">${t}</text>`; }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="chartsvg" role="img" aria-label="${L("المطر لكل موسم", "Rain per season")}">${ticks}${b}
      <line x1="${P}" x2="${W}" y1="${ym}" y2="${ym}" stroke="#2b2a20" stroke-width="1.2" stroke-dasharray="4 3"/><text x="${W - 2}" y="${ym - 4}" text-anchor="end" font-size="8.5" font-weight="800" fill="#2b2a20">${L("المتوسط", "avg")} ${l.summary.rain_mean}</text>
      <text x="${P}" y="${H - 3}" font-size="8" fill="#6b706a">${DATA.seasons[0]}</text><text x="${W}" y="${H - 3}" text-anchor="end" font-size="8" fill="#6b706a">${DATA.seasons[n - 1]}</text></svg>`;
  }
  function chartMonths() {
    const l = loc(), n = l.rain.length, R = Array(12).fill(0), Et = Array(12).fill(0);
    for (let s = 0; s < n; s++) for (let m = 0; m < 12; m++) { R[m] += l.rain[s][m] / n; Et[m] += l.et0[s][m] / n; }
    const W = 340, H = 160, P = 26, mx = Math.max(...R, ...Et) * 1.08, bw = (W - P - 6) / 12, y = (v) => H - 18 - v / mx * (H - 26);
    let s = [0, 50, 100, 150, 200].filter((t) => t < mx).map((t) => `<line x1="${P}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="#e3e3bf"/><text x="${P - 4}" y="${y(t) + 3}" text-anchor="end" font-size="8" fill="#6b706a">${t}</text>`).join("");
    R.forEach((v, m) => { s += `<rect class="gbar" style="animation-delay:${m * 0.04}s" x="${P + m * bw + 4}" y="${y(v)}" width="${bw - 8}" height="${y(0) - y(v)}" rx="3" fill="#516d77" data-tip="${mName(m)} · ${L("مطر", "rain")} ${Math.round(v)} ${L("ملم", "mm")} · ET0 ${Math.round(Et[m])} ${L("ملم", "mm")}"/><text x="${P + m * bw + bw / 2}" y="${H - 5}" text-anchor="middle" font-size="7.5" fill="#6b706a">${mName(m).slice(0, S().lang === "en" ? 3 : 4)}</text>`; });
    s += `<path class="gline" d="${Et.map((v, m) => `${m ? "L" : "M"}${(P + m * bw + bw / 2).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="#840000" stroke-width="2" stroke-linejoin="round"/>`;
    s += Et.map((v, m) => `<circle cx="${P + m * bw + bw / 2}" cy="${y(v)}" r="4" fill="#840000" stroke="#fbfbef" stroke-width="2" data-tip="${mName(m)} · ET0 ${Math.round(v)} ${L("ملم", "mm")} · ${L("مطر", "rain")} ${Math.round(R[m])} ${L("ملم", "mm")}"/>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="chartsvg" role="img" aria-label="${L("المطر والتبخر الشهري", "Monthly rain and evaporative demand")}">${s}</svg>`;
  }
  function chartHot() {
    const l = loc(), n = l.hot.length, Hh = Array(12).fill(0);
    for (let s = 0; s < n; s++) for (let m = 0; m < 12; m++) Hh[m] += l.hot[s][m] / n;
    const W = 340, H = 120, P = 26, mx = Math.max(...Hh, 1) * 1.1, bw = (W - P - 6) / 12, y = (v) => H - 18 - v / mx * (H - 26);
    let s = `<rect x="${P + 7 * bw}" y="4" width="${2 * bw}" height="${H - 22}" fill="#840000" opacity=".07" rx="4"/><text x="${P + 8 * bw}" y="13" text-anchor="middle" font-size="8" font-weight="800" fill="#840000">${L("الإزهار", "flowering")}</text>`;
    Hh.forEach((v, m) => { s += `<rect class="gbar" style="animation-delay:${m * 0.04}s" x="${P + m * bw + 4}" y="${y(v)}" width="${bw - 8}" height="${Math.max(0, y(0) - y(v))}" rx="3" fill="${m === 7 || m === 8 ? "#840000" : "#C9A15C"}" data-tip="${mName(m)} · ${v.toFixed(1)} ${L("يوم فوق 31°", "days above 31°C")}"/><text x="${P + m * bw + bw / 2}" y="${H - 5}" text-anchor="middle" font-size="7.5" fill="#6b706a">${mName(m).slice(0, S().lang === "en" ? 3 : 4)}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" class="chartsvg" role="img" aria-label="${L("أيام الحر", "Hot days")}">${s}</svg>`;
  }
  A.SCREENS.nasa = () => {
    const l = loc(), tr = l.trends, so = l.soil, f1 = (x) => (Math.round(x * 10) / 10);
    const TR = [["rain", L("مطر الموسم", "Season rain"), L("ملم", "mm")], ["autumn_rain", L("مطر الخريف", "Autumn rain"), L("ملم", "mm")], ["et0", L("حاجة التبخر ET0", "Evaporative demand ET0"), L("ملم", "mm")], ["onset", L("موعد مطر البذر", "Sowing-rain onset"), L("يوم بعد 1 سبتمبر", "days after 1 Sep")], ["tmean", L("متوسط الحرارة", "Mean temperature"), "°C"], ["hot_flowering", L("أيام الحر عند الإزهار", "Hot days at flowering"), L("يوم", "days")], ["frost", L("أيام الصقيع", "Frost days"), L("يوم", "days")]];
    const kpi = (v, t, sub, cls = "") => `<div class="kpi ${cls}"><b>${v}</b><span>${t}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const dry3 = l.summary.driest.map((i) => DATA.seasons[i]).join(S().lang === "en" ? ", " : "، ");
    return `<div class="gscreen">
      <div class="ghead in">${A.backBtn("hub").replace('class="back"', 'class="iconbtn"')}<h1><small>${esc(A.placeName())}</small>${L("تقرير ناسا لموقعك", "Your NASA location report")}</h1></div>
      <div class="dock in d1"><div class="who">${salahM(80, "worried")}</div><div class="say tone-warn">${L(`باختصار يا ${esc(pname())}: آخر 3 مواسم (${dry3}) كانت الأجف في 30 سنة، ومطر البذر يتأخر، والحاجة للماء ترتفع. هذا ما ستواجهه في اللعبة.`, `In short, ${esc(pname())}: the last 3 seasons (${dry3}) were the driest in 30 years, the sowing rain comes later and water demand is rising. That's what you'll face in the game.`)}</div></div>
      <div class="cover in d2"><span class="obs">${L("رصد", "Observed")}</span> NASA POWER · ${f1(l.lat)}°, ${f1(l.lon)}° · ${L("خلية ~50 كم", "~50 km cell")} · 1995–2025 (${DATA.seasons.length} ${L("موسمًا", "seasons")})<br>SoilGrids v2.0 (250 m) · NASADEM (30 m) · ${L("الارتفاع", "elevation")} ${Math.round(l.elev)} ${L("م", "m")}</div>
      <div class="kpis in d3">${kpi(`${l.summary.rain_mean}`, L("ملم مطر أكتوبر–ماي", "mm rain Oct–May"), L("المتوسط على 30 موسمًا", "30-season average"))}${kpi(`+${Math.round(tr.et0.per_decade)}`, L("ملم ET0 / عقد", "mm ET0 / decade"), sig(tr.et0.p))}${kpi(`+${Math.round(tr.onset.per_decade)}`, L("يوم تأخر مطر البذر / عقد", "days later sowing rain / decade"), sig(tr.onset.p))}${kpi(`+${tr.tmean.per_decade}°`, L("حرارة / عقد", "temperature / decade"), sig(tr.tmean.p))}${kpi(`${so.paw100}`, L("ملم ماء متاح في التربة", "mm plant-available water"), L("أول متر · SoilGrids", "top metre · SoilGrids"))}${kpi(`${l.slope}%`, L("انحدار الحقل", "field slope"), "NASADEM")}</div>
      <div class="panel2 chart in d3"><b>${L("مطر كل موسم (أكتوبر–ماي)", "Rain each season (Oct–May)")}</b><div class="legend2"><span><i style="background:#9ca047"></i>${L("موسم", "Season")}</span><span><i style="background:#840000"></i>${L("أجف 3 مواسم", "3 driest seasons")}</span></div>${chartSeasons()}<div class="tipbox" aria-live="polite">${L("المس عمودًا لرؤية القيمة", "Touch a bar to see its value")}</div>
        <div class="note">${L(`التغير ${Math.round(tr.rain.per_decade)} ملم/عقد، لكنه غير دال إحصائيًا (p=${tr.rain.p}). السنوات تتقلّب كثيرًا.`, `Change ${Math.round(tr.rain.per_decade)} mm/decade, but not statistically significant (p=${tr.rain.p}). Years swing a lot.`)}</div></div>
      <div class="panel2 chart in d4"><b>${L("المطر مقابل حاجة التبخر (متوسط شهري)", "Rain vs evaporative demand (monthly average)")}</b><div class="legend2"><span><i style="background:#516d77"></i>${L("مطر", "Rain")}</span><span><i style="background:#840000"></i>ET0</span></div>${chartMonths()}<div class="tipbox">${L("المس شهرًا", "Touch a month")}</div>
        <div class="note">${L("عندما يتجاوز الخط الأحمر الأعمدة، يعتمد المحصول على ماء التربة المخزّن.", "When the red line rises above the bars, the crop relies on water stored in the soil.")}</div></div>
      <div class="panel2 chart in d4"><b>${L("أيام الحر فوق 31° (متوسط شهري)", "Days above 31°C (monthly average)")}</b>${chartHot()}<div class="tipbox">${L("المس شهرًا", "Touch a month")}</div>
        <div class="note">${L(`أفريل+ماي: ${tr.hot_flowering.early} ← ${tr.hot_flowering.late} يوم بين 1995–2004 و2015–2024.`, `April+May: ${tr.hot_flowering.early} → ${tr.hot_flowering.late} days between 1995–2004 and 2015–2024.`)} ${sig(tr.hot_flowering.p)}</div></div>
      <div class="panel2 in d5"><b>${L("الاتجاهات: 1995–2004 مقابل 2015–2024", "Trends: 1995–2004 vs 2015–2024")}</b>
        <div class="trtab">${TR.map(([k, nm, u]) => { const t = tr[k]; return `<div class="trrow"><span class="trn">${nm}<small>${u}</small></span><span dir="ltr" class="trv">${f1(t.early)} → <b>${f1(t.late)}</b></span>${sig(t.p)}</div>`; }).join("")}</div>
        <div class="note">${L("اتجاه Theil–Sen واختبار Mann–Kendall على 30 موسمًا. \"دال\" = p<0.05.", "Theil–Sen slope and Mann–Kendall test over 30 seasons. \"Significant\" = p<0.05.")}</div></div>
      <div class="panel2 in d5"><b>${L("تربتك (SoilGrids)", "Your soil (SoilGrids)")}</b>
        <div class="texbar"><i style="width:${so.clay}%;background:#840000">${L("طين", "Clay")} ${so.clay}%</i><i style="width:${so.silt}%;background:#C9A15C">${L("طمي", "Silt")} ${so.silt}%</i><i style="width:${so.sand}%;background:#e8e8bc;color:#2b2a20">${L("رمل", "Sand")} ${so.sand}%</i></div>
        <div class="facts" style="margin-top:8px"><div class="fact">${L("القوام", "Texture")}<b>${so.texture}</b></div><div class="fact">pH<b>${so.ph}</b></div><div class="fact">${L("الكربون العضوي", "Organic carbon")}<b>${so.soc} g/kg</b></div><div class="fact">CEC<b>${so.cec} cmol/kg</b></div></div>
        <div class="note">${L("قيم تقديرية لخلية 250 م، وليست تحليلًا لحقلك. الملوحة غير متوفرة في بياناتنا.", "Estimates for a 250 m cell, not a test of your field. Salinity is not in our data.")}</div></div>
      <div class="panel2 in d5"><b>${L("مؤشر FAO GAEZ v4", "FAO GAEZ v4 benchmark")}</b><p style="margin:4px 0 0;font-size:13.5px;line-height:1.6">${L(`المردود الممكن للقمح المطري (مدخلات عالية): حوالي ${l.gaez_wheat} كغ/هكتار في هذه الخلية.`, `Attainable rainfed wheat yield (high inputs): about ${l.gaez_wheat} kg/ha in this cell.`)}</p></div>
      <button class="primary" data-act="go" data-to="map">${L("جاهز؟ ابدأ اللعبة", "Ready? Start the game")} ${A.fwd()}</button>
    </div>`;
  };
  // tooltips for every chart
  const tipShow = (e) => { const t = e.target.closest && e.target.closest("[data-tip]"); if (!t) return; const box = t.closest(".chart").querySelector(".tipbox"); box.textContent = t.dataset.tip; box.classList.add("on");
    t.closest("svg").querySelectorAll(".hot").forEach((x) => x.classList.remove("hot")); t.classList.add("hot"); };
  document.addEventListener("pointerover", tipShow); document.addEventListener("click", tipShow);

  // ---------------------------------------------------------------- CROP CHARACTERISTICS
  let CF = { fam: "all", cmp: [] };
  A.SCREENS.crops = () => {
    const fam = (k) => E.CROPS[CK[k]].family;
    const list = CROPS.filter((k) => CF.fam === "all" || fam(k) === CF.fam);
    const cmp = CF.on && CF.cmp.length === 2 ? (() => { const [a, b] = CF.cmp, ca = E.CROPS[CK[a]], cb = E.CROPS[CK[b]], sa = cropStats(a), sb = cropStats(b);
      const row = (t, x, y, better) => `<tr><th>${t}</th><td class="${better === 0 ? "win" : ""}">${x}</td><td class="${better === 1 ? "win" : ""}">${y}</td></tr>`;
      return `<div class="panel2 pop"><b>${L("مقارنة", "Comparison")}</b><table class="cmpt"><tr><th></th><th>${cname(a)}</th><th>${cname(b)}</th></tr>
        ${row(L("الماء الكافي", "Water met"), pct(sa.ws), pct(sb.ws), sa.ws > sb.ws ? 0 : 1)}
        ${row(L("في سنوات الجفاف", "In dry years"), pct(sa.dry), pct(sb.dry), sa.dry > sb.dry ? 0 : 1)}
        ${row(L("حاجة الماء", "Water need"), demandMm(a) + " " + L("ملم", "mm"), demandMm(b) + " " + L("ملم", "mm"), demandMm(a) < demandMm(b) ? 0 : 1)}
        ${row(L("عمق الجذور", "Root depth"), ca.root + " cm", cb.root + " cm", ca.root > cb.root ? 0 : 1)}
        ${row("Ky", ca.ky, cb.ky, ca.ky < cb.ky ? 0 : 1)}
        ${row(L("تثبيت الآزوت", "N fixation"), ca.n ? "✓" : "—", cb.n ? "✓" : "—", ca.n > cb.n ? 0 : cb.n > ca.n ? 1 : -1)}</table>
        <div class="note">${L("الخلية المظللة = الأفضل في هذا المعيار.", "Shaded cell = better on that criterion.")}</div></div>`; })() : "";
    return `<div class="gscreen">
      <div class="ghead in">${A.backBtn("hub").replace('class="back"', 'class="iconbtn"')}<h1><small>${esc(A.placeName())}</small>${L("خصائص المحاصيل", "Crop characteristics")}</h1></div>
      <div class="dock in d1"><div class="who">${salahM(80, "happy")}</div><div class="say tone-n">${L("افتح أي بطاقة لترى خصائصه العلمية. فعّل \"قارن\" واختر محصولين لتقارن بينهما.", "Open any card to see its scientific traits. Turn on \"Compare\" and pick two crops to put them side by side.")}</div></div>
      <div class="chiprow in d2">${[["all", L("الكل", "All")], ["cereal", L("حبوب", "Cereals")], ["legume", L("بقوليات", "Legumes")]].map((o) => `<button class="chip ${CF.fam === o[0] ? "on" : ""}" data-act="cf" data-v="${o[0]}">${o[1]}</button>`).join("")}<button class="chip ${CF.on ? "on" : ""}" data-act="cfc">${CF.on ? '<span class="ck"></span>' : ""}${L("قارن", "Compare")} ${CF.on ? CF.cmp.length + "/2" : ""}</button></div>
      ${cmp}
      <div class="cgrid stagger">${list.map((k) => `<button class="ccard tilt ${CF.on && CF.cmp.includes(k) ? "picked" : ""}" data-act="cropOpen" data-v="${k}"><div class="art">${cropArt(k)}</div><b>${cname(k)}</b><small>${fam(k) === "cereal" ? L("حبوب", "Cereal") : L("بقوليات", "Legume")}</small></button>`).join("")}</div>
      <button class="primary" data-act="go" data-to="map">${L("جرّبها في اللعبة", "Try them in the game")} ${A.fwd()}</button>
    </div>`;
  };
  A.ACT.cf = (d) => { CF.fam = d.v; CF.cmp = []; A.render(); };
  A.ACT.cfc = () => { CF.on = !CF.on; CF.cmp = []; A.render(); };
  A.ACT.cropOpen = (d) => {
    const k = d.v;
    if (CF.on) { const i = CF.cmp.indexOf(k); if (i >= 0) CF.cmp.splice(i, 1); else { if (CF.cmp.length === 2) CF.cmp.shift(); CF.cmp.push(k); } snd("tap"); return A.render(); }
    const ov = document.createElement("div"); ov.className = "riskov fade"; ov.innerHTML = LEVELS["2"].detail(k, lastCrop(), false); document.body.appendChild(ov); snd("tap");
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-r]")) ov.remove(); });
  };

  // 3D tilt on cards
  document.addEventListener("pointermove", (e) => { const c = e.target.closest && e.target.closest(".tilt"); document.querySelectorAll(".tilt.tilting").forEach((x) => { if (x !== c) { x.classList.remove("tilting"); x.style.transform = ""; } });
    if (!c || e.pointerType === "touch") return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.classList.add("tilting"); c.style.transform = `perspective(700px) rotateY(${(x * 12).toFixed(1)}deg) rotateX(${(-y * 10).toFixed(1)}deg) translateZ(6px)`; });


  // ---------------------------------------------------------------- the sunny 3D-farm look is for the game only
  // body.fs-game switches on game_theme.css while a game screen is showing; the rest of the app keeps its original style.
  const GAME_LOOK = /^(map|lvl|l\d+x|lvlResult|report)$/;
  const syncLook = () => {
    const isGame = GAME_LOOK.test(A.S.screen || "");
    document.body.classList.toggle("fs-game", isGame);
    syncAudio(A.S.screen);
  };
  const appEl = document.getElementById("app");
  if (appEl) new MutationObserver(syncLook).observe(appEl, { childList: true });
  syncLook();
  window.FS_GAME = { get LV() { return LV; }, LEVELS, ORDER, startLevel, finish, say, hint, axe, risk, snd, speak, suitability, lvlBadge, LVLNAME, seasonRun, mName, planCrop, demandMm, CK, playCalmMusic, stopCalmMusic, syncAudio, L, cname, lastCrop, loc, farmE, pname, cropStats, pct, salahM, G, QUIPS, esc };
  // migrate old saves that ended on the removed simulation
  if (["sim", "rotations"].includes(S().screen)) S().screen = "hub";

})();
