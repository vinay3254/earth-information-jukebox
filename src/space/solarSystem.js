// Full solar system scene: animated Sun, 8 planets on real period ratios,
// orbit paths, Saturn's rings, the Moon, labels and camera flights.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLANETS, visualRadius, visualDistance, SUN_RADIUS, EARTH_ORBIT_SECONDS } from './planets.js';
import { planetTexture, ringTexture, glowTexture } from './textures.js';

const SUN_VERT = /* glsl */ `
varying vec3 vPos; varying vec3 vNormal;
void main() { vPos = position; vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SUN_FRAG = /* glsl */ `
uniform float uTime; varying vec3 vPos; varying vec3 vNormal;
float h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 p = normalize(vPos) * 2.4;
  float t = uTime * 0.06;
  float g = fbm(p + vec3(t, -t * 0.7, t * 0.4));
  float cells = fbm(p * 3.0 - vec3(0.0, t * 1.4, 0.0));
  float v = g * 0.65 + cells * 0.35;
  vec3 col = mix(vec3(0.85, 0.28, 0.03), vec3(1.0, 0.78, 0.32), smoothstep(0.3, 0.75, v));
  col = mix(col, vec3(1.0, 0.95, 0.75), smoothstep(0.68, 0.9, v));
  float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
  col += vec3(1.0, 0.55, 0.15) * rim * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;

function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function makeStars(count, radius) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // Denser band to suggest the Milky Way plane.
    const band = Math.random() < 0.55;
    const theta = Math.random() * Math.PI * 2;
    const phi = band ? Math.PI / 2 + (Math.random() - 0.5) * 0.35 : Math.acos(2 * Math.random() - 1);
    const r = radius * (0.9 + Math.random() * 0.2);
    const v = new THREE.Vector3().setFromSphericalCoords(r, phi, theta).applyAxisAngle(new THREE.Vector3(1, 0, 0), 1.05);
    pos.set([v.x, v.y, v.z], i * 3);
    c.setHSL(0.58 + Math.random() * 0.1, 0.35, 0.65 + Math.random() * 0.35);
    if (Math.random() < 0.15) c.setHSL(0.08, 0.5, 0.8);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
  return new THREE.Points(geo, mat);
}

