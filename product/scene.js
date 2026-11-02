// scene.js (Agent A) - three.js solar system hero render inside #stage.
// Not to scale: distance from Sun = 4 + 13*AU^0.45 units; planet radius = 0.55*(radiusKm/1000)^0.36.
import * as THREE from 'three';
import { SUN, PLANETS } from './data.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const stage = document.getElementById('stage');

// ---------- renderer / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 1); // composer lifts non-zero clear colours to navy
renderer.domElement.style.display = 'block';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 2000);

// ---------- deterministic noise ----------
let seed = 1337;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const hash3 = (x, y, z) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
}
function fbm(x, y, z, oct = 5) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// Paint an equirectangular texture: fn(lat[-pi/2..pi/2], lon, px, py, pz) -> [r,g,b,a?] 0..255
function equirect(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      const c = fn(lat, lon, cl * Math.cos(lon), sl, cl * Math.sin(lon));
      const k = (j * w + i) * 4;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = c.length > 3 ? c[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const sstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
function toTex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

// ---------- texture painters ----------
function bandPalette(stops, y) { // stops: [[pos, rgb]...] sorted
  for (let i = 0; i < stops.length - 1; i++) {
    if (y <= stops[i + 1][0]) return mix(stops[i][1], stops[i + 1][1], sstep(stops[i][0], stops[i + 1][0], y));
  }
  return stops[stops.length - 1][1];
}

const painters = {
  Sun: (lat, lon, x, y, z) => {
    const n = fbm(x * 9, y * 9, z * 9, 4), m = fbm(x * 2.5 + 7, y * 2.5, z * 2.5, 3);
    const c = mix([235, 110, 25], [255, 214, 130], clamp01(n * 1.4 - 0.2 + m * 0.3));
    return c;
  },
  Mercury: (lat, lon, x, y, z) => {
    const n = fbm(x * 5, y * 5, z * 5, 6);
    let c = mix([88, 84, 80], [178, 170, 160], n);
    const cr = fbm(x * 18 + 3, y * 18, z * 18, 2);
    if (cr > 0.68) c = mix(c, [205, 198, 188], (cr - 0.68) * 3);
    if (cr < 0.3) c = mix(c, [60, 57, 55], (0.3 - cr) * 2);
    return c;
  },
  Venus: (lat, lon, x, y, z) => {
    const w = fbm(x * 3, y * 6, z * 3, 5);
    const b = Math.sin(lat * 7 + w * 6) * 0.5 + 0.5;
    return mix([196, 160, 104], [240, 218, 168], clamp01(b * 0.6 + w * 0.5));
  },
  Earth: (lat, lon, x, y, z) => {
    const n = fbm(x * 2.2 + 11, y * 2.2, z * 2.2, 7);
    const ice = Math.abs(lat) > 1.22 + (n - 0.5) * 0.3;
    if (ice) return [236, 242, 248];
    if (n < 0.52) {
      const depth = sstep(0.3, 0.52, n);
      return mix([8, 34, 86], [22, 82, 140], depth);
    }
    const alt = sstep(0.52, 0.75, n);
    const dry = fbm(x * 4 + 2, y * 4, z * 4, 4);
    const tropic = 1 - Math.abs(lat) / 1.2;
    let c = mix([46, 98, 44], [118, 120, 64], alt);
    if (dry > 0.55 && Math.abs(lat) < 0.7) c = mix(c, [196, 164, 110], sstep(0.55, 0.7, dry) * tropic);
    if (Math.abs(lat) > 0.95) c = mix(c, [120, 130, 120], 0.5);
    return c;
  },
  EarthClouds: (lat, lon, x, y, z) => {
    const n = fbm(x * 4 + 5, y * 7, z * 4, 6);
    const a = sstep(0.5, 0.75, n) * 235;
    return [255, 255, 255, a];
  },
  Mars: (lat, lon, x, y, z) => {
    const n = fbm(x * 3, y * 3, z * 3, 6);
    let c = mix([150, 64, 34], [214, 120, 72], n);
    const m = fbm(x * 1.6 + 9, y * 1.6, z * 1.6, 4);
    if (m < 0.42) c = mix(c, [92, 46, 32], sstep(0.42, 0.3, m) * 0.8);
    if (Math.abs(lat) > 1.32 + (n - 0.5) * 0.2) c = [238, 228, 220];
    return c;
  },
  Jupiter: (lat, lon, x, y, z) => {
    const warp = (fbm(x * 4, y * 14, z * 4, 5) - 0.5) * 0.18;
    const v = (Math.sin(lat) + warp + 1) / 2; // 0 south .. 1 north
    let c = bandPalette([
      [0.0, [120, 100, 86]], [0.1, [170, 140, 112]], [0.2, [210, 188, 160]], [0.28, [160, 106, 70]],
      [0.34, [226, 206, 176]], [0.42, [176, 112, 72]], [0.47, [236, 222, 196]], [0.53, [238, 226, 204]],
      [0.58, [168, 110, 74]], [0.65, [222, 200, 168]], [0.72, [150, 112, 84]], [0.8, [204, 182, 152]],
      [0.9, [150, 128, 108]], [1.0, [118, 102, 90]],
    ], v);
    const fine = fbm(x * 20, y * 60, z * 20, 3);
    c = mix(c, [255, 248, 236], (fine - 0.5) * 0.35);
    // Great Red Spot ~22 deg S
    const gLat = -22 * Math.PI / 180, gLon = 1.2 * Math.PI;
    let dl = lon - gLon; dl = Math.atan2(Math.sin(dl), Math.cos(dl));
    const e = Math.sqrt((dl / 0.2) ** 2 + ((lat - gLat) / 0.085) ** 2);
    if (e < 1.6) {
      const swirl = fbm(dl * 12, lat * 12, e * 3, 3);
      const core = sstep(1.0, 0.0, e);
      c = mix(c, [236, 214, 186], sstep(1.6, 1.15, e) * 0.7);
      c = mix(c, [182, 76, 48], core * (0.75 + swirl * 0.25));
    }
    return c.map((t) => Math.max(0, Math.min(255, t)));
  },
  Saturn: (lat, lon, x, y, z) => {
    const warp = (fbm(x * 3, y * 18, z * 3, 4) - 0.5) * 0.06;
    const v = (Math.sin(lat) + warp + 1) / 2;
    let c = bandPalette([
      [0.0, [150, 140, 120]], [0.12, [190, 170, 130]], [0.3, [222, 200, 150]], [0.4, [206, 176, 122]],
      [0.47, [236, 218, 172]], [0.53, [240, 222, 178]], [0.6, [212, 184, 132]], [0.7, [228, 206, 158]],
      [0.85, [196, 178, 140]], [0.95, [150, 156, 160]], [1.0, [120, 134, 150]],
    ], v);
    return c;
  },
  Uranus: (lat, lon, x, y, z) => {
    const v = Math.sin(lat);
    const w = fbm(x * 2, y * 10, z * 2, 3);
    return mix([150, 210, 220], [190, 232, 236], clamp01(0.5 + v * 0.3 + (w - 0.5) * 0.25));
  },
  Neptune: (lat, lon, x, y, z) => {
    const w = fbm(x * 3, y * 16, z * 3, 5);
    let c = mix([28, 60, 170], [74, 118, 220], clamp01(0.5 + Math.sin(lat * 9 + w * 4) * 0.25 + (w - 0.5) * 0.4));
    let dl = lon - 2.0; dl = Math.atan2(Math.sin(dl), Math.cos(dl));
    const e = Math.sqrt((dl / 0.22) ** 2 + ((lat + 0.35) / 0.09) ** 2);
    if (e < 1) c = mix(c, [16, 30, 100], sstep(1, 0.3, e));
    const e2 = Math.sqrt(((dl - 0.15) / 0.18) ** 2 + ((lat + 0.24) / 0.03) ** 2);
    if (e2 < 1) c = mix(c, [200, 220, 255], sstep(1, 0.2, e2) * 0.6);
    return c;
  },
};

// ---------- layout (compressed, NOT to scale) ----------
const ECC = { Mercury: 0.206, Venus: 0.007, Earth: 0.017, Mars: 0.093, Jupiter: 0.049, Saturn: 0.057, Uranus: 0.046, Neptune: 0.010 };
// Starting orbital angle (radians) chosen for the hero composition.
const ANGLE0 = { Mercury: -0.2, Venus: 0.6, Earth: 0.32, Mars: 0.0, Jupiter: 0.2, Saturn: 0.06, Uranus: -0.07, Neptune: -0.16 };
const distOf = (au) => 4 + 13 * Math.pow(au, 0.45);
const sizeOf = (km) => 0.55 * Math.pow(km / 1000, 0.36);
const SUN_R = 4.0;

// ---------- sun ----------
// emissive surface with limb darkening, pushed into HDR so ACES rolls it off
const sunMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: toTex(equirect(512, 256, painters.Sun)) }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uFlat: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 uTint; uniform float uFlat; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ float mu = clamp(dot(vN, vV), 0.0, 1.0);
      vec3 c = texture2D(map, vUv).rgb;
      float limb = 0.45 + 0.55 * pow(mu, 0.55);
      vec3 core = vec3(1.0, 0.905, 0.672) * 1.25; vec3 rimC = vec3(1.0, 0.33, 0.03);
      vec3 col = mix(rimC, core, pow(mu, 0.8)) * (0.55 + 0.6 * c) * limb * uTint;
      vec3 ink = mix(vec3(0.578, 0.184, 0.010), vec3(0.745, 0.255, 0.012), smoothstep(0.18, 0.24, mu)); // #c9781a engraved limb ring, #e08a1e face
      ink = mix(ink, vec3(0.578, 0.184, 0.010), smoothstep(0.5, 0.53, mu) * (1.0 - smoothstep(0.56, 0.59, mu)) * 0.6);
      col = mix(col, ink, uFlat);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 96, 64), sunMat);
