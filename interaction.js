(() => {
  'use strict';

  const body = document.body;
  const cursor = document.getElementById('portfolio-cursor');
  const cursorLabel = cursor?.querySelector('.cursor-label');
  const inspection = document.getElementById('hold-inspection');
  const holdHost = document.querySelector('[data-hold-model-host]');
  const dialog = document.getElementById('character-dialog');
  const dialogHost = document.getElementById('character-model-host');
  const viewport = document.getElementById('character-viewport');
  const fallback = document.getElementById('character-fallback');
  const status = document.getElementById('character-status');
  const openButtons = [...document.querySelectorAll('[data-character-open]')];
  const closeButton = document.getElementById('character-close');
  const viewButton = document.getElementById('character-view');
  const wireButton = document.getElementById('character-wireframe');
  const resetButton = document.getElementById('character-reset');
  const downloadButton = document.getElementById('character-download');
  const autoButton = document.getElementById('character-auto');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const surfaces = [...document.querySelectorAll('[data-hold-surface]')];
  surfaces.forEach(surface => {
    surface.querySelectorAll('img').forEach(image => { image.draggable = false; });
  });
  const controls = [autoButton, viewButton, wireButton, resetButton, downloadButton].filter(Boolean);
  const interactiveSelector = 'a[href],button,input,select,textarea,summary,details,label,[role="button"],[role="link"],[contenteditable]:not([contenteditable="false"]),iframe,video,audio,dialog,.hud-header,.hud-rail,[data-no-hold]';
  const HOLD_DELAY = 180;
  const PROGRESS_DURATION = 650;
  const MOVE_TOLERANCE = 12;
  const pointers = new Map();
  const downloadURLs = new Set();
  let model = null;
  let modelState = 'idle';
  let press = null;
  let holdTimer = 0;
  let progressFrame = 0;
  let held = false;
  let inspecting = false;
  let pageFocused = true;
  let cursorVisible = false;
  let opener = null;
  let savedOverflow = '';
  let modalOwned = false;
  let view = 'portrait';
  let wireframe = false;
  let exporting = false;
  let pinchDistance = 0;
  let heldDrag = false;
  let cursorPointerId = null;
  let cursorReleaseTimer = 0;

  if (!(dialog instanceof HTMLDialogElement) || !viewport || !holdHost || !dialogHost) return;

  const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
  const elementTarget = target => target instanceof Element ? target : target?.parentElement;
  const anyDialogOpen = () => Boolean(document.querySelector('dialog[open]'));
  const otherDialogOpen = () => [...document.querySelectorAll('dialog[open]')].some(element => element !== dialog);
  const isInactive = element => !element || Boolean(element.closest('[inert],[aria-hidden="true"]'));
  const inside = (box, x, y) => box.width > 1 && box.height > 1 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;

  function holdSurface(target, x, y) {
    const element = elementTarget(target);
    if (!element || element.closest(interactiveSelector) || anyDialogOpen() || isInactive(element)) return null;
    const direct = element.closest('[data-hold-surface]');
    if (direct && !isInactive(direct)) return direct;
    // The shared sequence deliberately makes visual panels pointer-transparent.
    // Resolve their visible picture geometry without changing the scroll stage.
    if (!element.closest('[data-sequence-stage]')) return null;
    return [...surfaces].reverse().find(surface => {
      if (isInactive(surface)) return false;
      const visual = surface.querySelector('[data-scene]');
      const style = visual && getComputedStyle(visual);
      return visual && style.visibility !== 'hidden' && Number(style.opacity) > 0.01 && inside(visual.getBoundingClientRect(), x, y);
    }) || null;
  }

  function setCursorVisible(visible) {
    cursorVisible = Boolean(visible && cursor && finePointer.matches && !anyDialogOpen() && !document.hidden);
    cursor?.classList.toggle('is-visible', cursorVisible);
    body.classList.toggle('custom-cursor', cursorVisible);
    if (!cursorVisible) {
      cursor?.classList.remove('is-hover', 'is-holdable');
      if (cursorLabel && !press) cursorLabel.textContent = '';
    }
  }

  function releaseCursor(event, animate = true) {
    if (event && event.pointerId !== cursorPointerId) return;
    const wasDown = cursorPointerId !== null;
    cursorPointerId = null;
    if (cursorReleaseTimer) clearTimeout(cursorReleaseTimer);
    cursorReleaseTimer = 0;
    cursor?.classList.remove('is-pointerdown', 'is-releasing');
    if (cursor) cursor.dataset.scopeState = 'idle';
    if (wasDown && animate && cursorVisible && !reducedMotion.matches) {
      cursor?.classList.add('is-releasing');
      cursorReleaseTimer = setTimeout(() => {
        cursorReleaseTimer = 0;
        cursor?.classList.remove('is-releasing');
      }, 420);
    }
  }

  function pressCursor(event) {
    if (event.button !== 0 || event.pointerType !== 'mouse' || event.isPrimary === false || !finePointer.matches || anyDialogOpen()) return;
    releaseCursor(null, false);
    updateCursor(event);
    cursorPointerId = event.pointerId;
    cursor?.classList.add('is-pointerdown');
    if (cursor) cursor.dataset.scopeState = 'down';
  }

  function updateCursor(event) {
    if (event.pointerType !== 'mouse' || !finePointer.matches || anyDialogOpen()) {
      setCursorVisible(false);
      return;
    }
    if (cursor) {
      cursor.style.left = event.clientX + 'px';
      cursor.style.top = event.clientY + 'px';
    }
    setCursorVisible(true);
    const target = elementTarget(event.target);
    const hover = Boolean(target?.closest(interactiveSelector));
    const surface = holdSurface(target, event.clientX, event.clientY);
    cursor?.classList.toggle('is-hover', hover && cursorPointerId === null && !press);
    cursor?.classList.toggle('is-holdable', Boolean(surface) && !hover);
    if (cursorLabel) cursorLabel.textContent = held ? '松开返回' : surface && !hover ? '按住查看' : '';
    if (surface) ensureModel();
  }

  function setInspectionMode() {
    const next = held || dialog.open;
    if (inspecting !== next) {
      inspecting = next;
      body.classList.toggle('inspecting', next);
      window.dispatchEvent(new CustomEvent('portfolio-inspect-mode', { detail: { active: next } }));
    }
    model?.setActive(Boolean(next && pageFocused && !document.hidden));
  }

  function updateControls() {
    controls.forEach(control => { control.disabled = modelState !== 'ready' || exporting; });
    const details = model?.inspect?.();
    const automatic = Boolean(details?.autoRotate);
    const isBust = details?.profile === 'bust';
    autoButton?.setAttribute('aria-pressed', String(automatic));
    autoButton?.setAttribute('aria-label', automatic ? '暂停自动旋转' : '开启自动旋转');
    if (autoButton) autoButton.textContent = automatic ? '自动旋转' : '旋转暂停';
    viewButton?.setAttribute('aria-pressed', String(view === 'fullbody'));
    if (viewButton) {
      viewButton.textContent = isBust ? (view === 'fullbody' ? '近景' : '整体') : (view === 'fullbody' ? '胸像' : '全身');
      viewButton.setAttribute('aria-label', isBust ? (view === 'fullbody' ? '切换角色近景' : '查看胸像整体') : (view === 'fullbody' ? '切换角色胸像' : '查看角色全身'));
    }
    wireButton?.setAttribute('aria-pressed', String(wireframe));
    downloadButton?.setAttribute('aria-busy', String(exporting));
  }

  function readyModel() {
    modelState = 'ready';
    viewport.dataset.modelState = 'ready';
    viewport.querySelectorAll('canvas').forEach(canvas => { canvas.style.visibility = ''; });
    if (fallback) fallback.hidden = true;
    if (status) status.textContent = model?.inspect?.().autoRotate ? '3D 已就绪 · 自动缓慢旋转，可拖动查看。' : '3D 已就绪 · 拖动可旋转。';
    updateControls();
    setInspectionMode();
  }

  function failedModel() {
    modelState = 'failed';
    viewport.dataset.modelState = 'failed';
    viewport.querySelectorAll('canvas').forEach(canvas => { canvas.style.visibility = 'hidden'; });
    if (fallback) fallback.hidden = false;
    if (status) status.textContent = '3D 暂不可用 · 平面角色设定参考图';
    stopDrag();
    updateControls();
    model?.setActive(false);
  }

  function ensureModel() {
    if (model || modelState === 'loading' || modelState === 'failed') return model;
    modelState = 'loading';
    viewport.dataset.modelState = 'loading';
    if (fallback) fallback.hidden = false;
    if (status) status.textContent = '正在载入 3D 角色…';
    updateControls();
    try {
      if (!window.PortfolioCharacterModel?.create) throw new Error('Character renderer unavailable.');
      model = window.PortfolioCharacterModel.create(viewport, {
        active: false,
        onReady: readyModel,
        onError: failedModel,
        onMotionChange: () => {
          updateControls();
          if (modelState === 'ready' && status) status.textContent = model?.inspect?.().autoRotate ? '3D 已就绪 · 自动缓慢旋转，可拖动查看。' : '3D 已就绪 · 拖动可旋转。';
        }
      });
      Promise.resolve(model.ready).then(readyModel, failedModel);
      setInspectionMode();
    } catch {
      failedModel();
    }
    return model;
  }

  function updateHoldProgress(now) {
    progressFrame = 0;
    if (!press) return;
    const progress = clamp((now - press.startedAt) / PROGRESS_DURATION);
    if (cursor) cursor.style.setProperty('--hold-progress', String(progress));
    if (progress < 1) progressFrame = requestAnimationFrame(updateHoldProgress);
  }

  function beginHold() {
    holdTimer = 0;
    if (!press || !finePointer.matches || document.hidden || !pageFocused || anyDialogOpen()) return cancelHold();
    held = true;
    if (inspection) {
      inspection.dataset.chapter = body.dataset.chapter || 'top';
      inspection.hidden = false;
      inspection.classList.add('is-active');
    }
    holdHost.append(viewport);
    cursor?.classList.add('is-held');
    if (cursorLabel) cursorLabel.textContent = '松开返回';
    ensureModel();
    setInspectionMode();
  }

  function cancelHold() {
    if (holdTimer) clearTimeout(holdTimer);
    if (progressFrame) cancelAnimationFrame(progressFrame);
    holdTimer = progressFrame = 0;
    press = null;
    held = false;
    if (heldDrag) model?.setInteracting(false);
    heldDrag = false;
    if (inspection) {
      inspection.hidden = true;
      inspection.classList.remove('is-active');
    }
    cursor?.classList.remove('is-pressing', 'is-held');
    cursor?.style.setProperty('--hold-progress', '0');
    if (cursorLabel) cursorLabel.textContent = cursor?.classList.contains('is-holdable') ? '按住查看' : '';
    setInspectionMode();
  }

  function startHold(event) {
    if (event.button !== 0) { cancelHold(); return; }
    if (!finePointer.matches || event.pointerType !== 'mouse' || event.isPrimary === false || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const surface = holdSurface(event.target, event.clientX, event.clientY);
    if (!surface || !document.getSelection()?.isCollapsed) return;
    cancelHold();
    updateCursor(event);
    press = { pointerId: event.pointerId, startedAt: performance.now(), x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, surface };
    cursor?.classList.add('is-pressing');
    holdTimer = setTimeout(beginHold, HOLD_DELAY);
    progressFrame = requestAnimationFrame(updateHoldProgress);
    ensureModel();
  }

  function movePointer(event) {
    if (event.pointerId === cursorPointerId && !(event.buttons & 1)) releaseCursor(event);
    updateCursor(event);
    if (!press || event.pointerId !== press.pointerId) return;
    if (!(event.buttons & 1) || (!held && Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE)) {
      cancelHold();
      return;
    }
    if (held && modelState === 'ready') {
      const dx = event.clientX - press.lastX, dy = event.clientY - press.lastY;
      if (Math.hypot(dx, dy) > .5) {
        heldDrag = true;
        model.setInteracting(true);
        model.rotate(dx * 0.25, dy * 0.25);
      }
    }
    press.lastX = event.clientX;
    press.lastY = event.clientY;
  }

  function stopDrag() {
    const wasDragging = pointers.size > 0;
    for (const id of pointers.keys()) {
      try { if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id); } catch { /* Pointer was already cancelled. */ }
    }
    pointers.clear();
    pinchDistance = 0;
    viewport.classList.remove('is-dragging');
    viewport.style.cursor = 'grab';
    if (wasDragging) model?.setInteracting(false);
  }

  function manualPulse(action) {
    if (!model || modelState !== 'ready') return;
    const keepInteracting = pointers.size > 0 || heldDrag;
    model.setInteracting(true);
    action();
    if (!keepInteracting) model.setInteracting(false);
  }

  function openDialog(trigger) {
    if (dialog.open || otherDialogOpen()) return;
    releaseCursor(null, false);
    cancelHold();
    opener = trigger instanceof HTMLElement ? trigger : document.activeElement;
    savedOverflow = body.style.overflow;
    dialogHost.append(viewport);
    try {
      dialog.showModal();
    } catch {
      holdHost.append(viewport);
      return;
    }
    modalOwned = true;
    body.style.overflow = 'hidden';
    openButtons.forEach(button => button.setAttribute('aria-expanded', 'true'));
    setCursorVisible(false);
    ensureModel();
    setInspectionMode();
    closeButton?.focus({ preventScroll: true });
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function finishDialog() {
    if (!modalOwned) return;
    modalOwned = false;
    stopDrag();
    cancelHold();
    holdHost.append(viewport);
    body.style.overflow = savedOverflow;
    openButtons.forEach(button => button.setAttribute('aria-expanded', 'false'));
    setCursorVisible(false);
    setInspectionMode();
    const focusTarget = opener?.isConnected && !isInactive(opener) ? opener : openButtons.find(button => !isInactive(button));
    focusTarget?.focus({ preventScroll: true });
    opener = null;
  }

  function pointerDistance() {
    const points = [...pointers.values()];
    return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  viewport.style.touchAction = 'none';
  viewport.style.cursor = 'grab';
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', '影像记录者的 3D 装甲模型，可用方向键旋转，加减键缩放。');
  viewport.addEventListener('pointerdown', event => {
    if (!dialog.open || modelState !== 'ready' || event.button !== 0 || elementTarget(event.target)?.closest('button,a,input,select,textarea')) return;
    event.preventDefault();
    model.setInteracting(true);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { viewport.setPointerCapture(event.pointerId); } catch { /* A cancelled pointer has no capture. */ }
    pinchDistance = pointerDistance();
    viewport.classList.add('is-dragging');
    viewport.style.cursor = 'grabbing';
    viewport.focus({ preventScroll: true });
  });
  viewport.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous || !dialog.open || modelState !== 'ready') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) {
      const distance = pointerDistance();
      if (pinchDistance > 0) model.zoom((pinchDistance - distance) * 3);
      pinchDistance = distance;
    } else model.rotate(event.clientX - previous.x, event.clientY - previous.y);
  });
  const endDragPointer = event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try { if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId); } catch { /* Capture ended with the pointer. */ }
    pinchDistance = pointerDistance();
    if (!pointers.size) {
      model?.setInteracting(false);
      stopDrag();
    }
  };
  viewport.addEventListener('pointerup', endDragPointer);
  viewport.addEventListener('pointercancel', endDragPointer);
  viewport.addEventListener('lostpointercapture', endDragPointer);
  viewport.addEventListener('wheel', event => {
    if (!dialog.open || modelState !== 'ready' || event.ctrlKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    manualPulse(() => model.zoom(event.deltaY * unit));
  }, { passive: false });
  viewport.addEventListener('keydown', event => {
    if (!dialog.open || modelState !== 'ready') return;
    const rotations = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -18], ArrowDown: [0, 18] };
    if (rotations[event.key]) manualPulse(() => model.rotate(...rotations[event.key]));
    else if (event.key === '+' || event.key === '=') manualPulse(() => model.zoom(-90));
    else if (event.key === '-' || event.key === '_') manualPulse(() => model.zoom(90));
    else if (event.key === 'Home') manualPulse(() => model.resetView());
    else return;
    event.preventDefault();
  });
  viewport.addEventListener('dragstart', event => event.preventDefault());

  openButtons.forEach(button => {
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => openDialog(button));
  });
  closeButton?.addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', stopDrag);
  dialog.addEventListener('close', finishDialog);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (!inside(box, event.clientX, event.clientY)) closeDialog();
  });
  viewButton?.addEventListener('click', () => {
    if (modelState !== 'ready') return;
    view = view === 'portrait' ? 'fullbody' : 'portrait';
    model.setView(view);
    updateControls();
  });
  wireButton?.addEventListener('click', () => {
    if (modelState !== 'ready') return;
    wireframe = !wireframe;
    model.setWireframe(wireframe);
    updateControls();
  });
  autoButton?.addEventListener('click', () => {
    if (modelState !== 'ready') return;
    model.setAutoRotate(!model.inspect().autoRotate);
    updateControls();
    if (status) status.textContent = model.inspect().autoRotate ? '3D 已就绪 · 自动缓慢旋转，可拖动查看。' : '3D 已就绪 · 拖动可旋转。';
  });
  resetButton?.addEventListener('click', () => {
    if (modelState !== 'ready') return;
    view = 'portrait';
    wireframe = false;
    manualPulse(() => {
      model.setView(view);
      model.setWireframe(wireframe);
      model.resetView();
    });
    updateControls();
  });
  downloadButton?.addEventListener('click', async () => {
    if (modelState !== 'ready' || exporting) return;
    exporting = true;
    updateControls();
    if (status) status.textContent = '正在导出模型…';
    try {
      const blob = await model.exportGLB();
      const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      if (header.length !== 4 || String.fromCharCode(...header) !== 'glTF') throw new Error('Invalid GLB export.');
      const url = URL.createObjectURL(blob);
      downloadURLs.add(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = '影像记录者-装甲形态.glb';
      link.hidden = true;
      body.append(link);
      link.click();
      link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); downloadURLs.delete(url); }, 30000);
      if (status) status.textContent = '模型已导出。';
    } catch {
      if (status) status.textContent = '模型导出失败，请稍后重试。';
    } finally {
      exporting = false;
      updateControls();
    }
  });

  document.addEventListener('pointermove', movePointer, { passive: true });
  document.addEventListener('dragstart', event => {
    const target = elementTarget(event.target);
    const surface = target?.closest('[data-hold-surface]');
    if (surface && !isInactive(surface) && !target.closest(interactiveSelector)) event.preventDefault();
  });
  document.addEventListener('pointerdown', event => { pressCursor(event); startHold(event); }, { passive: true });
  document.addEventListener('pointerup', event => { if (press?.pointerId === event.pointerId) cancelHold(); releaseCursor(event); updateCursor(event); }, { passive: true });
  document.addEventListener('pointercancel', event => { releaseCursor(event); if (press?.pointerId === event.pointerId) cancelHold(); }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (event.relatedTarget === null) { releaseCursor(null, false); cancelHold(); setCursorVisible(false); }
  }, { passive: true });
  document.addEventListener('contextmenu', cancelHold, { passive: true });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && press) cancelHold(); });
  window.addEventListener('wheel', cancelHold, { passive: true });
  window.addEventListener('scroll', cancelHold, { passive: true });
  window.addEventListener('blur', () => {
    pageFocused = false;
    releaseCursor(null, false);
    cancelHold();
    stopDrag();
    setCursorVisible(false);
    setInspectionMode();
  });
  window.addEventListener('focus', () => { pageFocused = true; setInspectionMode(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { releaseCursor(null, false); cancelHold(); stopDrag(); setCursorVisible(false); }
    setInspectionMode();
  });
  const preferenceChange = () => { releaseCursor(null, false); cancelHold(); setCursorVisible(false); };
  [finePointer, reducedMotion].forEach(query => {
    if (query.addEventListener) query.addEventListener('change', preferenceChange);
    else query.addListener(preferenceChange);
  });
  const dialogObserver = new MutationObserver(() => {
    if (!anyDialogOpen()) return;
    releaseCursor(null, false);
    cancelHold();
    setCursorVisible(false);
  });
  document.querySelectorAll('dialog').forEach(element => dialogObserver.observe(element, { attributes: true, attributeFilter: ['open'] }));
  window.addEventListener('pagehide', event => {
    releaseCursor(null, false);
    cancelHold();
    stopDrag();
    setCursorVisible(false);
    model?.setActive(false);
    if (!event.persisted) {
      model?.destroy();
      dialogObserver.disconnect();
      downloadURLs.forEach(url => URL.revokeObjectURL(url));
      downloadURLs.clear();
    }
  });
  window.addEventListener('pageshow', () => { pageFocused = true; setInspectionMode(); });

  holdHost.append(viewport);
  updateControls();
  window.PortfolioInteraction = Object.freeze({
    getModel: () => model,
    getState: () => ({
      mode: dialog.open ? 'dialog' : held ? 'held' : press ? 'pressing' : 'idle',
      modelState, view, wireframe, exporting, cursorVisible, inspecting,
      cursorPointerDown: cursorPointerId !== null,
      cursorPointerId,
      autoRotate: Boolean(model?.inspect?.().autoRotate),
      press: press ? { pointerId: press.pointerId, elapsed: performance.now() - press.startedAt } : null,
      activePointers: pointers.size
    })
  });
})();
