(() => {
  'use strict';
  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 v_uv;
    uniform sampler2D u_image, u_archive;
    uniform vec2 u_cover, u_archiveCover, u_pointer, u_resolution;
    uniform float u_progress, u_signal, u_time, u_kind, u_archiveMix;
    uniform float u_dolly, u_worldDepth, u_edge, u_scanPhase;
    vec3 sampleImage(vec2 uv) {
      return texture2D(u_image, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
    }
    void main() {
      float signal = clamp(u_signal, 0.0, 1.0);
      float cinema = 1.0 - clamp(u_archiveMix, 0.0, 1.0);
      float zoom = 1.028 + u_progress * mix(0.045, 0.075, u_kind);
      zoom += sin(u_time * 0.35) * 0.0014;
      zoom += cinema * (u_dolly * 0.028 * (1.0 - u_kind) + u_worldDepth * 0.038 * u_kind);
      vec2 uv = (v_uv - 0.5) * u_cover / zoom + 0.5;
      uv += u_pointer * mix(vec2(0.017, 0.012), vec2(0.010, 0.007), u_kind) * u_cover;
      uv.y += u_progress * 0.012 * u_kind;
      // Shallow screen-space layers enhance photographic depth, without a mesh claim.
      vec2 focusPoint = (v_uv - vec2(0.58, 0.52)) * vec2(1.15, 1.35);
      float subject = exp(-dot(focusPoint, focusPoint) * 6.0);
      float foreground = 1.0 - smoothstep(0.10, 0.54, v_uv.y);
      float nearLayer = mix(subject, foreground, u_kind);
      uv += u_pointer * u_cover * nearLayer * cinema * mix(vec2(0.007, 0.004), vec2(0.005, 0.003), u_kind);
      uv.y += foreground * u_worldDepth * u_kind * cinema * 0.006;
      // Displacement acts on the image surface; this is not a 3D mesh.
      vec2 delta = v_uv - (vec2(0.5) + u_pointer * 0.25);
      uv += delta * exp(-dot(delta, delta) * 12.0) * length(u_pointer) * 0.003;
      vec3 color = sampleImage(uv);
      // A narrow optical trace follows scroll through the window, never a full-image wash.
      float scanY = mix(-0.08, 1.08, clamp(u_scanPhase, 0.0, 1.0));
      float opticalLine = 1.0 - smoothstep(0.0008, 0.006, abs(v_uv.y - scanY));
      float opticalEnergy = opticalLine * clamp(u_edge, 0.0, 1.0) * cinema;
      if (opticalEnergy > 0.001) {
        vec2 opticalOffset = vec2(0.0009, 0.0) * opticalEnergy;
        color = mix(color, vec3(sampleImage(uv + opticalOffset).r, color.g, sampleImage(uv - opticalOffset).b), opticalEnergy * 0.32);
        color += opticalEnergy * vec3(0.022, 0.018, 0.036);
      }
      if (signal > 0.001) {
        vec2 refraction = vec2(0.0034 + sin(v_uv.y * 25.0 - u_time * 0.7) * 0.0011, 0.0006);
        vec3 optical = vec3(sampleImage(uv + refraction).r, color.g, sampleImage(uv - refraction).b);
        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
        vec3 spectral = mix(vec3(0.18, 0.10, 0.35), vec3(0.86, 0.98, 0.67), luminance);
        float contour = length(sampleImage(uv + vec2(2.0 / u_resolution.x, 0.0)) - color);
        spectral = mix(spectral, optical, 0.48) + contour * vec3(0.25, 0.5, 0.05);
        float scan = 1.0 - smoothstep(0.012, 0.045, abs(fract(v_uv.y + u_time * 0.045) - 0.5));
        spectral += scan * vec3(0.025, 0.050, 0.005);
        color = mix(color, spectral, signal * 0.85);
      }
      // The archive sample bypasses camera, breathing, pointer and signal effects.
      vec2 archiveUv = (v_uv - 0.5) * u_archiveCover + 0.5;
      vec3 archiveColor = texture2D(u_archive, clamp(archiveUv, vec2(0.001), vec2(0.999))).rgb;
      // Select the endpoint directly, avoiding mix rounding tied to the outgoing optics.
      if (u_archiveMix >= 1.0) gl_FragColor = vec4(archiveColor, 1.0);
      else gl_FragColor = vec4(mix(color, archiveColor, u_archiveMix), 1.0);
    }
  `;

  function create(canvas, image, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement) || !(image instanceof HTMLImageElement)) return null;
    const container = canvas.closest('[data-scene]') || canvas.parentElement;
    let gl;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power'
      });
    } catch { return null; }
    if (!gl) return null;
    let program, buffer, texture, archiveTexture, locations;
    let ready = false, destroyed = false, contextLost = false;
    let archiveReady = false;
    let imageWidth = 1, imageHeight = 1, lastWidth = 0, lastHeight = 0;
    let archiveWidth = 1, archiveHeight = 1, lastTime = 0;
    let cover = [1, 1], archiveCover = [1, 1];
    const archiveImage = options.archiveImage;
    const archiveFallback = options.archiveFallback;
    const state = { progress: 0, pointer: [0, 0], signal: 0, archiveMix: 0, dolly: 0, worldDepth: 0, edge: 0, scanPhase: 0, reducedMotion: false };
    const fallback = () => {
      container?.classList.remove('is-webgl-ready');
      if (archiveFallback) {
        archiveFallback.style.display = !state.reducedMotion && state.archiveMix > 0 ? 'block' : 'none';
        archiveFallback.style.opacity = state.archiveMix;
      }
    };

    function shader(type, source) {
      const compiled = gl.createShader(type);
      gl.shaderSource(compiled, source);
      gl.compileShader(compiled);
      if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
        gl.deleteShader(compiled);
        throw new Error('Scene shader compilation failed');
      }
      return compiled;
    }
    function initialize() {
      try {
        const vertex = shader(gl.VERTEX_SHADER, vertexSource);
        const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
        program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Scene shader link failed');
        gl.useProgram(program);
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        locations = {};
        ['image', 'archive', 'cover', 'archiveCover', 'pointer', 'resolution', 'progress', 'signal', 'time', 'kind', 'archiveMix', 'dolly', 'worldDepth', 'edge', 'scanPhase'].forEach(name => {
          locations[name] = gl.getUniformLocation(program, `u_${name}`);
        });
        texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        archiveTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, archiveTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
        if (archiveImage?.complete && archiveImage.naturalWidth) uploadArchive();
        if (image.complete && image.naturalWidth) uploadImage();
      } catch { ready = false; fallback(); }
    }
    function resize(dpr) {
      if (destroyed || contextLost) return;
      const mobile = window.matchMedia('(max-width: 820px)').matches;
      const ratio = Math.min(window.devicePixelRatio || 1, dpr || (mobile ? 1 : 1.5));
      // A portal changes its CSS box every frame. Keep its buffer stable and fit
      // textures to the current CSS aspect instead of reallocating the buffer.
      const width = Math.max(1, Math.round((options.fixedResolution ? innerWidth : canvas.clientWidth) * ratio));
      const height = Math.max(1, Math.round((options.fixedResolution ? innerHeight : canvas.clientHeight) * ratio));
      if (width !== lastWidth || height !== lastHeight) {
        // Resizing clears the drawing buffer. Keep the image visible until the next draw.
        fallback();
        canvas.width = width; canvas.height = height;
        lastWidth = width; lastHeight = height;
        gl.viewport(0, 0, width, height);
      }
      const aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight);
      const imageAspect = imageWidth / imageHeight;
      cover = imageAspect > aspect ? [aspect / imageAspect, 1] : [1, imageAspect / aspect];
      const archiveAspect = archiveWidth / archiveHeight;
      archiveCover = archiveAspect > aspect ? [aspect / archiveAspect, 1] : [1, archiveAspect / aspect];
    }
    function draw(time = 0) {
      if (!canvas.isConnected) { ready = false; fallback(); return false; }
      if (!ready || destroyed || contextLost || state.reducedMotion) {
        if (state.reducedMotion) fallback();
        return false;
      }
      try {
        lastTime = time;
        resize();
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, archiveTexture);
        gl.uniform1i(locations.image, 0);
        gl.uniform1i(locations.archive, 1);
        gl.uniform2f(locations.cover, cover[0], cover[1]);
        gl.uniform2f(locations.archiveCover, archiveCover[0], archiveCover[1]);
        gl.uniform2f(locations.pointer, state.pointer[0], state.pointer[1]);
        gl.uniform2f(locations.resolution, lastWidth, lastHeight);
        gl.uniform1f(locations.progress, state.progress);
        gl.uniform1f(locations.signal, state.signal);
        gl.uniform1f(locations.time, time);
        gl.uniform1f(locations.kind, options.kind === 'world' ? 1 : 0);
        gl.uniform1f(locations.archiveMix, archiveReady ? state.archiveMix : 0);
        gl.uniform1f(locations.dolly, state.dolly);
        gl.uniform1f(locations.worldDepth, state.worldDepth);
        gl.uniform1f(locations.edge, state.edge);
        gl.uniform1f(locations.scanPhase, state.scanPhase);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Scene draw failed');
        container?.classList.add('is-webgl-ready');
        if (archiveFallback) archiveFallback.style.display = 'none';
        return true;
      } catch { ready = false; fallback(); return false; }
    }
    function uploadImage() {
      if (destroyed || contextLost || !program || !image.naturalWidth) return;
      try {
        imageWidth = image.naturalWidth; imageHeight = image.naturalHeight;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Scene texture upload failed');
        ready = true;
        draw(lastTime);
        canvas.dispatchEvent(new Event('scene-ready'));
      } catch { ready = false; fallback(); }
    }
    function uploadArchive() {
      if (destroyed || contextLost || !program || !archiveImage?.naturalWidth) return;
      try {
        archiveWidth = archiveImage.naturalWidth;
        archiveHeight = archiveImage.naturalHeight;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, archiveTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, archiveImage);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Archive texture upload failed');
        archiveReady = true;
        draw(lastTime);
        canvas.dispatchEvent(new Event('scene-ready'));
      } catch { archiveReady = false; }
    }
    const onLoss = event => { event.preventDefault(); contextLost = true; ready = false; fallback(); };
    const onRestore = () => { contextLost = false; lastWidth = lastHeight = 0; initialize(); };
    const onError = () => { ready = false; fallback(); };
    image.addEventListener('load', uploadImage);
    image.addEventListener('error', onError);
    archiveImage?.addEventListener('load', uploadArchive);
    canvas.addEventListener('webglcontextlost', onLoss);
    canvas.addEventListener('webglcontextrestored', onRestore);
    initialize();
    return {
      get ready() { return ready; },
      set(values) {
        Object.assign(state, values);
        if (state.reducedMotion || !container?.classList.contains('is-webgl-ready')) fallback();
      },
      resize, draw,
      destroy() {
        destroyed = true; ready = false; fallback();
        image.removeEventListener('load', uploadImage);
        image.removeEventListener('error', onError);
        archiveImage?.removeEventListener('load', uploadArchive);
        canvas.removeEventListener('webglcontextlost', onLoss);
        canvas.removeEventListener('webglcontextrestored', onRestore);
        if (!contextLost) {
          if (texture) gl.deleteTexture(texture);
          if (archiveTexture) gl.deleteTexture(archiveTexture);
          if (buffer) gl.deleteBuffer(buffer);
          if (program) gl.deleteProgram(program);
        }
      }
    };
  }
  window.PortfolioSceneRenderer = { create };
})();
