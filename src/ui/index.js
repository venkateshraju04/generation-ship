import { createFooter } from './footer.js';
import { createHud } from './hud.js';
import { createSearch } from './search.js';
import { createStarPanel } from './starPanel.js';
import { html } from './dom.js';

/** Builds the HTML overlay and keyboard shortcuts on top of the starmap. */
export function createUI({ root, catalog, game, view, starmap }) {
  const selectAndFocus = (sysId) => {
    view.set({ selectedId: sysId });
    starmap.focusSystem(sysId);
  };

  const search = createSearch({ catalog, onChoose: (star) => selectAndFocus(star.sys) });
  const header = html(`<header class="masthead"><h1 class="brand">Generation Ship</h1></header>`);
  header.append(search.el);

  root.append(
    header,
    createHud({ game, catalog }),
    createStarPanel({
      catalog,
      game,
      view,
      onFocus: (id) => starmap.focusSystem(id),
      onClose: () => view.set({ selectedId: null }),
    }),
    createFooter({ view, onHome: () => starmap.home() }),
  );

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const toggle = (key) => view.set((v) => ({ [key]: !v[key] }));
    switch (e.key.toLowerCase()) {
      case '/':
        e.preventDefault();
        search.focus();
        break;
      case 'escape':
        view.set({ selectedId: null });
        break;
      case 'f':
        if (view.get().selectedId != null) starmap.focusSystem(view.get().selectedId);
        break;
      case 'h':
        starmap.home();
        break;
      case 'g':
        toggle('grid');
        break;
      case 'd':
        toggle('stalks');
        break;
      case 'l':
        toggle('labels');
        break;
    }
  });

  /** Screen rectangles occupied by the overlay, so map labels can avoid them. */
  function occupiedRects() {
    return [...root.querySelectorAll('.masthead, .clocks, .panel:not([hidden]), .controls, .credits')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height)
      .map((r) => ({ x: r.left - 8, y: r.top - 6, w: r.width + 16, h: r.height + 12 }));
  }

  return { selectAndFocus, occupiedRects };
}
