(() => {
  'use strict';
  if (window.PortfolioCinematicNavigation) return;
  const menu = document.getElementById('site-menu');
  if (!menu) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const indices = [...menu.querySelectorAll('nav a > span')].filter(node => /^\d{2}$/.test(node.textContent.trim()));
  const alphabet = '0123456789ABCDEF';
  let timer = 0, startedAt = 0, frames = 0, decodeCount = 0;
  let focused = true;
  indices.forEach(node => {
    node.parentElement.setAttribute('aria-label', node.parentElement.textContent.trim());
    node.setAttribute('aria-hidden', 'true');
    node.classList.add('menu-index');
  });
  const stop = () => {
    clearTimeout(timer); timer = 0;
    for (const node of indices) {
      node.classList.remove('is-decoding');
      delete node.dataset.decode;
    }
  };
  const allowed = () => menu.open && !preference.matches && !document.hidden && focused;
  const tick = () => {
    timer = 0;
    if (!allowed()) { stop(); return; }
    const elapsed = performance.now() - startedAt;
    frames++;
    for (const [index, node] of indices.entries()) {
      const local = elapsed - index * 35;
      if (local < 0 || local >= 350) {
        node.classList.remove('is-decoding'); delete node.dataset.decode;
      } else {
        const original = node.textContent.trim();
        const digit = alphabet[(frames * 7 + index * 3) % alphabet.length];
        node.dataset.decode = local > 210 ? original[0] + digit : digit + alphabet[(frames * 3 + index) % alphabet.length];
        node.classList.add('is-decoding');
      }
    }
    if (elapsed < 350 + (indices.length - 1) * 35) timer = setTimeout(tick, 55);
    else stop();
  };
  const start = () => {
    stop();
    if (!allowed()) return;
    startedAt = performance.now(); decodeCount++; tick();
  };
  let wasOpen = menu.open;
  const observer = new MutationObserver(() => {
    if (menu.open === wasOpen) return;
    wasOpen = menu.open;
    if (menu.open) start(); else stop();
  });
  observer.observe(menu, { attributes: true, attributeFilter: ['open'] });
  preference.addEventListener('change', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('blur', () => { focused = false; stop(); });
  window.addEventListener('focus', () => { focused = true; });
  window.addEventListener('pagehide', stop);
  window.PortfolioCinematicNavigation = Object.freeze({
    inspect: () => ({ running: Boolean(timer), frames, decodeCount, reducedMotion: preference.matches, originalIndices: indices.map(node => node.textContent.trim()) })
  });
})();
