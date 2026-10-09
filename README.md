# Generation Ship

A calm, single-player 3D exploration game in the browser. You captain a relativistic ship through the real stars within 50 light-years of the Sun, where ship time and Earth time drift apart.

See [PLAN.md](PLAN.md) for the design, phases and data decisions.

## Run it

Requires Node 20.19+ (or 22.12+).

```
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (relativity, catalogue search, star colours) |
| `npm run data:verify` | Check the committed star data against known positions |
| `npm run data` | Re-download the source catalogues, rebuild `public/data/`, and verify |

The generated data in `public/data/` is committed, so the game needs no network access. Only `npm run data` downloads anything.

## Controls

| Input | Action |
|---|---|
| Drag / right-drag / scroll | Orbit / pan / zoom |
| Click a star | Select its system |
| Double-click a star, or `F` | Centre the view on it |
| `/` | Search stars by name or catalogue number |
| `H` | Back to the ship |
| `G` / `D` / `L` | Toggle grid / depth lines / labels |
| `Esc` | Clear the selection |

Deep link to a star: `?select=Tau%20Ceti`.

## Data and credits

- Stars: [HYG Database](https://codeberg.org/astronexus/hyg) v4.4 by David Nash, CC BY-SA 4.0.
- Planets: [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu), Planetary Systems Composite Parameters table. This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.

The derived files in `public/data/` are shared under the same CC BY-SA 4.0 licence as HYG.
