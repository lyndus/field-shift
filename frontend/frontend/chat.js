/* Field Shift – "Ask Ammi Salah" chatbot (Arabic · Algerian Darja · English).
   What it does – all offline, no AI service, no key:
     1. Explains how to use every part of the app (hub, report, rotations, game, farms, chat).
     2. Describes the farmer's land in simple words (same numbers as the report's simple view).
     3. Analyses a crop on THIS farm (FSEngine on the farm's real NASA seasons).
     4. Ranks the best crops and scores any rotation the farmer types ("wheat lentil barley") out of 10.
     5. Answers crop questions only from the checked research library (LIB), with sources under the answer.
     6. Symptom guide (yellow leaves, wilting, white crust, poor emergence).
     7. Never guesses: any request to guess / predict / forecast gets an apology, and questions outside
        the library get "I don't have a checked answer".
   Language: the farmer can pick العربية / الدارجة / English in the chat header; a message written in Darja
   (واش، كيفاش، بزاف، wesh, kifach…) is answered in Darja automatically. */
(function () {
  "use strict";
  const A = window.FS_APP; if (!A) return;
  const S = () => A.S, esc = A.esc;
  const GM = () => window.FS_GAME || {};
  const E = () => window.FSEngine;

  // ---------------------------------------------------------------- language: ar | dz | en
  let CL = null;                                   // chat language (null = follow the app)
  const lang = () => CL || (S().lang === "en" ? "en" : "ar");
  const T = (ar, en, dz) => (lang() === "en" ? en : lang() === "dz" ? (dz != null ? dz : ar) : ar);
  const L = T;
  const DZ_WORDS = /(^|\s)(واش|وش|كيفاش|علاش|بزاف|شحال|قداش|نتاع|تاع|راني|راك|راهو|راهي|نقدر|ماشي|برك|دروك|ضرك|هاذي|هاذا|نحب|نزرع|نديرو|ندير|كاش|بصح|يزّي|يزي|مليح|خويا|صحا|سقسي|نسقسيك|نتاعي|تاعي|ماعلاباليش|مكانش|كاين|كاينة)(\s|$|[؟?!.،,])/;
  const DZ_LATIN = /\b(wesh|wech|kifach|kifeh|3lach|alach|bzaf|bezzaf|chhal|9adach|qadach|ntaa|nta3|ta3|rani|rak|rahou|n9der|machi|berk|derwak|nheb|nzre3|nzra3|kayen|mlih|sahit|sa7a|khoya|fel|3la)\b/i;
  function detectLang(q) {
    if (DZ_WORDS.test(" " + q + " ") || DZ_LATIN.test(q)) return "dz";
    if (/[؀-ۿ]/.test(q)) return lang() === "dz" ? "dz" : "ar";
    if (/[a-z]/i.test(q)) return "en";
    return lang();
  }

  // ---------------------------------------------------------------- verified library (authors, year, journal, DOI/URL checked)
  const LIB = {
    FAO56: { cite: "Allen, Pereira, Raes & Smith (1998). Crop evapotranspiration – Guidelines for computing crop water requirements. FAO Irrigation and Drainage Paper 56, Rome.", url: "https://www.fao.org/4/x0490e/x0490e00.htm",
      used: ["ET0 (FAO-56 Penman–Monteith) computed from NASA POWER daily weather", "crop coefficients Kc by growth stage"] },
    FAO66: { cite: "Steduto, Hsiao, Fereres & Raes (2012). Crop yield response to water. FAO Irrigation and Drainage Paper 66, Rome. ISBN 978-92-5-107274-5.", url: "https://www.fao.org/4/i2800e/i2800e00.htm",
      used: ["yield response factor Ky: relative yield loss = Ky × relative ET deficit"] },
    PG99: { cite: "Porter & Gawith (1999). Temperatures and the growth and development of wheat: a review. European Journal of Agronomy 10(1): 23–36.", url: "https://doi.org/10.1016/S1161-0301(98)00047-1",
      used: ["hot day threshold Tmax > 31 °C around flowering"] },
    ASS15: { cite: "Asseng et al. (2015). Rising temperatures reduce global wheat production. Nature Climate Change 5: 143–147.", url: "https://doi.org/10.1038/nclimate2470",
      used: ["context: ~6% less global wheat per °C of further warming"] },
    SR06: { cite: "Saxton & Rawls (2006). Soil water characteristic estimates by texture and organic matter for hydrologic solutions. Soil Sci. Soc. Am. J. 70: 1569–1578.", url: "https://doi.org/10.2136/sssaj2005.0117",
      used: ["plant-available water of the top metre from sand, clay and organic matter"] },
    SG21: { cite: "Poggio et al. (2021). SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. SOIL 7: 217–240.", url: "https://doi.org/10.5194/soil-7-217-2021",
      used: ["soil texture, organic carbon, pH and CEC at 250 m"] },
    ANG15: { cite: "Angus, Kirkegaard, Hunt, Ryan, Ohlander & Peoples (2015). Break crops and rotations for wheat. Crop & Pasture Science 66: 523–552.", url: "https://doi.org/10.1071/CP14252",
      used: ["rotation penalty for wheat after wheat; break-crop benefit"] },
    HER08: { cite: "Herridge, Peoples & Boddey (2008). Global inputs of biological nitrogen fixation in agricultural systems. Plant and Soil 311: 1–18.", url: "https://doi.org/10.1007/s11104-008-9668-3",
      used: ["legumes as the main nitrogen fixers in farming"] },
    JEN10: { cite: "Jensen, Peoples & Hauggaard-Nielsen (2010). Faba bean in cropping systems. Field Crops Research 115: 203–216.", url: "https://doi.org/10.1016/j.fcr.2009.10.008",
      used: ["faba bean N fixation and N benefit to the next crop"] },
    KN10: { cite: "Köpke & Nemecek (2010). Ecological services of faba bean. Field Crops Research 115: 217–233.", url: "https://doi.org/10.1016/j.fcr.2009.10.012",
      used: ["faba bean as a break crop in cereal rotations"] },
    ZO99: { cite: "Zhang & Oweis (1999). Water–yield relations and optimal irrigation scheduling of wheat in the Mediterranean region. Agricultural Water Management 38(3): 195–211.", url: "https://ideas.repec.org/a/eee/agiwat/v38y1999i3p195-211.html",
      used: ["wheat yield vs water use in northern Syria (ICARDA)"] },
    OH06: { cite: "Oweis & Hachum (2006). Water harvesting and supplemental irrigation for improved water productivity of dry farming systems in West Asia and North Africa. Agricultural Water Management 80: 57–73.", url: "https://doi.org/10.1016/j.agwat.2005.07.004",
      used: ["supplemental irrigation at critical stages"] },
    MH77: { cite: "Maas & Hoffman (1977). Crop salt tolerance – current assessment. J. Irrigation and Drainage Division (ASCE) 103(2): 115–134.", url: "https://doi.org/10.1061/JRCEA4.0001137",
      used: ["salinity threshold & slope: wheat 6.0 dS/m, barley 8.0, faba (broad) bean 1.6"] },
    SEN68: { cite: "Sen (1968). Estimates of the regression coefficient based on Kendall's tau. J. American Statistical Association 63: 1379–1389.", url: "https://doi.org/10.1080/01621459.1968.10480934",
      used: ["trend per decade (Theil–Sen) with a Kendall significance test"] },
    POWER: { cite: "NASA Langley Research Center, POWER Project (Prediction Of Worldwide Energy Resources), daily Agroclimatology data, API v2.", url: "https://power.larc.nasa.gov/docs/",
      used: ["daily rain, temperature, humidity, wind, solar radiation for the farm's ~50 km cell"] },
  };
  const srcHTML = (keys) => keys && keys.length ? `<details class="chsrc"><summary>📚 ${T("المصادر", "Sources", "المصادر")} (${keys.length})</summary><ol>${keys.map((k) => `<li>${esc(LIB[k].cite)} <a href="${LIB[k].url}" target="_blank" rel="noopener">${LIB[k].url.replace(/^https:\/\//, "").slice(0, 46)}</a></li>`).join("")}</ol></details>` : "";

  // ---------------------------------------------------------------- crops: names in 3 languages + research facts
  const CROPS = ["wheat", "barley", "oat", "lentil", "chickpea", "faba", "vetch"];
  const ENG = { wheat: "wheat", barley: "barley", oat: "oat_forage", lentil: "lentil", chickpea: "chickpea", faba: "faba", vetch: "vetch", fallow: "fallow_grazed" };
  const NAMES = {
    wheat: /wheat|bl[eé]|القمح|قمح|لقمح|gam[h7]|9am[h7]|qam[h7]/i,
    barley: /barley|orge|الشعير|شعير|cha3ir|chaair|chair/i,
    oat: /\boats?\b|avoine|الخرطال|خرطال|الشوفان|شوفان|khortal/i,
    lentil: /lentils?|lentille|العدس|عدس|3ds|3des|adas/i,
    chickpea: /chick ?peas?|pois chiche|الحمص|حمص|حمّص|[h7]ommos|hommos/i,
    faba: /faba|broad beans?|f[eè]ve|الفول|فول|\bfoul\b/i,
    vetch: /vetch|vesce|البيقية|بيقية|بيقة/i,
    fallow: /fallow|jach[eè]re|البور|بور|راحة|bour/i,
  };
  const cname = (k) => (k === "fallow" ? T("بور (راحة)", "Fallow (rest)", "بور (راحة)") : ({
    wheat: T("القمح", "Wheat", "القمح"), barley: T("الشعير", "Barley", "الشعير"), oat: T("الخرطال (علف)", "Oat (forage)", "الخرطال (علف)"), lentil: T("العدس", "Lentil", "العدس"),
    chickpea: T("الحمص", "Chickpea", "الحمص"), faba: T("الفول", "Faba bean", "الفول"), vetch: T("البيقية (علف)", "Vetch (forage)", "البيقية (علف)") })[k] || k);
  // crops named in the message, in the order they appear
  function cropsIn(q) {
    const hits = [];
    Object.keys(NAMES).forEach((k) => { const re = new RegExp(NAMES[k].source, "gi"); let m; while ((m = re.exec(q))) hits.push([m.index, k]); });
    return hits.sort((a, b) => a[0] - b[0]).map((h) => h[1]).filter((k, i, arr) => i === 0 || k !== arr[i - 1] || true);
  }
  const MONTHS = () => T(["سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر", "يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليو", "أوت"], ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June", "July", "August"], ["سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر", "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت"]);
  // research facts per crop – each line tied to a source in LIB, wording kept to what the source says
  const FACTS = {
    wheat: [
      ["PG99", "فوق 31°م وقت الإزهار يقل نجاح التلقيح في القمح.", "Above 31 °C at flowering, pollination success in wheat drops.", "كي تفوت السخانة 31°م وقت النوّار، التلقيح في القمح ينقص."],
      ["ZO99", "في تجارب ICARDA بشمال سوريا زاد مردود القمح الطري ~160 كغ لكل 10 ملم ماء مستهلك فوق عتبة ~200 ملم.", "In ICARDA trials in northern Syria, bread-wheat yield rose ~160 kg per 10 mm of water used above a ~200 mm threshold.", "في تجارب ICARDA في شمال سوريا، القمح الطري زاد ~160 كغ على كل 10 ملم ماء فوق ~200 ملم."],
      ["ANG15", "القمح بعد محصول كسر يعطي أكثر من القمح بعد القمح: من ~0.5 طن/هكتار بعد الخرطال إلى ~1.2 بعد البقول.", "Wheat after a break crop yields more than wheat after wheat: from ~0.5 t/ha after oats to ~1.2 t/ha after grain legumes.", "القمح من بعد محصول آخر يعطي كثر من القمح من بعد القمح: من ~0.5 طن/هكتار من بعد الخرطال حتى ~1.2 من بعد البقول."],
      ["MH77", "يبدأ مردوده بالنقص فوق ملوحة ~6.0 dS/m.", "Its yield starts falling above a salinity of ~6.0 dS/m.", "المحصول تاعو يبدا ينقص كي الملوحة تفوت ~6.0 dS/m."],
      ["ASS15", "عالميًا يُقدَّر أن إنتاج القمح ينقص ~6% لكل درجة احترار إضافية.", "Globally, wheat production is estimated to fall ~6% for each extra °C of warming.", "في العالم، يقدّرو بلي إنتاج القمح ينقص ~6% على كل درجة سخانة زايدة."],
    ],
    barley: [
      ["MH77", "الشعير أكثر المحاصيل تحمّلًا للملوحة هنا: حتى ~8.0 dS/m قبل أن ينقص المردود.", "Barley is the most salt-tolerant crop here: up to ~8.0 dS/m before yield falls.", "الشعير هو اللي يصبر كثر على الملوحة: حتى ~8.0 dS/m قبل ما ينقص المحصول."],
      ["ANG15", "القمح بعد القمح أو بعد نفس العائلة يعطي أقل؛ تنويع العائلة يفيد المحصول التالي.", "Cereal after cereal yields less; changing the crop family helps the next crop.", "الحبوب من بعد الحبوب تعطي قل؛ بدّل العائلة باش ينفع المحصول اللي من بعد."],
    ],
    oat: [["ANG15", "كمحصول كسر قبل القمح يعطي زيادة ~0.5 طن/هكتار، أقل من البقول (~1.2).", "As a break crop before wheat it adds ~0.5 t/ha, less than grain legumes (~1.2).", "كمحصول قبل القمح يزيد ~0.5 طن/هكتار، قل من البقول (~1.2)."]],
    lentil: [
      ["HER08", "البقول تثبّت آزوت الهواء، وهي المصدر الرئيسي للتثبيت الحيوي في الزراعة.", "Legumes fix nitrogen from the air and are the main biological nitrogen fixers in farming.", "البقول تجبد الآزوت من الهوا، وهي اللي تجيب أكثر آزوت طبيعي في الفلاحة."],
      ["ANG15", "القمح بعد البقول يعطي ~1.2 طن/هكتار أكثر في المتوسط من القمح بعد القمح.", "Wheat after grain legumes yields ~1.2 t/ha more on average than wheat after wheat.", "القمح من بعد البقول يعطي ~1.2 طن/هكتار زايدة في المتوسط على القمح من بعد القمح."],
    ],
    chickpea: [
      ["HER08", "البقول تثبّت آزوت الهواء، وهي المصدر الرئيسي للتثبيت الحيوي في الزراعة.", "Legumes fix nitrogen from the air and are the main biological nitrogen fixers in farming.", "البقول تجبد الآزوت من الهوا، وهي اللي تجيب أكثر آزوت طبيعي في الفلاحة."],
      ["ANG15", "الحمص من أفضل محاصيل الكسر قبل القمح (مع العدس والفول).", "Chickpea is among the best break crops before wheat (with lentil and faba bean).", "الحمص من أحسن المحاصيل قبل القمح (مع العدس والفول)."],
    ],
    faba: [
      ["JEN10", "الفول من أعلى البقول الشتوية تثبيتًا للآزوت (~70–95% من آزوته من الهواء)، فينفع المحصول التالي.", "Faba bean is among the highest nitrogen fixers of cool-season legumes (~70–95% of its N from the air), which benefits the next crop.", "الفول من البقول اللي تجبد أكثر آزوت (~70–95% من الهوا)، وهذا ينفع المحصول اللي من بعدو."],
      ["KN10", "يعمل محصولَ كسر جيدًا في دورات الحبوب.", "It works well as a break crop in cereal rotations.", "يخدم مليح بين الحبوب في الدورة."],
      ["MH77", "حساس للملوحة: يبدأ بالنقص فوق ~1.6 dS/m.", "Salt-sensitive: yield falls above ~1.6 dS/m.", "ما يصبرش على الملوحة: يبدا ينقص فوق ~1.6 dS/m."],
    ],
    vetch: [["HER08", "كبقلية، تثبّت آزوت الهواء وتغني التربة للمحصول التالي.", "As a legume, it fixes nitrogen from the air for the next crop.", "كبقلية، تجبد الآزوت من الهوا وتخلّيه للمحصول اللي من بعد."]],
  };

  // ---------------------------------------------------------------- farm context
  const sig = (t) => !!t && (t.significant != null ? t.significant : t.p < 0.05);
  const pct = (v) => Math.round(v * 100) + "%";
  const R = (x) => Math.round(x);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  function ctx() {
    let l = null; try { l = A.loc(); } catch (e) { }
    const s = S(), m = s.dataMeta || {};
    const src = m.mode === "wilaya" ? T(`بيانات ناسا لمقر ولاية ${m.wilayaAr || ""}`, `NASA data for the ${m.wilayaEn || ""} wilaya seat`, `معطيات ناسا تاع مقر ولاية ${m.wilayaAr || ""}`)
      : m.source === "ERA5" ? T("بيانات ERA5 (ليست ناسا)", "ERA5 data (not NASA)", "معطيات ERA5 (ماشي ناسا)") : m.mode === "live" ? T("بيانات ناسا لموقعك", "NASA data for your location", "معطيات ناسا تاع البلاصة تاعك")
      : m.mode === "fallback" ? T("بيانات نقطة أخرى", "data from another point", "معطيات بلاصة أخرى") : T("بيانات المثال (سيدي بلعباس)", "example data (Sidi Bel Abbès)", "معطيات المثال (سيدي بلعباس)");
    return { l, s, src, ready: !!(l && l.summary && s.locId) };
  }
  const noFarm = () => ({ t: T("أحتاج موقع أرضك أولًا. اختر موقعك من شاشة الموقع ثم اسألني من جديد.", "I need your land's location first. Choose your location, then ask me again.", "لازمني البلاصة تاع أرضك قبل. اختار البلاصة تاعك من شاشة الموقع ومن بعد عاود سقسيني."), chips: ["help", "crop_info"] });

  // ---------------------------------------------------------------- answers
  const ANS = {
    hello() { return { t: T(`أهلًا ${esc(S().name || "")}! أنا عمّي صالح. اسألني عن التطبيق، أو عن حالة محصولك، أو عن أرضك. أجيبك من بيانات مزرعتك ومن أبحاث موثّقة فقط، ولا أخمّن أبدًا.`,
      `Hello ${esc(S().name || "")}! I'm Ammi Salah. Ask me about the app, your crop, or your land. I answer only from your farm's data and checked research, and I never guess.`,
      `أهلا ${esc(S().name || "")}! أنا عمّي صالح. سقسيني على التطبيق، على الزرع تاعك، ولا على أرضك. نجاوبك غير من المعطيات تاع أرضك ومن أبحاث مأكّدة، وما نخمّنش.`), chips: ["describe", "analyse", "crop_info", "help", "can"] }; },

    can() {
      return { t: T(`هذا ما أستطيع فعله:<br>🗺️ <b>أصف أرضك</b> بكلمات بسيطة (المناخ، المطر، عطش الجو، مطر البذر، الحر، التربة)<br>🌾 <b>أحلّل محصولك</b> على مواسم ناسا الحقيقية<br>🏆 <b>أرتّب المحاصيل</b> لأرضك<br>⚖️ <b>أقيّم دورة</b> تكتبها (مثال: قمح عدس شعير) من 10<br>📚 <b>أجيب عن المحاصيل</b> من أبحاث موثّقة فقط، مع المصادر<br>🔍 <b>أعراض</b> في حقلك<br>❓ <b>أشرح التطبيق</b> خطوة بخطوة<br>🚫 <b>لا أخمّن أبدًا</b><br>🗣️ العربية، الدارجة والإنجليزية`,
        `Here's what I can do:<br>🗺️ <b>Describe your land</b> in simple words (climate, rain, air thirst, sowing rain, heat, soil)<br>🌾 <b>Analyse your crop</b> on your real NASA seasons<br>🏆 <b>Rank crops</b> for your land<br>⚖️ <b>Score a rotation</b> you type (e.g. wheat lentil barley) out of 10<br>📚 <b>Answer crop questions</b> only from checked research, with sources<br>🔍 <b>Symptoms</b> in your field<br>❓ <b>Explain the app</b> step by step<br>🚫 <b>I never guess</b><br>🗣️ Arabic, Darja and English`,
        `هاذا واش نقدر ندير:<br>🗺️ <b>نوصفلك أرضك</b> بكلام ساهل (المناخ، الشتا، عطش الجو، شتا الزريعة، السخانة، التربة)<br>🌾 <b>نحلّل الزرع تاعك</b> على مواسم ناسا الصحاح<br>🏆 <b>نرتّبلك المحاصيل</b> لأرضك<br>⚖️ <b>نقيّم دورة</b> تكتبها (مثلا: قمح عدس شعير) على 10<br>📚 <b>نجاوب على المحاصيل</b> غير من أبحاث مأكّدة، مع المصادر<br>🔍 <b>الأعراض</b> في الحقل تاعك<br>❓ <b>نفهّمك التطبيق</b> خطوة بخطوة<br>🚫 <b>ما نخمّنش أبدا</b><br>🗣️ بالعربية، بالدارجة وبالإنجليزية`), chips: ["describe", "analyse", "rotate_hint", "help"] };
    },

    guess() {
      return { t: T("آسف، لا أستطيع التخمين. 🙏 لا أعطي توقعات ولا تخمينات عن الطقس أو المردود أو أي شيء في الزراعة، لأن نصيحة خاطئة قد تكلّفك موسمًا. أستطيع بدلًا من ذلك أن أريك ما حدث فعلًا على أرضك في 30 موسمًا من بيانات ناسا، أو أحلّل محصولك بالمحاكاة على تلك المواسم.",
        "Sorry, I can't guess. 🙏 I don't give guesses or predictions about weather, yield or anything in farming, because wrong advice can cost you a season. Instead, I can show you what really happened on your land over 30 NASA seasons, or analyse your crop with a simulation on those seasons.",
        "سمحلي، ما نقدرش نخمّن. 🙏 ما نعطيش تخمينات ولا توقعات على الشتا ولا المحصول ولا أي حاجة في الفلاحة، خاطر نصيحة غالطة تقدر تخسّرلك موسم كامل. بلاصتها نقدر نوريلك واش صرا صح في أرضك في 30 موسم من معطيات ناسا، ولا نحلّلك الزرع تاعك بالمحاكاة على هاذوك المواسم."), chips: ["describe", "analyse", "data"] };
    },

    help() {
      return { t: T(`هكذا تستعمل Field Shift:<br>1️⃣ اختر موقع أرضك (GPS، الخريطة أو الإحداثيات) فنجلب بيانات ناسا لها.<br>2️⃣ أجب عن أسئلة المزرعة (المساحة، التربة، الماء، المحاصيل السابقة، أولوياتك).<br>3️⃣ في الصفحة الرئيسية ثلاثة أبواب: <b>تقرير ناسا</b>، <b>خصائص المحاصيل</b>، و<b>اللعبة</b>.<br>4️⃣ اسألني في أي وقت من زر «اسأل عمّي صالح».`,
        `How to use Field Shift:<br>1️⃣ Pick your land (GPS, map or coordinates); we fetch NASA data for it.<br>2️⃣ Answer the farm questions (area, soil, water, past crops, your priorities).<br>3️⃣ The hub has three doors: the <b>NASA report</b>, <b>crop characteristics</b> and the <b>game</b>.<br>4️⃣ Ask me any time with the "Ask Ammi Salah" button.`,
        `هكا تخدم بـ Field Shift:<br>1️⃣ اختار البلاصة تاع أرضك (GPS، الخريطة ولا الإحداثيات) ونجيبولك معطيات ناسا تاعها.<br>2️⃣ جاوب على الأسئلة تاع الفيرمة (المساحة، التربة، الماء، واش زرعت قبل، واش يهمّك).<br>3️⃣ في الصفحة الرئيسية كاين ثلاث بيبان: <b>تقرير ناسا</b>، <b>خصائص المحاصيل</b> و<b>اللعبة</b>.<br>4️⃣ سقسيني وقتما تحب من الزر «اسأل عمّي صالح».`), chips: ["help_report", "help_rot", "help_game", "help_farm"] };
    },
    help_report() { return { t: T("<b>تقرير ناسا</b> فيه ثلاث تبويبات: 🙂 <b>بكلمات بسيطة</b> (6 بطاقات بإشارة خضراء/صفراء/حمراء)، ⚖️ <b>قارن 3 دورات</b>، و📊 <b>البيانات المفصلة</b> (الاتجاهات، مطر كل موسم، التربة والانحدار). المس أي تبويب للتنقل.", "The <b>NASA report</b> has three tabs: 🙂 <b>In simple words</b> (6 cards with a green/amber/red light), ⚖️ <b>Compare 3 rotations</b>, and 📊 <b>Detailed data</b> (trends, rain of every season, soil and slope). Tap a tab to switch.", "<b>تقرير ناسا</b> فيه ثلاث خانات: 🙂 <b>بكلام ساهل</b> (6 بطاقات بضو أخضر/أصفر/أحمر)، ⚖️ <b>قارن 3 دورات</b>، و📊 <b>المعطيات بالتفصيل</b> (الاتجاهات، الشتا تاع كل موسم، التربة والطيحة). اضغط على الخانة باش تبدّل."), chips: ["help_rot", "help_game", "describe"] }; },
    help_rot() { return { t: T("في <b>قارن 3 دورات</b>: المس أي سنة لتغيير المحصول (قمح، شعير، خرطال، عدس، حمص، فول، بيقية أو بور)، ثم اضغط «قارن الدورات الثلاث». كل دورة تُحسب على مواسمك الحقيقية وتأخذ نقطة من 10 حسب أولوياتك، والأفضل يأخذ 👑 مع السبب. ويمكنك أيضًا أن تكتب لي دورة هنا، مثل: «قمح عدس شعير».", "In <b>Compare 3 rotations</b>: tap any year to change the crop (wheat, barley, oat, lentil, chickpea, faba bean, vetch or fallow), then press \"Compare my 3 rotations\". Each one is run on your real seasons and scored /10 by your priorities; the best gets a 👑 and the reason. You can also type a rotation to me here, like \"wheat lentil barley\".", "في <b>قارن 3 دورات</b>: اضغط على أي عام باش تبدّل الزرع (قمح، شعير، خرطال، عدس، حمص، فول، بيقية ولا بور)، ومن بعد اضغط «قارن الدورات الثلاثة». كل دورة تتحسب على المواسم تاعك الصحاح وتاخذ نقطة على 10 حسب واش يهمّك، واللي خير تاخذ 👑 مع السبة. وتقدر تكتبلي دورة هنا، كيما: «قمح عدس شعير»."), chips: ["rotate_hint", "best"] }; },
    help_game() { return { t: T("<b>اللعبة</b>: 12 مستوى، كل واحد تحدٍّ مناخي من مواسمك الحقيقية (جفاف، موجة حر، أمطار غزيرة، ملوحة…). في كل مستوى: المس العناصر المضيئة، اختر الأداة من الحزام، واتخذ القرار. 💡 <b>تلميح</b> يساعدك، 📊 <b>البيانات</b> تُظهر أرقام ناسا، و🔊 يكتم الصوت. أدر المزرعة بالسحب أو بأزرار الدوران.", "<b>The game</b>: 12 levels, each a climate challenge from your real seasons (drought, heatwave, heavy rain, salinity…). In each level: tap the glowing things, pick a tool from the belt, and decide. 💡 <b>Hint</b> helps, 📊 <b>Data</b> shows the NASA numbers, 🔊 mutes. Turn the farm by dragging or with the rotate buttons.", "<b>اللعبة</b>: 12 مستوى، كل واحد تحدّي من المواسم تاعك الصحاح (جفاف، سخانة، شتا قوية، ملوحة…). في كل مستوى: اضغط على الحوايج اللي يضويو، اختار الأداة، وقرّر. 💡 <b>تلميح</b> يعاونك، 📊 <b>المعطيات</b> توريلك أرقام ناسا، و🔊 يطفي الصوت. دوّر الفيرمة بالسحب ولا بأزرار الدوران."), chips: ["help_report", "help_farm"] }; },
    help_farm() { return { t: T("<b>مزارعك</b>: في أعلى الصفحة الرئيسية المس اسم المزرعة ▾ لترى مزارعك، تبدّل بينها، تضيف مزرعة جديدة، أو تغيّر موقع هذه المزرعة. كل مزرعة تحتفظ ببيانات ناسا الخاصة بها، حتى بدون إنترنت بعد أول تحميل.", "<b>Your farms</b>: at the top of the hub, tap the farm name ▾ to see your farms, switch between them, add a new one, or change this farm's location. Each farm keeps its own NASA data, even offline after the first load.", "<b>الفيرمات تاعك</b>: الفوق في الصفحة الرئيسية اضغط على اسم الفيرمة ▾ باش تشوف الفيرمات تاعك، تبدّل بيناتهم، تزيد وحدة جديدة، ولا تبدّل البلاصة تاع هاذي. كل فيرمة تحفظ معطيات ناسا تاعها، حتى بلا أنترنت من بعد أول مرة."), chips: ["help_report", "help_game"] }; },

    describe() {
      const c = ctx(); if (!c.ready) return noFarm();
      const l = c.l, tr = l.trends || {}, n = l.rain.length;
      const annP = mean(l.rain.map((r) => r.reduce((a, b) => a + b, 0))), annE = mean(l.et0.map((r) => r.reduce((a, b) => a + b, 0))), ai = annE ? annP / annE : 0;
      const aiTxt = ai < 0.05 ? T("شديد الجفاف", "hyper-arid", "ناشف بزاف") : ai < 0.2 ? T("جاف", "arid", "ناشف") : ai < 0.5 ? T("شبه جاف", "semi-arid", "شبه ناشف") : ai < 0.65 ? T("شبه رطب جاف", "dry sub-humid", "شبه رطب") : T("رطب", "humid", "رطب");
      const dot = (bad, mid) => (bad ? "🔴" : mid ? "🟡" : "🟢");
      const rain = l.summary.rain_mean, dry3 = l.summary.rain_oct_may.slice().sort((a, b) => a - b)[2];
      const etOM = mean(l.et0.map((r) => r.slice(1, 9).reduce((a, b) => a + b, 0))), cover = etOM ? rain / etOM : 0;
      const onset = tr.onset && tr.onset.late != null ? tr.onset.late : mean(l.onset.filter((x) => x != null).slice(-10));
      const d = new Date(Date.UTC(2001, 8, 1) + R(onset) * 864e5), mo = MONTHS()[(d.getUTCMonth() + 4) % 12];
      const hot = tr.hot_flowering ? tr.hot_flowering.late : mean(l.hot.map((r) => r[7] + r[8]));
      const so = l.soil || {}, paw = so.paw100;
      const lines = [
        `${dot(ai < 0.2, ai < 0.5)} ${T(`<b>المناخ:</b> ${aiTxt} (يسقط ~${R(annP)} ملم في السنة، والجو يستطيع تبخير ~${R(annE)} ملم).`, `<b>Climate:</b> ${aiTxt} (~${R(annP)} mm of rain a year, while the air could evaporate ~${R(annE)} mm).`, `<b>المناخ:</b> ${aiTxt} (تطيح ~${R(annP)} ملم في العام، والجو يقدر يبخّر ~${R(annE)} ملم).`)}`,
        `${dot(rain < 250, rain < 400)} ${T(`<b>المطر:</b> ${rain} ملم من أكتوبر إلى ماي في المتوسط؛ في 3 مواسم من ${n} نزل أقل من ${R(dry3)} ملم.`, `<b>Rain:</b> ${rain} mm Oct–May on average; in 3 of ${n} seasons less than ${R(dry3)} mm fell.`, `<b>الشتا:</b> ${rain} ملم من أكتوبر حتى ماي في المتوسط؛ في 3 مواسم من ${n} طاحت قل من ${R(dry3)} ملم.`)}`,
        `${dot(cover < 0.5, cover < 0.8)} ${T(`<b>عطش الجو:</b> المطر يغطي ${R(cover * 100)}% فقط مما يطلبه الجو؛ الباقي يجب أن تخزّنه التربة.`, `<b>Air thirst:</b> rain covers only ${R(cover * 100)}% of what the air demands; the soil must store the rest.`, `<b>عطش الجو:</b> الشتا تغطي غير ${R(cover * 100)}% من واش يطلب الجو؛ الباقي لازم التربة تخبّيه.`)}`,
        `${dot(onset > 75, onset > 45)} ${T(`<b>مطر البذر:</b> يصل حوالي ${d.getUTCDate()} ${mo} (متوسط آخر 10 مواسم).`, `<b>Sowing rain:</b> arrives around ${mo} ${d.getUTCDate()} (average of the last 10 seasons).`, `<b>شتا الزريعة:</b> تجي تقريبا ${d.getUTCDate()} ${mo} (متوسط آخر 10 مواسم).`)}${sig(tr.onset) ? T(` يتأخر ${Math.abs(tr.onset.per_decade)} يومًا كل 10 سنوات (تغيّر مؤكد).`, ` It's ${tr.onset.per_decade > 0 ? "coming later" : "coming earlier"} by ${Math.abs(tr.onset.per_decade)} days every 10 years (confirmed).`, ` راهي ${tr.onset.per_decade > 0 ? "تتأخر" : "تزرب"} ${Math.abs(tr.onset.per_decade)} يوم كل 10 سنين (مأكّد).`) : ""}`,
        `${dot(hot > 6, hot > 2)} ${T(`<b>الحر وقت الإزهار:</b> ~${hot.toFixed(1)} يوم فوق 31°م في أبريل–ماي.`, `<b>Heat at flowering:</b> ~${hot.toFixed(1)} days above 31 °C in April–May.`, `<b>السخانة وقت النوّار:</b> ~${hot.toFixed(1)} يوم فوق 31°م في أفريل–ماي.`)}`,
        `${dot(paw != null && paw < 80, paw == null || paw < 140)} ${paw != null ? T(`<b>التربة:</b> ${esc(so.texture || "")}، تخزّن ~${R(paw)} ملم يستطيع النبات شربها.`, `<b>Soil:</b> ${esc(so.texture || "")}, stores ~${R(paw)} mm the plant can drink.`, `<b>التربة:</b> ${esc(so.texture || "")}، تخبّي ~${R(paw)} ملم يقدر يشربها النبات.`) : T("<b>التربة:</b> لا توجد بيانات تربة لهذه النقطة.", "<b>Soil:</b> no soil data for this point.", "<b>التربة:</b> ما كانش معطيات تربة في هاذ البلاصة.")}`,
        `<span class="chnote">${T("المصدر:", "Source:", "المصدر:")} ${c.src} · ${esc(l.period_label || "")}</span>`,
      ];
      return { t: lines.join("<br>"), refs: ["POWER", "FAO56", "SR06", "SG21", "SEN68"], chips: ["analyse", "best", "data"] };
    },

    analyse(q) {
      const c = ctx(); if (!c.ready || !GM().cropStats) return noFarm();
      const named = cropsIn(q || "").filter((k) => k !== "fallow");
      const l = c.l, crop = named[0] || (GM().lastCrop ? GM().lastCrop() : "wheat"), hist = (c.s.farm && c.s.farm.history) || [], prev = hist.find((x) => x && x !== "unknown") || "fallow";
      let st, su; try { su = GM().suitability ? GM().suitability(crop, prev) : null; st = su ? su.st : GM().cropStats(crop, prev); } catch (e) { return noFarm(); }
      const flags = (su && su.flags) || [], tr = l.trends || {}, out = [], refs = ["POWER", "FAO56", "FAO66"];
      const lvl = su ? { ok: T("مناسب", "suitable", "يصلح"), adj: T("مناسب مع تعديلات", "suitable with adjustments", "يصلح بشوية تبديلات"), high: T("مخاطرة عالية", "high risk", "خطر كبير"), na: T("غير كافٍ", "not enough info", "ما يكفيش") }[su.level] : "";
      const pr = prev === "fallow" ? T("بور", "fallow", "بور") : cname(prev);
      out.push(T(`<b>${cname(crop)}</b> بعد ${pr} على أرضك: ${lvl ? `<b>${lvl}</b>. ` : ""}المردود المتوقع بالمحاكاة ≈ <b>${pct(st.y)}</b> من الممكن في المتوسط، و<b>${pct(st.dry || 0)}</b> في أجفّ ثلاثة مواسم.`,
        `<b>${cname(crop)}</b> after ${pr} on your land: ${lvl ? `<b>${lvl}</b>. ` : ""}simulated yield ≈ <b>${pct(st.y)}</b> of potential on average, and <b>${pct(st.dry || 0)}</b> in the three driest seasons.`,
        `<b>${cname(crop)}</b> من بعد ${pr} في أرضك: ${lvl ? `<b>${lvl}</b>. ` : ""}المحصول بالمحاكاة ≈ <b>${pct(st.y)}</b> من الممكن في المتوسط، و<b>${pct(st.dry || 0)}</b> في أنشف ثلاث مواسم.`));
      out.push(T(`💧 ضغط الماء ${pct(1 - st.ws)} في المتوسط (توازن الماء FAO-56 مع عامل Ky من FAO-66). مطر أكتوبر–ماي عندك ${l.summary.rain_mean} ملم.`, `💧 Water stress ${pct(1 - st.ws)} on average (FAO-56 water balance with the FAO-66 Ky factor). Your Oct–May rain is ${l.summary.rain_mean} mm.`, `💧 نقص الماء ${pct(1 - st.ws)} في المتوسط (حساب الماء FAO-56 مع Ky تاع FAO-66). الشتا عندك من أكتوبر حتى ماي ${l.summary.rain_mean} ملم.`));
      if (st.heatRisk > 0) { refs.push("PG99"); out.push(T(`🔥 في ${pct(st.heatRisk)} من المواسم تجاوزت الحرارة 31°م وقت الإزهار (Porter & Gawith 1999).`, `🔥 In ${pct(st.heatRisk)} of seasons Tmax passed 31 °C at flowering (Porter & Gawith 1999).`, `🔥 في ${pct(st.heatRisk)} من المواسم السخانة فاتت 31°م وقت النوّار (Porter & Gawith 1999).`)); }
      if (flags.includes("rotation")) { refs.push("ANG15"); out.push(T("🔁 نفس العائلة بعد نفسها تخفّض المردود (Angus وآخرون 2015).", "🔁 The same family after itself lowers yield (Angus et al. 2015).", "🔁 نفس العائلة من بعد روحها تنقّص المحصول (Angus 2015).")); }
      if (flags.includes("salt")) { refs.push("MH77"); out.push(T("🧂 الملوحة تحدّ هذا المحصول (Maas & Hoffman 1977).", "🧂 Salinity limits this crop (Maas & Hoffman 1977).", "🧂 الملوحة تحبس هاذ الزرع (Maas & Hoffman 1977).")); }
      if (flags.includes("broomrape")) out.push(T("🌱 بقل بعد بقل: خطر الهالوك يرتفع.", "🌱 Legume after legume: broomrape risk goes up.", "🌱 بقول من بعد بقول: خطر الهالوك يطلع."));
      if (sig(tr.onset)) { refs.push("SEN68"); out.push(T(`📅 مطر البذر يتأخر ${R(tr.onset.per_decade)} يومًا كل عقد (مؤكد إحصائيًا).`, `📅 Sowing rain comes ${R(tr.onset.per_decade)} days later per decade (statistically confirmed).`, `📅 شتا الزريعة راهي تتأخر ${R(tr.onset.per_decade)} يوم كل 10 سنين (مأكّد).`)); }
      const rank = CROPS.map((k) => { try { return [k, GM().cropStats(k, crop).y]; } catch (e) { return [k, 0]; } }).sort((a, b) => b[1] - a[1]).slice(0, 3);
      out.push(T(`✅ الأفضل بعد ${cname(crop)} على أرضك: ${rank.map(([k, y]) => `${cname(k)} (${pct(y)})`).join("، ")}.`, `✅ Best next after ${cname(crop)} on your land: ${rank.map(([k, y]) => `${cname(k)} (${pct(y)})`).join(", ")}.`, `✅ اللي خير من بعد ${cname(crop)} في أرضك: ${rank.map(([k, y]) => `${cname(k)} (${pct(y)})`).join("، ")}.`));
      out.push(`<span class="chnote">${T("المصدر:", "Source:", "المصدر:")} ${c.src}${T(" · محاكاة شهرية على مواسم حقيقية، ليست تخمينًا ولا قياسًا لحقلك", " · monthly simulation on real seasons, not a guess or a field measurement", " · محاكاة شهرية على مواسم صحاح، ماشي تخمين ولا قياس في الحقل")}</span>`);
      return { t: out.join("<br>"), refs, chips: ["best", "symptoms", "crop_info"] };
    },

    best() {
      const c = ctx(); if (!c.ready || !GM().cropStats) return noFarm();
      const prev = GM().lastCrop ? GM().lastCrop() : "wheat";
      const rows = CROPS.map((k) => { try { return [k, GM().cropStats(k, prev)]; } catch (e) { return null; } }).filter(Boolean).sort((a, b) => b[1].y - a[1].y);
      return { t: T(`ترتيب المحاصيل بعد ${cname(prev)} على أرضك (متوسط / في الأجفّ):<br>`, `Crops after ${cname(prev)} on your land (average / in dry years):<br>`, `ترتيب الزرع من بعد ${cname(prev)} في أرضك (المتوسط / في العام الناشف):<br>`)
        + rows.map(([k, s], i) => `${i + 1}. <b>${cname(k)}</b> ${pct(s.y)} / ${pct(s.dry || 0)}${s.heatRisk > 0.35 ? " 🔥" : ""}${s.rotPen < 1 ? " 🔁" : ""}`).join("<br>")
        + `<br><span class="chnote">🔥 ${T("حرارة عند الإزهار", "heat at flowering", "سخانة وقت النوّار")} · 🔁 ${T("عقوبة الدورة", "rotation penalty", "نفس العائلة")} · ${c.src}</span>`, refs: ["FAO56", "FAO66", "ANG15", "PG99"], chips: ["rotate_hint", "analyse"] };
    },

    rotation(q) {
      const c = ctx(); if (!c.ready || !window.FS_REPORT) return noFarm();
      const seq = cropsIn(q).slice(0, 3);
      if (seq.length < 2) return ANS.rotate_hint();
      let r; try { r = window.FS_REPORT.evalRot(seq); } catch (e) { return noFarm(); }
      const LB = { production: T("المحصول", "Harvest", "المحصول"), drought: T("السنوات الجافة", "Dry years", "العام الناشف"), water: T("الماء", "Water", "الماء"), soil: T("صحة التربة", "Soil health", "صحة التربة"), pest: T("الآفات", "Pests", "الحشرات والمرض") };
      const bars = Object.keys(LB).map((k) => `${LB[k]}: <b>${R(r.scores[k] / 10)}</b>/10`).join(" · ");
      const weak = Object.keys(LB).sort((x, y) => r.scores[x] - r.scores[y])[0];
      return { t: T(`⚖️ الدورة <b>${seq.map(cname).join(" ← ")}</b> على أرضك: <b>${r.out10.toFixed(1)}/10</b><br>${bars}<br>نقطة ضعفها: ${LB[weak]}. جرّب دورات أخرى في «قارن 3 دورات» في تقرير ناسا.`,
        `⚖️ Rotation <b>${seq.map(cname).join(" → ")}</b> on your land: <b>${r.out10.toFixed(1)}/10</b><br>${bars}<br>Weak point: ${LB[weak]}. Try others in "Compare 3 rotations" in the NASA report.`,
        `⚖️ الدورة <b>${seq.map(cname).join(" ← ")}</b> في أرضك: <b>${r.out10.toFixed(1)}/10</b><br>${bars}<br>النقطة الضعيفة: ${LB[weak]}. جرّب دورات أخرى في «قارن 3 دورات» في تقرير ناسا.`)
        + `<br><span class="chnote">${T("محاكاة على", "Simulated on", "محاكاة على")} ${c.l.rain.length} ${T("موسمًا حقيقيًا · ", "real seasons · ", "موسم صحيح · ")}${c.src}</span>`, refs: ["FAO56", "FAO66", "ANG15", "HER08"], chips: ["best", "help_rot"] };
    },
    rotate_hint() { return { t: T("اكتب لي دورة من 2 أو 3 محاصيل بالترتيب، مثل: «قمح عدس شعير» أو «wheat faba barley»، وسأعطيها نقطة من 10 على أرضك.", "Type a rotation of 2 or 3 crops in order, like \"wheat lentil barley\" or \"قمح فول شعير\", and I'll score it out of 10 on your land.", "كتبلي دورة فيها 2 ولا 3 محاصيل بالترتيب، كيما: «قمح عدس شعير» ولا «قمح فول شعير»، ونعطيهالك نقطة على 10 في أرضك."), chips: ["best", "help_rot"] }; },

    crop_info(q) {
      const k = cropsIn(q || "").filter((x) => x !== "fallow")[0];
      if (!k) return { t: T("عن أي محصول؟", "Which crop?", "على أنهي زرع؟"), chips: CROPS.map((c) => "c_" + c) };
      const C = E() && E().CROPS[ENG[k]], f = FACTS[k] || [], M = MONTHS(), ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const lines = [];
      if (C) {
        const sow = M[ORDER[C.sow]] || "", flw = C.flower >= 0 ? M[ORDER[C.sow + C.flower]] : null, kc = Math.max(...C.kc), legume = C.family === "legume";
        lines.push(T(`<b>${cname(k)}</b> · ${legume ? "بقلية تثبّت الآزوت" : C.family === "cereal" ? "من الحبوب" : ""} · ${C.product === "forage" ? "علف" : "حبوب"}`, `<b>${cname(k)}</b> · ${legume ? "legume, fixes nitrogen" : C.family === "cereal" ? "cereal" : ""} · ${C.product === "forage" ? "forage" : "grain"}`, `<b>${cname(k)}</b> · ${legume ? "من البقول، تجبد الآزوت" : C.family === "cereal" ? "من الحبوب" : ""} · ${C.product === "forage" ? "علف" : "حب"}`));
        lines.push(T(`📅 البذر في ${sow}${flw ? `، الإزهار حوالي ${flw}` : ""} · 🌱 جذور حتى ~${C.root} سم`, `📅 Sown in ${sow}${flw ? `, flowers around ${flw}` : ""} · 🌱 roots to ~${C.root} cm`, `📅 الزريعة في ${sow}${flw ? `، النوّار تقريبا في ${flw}` : ""} · 🌱 العروق حتى ~${C.root} سم`));
        lines.push(T(`💧 حاجته للماء = Kc × ET0، وKc الأقصى ${kc} (FAO-56). حساسيته لنقص الماء Ky = ${C.ky} (FAO-66): ${C.ky > 1 ? "أكثر من 1، أي حساس" : "حوالي 1"}.`, `💧 Water need = Kc × ET0, peak Kc ${kc} (FAO-56). Sensitivity to water shortage Ky = ${C.ky} (FAO-66): ${C.ky > 1 ? "above 1, so sensitive" : "about 1"}.`, `💧 الماء اللي يحتاجو = Kc × ET0، وKc الأكبر ${kc} (FAO-56). كيفاش يتأثر بنقص الماء Ky = ${C.ky} (FAO-66): ${C.ky > 1 ? "كثر من 1، يعني حساس" : "تقريبا 1"}.`));
      }
      f.forEach(([ref, ar, en, dz]) => lines.push(`📚 ${T(ar, en, dz)}`));
      const refs = ["FAO56", "FAO66", ...new Set(f.map((x) => x[0]))];
      lines.push(`<span class="chnote">${T("القيم أعلاه هي ما يستعمله محرّك Field Shift، والجمل 📚 من الأبحاث المذكورة في المصادر.", "Values above are those used by the Field Shift engine; 📚 lines come from the papers listed under Sources.", "الأرقام الفوق هوما اللي يخدم بيهم Field Shift، والجمل 📚 من الأبحاث اللي في المصادر.")}</span>`);
      return { t: lines.join("<br>"), refs, chips: ["analyse_" + k, "best", "crop_info"] };
    },

    data() {
      const c = ctx(); if (!c.ready) return noFarm();
      const l = c.l, tr = l.trends || {}, d = (l.summary.driest || []).map((i) => (window.FS_DATA.seasons || [])[i]).filter(Boolean);
      const t = (k, unit, en, ar, dz) => tr[k] ? T(`• ${ar}: ${tr[k].early} ← ${tr[k].late} ${unit} (${sig(tr[k]) ? "تغيّر مؤكد" : "غير مؤكد؛ لا نسميه اتجاهًا"})`, `• ${en}: ${tr[k].early} → ${tr[k].late} ${unit} (${sig(tr[k]) ? "confirmed change" : "not significant, not a trend"})`, `• ${dz}: ${tr[k].early} ← ${tr[k].late} ${unit} (${sig(tr[k]) ? "تبدّل مأكّد" : "ماشي مأكّد"})`) : "";
      return { t: T(`أرقام أرضك (${c.src}):<br>• مطر أكتوبر–ماي: ${l.summary.rain_mean} ملم${d.length ? `؛ أجفّ المواسم: ${d.join("، ")}` : ""}.<br>`, `Your land's numbers (${c.src}):<br>• Oct–May rain: ${l.summary.rain_mean} mm${d.length ? `; driest seasons: ${d.join(", ")}` : ""}.<br>`, `الأرقام تاع أرضك (${c.src}):<br>• الشتا من أكتوبر حتى ماي: ${l.summary.rain_mean} ملم${d.length ? `؛ أنشف المواسم: ${d.join("، ")}` : ""}.<br>`)
        + [t("rain", T("ملم", "mm", "ملم"), "Oct–May rain", "مطر أكتوبر–ماي", "الشتا"), t("et0", T("ملم", "mm", "ملم"), "Air water demand ET0", "طلب الجو للماء ET0", "عطش الجو ET0"), t("onset", T("يوم", "days", "يوم"), "Sowing-rain day (after 1 Sep)", "يوم مطر البذر (بعد 1 سبتمبر)", "نهار شتا الزريعة (من بعد 1 سبتمبر)"), t("tmean", "°C", "Mean temperature", "متوسط الحرارة", "السخانة في المتوسط"), t("hot_flowering", T("يوم", "days", "يوم"), "Hot days in Apr–May", "أيام حارة في أبريل–ماي", "أيام السخانة في أفريل–ماي")].filter(Boolean).join("<br>"),
        refs: ["POWER", "FAO56", "SEN68"], chips: ["describe", "analyse"] };
    },
    water() { const c = ctx(), rain = c.ready ? c.l.summary.rain_mean : null; return { t: T(`${rain ? `مطرك ≈ ${rain} ملم. ` : ""}عندما يقل الماء عن حاجة المحصول (Kc × ET0) ينخفض المردود بنسبة Ky × نقص التبخر (FAO-66). في تجارب ICARDA زاد مردود القمح خطيًا مع الماء فوق ~200 ملم (Zhang & Oweis 1999)، وريّة تكميلية قليلة في المراحل الحرجة ترفع المردود وتثبّته (Oweis & Hachum 2006).`, `${rain ? `Your rain ≈ ${rain} mm. ` : ""}When water falls below the crop's need (Kc × ET0), yield drops by Ky × the ET deficit (FAO-66). In ICARDA trials wheat yield rose linearly with water above ~200 mm (Zhang & Oweis 1999), and a little supplemental irrigation at critical stages raises and stabilises yield (Oweis & Hachum 2006).`, `${rain ? `الشتا عندك ≈ ${rain} ملم. ` : ""}كي الماء ينقص على واش يحتاج الزرع (Kc × ET0)، المحصول ينقص بـ Ky × النقص (FAO-66). في تجارب ICARDA القمح زاد كل ما زاد الماء فوق ~200 ملم (Zhang & Oweis 1999)، وشوية سقي في الوقت الصح يطلّع المحصول ويثبّتو (Oweis & Hachum 2006).`), refs: ["FAO56", "FAO66", "ZO99", "OH06"], chips: ["analyse", "soil"] }; },
    heat() { const c = ctx(), h = c.ready && c.l.trends && c.l.trends.hot_flowering; return { t: T(`فوق 31°م وقت الإزهار يقل نجاح التلقيح في القمح (Porter & Gawith 1999).${h ? ` عندك: ${h.early} ← ${h.late} يومًا (${sig(h) ? "مؤكد" : "غير مؤكد"}).` : ""} عالميًا يُقدَّر نقص إنتاج القمح ~6% لكل درجة احترار (Asseng 2015). الحلول: صنف أبكر، بذر عند وصول مطر البذر، أو الشعير.`, `Above 31 °C at flowering, pollination in wheat drops (Porter & Gawith 1999).${h ? ` Yours: ${h.early} → ${h.late} days (${sig(h) ? "confirmed" : "not significant"}).` : ""} Globally, wheat output is estimated to fall ~6% per °C of warming (Asseng 2015). Options: an earlier variety, sowing when the sowing rain arrives, or barley.`, `كي السخانة تفوت 31°م وقت النوّار، التلقيح في القمح ينقص (Porter & Gawith 1999).${h ? ` عندك: ${h.early} ← ${h.late} يوم (${sig(h) ? "مأكّد" : "ماشي مأكّد"}).` : ""} في العالم يقدّرو بلي القمح ينقص ~6% على كل درجة (Asseng 2015). الحلول: صنف يبكّر، تزرع كي تجي شتا الزريعة، ولا الشعير.`), refs: ["PG99", "ASS15", "POWER"], chips: ["analyse", "sowing"] }; },
    soil() { const c = ctx(), so = c.ready && c.l.soil; return { t: T(`${so && so.texture ? `تربتك: ${esc(so.texture)}، تخزّن ~${so.paw100} ملم. ` : ""}نحسب الماء المتاح من الرمل والطين والمادة العضوية (Saxton & Rawls 2006)، وخرائط SoilGrids 2.0 تقديرية بدقة 250 م (Poggio 2021)؛ جوابك عن تربتك يُستعمل إن أعطيته.`, `${so && so.texture ? `Your soil: ${esc(so.texture)}, stores ~${so.paw100} mm. ` : ""}We compute available water from sand, clay and organic matter (Saxton & Rawls 2006); SoilGrids 2.0 maps are 250 m estimates (Poggio 2021), and your own soil answer is used when you give it.`, `${so && so.texture ? `التربة تاعك: ${esc(so.texture)}، تخبّي ~${so.paw100} ملم. ` : ""}نحسبو الماء من الرمل والطين والمادة العضوية (Saxton & Rawls 2006)؛ خرائط SoilGrids تقريبية بـ 250 م (Poggio 2021)، وإذا قلتلنا واش من تربة عندك نخدمو بيها.`), refs: ["SR06", "SG21"], chips: ["water", "analyse"] }; },
    rotation_info() { return { t: T("القمح بعد محصول كسر يعطي أكثر: من ~0.5 طن/هكتار بعد الخرطال إلى ~1.2 بعد البقول (Angus 2015). البقول تثبّت الآزوت (Herridge 2008)، والفول ينفع المحصول التالي (Jensen 2010؛ Köpke & Nemecek 2010).", "Wheat after a break crop yields more: ~0.5 t/ha after oats up to ~1.2 after grain legumes (Angus 2015). Legumes fix nitrogen (Herridge 2008), and faba bean benefits the next crop (Jensen 2010; Köpke & Nemecek 2010).", "القمح من بعد محصول آخر يعطي كثر: ~0.5 طن/هكتار من بعد الخرطال حتى ~1.2 من بعد البقول (Angus 2015). البقول تجبد الآزوت (Herridge 2008)، والفول ينفع اللي يجي من بعدو (Jensen 2010؛ Köpke & Nemecek 2010)."), refs: ["ANG15", "HER08", "JEN10", "KN10"], chips: ["rotate_hint", "best"] }; },
    salt() { return { t: T("نموذج Maas & Hoffman (1977): لا ينقص المردود حتى عتبة، ثم ينقص بميل ثابت: الشعير ~8.0 dS/m، القمح ~6.0، والفول حساس (~1.6).", "Maas & Hoffman (1977): yield holds up to a threshold, then falls at a fixed slope: barley ~8.0 dS/m, wheat ~6.0, faba bean sensitive (~1.6).", "Maas & Hoffman (1977): المحصول ما ينقصش حتى حد معيّن، ومن بعد ينقص: الشعير ~8.0 dS/m، القمح ~6.0، والفول ما يصبرش (~1.6)."), refs: ["MH77"], chips: ["best", "symptoms"] }; },
    sowing() { const c = ctx(), o = c.ready && c.l.trends && c.l.trends.onset; return { t: T(`«مطر البذر» = أول يوم بعد 1 سبتمبر يصل فيه مجموع 3 أيام إلى 20 ملم (من بيانات ناسا اليومية).${o ? ` عندك: من ${o.early} إلى ${o.late} يومًا بعد 1 سبتمبر (${sig(o) ? "مؤكد" : "غير مؤكد"}).` : ""}`, `"Sowing rain" = first day after 1 Sep whose 3-day total reaches 20 mm (NASA daily data).${o ? ` Yours: from ${o.early} to ${o.late} days after 1 Sep (${sig(o) ? "confirmed" : "not significant"}).` : ""}`, `«شتا الزريعة» = أول نهار من بعد 1 سبتمبر اللي فيه 3 أيام شتا يوصلو 20 ملم (معطيات ناسا).${o ? ` عندك: من ${o.early} حتى ${o.late} يوم من بعد 1 سبتمبر (${sig(o) ? "مأكّد" : "ماشي مأكّد"}).` : ""}`), refs: ["POWER", "SEN68"], chips: ["heat", "analyse"] }; },
    frost() { const c = ctx(), f = c.ready && c.l.trends && c.l.trends.frost; return { t: T(`يوم الصقيع = الحرارة الدنيا تحت 0°م (ناسا).${f ? ` عندك: ${f.early} ← ${f.late} يومًا في الموسم.` : ""}`, `A frost day = minimum below 0 °C (NASA).${f ? ` Yours: ${f.early} → ${f.late} days per season.` : ""}`, `نهار الجليد = السخانة الصغيرة تحت 0°م (ناسا).${f ? ` عندك: ${f.early} ← ${f.late} يوم في الموسم.` : ""}`), refs: ["POWER", "SEN68"], chips: ["heat", "analyse"] }; },
    et0() { return { t: T("ET0 = «عطش الجو»: الماء الذي يبخّره عشب مرجعي مسقي جيدًا، نحسبه يوميًا بمعادلة بنمان–مونتيث (FAO-56) من حرارة ناسا ورطوبتها وريحها وإشعاعها. حاجة المحصول = Kc × ET0.", "ET0 = the air's thirst: water a well-watered reference grass would evaporate, computed daily with Penman–Monteith (FAO-56) from NASA temperature, humidity, wind and sunshine. Crop need = Kc × ET0.", "ET0 = «عطش الجو»: الماء اللي يبخّرو حشيش مسقي مليح، نحسبوه كل نهار بمعادلة بنمان–مونتيث (FAO-56) من السخانة والرطوبة والريح والشمس تاع ناسا. الزرع يحتاج Kc × ET0."), refs: ["FAO56", "POWER"], chips: ["water", "data"] }; },
    symptoms() { return { t: T("ما الذي تراه في حقلك؟", "What do you see in your field?", "واش راك تشوف في الحقل تاعك؟"), chips: ["s_yellow", "s_wilt", "s_crust", "s_gaps"] }; },
    s_yellow() { return { t: T("اصفرار الأوراق السفلية أولًا يدل غالبًا على نقص الآزوت، خاصة في القمح بعد القمح؛ البقول قبل القمح تزيده (Herridge 2008؛ Jensen 2010). هذا دليل تقريبي، والتأكيد بتحليل التربة أو مرشد زراعي.", "Yellowing that starts on lower leaves usually points to nitrogen shortage, especially wheat after wheat; a legume before wheat raises it (Herridge 2008; Jensen 2010). This is a rough guide; confirm with a soil test or an extension agent.", "كي الورق اللي لتحت يصفار هو الأول، غالبا نقص الآزوت، خاصة القمح من بعد القمح؛ البقول قبل القمح تزيدو (Herridge 2008؛ Jensen 2010). هاذا غير دليل، أكّد بتحليل التربة ولا مرشد فلاحي."), refs: ["HER08", "JEN10"], chips: ["rotation_info", "analyse"] }; },
    s_wilt() { return { t: T("الذبول وسط النهار مع تربة جافة = نقص ماء: الحاجة (Kc × ET0) أكبر من المخزون. ريّة تكميلية عند الإزهار هي الأنفع (Oweis & Hachum 2006).", "Midday wilting with dry soil = water stress: demand (Kc × ET0) is bigger than the store. One supplemental irrigation at flowering helps most (Oweis & Hachum 2006).", "كي يذبل في نص النهار والتربة ناشفة = نقص الماء: يحتاج (Kc × ET0) كثر من واش كاين. سقية وحدة وقت النوّار هي اللي تنفع كثر (Oweis & Hachum 2006)."), refs: ["FAO56", "OH06"], chips: ["water", "analyse"] }; },
    s_crust() { return { t: T("قشرة بيضاء بعد السقي غالبًا أملاح. قِس ملوحة التربة: القمح ينقص فوق ~6 dS/m، الشعير يتحمل حتى ~8، والفول حساس جدًا (Maas & Hoffman 1977).", "A white crust after irrigation is usually salt. Measure soil salinity: wheat loses yield above ~6 dS/m, barley tolerates ~8, faba bean is very sensitive (Maas & Hoffman 1977).", "القشرة البيضا من بعد السقي غالبا ملح. قيس الملوحة: القمح ينقص فوق ~6 dS/m، الشعير يصبر حتى ~8، والفول ما يصبرش (Maas & Hoffman 1977)."), refs: ["MH77"], chips: ["salt", "best"] }; },
    s_gaps() { return { t: T("فراغات وضعف إنبات غالبًا من البذر قبل مطر كافٍ؛ انتظر ~20 ملم في 3 أيام.", "Gaps and poor emergence usually come from sowing before enough rain; wait for ~20 mm over 3 days.", "الفراغات والنبتة الضعيفة غالبا من الزريعة قبل ما تجي الشتا الكافية؛ استنّى ~20 ملم في 3 أيام."), refs: ["POWER"], chips: ["sowing", "analyse"] }; },
    sources() { return { t: T("المكتبة التي أجيب منها (تحققنا من المؤلفين والمجلة والرابط):", "The library I answer from (authors, journal and link checked):", "المكتبة اللي نجاوب منها (حقّقنا في الكتّاب والمجلة والرابط):"), refs: Object.keys(LIB), open: true, chips: ["crop_info", "can"] }; },
    unknown() { return { t: T("لا أملك جوابًا موثّقًا عن هذا في مكتبتي، ولا أريد أن أخمّن. اختر سؤالًا من الأزرار أو اكتب «ماذا تستطيع؟».", "I don't have a checked answer to that in my library, and I won't guess. Pick a button or type \"what can you do?\".", "ما عنديش جواب مأكّد على هاذي في المكتبة تاعي، وما نحبش نخمّن. اختار سؤال من الأزرار ولا كتب «واش تقدر دير؟»."), chips: ["can", "describe", "analyse", "help"] }; },
  };
  CROPS.forEach((k) => { ANS["c_" + k] = () => ANS.crop_info(k); ANS["analyse_" + k] = () => ANS.analyse(k); });

  const CHIP = () => ({
    describe: T("🗺️ صف أرضي", "🗺️ Describe my land", "🗺️ وصفلي أرضي"), analyse: T("🌾 حلّل محصولي", "🌾 Analyse my crop", "🌾 حلّلي الزرع تاعي"), best: T("🏆 أي محصول أفضل؟", "🏆 Best crop for my land?", "🏆 واش من زرع خير؟"),
    crop_info: T("📚 معلومات محصول", "📚 Crop facts", "📚 معلومات على زرع"), rotate_hint: T("⚖️ قيّم دورتي", "⚖️ Score my rotation", "⚖️ قيّملي الدورة"), help: T("❓ كيف أستعمل التطبيق؟", "❓ How do I use the app?", "❓ كيفاش نخدم بالتطبيق؟"),
    help_report: T("📊 التقرير", "📊 The report", "📊 التقرير"), help_rot: T("⚖️ مقارنة الدورات", "⚖️ Comparing rotations", "⚖️ مقارنة الدورات"), help_game: T("🎮 اللعبة", "🎮 The game", "🎮 اللعبة"), help_farm: T("🏠 مزارعي", "🏠 My farms", "🏠 الفيرمات تاعي"),
    can: T("✨ ماذا تستطيع؟", "✨ What can you do?", "✨ واش تقدر دير؟"), sources: T("📚 المصادر", "📚 Sources", "📚 المصادر"), data: T("🛰️ أرقام أرضي", "🛰️ My land's numbers", "🛰️ الأرقام تاع أرضي"),
    water: T("💧 الماء والسقي", "💧 Water", "💧 الماء والسقي"), heat: T("🔥 الحرارة", "🔥 Heat", "🔥 السخانة"), soil: T("🟫 التربة", "🟫 Soil", "🟫 التربة"), rotation_info: T("🔁 الدورة الزراعية", "🔁 Rotation", "🔁 الدورة"),
    salt: T("🧂 الملوحة", "🧂 Salinity", "🧂 الملوحة"), sowing: T("📅 مطر البذر", "📅 Sowing rain", "📅 شتا الزريعة"), symptoms: T("🔍 أعراض في حقلي", "🔍 Symptoms in my field", "🔍 حاجة ماشي مليحة في الحقل"),
    s_yellow: T("اصفرار الأوراق", "Yellow leaves", "الورق يصفار"), s_wilt: T("ذبول", "Wilting", "يذبل"), s_crust: T("قشرة بيضاء", "White crust", "قشرة بيضا"), s_gaps: T("إنبات ضعيف", "Poor emergence", "ما نبتش مليح"),
    ...Object.fromEntries(CROPS.map((k) => ["c_" + k, cname(k)])), ...Object.fromEntries(CROPS.map((k) => ["analyse_" + k, T(`🌾 حلّل ${cname(k)} على أرضي`, `🌾 Analyse ${cname(k)} on my land`, `🌾 حلّلي ${cname(k)} في أرضي`)])),
  });

  // ---------------------------------------------------------------- intent matching (order matters: guess first)
  const INTENTS = [
    ["guess", /\bguess|predict|forecast|prophe|will it rain|rain tomorrow|next (year|season).*(rain|yield|harvest|weather)|خمّن|خمن|تخمين|بالتخمين|تنبّأ|تنبأ|(^|\s)(توقّع|توقع|تتوقع|نتوقع|تتوقّع)|تظن|غدوة|غدا تشتي|العام الجاي|nkhamem|khamen|khamem|tkhamem|ghodwa/i],
    ["can", /what can you|your functions|what do you do|help me with what|ماذا تستطيع|ماذا تفعل|وظائف|واش تقدر|واش تدير|واش تعرف دير|wesh t9der|chnou t9der/i],
    ["sources", /source|paper|reference|research|study|مصدر|مصادر|مراجع|مرجع|بحث|أبحاث|دراس/i],
    ["s_yellow", /yellow|اصفر|صفراء|يصفار|صفار/i], ["s_wilt", /wilt|ذبول|ذابل|يذبل|ذبلان/i], ["s_crust", /crust|white|قشرة|بيضاء|بيضا|بياض/i], ["s_gaps", /emerg|\bgaps?\b|germinat|إنبات|انبات|فراغ|ما نبتش|ما طلعش/i],
    ["symptoms", /symptom|disease|sick|أعراض|مرض|مريض|مريضة|فيه حاجة/i],
    ["help_report", /(\bhow\b|\buse\b|كيف|كيفاش).*(report|تقرير)|report tab/i],
    ["help_rot", /(\bhow\b|\buse\b|كيف|كيفاش).*(compare|rotation|مقارن|دورة|دورات)/i],
    ["help_game", /(\bhow\b|\buse\b|كيف|كيفاش).*(game|level|play|لعبة|اللعبة|مستوى|نلعب|ألعب)/i],
    ["help_farm", /(\bhow\b|كيف|كيفاش).*(farms?\b|location|فيرمة|مزرعة|موقع|بلاصة)|add (a )?farm|change (my )?location/i],
    ["describe", /describe|summary|summari[sz]e|my land|(^|\s)(صف|صِف|وصف|وصّف|لخّص|لخص)(\s|$)|وصفلي|وصّفلي|لخصلي|أرضي|ارضي|أرض تاعي|الارض تاعي|الأرض تاعي|ardi/i],
    ["rotation", /rotation|sequence|\bscore|\brate\b|compare|دورة|دورتي|تناوب|قيّم|قيّملي|قيملي|(^|\s)قيم(\s|$)|نقطة|قارن|→|->|←/i],
    ["analyse", /analy|\bstatus|my crop|my plant|how is my|حلل|حلّل|تحليل|حالة|محصولي|نباتي|زرعي|الزرع تاعي/i],
    ["best", /best|which crop|recommend|choose|suggest|plant what|what should i (plant|grow)|أفضل|أي محصول|ماذا أزرع|انصح|اقترح|اختار|واش نزرع|واش من زرع|شنو نزرع/i],
    ["salt", /salt|salin|\bec\b|ملوح|ملح|مالح/i], ["frost", /frost|freez|صقيع|جليد|الجليد/i],
    ["sowing", /\bsow|onset|\bseeds?\b|plant(ing)? date|بذر|زريعة|موعد|مطر البذر|شتا الزريعة|وقتاش نزرع/i],
    ["heat", /heat|\bhot\b|temperat|warm|حرار|سخان|احترار|(^|\s)(حر|الحر)(\s|$|[؟?])/i],
    ["et0", /et0|\beto\b|evapo|تبخر|تبخّر/i],
    ["rotation_info", /legume|nitrogen|break crop|fertili|بقول|بقولي|آزوت|ازوت|نيتروجين|سماد|غبار/i],
    ["soil", /soil|clay|sand|paw|تربة|طين|رمل/i],
    ["water", /\b(water|irrig|drought|dry|rain)|ماء|مياه|سقي|نسقي|جفاف|ناشف|شتا|مطر/i],
    ["data", /nasa|\bdata\b|numbers?\b|trend|ناسا|بيانات|أرقام|معطيات|اتجاه/i],
    ["help", /\bhow\b|\buse\b|\bplay\b|\bstart|button|\bhelp\b|كيف|كيفاش|استعمل|نخدم|ألعب|ابدأ|مساعدة|ساعد|عاوني|عاونّي/i],
    ["hello", /^(hi|hello|salam|slm|hey|السلام|سلام|مرحبا|أهلا|اهلا|صباح|مساء)/i],
  ];
  function intentOf(q) {
    const crops = cropsIn(q);
    for (const [k, re] of INTENTS) {
      if (!re.test(q)) continue;
      if (k === "rotation" && crops.length < 2) return crops.length ? "crop_info" : "help_rot";
      if (k === "analyse" || k === "best" || k === "guess" || k.startsWith("help") || k === "can" || k === "sources" || k.startsWith("s_") || k === "symptoms" || k === "describe") return k;
      if (crops.length === 1 && ["water", "heat", "salt", "soil", "sowing", "frost", "rotation_info", "data", "et0"].includes(k)) return "crop_info";
      return k;
    }
    if (crops.filter((c) => c !== "fallow").length >= 2) return "rotation";
    if (crops.length === 1) return "crop_info";
    return "unknown";
  }

  // ---------------------------------------------------------------- UI
  let LOG = [];
  const bubble = (role, html, refs, open) => `<div class="chmsg ${role}">${role === "bot" ? `<span class="chava">${A.salah(34)}</span>` : ""}<div class="chb">${html}${refs ? srcHTML(refs).replace("<details", open ? "<details open" : "<details") : ""}</div></div>`;
  const chipsHTML = (keys) => { const C = CHIP(); return (keys || []).filter((k) => C[k]).map((k) => `<button class="chchip" data-q="${k}">${C[k]}</button>`).join(""); };
  function render() {
    const box = document.getElementById("chLog"); if (!box) return;
    box.innerHTML = LOG.map((m) => bubble(m.role, m.html, m.refs, m.open)).join("");
    const last = LOG[LOG.length - 1]; document.getElementById("chChips").innerHTML = chipsHTML(last && last.chips);
    box.scrollTop = box.scrollHeight;
  }
  function answer(key, q) {
    let r; try { r = (ANS[key] || ANS.unknown)(q); } catch (e) { r = ANS.unknown(); }
    LOG.push({ role: "bot", html: r.t, refs: r.refs, open: r.open, chips: r.chips });
  }
  function setLang(l) {
    CL = l; const ov = document.getElementById("chatOv"); if (!ov) return;
    ov.setAttribute("dir", l === "en" ? "ltr" : "rtl");
    ov.querySelectorAll(".chlang button").forEach((b) => b.classList.toggle("on", b.dataset.l === l));
    const hb = ov.querySelector(".chhead b"); if (hb) hb.textContent = T("عمّي صالح", "Ammi Salah", "عمّي صالح");
    const h = ov.querySelector(".chhead small"); if (h) h.textContent = T("مساعدك الزراعي · يجيب من بيانات أرضك وأبحاث موثّقة · لا يخمّن", "Your farm helper · answers from your land's data and checked research · never guesses", "المعاون تاعك · يجاوب من معطيات أرضك ومن أبحاث مأكّدة · ما يخمّنش");
    const i = document.getElementById("chText"); if (i) i.placeholder = T("اكتب سؤالك…", "Type your question…", "كتب السؤال تاعك…");
  }
  function ask(text, key) {
    if (!key) { const d = detectLang(text); if (d !== lang()) setLang(d); }
    LOG.push({ role: "me", html: esc(text) });
    render();
    const box = document.getElementById("chLog"); box.insertAdjacentHTML("beforeend", `<div class="chmsg bot typing"><span class="chava">${A.salah(34)}</span><div class="chb"><i></i><i></i><i></i></div></div>`); box.scrollTop = box.scrollHeight;
    setTimeout(() => { answer(key || intentOf(text), text); render(); try { GM().snd && GM().snd("tap"); } catch (e) { } }, 500);
  }
  function open() {
    if (document.getElementById("chatOv")) return;
    const ov = document.createElement("div"); ov.id = "chatOv"; ov.className = "chov";
    ov.innerHTML = `<div class="chsheet" role="dialog" aria-label="Ammi Salah">
      <div class="chhead"><span class="chava big">${A.salah(46, "wave1")}</span><div style="flex:1;min-width:0"><b>${T("عمّي صالح", "Ammi Salah", "عمّي صالح")}</b><small></small></div>
        <div class="chlang" role="group" aria-label="Language"><button data-l="ar">ع</button><button data-l="dz">دارجة</button><button data-l="en">EN</button></div>
        <button class="chx" data-c="close" aria-label="Close">✕</button></div>
      <div class="chlog" id="chLog" aria-live="polite"></div>
      <div class="chchips" id="chChips"></div>
      <form class="chin" id="chForm" autocomplete="off"><input id="chText" maxlength="240"><button class="chsend" aria-label="Send">➤</button></form></div>`;
    document.body.appendChild(ov);
    setLang(lang());
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-c=close]")) return close();
      const lb = e.target.closest(".chlang button"); if (lb) { setLang(lb.dataset.l); LOG = LOG.slice(); answer("hello"); render(); return; }
      const c = e.target.closest(".chchip"); if (c) ask(c.textContent, c.dataset.q);
    });
    document.getElementById("chForm").addEventListener("submit", (e) => { e.preventDefault(); const i = document.getElementById("chText"), q = i.value.trim(); if (!q) return; i.value = ""; ask(q); });
    if (!LOG.length) answer("hello");
    render();
    requestAnimationFrame(() => ov.classList.add("on"));
  }
  function close() { const ov = document.getElementById("chatOv"); if (!ov) return; ov.classList.remove("on"); setTimeout(() => ov.remove(), 250); }
  A.ACT.chatOpen = () => open();

  // floating button on calm screens
  const FAB_ON = /^(lang|location|manual|profile|farm|hub|nasa|crops|map|report|lvlResult)$/;
  function syncFab() {
    let b = document.getElementById("chFab");
    const show = S().lang && FAB_ON.test(S().screen || "");
    if (!show) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("button"); b.id = "chFab"; b.className = "chfab"; b.addEventListener("click", open); document.body.appendChild(b); }
    const ar = S().lang !== "en";
    b.setAttribute("aria-label", ar ? "تحدث مع عمّي صالح" : "Talk to Ammi Salah");
    b.innerHTML = `${A.salah(44)}<span>${ar ? "اسأل عمّي صالح" : "Ask Ammi Salah"}</span>`;
  }
  const app = document.getElementById("app");
  if (app) new MutationObserver(() => syncFab()).observe(app, { childList: true });
  setTimeout(syncFab, 50);

  window.FS_CHAT = { open, close, ask, intentOf, detectLang, setLang, cropsIn, LIB, ANS, FACTS };
})();
