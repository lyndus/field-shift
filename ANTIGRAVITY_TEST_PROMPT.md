# Prompt for Antigravity – run the Field Shift test cases and capture screenshots

You are the QA tester for **Field Shift**, our NASA Space Apps 2026 web app: a farm decision tool plus a 3D game.
Run all **150 test cases** in `TEST_CASES.md` in order, take screenshots, and record PASS or FAIL for each.
You only test. You never fix code, and you never change the app's files.

## 0. Safety rules (always apply)
- Never write passwords, tokens or API keys anywhere: not in files, not in notes, not in screenshots. If a page shows a secret, close it and do not capture it.
- Never log in to anything. Never submit forms or accept agreements, licences or EULAs on any account.
- Never create AppEEARS tasks or any other jobs on NASA or Earthdata accounts.
- Never edit, move or delete anything in `data/raw/` or in the app's `data/` folder.
- Keep live NASA POWER requests low:
  - Each NEW map point makes 1 request; reusing a point uses the phone cache.
  - Make at most **30 new-point requests** over the whole run (the wilaya builder is separate, see TC-040).
  - Wait at least 3 seconds between new points.
  - If NASA returns HTTP 429 (rate limit), wait 60 seconds and continue.
- Write only inside the new folder `vetoscreenshots/`.

## 1. Setup
1. Unzip `field-shift-front-v5.zip` into a folder named `front/`. If the backend is available, put it in `backend/`.
2. Serve the front end over HTTP. Do not open it as a `file://` page.
   `cd front && python -m http.server 5500`, then open `http://localhost:5500/index.html`.
   You may use the deployed Netlify URL instead; write which URL you used at the top of RESULTS.md.
3. **Backend.** Most cases need it **OFF**: they test the phone fetching NASA data itself.
   - Leave nothing running on port 8000.
   - For TC-023 only, start the backend: `cd backend && uvicorn app.main:app --port 8000`.
   - Credentials come from environment variables that already exist. Never type or write them.
4. Create the folder `vetoscreenshots/` next to `front/`.
5. Default viewport: **390×844** (a phone). Use the viewport given in a case's Setup when it names one.
6. Open DevTools and keep the Console and Network panels available.

## 2. Setup codes used in TEST_CASES.md
Run these in the browser console. Install the BLOCK helper again after every reload, because a reload removes it.

**FRESH**
```js
localStorage.clear(); sessionStorage.clear(); location.reload();
```

**EN**: FRESH, then:
```js
FS_APP.S.lang='en'; FS_APP.S.name='Tester'; FS_APP.save(); FS_APP.go('location');
```

**Arabic**: same as EN, but with `FS_APP.S.lang='ar'`.

**FARM**: EN, then go to the manual entry screen and confirm coordinates **35.19, -0.63**. Wait for "Continue", answer the farm questions with any sensible values, and arrive at the hub.

**FARM+UNLOCK**: FARM, then:
```js
const g=FS_GAME.G(); FS_GAME.ORDER.forEach(x=>g.levels[x]=g.levels[x]||{attempts:[{score:70}],stars:2}); FS_APP.save(); FS_APP.go('map');
```

**BLOCK host1, host2…**: makes chosen services unreachable, to test the fallbacks.
```js
window.__block = ['power.larc.nasa.gov'];  // put the hosts named in the case
(()=>{ if (window.__blockInstalled) return; window.__blockInstalled = true; const f = window.fetch;
  window.fetch = (u, o) => { const s = String((u && u.url) || u);
    return (window.__block || []).some(h => s.includes(h)) ? Promise.reject(new TypeError('blocked for test: ' + s)) : f(u, o); }; })();
```
To remove a block: `window.__block = []`.

**Mock GPS** (for TC-008):
```js
navigator.geolocation.getCurrentPosition = (ok) => ok({ coords: { latitude: 35.19, longitude: -0.63, accuracy: 20 } });
```

