(() => {
  'use strict';
  if (window.PortfolioCinematicInterface) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const desktop = matchMedia('(min-width: 821px)');
  const animations = new Set();
  const hovered = new Set();
  const hoverStates = new Map();
  const revealed = new WeakSet();
  let focused = true, inspecting = false, destroyed = false, revealCount = 0;
  let observer = null;
  let hoverFrame = 0, hoverTimestamp = 0, hoverFrames = 0;
  const decorations = [];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const layer = (className, html, parent, prepend = false) => {
    if (!parent) return null;
    const element = document.createElement('div');
    element.className = className;
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = html;
    prepend ? parent.prepend(element) : parent.append(element);
    decorations.push(element);
    return element;
  };
  const svg = (className, viewBox, content) => `<svg class="${className}" viewBox="${viewBox}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${content}</svg>`;
  // This deferred file executes before app.js. The inert archive clone receives
  // identical optical framing, while only the real content receives listeners.
  layer('cine-layer cine-hero-optics',
    svg('cine-registration', '0 0 1536 1024', '<path d="M98 240h26m-26 0v25m0 22v25h26M1436 168h29v29m0 26v29h-29M102 902v25h25M1436 902h29v25"/><path class="cine-registration-accent" d="M1490 498h-11m-15 0h-11M1470 478v11m0 18v11"/>') +
    '<span class="cine-recorder">RECORDER<br>01</span><span class="cine-character-label">ORIGINAL<br>CHARACTER</span>' +
    svg('cine-lens-arc', '0 0 240 240', '<path d="M49 42a96 96 0 0 1 143 128M173 201a96 96 0 0 1-133-27"/><path class="cine-registration-accent" d="M53 52a87 87 0 0 1 56-20"/><path d="M120 18v8m94 94h8M120 214v8M18 120h8"/>'),
    document.querySelector('.hero-visual'));
  const world = document.querySelector('.world-visual');
  if (world) {
    const foreground = layer('cine-world-foreground', '<i></i><i></i>', world);
    const firstCopy = world.querySelector('.world-title');
    if (firstCopy) world.insertBefore(foreground, firstCopy);
    const optics = layer('cine-layer cine-world-optics',
      svg('cine-world-orbits', '0 0 1400 850', '<ellipse cx="790" cy="396" rx="718" ry="271" transform="rotate(-12 790 396)"/><ellipse class="cine-orbit-secondary" cx="750" cy="389" rx="689" ry="249" transform="rotate(15 750 389)"/><circle cx="315" cy="228" r="3" fill="currentColor" stroke="none"/><circle cx="1224" cy="476" r="3" fill="currentColor" stroke="none"/>') +
      svg('cine-world-registration', '0 0 340 320', '<path d="M2 29V2h27M311 2h27v27M338 291v27h-27M29 318H2v-27"/><path d="M40 74h22m-11-11v22" opacity=".65"/>') +
      '<span class="cine-world-label cine-world-label-first">HOMEWARD / 02</span><span class="cine-world-label">VISUAL WORLD</span>', world);
    if (firstCopy) world.insertBefore(optics, firstCopy);
  }
  const works = document.getElementById('works');
  layer('cine-chapter-mark cine-mark-works', '03', works, true);
  layer('cine-chapter-mark cine-mark-about', '04', document.getElementById('about'), true);
  const projectArt = works?.querySelector('.project-art');
  if (projectArt) {
    layer('cine-image-index', 'HOMEWARD / 01', projectArt);
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    border.classList.add('cine-image-frame');
    border.setAttribute('viewBox', '0 0 1000 500');
    border.setAttribute('preserveAspectRatio', 'none');
    border.setAttribute('aria-hidden', 'true');
    border.setAttribute('focusable', 'false');
    border.innerHTML = '<path d="M2 2H998V445L945 498H2Z"/><path d="M791 2h28m7 0h11m7 0h11" stroke-width="3"/><path d="M9 39V9h30M918 490h19l52-52v-18"/>';
    projectArt.append(border);
    decorations.push(border);
  }
  const aboutArt = document.querySelector('#about .about-art');
  if (aboutArt) {
    const mark = layer('cine-portrait-registration', svg('', '0 0 620 610', '<path d="M3 32V3h29M588 3h29v29M617 578v29h-29M32 607H3v-29"/><path d="M580 213v32m-16-16h32" opacity=".6"/>'), aboutArt);
    mark.style.position = 'absolute';
    layer('cine-portrait-label', 'ORIGINAL<br>CHARACTER', aboutArt);
  }
  const contact = document.getElementById('contact');
  layer('cine-contact-background', '<img src="assets/refinement-2026/port.webp" width="1536" height="1024" alt="" loading="lazy">' +
    svg('cine-contact-arcs', '0 0 1400 500', '<ellipse cx="720" cy="290" rx="670" ry="390"/><ellipse cx="729" cy="289" rx="525" ry="330" transform="rotate(-15 729 289)"/>'), contact, true);
  layer('cine-chapter-mark cine-mark-contact', '05', contact);

  const hasModal = () => Boolean(document.querySelector('dialog[open]'));
  const allowed = () => !destroyed && !motion.matches && !document.hidden && focused && !inspecting && !hasModal();
  const allowHover = () => allowed() && pointer.matches && desktop.matches;
  const inViewport = element => {
    const box = element.getBoundingClientRect();
    return box.height > 0 && box.width > 0 && box.bottom > 0 && box.top < innerHeight;
  };
  const visibleForHover = element => {
    if (!inViewport(element) || element.closest('[inert], [aria-hidden="true"]')) return false;
    for (let node = element; node instanceof HTMLElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) <= .01) return false;
    }
    return true;
  };
  const animate = (element, frames, options) => {
    if (!allowed() || !element?.animate) return;
    const animation = element.animate(frames, { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)', ...options });
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  };
  // Animate existing semantic headings as intact elements. Their spans and copy
  // remain untouched, and the app's data-reveal visibility state is preserved.
  const revealTargets = [document.getElementById('works-heading'), document.querySelector('#about .about-copy'), document.querySelector('#about .about-art'), document.querySelector('#contact .contact-main'), document.querySelector('#world-explorer .explorer-heading')].filter(Boolean);
  function reveal(element) {
    if (revealed.has(element) || !allowed() || !inViewport(element)) return;
    revealed.add(element);
    revealCount++;
    if (element.id === 'works-heading') {
      animate(element, [{ clipPath: 'inset(0 0 100% 0)', opacity: .55 }, { clipPath: 'inset(0)', opacity: 1 }], { duration: 720 });
    } else if (element.matches('.explorer-heading')) {
      animate(element, [{ clipPath: 'inset(0 0 100% 0)', opacity: .35, translate: '0 12px' }, { clipPath: 'inset(0)', opacity: 1, translate: '0 0' }], { duration: 560 });
    } else if (element.matches('.about-copy')) {
      const children = [element.querySelector('h2'), element.querySelector('.experience-list'), element.querySelector('.skills')].filter(Boolean);
      children.forEach((node, index) => animate(node, [{ clipPath: 'inset(0 0 100% 0)', opacity: .25, translate: '0 14px' }, { clipPath: 'inset(0)', opacity: 1, translate: '0 0' }], { duration: 660, delay: index * 85, fill: 'backwards' }));
    } else if (element.matches('.about-art')) {
      animate(element.querySelector('img'), [{ transform: 'scale(1.055)', opacity: .5 }, { transform: 'scale(1)', opacity: 1 }], { duration: 850 });
    } else {
      [...element.children].forEach((node, index) => animate(node, [{ opacity: .2, translate: '0 18px' }, { opacity: 1, translate: '0 0' }], { duration: 650, delay: index * 95, fill: 'backwards' }));
    }
  }
  const revealVisible = () => revealTargets.forEach(reveal);
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); }), { threshold: .08, rootMargin: '0px 0px -18px 0px' });
    revealTargets.forEach(element => observer.observe(element));
  }
  // Explorer is built by a later deferred script, after this interface and the
  // inert archive clone have initialized. Register its real heading once ready.
  const registerExplorerHeading = () => {
    const heading = document.querySelector('#world-explorer .explorer-heading');
    if (destroyed || !heading || revealTargets.includes(heading)) return;
    revealTargets.push(heading);
    observer?.observe(heading);
    reveal(heading);
  };
  document.addEventListener('DOMContentLoaded', registerExplorerHeading, { once: true });
  if (document.readyState === 'complete') registerExplorerHeading();
  const onExplorerFocus = event => {
    if (!(event.target instanceof Element) || !event.target.closest('#world-explorer')) return;
    const heading = document.querySelector('#world-explorer .explorer-heading');
    if (!heading) return;
    revealed.add(heading);
    for (const animation of animations) {
      if (animation.effect?.target === heading) {
        animation.cancel();
        animations.delete(animation);
      }
    }
  };
  document.addEventListener('focusin', onExplorerFocus);
  const imageTargets = [...document.querySelectorAll('#works .project-art, #works .project-portrait, #about .about-art, #top .story-art-small, #top .story-art-wide')];
  const magneticTargets = [...document.querySelectorAll('.hero-action, .story-copy .text-link, .world-copy .button, #works .project-side .text-link, #contact .button')];
  const cancelHoverFrame = () => {
    if (hoverFrame) cancelAnimationFrame(hoverFrame);
    hoverFrame = 0;
    hoverTimestamp = 0;
  };
  const removeHoverState = element => {
    hoverStates.delete(element);
    hovered.delete(element);
    if (!hoverStates.size) cancelHoverFrame();
  };
  const resetImage = element => {
    element.style.removeProperty('--cine-tilt-x');
    element.style.removeProperty('--cine-tilt-y');
    element.style.removeProperty('--cine-image-scale');
    removeHoverState(element);
  };
  const resetMagnetic = element => {
    element.style.removeProperty('--cine-magnet-x');
    element.style.removeProperty('--cine-magnet-y');
    removeHoverState(element);
  };
  const resetHover = () => {
    imageTargets.forEach(resetImage);
    magneticTargets.forEach(resetMagnetic);
    cancelHoverFrame();
  };
  const queueHover = () => {
    if (!hoverFrame && hoverStates.size && allowHover()) hoverFrame = requestAnimationFrame(updateHover);
  };
  function updateHover(timestamp) {
    hoverFrame = 0;
    if (!allowHover()) { resetHover(); return; }
    const elapsed = hoverTimestamp ? clamp(timestamp - hoverTimestamp, 0, 40) : 1000 / 60;
    hoverTimestamp = timestamp;
    hoverFrames++;
    const amount = 1 - Math.exp(-elapsed / 80);
    let moving = false;
    for (const [element, state] of hoverStates) {
      if (!visibleForHover(element)) {
        state.kind === 'image' ? resetImage(element) : resetMagnetic(element);
        continue;
      }
      if (state.pending) {
        const box = element.getBoundingClientRect();
        const { x: clientX, y: clientY } = state.pending;
        if (state.kind === 'image') {
          const x = clamp((clientX - box.left) / box.width - .5, -.5, .5);
          const y = clamp((clientY - box.top) / box.height - .5, -.5, .5);
          state.target = [-y * 2.6, x * 3.2, 1.025];
        } else {
          state.target = [clamp((clientX - box.left - box.width / 2) * .045, -5, 5), clamp((clientY - box.top - box.height / 2) * .1, -5, 5)];
        }
        state.pending = null;
      }
      state.properties.forEach((property, index) => {
        const difference = state.target[index] - state.current[index];
        state.current[index] = Math.abs(difference) <= state.thresholds[index]
          ? state.target[index] : state.current[index] + difference * amount;
        if (Math.abs(state.target[index] - state.current[index]) > state.thresholds[index]) moving = true;
        else state.current[index] = state.target[index];
        element.style.setProperty(property, state.current[index].toFixed(index === 2 ? 5 : 3) + state.units[index]);
      });
    }
    if (moving) queueHover();
    else hoverTimestamp = 0;
  }
  const followPointer = (element, kind, event) => {
    let state = hoverStates.get(element);
    if (!state) {
      state = kind === 'image'
        ? { kind, current: [0, 0, 1], target: [0, 0, 1], properties: ['--cine-tilt-x', '--cine-tilt-y', '--cine-image-scale'], thresholds: [.002, .002, .00005], units: ['deg', 'deg', ''] }
        : { kind, current: [0, 0], target: [0, 0], properties: ['--cine-magnet-x', '--cine-magnet-y'], thresholds: [.01, .01], units: ['px', 'px'] };
      hoverStates.set(element, state);
    }
    state.pending = { x: event.clientX, y: event.clientY };
    hovered.add(element);
    queueHover();
  };
  imageTargets.forEach(element => {
    element.classList.add('cine-image-hover', 'cine-damped-hover');
    element.addEventListener('pointermove', event => {
      if (!allowHover() || event.pointerType === 'touch' || event.buttons) return resetImage(element);
      followPointer(element, 'image', event);
    }, { passive: true });
    ['pointerleave', 'pointercancel', 'pointerdown'].forEach(type => element.addEventListener(type, () => resetImage(element), { passive: true }));
  });
  magneticTargets.forEach(element => {
    element.classList.add('cine-magnetic', 'cine-damped-hover');
    element.addEventListener('pointermove', event => {
      if (!allowHover() || event.pointerType === 'touch' || event.buttons) return resetMagnetic(element);
      followPointer(element, 'magnet', event);
    }, { passive: true });
    ['pointerleave', 'pointercancel', 'pointerdown', 'blur'].forEach(type => element.addEventListener(type, () => resetMagnetic(element), { passive: true }));
  });
  function stop() {
    animations.forEach(animation => animation.cancel());
    animations.clear();
    resetHover();
  }
  const sync = () => {
    if (!allowed()) stop();
    else {
      if (!allowHover()) {
        resetHover();
      }
      else {
        imageTargets.filter(element => hovered.has(element) && !visibleForHover(element)).forEach(resetImage);
        magneticTargets.filter(element => hovered.has(element) && !visibleForHover(element)).forEach(resetMagnetic);
      }
      revealVisible();
    }
  };
  const onBlur = () => { focused = false; stop(); };
  const onFocus = () => { focused = true; sync(); };
  const onInspect = event => { inspecting = Boolean(event.detail?.active); sync(); };
  const onScroll = () => { resetHover(); if (!observer) revealVisible(); };
  const onResize = () => { resetHover(); sync(); };
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('portfolio-inspect-mode', onInspect);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  pointer.addEventListener('change', sync);
  desktop.addEventListener('change', sync);
  const modalObserver = new MutationObserver(sync);
  document.querySelectorAll('dialog').forEach(dialog => modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  const onPageHide = event => { stop(); if (!event.persisted) { destroyed = true; observer?.disconnect(); modalObserver.disconnect(); document.removeEventListener('DOMContentLoaded', registerExplorerHeading); document.removeEventListener('focusin', onExplorerFocus); } };
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', sync);
  window.PortfolioCinematicInterface = {
    inspect: () => ({
      reducedMotion: motion.matches, pointerFine: pointer.matches, desktop: desktop.matches,
      activeAnimations: animations.size, hoverCount: hovered.size, layerCount: decorations.length,
      hoverRafQueued: Boolean(hoverFrame), hoverFrames, hoverTargets: hoverStates.size,
      revealCount, inspecting, modalOpen: hasModal(), focused, hidden: document.hidden,
      paused: !allowed(), destroyed, observedTargets: revealTargets.length,
      backgroundAsset: 'refinement-2026/port.webp', magneticLimit: 5,
      hover: [...hovered].map(element => ({ className: element.className,
        x: element.style.getPropertyValue('--cine-magnet-x'), y: element.style.getPropertyValue('--cine-magnet-y'),
        tiltX: element.style.getPropertyValue('--cine-tilt-x'), tiltY: element.style.getPropertyValue('--cine-tilt-y') }))
    })
  };
})();
