import { earthYear, generation } from '../sim/game.js';
import { esc, html } from './dom.js';

/** The two clocks: time aboard the ship and the calendar year on Earth. */
export function createHud({ game, catalog }) {
  const el = html(`
    <section class="clocks" aria-label="Clocks">
      <div class="clock">
        <div class="eyebrow">Ship time</div>
        <div class="clock-value" data-ship></div>
        <div class="clock-sub" data-generation></div>
      </div>
      <div class="clock">
        <div class="eyebrow">Earth</div>
        <div class="clock-value" data-earth></div>
        <div class="clock-sub" data-location></div>
      </div>
    </section>`);

  const $ = (sel) => el.querySelector(sel);
  function render(g) {
    const day = Math.floor((g.shipYears % 1) * 365.25);
    $('[data-ship]').textContent = `Year ${Math.floor(g.shipYears)} · day ${day}`;
    $('[data-generation]').textContent = `Generation ${generation(g)}`;
    $('[data-earth]').textContent = `${Math.floor(earthYear(g))} CE`;
    $('[data-location]').innerHTML = `At <b>${esc(catalog.systemOf(g.locationId).name)}</b>`;
  }
  game.subscribe(render);
  render(game.get());
  return el;
}
