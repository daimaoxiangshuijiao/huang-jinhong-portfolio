(() => {
  'use strict';
  if (window.PortfolioWorldExplorer) return;
  const root = document.querySelector('[data-exploration]');
  if (!root) return;

  const scenes = [
    {
      id: 'port', name: '晨潮港口', title: '在晨光里出发。', image: 'assets/refinement-2026/port.webp',
      thumbnail: 'assets/refinement-2026/thumb-port.webp',
      alt: '未来港口、环形桥梁、远方行星与晨光照亮的水面',
      story: '晨潮退去，港口的导航环重新亮起。记录者收到一段没有署名的旧影像；一艘穿过晨雾的运输艇，指向记忆中那条失落的航线。',
      design: '把环桥作为四幕反复出现的识别形状。近景建筑、中景环桥和远景行星形成三层空间；飞船只在天空运动，给主地标和文字留出位置。',
      route: '晨潮港口 → 轨道中继站', shipAsset: 'assets/exploration/cargo.webp',
      shipDesign: '同一组航行器以不同大小和速度呈现远近。选中后定住目标，让观众能细看外形，并理解它与港口的尺度关系。',
      landmarks: [
        { id: 'navigation-ring', name: '导航环', x: .51, y: .34, story: '港口的环形结构既是航线入口，也是记录者辨认归途的地标。它框住远方行星，让旅途有了明确的方向。', design: '用巨大的圆弧框住行星，把复杂建筑集中成一个识别形状；同时保留天空，给航行器一条清楚的运动路线。' },
        { id: 'tidal-platform', name: '潮汐平台', x: .71, y: .72, story: '航行器在水面上方完成补给。港口的暖光沿潮汐展开，旧影像在这里被交给记录者。', design: '水面反射拉开建筑和水面的距离；少量暖光把冷色金属环境与“回家”的情绪连接起来。' }
      ]
    },
    {
      id: 'relay', name: '轨道中继站', title: '在轨道上接收。', image: 'assets/refinement-2026/relay.webp',
      thumbnail: 'assets/refinement-2026/thumb-relay.webp',
      alt: '巨大行星边缘的银黑色轨道中继站与紫色光学阵列',
      story: '离开港口后，信号在轨道中继站短暂停驻。行星遮住一半星光，天线接收到同一段影像的另一个版本。两次记录之间，藏着一组不同的坐标。',
      design: '把港口的圆形语言转为轨道设施，保留银黑材质和紫色光学部件。栈桥提供尺度参照，运动路径顺着环体外沿走，强化空间感。',
      route: '轨道中继站 → 记忆档案室', shipAsset: 'assets/exploration/scout.webp',
      shipDesign: '巡航器采用较短的轮廓与低亮度尾光，让它与巨大中继设施形成尺度差。选中单艇只暂停该艇，其他景深层仍可继续航行。',
      landmarks: [
        { id: 'optical-array', name: '光学阵列', x: .85, y: .49, story: '阵列捕捉从港口传来的影像信号。同一段记忆的另一个版本在这里被接收，成为继续寻找的线索。', design: '紫色光学部件与角色面罩呼应，把人物、设备和场景连成同一套视觉语言。' },
        { id: 'maintenance-bridge', name: '检修栈桥', x: .27, y: .83, story: '记录者沿狭窄栈桥抵达信号入口。设施的阴影外，行星与远方航线正在缓慢改变位置。', design: '近处栈桥较暗，远处环体更明亮。保留栏杆与检修尺度，让宏大的空间仍然可以被理解。' }
      ]
    },
    {
      id: 'archive', name: '记忆档案室', title: '在光里比对记忆。', image: 'assets/refinement-2026/archive.webp',
      thumbnail: 'assets/refinement-2026/thumb-archive.webp',
      alt: '银黑色深邃档案室、弧形导光与中央琥珀色记录匣',
      story: '档案室的光在深处依次点亮。记录者把两个版本并排放进记忆索引；缺失的一帧并没有消失，它被保存在一枚仍未打开的记录匣里。',
      design: '重复弧线与导光建立空间纵深。室内保持静止，形成外部大场景之间的安静间奏；记录匣承接角色胸前装置的设定，让场景服务故事。',
      route: '影像片段 → 记忆索引', shipAsset: null, shipDesign: '',
      landmarks: [
        { id: 'memory-case', name: '记录匣', x: .74, y: .48, story: '记录匣保存那一帧缺失的影像。两个版本的记忆在这里汇合，归途的坐标也逐渐清晰。', design: '以明亮的垂直核心作为单一视觉中心，周围保持低照度，避免把档案室做成一面没有重点的仪表墙。' },
        { id: 'archive-desk', name: '环形归档台', x: .73, y: .66, story: '归档台用于并排查看两个版本的记忆。记录者在这里找到差异，重新拼合那条失落的航线。', design: '台面只保留一个明确的工作区。重复圆弧呼应外部环桥，景别从宏大设施收拢到能被触及的物件。' }
      ]
    },
    {
      id: 'night', name: '夜航归途', title: '向归途继续航行。', image: 'assets/refinement-2026/night.webp',
      thumbnail: 'assets/refinement-2026/thumb-night.webp',
      alt: '紫色行星下的夜间港口、灯塔、环桥与低照度水面',
      story: '坐标被重新拼合，港口已进入夜色。运输艇沿着水面的光带缓缓升空。记录者没有找到全部答案，却终于拥有了一条可以继续前行的航线。',
      design: '结尾回到同一港口，用灯光与镜位变化表达时间推进。同一地标和航行器再次出现，检验跨场景的识别一致性，也让四幕成为一个故事。',
      route: '夜航港口 → 未知归途', shipAsset: 'assets/exploration/cargo.webp',
      shipDesign: '再次使用开场的航行器外形，只改变它所处的光线与位置。缓慢离港的路径回应开场，让运动承担叙事。',
      landmarks: [
        { id: 'homeward-beacon', name: '归航灯塔', x: .89, y: .54, story: '灯塔在夜间给航行器提供方向。少量暖光回应晨潮港口，照亮下一段仍未被记录的旅途。', design: '灯塔承担夜景的方向提示，暖光与开场对应；其余区域维持冷色和暗部，让夜航安静而清楚。' },
        { id: 'old-platform', name: '旧检修平台', x: .18, y: .76, story: '记录者从另一个方向回望熟悉的平台。港口并没有改变，改变的是他手里的记忆和即将出发的路线。', design: '同一港口在不同光线与镜位中重现，比持续引入陌生地点更能形成故事，也让观众辨认已有的地标。' }
      ]
    }
  ];
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { scene: 'port', loadedScene: null, pendingScene: null, transitioning: false, mode: 'story', selected: null, zoomed: false, userPaused: false, routes: false, visible: false, focused: true, inspecting: false, destroyed: false };
  let flight = null;
  let plane = { width: 0, height: 0, left: 0, top: 0 };
  let imageRatio = 1.5;
  let sceneAnimation = null;
  let outgoingAnimation = null;
  let outgoingLayer = null;
  let sceneRequest = 0;
  const focusZoom = 1.6;
  const contentAnimations = new Set();
  const decodedScenes = new Map();
  let layoutFrame = 0;
  const cleanups = [];

  const icons = {
    pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="m8 4 12 8-12 8z"/>',
    focus: '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/>',
    route: '<path d="m3 10 18-7-7 18-3-8zM11 13l10-10"/>'
  };
  function icon(kind) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[kind] + '</svg>'; }
  root.innerHTML = '<header class="explorer-heading"><h2 id="explorer-heading">继续探索<span class="explorer-heading-break">这个世界。</span></h2><p>四个场景，一条寻找归途的线索。</p></header>' +
    '<div class="explorer-viewer" data-no-hold><div class="explorer-visual"><div class="explorer-frame" id="explorer-scene-panel" role="tabpanel" aria-labelledby="explorer-tab-port">' +
      '<div class="explorer-camera"><img class="explorer-scene-image" width="1536" height="1024" decoding="async" loading="lazy"><div class="explorer-flight-host"></div><div class="explorer-hotspots"></div></div>' +
      '<div class="explorer-registration" aria-hidden="true"></div><p class="explorer-scene-label"></p>' +
      '</div><div class="explorer-toolbar" aria-label="场景画面控制"><button type="button" data-explorer-action="pause">' + icon('pause') + '<span>暂停航行</span></button>' +
      '<button type="button" data-explorer-action="focus" aria-pressed="false">' + icon('focus') + '<span>聚焦线索</span></button>' +
      '<button type="button" data-explorer-action="routes" aria-pressed="false">' + icon('route') + '<span>航线</span></button></div></div>' +
      '<div class="explorer-details"><article class="explorer-story"><div class="explorer-modes" role="tablist" aria-label="场景内容"><button id="explorer-mode-story" type="button" role="tab" aria-selected="true" aria-controls="explorer-story-panel" data-explorer-mode="story">世界故事</button><button id="explorer-mode-design" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="explorer-story-panel" data-explorer-mode="design">设计思路</button></div>' +
      '<div id="explorer-story-panel" role="tabpanel" aria-labelledby="explorer-mode-story"><h3></h3><p class="explorer-story-text"></p></div><div class="explorer-landmark-list" aria-label="场景线索"></div></article>' +
      '<article class="explorer-object" aria-label="选中物件的说明"><figure class="explorer-object-preview"><img alt="" aria-hidden="true" decoding="async"></figure><div class="explorer-object-copy" aria-live="polite" aria-atomic="true"><h4></h4><p></p><span class="explorer-object-route"></span></div></article></div>' +
      '<div class="explorer-scene-tabs" role="tablist" aria-label="选择探索场景">' + scenes.map((scene, index) => '<button type="button" id="explorer-tab-' + scene.id + '" role="tab" data-explorer-scene="' + scene.id + '" aria-selected="' + (index === 0) + '" aria-controls="explorer-scene-panel" tabindex="' + (index === 0 ? 0 : -1) + '"><img src="' + scene.thumbnail + '" width="440" height="293" alt="" loading="lazy" decoding="async"><span><i>' + String(index + 1).padStart(2, '0') + '</i>' + scene.name + '</span></button>').join('') + '</div></div>' +
      '<p class="explorer-credit">自主概念项目 · 世界设定：黄进鸿 · 场景视觉：AI 协作。展示场景概念与网页交互，短片尚未制作。</p><p class="sr-only explorer-live" role="status" aria-live="polite"></p>';

  const q = selector => root.querySelector(selector);
  const camera = q('.explorer-camera');
  const frame = q('.explorer-frame');
  let image = q('.explorer-scene-image');
  const preview = q('.explorer-object-preview');
  const previewImage = preview.querySelector('img');
  const buttons = { pause: q('[data-explorer-action="pause"]'), focus: q('[data-explorer-action="focus"]'), routes: q('[data-explorer-action="routes"]') };
  const sceneTabs = q('.explorer-scene-tabs');
  q('.explorer-details').before(sceneTabs);
  q('.explorer-viewer').append(q('.explorer-credit'));
  const scene = () => scenes.find(item => item.id === state.scene);
  const selected = () => state.selected || scene().landmarks[0];

  function on(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    cleanups.push(() => target.removeEventListener(type, listener, options));
  }
  function blockers() {
    const reasons = [];
    if (!state.loadedScene) reasons.push('loading');
    if (!state.visible) reasons.push('offscreen');
    if (document.hidden) reasons.push('hidden');
    if (!state.focused) reasons.push('blurred');
    const held = document.querySelector('#hold-inspection');
    if (state.inspecting || document.querySelector('#character-dialog[open],#site-menu[open]') || (held && !held.hidden)) reasons.push('overlay');
    if (media.matches) reasons.push('reduced-motion');
    return reasons;
  }
  function contentVisible(element) {
    if (!element?.getBoundingClientRect) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }
  function pruneContentAnimations() {
    for (const animation of contentAnimations) {
      if (!contentVisible(animation.effect?.target)) {
        animation.cancel(); contentAnimations.delete(animation);
      }
    }
  }
  function sync() {
    if (state.destroyed) return;
    const active = blockers().length === 0;
    flight?.setActive(active);
    flight?.setPaused(state.userPaused);
    root.dataset.explorerActive = String(active);
    root.dataset.explorerPaused = String(state.userPaused);
    if (!active) {
      finishTransition();
      // The mobile text panel remains visible after the scene frame leaves.
      // Pause background flight by frame visibility; gate text by its own box.
      if (blockers().some(reason => reason !== 'offscreen')) {
        for (const animation of contentAnimations) animation.cancel();
        contentAnimations.clear();
      }
    }
    pruneContentAnimations();
    updateControls();
  }
  function updateControls() {
    const staticScene = state.scene === 'archive';
    const staticMotion = staticScene || media.matches;
    buttons.pause.disabled = staticMotion;
    const pauseText = staticMotion ? '静态展示' : state.userPaused ? '继续航行' : '暂停航行';
    buttons.pause.innerHTML = icon(state.userPaused && !staticMotion ? 'play' : 'pause') + '<span>' + pauseText + '</span>';
    buttons.pause.setAttribute('aria-label', pauseText);
    buttons.pause.setAttribute('aria-pressed', String(state.userPaused && !staticMotion));
    buttons.pause.title = staticScene ? '档案室保持静止，点击地标查看记录' : media.matches ? '已启用减少动态，航行器保持静止' : '';
    buttons.focus.setAttribute('aria-pressed', String(state.zoomed));
    buttons.focus.querySelector('span').textContent = state.zoomed ? '还原全景' : '聚焦线索';
    buttons.focus.setAttribute('aria-label', state.zoomed ? '还原全景' : '聚焦线索');
    buttons.routes.disabled = staticScene;
    buttons.routes.setAttribute('aria-pressed', String(state.routes && !staticScene));
    buttons.routes.setAttribute('aria-label', state.routes ? '隐藏航线' : '显示航线');
    buttons.routes.title = staticScene ? '室内档案没有航行路线' : '';
  }
  function layout() {
    if (state.destroyed) return;
    const w = frame.clientWidth, h = frame.clientHeight;
    if (!w || !h) return;
    const pw = Math.max(w, h * imageRatio), ph = pw / imageRatio;
    plane = { width: pw, height: ph, left: (w - pw) / 2, top: (h - ph) / 2 };
    camera.style.width = pw + 'px'; camera.style.height = ph + 'px';
    camera.style.left = plane.left + 'px'; camera.style.top = plane.top + 'px';
    updateCamera(); updatePreview(); updateControls();
  }
  function requestLayout() {
    if (!layoutFrame) layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; layout(); });
  }
  function updateCamera() {
    const target = selected();
    const zoom = state.zoomed ? focusZoom : 1;
    const w = frame.clientWidth, h = frame.clientHeight;
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const x = state.zoomed ? clamp(w / 2 - target.x * plane.width * zoom, w - plane.width * zoom, 0) - plane.left : 0;
    const y = state.zoomed ? clamp(h / 2 - target.y * plane.height * zoom, h - plane.height * zoom, 0) - plane.top : 0;
    camera.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + zoom + ')';
    root.dataset.explorerZoom = state.zoomed ? 'focused' : 'wide';
    for (const button of root.querySelectorAll('[data-explorer-hotspot]')) {
      const landmark = scene().landmarks.find(item => item.id === button.dataset.explorerHotspot);
      const px = plane.left + x + landmark.x * plane.width * zoom;
      const py = plane.top + y + landmark.y * plane.height * zoom;
      const visible = px >= 22 && px <= w - 22 && py >= 22 && py <= h - 22;
      button.tabIndex = visible ? 0 : -1;
      button.setAttribute('aria-hidden', String(!visible));
      /* The frame clips markers naturally while the camera moves. Hiding them by
         destination coordinates would make a visible marker disappear before its move. */
      button.style.visibility = '';
    }
  }
  function updatePreview() {
    const target = selected();
    const current = scene();
    const ship = target.kind === 'ship';
    preview.classList.toggle('is-ship', ship);
    const source = ship ? target.asset || current.shipAsset : current.image;
    if (previewImage.getAttribute('src') !== source) previewImage.src = source;
    if (ship) { previewImage.style.cssText = ''; return; }
    const w = preview.clientWidth, h = preview.clientHeight;
    const pw = Math.max(w, h * imageRatio) * 1.85, ph = pw / imageRatio;
    const left = Math.max(w - pw, Math.min(0, w / 2 - target.x * pw));
    const top = Math.max(h - ph, Math.min(0, h / 2 - target.y * ph));
    Object.assign(previewImage.style, { width: pw + 'px', height: ph + 'px', left: left + 'px', top: top + 'px' });
  }
  function updateContent() {
    const current = scene(), target = selected();
    q('#explorer-story-panel h3').textContent = current.title;
    q('.explorer-story-text').textContent = state.mode === 'story' ? current.story : current.design;
    q('.explorer-object-copy h4').textContent = target.name;
    q('.explorer-object-copy p').textContent = state.mode === 'story' ? target.story : target.design;
    q('.explorer-object-route').textContent = target.kind === 'ship' ? current.route : '';
    root.dataset.explorerMode = state.mode;
    for (const button of root.querySelectorAll('[data-explorer-mode]')) {
      const active = button.dataset.explorerMode === state.mode;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    }
    q('#explorer-story-panel').setAttribute('aria-labelledby', 'explorer-mode-' + state.mode);
    for (const button of root.querySelectorAll('[data-explorer-hotspot],[data-explorer-landmark]')) {
      const active = (button.dataset.explorerHotspot || button.dataset.explorerLandmark) === target.id;
      button.setAttribute('aria-pressed', String(active));
    }
    updatePreview(); updateCamera();
  }
  function selectLandmark(id) {
    const target = scene().landmarks.find(item => item.id === id);
    if (!target) return;
    state.selected = { ...target, kind: 'landmark' };
    flight?.select(null);
    updateContent();
    animateContent([q('.explorer-object-copy'), preview]);
    q('.explorer-live').textContent = '已选择' + target.name;
  }
  function selectShip(payload) {
    if (payload.scene !== state.scene) return;
    state.selected = { id: payload.id, name: payload.name, asset: payload.asset, x: payload.position.x, y: payload.position.y, kind: 'ship', story: payload.description, design: scene().shipDesign };
    updateContent();
    animateContent([q('.explorer-object-copy'), preview]);
    q('.explorer-live').textContent = '已选择' + payload.name + '，航行器已暂停供查看';
  }
  function animateContent(elements) {
    for (const animation of contentAnimations) animation.cancel();
    contentAnimations.clear();
    if (state.destroyed || blockers().some(reason => reason !== 'offscreen')) return;
    elements.forEach((element, index) => {
      if (!element?.animate || !contentVisible(element)) return;
      const animation = element.animate([{ opacity: .4, translate: '0 8px' }, { opacity: 1, translate: '0 0' }],
        { duration: 360, delay: index * 32, easing: 'cubic-bezier(.16,1,.3,1)' });
      contentAnimations.add(animation);
      animation.finished.catch(() => {}).then(() => contentAnimations.delete(animation));
    });
  }
  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode; updateContent();
    animateContent([q('#explorer-story-panel'), q('.explorer-object-copy')]);
  }
  on(window, 'scroll', pruneContentAnimations, {passive: true});
  function revealSelectedScene() {
    if (sceneTabs.scrollWidth <= sceneTabs.clientWidth) return;
    const button = q('[data-explorer-scene="' + state.scene + '"]');
    const left = button.offsetLeft - sceneTabs.offsetLeft;
    const right = left + button.offsetWidth;
    const gutter = 12;
    let position = sceneTabs.scrollLeft;
    if (left < position + gutter) position = left - gutter;
    else if (right > position + sceneTabs.clientWidth - gutter) position = right - sceneTabs.clientWidth + gutter;
    sceneTabs.scrollTo({ left: Math.max(0, position), behavior: media.matches ? 'auto' : 'smooth' });
  }
  function finishTransition() {
    sceneAnimation?.cancel(); outgoingAnimation?.cancel();
    sceneAnimation = null; outgoingAnimation = null;
    outgoingLayer?.remove(); outgoingLayer = null;
    camera.style.opacity = '1'; camera.removeAttribute('data-scene-switch');
    state.transitioning = false;
    root.dataset.explorerTransition = 'settled';
  }
  function capturePicture() {
    const snapshot = document.createElement('div');
    snapshot.className = 'explorer-outgoing';
    snapshot.setAttribute('aria-hidden', 'true');
    const picture = document.createElement('div');
    picture.className = 'explorer-picture-snapshot';
    const style = getComputedStyle(camera);
    Object.assign(picture.style, { left: style.left, top: style.top, width: style.width, height: style.height, transform: style.transform, transformOrigin: style.transformOrigin, opacity: style.opacity });
    /* Keep the already decoded node. Cloning its src would briefly require another
       image decode, even from cache, precisely when this layer must cover the frame. */
    image.alt = ''; image.removeAttribute('loading');
    picture.append(image); snapshot.append(picture);
    return snapshot;
  }
  function decodeScene(next) {
    if (decodedScenes.has(next.id)) return decodedScenes.get(next.id);
    const pending = (async () => {
      const photograph = new Image();
      photograph.decoding = 'async';
      if (typeof photograph.decode === 'function') {
        photograph.src = next.image;
        await photograph.decode();
      } else {
        await new Promise((resolve, reject) => {
          photograph.onload = resolve; photograph.onerror = reject; photograph.src = next.image;
        });
      }
      if (!photograph.naturalWidth || !photograph.naturalHeight) throw new Error('Scene image is unavailable');
      return photograph;
    })();
    decodedScenes.set(next.id, pending);
    pending.catch(() => { if (decodedScenes.get(next.id) === pending) decodedScenes.delete(next.id); });
    return pending;
  }
  function markPending(id) {
    state.pendingScene = id;
    root.dataset.explorerPending = id || '';
    frame.setAttribute('aria-busy', String(!!id));
    for (const button of root.querySelectorAll('[data-explorer-scene]')) {
      button.toggleAttribute('data-pending', button.dataset.explorerScene === id);
    }
  }
  function commitScene(next, photograph, announce) {
    const animate = !!state.loadedScene && !media.matches && blockers().length === 0;
    finishTransition();
    const previous = animate ? capturePicture() : null;
    camera.setAttribute('data-scene-switch', 'true');
    const id = next.id;
    state.scene = id; state.selected = { ...next.landmarks[0], kind: 'landmark' }; state.zoomed = false;
    state.loadedScene = id;
    imageRatio = photograph.naturalWidth / photograph.naturalHeight;
    camera.querySelector(':scope > .explorer-scene-image')?.remove();
    image = photograph; image.className = 'explorer-scene-image';
    image.width = photograph.naturalWidth; image.height = photograph.naturalHeight;
    image.alt = next.alt;
    camera.prepend(image);
    const index = scenes.indexOf(next);
    q('.explorer-scene-label').textContent = String(index + 1).padStart(2, '0') + ' / 04  ' + next.name;
    q('.explorer-hotspots').innerHTML = next.landmarks.map(item => '<button type="button" data-no-hold data-explorer-hotspot="' + item.id + '" style="left:' + item.x * 100 + '%;top:' + item.y * 100 + '%" aria-label="查看' + item.name + '" aria-pressed="false"><i aria-hidden="true"></i><span>' + item.name + '</span></button>').join('');
    q('.explorer-landmark-list').innerHTML = next.landmarks.map(item => '<button type="button" data-explorer-landmark="' + item.id + '" aria-pressed="false">' + item.name + '</button>').join('');
    for (const button of root.querySelectorAll('[data-explorer-scene]')) {
      const active = button.dataset.explorerScene === id;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    }
    frame.setAttribute('aria-labelledby', 'explorer-tab-' + id);
    root.dataset.explorerScene = id;
    revealSelectedScene();
    flight?.setScene(id); flight?.setRoutes(state.routes);
    updateContent(); layout(); sync();
    if (animate && previous) {
      outgoingLayer = previous;
      frame.insertBefore(outgoingLayer, camera);
      state.transitioning = true; root.dataset.explorerTransition = 'crossfading';
      /* The outgoing photograph covers the background until the new layer covers it.
         Fading both from 50% creates a dark flash, so only the last covered frame fades out. */
      sceneAnimation = camera.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 760, easing: 'cubic-bezier(.4,0,.2,1)' });
      outgoingAnimation = outgoingLayer.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: .98 }, { opacity: 0, offset: 1 }], { duration: 760, easing: 'linear' });
      const animation = sceneAnimation;
      animation.finished.catch(() => {}).then(() => { if (sceneAnimation === animation) finishTransition(); });
    } else camera.removeAttribute('data-scene-switch');
    if (announce) q('.explorer-live').textContent = '正在探索' + next.name;
  }
  async function setScene(id, announce = true) {
    const next = scenes.find(item => item.id === id);
    if (!next || state.destroyed) return;
    const request = ++sceneRequest;
    if (state.loadedScene === id) { markPending(null); return; }
    markPending(id);
    try {
      const photograph = await decodeScene(next);
      if (state.destroyed || request !== sceneRequest) return;
      markPending(null); commitScene(next, photograph, announce);
    } catch {
      if (state.destroyed || request !== sceneRequest) return;
      markPending(null);
      q('.explorer-live').textContent = '场景暂时未能加载，已保留当前画面。请再试一次。';
    }
  }
  function activateTab(list, event, attribute) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    if (attribute === 'scene') setScene(tabs[next].dataset.explorerScene);
    else setMode(tabs[next].dataset.explorerMode);
  }

  flight = window.PortfolioWorldFlight?.create(q('.explorer-flight-host'), { scene: state.scene, onSelect: selectShip }) || null;
  on(root, 'click', event => {
    const target = event.target.closest('button');
    if (!target || !root.contains(target)) return;
    if (target.dataset.explorerScene) setScene(target.dataset.explorerScene);
    else if (target.dataset.explorerMode) setMode(target.dataset.explorerMode);
    else if (target.dataset.explorerHotspot || target.dataset.explorerLandmark) selectLandmark(target.dataset.explorerHotspot || target.dataset.explorerLandmark);
    else if (target.dataset.explorerAction === 'pause') { state.userPaused = !state.userPaused; sync(); }
    else if (target.dataset.explorerAction === 'routes') { state.routes = !state.routes; flight?.setRoutes(state.routes); updateControls(); }
    else if (target.dataset.explorerAction === 'focus') { state.zoomed = !state.zoomed; updateCamera(); updateControls(); }
  });
  on(q('.explorer-scene-tabs'), 'keydown', event => activateTab(q('.explorer-scene-tabs'), event, 'scene'));
  on(q('.explorer-modes'), 'keydown', event => activateTab(q('.explorer-modes'), event, 'mode'));
  on(root, 'keydown', event => { if (event.key === 'Escape' && state.zoomed) { state.zoomed = false; updateCamera(); updateControls(); } });
  on(window, 'portfolio-inspect-mode', event => { state.inspecting = !!event.detail?.active; sync(); });
  on(document, 'visibilitychange', sync);
  on(window, 'blur', () => { state.focused = false; sync(); });
  on(window, 'focus', () => { state.focused = true; sync(); });
  on(media, 'change', sync);
  const io = new IntersectionObserver(entries => { state.visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > .01); sync(); }, { threshold: [0, .01, .15] });
  io.observe(frame);
  const resize = new ResizeObserver(requestLayout);
  resize.observe(frame); resize.observe(preview);
  const modal = new MutationObserver(sync);
  for (const dialog of document.querySelectorAll('#site-menu,#character-dialog')) modal.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  on(window, 'pagehide', event => { state.focused = false; sync(); if (!event.persisted) destroy(); });
  on(window, 'pageshow', () => { state.focused = true; sync(); requestLayout(); });
  function destroy() {
    if (state.destroyed) return;
    state.destroyed = true; io.disconnect(); resize.disconnect(); modal.disconnect();
    ++sceneRequest; finishTransition(); if (layoutFrame) cancelAnimationFrame(layoutFrame);
    for (const animation of contentAnimations) animation.cancel(); contentAnimations.clear();
    flight?.destroy(); for (const cleanup of cleanups) cleanup();
  }
  window.PortfolioWorldExplorer = {
    inspect: () => ({ ...state, transitionVersion: sceneRequest, contentAnimationCount: contentAnimations.size, layerOpacity: { incoming: Number(getComputedStyle(camera).opacity), outgoing: outgoingLayer ? Number(getComputedStyle(outgoingLayer).opacity) : 0 }, reducedMotion: media.matches, blockers: blockers(), currentImage: image.getAttribute('src'), selected: state.selected ? { ...state.selected } : null, camera: { ...plane, zoom: state.zoomed ? focusZoom : 1, transform: camera.style.transform }, flight: flight?.inspect() || null }),
    destroy
  };
  setScene('port', false);
})();
