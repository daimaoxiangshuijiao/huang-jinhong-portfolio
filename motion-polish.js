(() => {
  'use strict';
  if (window.PortfolioMotionPolish) return;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const animations = new Set();
  const cleanups = [];
  const records = new Map();
  let focused = document.hasFocus(), inspecting = false, destroyed = false;
  let introState = 'pending';
  const introAnimations = new Set();
  const allowed = () => !destroyed && !media.matches && focused && !document.hidden && !inspecting && !document.querySelector('dialog[open]');
  const inView = element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  };
  function on(target, event, callback, options) {
    target.addEventListener(event, callback, options);
    cleanups.push(() => target.removeEventListener(event, callback, options));
  }
  function track(animation, group) {
    animations.add(animation);
    group?.add(animation);
    animation.finished.catch(() => {}).finally(() => {
      animations.delete(animation);
      group?.delete(animation);
    });
    return animation;
  }
  function cancelGroup(group) {
    for (const animation of group) {
      animation.cancel();
      animations.delete(animation);
    }
    group.clear();
  }
  function nativeOpen(record, value) {
    record.expectedNativeOpen = value;
    record.element.open = value;
  }
  function collapsedHeight(record) {
    const style = getComputedStyle(record.element);
    return record.summary.getBoundingClientRect().height +
      ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
        .reduce((total, key) => total + (parseFloat(style[key]) || 0), 0);
  }
  function clearDetailsAnimation(record) {
    record.generation++;
    if (record.animation) {
      record.animation.cancel();
      animations.delete(record.animation);
      record.animation = null;
    }
    cancelGroup(record.children);
  }
  function commit(record) {
    clearDetailsAnimation(record);
    nativeOpen(record, record.intent);
    record.content.inert = false;
    record.element.style.removeProperty('height');
    record.element.style.removeProperty('overflow');
    record.state = record.intent ? 'open' : 'closed';
    record.element.dataset.motionState = record.state;
    record.summary.setAttribute('aria-expanded', String(record.intent));
  }
  function request(record, intent, external = false) {
    if (!record || destroyed) return;
    if (record.intent === intent && !external) return;
    const previousIntent = record.intent;
    // Read the rendered height before cancellation, so reversals start in place.
    let from = record.element.getBoundingClientRect().height;
    if (external && intent && !previousIntent) from = collapsedHeight(record);
    if (external && !intent && previousIntent && !record.element.open) {
      nativeOpen(record, true);
      from = record.element.getBoundingClientRect().height;
    }
    record.intent = intent;
    clearDetailsAnimation(record);
    record.summary.setAttribute('aria-expanded', String(intent));
    if (!intent && record.content.contains(document.activeElement)) record.summary.focus({preventScroll: true});
    if (!allowed() || !inView(record.element) || !record.element.animate) { commit(record); return; }

    // Natural height is measured synchronously; no content is moved or cloned.
    nativeOpen(record, true);
    record.content.inert = false;
    record.element.style.removeProperty('height');
    record.element.style.removeProperty('overflow');
    const expanded = record.element.getBoundingClientRect().height;
    const collapsed = collapsedHeight(record);
    const to = intent ? expanded : collapsed;
    if (Math.abs(to - from) < 1) { commit(record); return; }
    const mobile = innerWidth <= 700;
    const fullDuration = intent ? (mobile ? 420 : 460) : (mobile ? 300 : 340);
    const fraction = Math.min(1, Math.abs(to - from) / Math.max(1, expanded - collapsed));
    const duration = Math.max(160, Math.round(fullDuration * fraction));
    record.content.inert = !intent;
    record.state = intent ? 'opening' : 'closing';
    record.element.dataset.motionState = record.state;
    record.element.style.height = from + 'px';
    record.element.style.overflow = 'hidden';
    const generation = record.generation;
    const animation = track(record.element.animate(
      [{height: from + 'px'}, {height: to + 'px'}], {duration, easing: ease, fill: 'both'}));
    record.animation = animation;
    if (intent) {
      const groups = record.content.querySelectorAll('.case-heading, .process-grid > div, .case-result, .authorship-note, .case-content > a, .case-links');
      groups.forEach((element, index) => track(element.animate([
        {opacity: .35, translate: '0 8px'}, {opacity: 1, translate: '0 0'}
      ], {duration: 340, delay: Math.min(index * 36, 108), easing: ease}), record.children));
    }
    animation.finished.then(() => {
      if (generation === record.generation && record.animation === animation) commit(record);
    }).catch(() => {});
  }
  document.querySelectorAll('#works details').forEach(element => {
    const summary = element.querySelector(':scope > summary');
    const content = element.querySelector(':scope > .case-content');
    if (!summary || !content) return;
    const record = {element, summary, content, intent: element.open, expectedNativeOpen: element.open,
      state: element.open ? 'open' : 'closed', animation: null, children: new Set(), generation: 0,
      originalExpanded: summary.getAttribute('aria-expanded')};
    records.set(element, record);
    element.dataset.motionState = record.state;
    summary.setAttribute('aria-expanded', String(record.intent));
    on(summary, 'click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          event.target.closest('a,button,input,select,textarea')) return;
      event.preventDefault();
      request(record, !record.intent);
    });
    on(element, 'toggle', () => {
      if (element.open !== record.expectedNativeOpen) request(record, element.open, true);
    });
  });

  function finishIntro() {
    cancelGroup(introAnimations);
    if (introState === 'pending' || introState === 'playing') introState = 'finished';
  }
  function startIntro() {
    if (introState !== 'pending' || destroyed) return;
    if (!allowed() || scrollY > 16 || (window.PortfolioCinematicStage?.inspect().progress || 0) > .015) {
      introState = 'skipped'; return;
    }
    introState = 'playing';
    const sequence = [
      [document.querySelector('.hero-identity'), 0, 420, 8],
      [document.querySelector('.hero-description'), 40, 420, 8],
      ...[...document.querySelectorAll('#hero-heading > span')].map((element, index) => [element, 70 + index * 80, 560, 12]),
      [document.querySelector('.hero-action'), 320, 320, 4]
    ];
    const running = sequence.filter(([element]) => element?.animate).map(([element, delay, duration, distance]) => {
      // Individual translate leaves the scroll camera's transform untouched.
      const animation = track(element.animate([
        {opacity: .2, translate: '0 ' + distance + 'px'}, {opacity: 1, translate: '0 0'}
      ], {duration, delay, easing: ease, fill: 'backwards'}), introAnimations);
      return animation.finished.catch(() => {});
    });
    Promise.all(running).then(() => { if (introState === 'playing') introState = 'finished'; });
  }
  const heroImage = document.querySelector('.hero-visual > img');
  Promise.all([document.fonts?.ready, heroImage?.decode?.().catch(() => {})]).then(startIntro);
  function stop(preservePendingIntro = false) {
    if (!preservePendingIntro || introState !== 'pending') finishIntro();
    records.forEach(record => {
      // An external native toggle may be queued behind blur/resize/preference.
      // Internal height animation always keeps expectedNativeOpen in sync.
      if (record.element.open !== record.expectedNativeOpen) record.intent = record.element.open;
      commit(record);
    });
  }
  on(window, 'scroll', () => {
    // Mobile viewport initialization can emit a zero-position scroll event.
    if (introState !== 'pending' || scrollY > 16) finishIntro();
  }, {passive: true});
  on(window, 'wheel', finishIntro, {passive: true});
  on(window, 'pointerdown', finishIntro, {passive: true});
  on(document, 'focusin', event => {
    if (event.target.closest('.hero-copy') && introState === 'playing') finishIntro();
  });
  on(window, 'blur', () => {focused = false; stop();});
  on(window, 'focus', () => {focused = true;});
  on(window, 'resize', () => stop(true), {passive: true});
  on(window, 'pagehide', () => stop());
  on(document, 'visibilitychange', () => {if (document.hidden) stop();});
  on(window, 'portfolio-inspect-mode', event => {inspecting = Boolean(event.detail?.active); if (inspecting) stop();});
  const preferenceChanged = () => {if (media.matches) stop();};
  if (media.addEventListener) on(media, 'change', preferenceChanged);
  else {media.addListener(preferenceChanged); cleanups.push(() => media.removeListener(preferenceChanged));}
  const modalObserver = new MutationObserver(() => {if (document.querySelector('dialog[open]')) stop();});
  document.querySelectorAll('dialog').forEach(dialog => modalObserver.observe(dialog, {attributes: true, attributeFilter: ['open']}));
  window.PortfolioMotionPolish = Object.freeze({
    openDetails(element) {request(records.get(element), true);},
    closeDetails(element) {request(records.get(element), false);},
    inspect() {
      return {reducedMotion: media.matches, focused, hidden: document.hidden, introState,
        activeAnimations: animations.size,
        details: [...records.values()].map(record => ({id: record.element.id, state: record.state,
          intent: record.intent, domOpen: record.element.open, animationRunning: Boolean(record.animation),
          childAnimationCount: record.children.size}))};
    },
    destroy() {
      stop(); destroyed = true;
      modalObserver.disconnect(); cleanups.splice(0).forEach(cleanup => cleanup());
      records.forEach(record => {
        delete record.element.dataset.motionState;
        if (record.originalExpanded === null) record.summary.removeAttribute('aria-expanded');
        else record.summary.setAttribute('aria-expanded', record.originalExpanded);
      });
    }
  });
})();
