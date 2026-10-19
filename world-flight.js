(() => {
  'use strict';
  if (window.PortfolioWorldFlight) return;

  const assets = {
    cargo: 'assets/exploration/cargo.webp',
    scout: 'assets/exploration/scout.webp'
  };
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const ease = value => value * value * (3 - 2 * value);
  const motionSpec = Object.freeze({ engine: 'waapi-arc-length', samples: 97, loop: 'offscreen', speedTransitionMs: 180, permanentRAF: false, phasePreservedOnResize: true });
  const profiles = {
    port: [
      { id: 'cargo', name: '远航运输艇', description: '往返晨潮港口的运输艇，载着旅人的行李，也保存着等待归档的影像。', asset: 'cargo', width: 190, duration: 60000, phase: .58, points: [[-.18, .43], [.24, .34], [.75, .34], [1.18, .43]], scale: [.86, 1.04], atmosphere: .98 },
      { id: 'scout', name: '航道巡游艇', description: '巡游艇沿环桥检查通行信号，为即将出发的航船点亮下一段航道。', asset: 'scout', width: 120, duration: 51000, phase: .29, points: [[1.18, .55], [.77, .52], [.3, .49], [-.18, .54]], scale: [1, .83], atmosphere: .9, reverse: true },
      { id: 'distant', name: '远空记录艇', description: '远空记录艇把沿途的光、云和声音带回港口，留下遥远世界的坐标。', asset: 'scout', width: 64, duration: 65000, phase: .67, points: [[-.18, .16], [.24, .12], [.78, .12], [1.18, .18]], scale: [.76, .9], atmosphere: .66 }
    ],
    relay: [
      { id: 'cargo', name: '中继补给艇', description: '补给艇在云海与轨道之间交接能源，继续驶向记录者尚未抵达的地方。', asset: 'cargo', width: 190, duration: 62000, phase: .58, points: [[-.18, .44], [.25, .36], [.77, .36], [1.18, .44]], scale: [.84, 1.04], atmosphere: .94 },
      { id: 'scout', name: '轨道引导艇', description: '它跟随中继站的光学信标，让离开云层的航船重新辨认星海的方向。', asset: 'scout', width: 120, duration: 54000, phase: .29, points: [[1.18, .19], [.77, .14], [.28, .15], [-.18, .23]], scale: [.9, 1], atmosphere: .88, reverse: true },
      { id: 'distant', name: '云海观测艇', description: '从高处观察云层变化的小型艇，记录一条暂时安静的航路。', asset: 'scout', width: 64, duration: 68000, phase: .65, points: [[-.18, .47], [.25, .42], [.78, .42], [1.18, .47]], scale: [.7, .85], atmosphere: .62 }
    ],
    archive: [],
    night: [
      { id: 'cargo', name: '归途夜航艇', description: '最后一班夜航承载已经拼合的记忆。记录者顺着灯光，驶向故事开始的地方。', asset: 'cargo', width: 190, duration: 62000, phase: .58, points: [[-.18, .47], [.25, .43], [.77, .43], [1.18, .49]], scale: [.9, 1.04], atmosphere: .91 },
      { id: 'scout', name: '夜间护航艇', description: '护航艇守住港口最后的信号，等待远方的旅人靠岸。', asset: 'scout', width: 120, duration: 55000, phase: .28, points: [[1.18, .19], [.77, .14], [.29, .15], [-.18, .23]], scale: [1, .8], atmosphere: .85, reverse: true },
      { id: 'distant', name: '星光传讯艇', description: '细小的航行灯划过夜空，将一句抵达的消息送向远处的家。', asset: 'scout', width: 64, duration: 68000, phase: .65, points: [[-.18, .13], [.25, .08], [.78, .08], [1.18, .15]], scale: [.73, .88], atmosphere: .59 }
    ]
  };
  const bezier = (points, t) => {
    const q = 1 - t;
    return [0, 1].map(axis => q * q * q * points[0][axis] + 3 * q * q * t * points[1][axis] + 3 * q * t * t * points[2][axis] + t * t * t * points[3][axis]);
  };
  const heading = (points, t, reverse, width, height, limit) => {
    const q = 1 - t;
    const tangent = [0, 1].map(axis => 3 * q * q * (points[1][axis] - points[0][axis]) + 6 * q * t * (points[2][axis] - points[1][axis]) + 3 * t * t * (points[3][axis] - points[2][axis]));
    const raw = Math.atan2(tangent[1] * height, tangent[0] * width) * 180 / Math.PI;
    return clamp(reverse ? raw - (raw < 0 ? -180 : 180) : raw, -limit, limit);
  };
  function arcTable(points, width, height) {
    const table = [{ t: 0, distance: 0 }];
    let previous = bezier(points, 0), distance = 0;
    for (let index = 1; index <= 192; index++) {
      const t = index / 192, point = bezier(points, t);
      distance += Math.hypot((point[0] - previous[0]) * width, (point[1] - previous[1]) * height);
      table.push({ t, distance }); previous = point;
    }
    return {
      distance,
      at(progress) {
        const desired = progress * distance;
        let low = 0, high = table.length - 1;
        while (high - low > 1) { const middle = (low + high) >> 1; if (table[middle].distance < desired) low = middle; else high = middle; }
        const a = table[low], b = table[high];
        return a.t + (b.t - a.t) * clamp((desired - a.distance) / (b.distance - a.distance || 1));
      }
    };
  }

  function create(host, options = {}) {
    if (!(host instanceof HTMLElement)) return null;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let scene = profiles[options.scene] ? options.scene : 'port';
    let active = false, userPaused = false, routesVisible = false, selected = null;
    let focused = true, inspecting = Boolean(window.PortfolioInteraction?.getState?.().inspecting);
    let destroyed = false, ships = [], rateFrame = 0, rateTimer = 0;
    const layer = document.createElement('div');
    layer.className = 'world-flight-layer';
    layer.setAttribute('role', 'group');
    layer.setAttribute('aria-label', '场景航行器');
    layer.dataset.flightScene = scene;
    host.append(layer);

    const modalOpen = () => Boolean(document.querySelector('dialog[open]'));
    const allowed = () => active && !motion.matches && !document.hidden && focused && !inspecting && !modalOpen() && !destroyed;
    function applyRate(ship, value) {
      ship.rate = value;
      for (const animation of ship.animations) {
        if (value === 0) {
          const holdTime = animation.currentTime;
          if (animation.playState !== 'paused') animation.pause();
          if (holdTime != null) animation.currentTime = holdTime;
          animation.playbackRate = 0;
        } else {
          animation.playbackRate = value;
          if (animation.playState !== 'running') animation.play();
        }
      }
    }
    function clearRateClock() {
      cancelAnimationFrame(rateFrame); clearTimeout(rateTimer);
      rateFrame = 0; rateTimer = 0;
    }
    function rateStep(now) {
      rateFrame = 0;
      for (const ship of ships) {
        if (!ship.rateTween) continue;
        const { from, to, start } = ship.rateTween;
        const progress = clamp((now - start) / motionSpec.speedTransitionMs);
        applyRate(ship, progress >= 1 ? to : from + (to - from) * ease(progress));
        if (progress >= 1) ship.rateTween = null;
      }
      layer.dataset.flightRunning = String(ships.some(ship => ship.rate > 0));
      if (ships.some(ship => ship.rateTween)) queueRates();
      else clearRateClock();
    }
    function queueRates() {
      if (destroyed || !ships.some(ship => ship.rateTween)) return;
      if (!rateFrame) rateFrame = requestAnimationFrame(rateStep);
      // A finite deadline also completes the stop when the browser delivers
      // very few frames. There is no JavaScript animation loop during cruise.
      if (!rateTimer) {
        const deadline = Math.max(...ships.filter(ship => ship.rateTween).map(ship => ship.rateTween.start + motionSpec.speedTransitionMs));
        rateTimer = setTimeout(() => { rateTimer = 0; cancelAnimationFrame(rateFrame); rateStep(performance.now()); }, Math.max(1, deadline - performance.now() + 2));
      }
    }
    function syncShip(ship) {
      const hardStop = !allowed() || !ship.animation || !ship.loaded || ship.focused || ship.pressed || selected === ship.config.id;
      const desired = hardStop || userPaused || ship.hovered ? 0 : 1;
      if (hardStop) {
        ship.targetRate = 0; ship.rateTween = null; applyRate(ship, 0);
      } else if (ship.targetRate !== desired || (!ship.rateTween && ship.rate !== desired)) {
        ship.targetRate = desired;
        ship.rateTween = { from: ship.rate, to: desired, start: performance.now() };
      }
    }
    function sync() {
      if (destroyed) return;
      ships.forEach(syncShip);
      if (ships.some(ship => ship.rateTween)) queueRates();
      else clearRateClock();
      layer.dataset.flightActive = String(active);
      layer.dataset.flightPaused = String(userPaused);
      layer.dataset.flightRunning = String(ships.some(ship => ship.rate > 0));
      layer.dataset.flightReduced = String(motion.matches);
    }
    function position(ship) {
      const parent = host.getBoundingClientRect();
      const box = ship.button.getBoundingClientRect();
      return {
        x: parent.width > 0 ? Number(((box.left + box.width / 2 - parent.left) / parent.width).toFixed(5)) : .5,
        y: parent.height > 0 ? Number(((box.top + box.height / 2 - parent.top) / parent.height).toFixed(5)) : .3
      };
    }
    function target(ship) {
      return { id: ship.config.id, name: ship.config.name, description: ship.config.description, asset: assets[ship.config.asset], scene, position: position(ship) };
    }
    function select(id) {
      selected = ships.some(ship => ship.config.id === id) ? id : null;
      ships.forEach(ship => {
        const isSelected = selected === ship.config.id;
        ship.button.classList.toggle('is-selected', isSelected);
        ship.button.setAttribute('aria-pressed', String(isSelected));
      });
      sync();
    }
    function animateShip(ship, phase = ship.config.phase) {
      const width = host.clientWidth || 1536, height = host.clientHeight || 1024;
      const { points, scale, reverse, duration, atmosphere } = ship.config;
      const route = arcTable(points, width, height);
      const spriteWidth = width * ship.config.width / 1536, spriteHeight = spriteWidth * 267 / 800;
      const maxScale = Math.max(...scale), hitWidth = Math.max(44, spriteWidth * maxScale + 8), hitHeight = Math.max(44, spriteHeight * maxScale + 8);
      ship.visualSize = { width: Number(spriteWidth.toFixed(2)), height: Number(spriteHeight.toFixed(2)) };
      ship.hitSize = { width: Number(hitWidth.toFixed(2)), height: Number(hitHeight.toFixed(2)) };
      ship.arcLengthPx = Number(route.distance.toFixed(2));
      ship.mover.style.width = hitWidth + 'px'; ship.mover.style.height = hitHeight + 'px';
      ship.sprite.style.width = spriteWidth + 'px'; ship.sprite.style.height = spriteHeight + 'px';
      const poseFrames = [];
      const frames = Array.from({ length: motionSpec.samples }, (_, index) => {
        const progress = index / (motionSpec.samples - 1), t = route.at(progress);
        const [x, y] = bezier(points, t);
        const size = scale[0] + (scale[1] - scale[0]) * ease(progress);
        // The seam lies beyond both edges. Fading is restricted to this
        // already invisible part of the route, never an in-picture dissolve.
        const opacity = atmosphere * (progress < .025 ? ease(progress / .025) : progress > .975 ? ease((1 - progress) / .025) : 1);
        const outside = x * width + hitWidth / 2 < 0 || x * width - hitWidth / 2 > width || y * height + hitHeight / 2 < 0 || y * height - hitHeight / 2 > height;
        poseFrames.push({ offset: progress, transform: `translate(-50%,-50%) rotate(${heading(points, t, reverse, width, height, ship.config.id === 'distant' ? 4 : 7).toFixed(3)}deg) scale(${size.toFixed(5)})` });
        return { offset: progress, opacity: clamp(opacity), visibility: outside ? 'hidden' : 'visible', transform: `translate3d(${(x * width).toFixed(3)}px,${(y * height).toFixed(3)}px,0) translate(-50%,-50%)` };
      });
      ship.animations.forEach(animation => animation.cancel());
      ship.animations = [];
      if (ship.mover.animate) {
        const timing = { duration, iterations: Infinity, easing: 'linear', fill: 'both' };
        ship.animation = ship.mover.animate(frames, timing);
        ship.poseAnimation = ship.sprite.animate(poseFrames, timing);
        ship.animations = [ship.animation, ship.poseAnimation];
        for (const animation of ship.animations) { animation.pause(); animation.currentTime = duration * phase; }
        applyRate(ship, ship.rate);
      } else {
        const [x, y] = bezier(points, route.at(phase));
        ship.mover.style.transform = `translate3d(${x * width}px,${y * height}px,0) translate(-50%,-50%)`;
      }
    }
    function build() {
      clearRateClock();
      ships.forEach(ship => ship.animations.forEach(animation => animation.cancel()));
      ships = [];
      layer.replaceChildren();
      layer.dataset.flightScene = scene;
      const routes = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      routes.classList.add('world-flight-routes');
      routes.setAttribute('viewBox', '0 0 1000 600');
      routes.setAttribute('preserveAspectRatio', 'none');
      routes.setAttribute('aria-hidden', 'true');
      routes.setAttribute('focusable', 'false');
      routes.hidden = !routesVisible;
      routes.style.display = routesVisible ? '' : 'none';
      layer.append(routes);
      profiles[scene].forEach(profile => {
        // Explorer images occupy a full source-image plane that is cropped to
        // a wide viewport. Keep flight lanes inside that visible upper band.
        const config = options.presentation === 'world' ? profile : {
          ...profile, points: profile.points.map(([x, y]) => [x, .25 + y * .5])
        };
        const points = config.points;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${points[0][0] * 1000} ${points[0][1] * 600}C${points[1][0] * 1000} ${points[1][1] * 600},${points[2][0] * 1000} ${points[2][1] * 600},${points[3][0] * 1000} ${points[3][1] * 600}`);
        path.dataset.flightRoute = config.id;
        routes.append(path);
        const mover = document.createElement('div');
        mover.className = `world-flight-mover world-flight-${config.id}`;
        mover.dataset.flightId = config.id;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'world-flight-target';
        button.dataset.flightId = config.id;
        button.dataset.noHold = '';
        button.setAttribute('aria-label', `查看${config.name}的航行记录`);
        button.setAttribute('aria-pressed', 'false');
        const sprite = document.createElement('span');
        sprite.className = 'world-flight-sprite';
        sprite.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.src = assets[config.asset];
        image.alt = '';
        image.width = 800;
        image.height = 267;
        image.draggable = false;
        image.decoding = 'async';
        // Both supplied sprites face left; rightward paths flip only the artwork.
        if (!config.reverse) image.style.transform = 'scaleX(-1)';
        sprite.append(image); button.append(sprite); mover.append(button); layer.append(mover);
        const ship = { config, mover, button, sprite, image, animation: null, poseAnimation: null, animations: [], loaded: false, hovered: false, focused: false, pressed: false, rate: 0, targetRate: 0, rateTween: null };
        ships.push(ship);
        const onLoad = () => { ship.loaded = image.naturalWidth > 0; button.dataset.flightLoaded = String(ship.loaded); sync(); };
        image.addEventListener('load', onLoad);
        image.addEventListener('error', () => { ship.loaded = false; button.hidden = true; sync(); });
        if (image.complete) onLoad();
        button.addEventListener('pointerenter', event => {
          if (event.pointerType !== 'mouse') return;
          ship.hovered = true;
          sync();
        }, { passive: true });
        button.addEventListener('pointerleave', () => { ship.hovered = false; sync(); }, { passive: true });
        button.addEventListener('focus', () => { ship.focused = true; sync(); });
        button.addEventListener('blur', () => { ship.focused = false; sync(); });
        button.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          ship.pressed = true; sync();
          try { button.setPointerCapture(event.pointerId); } catch (_) { /* Detached pointer, keep the same stationary target. */ }
        });
        const release = () => { ship.pressed = false; sync(); };
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
        button.addEventListener('click', () => {
          select(config.id);
          if (typeof options.onSelect === 'function') options.onSelect(target(ship));
        });
        animateShip(ship);
      });
      sync();
    }
    function resize() {
      if (destroyed) return;
      ships.forEach(ship => {
        const phase = ship.animation?.currentTime == null ? ship.config.phase : (Number(ship.animation.currentTime) % ship.config.duration) / ship.config.duration;
        animateShip(ship, phase);
      });
      sync();
    }
    const onBlur = () => { focused = false; ships.forEach(ship => { ship.hovered = false; ship.pressed = false; }); sync(); };
    const onFocus = () => { focused = true; sync(); };
    const onInspection = event => { inspecting = Boolean(event.detail?.active); sync(); };
    const onPreference = () => sync();
    const onPageHide = () => { focused = false; sync(); };
    const onPageShow = () => { focused = true; sync(); };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('portfolio-inspect-mode', onInspection);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', sync);
    if (motion.addEventListener) motion.addEventListener('change', onPreference);
    else motion.addListener(onPreference);
    const dialogs = new MutationObserver(sync);
    document.querySelectorAll('dialog').forEach(dialog => dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
    const dimensions = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    dimensions?.observe(host);
    build();

    return Object.freeze({
      setScene(next) {
        if (destroyed || !profiles[next] || next === scene) return;
        scene = next;
        selected = null;
        build();
      },
      setPaused(paused) { userPaused = Boolean(paused); sync(); },
      setActive(next) { active = Boolean(next); sync(); },
      setRoutes(next) {
        routesVisible = Boolean(next);
        const routes = layer.querySelector('.world-flight-routes');
        if (routes) { routes.hidden = !routesVisible; routes.style.display = routesVisible ? '' : 'none'; }
      },
      select,
      getTargets() { return destroyed ? [] : ships.map(target); },
      inspect() {
        return {
          scene, active, paused: userPaused, running: ships.some(ship => ship.animation?.playState === 'running'),
          reducedMotion: motion.matches, routes: routesVisible, selected, destroyed,
          motion: { ...motionSpec, rateFrameQueued: Boolean(rateFrame), rateTimerQueued: Boolean(rateTimer) },
          blocked: { hidden: document.hidden, focused, inspecting, modal: modalOpen() },
          ships: ships.map(ship => ({
            id: ship.config.id, name: ship.config.name, loaded: ship.loaded, hovered: ship.hovered, focused: ship.focused,
            selected: selected === ship.config.id, pressed: ship.pressed, playState: ship.animation?.playState || 'static',
            duration: ship.config.duration, phase: ship.animation?.currentTime == null ? ship.config.phase : (Number(ship.animation.currentTime) % ship.config.duration) / ship.config.duration,
            playbackRate: ship.rate, targetRate: ship.targetRate, settling: Boolean(ship.rateTween),
            arcLengthPx: ship.arcLengthPx, visualSize: ship.visualSize, hitSize: ship.hitSize,
            loop: { start: ship.config.points[0], end: ship.config.points[3], opacity: ship.config.atmosphere },
            currentTime: ship.animation?.currentTime == null ? null : Number(ship.animation.currentTime), position: position(ship)
          }))
        };
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        clearRateClock();
        ships.forEach(ship => ship.animations.forEach(animation => animation.cancel()));
        ships = [];
        dimensions?.disconnect();
        dialogs.disconnect();
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('portfolio-inspect-mode', onInspection);
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('pageshow', onPageShow);
        document.removeEventListener('visibilitychange', sync);
        if (motion.removeEventListener) motion.removeEventListener('change', onPreference);
        else motion.removeListener(onPreference);
        layer.remove();
      }
    });
  }

  let world = null;
  function bootWorld() {
    const host = document.querySelector('#world .world-visual');
    if (!host) return;
    const note = document.createElement('div');
    note.className = 'world-flight-note';
    note.dataset.noHold = '';
    note.hidden = true;
    note.innerHTML = '<div class="world-flight-note-heading"><h3></h3><button type="button" class="world-flight-note-close" aria-label="关闭航行记录"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 4 12 12M16 4 4 16"/></svg></button></div><p></p><a class="world-flight-explore" href="#world-explorer">继续探索<svg viewBox="0 0 24 18" aria-hidden="true"><path d="M1 9h20M13 1l8 8-8 8"/></svg></a>';
    const hint = document.createElement('p');
    hint.className = 'world-flight-hint';
    hint.textContent = '点击飞船，查看航行记录';
    let worldPhase = false, syncFrame = 0;
    const closeNote = () => { note.hidden = true; world?.select(null); };
    world = create(host, {
      scene: 'port',
      presentation: 'world',
      onSelect(item) {
        note.querySelector('h3').textContent = item.name;
        note.querySelector('p').textContent = item.description;
        note.hidden = false;
      }
    });
    host.append(hint, note);
    note.querySelector('.world-flight-note-close').addEventListener('click', () => {
      const id = world.inspect().selected;
      closeNote();
      const button = host.querySelector(`.world-flight-target[data-flight-id="${id}"]`);
      button?.focus({ preventScroll: true });
    });
    note.querySelector('.world-flight-explore').addEventListener('click', closeNote);
    host.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || note.hidden) return;
      event.preventDefault();
      const id = world.inspect().selected;
      closeNote();
      host.querySelector(`.world-flight-target[data-flight-id="${id}"]`)?.focus({ preventScroll: true });
    });
    const syncWorld = () => {
      syncFrame = 0;
      const state = window.PortfolioCinematicStage?.inspect?.();
      const labels = state?.variables?.['--world-labels'] ?? 1;
      const fold = state?.variables?.['--world-exit'] ?? 0;
      const opacity = labels * Math.max(0, 1 - fold * 3);
      // The photograph continues folding beyond .79. Keep its craft alive
      // until the same CSS fade reaches zero rather than cutting them in half.
      worldPhase = state ? !state.enabled || (!state.handed && state.progress >= .42 && opacity > .002) : true;
      const box = host.getBoundingClientRect();
      // The portal starts at zero width. Its intersection ratio can stay at 1
      // while it grows, so derive visibility again when the stage changes.
      const visible = box.width > 1 && box.height > 1 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
      const active = worldPhase && visible;
      world.setActive(active);
      host.classList.toggle('world-flight-active', active);
      if (!active && !note.hidden) closeNote();
      // Follow only a finite scroll-settling transition; cruise itself uses
      // compositor animations and never maintains an idle JavaScript RAF.
      const settling = state?.enabled && Math.abs(state.progress - state.target) > .00015;
      if (settling && !document.hidden && state.pageFocused && !state.inspecting && !state.menuOpen && state.progress > .39 && state.progress < .85) queueSync();
    };
    const queueSync = () => { if (!syncFrame) syncFrame = requestAnimationFrame(syncWorld); };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(syncWorld, { threshold: [0, .01] }) : null;
    observer?.observe(host);
    window.addEventListener('portfolio-stage-state', syncWorld);
    window.addEventListener('scroll', queueSync, { passive: true });
    window.addEventListener('resize', queueSync, { passive: true });
    window.addEventListener('pageshow', syncWorld);
    window.addEventListener('pagehide', event => {
      cancelAnimationFrame(syncFrame);
      syncFrame = 0;
      if (!event.persisted) {
        observer?.disconnect();
        window.removeEventListener('portfolio-stage-state', syncWorld);
        window.removeEventListener('scroll', queueSync);
        window.removeEventListener('resize', queueSync);
        window.removeEventListener('pageshow', syncWorld);
        world.destroy();
      }
    });
    syncWorld();
  }
  window.PortfolioWorldFlight = Object.freeze({ create, inspect: () => world?.inspect?.() || null });
  bootWorld();
})();
