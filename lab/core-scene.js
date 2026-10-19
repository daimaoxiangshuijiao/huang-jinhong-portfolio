import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;
export const CORE_PALETTES = {
  silver: { base: 0xd8dcdf, vein: 0xd9f870 },
  lime: { base: 0xc5e668, vein: 0xefffc1 },
  ink: { base: 0x242b2e, vein: 0xcdeba2 }
};
const rand = seed => () => {
  seed += 0x6D2B79F5;
  let n = Math.imul(seed ^ seed >>> 15, seed | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
};
const smooth = (a, b, t) => a + (b - a) * t;

function studioEnvironment(renderer) {
  const width = 512, height = 256, data = new Float32Array(width * height * 4);
  const panels = [
    [-.62, .48, .64, .48, 1.1, 1.95], [.78, .18, .60, .24, .88, 1.35],
    [.05, .97, .23, 1.3, .38, 1.75], [-.75, .14, -.65, .14, .95, 1.05],
    [.52, -.24, -.82, .85, .24, .8], [-.15, -.32, .94, .7, .12, .40]
  ].map(p => {
    const n = new THREE.Vector3(...p.slice(0, 3)).normalize();
    const right = new THREE.Vector3(n.z, 0, -n.x).normalize();
    return { n, right, up: n.clone().cross(right), w: p[3], h: p[4], power: p[5] };
  });
  for (let y = 0; y < height; y++) {
    const phi = (y + .5) / height * Math.PI;
    for (let x = 0; x < width; x++) {
      const theta = (x + .5) / width * TAU;
      const d = new THREE.Vector3(-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      let light = .025 + Math.max(d.y, 0) * .055;
      for (const panel of panels) {
        const face = d.dot(panel.n);
        if (face <= .05) continue;
        const u = d.dot(panel.right) / face / panel.w, v = d.dot(panel.up) / face / panel.h;
        light += panel.power * Math.exp(-(u * u + v * v));
      }
      const i = (y * width + x) * 4;
      // A weak low accent card gives the inside of the knot a lime reflection.
      const accent = .66 * Math.exp(-((d.y + .42) ** 2 / .055 + (d.x + .35) ** 2 / .17 + (d.z + .82) ** 2 / .28));
      data[i] = light * .985 + accent * .72;
      data[i + 1] = light + accent;
      data[i + 2] = light * 1.015 + accent * .18;
      data[i + 3] = 1;
    }
  }
  const image = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  image.mapping = THREE.EquirectangularReflectionMapping;
  image.needsUpdate = true;
  const generator = new THREE.PMREMGenerator(renderer), target = generator.fromEquirectangular(image);
  image.dispose(); generator.dispose();
  return target;
}

function radialTexture() {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x / 127 - .5) * 2, (y / 127 - .5) * 2);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(Math.max(0, 1 - radius) ** 2.4 * 255);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

class KnotPath extends THREE.Curve {
  constructor(seed, deform) {
    super();
    const random = rand(seed);
    this.phase = random() * TAU;
    this.deform = deform;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * TAU, d = this.deform;
    const radial = .80 + (.22 + d * .17) * Math.cos(3 * a);
    const tension = .022 * d * Math.sin(5 * a + this.phase);
    return target.set((radial + tension) * Math.cos(2 * a), (radial + tension) * Math.sin(2 * a), (.23 + d * .18) * Math.sin(3 * a));
  }
}

function knotGeometry(seed, deform) {
  const path = new KnotPath(seed, deform), segments = 560, sides = 64;
  const frames = path.computeFrenetFrames(segments, true), positions = [], uvs = [], indices = [];
  const random = rand(seed + 72), phase = random() * TAU;
  const point = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, angle = u * TAU;
    path.getPoint(u, point);
    const roll = .54 * Math.sin(angle * 3 + phase) + angle * 2;
    n.copy(frames.normals[i]).multiplyScalar(Math.cos(roll)).addScaledVector(frames.binormals[i], Math.sin(roll));
    b.copy(frames.binormals[i]).multiplyScalar(Math.cos(roll)).addScaledVector(frames.normals[i], -Math.sin(roll));
    const thickness = .18 + .055 * deform + .010 * deform * Math.sin(angle * 6 + phase);
    for (let j = 0; j <= sides; j++) {
      const v = j / sides, a = v * TAU;
      const lip = 1 + .035 * deform * Math.cos(a * 3 - angle * 3);
      const nx = Math.cos(a) * thickness * .72 * lip;
      const by = Math.sin(a) * thickness * (1.12 + deform * .16) * lip;
      positions.push(point.x + n.x * nx + b.x * by, point.y + n.y * nx + b.y * by, point.z + n.z * nx + b.z * by);
      uvs.push(u, v);
      if (i < segments && j < sides) {
        const a0 = i * (sides + 1) + j, b0 = a0 + sides + 1;
        indices.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const position = geometry.attributes.position;
  for (let j = 0; j <= sides; j++) {
    const last = segments * (sides + 1) + j;
    position.setXYZ(last, position.getX(j), position.getY(j), position.getZ(j));
  }
  for (let i = 0; i <= segments; i++) {
    const a = i * (sides + 1), b = a + sides;
    position.setXYZ(b, position.getX(a), position.getY(a), position.getZ(a));
  }
  geometry.computeVertexNormals();
  // Join both periodic seams so the chrome remains continuous while turning.
  const normal = geometry.attributes.normal, joined = new THREE.Vector3();
  const weld = (a, b) => {
    joined.fromBufferAttribute(normal, a).add(new THREE.Vector3().fromBufferAttribute(normal, b)).normalize();
    normal.setXYZ(a, joined.x, joined.y, joined.z); normal.setXYZ(b, joined.x, joined.y, joined.z);
  };
  for (let i = 0; i <= segments; i++) weld(i * (sides + 1), i * (sides + 1) + sides);
  for (let j = 0; j <= sides; j++) weld(j, segments * (sides + 1) + j);
  geometry.computeBoundingSphere();
  return geometry;
}

function crystalGeometry(seed, deform) {
  const source = new THREE.IcosahedronGeometry(1.16, 1);
  const input = source.attributes.position, random = rand(seed + 341);
  const unique = new Map(), faces = [], edgeMap = new Map();
  for (let i = 0; i < input.count; i += 3) {
    const face = { points: [], vertices: [], inset: [], tint: random() > .89 ? .65 : 0 };
    for (let j = 0; j < 3; j++) {
      const point = new THREE.Vector3().fromBufferAttribute(input, i + j);
      const seedPhase = (seed % 8191) * .001;
      point.multiplyScalar(1 + .025 * deform * Math.sin(point.x * 5.1 + seedPhase) * Math.cos(point.y * 4.3 - point.z * 3.0 + seedPhase * .7));
      const key = point.toArray().map(n => Math.round(n * 100000)).join(',');
      if (!unique.has(key)) unique.set(key, { point, faces: [] });
      const item = unique.get(key);
      face.points.push(point); face.vertices.push(item); item.faces.push(face);
    }
    const center = face.points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / 3);
    const inset = .038 + deform * .024;
    face.inset = face.points.map(p => p.clone().lerp(center, inset));
    const faceIndex = faces.length;
    for (let j = 0; j < 3; j++) {
      const a = face.points[j].toArray().map(n => Math.round(n * 100000)).join(',');
      const b = face.points[(j + 1) % 3].toArray().map(n => Math.round(n * 100000)).join(',');
      const key = [a, b].sort().join('|');
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({ face: faceIndex, start: j, end: (j + 1) % 3, a, b });
    }
    faces.push(face);
  }
  const positions = [], normals = [], uv = [], accents = [];
  const triangle = (a, b, c, tint, normal = null) => {
    const n = normal || b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    for (const [point, index] of [[a, 0], [b, 1], [c, 2]]) {
      positions.push(...point.toArray()); normals.push(...n.toArray());
      uv.push(index === 1 ? 1 : 0, index === 2 ? 1 : 0); accents.push(tint);
    }
  };
  faces.forEach(face => triangle(...face.inset, face.tint));
  for (const pair of edgeMap.values()) {
    if (pair.length !== 2) continue;
    const e = pair[0], f = pair[1], a = faces[e.face].inset[e.start], b = faces[e.face].inset[e.end];
    const c = faces[f.face].inset[f.start], d = faces[f.face].inset[f.end];
    triangle(a, d, b, .20); triangle(b, d, c, .20);
  }
  for (const vertex of unique.values()) {
    const axis = vertex.point.clone().normalize(), tangent = new THREE.Vector3(0, 1, 0).cross(axis);
    if (tangent.lengthSq() < .01) tangent.set(1, 0, 0).cross(axis);
    tangent.normalize(); const bitangent = axis.clone().cross(tangent);
    const points = vertex.faces.map(face => face.inset[face.vertices.indexOf(vertex)]);
    points.sort((a, b) => Math.atan2(a.dot(bitangent), a.dot(tangent)) - Math.atan2(b.dot(bitangent), b.dot(tangent)));
    const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const cross = a.clone().sub(center).cross(b.clone().sub(center));
      if (cross.dot(axis) > 0) triangle(center, a, b, .10); else triangle(center, b, a, .10);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('aFacet', new THREE.Float32BufferAttribute(accents, 1));
  source.dispose(); geometry.computeBoundingSphere();
  return geometry;
}

const deformationGLSL = `
  uniform float uMemoryPhase;
  uniform float uMemoryAmp;
  uniform float uMemorySeed;
  varying vec2 vMemoryUv;
  varying float vMemoryFacet;
  vec3 memoryDisplacement(vec3 p) {
    return uMemoryAmp * vec3(
      sin(dot(p, vec3(2.7,1.8,-1.3)) + uMemoryPhase*.48 + uMemorySeed),
      .82*sin(dot(p, vec3(-1.6,2.4,2.1)) - uMemoryPhase*.37 + uMemorySeed*.7),
      .75*sin(dot(p, vec3(1.5,-2.3,2.8)) + uMemoryPhase*.41 - uMemorySeed*.6));
  }
  vec3 memoryNormal(vec3 p, vec3 n) {
    vec3 a = vec3(2.7,1.8,-1.3) * (uMemoryAmp*cos(dot(p,vec3(2.7,1.8,-1.3))+uMemoryPhase*.48+uMemorySeed));
    vec3 b = vec3(-1.6,2.4,2.1) * (uMemoryAmp*.82*cos(dot(p,vec3(-1.6,2.4,2.1))-uMemoryPhase*.37+uMemorySeed*.7));
    vec3 c = vec3(1.5,-2.3,2.8) * (uMemoryAmp*.75*cos(dot(p,vec3(1.5,-2.3,2.8))+uMemoryPhase*.41-uMemorySeed*.6));
    vec3 j0 = vec3(1.0+a.x,b.x,c.x), j1 = vec3(a.y,1.0+b.y,c.y), j2 = vec3(a.z,b.z,1.0+c.z);
    return normalize(cross(j1,j2)*n.x + cross(j2,j0)*n.y + cross(j0,j1)*n.z);
  }
`;

export class CoreScene {
  constructor(container, onContext = () => {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .98;
    this.renderer.setClearColor(0x0b0e10);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'core-webgl';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', '三维记忆核心。拖动旋转，双指或滚轮缩放，方向键调整，空格暂停。');
    container.prepend(this.canvas);
    this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.lost = true; onContext(true); });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.environment?.dispose();
      if (this.hdrSource) {
        this.hdrSource.needsUpdate = true;
        const generator = new THREE.PMREMGenerator(this.renderer);
        this.environment = generator.fromEquirectangular(this.hdrSource);
        generator.dispose();
      } else this.environment = studioEnvironment(this.renderer);
      this.scene.environment = this.environment.texture;
      this.floorMaterial.envMap = this.environment.texture;
      this.floorMaterial.envMapRotation.copy(this.scene.environmentRotation);
      this.floorMaterial.needsUpdate = true;
      onContext(false);
    });
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0b0e10);
    this.scene.fog = new THREE.FogExp2(0x0b0e10, .046);
    this.camera = new THREE.PerspectiveCamera(34, 1, .1, 40);
    this.environment = studioEnvironment(this.renderer); this.scene.environment = this.environment.texture; this.scene.environmentIntensity = 1.12;
    this.environmentInfo = { type: 'procedural', source: 'Local softbox studio', ready: false, fallback: true };
    this.object = new THREE.Group(); this.object.position.y = .08; this.scene.add(this.object);
    this.materials = [];
    this.meshes = [];
    this.view = { x: -.18, y: -.25, zoom: 1 };
    this.size = { width: 1000, height: 760, dpr: 1 };
    this.phase = 0; this.frameCount = 0; this.geometryVersion = 0;
    const key = new THREE.DirectionalLight(0xf8fcff, 1.5); key.position.set(-3, 4, 4); this.scene.add(key); this.key = key;
    const fill = new THREE.DirectionalLight(0xdde5ec, .6); fill.position.set(4, 1, -3); this.scene.add(fill); this.fill = fill;
    const bottom = new THREE.PointLight(0xd9f870, 1.2, 5, 2); bottom.position.set(0, -1.5, .5); this.scene.add(bottom); this.bottom = bottom;
    this.scene.add(new THREE.HemisphereLight(0xe3e9ed, 0x111619, .25));
    const texture = radialTexture();
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0b1012, metalness: .15, roughness: .59, envMapIntensity: .045, envMap: this.environment.texture });
    this.floorMaterial = floorMaterial;
    floorMaterial.onBeforeCompile = shader => {
      shader.uniforms.uStudioFloorBackground = { value: new THREE.Color(0x0b0e10) };
      shader.vertexShader = 'varying vec3 vStudioFloorWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStudioFloorWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = 'varying vec3 vStudioFloorWorld;uniform vec3 uStudioFloorBackground;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\nfloat studioFloorFade=1.0-smoothstep(3.5,13.0,length(vStudioFloorWorld.xz));\ngl_FragColor.rgb=mix(uStudioFloorBackground,gl_FragColor.rgb,studioFloorFade);');
    };
    floorMaterial.customProgramCacheKey = () => 'memory-studio-floor-distance-v1';
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), floorMaterial);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.56; this.scene.add(floor);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.5), new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: 0x000000, opacity: .75, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = -1.557; this.scene.add(contact);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: 0xd9f870, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.pool.rotation.x = -Math.PI / 2; this.pool.position.y = -1.553; this.scene.add(this.pool);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: 0xb5c9c0, opacity: .085, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(.2, .3, -2); halo.scale.set(6, 6, 1); this.scene.add(halo);
    this.setupPost();
  }

  async loadEnvironment() {
    try {
      const { HDRLoader } = await import('../vendor/HDRLoader.js');
      const texture = await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(new URL('../assets/lab/studio-small-09-1k.hdr', import.meta.url).href);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.LinearSRGBColorSpace;
      const generator = new THREE.PMREMGenerator(this.renderer);
      const target = generator.fromEquirectangular(texture);
      generator.dispose(); this.environment.dispose();
      this.hdrSource = texture; this.environment = target;
      this.scene.environment = target.texture;
      this.scene.environmentIntensity = .56;
      this.scene.environmentRotation.set(0, .55, 0);
      this.floorMaterial.envMap = target.texture;
      this.floorMaterial.envMapRotation.copy(this.scene.environmentRotation);
      this.floorMaterial.needsUpdate = true;
      this.key.intensity = .70; this.fill.intensity = .30;
      this.environmentInfo = { type: 'hdr', source: 'Poly Haven · Studio Small 09', author: 'Sergej Majboroda', license: 'CC0', asset: '../assets/lab/studio-small-09-1k.hdr', ready: true, fallback: false, intensity: .56 };
    } catch (error) {
      this.environmentInfo = { type: 'procedural', source: 'Local softbox studio', ready: true, fallback: true, reason: String(error.message || error) };
    }
  }

  setupPost() {
    this.postScene = new THREE.Scene(); this.postCamera = new THREE.Camera();
    const fullscreenVertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial()); this.postScene.add(this.postQuad);
    const rt = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    this.mainTarget = rt(1, 1); this.mainTarget.depthBuffer = true;
    this.bloomA = rt(1, 1); this.bloomB = rt(1, 1);
    this.bright = new THREE.ShaderMaterial({ vertexShader: fullscreenVertex, uniforms: { inputMap: { value: null } }, fragmentShader: 'varying vec2 vUv; uniform sampler2D inputMap; void main(){vec3 c=texture2D(inputMap,vUv).rgb;float b=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(1.2,3.0,b),1.);}', depthTest: false, depthWrite: false, toneMapped: false });
    this.blur = new THREE.ShaderMaterial({ vertexShader: fullscreenVertex, uniforms: { inputMap: { value: null }, direction: { value: new THREE.Vector2() } }, fragmentShader: 'varying vec2 vUv;uniform sampler2D inputMap;uniform vec2 direction;void main(){vec3 c=texture2D(inputMap,vUv).rgb*.227027;c+=(texture2D(inputMap,vUv+direction*1.384615).rgb+texture2D(inputMap,vUv-direction*1.384615).rgb)*.316216;c+=(texture2D(inputMap,vUv+direction*3.230769).rgb+texture2D(inputMap,vUv-direction*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}', depthTest: false, depthWrite: false, toneMapped: false });
    this.composite = new THREE.ShaderMaterial({ vertexShader: fullscreenVertex, uniforms: { baseMap: { value: null }, bloomMap: { value: null }, amount: { value: .11 } }, fragmentShader: 'varying vec2 vUv;uniform sampler2D baseMap;uniform sampler2D bloomMap;uniform float amount;void main(){gl_FragColor=vec4(texture2D(baseMap,vUv).rgb+texture2D(bloomMap,vUv).rgb*amount,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}', depthTest: false, depthWrite: false });
  }

  makeMaterial(kind = 'liquid', core = false) {
    const material = new THREE.MeshPhysicalMaterial({ color: 0xd8dcdf, metalness: .96, roughness: .18, clearcoat: .08, clearcoatRoughness: .16, anisotropy: kind === 'crystal' ? 0 : .18, anisotropyRotation: Math.PI / 2 });
    const uniforms = { phase: { value: this.phase }, amp: { value: 0 }, seed: { value: 0 }, glow: { value: .46 }, vein: { value: new THREE.Color(0xd9f870) } };
    material.userData.memory = { uniforms, kind, core };
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { uMemoryPhase: uniforms.phase, uMemoryAmp: uniforms.amp, uMemorySeed: uniforms.seed, uMemoryGlow: uniforms.glow, uMemoryVein: uniforms.vein });
      shader.vertexShader = (kind === 'crystal' ? 'attribute float aFacet;\n' : '') + deformationGLSL + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = memoryNormal(position, objectNormal);');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += memoryDisplacement(position); vMemoryUv=uv; vMemoryFacet=${kind === 'crystal' ? 'aFacet' : '0.0'};`);
      shader.fragmentShader = 'uniform float uMemoryPhase;uniform float uMemoryGlow;uniform float uMemorySeed;uniform vec3 uMemoryVein;varying vec2 vMemoryUv;varying float vMemoryFacet;\n' + shader.fragmentShader;
      const veinCode = kind === 'crystal'
        ? 'float vein = vMemoryFacet*.26; float traveling = 1.0;'
        : `float linePhase = 6.2831853*(vMemoryUv.y + .035*sin(vMemoryUv.x*18.84956 + uMemorySeed));
           float distanceToVein = abs(sin(linePhase));
           float pixelWidth = max(fwidth(distanceToVein)*.85,.006);
           float narrow = 1.0-smoothstep(.032-pixelWidth,.032+pixelWidth,distanceToVein);
           float shoulder = 1.0-smoothstep(.06,.24,distanceToVein);
           float vein = narrow*.56+shoulder*.20;
           float traveling = .60+.40*sin(vMemoryUv.x*12.56637-uMemoryPhase*.65);
           ${core ? 'vein *= .16;' : ''}`;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${veinCode}\ndiffuseColor.rgb=mix(diffuseColor.rgb,uMemoryVein*.62,vein*uMemoryGlow*.48);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=uMemoryVein*vein*uMemoryGlow*(.42+traveling*.68);');
      if (kind !== 'crystal') shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= .97+.03*sin(vMemoryUv.x*81.6814+sin(vMemoryUv.y*18.84956));');
    };
    material.customProgramCacheKey = () => `memory-studio-${kind}-${core}`;
    this.materials.push(material);
    return material;
  }

  rebuild(config) {
    for (const mesh of this.meshes) mesh.geometry.dispose();
    this.materials.forEach(material => material.dispose()); this.materials = []; this.meshes = []; this.object.clear();
    const add = (geometry, material) => { const mesh = new THREE.Mesh(geometry, material); this.object.add(mesh); this.meshes.push(mesh); return mesh; };
    if (config.preset === 'liquid') {
      const mesh = add(knotGeometry(config.seed, config.deform), this.makeMaterial('liquid'));
      mesh.rotation.z = .18;
    } else if (config.preset === 'orbit') {
      const random = rand(config.seed), phase = random() * TAU;
      for (let i = 0; i < 4; i++) {
        const radius = .70 + i * .22;
        const ring = add(new THREE.TorusGeometry(radius, (i === 0 ? .073 : .045) + config.deform * .012, 32, 288), this.makeMaterial('orbit'));
        ring.rotation.set(.4 + i * .68 + phase * .08, -.5 + i * .43, .15 + i * .35);
        ring.scale.set(1 + config.deform * .04, 1 - config.deform * .025, 1);
      }
      const geometry = new THREE.SphereGeometry(.48 + config.deform * .06, 96, 64);
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const factor = 1 + .055 * config.deform * Math.sin(x * 14 + y * 8 + phase) * Math.cos(z * 13 - phase);
        p.setXYZ(i, x * factor, y * factor, z * factor);
      }
      geometry.computeVertexNormals(); add(geometry, this.makeMaterial('orbit', true));
    } else {
      const mesh = add(crystalGeometry(config.seed, config.deform), this.makeMaterial('crystal'));
      mesh.rotation.set(.15, .1, .12);
    }
    this.config = { ...config }; this.geometryVersion++; this.updateMaterials(config); this.updateGeometryInfo();
  }

  updateMaterials(config) {
    this.config = { ...config };
    const palette = CORE_PALETTES[config.palette];
    for (const material of this.materials) {
      const { uniforms, kind, core } = material.userData.memory;
      material.color.setHex(palette.base);
      if (core) material.color.multiplyScalar(.48);
      material.metalness = .62 + config.metal * .38;
      material.roughness = .235 - config.metal * .065 + (kind === 'crystal' ? .015 : 0);
      material.envMapIntensity = this.environmentInfo.type === 'hdr' ? .56 : 1.12;
      uniforms.seed.value = (config.seed % 8191) * .001;
      uniforms.glow.value = config.glow;
      uniforms.vein.value.setHex(palette.vein);
      uniforms.amp.value = kind === 'crystal' ? 0 : kind === 'orbit' ? .004 + config.deform * .005 : .010 + config.deform * .014;
    }
    this.pool.material.color.setHex(palette.vein); this.pool.material.opacity = .04 + config.glow * .18;
    this.bottom.color.setHex(palette.vein); this.bottom.intensity = config.glow * 1.8;
    this.composite.uniforms.amount.value = .045 + config.glow * .12;
  }

  updateGeometryInfo() {
    let vertexCount = 0, triangleCount = 0, hash = 2166136261;
    for (const mesh of this.meshes) {
      const p = mesh.geometry.attributes.position;
      vertexCount += p.count; triangleCount += mesh.geometry.index ? mesh.geometry.index.count / 3 : p.count / 3;
      for (let i = 0; i < p.array.length; i++) hash = Math.imul(hash ^ Math.round(p.array[i] * 100000), 16777619);
      mesh.updateMatrix();
      for (const n of mesh.matrix.elements) hash = Math.imul(hash ^ Math.round(n * 100000), 16777619);
    }
    const bounds = new THREE.Box3().setFromObject(this.object), sphere = bounds.getBoundingSphere(new THREE.Sphere());
    this.geometryInfo = { real3D: true, preset: this.config.preset, type: this.config.preset === 'liquid' ? 'ClosedTwistedKnot' : this.config.preset === 'orbit' ? 'FourSolidOrbitsAndCore' : 'BeveledIcosahedralCrystal', vertexCount, triangleCount, meshCount: this.meshes.length, hash: (hash >>> 0).toString(16).padStart(8, '0'), version: this.geometryVersion, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, normalMethod: 'Exact cofactor of displacement Jacobian', gpuDeformation: this.config.preset !== 'crystal', radius: sphere.radius };
  }

  setPhase(phase) { this.phase = phase; for (const material of this.materials) material.userData.memory.uniforms.phase.value = phase; }
  setView(view) { this.view = { ...view }; }
  applyView() {
    this.object.rotation.set(this.view.x, this.view.y, 0);
    const aspect = this.camera.aspect;
    const distance = 5.8 * Math.max(1, 1 / Math.max(.7, aspect)) * (aspect < 1.05 ? 1.08 : 1) / this.view.zoom;
    this.camera.position.set(0, .22, distance); this.camera.lookAt(0, aspect < 1.05 ? -.03 : -.15, 0);
  }
  resize(width, height, dpr = 1) {
    this.size = { width, height, dpr };
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
    this.mainTarget.setSize(w, h); this.bloomA.setSize(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4))); this.bloomB.setSize(this.bloomA.width, this.bloomA.height);
  }
  render() {
    if (this.lost) return;
    this.applyView();
    const renderer = this.renderer;
    renderer.setRenderTarget(this.mainTarget); renderer.render(this.scene, this.camera);
    this.postQuad.material = this.bright; this.bright.uniforms.inputMap.value = this.mainTarget.texture;
    renderer.setRenderTarget(this.bloomA); renderer.render(this.postScene, this.postCamera);
    this.postQuad.material = this.blur; this.blur.uniforms.inputMap.value = this.bloomA.texture; this.blur.uniforms.direction.value.set(1 / this.bloomA.width, 0);
    renderer.setRenderTarget(this.bloomB); renderer.render(this.postScene, this.postCamera);
    this.blur.uniforms.inputMap.value = this.bloomB.texture; this.blur.uniforms.direction.value.set(0, 1 / this.bloomA.height);
    renderer.setRenderTarget(this.bloomA); renderer.render(this.postScene, this.postCamera);
    this.postQuad.material = this.composite; this.composite.uniforms.baseMap.value = this.mainTarget.texture; this.composite.uniforms.bloomMap.value = this.bloomA.texture;
    renderer.setRenderTarget(null); renderer.render(this.postScene, this.postCamera); this.frameCount++;
  }
  capture(width, height) {
    const previous = { ...this.size };
    this.resize(width, height, 1); this.render();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(this.canvas, 0, 0);
    this.resize(previous.width, previous.height, previous.dpr); this.render();
    return canvas;
  }
  presetThumbnails(config) {
    const saved = { config: { ...this.config }, view: { ...this.view }, phase: this.phase }, result = {};
    for (const preset of ['liquid', 'orbit', 'crystal']) {
      this.rebuild({ ...config, preset }); this.setView({ x: -.18, y: -.25, zoom: 1.05 }); this.setPhase(0);
      result[preset] = this.capture(240, 156).toDataURL('image/jpeg', .85);
    }
    this.rebuild(saved.config); this.setView(saved.view); this.setPhase(saved.phase); this.render();
    return result;
  }
  inspect() {
    const triangles = this.geometryInfo?.triangleCount || 0;
    return { engine: 'Three.js', revision: THREE.REVISION, width: this.canvas.width, height: this.canvas.height, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, preserveDrawingBuffer: true, bloom: true, environment: { ...this.environmentInfo, actualIntensity: this.scene.environmentIntensity, floorIntensity: this.floorMaterial.envMapIntensity, floorHasOwnEnvironment: !!this.floorMaterial.envMap }, actualSceneTriangles: triangles, triangles, frames: this.frameCount };
  }
}
