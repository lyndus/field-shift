/* Field Shift – NASA report, farmer-friendly.
   Tab 1 "Your land in simple words": the same NASA numbers turned into 6 plain cards with a traffic light.
   Tab 2 "Compare 3 rotations": the farmer builds 3 three-year rotations; FSEngine runs each one on the farm's
   real NASA seasons, scores it against the farmer's own priorities, and we say which is best and why.
   Tab 3 "Detailed data": the original report, unchanged except for a summary sentence computed from this farm. */
(function () {
  "use strict";
  const A = window.FS_APP, E = window.FSEngine; if (!A || !E || !A.SCREENS.nasa) return;
  const S = () => A.S, esc = A.esc, GM = () => window.FS_GAME || {};
  const L = (ar, en) => (S().lang === "en" ? en : ar);
  const ORIG = A.SCREENS.nasa;
  const OPTS = ["wheat", "barley", "oat", "lentil", "chickpea", "faba", "vetch", "fallow"];
  const ICON = { wheat: "🌾", barley: "🌾", oat: "🌿", lentil: "🫘", chickpea: "🫘", faba: "🫛", vetch: "☘️", fallow: "🟫" };
  const cname = (k) => (k === "fallow" ? L("بور (راحة)", "Fallow (rest)") : GM().cname ? GM().cname(k) : k);
  const sig = (t) => !!t && (t.significant != null ? t.significant : t.p < 0.05);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const R = (x) => Math.round(x);

  // ---------------------------------------------------------------- tab 1: plain-language cards
  function dateAfterSep1(days) {
    const d = new Date(Date.UTC(2001, 8, 1) + Math.round(days) * 864e5), m = d.getUTCMonth();
    const MO = L(["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليو", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"], ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    return `${d.getUTCDate()} ${MO[m]}`;
  }
  const trendTxt = (t, upBad, unit) => {
    if (!t) return "";
    if (!sig(t)) return L("لا تغيّر واضح خلال 30 سنة.", "No clear change over 30 years.");
    const up = t.per_decade > 0, bad = up === upBad;
    return `${bad ? "⚠️" : "✅"} ${L(`${up ? "يزداد" : "يتناقص"} بحوالي ${Math.abs(t.per_decade)} ${unit} كل 10 سنوات (تغيّر مؤكد).`, `${up ? "Rising" : "Falling"} by about ${Math.abs(t.per_decade)} ${unit} every 10 years (a confirmed change).`)}`;
  };
  function simpleCards(l) {
    const tr = l.trends || {}, n = l.rain.length;
    const om = l.summary.rain_oct_may, rainMean = l.summary.rain_mean;
    const sorted = om.slice().sort((a, b) => a - b), dry3 = sorted[2];
    const annP = mean(l.rain.map((r) => r.reduce((a, b) => a + b, 0))), annE = mean(l.et0.map((r) => r.reduce((a, b) => a + b, 0)));
    const ai = annE ? annP / annE : 0;
    const aiCls = ai < 0.05 ? [L("شديد الجفاف", "hyper-arid"), "red"] : ai < 0.2 ? [L("جاف", "arid"), "red"] : ai < 0.5 ? [L("شبه جاف", "semi-arid"), "amber"] : ai < 0.65 ? [L("شبه رطب جاف", "dry sub-humid"), "green"] : [L("رطب", "humid"), "green"];
    const etOM = mean(l.et0.map((r) => r.slice(1, 9).reduce((a, b) => a + b, 0)));
    const cover = etOM ? rainMean / etOM : 0;
    const onsetLate = tr.onset && tr.onset.late != null ? tr.onset.late : mean(l.onset.filter((x) => x != null).slice(-10));
    const hot = tr.hot_flowering ? tr.hot_flowering.late : mean(l.hot.map((r) => r[7] + r[8]));
    const frost = tr.frost ? tr.frost.late : mean(l.frost.map((r) => r.reduce((a, b) => a + b, 0)));
    const so = l.soil || {}, paw = so.paw100;
    const card = (light, icon, title, big, text, sub) => `<div class="sv-card ${light}"><div class="sv-top"><span class="sv-ico">${icon}</span><b>${title}</b><span class="sv-dot" aria-label="${light}"></span></div><div class="sv-big">${big}</div><p>${text}</p>${sub ? `<small>${sub}</small>` : ""}</div>`;
    return [
      card(aiCls[1], "🌍", L("مناخ أرضك", "Your climate"), aiCls[0],
        L(`في السنة يسقط ~${R(annP)} ملم من المطر، بينما يستطيع الجو أن يبخّر ~${R(annE)} ملم.`, `In a year ~${R(annP)} mm of rain falls, while the air could evaporate ~${R(annE)} mm.`),
        L(`مؤشر الجفاف ${ai.toFixed(2)} (تصنيف برنامج الأمم المتحدة للبيئة)`, `Aridity index ${ai.toFixed(2)} (UNEP classes)`)),
      card(rainMean < 250 ? "red" : rainMean < 400 ? "amber" : "green", "🌧️", L("المطر في موسم الزرع", "Rain in the growing season"), `${rainMean} ${L("ملم", "mm")}`,
        L(`هذا متوسط أكتوبر–ماي. في 3 مواسم من ${n} نزل أقل من ${R(dry3)} ملم: خطّط لسنة جافة من كل 10.`, `That's the Oct–May average. In 3 of ${n} seasons less than ${R(dry3)} mm fell: plan for 1 dry year in 10.`), trendTxt(tr.rain, false, L("ملم", "mm"))),
      card(cover < 0.5 ? "red" : cover < 0.8 ? "amber" : "green", "☀️", L("عطش الجو", "How thirsty the air is"), `${R(cover * 100)}%`,
        L(`المطر يغطي ${R(cover * 100)}% فقط مما يطلبه الجو من أكتوبر إلى ماي (${R(etOM)} ملم). الباقي يجب أن تخزّنه التربة.`, `Rain covers only ${R(cover * 100)}% of what the air demands from Oct to May (${R(etOM)} mm). The soil has to store the rest.`), trendTxt(tr.et0, true, L("ملم", "mm"))),
      card(onsetLate > 75 ? "red" : onsetLate > 45 ? "amber" : "green", "📅", L("متى يأتي مطر البذر", "When the sowing rain comes"), isFinite(onsetLate) ? dateAfterSep1(onsetLate) : "—",
        L("أول يوم يصل فيه مطر 3 أيام إلى 20 ملم (متوسط آخر 10 مواسم). لا تبذر قبله.", "First day that 3 days of rain reach 20 mm (average of the last 10 seasons). Don't sow before it."), trendTxt(tr.onset, true, L("يوم", "days"))),
      card(hot > 6 ? "red" : hot > 2 ? "amber" : "green", "🔥", L("الحر وقت الإزهار", "Heat at flowering"), `${hot.toFixed(1)} ${L("يوم", "days")}`,
        L("عدد الأيام فوق 31°م في أبريل–ماي، حين يزهر القمح. فوق هذه الحرارة تقل الحبوب.", "Days above 31 °C in April–May, when wheat flowers. Above that heat, fewer grains set."), trendTxt(tr.hot_flowering, true, L("يوم", "days"))),
      card(paw == null ? "amber" : paw < 80 ? "red" : paw < 140 ? "amber" : "green", "🟫", L("مخزن الماء في التربة", "Your soil's water store"), paw != null ? `${R(paw)} ${L("ملم", "mm")}` : L("غير معروف", "unknown"),
        paw != null ? L(`المتر الأول من تربتك (${esc(so.texture || "")}) يخزّن ~${R(paw)} ملم يستطيع النبات شربها${so.estimated ? " (قيمة تقديرية)" : ""}.`, `The top metre of your soil (${esc(so.texture || "")}) stores ~${R(paw)} mm the plant can drink${so.estimated ? " (estimated value)" : ""}.`) : L("لا توجد بيانات تربة لهذه النقطة.", "No soil data for this point."),
        L(`الصقيع: ~${frost.toFixed(1)} يوم تحت 0°م في الموسم.`, `Frost: ~${frost.toFixed(1)} days below 0 °C per season.`)),
    ].join("");
  }
  function summarySentence(l) {
    const tr = l.trends || {}, bits = [];
    const dry = (l.summary.driest || []).map((i) => (window.FS_DATA.seasons || [])[i]).filter(Boolean);
    if (dry.length) bits.push(L(`أجفّ المواسم كانت ${dry.join("، ")}`, `the driest seasons were ${dry.join(", ")}`));
    if (sig(tr.onset) && tr.onset.per_decade > 0) bits.push(L("مطر البذر صار يتأخر", "the sowing rain now comes later"));
    if (sig(tr.et0) && tr.et0.per_decade > 0) bits.push(L("الجو صار أعطش", "the air is getting thirstier"));
    if (sig(tr.hot_flowering) && tr.hot_flowering.per_decade > 0) bits.push(L("أيام الحر وقت الإزهار تزداد", "hot days at flowering are increasing"));
    if (sig(tr.rain)) bits.push(tr.rain.per_decade < 0 ? L("المطر يتناقص", "rain is decreasing") : L("المطر يزداد", "rain is increasing"));
    return L(`باختصار يا ${esc(S().name || "")}: ${bits.join("، ")}. هذا ما ستواجهه في اللعبة.`, `In short, ${esc(S().name || "")}: ${bits.join("; ")}. That's what you'll face in the game.`);
  }

  // ---------------------------------------------------------------- tab 2: compare 3 rotations
  const DEF = [["wheat", "wheat", "wheat"], ["wheat", "lentil", "barley"], ["faba", "wheat", "fallow"]];
  const LABEL = () => ({ water: L("الماء", "Water"), drought: L("السنوات الجافة", "Dry years"), production: L("المحصول", "Harvest"), soil: L("صحة التربة", "Soil health"), pest: L("الآفات والأمراض", "Pests & disease"),
    heat: L("الحر", "Heat"), erosion: L("الانجراف", "Erosion"), fertilizer: L("الآزوت", "Nitrogen"), feed: L("العلف", "Animal feed"), workload: L("قلة العمل", "Less work") });
  const SHOW = ["production", "drought", "water", "soil", "pest"];
  function prios() { return [...new Set((S().farm && S().farm.prios || []).map((p) => (A.PK && A.PK[p]) || (E.PRIORITIES.includes(p) ? p : null)).filter(Boolean))].slice(0, 3); }
  function rots() { const s = S(); if (!s.rep3 || s.rep3.length !== 3) s.rep3 = DEF.map((r) => r.slice()); return s.rep3; }
  function evalRot(seq) {
    const fm = GM().farmE ? GM().farmE() : { paw100: 140, slope: 3.5, water: false };
    const ev = E.evaluate(A.loc(), { seq: seq.map((k) => A.CK[k] || "fallow_grazed"), sowing: "normal", residue: "grazed", irrigation: fm.water }, fm);
    const tot = E.total(ev.scores, prios());
    return { scores: ev.scores, total: tot, out10: Math.round(tot) / 10, yieldDry: ev.m.yieldDry, prod: ev.m.prod };
  }
  function rotCard(i, res, best) {
    const r = rots()[i], open = S().rotEdit && S().rotEdit[0] === i ? S().rotEdit[1] : -1, LB = LABEL();
    const slots = r.map((k, y) => `<button class="rs-slot ${open === y ? "on" : ""}" data-act="rotSlot" data-r="${i}" data-y="${y}"><small>${L("السنة", "Year")} ${y + 1}</small><span>${ICON[k] || "🌱"}</span><b>${cname(k)}</b></button>`).join(`<span class="rs-arrow">${S().lang === "en" ? "→" : "←"}</span>`);
    const pick = open >= 0 ? `<div class="rs-pick">${OPTS.map((k) => `<button class="rs-opt ${r[open] === k ? "on" : ""}" data-act="rotSet" data-r="${i}" data-y="${open}" data-k="${k}">${ICON[k]} ${cname(k)}</button>`).join("")}</div>` : "";
    const bars = res ? `<div class="rs-bars">${SHOW.map((k) => `<div class="rs-bar"><span>${LB[k]}</span><i><em style="width:${res.scores[k]}%"></em></i><b>${R(res.scores[k] / 10)}</b></div>`).join("")}</div>` : "";
    return `<div class="rs-card ${best ? "best" : ""}">
      <div class="rs-head"><b>${L("الدورة", "Rotation")} ${"ABC"[i]}</b>${res ? `<span class="rs-score"><b>${res.out10.toFixed(1)}</b>/10</span>` : ""}${best ? `<span class="rs-crown">👑 ${L("الأفضل لأرضك", "Best for your land")}</span>` : ""}</div>
      <div class="rs-slots">${slots}</div>${pick}${bars}</div>`;
  }
  function why(results) {
    const order = results.map((r, i) => [r, i]).sort((a, b) => b[0].total - a[0].total), [b, bi] = order[0], [s2, si] = order[1], LB = LABEL();
    if (b.total === s2.total) return L(`الدورتان ${"ABC"[bi]} و${"ABC"[si]} متساويتان على أرضك؛ اختر حسب السوق أو العمل.`, `Rotations ${"ABC"[bi]} and ${"ABC"[si]} score the same on your land; choose by market or workload.`);
    const diffs = Object.keys(b.scores).map((k) => [k, b.scores[k] - s2.scores[k]]).filter((d) => d[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 2);
    const weak = Object.keys(b.scores).filter((k) => SHOW.includes(k)).sort((x, y) => b.scores[x] - b.scores[y])[0];
    const seq = rots()[bi].map(cname).join(" → ");
    return L(`👑 <b>الدورة ${"ABC"[bi]} (${seq})</b> هي الأفضل لأرضك بـ <b>${b.out10.toFixed(1)}/10</b>. تتفوّق على ${"ABC"[si]} في: ${diffs.map(([k, d]) => `${LB[k]} (+${R(d / 10)})`).join("، ") || "عدة نقاط صغيرة"}. نقطة ضعفها: ${LB[weak]} (${R(b.scores[weak] / 10)}/10)، فانتبه لها.`,
      `👑 <b>Rotation ${"ABC"[bi]} (${seq})</b> is the best for your land with <b>${b.out10.toFixed(1)}/10</b>. It beats ${"ABC"[si]} on: ${diffs.map(([k, d]) => `${LB[k]} (+${R(d / 10)})`).join(", ") || "several small points"}. Its weak point: ${LB[weak]} (${R(b.scores[weak] / 10)}/10), so watch it.`);
  }
  function rotTab() {
    const res = S().rotResLoc === S().locId ? S().rotRes : null, bi = res ? res.indexOf(res.reduce((a, b) => (b.total > a.total ? b : a))) : -1, LB = LABEL(), pr = prios();
    return `<div class="rs-intro">${L("ابنِ 3 دورات زراعية لثلاث سنوات (المس أي سنة لتغيير المحصول)، ثم نجرّب كل واحدة على مواسم ناسا الحقيقية لأرضك ونخبرك بالأفضل.", "Build 3 three-year rotations (tap any year to change the crop). We then run each one on your land's real NASA seasons and tell you which is best.")}</div>
      ${[0, 1, 2].map((i) => rotCard(i, res && res[i], i === bi)).join("")}
      <button class="primary" data-act="rotCompare">⚖️ ${L("قارن الدورات الثلاث", "Compare my 3 rotations")}</button>
      ${res ? `<div class="rs-why">${why(res)}</div>` : ""}
      <div class="rs-note">${L(`التقييم: محاكاة شهرية للماء والحرارة والدورة على ${A.loc().rain.length} موسمًا حقيقيًا، موزونة بأولوياتك (${pr.length ? pr.map((k) => LB[k]).join("، ") : "كل المعايير بالتساوي"}). هو ترتيب للمقارنة وليس وعدًا بمردود.`, `Score: a monthly simulation of water, heat and rotation on ${A.loc().rain.length} real seasons, weighted by your priorities (${pr.length ? pr.map((k) => LB[k]).join(", ") : "all criteria equally"}). It's a ranking to compare, not a yield promise.`)}</div>`;
  }

  // ---------------------------------------------------------------- the screen
  A.SCREENS.nasa = () => {
    const full = ORIG(), l = A.loc(), tab = S().repTab || "simple";
    const cut = full.indexOf("</h1></div>") + "</h1></div>".length;
    let head = full.slice(0, cut), rest = full.slice(cut);
    const ban = rest.match(/^\s*<div class="envbadge[^"]*"[^>]*>[\s\S]*?<\/div>/);
    if (ban) { head += ban[0]; rest = rest.slice(ban[0].length); }
    rest = rest.replace(/(<div class="say[^"]*">)[\s\S]*?(<\/div>)/, `$1${summarySentence(l)}$2`).replace(/<\/div>\s*$/, "");
    const tabs = [["simple", L("🙂 بكلمات بسيطة", "🙂 In simple words")], ["rot", L("⚖️ قارن 3 دورات", "⚖️ Compare 3 rotations")], ["detail", L("📊 البيانات المفصلة", "📊 Detailed data")]];
    const body = tab === "simple" ? `<div class="sv-say">${summarySentence(l)}</div><div class="sv-grid">${simpleCards(l)}</div>
        <button class="primary" data-act="repTab" data-t="rot">⚖️ ${L("الآن قارن 3 دورات لأرضك", "Now compare 3 rotations for your land")}</button>`
      : tab === "rot" ? rotTab() : rest;
    return `${head}<div class="rep-tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" aria-selected="${k === tab}" class="rep-tab ${k === tab ? "on" : ""}" data-act="repTab" data-t="${k}">${t}</button>`).join("")}</div><div class="rep-body">${body}</div></div>`;
  };
  const rerender = () => { const y = (document.querySelector(".rep-body") || {}).scrollTop || 0; A.render(); const b = document.querySelector(".rep-body"); if (b) b.scrollTop = y; };
  A.ACT.repTab = (d) => { S().repTab = d.t; A.save(); A.render(); };
  A.ACT.rotSlot = (d) => { const e = S().rotEdit, r = +d.r, y = +d.y; S().rotEdit = e && e[0] === r && e[1] === y ? null : [r, y]; rerender(); };
  A.ACT.rotSet = (d) => { rots()[+d.r][+d.y] = d.k; S().rotEdit = null; S().rotRes = null; A.save(); rerender(); };
  A.ACT.rotCompare = () => {
    try { S().rotRes = rots().map(evalRot); S().rotResLoc = S().locId; } catch (e) { S().rotRes = null; alert(L("تعذّر الحساب: اختر موقع أرضك أولًا.", "Couldn't compute: choose your land's location first.")); }
    S().rotEdit = null; A.save(); rerender();
    setTimeout(() => { const w = document.querySelector(".rs-why"); w && w.scrollIntoView({ behavior: "smooth", block: "center" }); try { GM().snd && GM().snd("good"); } catch (e) { } }, 80);
  };
  window.FS_REPORT = { evalRot, rots, simpleCards };
})();
