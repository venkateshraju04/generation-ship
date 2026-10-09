import { fmtLy } from '../format.js';
import { esc, html } from './dom.js';

/** Star search box with keyboard navigation. Calls onChoose(star). */
export function createSearch({ catalog, onChoose }) {
  const el = html(`
    <div class="search">
      <input type="search" placeholder="Search stars  /" aria-label="Search stars"
        autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="search-results">
      <ul class="search-results" id="search-results" role="listbox" hidden></ul>
    </div>`);
  const input = el.querySelector('input');
  const list = el.querySelector('ul');
  let results = [];
  let active = 0;

  function render() {
    list.hidden = results.length === 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
    list.innerHTML = results
      .map((s, i) => {
        const other = s.sysName !== s.name && s.sysName !== s.name.replace(/\s+[A-C]$/, '') ? ` · ${s.sysName}` : '';
        return `<li role="option" data-index="${i}" class="${i === active ? 'active' : ''}" aria-selected="${i === active}">
          <span>${esc(s.name)}</span><small>${esc(fmtLy(s.d))}${esc(other)}</small></li>`;
      })
      .join('');
  }

  function choose(i) {
    const star = results[i];
    if (!star) return;
    input.value = '';
    results = [];
    render();
    input.blur();
    onChoose(star);
  }

  input.addEventListener('input', () => {
    results = catalog.search(input.value, 8);
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (e.key === 'Enter') {
      choose(active);
    } else if (e.key === 'Escape') {
      input.value = '';
      results = [];
      render();
      input.blur();
    }
  });
  input.addEventListener('blur', () => {
    list.hidden = true;
  });
  input.addEventListener('focus', () => render());
  // pointerdown fires before the input's blur, so the click is not lost.
  list.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.index));
  });

  return { el, focus: () => input.focus() };
}
