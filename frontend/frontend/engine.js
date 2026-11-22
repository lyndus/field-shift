/* Field Shift engine: monthly soil-water simulation on real NASA POWER seasons + transparent scoring.
   Month index 0..11 = Sep..Aug (farming season). All parameters are listed in CROPS / RULES with sources. */
(function () {
  "use strict";

  // Kc by month from emergence (FAO-56 Table 12, stage lengths adapted to the Algerian high plains);
  // ky = yield response to water (FAO-33 / FAO-66); heat/frost = relative sensitivity at flowering (expert rule).
  const CROPS = {
    wheat:        { sow: 2, kc: [.4, .7, 1.0, 1.15, 1.15, 1.15, .7, .3], flower: 5, root: 120, ky: 1.05, heat: 1.0, frost: .3, family: "cereal", n: 0, product: "grain", straw: .3, ops: 4, host: 0 },
    barley:       { sow: 2, kc: [.4, .7, 1.0, 1.15, 1.15, .9, .3], flower: 5, root: 110, ky: 1.0, heat: .6, frost: .3, family: "cereal", n: 0, product: "grain", straw: .45, ops: 4, host: 0 },
    oat_forage:   { sow: 2, kc: [.4, .75, 1.0, 1.1, 1.1, .8], flower: -1, root: 100, ky: 1.0, heat: .2, frost: .2, family: "cereal", n: 0, product: "forage", straw: 0, ops: 3, host: 0 },
    lentil:       { sow: 3, kc: [.4, .7, 1.0, 1.1, 1.1, .4], flower: 4, root: 70, ky: 1.15, heat: .9, frost: .3, family: "legume", n: 1.0, product: "grain", straw: .2, ops: 3, host: 1 },
    chickpea:     { sow: 5, kc: [.4, .8, 1.0, 1.0, .35], flower: 3, root: 90, ky: 1.0, heat: 1.0, frost: .2, family: "legume", n: .8, product: "grain", straw: .1, ops: 3, host: .3 },
    faba:         { sow: 2, kc: [.5, .7, 1.0, 1.15, 1.15, 1.1, .3], flower: 4, root: 80, ky: 1.15, heat: .8, frost: .6, family: "legume", n: 1.2, product: "grain", straw: .2, ops: 3, host: 1 },
    vetch:        { sow: 2, kc: [.4, .7, 1.0, 1.1, 1.1, .8], flower: -1, root: 80, ky: 1.1, heat: .2, frost: .3, family: "legume", n: 1.5, product: "forage", straw: 0, ops: 2, host: .5 },
    vetch_oat:    { sow: 2, kc: [.4, .7, 1.0, 1.1, 1.1, .8], flower: -1, root: 100, ky: 1.05, heat: .2, frost: .3, family: "mixed", n: .8, product: "forage", straw: 0, ops: 2, host: .25 },
    fallow_grazed:{ fallow: true, weeds: true, cover: .6, ke: .35, feed: .3, ops: .5, family: "none", n: .1 },
    fallow_clean: { fallow: true, cover: 1.0, ke: .5, feed: 0, ops: 2, family: "none", n: 0 },
  };

  const SALT = { wheat: [6, 7], barley: [8, 5], oat_forage: [5, 5], lentil: [1.5, 12], chickpea: [1.5, 12], faba: [1.6, 10], vetch: [3, 10], vetch_oat: [4, 8] };
  const RULES = {
    supp_irrigation_mm: 40,          // per month, at most 2 months (flowering and the month before)
    residue_cover: { kept: .3, grazed: .6, removed: 1.0 },
    residue_evap: { kept: .25, grazed: .4, removed: .5 },
    tew_mm: 25,                      // FAO-56 total evaporable water, clay-loam top layer: bare soil can only dry the top ~10 cm
    same_family_penalty: { cereal: .88, legume: .85, mixed: .94 },
    heat_per_day: .015, heat_cap: .35, frost_per_day: .03, frost_cap: .2,
  };

  function paw(soil, root) {                    // plant-available water reachable by roots (mm)
    const cap = soil.paw100;
    return Math.min(cap, cap * Math.min(root, 100) / 100 + (root > 100 ? cap * .1 : 0));
  }

  function slopeFactor(slope) { return Math.max(.3, Math.min(1.5, (slope || 3) / 5)); }

  // ------------------------------------------------------------------ simulate one strategy, one phase
  function simulate(loc, strat, farm, phase) {
    const seq = strat.seq, L = seq.length, nS = loc.rain.length;
    const cap = farm.paw100, sowShift = { early: -1, normal: 0, late: 1 }[strat.sowing || "normal"];
    let S = cap * .3, W = 0, prevFamily = null; const TEW = RULES.tew_mm;
    const seasons = [];
    for (let s = 0; s < nS; s++) {
      const key = seq[(s + phase) % L], c = CROPS[key];
      const onsetM = loc.onset[s] == null ? 4 : Math.floor(loc.onset[s] / 30.4);
      const rec = { s, crop: key, months: [], demand: 0, aet: 0, irr: 0, heavy: 0, exposed: 0, yieldIdx: 0, ws: null, heat: 0, frost: 0, rotPen: 1, delay: 0 };
      let start = -1, end = -1, kcs = [];
      if (!c.fallow) {
        const sow = Math.max(1, c.sow + sowShift);
        const emerge = c.sow <= 4 ? Math.max(sow, onsetM) : sow;   // autumn crops wait for the sowing rain
        rec.delay = emerge - sow;
        start = emerge; kcs = c.kc.slice(); end = start + kcs.length - 1;
      }
      const prevKey = s > 0 ? seasons[s - 1].crop : seq[(phase + L - 1) % L];
      const prevC = CROPS[prevKey];
      for (let m = 0; m < 12; m++) {
        const rain = loc.rain[s][m], et0 = loc.et0[s][m], heavy = loc.heavy[s][m];
        let kc = null, demand = 0, aet = 0, irr = 0, cover;
        if (!c.fallow && m >= start && m <= end) {
          const i = m - start;
          if (m <= 9) {                                // must finish by end of June
            kc = kcs[i]; demand = kc * et0;
            const reach = paw(farm, c.root);
            let avail = Math.min(S, reach) + rain;
            if (strat.irrigation && farm.water && c.flower >= 0 && (i === c.flower || i === c.flower - 1) && demand > avail) {
              irr = Math.min(RULES.supp_irrigation_mm, demand - avail); avail += irr;
            }
            aet = Math.min(demand, avail);
            W = Math.max(0, Math.min(TEW, W + rain - aet));
            cover = kc >= .7 ? .1 : .5;
          }
        }
        if (kc === null) {
          let ke, cv;
          if (c.fallow) { ke = c.ke; cv = c.cover; }
          else {
            const before = m < start;                  // before sowing: residue of last season's crop
            const res = (before && prevC.fallow) ? null : strat.residue || "grazed";
            ke = res ? RULES.residue_evap[res] : prevC.ke; cv = res ? RULES.residue_cover[res] : prevC.cover;
            if (!before && m > 9 && c.product === "forage") cv = Math.min(cv + .2, 1);  // forage cut: less residue
          }
          if (c.weeds) {                             // weedy fallow: weeds transpire from depth
            aet = Math.min(S + rain, ke * et0); W = Math.max(0, Math.min(TEW, W + rain - aet));
          } else {                                   // bare or mulched soil: only the top layer evaporates
            W = Math.min(TEW, W + rain, S + rain); aet = Math.min(ke * et0, W); W -= aet;
          }
          cover = cv;
        }
        S = Math.max(0, Math.min(cap, S + rain + irr - aet));
        rec.demand += demand; rec.aet += kc !== null ? aet : 0; rec.irr += irr;
        rec.heavy += heavy; rec.exposed += heavy * cover;
        rec.months.push({ m, kc, demand, aet, S, cover, rain, heavy, et0, hot: loc.hot[s][m], frost: loc.frost[s][m], irr,
          green: kc !== null ? Math.min(1, kc / 1.15) * (demand ? Math.min(1, aet / demand) : 1) : (c.weeds ? .25 : 0) });
      }
      if (!c.fallow) {
        // months lost to late sowing count as unmet demand
        const lost = Math.max(0, end - 9);
        let lostDemand = 0;
        for (let k = 0; k < lost; k++) lostDemand += kcs[kcs.length - 1 - k] * loc.et0[s][Math.min(11, 9 + 1 + k)];
        rec.ws = (rec.aet) / (rec.demand + lostDemand || 1);
        if (c.flower >= 0) {
          const fm = start + c.flower;
          if (fm <= 9) {
            const hd = loc.hot[s][fm] + .5 * (fm + 1 <= 9 ? loc.hot[s][fm + 1] : 0);
            rec.heat = Math.min(RULES.heat_cap, hd * RULES.heat_per_day * c.heat);
            rec.frost = Math.min(RULES.frost_cap, loc.frost[s][fm] * RULES.frost_per_day * c.frost);
            rec.flowerMonth = fm;
          }
        }
        if (prevC.family === c.family && RULES.same_family_penalty[c.family]) rec.rotPen = RULES.same_family_penalty[c.family];
        rec.salt = 0;
        if (farm.ec && SALT[key]) rec.salt = Math.min(.9, Math.max(0, farm.ec - SALT[key][0]) * SALT[key][1] / 100);
        rec.yieldIdx = Math.max(0, Math.min(1, 1 - c.ky * (1 - rec.ws))) * (1 - rec.heat - rec.frost) * rec.rotPen * (1 - rec.salt);
      }
      rec.sameFamily = !c.fallow && prevC.family === c.family;
      prevFamily = c.family;
      seasons.push(rec);
    }
    return seasons;
  }

  // ------------------------------------------------------------------ metrics over all phases
  function evaluate(loc, strat, farm) {
    const L = strat.seq.length, dry = loc.summary.driest;
    const acc = { ws: [], wsDry: [], yDry: [], prod: [], heatRisk: [], heavy: 0, exposed: 0, n: 0, feed: 0, ops: 0, irr: 0, same: 0, host: 0, crops: 0, seasons: 0, cerealSeasons: 0, perSeason: [] };
    const runs = [];
    for (let ph = 0; ph < L; ph++) {
      const sim = simulate(loc, strat, farm, ph); runs.push(sim);
      sim.forEach((r, s) => {
        const c = CROPS[r.crop];
        acc.seasons++; acc.heavy += r.heavy; acc.exposed += r.exposed; acc.irr += r.irr; acc.ops += c.ops + (r.irr > 0 ? 1 : 0);
        acc.n += c.n || 0;
        if (c.fallow) { acc.feed += c.feed; acc.prod.push(0); return; }
        acc.crops++; acc.ws.push(r.ws);
        if (dry.includes(s)) { acc.wsDry.push(r.ws); acc.yDry.push(r.yieldIdx); }
        acc.prod.push(r.yieldIdx * (c.product === "forage" ? .8 : 1));
        if (c.product === "grain") acc.heatRisk.push(r.heat > .1 ? 1 : 0);
        acc.feed += c.product === "forage" ? r.yieldIdx : c.straw * ((strat.residue || "grazed") === "grazed" ? 1 : .5);
        if (r.sameFamily) acc.same++;
        acc.host += c.host; if (c.family === "cereal") acc.cerealSeasons++;
      });
    }
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const m = {
      waterSat: mean(acc.ws), waterSatDry: mean(acc.wsDry), yieldDry: mean(acc.yDry), prod: mean(acc.prod),
      heatRisk: acc.heatRisk.length ? mean(acc.heatRisk) : 0, exposedShare: acc.heavy ? acc.exposed / acc.heavy : 0,
      exposedMm: acc.exposed / acc.seasons, nPerYear: acc.n / acc.seasons, feedPerYear: acc.feed / acc.seasons,
      opsPerYear: acc.ops / acc.seasons, irrPerYear: acc.irr / acc.seasons, sameShare: acc.crops ? acc.same / acc.seasons : 0,
      hostShare: acc.host / acc.seasons, cerealShare: acc.cerealSeasons / acc.seasons, cropShare: acc.crops / acc.seasons,
      cleanFallowShare: strat.seq.filter(k => k === "fallow_clean").length / L,
      livingShare: strat.seq.filter(k => ["legume", "mixed"].includes(CROPS[k].family) || CROPS[k].product === "forage").length / L,
    };
    // per-season mean yield index across phases (for the timeline)
    m.seasonYield = loc.rain.map((_, s) => mean(runs.map(r => r[s]).filter(r => !CROPS[r.crop].fallow).map(r => r.yieldIdx)));
    m.seasonWater = loc.rain.map((_, s) => mean(runs.map(r => r[s]).filter(r => !CROPS[r.crop].fallow).map(r => r.ws)));
    return { m, scores: score(m, strat, farm), runs };
  }

  const clamp = v => Math.round(Math.max(0, Math.min(100, v)));

  function score(m, strat, farm) {
    const sf = slopeFactor(farm.slope);
    const erosion = clamp(100 - 100 * m.exposedShare * sf);
    const fert = clamp(100 * m.nPerYear / .6);
    const organic = { kept: 85, grazed: 55, removed: 25 }[strat.residue || "grazed"] + 15 * m.livingShare - 25 * m.cleanFallowShare;
    return {
      water: clamp(100 * m.waterSat - m.irrPerYear / 3),
      drought: clamp(100 * m.yieldDry / .8),
      heat: clamp(100 * (1 - m.heatRisk)),
      erosion,
      fertilizer: fert,
      soil: clamp((erosion + fert + clamp(organic)) / 3),
      production: clamp(100 * m.prod / .8),
      feed: clamp(100 * m.feedPerYear / .8),
      pest: clamp(100 - 45 * m.sameShare - 60 * Math.max(0, m.hostShare - .34) - (m.cerealShare > .74 ? 15 : 0)),
      workload: clamp(100 - 12 * m.opsPerYear),
    };
  }

  const PRIORITIES = ["water", "soil", "erosion", "fertilizer", "production", "feed", "drought", "heat", "pest", "workload"];
  const WEIGHTS = { 1: [1], 2: [.6, .4], 3: [.5, .3, .2] };
  function total(scores, prios) {
    if (!prios.length) return Math.round(PRIORITIES.reduce((a, k) => a + scores[k], 0) / PRIORITIES.length);
    const w = WEIGHTS[prios.length];
    return Math.round(prios.reduce((a, k, i) => a + w[i] * scores[k], 0));
  }

  window.FSEngine = { SALT, CROPS, RULES, PRIORITIES, WEIGHTS, simulate, evaluate, total, slopeFactor, paw };
})();