scene.add(sun);

function glowTexture(stops) {
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  stops.forEach(([p, c]) => gr.addColorStop(p, c));
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowMat = (tex, op) => new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op });
// corona: three additive layers, white-hot core -> #ffb347 -> transparent at ~3x radius
const glowCore = new THREE.Sprite(glowMat(glowTexture([
  [0, 'rgba(255,255,245,1)'], [0.32, 'rgba(255,246,220,0.9)'], [0.42, 'rgba(255,214,150,0.45)'],
  [0.6, 'rgba(255,179,71,0.12)'], [1, 'rgba(0,0,0,0)']]), 0.75));
glowCore.scale.setScalar(SUN_R * 3.2);
const glowInner = new THREE.Sprite(glowMat(glowTexture([
  [0, 'rgba(255,200,120,0.9)'], [0.33, 'rgba(255,179,71,0.55)'], [0.5, 'rgba(255,150,60,0.18)'],
  [0.75, 'rgba(255,120,40,0.04)'], [1, 'rgba(0,0,0,0)']]), 0.85));
glowInner.scale.setScalar(SUN_R * 6.5);
const glowOuter = new THREE.Sprite(glowMat(glowTexture([
  [0, 'rgba(255,179,71,0.3)'], [0.3, 'rgba(255,140,60,0.1)'], [0.65, 'rgba(120,60,30,0.025)'], [1, 'rgba(0,0,0,0)']]), 0.8));
