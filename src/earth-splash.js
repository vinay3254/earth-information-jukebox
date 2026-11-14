// Cinematic Earth splash shown behind the loader while the observatory loads.
//
// Timeline (seconds): the camera pulls back from the Asian horizon to the full
// globe (0-3.9), orbit rings fade in (2.3-4.3), a hub glows over Shanghai
// (3.7) and network arcs grow out to six destinations (4.1-6.2). After that
// the globe idles until the app is ready.
//
// Drop-in replacement for SpaceDive: `start()`, `stop()`, `boost()`, plus a
// `done` promise that resolves once the opening sequence has played (or the
// viewer skips it). The loader waits on `done` before it fades out.
//
// The splash reuses the Earth textures the main scene loads, so the HTTP cache
// serves them to both. It owns its own small WebGL context and releases it on
// stop(), the same contract SpaceDive had.

import * as THREE from 'three';

const TEXTURE_ROOT = './assets/textures/';
const SEQUENCE_END = 6.2;
const MAX_DPR = 1.5;
const FOV = 30;
const D2R = Math.PI / 180;

const SUN = new THREE.Vector3(-0.3, 0.35, 1.0).normalize();
const FACE = { lat: 30, lon: 85 };
const HUB = { lat: 31.2, lon: 121.5 };
const DESTINATIONS = [
  { lat: 45.5, lon: 26.0, delay: 0.25 },   // Europe
  { lat: 19.0, lon: 73.0, delay: 0.0 },    // India
  { lat: 51.5, lon: 101.0, delay: 0.45 },  // Siberia
  { lat: 66.0, lon: 141.0, delay: 0.15 },  // Far east, north
  { lat: 27.0, lon: 171.0, delay: 0.35 },  // Pacific
  { lat: -33.5, lon: 141.0, delay: 0.05 }  // Australia
];

// Same convention as SphereGeometry UVs: u = lon / 360 + 0.5
function latLon(lat, lon, r = 1) {
  const a = lat * D2R;
  const o = lon * D2R;
  return new THREE.Vector3(Math.cos(a) * Math.cos(o), Math.sin(a), -Math.cos(a) * Math.sin(o)).multiplyScalar(r);
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

const EARTH_VS = /* glsl */ `
  varying vec2 vUv; varying vec3 vObjN; varying vec3 vWorldN; varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vObjN = normalize(position);
    vWorldN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const EARTH_FS = /* glsl */ `
  // Natural "Blue Marble" look: fully sunlit disc, true land colours, blue
  // oceans and white cloud cover, with gentle limb darkening at the edge.
  uniform sampler2D dayMap, nightMap, normalMap, specMap, cloudMap;
  uniform vec3 sunDir; uniform mat3 uNormalMat; uniform float uTime;
  varying vec2 vUv; varying vec3 vObjN; varying vec3 vWorldN; varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vObjN);
    vec3 east = normalize(vec3(n.z, 0.0, -n.x) + 1e-5);
    vec3 north = cross(n, east);
    vec3 tn = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    tn.xy *= 0.9;
    vec3 objN = normalize(east * tn.x + north * tn.y + n * tn.z);
    vec3 Nw = normalize(uNormalMat * objN);
    vec3 Gw = normalize(vWorldN);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(sunDir);

    float ocean = smoothstep(0.35, 0.65, texture2D(specMap, vUv).r);
    float land = 1.0 - ocean;

    // Land in its own colours, a touch richer: green lowlands, tan deserts
    vec3 day = texture2D(dayMap, vUv).rgb;
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    vec3 landCol = mix(vec3(lum), day, 1.45) * vec3(1.08, 1.2, 0.98);
    landCol = pow(max(landCol, 0.0), vec3(0.92));

    // Oceans: deep blue with turquoise in the shallows the texture carries
    vec3 oceanCol = mix(vec3(0.02, 0.05, 0.20), vec3(0.08, 0.26, 0.50), smoothstep(0.12, 0.35, day.b)) * 0.8;
    oceanCol = mix(oceanCol, day * vec3(0.6, 0.85, 1.3), 0.25);

    float diff = max(dot(Nw, L), 0.0);
    float shade = 0.22 + 0.95 * diff;
    vec3 col = mix(oceanCol, landCol, land) * shade;

    // Soft specular glint on water
    vec3 H = normalize(L + V);
    col += vec3(0.55, 0.65, 0.8) * pow(max(dot(Gw, H), 0.0), 60.0) * ocean * 0.35;

    // White cloud cover drifting slowly
    float cl = texture2D(cloudMap, vUv + vec2(uTime * 0.0015, 0.0)).a;
    col = mix(col, vec3(0.93, 0.94, 0.97) * (0.35 + 0.8 * diff), smoothstep(0.05, 0.8, cl) * 0.82);

    // Limb darkening plus a thin, faint atmosphere at the very edge
    float nv = max(dot(Gw, V), 0.0);
    col *= 0.45 + 0.55 * pow(nv, 0.45);
    col += vec3(0.30, 0.50, 0.90) * pow(1.0 - nv, 4.0) * 0.35;

    gl_FragColor = vec4(col, 1.0);
  }`;

const HALO_VS = /* glsl */ `
  varying vec3 vN; varying vec3 vP;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const HALO_FS = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vN; varying vec3 vP;
  void main() {
    vec3 V = normalize(cameraPosition - vP);
    float d = -dot(normalize(vN), V);
    float g = pow(smoothstep(0.0, 0.36, d), 3.2);
    float lit = 0.3 + 0.9 * smoothstep(-0.5, 0.75, dot(normalize(vN), normalize(sunDir)));
    gl_FragColor = vec4(vec3(0.25, 0.5, 1.0) * g * lit * 0.3, 1.0);
  }`;

const PROGRESS_VS = /* glsl */ `
  attribute float aT; varying float vT;
  void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const RING_FS = /* glsl */ `
  uniform float uOpacity, uPhase, uGain; uniform vec3 uColor; varying float vT;
  void main() {
    float a = 0.5 + 0.5 * sin(vT * 6.28318 + uPhase);
    a = 0.12 + 0.88 * pow(a, 2.2);
    gl_FragColor = vec4(uColor * a * uGain * uOpacity, 1.0);
  }`;

