/* Memory Core Studio — deterministic geometry, saved moments, local creation. */
const defaults = Object.freeze({ preset: 'liquid', seed: 427, title: '记忆核心', deform: .68, metal: .82, glow: .46, speed: .30, palette: 'silver', playing: true, phase: 0 });
const presetDefaults = Object.freeze({ liquid: { deform: .68, metal: .82, glow: .46, speed: .30, palette: 'silver' }, orbit: { deform: .62, metal: .88, glow: .42, speed: .22, palette: 'silver' }, crystal: { deform: .42, metal: .87, glow: .24, speed: .15, palette: 'silver' } });
const presetNames = { liquid: '液态银', orbit: '轨道回声', crystal: '晶化记忆' };
const homeView = Object.freeze({ x: -.18, y: -.25, zoom: 1 });
const state = { ...defaults }, ui = {}, gates = { hidden: document.hidden, blurred: !document.hasFocus(), offscreen: false, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
let view = { ...homeView }, poster = { format: 'portrait', showTitle: true };
let stage, store, history, posterTools, raf = 0, lastTick = 0, saveTimer = 0, geometryTimer = 0, geometryPending = false, phaseSaveAt = 0;
let exportBusy = false, posterSnapshot = null, previewSerial = 0, activeTab = 'shape', activeView = 'front', pointers = new Map(), pinch = null, dragging = false, viewDirty = false, statusTimer = 0;
const stats = { ready: false, frames: 0, error: null, contextLost: false, lastFrameMs: 0, averageFrameMs: 0, lastExport: null, lastSave: null, lastImport: null, lastCollection: null, lastRestoredCollection: null, migratedFrom: null };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const clone = value => JSON.parse(JSON.stringify(value));
const finite = n => typeof n === 'number' && Number.isFinite(n);
const seedText = () => String(state.seed).padStart(4, '0');
const snapshot = () => ({ type: 'memory-core', version: 2, ...state, view: { ...view }, poster: { ...poster } });
const status = (message = '', kind = 'ready') => {
  clearTimeout(statusTimer);
  if (ui.status) { ui.status.textContent = message; ui.status.dataset.state = kind; }
  if (kind === 'ready' && message) statusTimer = setTimeout(() => status(''), 2200);
};
function pausedReasons() { return [!stats.ready && 'not-ready', !state.playing && 'user', state.speed === 0 && 'zero-speed', gates.hidden && 'hidden', gates.blurred && 'blur', gates.offscreen && 'offscreen', gates.reduced && 'reduced-motion', stats.contextLost && 'context-lost', exportBusy && 'export', ui.posterDialog?.open && 'poster', ui.libraryDialog?.open && 'library'].filter(Boolean); }
function inspect() {
  return clone({ type: 'memory-core', version: 2, config: { ...state, poster: { ...poster } }, view: { ...view }, phase: state.phase, ...stats,
    geometry: stage?.geometryInfo || null, renderer: stage?.inspect() || null,
    scheduler: { running: !!raf, pendingRaf: raf ? 1 : 0, pausedReasons: pausedReasons(), gates: { ...gates } },
    controls: Object.fromEntries(['deform', 'metal', 'glow', 'speed'].map(key => [key, { value: state[key], input: ui[key]?.value, min: ui[key]?.min, max: ui[key]?.max }])),
    history: history?.inspect() || null, storage: store?.inspect() || null, library: store?.inspect().items || [],
    poster: { open: !!ui.posterDialog?.open, format: poster.format, showTitle: poster.showTitle, previewReady: !!ui.posterPreview?.querySelector('canvas'), frozenPhase: posterSnapshot?.phase ?? null, snapshot: posterSnapshot ? clone(posterSnapshot) : null },
    tab: activeTab, activeView, exportBusy, geometryPending
  });
}
Object.defineProperty(window, 'RecorderCore', { configurable: true, value: Object.freeze({ inspect }) });

function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; lastTick = 0; }
function syncLoop() { if (pausedReasons().length) stopLoop(); else if (!raf) raf = requestAnimationFrame(tick); }
function draw() {
  if (!stage || !stats.ready || stats.contextLost || exportBusy) return;
  stage.setView(view); stage.setPhase(state.phase); stage.render(); stats.frames++;
}
function tick(time) {
  raf = 0;
  if (pausedReasons().length) return;
  const dt = lastTick ? Math.min((time - lastTick) / 1000, .08) : 0;
  const frameTime = lastTick ? time - lastTick : 0; lastTick = time;
  stats.lastFrameMs = +frameTime.toFixed(2);
  if (frameTime) stats.averageFrameMs = +(stats.averageFrameMs ? stats.averageFrameMs * .94 + frameTime * .06 : frameTime).toFixed(2);
  state.phase += dt * state.speed * 1.8;
  if (!dragging) view.y += dt * state.speed * .13;
  draw();
  if (time - phaseSaveAt > 6000) { phaseSaveAt = time; persist(); }
  raf = requestAnimationFrame(tick);
}
function storageStatus() {
  if (!store) return;
  ui.draftStatus.textContent = store.error || (store.restored ? '已恢复草稿 · 已自动保存' : '已自动保存');
  ui.draftStatus.dataset.state = store.error ? 'error' : 'saved';
  ui.savedTime.textContent = store.lastSaved ? `最后保存 ${new Date(store.lastSaved).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : '';
}
function persist() { if (!stats.ready || !store) return; clearTimeout(saveTimer); store.saveDraft(snapshot()); storageStatus(); }
function scheduleSave() { clearTimeout(saveTimer); ui.draftStatus.textContent = '正在保存…'; saveTimer = setTimeout(persist, 450); }
function syncHistory() { if (!history) return; const h = history.inspect(); ui.undo.disabled = !h.canUndo; ui.redo.disabled = !h.canRedo; }
function commit() { if (!history) return; history.commit(snapshot()); syncHistory(); scheduleSave(); }
function syncControls() {
  for (const key of ['deform', 'metal', 'glow', 'speed']) {
    if (ui[key]) { ui[key].value = String(state[key]); ui[key].style.setProperty('--range-progress', `${state[key] * 100}%`); ui[key].setAttribute('aria-valuetext', state[key].toFixed(2)); }
    $$(`[data-core-output="${key}"]`).forEach(output => { output.textContent = state[key].toFixed(2); });
  }
  ui.title.value = state.title; ui.seed.value = String(state.seed); ui.preset.value = state.preset;
  $$('[data-core-palette]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.corePalette === state.palette)));
  $$('[data-core-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.corePreset === state.preset)));
  ui.play.setAttribute('aria-pressed', String(state.playing));
  ui.play.setAttribute('aria-label', state.playing ? '暂停流动与旋转' : '播放流动与旋转');
  ui.play.innerHTML = state.playing ? '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14M16 5v14"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m7 4 13 8-13 8Z"/></svg>';
  ui.pieceLabel.textContent = `${state.title} / ${seedText()}`;
  ui.motionLabel.textContent = gates.reduced ? '已减少动态，仍可手动探索。' : state.playing && state.speed > 0 ? '形态在流动，记忆在延续。' : '这一瞬间，已经定格。';
  ui.posterFormat.value = poster.format; ui.posterTitle.checked = poster.showTitle; syncHistory();
  syncViewSelection();
}
function syncViewSelection() { $$('[data-core-view]').forEach(button => { if (button.dataset.coreView !== 'reset') button.setAttribute('aria-pressed', String(button.dataset.coreView === activeView)); }); }
function detectView(v) {
  const candidates = { front: homeView, side: { x: .05, y: Math.PI / 2 + .20, zoom: 1 }, detail: { x: -.3, y: -.4, zoom: 1.37 } };
  return Object.keys(candidates).find(name => ['x', 'y', 'zoom'].every(key => Math.abs(v[key] - candidates[name][key]) < .00001)) || 'custom';
}
function customView() { if (activeView !== 'custom') { activeView = 'custom'; syncViewSelection(); } }
function geometryKey(config) { return `${config.preset}/${config.seed}/${config.deform}`; }
function rebuild(immediate = false) {
  clearTimeout(geometryTimer); geometryPending = true;
  const run = () => { geometryTimer = 0; geometryPending = false; stage.rebuild(state); draw(); };
  if (immediate) run(); else geometryTimer = setTimeout(run, 24);
}
function finishGeometry() { if (geometryPending) rebuild(true); }
function applyConfig(raw, { announce = true } = {}) {
  const checked = validateConfig(raw), previous = geometryKey(state);
  Object.assign(state, checked.state); view = checked.view; poster = checked.poster;
  activeView = detectView(view);
  if (stage) { if (previous !== geometryKey(state)) rebuild(true); else stage.updateMaterials(state); }
  syncControls(); draw(); syncLoop();
  if (checked.migrated) stats.migratedFrom = 1;
  if (announce) status(checked.migrated ? '旧版作品已恢复，并升级为新草稿。' : '作品已恢复，可继续创作。');
}
function validateConfig(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.type !== 'memory-core' || ![1, 2].includes(data.version)) throw new Error('请选择记忆核心导出的版本 1 或版本 2 配置。');
  if (!Object.hasOwn(presetDefaults, data.preset) || !['silver', 'lime', 'ink'].includes(data.palette)) throw new Error('配置中的预设或色彩方案不可用。');
  if (!Number.isInteger(data.seed) || data.seed < 0 || data.seed > 999999) throw new Error('种子需要是 0–999999 的整数。');
  for (const key of ['deform', 'metal', 'glow', 'speed']) if (!finite(data[key]) || data[key] < 0 || data[key] > 1) throw new Error('形态参数需要为 0–1 之间的数值。');
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 24) throw new Error('作品名称需要为 1–24 个字符。');
  if (typeof data.playing !== 'boolean') throw new Error('配置缺少有效的播放状态。');
  const phase = data.version === 1 ? 0 : data.phase;
  if (!finite(phase) || phase < 0 || phase > 1e10) throw new Error('配置中的流动时间不可用。');
  const v = data.view || homeView;
  if (!v || !['x', 'y', 'zoom'].every(key => finite(v[key])) || Math.abs(v.x) > 1.4 || Math.abs(v.y) > 1e8 || v.zoom < .65 || v.zoom > 1.45) throw new Error('配置中的视角不可用。');
  const p = data.version === 1 ? { format: 'portrait', showTitle: true } : data.poster;
  if (!p || !['portrait', 'square', 'landscape'].includes(p.format) || typeof p.showTitle !== 'boolean') throw new Error('配置中的海报设置不可用。');
  return { state: { preset: data.preset, seed: data.seed, title: data.title.trim(), deform: data.deform, metal: data.metal, glow: data.glow, speed: data.speed, palette: data.palette, playing: data.playing, phase }, view: { x: v.x, y: v.y, zoom: v.zoom }, poster: { format: p.format, showTitle: p.showTitle }, migrated: data.version === 1 };
}
function togglePlay() { state.playing = !state.playing; syncControls(); syncLoop(); draw(); commit(); }
function setPreset(preset) {
  if (!Object.hasOwn(presetDefaults, preset)) return;
  state.preset = preset; Object.assign(state, presetDefaults[preset]); state.phase = 0;
  rebuild(true); syncControls(); draw(); syncLoop(); commit(); status(`${presetNames[preset]} · 已切换形态`);
}
function setTab(tab, focus = false) {
  activeTab = tab;
  $$('[data-core-tab]').forEach(button => { const active = button.dataset.coreTab === tab; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; if (active && focus) button.focus(); });
  ui.shapePanel.hidden = tab !== 'shape'; ui.workPanel.hidden = tab !== 'work';
}
function selectView(name) {
  activeView = name === 'reset' ? 'front' : name;
  view = name === 'side' ? { x: .05, y: Math.PI / 2 + .20, zoom: 1 } : name === 'detail' ? { x: -.3, y: -.4, zoom: 1.37 } : { ...homeView };
  syncViewSelection();
  draw(); commit();
}
function resize() { if (!stage || exportBusy) return; const rect = ui.stage.getBoundingClientRect(); stage.resize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), Math.min(devicePixelRatio || 1, 1.5)); draw(); }

function bindPointer() {
  const canvas = stage.canvas;
  const distance = () => { const a = [...pointers.values()]; return a.length >= 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0; };
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); dragging = true;
    if (pointers.size === 2) pinch = { distance: distance(), zoom: view.zoom };
  });
  canvas.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId); if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1 && pinch) view.zoom = clamp(pinch.zoom * distance() / Math.max(1, pinch.distance), .65, 1.45);
    else { view.y += (event.clientX - previous.x) * .007; view.x = clamp(view.x + (event.clientY - previous.y) * .006, -1.4, 1.4); }
    viewDirty = true; customView(); draw();
  });
  const release = event => {
    pointers.delete(event.pointerId); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) { dragging = false; if (viewDirty) { viewDirty = false; commit(); } }
  };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', event => { pointers.delete(event.pointerId); if (!pointers.size) dragging = false; });
  let wheelCommit = 0;
  canvas.addEventListener('wheel', event => { event.preventDefault(); view.zoom = clamp(view.zoom * Math.exp(-event.deltaY * .001), .65, 1.45); customView(); draw(); clearTimeout(wheelCommit); wheelCommit = setTimeout(commit, 220); }, { passive: false });
  canvas.addEventListener('keydown', event => {
    const amount = event.shiftKey ? .16 : .065;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'ArrowLeft') view.y -= amount; if (event.key === 'ArrowRight') view.y += amount;
      if (event.key === 'ArrowUp') view.x = clamp(view.x - amount, -1.4, 1.4); if (event.key === 'ArrowDown') view.x = clamp(view.x + amount, -1.4, 1.4);
      customView(); draw(); commit();
    } else if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  });
}

async function saveConfig() {
  finishGeometry();
  const data = snapshot(), filename = `memory-core-${seedText()}.json`, blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  posterTools.downloadBlob(blob, filename); stats.lastSave = { filename, bytes: blob.size, config: clone(data) }; persist(); status('配置已导出，可以在另一台设备继续创作。');
}
async function importConfig(file) {
  if (!file || exportBusy) return;
  try {
    if (file.size > 100000) throw new Error('配置文件过大，请选择此实验室导出的 JSON。');
    const data = JSON.parse(await file.text()); validateConfig(data); applyConfig(data); commit();
    stats.lastImport = { filename: file.name, seed: state.seed, phase: state.phase, geometryHash: stage.geometryInfo.hash, sourceVersion: data.version };
    persist();
  } catch (error) { status(error instanceof SyntaxError ? '文件不是有效的 JSON，当前作品已保留。' : error.message, 'notice'); }
  finally { ui.file.value = ''; }
}
async function collect() {
  if (!stats.ready || exportBusy) return;
  try {
    finishGeometry(); const moment = snapshot(); stopLoop();
    stage.setPhase(moment.phase); stage.setView(moment.view);
    const thumbnail = stage.capture(480, 350).toDataURL('image/jpeg', .84);
    const item = store.add(moment, thumbnail); stats.lastCollection = { id: item.id, seed: item.config.seed, phase: item.config.phase, thumbnailBytes: thumbnail.length };
    status(`「${state.title}」已收藏 · ${store.items.length} / 6`); storageStatus(); renderLibrary();
  } catch (error) { status(error.message, 'notice'); storageStatus(); }
  finally { draw(); syncLoop(); }
}
function renderLibrary() {
  ui.libraryGrid.replaceChildren();
  if (!store.items.length) { const empty = document.createElement('p'); empty.className = 'core-library-empty'; empty.textContent = '这里还没有作品。定格一个喜欢的瞬间，再点击「收藏作品」。'; ui.libraryGrid.append(empty); return; }
  for (const item of store.items) {
    const card = document.createElement('article'); card.className = 'core-library-card'; card.dataset.coreCollection = item.id;
    const image = document.createElement('img'); image.src = item.thumbnail; image.alt = `${item.name} 的真实三维缩略图`;
    const title = document.createElement('h3'); title.textContent = item.name;
    const meta = document.createElement('p'); meta.textContent = `${String(item.config.seed).padStart(4, '0')} / ${new Date(item.savedAt).toLocaleDateString('zh-CN')}`;
    const actions = document.createElement('div'), load = document.createElement('button'), remove = document.createElement('button');
    load.type = remove.type = 'button'; load.textContent = '继续创作'; remove.textContent = '移除'; load.dataset.coreLoad = item.id; remove.dataset.coreRemove = item.id;
    load.addEventListener('click', () => { try { applyConfig(item.config); commit(); persist(); stats.lastRestoredCollection = item.id; ui.libraryDialog.close(); status(`已打开「${item.name}」`); } catch (error) { status(error.message, 'notice'); } });
    remove.addEventListener('click', () => { try { store.remove(item.id); renderLibrary(); status('已从本机收藏移除。'); } catch (error) { status(error.message, 'notice'); } });
    actions.append(load, remove); card.append(image, title, meta, actions); ui.libraryGrid.append(card);
  }
}
function openLibrary() { renderLibrary(); ui.libraryDialog.showModal(); stopLoop(); }
async function refreshPoster() {
  if (exportBusy) return;
  const serial = ++previewSerial;
  ui.posterDownload.disabled = true; ui.posterStatus.textContent = '正在生成预览…';
  try {
    await document.fonts.ready;
    if (serial !== previewSerial || !ui.posterDialog.open) return;
    posterSnapshot.poster = { ...poster };
    const canvas = posterTools.renderCorePoster(stage, posterSnapshot, poster.format, poster.showTitle, true);
    canvas.setAttribute('aria-label', '当前流动瞬间的海报构图预览');
    ui.posterPreview.replaceChildren(canvas); ui.posterStatus.textContent = '同一瞬间，与你的舞台构图一致。'; ui.posterDownload.disabled = false;
    stage.setView(view); stage.setPhase(state.phase); draw();
  } catch (error) { ui.posterStatus.textContent = `预览未完成：${error.message}`; }
}
function openPoster() {
  finishGeometry(); posterSnapshot = snapshot(); ui.posterDialog.showModal(); stopLoop(); syncControls(); refreshPoster();
}
async function downloadPoster() {
  if (exportBusy || !posterSnapshot) return;
  exportBusy = true; stopLoop(); ui.posterDownload.disabled = true; ui.posterFormat.disabled = true; ui.posterTitle.disabled = true; ui.posterStatus.textContent = '正在生成高清海报…';
  try {
    await document.fonts.ready;
    const canvas = posterTools.renderCorePoster(stage, posterSnapshot, poster.format, poster.showTitle, false);
    const blob = await posterTools.canvasPNG(canvas), filename = `memory-core-${String(posterSnapshot.seed).padStart(4, '0')}-${poster.format}.png`;
    posterTools.downloadBlob(blob, filename);
    stats.lastExport = { filename, width: canvas.width, height: canvas.height, mime: blob.type, bytes: blob.size, seed: posterSnapshot.seed, phase: posterSnapshot.phase, geometryHash: stage.geometryInfo.hash, realWebGLPixels: true, config: clone({ ...posterSnapshot, poster: { ...poster } }), format: poster.format };
    ui.posterStatus.textContent = `${canvas.width} × ${canvas.height} 高清海报已下载。`;
    persist();
  } catch (error) { ui.posterStatus.textContent = `导出未完成：${error.message}`; }
  finally { exportBusy = false; ui.posterDownload.disabled = false; ui.posterFormat.disabled = false; ui.posterTitle.disabled = false; stage.setView(view); stage.setPhase(state.phase); resize(); syncLoop(); }
}

function bindControls() {
  ui.form.addEventListener('submit', event => event.preventDefault());
  for (const key of ['deform', 'metal', 'glow', 'speed']) {
    ui[key].addEventListener('input', () => { state[key] = clamp(Number(ui[key].value)); syncControls(); if (key === 'deform') rebuild(); else { stage.updateMaterials(state); draw(); } syncLoop(); });
    ui[key].addEventListener('change', () => { finishGeometry(); commit(); });
  }
  ui.preset.addEventListener('change', () => setPreset(ui.preset.value));
  $$('[data-core-preset]').forEach(button => button.addEventListener('click', () => setPreset(button.dataset.corePreset)));
  $$('[data-core-palette]').forEach(button => button.addEventListener('click', () => { state.palette = button.dataset.corePalette; stage.updateMaterials(state); syncControls(); draw(); commit(); }));
  ui.title.addEventListener('input', () => { state.title = ui.title.value.trim().slice(0, 24) || defaults.title; ui.pieceLabel.textContent = `${state.title} / ${seedText()}`; scheduleSave(); });
  ui.title.addEventListener('change', () => { ui.title.value = state.title; commit(); });
  ui.seed.addEventListener('change', () => {
    const seed = Number(ui.seed.value); if (!Number.isInteger(seed) || seed < 0 || seed > 999999) { ui.seed.value = String(state.seed); status('请输入 0–999999 的整数种子。', 'notice'); return; }
    state.seed = seed; rebuild(true); syncControls(); commit(); status(`种子 ${seedText()} · 已塑造新的记忆`);
  });
  ui.random.addEventListener('click', () => { const n = new Uint32Array(1); crypto.getRandomValues(n); state.seed = n[0] % 1000000; state.phase = 0; rebuild(true); syncControls(); commit(); status(`新的记忆 · ${seedText()}`); });
  ui.reset.addEventListener('click', () => { Object.assign(state, defaults); view = { ...homeView }; activeView = 'front'; poster = { format: 'portrait', showTitle: true }; rebuild(true); syncControls(); draw(); syncLoop(); commit(); status('已恢复默认作品。撤销可以找回刚才的形态。'); });
  ui.play.addEventListener('click', togglePlay);
  ui.undo.addEventListener('click', () => { const previous = history.back(); if (previous) { applyConfig(previous, { announce: false }); syncHistory(); scheduleSave(); status('已撤销。'); } });
  ui.redo.addEventListener('click', () => { const next = history.forward(); if (next) { applyConfig(next, { announce: false }); syncHistory(); scheduleSave(); status('已重做。'); } });
  $$('[data-core-tab]').forEach(button => {
    button.addEventListener('click', () => setTab(button.dataset.coreTab));
    button.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setTab(event.key === 'Home' ? 'shape' : event.key === 'End' ? 'work' : activeTab === 'shape' ? 'work' : 'shape', true); } });
  });
  $$('[data-core-view]').forEach(button => {
    const label = button.querySelector('span')?.textContent.trim() || '调整视角';
    button.setAttribute('aria-label', label); button.title = label;
    button.addEventListener('click', () => selectView(button.dataset.coreView));
  });
  ui.fullscreen.setAttribute('aria-label', '全屏'); ui.fullscreen.title = '全屏';
  ui.fullscreen.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (ui.stage.requestFullscreen) await ui.stage.requestFullscreen(); else status('此浏览器不支持全屏，仍可使用双指放大。', 'notice'); }
    catch (error) { status(`全屏暂不可用：${error.message}`, 'notice'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const fullscreen = document.fullscreenElement === ui.stage;
    ui.fullscreen.setAttribute('aria-pressed', String(fullscreen));
    ui.fullscreen.setAttribute('aria-label', fullscreen ? '退出全屏' : '全屏'); ui.fullscreen.title = fullscreen ? '退出全屏' : '全屏'; resize();
  });
  ui.export.addEventListener('click', openPoster); ui.save.addEventListener('click', saveConfig); ui.import.addEventListener('click', () => ui.file.click()); ui.file.addEventListener('change', () => importConfig(ui.file.files?.[0]));
  [ui.collect, ui.collectPanel].forEach(button => button.addEventListener('click', collect)); [ui.library, ui.libraryPanel].forEach(button => button.addEventListener('click', openLibrary));
  ui.posterFormat.addEventListener('change', () => { poster.format = ui.posterFormat.value; commit(); refreshPoster(); });
  ui.posterTitle.addEventListener('change', () => { poster.showTitle = ui.posterTitle.checked; commit(); refreshPoster(); });
  ui.posterDownload.addEventListener('click', downloadPoster);
  $$('[data-core-close]').forEach(button => button.addEventListener('click', () => { if (!exportBusy) button.closest('dialog').close(); }));
  [ui.posterDialog, ui.libraryDialog].forEach(dialog => {
    dialog.addEventListener('cancel', event => { if (exportBusy) event.preventDefault(); });
    dialog.addEventListener('close', () => { if (dialog === ui.posterDialog) { previewSerial++; posterSnapshot = null; } draw(); syncLoop(); });
    dialog.addEventListener('click', event => { if (event.target !== dialog || exportBusy) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); });
  });
  document.addEventListener('keydown', event => {
    const textEditing = event.target.tagName === 'TEXTAREA' || (event.target.tagName === 'INPUT' && event.target.type !== 'range');
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z' || textEditing || document.querySelector('dialog[open]')) return;
    event.preventDefault(); (event.shiftKey ? ui.redo : ui.undo).click();
  });
}

function lifecycle() {
  const changed = () => { syncLoop(); if (!gates.hidden) draw(); };
  document.addEventListener('visibilitychange', () => { gates.hidden = document.hidden; if (gates.hidden) persist(); changed(); });
  window.addEventListener('blur', () => { gates.blurred = true; pointers.clear(); dragging = false; persist(); stopLoop(); });
  window.addEventListener('focus', () => { gates.blurred = false; changed(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { gates.reduced = event.matches; syncControls(); changed(); });
  new ResizeObserver(resize).observe(ui.stage);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { gates.offscreen = !entries[0].isIntersecting; changed(); }, { threshold: .01 }).observe(ui.stage);
  window.addEventListener('pagehide', () => { persist(); gates.hidden = true; stopLoop(); });
  window.addEventListener('pageshow', () => { gates.hidden = document.hidden; gates.blurred = !document.hasFocus(); changed(); });
}

async function boot() {
  const ids = { stage: 'core-stage', status: 'core-status', form: 'core-form', title: 'core-title', seed: 'core-seed', preset: 'core-preset', random: 'core-random', reset: 'core-reset', play: 'core-play', export: 'core-export', save: 'core-save', import: 'core-import', file: 'core-file', undo: 'core-undo', redo: 'core-redo', fullscreen: 'core-fullscreen', collect: 'core-collect', collectPanel: 'core-collect-panel', library: 'core-library', libraryPanel: 'core-library-panel', draftStatus: 'core-draft-status', savedTime: 'core-saved-time', shapePanel: 'core-shape-panel', workPanel: 'core-work-panel', pieceLabel: 'core-piece-label', motionLabel: 'core-motion-label', posterDialog: 'core-poster-dialog', libraryDialog: 'core-library-dialog', libraryGrid: 'core-library-grid', posterPreview: 'core-poster-preview', posterFormat: 'core-poster-format', posterTitle: 'core-poster-title', posterStatus: 'core-poster-status', posterDownload: 'core-poster-download' };
  for (const [name, id] of Object.entries(ids)) { ui[name] = document.getElementById(id); if (!ui[name]) throw new Error(`Missing ${id}`); }
  for (const key of ['deform', 'metal', 'glow', 'speed']) ui[key] = $(`[data-core-param="${key}"]`);
  const modules = await Promise.all([import('./core-scene.js'), import('./core-store.js'), import('./core-poster.js')]);
  const { CoreScene } = modules[0], { CoreStore, CoreHistory } = modules[1]; posterTools = modules[2];
  store = new CoreStore(); store.loadLibrary();
  const draft = store.loadDraft();
  if (draft?.config) {
    try { const checked = validateConfig(draft.config); Object.assign(state, checked.state); view = checked.view; poster = checked.poster; store.restored = true; store.lastSaved = draft.savedAt; }
    catch (error) { store.error = `上次草稿无法恢复：${error.message}`; }
  }
  stage = new CoreScene(ui.stage, lost => { stats.contextLost = lost; if (lost) { stopLoop(); persist(); status('图形暂时中断。你的作品已保留，正在等待恢复。', 'error'); } else { resize(); draw(); syncLoop(); status('画布已恢复。'); } });
  await stage.loadEnvironment();
  activeView = detectView(view);
  stage.rebuild(state); stage.setView(view); stage.setPhase(state.phase);
  resize();
  const thumbnails = stage.presetThumbnails(defaults);
  for (const button of $$('[data-core-preset]')) button.querySelector('img').src = thumbnails[button.dataset.corePreset];
  history = new CoreHistory(snapshot()); stats.ready = true;
  syncControls(); bindControls(); bindPointer(); lifecycle(); resize(); draw();
  if (store.error) storageStatus(); else persist();
  status(stage.environmentInfo.fallback ? '摄影环境暂不可用，已切换本地柔光环境。' : gates.reduced ? '已减少动态。拖动或方向键仍可探索。' : ''); syncLoop();
}
boot().catch(error => { stats.error = String(error.message || error); stats.ready = false; stopLoop(); status('画布未能启动。请刷新，或使用支持 WebGL 的浏览器。已保存的作品不会丢失。', 'error'); console.error('[Memory Core]', error); });
