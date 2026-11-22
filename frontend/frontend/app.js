/* Field Shift – farmer app (vanilla JS, no build step).
   Uses window.FSEngine (engine.js), window.FS_DATA (data/app_data.js), window.FS_TOWNS (towns.js), window.FS_ART (art.js). */
(function () {
  "use strict";
  const E = window.FSEngine, DATA = window.FS_DATA, TOWNS = window.FS_TOWNS, ART = window.FS_ART;
  const app = document.getElementById("app");

  // ------------------------------------------------------------------ text
  const TXT = {
    ar: {
      dir: "rtl", start: "ابدأ", back: "رجوع", next: "التالي", cont: "متابعة",
      langQ: "بأي لغة تفضّل التحدث؟", pickLang: "اختر لغة", voice: "يمكنك أيضًا التحدث مع عمّي صالح", arSub: "Arabic", enSub: "الإنجليزية",
      whereQ: "أين تقع أرضك؟", allow: "السماح بتحديد الموقع", manual: "إدخال الموقع يدويًا", locating: "جارٍ تحديد موقعك…",
      detectedLoc: "موقعك الحالي الحقيقي المكتشف", confirmLocBtn: "تأكيد الموقع والمتابعة", redetect: "إعادة التحديد", locatingGps: "جارٍ تحديد موقعك الحقيقي عبر GPS…",
      enterLoc: "أدخل موقع أرضك", enterLocTip: "اكتب اسم البلدية أو الولاية، أو حدّدها على الخريطة.", townLbl: "البلدية أو الولاية", townPh: "مثال: تيارت", or: "أو",
      onMap: "حدّدها على الخريطة", gps: "لديّ الإحداثيات (GPS)", lat: "خط العرض", lon: "خط الطول", confirm: "تأكيد", chooseFirst: "اختر موقعًا أولًا",
      noData: "لا توجد بيانات لهذه المنطقة بعد. يمكنك تجربة حقل كريم في سيدي بلعباس.", useDemo: "جرّب حقل كريم (سيدي بلعباس)", mapTap: "اضغط على الخريطة لتحديد أرضك",
      hello: "أهلاً، ", friend: "يا صديقي", nameQ: "ما اسمك؟", namePh: "اكتب اسمك هنا", pickAv: "اختر صورتك", typeName: "اكتب اسمك للمتابعة",
      av: { farmer: "فلاح بقبعة", woman: "فلاحة", young: "شاب", elder: "شيخ بعمامة", sheep: "خروف", wheat: "سنبلة" },
      aboutFarm: "أخبرنا عن مزرعتك", qOf: (a, b) => `سؤال ${a} من ${b}`, ha: "هكتار", answerFirst: "اختر إجابة للمتابعة", prioFirst: "اختر أولوية واحدة على الأقل",
      startSim: "ابدأ المحاكاة", chooseRots: "اختر الدورات للمقارنة", soon: "قريبًا", unknown: "لا أعرف", none: "لا شيء", moreSeason: "+ موسم آخر",
      whichCrop: "ما هو المحصول؟", chosen: (n) => `اخترت ${n} (الحد الأقصى 3)`, weight: "الوزن في التقييم", up: "إلى الأعلى", down: "إلى الأسفل",
      thinking: "أفكّر في: ", wantIdeas: "أريد اقتراحات", pastSeasons: "المواسم الماضية: ",
      Q: {
        area: ["ما مساحة حقلك؟", "تقدير تقريبي يكفي."],
        system: ["ما نظام الزراعة؟", "نصمّم النتائج حاليًا للحقل المفتوح.", [["open", "حقل مفتوح", ""], ["green", "بيت بلاستيكي", "", true]]],
        soil: ["ما نوع التربة؟", "إذا لم تكن متأكدًا، سنقدّرها من بيانات الأقمار الصناعية.", [["sandy", "رملية", "خفيفة، يتسرّب منها الماء بسرعة"], ["clay", "طينية", "ثقيلة، تحتفظ بالماء وتتشقّق عند الجفاف"], ["loam", "طميية", "متوسطة، سهلة الحرث"], ["unknown", "لا أعرف", "نستعمل تقدير SoilGrids"]]],
        irrig: ["كيف تسقي حقلك؟", "اختر الطريقة الرئيسية.", [["rain", "مطري (بدون ري)", "أعتمد على المطر فقط"], ["drip", "بالتنقيط", ""], ["sprinkler", "بالرش", ""], ["flood", "بالغمر", ""]]],
        water: ["ما مدى توفّر الماء لديك؟", "في السنة العادية.", [["low", "منخفض", "المطر فقط، أو ماء قليل لا يكفي للسقي"], ["medium", "متوسط", "يكفي لسقية أو سقيتين في الأوقات الحرجة (البذر، الإزهار)"], ["high", "مرتفع", "ماء كافٍ للسقي كلما احتاج المحصول (بئر، سد، قناة)"]]],
        history: ["ماذا زرعت في المواسم الماضية؟", "من 3 إلى 5 مواسم إن كنت تتذكّر."],
        current: ["ما المزروع الآن في الحقل؟", ""],
        intent: ["ماذا تريد؟", "", [["crop", "عندي محصول في ذهني", "نختبره على أرضك"], ["suggest", "أريد اقتراحات", "نقارن لك عدة دورات"]]],
        prios: ["ما أولوياتك؟", "اختر من 1 إلى 3 أولويات."],
        order: ["رتّب أولوياتك", "الأهم في الأعلى. استعمل الأسهم لتغيير الترتيب."],
      },
      crops: { wheat: "قمح", barley: "شعير", oat: "شوفان", lentil: "عدس", chickpea: "حمص", faba: "فول", vetch: "بيقية", fallow: "بور" },
      prio: { water: "توفير الماء", soil: "صحة التربة", erosion: "الحدّ من انجراف التربة", fert: "تقليل تكلفة الأسمدة", prod: "الإنتاجية", profit: "الربحية", feed: "علف الماشية", drought: "الصمود في سنوات الجفاف", heat: "مقاومة موجات الحر", pest: "آفات وأمراض أقل", work: "عمل ومدخلات أقل" },
      rotTitle: "اختر الدورات التي تريد مقارنتها", rotTip: "سنقارن دورتك الحالية مع دورتين من اختيارك على نفس الطقس الحقيقي.",
      rotNames: ["دورتك الحالية", "الدورة 2", "الدورة 3"], rotTags: ["من تاريخ حقلك", "من اختيارك", "من اختيارك"], season: "الموسم", quick: "أفكار سريعة", addSeason: "إضافة موسم",
      simTitle: (s) => `محاكاة موسم ${s}`, simSub: (p) => `طقس حقيقي من بيانات ناسا · ${p}`,
      kinds: { cur: "دورتك الحالية", idea: "فكرتك", sug: "اقتراح", r2: "الدورة 2", r3: "الدورة 3" },
      months: ["سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر", "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان"],
      monthsShort: ["سبت", "أكت", "نوف", "ديس", "جان", "فيف", "مار", "أفر", "ماي", "جوا"],
      rainMm: (v) => `مطر ${v} ملم`, hotDays: (v) => `${v} يوم حار`, soilWater: (v) => `ماء التربة ${v} ملم`,
      health: "حالة المحصول هذا الشهر (الماء الكافي)", nextMonth: "الشهر التالي", endSeason: "نهاية الموسم", auto: "تشغيل تلقائي", pause: "إيقاف",
      m: { wait: "الأرض تنتظر مطر البذر.", before: "الأرض تستقبل المطر قبل البذر.", ero: "مطر غزير على أرض مكشوفة: التربة تنجرف.", sow: "وقت البذر! النبتة الصغيرة تحتاج الماء.",
        heat: "حرارة شديدة أثناء الإزهار: الحبوب تتأثر.", good: "المحصول مرتاح، الماء كافٍ هذا الشهر.", warn: "المحصول يعاني قليلًا من نقص الماء.", bad: "عطش شديد: الماء في التربة نفد.",
        harvest: (p) => `الحصاد! المردود ${p}% من الممكن.`, after: "تم الحصاد. التبن يحمي التربة من الشمس.", fallow: "الأرض مستريحة هذا الموسم." },
      seasonOver: "انتهى الموسم!", seasonNote: (r, m) => `أمطار أكتوبر–ماي هذا الموسم: ${r} ملم (المتوسط ${m} ملم).`, harvestOf: (p) => `المحصول هذا الموسم: ${p} من الممكن`,
      scoreNote: "النقطة من 100 حسب أولوياتك، على 30 موسمًا من بيانات ناسا.", replay: "أعد الموسم", why: "لماذا هذه النتائج؟",
      whyTitle: "لماذا هذه النتائج؟", whyNote: "كل نقطة محسوبة على 30 موسمًا حقيقيًا (1995–2025) من بيانات ناسا لموقعك. هذه أداة لدعم القرار وليست توقعًا للمردود.", close: "إغلاق",
      askSalah: "اسأل عمّي صالح (قريبًا)", fallowName: "بور",
    },
    en: {
      dir: "ltr", start: "Start", back: "Back", next: "Next", cont: "Continue",
      langQ: "Which language do you prefer?", pickLang: "Pick a language", voice: "You can also talk to Ammi Salah", arSub: "Arabic", enSub: "English",
      whereQ: "Where is your land?", allow: "Allow location", manual: "Enter it manually", locating: "Finding your location…",
      detectedLoc: "Detected Real Location", confirmLocBtn: "Confirm Location & Continue", redetect: "Re-detect", locatingGps: "Detecting your real location via GPS…",
      enterLoc: "Enter your land's location", enterLocTip: "Type your town or wilaya, or pick it on the map.", townLbl: "Town or wilaya", townPh: "e.g. Tiaret", or: "or",
      onMap: "Pick it on the map", gps: "I have GPS coordinates", lat: "Latitude", lon: "Longitude", confirm: "Confirm", chooseFirst: "Choose a location first",
      noData: "No data for this area yet. You can try Karim's field in Sidi Bel Abbès.", useDemo: "Try Karim's field (Sidi Bel Abbès)", mapTap: "Tap the map to mark your land",
      hello: "Hello, ", friend: "my friend", nameQ: "What's your name?", namePh: "Type your name", pickAv: "Choose your picture", typeName: "Type your name to continue",
      av: { farmer: "Farmer in a hat", woman: "Woman farmer", young: "Young farmer", elder: "Elder in a turban", sheep: "Sheep", wheat: "Wheat ear" },
      aboutFarm: "Tell us about your farm", qOf: (a, b) => `Question ${a} of ${b}`, ha: "ha", answerFirst: "Choose an answer to continue", prioFirst: "Choose at least one priority",
      startSim: "Start the simulation", chooseRots: "Choose rotations to compare", soon: "Soon", unknown: "I don't know", none: "Nothing", moreSeason: "+ another season",
      whichCrop: "Which crop?", chosen: (n) => `You chose ${n} (max 3)`, weight: "Weight in the score", up: "Move up", down: "Move down",
      thinking: "Thinking of: ", wantIdeas: "I want suggestions", pastSeasons: "Past seasons: ",
      Q: {
        area: ["How big is your field?", "A rough estimate is fine."],
        system: ["What is your farming system?", "Results are designed for open fields for now.", [["open", "Open field", ""], ["green", "Greenhouse", "", true]]],
        soil: ["What is your soil type?", "Not sure? We'll estimate it from satellite data.", [["sandy", "Sandy", "Light, water drains fast"], ["clay", "Clay", "Heavy, holds water, cracks when dry"], ["loam", "Loamy", "Medium, easy to plough"], ["unknown", "I don't know", "We use the SoilGrids estimate"]]],
        irrig: ["How do you water your field?", "Choose the main method.", [["rain", "Rainfed (no irrigation)", "I rely on rain only"], ["drip", "Drip", ""], ["sprinkler", "Sprinkler", ""], ["flood", "Flood", ""]]],
        water: ["How much water do you have?", "In a normal year.", [["low", "Low", "Rain only, or too little water to irrigate"], ["medium", "Medium", "Enough for 1–2 waterings at critical times (sowing, flowering)"], ["high", "High", "Enough to water whenever the crop needs it (well, dam, canal)"]]],
        history: ["What did you grow in past seasons?", "3 to 5 seasons if you remember."],
        current: ["What is in the field now?", ""],
        intent: ["What do you want?", "", [["crop", "I have a crop in mind", "We test it on your land"], ["suggest", "I want suggestions", "We compare several rotations"]]],
        prios: ["What are your priorities?", "Choose 1 to 3."],
        order: ["Order your priorities", "Most important on top. Use the arrows."],
      },
      crops: { wheat: "Wheat", barley: "Barley", oat: "Oat", lentil: "Lentil", chickpea: "Chickpea", faba: "Faba bean", vetch: "Vetch", fallow: "Fallow" },
      prio: { water: "Save water", soil: "Soil health", erosion: "Less soil erosion", fert: "Lower fertilizer cost", prod: "Productivity", profit: "Profitability", feed: "Livestock feed", drought: "Survive drought years", heat: "Resist heat waves", pest: "Fewer pests & diseases", work: "Less work & inputs" },
      rotTitle: "Choose the rotations to compare", rotTip: "We'll compare your current rotation with two of your choice on the same real weather.",
      rotNames: ["Your current rotation", "Rotation 2", "Rotation 3"], rotTags: ["from your field history", "your choice", "your choice"], season: "Season", quick: "Quick ideas", addSeason: "Add a season",
      simTitle: (s) => `Season ${s} simulation`, simSub: (p) => `Real weather from NASA data · ${p}`,
      kinds: { cur: "Your current", idea: "Your idea", sug: "Suggestion", r2: "Rotation 2", r3: "Rotation 3" },
      months: ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June"],
      monthsShort: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      rainMm: (v) => `Rain ${v} mm`, hotDays: (v) => `${v} hot days`, soilWater: (v) => `Soil water ${v} mm`,
      health: "Crop condition this month (water met)", nextMonth: "Next month", endSeason: "End of season", auto: "Auto-play", pause: "Pause",
      m: { wait: "The land is waiting for the sowing rain.", before: "The land is taking in rain before sowing.", ero: "Heavy rain on bare land: the soil is washing away.", sow: "Sowing time! The young plants need water.",
        heat: "Strong heat at flowering: the grain suffers.", good: "The crop is comfortable, enough water this month.", warn: "The crop is a little short of water.", bad: "Severe thirst: the soil water has run out.",
        harvest: (p) => `Harvest! ${p}% of what was possible.`, after: "Harvested. The straw shields the soil from the sun.", fallow: "The land is resting this season." },
      seasonOver: "Season over!", seasonNote: (r, m) => `Oct–May rain this season: ${r} mm (average ${m} mm).`, harvestOf: (p) => `This season's harvest: ${p} of what was possible`,
      scoreNote: "Score out of 100 for your priorities, over 30 seasons of NASA data.", replay: "Replay the season", why: "Why these results?",
      whyTitle: "Why these results?", whyNote: "Each score is computed over 30 real seasons (1995–2025) of NASA data for your location. Decision support, not a yield forecast.", close: "Close",
      askSalah: "Ask Ammi Salah (soon)", fallowName: "Fallow",
    },
  };
  const t = () => TXT[S.lang || "ar"];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ------------------------------------------------------------------ state
  const DEF = {
    lang: null, screen: "welcome", locId: null, locName: "", name: "", avatar: "farmer", step: 0,
    farm: { area: 5, system: null, soil: null, irrig: null, water: null, history: ["unknown", "unknown", "unknown"], current: null, intent: null, focus: null, prios: [] },
    rots: [null, ["wheat", "lentil"], ["barley", "vetch"]],
  };
  // Always clear previous session data on load/refresh so every refresh starts completely fresh
  try {
    localStorage.removeItem("fieldshift");
    localStorage.removeItem("fs_farm_id");
    sessionStorage.removeItem("fieldshift");
    sessionStorage.removeItem("fs_farm_id");
  } catch (e) { }
  let S = JSON.parse(JSON.stringify(DEF));
  const save = () => { /* In-memory session state */ };
  let PREV = { scale: null, lvl: null, soil: null };

  const ICON = {
    back: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4l5 5-5 5" stroke="#516d77" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fwd: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 5l-5 5 5 5" stroke="#fbfbef" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tick: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3L12.5 5" stroke="#fbfbef" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const salah = (size, cls = "") => `<span class="${cls}" style="display:inline-block;width:${size}px;height:${size}px;max-width:100%;max-height:100%">${ART.salah.replace(/__S__/g, size)}</span>`;
  const backBtn = (to) => `<button class="back" data-act="go" data-to="${to}" aria-label="${t().back}">${S.lang === "en" ? ICON.back.replace('M7 4l5 5-5 5', 'M11 4l-5 5 5 5') : ICON.back}</button>`;
  const fwd = () => S.lang === "en" ? ICON.fwd.replace("M12 5l-5 5 5 5", "M8 5l5 5-5 5") : ICON.fwd;
  const arrow = () => (S.lang === "en" ? " → " : " ← ");

  // ------------------------------------------------------------------ navigation
  let NAV_HIST = [];
  function go(screen, pushHist = true) {
    stopAuto();
    if (pushHist && S.screen && S.screen !== screen) {
      NAV_HIST.push(S.screen);
      try {
        history.pushState({ screen }, "", "#" + screen);
      } catch (e) {}
    }
    S.screen = screen; save();
    const cur = app.firstElementChild;
    if (cur && !matchMedia("(prefers-reduced-motion: reduce)").matches) { cur.classList.add("leave"); setTimeout(render, 220); } else render();
    window.scrollTo(0, 0);
  }

  window.addEventListener("popstate", (e) => {
    const target = (e.state && e.state.screen) || (location.hash ? location.hash.replace("#", "") : null);
    if (target && SCREENS[target]) {
      go(target, false);
    } else if (NAV_HIST.length) {
      go(NAV_HIST.pop(), false);
    }
  });
  function render() {
    document.documentElement.lang = S.lang || "ar"; document.documentElement.dir = t().dir;
    const fn = SCREENS[S.screen] || SCREENS.welcome;
    app.innerHTML = fn();
    if (AFTER[S.screen]) AFTER[S.screen]();
    if (window.FS_GAME && window.FS_GAME.syncAudio) window.FS_GAME.syncAudio(S.screen);
  }

  // ------------------------------------------------------------------ data helpers
  const LOCS = DATA.locations;
  function findLoc(lat, lon) {
    let best = null, bd = 1e9;
    LOCS.forEach((l) => { const d = (l.lat - lat) ** 2 + (l.lon - lon) ** 2; if (d < bd) { bd = d; best = l; } });
    return best || LOCS.find((l) => l.demo) || LOCS[0];
  }
  function nearestTown(lat, lon) {
    let best = TOWNS[0], bd = 1e9;
    TOWNS.forEach((x) => { const d = (x[2] - lat) ** 2 + (x[3] - lon) ** 2; if (d < bd) { bd = d; best = x; } });
    return best;
  }
  const loc = () => LOCS.find((l) => l.id === S.locId) || LOCS.find((l) => l.demo);
  const placeName = () => S.locName || (S.lang === "en" ? "Sidi Bel Abbès" : "سيدي بلعباس");

  // ------------------------------------------------------------------ 1 welcome
  const SCREENS = {}, AFTER = {};
  SCREENS.welcome = () => `
  <div class="welcome">
    <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" aria-hidden="true" style="position:absolute;inset:0">
      <defs><radialGradient id="msun" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fbfbe4"/><stop offset="1" stop-color="#e8e8bc"/></radialGradient>
      <linearGradient id="mh1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b5b862"/><stop offset="1" stop-color="#9ca047"/></linearGradient>
      <linearGradient id="mh2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ca047"/><stop offset="1" stop-color="#7d8136"/></linearGradient></defs>
      <circle cx="300" cy="140" r="54" fill="url(#msun)"/>
      <path d="M40 210 q20 -18 44 -6 q14 -14 34 -2 q18 2 14 16 Z" fill="#fbfbef" opacity=".8"/><path d="M200 90 q16 -14 36 -4 q12 -10 28 0 q14 2 10 12 Z" fill="#fbfbef" opacity=".7"/>
      <path d="M0 600 C90 560 160 590 230 576 C300 562 350 572 390 560 L390 844 L0 844 Z" fill="url(#mh1)"/>
      <path d="M0 690 C80 662 170 684 250 668 C320 656 360 664 390 658 L390 844 L0 844 Z" fill="url(#mh2)"/>
      <g stroke="#e8e8bc" stroke-width="2" opacity=".5" stroke-linecap="round"><path d="M20 740 l60 -8 M100 760 l70 -9 M240 730 l70 -8 M260 770 l90 -10"/></g>
      <g class="hi" stroke="#840000" stroke-width="5" stroke-linecap="round" fill="none"><path d="M318 286 q16 10 18 30"/><path d="M334 268 q24 16 26 46"/></g>
    </svg>
    <div style="position:absolute;left:50%;top:clamp(180px,29%,250px);transform:translateX(-50%);max-width:min(340px,88%);display:flex;justify-content:center"><div class="pop d1">${salah(340, "wave")}</div></div>
    <div style="position:absolute;left:0;right:0;bottom:64px;display:flex;flex-direction:column;align-items:center;gap:18px">
      <div class="dots in d4" aria-hidden="true"><i class="on"></i><i style="background:#fbfbef"></i><i style="background:#fbfbef"></i></div>
      <div class="pop d5"><button class="go" data-act="go" data-to="lang" aria-label="${t().start}"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M11 7l8 8-8 8" stroke="#fbfbef" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
    </div>
  </div>`;

  // ------------------------------------------------------------------ 2 language
  SCREENS.lang = () => {
    const T = t(), card = (id, badge, name, sub, dir) => `
      <button class="opt ${S.lang === id ? "on" : ""}" role="radio" aria-checked="${S.lang === id}" data-act="lang" data-v="${id}" style="min-height:88px;padding:16px">
        <span style="flex:none;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:22px;font-weight:800;${S.lang === id ? "background:#516d77;color:#fbfbef" : "background:#e8e8bc;color:#3f565e"}">${badge}</span>
        <span style="flex:1" dir="${dir}"><b style="font-size:21px">${name}</b><small>${sub}</small></span>
        <span style="flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;${S.lang === id ? "background:#9ca047" : "border:2px solid #d6d6a8"}">${S.lang === id ? ICON.tick : ""}</span>
      </button>`;
    return `<div class="screen">
      <div class="top in" style="justify-content:space-between">${backBtn("welcome")}<div class="dots" aria-hidden="true"><i></i><i class="on"></i><i></i></div></div>
      <div class="pop d1" style="display:flex;flex-direction:column;align-items:center;gap:6px">${salah(140, "wave2")}
        <div class="bubble" style="text-align:center;border-radius:20px"><div style="font-size:17px;font-weight:800">${TXT.ar.langQ}</div><div dir="ltr" style="font-size:14px;font-weight:700;color:#516d77">${TXT.en.langQ}</div></div></div>
      <div role="radiogroup" class="in d3" style="display:flex;flex-direction:column;gap:12px">${card("ar", "ع", "العربية", "Arabic", "rtl")}${card("en", "En", "English", "الإنجليزية", "ltr")}</div>
      <button class="in d4 chtalk" data-act="chatOpen">💬 ${S.lang ? T.voice : TXT.ar.voice + " · " + TXT.en.voice}</button>
      <div class="spacer"></div>
      ${S.lang ? `<button class="primary pop" data-act="go" data-to="location">${T.cont} ${fwd()}</button>` : `<button class="primary" disabled>${TXT.ar.pickLang} · ${TXT.en.pickLang}</button>`}
    </div>`;
  };

  // ------------------------------------------------------------------ 3 location
  let PENDING_GEO = null;
  SCREENS.location = () => {
    const T = t();
    return `<div class="screen" style="position:relative;padding:0">
      <div style="position:absolute;top:16px;inset-inline-start:16px;z-index:10">${backBtn("lang")}</div>
      <div aria-hidden="true" style="padding:16px 20px;padding-top:68px;opacity:.5;display:flex;flex-direction:column;gap:12px"><div style="height:210px;border-radius:30px;background:#dfe7e9"></div><div style="height:64px;width:80%;border-radius:20px;background:#fbfbef"></div></div>
      <div class="fade" data-act="go" data-to="lang" aria-label="${T.back}" style="position:absolute;inset:0;background:rgba(43,58,63,.55);cursor:pointer"></div>
      <div role="dialog" aria-labelledby="locT" class="sheet" style="position:absolute;left:0;right:0;bottom:0;background:#fbfbef;border-radius:32px 32px 0 0;padding:14px 22px 26px;display:flex;flex-direction:column;gap:14px;box-shadow:0 -12px 30px rgba(43,58,63,.25)">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">${backBtn("lang")}<div style="width:48px;height:5px;border-radius:3px;background:#c9c99a"></div><div style="width:44px"></div></div>
        <div style="height:168px;border-radius:24px;background:#e8e8bc;position:relative;overflow:hidden">
          <svg width="100%" height="168" viewBox="0 0 346 168" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="position:absolute;inset:0">
            <defs><radialGradient id="pinG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#c23a2c"/><stop offset=".6" stop-color="#840000"/><stop offset="1" stop-color="#4f0000"/></radialGradient></defs>
            <path d="M-10 40 L120 10 L200 60 L80 100 Z" fill="#c8cc6a"/><path d="M200 60 L320 20 L360 90 L240 120 Z" fill="#9ca047"/><path d="M80 100 L200 60 L240 120 L110 170 Z" fill="#b5b862"/>
            <path d="M-10 120 L80 100 L110 170 L-10 180 Z" fill="#9ca047" opacity=".8"/><path d="M240 120 L360 90 L360 180 L260 180 Z" fill="#c8cc6a"/>
            <path d="M-10 70 C90 80 140 40 220 90 S330 140 360 120" stroke="#516d77" stroke-width="7" fill="none" opacity=".55" stroke-linecap="round"/>
            <g class="pin"><path d="M172 122 C160 104 148 92 148 76 C148 62 159 52 172 52 C185 52 196 62 196 76 C196 92 184 104 172 122 Z" fill="url(#pinG)"/><circle cx="172" cy="76" r="9" fill="#fbfbef"/><ellipse cx="164" cy="64" rx="6" ry="4" fill="#fff" opacity=".35"/></g>
            <circle class="ring" cx="172" cy="124" r="30" fill="none" stroke="#840000" stroke-width="3"/>
          </svg>
          <div style="position:absolute;bottom:6px;inset-inline-start:10px">${salah(86, "wave1")}</div>
        </div>

        ${PENDING_GEO ? `
          <div class="in d2" style="background:#f4f6e8;border:2px solid #7d8136;border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:24px">📍</span>
              <div style="flex:1">
                <div style="font-size:11px;font-weight:800;color:#516d77">${T.detectedLoc}</div>
                <div style="font-size:18px;font-weight:900;color:#2b2a20;line-height:1.25">${esc(PENDING_GEO.town)}</div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:#516d77;border-top:1px dashed #d6dcba;padding-top:6px;margin-top:2px">
              <span dir="ltr"><b>GPS:</b> ${PENDING_GEO.lat.toFixed(4)}°, ${PENDING_GEO.lon.toFixed(4)}°</span>
            </div>
          </div>
          <button class="primary in d3 pop" data-act="confirmGeo">
            ✅ ${T.confirmLocBtn}
          </button>
          <div style="display:flex;gap:8px">
            <button class="secondary in d4" data-act="geo" style="flex:1">🔄 ${T.redetect}</button>
            <button class="secondary in d5" data-act="go" data-to="manual" style="flex:1">${T.manual}</button>
          </div>
        ` : `
          <h2 id="locT" class="in d3" style="text-align:center;font-size:26px;font-weight:800">${T.whereQ}</h2>
          <div id="locMsg" class="muted" style="text-align:center;font-size:13px;min-height:0"></div>
          <button class="primary in d5" data-act="geo">${T.allow}</button>
          <button class="secondary in d6" data-act="go" data-to="manual">${T.manual}</button>
        `}
      </div>
    </div>`;
  };

  // ------------------------------------------------------------------ 4 manual
  let PICK = null, MAP = null;
  SCREENS.manual = () => {
    const T = t();
    return `<div class="screen">
      <div class="top in">${backBtn("location")}<h1 style="font-size:22px;font-weight:800">${T.enterLoc}</h1></div>
      <div class="in d1" style="display:flex;gap:10px;align-items:flex-end"><div style="flex:none">${salah(64, "wave1")}</div><div class="bubble me" style="font-size:14.5px">${T.enterLocTip}</div></div>
      <div class="in d2"><label class="lbl" for="town">${T.townLbl}</label>
        <input id="town" class="field" type="text" autocomplete="off" placeholder="${T.townPh}" value="${PICK && PICK.town ? esc(PICK.town) : ""}">
        <div id="sugg" class="sugg card" style="margin-top:6px;overflow:hidden;display:none"></div></div>
      <div class="in d3" style="display:flex;align-items:center;gap:10px;color:#4f5a5e;font-size:13px"><span style="flex:1;height:1px;background:#d6d6a8"></span>${T.or}<span style="flex:1;height:1px;background:#d6d6a8"></span></div>
      <div class="in d4"><button class="secondary" data-act="map">${T.onMap}</button><div id="mapbox"></div></div>
      <details class="in d5" style="font-size:13px;color:#3f565e"><summary style="cursor:pointer;font-weight:700;min-height:32px">${T.gps}</summary>
        <div style="display:flex;gap:8px;margin-top:6px">
          <label style="flex:1;display:flex;flex-direction:column;gap:2px">${T.lat}<input id="lat" type="text" inputmode="decimal" placeholder="35.37" dir="ltr" class="field" style="font-size:15px;padding:8px;border-width:1.5px"></label>
          <label style="flex:1;display:flex;flex-direction:column;gap:2px">${T.lon}<input id="lon" type="text" inputmode="decimal" placeholder="1.32" dir="ltr" class="field" style="font-size:15px;padding:8px;border-width:1.5px"></label></div></details>
      <div id="manMsg" style="font-size:14px;font-weight:700;color:#840000"></div>
      <div class="spacer"></div>
      <button id="confirmLoc" class="primary in d6" data-act="confirmLoc" ${PICK ? "" : "disabled"}>${PICK ? T.confirm + (PICK.town ? ": " + esc(PICK.town) : "") : T.chooseFirst}</button>
    </div>`;
  };
  AFTER.manual = () => {
    const inp = document.getElementById("town"), box = document.getElementById("sugg");
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[أإآ]/g, "ا").trim();
    inp.addEventListener("input", () => {
      const q = norm(inp.value);
      if (!q) { box.style.display = "none"; return; }
      const hits = TOWNS.filter((x) => norm(x[0]).includes(q) || norm(x[1]).includes(q)).slice(0, 5);
      box.style.display = hits.length ? "block" : "none";
      box.innerHTML = hits.map((x) => `<button class="reveal" data-act="town" data-lat="${x[2]}" data-lon="${x[3]}" data-name="${esc(S.lang === "en" ? x[0] : x[1])}"><span>${esc(S.lang === "en" ? x[0] : x[1])}</span><span class="muted" style="font-size:12px" dir="ltr">${x[2].toFixed(2)}, ${x[3].toFixed(2)}</span></button>`).join("");
    });
    ["lat", "lon"].forEach((id) => document.getElementById(id).addEventListener("change", () => {
      const la = parseFloat(document.getElementById("lat").value), lo = parseFloat(document.getElementById("lon").value);
      if (!isNaN(la) && !isNaN(lo)) setPick(la, lo, null);
    }));
  };
  function setPick(lat, lon, town) {
    PICK = { lat, lon, town: town || (S.lang === "en" ? nearestTown(lat, lon)[0] : nearestTown(lat, lon)[1]) };
    const b = document.getElementById("confirmLoc");
    if (b) { b.disabled = false; b.innerHTML = t().confirm + ": " + esc(PICK.town); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    const m = document.getElementById("manMsg"); if (m) m.innerHTML = "";
  }
  function useLocation(lat, lon, town) {
    // live NASA data for THIS point (environment.js); the bundled datasets are only an announced fallback
    if (window.FS_ENV) return window.FS_ENV.select(lat, lon, town);
    const l = findLoc(lat, lon);
    if (!l) return false;
    S.realLat = Number(lat);
    S.realLon = Number(lon);
    S.locId = l.id;
    S.locName = town || (S.lang === "en" ? nearestTown(lat, lon)[0] : nearestTown(lat, lon)[1]);
    save();
    go("profile");
    if (window.FS_API) {
      window.FS_API.getNearestLocation(lat, lon).catch(() => {});
      window.FS_API.saveFarm(lat, lon, S.farm).then((f) => { if (f && f.farm_id) { S.farmId = f.farm_id; save(); } }).catch(() => {});
    }
    return true;
  }
  function noDataMsg(el) {
    if (!el) return;
    el.innerHTML = `<div class="reveal" style="display:flex;flex-direction:column;gap:8px"><span>${t().noData}</span><button class="secondary" data-act="demo">${t().useDemo}</button></div>`;
  }

  // ------------------------------------------------------------------ 5 profile
  const AVS = ["farmer", "woman", "young", "elder", "sheep", "wheat"];
  SCREENS.profile = () => {
    const T = t(), nm = S.name.trim();
    return `<div class="screen">${ART.avatars}
      <div class="top in" style="justify-content:space-between">${backBtn("location")}<div class="dots" aria-hidden="true"><i class="on"></i><i></i><i></i></div></div>
      <div class="pop d1" style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="position:relative;width:132px;height:132px"><div style="width:132px;height:132px;border-radius:50%;box-shadow:0 8px 0 #d6d6a8,0 14px 28px rgba(43,58,63,.18);overflow:hidden;background:#fbfbef">
          <svg id="avPrev" class="swap" width="132" height="132" viewBox="0 0 100 100" role="img" aria-label="${T.av[S.avatar]}"><use href="#av-${S.avatar}"/></svg></div>
          <div style="position:absolute;bottom:-2px;inset-inline-start:-8px">${salah(64)}</div></div>
        <div style="font-size:24px;font-weight:800">${T.hello}<span id="hiName" style="color:#840000">${esc(nm || T.friend)}</span>!</div></div>
      <div class="in d2"><label class="lbl" for="fname">${T.nameQ}</label><input id="fname" class="field" type="text" autocomplete="given-name" placeholder="${T.namePh}" value="${esc(S.name)}"></div>
      <div class="in d3" style="display:flex;flex-direction:column;gap:8px"><div style="font-size:15px;font-weight:800">${T.pickAv}</div>
        <div role="radiogroup" class="stagger" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
          ${AVS.map((a) => `<button class="av ${S.avatar === a ? "on" : ""}" role="radio" aria-checked="${S.avatar === a}" aria-label="${T.av[a]}" data-act="avatar" data-v="${a}"><svg width="76" height="76" viewBox="0 0 100 100" aria-hidden="true"><use href="#av-${a}"/></svg><span class="tk">${ICON.tick}</span></button>`).join("")}
        </div></div>
      <div class="spacer"></div>
      <div id="profBtn">${nm ? `<button class="primary pop" data-act="go" data-to="farm">${T.cont} ${fwd()}</button>` : `<button class="primary" disabled>${T.typeName}</button>`}</div>
    </div>`;
  };
  AFTER.profile = () => {
    const inp = document.getElementById("fname");
    inp.addEventListener("input", () => {
      const had = !!S.name.trim(); S.name = inp.value; save();
      document.getElementById("hiName").textContent = S.name.trim() || t().friend;
      const has = !!S.name.trim();
      if (has !== had) document.getElementById("profBtn").innerHTML = has ? `<button class="primary pop" data-act="go" data-to="farm">${t().cont} ${fwd()}</button>` : `<button class="primary" disabled>${t().typeName}</button>`;
    });
  };

  // ------------------------------------------------------------------ 6 farm questions + live farm
  const QKEYS = ["area", "system", "soil", "irrig", "water", "history", "current", "prios", "order"];
  const CROPLIST = ["wheat", "barley", "oat", "lentil", "chickpea", "faba", "vetch", "fallow"];
  const PRIOS = ["water", "soil", "erosion", "fert", "prod", "profit", "feed", "drought", "heat", "pest", "work"];
  const SEASONS_LBL = ["2024–25", "2023–24", "2022–23", "2021–22", "2020–21"];
  SCREENS.farm = () => `<div class="screen" style="gap:12px">
      <div class="top in"><button class="back" data-act="qback" aria-label="${t().back}">${S.lang === "en" ? ICON.back.replace('M7 4l5 5-5 5', 'M11 4l-5 5 5 5') : ICON.back}</button>
        <div style="flex:1;display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;color:#3f565e"><span>${t().aboutFarm}</span><span id="qCount"></span></div>
        <div class="progress"><i id="qBar" style="width:0"></i></div></div></div>
      <div id="scene" class="scene in d1"></div>
      <div id="qBox" style="flex:1;display:flex;flex-direction:column;gap:10px"></div>
      <div id="qBtn"></div>
    </div>`;
  AFTER.farm = () => { if (S.step >= QKEYS.length) S.step = QKEYS.length - 1; renderScene(new Set()); renderQ(true); };

  function answered() {
    const f = S.farm, k = QKEYS[S.step];
    if (k === "area") return Number(f.area) > 0;
    if (k === "history") return true;
    if (k === "intent") return f.intent === "suggest" || (f.intent === "crop" && !!f.focus);
    if (k === "prios" || k === "order") return f.prios.length >= 1;
    return !!f[k];
  }
  function renderQ(animate) {
    const T = t(), f = S.farm, k = QKEYS[S.step], q = T.Q[k], box = document.getElementById("qBox");
    document.getElementById("qCount").textContent = T.qOf(S.step + 1, QKEYS.length);
    document.getElementById("qBar").style.width = Math.round((S.step + 1) / QKEYS.length * 100) + "%";
    const A = animate ? "" : " style-still";
    let body = "";
    if (k === "area") {
      body = `<div class="stepper"><button data-act="area" data-d="0.5" aria-label="+" style="background:#516d77;color:#fbfbef">+</button>
        <label style="flex:1;display:flex;flex-direction:column;align-items:center"><input id="areaIn" type="number" inputmode="decimal" min="0" step="0.5" value="${f.area}" dir="ltr"><span style="font-size:14px;font-weight:700;color:#3f565e">${T.ha}</span></label>
        <button data-act="area" data-d="-0.5" aria-label="−" style="background:#e8e8bc;color:#3f565e">−</button></div>
        <div class="stagger" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${[1, 5, 10, 20].map((v) => `<button class="chip ${Number(f.area) === v ? "on" : ""}" style="justify-content:center" data-act="areaSet" data-v="${v}">${v === 20 ? "+20" : v}</button>`).join("")}</div>`;
    } else if (q[2]) {
      body = `<div role="radiogroup" class="stagger" style="display:flex;flex-direction:column;gap:10px">${q[2].map((o) => {
        const on = f[k] === o[0], soon = !!o[3];
        return `<button class="opt ${on ? "on" : ""}" role="radio" aria-checked="${on}" ${soon ? 'aria-disabled="true"' : ""} data-act="${soon ? "" : "ans"}" data-k="${k}" data-v="${o[0]}">
          <span class="rad"></span><span style="flex:1"><b>${o[1]}</b>${o[2] ? `<small>${o[2]}</small>` : ""}</span>${soon ? `<span class="tag">${T.soon}</span>` : ""}</button>`; }).join("")}</div>`;
      if (k === "intent" && f.intent === "crop") body += `<div class="card reveal" style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;box-shadow:none"><div style="font-size:14px;font-weight:800;color:#3f565e">${T.whichCrop}</div>
        <div class="chips">${CROPLIST.filter((c) => c !== "fallow").map((c) => `<button class="chip ${f.focus === c ? "on" : ""}" data-act="ans" data-k="focus" data-v="${c}">${T.crops[c]}</button>`).join("")}</div></div>`;
    } else if (k === "history") {
      body = `<div class="stagger" style="display:flex;flex-direction:column;gap:8px">${f.history.map((v, i) => `<label class="histrow"><span style="flex:none;width:74px;font-size:13px;font-weight:800;color:#3f565e" dir="ltr">${SEASONS_LBL[i]}</span>
        <select data-hist="${i}"><option value="unknown" ${v === "unknown" ? "selected" : ""}>${T.unknown}</option>${CROPLIST.map((c) => `<option value="${c}" ${v === c ? "selected" : ""}>${T.crops[c]}</option>`).join("")}</select></label>`).join("")}
        ${f.history.length < 5 ? `<button data-act="addHist" style="align-self:flex-start;border:2px dashed #9ca047;background:transparent;color:#3f565e;border-radius:14px;padding:8px 14px;font-weight:800;font-size:14px;min-height:44px">${T.moreSeason}</button>` : ""}</div>`;
    } else if (k === "current") {
      body = `<div class="chips stagger">${CROPLIST.filter((c) => c !== "fallow").concat(["none"]).map((c) => `<button class="chip ${f.current === c ? "on" : ""}" data-act="ans" data-k="current" data-v="${c}">${c === "none" ? T.none : T.crops[c]}</button>`).join("")}</div>`;
    } else if (k === "prios") {
      const full = f.prios.length >= 3;
      body = `<div style="font-size:14px;font-weight:800;color:#840000">${T.chosen(f.prios.length)}</div>
        <div class="chips stagger">${PRIOS.map((p) => { const on = f.prios.includes(p); return `<button class="chip ${on ? "on" : ""} ${full && !on ? "dim" : ""}" aria-pressed="${on}" data-act="prio" data-v="${p}">${on ? '<span class="ck"></span>' : ""}${T.prio[p]}</button>`; }).join("")}</div>`;
    } else if (k === "order") {
      const W = f.prios.length === 1 ? ["100%"] : f.prios.length === 2 ? ["60%", "40%"] : ["50%", "30%", "20%"], C = ["#840000", "#a33a2a", "#b8705f"];
      body = `<div class="stagger" style="display:flex;flex-direction:column;gap:10px">${f.prios.map((p, i) => `<div class="orow"><span class="rk" style="background:${C[i]}">${i + 1}</span>
        <span style="flex:1"><b style="display:block;font-size:16.5px">${T.prio[p]}</b><small class="muted" style="font-size:12.5px">${T.weight}: ${W[i]}</small></span>
        <button data-act="move" data-i="${i}" data-d="-1" aria-label="${T.up}" ${i === 0 ? "disabled" : ""}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4" stroke="#fbfbef" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button data-act="move" data-i="${i}" data-d="1" aria-label="${T.down}" ${i === f.prios.length - 1 ? "disabled" : ""}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="#fbfbef" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`).join("")}</div>`;
    }
    box.innerHTML = `<div class="${animate ? "qin" : ""}"><h1 style="font-size:22px;font-weight:800">${q[0]}</h1>${q[1] ? `<div class="muted" style="font-size:13.5px;line-height:1.5">${q[1]}</div>` : ""}</div><div class="${animate ? "qin" : "still"}" style="display:flex;flex-direction:column;gap:10px">${body}</div>`;
    if (!animate) box.querySelectorAll(".stagger>*").forEach((e) => (e.style.animation = "none"));
    const ai = document.getElementById("areaIn");
    if (ai) ai.addEventListener("change", () => { setFarm("area", Math.max(0, parseFloat(ai.value) || 0)); });
    box.querySelectorAll("select[data-hist]").forEach((sel) => sel.addEventListener("change", () => { const h = S.farm.history.slice(); h[+sel.dataset.hist] = sel.value; setFarm("history", h); }));
    renderQBtn();
  }
  function renderQBtn() {
    const T = t(), last = S.step === QKEYS.length - 1, ok = answered(), k = QKEYS[S.step];
    const el = document.getElementById("qBtn");
    const label = last ? (S.lang === "en" ? "Continue" : "تابع") : T.next;
    const html = ok ? `<button class="primary" data-act="qnext">${label} ${fwd()}</button>` : `<button class="primary" disabled>${k === "prios" ? T.prioFirst : T.answerFirst}</button>`;
    if (el.dataset.ok !== String(ok) || el.dataset.lbl !== label) { el.innerHTML = html; if (ok) el.firstChild.classList.add("pop"); el.dataset.ok = String(ok); el.dataset.lbl = label; }
  }
  const KIND = { area: "area", system: "system", soil: "soil", irrig: "irrig", water: "water", history: "crop", current: "crop", focus: "intent", intent: "intent", prios: "prios" };
  function setFarm(k, v) {
    S.farm[k] = v; save();
    renderScene(new Set([KIND[k] || k, "any"]));
    renderQ(false);
  }

  function renderScene(fx) {
    const T = t(), f = S.farm, el = document.getElementById("scene");
    if (!el) return;
    const SOIL = { sandy: ["#d9bf86", "#b99a5c"], clay: ["#9a5a3c", "#73402a"], loam: ["#7a5a3e", "#5a4130"], unknown: ["#a39a86", "#857c69"] };
    const soil = SOIL[f.soil || "unknown"] || SOIL.unknown, prevSoil = SOIL[PREV.soil || f.soil || "unknown"] || soil;
    const a = Number(f.area) || 0;
    const scale = a <= 0 ? 0.55 : a < 2 ? 0.65 : a < 6 ? 0.8 : a < 15 ? 0.92 : 1;
    const fromScale = PREV.scale == null ? scale : PREV.scale;
    const rows = [192, 174, 157, 141, 127];
    const furrows = rows.map((y) => { const tt = (192 - y) / 74, x0 = 30 + 38 * tt, x1 = 320 - 38 * tt; return { y, x0, x1, d: `M${x0} ${y} L${x1} ${y}`, delay: (tt * 0.5).toFixed(2) }; });
    const shown = f.current && f.current !== "none" ? f.current : (f.history[0] && !["unknown", "fallow"].includes(f.history[0]) ? f.history[0] : null);
    const LOOK = { wheat: ["#b8903a", "#e0b44a", "c"], barley: ["#a8963c", "#d8c46a", "c"], oat: ["#8f9a46", "#c8cc6a", "c"], lentil: ["", "#9ca047", "b"], chickpea: ["", "#e8e8bc", "b"], faba: ["", "#fbfbef", "b"], vetch: ["", "#8a4fbf", "b"] };
    let plants = "";
    if (shown && LOOK[shown]) {
      const L = LOOK[shown], per = a < 2 ? 5 : a < 10 ? 7 : 9;
      furrows.forEach((fr, r) => { for (let k = 0; k < per; k++) {
        const x = Math.round(fr.x0 + (fr.x1 - fr.x0) * (k + 0.5) / per), sc = (0.6 + 0.4 * (1 - r / 5)).toFixed(2), dl = ((r * per + k) * 0.03).toFixed(2);
        const shape = L[2] === "c"
          ? `<path d="M0 0 V-22 M-4 0 V-17 M4 0 V-18" stroke="${L[0]}" stroke-width="2" stroke-linecap="round"/><ellipse cx="0" cy="-25" rx="2.6" ry="6" fill="${L[1]}"/><ellipse cx="-4" cy="-20" rx="2.2" ry="5" fill="${L[1]}"/><ellipse cx="4" cy="-21" rx="2.2" ry="5" fill="${L[1]}"/>`
          : `<circle cx="-5" cy="-7" r="6" fill="#7d8136"/><circle cx="5" cy="-8" r="6.5" fill="#9ca047"/><circle cx="0" cy="-13" r="6" fill="#b5b862"/><circle cx="2" cy="-12" r="1.8" fill="${L[1]}"/><circle cx="-5" cy="-6" r="1.6" fill="${L[1]}"/>`;
        plants += `<g transform="translate(${x} ${fr.y - 2}) scale(${sc})"><g class="${fx.has("crop") ? "grow" : ""}" style="animation-delay:${dl}s"><g class="sway" style="animation-delay:${dl}s">${shape}</g></g></g>`;
      } });
    }
    const irr = f.irrig || "rain", ir = fx.has("irrig");
    const lvl = { low: 0.22, medium: 0.55, high: 0.9 }[f.water] || 0.08, fromLvl = PREV.lvl == null ? lvl : PREV.lvl;
    const flags = f.prios.map((p, i) => `<g transform="translate(${70 + i * 22} 112)"><g class="${fx.has("prios") ? "grow" : ""}"><path d="M0 0 V-26" stroke="#5a4535" stroke-width="2.4"/><g class="flag"><path d="M0 -26 L16 -21 L0 -16 Z" fill="${["#840000", "#a33a2a", "#b8705f"][i]}"/><text x="6" y="-19" font-size="7" font-weight="800" fill="#fbfbef" text-anchor="middle">${i + 1}</text></g></g></g>`).join("");
    const hist = f.history.filter((h) => h && h !== "unknown");
    const tractor = `<g class="tractor"><g transform="translate(0 150)"><rect x="6" y="-20" width="34" height="16" rx="4" fill="#840000"/><rect x="24" y="-34" width="14" height="16" rx="3" fill="#a51a1a"/><rect x="27" y="-31" width="8" height="8" rx="1" fill="#dfe7e9"/><path d="M12 -20 v-8" stroke="#3f565e" stroke-width="3"/><circle cx="34" cy="-4" r="9" fill="#2c3f45"/><circle cx="34" cy="-4" r="4" fill="#9ca047"/><circle cx="12" cy="-2" r="6" fill="#2c3f45"/><circle cx="12" cy="-2" r="2.5" fill="#9ca047"/></g></g>`;
    el.style.background = irr === "rain" ? "#d4dfe3" : "#dfe7e9";
    el.innerHTML = `<svg viewBox="0 0 350 196" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${a} ${T.ha}">
      <defs><linearGradient id="fh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b5b862"/><stop offset="1" stop-color="#9ca047"/></linearGradient>
      <linearGradient id="ft" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f9ba5"/><stop offset="1" stop-color="#3f565e"/></linearGradient>
      <linearGradient id="fw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb3c2"/><stop offset="1" stop-color="#516d77"/></linearGradient>
      <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".75"/><stop offset="1" stop-color="#dfe7e9" stop-opacity=".35"/></linearGradient></defs>
      <circle cx="56" cy="40" r="20" fill="#fbfbe4"/>
      ${irr === "rain" ? `<g class="${ir ? "slidein" : ""}"><g class="cloud"><ellipse cx="200" cy="34" rx="34" ry="13" fill="#fbfbef"/><ellipse cx="222" cy="26" rx="20" ry="13" fill="#fbfbef"/><ellipse cx="182" cy="28" rx="16" ry="11" fill="#fbfbef"/></g></g>
        <g stroke="#516d77" stroke-width="2" stroke-linecap="round">${[184, 198, 212, 226].map((x, i) => `<path class="rain" style="animation-delay:${i * 0.2}s" d="M${x} 50 l-3 8"/>`).join("")}</g>` : ""}
      <path d="M0 112 C70 92 140 104 210 96 C270 90 320 98 350 92 L350 196 L0 196 Z" fill="url(#fh)"/>
      <g class="fs-field" style="transform:scale(${scale});${fx.has("area") ? `animation:fsField .7s cubic-bezier(.3,1.3,.5,1) both;--from:${fromScale};--to:${scale}` : ""}">
        <path d="M30 192 L320 192 L282 118 L68 118 Z" fill="${fx.has("soil") ? prevSoil[0] : soil[0]}"/>
        ${fx.has("soil") ? `<rect class="till" x="30" y="118" width="290" height="74" fill="${soil[0]}" clip-path="url(#fieldClip)"/>` : ""}
        <clipPath id="fieldClip"><path d="M30 192 L320 192 L282 118 L68 118 Z"/></clipPath>
        ${fx.has("area") ? `<path class="ring2" d="M30 192 L320 192 L282 118 L68 118 Z" fill="none" stroke="#fbfbef"/>` : ""}
        ${furrows.map((fr) => `<path d="${fr.d}" stroke="${soil[1]}" stroke-width="1.5" fill="none" opacity=".6"/>`).join("")}
        ${irr === "flood" ? `<g class="${ir ? "rise" : ""}"><path class="shine" d="M34 188 L316 188 L284 124 L66 124 Z" fill="#8fb3c2"/></g>` : ""}
        ${irr === "drip" ? furrows.map((fr) => `<path class="${ir ? "draw" : ""}" style="animation-delay:${fr.delay}s" d="${fr.d}" stroke="#2f5884" stroke-width="2" fill="none"/>`).join("") + furrows.slice(0, 4).map((fr, r) => [0.3, 0.6].map((tt, k) => `<circle class="drop" style="animation-delay:${((r + k) * 0.3).toFixed(1)}s" cx="${Math.round(fr.x0 + (fr.x1 - fr.x0) * tt)}" cy="${fr.y + 1}" r="2.4" fill="#2f5884"/>`).join("")).join("") : ""}
        ${plants}
        ${irr === "sprinkler" ? `<g class="${ir ? "rise" : ""}"><path d="M110 150 v-14 M240 150 v-14" stroke="#3f565e" stroke-width="3" stroke-linecap="round"/><path class="spray" d="M110 136 q-26 -18 -40 4 M110 136 q26 -18 40 4" stroke="#8fb3c2" stroke-width="3" fill="none" stroke-linecap="round"/><path class="spray" style="animation-delay:.8s" d="M240 136 q-26 -18 -40 4 M240 136 q26 -18 40 4" stroke="#8fb3c2" stroke-width="3" fill="none" stroke-linecap="round"/></g>` : ""}
        ${f.system === "green" ? `<g class="${fx.has("system") ? "rise" : ""}"><path d="M40 192 C40 96 310 96 310 192 Z" fill="url(#fg)" stroke="#fbfbef" stroke-width="2"/></g>` : ""}
        ${fx.has("soil") ? tractor : ""}
      </g>
      <g transform="translate(312 92)"><rect width="26" height="58" rx="6" fill="url(#ft)"/>
        <rect x="4" y="4" width="18" height="50" rx="3" fill="url(#fw)" style="transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(${lvl});${fx.has("water") ? `animation:fsTank .8s cubic-bezier(.3,1.3,.5,1) both;--from:${fromLvl};--to:${lvl}` : ""}"/>
        ${fx.has("water") ? `<circle class="fall" cx="13" cy="${Math.round(4 + 50 * (1 - lvl))}" r="3.5" fill="#516d77"/><circle class="splash" cx="13" cy="${Math.round(4 + 50 * (1 - lvl))}" r="7" fill="none" stroke="#8fb3c2" stroke-width="2"/>` : ""}
        <path d="M2 58 v10 M24 58 v10" stroke="#3f565e" stroke-width="3"/><rect x="7" y="-6" width="12" height="6" rx="2" fill="#3f565e"/></g>
      ${flags}
    </svg>
    <div class="labels"><span>${a || "—"} ${T.ha}</span>
      ${hist.length && S.step >= 5 ? `<span class="${fx.has("crop") ? "slidein" : ""}" style="font-size:11px;max-width:180px">${T.pastSeasons}${hist.slice(0, 3).map((h) => T.crops[h]).join(arrow())}</span>` : ""}
      ${f.intent === "crop" && f.focus ? `<span class="${fx.has("intent") ? "dropin" : ""}" style="background:#840000;color:#fbfbef">${T.thinking}${T.crops[f.focus]}</span>` : ""}
      ${f.intent === "suggest" ? `<span class="${fx.has("intent") ? "dropin" : ""}" style="background:#516d77;color:#fbfbef"><span class="wiggle">?</span> ${T.wantIdeas}</span>` : ""}</div>
    <div class="salah"><div class="${fx.has("any") ? "hop" : ""}">${salah(64)}</div></div>`;
    PREV.scale = scale; PREV.lvl = lvl; PREV.soil = f.soil;
  }

  // ------------------------------------------------------------------ 7a rotations
  let OPEN = null;
  function currentSeq() {
    const f = S.farm, known = f.history.filter((h) => h && h !== "unknown").slice(0, 3).reverse();
    let seq = known.slice();
    if (seq.length >= 3 && seq[0] === seq[2]) seq = seq.slice(0, 2);
    if (seq.length === 1) seq.push(f.current && f.current !== "none" && f.current !== seq[0] ? f.current : "fallow");
    if (!seq.length) seq = [f.current && f.current !== "none" ? f.current : "wheat", "fallow"];
    if (seq.length > 1 && seq.every((x) => x === seq[0])) seq = [seq[0]];
    return seq;
  }
  const CK = { wheat: "wheat", barley: "barley", oat: "oat_forage", lentil: "lentil", chickpea: "chickpea", faba: "faba", vetch: "vetch", fallow: "fallow_grazed" };
  const PK = { water: "water", soil: "soil", erosion: "erosion", fert: "fertilizer", prod: "production", profit: "production", feed: "feed", drought: "drought", heat: "heat", pest: "pest", work: "workload" };
  function stopAuto() { }
  const ACT = {
    go: (d) => go(d.to),
    lang: (d) => { S.lang = d.v; save(); render(); },
    confirmGeo: () => {
      if (!PENDING_GEO) return;
      useLocation(PENDING_GEO.lat, PENDING_GEO.lon, PENDING_GEO.town);
      PENDING_GEO = null;
    },
    geo: () => {
      const msg = document.getElementById("locMsg");
      if (msg) msg.textContent = t().locatingGps;

      const resolveAndSetPending = async (lat, lon, fallbackCity) => {
        let town = fallbackCity;
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 3500);
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&accept-language=${S.lang || 'ar'}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (res.ok) {
            const d = await res.json();
            const a = d.address || {};
            town = a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state || town;
          }
        } catch (e) {}

        if (!town) {
          const nt = nearestTown(lat, lon);
          town = S.lang === "en" ? nt[0] : nt[1];
        }

        PENDING_GEO = {
          lat: Number(lat),
          lon: Number(lon),
          town: town || (S.lang === "en" ? "My Location" : "موقعي الحالي")
        };
        render();
      };

      const fallbackToApi = () => {
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then((data) => {
            if (data && data.latitude && data.longitude) {
              resolveAndSetPending(data.latitude, data.longitude, data.city || data.region);
              return;
            }
            const msg = document.getElementById("locMsg");
            if (msg) msg.textContent = t().enterLocTip;
          })
          .catch(() => {
            const msg = document.getElementById("locMsg");
            if (msg) msg.textContent = t().enterLocTip;
          });
      };

      if (!navigator.geolocation) {
        fallbackToApi();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => {
          resolveAndSetPending(p.coords.latitude, p.coords.longitude, null);
        },
        (err) => {
          console.warn("GPS error:", err);
          fallbackToApi();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    },
    demo: () => { const d = LOCS.find((l) => l.demo); useLocation(d.lat, d.lon, S.lang === "en" ? "Sidi Bel Abbès" : "سيدي بلعباس"); },
    town: (d) => { document.getElementById("town").value = d.name; document.getElementById("sugg").style.display = "none"; setPick(+d.lat, +d.lon, d.name); },
    map: () => {
      const box = document.getElementById("mapbox");
      if (!window.L) { box.innerHTML = `<p class="muted reveal" style="font-size:13px">${t().mapTap}</p>`; return; }
      if (MAP) return;
      box.innerHTML = `<p class="muted reveal" style="font-size:13px;margin:8px 0 4px">${t().mapTap}</p><div id="map" class="reveal"></div>`;
      MAP = L.map("map").setView([35.4, 2.5], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 13, attribution: "© OpenStreetMap" }).addTo(MAP);
      let mk = null;
      MAP.on("click", (e) => { if (mk) mk.setLatLng(e.latlng); else mk = L.marker(e.latlng).addTo(MAP); setPick(e.latlng.lat, e.latlng.lng, null); });
    },
    confirmLoc: () => { if (PICK && !useLocation(PICK.lat, PICK.lon, PICK.town)) noDataMsg(document.getElementById("manMsg")); },
    avatar: (d) => { S.avatar = d.v; save(); document.querySelectorAll(".av").forEach((b) => { const on = b.dataset.v === d.v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
      const pv = document.getElementById("avPrev"); pv.innerHTML = `<use href="#av-${d.v}"/>`; pv.setAttribute("aria-label", t().av[d.v]); pv.classList.remove("swap"); void pv.getBoundingClientRect(); pv.classList.add("swap"); },
    area: (d) => setFarm("area", Math.max(0, Math.round((Number(S.farm.area) + Number(d.d)) * 2) / 2)),
    areaSet: (d) => setFarm("area", Number(d.v)),
    ans: (d) => { if (d.k === "intent" && d.v === "suggest") S.farm.focus = null; setFarm(d.k, d.v); },
    addHist: () => setFarm("history", S.farm.history.concat(["unknown"])),
    prio: (d) => { const p = S.farm.prios.slice(), i = p.indexOf(d.v); if (i >= 0) p.splice(i, 1); else if (p.length < 3) p.push(d.v); setFarm("prios", p); },
    move: (d) => { const p = S.farm.prios.slice(), i = +d.i, j = i + Number(d.d); if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; setFarm("prios", p); },
    qnext: () => {
      if (!answered()) return;
      if (S.step < QKEYS.length - 1) {
        S.step++; save(); renderQ(true);
      } else {
        if (window.FS_API) {
          const l = loc();
          if (l) window.FS_API.saveFarm(l.lat, l.lon, S.farm).then((f) => { if (f && f.farm_id) { S.farmId = f.farm_id; save(); } }).catch(() => {});
        }
        go("hub");
      }
    },
    qback: () => { if (S.step > 0) { S.step--; save(); renderQ(true); } else go("profile"); },
  };
  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled || !el.dataset.act || !ACT[el.dataset.act]) return;
    ACT[el.dataset.act](el.dataset);
  });
  // keyframes that need CSS variables
  const st = document.createElement("style");
  st.textContent = "@keyframes fsField{from{transform:scale(var(--from))}to{transform:scale(var(--to))}}@keyframes fsTank{from{transform:scaleY(var(--from))}to{transform:scaleY(var(--to))}}";
  document.head.appendChild(st);

  if (S.screen !== "welcome" && !S.lang) S.screen = "welcome";
  window.FS_APP = { get S() { return S; }, save, go, render, SCREENS, AFTER, ACT, t, loc, salah, CK, PK, currentSeq, esc, fwd, backBtn, arrow, placeName, stopAuto };
  document.addEventListener("DOMContentLoaded", () => {});
  setTimeout(() => { if (!SCREENS[S.screen]) S.screen = "welcome"; render(); }, 0);
})();