export function createSolarSystem(container, { onSelect = () => {}, onChime = () => {}, reducedMotion = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02050c);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 3;
  controls.maxDistance = 260;
  controls.enablePan = false;

  scene.add(makeStars(6000, 1500));
  scene.add(new THREE.AmbientLight(0x3a4c6a, 0.9));
  const sunLight = new THREE.PointLight(0xfff1dd, 2.6, 0, 0);
  scene.add(sunLight);

  // Sun
  const sunMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 64, 64), sunMat);
  scene.add(sun);
  const glowTex = glowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  glow.scale.setScalar(SUN_RADIUS * 6);
  scene.add(glow);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25 }));
  corona.scale.setScalar(SUN_RADIUS * 14);
  scene.add(corona);

  // Planets
  const loader = new THREE.TextureLoader();
  const bodies = [];
  const labelLayer = document.createElement('div');
  labelLayer.className = 'space-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  container.appendChild(labelLayer);

  PLANETS.forEach((p, i) => {
    const radius = visualRadius(p);
    const dist = visualDistance(p);
    const pivot = new THREE.Object3D();
    pivot.rotation.y = Math.random() * Math.PI * 2;
    scene.add(pivot);

    const tilt = new THREE.Object3D();
    tilt.position.x = dist;
    tilt.rotation.z = THREE.MathUtils.degToRad(p.tilt ?? (p.id === 'earth' ? 23.4 : 3 + i));
    pivot.add(tilt);

    let map;
    if (p.kind === 'earth') {
      map = loader.load('globe/blue_marble.jpg');
      map.colorSpace = THREE.SRGBColorSpace;
    } else {
      map = planetTexture(p, i + 3);
    }
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 48),
      new THREE.MeshStandardMaterial({ map, roughness: p.kind === 'gas' ? 0.9 : 1, metalness: 0 })
    );
    tilt.add(mesh);

    if (p.kind === 'earth') {
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.06, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending })
      );
      tilt.add(atmo);
      const moonPivot = new THREE.Object3D();
      tilt.add(moonPivot);
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.27, 24, 24),
        new THREE.MeshStandardMaterial({ map: planetTexture({ kind: 'rock', colors: ['#5f5f62', '#8a8a8e', '#b5b5b8', '#707074'] }, 42), roughness: 1 })
      );
      moon.position.x = radius * 2.6;
      moonPivot.add(moon);
      p._moonPivot = moonPivot;
    }

    if (p.rings) {
      const ringGeo = new THREE.RingGeometry(radius * 1.25, radius * 2.3, 128, 1);
      // Map texture u across the ring radius.
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      const v3 = new THREE.Vector3();
      for (let k = 0; k < pos.count; k++) {
        v3.fromBufferAttribute(pos, k);
        uv.setXY(k, (v3.length() - radius * 1.25) / (radius * 1.05), 0.5);
      }
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2 + 0.1;
      tilt.add(ring);
    }

    // Orbit path
    const pts = [];
    for (let k = 0; k <= 256; k++) {
      const a = (k / 256) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * dist, 0, Math.sin(a) * dist));
    }
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: p.id === 'earth' ? 0x8fb8dc : 0x50657f, transparent: true, opacity: p.id === 'earth' ? 0.55 : 0.28 })
    );
    scene.add(orbit);

    const label = document.createElement('button');
    label.type = 'button';
    label.tabIndex = -1;
    label.className = 'space-label';
    label.textContent = p.name;
    label.addEventListener('click', () => onSelect(p.id));
    labelLayer.appendChild(label);

    bodies.push({ p, pivot, tilt, mesh, radius, dist, label, orbit, lastAngle: pivot.rotation.y });
  });

  // Clicking a planet
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(bodies.map((b) => b.mesh), false)[0];
    if (hit) onSelect(bodies.find((b) => b.mesh === hit.object).p.id);
  });

  // Camera flight state
  let flight = null;
  let follow = null; // body the camera tracks
  const OVERVIEW = new THREE.Vector3(0, 70, 120);
  camera.position.set(0, 420, 900); // far out for the arrival flight
  controls.target.set(0, 0, 0);

  // body: if given, toPos/toTarget are offsets from that body's live position,
  // so the camera lands on a planet even though it keeps orbiting.
  function flyTo(toPos, toTarget, seconds = 2.6, body = null) {
    return new Promise((resolve) => {
      flight = {
        fromPos: camera.position.clone(), toPos: toPos.clone(),
        fromTarget: controls.target.clone(), toTarget: toTarget.clone(),
        start: performance.now(), seconds: reducedMotion ? 0.001 : seconds, body, resolve
      };
    });
  }

  const tmp = new THREE.Vector3();
  function bodyWorld(b) { return b.mesh.getWorldPosition(tmp).clone(); }

  // Camera offset from a planet: on the Sun-facing side, a little above and to
  // the side, so we see the lit face with the Sun out of frame.
  function offsetFor(b, closeness = 4.2) {
    const at = bodyWorld(b);
    const toSun = at.clone().negate().normalize();
    const side = new THREE.Vector3(-toSun.z, 0, toSun.x);
    return toSun.multiplyScalar(b.radius * closeness * 0.75)
      .add(side.multiplyScalar(b.radius * closeness * 0.65))
      .add(new THREE.Vector3(0, b.radius * closeness * 0.3, 0));
  }

  // Resize
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    const shift = w > 860 ? Math.min(w * 0.18, 270) : 0;
    if (shift) camera.setViewOffset(w, h, shift, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Loop
  const clock = new THREE.Clock();
  let running = true;
  let speed = 1;
  let raf = 0;
  const proj = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    sunMat.uniforms.uTime.value = time;
    sun.rotation.y += dt * 0.03;

    for (const b of bodies) {
      const omega = (Math.PI * 2) / (EARTH_ORBIT_SECONDS * (b.p.periodDays / 365.25));
      const before = b.pivot.rotation.y;
      b.pivot.rotation.y += omega * dt * speed;
      b.mesh.rotation.y += dt * speed * Math.min(3, 24 / Math.max(6, Math.abs(b.p.dayHours)));
      if (b.p._moonPivot) b.p._moonPivot.rotation.y += dt * speed * ((Math.PI * 2) / (EARTH_ORBIT_SECONDS / 13.4));
      // Chime each time a planet crosses the line from the Sun toward the viewer's start (angle 0).
      const k0 = Math.floor(before / (Math.PI * 2)), k1 = Math.floor(b.pivot.rotation.y / (Math.PI * 2));
      if (k1 > k0) onChime(b.p);
    }

    if (flight) {
      const t = Math.min(1, (performance.now() - flight.start) / 1000 / flight.seconds);
      const e = easeInOut(t);
      let toPos = flight.toPos, toTarget = flight.toTarget;
      if (flight.body) {
        const at = bodyWorld(flight.body);
        toTarget = at.clone().add(flight.toTarget);
        toPos = at.clone().add(flight.toPos);
      }
      camera.position.lerpVectors(flight.fromPos, toPos, e);
      controls.target.lerpVectors(flight.fromTarget, toTarget, e);
      if (t >= 1) { const r = flight.resolve; flight = null; r(); }
    } else if (follow) {
      // Keep the followed planet centred as it orbits.
      const at = bodyWorld(follow);
      const delta = at.clone().sub(controls.target);
      controls.target.add(delta);
      camera.position.add(delta);
    }
    controls.update();

    // Labels
    const w = container.clientWidth, h = container.clientHeight;
    for (const b of bodies) {
      b.mesh.getWorldPosition(proj);
      proj.y += b.radius * 1.35;
      proj.project(camera);
      const visible = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
      b.label.style.display = visible ? '' : 'none';
      if (visible) b.label.style.transform = `translate(${((proj.x + 1) / 2) * w}px, ${((1 - proj.y) / 2) * h}px) translate(-50%, -100%)`;
    }
    glow.material.opacity = 0.75 + Math.sin(time * 0.7) * 0.08;
    renderer.render(scene, camera);
  }
  frame();

  return {
    planets: PLANETS,
    async intro() {
      follow = null;
      await flyTo(OVERVIEW, new THREE.Vector3(0, 0, 0), 4.2);
    },
    skipIntro() {
      if (flight) flight.start = -1e9;
    },
    async focus(id, closeness) {
      const b = bodies.find((x) => x.p.id === id);
      if (!b) return;
      follow = null;
      for (const o of bodies) o.label.classList.toggle('on', o === b);
      await flyTo(offsetFor(b, closeness), new THREE.Vector3(), 2.4, b);
      follow = b;
    },
    async diveInto(id) {
      const b = bodies.find((x) => x.p.id === id);
      if (!b) return;
      follow = null;
      const dir = camera.position.clone().sub(bodyWorld(b)).normalize();
      await flyTo(dir.multiplyScalar(b.radius * 1.2), new THREE.Vector3(), 1.6, b);
    },
    async overview() {
      follow = null;
      for (const o of bodies) o.label.classList.remove('on');
      await flyTo(OVERVIEW, new THREE.Vector3(0, 0, 0), 2.6);
    },
    setSpeed(s) { speed = s; },
    setRunning(on) { running = on; if (on) clock.getDelta(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose();
      renderer.domElement.remove(); labelLayer.remove();
    }
  };
}
