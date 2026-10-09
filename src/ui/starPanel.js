import { MIN_BETA, MAX_BETA, SOL_ID } from '../sim/constants.js';
import { earthYear } from '../sim/game.js';
import { travelEstimate } from '../sim/relativity.js';
import {
  describeStar, designations, est, fmtDuration, fmtInt, fmtLum, fmtLy, fmtNum, fmtPeriod, fmtSpect,
  planetName, systemKind,
} from '../format.js';
import { temperatureCss } from '../render/color.js';
import { esc, html } from './dom.js';

function memberHtml(s) {
  return `
    <li class="member">
      <i class="swatch" style="--swatch:${temperatureCss(s.teff)}"></i>
      <div>
        <div class="member-name">${esc(s.name)} <span class="tag">${esc(fmtSpect(s.spect))}</span></div>
        <div class="member-desc">${esc(describeStar(s))} · ${est(s, 'teff')}${fmtInt(s.teff)} K · ${est(s, 'lum')}${fmtLum(s.lum)}</div>
      </div>
    </li>`;
}

function planetHtml(p, host) {
  const bits = [];
  // pscomppars fills radii of non-transiting planets from a mass–radius relation; only show measured ones.
  if (p.radius != null && p.method === 'Transit') bits.push(`${fmtNum(p.radius)} R⊕`);
  if (p.mass != null) {
    const prefix = p.massKind === 'Msini' ? '≥ ' : p.massKind === 'M-R relationship' ? '~' : '';
    bits.push(`${prefix}${fmtNum(p.mass)} M⊕`);
  }
  if (p.period != null) bits.push(fmtPeriod(p.period));
  return `
    <li class="planet">
      <div class="planet-name">${esc(planetName(host, p))}${p.controversial ? ' <span class="tag">disputed</span>' : ''}</div>
      <div class="planet-desc">${esc(bits.join(' · '))}</div>
      <div class="planet-found">${esc(p.method ?? 'Discovered')}${p.year ? `, ${p.year}` : ''}</div>
    </li>`;
}

function planetsHtml(sys, catalog) {
  if (sys.id === SOL_ID) return `<p class="muted">Eight planets. One of them is home.</p>`;
  if (!sys.planets.length) {
    return `<p class="muted">No confirmed planets. Any worlds here are still unknown.</p>`;
  }
  return `<ul class="planets">${sys.planets.map((p) => planetHtml(p, catalog.star(p.starId))).join('')}</ul>`;
}

/** Details of the selected system, with a relativistic travel estimate from the ship. */
export function createStarPanel({ catalog, game, view, onFocus, onClose }) {
  const el = html(`<aside class="panel" aria-label="Selected star" hidden></aside>`);
  let shownId = null;

  function renderEstimate() {
    const box = el.querySelector('[data-estimate]');
    if (!box) return;
    const g = game.get();
    const beta = view.get().beta;
    const t = travelEstimate(catalog.distance(g.locationId, shownId), beta);
    box.querySelector('[data-beta]').textContent = `${beta.toFixed(2)} c`;
    box.querySelector('[data-earth]').textContent = fmtDuration(t.earthYears);
    box.querySelector('[data-arrive]').textContent = `arrive ${Math.floor(earthYear(g) + t.earthYears)} CE`;
    box.querySelector('[data-ship]').textContent = fmtDuration(t.shipYears);
    box.querySelector('[data-gamma]').textContent = `γ = ${t.gamma.toFixed(2)}`;
  }

  function render() {
    const sysId = view.get().selectedId;
    shownId = sysId;
    if (sysId == null) {
      el.hidden = true;
      return;
    }
    const sys = catalog.system(sysId);
    const g = game.get();
    const here = catalog.systemOf(g.locationId).id === sysId;
    const fromShip = catalog.distance(g.locationId, sysId);
    const names = designations(sys.primary).filter((d) => d !== sys.name);
    const beta = view.get().beta;

    el.innerHTML = `
      <header class="panel-head">
        <div>
          <div class="eyebrow">${esc(systemKind(sys))}</div>
          <h2 class="panel-title">${esc(sys.name)}</h2>
          ${names.length ? `<div class="panel-sub">${esc(names.join(' · '))}</div>` : ''}
        </div>
        <button class="icon-btn" data-action="close" aria-label="Close" title="Close (Esc)">×</button>
      </header>
      <dl class="facts">
        <div><dt>From Sol</dt><dd>${esc(fmtLy(sys.primary.d))}</dd></div>
        <div><dt>From ship</dt><dd>${here ? 'Here' : esc(fmtLy(fromShip))}</dd></div>
      </dl>
      <section>
        <div class="eyebrow">${sys.members.length > 1 ? 'Stars' : 'Star'}</div>
        <ul class="members">${sys.members.map(memberHtml).join('')}</ul>
      </section>
      <section>
        <div class="eyebrow">Planets${sys.planets.length ? ` · ${sys.planets.length} confirmed` : ''}</div>
        ${planetsHtml(sys, catalog)}
      </section>
      ${
        here
          ? `<section><p class="muted">Your ship is here.</p></section>`
          : `<section class="travel" data-estimate>
              <div class="eyebrow">Travel estimate</div>
              <label class="speed">
                <span>Cruise speed</span><output data-beta></output>
              </label>
              <input type="range" min="${MIN_BETA}" max="${MAX_BETA}" step="0.01" value="${beta}" aria-label="Cruise speed as a fraction of light speed">
              <div class="times">
                <div><div class="eyebrow">Earth time</div><b data-earth></b><small data-arrive></small></div>
                <div><div class="eyebrow">Ship time</div><b data-ship></b><small data-gamma></small></div>
              </div>
            </section>`
      }
      <footer class="panel-foot">
        <button class="btn" data-action="focus">Centre view <kbd>F</kbd></button>
      </footer>`;
    el.hidden = false;
    renderEstimate();
  }

  view.subscribe((v, prev) => {
    if (v.selectedId !== prev.selectedId) render();
    else if (v.beta !== prev.beta) renderEstimate();
  });
  game.subscribe(render);

  el.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') onClose();
    if (action === 'focus') onFocus(shownId);
  });
  el.addEventListener('input', (e) => {
    if (e.target.type === 'range') view.set({ beta: Number(e.target.value) });
  });

  return el;
}