glowOuter.scale.setScalar(SUN_R * 8); glowOuter.material.opacity = 0.3; glowInner.scale.setScalar(SUN_R * 4.4); glowInner.material.opacity = 0.45; glowCore.scale.setScalar(SUN_R * 2.6); glowCore.material.opacity = 0.3;
[glowCore, glowInner, glowOuter].forEach((g) => { g.userData.op = g.material.opacity; });
scene.add(glowOuter, glowInner, glowCore);

const sunLight = new THREE.PointLight(0xfff1dc, 3.2, 0, 0);
scene.add(sunLight);
const ambient = new THREE.AmbientLight(0x4a5878, 0.06); // faint night-side fill
scene.add(ambient);
const orbitLines = [];
const planetMats = [];

// ---------- planets ----------
const bodies = [{ name: SUN.name, obj: sun, radius: SUN_R, ext: 0 }];
// hairline orbits: inner ones warmer and brighter, as if lit by the Sun
// Orbits fade out above the caption band: uCut = NDC y of B's __copyRects.facts top.
const orbitCut = { value: -2 };
const orbitMatFor = (a) => {
  const k = Math.exp(-(a - distOf(0.39)) / 7);
  const m = new THREE.LineBasicMaterial({
    color: new THREE.Color(0x8e9ab0).lerp(new THREE.Color(0xffc98a), k * 0.8),
    transparent: true, opacity: 0.09 + 0.14 * k, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = orbitCut;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vNdcY;\nvoid main() {')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vNdcY = gl_Position.y / gl_Position.w;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uCut; varying float vNdcY;\nvoid main() {')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.a *= smoothstep(uCut, uCut + 0.08, vNdcY);');
  };
  return m;
};

function ellipsePoint(a, e, th, out = new THREE.Vector3()) {
  const b = a * Math.sqrt(1 - e * e), c = a * e;
  return out.set(a * Math.cos(th) - c, 0, -b * Math.sin(th));
}

function makeRing(inner, outer) {
  const geo = new THREE.RingGeometry(inner, outer, 256, 1);
  const pos = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  const W = 1024, cv = document.createElement('canvas');
  cv.width = W; cv.height = 4;
  const g = cv.getContext('2d'), img = g.createImageData(W, 4);
  seed = 99;
  for (let i = 0; i < W; i++) {
    const t = i / (W - 1); // 0 inner .. 1 outer
    const R = inner + t * (outer - inner); // in planet radii-ish units relative
    let a, col;
    const f = fbm(t * 60, 0.5, 0.5, 3);
    if (t < 0.17) { a = 0.12 + t * 1.2; col = [150, 136, 116]; }            // C ring (faint)
    else if (t < 0.53) { a = 0.85 + (f - 0.5) * 0.4; col = [226, 208, 172]; } // B ring (bright)
    else if (t < 0.65) { a = 0.0; col = [20, 18, 16]; }                     // Cassini division
    else if (t < 0.9) { a = 0.45 + (f - 0.5) * 0.25; col = [200, 184, 154]; }  // A ring
    else if (t < 0.915) { a = 0.08; col = [120, 110, 100]; }                 // Encke gap
    else { a = 0.45 * (1 - (t - 0.915) / 0.085) + 0.05; col = [190, 176, 150]; }
    const fine = Math.sin(t * 900) * 0.04 + Math.sin(t * 310) * 0.05;
    a = clamp01(a + fine);
    for (let r = 0; r < 4; r++) {
      const k = (r * W + i) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = toTex(cv);
  // Custom shader: lit vs unlit face of the rings + the planet's shadow cast across them.
  const mat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { map: { value: tex }, uSun: { value: new THREE.Vector3() }, uPlanet: { value: new THREE.Vector3() }, uR: { value: inner / 1.24 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uSun; uniform vec3 uPlanet; uniform float uR;
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){ vec4 c = texture2D(map, vUv);
        vec3 L = normalize(uSun - vW); vec3 V = normalize(cameraPosition - vW);
        float sameSide = sign(dot(vN, L)) * sign(dot(vN, V));
        float lit = sameSide > 0.0 ? 0.3 + 0.7 * abs(dot(vN, L)) : 0.4 + 0.3 * (1.0 - c.a); // unlit face: forward-scattered light through the ring
        // planet shadow: does the ray toward the sun hit the planet sphere?
        vec3 oc = vW - uPlanet; float b = dot(oc, L); float h = dot(oc, oc) - b*b;
        float shadow = (b < 0.0) ? smoothstep(uR*uR*0.92, uR*uR*1.04, h) : 1.0;
        vec3 col = c.rgb * lit * shadow * 0.62; // ring albedo ~0.55-0.6
        gl_FragColor = vec4(col, c.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

function makeAtmosphere(r, rgb, k) {
  return new THREE.Mesh(new THREE.SphereGeometry(r * 1.07, 64, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    uniforms: { uSun: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3(...rgb) }, uK: { value: k } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uC; uniform float uK; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(V, vN)), 2.5);
        float lit = clamp(dot(vN, normalize(uSun - vW)) * 1.5 + 0.35, 0.0, 1.0);
        gl_FragColor = vec4(uC * rim * lit * uK, rim * lit); }`,
  }));
}
const TEX_SIZE = { Jupiter: 1024, Saturn: 1024, Earth: 1024 };
for (const p of PLANETS) {
  const r = sizeOf(p.radiusKm), a = distOf(p.au), e = ECC[p.name] ?? 0;
  seed = p.name.length * 97;

  // orbit hairline
  const pts = [];
  for (let i = 0; i <= 360; i++) pts.push(ellipsePoint(a, e, (i / 360) * Math.PI * 2));
  const ol = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), orbitMatFor(a));
  ol.userData.base = { color: ol.material.color.clone(), opacity: ol.material.opacity };
  orbitLines.push(ol); scene.add(ol);

  const w = TEX_SIZE[p.name] || 512;
  const mat = new THREE.MeshStandardMaterial({
    map: toTex(equirect(w, w / 2, painters[p.name])), roughness: 0.95, metalness: 0,
  });
  if (p.name === 'Earth') { mat.roughness = 0.75; }
  planetMats.push(mat);
  const holder = new THREE.Group(); // positioned on orbit
  const tilt = new THREE.Group();   // axial tilt
  const tiltRad = THREE.MathUtils.degToRad(p.tilt);
  tilt.rotation.z = tiltRad;
  tilt.rotation.x = p.name === 'Saturn' ? -0.35 : 0; // open Saturn's rings toward the camera
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), mat);
  tilt.add(mesh);
  holder.add(tilt);
  scene.add(holder);

  const ATM = { Venus: [1.0, 0.85, 0.55], Earth: [0.35, 0.6, 1.0], Mars: [1.0, 0.6, 0.4], Jupiter: [1.0, 0.85, 0.65], Saturn: [1.0, 0.9, 0.7], Uranus: [0.55, 0.9, 1.0], Neptune: [0.35, 0.55, 1.0] };
  if (ATM[p.name]) holder.add(makeAtmosphere(r, ATM[p.name], p.name === 'Earth' ? 1.4 : 0.8));
  if (p.name === 'Earth') {
    const moon = new THREE.Mesh(new THREE.SphereGeometry(r * 0.36, 48, 32),
      new THREE.MeshStandardMaterial({ map: toTex(equirect(256, 128, painters.Mercury)), roughness: 1 }));
    holder.add(moon);
    holder.userData.moon = moon; holder.userData.moonR = r * 2.6;
    const mo = []; for (let k = 0; k <= 96; k++) { const q = (k / 96) * Math.PI * 2; mo.push(new THREE.Vector3(Math.cos(q) * r * 2.6, 0, Math.sin(q) * r * 2.6)); }
    holder.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(mo), new THREE.LineBasicMaterial({ color: 0x9aa6bb, transparent: true, opacity: 0.18, depthWrite: false })));
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.015, 96, 64),
      new THREE.MeshStandardMaterial({ map: toTex(equirect(1024, 512, painters.EarthClouds)), transparent: true, roughness: 1, depthWrite: false }));
    mesh.add(clouds);
    mesh.userData.clouds = clouds;
  }
  if (p.name === 'Saturn') {
    const ring = makeRing(r * 1.24, r * 2.3);
    ring.rotation.x = -Math.PI / 2;
    tilt.add(ring);
    ring.onBeforeRender = () => { ring.material.uniforms.uPlanet.value.setFromMatrixPosition(holder.matrixWorld); };
  }
  if (p.name === 'Uranus') { // faint narrow ring system
    const ur = new THREE.Mesh(new THREE.RingGeometry(r * 1.6, r * 1.64, 128),
      new THREE.MeshBasicMaterial({ color: 0x8fa3ad, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    ur.rotation.x = -Math.PI / 2;
    tilt.add(ur);
  }
  bodies.push({ name: p.name, obj: holder, mesh, radius: r, ext: r * ({ Saturn: 2.0, Uranus: 1.3 }[p.name] || 1), a, e, theta: ANGLE0[p.name] ?? 0, period: p.periodDays, day: p.dayHours, retro: p.tilt > 90 });
}

// round soft point sprite
const dotTex = glowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.85)'], [0.7, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]);

// ---------- asteroid belt (very faint) ----------
{
  const N = 2800, pos = new Float32Array(N * 3);
  seed = 4242;
  for (let i = 0; i < N; i++) {
    const au = 2.7 + (rand() + rand() + rand() + rand() - 2) * 0.22, th = rand() * Math.PI * 2, d = distOf(au);
    pos[i * 3] = Math.cos(th) * d; pos[i * 3 + 1] = (rand() - 0.5) * 0.2; pos[i * 3 + 2] = Math.sin(th) * d;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const beltMat = new THREE.PointsMaterial({ color: 0x8a8070, map: dotTex, size: 1.6 * renderer.getPixelRatio(), sizeAttenuation: false, transparent: true, opacity: 0.22, depthWrite: false });
  // fade belt dust below ~70% of the frame so it never reaches the caption band
  beltMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vFade;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vFade = smoothstep(-0.55, -0.25, gl_Position.y / gl_Position.w);');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vFade;\nvoid main() {')
      .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.a *= vFade;\n#include <premultiplied_alpha_fragment>');
  };
  scene.add(new THREE.Points(g, beltMat));
  window.__beltMat = beltMat;
}

// ---------- starfield ----------
{
  const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  seed = 777;
  for (let i = 0; i < N; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 700;
    pos[i * 3] = R * s * Math.cos(th); pos[i * 3 + 1] = R * u; pos[i * 3 + 2] = R * s * Math.sin(th);
    const b = Math.pow(rand(), 4) * 0.8 + 0.06, tint = rand();
    const c = tint < 0.15 ? [1, 0.85, 0.7] : tint > 0.85 ? [0.75, 0.85, 1] : [1, 1, 1];
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = window.__stars = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex, size: 2.0 * renderer.getPixelRatio(), sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  stars.renderOrder = -1;
  scene.add(stars);
}

// ---------- camera framing ----------
const camBase = new THREE.Vector3(-12, 27, 46);
const target = new THREE.Vector3(25, -3, 4);
const BASE_ZOOM = 1.05;
function frame() {
  const w = stage.clientWidth || window.innerWidth;
  const h = stage.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  if (typeof composer !== 'undefined') { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  camera.aspect = w / h;
  // keep the whole system in frame on tall/narrow screens
  // keep at least the horizontal field of a 16:10 frame at 30deg vertical
  const portrait = camera.aspect < 0.8;
  target.x = portrait ? 14 : 25; // keep more of the Sun on narrow screens
  const hTan = Math.tan(THREE.MathUtils.degToRad(15)) * (portrait ? 1.6 / 1.2 : 1.6);
  const vTan = Math.max(Math.tan(THREE.MathUtils.degToRad(15)), hTan / camera.aspect);
  camera.fov = Math.min(90, THREE.MathUtils.radToDeg(2 * Math.atan(vTan)));
  camera.updateProjectionMatrix();
  layoutPlanets(w, h);
  if (typeof fitGain !== 'undefined') fitGain = 0.3;
}

// Hero layout: phase each planet on its own orbit so that, on screen, they march along a
// diagonal from the Sun to ~88% width / ~32% height with screen-x increasing with AU.
// Phases are limited to the far half of each orbit so every planet shows its sunlit side.
const MARCH = [0.1, 0.22, 0.34, 0.46, 0.6, 0.735, 0.865, 1.0];
function layoutPlanets(w, h) {
  camera.position.copy(camBase).multiplyScalar(BASE_ZOOM); camera.lookAt(tmpP.copy(target).multiplyScalar(BASE_ZOOM)); camera.updateMatrixWorld();
  const toScreen = (v) => { tmpL.copy(v).project(camera); return [(tmpL.x * 0.5 + 0.5) * w, (-tmpL.y * 0.5 + 0.5) * h]; };
  const [sx, sy] = toScreen(sun.position);
  const ex = 0.9 * w, ey = (w / h < 0.8 ? 0.4 : 0.27) * h;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const placed = [];
  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i], f = MARCH[i - 1];
    const tx = sx + (ex - sx) * f, ty = sy + (ey - sy) * Math.pow(f, 0.85);
    let best = 0, bestD = Infinity;
    for (let th = -0.35; th <= 2.4; th += 0.004) {
      ellipsePoint(b.a, b.e, th, tmpP);
      const [px, py] = toScreen(tmpP);
      const [qx, qy] = toScreen(tmpP.addScaledVector(right, b.ext));
      const rp = Math.hypot(qx - px, qy - py);
      let d = (px - tx) ** 2 + (py - ty) ** 2;
      // keep every disc clear of the ones already placed (room for the sweep + a label gap)
      for (const o of placed) {
        const gap = Math.hypot(px - o[0], py - o[1]) - (1.2 * (rp + o[2]) + 12);
        if (gap < 0) d += gap * gap * 400;
      }
      if (px - rp < 8) d += 1e7; // never park a planet against the left edge
      const prev = placed[placed.length - 1];
      if (prev && px < prev[0] + 0.8 * (rp + prev[2])) d += 1e7; // screen-x order follows AU
      if (d < bestD) { bestD = d; best = th; b._s = [px, py, rp]; }
    }
    placed.push(b._s);
    b.theta = b.hero = best;
  }
}
const tmpL = new THREE.Vector3(), tmpP = new THREE.Vector3();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
frame();
new ResizeObserver(frame).observe(stage);
window.addEventListener('resize', frame);

// ---------- animation + label anchors ----------
const clock = new THREE.Clock();
const view = { yaw: 0, pitch: 0, zoom: BASE_ZOOM, vYaw: 0, vPitch: 0, tZoom: BASE_ZOOM, dragging: false, lx: 0, ly: 0, idle: 0 };
window.addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.target.closest('a,button,input')) return; view.dragging = true; view.lx = e.clientX; view.ly = e.clientY; });
window.addEventListener('pointermove', (e) => {
  if (!view.dragging) return;
  view.vYaw = -(e.clientX - view.lx) * 0.004; view.vPitch = (e.clientY - view.ly) * 0.003;
  view.lx = e.clientX; view.ly = e.clientY; view.idle = 0;
});
window.addEventListener('pointerup', () => { view.dragging = false; });
stage.addEventListener('wheel', (e) => { e.preventDefault(); view.tZoom = THREE.MathUtils.clamp(view.tZoom * Math.exp(e.deltaY * 0.001), BASE_ZOOM * 0.8, BASE_ZOOM * 1.15); view.idle = 0; }, { passive: false });
const yAxis = new THREE.Vector3(0, 1, 0);
let lastT = 0;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camRight = new THREE.Vector3();
window.__labelAnchors = [];

function anchorFor(name, worldPos, radius, w, h) {
  tmp.copy(worldPos).project(camera);
  camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  tmp2.copy(worldPos).addScaledVector(camRight, radius).project(camera);
  const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
  const x2 = (tmp2.x * 0.5 + 0.5) * w, y2 = (-tmp2.y * 0.5 + 0.5) * h;
  return { name, x, y, r: Math.hypot(x2 - x, y2 - y), visible: tmp.z < 1 };
}

// ---------- themes: <html data-theme="night|paper|blueprint"> (set by B's switcher) ----------
const THEMES = {
  night:  { bg: 0x000000, orbit: null, orbitK: 1, stars: true, starTint: [1, 1, 1], glow: 1, bloom: 0.6, amb: [0x4a5878, 0.06], belt: [0x8a8070, 0.22], sun: [1, 1, 1] },
  natgeo: { bg: 0x000000, orbit: null, orbitK: 1, stars: true, starTint: [0.82, 0.9, 1.15], glow: 1, bloom: 0.6, amb: [0x4a5878, 0.06], belt: [0x8a8070, 0.22], sun: [1, 1, 1] },
  print:  { bg: 0xf3eee3, orbit: 0x8a6a3a, orbitK: 2.6, orbitOp: 0.28, stars: false, starTint: [1, 1, 1], glow: 0, bloom: 0, amb: [0xfff4e0, 0.55], belt: [0x7a5a3a, 0.35], sun: [1, 1, 1], flat: 1 },
};
let themeName = null;
function applyTheme(name) {
  const th = THEMES[name] || THEMES[name === 'paper' ? 'print' : 'night'];
  themeName = name;
  const bg = new THREE.Color(th.bg);
  renderer.setClearColor(bg, 1);
  scene.background = th.bg === 0 ? null : bg;
  for (const ol of orbitLines) {
    ol.material.color.copy(th.orbit == null ? ol.userData.base.color : new THREE.Color(th.orbit));
    ol.material.opacity = th.orbitOp || Math.min(0.6, ol.userData.base.opacity * th.orbitK);
  }
  if (window.__stars) { window.__stars.visible = th.stars; window.__stars.material.color.setRGB(...th.starTint); }
  sun.material.uniforms.uTint.value.set(...th.sun);
  sun.material.uniforms.uFlat.value = th.flat || 0;
  [glowCore, glowInner, glowOuter].forEach((g) => { g.visible = th.glow > 0; g.material.opacity = g.userData.op * th.glow; });
  bloom.strength = th.bloom; bloom.enabled = th.bloom > 0;
  ambient.color.set(th.amb[0]); ambient.intensity = th.amb[1];
  const bm = window.__beltMat; if (bm) { bm.color.set(th.belt[0]); bm.opacity = th.belt[1]; }

}
// Auto-fit: every frame, measure the planets' on-screen extent (rings included, Sun centre kept
// on-canvas) and gently zoom/pan so the moving system stays between the masthead and captions.
const fit = { zoom: 1, pan: new THREE.Vector3() };
const fitV = new THREE.Vector3(), fitR = new THREE.Vector3(), fitU = new THREE.Vector3();
var fitGain = 0.3; // fast settle on load/resize, then gentle
function autoFit() {
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  if (!w || !h) return;
  camera.updateMatrixWorld();
  fitR.setFromMatrixColumn(camera.matrixWorld, 0); fitU.setFromMatrixColumn(camera.matrixWorld, 1);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const b of bodies) {
    b.obj.getWorldPosition(fitV);
    const c = fitV.clone().project(camera), e = fitV.addScaledVector(fitR, b.ext || 0).project(camera);
    const px = (c.x * 0.5 + 0.5) * w, py = (-c.y * 0.5 + 0.5) * h, rp = Math.abs(e.x - c.x) * 0.5 * w;
    x0 = Math.min(x0, px - rp); x1 = Math.max(x1, px + rp); y0 = Math.min(y0, py - rp); y1 = Math.max(y1, py + rp);
  }
  const cr = window.__copyRects;
  const top = Math.max(0.16 * h, cr && cr.masthead ? cr.masthead.y1 + 16 : 0);
  const bot = cr && cr.facts ? cr.facts.y0 - 16 : 0.72 * h;
  const L = 0.03 * w, Rr = 0.97 * w;
  const need = Math.max((x1 - x0) / (Rr - L), (y1 - y0) / Math.max(40, bot - top));
  const want = need > 1 ? need : need < 0.82 ? need / 0.82 : 1;
  fit.zoom = THREE.MathUtils.clamp(fit.zoom * (1 + (want - 1) * fitGain), 0.75, 2.2);
  const dx = (L + Rr) / 2 - (x0 + x1) / 2, dy = (top + bot) / 2 - (y0 + y1) / 2;
  const dist = camera.position.distanceTo(sun.position);
  const wpp = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h;
  fit.pan.addScaledVector(fitR, -dx * wpp * fitGain).addScaledVector(fitU, dy * wpp * fitGain);
  fitGain = Math.max(0.035, fitGain * 0.97);
  fit.pan.clampLength(0, 40);
}
function tick() {
  const want = document.documentElement.dataset.theme || 'night';
  const facts = window.__copyRects && window.__copyRects.facts;
  const sh = renderer.domElement.clientHeight || 1;
  orbitCut.value = facts ? 1 - 2 * (facts.y0 - 6) / sh : -2;
  if (want !== themeName) applyTheme(want);
  const t = clock.getElapsedTime();
  // slow camera drift around the hero framing
  const dt = Math.min(0.05, t - lastT); lastT = t;
  // cinematic: slow auto-orbit around the Sun, user drag adds momentum, then eases back to auto
  view.idle += dt;
  view.yaw += view.vYaw;
  // when idle, ease back toward a gentle side-to-side arc that keeps the hero framing
  if (!view.dragging && view.idle > 6) view.yaw += (Math.sin(t * 0.05) * 0.03 - view.yaw) * 0.01;
  view.yaw = THREE.MathUtils.clamp(view.yaw, -0.21, 0.21); // +/-12 deg azimuth
  view.pitch = THREE.MathUtils.clamp(view.pitch + view.vPitch, -0.07, 0.07); // +/-4 deg elevation
  view.vYaw *= 0.92; view.vPitch *= 0.92;
  if (view.idle > 6 && !view.dragging) view.pitch *= 0.99;
  view.zoom += (view.tZoom - view.zoom) * 0.08;
  if (!view.dragging && view.idle > 6) view.tZoom += (BASE_ZOOM - view.tZoom) * 0.01;

  sun.rotation.y = t * 0.02;
  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i];
    // real orbital motion: Mercury laps in 20 s, others scale with sqrt(period) (Neptune ~9 min)
    b.theta += dt * (Math.PI * 2) / (20 * Math.sqrt(b.period / 88));
    const focus = window.__focusPlanet === b.name ? 1.18 : 1; b.obj.scale.setScalar(b.obj.scale.x + (focus - b.obj.scale.x) * 0.12);
    const th = b.theta;
    if (b.obj.userData.moon) b.obj.userData.moon.position.set(Math.cos(t * 1.3) * b.obj.userData.moonR, 0, -Math.sin(t * 1.3) * b.obj.userData.moonR);
    ellipsePoint(b.a, b.e, th, b.obj.position);
    const spin = (t * 0.5) / Math.max(0.4, Math.sqrt(b.day / 24));
    b.mesh.rotation.y = b.retro ? -spin : spin;
    if (b.mesh.userData.clouds) b.mesh.userData.clouds.rotation.y = t * 0.02;
  }
  scene.traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uSun) o.material.uniforms.uSun.value.copy(sun.position); });

  autoFit();
  const pitchAxis = tmp.crossVectors(yAxis, camBase).normalize();
  const z = view.zoom * fit.zoom;
  camera.position.copy(camBase).applyAxisAngle(pitchAxis, -view.pitch).multiplyScalar(z).applyAxisAngle(yAxis, view.yaw).add(fit.pan);
  camera.position.y += Math.sin(t * 0.11) * 0.5;
  camera.lookAt(tmpL.copy(target).multiplyScalar(z).applyAxisAngle(yAxis, view.yaw).add(fit.pan));

  composer.render();

  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  camera.updateMatrixWorld();
  window.__labelAnchors = bodies.map((b) => anchorFor(b.name, b.obj.getWorldPosition(tmp2.clone()), b.radius, w, h));
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.__scene = { scene, camera, renderer, bodies, composer, bloom };