const ARC_FS = /* glsl */ `
  uniform float uProg, uGain; varying float vT;
  void main() {
    if (vT > uProg) discard;
    float d = uProg - vT;
    float head = exp(-d * 34.0);
    float body = 0.45 + 0.55 * smoothstep(0.0, 0.35, vT);
    vec3 cyan = vec3(0.16, 0.92, 0.78);
    vec3 white = vec3(0.92, 1.0, 0.82);
    gl_FragColor = vec4(mix(cyan * body, white * 1.6, head) * uGain, 1.0);
  }`;

const BG_FS = /* glsl */ `
  uniform vec2 uRes;
  float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = (uv - vec2(0.80, 0.98)) * vec2(uRes.x / uRes.y, 1.0);
    float d = length(p * vec2(0.62, 1.0));
    vec3 c0 = vec3(0.008, 0.027, 0.045), c1 = vec3(0.022, 0.07, 0.10), c2 = vec3(0.06, 0.17, 0.23);
    vec3 col = mix(c2, c1, smoothstep(0.0, 0.55, d));
    col = mix(col, c0, smoothstep(0.45, 1.45, d));
    vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    col *= 1.0 - 0.55 * smoothstep(0.45, 1.25, length(q * vec2(0.75, 1.1)));
    col += (h(gl_FragCoord.xy) - 0.5) * 0.008;
    gl_FragColor = vec4(col, 1.0);
  }`;

function softTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Tube with a per-vertex progress attribute (0..1 along its length).
function progressTube(curve, segs, radius, radial, closed) {
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, closed);
  const count = geo.attributes.position.count;
  const ring = radial + 1;
  const t = new Float32Array(count);
  for (let i = 0; i < count; i++) t[i] = Math.floor(i / ring) / segs;
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  return geo;
}

const additive = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false };

