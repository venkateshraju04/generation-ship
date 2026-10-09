import { html } from './dom.js';

const LAYERS = [
  { key: 'grid', label: 'Grid', shortcut: 'G' },
  { key: 'stalks', label: 'Depth lines', shortcut: 'D' },
  { key: 'labels', label: 'Labels', shortcut: 'L' },
];

/** Bottom bar: control hints, layer toggles, and data credits. */
export function createFooter({ view, onHome }) {
  const el = html(`
    <footer class="footer">
      <div class="controls">
        <p class="hints">Drag to orbit · Right-drag to pan · Scroll to zoom · Click a star · Double-click to centre</p>
        <div class="toggles">
          ${LAYERS.map((l) => `<button class="chip" data-layer="${l.key}" aria-pressed="true" title="Toggle ${l.label.toLowerCase()} (${l.shortcut})">${l.label}</button>`).join('')}
          <button class="chip" data-action="home" title="Back to the ship (H)">Home</button>
        </div>
      </div>
      <p class="credits">
        Stars: <a href="https://codeberg.org/astronexus/hyg" target="_blank" rel="noopener">HYG Database</a> (CC BY-SA 4.0)
        · Planets: <a href="https://exoplanetarchive.ipac.caltech.edu" target="_blank" rel="noopener">NASA Exoplanet Archive</a>
      </p>
    </footer>`);

  el.addEventListener('click', (e) => {
    const layer = e.target.closest('[data-layer]')?.dataset.layer;
    if (layer) view.set((v) => ({ [layer]: !v[layer] }));
    if (e.target.closest('[data-action="home"]')) onHome();
  });

  const sync = (v) => {
    for (const b of el.querySelectorAll('[data-layer]')) b.setAttribute('aria-pressed', String(v[b.dataset.layer]));
  };
  view.subscribe(sync);
  sync(view.get());
  return el;
}
