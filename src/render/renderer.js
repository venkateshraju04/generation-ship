import { WebGLRenderer } from 'three';

/**
 * Owns the WebGL renderer and the frame loop. One view (starmap, system, transit) is active
 * at a time; it receives resize(), update(dt) and render(renderer) calls.
 */
export function createRenderer(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x020306, 1);

  let view = null;
  let last = performance.now();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    view?.resize(w, h, renderer.getPixelRatio());
  }
  window.addEventListener('resize', resize);

  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!view) return;
    view.update(dt);
    view.render(renderer);
  });

  return {
    renderer,
    setView(next) {
      view = next;
      resize();
    },
  };
}
