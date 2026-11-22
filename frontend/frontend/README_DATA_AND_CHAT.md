# Field Shift front end: data fallback, Ammi Salah chat, game look

## Where a farm's numbers come from (environment.js + nasa_direct.js)
1. **Field Shift server**: `POST /api/farm/environment` (NASA POWER, cached, farm saved).
2. **NASA POWER fetched by the phone itself**, if the server can't be reached. It runs the same pipeline as the server: drop -999 and impossible values, fill gaps of 5 days or less, keep only complete Sep–Aug seasons, FAO-56 ET0, onset, Theil–Sen + Kendall. It was checked against the Python backend on the Sidi Bel Abbès record and matches except for 3 of ~2,500 monthly values, which differ by 0.001–0.1 because of rounding. SoilGrids soil and Copernicus slope are fetched in parallel, best effort.
3. **A profile this phone already built for the same NASA cell**: every profile is kept in localStorage, so a farm that loaded once also works offline.
4. **The wilaya's NASA profile** (`data/wilayas_data.js`). This file ships empty. Build it once on a computer with internet in one of two ways:
   - open `tools/build_wilayas_data.html` in a browser, press Start, then Download and put the file in `data/`;
   - or, from the backend folder, run `python -m scripts.build_wilayas_data --wilayas ../front/wilayas.js --out ../front/data/wilayas_data.js`.
5. **ERA5 reanalysis via Open-Meteo**, labelled everywhere as "not NASA data". This is only used when NASA is unreachable and there is no wilaya profile.
6. Otherwise: the honest offline screen, with retry.

The source in use is always shown on the loading screen, as the hub badge and as the NASA report banner.
Farms are also remembered on the phone, so the "My farms" sheet works when the server is down.

## Ammi Salah chat (chat.js, chat.css)
The chat opens from "You can also talk to Ammi Salah" on the language screen and from the floating button on the calm screens.
- **App help**: how to use the app and what the levels are.
- **Plant status**: uses `FS_GAME.suitability` / `cropStats`, which is the same FSEngine simulation on the farm's real seasons that the game uses. It gives expected yield, yield in the driest years, water stress, heat at flowering, rotation, salinity, onset trend and the 3 best next crops.
- **Symptom guide**: yellow leaves, wilting, white crust, poor emergence. It gives rough causes linked to the farm's data and says to confirm with a soil test or an extension agent.
- **Research answers**: answers come only from the 15-entry library `LIB` in chat.js. Each entry is checked (authors, journal, DOI/URL) and is cited under the answer. Questions outside the library get "I don't have a checked answer", never a guess.
- It works fully offline: no AI service and no API key.

## Look
- The original app style is used everywhere except the game.
- `game_theme.css` turns on the sunny 3D look only while a game screen is showing (`body.fs-game`): map, levels, the 3D Level 1, level results and the final report.

## Sound
Farm ambience plays under the calm music while playing: breeze, birds, crickets, now and then a sheep or a hen, and rain hiss in storm levels. It is synthesised, so there are no audio files. It stops outside the game and follows the mute button.
