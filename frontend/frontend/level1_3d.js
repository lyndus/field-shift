/* Field Shift – 3D world (Three.js) + Level 1 "Meet your farm: the harvest".
   The level rules, texts, hints, risk cards and scoring are the ones in game.js (LEVELS["1"]);
   this file only replaces how the player experiences them. */
(function () {
  "use strict";
  if (!window.THREE) return;
  const A = window.FS_APP, GM = window.FS_GAME, L = GM.L;
  const S = () => A.S;

  // ============================================================ WORLD: reusable 3D farm
  const PAL = { apple: 0x6cc04a, appleD: 0x4a9e2f, core: 0xffe9a8, orch: 0xe8552f, jean: 0x2f9bd6, jeanD: 0x1f78ab };
  const SOILC = { sandy: 0xe8b878, clay: 0xa65f34, loam: 0xb8743f };
  const CEREAL = ["wheat", "barley", "oat"];
  const HEADC = { wheat: 0xffc83a, barley: 0xdcc770, oat: 0xb5ea86, lentil: 0x6cc04a, chickpea: 0x9be070, faba: 0x58ad38, vetch: 0x7a5fa0 };
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o));
  const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function furrowTex(hex) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const col = "#" + hex.toString(16).padStart(6, "0"); g.fillStyle = col; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 8; i++) { g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(0, i * 16 + 10, 128, 5); g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(0, i * 16 + 6, 128, 3); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.08})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function skyTex(top, bottom) {
    const c = document.createElement("canvas"); c.width = 2; c.height = 256; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(0.62, bottom); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  class World {
    constructor(canvas, opts = {}) {
      this.canvas = canvas; this.opts = opts; this.t = 0; this.updaters = [];
      const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.useLegacyLights = false;
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.LinearToneMapping; r.toneMappingExposure = 1.0;
      const sc = this.scene = new THREE.Scene();
      sc.background = skyTex(opts.skyTop || "#45b8f0", opts.skyBottom || "#d9f3ff");
      sc.fog = new THREE.Fog(opts.fog || 0xcdeeff, 90, 210);
      this.cam = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
      // orbit state
      this.orb = { theta: 0.75, phi: 0.98, radius: 34, target: new THREE.Vector3(0, 0.6, 0) };
      this.orbGoal = { theta: 0.75, phi: 0.98, radius: 34, target: new THREE.Vector3(0, 0.6, 0) };
      // lights
      sc.add(new THREE.HemisphereLight(0xdff4ff, 0x8ccf5c, 1.25));
      const sun = this.sun = new THREE.DirectionalLight(0xfff1cc, 2.2);
      sun.position.set(-26, 38, 18); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
      Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 5, far: 110 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
      sc.add(sun);
      this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }));
      this.sunDisc.position.set(-90, 75, 40); sc.add(this.sunDisc);
      this.buildTerrain(); this.buildClouds();
      this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
      this.resize = this.resize.bind(this); window.addEventListener("resize", this.resize); this.resize();
    }
    resize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.fov = w < h ? 46 : 36; this.cam.updateProjectionMatrix(); }
    buildTerrain() {
      const g = new THREE.PlaneGeometry(260, 260, 90, 90); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, cols = [], cA = new THREE.Color(0x74c94a), cB = new THREE.Color(0x52b03a), cC = new THREE.Color(0xa6e06a), tmp = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
        const n = Math.sin(x * 0.09) * Math.cos(z * 0.11) + Math.sin(x * 0.031 + z * 0.047) * 1.6;
        const h = d > 30 ? (d - 30) * 0.06 * (1.6 + n) : 0;
        p.setY(i, Math.max(-0.05, h));
        tmp.copy(cA).lerp(n > 0.6 ? cC : cB, Math.min(1, Math.abs(n) * 0.35)); cols.push(tmp.r, tmp.g, tmp.b);
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; this.scene.add(m); this.ground = m;
      // dirt road
      const road = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 60), std(0xe59a52, { roughness: 0.95 })); road.position.set(15.5, 0.04, 26); road.receiveShadow = true; this.scene.add(road);
      this.flowers();
      // distant hills & trees
      for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2 + Math.sin(k) * 0.2, d = 46 + (k % 4) * 9; this.tree(Math.cos(a) * d, Math.sin(a) * d, 1.2 + (k % 3) * 0.5); }
    }
    tree(x, z, s = 1) {
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.7, 10), std(0x9a5b2e, { roughness: 0.8 })); trunk.position.y = 0.85; t.add(trunk);
      const greens = [0x4fb33a, 0x6fcf4a, 0x8fdc5a, 0x5cbf3f];
      [[0, 2.5, 0, 1.25], [0.75, 2.05, 0.25, 0.9], [-0.7, 2.1, -0.2, 0.85], [0.1, 3.15, -0.1, 0.8], [-0.2, 2.0, 0.65, 0.75]].forEach((v, i) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(v[3], 18, 14), std(greens[i % 4], { roughness: 0.65 })); b.position.set(v[0], v[1], v[2]); t.add(b); });
      if (Math.abs(Math.sin(x * 3.1 + z)) > 0.6) [[0.9, 2.3, 0.7], [-0.6, 2.7, 0.8], [0.2, 2.1, 1.1]].forEach(([a, b2, c]) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), std(0xff7a45, { roughness: 0.4 })); f.position.set(a, b2, c); t.add(f); });
      t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      t.position.set(x, this.heightAt(x, z), z); t.scale.setScalar(s); t.rotation.y = x * 7; this.scene.add(t); return t;
    }
    flowers() {
      // little colourful meadow flowers and bushes (instanced, cheap)
      const N = 260, geo = new THREE.SphereGeometry(0.16, 8, 6), mesh = new THREE.InstancedMesh(geo, std(0xffffff, { roughness: 0.5 }), N);
      const cols = [0xff6b6b, 0xffd93d, 0xffffff, 0xff9ff3, 0x8ad6fb, 0xffa94d], d = new THREE.Object3D(), c = new THREE.Color();
      for (let k = 0; k < N; k++) {
        const a = k * 2.399, r = 17 + (k % 37) * 0.75 + Math.sin(k) * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        d.position.set(x, this.heightAt(x, z) + 0.15, z); d.scale.setScalar(0.8 + (k % 5) * 0.12); d.updateMatrix(); mesh.setMatrixAt(k, d.matrix); mesh.setColorAt(k, c.setHex(cols[k % cols.length]));
      }
      this.scene.add(mesh);
      const bush = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 14, 10), std(0x5cbf3f, { roughness: 0.7 }), 36);
      for (let k = 0; k < 36; k++) { const a = k * 1.7, r = 24 + (k % 9) * 1.6, x = Math.cos(a) * r, z = Math.sin(a) * r; d.position.set(x, this.heightAt(x, z) + 0.35, z); d.scale.set(1.2, 0.8, 1.1); d.updateMatrix(); bush.setMatrixAt(k, d.matrix); bush.setColorAt(k, c.setHex(k % 3 ? 0x5cbf3f : 0x7ed957)); }
      bush.castShadow = true; this.scene.add(bush);
    }
    heightAt(x, z) { const d = Math.hypot(x, z); if (d <= 30) return 0; const n = Math.sin(x * 0.09) * Math.cos(z * 0.11) + Math.sin(x * 0.031 + z * 0.047) * 1.6; return Math.max(-0.05, (d - 30) * 0.06 * (1.6 + n)); }
    buildClouds() {
      this.clouds = [];
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.97, emissive: 0xffffff, emissiveIntensity: 0.25 });
      for (let k = 0; k < 7; k++) {
        const c = new THREE.Group();
        for (let j = 0; j < 5; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random() * 1.6, 16, 12), mat); b.position.set(j * 2.6 - 4, Math.random() * 1.2, Math.random() * 2); c.add(b); }
        c.position.set(-90 + k * 30, 34 + (k % 3) * 6, -95 + (k % 3) * 14); c.userData.v = 1.2 + (k % 3) * 0.5; this.scene.add(c); this.clouds.push(c);
      }
      this.cloudMat = mat;
    }
    setWeather(w) { // day | harvest | dry | storm | dusk
      const sky = { day: ["#45b8f0", "#d9f3ff", 0xcdeeff, 1.0], harvest: ["#56bff2", "#ffefc4", 0xfde9c4, 1.03], dry: ["#e8c48e", "#f6ecd2", 0xf0e0c0, 1.18], storm: ["#6f7f86", "#b9c2bf", 0xa9b2b0, 0.82], dusk: ["#b78f7a", "#e9dcc4", 0xd8c9b0, 0.9], heat: ["#e59a58", "#f6d8ae", 0xf0cfa0, 1.22], salt: ["#c3d3d8", "#f2f2e8", 0xe6e9e2, 1.1], soil: ["#b7ad92", "#ece5cf", 0xe0d8c0, 1.0] }[w] || ["#7fd2fb", "#e6f6ff", 0xdff3ff, 1.08];
      this.weather = w;
      this.sunDisc.material.color.setHex(w === "heat" || w === "dry" ? 0xffb35a : 0xffe2a0); this.sunDisc.scale.setScalar(w === "heat" ? 2.2 : w === "dry" ? 1.6 : 1); this.sunDisc.visible = w !== "storm";
      this.sun.intensity = w === "storm" ? 1.2 : w === "heat" ? 3.0 : 2.4;
      this.scene.background = skyTex(sky[0], sky[1]); this.scene.fog.color.setHex(sky[2]); this.renderer.toneMappingExposure = sky[3];
      this.cloudMat.color.setHex(w === "storm" ? 0x75828a : 0xffffff);
    }
    pick(ev, objs) {
      const r = this.canvas.getBoundingClientRect();
      this.ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.cam); return this.ray.intersectObjects(objs, true);
    }
    groundPoint(ev, y = 0.35) {
      const r = this.canvas.getBoundingClientRect(); this.ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.cam); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), out = new THREE.Vector3();
      return this.ray.ray.intersectPlane(pl, out) ? out : null;
    }
    project(v) { const p = v.clone().project(this.cam); return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, vis: p.z < 1 }; }
    flyTo(goal, speed) { Object.assign(this.orbGoal, goal); if (goal.target) this.orbGoal.target = goal.target.clone(); this.flySpeed = speed || 2.6; }
    frame(dt) {
      this.t += dt;
      const o = this.orb, gl = this.orbGoal, k = Math.min(1, dt * (RM ? 20 : this.flySpeed || 2.6));
      o.theta += (gl.theta - o.theta) * k; o.phi += (gl.phi - o.phi) * k; o.radius += (gl.radius - o.radius) * k; o.target.lerp(gl.target, k);
      const sp = Math.sin(o.phi), R = o.radius * (this.cam.aspect < 1 ? 1 + (1 - this.cam.aspect) * 1.25 : 1);
      this.cam.position.set(o.target.x + R * sp * Math.sin(o.theta), o.target.y + R * Math.cos(o.phi), o.target.z + R * sp * Math.cos(o.theta));
      this.cam.lookAt(o.target);
      this.clouds.forEach((c) => { c.position.x += c.userData.v * dt; if (c.position.x > 110) c.position.x = -110; });
      this.updaters.forEach((f) => f(dt, this.t));
      this.renderer.render(this.scene, this.cam);
    }
    dispose() {
      window.removeEventListener("resize", this.resize);
      this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
      this.renderer.dispose();
    }
  }

  // ------------------------------------------------------------ particles (chaff, sparks, confetti, fire, smoke)
  class Particles {
    constructor(world, n, size, opacity = 1) {
      this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.grav = new Float32Array(n); this.i = 0;
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
      this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, depthWrite: false }));
      this.pts.frustumCulled = false; world.scene.add(this.pts);
      for (let k = 0; k < n; k++) this.pos[k * 3 + 1] = -99;
      world.updaters.push((dt) => this.step(dt));
    }
    emit(x, y, z, count, color, spread = 1, up = 3, grav = 9, life = 1.2, vx = 0, vz = 0) {
      const c = new THREE.Color(color);
      for (let k = 0; k < count; k++) {
        const i = this.i = (this.i + 1) % this.n;
        this.pos.set([x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread], i * 3);
        this.vel.set([(Math.random() - 0.5) * spread * 3 + vx, up * (0.5 + Math.random()), (Math.random() - 0.5) * spread * 3 + vz], i * 3);
        const v = 0.85 + Math.random() * 0.3; this.col.set([c.r * v, c.g * v, c.b * v], i * 3); this.life[i] = life * (0.6 + Math.random() * 0.6); this.grav[i] = grav;
      }
    }
    step(dt) {
      for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) continue; this.life[i] -= dt;
        this.vel[i * 3 + 1] -= this.grav[i] * dt; for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
        if (this.life[i] <= 0 || this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = -99; this.life[i] = 0; } }
      this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------ farm field with instanced crops
  class Field {
    constructor(world, o) {
      this.w = world; this.cols = o.cols; this.rows = o.rows; this.P = 4.2; this.gap = 0.45; this.crop = o.crop;
      const P = this.P, G = this.gap, W = this.W = this.cols * (P + G) - G, D = this.D = this.rows * (P + G) - G;
      this.group = new THREE.Group(); world.scene.add(this.group);
      // raised field bed
      const path = new THREE.Mesh(new THREE.BoxGeometry(W + 6.2, 0.08, D + 6.2), std(0xe59a52, { roughness: 0.95 })); path.position.y = 0.04; path.receiveShadow = true; this.group.add(path);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, 0.22, D + 1.4), std(0x8a5a33, { roughness: 1 })); bed.position.y = 0.11; bed.receiveShadow = true; this.group.add(bed);
      this.soilHex = SOILC[S().farm.soil] || 0xb8743f;
      const tex = furrowTex(this.soilHex);
      this.plots = []; this.centers = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(P, 0.3, P), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: 0xffffff }));
        const x = -W / 2 + P / 2 + c * (P + G), z = -D / 2 + P / 2 + r * (P + G);
        m.position.set(x, 0.32, z); m.receiveShadow = true; m.userData.plot = this.plots.length; this.group.add(m); this.plots.push(m); this.centers.push(new THREE.Vector3(x, 0.47, z));
      }
      // fence
      const postG = new THREE.CylinderGeometry(0.1, 0.12, 1.1, 10), postM = std(0xb0733f, { roughness: 0.8 }), railM = std(0xd29a5a);
      const fence = (x1, z1, x2, z2) => { const len = Math.hypot(x2 - x1, z2 - z1), n = Math.ceil(len / 2.4);
        for (let k = 0; k <= n; k++) { const p = new THREE.Mesh(postG, postM); p.position.set(x1 + (x2 - x1) * k / n, 0.55, z1 + (z2 - z1) * k / n); p.castShadow = true; this.group.add(p); }
        [0.45, 0.85].forEach((y) => { const r2 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), railM); r2.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); r2.rotation.y = -Math.atan2(z2 - z1, x2 - x1); r2.castShadow = true; this.group.add(r2); }); };
      const fx = W / 2 + 1.6, fz = D / 2 + 1.6;
      fence(-fx, -fz, fx, -fz); fence(-fx, -fz, -fx, fz); fence(fx, -fz, fx, fz - 4.5); fence(-fx, fz, fx - 4.5, fz);
      this.buildCrops(o.crop);
      this.done = new Set(); this.fall = new Float32Array(this.plots.length);
      world.updaters.push((dt, t) => this.step(dt, t));
    }
    buildCrops(crop) {
      const cer = CEREAL.includes(crop), per = this.per = cer ? 49 : 25, N = per * this.plots.length;
      const stemG = cer ? new THREE.CylinderGeometry(0.03, 0.045, 1.25, 4) : new THREE.CylinderGeometry(0.04, 0.05, 0.5, 4);
      stemG.translate(0, cer ? 0.625 : 0.25, 0);
      const headG = cer ? new THREE.CapsuleGeometry(0.11, 0.42, 2, 6) : new THREE.SphereGeometry(0.36, 12, 10);
      this.stemH = cer ? 1.25 : 0.5; this.cer = cer;
      this.stems = new THREE.InstancedMesh(stemG, std(cer ? 0xd8b24a : 0x5aa83a), N);
      this.heads = new THREE.InstancedMesh(headG, std(HEADC[crop] || 0xffc83a, { flatShading: !cer }), N);
      [this.stems, this.heads].forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.w.scene.add(m); });
      this.base = [];
      const P = this.P;
      this.plots.forEach((pm, pi) => {
        const side = Math.round(Math.sqrt(per)), c = this.centers[pi];
        for (let k = 0; k < per; k++) {
          const gx = (k % side + 0.5) / side - 0.5, gz = (Math.floor(k / side) + 0.5) / Math.ceil(per / side) - 0.5;
          this.base.push({ x: c.x + gx * (P - 0.6) + (Math.random() - 0.5) * 0.25, z: c.z + gz * (P - 0.6) + (Math.random() - 0.5) * 0.25, ry: Math.random() * 6, s: 0.85 + Math.random() * 0.3, ph: Math.random() * 6, lean: (Math.random() - 0.5) * 0.12 });
        }
      });
      // straw (shown after harvest)
      const strawN = 26 * this.plots.length;
      this.straw = new THREE.InstancedMesh(new THREE.BoxGeometry(0.75, 0.035, 0.07), std(0xf5cf6a), strawN); this.straw.receiveShadow = true; this.w.scene.add(this.straw);
      this.strawBase = []; const d = new THREE.Object3D();
      this.plots.forEach((pm, pi) => { const c = this.centers[pi]; for (let k = 0; k < 26; k++) { const b = { x: c.x + (Math.random() - 0.5) * (P - 0.5), z: c.z + (Math.random() - 0.5) * (P - 0.5), ry: Math.random() * 3.14, y: 0.49 + Math.random() * 0.05 }; this.strawBase.push(b); d.position.set(b.x, -5, b.z); d.updateMatrix(); this.straw.setMatrixAt(this.strawBase.length - 1, d.matrix); } });
      this.strawVis = new Float32Array(this.plots.length); // 0 none, 1 normal, 0.4 thin, 1.6 mulch
      this.dummy = new THREE.Object3D(); this.m4 = new THREE.Matrix4(); this.tTop = new THREE.Matrix4();
    }
    plotAt(p) { if (!p) return -1; let best = -1, bd = 1e9; this.centers.forEach((c, i) => { const d = Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)); if (d < bd) { bd = d; best = i; } }); return bd <= this.P / 2 + 0.2 ? best : -1; }
    harvest(i) { if (this.done.has(i)) return false; this.done.add(i); this.fall[i] = 0.0001; this.strawVis[i] = 1; return true; }
    setStraw(i, v) { this.strawVis[i] = v; }
    step(dt, t) {
      const d = this.dummy, wind = 1 + Math.sin(t * 0.4) * 0.4;
      this.base.forEach((b, k) => {
        const pi = Math.floor(k / this.per); let f = this.fall[pi];
        if (f > 0 && f < 1 && k % this.per === 0) this.fall[pi] = f = Math.min(1, f + dt * 2.6);
        f = this.fall[pi];
        const sway = Math.sin(t * 1.7 + b.ph + b.x * 0.25) * 0.07 * wind * (1 - f);
        const tilt = f < 1 ? f * 1.45 : 0, sy = f >= 1 ? 0.16 : 1;
        d.position.set(b.x, 0.47, b.z); d.rotation.set(sway * 0.6 + b.lean, b.ry, sway + tilt); d.scale.set(b.s, b.s * sy, b.s); d.updateMatrix(); this.stems.setMatrixAt(k, d.matrix);
        if (f >= 1) { d.scale.set(0, 0, 0); d.updateMatrix(); this.heads.setMatrixAt(k, d.matrix); return; }
        d.scale.set(b.s, b.s, b.s); d.updateMatrix(); this.m4.copy(d.matrix); this.tTop.makeTranslation(0, this.cer ? this.stemH + 0.12 : this.stemH, 0); this.m4.multiply(this.tTop); this.heads.setMatrixAt(k, this.m4);
      });
      this.stems.instanceMatrix.needsUpdate = true; this.heads.instanceMatrix.needsUpdate = true;
      this.strawBase.forEach((b, k) => { const pi = Math.floor(k / 26), v = this.strawVis[pi], show = v > 0 && (k % 26) / 26 < Math.min(1, v) && this.fall[pi] >= 1;
        d.position.set(b.x, show ? b.y + (v > 1.2 ? 0.06 * (k % 3) : 0) : -5, b.z); d.rotation.set(0, b.ry, 0); d.scale.set(1, v > 1.2 ? 2.2 : 1, v > 1.2 ? 1.6 : 1); d.updateMatrix(); this.straw.setMatrixAt(k, d.matrix); });
      this.straw.instanceMatrix.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------ props
  function house(w, x, z) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), std(PAL.core)); walls.position.y = 1.5; g.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 2.2, 4), std(PAL.orch, { flatShading: true })); roof.position.y = 4.1; roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, 0.85); g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.7, 0.1), std(PAL.jean)); door.position.set(0.8, 0.85, 2.02); g.add(door);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.1), std(0xa6e1ff, { roughness: 0.3, metalness: 0.2 })); win.position.set(-1.2, 1.8, 2.02); g.add(win);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.4, 12), std(0xd29a5a));
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.8), std(0xc98a4b)); step.position.set(0.8, 0.12, 2.3); g.add(step);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), std(0x5cbf3f)); flower.position.set(-1.9, 0.4, 2.3); g.add(flower); ch.position.set(1.4, 4.4, -0.6); g.add(ch);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, 0, z); g.rotation.y = 0.5; w.scene.add(g); return g;
  }
  function tank(w, x, z) {
    const g = new THREE.Group();
    [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 5), std(0x8a7158)); l.position.set(a, 0.8, b); g.add(l); });
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.2, 16), std(PAL.jean, { roughness: 0.5, metalness: 0.3 })); t.position.y = 2.7; g.add(t);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 16), std(PAL.jeanD)); top.position.y = 4.05; g.add(top);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4, 6), std(PAL.jeanD)); pipe.rotation.z = Math.PI / 2; pipe.position.set(-2, 0.2, 0); g.add(pipe);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z); w.scene.add(g); return g;
  }
  function rainGauge(w, x, z) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), std(0x8a6a48)); post.position.y = 0.6; g.add(post);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.9, 12, 1, true), std(0xcdeeff, { transparent: true, opacity: 0.7, side: THREE.DoubleSide })); cup.position.y = 1.6; g.add(cup);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.23, 0.25, 12), std(0x4fb2f0)); water.position.y = 1.28; g.add(water);
    g.position.set(x, 0, z); w.scene.add(g); return g;
  }
  function shovel(w, x, z) {
    const g = new THREE.Group();
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 0.2, 14), std(0x6e4527)); pit.position.y = 0.05; g.add(pit);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(SOILC[S().farm.soil] || 0xb8743f, { roughness: 0.9 })); mound.position.set(1.1, 0, 0.3); mound.scale.y = 0.6; g.add(mound);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 6), std(0x9a6a3c)); h.position.set(0.2, 1.0, 0); h.rotation.z = -0.25; g.add(h);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.05), std(0xb9c4c9, { metalness: 0.6, roughness: 0.4 })); blade.position.set(-0.05, 0.05, 0); blade.rotation.z = -0.25; g.add(blade);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z); w.scene.add(g); return g;
  }
  function sheep(w) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), std(0xfffdf4, { roughness: 0.95 })); body.scale.set(1.3, 0.95, 0.95); body.position.y = 0.85; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.5), std(0x3f3a30)); head.position.set(0, 1.0, 0.85); g.add(head);
    [[-0.3, -0.35], [0.3, -0.35], [-0.3, 0.35], [0.3, 0.35]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 5), std(0x3f3a30)); l.position.set(a, 0.25, b); g.add(l); });
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    w.scene.add(g); return g;
  }
  function bale(w) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 16), std(0xf5cf6a, { roughness: 0.85 })); m.rotation.z = Math.PI / 2; m.castShadow = true;
    const g = new THREE.Group(); g.add(m); w.scene.add(g); return g;
  }
  function combine(w) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 3.4), std(PAL.orch, { roughness: 0.5 })); body.position.y = 1.5; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.3), std(0xa6e1ff, { roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 })); cab.position.set(0, 2.8, 0.6); g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.15, 1.5), std(PAL.orch)); roof.position.set(0, 3.45, 0.6); g.add(roof);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.6, 8), std(0xff7a45)); pipe.rotation.z = 1.2; pipe.position.set(-1.6, 2.6, -0.6); g.add(pipe);
    const header = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 0.9), std(0x8a7158, { metalness: 0.4 })); header.position.set(0, 0.6, 2.3); g.add(header);
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 4.4, 8, 1, true), std(PAL.core, { wireframe: true })); reel.rotation.z = Math.PI / 2; reel.position.set(0, 1.15, 2.5); g.add(reel); g.userData.reel = reel;
    [[-1.25, 0.6, 1], [1.25, 0.6, 1], [-1.25, 0.45, -1.1], [1.25, 0.45, -1.1]].forEach(([x, r, z]) => { const wh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.45, 14), std(0x24506a)); wh.rotation.z = Math.PI / 2; wh.position.set(x, r, z); g.add(wh); });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    w.scene.add(g); return g;
  }
  function hotspot(w, pos, color = PAL.orch) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.55; g.add(ring);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), std(color, { emissive: color, emissiveIntensity: 0.45, flatShading: true })); gem.position.y = 4.4; g.add(gem);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 5, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 2.5; g.add(hit);
    g.position.copy(pos); w.scene.add(g); g.userData = { ring, gem, hit };
    w.updaters.push((dt, t) => { if (!g.visible) return; gem.position.y = 4.4 + Math.sin(t * 2.5) * 0.25; gem.rotation.y += dt * 1.6; const s = 1 + Math.sin(t * 4) * 0.08; ring.scale.set(s, s, s); });
    return g;
  }

  // ------------------------------------------------------------ Ammi Salah, the 3D farmer
  class Salah {
    constructor(w, x, z) {
      this.w = w; const g = this.g = new THREE.Group();
      const skin = std(0xd99a6c), shirt = std(PAL.jean), pants = std(0x3f4a3a), dark = std(0x3a2a20), hatM = std(0xf2d27a, { roughness: 0.8 });
      this.hipL = new THREE.Group(); this.hipR = new THREE.Group(); [this.hipL, this.hipR].forEach((h, i) => { h.position.set(i ? 0.17 : -0.17, 0.85, 0);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.82, 8), pants); leg.position.y = -0.42; h.add(leg);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.38), dark); shoe.position.set(0, -0.82, 0.07); h.add(shoe); g.add(h); });
      this.body = new THREE.Group(); this.body.position.y = 0.85; g.add(this.body);
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.5, 4, 12), shirt); torso.position.y = 0.45; torso.scale.z = 0.8; this.body.add(torso);
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.09, 14), std(0x8a5a33)); belt.position.y = 0.12; belt.scale.z = 0.8; this.body.add(belt);
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 14), std(PAL.orch)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.92; this.body.add(scarf);
      this.armL = new THREE.Group(); this.armR = new THREE.Group(); [this.armL, this.armR].forEach((a, i) => { a.position.set(i ? 0.43 : -0.43, 0.82, 0);
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.48, 3, 8), shirt); arm.position.y = -0.32; a.add(arm);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skin); hand.position.y = -0.66; a.add(hand); this.body.add(a); });
      this.head = new THREE.Group(); this.head.position.y = 1.25; this.body.add(this.head);
      const face = this.face = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), skin.clone()); this.head.add(face);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin); nose.position.set(0, -0.02, 0.33); this.head.add(nose);
      [-1, 1].forEach((s) => { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), skin); ear.position.set(0.33 * s, 0, 0); this.head.add(ear); });
      this.eyes = [-1, 1].map((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), std(0x1e1a16)); e.position.set(0.12 * s, 0.07, 0.3); this.head.add(e); return e; });
      this.brows = [-1, 1].map((s) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.04), dark); b.position.set(0.12 * s, 0.17, 0.31); this.head.add(b); return b; });
      [-1, 1].forEach((s) => { const mu = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 2, 6), dark); mu.position.set(0.08 * s, -0.11, 0.31); mu.rotation.z = s * 1.2; this.head.add(mu); });
      this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), std(0x6b2a20)); this.mouth.position.set(0, -0.18, 0.3); this.mouth.rotation.z = Math.PI; this.head.add(this.mouth);
      [-1, 1].forEach((s) => { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0xe07c64, { transparent: true, opacity: 0.45 })); ch.position.set(0.2 * s, -0.06, 0.26); this.head.add(ch); });
      const hat = this.hat = new THREE.Group(); hat.position.y = 0.26; hat.rotation.z = 0.06; this.head.add(hat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.05, 22), hatM); hat.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.32, 16), hatM); crown.position.y = 0.17; hat.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.08, 16), std(PAL.orch)); band.position.y = 0.06; hat.add(band);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.scale.setScalar(1.7); g.position.set(x, 0, z); w.scene.add(g);
      this.home = new THREE.Vector3(x, 0, z); this.target = null; this.mood = "happy"; this.act = "wave"; this.actT = 0; this.blink = 2;
      const hit = this.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.8, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.4; g.add(hit);
      w.updaters.push((dt, t) => this.step(dt, t));
    }
    walkTo(v, then) { this.target = new THREE.Vector3(v.x, 0, v.z); this.onArrive = then; this.act = "walk"; }
    play(a, dur = 2.2) { this.act = a; this.actT = dur; }
    setMood(m) { this.mood = m; }
    headPos() { const p = new THREE.Vector3(); this.head.getWorldPosition(p); p.y += 1.4; return p; }
    step(dt, t) {
      const g = this.g;
      if (this.target) {
        const d = this.target.clone().sub(g.position); d.y = 0; const dist = d.length();
        if (dist < 0.15) { this.target = null; this.act = "idle"; const f = this.onArrive; this.onArrive = null; f && f(); }
        else { const sp = Math.min(dist, dt * 6.5); g.position.addScaledVector(d.normalize(), sp); const ang = Math.atan2(d.x, d.z); g.rotation.y += (((ang - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10); }
      } else {
        const c = this.w.cam.position, ang = Math.atan2(c.x - g.position.x, c.z - g.position.z), aim = this.lookAt ? Math.atan2(this.lookAt.x - g.position.x, this.lookAt.z - g.position.z) : ang;
        g.rotation.y += (((aim - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 4);
      }
      if (this.actT > 0) { this.actT -= dt; if (this.actT <= 0 && this.act !== "walk") { this.act = "idle"; this.lookAt = null; } }
      const walk = this.act === "walk", sw = walk ? Math.sin(t * 11) * 0.6 : 0;
      this.hipL.rotation.x = sw; this.hipR.rotation.x = -sw;
      let aL = -sw * 0.8, aR = sw * 0.8, aLz = 0, aRz = 0, bodyY = 0.85 + Math.sin(t * 2) * 0.012, headTilt = 0, headNod = 0;
      if (walk) bodyY += Math.abs(Math.sin(t * 11)) * 0.05;
      if (this.act === "wave") { aRz = 2.6 + Math.sin(t * 9) * 0.35; }
      if (this.act === "point") { aR = -1.45; aRz = 0.2; headNod = 0.12; }
      if (this.act === "celebrate") { aLz = -2.7; aRz = 2.7; bodyY += Math.abs(Math.sin(t * 8)) * 0.45; }
      if (this.act === "talk") { aR = -0.4 + Math.sin(t * 5) * 0.25; headNod = Math.sin(t * 6) * 0.05; }
      if (this.mood === "worried") { headTilt = 0.18; aL = -0.5; aLz = -0.4; }
      if (this.mood === "angry") { aLz = -0.5; aRz = 0.5; bodyY += Math.sin(t * 30) * 0.02; }
      this.armL.rotation.set(aL, 0, aLz); this.armR.rotation.set(aR, 0, aRz);
      this.body.position.y = bodyY; this.head.rotation.set(headNod, 0, headTilt);
      // face
      const br = this.mood === "angry" ? [-0.35, 0.35] : this.mood === "worried" ? [0.3, -0.3] : [0.06, -0.06];
      this.brows[0].rotation.z = br[0]; this.brows[1].rotation.z = br[1];
      this.brows.forEach((b) => (b.position.y = this.mood === "angry" ? 0.14 : 0.17));
      this.mouth.rotation.z = this.mood === "happy" ? Math.PI : 0; this.mouth.position.y = this.mood === "happy" ? -0.18 : -0.22;
      this.face.material.color.setHex(this.mood === "angry" ? 0xe0785a : 0xd99a6c);
      this.blink -= dt; const bl = this.blink < 0.12 ? 0.1 : 1; if (this.blink < 0) this.blink = 2.5 + Math.random() * 2; this.eyes.forEach((e) => (e.scale.y = bl));
    }
  }

  // ============================================================ HUD helpers
  const $ = (id) => document.getElementById(id);
  const ICON = {
    hand: '<path d="M8 14V6a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5a1.5 1.5 0 0 1 3 0v8M17 12V8a1.5 1.5 0 0 1 3 0v6c0 5-3 8-7 8s-6-2-8-6l-2-4a1.5 1.5 0 0 1 2.6-1.5L8 15" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    sickle: '<path d="M5 22 L12 15 M12 15 C12 6 21 4 24 9 C18 8 14 12 14 16" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    combine: '<rect x="4" y="11" width="15" height="8" rx="2" fill="currentColor"/><rect x="12" y="6" width="7" height="6" rx="1" fill="currentColor" opacity=".7"/><circle cx="8" cy="21" r="2.6" fill="currentColor"/><circle cx="17" cy="21" r="2.6" fill="currentColor"/><path d="M2 10v10" stroke="currentColor" stroke-width="2.4"/>',
    plough: '<path d="M4 8 L19 8 L23 19 L9 19 Z" fill="currentColor" opacity=".8"/><path d="M4 8 L2 4" stroke="currentColor" stroke-width="2"/>',
    can: '<rect x="5" y="10" width="13" height="11" rx="2" fill="currentColor"/><path d="M18 13 L25 8" stroke="currentColor" stroke-width="2.4"/><path d="M7 10 q4 -6 9 0" stroke="currentColor" stroke-width="2" fill="none"/>',
  };
  function bubble(text, tone) {
    const el = $("x3bub"); if (!el) return;
    const tag = tone === "hint" ? `<span class="x3tag t-hint">💡 ${L("تلميح", "Hint")} ${Math.min(3, GM.LV.hintStage)}/3</span>` : tone === "bad" || tone === "warn" ? `<span class="x3tag t-warn">⚠ ${L("تحذير", "Warning")}</span>` : tone === "good" ? `<span class="x3tag t-good">✔ ${L("أحسنت", "Nice")}</span>` : tone === "info" ? `<span class="x3tag t-info">ℹ ${L("معلومة", "Did you know")}</span>` : "";
    el.className = "x3bub show tone-" + tone; el.innerHTML = `${tag}<div>${text}</div><button class="x3rep" data-act="g" data-a="replay" aria-label="${L("إعادة", "Replay")}">🔊</button>`;
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  }

  // ============================================================ LEVEL 1 (3D)
  let RT = null;
  A.SCREENS.l1x = () => {
    const T = (k) => `<svg width="28" height="28" viewBox="0 0 26 26" aria-hidden="true">${ICON[k]}</svg>`;
    return `<div class="x3" id="x3">
      <canvas id="x3c" tabindex="0" aria-label="${L("مزرعتك ثلاثية الأبعاد. اسحب لتدوير الكاميرا، المس لتتفاعل.", "Your 3D farm. Drag to turn the camera, tap to interact.")}"></canvas>
      <div class="x3vign"></div>
      <div class="x3top">
        <button class="x3b" data-act="g" data-a="leave" aria-label="${L("الخريطة", "Map")}"><svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2z M7 3v12 M13 5v12" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg></button>
        <div class="x3title"><small>${L("المستوى 1", "Level 1")}</small><b>${L("تعرّف على مزرعتك", "Meet your farm")}</b></div>
        <button class="x3b x3tea" data-act="g" data-a="hint" aria-label="${L("اكشف السر: تلميح", "Spill the tea: get a hint")}"><svg width="24" height="24" viewBox="0 0 22 22" aria-hidden="true"><path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10h2a2 2 0 0 1 0 4h-2 M8 3c0 2 2 2 2 4 M12 3c0 2 2 2 2 4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg><span>${L("تلميح", "Hint")}</span></button>
        <button class="x3b" data-act="x3mute" id="x3mute" aria-label="${L("الصوت", "Sound")}">${GM.G().mute ? "🔇" : "🔊"}</button>
      </div>
      <div class="x3mission" id="x3m" aria-live="polite"></div>
      <div class="x3bub" id="x3bub" aria-live="polite"></div>
      <div id="x3labels"></div>
      <div class="x3combo" id="x3combo"></div>
      <div class="x3bottom">
        <div class="x3prog" id="x3prog" hidden><i id="x3pb"></i><span id="x3pt"></span></div>
        <div class="x3tools" id="x3tools" hidden role="radiogroup" aria-label="${L("الأدوات", "Tools")}">
          ${[["hand", L("تجوّل", "Look")], ["sickle", L("منجل", "Sickle")], ["combine", L("حصادة", "Combine")], ["plough", L("محراث", "Plough")], ["can", L("مرشّة", "Can")]].map(([k, n]) => `<button class="x3tool" role="radio" data-act="x3tool" data-v="${k}" aria-checked="false">${T(k)}<span>${n}</span></button>`).join("")}
        </div>
        <div class="x3panel" id="x3panel"></div>
      </div>
      <div class="x3cam"><button data-act="x3cam" data-d="-0.6" aria-label="${L("تدوير", "Rotate")}">↺</button><button data-act="x3cam" data-d="0.6" aria-label="${L("تدوير", "Rotate")}">↻</button><button data-act="x3zoom" aria-label="${L("تقريب", "Zoom")}">⤢</button></div>
    </div>`;
  };

  A.AFTER.l1x = () => {
    cleanup();
    const def = GM.LEVELS["1"]; def.init();
    const st = GM.LV.st, f = S().farm, area = +f.area || 5, big = area >= 5;
    document.body.classList.add("x3on");
    const w = new World($("x3c"));
    w.setWeather("harvest");
    const field = new Field(w, { cols: 4, rows: 4, crop: st.crop });
    const parts = new Particles(w, 900, 0.16), smoke = new Particles(w, 260, 1.1, 0.45);
    const hx = -field.W / 2 - 9, hz = 3;
    house(w, hx, hz);
    const irrig = f.irrig && f.irrig !== "rain";
    const waterObj = irrig ? tank(w, field.W / 2 + 6, -field.D / 2 + 1) : rainGauge(w, field.W / 2 + 4, -field.D / 2 + 1);
    if (f.irrig === "sprinkler") field.centers.forEach((c, i) => { if (i % 3 !== 1) return; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), std(PAL.jeanD)); s.position.set(c.x + 1.6, 1.3, c.z + 1.6); s.castShadow = true; w.scene.add(s); });
    if (f.irrig === "drip") for (let r = 0; r < 4; r++) { const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, field.W, 6), std(0x1e2e33)); tube.rotation.z = Math.PI / 2; tube.position.set(0, 0.5, field.centers[r * 4].z + 1.4); w.scene.add(tube); }
    if (f.irrig === "flood") { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, field.D + 1), std(0x4fb2f0, { roughness: 0.15, metalness: 0.3 })); ch.position.set(-field.W / 2 - 0.9, 0.3, 0); w.scene.add(ch); }
    const soilObj = shovel(w, -field.W / 2 + 2, field.D / 2 + 3.6);
    w.tree(hx - 4, hz - 6, 1.3); w.tree(field.W / 2 + 5, field.D / 2 + 6, 1.1); w.tree(-field.W / 2 - 4, -field.D / 2 - 5, 1.4);
    const flock = []; for (let k = 0; k < 3; k++) { const sh = sheep(w); sh.position.set(hx + 2 + k * 1.6, 0, hz + 6 + (k % 2)); sh.rotation.y = k; flock.push({ g: sh, home: sh.position.clone(), goal: null }); }
    w.updaters.push((dt, t) => flock.forEach((s, k) => { if (s.goal) { const d = s.goal.clone().sub(s.g.position); d.y = 0; if (d.length() > 0.2) { s.g.position.addScaledVector(d.normalize(), dt * 3.2); s.g.rotation.y = Math.atan2(d.x, d.z); s.g.position.y = Math.abs(Math.sin(t * 9 + k)) * 0.12; } else s.g.position.y = 0; } }));
    const salah = new Salah(w, -field.W / 2 - 3, field.D / 2 + 1.5);
    const cmb = big ? combine(w) : null; if (cmb) { cmb.position.set(15.5, 0, 34); cmb.visible = false; }
    const bales = [];
    // hotspots
    const HS = [
      { k: "crop", pos: field.centers[5].clone().setY(0), label: L("محصولك", "Your crop") },
      { k: "water", pos: waterObj.position.clone(), label: irrig ? L("خزان الماء", "Water tank") : L("مقياس المطر", "Rain gauge") },
      { k: "soil", pos: soilObj.position.clone(), label: L("تربتك", "Your soil") },
    ].map((h) => Object.assign(h, { g: hotspot(w, h.pos), seen: false }));
    const labels = $("x3labels");
    labels.innerHTML = HS.map((h, i) => `<button class="x3label" id="x3l${i}" data-act="x3hs" data-i="${i}">🔍 ${h.label}</button>`).join("");

    RT = { w, field, parts, smoke, salah, st, big, cmb, phase: "intro", combo: 0, comboT: 0, drag: null, HS, bales, flock, inspected: 0, gestureWrong: false, cmbGoal: null };
    window.__say3 = (text, mood, tone, silent) => { salah.setMood(mood || "happy"); if (tone === "good") salah.play("celebrate", 1.4); else if (tone !== "hint" && mood === "happy") salah.play("talk", 2.2); bubble(text, tone || "n"); if (!silent) GM.speak(text); };

    // intro camera flight
    w.orb.radius = 80; w.orb.phi = 0.5; w.orb.theta = -0.6;
    w.flyTo({ radius: 36, phi: 0.98, theta: 0.7, target: new THREE.Vector3(-2, 0.6, 1) }, 0.9);
    salah.play("wave", 4);
    setTimeout(() => { if (RT && RT.w === w) { RT.phase = "explore"; mission(); GM.say(def.intro(), "happy", "n"); setTimeout(() => RT && RT.w === w && GM.say(L(`أولًا، تجوّل في مزرعتك يا ${GM.pname()}! المس الأشياء المضيئة الثلاثة.`, `First, look around your farm, ${GM.pname()}! Tap the 3 glowing things.`), "happy", "info", true), 5200); } }, RM ? 100 : 1800);

    // ---------------- input: orbit / swipe-harvest / tap
    const cv = $("x3c");
    const fieldHit = (ev) => { const p = w.groundPoint(ev); return p && Math.abs(p.x) < field.W / 2 + 0.3 && Math.abs(p.z) < field.D / 2 + 0.3 ? p : null; };
    cv.addEventListener("pointerdown", (ev) => {
      cv.setPointerCapture(ev.pointerId);
      const harvestMode = RT.phase === "harvest" && st.tool && st.tool !== "hand" && fieldHit(ev);
      RT.drag = { x: ev.clientX, y: ev.clientY, moved: 0, mode: harvestMode ? "harvest" : "orbit", th: w.orbGoal.theta, ph: w.orbGoal.phi };
      RT.combo = 0; RT.gestureWrong = false;
      if (harvestMode) swipeAt(ev);
    });
    cv.addEventListener("pointermove", (ev) => {
      const d = RT.drag; if (!d) return; d.moved = Math.max(d.moved, Math.hypot(ev.clientX - d.x, ev.clientY - d.y));
      if (d.mode === "orbit") { w.orbGoal.theta = d.th - (ev.clientX - d.x) * 0.006; w.orbGoal.phi = Math.max(0.35, Math.min(1.35, d.ph - (ev.clientY - d.y) * 0.004)); w.flySpeed = 9; }
      else swipeAt(ev);
    });
    const up = (ev) => {
      const d = RT.drag; RT.drag = null; RT.cmbGoal = null; if (!d) return;
      if (d.moved < 8) tap(ev);
      if (d.mode === "harvest" && RT.combo >= 3) comboText(RT.combo, true);
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", () => (RT.drag = null));
    cv.addEventListener("wheel", (ev) => { ev.preventDefault(); w.orbGoal.radius = Math.max(16, Math.min(60, w.orbGoal.radius + ev.deltaY * 0.03)); w.flySpeed = 6; }, { passive: false });
    cv.addEventListener("keydown", (ev) => { if ((ev.key === " " || ev.key === "Enter") && RT.phase === "harvest") { ev.preventDefault(); const i = field.plots.findIndex((_, k) => !field.done.has(k)); if (i >= 0) tryHarvest(i); } });

    function tap(ev) {
      const hits = w.pick(ev, [salah.hit, ...HS.filter((h) => h.g.visible).map((h) => h.g.userData.hit), ...field.plots]);
      if (!hits.length) return;
      const o = hits[0].object;
      if (o === salah.hit) { GM.snd("tap"); salah.play("wave", 1.5); GM.say(RT.phase === "explore" ? L("المس الأشياء المضيئة لنكتشف مزرعتك معًا!", "Tap the glowing things and we'll discover your farm together!") : RT.phase === "tool" ? L("اختر أداة من الحزام في الأسفل.", "Pick a tool from the belt below.") : RT.phase === "harvest" ? L("اسحب إصبعك فوق السنابل لتحصدها!", "Swipe across the crop to harvest it!") : L("أنا هنا إذا احتجتني. جرّب زر التلميح!", "I'm here if you need me. Try the hint button!"), "happy", "n"); return; }
      const hi = HS.findIndex((h) => h.g.userData.hit === o); if (hi >= 0) return inspect(hi);
      if (o.userData.plot != null && RT.phase === "harvest") { if (!st.tool || st.tool === "hand") { pulseTools(); GM.say(L("اختر أداة أولًا!", "Pick a tool first!"), "worried", "warn"); } else { RT.combo = 0; tryHarvest(o.userData.plot); } }
      else if (o.userData.plot != null && RT.phase === "explore") inspect(0);
    }
    function swipeAt(ev) {
      if (st.tool === "combine" && cmb) { const p = w.groundPoint(ev, 0); if (p) RT.cmbGoal = p; return; }
      const i = field.plotAt(fieldHit(ev)); if (i >= 0) tryHarvest(i);
    }
    function tryHarvest(i) {
      if (st.tool === "plough" || st.tool === "can") {
        if (!RT.gestureWrong) { RT.gestureWrong = true; st.wrong++; GM.snd("bad"); GM.say(GM.QUIPS()[st.wrong % 4], "angry", "bad"); }
        return;
      }
      if (!field.harvest(i)) return;
      st.done.add(i); st.just = i; st.left = 16 - st.done.size; RT.combo++; GM.snd("cut");
      const c = field.centers[i]; parts.emit(c.x, 1.0, c.z, 46, field.cer ? 0xffc83a : 0x6cc04a, 3.4, 3.2, 7, 1.3); parts.emit(c.x, 0.6, c.z, 14, 0xd29a5a, 3, 1.5, 4, 1);
      if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { }
      if (RT.combo >= 2) comboText(RT.combo, false);
      progress();
      if (st.done.size === 16) harvestDone();
    }
    function comboText(n, fin) {
      const el = $("x3combo"); el.textContent = fin ? L(`سلسلة رائعة ×${n}!`, `Great swipe ×${n}!`) : `×${n}`; el.className = "x3combo show" + (fin ? " big" : ""); void el.offsetWidth;
      clearTimeout(RT.comboTO); RT.comboTO = setTimeout(() => (el.className = "x3combo"), fin ? 1400 : 700);
      if (fin) GM.snd("good");
    }
    function inspect(i) {
      const h = RT.HS[i]; if (!h || h.seen || RT.phase !== "explore") { if (h && h.seen) GM.say(L("رأينا هذا. انظر إلى الأشياء الأخرى!", "We've seen this one. Look at the others!"), "happy", "n"); return; }
      h.seen = true; RT.inspected++; GM.snd("good");
      const l = GM.loc(), so = l.soil, stt = GM.cropStats(st.crop, (S().farm.history || []).find((x) => x && x !== "unknown") || "fallow");
      const fact = {
        crop: L(`هذا ${GM.cname(st.crop)}، ناضج وجاهز للحصاد. في موقعك يغطي المطر حوالي ${GM.pct(stt.ws)} من حاجته في المتوسط، و${GM.pct(stt.dry)} فقط في سنوات الجفاف.`, `That's your ${GM.cname(st.crop).toLowerCase()}, ripe and ready. Here, rain covers about ${GM.pct(stt.ws)} of its water needs on average, but only ${GM.pct(stt.dry)} in dry years.`),
        water: irrig ? L(`هذا خزانك لري ${{ drip: "التنقيط", sprinkler: "الرش", flood: "الغمر" }[S().farm.irrig] || ""}. مهم، لأن آخر 3 مواسم كانت الأجف في 30 سنة: ${l.summary.driest.map((k) => l.summary.rain_oct_may[k]).join("، ")} ملم مقابل ${l.summary.rain_mean} عادة.`, `Your tank feeds the ${S().farm.irrig} system. Good thing: the last 3 seasons were the driest in 30 years, ${l.summary.driest.map((k) => l.summary.rain_oct_may[k]).join(", ")} mm vs ${l.summary.rain_mean} usually.`)
          : L(`لا ري هنا: المطر فقط. المتوسط ${l.summary.rain_mean} ملم من أكتوبر إلى ماي، لكن آخر 3 مواسم كانت الأجف في 30 سنة.`, `No irrigation here: rain only. ${l.summary.rain_mean} mm Oct–May on average, but the last 3 seasons were the driest in 30 years.`),
        soil: L(`تربتك ${so.texture === "clay loam" ? "طميية طينية" : so.texture} (SoilGrids). تخزن حوالي ${so.paw100} ملم من الماء في المتر الأول، والانحدار ${l.slope}%. التربة العارية تنجرف!`, `Your soil is ${so.texture} (SoilGrids). It stores about ${so.paw100} mm of water in the top metre, on a ${l.slope}% slope. Bare soil washes away!`),
      }[h.k];
      w.flyTo({ target: h.pos.clone().setY(1), radius: 24 }, 2.4);
      const near = h.pos.clone().add(new THREE.Vector3(h.k === "crop" ? -3.2 : -2.2, 0, 2.2));
      salah.walkTo(near, () => { salah.lookAt = h.pos; salah.play("point", 3); GM.say(fact, "happy", "info"); });
      h.g.userData.gem.visible = false; h.g.userData.ring.material.color.setHex(0x6cc04a);
      setTimeout(() => { h.g.visible = false; }, 1600);
      $("x3l" + i).classList.add("seen");
      mission();
      if (RT.inspected === 3) setTimeout(() => { if (!RT || RT.w !== w) return; RT.phase = "tool"; w.flyTo({ target: new THREE.Vector3(0, 0.6, 1), radius: 34, phi: 0.95 }, 2);
        $("x3tools").hidden = false; $("x3tools").classList.add("rise"); mission();
        GM.say(L(`ممتاز يا ${GM.pname()}، تعرفت على مزرعتك! الآن احصد قبل الموسم الجديد. اختر الأداة المناسبة من الحزام.`, `Great, ${GM.pname()}, now you know your farm! Time to harvest before the new season. Pick the right tool from your belt.`), "happy", "good"); }, 5200);
    }
    function harvestDone() {
      GM.LV.done = true; RT.phase = "straw"; mission(); $("x3tools").hidden = true; RT.cmbGoal = null;
      GM.snd("level"); salah.play("celebrate", 2.5);
      parts.emit(0, 6, 0, 160, 0x6cc04a, 14, 6, 6, 2.2); parts.emit(0, 6, 0, 120, 0xe8552f, 14, 6, 6, 2.2); parts.emit(0, 6, 0, 120, 0xffe9a8, 14, 6, 6, 2.2);
      GM.say(L(`أحسنت يا ${GM.pname()}! الحقل محصود. الآن، ماذا نفعل بالتبن؟`, `Well done, ${GM.pname()}! The field is harvested. Now, what do we do with the straw?`), "happy", "good");
      w.flyTo({ target: new THREE.Vector3(0, 0.5, 0), radius: 30, phi: 0.85 }, 1.6);
      strawPanel();
    }
    function strawPanel() {
      $("x3prog").hidden = true;
      const opts = [["keep", "🌾", L("أتركه على التربة", "Leave it on the soil")], ["graze", "🐑", L("ترعاه الأغنام", "Let sheep graze it")], ["bale", "🧺", L("أجمعه للبيع", "Bale it for sale")], ["burn", "🔥", L("أحرقه", "Burn it")]];
      $("x3panel").innerHTML = `<div class="x3q">${L("ماذا تفعل بالتبن؟", "What do you do with the straw?")}</div><div class="x3choices">${opts.map(([k, e, n]) => `<button class="x3choice" data-act="x3straw" data-v="${k}"><span class="e">${e}</span>${n}</button>`).join("")}</div>`;
      $("x3panel").className = "x3panel show";
    }
    function resetStraw() {
      field.plots.forEach((p, i) => { p.material.color.setHex(0xffffff); field.setStraw(i, 1); });
      bales.forEach((b) => (b.visible = false)); flock.forEach((s) => (s.goal = s.home.clone())); RT.fire = 0;
    }
    function playStraw(v) {
      resetStraw();
      if (v === "keep") { field.plots.forEach((_, i) => field.setStraw(i, 1.6)); parts.emit(0, 1.2, 0, 90, 0xf5cf6a, 16, 1.5, 3, 1.2); }
      if (v === "graze") flock.forEach((s, k) => { s.goal = field.centers[[5, 6, 9][k]].clone().setY(0); field.setStraw([5, 6, 9][k], 0.4); [4, 7, 8, 10, 1].forEach((i) => field.setStraw(i, 0.55)); });
      if (v === "bale") { field.plots.forEach((_, i) => field.setStraw(i, 0)); field.centers.forEach((c, i) => { if (i % 2) return; let b = bales[i / 2]; if (!b) { b = bale(w); bales[i / 2] = b; } b.visible = true; b.position.set(c.x, 0.95, c.z); b.scale.setScalar(0.01); b.userData.t = 0; }); }
      if (v === "burn") { RT.fire = 2.6; }
    }
    w.updaters.push((dt) => {
      bales.forEach((b) => { if (b && b.visible && b.scale.x < 1) b.scale.setScalar(Math.min(1, b.scale.x + dt * 2.5)); });
      if (RT && RT.fire > 0) { RT.fire -= dt; field.centers.forEach((c, i) => { if (Math.random() < 0.6) parts.emit(c.x, 0.6, c.z, 3, Math.random() < 0.5 ? 0xff8a2a : 0xffd23a, 3, 2.5, -1, 0.7); if (Math.random() < 0.15) smoke.emit(c.x, 1.2, c.z, 1, 0x6b6560, 2, 1.6, -0.4, 2.6); const p = field.plots[i]; p.material.color.lerp(new THREE.Color(0x3a332c), dt * 0.9); field.setStraw(i, Math.max(0, field.strawVis[i] - dt * 0.5)); }); }
      // combine drive
      if (cmb && cmb.visible) {
        cmb.userData.reel.rotation.x += dt * 6;
        if (RT && RT.cmbGoal && RT.phase === "harvest") {
          const g = RT.cmbGoal.clone(); g.x = Math.max(-field.W / 2 - 1, Math.min(field.W / 2 + 1, g.x)); g.z = Math.max(-field.D / 2 - 1, Math.min(field.D / 2 + 1, g.z));
          const d = g.sub(cmb.position); d.y = 0; const dist = d.length();
          if (dist > 0.3) { cmb.position.addScaledVector(d.normalize(), Math.min(dist, dt * 9)); cmb.rotation.y += (((Math.atan2(d.x, d.z) - cmb.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6);
            const front = new THREE.Vector3(Math.sin(cmb.rotation.y) * 2.2, 0, Math.cos(cmb.rotation.y) * 2.2).add(cmb.position);
            field.centers.forEach((c, i) => { if (!field.done.has(i) && Math.hypot(c.x - front.x, c.z - front.z) < 2.9) tryHarvest(i); }); }
        }
      }
    });
    function mission() {
      const ph = RT.phase, n = st.done.size;
      const items = [
        [L(`استكشف مزرعتك (${RT.inspected}/3)`, `Explore your farm (${RT.inspected}/3)`), RT.inspected === 3, ph === "explore" || ph === "intro"],
        [L("اختر أداة الحصاد", "Pick a harvesting tool"), ["sickle", "combine"].includes(st.tool) && ph !== "tool", ph === "tool"],
        [L(`احصد الحقل (${n}/16)`, `Harvest the field (${n}/16)`), n === 16, ph === "harvest"],
        [L("قرّر مصير التبن", "Decide about the straw"), !!st.straw && (ph === "done"), ph === "straw" || ph === "strawWait"],
      ];
      $("x3m").innerHTML = `<b>${L("المهمة", "Mission")}</b>` + items.map(([t, ok, cur]) => `<div class="x3mi ${ok ? "ok" : ""} ${cur ? "cur" : ""}"><span class="ck">${ok ? "✓" : ""}</span>${t}</div>`).join("");
    }
    function progress() { $("x3prog").hidden = false; $("x3pb").style.width = (st.done.size / 16 * 100) + "%"; $("x3pt").textContent = `${st.done.size}/16`; mission(); }
    function pulseTools() { const t = $("x3tools"); t.classList.remove("pulse"); void t.offsetWidth; t.classList.add("pulse"); }
    RT.api = { mission, progress, playStraw, resetStraw, strawPanel, pulseTools, inspect };
    mission();

    // ---------------- main loop
    let last = performance.now();
    const loop = (now) => {
      if (!RT || RT.w !== w) return;
      if ($("x3c") !== w.canvas) { cleanup(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      w.frame(dt);
      // HTML anchors
      const bp = w.project(salah.headPos()), bb = $("x3bub");
      if (bb) { const bw = bb.offsetWidth, bh = bb.offsetHeight; bb.style.left = Math.max(8, Math.min(window.innerWidth - bw - 62, bp.x - bw / 2)) + "px"; bb.style.top = Math.max(118, Math.min(window.innerHeight - bh - 190, bp.y - bh - 10)) + "px"; }
      RT.HS.forEach((h, i) => { const el = $("x3l" + i); if (!el) return; const p = w.project(h.pos.clone().setY(5.6)); el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`; el.hidden = !h.g.visible || RT.phase !== "explore" || !p.vis; });
      if (RT.phase === "strawWait" && !document.querySelector(".riskov")) {
        if (st.straw) { RT.phase = "done"; mission(); $("x3panel").innerHTML = `<button class="x3go" data-act="x3finish">${L("أنهِ المستوى", "Finish the level")} ${A.fwd()}</button>`; }
        else { RT.phase = "straw"; resetStraw(); strawPanel(); mission(); }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  window.__X3 = () => RT;
  window.FS3D = { World, Particles, Salah, house, tank, sheep, std, PAL, SOILC, HEADC, CEREAL, ICON, bubble, RM };
  function cleanup() {
    if (!RT) return; try { RT.w.dispose(); } catch (e) { } RT = null; window.__say3 = null; document.body.classList.remove("x3on");
  }

  // ---------------- actions
  A.ACT.x3mute = () => { const g = GM.G(); g.mute = !g.mute; A.save(); if (g.mute) GM.stopCalmMusic && GM.stopCalmMusic(); else GM.playCalmMusic && GM.playCalmMusic(); try { speechSynthesis.cancel(); } catch (e) { } const b = $("x3mute"); if (b) b.textContent = g.mute ? "🔇" : "🔊"; };
  A.ACT.x3cam = (d) => { if (!RT) return; RT.w.orbGoal.theta += Number(d.d); RT.w.flySpeed = 3; GM.snd("whoosh"); };
  A.ACT.x3zoom = () => { if (!RT) return; const o = RT.w.orbGoal; o.radius = o.radius > 30 ? 22 : 38; o.phi = o.radius > 30 ? 0.98 : 0.85; RT.w.flySpeed = 3; };
  A.ACT.x3hs = (d) => { if (RT && RT.api) RT.api.inspect(+d.i); };
  A.ACT.x3tool = (d) => {
    if (!RT || RT.phase === "explore" || RT.phase === "intro") return;
    const st = RT.st;
    document.querySelectorAll(".x3tool").forEach((b) => { const on = b.dataset.v === d.v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    if (d.v === "hand") { st.tool = "hand"; GM.say(L("وضع التجوّل: اسحب لتدوير الكاميرا.", "Look mode: drag to turn the camera."), "happy", "n", true); return; }
    GM.LEVELS["1"].on("tool", d); // same rules, lines and wrong-tool counting as before
    if (RT.cmb) { RT.cmb.visible = d.v === "combine"; if (d.v === "combine") { RT.cmb.position.set(0, 0, RT.field.D / 2 + 4.5); RT.cmb.rotation.y = Math.PI; } }
    if (d.v === "sickle" || d.v === "combine") {
      if (RT.phase === "tool") { RT.phase = "harvest"; RT.api.progress(); setTimeout(() => RT && RT.phase === "harvest" && GM.say(d.v === "combine" ? L("اسحب إصبعك في الحقل: الحصادة تتبعك!", "Drag across the field: the combine follows you!") : L("اسحب إصبعك فوق السنابل لتحصدها. سلسلة طويلة = مكافأة!", "Swipe across the crop to cut it. Long swipes make combos!"), "happy", "info", true), 2600); }
      RT.api.mission();
    }
  };
  A.ACT.x3straw = (d) => {
    if (!RT || RT.phase !== "straw") return;
    RT.api.playStraw(d.v); GM.snd(d.v === "burn" ? "crack" : "tap");
    $("x3panel").className = "x3panel";
    setTimeout(() => { if (!RT) return; RT.phase = "strawWait"; GM.LEVELS["1"].on("straw", d); RT.api.mission(); }, d.v === "burn" ? 1800 : 1100);
  };
  A.ACT.x3finish = () => {
    if (!RT) return; const w = RT.w; RT.phase = "end"; $("x3panel").innerHTML = "";
    RT.salah.play("celebrate", 3); GM.snd("level");
    [0x6cc04a, 0xe8552f, 0x2f9bd6, 0xffe9a8].forEach((c) => RT.parts.emit(0, 9, 0, 120, c, 18, 5, 5, 2.5));
    w.flyTo({ radius: 46, phi: 0.7, theta: w.orbGoal.theta + 1.4 }, 1.2);
    setTimeout(() => { if (RT && RT.w === w) GM.LEVELS["1"].on("end", {}); }, RM ? 200 : 2300);
  };
})();
