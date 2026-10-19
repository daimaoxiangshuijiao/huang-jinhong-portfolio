(() => {
  'use strict';
  const sourceURL = document.currentScript ? document.currentScript.src : new URL('character-procedural.js', location.href).href;

  // This model follows the approved recorder concept: a silver segmented helmet,
  // one continuous panoramic violet visor, fitted armour and photographic tools.
  // All geometry and surface maps below are original; no character image planes.
  async function build(T, options = {}) {
    const { mergeVertices } = await import(new URL('vendor/BufferGeometryUtils.js', sourceURL).href);
    const root = new T.Group();
    root.name = 'Homecoming_Recorder_Concept_Reconstruction';
    const body = new T.Group();
    body.name = 'Recorder_Original_Fabricated_Parts';
    root.add(body);
    const textures = [];
    let seed = 428781;
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967295; };
    const canvasMap = (size, draw, color = false) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      draw(canvas.getContext('2d'), size);
      const texture = new T.CanvasTexture(canvas);
      if (color) texture.colorSpace = T.SRGBColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.anisotropy = 4;
      textures.push(texture);
      return texture;
    };
    const surface = canvasMap(512, (c, size) => {
      c.fillStyle = '#e1e3e6'; c.fillRect(0, 0, size, size);
      const data = c.getImageData(0, 0, size, size);
      for (let i = 0; i < data.data.length; i += 4) {
        const value = Math.round(220 + random() * 22);
        data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
      }
      c.putImageData(data, 0, 0);
      // Paint grain, worn edges and fine scratches, rather than chunky fake panels.
      for (let i = 0; i < 560; i++) {
        c.strokeStyle = `rgba(55,61,70,${.08 + random() * .26})`;
        c.lineWidth = .30 + random() * .75;
        const x = random() * size, y = random() * size;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + (random() - .5) * 34, y + 1 + random() * 19); c.stroke();
      }
      for (let i = 0; i < 1600; i++) {
        c.fillStyle = `rgba(41,47,58,${.12 + random() * .42})`;
        const radius = .25 + Math.pow(random(), 6) * 2.5;
        c.beginPath(); c.arc(random() * size, random() * size, radius, 0, Math.PI * 2); c.fill();
      }
    }, true);
    surface.repeat.set(1, 1);
    const microRoughness = canvasMap(256, (c, size) => {
      const data = c.createImageData(size, size);
      for (let i = 0; i < data.data.length; i += 4) {
        const v = Math.round(170 + random() * 57);
        data.data.set([v, v, v, 255], i);
      }
      c.putImageData(data, 0, 0);
    });
    microRoughness.repeat.set(5, 5);
    const microNormal = canvasMap(256, (c, size) => {
      const data = c.createImageData(size, size);
      for (let i = 0; i < data.data.length; i += 4) data.data.set([Math.round(128 + (random() - .5) * 32), Math.round(128 + (random() - .5) * 32), 254, 255], i);
      c.putImageData(data, 0, 0);
    });
    microNormal.repeat.set(7, 7);
    const weave = canvasMap(256, (c, size) => {
      c.fillStyle = '#bfc1c3'; c.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) {
        c.fillStyle = (x + y) % 8 ? '#dddfe0' : '#a4a8aa';
        c.fillRect(x, y, 2.7, 1.6);
        c.fillStyle = '#8d9295'; c.fillRect(x + 2.3, y + 1.6, 1.5, 2.4);
      }
    }, true);
    weave.repeat.set(12, 12);
    const clothNormal = canvasMap(256, (c, size) => {
      c.fillStyle = '#8080ff'; c.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) {
        c.fillStyle = '#7289fb'; c.fillRect(x, y, 2.4, 1.4);
        c.fillStyle = '#8d74fa'; c.fillRect(x + 2.4, y + 1.4, 1.6, 2.6);
      }
    });
    clothNormal.repeat.set(12, 12);
    const materials = {
      silver: new T.MeshStandardMaterial({ color: 0xb2b6bd, map: surface, roughnessMap: microRoughness, normalMap: microNormal, normalScale: new T.Vector2(.06, .06), metalness: .79, roughness: .74 }),
      silverLight: new T.MeshStandardMaterial({ color: 0xc4c7ce, map: surface, roughnessMap: microRoughness, normalMap: microNormal, normalScale: new T.Vector2(.065, .065), metalness: .71, roughness: .71 }),
      gunmetal: new T.MeshStandardMaterial({ color: 0x555c65, map: surface, roughnessMap: microRoughness, normalMap: microNormal, normalScale: new T.Vector2(.06, .06), metalness: .87, roughness: .67 }),
      graphite: new T.MeshStandardMaterial({ color: 0x24282d, roughnessMap: microRoughness, metalness: .68, roughness: .47 }),
      chrome: new T.MeshStandardMaterial({ color: 0xbcc6ce, metalness: .96, roughness: .23 }),
      black: new T.MeshStandardMaterial({ color: 0x111418, metalness: .20, roughness: .71 }),
      fabric: new T.MeshStandardMaterial({ color: 0x46494e, map: weave, normalMap: clothNormal, normalScale: new T.Vector2(.26, .26), metalness: .015, roughness: .96 }),
      rubber: new T.MeshStandardMaterial({ color: 0x16191c, metalness: .025, roughness: .86 }),
      violet: new T.MeshPhysicalMaterial({ color: 0x512883, emissive: 0x240936, emissiveIntensity: .17, metalness: .58, roughness: .075, clearcoat: 1, clearcoatRoughness: .045, envMapIntensity: 2.15 }),
      opticEtching: new T.MeshStandardMaterial({ color: 0x977cc4, transparent: true, opacity: .23, metalness: .4, roughness: .45, depthWrite: false }),
      violetRim: new T.MeshStandardMaterial({ color: 0x8f58d4, emissive: 0x5c248c, emissiveIntensity: .44, metalness: .57, roughness: .28 }),
      lens: new T.MeshPhysicalMaterial({ color: 0x251139, metalness: .90, roughness: .06, clearcoat: 1, clearcoatRoughness: .018, envMapIntensity: 2.5 }),
      lime: new T.MeshStandardMaterial({ color: 0xcde866, emissive: 0x7c922c, emissiveIntensity: .28, metalness: .33, roughness: .47 }),
      brass: new T.MeshStandardMaterial({ color: 0x9b8b58, metalness: .85, roughness: .42 }),
    };
    let fabricationParts = 0;
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const add = (geometry, material, name, position = [0, 0, 0], parent = body, rotation = null) => {
      const mesh = new T.Mesh(geometry, material);
      mesh.name = name;
      mesh.position.set(...position);
      if (rotation) mesh.rotation.set(...rotation);
      mesh.castShadow = true; mesh.receiveShadow = true;
      parent.add(mesh);
      fabricationParts++;
      return mesh;
    };
    const cutRect = (w, h, cut = Math.min(w, h) * .11) => [
      [-w / 2 + cut, -h / 2], [w / 2 - cut, -h / 2], [w / 2, -h / 2 + cut],
      [w / 2, h / 2 - cut], [w / 2 - cut, h / 2], [-w / 2 + cut, h / 2],
      [-w / 2, h / 2 - cut], [-w / 2, -h / 2 + cut],
    ];
    const extruded = (points, depth = .015, bevel = .0025) => {
      const shape = new T.Shape();
      points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
      shape.closePath();
      return new T.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSegments: 3, bevelSize: bevel, bevelThickness: bevel * .75, curveSegments: 12, steps: 1 });
    };
    const flat = (points, depth, material, name, position, parent = body, rotation = null, bevel = .0025) => add(extruded(points, depth, bevel), material, name, position, parent, rotation);
    const box = (w, h, d, material, name, position, parent = body, rotation = null, bevel = .0015) => flat(cutRect(w, h), d, material, name, position, parent, rotation, bevel);
    const tube = (points, radius, material, name, parent = body, segments = 8) => add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => V(...p))), Math.max(8, points.length * 3), radius, radius < .001 ? 5 : segments, false), material, name, [0, 0, 0], parent);
    const lathe = (profile, material, name, position, axis = 'y', parent = body, segments = 48) => {
      const mesh = add(new T.LatheGeometry(profile.map(p => new T.Vector2(...p)), segments), material, name, position, parent);
      if (axis === 'x') mesh.rotation.z = -Math.PI / 2;
      if (axis === 'z') mesh.rotation.x = Math.PI / 2;
      return mesh;
    };
    const cylinder = (radius, length, material, name, position, axis = 'y', parent = body, segments = 32) => lathe([[0, -length / 2], [radius * .92, -length / 2], [radius, -length / 2 + Math.min(.002, length * .14)], [radius, length / 2 - Math.min(.002, length * .14)], [radius * .92, length / 2], [0, length / 2]], material, name, position, axis, parent, segments);
    const ring = (outer, inner, length, material, name, position, axis = 'y', parent = body, segments = 48) => lathe([[inner, -length / 2], [outer * .95, -length / 2], [outer, -length / 2 + length * .2], [outer, length / 2 - length * .2], [outer * .95, length / 2], [inner, length / 2], [inner, -length / 2]], material, name, position, axis, parent, segments);
    const bolt = (position, name, axis = 'z', parent = body, r = .0028) => {
      const mesh = cylinder(r, .0026, materials.graphite, name, position, axis, parent, 6);
      const inner = cylinder(r * .40, .00285, materials.black, name + '_socket', position, axis, parent, 6);
      return mesh;
    };
    const profileAt = (rings, y) => {
      let i = 0;
      while (i < rings.length - 2 && y > rings[i + 1][0]) i++;
      const a = rings[i], b = rings[i + 1], f = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
      const smooth = f * f * (3 - 2 * f);
      return [a[1] + (b[1] - a[1]) * smooth, a[2] + (b[2] - a[2]) * smooth, (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * smooth];
    };
    const loft = (rings, segments = 56, subdivisions = 3, folds = 0) => {
      const points = [], uv = [], indices = [];
      const count = (rings.length - 1) * subdivisions + 1;
      for (let j = 0; j < count; j++) {
        const y = rings[0][0] + j / (count - 1) * (rings[rings.length - 1][0] - rings[0][0]);
        const [rx, rz, oz] = profileAt(rings, y);
        for (let i = 0; i <= segments; i++) {
          const theta = i / segments * Math.PI * 2;
          const fold = folds * (Math.sin(y * 72 + theta * 4) * .55 + Math.sin(theta * 11 - y * 38) * .45);
          points.push(Math.sin(theta) * (rx + fold), y, Math.cos(theta) * (rz + fold) + oz);
          uv.push(i / segments, j / (count - 1));
        }
      }
      for (let j = 0; j < count - 1; j++) for (let i = 0; i < segments; i++) {
        const a = j * (segments + 1) + i, b = a + 1, c = a + segments + 1, d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
      const cap = (first, y, oz, reverse) => {
        const center = points.length / 3;
        points.push(0, y, oz); uv.push(.5, .5);
        for (let i = 0; i < segments; i++) indices.push(center, first + (reverse ? i + 1 : i), first + (reverse ? i : i + 1));
      };
      cap(0, rings[0][0], rings[0][3] || 0, true);
      cap((count - 1) * (segments + 1), rings[rings.length - 1][0], rings[rings.length - 1][3] || 0, false);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(indices); g.computeVertexNormals();
      return g;
    };
    // Bevelled patches are remapped onto a curved anatomical shell after subdivision.
    // Welded surface normals preserve smooth curvature while the bevel edge stays crisp.
    const curvedGeometry = (points, mapper, depth = .010, bevel = .002) => {
      const original = extruded(points, depth, bevel);
      const src = original.attributes.position, srcNormal = original.attributes.normal;
      const positions = [], uvs = [], indices = [], keys = new Map();
      const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
      const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
      const emit = (v, category) => {
        const p = mapper(...v);
        const key = p.map(n => Math.round(n * 1e7)).join(',') + ':' + category;
        if (!keys.has(key)) {
          keys.set(key, positions.length / 3); positions.push(...p);
          uvs.push((v[0] - minX) / Math.max(.0001, maxX - minX), (v[1] - minY) / Math.max(.0001, maxY - minY));
        }
        indices.push(keys.get(key));
      };
      const midpoint = (a, b) => a.map((v, i) => (v + b[i]) / 2);
      const divide = (a, b, c, n, category) => {
        if (!n) { emit(a, category); emit(b, category); emit(c, category); return; }
        const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
        divide(a, ab, ca, n - 1, category); divide(ab, b, bc, n - 1, category);
        divide(ca, bc, c, n - 1, category); divide(ab, bc, ca, n - 1, category);
      };
      const read = i => [src.getX(i), src.getY(i), src.getZ(i)];
      for (let i = 0; i < src.count; i += 3) {
        const nz = srcNormal.getZ(i), category = Math.abs(nz) > .999 ? Math.sign(nz) : 0;
        // A fine bevel or five-pixel crown lamella does not need the same
        // tessellation as the principal breastplate. Preserve major curvature.
        const subdivisions = category === 0 ? 1 : ((maxX - minX) * (maxY - minY) >= .11 ? 2 : 1);
        divide(read(i), read(i + 1), read(i + 2), subdivisions, category);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices); g.computeVertexNormals(); original.dispose();
      return g;
    };
    const shellMapper = (rings, offset = .005, center = [0, 0, 0]) => (theta, y, d) => {
      const [rx, rz, oz] = profileAt(rings, y);
      return [center[0] + Math.sin(theta) * (rx + offset + d), center[1] + y, center[2] + Math.cos(theta) * (rz + offset + d) + oz];
    };
    const patch = (points, mapper, material, name, depth = .011, bevel = .002, parent = body) => add(curvedGeometry(points, mapper, depth, bevel), material, name, [0, 0, 0], parent);
    const edgeLine = (points, mapper, material, name, radius = .0016, parent = body) => {
      const rounded = points.map(([x, y]) => mapper(x, y, .001));
      return tube(rounded, radius, material, name, parent, 6);
    };
    const fasteners = (points, mapper, name, parent = body) => points.forEach(([theta, y], i) => {
      const p = mapper(theta, y, .014), mesh = bolt(p, name + '_' + i, 'z', parent);
      mesh.rotation.y = theta;
    });
    const strut = (from, to, radius, material, name, parent = body) => {
      const a = V(...from), b = V(...to), vector = b.clone().sub(a);
      const mesh = cylinder(radius, vector.length(), material, name, a.clone().add(b).multiplyScalar(.5).toArray(), 'y', parent);
      mesh.quaternion.setFromUnitVectors(V(0, 1, 0), vector.normalize());
      return mesh;
    };
    const hydraulic = (from, to, radius, name) => {
      const a = V(...from), b = V(...to), p = a.clone().lerp(b, .62);
      strut(a.toArray(), p.toArray(), radius, materials.graphite, name + '_barrel');
      strut(a.clone().lerp(b, .43).toArray(), b.toArray(), radius * .57, materials.chrome, name + '_polished_piston');
      const direction = b.clone().sub(a).normalize();
      for (const f of [.04, .56, .66, .96]) {
        const mesh = ring(radius * 1.15, radius * .57, radius * .4, materials.silver, name + '_seal_' + f, a.clone().lerp(b, f).toArray());
        mesh.quaternion.setFromUnitVectors(V(0, 1, 0), direction);
      }
    };
    const bearing = (p, radius, name, side = 1, axis = 'x') => {
      ring(radius, radius * .62, .026, materials.graphite, name + '_housing', p, axis);
      ring(radius * .80, radius * .52, .030, materials.chrome, name + '_race', p, axis);
      cylinder(radius * .52, .032, materials.black, name + '_recess', p, axis);
      ring(radius * .46, radius * .32, .035, materials.brass, name + '_inner_retainer', p, axis);
      cylinder(radius * .30, .036, materials.gunmetal, name + '_hub', p, axis);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, pp = p.slice();
        if (axis === 'x') { pp[0] += side * .02; pp[1] += Math.sin(a) * radius * .81; pp[2] += Math.cos(a) * radius * .81; }
        else { pp[0] += Math.sin(a) * radius * .81; pp[1] += Math.cos(a) * radius * .81; pp[2] += .02; }
        bolt(pp, name + '_retaining_socket_' + i, axis, body, radius * .065);
      }
    };

    // Torso silhouette: broad shoulders, narrow waist, quilted pressure garment.
    const torso = [[1.13, .151, .105], [1.28, .184, .127], [1.44, .250, .155], [1.63, .264, .143], [1.73, .218, .115], [1.79, .100, .076]];
    add(loft(torso, 80, 12, .0065), materials.fabric, 'Torso_Woven_Pressure_Garment');
    const torsoMap = shellMapper(torso, .010);
    patch([[-.79, 1.652], [-.42, 1.69], [.06, 1.677], [.72, 1.646], [.93, 1.544], [.69, 1.466], [.29, 1.451], [.20, 1.386], [-.19, 1.389], [-.32, 1.436], [-.66, 1.449], [-.91, 1.516]], torsoMap, materials.graphite, 'Breastplate_Recessed_Continuous_Underframe', .023, .004);
    const breastPanels = [
      // The concept has one diagonally cut principal breastplate. The smaller
      // lamellae continue below it instead of forming a uniform jigsaw grid.
      [[-.89, 1.620], [-.63, 1.669], [-.31, 1.695], [.03, 1.645], [.45, 1.625], [.67, 1.583], [.60, 1.477], [-.71, 1.515], [-.91, 1.564]],
      [[-.70, 1.503], [-.36, 1.490], [-.16, 1.469], [-.19, 1.421], [-.38, 1.428], [-.64, 1.453]],
      [[-.10, 1.474], [.18, 1.474], [.35, 1.458], [.22, 1.42], [.10, 1.385], [-.09, 1.396], [-.16, 1.423]],
      [[.39, 1.463], [.62, 1.466], [.80, 1.437], [.73, 1.381], [.48, 1.342], [.28, 1.387]],
    ];
    breastPanels.forEach((p, i) => {
      patch(p, shellMapper(torso, .035 + (i === 3 ? .007 : 0)), i === 3 ? materials.silver : materials.silverLight, 'Breastplate_Asymmetric_Principal_And_Lower_Lamella_' + i, .013, .0023);
      fasteners([p[1], p[p.length - 2]].map(([t, y]) => [t * .97, y + .005]), shellMapper(torso, .044 + (i === 3 ? .007 : 0)), 'Breastplate_Recessed_Panel_Fixing_' + i);
    });
    patch([[-.75, 1.64], [-.57, 1.677], [-.33, 1.687], [-.13, 1.65], [-.27, 1.628], [-.57, 1.626]], shellMapper(torso, .050), materials.silver, 'Breastplate_Raised_Left_Upper_Oblique_Plane', .007, .0015);
    patch([[-.64, 1.615], [-.50, 1.632], [-.33, 1.619], [-.31, 1.583], [-.50, 1.575], [-.65, 1.590]], shellMapper(torso, .052), materials.gunmetal, 'Breastplate_Inset_Optical_Mounting_Recess', .007, .0015);
    patch([[-.59, 1.602], [-.54, 1.61], [-.40, 1.602], [-.41, 1.588], [-.56, 1.591]], shellMapper(torso, .061), materials.silver, 'Breastplate_Industrial_Mounting_Brace', .005, .0013);
    patch([[.05, 1.581], [.23, 1.60], [.29, 1.571], [.24, 1.549], [.10, 1.55]], shellMapper(torso, .049), materials.graphite, 'Breastplate_Camera_Anchor_Connection_Panel', .007, .0016);
    for (const side of [-1, 1]) {
      const panels = [
        [[.19, 1.665], [.48, 1.699], [.92, 1.671], [1.04, 1.621], [.73, 1.597], [.54, 1.625]],
        [[.75, 1.592], [1.05, 1.614], [1.16, 1.542], [.97, 1.478], [.72, 1.498]],
        [[.73, 1.479], [1.05, 1.476], [1.17, 1.385], [.83, 1.333], [.63, 1.395]],
        [[.79, 1.326], [1.10, 1.378], [1.32, 1.310], [1.13, 1.225], [.73, 1.260]],
        [[.76, 1.238], [1.06, 1.214], [1.15, 1.153], [.82, 1.150], [.63, 1.191]],
      ];
      panels.forEach((p, i) => {
        const pts = p.map(([t, y]) => [side * t, y]);
        patch(pts, shellMapper(torso, .011 + (i === 0 ? .019 : .006)), i === 2 ? materials.gunmetal : materials.silver, 'Thoracic_Fitted_Lamella_' + side + '_' + i, .012, .0025);
        fasteners([pts[0], pts[2]].map(([t, y]) => [t * .985, y + .005]), shellMapper(torso, .024), 'Thoracic_Service_Fastener_' + side + '_' + i);
      });
      // Diagonal textile seams continue around the sides, with straps sitting above.
      tube([[side * .035, 1.412, .158], [side * .084, 1.306, .147], [side * .131, 1.224, .117]], .0038, materials.rubber, 'Garment_Reinforced_Seam_' + side);
      for (let seam = 0; seam < 3; seam++) tube([[side * (.047 + seam * .037), 1.393, .155 - seam * .006], [side * (.049 + seam * .042), 1.33, .147 - seam * .006], [side * (.073 + seam * .033), 1.266, .125 - seam * .010]], .0019, materials.fabric, 'Garment_Raised_Quilt_Stitch_' + side + '_' + seam);
      hydraulic([side * .238, 1.46, -.021], [side * .180, 1.23, -.024], .009, 'Thoracic_Lateral_Hydraulic_' + side);
      tube([[side * .244, 1.655, -.078], [side * .258, 1.477, -.097], [side * .216, 1.272, -.065]], .006, materials.rubber, 'Rib_Harness_Protected_Cable_' + side);
    }
    // Original markings are small, functional manufacturing details, not fake specs.
    box(.041, .004, .003, materials.graphite, 'Chest_Recessed_Registration_Slit', [-.106, 1.562, .205], body, [0, -.2, .15]);
    box(.023, .003, .003, materials.graphite, 'Chest_Offset_Registration_Slit', [-.112, 1.55, .205], body, [0, -.2, .15]);
    for (let i = 0; i < 3; i++) box(.004, .023, .003, materials.black, 'Breastplate_Vent_Slot_' + i, [-.032 + i * .009, 1.443, .205], body, null, .0005);
    box(.024, .020, .006, materials.black, 'Chest_Protocol_Plaque', [0, 1.658, .184]);
    box(.003, .012, .002, materials.lime, 'Chest_Protocol_Signal', [0, 1.658, .192], body, null, .0003);

    // Collar wraps the neck with several overlapping curved armour sections.
    const collar = [[1.737, .118, .083], [1.775, .139, .102], [1.822, .125, .091], [1.85, .105, .076]];
    add(loft([[1.74, .09, .075], [1.79, .093, .078], [1.862, .087, .073]], 48, 4), materials.rubber, 'Neck_Continuous_Pressure_Seal');
    for (let i = 0; i < 7; i++) ring(.092, .079, .0045, materials.graphite, 'Neck_Flexible_Seal_Rib_' + i, [0, 1.776 + i * .011, 0]);
    add(loft(collar, 64, 4), materials.rubber, 'Collar_Recessed_Pressure_Gasket');
    for (const side of [-1, 1]) {
      patch([[side * .13, 1.755], [side * .43, 1.795], [side * .98, 1.829], [side * 1.34, 1.823], [side * 1.44, 1.782], [side * 1.14, 1.75], [side * .41, 1.733]], shellMapper(collar, .007), materials.silverLight, 'Collar_Swept_Asymmetric_Front_Gorget_' + side, .012, .0025);
      patch([[side * 1.46, 1.778], [side * 1.56, 1.821], [side * 2.04, 1.83], [side * 2.39, 1.786], [side * 2.12, 1.744], [side * 1.59, 1.746]], shellMapper(collar, .009), materials.silver, 'Collar_Independent_Rear_Protection_' + side, .010, .002);
      patch([[side * .73, 1.788], [side * .90, 1.807], [side * 1.21, 1.805], [side * 1.29, 1.78], [side * 1.00, 1.768]], shellMapper(collar, .020), materials.graphite, 'Collar_Recessed_Lateral_Recording_Mount_' + side, .006, .0014);
      cylinder(.008, .003, materials.gunmetal, 'Collar_Flat_Recessed_Service_Latch_' + side, [side * .127, 1.793, .071], 'z', body, 6);
      cylinder(.0036, .0033, materials.black, 'Collar_Latch_Hex_Socket_' + side, [side * .127, 1.793, .073], 'z', body, 6);
      patch([[side * .35, 1.69], [side * .60, 1.724], [side * 1.11, 1.712], [side * 1.30, 1.687], [side * 1.08, 1.65], [side * .56, 1.657]], shellMapper(torso, .025), materials.gunmetal, 'Clavicle_Continuous_Collar_Support_' + side, .012, .002);
      for (let i = 0; i < 3; i++) box(.018, .009, .014, materials.graphite, 'Collar_Protected_Data_Connection_' + side + '_' + i, [side * (.101 + i * .012), 1.750 - i * .009, .081]);
      patch([[side * 1.32, 1.773], [side * 1.46, 1.816], [side * 1.81, 1.838], [side * 2.10, 1.802], [side * 1.92, 1.775], [side * 1.56, 1.745]], shellMapper(collar, .023), materials.gunmetal, 'Collar_Oblique_Interleaved_Side_Shim_' + side, .007, .0018);
      const highNeck = [[1.787, .12, .089], [1.827, .112, .086], [1.874, .093, .073]];
      patch([[side * .68, 1.812], [side * .93, 1.85], [side * 1.40, 1.868], [side * 1.71, 1.84], [side * 1.42, 1.81], [side * .96, 1.787]], shellMapper(highNeck, .010), materials.silver, 'Gorget_Raised_Oblique_Neck_Shield_' + side, .010, .0018);
    }
    patch([[-.21, 1.745], [.19, 1.749], [.18, 1.79], [.07, 1.803], [-.13, 1.797], [-.24, 1.77]], shellMapper(collar, .008), materials.gunmetal, 'Collar_Small_Central_Release_Guard', .009, .0018);

    // High resolution curved head: dome tessellation, separate bevelled crown
    // panels, real recessed side hardware and one uninterrupted panoramic visor.
    const head = [[1.864, .062, .074, .001], [1.902, .090, .109], [1.98, .137, .148], [2.07, .153, .149], [2.125, .139, .128, -.002], [2.165, .106, .094, -.008], [2.19, .032, .038, -.007]];
    add(loft(head, 96, 7), materials.graphite, 'Helmet_Unified_Organic_Inner_Chassis');
    const headMap = shellMapper(head, .009);
    const crownParts = [
      [[-.34, 2.12], [-.18, 2.16], [.22, 2.17], [.38, 2.12], [.29, 2.096], [-.28, 2.10]],
      [[-.95, 2.104], [-.71, 2.158], [-.31, 2.174], [-.35, 2.129], [-.51, 2.096], [-.89, 2.073]],
      [[.34, 2.13], [.35, 2.174], [.78, 2.155], [1.04, 2.112], [.88, 2.072], [.60, 2.097]],
      [[-1.65, 2.022], [-1.52, 2.103], [-1.06, 2.135], [-.98, 2.11], [-1.18, 2.062], [-1.36, 2.018]],
      [[1.02, 2.106], [1.20, 2.14], [1.66, 2.098], [1.80, 2.037], [1.49, 2.016], [1.25, 2.063]],
      [[1.73, 2.019], [1.84, 2.112], [2.35, 2.145], [2.54, 2.075], [2.42, 2.008]],
      [[-2.45, 2.015], [-2.58, 2.077], [-2.38, 2.145], [-1.92, 2.123], [-1.76, 2.025]],
      [[2.48, 2.029], [2.51, 2.14], [3.13, 2.178], [3.75, 2.14], [3.78, 2.03], [3.27, 2.006], [2.93, 2.011]],
    ];
    crownParts.forEach((p, i) => {
      patch(p, headMap, i === 6 ? materials.gunmetal : materials.silverLight, 'Helmet_Curved_Individual_Crown_Panel_' + i, .010, .0022);
      fasteners([p[0], p[p.length - 2]].map(([t, y]) => [t, y + .005]), shellMapper(head, .018), 'Helmet_Crown_Recessed_Fixing_' + i);
      edgeLine([...p, p[0]], shellMapper(head, .020), materials.gunmetal, 'Helmet_Crown_Individual_Edge_Recess_' + i, .00065);
    });
    const browPanels = [
      [[-.20, 2.147], [-.12, 2.176], [.14, 2.177], [.25, 2.149], [.13, 2.132], [-.10, 2.137]],
      [[-.93, 2.086], [-.70, 2.129], [-.39, 2.142], [-.28, 2.114], [-.51, 2.089], [-.72, 2.071]],
      [[.34, 2.111], [.49, 2.142], [.81, 2.117], [1.01, 2.080], [.83, 2.059], [.63, 2.091]],
      [[-1.51, 2.026], [-1.46, 2.088], [-1.07, 2.107], [-.98, 2.078], [-1.20, 2.043], [-1.24, 2.018]],
      [[1.08, 2.071], [1.29, 2.100], [1.59, 2.077], [1.65, 2.032], [1.39, 2.018], [1.28, 2.043]],
    ];
    browPanels.forEach((p, i) => {
      patch(p, shellMapper(head, .027), i === 0 ? materials.graphite : materials.silver, 'Helmet_Independent_Brow_Crown_Overlap_' + i, .009, .0018);
      fasteners([p[0], p[3]].map(([a, y]) => [a, y + .005]), shellMapper(head, .036), 'Helmet_Brow_Overlap_Fixing_' + i);
    });
    for (const side of [-1, 1]) {
      patch([[side * .78, 2.105], [side * .92, 2.129], [side * 1.20, 2.108], [side * 1.12, 2.083]], shellMapper(head, .041), materials.graphite, 'Helmet_Recessed_Brow_Equipment_Slot_' + side, .004, .0008);
      patch([[side * .88, 2.108], [side * .97, 2.116], [side * 1.07, 2.104], [side * 1.01, 2.095]], shellMapper(head, .046), materials.lime, 'Helmet_Brow_Small_Caution_Insert_' + side, .002, .0005);
      const layered = [
        [[1.24, 2.077], [1.44, 2.092], [1.67, 2.067], [1.76, 2.021], [1.57, 2.003], [1.44, 2.041]],
        [[1.77, 2.060], [1.96, 2.086], [2.21, 2.080], [2.28, 2.040], [2.08, 2.021], [1.92, 2.034]],
        [[1.20, 1.978], [1.47, 2.010], [1.70, 1.982], [1.64, 1.953], [1.37, 1.945]],
      ];
      layered.forEach((p, i) => {
        const pts = p.map(([a, y]) => [side * a, y]);
        patch(pts, shellMapper(head, .034 + i * .002), i === 1 ? materials.gunmetal : materials.silver, 'Helmet_Narrow_Layered_Temple_Armour_' + side + '_' + i, .007, .0016);
        edgeLine([...pts, pts[0]], shellMapper(head, .044 + i * .002), materials.graphite, 'Helmet_Layered_Temple_Panel_Edge_' + side + '_' + i, .0006);
        fasteners([pts[0]], shellMapper(head, .043 + i * .002), 'Helmet_Temple_Recessed_Fixing_' + side + '_' + i);
      });
    }
    for (let i = 0; i < 3; i++) {
      const a = 2.62 + i * .35;
      patch([[a, 2.133], [a + .18, 2.16], [a + .28, 2.143], [a + .23, 2.102], [a + .04, 2.11]], shellMapper(head, .029 + i * .003), i === 1 ? materials.silverLight : materials.silver, 'Helmet_Staggered_Dorsal_Crown_Lamella_' + i, .008, .0016);
    }
    box(.026, .013, .024, materials.graphite, 'Helmet_Top_Recording_Link_Recess', [.015, 2.194, -.017], body, [-.08, .10, -.05]);
    box(.012, .003, .007, materials.lime, 'Helmet_Top_Recording_Link_Caution_Insert', [.015, 2.209, -.010], body, [-.08, .10, -.05], .0004);
    const visorPosition = (a, f, d = 0) => {
      const low = 1.888 + Math.pow(Math.abs(Math.sin(a)), 1.23) * .089;
      const high = 2.112 - Math.abs(Math.sin(a)) * .035;
      const y = low + (high - low) * f;
      const bulge = .94 + Math.sin(f * Math.PI) * .065;
      return [Math.sin(a) * (.154 + d) * (.74 + f * .26), y, Math.cos(a) * (.171 + d) * bulge + .005];
    };
    const visorGeometry = (min = -1.25, max = 1.25, low = 0, high = 1, offset = 0, segments = 96) => {
      const p = [], uv = [], index = [], rows = 26;
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= segments; i++) {
        p.push(...visorPosition(min + (max - min) * i / segments, low + (high - low) * j / rows, offset));
        uv.push(i / segments, j / rows);
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) {
        const a = j * (segments + 1) + i, b = a + 1, c = a + segments + 1, d = c + 1;
        index.push(a, b, d, a, d, c);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(index); g.computeVertexNormals(); return g;
    };
    add(visorGeometry(-1.27, 1.27, -.028, 1.033, -.002), materials.black, 'Helmet_Panoramic_Visor_Recessed_Gasket');
    add(visorGeometry(), materials.violet, 'Helmet_Continuous_Curved_Violet_Optical_Visor');
    // Fine optical etching belongs to a second physical glass surface. Keep it
    // restrained so the visor remains a single violet panoramic form.
    for (const a of [-.88, -.37, .22, .74]) {
      const p = [];
      for (let i = 0; i <= 18; i++) p.push(visorPosition(a + Math.sin(i / 18 * Math.PI) * .012, .16 + i / 18 * .66, .0006));
      tube(p, .00024, materials.opticEtching, 'Visor_Laminated_Internal_Vertical_Etch_' + a);
    }
    for (const f of [.27, .66]) {
      const p = [];
      for (let i = 0; i <= 42; i++) p.push(visorPosition(-1.03 + i / 42 * 2.06, f, .0007));
      tube(p, .00022, materials.opticEtching, 'Visor_Laminated_Internal_Horizontal_Etch_' + f);
    }
    for (let i = 0; i < 11; i++) {
      const a = -.85 + i * .16, p = [visorPosition(a, .86, .0008), visorPosition(a, .876 + (i % 3 ? 0 : .009), .0008)];
      tube(p, .00026, materials.opticEtching, 'Visor_Optical_Alignment_MicroTick_' + i);
    }
    for (const [name, f, radius, mat] of [['brow', 1, .0031, materials.chrome], ['jaw', 0, .003, materials.gunmetal]]) {
      const pts = [];
      for (let i = 0; i <= 42; i++) pts.push(visorPosition(-1.25 + 2.5 * i / 42, f, .0008));
      tube(pts, radius, mat, 'Helmet_Panoramic_Visor_' + name + '_Metal_Seal');
    }
    // A very subtle violet perimeter is a physical optical seal, not a HUD decal.
    add(visorGeometry(-1.17, -.92, .50, .85, .0005, 10), materials.violetRim, 'Helmet_Visor_Lateral_Optical_Coating');
    for (const side of [-1, 1]) {
      const jaw = [[.70, 1.93], [.98, 1.973], [1.36, 2.022], [1.47, 1.981], [1.17, 1.914], [.75, 1.877], [.39, 1.887]];
      patch(jaw.map(([a, y]) => [a * side, y]), shellMapper(head, .012), materials.silverLight, 'Helmet_Swept_Lower_Jaw_Panel_' + side, .014, .0023);
      patch([[side * 1.22, 1.949], [side * 1.39, 1.995], [side * 1.82, 1.985], [side * 1.88, 1.935], [side * 1.65, 1.903], [side * 1.42, 1.913]], shellMapper(head, .015), materials.silver, 'Helmet_Rear_Jaw_Floating_Panel_' + side, .013, .0023);
      fasteners([[side * .75, 1.911], [side * 1.38, 1.955]], shellMapper(head, .026), 'Helmet_Jaw_Countersunk_Fixing_' + side);
      bearing([side * .183, 2.031, -.014], .054, 'Helmet_MultiLayer_Acoustic_Sensor_' + side, side);
      ring(.060, .050, .017, materials.silverLight, 'Helmet_Ear_Armoured_Perimeter_' + side, [side * .190, 2.031, -.014], 'x');
      cylinder(.023, .044, materials.gunmetal, 'Helmet_Ear_Central_Receiver_' + side, [side * .190, 2.031, -.014], 'x');
      ring(.015, .011, .047, materials.chrome, 'Helmet_Ear_Receiver_Rim_' + side, [side * .190, 2.031, -.014], 'x');
      cylinder(.0105, .048, materials.black, 'Helmet_Ear_Actual_Receiver_Recess_' + side, [side * .190, 2.031, -.014], 'x');
      ring(.043, .039, .037, materials.graphite, 'Helmet_Ear_Secondary_Recessed_Race_' + side, [side * .186, 2.031, -.014], 'x');
      box(.013, .039, .011, materials.graphite, 'Helmet_Temple_Optical_Sensor_Housing_' + side, [side * .177, 2.074, .055], body, [0, side * Math.PI / 2, .12]);
      for (let marker = 0; marker < 3; marker++) box(.0026, .008, .004, materials.lime, 'Helmet_Temple_Optical_Sensor_Status_' + side + '_' + marker, [side * .191, 2.071 + marker * .010, .057], body, [0, side * Math.PI / 2, .12], .0005);
      tube([[side * .106, 1.904, -.065], [side * .129, 1.870, -.047], [side * .120, 1.834, -.013], [side * .101, 1.818, .045]], .0055, materials.rubber, 'Helmet_Neck_Armoured_Conduit_' + side);
      for (let i = 0; i < 5; i++) box(.032, .004, .006, materials.black, 'Helmet_Rear_Recessed_Vent_' + side + '_' + i, [side * .055, 2.037 - i * .010, -.157], body, [0, Math.PI, side * .18], .0007);
      cylinder(.008, .008, materials.lens, 'Helmet_Brow_Auxiliary_Optic_' + side, [side * .082, 2.126, .119], 'z', body, 24);
      ring(.011, .008, .007, materials.graphite, 'Helmet_Brow_Optical_Recess_Rim_' + side, [side * .082, 2.126, .116], 'z');
    }
    patch([[-.27, 1.857], [.27, 1.857], [.37, 1.881], [.16, 1.891], [-.16, 1.891], [-.37, 1.88]], shellMapper(head, .017), materials.gunmetal, 'Helmet_Central_Compact_Chin_Curved_Latch', .010, .0018);
    patch([[2.57, 1.948], [2.72, 2.004], [3.57, 2.004], [3.72, 1.948], [3.50, 1.889], [2.78, 1.890]], shellMapper(head, .012), materials.silver, 'Helmet_Occipital_Armoured_Service_Hatch', .012, .0023);

    // Articulated shoulder shells use asymmetric fitted curved segments, rather
    // than the former big vertical shield plates. Woven folds remain visible.
    for (const side of [-1, 1]) {
      const armCenter = [side * .330, 1.638, 0];
      bearing([side * .295, 1.674, 0], .069, 'Shoulder_Inner_Articulation_' + side, side);
      const shoulder = [[-.137, .060, .058], [-.094, .091, .079], [-.024, .110, .090], [.064, .090, .082], [.107, .047, .054]];
      add(loft(shoulder, 56, 4, .003), materials.fabric, 'Shoulder_Folded_Pressure_Garment_' + side, armCenter);
      const map = shellMapper(shoulder, .007, armCenter);
      const shoulderPanels = [
        [[-.57, .056], [-.24, .104], [.11, .091], [.15, .027], [-.04, -.008], [-.43, .011]],
        [[.22, .091], [.47, .084], [.79, .042], [.83, -.013], [.50, -.045], [.20, -.019]],
        [[.96, .05], [1.41, .049], [1.63, .01], [1.52, -.066], [1.24, -.09], [.91, -.025]],
        [[-.77, .018], [-.56, .025], [-.10, -.028], [.13, -.062], [-.06, -.108], [-.57, -.128], [-.81, -.07]],
        [[.56, -.044], [.92, -.083], [1.28, -.10], [1.58, -.07], [1.54, -.127], [1.00, -.143], [.65, -.111]],
        [[1.77, .035], [2.27, .057], [2.51, .006], [2.41, -.065], [1.97, -.094], [1.69, -.058]],
      ];
      shoulderPanels.forEach((p, i) => {
        const pts = p.map(([t, y]) => [side * t, y]);
        patch(pts, shellMapper(shoulder, .007 + (i >= 3 ? .004 : 0), armCenter), i === 5 ? materials.gunmetal : (i === 3 ? materials.silver : materials.silverLight), 'Shoulder_Interlocking_Oblique_Armour_Plate_' + side + '_' + i, .010, .002);
        fasteners([pts[0], pts[3]].map(([t, y]) => [t, y - .008]), shellMapper(shoulder, .018, armCenter), 'Shoulder_Plate_Fixing_' + side + '_' + i);
        edgeLine([...pts, pts[0]], shellMapper(shoulder, .018, armCenter), materials.graphite, 'Shoulder_Independent_Inset_Edge_' + side + '_' + i, .0007);
      });
      patch([[side * .56, .033], [side * .70, .043], [side * .87, .016], [side * .80, -.006], [side * .62, .008]], shellMapper(shoulder, .026, armCenter), materials.graphite, 'Shoulder_Recessed_Service_Mount_' + side, .007, .0012);
      patch([[side * .65, .024], [side * .70, .026], [side * .77, .013], [side * .72, .007]], shellMapper(shoulder, .035, armCenter), materials.lime, 'Shoulder_Small_Caution_Optical_Insert_' + side, .002, .0004);
      tube([[side * .262, 1.721, -.021], [side * .322, 1.741, -.066], [side * .399, 1.683, -.059]], .008, materials.rubber, 'Shoulder_Cable_Bridge_' + side);
      for (let i = 0; i < 4; i++) box(.010, .019, .018, materials.gunmetal, 'Shoulder_Conduit_Armour_Clip_' + side + '_' + i, [side * (.28 + i * .024), 1.731 - i * .012, -.055]);
      const upper = [[1.326, .050, .050], [1.389, .061, .059], [1.50, .074, .069], [1.563, .073, .065]];
      const upC = [side * .372, 0, -.001];
      add(loft(upper, 48, 5, .004), materials.fabric, 'UpperArm_Woven_Garment_' + side, upC);
      const upMap = shellMapper(upper, .006, upC);
      patch([[side * -.50, 1.537], [side * .09, 1.55], [side * .47, 1.515], [side * .39, 1.47], [side * -.08, 1.456], [side * -.44, 1.480]], upMap, materials.silver, 'UpperArm_Separate_Upper_Fitted_Armour_' + side, .011, .002);
      patch([[side * -.39, 1.46], [side * .05, 1.441], [side * .48, 1.474], [side * .54, 1.406], [side * .30, 1.355], [side * -.26, 1.374], [side * -.50, 1.414]], upMap, materials.silverLight, 'UpperArm_Separate_Lower_Fitted_Armour_' + side, .010, .002);
      patch([[side * .84, 1.51], [side * 1.45, 1.50], [side * 1.52, 1.398], [side * 1.18, 1.376], [side * .82, 1.412]], upMap, materials.gunmetal, 'UpperArm_Outer_Articulated_Rail_' + side, .010, .002);
      patch([[side * .04, 1.488], [side * .13, 1.497], [side * .25, 1.473], [side * .19, 1.459], [side * .05, 1.470]], shellMapper(upper, .024, upC), materials.graphite, 'UpperArm_Recessed_Lateral_Anchor_' + side, .005, .001);
      for (const y of [1.508, 1.411]) fasteners([[side * -.19, y], [side * .24, y - .008]], shellMapper(upper, .022, upC), 'UpperArm_Recessed_Fixing_' + side + '_' + y);
      ring(.060, .052, .021, materials.graphite, 'UpperArm_Articulation_Seal_' + side, [side * .372, 1.378, -.001]);
      hydraulic([side * .443, 1.512, -.047], [side * .460, 1.286, -.032], .010, 'Arm_Outer_Extension_Hydraulic_' + side);
      bearing([side * .390, 1.303, .003], .048, 'Elbow_MultiRace_Articulation_' + side, side);
      const forearm = [[1.01, .037, .035], [1.08, .048, .047], [1.202, .071, .060], [1.264, .058, .050]];
      const foreC = [side * .410, 0, .052];
      add(loft(forearm, 48, 5, .003), materials.fabric, 'Forearm_Contoured_Pressure_Sleeve_' + side, foreC);
      const foreMap = shellMapper(forearm, .007, foreC);
      const forePanels = [
        [[-.62, 1.25], [.12, 1.264], [.66, 1.213], [.55, 1.149], [.17, 1.13], [-.43, 1.156]],
        [[-.46, 1.143], [.25, 1.146], [.58, 1.113], [.45, 1.05], [-.30, 1.028], [-.54, 1.08]],
        [[.76, 1.21], [1.46, 1.236], [1.66, 1.154], [1.20, 1.081], [.66, 1.11]],
      ];
      forePanels.forEach((p, i) => patch(p.map(([t, y]) => [t * side, y]), foreMap, i === 2 ? materials.gunmetal : materials.silverLight, 'Forearm_Segmented_Fitted_Plate_' + side + '_' + i, .012, .002));
      ring(.043, .033, .018, materials.graphite, 'Wrist_Articulation_Seal_' + side, [side * .410, 1.015, .052]);
      ring(.039, .031, .008, materials.chrome, 'Wrist_Polished_Bearing_Rim_' + side, [side * .410, 1.001, .052]);
      box(.026, .066, .015, materials.graphite, 'Forearm_Control_Recess_' + side, [side * .410, 1.181, .124], body, [-.08, 0, 0]);
      box(.003, .024, .004, materials.lime, 'Forearm_Control_Optical_Marker_' + side, [side * .415, 1.19, .143], body, null, .0004);
      tube([[side * .394, 1.273, -.018], [side * .431, 1.18, -.014], [side * .428, 1.042, .008]], .0045, materials.rubber, 'Forearm_Protected_Cable_' + side);
      // Anatomical mechanical hands: four fingers plus an opposable thumb.
      const hand = new T.Group(); hand.name = 'Recorder_Segmented_Hand_' + side;
      hand.position.set(side * .411, .953, .064); hand.rotation.set(-.07, -side * .12, -side * .04); body.add(hand);
      add(loft([[-.045, .025, .022], [-.026, .042, .028], [.018, .044, .026], [.042, .032, .022]], 32, 3, .001), materials.rubber, 'Hand_Palm_Glove_' + side, [0, 0, 0], hand);
      flat([[-.032, -.033], [.028, -.037], [.040, -.007], [.032, .028], [-.024, .031], [-.040, .005]], .006, materials.graphite, 'Hand_Fitted_Dorsal_Armour_' + side, [0, 0, .026], hand, null, .0015);
      for (let f = 0; f < 4; f++) {
        const digit = new T.Group(); digit.position.set((f - 1.5) * .021, -.044, .002); digit.rotation.x = -.19 - f * .018; hand.add(digit);
        const length = [.069, .081, .077, .059][f];
        add(loft([[-length, .0058, .0065], [-length * .85, .0084, .0083], [-length * .56, .0091, .0088], [-length * .46, .0074, .0075], [-length * .11, .010, .010], [0, .008, .008]], 16, 3), materials.rubber, 'Finger_Segmented_Seal_' + side + '_' + f, [0, 0, 0], digit);
        for (let j = 0; j < 3; j++) {
          box(.0145 - j * .001, length * .21, .004, j === 0 ? materials.graphite : materials.rubber, 'Finger_Individual_Phalanx_' + side + '_' + f + '_' + j, [0, -length * (.16 + j * .29), .0075], digit, [-j * .08, 0, 0], .001);
          cylinder(.0073 - j * .0006, .016, materials.graphite, 'Finger_Actual_Hinge_' + side + '_' + f + '_' + j, [0, -length * (.30 + j * .27), .001], 'x', digit, 14);
        }
      }
      const thumb = new T.Group(); thumb.position.set(-side * .039, -.008, .015); thumb.rotation.z = -side * .57; thumb.rotation.x = -.27; hand.add(thumb);
      add(loft([[-.058, .007, .008], [-.041, .010, .01], [-.024, .012, .012], [0, .011, .01]], 20, 3), materials.rubber, 'Thumb_Seal_' + side, [0, 0, 0], thumb);
      box(.017, .024, .008, materials.gunmetal, 'Thumb_Proximal_Armour_' + side, [0, -.017, .012], thumb);
      box(.013, .019, .006, materials.graphite, 'Thumb_Distal_Armour_' + side, [0, -.044, .009], thumb, [-.14, 0, 0]);
    }

    // Tactical waist and flexible pelvic armour retain the fitted human silhouette.
    const pelvis = [[1.009, .166, .108], [1.075, .191, .125], [1.15, .170, .114]];
    add(loft(pelvis, 56, 4, .003), materials.fabric, 'Pelvis_Flexible_Woven_Pressure_Garment');
    const belt = [[1.132, .165, .112], [1.175, .159, .110], [1.20, .165, .115]];
    add(loft(belt, 64, 3), materials.black, 'Waist_Continuous_Load_Belt');
    for (let i = 0; i < 8; i++) {
      const a = (i + .5) / 8 * Math.PI * 2;
      patch([[a - .16, 1.139], [a + .16, 1.139], [a + .17, 1.187], [a - .17, 1.187]], shellMapper(belt, .005), i % 3 ? materials.gunmetal : materials.silver, 'Belt_Articulated_Armoured_Link_' + i, .010, .0015);
    }
    box(.118, .058, .025, materials.graphite, 'Waist_Large_Photographer_QuickRelease', [0, 1.165, .136]);
    box(.077, .040, .008, materials.gunmetal, 'Waist_Recessed_Release_Guard', [0, 1.165, .164]);
    box(.046, .004, .005, materials.lime, 'Waist_Buckle_Caution_Insert', [0, 1.17, .176], body, null, .0004);
    for (const x of [-.045, .045]) bolt([x, 1.166, .176], 'Buckle_Service_Fixing_' + x);
    patch([[-.44, 1.103], [.43, 1.103], [.43, 1.063], [.14, 1.009], [-.13, 1.009], [-.46, 1.06]], shellMapper(pelvis, .011), materials.gunmetal, 'Pelvic_Small_Flexible_Central_Protector', .010, .002);
    for (const side of [-1, 1]) {
      patch([[side * .53, 1.139], [side * 1.06, 1.148], [side * 1.31, 1.083], [side * 1.00, 1.009], [side * .57, 1.035]], shellMapper(pelvis, .007), materials.silver, 'Hip_Fitted_Tactical_Tasset_' + side, .012, .002);
      box(.049, .070, .029, materials.graphite, 'Belt_Lateral_Utility_Box_' + side, [side * .189, 1.155, -.007], body, [0, side * Math.PI / 2, 0]);
      box(.025, .037, .008, materials.silver, 'Belt_Utility_Box_Service_Lid_' + side, [side * .228, 1.153, -.006], body, [0, side * Math.PI / 2, 0]);
    }
    flat([[-.009, .011], [.012, .008], [.001, -.012]], .0015, materials.lime, 'Original_Abdominal_Caution_Registration_Triangle', [.191, 1.28, .095], body, [0, .52, .20], .0005);
    flat([[-.003, .004], [.004, .003], [0, -.004]], .0018, materials.graphite, 'Original_Abdominal_Caution_Triangle_Inset', [.191, 1.28, .098], body, [0, .52, .20], .0002);

    // Legs are fully designed, including back-side tendons, hydraulic knees and
    // ankle bearings. Smooth wraparound armour follows the tapered pressure suit.
    for (const side of [-1, 1]) {
      const thigh = [[.628, .054, .056], [.710, .071, .067], [.892, .092, .089], [1.035, .088, .092]];
      const center = [side * .153, 0, .005];
      add(loft(thigh, 56, 5, .003), materials.fabric, 'Thigh_Anatomical_Pressure_Garment_' + side, center);
      const map = shellMapper(thigh, .009, center);
      const panels = [
        [[-.75, 1.007], [.10, 1.016], [.67, .953], [.62, .846], [.25, .817], [-.55, .842]],
        [[-.57, .824], [.24, .810], [.65, .838], [.65, .735], [.28, .658], [-.33, .675], [-.60, .742]],
        [[.79, .945], [1.42, .965], [1.55, .814], [1.26, .732], [.73, .759]],
      ];
      panels.forEach((p, i) => patch(p.map(([a, y]) => [a * side, y]), map, i === 2 ? materials.gunmetal : materials.silver, 'Thigh_Fitted_Overlapping_Armour_' + side + '_' + i, .012, .002));
      tube([[side * .233, 1.021, -.054], [side * .255, .862, -.061], [side * .224, .676, -.053]], .005, materials.rubber, 'Thigh_Rear_Protected_Conduit_' + side);
      bearing([side * .158, .601, .011], .054, 'Knee_Polished_MultiRace_Hinge_' + side, side);
      flat([[-.046, .034], [-.019, .054], [.025, .054], [.051, .027], [.039, -.025], [0, -.051], [-.038, -.029]], .018, materials.graphite, 'Knee_Recessed_Protective_Frame_' + side, [side * .158, .603, .063], body, [.07, 0, 0], .004);
      flat([[-.037, .027], [-.012, .043], [.018, .044], [.041, .022], [.032, -.025], [0, -.040], [-.03, -.021]], .014, materials.silverLight, 'Knee_Fitted_Floating_Protector_' + side, [side * .158, .604, .083], body, [.07, 0, 0], .003);
      hydraulic([side * .197, .737, -.039], [side * .211, .485, -.045], .008, 'Knee_Lateral_Extension_Hydraulic_' + side);
      const shin = [[.162, .038, .040], [.241, .049, .052], [.402, .065, .067], [.536, .063, .067], [.565, .055, .060]];
      const shinC = [side * .160, 0, -.005];
      add(loft(shin, 56, 5, .0025), materials.fabric, 'LowerLeg_Flexible_Pressure_Sleeve_' + side, shinC);
      const shinMap = shellMapper(shin, .008, shinC);
      patch([[-.60, .545], [.27, .559], [.70, .499], [.62, .381], [.22, .345], [-.43, .365], [-.67, .456]].map(([a, y]) => [a * side, y]), shinMap, materials.silver, 'Shin_Fitted_Upper_Wrap_Plate_' + side, .013, .0025);
      patch([[-.44, .357], [.24, .347], [.56, .372], [.47, .229], [.27, .176], [-.27, .181], [-.47, .256]].map(([a, y]) => [a * side, y]), shinMap, materials.silverLight, 'Shin_Tapered_Lower_Floating_Plate_' + side, .011, .002);
      patch([[side * .78, .491], [side * 1.50, .496], [side * 1.57, .309], [side * 1.01, .230], [side * .68, .313]], shinMap, materials.gunmetal, 'Shin_Lateral_Mechanical_Service_Cover_' + side, .010, .002);
      tube([[side * .18, .554, -.058], [side * .192, .39, -.074], [side * .180, .208, -.054]], .007, materials.rubber, 'Calf_Rear_Protected_Flex_Tendon_' + side);
      for (let i = 0; i < 4; i++) box(.027, .008, .015, materials.graphite, 'Calf_Rear_Tendon_Armour_Clip_' + side + '_' + i, [side * .18, .478 - i * .062, -.078], body, [0, Math.PI, 0]);
      bearing([side * .16, .158, .008], .032, 'Ankle_Articulated_Bearing_' + side, side);
      const boot = [[.018, .075, .145, .053], [.039, .077, .147, .053], [.072, .074, .137, .051], [.10, .064, .098, .026], [.148, .039, .044, -.002]];
      add(loft(boot, 56, 4), materials.rubber, 'Boot_Anatomical_Rocker_Sole_' + side, [side * .16, 0, 0]);
      add(loft([[.052, .069, .12, .058], [.084, .068, .119, .052], [.117, .049, .078, .017], [.149, .036, .042, -.003]], 48, 4), materials.gunmetal, 'Boot_Continuous_Fitted_Upper_' + side, [side * .16, 0, 0]);
      flat([[-.050, -.009], [.050, -.009], [.061, .006], [.046, .025], [-.037, .025], [-.058, .009]], .013, materials.silver, 'Boot_Swept_Armoured_Toe_Cap_' + side, [side * .16, .069, .169], body, [-.26, 0, 0], .0025);
      for (let i = 0; i < 6; i++) box(.105, .006, .012, materials.black, 'Boot_Functional_Sole_Tread_' + side + '_' + i, [side * .16, .028, -.056 + i * .039], body, [Math.PI / 2, 0, 0], .0006);
      for (let i = 0; i < 3; i++) box(.044, .008, .010, materials.graphite, 'Boot_Segmented_Instep_Link_' + side + '_' + i, [side * .16, .115 - i * .009, .091 + i * .022], body, [-.45, 0, 0], .001);
    }

    // The original concept's photographic identity is kept in a detailed chest
    // recorder: focus teeth, optical glass, guarded chassis, socket and cable.
    const recorder = new T.Group(); recorder.name = 'Recorder_Chest_Photographic_Unit';
    recorder.position.set(.166, 1.622, .194); recorder.rotation.set(-.07, .10, .12); body.add(recorder);
    box(.109, .088, .042, materials.graphite, 'Camera_Recessed_Protected_Main_Chassis', [0, 0, 0], recorder, null, .0035);
    box(.097, .079, .009, materials.gunmetal, 'Camera_Replaceable_Front_Guard', [0, 0, .044], recorder, null, .002);
    box(.025, .090, .049, materials.silver, 'Camera_Armoured_Side_Grip', [.057, 0, -.005], recorder, null, .002);
    cylinder(.030, .035, materials.black, 'Camera_Large_Optical_Barrel', [-.013, .004, .064], 'z', recorder, 48);
    ring(.031, .025, .018, materials.gunmetal, 'Camera_Focus_Collar', [-.013, .004, .081], 'z', recorder);
    ring(.026, .020, .010, materials.chrome, 'Camera_Polished_Optical_Seal', [-.013, .004, .094], 'z', recorder);
    cylinder(.020, .003, materials.lens, 'Camera_Actual_Violet_Optical_Element', [-.013, .004, .102], 'z', recorder, 56);
    ring(.013, .010, .0025, materials.violetRim, 'Camera_Inner_Optical_Coating_Ring', [-.013, .004, .104], 'z', recorder, 40);
    cylinder(.008, .002, materials.lens, 'Camera_Recessed_Inner_Optical_Element', [-.013, .004, .105], 'z', recorder, 40);
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      box(.003, .012, .004, materials.graphite, 'Camera_Focus_Ring_Grip_Tooth_' + i, [-.013 + Math.sin(a) * .031, .004 + Math.cos(a) * .031, .074], recorder, [0, 0, -a], .0004);
    }
    tube([[-.052, -.042, .035], [-.065, -.031, .053], [-.065, .036, .053], [-.052, .047, .035]], .0035, materials.black, 'Camera_Left_Protective_Cage', recorder);
    tube([[.048, -.043, .034], [.067, -.03, .05], [.067, .036, .05], [.048, .046, .034]], .0035, materials.black, 'Camera_Right_Protective_Cage', recorder);
    box(.008, .019, .0035, materials.lime, 'Camera_Recording_Status_Indicator', [.035, .010, .057], recorder, null, .0006);
    cylinder(.0048, .005, materials.black, 'Camera_Release_Control', [.034, -.025, .058], 'z', recorder, 20);
    for (const [x, y] of [[-.041, -.029], [.041, -.029], [-.041, .030], [.041, .030]]) bolt([x, y, .056], 'Camera_Captive_Chassis_Fastener_' + x + '_' + y, 'z', recorder, .0023);
    for (let i = 0; i < 4; i++) box(.004, .026, .006, materials.black, 'Camera_Lateral_Cooling_Slot_' + i, [.058 + i * .003, -.009, .035], recorder, null, .0004);
    tube([[.212, 1.620, .17], [.258, 1.544, .16], [.221, 1.443, .136], [.192, 1.341, .112]], .0045, materials.rubber, 'Camera_Armoured_Data_Cable');
    // Wide woven camera harness and individual metal buckles follow the shoulders.
    const harnessCurve = [[.228, 1.731, .104], [.209, 1.658, .175], [.157, 1.502, .197], [.083, 1.342, .159], [.019, 1.205, .132]];
    const curve = new T.CatmullRomCurve3(harnessCurve.map(p => V(...p)));
    for (let i = 0; i < 22; i++) {
      const p = curve.getPoint(i / 22), tangent = curve.getTangent(i / 22), piece = box(.037, .027, .006, materials.black, 'Harness_Fitted_Woven_Segment_' + i, p.toArray());
      piece.rotation.z = -Math.atan2(tangent.x, -tangent.y);
    }
    for (const f of [.15, .63]) {
      const p = curve.getPoint(f), tangent = curve.getTangent(f), buckle = new T.Group(); buckle.position.copy(p); buckle.rotation.z = -Math.atan2(tangent.x, -tangent.y); body.add(buckle);
      box(.043, .012, .008, materials.silver, 'Harness_Release_Buckle_Top_' + f, [0, .020, .008], buckle);
      box(.043, .012, .008, materials.silver, 'Harness_Release_Buckle_Bottom_' + f, [0, -.020, .008], buckle);
      for (const side of [-1, 1]) box(.007, .034, .008, materials.gunmetal, 'Harness_Release_Buckle_Rail_' + f + '_' + side, [side * .018, 0, .008], buckle);
      box(.017, .006, .003, materials.lime, 'Harness_Buckle_Release_Marker_' + f, [0, -.020, .018], buckle, null, .0005);
    }

    // Inspectable rear: layered spinal memory pack, cooling fins, cable glands,
    // shoulder storage modules and articulated scapular protection.
    box(.181, .302, .057, materials.graphite, 'Back_Continuous_Memory_Unit_Chassis', [0, 1.492, -.189], body, [0, Math.PI, 0], .004);
    flat([[-.079, .115], [-.042, .149], [.052, .145], [.079, .10], [.075, -.105], [.032, -.141], [-.036, -.139], [-.077, -.10]], .015, materials.silver, 'Back_Fitted_Memory_Unit_Armour', [0, 1.493, -.253], body, [0, Math.PI, 0], .003);
    box(.054, .140, .024, materials.gunmetal, 'Back_Removable_Recording_Archive_Module', [0, 1.523, -.277], body, [0, Math.PI, 0], .003);
    for (let i = 0; i < 9; i++) box(.054, .006, .013, materials.black, 'Back_Exposed_Memory_HeatExchanger_Fin_' + i, [0, 1.556 - i * .012, -.306], body, [0, Math.PI, 0], .0006);
    box(.030, .004, .004, materials.lime, 'Back_Memory_Module_Status_Insert', [0, 1.60, -.307], body, [0, Math.PI, 0], .0005);
    for (const side of [-1, 1]) {
      patch([[side * 2.05, 1.64], [side * 2.60, 1.696], [side * 2.77, 1.62], [side * 2.55, 1.514], [side * 2.07, 1.516]], shellMapper(torso, .014), materials.silver, 'Back_Articulated_Scapular_Panel_' + side, .014, .0025);
      box(.042, .114, .055, materials.graphite, 'Back_Shoulder_Storage_Module_' + side, [side * .176, 1.677, -.142], body, [0, Math.PI, -side * .05], .003);
      box(.036, .092, .013, materials.silver, 'Back_Shoulder_Module_Armoured_Lid_' + side, [side * .176, 1.68, -.21], body, [0, Math.PI, -side * .05]);
      tube([[side * .098, 1.734, -.097], [side * .148, 1.693, -.160], [side * .143, 1.532, -.186], [side * .124, 1.35, -.149]], .007, materials.rubber, 'Back_Protected_Memory_Data_Conduit_' + side);
      hydraulic([side * .13, 1.48, -.16], [side * .101, 1.24, -.112], .008, 'Back_Spine_Support_Hydraulic_' + side);
      ring(.013, .006, .018, materials.gunmetal, 'Back_Cable_Sealed_Gland_' + side, [side * .13, 1.337, -.153], 'z');
    }

    // Add a handful of legible original manufacturing labels. The labels are
    // texture decals on curved/fitted equipment, never a fake character render.
    const makeLabel = (name, text, w, h, position, rotation = [0, 0, 0]) => {
      const labelMap = canvasMap(256, (c, size) => {
        c.clearRect(0, 0, size, size);
        c.fillStyle = '#c3c8d2'; c.font = '600 31px Arial';
        c.fillText(text, 12, 90); c.font = '20px Arial'; c.fillText('HOMECOMING / RECORDER', 12, 126);
        c.fillStyle = '#cde866'; c.fillRect(12, 158, 37, 4);
      }, true);
      labelMap.wrapS = labelMap.wrapT = T.ClampToEdgeWrapping;
      const mat = new T.MeshStandardMaterial({ map: labelMap, transparent: true, depthWrite: false, roughness: .82, metalness: .1, polygonOffset: true, polygonOffsetFactor: -1 });
      materials['label_' + name] = mat;
      const mesh = add(new T.PlaneGeometry(w, h), mat, 'Original_Equipment_Marking_' + name, position, body, rotation);
      mesh.userData.isEquipmentDecal = true;
    };
    makeLabel('camera', 'FIELD RECORDER', .057, .030, [.194, 1.576, .262], [0, .10, .12]);
    makeLabel('forearm', 'OPTICAL UNIT', .039, .044, [.407, 1.124, .124], [-.08, 0, 0]);
    makeLabel('back', 'MEMORY ARCHIVE', .087, .047, [0, 1.412, -.273], [0, Math.PI, 0]);

    // Batch static detail by material and body region. Real geometry is retained;
    // batching changes draw calls, not the shape, normal maps or export quality.
    body.updateMatrixWorld(true);
    const regionOf = mesh => {
      const center = new T.Box3().setFromObject(mesh).getCenter(new T.Vector3());
      if (/^(Helmet_|Visor_)/.test(mesh.name)) return 'helmet';
      if (Math.abs(center.x) > .27 && center.y > .85) return center.x < 0 ? 'left_arm' : 'right_arm';
      if (center.y < 1.06) return center.x < 0 ? 'left_leg' : 'right_leg';
      return center.z < -.11 ? 'back' : 'torso';
    };
    const buckets = new Map(), decals = [], originalGeometries = new Set();
    body.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (mesh.userData.isEquipmentDecal) { decals.push(mesh); return; }
      const key = mesh.material.uuid + ':' + regionOf(mesh);
      if (!buckets.has(key)) buckets.set(key, { name: regionOf(mesh), material: mesh.material, geometries: [], parts: [] });
      const b = buckets.get(key), g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld); b.geometries.push(g); b.parts.push(mesh.name); originalGeometries.add(mesh.geometry);
    });
    const batched = new T.Group(); batched.name = 'Recorder_Static_Detailed_Assemblies';
    const headPose = new T.Group(); headPose.name = 'Recorder_Concept_Natural_Head_Pose';
    headPose.position.y = 1.855; headPose.rotation.set(.055, -.085, -.014); headPose.scale.setScalar(1.08); batched.add(headPose);
    buckets.forEach(bucket => {
      const count = bucket.geometries.reduce((n, g) => n + g.attributes.position.count, 0);
      const merged = new T.BufferGeometry();
      for (const [attribute, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
        const result = new Float32Array(count * size); let offset = 0;
        bucket.geometries.forEach(g => { const a = g.getAttribute(attribute); if (a) result.set(a.array, offset); offset += g.attributes.position.count * size; });
        merged.setAttribute(attribute, new T.BufferAttribute(result, size));
      }
      // Welding identical position/normal/UV tuples restores indices after the
      // material batch, without smoothing deliberate bevels or texture seams.
      const indexed = mergeVertices(merged, 1e-6);
      merged.dispose(); indexed.computeBoundingBox(); indexed.computeBoundingSphere();
      const mesh = new T.Mesh(indexed, bucket.material);
      mesh.name = 'Recorder_Assembly_' + bucket.name + '_' + Object.keys(materials).find(k => materials[k] === bucket.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.fabricatedParts = bucket.parts;
      if (bucket.name === 'helmet') { mesh.position.y = -1.868; headPose.add(mesh); } else batched.add(mesh);
      bucket.geometries.forEach(g => g.dispose());
    });
    decals.forEach(mesh => { mesh.applyMatrix4(mesh.parent.matrixWorld); batched.add(mesh); });
    root.remove(body); root.add(batched); originalGeometries.forEach(g => g.dispose());
    const provenance = {
      modelVersion: 'recorder-concept-refinement-r04',
      title: '归巢协议 · 影像记录者',
      concept: '黄进鸿的原创角色设定；按已确认的银黑装甲与全景紫色面罩概念还原',
      construction: '原创曲面硬表面机体与头盔，AI协作建模与材质制作',
      sources: [],
      fabricationParts,
      reconstruction: 'Concept-faithful panoramic-visor recorder; not a replacement character',
      optimisation: 'Adaptive curved-panel tessellation; static material-region batches with indexed positions, normals and UV seams retained',
    };
    root.userData = { title: provenance.title, provenance, units: 'metres', imageCharacterPlanes: 0, equipmentDecals: decals.length };
    return { root, materials, textures, provenance };
  }
  window.PortfolioProceduralCharacterDetail = { build };
})();
