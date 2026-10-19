(() => {
  'use strict';
  // The viewer uses real geometry. Authorship and asset provenance come from the builder.
  const sourceURL = document.currentScript ? document.currentScript.src : new URL('character-model.js', location.href).href;
  const vendorURL = file => new URL('vendor/' + file, sourceURL).href;
  const assetURL = file => new URL('assets/' + file, sourceURL).href;
  let dependency, builderDependency;
  const getThree = () => dependency || (dependency = import(vendorURL('three.module.min.js')));
  function getBuilder() {
    if (window.PortfolioCharacterDetail?.build) return Promise.resolve(window.PortfolioCharacterDetail.build);
    if (!builderDependency) builderDependency = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('character-detail.js', sourceURL).href;
      script.async = true;
      script.onload = () => window.PortfolioCharacterDetail?.build ? resolve(window.PortfolioCharacterDetail.build) : reject(new Error('Character builder unavailable.'));
      script.onerror = () => reject(new Error('Character builder could not load.'));
      document.head.append(script);
    });
    return builderDependency;
  }

  async function studioEnvironment(T, renderer) {
    const studio = new T.Scene();
    const box = new T.Mesh(new T.BoxGeometry(12, 12, 12), new T.MeshBasicMaterial({ color: 0x10121b, side: T.BackSide }));
    studio.add(box);
    const cards = [
      { p: [-3.3, 3.1, 2.8], s: [.65, 4.2], c: 0xffffff, i: 7.2 },
      { p: [3.8, 2.6, .7], s: [.46, 4.5], c: 0xc6afff, i: 6.0 },
      { p: [2.8, 2.2, 4], s: [.42, 3.7], c: 0x9264df, i: 4.5 },
      { p: [0, 4.8, -1.3], s: [2.5, 1.1], c: 0xf0f3ff, i: 4.2 },
      { p: [-1.8, .1, -3.5], s: [.72, 2.8], c: 0x9775e4, i: 3.0 },
      { p: [-3.4, .8, -.8], s: [.6, 1.8], c: 0xd7bb96, i: .85 },
    ];
    cards.forEach(card => {
      const material = new T.MeshBasicMaterial({ color: new T.Color(card.c).multiplyScalar(card.i), side: T.DoubleSide });
      const mesh = new T.Mesh(new T.PlaneGeometry(...card.s), material);
      mesh.position.set(...card.p);
      mesh.lookAt(0, 1.3, 0);
      studio.add(mesh);
    });
    // This scene is used only by the reflection probe. The existing port image
    // lights the real optical surfaces; it is never mapped onto a character plane.
    let portTexture = null;
    try {
      portTexture = await new T.TextureLoader().loadAsync(assetURL('world-v2.webp'));
      portTexture.colorSpace = T.SRGBColorSpace;
      const reflectedPort = new T.Mesh(
        new T.PlaneGeometry(8, 8 * 1024 / 1536),
        new T.MeshBasicMaterial({ map: portTexture, color: new T.Color(0xffffff).multiplyScalar(2.2), side: T.DoubleSide })
      );
      reflectedPort.position.set(-1.2, 2.5, 5.2);
      reflectedPort.lookAt(0, 1.3, 0);
      studio.add(reflectedPort);
    } catch {
      // Local studio cards remain a complete fallback if an optional texture fails.
    }
    const generator = new T.PMREMGenerator(renderer);
    const target = generator.fromScene(studio, .012, .1, 30, {
      size: innerWidth < 700 ? 256 : 512,
      position: new T.Vector3(0, 1.55, 0)
    });
    generator.dispose();
    studio.traverse(object => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
    if (portTexture) portTexture.dispose();
    return target;
  }

  function create(host, options = {}) {
    if (!(host instanceof HTMLElement)) throw new TypeError('A model viewport element is required.');
    let T, renderer, scene, camera, model, envTarget, resizeObserver;
    let destroyed = false, active = !!options.active, failed = false, raf = 0, lastTime = 0, lastFrameAt = 0, renderCount = 0;
    let width = 0, height = 0, materials = [], textures = [], animations = [], stats = null, provenance = null;
    let profile = 'fullbody', modelBounds = null, bustFrame = null, distanceScale = 1;
    let focusX = 0, focusZ = .005;
    let view = 'portrait', wireframe = false, pendingFrames = 0, resumeTimer = 0, resumeAt = 0;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let autoExplicit = typeof options.autoRotate === 'boolean';
    let autoRotate = autoExplicit ? options.autoRotate : !media.matches;
    let userInteracting = false;
    const AUTO_SPEED = Math.PI * 2 / 55;
    const RESUME_DELAY = 2800;
    const state = { yaw: .42, pitch: .025, distance: 1.83, focusY: 1.69 };
    const target = { ...state };
    host.dataset.modelState = 'loading';
    const setState = value => { host.dataset.modelState = value; };
    const syncAutoState = () => { host.dataset.modelAutoRotate = String(autoRotate); };
    const clearResume = () => { if (resumeTimer) clearTimeout(resumeTimer); resumeTimer = 0; };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; lastTime = 0; clearResume(); };
    const warn = error => {
      if (destroyed || failed) return;
      failed = true;
      stop();
      setState('failed');
      if (typeof options.onError === 'function') options.onError(error);
    };
    const canRender = () => renderer && !destroyed && !failed && active && !document.hidden && width > 0 && height > 0;
    const canAutoRotate = now => autoRotate && !userInteracting && now >= resumeAt;
    const scheduleResume = () => {
      clearResume();
      if (canRender() && autoRotate && !userInteracting && resumeAt > performance.now()) {
        resumeTimer = setTimeout(() => { resumeTimer = 0; invalidate(); }, Math.max(1, resumeAt - performance.now()));
      }
    };
    const applyCamera = () => {
      const horizontal = state.distance * Math.cos(state.pitch);
      camera.position.set(focusX + Math.sin(state.yaw) * horizontal, state.focusY + Math.sin(state.pitch) * state.distance, (profile === 'bust' ? focusZ : 0) + Math.cos(state.yaw) * horizontal);
      camera.lookAt(focusX, state.focusY, focusZ);
      camera.updateMatrixWorld();
    };
    const fitBust = (snap = false) => {
      if (profile !== 'bust' || !modelBounds || !camera || width < 1 || height < 1) return;
      const size = modelBounds.getSize(new T.Vector3()), center = modelBounds.getCenter(new T.Vector3());
      // Fit a yaw-independent cylinder rather than a single front view so the
      // helmet and shoulder silhouette stay inside the frame as it turns.
      const bottom = modelBounds.min.y + (view === 'portrait' ? size.y * .18 : 0);
      const focusY = (bottom + modelBounds.max.y) / 2;
      const halfHeight = (modelBounds.max.y - bottom) / 2;
      const radius = Math.hypot(size.x, size.z) / 2;
      const maxPitch = .34;
      const verticalExtent = halfHeight * Math.cos(maxPitch) + radius * Math.sin(maxPitch);
      const depthExtent = radius * Math.cos(maxPitch) + halfHeight * Math.sin(maxPitch);
      const tanVertical = Math.tan(camera.fov * Math.PI / 360), tanHorizontal = tanVertical * camera.aspect;
      const fitDistance = (Math.max(verticalExtent / tanVertical, radius / tanHorizontal) + depthExtent) * 1.08;
      focusX = center.x; focusZ = center.z;
      bustFrame = { fitDistance, minDistance: fitDistance * .82, maxDistance: fitDistance * 2.5, visibleMinY: bottom, focusY };
      target.focusY = focusY;
      target.distance = Math.max(bustFrame.minDistance, Math.min(bustFrame.maxDistance, fitDistance * distanceScale));
      if (snap) { state.focusY = target.focusY; state.distance = target.distance; }
    };
    const draw = timestamp => {
      raf = 0;
      if (!canRender()) { lastTime = 0; return; }
      if (lastTime && timestamp - lastTime < 25) { raf = requestAnimationFrame(draw); return; }
      const elapsed = lastTime ? Math.max(0, (timestamp - lastTime) / 1000) : 0;
      const delta = Math.min(elapsed || 1 / 60, .20);
      lastTime = timestamp;
      lastFrameAt = timestamp;
      const rotating = canAutoRotate(timestamp);
      if (rotating) {
        // Turntable phase follows the real clock even on a slow GPU. Camera
        // easing has its own bounded delta; a hidden/closed view resets the clock.
        const step = elapsed * AUTO_SPEED;
        target.yaw += step;
        state.yaw += step;
      }
      const ease = 1 - Math.exp(-delta * 13);
      let moving = false;
      for (const key of Object.keys(state)) {
        const distance = target[key] - state[key];
        if (Math.abs(distance) > .00015) moving = true;
        state[key] += distance * ease;
      }
      applyCamera();
      // No idle bobbing: paused and reduced-motion views settle to a static frame.
      renderer.render(scene, camera);
      renderCount++;
      host.dataset.modelFrames = String(renderCount);
      if (pendingFrames > 0) pendingFrames--;
      if (rotating || moving || pendingFrames > 0) raf = requestAnimationFrame(draw);
      else { lastTime = 0; scheduleResume(); }
    };
    const invalidate = () => { pendingFrames = 2; if (canRender() && !raf) raf = requestAnimationFrame(draw); };
    const resize = () => {
      if (!renderer || destroyed) return;
      const rect = host.getBoundingClientRect();
      width = Math.round(rect.width); height = Math.round(rect.height);
      if (width < 1 || height < 1) { stop(); return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 600 ? 1.5 : 1.75));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fitBust(true);
      invalidate();
    };
    const visibility = () => document.hidden ? stop() : invalidate();
    const motionChange = () => {
      if (!autoExplicit) autoRotate = !media.matches;
      if (!autoRotate) target.yaw = state.yaw;
      syncAutoState();
      clearResume();
      invalidate();
      if (typeof options.onMotionChange === 'function') options.onMotionChange(api);
    };
    const shortestFront = yaw => yaw + ((((.42 - yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
    const api = {
      ready: null,
      setActive(value) { active = !!value; if (!active) stop(); else { resize(); invalidate(); } },
      setAutoRotate(value) {
        autoExplicit = true;
        autoRotate = !!value;
        resumeAt = 0;
        clearResume();
        if (!autoRotate) target.yaw = state.yaw;
        syncAutoState();
        invalidate();
      },
      setInteracting(value) {
        const next = !!value;
        if (userInteracting === next) return;
        userInteracting = next;
        clearResume();
        if (next) { target.yaw = state.yaw; resumeAt = 0; }
        else resumeAt = performance.now() + RESUME_DELAY;
        invalidate();
      },
      rotate(dx = 0, dy = 0) { target.yaw += Number(dx) * .006; target.pitch = Math.max(-.32, Math.min(.34, target.pitch + Number(dy) * .004)); invalidate(); },
      zoom(delta = 0) {
        const limits = profile === 'bust' && bustFrame ? [bustFrame.minDistance, bustFrame.maxDistance] : view === 'portrait' ? [1.50, 3.30] : [3.20, 5.60];
        target.distance = Math.max(limits[0], Math.min(limits[1], target.distance * Math.exp(Number(delta) * .001)));
        if (profile === 'bust' && bustFrame) distanceScale = target.distance / bustFrame.fitDistance;
        invalidate();
      },
      setView(value) {
        view = value === 'fullbody' ? 'fullbody' : 'portrait';
        if (profile === 'bust') { distanceScale = 1; fitBust(); }
        else {
          target.focusY = view === 'fullbody' ? 1.09 : 1.69;
          target.distance = view === 'fullbody' ? 4.1 : 1.83;
        }
        target.pitch = .025;
        host.dataset.modelView = view;
        invalidate();
      },
      setWireframe(value) { wireframe = !!value; materials.forEach(material => { material.wireframe = wireframe; material.needsUpdate = true; }); host.dataset.modelWireframe = String(wireframe); invalidate(); },
      resetView() {
        target.yaw = shortestFront(state.yaw); target.pitch = .025;
        if (profile === 'bust') { distanceScale = 1; fitBust(); }
        else { target.distance = view === 'fullbody' ? 4.1 : 1.83; target.focusY = view === 'fullbody' ? 1.09 : 1.69; }
        invalidate();
      },
      render() { invalidate(); },
      inspect() {
        const now = performance.now();
        const autoPhase = (((state.yaw - .42) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
        return { status: host.dataset.modelState, active, reducedMotion: media.matches, view, profile, wireframe, renderCount, lastFrameAt, ...stats, provenance, framing: profile === 'bust' && modelBounds ? { ...bustFrame, bounds: { min: modelBounds.min.toArray(), max: modelBounds.max.toArray() }, focus: { x: focusX, y: state.focusY, z: focusZ }, fov: camera.fov, zoomScale: distanceScale } : null, renderStats: renderer ? { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles } : null, autoRotate, autoRotating: Boolean(canRender() && canAutoRotate(now)), autoExplicit, userInteracting, resumeInMs: userInteracting ? null : Math.max(0, resumeAt - now), autoPhase, autoPeriodSeconds: 55, rotation: { yaw: state.yaw, pitch: state.pitch }, targetRotation: { yaw: target.yaw, pitch: target.pitch }, distance: state.distance, targetDistance: target.distance, width, height };
      },
      async exportGLB() {
        await api.ready;
        if (destroyed || failed) throw new Error('The model is not available.');
        const { GLTFExporter } = await import(vendorURL('GLTFExporter.js'));
        let hasSkeleton = false;
        model.traverse(object => { if (object.isSkinnedMesh) hasSkeleton = true; });
        const copy = hasSkeleton
          ? (await import(vendorURL('SkeletonUtils.js'))).clone(model)
          : model.clone(true);
        const clonedNodes = new Map();
        const mapClonedNodes = (source, cloned) => {
          clonedNodes.set(source, cloned);
          source.children.forEach((child, index) => mapClonedNodes(child, cloned.children[index]));
        };
        mapClonedNodes(model, copy);
        // glTF animation tracks can target UUIDs when source nodes are unnamed.
        // Cloning changes UUIDs; retarget cloned tracks without mutating the
        // loaded clips, including bone/property array paths.
        const exportAnimations = animations.map(clip => {
          const exported = clip.clone();
          exported.tracks.forEach(track => {
            const binding = T.PropertyBinding.parseTrackName(track.name);
            const sourceNode = T.PropertyBinding.findNode(model, binding.nodeName);
            const clonedNode = clonedNodes.get(sourceNode);
            if (!clonedNode) throw new Error('Animation target is outside the exported model: ' + track.name);
            track.name = clonedNode.uuid;
            if (binding.objectName) {
              track.name += '.' + binding.objectName;
              if (binding.objectIndex !== undefined) track.name += '[' + binding.objectIndex + ']';
            }
            track.name += '.' + binding.propertyName;
            if (binding.propertyIndex !== undefined) track.name += '[' + binding.propertyIndex + ']';
          });
          return exported;
        });
        // Keep the imported asset's centering, floor, axis and scale transforms.
        // The turntable rotates the camera, so it needs no export correction.
        if (provenance) copy.userData.provenance = provenance;
        // Wireframe belongs to the viewer; the exported asset retains its real PBR maps.
        const clonedMaterials = [];
        const materialCopies = new Map();
        const cloneExportMaterial = source => {
          if (!materialCopies.has(source)) {
            const material = source.clone();
            material.wireframe = false;
            materialCopies.set(source, material);
            clonedMaterials.push(material);
          }
          return materialCopies.get(source);
        };
        copy.traverse(object => {
          if (object.isMesh) object.material = Array.isArray(object.material)
            ? object.material.map(cloneExportMaterial)
            : cloneExportMaterial(object.material);
        });
        try {
          const binary = await new Promise((resolve, reject) => new GLTFExporter().parse(copy, resolve, reject, { binary: true, onlyVisible: false, animations: exportAnimations }));
          return new Blob([binary], { type: 'model/gltf-binary' });
        } finally { clonedMaterials.forEach(material => material.dispose()); }
      },
      destroy() {
        if (destroyed) return;
        destroyed = true; active = false; stop();
        document.removeEventListener('visibilitychange', visibility);
        media.removeEventListener('change', motionChange);
        if (resizeObserver) resizeObserver.disconnect();
        if (scene) {
          const geometries = new Set();
          scene.traverse(object => { if (object.isMesh) geometries.add(object.geometry); });
          geometries.forEach(geometry => geometry.dispose());
        }
        materials.forEach(material => material.dispose());
        textures.forEach(texture => texture.dispose());
        if (envTarget) envTarget.dispose();
        if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
        setState('destroyed');
      },
    };
    syncAutoState();
    api.ready = Promise.all([getThree(), getBuilder()]).then(async ([three, build]) => {
      if (destroyed) throw new Error('The model viewport was closed before loading.');
      T = three;
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      // Geometry and lights are static; orbiting the camera can reuse this depth map.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      const canvas = renderer.domElement;
      canvas.className = 'character-canvas';
      canvas.style.cssText = 'display:block;width:100%;height:100%;';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', '可旋转的记录者装甲三维模型');
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); warn(new Error('WebGL context lost')); });
      host.append(canvas);
      scene = new T.Scene();
      camera = new T.PerspectiveCamera(34, 1, .015, 40);
      const result = await build(T, { assetURL });
      if (destroyed) throw new Error('The model viewport was closed before building.');
      model = result.root;
      if (!model?.isObject3D) throw new Error('Invalid character geometry.');
      materials = [...new Set(Object.values(result.materials || {}).filter(material => material?.isMaterial))];
      textures = [...new Set(result.textures || [])];
      animations = result.animations || [];
      provenance = result.provenance || model.userData?.provenance || null;
      profile = provenance?.profile === 'bust' ? 'bust' : 'fullbody';
      host.dataset.modelProfile = profile;
      if (provenance) model.userData.provenance = provenance;
      materials.forEach(material => { material.wireframe = wireframe; });
      model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
      scene.add(model);
      envTarget = await studioEnvironment(T, renderer);
      if (destroyed) { envTarget.dispose(); throw new Error('The model viewport was closed before lighting.'); }
      scene.environment = envTarget.texture;
      // Photo-projected assets already carry highlights. Keep the silver armor
      // neutral instead of applying a second strong violet lighting pass.
      const photoProjected = provenance?.displayMode === 'imported-3d-asset';
      scene.environmentIntensity = photoProjected ? .55 : .88;
      const key = new T.DirectionalLight(photoProjected ? 0xffffff : 0xf6f4ff, photoProjected ? 2.1 : 2.5);
      key.position.set(-2.7, 4.2, 4.5);
      key.target.position.set(0, 1.15, 0);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { near: .1, far: 12, left: -1.65, right: 1.65, top: 1.65, bottom: -1.65 });
      key.shadow.bias = -.00015;
      key.shadow.normalBias = .003;
      key.shadow.radius = 3;
      scene.add(key, key.target);
      const fill = new T.DirectionalLight(photoProjected ? 0xdedee8 : 0xb8a4f4, photoProjected ? .3 : .42); fill.position.set(3, 2, -2); scene.add(fill);
      const rim = new T.DirectionalLight(photoProjected ? 0xede7ff : 0xcebdff, photoProjected ? 1.3 : 3.7); rim.position.set(1, 3, -4); scene.add(rim);
      scene.add(new T.HemisphereLight(photoProjected ? 0xececf4 : 0xe8e4ff, 0x292233, .22));
      modelBounds = new T.Box3().setFromObject(model);
      const dimensions = modelBounds.getSize(new T.Vector3());
      stats = { meshes: 0, triangles: 0, vertices: 0, heightMetres: Number(dimensions.y.toFixed(4)), dimensionsMetres: { width: Number(dimensions.x.toFixed(4)), height: Number(dimensions.y.toFixed(4)), depth: Number(dimensions.z.toFixed(4)) }, imagePlanes: 0 };
      model.traverse(object => {
        if (!object.isMesh) return;
        stats.meshes++;
        stats.vertices += object.geometry.attributes.position.count;
        stats.triangles += (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) / 3;
      });
      host.dataset.modelMeshes = String(stats.meshes);
      host.dataset.modelTriangles = String(stats.triangles);
      host.dataset.modelView = view;
      host.dataset.modelWireframe = String(wireframe);
      document.addEventListener('visibilitychange', visibility);
      media.addEventListener('change', motionChange);
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      setState('ready');
      resize();
      if (typeof options.onReady === 'function') options.onReady(api);
      return api;
    }).catch(error => { warn(error); throw error; });
    api.ready.catch(() => {});
    return api;
  }
  window.PortfolioCharacterModel = { create };
})();
