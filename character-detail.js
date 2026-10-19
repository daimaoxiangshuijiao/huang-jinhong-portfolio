(() => {
  'use strict';
  const sourceURL = document.currentScript ? document.currentScript.src : new URL('character-detail.js', location.href).href;
  const localAssetsURL = new URL('assets/', sourceURL);
  let proceduralDependency;

  // Keep all model loads inside the bundled assets directory. A manifest cannot
  // trigger an external model/texture fetch or opt into a paid conversion service.
  function localAssetURL(value, base = localAssetsURL) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Character asset path is required.');
    let url;
    try { url = new URL(value, base); } catch { throw new Error('Character asset path is invalid.'); }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { throw new Error('Character asset path encoding is invalid.'); }
    if (url.origin !== location.origin || url.username || url.password || url.search || url.hash ||
        !['http:', 'https:'].includes(url.protocol) || !pathname.startsWith(decodeURIComponent(localAssetsURL.pathname)) ||
        pathname.split('/').some(segment => segment === '..' || segment === '.') || pathname.includes('\\')) {
      throw new Error('Character files must be same-origin files inside the local assets directory.');
    }
    return url;
  }

  function getProceduralBuilder() {
    if (window.PortfolioProceduralCharacterDetail?.build) return Promise.resolve(window.PortfolioProceduralCharacterDetail.build);
    if (!proceduralDependency) proceduralDependency = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('character-procedural.js', sourceURL).href;
      script.async = true;
      script.onload = () => window.PortfolioProceduralCharacterDetail?.build
        ? resolve(window.PortfolioProceduralCharacterDetail.build)
        : reject(new Error('Procedural character builder unavailable.'));
      script.onerror = () => reject(new Error('Procedural character builder could not load.'));
      document.head.append(script);
    });
    return proceduralDependency;
  }

  const axis = (T, value) => {
    const values = { '+X': [1, 0, 0], '-X': [-1, 0, 0], '+Y': [0, 1, 0], '-Y': [0, -1, 0], '+Z': [0, 0, 1], '-Z': [0, 0, -1] };
    if (!Object.hasOwn(values, value)) throw new Error('Model axis must be +X, -X, +Y, -Y, +Z or -Z.');
    return new T.Vector3(...values[value]);
  };

  function validateManifest(manifest) {
    if (!manifest || Array.isArray(manifest) || manifest.schemaVersion !== 1 || typeof manifest.enabled !== 'boolean') {
      throw new Error('Character asset manifest is invalid (expected schemaVersion 1 and boolean enabled).');
    }
    if (!manifest.enabled) return;
    if (!['fullbody', 'bust'].includes(manifest.profile)) throw new Error('Character asset profile must be fullbody or bust.');
    if (typeof manifest.file !== 'string' || !/\.glb$/i.test(manifest.file)) throw new Error('Enabled character asset must be a local .glb file.');
    const n = manifest.normalization;
    if (!n || (n.targetHeightMeters !== undefined && (!Number.isFinite(n.targetHeightMeters) || n.targetHeightMeters <= 0 || n.targetHeightMeters > 20)) ||
        !Number.isFinite(n.yawDegrees) || typeof n.centerXZ !== 'boolean' || !Number.isFinite(n.floorY)) {
      throw new Error('Character normalization settings are invalid.');
    }
    const p = manifest.provenance;
    if (!p || typeof p.title !== 'string' || !p.title.trim() || typeof p.author !== 'string' || !p.author.trim() ||
        !p.source || typeof p.source !== 'object' || !['original', 'licensed', 'service-generated'].includes(p.source.type) ||
        typeof p.source.name !== 'string' || !p.source.name.trim() || typeof p.license !== 'string' || !p.license.trim() ||
        !['not-evaluated', 'in-review', 'approved'].includes(p.referenceMatch)) {
      throw new Error('Enabled assets require an accurate author, source, license and review status.');
    }
  }

  // GLB binaries may contain embedded/data images. Relative files are allowed
  // only under assets; remote, protocol-relative, blob and traversal URIs fail
  // before GLTFLoader parses the file or requests any dependencies.
  function validateGLB(bytes, modelURL) {
    const view = new DataView(bytes);
    if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== view.byteLength) {
      throw new Error('Character asset is not a valid GLB 2.0 file.');
    }
    let json, offset = 12;
    while (offset < view.byteLength) {
      if (offset + 8 > view.byteLength) throw new Error('Character GLB has a truncated chunk header.');
      const size = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
      offset += 8;
      if (size > view.byteLength - offset) throw new Error('Character GLB has a truncated chunk.');
      if (type === 0x4e4f534a) {
        if (json) throw new Error('Character GLB has more than one JSON chunk.');
        try { json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, offset, size)).trim()); }
        catch { throw new Error('Character GLB JSON is invalid.'); }
      }
      offset += size;
    }
    if (!json || json.asset?.version !== '2.0' || !Array.isArray(json.meshes) || !json.meshes.length) {
      throw new Error('Character GLB contains no renderable mesh asset.');
    }
    for (const item of [...(json.buffers || []), ...(json.images || [])]) {
      if (!item || item.uri === undefined) continue;
      if (typeof item.uri !== 'string') throw new Error('Character GLB contains an invalid resource URI.');
      if (/^data:/i.test(item.uri)) {
        if (!/^data:(?:image\/(?:png|jpeg|webp)|application\/octet-stream);base64,/i.test(item.uri)) {
          throw new Error('Character GLB contains an unsupported inline resource.');
        }
      } else {
        if (/^[a-z][a-z\d+.-]*:/i.test(item.uri) || item.uri.startsWith('//')) throw new Error('Remote character resources are not allowed.');
        localAssetURL(item.uri, modelURL);
      }
    }
    const unsupported = (json.extensionsRequired || []).filter(name => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(name));
    if (unsupported.length) throw new Error('Export an uncompressed GLB with PNG/JPEG/WebP textures; decoder-dependent extensions are unavailable: ' + unsupported.join(', '));
    return json;
  }

  async function build(T, options = {}) {
    const manifestURL = localAssetURL(typeof options.assetURL === 'function' ? options.assetURL('character-asset.json') : 'character-asset.json');
    const response = await fetch(manifestURL, { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
    if (!response.ok) throw new Error('Character asset manifest could not load (HTTP ' + response.status + ').');
    let manifest;
    try { manifest = await response.json(); } catch { throw new Error('Character asset manifest is not valid JSON.'); }
    validateManifest(manifest);
    if (!manifest.enabled) {
      const builder = await getProceduralBuilder();
      const result = await builder(T, options);
      result.provenance = {
        ...result.provenance,
        profile: 'fullbody',
        displayMode: 'procedural-approximation',
        referenceMatch: 'not-approved-as-final',
        productionNote: '程序化近似稿；尚未达到已确认概念图的专业建模还原要求。',
        sources: [{ type: 'concept-reference', name: '已确认的归巢协议角色概念图', author: '黄进鸿 · AI 协作角色设计', role: '2D silhouette and design reference; not a high-detail 3D source asset' }]
      };
      result.root.userData.provenance = result.provenance;
      return result;
    }

    const n = { ...manifest.normalization, targetHeightMeters: manifest.normalization.targetHeightMeters ?? (manifest.profile === 'bust' ? 1.25 : 2.15) };
    const up = axis(T, n.upAxis), front = axis(T, n.frontAxis);
    if (Math.abs(up.dot(front)) > .001) throw new Error('Model upAxis and frontAxis must be perpendicular.');
    const modelURL = localAssetURL(manifest.file, manifestURL);
    const fileResponse = await fetch(modelURL, { credentials: 'same-origin', redirect: 'error' });
    if (!fileResponse.ok) throw new Error('Enabled character GLB could not load (HTTP ' + fileResponse.status + ').');
    const bytes = await fileResponse.arrayBuffer();
    validateGLB(bytes, modelURL);
    const { GLTFLoader } = await import(new URL('vendor/GLTFLoader.js', sourceURL).href);
    const manager = new T.LoadingManager(), dependencyFailures = [];
    manager.onError = url => dependencyFailures.push(url);
    manager.setURLModifier(url => /^data:|^blob:/i.test(url) ? url : localAssetURL(url, modelURL).href);
    const loader = new GLTFLoader(manager);
    const gltf = await loader.parseAsync(bytes, new URL('.', modelURL).href);
    if (dependencyFailures.length) throw new Error('Character GLB dependencies could not load: ' + dependencyFailures.join(', '));
    const scene = gltf.scene;
    if (!scene) throw new Error('Character GLB has no default scene.');
    const materials = [], textures = [], materialSet = new Set(), textureSet = new Set();
    let meshCount = 0;
    scene.traverse(object => {
      if (!object.isMesh) return;
      meshCount++;
      const position = object.geometry?.getAttribute('position');
      if (!position || position.count < 3) throw new Error('Character GLB contains a mesh with no usable vertex positions.');
      for (let index = 0; index < position.count; index++) {
        if (![position.getX(index), position.getY(index), position.getZ(index)].every(Number.isFinite)) throw new Error('Character GLB contains non-finite vertex coordinates.');
      }
      object.castShadow = true; object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material?.isMaterial) throw new Error('Character GLB contains a mesh with no usable material.');
        if (!materialSet.has(material)) { materialSet.add(material); materials.push(material); }
        // Include every PBR extension texture slot (clearcoat, transmission,
        // sheen, iridescence, anisotropy, etc.), not only the common four maps.
        for (const value of Object.values(material)) if (value?.isTexture && !textureSet.has(value)) { textureSet.add(value); textures.push(value); }
      }
    });
    if (!meshCount) throw new Error('Character GLB scene contains no renderable meshes.');

    const right = up.clone().cross(front).normalize();
    const rotation = new T.Matrix4().makeBasis(right, up, front).transpose();
    const orientation = new T.Group();
    orientation.name = 'Recorder_Imported_Asset_Orientation';
    orientation.quaternion.setFromRotationMatrix(rotation);
    orientation.add(scene);
    const root = new T.Group();
    root.name = 'Recorder_Imported_Asset';
    root.rotation.y = n.yawDegrees * Math.PI / 180;
    root.add(orientation);
    root.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(root), size = bounds.getSize(new T.Vector3());
    if (bounds.isEmpty() || ![...size.toArray(), ...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite) || size.y <= 1e-6) {
      throw new Error('Character GLB has invalid or zero-height bounds.');
    }
    root.scale.setScalar(n.targetHeightMeters / size.y);
    root.updateMatrixWorld(true);
    bounds.setFromObject(root);
    const center = bounds.getCenter(new T.Vector3());
    root.position.set(n.centerXZ ? -center.x : 0, n.floorY - bounds.min.y, n.centerXZ ? -center.z : 0);
    root.updateMatrixWorld(true);
    const provenance = {
      modelVersion: 'local-glb-import-v1',
      profile: manifest.profile,
      title: manifest.provenance.title,
      construction: manifest.provenance.productionNote || 'Imported GLB; original mesh and PBR materials retained.',
      author: manifest.provenance.author,
      license: manifest.provenance.license,
      sources: [{ ...manifest.provenance.source, author: manifest.provenance.author, license: manifest.provenance.license }],
      referenceMatch: manifest.provenance.referenceMatch,
      displayMode: 'imported-3d-asset',
      assetFile: manifest.file,
      normalization: { ...n, uniformScale: root.scale.x },
      animationClips: gltf.animations?.map(clip => clip.name) || []
    };
    root.userData = { ...root.userData, title: provenance.title, provenance, units: 'metres' };
    return { root, materials, textures, provenance, animations: gltf.animations || [] };
  }

  window.PortfolioCharacterDetail = { build };
})();