**GPS denied** (for TC-009):
```js
navigator.geolocation.getCurrentPosition = (ok, err) => err({ code: 1, message: 'denied' });
```

**Wilaya data without touching data/**: for the wilaya-fallback cases, after TC-041, load the downloaded sample into the page:
```js
const s = document.createElement('script'); s.src = '/vetoscreenshots/wilayas_data.sample.js'; document.head.appendChild(s);
```
This only works if `vetoscreenshots/` is served from the same server. Otherwise, paste the file's content into the console.

**Shortcuts** you may use instead of tapping through screens:
- `FS_APP.go('hub' | 'nasa' | 'crops' | 'map')`
- `FS_GAME.startLevel('2')`
- `FS_CHAT.open()`

## 3. How to run each case
For every row in `TEST_CASES.md`, in order:
1. Set up as the Setup column says: setup code, viewport, blocks.
2. Do the Steps.
3. Wait for animations to settle: 1–2 seconds; 4 seconds for 3D scenes.
4. Take a **full-viewport screenshot** and save it under the exact name in the Screenshot column, e.g. `vetoscreenshots/TC-024_server_down___nasa_straight_from_the_pho.png`.
   - If a case needs more than one picture, add `_b`, `_c` before `.png`.
   - For the sound cases you can't hear anything. Instead, screenshot the screen and check the Console for `AudioContext` errors. Mark PASS if there are no errors and the mute icon state is right. Add the note "audio not audible to agent".
5. Compare what you see with the Expected column and mark it:
   - **PASS**: everything expected is there.
   - **FAIL**: anything differs, there is a console error, or something is cut off, overlapping or blank.
   - **BLOCKED**: you can't run the case, e.g. no backend for TC-023. Say why.
6. Copy any **red console errors** that happened during the case. Ignore the `blocked for test` errors you caused on purpose.
7. Don't stop at a FAIL. Write it down and go on to the next case.

## 4. Output (everything inside `vetoscreenshots/`)
1. **All screenshots**, named as in TEST_CASES.md.
2. **`RESULTS.md`**, containing:
   - **Header:** date and time, app URL, browser and version, whether the backend was ON or OFF per section, and the number of live NASA requests made.
   - **Summary:** PASS / FAIL / BLOCKED counts per area (Launch, Location, Data, Wilaya tool, Farm, Hub, NASA report, Crops, Level map, Game, Chat, Sound, Design, Responsive, Robustness).
   - **Full table:** `| ID | Title | Result | Screenshot | Notes |`. Every FAIL needs a one-line description of what went wrong and the console error, if any.
   - **"Top problems"** list: the FAILs that block a user, most serious first.
3. **`console_errors.txt`**: every console error, prefixed with its case ID.
4. **`network_notes.txt`**:
   - for the Data cases, which hosts were called, e.g. `power.larc.nasa.gov`, `rest.isric.org`, `api.open-meteo.com`, `archive-api.open-meteo.com`, `nominatim.openstreetmap.org`;
   - any **CORS** errors. These matter: they tell us whether phones can reach NASA directly.

## 5. Things to watch especially
- **TC-024:** does the browser get NASA POWER data directly, or is it blocked by CORS? Quote the exact console message.
- **Every "Level N opens in 3D" case:** a plain light-blue screen with only the top bar is a **FAIL**. That is the bug fixed in v5.
- **Design split:** the welcome, language, location, loading, hub, report and crops screens use the **original** style. Only the level map, levels, level results and final report use the bright game style.
- **Ammi Salah chat:**
  - Every agronomy answer must show "📚 Sources".
  - Out-of-scope questions must get the "won't guess" reply.
  - It must never invent a number for a farm that hasn't loaded data.
- **No `NaN`, `undefined` or `null` text** anywhere on screen. This is an automatic FAIL; note where it appeared.

When finished, reply with:
- the PASS / FAIL / BLOCKED totals;
- the 10 most important failures;
- the path to `vetoscreenshots/RESULTS.md`.
