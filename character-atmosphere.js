(() => {
  'use strict';
  if (window.PortfolioCharacterAtmosphere) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const surfaces = [];
  const observers = [];
  const removers = [];
  let timer = 0, destroyed = false, focused = true, suspended = false;
  let activeSurface = null, sequence = 0, updateCount = 0;
  const archive = ['PORT / ORIGIN', 'TRANSIT / IMAGE', 'SIGNAL / HOME', 'TRACE / MEMORY', 'OPTICS / RECORD', 'RETURN / ROUTE'];
  // These lines describe the original character's fictional memory archive.
  // They are scenery, never claimed as live instrumentation or client work.
  const code = [
    'recorder.open("homeward");',
    'memory.frame = optical.capture();',
    'archive.append(memory.frame);',
    'route.trace("future-port");',
    'signal.seek("return");',
    'optics.mode = "violet";',
    'memory.link("origin");',
    'archive.replay("journey");',
    'recorder.save("fragment");',
    'route.follow(memory.trace);',
    'optics.observe("horizon");',
    'archive.keep("home");'
  ];

  const svg = `<svg class="character-atmosphere__diagram" viewBox="0 0 800 800" fill="none" aria-hidden="true">
    <g class="character-atmosphere__diagram-lines">
      <path d="M400 42v62m0 592v62M42 400h62m592 0h62"/>
      <circle cx="400" cy="400" r="284" stroke-dasharray="2 12"/>
      <path d="M209 132a329 329 0 0 1 382 0M132 591a329 329 0 0 1 0-382M591 668a329 329 0 0 1-382 0M668 209a329 329 0 0 1 0 382"/>
      <path d="M119 183v-40h40M641 143h40v40M681 617v40h-40M159 657h-40v-40"/>
      <path d="M103 300h32m530 0h32M103 500h32m530 0h32"/>
    </g>
    <g class="character-atmosphere__orbit">
      <circle cx="400" cy="400" r="312" stroke-dasharray="132 260 18 156 38 320"/>
      <path d="M400 86v14m0 600v14M86 400h14m600 0h14"/>
    </g>
  </svg>`;

  function on(target, event, listener, options) {
    target.addEventListener(event, listener, options);
    removers.push(() => target.removeEventListener(event, listener, options));
  }
  function createSurface(host, mode) {
    if (!host) return;
    const element = document.createElement('div');
    element.className = 'character-atmosphere';
    element.setAttribute('aria-hidden', 'true');
    element.dataset.surface = mode;
    element.dataset.active = 'false';
    element.dataset.running = 'false';
    element.innerHTML = `
      <div class="character-atmosphere__halo"></div>
      <div class="character-atmosphere__grid"></div>
      <div class="character-atmosphere__code-grid"></div>
      ${svg}
      <div class="character-atmosphere__scan"></div>
      <div class="character-atmosphere__platform"><i></i><i></i><b></b></div>
      <div class="character-atmosphere__identity"><span>RECORDER</span><small>OPTICAL MEMORY / ARCHIVE</small></div>
      <div class="character-atmosphere__index"><span>R / 01</span><small>CHARACTER STUDY</small></div>
      <div class="character-atmosphere__callout character-atmosphere__callout--optics"><b>01 / OPTICAL VISOR</b><span>光学头盔</span><i></i></div>
      <div class="character-atmosphere__callout character-atmosphere__callout--memory"><i></i><b>02 / MEMORY UNIT</b><span>记忆记录单元</span></div>
      <div class="character-atmosphere__archive"><span>MEMORY ARCHIVE</span><b>0000 / PORT / ORIGIN</b><i></i><small>角色设定 · 记忆归档</small></div>
      <div class="character-atmosphere__metadata"><span data-atmosphere-turntable>TURN / 55 S</span><span data-atmosphere-dimensions>三维角色 / 半身研究</span></div>`;
    const columns = [];
    const grid = element.querySelector('.character-atmosphere__code-grid');
    for (let col = 0; col < 4; col++) {
      const column = document.createElement('div');
      column.className = 'character-atmosphere__code-column';
      column.dataset.column = String(col);
      const title = document.createElement('span');
      title.className = 'character-atmosphere__code-title';
      title.textContent = ['OPTICS / ARRAY', 'FRAME / INDEX', 'ARCHIVE / DATA', 'RETURN / SIGNAL'][col];
      column.append(title);
      const rows = [];
      for (let row = 0; row < 12; row++) {
        const line = document.createElement('span');
        line.textContent = formatCode(col, row, 0);
        rows.push(line);
        column.append(line);
      }
      grid.append(column);
      columns.push(rows);
    }
    host.classList.add('has-character-atmosphere');
    host.prepend(element);
    const surface = { host, mode, element, columns, archive: element.querySelector('.character-atmosphere__archive b') };
    surfaces.push(surface);
    const hostObserver = new MutationObserver(sync);
    hostObserver.observe(host, { childList: true });
    observers.push(hostObserver);
  }

  function formatCode(column, row, step) {
    const address = ((column + 1) * 256 + row * 16 + step).toString(16).padStart(4, '0').toUpperCase();
    return column % 2 === 0
      ? `${address}  ${code[(row + column * 3 + step) % code.length]}`
      : `${address}  ${(row * 17 + column * 91 + step).toString(16).padStart(6, '0').toUpperCase()}  ${['FRAME', 'TRACE', 'OPTICS', 'MEMORY'][row % 4]}`;
  }
  function modelInfo() {
    try { return window.PortfolioInteraction?.getModel?.()?.inspect?.() || null; }
    catch { return null; }
  }
  function metadata(surface, info) {
    if (!surface) return;
    const turntable = surface.element.querySelector('[data-atmosphere-turntable]');
    const dimensions = surface.element.querySelector('[data-atmosphere-dimensions]');
    const duration = Number(info?.autoPeriodSeconds);
    const nextTurn = Number.isFinite(duration) && duration > 0 ? `TURN / ${duration} S` : 'TURN / STUDY';
    if (turntable.textContent !== nextTurn) turntable.textContent = nextTurn;
    const size = info?.dimensionsMetres;
    const actualSize = size && [size.width, size.height, size.depth].every(Number.isFinite);
    const nextDimensions = actualSize
      ? `MODEL / ${size.width.toFixed(2)} × ${size.height.toFixed(2)} × ${size.depth.toFixed(2)} M`
      : '三维角色 / 半身研究';
    if (dimensions.textContent !== nextDimensions) dimensions.textContent = nextDimensions;
    surface.element.dataset.ready = String(info?.status === 'ready');
    surface.element.dataset.view = info?.view || 'portrait';
  }
  function stop() {
    if (timer) clearTimeout(timer);
    timer = 0;
    surfaces.forEach(surface => { surface.element.dataset.running = 'false'; });
  }
  function isRunning() {
    return Boolean(!destroyed && !suspended && activeSurface && !document.hidden && focused && !motion.matches);
  }
  function schedule() {
    if (!timer && isRunning()) timer = setTimeout(update, 1800);
  }
  function update() {
    timer = 0;
    if (!isRunning()) return;
    sequence++;
    const column = sequence % 4;
    const row = (Math.floor(sequence / 4) * 3) % 12;
    activeSurface.columns[column][row].textContent = formatCode(column, row, sequence);
    activeSurface.archive.textContent = `${sequence.toString(16).padStart(4, '0').toUpperCase()} / ${archive[sequence % archive.length]}`;
    updateCount++;
    metadata(activeSurface, modelInfo());
    schedule();
  }
  function sync() {
    if (destroyed) return;
    const viewport = document.getElementById('character-viewport');
    const dialog = document.getElementById('character-dialog');
    const held = document.getElementById('hold-inspection');
    const mode = dialog?.open ? 'dialog' : held && !held.hidden ? 'held' : null;
    const next = mode ? surfaces.find(surface => surface.mode === mode && surface.host.contains(viewport)) || null : null;
    if (next !== activeSurface) stop();
    activeSurface = next;
    const info = modelInfo();
    surfaces.forEach(surface => {
      surface.element.dataset.active = String(surface === activeSurface);
      surface.element.dataset.reducedMotion = String(motion.matches);
      surface.element.dataset.running = String(surface === activeSurface && isRunning());
    });
    if (activeSurface) metadata(activeSurface, info);
    if (isRunning()) schedule(); else stop();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stop();
    observers.forEach(observer => observer.disconnect());
    removers.forEach(remove => remove());
    surfaces.forEach(surface => { surface.element.remove(); surface.host.classList.remove('has-character-atmosphere'); });
    activeSurface = null;
  }
  function initialize() {
    if (destroyed) return;
    createSurface(document.getElementById('character-model-host'), 'dialog');
    createSurface(document.querySelector('[data-hold-model-host]'), 'held');
    const stateObserver = new MutationObserver(sync);
    const dialog = document.getElementById('character-dialog');
    const held = document.getElementById('hold-inspection');
    const viewport = document.getElementById('character-viewport');
    if (dialog) stateObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    if (held) stateObserver.observe(held, { attributes: true, attributeFilter: ['hidden'] });
    if (viewport) stateObserver.observe(viewport, { attributes: true, attributeFilter: ['data-model-state', 'data-model-view', 'data-model-profile'] });
    observers.push(stateObserver);
    on(window, 'portfolio-inspect-mode', sync);
    on(document, 'visibilitychange', sync);
    on(motion, 'change', sync);
    on(window, 'blur', () => { focused = false; sync(); });
    on(window, 'focus', () => { focused = true; sync(); });
    on(window, 'pagehide', event => { suspended = true; stop(); if (!event.persisted) destroy(); });
    on(window, 'pageshow', () => { suspended = false; focused = true; sync(); });
    sync();
  }
  window.PortfolioCharacterAtmosphere = Object.freeze({
    inspect: () => ({ active: activeSurface?.mode || null, running: isRunning(), reducedMotion: motion.matches, updateCount, sequence, surfaces: surfaces.length, destroyed, metadata: activeSurface ? [...activeSurface.element.querySelectorAll('.character-atmosphere__metadata span')].map(node => node.textContent) : [] }),
    destroy
  });
  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
