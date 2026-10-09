/**
 * Pooled HTML labels positioned over the canvas. Each frame: begin(), add() per label, end().
 * DOM writes are skipped when text and class have not changed.
 */
export function createLabels(container) {
  const pool = [];
  let used = 0;

  function make() {
    const el = document.createElement('div');
    const name = document.createElement('span');
    const meta = document.createElement('span');
    name.className = 'label-name';
    meta.className = 'label-meta';
    el.append(name, meta);
    container.append(el);
    return { el, name, meta, text: null, metaText: null, kind: null, hidden: false };
  }

  return {
    begin() {
      used = 0;
    },

    add(x, y, text, metaText, kind) {
      const item = pool[used] ?? (pool[used] = make());
      used++;
      if (item.text !== text) item.name.textContent = item.text = text;
      if (item.metaText !== metaText) item.meta.textContent = item.metaText = metaText ?? '';
      if (item.kind !== kind) item.el.className = `label label--${(item.kind = kind)}`;
      if (item.hidden) item.el.hidden = item.hidden = false;
      item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    },

    end() {
      for (let i = used; i < pool.length; i++) {
        if (!pool[i].hidden) pool[i].el.hidden = pool[i].hidden = true;
      }
    },
  };
}
