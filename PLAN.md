# Generation Ship — Plan

A single-player 3D browser exploration game. The player captains a ship exploring the real stars within ~50 light-years of the Sun at relativistic speeds, so ship time and Earth time drift apart. The core feeling: wonder at real places, and the quiet cost of distance.

**Status:** Phase 1 is done: data pipeline and 3D starmap. Phase 2 (voyage) is next.

---

## Progress

| Phase | Part | Status |
|---|---|---|
| 1 | Data fetch, preprocessing, verification | **Done** — see [Data](#data) |
| 1 | 3D starmap, selection, search, travel estimate | **Done** — see [Phase 1 starmap: what was built](#phase-1-starmap-what-was-built) |
| 2 | Voyage | Not started |
| 3 | Story and finish | Not started |

---

## Architecture

The game is split into three layers, and only `main.js` connects them:

- **`src/sim/`** holds the rules: relativity, game state, travel, scanning, messages, procedural planets, saving. It never imports three.js or touches the DOM, so it can be unit-tested with Node's built-in test runner.
- **`src/render/`** holds the three.js scenes. They read game state and report clicks back; they never change the rules.
- **`src/ui/`** is plain HTML panels (clocks, star info, jump dialog, log, messages, end screen) layered over the canvas. It subscribes to state changes.

**Stack (pinned exactly, `save-exact=true` in `.npmrc`):**
- `three` 0.186.1
- `vite` 8.3.1 (8.3.4 was one day old; 8.3.1 is the newest release at least two weeks old)
- `@fontsource/inter` 5.3.0
- `tone` 15.1.22 is added in Phase 3.

Vanilla JS everywhere else.

## File structure

`✓` = exists now. Everything else is planned.

```
generation-ship/                      (git repo)
├── package.json  .npmrc  .gitignore  ✓
├── index.html  vite.config.js  README.md  ✓
├── PLAN.md                           ✓
├── scripts/                          ✓ Node, no Python
│   ├── fetch-data.js                 ✓ HYG + NASA Exoplanet Archive → data/raw/ (gitignored)
│   ├── build-stars.js                ✓ → public/data/stars.json, sky.json
│   ├── build-planets.js              ✓ → public/data/planets.json
│   ├── verify-stars.js               ✓ position/catalogue checks, exits non-zero on failure
│   └── lib/
│       ├── config.js                 ✓ paths, 50 ly limit, magnitude limit
│       ├── csv.js                    ✓ RFC 4180 parser
│       ├── coords.js                 ✓ RA/Dec ↔ xyz, equatorial ↔ galactic
│       ├── stellar.js                ✓ spectral parsing, Teff, luminosity, mass, radius
│       └── names.js                  ✓ Bayer/Flamsteed/Gliese names, 88 constellation genitives
├── data/
│   ├── raw/                          ✓ downloaded sources + sources.json (not committed)
│   └── curated/
│       ├── names.json                ✓ display-name preferences and search aliases
│       ├── corrections.json          ✓ fixes for known catalogue errors
│       ├── star-facts.json           (Phase 2) hand-written facts for notable stars
│       └── poi.json                  (Phase 3) hand-placed points of interest
├── public/data/                      ✓ generated JSON, committed so the game needs no network
│   ├── stars.json                    ✓ 992 stars ≤ 50 ly (406 KB)
│   ├── sky.json                      ✓ 8,687 naked-eye background stars (248 KB)
│   └── planets.json                  ✓ 228 confirmed planets (63 KB)
├── src/
│   ├── main.js                       ✓ loads data, wires sim ↔ render ↔ UI
│   ├── format.js                     ✓ shared display formatting (distances, durations, star types)
│   ├── sim/        ✓ constants, relativity, catalog (lookups, systems, search), store, game;
│   │               later: rng, physics, procgen, travel, scan, log, messages, save
│   ├── content/    messages.js (~30 templates)
│   ├── render/     ✓ renderer.js, color.js, coords.js
│   │   ├── starmap/  ✓ starmap.js, starPoints.js, milkyWay.js, grid.js, markers.js, labels.js
│   │   ├── shaders/  ✓ stars, milkyway, fade (depth lines)
│   │   └── system/, transit/   (Phases 2–3)
│   ├── ui/         ✓ index.js, hud.js, search.js, starPanel.js, footer.js, dom.js, styles.css
│   └── audio/      ambient.js (Tone.js, loaded only when the player turns sound on)
└── tests/          ✓ relativity, catalog, color (14 tests); later: procgen determinism, message timing
```

## Phase 1 starmap: what was built

**Run:** `npm install`, then `npm run dev` and open http://localhost:5173. Controls and scripts are listed in [README.md](README.md).

### Rendering
- **Stars:** each star's size and opacity come from its apparent magnitude as seen from the camera, computed in the vertex shader. Brightness stays physically consistent wherever you fly, and approaching a star makes it glare.
  - Selectable stars (≤ 50 ly) get a minimum size and opacity of 0.7, so faint red dwarfs stay visible and clickable.
  - Background stars have no minimum, so the sky looks like the real one.
- **Colour** comes from temperature: a Planck spectrum integrated against the CIE 1931 colour-matching functions, then converted to sRGB. The results match standard blackbody star-colour tables: 3,000 K → #ffb46b, 5,800 K → #fff4ea.
- **Backdrop:** the 8,687 naked-eye stars at their true 3D positions, plus a faint procedural Milky Way band along the galactic plane, with its bulge toward the galactic centre.
- **Grid:** distance rings every 10 ly around the Sun, with longitude spokes and labels. The grid fades as the camera nears the galactic plane, where the rings would otherwise collapse into one bright line.
- **Depth lines** run from each star to the plane, blue above and amber below. They fade beyond a radius around the camera's focus that grows as you zoom out.
- **Markers:** the ship is a diamond, the selection is pulsing brackets and hover is a ring. A dashed route line runs from the ship to the selected star.

### Interaction
- **Picking** is done in screen space against every star's projected position, within 14 px or the drawn radius. Clicking any member star selects its whole system.
- **Hover** shows a ring and a label with the distance from the ship.
- **Labels:** up to about 40 per frame, ranked by apparent brightness. Real names are weighted 8× over bare catalogue numbers. A greedy pass avoids overlaps and keeps labels clear of the UI panels. Selected, hovered and ship labels always show, and start outside their marker.
- **Camera:** OrbitControls with damping, plus an eased glide to a star on double-click, `F`, search or `?select=`. `H` returns to the overview, and any drag cancels a glide.

### UI
- **Clocks:** ship time (year, day, generation) and the Earth calendar year with the ship's location. Both are static until Phase 2.
- **Search** matches names, Bayer and Flamsteed names, IAU names, and Gliese, HD and HIP numbers. It ignores case, accents and superscripts, and supports arrow keys and Enter.
- **Star panel:**
  - system type, name and designations
  - distance from Sol and from the ship
  - member stars, each with a colour swatch, spectral type, plain-language type, temperature and luminosity (`~` marks estimates)
  - confirmed planets with measured radius (transits only), mass (`≥` for minimum masses), orbit, discovery method and year, and the Archive's "disputed" flag
  - a travel estimate with a 0.50–0.99c slider, showing Earth time, arrival year, ship time and γ
- **Footer:** control hints, layer toggles (Grid, Depth lines, Labels, Home) and data credits.
- **Phone layout** (≤ 720 px): the panel becomes a bottom sheet, the clocks move to the bottom, and hints and credits are hidden.

### Verification
- `npm test`: 14 passing tests.
  - Relativity: γ, Earth and ship time, and ship time always less than Earth time.
  - Catalogue: search by common, Bayer, IAU and catalogue names; system grouping; distances; planets attached to systems.
  - Star colours: red, near-white and blue-white ends, and monotonic with temperature.
- **Headless Chrome smoke test** (Puppeteer, run from outside the repo), with no console errors:
  - Clicking Sirius on the canvas selected it and showed 8.60 ly, 10.8 Earth-years and 6.5 ship-years at 0.8c.
  - Searching "tau ceti" and pressing Enter selected and centred it.
  - Moving the slider to 0.99c gave γ = 7.09 and 1.7 ship-years.
  - Also checked: an Alpha Centauri close-up, TRAPPIST-1 with its 7 planets, layer toggles with Home, and the phone layout.
- **Rendering bug found and fixed:** TRAPPIST-1 looked invisible. Pixel sampling showed it did render; the selected-star label started inside the brackets and covered it.

---

## Data

### Commands
```
npm run data          # fetch + build + verify
npm run data:fetch    # download raw sources into data/raw/
npm run data:build    # build-stars.js then build-planets.js
npm run data:verify   # check positions and catalogue integrity
```

### Sources
- **HYG Database v4.4** (CC BY-SA 4.0), from `codeberg.org/astronexus/hyg`.
  - The repo stores the CSV in Git LFS, so the script downloads it from the `/media/` URL; the `/raw/` URL only returns the pointer file.
  - The script finds the current `hyg_v*.csv.gz` file automatically.
- **NASA Exoplanet Archive**, `pscomppars` table, through its TAP service.
  - The query keeps hosts within 16.03 pc by `sy_dist` **or** with `sy_plx` > 62.4 mas, so that a wrong `sy_dist` can't drop a nearby host.

### Output formats
All positions are **galactic Cartesian light-years with the Sun at the origin**: +x toward the galactic centre, +y toward l = 90°, +z toward the north galactic pole.

- **`stars.json`** has one star per line. Each star has:
  - identity: `id`, `name`, `sys` (system id), `sysName`, `comp` (component letter), searchable `aliases`
  - position: `x y z` and distance `d` (ly), `ra dec` (°)
  - brightness: `mag`, `absmag`
  - type: `spect`, parsed `cls` / `sub` / `lc`
  - physics: `teff` (K), bolometric `lum` (L☉), `mass` (M☉), `radius` (R☉), and `est` listing which of these are estimates rather than measurements
  - catalogue IDs: `hip`, `hd`, `gl`, `host` (Archive host name), `src` (`hyg` or `archive`)
- **`sky.json`** is a flat array `[x, y, z, absmag, teff, …]` for stars brighter than V 6.5 that lie beyond 50 ly. Stars without a usable parallax are placed at 1,000 pc.
- **`planets.json`** is planets keyed by star id. It stores only measured values; anything missing stays `null`, and the game estimates it at runtime. Each planet has:
  - orbit: period, semi-major axis, eccentricity, inclination
  - size: radius, mass and how the mass was obtained (`massKind`), density
  - climate inputs: insolation, equilibrium temperature
  - discovery: method, year, facility, controversial flag

### Stars
- **992 stars in 871 systems.** That's 978 HYG stars within 15.33 pc, plus planet hosts added from the Archive.
- **Systems** are grouped by HYG's `comp_primary`. Proxima is its own system, 0.19 ly from α Cen A/B.
- **Companion distances:** companions are placed at the primary's distance in their own sky direction. HYG gives companions separate, noisier parallaxes, which had put 40 Eridani B 0.2 ly from A; the real separation is about 400 AU.
- **Temperature**, in order of preference:
  1. a curated correction
  2. the Archive's measured value (planet hosts)
  3. the spectral type
  4. the B–V colour index (Ballesteros 2012)
  5. the absolute magnitude
  - Spectral types are read from both modern and old Gliese notation: `dM4.5e`, `sdM4`, bare `m`, `k-m`. White dwarfs use the temperature index (`DA2` → 50,400/2 K).
  - 261 stars have estimated temperatures because they lack a full spectral type.
- **Luminosity is bolometric**, from absolute V magnitude plus a temperature-dependent bolometric correction. HYG's own `lum` field is visual-band only, so it was not used. Mass and radius come from luminosity and temperature. Planet hosts use the Archive's measured values.
- **Names** use the familiar designation, with IAU names kept searchable. Examples: "Alpha Centauri A" rather than Rigil Kentaurus, "Epsilon Eridani" rather than Ran, "55 Cancri A" rather than Copernicus.
  - Fallback order: curated name, proper name, Bayer, Flamsteed, Archive name, Gliese, HD, HIP.
  - Companions inherit the primary's name ("Sirius B", "40 Eridani C").
  - Archive abbreviations are expanded ("55 Cnc B" → "55 Cancri B").
  - About 800 faint stars only have catalogue names such as "Gliese 1005 A".

### Planets
- **228 confirmed planets around 126 stars.**
- **Hosts matched to HYG:** 97 by HIP number, 17 by Gliese number and 9 by sky position (within 0.06°).
- **10 hosts missing from HYG were added** from the Archive's coordinates: TRAPPIST-1, Teegarden's Star, L 98-59, LHS 475, LHS 3844, TOI-540, COCONUTS-2 A, VHS 1256−1257, WISE 1217+16 A and CWISE 1935−15.
- **Spectral type:** planet hosts use the Archive's spectral type. HYG had Struve 2398 A/B as K5; they are M3/M4 dwarfs.

### Distance conflicts (found during the build)
Neither catalogue is always right:
- **The Archive's `sy_dist` is wrong for some hosts.** GJ 411 (Lalande 21185) is listed at 5.68 pc, but its own `sy_plx` of 392.4 mas gives 2.55 pc. GJ 273 and Gl 725 B have the same problem.
- **HYG's old parallaxes are wrong for others:** GJ 1061, GJ 3323, LTT 1445 A, GJ 1132, GJ 1214 and GJ 317. For example, HYG puts GJ 1132 at 56 ly where Gaia gives 41.

**Rule:** the Archive distance is computed from `sy_plx`, falling back to `sy_dist`. When it differs from HYG by more than 10%, the Archive (Gaia-era) value wins. The build log lists every case.

### Curated corrections (`data/curated/corrections.json`)
- **Capella:** HYG v4.4 lists the primary as "M1: comp"; corrected to K0 III.
- **Procyon B:** HYG's "DA" has no temperature index; set to 7,740 K.
- **40 Eridani B:** HYG's DA4 implies about 12,600 K; set to 16,500 K.
- **HD 104901:** typed "F0Ib-II" (a supergiant) but its absolute magnitude is 8.9. Any giant class on a star fainter than M_V 4 is treated as a dwarf.

### Verification (`npm run data:verify`, all passing)
- **Frame transform:** the north galactic pole maps to b = +90.0000°, and the galactic centre to l = 0°, b = 0°.
- **Sky positions** are within 20″ of reference J2000 coordinates for Proxima, α Cen A, Barnard's Star, Sirius, Procyon, Tau Ceti, ε Eridani, 61 Cygni A, Vega and TRAPPIST-1.
- **Distances** are within 1.1% of reference. α Cen A is the worst case, at 4.32 vs 4.37 ly, because HYG uses the 1997 Hipparcos parallax.
- **Galactic l/b** matches SIMBAD to 0.01° for Proxima, α Cen A, Barnard's Star and Sirius.
- **Pair separations:** Sirius ↔ Procyon is 5.26 ly (reference 5.24), and α Cen A ↔ Proxima is 0.19 ly (reference ~0.21).
- **Catalogue checks:**
  - TRAPPIST-1 has 7 planets.
  - Proxima b exists, and Teegarden's Star has b, c and d.
  - Sirius B is a white dwarf in the Sirius system.
  - Star ids are unique, and every planet host is in `stars.json`.

### Procedural planets (Phase 2)
- For stars with no known planets: a seeded RNG keyed on the star id, so a star's planets are always the same.
- Planet counts and types depend on spectral type; sizes follow a standard mass–radius relation.
- Always labelled **"unconfirmed / simulated"** in the UI and drawn with dashed orbits.

### Credits
HYG is CC BY-SA 4.0, so the game includes a credits line for HYG and for the NASA Exoplanet Archive.

## Core mechanics

### Travel
- Earth time = d / v
- Ship time = Earth time · √(1 − v²/c²)
- Cruise speed is chosen between 0.5c and 0.99c. There is no acceleration phase (constant-cruise model as specified).
- Both durations are shown before a jump is confirmed.

### Resources
The speed slider trades one resource for the other:

- **Energy:** a jump costs ∝ 2(γ − 1), plus a small shielding cost per light-year. Relative to 0.5c, 0.9c costs about 8× and 0.99c about 39×.
- **Life-support years:** a ship-years budget (~250, to be tuned). The ship clock shows ship year, crew generation and crew age.

Faster saves crew years but burns energy; slower saves energy but costs years.

### Ending
There is no fail state. The voyage ends when:
- the player chooses to end it (settling a habitable world gets its own ending),
- no star is reachable with remaining energy, or
- life support runs out.

The end screen summarises the journey: stars visited, discoveries, and years elapsed on the ship vs on Earth.

### Earth messages
- A message sent in Earth year *S* reaches the ship once (Earth year − distance from Sol in ly) ≥ *S*.
- The HUD shows both, e.g. "Earth year 2347 · latest news from 2331".
- Some templates are **replies to your reports**: Earth hears about a discovery *d* years after it happens, and its answer takes another *d* years to arrive.
- The ~30 templates follow an arc: familiar news → new generations → messages grow sparse → silence → one surprise (a faster ship, launched much later, announces it will arrive first).

### Systems and discovery
- Arriving at a star opens the system view: the star and its planets in orbit.
- Scanning a planet costs ship time and energy and reveals type, temperature, gravity and a habitability estimate (Earth Similarity Index).
- Every discovery goes into the Captain's Log / codex, with real facts for real objects.

### Transit sequence
- About 10 seconds, skippable.
- The shader applies real relativistic effects: aberration (stars bunch forward), Doppler colour shift (blue ahead, red behind) and the searchlight effect.
- Both clocks visibly run at different rates during the jump.

## Rendering

### Starmap
- Star colours from temperature: a Planck spectrum integrated against the CIE 1931 colour-matching functions, then converted to sRGB.
- Brightness: the shader computes each star's apparent magnitude from the camera's position, so brightness stays physically consistent wherever the camera is. Stars within 50 ly get a minimum size and opacity so they stay clickable.
- Backdrop: the 8,687 naked-eye stars drawn at their true 3D positions (so constellations shift as you travel), plus a faint procedural Milky Way band along the galactic plane.
- Galactic-plane grid with distance rings every 10 ly, plus vertical lines from each star to the plane for depth.
- Orbit/zoom camera around the ship.
- Click-to-select (screen-space picking), name search, labels and a route line.
- The selected star shows distance and a travel estimate.

### System view
- Star with limb darkening.
- Procedurally shaded planets by type (rocky, ocean, ice, gas giant).
- Kepler orbits from real semi-major axis and eccentricity, on a compressed scale.
- Habitable-zone ring.

## Phases

1. **Data and starmap** ✓
   - ✓ Fetch and build scripts, plus the verify script.
   - ✓ 3D starmap with selection, a distance + travel-estimate panel, and search.
   - ✓ Smoke-tested in headless Chrome.
2. **Voyage** *(next)*
   - Relativistic travel and resources, both clocks, system view, scanning, Captain's Log and codex.
3. **Story and finish**
   - Earth messages, points of interest, transit effects, Tone.js ambient drones, localStorage save/continue, end screen.

Each phase ends with instructions on how to run it and what to test.

## Decisions (open for change)

1. **Scene frame:** galactic coordinates in light-years with Sol at the origin, so the Milky Way plane is horizontal. *(Implemented in the data.)*
2. **Refuelling:** limited. The player can skim one gas giant per system for some energy at a cost in ship time. Without it, runs get short and choices get binary.
3. **Launch year:** 2200 (arbitrary).
4. **Points of interest are real objects only:**
   - Habitable zone: Proxima b, TRAPPIST-1 e, Teegarden's Star b
   - White dwarfs: Sirius B, 40 Eridani B, Van Maanen's Star
   - Binaries with planets: Gamma Cephei; Gliese 86 (white dwarf + K star with a planet)
   - No invented anomalies; fiction lives only in the Earth messages.
5. **Look:** dark theme with self-hosted Inter at light weights, so nothing loads from a CDN at runtime.
6. **Display names:** familiar designations first, with IAU names kept as search aliases. *(Implemented.)*

## Risks and notes

- **Network access:** confirmed working for both data sources. The game itself never needs the network, because the generated JSON is committed.
- **Gliese 86 B**, the white dwarf companion, is not in HYG. The Gliese 86 point of interest will need it added by hand in Phase 3.
- **Not committed:** the five data-pipeline commits are on `main`; the starmap work (`src/`, `tests/`, `index.html`, `vite.config.js`, `README.md`, the `package.json` test-script fix) is not.
- **Bundle size:** about 590 kB JS (150 kB gzipped), almost all three.js. This is fine for now; code-splitting can wait until Phase 3 adds Tone.js, which will be lazy-loaded.
