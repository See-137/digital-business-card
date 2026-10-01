/**
 * C-137 portal: three r186 on WebGPU (automatic WebGL2 fallback).
 *
 * The vortex funnel, the portal gun and its beam are the same composition as
 * the r128 version; the shaders are rewritten in TSL so one source compiles to
 * WGSL or GLSL. New: a GPU-driven particle stream that spirals into the funnel
 * (every particle is computed from its instance index and the clock, so the
 * CPU does nothing per particle), bloom, adaptive resolution, and a hard pause
 * whenever the stage is off-screen or the tab is hidden.
 *
 * Loaded lazily by app.js after first paint, only when the stage is near the
 * viewport. Pins: ?webgl=1 forces the WebGL2 backend, ?motion=0 renders one
 * still frame, ?t=<seconds> pins the clock.
 */
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, uv, float, vec2, vec3, sin, cos, atan, mix, smoothstep, pow, fract, max,
  oneMinus, positionLocal, mx_fractal_noise_float, instanceIndex, hash, pass, length,
} from 'three/tsl';
import { bloom } from '../vendor/three/addons/BloomNode.js';

const STILL_T = 4.2;

/**
 * Per-device budgets. Phones (narrow or coarse pointer) get 30 fps, a lower
 * pixel-ratio ceiling, no MSAA and one noise octave less; desktops 60 fps.
 * Every running frame also counts toward an idle timer: after IDLE_MS with no
 * input the portal freezes on its current frame until the next input.
 */
const PHONE = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const BUDGET = PHONE
  ? { fps: 30, maxPr: 1.25, antialias: false, octaves: 3, motes: 900 }
  : { fps: 60, maxPr: 1.5, antialias: true, octaves: 4, motes: 2200 };
const IDLE_MS = 60000;
const BG = 0x050c08;

/** Funnel profile shared by the mesh and the particles (lathe space, mouth at y = 0). */
const profile = (u) => 1.6 * Math.pow(1 - u, 0.58) + 0.03;

/**
 * three r186 reports shader / pipeline failures through its console function
 * (and WebGPU through `uncapturederror`) instead of throwing, which would leave
 * a black canvas over the poster. Startup errors are collected here and turned
 * into a thrown failure, so app.js keeps the poster.
 */
function watchStartupErrors(renderer) {
  const errors = [];
  const previous = THREE.getConsoleFunction();
  THREE.setConsoleFunction((type, message, ...params) => {
    if (type === 'error') errors.push(String(message));
    (console[type] || console.log)(message, ...params);
  });
  const device = renderer.backend.device;
  const onGpuError = (e) => errors.push(e.error?.message || 'GPU error');
  device?.addEventListener?.('uncapturederror', onGpuError);
  return {
    errors,
    stop() {
      THREE.setConsoleFunction(previous);
      device?.removeEventListener?.('uncapturederror', onGpuError);
    },
  };
}

export async function startPortal(opts) {
  const renderer = new THREE.WebGPURenderer({ canvas: opts.canvas, antialias: BUDGET.antialias, forceWebGL: opts.pins.webgl });
  try {
    await renderer.init();
    return await buildPortal(renderer, opts);
  } catch (err) {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    throw err;
  }
}

async function buildPortal(renderer, opts) {
  const watch = watchStartupErrors(renderer);
  try {
    return await buildScene(renderer, opts, watch);
  } finally {
    watch.stop();
  }
}

