import '@fontsource/inter/200.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import './ui/styles.css';

import { createCatalog } from './sim/catalog.js';
import { DEFAULT_BETA } from './sim/constants.js';
import { newGame } from './sim/game.js';
import { createStore } from './sim/store.js';
import { createRenderer } from './render/renderer.js';
import { createStarmap } from './render/starmap/starmap.js';
import { createUI } from './ui/index.js';

const loading = document.getElementById('loading');

async function loadJSON(name) {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
  return res.json();
}

async function main() {
  const [starsData, skyData, planetsData] = await Promise.all([
    loadJSON('stars.json'),
    loadJSON('sky.json'),
    loadJSON('planets.json'),
  ]);

  const catalog = createCatalog(starsData, planetsData);
  const game = createStore(newGame());
  // View state is not part of the saved game: what is selected, speed slider, map layers.
  const view = createStore({ selectedId: null, beta: DEFAULT_BETA, grid: true, stalks: true, labels: true });

  const { setView } = createRenderer(document.getElementById('scene'));
  const starmap = createStarmap({
    canvas: document.getElementById('scene'),
    labelsEl: document.getElementById('labels'),
    catalog,
    skyData,
    onSelect: (sysId) => view.set({ selectedId: sysId }),
  });
  starmap.setShipSystem(catalog.systemOf(game.get().locationId).id);
  game.subscribe((g) => starmap.setShipSystem(catalog.systemOf(g.locationId).id));
  view.subscribe((v, prev) => {
    if (v.selectedId !== prev.selectedId) starmap.setSelected(v.selectedId);
    if (v.grid !== prev.grid || v.stalks !== prev.stalks || v.labels !== prev.labels) {
      starmap.setLayers({ grid: v.grid, stalks: v.stalks, labels: v.labels });
    }
  });
  setView(starmap);

  const ui = createUI({ root: document.getElementById('ui'), catalog, game, view, starmap });
  starmap.setLabelExclusions(ui.occupiedRects);

  // Deep link for sharing and testing: ?select=Tau%20Ceti
  const query = new URLSearchParams(location.search).get('select');
  const match = query && catalog.search(query, 1)[0];
  if (match) ui.selectAndFocus(match.sys);

  if (import.meta.env.DEV) window.__gs = { catalog, game, view, starmap };

  loading.classList.add('done');
  loading.addEventListener('transitionend', () => loading.remove(), { once: true });
}

main().catch((err) => {
  console.error(err);
  loading.textContent = `Something went wrong: ${err.message}`;
  loading.classList.add('error');
});
