(() => {
  'use strict';
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerQuery = matchMedia('(hover: hover) and (pointer: fine)');
  const desktopQuery = matchMedia('(min-width: 821px)');
  const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
  const mix = (start, end, value) => start + (end - start) * value;
  const smoothstep = (start, end, value) => {
    const x = clamp((value - start) / (end - start));
    return x * x * (3 - 2 * x);
  };
  const html = document.documentElement;
  const body = document.body;
  const reveal = element => element?.classList.add('is-visible');
  const revealContaining = element => {
    for (let node = element; node instanceof HTMLElement; node = node.parentElement) {
      if (node.hasAttribute('data-reveal')) reveal(node);
    }
  };
  const sequenceElement = document.querySelector('[data-scroll-sequence]');
  const stage = document.querySelector('[data-sequence-stage]');
  const works = document.getElementById('works');
  const handoff = document.getElementById('archive-handoff');
  const archiveImage = works?.querySelector('.project-art img');
  const sequence = {
    enabled: false, top: 0, travel: 1, progress: 0, target: 0, width: innerWidth, height: innerHeight,
    destination: { x: 8, y: 32, width: 56, height: 46 }, clone: null, handed: false
  };
  const scenes = [...document.querySelectorAll('[data-sequence-panel]')].map(element => ({
    element, kind: element.dataset.sequencePanel, visual: element.querySelector('[data-scene]'),
    renderer: null, pointer: [0, 0], pointerTarget: [0, 0], fallback: null
  }));
  const copyGroups = {
    hero: document.querySelector('#top .hero-copy'),
    story: document.querySelector('#top .story-copy'),
    world: document.querySelector('#world .world-copy')
  };
  const chapters = [...document.querySelectorAll('[data-chapter-section]')].map(element => ({ element, top: 0 }));
  const navLinks = [...document.querySelectorAll('.site-header nav a, #site-menu a[href^="#"]')];
  const chapterCount = document.getElementById('chapter-count');
  const readingProgress = document.getElementById('reading-progress');
  const sceneToggle = document.getElementById('scene-toggle');
  const sceneModeLive = document.getElementById('scene-mode-live');
  const backgroundMenu = document.getElementById('site-menu');
  const writtenVariables = new Map();
  let signalTarget = 0, signalCurrent = 0, frame = 0, lastDraw = 0, lastUpdate = 0;
  let renderCount = 0, activeSceneKinds = [];
  let layoutDirty = true, scrollDirty = true, pageFocused = true, initialLayout = true, inspecting = false;
  let initialHashPending = Boolean(location.hash), lastReadingProgress = '', pendingFocus = null;
  let viewportHeight = innerHeight, maxScroll = 1;
  let publishedWorldActive = null, publishedSequenceEnabled = null;
  html.classList.add('motion-ready');

  function buildClone() {
    if (!works || !handoff || sequence.clone) return;
    const clone = works.cloneNode(true);
    clone.classList.add('archive-clone');
    clone.style.marginTop = '0px';
    clone.inert = true;
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('.case-content, [data-exploration]').forEach(element => element.remove());
    // The handoff is a still image of the archive, never a second media player.
    clone.querySelectorAll('video, audio').forEach(media => {
      if (media instanceof HTMLVideoElement && media.poster) {
        const poster = document.createElement('img');
        poster.src = media.poster;
        poster.width = media.width;
        poster.height = media.height;
        poster.className = media.className;
        poster.alt = '';
        media.replaceWith(poster);
      } else media.remove();
    });
    clone.querySelectorAll('#film-play, #film-reset, .film-status').forEach(element => element.remove());
    [clone, ...clone.querySelectorAll('*')].forEach(element => {
      ['id', 'name', 'data-chapter-section', 'data-theme', 'data-reveal', 'data-open-details',
        'aria-labelledby', 'aria-describedby', 'aria-controls'].forEach(attribute => element.removeAttribute(attribute));
      if (element.matches('a, button, summary, input, select, textarea, [tabindex]')) {
        element.removeAttribute('href');
        element.setAttribute('tabindex', '-1');
      }
      if (element instanceof HTMLImageElement) element.loading = 'eager';
    });
    handoff.replaceChildren(clone);
    sequence.clone = clone;
  }
  function configureSequence() {
    sequence.enabled = Boolean(sequenceElement && stage && !motionQuery.matches);
    html.classList.toggle('sequence-on', sequence.enabled);
    if (sequence.enabled) buildClone();
    else {
      handoff?.replaceChildren();
      sequence.clone = null;
      sequence.progress = sequence.target = 0;
      if (stage) {
        stage.style.opacity = '';
        stage.style.visibility = '';
        stage.style.pointerEvents = '';
        stage.removeAttribute('aria-hidden');
        stage.inert = false;
      }
      scenes.forEach(scene => {
        scene.element.inert = false;
        scene.element.removeAttribute('aria-hidden');
        if (scene.fallback) scene.fallback.style.display = 'none';
      });
      Object.values(copyGroups).forEach(element => setCopyInactive(element, false));
    }
    initialLayout = true;
    layoutDirty = scrollDirty = true;
  }
  const backgroundBlocked = () => document.hidden || !pageFocused || inspecting || Boolean(backgroundMenu?.open);
  const canAnimate = () => sequence.enabled && !motionQuery.matches && !backgroundBlocked();
  const queue = () => {
    if (!frame && !backgroundBlocked()) frame = requestAnimationFrame(update);
  };
  const dirtyLayout = () => { layoutDirty = scrollDirty = true; queue(); };
  const suspendBackground = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastUpdate = 0;
    activeSceneKinds = [];
  };
  window.addEventListener('portfolio-inspect-mode', event => {
    inspecting = Boolean(event.detail?.active);
    if (inspecting) suspendBackground();
    else { lastUpdate = 0; dirtyLayout(); }
  });
  if (backgroundMenu && 'MutationObserver' in window) {
    const menuObserver = new MutationObserver(() => {
      if (backgroundMenu.open) suspendBackground();
      else { lastUpdate = 0; dirtyLayout(); }
    });
    menuObserver.observe(backgroundMenu, { attributes: true, attributeFilter: ['open'] });
  }
  function measure() {
    const scroll = scrollY;
    viewportHeight = innerHeight;
    maxScroll = Math.max(1, html.scrollHeight - viewportHeight);
    if (sequenceElement && stage) {
      sequence.top = sequenceElement.getBoundingClientRect().top + scroll;
      sequence.travel = Math.max(1, sequenceElement.offsetHeight - viewportHeight);
      const stageBox = stage.getBoundingClientRect();
      sequence.width = stage.clientWidth || innerWidth;
      sequence.height = stage.clientHeight || viewportHeight;
      const destination = sequence.clone?.querySelector('.project-art')?.getBoundingClientRect();
      if (destination) sequence.destination = {
        x: (destination.left - stageBox.left) / sequence.width * 100,
        y: (destination.top - stageBox.top) / sequence.height * 100,
        width: destination.width / sequence.width * 100,
        height: destination.height / sequence.height * 100
      };
    }
    chapters.forEach(chapter => { chapter.top = chapter.element.getBoundingClientRect().top + scroll; });
    layoutDirty = false;
  }
  function scrollTarget(element) {
    if (sequence.enabled) {
      if (element.id === 'top') return sequence.top;
      if (element.id === 'works') return sequence.top + sequence.travel;
      const anchor = Number.parseFloat(element.dataset.sequenceAnchor);
      if (Number.isFinite(anchor)) return sequence.top + sequence.travel * clamp(anchor);
    }
    const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
    return element.getBoundingClientRect().top + scrollY - margin;
  }
  function openDetailsTarget(target) {
    if (!(target instanceof HTMLDetailsElement)) return;
    if (window.PortfolioMotionPolish) window.PortfolioMotionPolish.openDetails(target);
    else target.open = true;
  }
  function openHashTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    const target = document.getElementById(id);
    if (!target || target.closest('#archive-handoff')) return null;
    revealContaining(target);
    target.querySelectorAll('[data-reveal]').forEach(reveal);
    openDetailsTarget(target);
    return target;
  }
  function navigate(target, options = {}) {
    if (!target) return;
    if (layoutDirty) measure();
    revealContaining(target);
    target.querySelectorAll('[data-reveal]').forEach(reveal);
    openDetailsTarget(target);
    if (options.history) history.pushState(null, '', '#' + target.id);
    const top = clamp(scrollTarget(target), 0, maxScroll);
    if (options.snap) initialLayout = true;
    scrollTo({ top, behavior: options.behavior || (motionQuery.matches ? 'instant' : 'smooth') });
    if (options.focus) pendingFocus = { element: target, top };
    scrollDirty = true;
    queue();
  }
  function syncHash() {
    const target = openHashTarget();
    if (target) navigate(target, { behavior: 'instant', snap: true });
  }
  window.addEventListener('hashchange', syncHash);
  window.addEventListener('popstate', () => requestAnimationFrame(syncHash));
  document.querySelectorAll('[data-open-details]').forEach(link => {
    link.addEventListener('click', () => {
      const target = document.getElementById(link.dataset.openDetails);
      revealContaining(target);
      openDetailsTarget(target);
    });
  });

  const reveals = [...document.querySelectorAll('[data-reveal]')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -20px 0px' });
    reveals.forEach(element => observer.observe(element));
  } else reveals.forEach(reveal);
  if (motionQuery.matches) reveals.forEach(reveal);
  document.addEventListener('focusin', event => revealContaining(event.target));

  function writeVariable(name, value) {
    const text = value.toFixed(5);
    if (writtenVariables.get(name) === text || !stage) return;
    stage.style.setProperty(name, text);
    writtenVariables.set(name, text);
  }
  function setCopyInactive(element, inactive) {
    if (!element) return;
    if (element.inert !== inactive) element.inert = inactive;
    if (inactive) {
      if (element.getAttribute('aria-hidden') !== 'true') element.setAttribute('aria-hidden', 'true');
    } else if (element.hasAttribute('aria-hidden')) element.removeAttribute('aria-hidden');
  }
  function writeSequence(progress) {
    const entry = smoothstep(0.34, 0.47, progress);
    const fold = smoothstep(0.76, 0.88, progress);
    const dock = smoothstep(0.88, 0.97, progress);
    const destination = sequence.destination;
    const dolly = smoothstep(0.005, 0.34, progress);
    const worldDepth = smoothstep(0.47, 0.76, progress) * (1 - smoothstep(0.85, 0.97, progress));
    const edge = Math.max(4 * entry * (1 - entry), 4 * fold * (1 - fold)) * (1 - dock);
    const scanPhase = progress < 0.47 ? entry : fold;
    let box = { x: 53 * Math.pow(1 - entry, 1.4), y: 0, width: entry * 100, height: 100 };
    let cut = Math.min(150, sequence.width * entry * 0.18) * Math.sin(Math.PI * entry);
    let tilt = Math.sin(Math.PI * entry) * 3;
    if (progress >= 0.47) {
      box = { x: 26 * fold, y: 4 * fold, width: mix(100, 48, fold), height: mix(100, 92, fold) };
      cut = Math.min(150, sequence.width * 0.48 * 0.19) * fold;
      tilt = 3 * fold;
    }
    if (progress >= 0.88) {
      box = {
        x: mix(26, destination.x, dock), y: mix(4, destination.y, dock),
        width: mix(48, destination.width, dock), height: mix(92, destination.height, dock)
      };
      tilt = 3 * (1 - dock);
    }
    const values = {
      '--scene-progress': progress, '--reframe': smoothstep(0.02, 0.19, progress),
      '--cine-dolly': dolly, '--cine-world-depth': worldDepth, '--cine-edge': edge,
      '--cine-title-split': smoothstep(0.015, 0.12, progress),
      '--cine-title-a': smoothstep(0.015, 0.09, progress),
      '--cine-title-b': smoothstep(0.025, 0.11, progress),
      '--cine-title-c': smoothstep(0.04, 0.12, progress),
      '--collage': smoothstep(0.14, 0.30, progress), '--headline-out': smoothstep(0.015, 0.12, progress),
      '--hero-out': smoothstep(0.36, 0.49, progress), '--world-in': smoothstep(0.34, 0.355, progress),
      '--world-labels': smoothstep(0.42, 0.53, progress), '--world-exit': fold,
      '--archive-in': smoothstep(0.75, 0.84, progress),
      '--archive-progress': dock, '--archive-mix': smoothstep(0.85, 0.97, progress),
      '--world-x': box.x, '--world-y': box.y, '--world-width': box.width, '--world-height': box.height,
      '--world-cut': cut, '--world-tilt': tilt
    };
    Object.entries(values).forEach(([name, value]) => writeVariable(name, value));
    const handed = sequence.enabled && sequence.target >= 1;
    if (sequence.handed !== handed || initialLayout) {
      sequence.handed = handed;
      if (stage) {
        stage.style.opacity = handed ? '0' : '';
        stage.style.visibility = handed ? 'hidden' : '';
        stage.style.pointerEvents = handed ? 'none' : '';
        stage.inert = handed;
        if (handed) stage.setAttribute('aria-hidden', 'true');
        else stage.removeAttribute('aria-hidden');
      }
    }
    if (sequence.enabled) {
      scenes.forEach(scene => {
        const inactive = handed || (scene.kind === 'hero' ? progress >= 0.47 : progress < 0.42 || progress >= 0.97);
        if (scene.element.inert !== inactive) scene.element.inert = inactive;
        if (inactive) scene.element.setAttribute('aria-hidden', 'true');
        else scene.element.removeAttribute('aria-hidden');
      });
      setCopyInactive(copyGroups.hero, handed || values['--headline-out'] >= 0.999);
      setCopyInactive(copyGroups.story, handed || values['--reframe'] <= 0.001 || progress >= 0.47);
      setCopyInactive(copyGroups.world, handed || values['--world-labels'] <= 0.001 || fold >= 1 / 3);
    }
    const worldFlightOpacity = values['--world-labels'] * Math.max(0, 1 - fold * 3);
    const worldActive = !sequence.enabled || (!handed && worldFlightOpacity > .002);
    if (publishedWorldActive !== worldActive || publishedSequenceEnabled !== sequence.enabled) {
      publishedWorldActive = worldActive;
      publishedSequenceEnabled = sequence.enabled;
      window.dispatchEvent(new CustomEvent('portfolio-stage-state', { detail: {
        worldActive, progress, handed, enabled: sequence.enabled
      } }));
    }
    return { archiveMix: values['--archive-mix'], dolly, worldDepth, edge, scanPhase };
  }
  function updateNavigation(scroll) {
    const focus = scroll + Math.min(viewportHeight * 0.2, 160);
    let id = 'top';
    if (sequence.enabled) {
      if (sequence.progress >= 0.40) id = 'world';
      if (sequence.progress >= 0.80 || sequence.target >= 1) id = 'works';
      chapters.forEach(chapter => {
        if (['about', 'contact'].includes(chapter.element.id) && chapter.top <= focus) id = chapter.element.id;
      });
    } else chapters.forEach(chapter => { if (chapter.top <= focus) id = chapter.element.id; });
    if (maxScroll - scroll < 3 && chapters.length) id = chapters[chapters.length - 1].element.id;
    if (body.dataset.chapter !== id) body.dataset.chapter = id;
    const fullWorld = sequence.enabled && sequence.progress >= 0.465 && sequence.progress < 0.78 && sequence.target < 1;
    const theme = sequence.enabled && id === 'top'
      ? (sequence.progress > 0.12 ? 'light' : 'dark')
      : sequence.enabled && id === 'world' ? (fullWorld ? 'dark' : 'light')
      : chapters.find(chapter => chapter.element.id === id)?.element.dataset.theme || 'light';
    if (body.dataset.theme !== theme) body.dataset.theme = theme;
    const index = Math.max(0, chapters.findIndex(chapter => chapter.element.id === id));
    const count = String(index + 1).padStart(2, '0') + ' / ' + String(chapters.length).padStart(2, '0');
    if (chapterCount && chapterCount.textContent !== count) chapterCount.textContent = count;
    navLinks.forEach(link => {
      if (link.getAttribute('href') === '#' + id) {
        if (link.getAttribute('aria-current') !== 'location') link.setAttribute('aria-current', 'location');
      } else if (link.hasAttribute('aria-current')) link.removeAttribute('aria-current');
    });
    const reading = clamp(scroll / maxScroll).toFixed(4);
    if (reading !== lastReadingProgress) {
      readingProgress?.style.setProperty('--reading-progress', reading);
      lastReadingProgress = reading;
    }
  }
  function update(timestamp) {
    frame = 0;
    if (backgroundBlocked()) { activeSceneKinds = []; return; }
    const elapsed = lastUpdate ? clamp(timestamp - lastUpdate, 1, 120) : 16.67;
    lastUpdate = timestamp;
    if (layoutDirty) measure();
    if (initialHashPending) {
      initialHashPending = false;
      const target = openHashTarget();
      if (target) navigate(target, { behavior: 'instant', snap: true });
    }
    const scroll = scrollY;
    let moving = false;
    if (scrollDirty) {
      sequence.target = sequence.enabled ? clamp((scroll - sequence.top) / sequence.travel) : 0;
      if (initialLayout) sequence.progress = sequence.target;
      scrollDirty = false;
    }
    const difference = sequence.target - sequence.progress;
    if (Math.abs(difference) > 0.00015 && canAnimate()) {
      sequence.progress += difference * (1 - Math.exp(-elapsed / 90));
      moving = true;
    } else sequence.progress = sequence.target;
    const signalDifference = signalTarget - signalCurrent;
    if (Math.abs(signalDifference) > 0.001 && canAnimate()) {
      signalCurrent += signalDifference * (1 - Math.exp(-elapsed / 150));
      moving = true;
    } else signalCurrent = signalTarget;
    const cinema = writeSequence(sequence.progress);
    const archiveMix = cinema.archiveMix;
    initialLayout = false;
    scenes.forEach(scene => {
      scene.pointer = scene.pointer.map((value, index) => {
        const delta = scene.pointerTarget[index] - value;
        if (Math.abs(delta) > 0.0005 && canAnimate()) {
          moving = true;
          return value + delta * (1 - Math.exp(-elapsed / 130));
        }
        return scene.pointerTarget[index];
      });
      scene.renderer?.set({
        progress: scene.kind === 'hero' ? clamp(sequence.progress / 0.34) : smoothstep(0.47, 0.76, sequence.progress),
        pointer: scene.pointer, signal: signalCurrent,
        dolly: scene.kind === 'hero' ? cinema.dolly : 0,
        worldDepth: scene.kind === 'world' ? cinema.worldDepth : 0, edge: cinema.edge,
        scanPhase: cinema.scanPhase,
        archiveMix: scene.kind === 'world' ? archiveMix : 0, reducedMotion: !sequence.enabled
      });
    });
    updateNavigation(scroll);
    const visible = !sequence.handed && scroll + viewportHeight > sequence.top && scroll < sequence.top + sequence.travel + viewportHeight;
    const activeScenes = canAnimate() && visible ? scenes.filter(scene => scene.kind === 'hero'
      ? sequence.progress < 0.49 : sequence.progress > 0.34) : [];
    activeSceneKinds = activeScenes.filter(scene => scene.renderer?.ready).map(scene => scene.kind);
    const interval = desktopQuery.matches ? 1000 / 48 : 1000 / 30;
    if (timestamp - lastDraw >= interval) {
      activeScenes.forEach(scene => {
        if (scene.renderer?.ready && scene.renderer.draw(timestamp / 1000)) {
          renderCount++;
          if (scene.kind === 'world') {
            // Reuse this render clock for the DOM flight plane's common optical camera.
            // Local shader refraction remains a photographic effect, not mesh geometry.
            const worldProgress = smoothstep(0.47, 0.76, sequence.progress);
            const zoom = 1.028 + worldProgress * .075 + Math.sin(timestamp / 1000 * .35) * .0014
              + (1 - archiveMix) * cinema.worldDepth * .038;
            writeVariable('--world-camera-zoom', zoom);
            writeVariable('--world-camera-x', -scene.pointer[0] * .010 * zoom * 100);
            writeVariable('--world-camera-y', (scene.pointer[1] * .007 + worldProgress * .012) * zoom * 100);
          }
        }
      });
      lastDraw = timestamp;
    }
    scenes.forEach(scene => {
      if (!scene.fallback) return;
      const show = sequence.enabled && archiveMix > 0 && !scene.visual.classList.contains('is-webgl-ready');
      scene.fallback.style.display = show ? 'block' : 'none';
      if (show) scene.fallback.style.opacity = archiveMix;
    });
    if (pendingFocus && Math.abs(scroll - pendingFocus.top) < 4 && !pendingFocus.element.inert) {
      const target = pendingFocus.element;
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      target.focus({ preventScroll: true });
      pendingFocus = null;
    }
    if (moving || activeScenes.some(scene => scene.renderer?.ready) || pendingFocus) queue();
  }

  configureSequence();
  if (archiveImage) archiveImage.loading = 'eager';
  scenes.forEach(scene => {
    const canvas = scene.visual?.querySelector('[data-scene-canvas]');
    const image = scene.visual?.querySelector('img');
    if (scene.kind === 'world' && scene.visual && archiveImage) {
      const fallback = archiveImage.cloneNode(false);
      fallback.removeAttribute('id');
      fallback.removeAttribute('data-reveal');
      fallback.className = 'archive-fallback';
      fallback.alt = '';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.style.cssText = 'display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:none;pointer-events:none;opacity:0;';
      scene.visual.insertBefore(fallback, canvas);
      scene.fallback = fallback;
    }
    scene.renderer = window.PortfolioSceneRenderer?.create(canvas, image, {
      kind: scene.kind, fixedResolution: scene.kind === 'world',
      archiveImage: scene.kind === 'world' ? archiveImage : null, archiveFallback: scene.fallback
    }) || null;
    scene.renderer?.set({ reducedMotion: !sequence.enabled });
    canvas?.addEventListener('scene-ready', queue);
    image?.addEventListener('load', dirtyLayout);
  });
  archiveImage?.addEventListener('load', dirtyLayout);
  stage?.addEventListener('pointermove', event => {
    if (!canAnimate() || !pointerQuery.matches || event.pointerType !== 'mouse') return;
    scenes.forEach(scene => {
      const box = scene.visual?.getBoundingClientRect();
      if (!box || box.width < 1) return;
      scene.pointerTarget = [
        clamp((event.clientX - box.left) / box.width * 2 - 1, -1, 1),
        -clamp((event.clientY - box.top) / box.height * 2 - 1, -1, 1)
      ];
    });
    queue();
  });
  const resetPointers = () => scenes.forEach(scene => { scene.pointer = scene.pointerTarget = [0, 0]; });
  stage?.addEventListener('pointerleave', () => {
    scenes.forEach(scene => { scene.pointerTarget = [0, 0]; });
    queue();
  });
  sceneToggle?.addEventListener('click', () => {
    const enabled = sceneToggle.getAttribute('aria-pressed') !== 'true';
    sceneToggle.setAttribute('aria-pressed', String(enabled));
    body.classList.toggle('signal-on', enabled);
    signalTarget = enabled ? 1 : 0;
    if (sceneModeLive) sceneModeLive.textContent = enabled ? '信号视图已开启：画面切换为光学显影效果。' : '信号视图已关闭：恢复原始画面。';
    queue();
  });

  const menuToggle = document.getElementById('menu-toggle');
  const menuClose = document.getElementById('menu-close');
  const menu = document.getElementById('site-menu');
  let restoreMenuFocus = true, previousOverflow = '';
  const closeMenu = (restore = true) => {
    if (!menu?.open) return;
    restoreMenuFocus = restore;
    menu.close();
  };
  menuToggle?.addEventListener('click', () => {
    if (!(menu instanceof HTMLDialogElement)) return;
    if (menu.open) { closeMenu(); return; }
    restoreMenuFocus = true;
    previousOverflow = body.style.overflow;
    menu.showModal();
    body.style.overflow = 'hidden';
    menuToggle.setAttribute('aria-expanded', 'true');
  });
  menuClose?.addEventListener('click', () => closeMenu());
  menu?.addEventListener('cancel', () => { restoreMenuFocus = true; });
  menu?.addEventListener('close', () => {
    body.style.overflow = previousOverflow;
    menuToggle?.setAttribute('aria-expanded', 'false');
    if (restoreMenuFocus) menuToggle?.focus({ preventScroll: true });
    dirtyLayout();
  });
  menu?.addEventListener('click', event => {
    if (event.target !== menu) return;
    const box = menu.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeMenu();
  });
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    if (link.closest('#archive-handoff')) return;
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      let id;
      try { id = decodeURIComponent(link.getAttribute('href').slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      if (link.closest('#site-menu')) closeMenu(false);
      navigate(target, { history: true, focus: true });
    });
  });
  document.querySelectorAll('details').forEach(details => {
    if (details.closest('#archive-handoff')) return;
    details.addEventListener('toggle', () => {
      dirtyLayout();
      if (details.open) revealContaining(details);
    });
  });
  window.addEventListener('scroll', () => { scrollDirty = true; queue(); }, { passive: true });
  window.addEventListener('wheel', () => { pendingFocus = null; }, { passive: true });
  window.addEventListener('resize', dirtyLayout, { passive: true });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(dirtyLayout);
    observer.observe(body);
    if (stage) observer.observe(stage);
    if (works) observer.observe(works);
  }
  document.fonts?.ready.then(dirtyLayout);
  const onPreferenceChange = () => {
    resetPointers();
    configureSequence();
    scenes.forEach(scene => scene.renderer?.set({ reducedMotion: !sequence.enabled, archiveMix: 0 }));
    if (motionQuery.matches) reveals.forEach(reveal);
    queue();
  };
  [motionQuery, pointerQuery, desktopQuery].forEach(query => {
    if (query.addEventListener) query.addEventListener('change', onPreferenceChange);
    else query.addListener(onPreferenceChange);
  });
  window.addEventListener('blur', () => {
    pageFocused = false; lastUpdate = 0;
    resetPointers();
    suspendBackground();
  });
  window.addEventListener('focus', () => { pageFocused = true; dirtyLayout(); });
  document.addEventListener('visibilitychange', () => {
    lastUpdate = 0; resetPointers();
    suspendBackground();
    if (!document.hidden) dirtyLayout();
  });
  window.PortfolioCinematicStage = Object.freeze({
    inspect() {
      return {
        enabled: sequence.enabled, progress: sequence.progress, target: sequence.target,
        handed: sequence.handed, renderCount, active: canAnimate() && activeSceneKinds.length > 0,
        activeSceneKinds: [...activeSceneKinds], rafQueued: Boolean(frame),
        reducedMotion: motionQuery.matches, inspecting, menuOpen: Boolean(backgroundMenu?.open),
        pageFocused, hidden: document.hidden,
        variables: Object.fromEntries([...writtenVariables].map(([name, value]) => [name, Number(value)]))
      };
    }
  });
  queue();
})();