async function buildScene(renderer, { canvas, wrap, pins, onJump }, watch) {
  const still = pins.still;
  const narrow = matchMedia('(max-width: 900px)').matches;
  canvas.dataset.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl';

  const maxPr = Math.min(window.devicePixelRatio || 1, BUDGET.maxPr);
  let pr = maxPr;
  const size = () => ({ w: wrap.clientWidth || 500, h: wrap.clientHeight || 360 });
  renderer.setPixelRatio(pr);
  renderer.setSize(size().w, size().h, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(46, size().w / size().h, 0.1, 60);
  camera.position.set(0, 0, 5.6);
  // r128 values converted to r155+ physical units (legacy intensity x PI, decay 1).
  scene.add(new THREE.AmbientLight(0x9fb8c8, 0.5 * Math.PI));
  const key = new THREE.PointLight(0x9cff2e, 1.4 * Math.PI, 18, 1);
  key.position.set(0, 1.0, 2.4);
  scene.add(key);

  const uTime = uniform(0);
  const uGain = uniform(1);
  const uBoost = uniform(0);

  // ---------------------------------------------------------------- funnel
  // Same palette and swirl maths as the original GLSL; fbm is MaterialX
  // fractal noise (4 octaves) remapped to 0..1.
  const nz = (p) => mx_fractal_noise_float(p, BUDGET.octaves, 2.0, 0.5).mul(0.5).add(0.5);
  const funnelColor = Fn(() => {
    const ang = uv().x.mul(6.28318);
    const dep = uv().y;
    const sw = ang.add(dep.mul(6.0)).sub(uTime.mul(1.5));
    const c1 = vec2(cos(sw), sin(sw)).mul(1.35);
    const c2 = vec2(cos(sw.mul(2.0)), sin(sw.mul(2.0))).mul(1.1);
    const q = vec2(
      nz(vec3(c1.x, c1.y.add(dep.mul(4.0)).sub(uTime.mul(0.9)), 0.0)),
      nz(vec3(c1.x.add(5.2), c1.y.add(dep.mul(4.0)).add(uTime.mul(0.7)), 1.7)),
    );
    const n = nz(vec3(c1.mul(1.7).add(q.mul(1.8)).add(vec2(0.0, dep.mul(7.0).sub(uTime.mul(1.9)))), 3.1));
    const streak = nz(vec3(c2.mul(2.3).add(q.mul(1.2)).add(vec2(0.0, dep.mul(12.0).sub(uTime.mul(3.1)))), 5.3));
    const col = mix(vec3(0.02, 0.11, 0.03), vec3(0.08, 0.42, 0.06), smoothstep(0.3, 0.62, n)).toVar();
    col.assign(mix(col, vec3(0.36, 0.8, 0.22), smoothstep(0.6, 0.88, n)));
    col.addAssign(vec3(0.78, 1.0, 0.58).mul(smoothstep(0.84, 1.0, streak)).mul(0.45));
    col.mulAssign(mix(1.0, 0.05, pow(dep, 1.35)));
    col.addAssign(vec3(0.4, 0.9, 0.35).mul(smoothstep(0.88, 1.0, dep)).mul(0.2));
    // Authored as display (sRGB) values; the pipeline works in linear.
    return pow(col.mul(uGain), vec3(2.2));
  });
  const funnelWobble = Fn(() => {
    const p = positionLocal;
    const a = atan(p.z, p.x);
    const mouth = smoothstep(-1.2, 0.0, p.y);
    const wob = sin(a.mul(5.0).add(uTime.mul(1.6))).mul(0.55).add(sin(a.mul(9.0).sub(uTime.mul(2.4))).mul(0.45));
    const k = wob.mul(0.032).mul(mouth).add(1.0);
    return vec3(p.x.mul(k), p.y, p.z.mul(k));
  });

  const lathe = (scale, dy, segs) => {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28;
      pts.push(new THREE.Vector2(profile(u) * scale, -u * 2.1 + dy));
    }
    return new THREE.LatheGeometry(pts, segs);
  };

  const funnelMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  funnelMat.colorNode = funnelColor();
  funnelMat.positionNode = funnelWobble();
  const funnel = new THREE.Mesh(lathe(1, 0, narrow ? 96 : 128), funnelMat);
  const shell = new THREE.Mesh(
    lathe(1.035, -0.02, 64),
    new THREE.MeshStandardNodeMaterial({ color: 0x0d1420, roughness: 0.92, metalness: 0.25 }),
  );

  // ---------------------------------------------------------------- particle stream
  // Each particle: a seed from its instance index; life 0..1 loops on the
  // clock. Outside the rim it spirals inward on the mouth plane, then follows
  // the funnel wall down and fades out in the throat.
  const COUNT = BUDGET.motes;
  const seed = hash(instanceIndex);
  const seed2 = hash(instanceIndex.add(1013));
  const seed3 = hash(instanceIndex.add(2027));
  const life = fract(seed.add(uTime.mul(seed2.mul(0.16).add(0.07))));
  const dive = max(life.sub(0.22), 0.0).div(0.78);
  const wall = float(1.6).mul(pow(oneMinus(dive), 0.58)).add(0.03).mul(seed3.mul(0.18).add(0.78));
  const radius = mix(seed3.mul(1.1).add(2.0), wall, smoothstep(0.0, 0.22, life));
  const ang = seed.mul(6.2832).add(life.mul(10.0)).sub(uTime.mul(0.35));
  const fade = smoothstep(0.0, 0.08, life).mul(oneMinus(smoothstep(0.78, 1.0, life)));

  const motesMat = new THREE.PointsNodeMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false,
  });
  motesMat.positionNode = vec3(cos(ang).mul(radius), dive.mul(-2.1).add(seed2.mul(0.06)), sin(ang).mul(radius));
  // Soft round sprites: a radial falloff on each point's quad (they rendered
  // as hard squares, most visibly at phone pixel ratios). Slightly larger to
  // keep the same visual weight once the corners fade out.
  const disc = smoothstep(0.5, 0.12, length(uv().sub(0.5)));
  motesMat.sizeNode = seed3.mul(3.4).add(2.2).mul(uBoost.mul(0.6).add(1.0));
  motesMat.colorNode = mix(vec3(0.42, 1.0, 0.16), vec3(0.8, 1.0, 0.62), seed2).mul(uBoost.mul(1.4).add(1.1));
  motesMat.opacityNode = fade.mul(disc).mul(0.9);
  const motes = new THREE.Sprite(motesMat);
  motes.count = COUNT;
  motes.frustumCulled = false;

  const group = new THREE.Group();
  for (const m of [funnel, shell, motes]) {
    m.rotation.x = Math.PI / 2;
    group.add(m);
  }
  group.rotation.y = 0.35;
  group.position.y = 0.7;
  scene.add(group);

  // ---------------------------------------------------------------- portal gun + beam
  const uBeam = uniform(0.55);
  const metal = new THREE.MeshStandardNodeMaterial({ color: 0x0c1310, metalness: 0.85, roughness: 0.34 });
  const emitter = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 1.15, 26), metal);
  barrel.rotation.z = -Math.PI / 2;
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.06, 14, 30),
    new THREE.MeshStandardNodeMaterial({ color: 0x1a241f, metalness: 0.7, roughness: 0.4 }),
  );
  collar.position.x = 0.28;
  collar.rotation.y = Math.PI / 2;
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), new THREE.MeshBasicNodeMaterial({ color: 0x9cff2e }));
  muzzle.position.x = 0.62;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.2), metal);
  grip.position.set(-0.34, -0.34, 0);
  grip.rotation.z = 0.24;
  emitter.add(barrel, collar, muzzle, grip);
  emitter.position.set(-2.25, 0.32, 0.7);
  emitter.rotation.y = 0.2;
  scene.add(emitter);
  const gunLight = new THREE.PointLight(0x9cff2e, 0.7 * Math.PI, 6, 1);
  gunLight.position.set(-1.7, 0.34, 0.9);
  scene.add(gunLight);

  const A = new THREE.Vector3(-1.62, 0.34, 0.58);
  const B = new THREE.Vector3(-0.1, 0.66, 0.28);
  const dir = new THREE.Vector3().subVectors(B, A);
  const beamMat = new THREE.MeshBasicNodeMaterial({
    color: 0xbfff7a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  beamMat.opacityNode = uBeam;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.15, dir.length(), 18, 1, true), beamMat);
  beam.position.copy(A).addScaledVector(dir, 0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  scene.add(beam);

  // ---------------------------------------------------------------- post
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  pipeline.outputNode = color.add(bloom(color, 0.62, 0.38, 0.5));

  // ---------------------------------------------------------------- input
  let down = false, lastX = 0, sx = 0, sy = 0, moved = false, tYaw = 0.35;
  const onDown = (e) => { down = true; moved = false; lastX = sx = e.clientX; sy = e.clientY; canvas.style.cursor = 'grabbing'; };
  const onMove = (e) => {
    if (!down) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    if (Math.abs(e.clientX - sx) > 5 || Math.abs(e.clientY - sy) > 5) moved = true;
    tYaw = Math.max(-0.5, Math.min(1.1, tYaw + dx * 0.006));
    if (still) render(0);
  };
  const onUp = (e) => {
    const was = down;
    down = false;
    canvas.style.cursor = 'grab';
    if (was && !moved && e.target === canvas) onJump();
  };
  const onCancel = () => { down = false; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);

  // ---------------------------------------------------------------- loop
  let tAcc = pins.t ?? (still ? STILL_T : 0);
  let boost = 0, boostT = 0, last = performance.now(), slow = 0, running = false, onScreen = true, paused = false, idle = false;

  function render(dt) {
    boost = still ? 0 : boost + (boostT - boost) * 0.07;
    if (!still && pins.t === undefined) tAcc += dt * (1 + boost * 2.6);
    uTime.value = tAcc;
    uGain.value = 1 + boost * 0.55;
    uBoost.value = boost;
    group.rotation.y += (tYaw - group.rotation.y) * (still ? 1 : 0.08);
    if (!still) {
      uBeam.value = Math.min(1, 0.42 + 0.18 * Math.sin(tAcc * 7.0) + boost * 0.4);
      muzzle.scale.setScalar(1 + 0.1 * Math.sin(tAcc * 9.0) + boost * 0.5);
    }
    pipeline.render();
  }

  // Adaptive resolution, measured against this device's frame budget (a 120 Hz
  // phone that sinks to 50 fps is "slow" here; a fixed 24 ms threshold never
  // noticed). Reacts within ~20 frames while starting up, ~45 afterwards.
  const frameMs = 1000 / BUDGET.fps;
  const startedAt = performance.now();
  function adapt(dt) {
    slow = dt * 1000 > frameMs * 1.35 ? slow + 1 : Math.max(0, slow - 2);
    const patience = performance.now() - startedAt < 2000 ? 20 : 45;
    if (slow > patience && pr > 1) {
      pr = Math.max(1, pr - 0.25);
      renderer.setPixelRatio(pr);
      renderer.setSize(size().w, size().h, false);
      slow = 0;
    }
  }

  const idleMs = Number.isFinite(pins.idleMs) ? pins.idleMs : IDLE_MS;
  let lastInput = performance.now(), frames = 0;
  function tick() {
    const now = performance.now();
    if (now - last < frameMs - 2) return; // frame cap: skip display frames above the budget
    if (now - lastInput > idleMs) { // nobody is interacting: freeze until the next input
      idle = true;
      updateLoop();
      return;
    }
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    adapt(dt);
    render(dt);
    frames++;
  }
  const onInput = () => {
    lastInput = performance.now();
    if (idle) {
      idle = false;
      updateLoop();
    }
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart']) {
    window.addEventListener(type, onInput, { passive: true });
  }

  function updateLoop() {
    const should = !still && !paused && !idle && onScreen && !document.hidden;
    if (should && !running) {
      last = performance.now();
      renderer.setAnimationLoop(tick);
      running = true;
    } else if (!should && running) {
      renderer.setAnimationLoop(null);
      running = false;
    }
  }

  const ro = new ResizeObserver(() => {
    const { w, h } = size();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!running) render(0);
  });
  ro.observe(wrap);
  const io = new IntersectionObserver((es) => { onScreen = es.some((e) => e.isIntersecting); updateLoop(); });
  io.observe(wrap);
  document.addEventListener('visibilitychange', updateLoop);

  // Everything this portal attached; the renderer itself is disposed by the
  // caller on failure, or by dispose() below.
  function teardown() {
    renderer.setAnimationLoop(null);
    running = false;
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', updateLoop);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart']) window.removeEventListener(type, onInput);
    pipeline.dispose();
  }

  // Compile everything up front, draw one frame, and give the GPU a moment to
  // report validation errors before the canvas is revealed.
  try {
    await renderer.compileAsync(scene, camera);
    render(0);
    await new Promise((r) => setTimeout(r, 120));
  } catch (err) {
    watch.errors.push(String(err));
  }
  if (watch.errors.length) {
    teardown();
    throw new Error(`portal startup failed: ${watch.errors[0]}`);
  }
  updateLoop();

  return {
    backend: canvas.dataset.backend,
    /** Read-only snapshot for tests and debugging. */
    state: () => ({ fps: BUDGET.fps, maxPr: BUDGET.maxPr, pr, antialias: BUDGET.antialias, octaves: BUDGET.octaves, motes: COUNT, running, idle, paused, frames }),
    /** Charge the portal (1) or let it settle (0). */
    /** Pause-motion control: freeze on the current frame, or resume. */
    setPaused(v) {
      paused = Boolean(v);
      updateLoop();
      if (paused) render(0);
    },
    setBoost(v) {
      boostT = v;
      if (still) render(0);
    },
    dispose() {
      teardown();
      renderer.dispose();
    },
  };
}