export class EarthSplash {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.raf = 0;
    this.renderer = null;
    this.startedAt = 0;
    this.time = 0;
    this.lastFrame = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.done = new Promise((resolve) => { this.resolveDone = resolve; });
    this.frame = (now) => this.render(now);
    this.onResize = () => this.resize();
    this.onSkip = () => this.resolveDone();
    this.onContextLost = (event) => {
      event.preventDefault();
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.resolveDone();
    };
  }

  start() {
    if (this.running) return true;
    try {
      this.build();
    } catch (error) {
      // No WebGL: let the loader behave as before, with no splash to wait on.
      console.warn('Earth splash unavailable:', error);
      this.resolveDone();
      return false;
    }
    this.running = true;
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('pointerdown', this.onSkip);
    return true;
  }

  // Kept for SpaceDive API compatibility; the splash has no speed control.
  boost() {}

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resolveDone();
    window.removeEventListener('resize', this.onResize);
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
      this.canvas.removeEventListener('pointerdown', this.onSkip);
      this.canvas.style.display = 'none';
    }
    const dispose = () => this.dispose();
    if ('requestIdleCallback' in window) window.requestIdleCallback(dispose, { timeout: 2000 });
    else window.setTimeout(dispose, 600);
  }

  dispose() {
    if (!this.renderer) return;
    this.scene?.traverse((object) => {
      object.geometry?.dispose();
      const materials = object.material ? [].concat(object.material) : [];
      for (const material of materials) {
        for (const uniform of Object.values(material.uniforms || {})) uniform.value?.isTexture && uniform.value.dispose();
        material.map?.dispose();
        material.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer = null;
    this.scene = null;
  }

  build() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setClearColor(0x02070c, 1);
    renderer.autoClear = false;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 200);

    // Background gradient and vignette
    this.bgScene = new THREE.Scene();
    this.bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.bgMat = new THREE.ShaderMaterial({
      uniforms: { uRes: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: BG_FS,
      depthTest: false,
      depthWrite: false
    });
    const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat);
    bgQuad.frustumCulled = false;
    this.bgScene.add(bgQuad);

    // Textures: count loads so the first visible frame is never a blank sphere
    let pending = 5;
    const loader = new THREE.TextureLoader();
    const onTexture = () => {
      pending -= 1;
      if (pending === 0 && this.running) {
        this.startedAt = performance.now();
        this.lastFrame = this.startedAt;
        this.raf = requestAnimationFrame(this.frame);
      }
    };
    const load = (name) => {
      const texture = loader.load(TEXTURE_ROOT + name, onTexture, undefined, onTexture);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    };
    const clouds = load('earth_clouds.png');
    clouds.wrapS = THREE.RepeatWrapping;

    // Earth: tilt (x) -> spin (y)
    this.tilt = new THREE.Group();
    this.tilt.rotation.order = 'ZXY';
    this.tilt.rotation.x = FACE.lat * D2R;
    this.tilt.rotation.z = -6 * D2R;
    this.spin = new THREE.Group();
    this.tilt.add(this.spin);
    scene.add(this.tilt);
    this.baseSpin = -Math.PI / 2 - FACE.lon * D2R;

    this.earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: load('earth_day.jpg') },
        nightMap: { value: load('earth_night.jpg') },
        normalMap: { value: load('earth_normal.jpg') },
        specMap: { value: load('earth_specular.jpg') },
        cloudMap: { value: clouds },
        sunDir: { value: SUN },
        uNormalMat: { value: new THREE.Matrix3() },
        uTime: { value: 0 }
      },
      vertexShader: EARTH_VS,
      fragmentShader: EARTH_FS
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 160), this.earthMat);
    this.spin.add(this.earth);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.07, 96, 96),
      new THREE.ShaderMaterial({ uniforms: { sunDir: { value: SUN } }, vertexShader: HALO_VS, fragmentShader: HALO_FS, side: THREE.BackSide, ...additive })
    );
    scene.add(halo);

    const glowTex = softTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    const dotTex = softTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    const bokehTex = softTexture([[0, 'rgba(255,255,255,0.55)'], [0.72, 'rgba(255,255,255,0.42)'], [0.86, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);

    this.haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x2a7fd0, opacity: 0.28, ...additive }));
    this.haze.scale.set(4.4, 4.4, 1);
    this.haze.position.set(0.25, 0.15, -0.6);
    scene.add(this.haze);

    this.buildRings(scene);
    this.buildArcs(glowTex);
    this.buildParticles(scene, dotTex, bokehTex, renderer.getPixelRatio());

    this.normalMatrix = new THREE.Matrix3();
    this.lookTarget = new THREE.Vector3();
    this.P0 = new THREE.Vector3(0, 0.95, 0.6);
    this.T0 = new THREE.Vector3(0, 1.22, -0.35);
    this.resize();
  }

  buildRings(scene) {
    this.rings = [];
    const add = (r, rx, rz, speed, thick, gain, phase) => {
      const pts = [];
      for (let i = 0; i < 256; i++) {
        const a = (i / 256) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const holder = new THREE.Group();
      holder.rotation.order = 'ZXY';
      holder.rotation.x = rx;
      holder.rotation.z = rz;
      [[thick, gain], [thick * 3.2, gain * 0.22]].forEach(([th, g]) => {
        const mat = new THREE.ShaderMaterial({
          uniforms: { uOpacity: { value: 0 }, uPhase: { value: phase }, uGain: { value: g }, uColor: { value: new THREE.Color(0.36, 0.68, 1.0) } },
          vertexShader: PROGRESS_VS,
          fragmentShader: RING_FS,
          ...additive
        });
        holder.add(new THREE.Mesh(progressTube(curve, 512, th, 6, true), mat));
        this.rings.push({ mat, speed, base: phase });
      });
      scene.add(holder);
    };
    add(1.42, 17 * D2R, 20 * D2R, 0.22, 0.003, 0.6, 0.6);
    add(1.62, 11 * D2R, -9 * D2R, -0.16, 0.003, 0.48, 2.4);
    add(4.6, 6 * D2R, 8 * D2R, 0.05, 0.009, 0.42, 4.1);
  }

  buildArcs(glowTex) {
    this.arcs = [];
    const hub = latLon(HUB.lat, HUB.lon);
    for (const dest of DESTINATIONS) {
      const b = latLon(dest.lat, dest.lon);
      const ang = hub.angleTo(b);
      const h = 0.035 + 0.17 * (ang / Math.PI);
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const t = i / 96;
        const p = hub.clone().multiplyScalar(Math.sin((1 - t) * ang) / Math.sin(ang))
          .add(b.clone().multiplyScalar(Math.sin(t * ang) / Math.sin(ang)));
        p.normalize().multiplyScalar(1.004 + h * Math.sin(Math.PI * t));
        pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      for (const [r, g] of [[0.0042, 1.0], [0.013, 0.28], [0.03, 0.08]]) {
        const mat = new THREE.ShaderMaterial({
          uniforms: { uProg: { value: 0 }, uGain: { value: g } },
          vertexShader: PROGRESS_VS,
          fragmentShader: ARC_FS,
          ...additive
        });
        this.spin.add(new THREE.Mesh(progressTube(curve, 220, r, 8, false), mat));
        this.arcs.push({ mat, delay: dest.delay });
      }
    }
    this.hubGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9ff0ff, opacity: 0, ...additive }));
    this.hubGlow.position.copy(hub).multiplyScalar(1.01);
    this.spin.add(this.hubGlow);
  }

  buildParticles(scene, dotTex, bokehTex, pixelRatio) {
    const layer = (n, place, size, color, twinkle) => {
      const pos = new Float32Array(n * 3);
      const seed = new Float32Array(n);
      const scale = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = place();
        pos.set([p.x, p.y, p.z], i * 3);
        seed[i] = Math.random() * 100;
        scale[i] = 0.35 + Math.random() * 0.65;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
      const twinkleExpr = twinkle ? '0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + fract(aSeed) * 2.5) + aSeed))' : '1.0';
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSize: { value: size }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 }, uMap: { value: dotTex }, uPR: { value: pixelRatio } },
        vertexShader: /* glsl */ `
          attribute float aSeed, aScale; uniform float uTime, uSize, uPR; varying float vA;
          void main() {
            vA = (${twinkleExpr}) * aScale;
            gl_PointSize = uSize * aScale * uPR;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vA;
          void main() { float m = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(uColor * m * vA * uOpacity, 1.0); }`,
        ...additive
      });
      scene.add(new THREE.Points(geo, mat));
      return mat;
    };
    const randDir = () => new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
    this.stars = layer(1400, () => {
      const p = randDir().multiplyScalar(rnd(40, 80));
      if (p.z > 0) p.z *= -1;
      if (Math.random() < 0.55) p.x = Math.abs(p.x);
      return p;
    }, 3.2, 0xcfe6ff, true);
    this.sparks = layer(220, () => randDir().multiplyScalar(rnd(1.06, 2.1)), 4.5, 0x5cf0c8, true);

    this.bokehs = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bokehTex, color: i % 3 ? 0x2fbfb0 : 0x3a9fe0, opacity: 0, ...additive }));
      s.position.set(rnd(-1.1, 1.1), rnd(0.85, 1.55), rnd(-0.6, 1.0));
      const k = rnd(0.03, 0.09);
      s.scale.set(k, k, 1);
      s.userData.opacity = rnd(0.25, 0.7);
      scene.add(s);
      this.bokehs.push(s);
    }
  }

  resize() {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the settled globe at ~62% of the height (or ~78% of a narrow width),
    // sitting high enough to clear the loader type along the bottom.
    const halfHeight = Math.max(1.6, 1.28 / this.camera.aspect);
    this.endDistance = halfHeight / Math.tan((FOV / 2) * D2R);
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.bgMat.uniforms.uRes.value.set(w * pr, h * pr);
  }

  render(now) {
    if (!this.running || !this.renderer) return;
    // Advance per frame with a capped step. The observatory decodes textures and
    // compiles shaders on this thread while the splash plays; a wall-clock timeline
    // would jump past the opening during those stalls, so it slows down instead.
    const step = Math.min(Math.max(now - this.lastFrame, 0) / 1000, 1 / 30);
    this.lastFrame = now;
    this.time += step;
    const t = this.reducedMotion ? SEQUENCE_END + 3 : this.time;

    // Camera pull-back from the horizon to the full globe
    const k = easeOut(t / 3.9);
    this.camera.position.set(0, lerp(this.P0.y, 0, k), lerp(this.P0.z, this.endDistance, k));
    this.lookTarget.set(0, lerp(this.T0.y, -0.36, k), lerp(this.T0.z, 0, k));
    this.camera.lookAt(this.lookTarget);

    // Spin settles during the pull-back, then drifts
    this.spin.rotation.y = this.baseSpin - 0.32 * (1 - k) + (this.reducedMotion ? 0 : Math.max(0, t - 3.9) * 0.012);
    this.tilt.updateMatrixWorld(true);
    this.normalMatrix.getNormalMatrix(this.earth.matrixWorld);
    this.earthMat.uniforms.uNormalMat.value.copy(this.normalMatrix);
    this.earthMat.uniforms.uTime.value = t;

    const ringOpacity = sstep(2.3, 4.3, t);
    for (const r of this.rings) {
      r.mat.uniforms.uOpacity.value = ringOpacity;
      r.mat.uniforms.uPhase.value = r.base + t * r.speed;
    }

    const hubOn = sstep(3.7, 4.2, t);
    this.hubGlow.material.opacity = hubOn * 0.95;
    const hs = 0.13 * (0.85 + 0.15 * Math.sin(t * 3.2)) * (0.6 + 0.4 * hubOn);
    this.hubGlow.scale.set(hs, hs, 1);
    for (const a of this.arcs) a.mat.uniforms.uProg.value = easeOut((t - 4.1 - a.delay) / 1.7) * 1.0001;

    this.stars.uniforms.uTime.value = t;
    this.sparks.uniforms.uTime.value = t;
    this.stars.uniforms.uOpacity.value = 0.35 + 0.65 * sstep(0.5, 3.5, t);
    this.sparks.uniforms.uOpacity.value = sstep(1.8, 4.5, t) * 0.9;
    const bokehOpacity = 1 - sstep(1.0, 2.8, t);
    this.bokehs.forEach((b, i) => {
      b.material.opacity = b.userData.opacity * bokehOpacity * sstep(0, 0.3, t + 0.3);
      b.position.x += Math.sin(t * 0.7 + i) * 0.0004;
    });
    this.haze.material.opacity = 0.08 + 0.12 * k;

    this.renderer.clear();
    this.renderer.render(this.bgScene, this.bgCam);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);

    if (t >= SEQUENCE_END) this.resolveDone();
    this.raf = requestAnimationFrame(this.frame);
  }
}
