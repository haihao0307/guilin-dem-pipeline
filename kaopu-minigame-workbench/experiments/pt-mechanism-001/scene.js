/**
 * Conservation room / OPEN VOLUME 07.
 * Original procedural architecture and sculpture. No remote assets or model data.
 * Units are metres; +Z is the entrance. Three.js r170-compatible.
 */
export function createGallery(THREE) {
  const scene = new THREE.Scene();
  scene.name = 'Conservation room — Open Volume';
  scene.background = new THREE.Color('#252e31');
  scene.fog = new THREE.FogExp2('#43423b', 0.013);
  const occluders = [];
  const collisions = [];
  const disposables = [];
  let phase = 0;

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function canvas(w, h = w) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    return [c, c.getContext('2d', { alpha: true })];
  }
  function texture(c, color = true) {
    const t = new THREE.CanvasTexture(c);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8; disposables.push(t); return t;
  }
  function surfaceMap(kind, seed = 71) {
    const [c, ctx] = canvas(512);
    const random = rng(seed);
    const base = kind === 'wood' ? [96, 64, 45] : kind === 'stone' ? [157, 153, 140] : [204, 198, 181];
    const pixels = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const grain = kind === 'wood'
        ? Math.sin(x * 0.35 + 1.8 * Math.sin(y * 0.009) + Math.sin(x * 0.052)) * 5
          + Math.sin(x * 1.71 + y * 0.004) * 1.8
        : Math.sin(x * 0.035) * Math.sin(y * 0.043) * 1.2;
      const n = (random() - .5) * (kind === 'stone' ? 11 : 7) + grain;
      for (let k = 0; k < 3; k++) pixels.data[i + k] = base[k] + n;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    if (kind === 'wood') {
      ctx.lineWidth = .55;
      for (let i = 0; i < 90; i++) {
        const x = random() * 512;
        ctx.strokeStyle = `rgba(29,17,12,${.025 + random() * .09})`;
        ctx.beginPath(); ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + random() * 9, 170, x - 4, 380, x + 1, 512); ctx.stroke();
      }
    } else {
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(255,251,224,${random() * .075})`;
        const r = .3 + random() * 2.2;
        ctx.beginPath(); ctx.arc(random() * 512, random() * 512, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    return texture(c);
  }
  function microBump(seed, soft = false) {
    const [c, ctx] = canvas(256); const random = rng(seed);
    const p = ctx.createImageData(256, 256);
    for (let i = 0; i < p.data.length; i += 4) {
      const n = 125 + (random() - .5) * (soft ? 22 : 76);
      p.data[i] = p.data[i + 1] = p.data[i + 2] = n; p.data[i + 3] = 255;
    }
    ctx.putImageData(p, 0, 0); return texture(c, false);
  }
  const plasterMap = surfaceMap('plaster'); plasterMap.repeat.set(2, 1);
  const woodMap = surfaceMap('wood', 9);
  const stoneMap = surfaceMap('stone', 81);
  const fine = microBump(13, true); fine.repeat.set(4, 4);
  const rough = microBump(22); rough.repeat.set(5, 5);
  const materials = {
    plaster: new THREE.MeshStandardMaterial({ color: '#efe9d9', map: plasterMap, roughness: .94, bumpMap: rough, bumpScale: .011 }),
    trim: new THREE.MeshStandardMaterial({ color: '#c1b9a4', roughness: .83, bumpMap: fine, bumpScale: .007 }),
    walnut: new THREE.MeshStandardMaterial({ color: '#b7a48f', map: woodMap, roughness: .56, bumpMap: woodMap, bumpScale: .009 }),
    walnutDark: new THREE.MeshStandardMaterial({ color: '#665446', map: woodMap, roughness: .6 }),
    brass: new THREE.MeshStandardMaterial({ color: '#796444', metalness: .83, roughness: .4, bumpMap: fine, bumpScale: .002 }),
    brassLight: new THREE.MeshStandardMaterial({ color: '#a9966f', metalness: .76, roughness: .36 }),
    stone: new THREE.MeshStandardMaterial({ color: '#dedbd0', map: stoneMap, roughness: .75, bumpMap: rough, bumpScale: .008 }),
    porcelain: new THREE.MeshPhysicalMaterial({ color: '#e1ddd0', roughness: .29, metalness: .035, clearcoat: .24, clearcoatRoughness: .31, bumpMap: fine, bumpScale: .0025, side: THREE.DoubleSide }),
    seed: new THREE.MeshPhysicalMaterial({ color: '#29383b', metalness: .35, roughness: .22, clearcoat: .35, clearcoatRoughness: .2 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1d2424', roughness: .67, metalness: .08 }),
    linen: new THREE.MeshStandardMaterial({ color: '#bcb9a5', roughness: 1, bumpMap: fine, bumpScale: .006, side: THREE.DoubleSide }),
  };
  for (const material of Object.values(materials)) { material.envMapIntensity = .32; disposables.push(material); }
  function add(geometry, material, pos, parent = scene, name = '') {
    const m = new THREE.Mesh(geometry, material);
    if (pos) m.position.set(...pos);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function box(w, h, d, pos, mat = materials.plaster, parent = scene, name = '') {
    return add(new THREE.BoxGeometry(w, h, d), mat, pos, parent, name);
  }
  function roundShape(w, h, r) {
    const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  function bevelBox(w, h, d, bevel, pos, mat, parent = scene, name = '') {
    const b = Math.min(bevel, w * .2, h * .2, d * .2);
    const g = new THREE.ExtrudeGeometry(roundShape(w - 2 * b, h - 2 * b, b), {
      depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b,
      bevelSegments: 3, steps: 1, curveSegments: 4,
    });
    g.translate(0, 0, -d / 2 + b);
    return add(g, mat, pos, parent, name);
  }
  function wall(w, h, d, pos, name) {
    const m = box(w, h, d, pos, materials.plaster, scene, name); occluders.push(m); return m;
  }
  function rod(a, b, r, material = materials.brass, parent = scene) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), v = vb.clone().sub(va);
    const m = add(new THREE.CylinderGeometry(r, r, v.length(), 12), material, null, parent);
    m.position.copy(va).add(vb).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return m;
  }
  function label(lines, w, h, pos, parent = scene, dark = false) {
    const [c, ctx] = canvas(1024, 256);
    ctx.fillStyle = dark ? '#262b29' : '#ccc8b6'; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = dark ? '#cbc5b1' : '#484d46';
    ctx.font = '500 48px Arial, sans-serif'; ctx.fillText(lines[0], 45, 92);
    ctx.font = '28px Arial, sans-serif'; ctx.fillStyle = dark ? '#858f87' : '#797f73'; ctx.fillText(lines[1] || '', 46, 158);
    ctx.fillRect(46, 190, 82, 2);
    const mat = new THREE.MeshStandardMaterial({ map: texture(c), roughness: .86 });
    return add(new THREE.PlaneGeometry(w, h), mat, pos, parent);
  }
  function contact(x, z, w, d, opacity = .35) {
    const [c, ctx] = canvas(128); const g = ctx.createRadialGradient(64, 64, 9, 64, 64, 62);
    g.addColorStop(0, 'rgba(15,19,18,.68)'); g.addColorStop(.45, 'rgba(15,19,18,.28)'); g.addColorStop(1, 'rgba(15,19,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const m = add(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: texture(c), transparent: true, opacity, depthWrite: false }), [x, .012, z]);
    m.rotation.x = -Math.PI / 2; m.castShadow = false; return m;
  }

  // Low-resolution, original studio radiance field supplies coherent glossy reflections.
  {
    const [c, ctx] = canvas(512, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#a2a796'); g.addColorStop(.40, '#817d69');
    g.addColorStop(.52, '#3f4847'); g.addColorStop(1, '#272b2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
    const glow = ctx.createRadialGradient(360, 100, 1, 360, 100, 94);
    glow.addColorStop(0, 'rgba(212,229,233,.65)'); glow.addColorStop(1, 'rgba(138,162,167,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#b8c8c6'; ctx.fillRect(351, 49, 13, 83);
    ctx.fillStyle = '#c1ad84'; ctx.fillRect(146, 30, 46, 8);
    const t = texture(c); t.mapping = THREE.EquirectangularReflectionMapping; scene.environment = t;
  }

  // Room shell. The daylight slit is a real opening, rather than a pasted bright rectangle.
  wall(.3, 3.9, 12.1, [-3.75, 1.95, -3.1], 'west plaster wall');
  wall(7.8, 3.9, .3, [0, 1.95, -9.15], 'north plaster wall');
  wall(7.8, .24, 12.1, [0, 4.02, -3.1], 'plaster ceiling');
  // East window: z -7.25..-5.9, y 1.35..3.55.
  wall(.3, 3.9, 1.75, [3.75, 1.95, -8.125], 'east rear wall');
  wall(.3, 3.9, 8.7, [3.75, 1.95, -1.55], 'east front wall');
  wall(.3, 1.35, 1.35, [3.75, .675, -6.575], 'window breast');
  wall(.3, .35, 1.35, [3.75, 3.725, -6.575], 'window lintel');
  // Entrance door has a genuine depth reveal and a separate leaf.
  wall(2.75, 3.9, .3, [-2.225, 1.95, 2.95], 'entrance left wall');
  wall(2.75, 3.9, .3, [2.225, 1.95, 2.95], 'entrance right wall');
  wall(1.7, 1.16, .3, [0, 3.32, 2.95], 'entrance lintel');
  const door = bevelBox(1.55, 2.69, .13, .017, [0, 1.365, 2.975], materials.walnutDark, scene, 'closed conservation door');
  occluders.push(door);
  for (const x of [-.835, .835]) {
    box(.125, 2.83, .18, [x, 1.415, 2.82], materials.walnut);
    box(.033, 2.83, .215, [x + Math.sign(x) * .07, 1.415, 2.81], materials.brass);
  }
  box(1.92, .14, .18, [0, 2.83, 2.82], materials.walnut);
  box(1.62, .024, .23, [0, .019, 2.81], materials.brass);
  for (const y of [.62, 1.86]) {
    const p = bevelBox(1.23, 1.02, .031, .007, [0, y, 2.89], materials.walnut);
    for (const x of [-.64, .64]) box(.025, 1.09, .036, [x, y, 2.866], materials.walnutDark);
    for (const yy of [y - .55, y + .55]) box(1.3, .025, .036, [0, yy, 2.866], materials.walnutDark);
  }
  const escutcheon = bevelBox(.095, .27, .024, .012, [.53, 1.12, 2.872], materials.brass);
  rod([.53, 1.14, 2.84], [.53, 1.14, 2.77], .016);
  rod([.53, 1.14, 2.77], [.34, 1.14, 2.77], .018);

  // Large mineral floor slabs with restrained joints and a gently worn finish.
  {
    const [c, ctx] = canvas(1024, 2048); const random = rng(121);
    ctx.fillStyle = '#696b62'; ctx.fillRect(0, 0, 1024, 2048);
    const cols = 4, rows = 9, cw = 1024 / cols, ch = 2048 / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = Math.floor(137 + random() * 14);
      ctx.fillStyle = `rgb(${v + 8},${v + 5},${v - 5})`;
      ctx.fillRect(x * cw + 1.7, y * ch + 1.5, cw - 3.4, ch - 3);
      ctx.strokeStyle = 'rgba(218,211,189,.19)'; ctx.lineWidth = 1;
      ctx.strokeRect(x * cw + 3, y * ch + 3, cw - 6, ch - 6);
    }
    for (let i = 0; i < 65000; i++) {
      ctx.fillStyle = random() > .5 ? 'rgba(55,61,56,.045)' : 'rgba(230,224,201,.065)';
      ctx.fillRect(random() * 1024, random() * 2048, random() * 2 + .5, random() * 2 + .5);
    }
    const map = texture(c);
    const mat = new THREE.MeshStandardMaterial({ map, color: '#dfded4', roughness: .63, bumpMap: map, bumpScale: .007, envMapIntensity: .2 });
    const floor = box(7.5, .15, 12, [0, -.075, -3.1], mat, scene, 'limestone floor');
    occluders.push(floor);
  }
  // Walnut wainscot: individual flush panels, narrow shadow gaps, layered rail and skirting.
  for (const side of [-1, 1]) {
    box(.072, .91, 11.8, [side * 3.555, .49, -3.1], materials.walnutDark);
    for (let i = 0; i < 11; i++) {
      const z = 2.21 - i * 1.07;
      box(.033, .675, 1.015, [side * 3.508, .485, z], materials.walnut);
      box(.061, .77, .019, [side * 3.49, .485, z - .508], materials.walnutDark);
    }
    box(.12, .115, 11.8, [side * 3.51, .107, -3.1], materials.walnutDark);
    box(.105, .055, 11.8, [side * 3.50, .98, -3.1], materials.walnut);
    box(.10, .018, 11.8, [side * 3.502, 1.026, -3.1], materials.brass);
    box(.1, .10, 11.8, [side * 3.54, 3.78, -3.1], materials.trim);
    box(.16, .057, 11.8, [side * 3.515, 3.855, -3.1], materials.trim);
    // Thin floor perimeter inlay establishes real architectural scale.
    box(.011, .002, 11.40, [side * 3.3, .005, -3.10], materials.brass);
  }
  box(7.1, .90, .07, [0, .49, -8.955], materials.walnutDark);
  for (let i = 0; i < 7; i++) box(.985, .675, .03, [-3.075 + i * 1.025, .485, -8.902], materials.walnut);
  box(7.1, .115, .12, [0, .107, -8.94], materials.walnutDark);
  box(7.1, .055, .11, [0, .98, -8.93], materials.walnut);
  box(7.1, .018, .10, [0, 1.026, -8.93], materials.brass);
  box(7.1, .10, .10, [0, 3.78, -8.95], materials.trim);
  box(7.1, .057, .16, [0, 3.855, -8.925], materials.trim);
  for (const z of [-8.7, 2.5]) box(6.6, .002, .011, [0, .005, z], materials.brass);

  // Tall, deep-set translucent window with a sill, mullion and functional light direction.
  const windowGlass = new THREE.MeshPhysicalMaterial({ color: '#b8d1d3', roughness: .52, metalness: .05,
    emissive: '#bed9e2', emissiveIntensity: .52, transparent: true, opacity: .80, side: THREE.DoubleSide });
  const glass = add(new THREE.PlaneGeometry(1.31, 2.17), windowGlass, [3.87, 2.45, -6.575]);
  glass.rotation.y = -Math.PI / 2; glass.castShadow = false;
  for (const z of [-7.285, -5.865]) {
    box(.42, 2.28, .075, [3.69, 2.45, z], materials.trim);
    box(.047, 2.15, .035, [3.865, 2.45, z + (z < -6.5 ? .053 : -.053)], materials.brass);
  }
  box(.50, .11, 1.57, [3.66, 1.32, -6.575], materials.stone);
  box(.39, .07, 1.48, [3.73, 3.59, -6.575], materials.trim);
  box(.040, 2.17, .033, [3.848, 2.45, -6.56], materials.brass);
  box(.038, .028, 1.35, [3.848, 2.79, -6.575], materials.brass);

  // Recessed rear niche. A broad quiet arch breaks the box silhouette without extra focal clutter.
  {
    const arch = new THREE.Shape();
    arch.moveTo(-1.39, 1.12); arch.lineTo(-1.39, 2.52);
    arch.bezierCurveTo(-1.39, 3.31, 1.39, 3.31, 1.39, 2.52);
    arch.lineTo(1.39, 1.12); arch.closePath();
    const niche = add(new THREE.ShapeGeometry(arch, 32), new THREE.MeshStandardMaterial({ color: '#777e73', roughness: .95, bumpMap: plasterMap, bumpScale: .004 }), [0, 0, -8.985]);
    const borderPath = new THREE.CurvePath();
    borderPath.add(new THREE.LineCurve3(new THREE.Vector3(-1.42, 1.12, -8.956), new THREE.Vector3(-1.42, 2.52, -8.956)));
    borderPath.add(new THREE.CubicBezierCurve3(new THREE.Vector3(-1.42, 2.52, -8.956), new THREE.Vector3(-1.42, 3.36, -8.956), new THREE.Vector3(1.42, 3.36, -8.956), new THREE.Vector3(1.42, 2.52, -8.956)));
    borderPath.add(new THREE.LineCurve3(new THREE.Vector3(1.42, 2.52, -8.956), new THREE.Vector3(1.42, 1.12, -8.956)));
    add(new THREE.TubeGeometry(borderPath, 96, .024, 8, false), materials.trim);
    box(2.89, .062, .115, [0, 1.11, -8.945], materials.trim);
    // A single archival plate, designed in code rather than used as a UI instruction.
    label(['CONSERVATION  /  07', 'OPEN VOLUME — PORCELAIN & BRONZE'], .66, .165, [0, 2.45, -8.94]);
  }

  // Primary plinth: chamfered limestone, dark recessed toe, thin bronze reveal.
  contact(0, -5.3, 2.35, 2.2, .65);
  const plinth = bevelBox(1.12, .98, 1.03, .034, [0, .535, -5.3], materials.stone, scene, 'sculpture plinth');
  occluders.push(plinth); collisions.push({ min: [-.65, 0, -5.90], max: [.65, 1.08, -4.70] });
  bevelBox(1.04, .056, .95, .008, [0, .033, -5.3], materials.dark);
  bevelBox(1.135, .023, 1.045, .005, [0, 1.037, -5.3], materials.brass);
  bevelBox(1.15, .028, 1.058, .007, [0, 1.062, -5.3], materials.stone);
  const plaque = label(['07  /  OPEN VOLUME', 'CAST PORCELAIN · CONSERVATION STUDY'], .34, .085, [.25, .79, -4.778]);
  plaque.rotation.y = 0;
  for (const x of [.074, .426]) add(new THREE.SphereGeometry(.0045, 8, 6), materials.brass, [x, .789, -4.774]);

  // Hero object: two original hand-formed porcelain shells embracing a dark seed.
  // The front negative space and asymmetric bronze seam carry the gaze-driven change.
  const focusTarget = new THREE.Group(); focusTarget.name = 'Open Volume sculpture';
  focusTarget.position.set(0, 1.56, -5.3); scene.add(focusTarget);
  const mount = add(new THREE.CylinderGeometry(.22, .245, .027, 64), materials.brass, [0, -.473, 0], focusTarget);
  const profile = [
    [.105, -.457], [.164, -.444], [.221, -.395], [.315, -.274], [.403, -.100],
    [.426, .086], [.391, .266], [.311, .437], [.205, .549], [.136, .586],
    [.116, .585], [.123, .558], [.180, .522], [.272, .414], [.351, .251],
    [.386, .082], [.365, -.091], [.279, -.255], [.189, -.375], [.143, -.413], [.105, -.422],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const shellLeft = new THREE.Group(), shellRight = new THREE.Group();
  focusTarget.add(shellLeft, shellRight);
  const left = add(new THREE.LatheGeometry(profile, 64, .37, Math.PI - .37), materials.porcelain, null, shellLeft, 'porcelain shell right');
  const right = add(new THREE.LatheGeometry(profile, 64, Math.PI, Math.PI - .37), materials.porcelain, null, shellRight, 'porcelain shell left');
  // Minute asymmetry avoids a sterile, perfectly turned vessel.
  left.scale.set(1.025, 1, 1); right.scale.set(.97, .988, 1.035);
  right.rotation.z = -.018;
  function rim(phi, parent, scaleX = 1) {
    const points = profile.slice(0, 10).map(p => new THREE.Vector3(Math.sin(phi) * p.x * scaleX, p.y, Math.cos(phi) * p.x));
    const curve = new THREE.CatmullRomCurve3(points);
    return add(new THREE.TubeGeometry(curve, 64, .0055, 8, false), materials.brassLight, null, parent);
  }
  rim(.37, shellLeft, 1.025); rim(Math.PI * 2 - .37, shellRight, .97);
  const innerSeed = add(new THREE.SphereGeometry(1, 48, 32), materials.seed, [0, .015, .095], focusTarget, 'dark mineral inclusion');
  innerSeed.scale.set(.135, .236, .121); innerSeed.rotation.z = -.18;
  rod([0, -.446, 0], [0, -.187, .095], .009, materials.brass, focusTarget);
  rod([-.087, -.245, .067], [-.115, -.08, .097], .007, materials.brass, focusTarget);
  rod([.087, -.245, .067], [.115, -.08, .097], .007, materials.brass, focusTarget);
  // A sculptor's three incised witness marks, engraved rather than emissive graphics.
  for (let i = 0; i < 3; i++) {
    const y = -.14 + i * .065;
    const line = rod([.296, y, .261], [.336, y + .012, .240], .0022, materials.brass, shellLeft);
  }

  // Small conservation bench, peripheral and functional. No borrowed props.
  {
    const bench = new THREE.Group(); scene.add(bench);
    bevelBox(1.84, .075, .62, .014, [-2.51, .81, -7.86], materials.walnut, bench);
    box(1.70, .095, .48, [-2.51, .715, -7.86], materials.walnutDark, bench);
    for (const x of [-3.25, -1.77]) for (const z of [-8.06, -7.66]) {
      bevelBox(.055, .70, .055, .004, [x, .365, z], materials.dark, bench);
      add(new THREE.CylinderGeometry(.04, .04, .035, 16), materials.brass, [x, .02, z], bench);
    }
    rod([-3.25, .26, -7.87], [-1.77, .26, -7.87], .017, materials.dark, bench);
    // Folded cotton work cloth, with a continuous lightly draped surface.
    const g = new THREE.PlaneGeometry(.78, .55, 24, 20);
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i);
      a.setZ(i, .003 + .006 * Math.sin(x * 41 + y * 13) + .004 * Math.sin(y * 34));
    }
    g.computeVertexNormals();
    const cloth = add(g, materials.linen, [-2.72, .86, -7.84], bench); cloth.rotation.x = -Math.PI / 2; cloth.rotation.z = -.04;
    // Closed archival folio and cotton tie, each genuinely thin at human scale.
    const cover = bevelBox(.36, .023, .27, .004, [-1.99, .863, -7.91], materials.linen, bench);
    cover.rotation.y = -.08;
    box(.355, .006, .018, [-1.99, .879, -7.91], materials.walnutDark, bench);
    const pencil = rod([-2.4, .865, -7.63], [-2.15, .865, -7.67], .004, materials.brass, bench);
    contact(-2.51, -7.86, 2.50, 1.15, .28);
    collisions.push({ min: [-3.50, 0, -8.26], max: [-1.49, .89, -7.43] });
    bench.updateMatrixWorld(true); occluders.push(...bench.children.filter(m => m.isMesh && m !== cloth));
  }

  // Lighting fixtures are modelled at real sizes. Every key has a visible source.
  const ceilingLamp = new THREE.Group(); ceilingLamp.position.set(0, 3.32, -1.25); scene.add(ceilingLamp);
  add(new THREE.CylinderGeometry(.14, .14, .055, 48), materials.brass, [0, .555, 0], ceilingLamp);
  rod([0, .525, 0], [0, .13, 0], .01, materials.dark, ceilingLamp);
  const diffuserMat = new THREE.MeshPhysicalMaterial({ color: '#ded8be', emissive: '#ffe6b8', emissiveIntensity: 1.25, roughness: .38, metalness: .015 });
  const lampProfile = [[0,.135],[.12,.132],[.215,.08],[.276,.01],[.284,-.085],[.254,-.135],[.13,-.154],[0,-.15]].map(p => new THREE.Vector2(...p));
  const diffuser = add(new THREE.LatheGeometry(lampProfile, 64), diffuserMat, [0, 0, 0], ceilingLamp, 'opaline pendant');
  diffuser.castShadow = false;
  add(new THREE.TorusGeometry(.278, .009, 8, 64), materials.brass, [0, -.077, 0], ceilingLamp).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(.079, .11, .045, 48), materials.brass, [0, .151, 0], ceilingLamp);
  const pendantLight = new THREE.PointLight('#ffe4b3', 19, 9, 2); pendantLight.position.set(0, 3.08, -1.25); scene.add(pendantLight);
  pendantLight.castShadow = false; pendantLight.shadow.mapSize.set(512, 512); pendantLight.shadow.bias = -.00015;
  pendantLight.shadow.normalBias = .02; pendantLight.shadow.camera.near = .15; pendantLight.shadow.camera.far = 9;

  // Ceiling-mounted conservation spotlight.
  add(new THREE.CylinderGeometry(.115, .115, .055, 32), materials.brass, [-.8, 3.86, -3.9]);
  const snoot = add(new THREE.CylinderGeometry(.083, .11, .20, 32), materials.brass, [-.8, 3.67, -3.9]);
  const keyTarget = new THREE.Object3D(); keyTarget.position.set(0, 1.25, -5.3); scene.add(keyTarget);
  snoot.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), keyTarget.position.clone().sub(snoot.position).normalize());
  const key = new THREE.SpotLight('#fff0d5', 38, 8, .52, .65, 2);
  key.position.set(-.8, 3.55, -3.98); key.target = keyTarget;
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.00012;
  key.shadow.normalBias = .018; key.shadow.camera.near = .20; key.shadow.focus = 1;
  scene.add(key);
  const lens = add(new THREE.CircleGeometry(.062, 32), new THREE.MeshBasicMaterial({ color: '#ffe6b0' }), [-.8, 3.564, -3.97]);
  lens.lookAt(keyTarget.position); lens.castShadow = false;

  const daylight = new THREE.DirectionalLight('#c4e0ed', 2.0);
  daylight.position.set(8.2, 5.05, -9.0); daylight.target.position.set(0, 1.1, -4.9);
  daylight.castShadow = true; daylight.shadow.mapSize.set(2048, 2048);
  Object.assign(daylight.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 22 });
  daylight.shadow.bias = -.00012; daylight.shadow.normalBias = .025;
  scene.add(daylight, daylight.target);
  const windowBounce = new THREE.SpotLight('#b7d6e2', 12, 8, .96, 1, 2);
  windowBounce.position.set(3.40, 2.85, -6.55); windowBounce.target.position.set(0, .75, -5.0);
  scene.add(windowBounce, windowBounce.target);
  // Wide indirect fill keeps the room navigable without flattening the key shadows.
  scene.add(new THREE.HemisphereLight('#d2d5c7', '#505148', .60));
  const rearBounce = new THREE.PointLight('#d4c5a3', 3.8, 5.5, 2); rearBounce.position.set(0, 2.5, -7.6); scene.add(rearBounce);
  const entranceBounce = new THREE.PointLight('#c7cbbd', 2.7, 5, 2); entranceBounce.position.set(0, 1.8, 1.2); scene.add(entranceBounce);

  // Deterministic settled physical states. No player movement, random flicker or jump cuts.
  function applyPhase(nextPhase) {
    phase = THREE.MathUtils.clamp(Math.round(Number(nextPhase) || 0), 0, 2);
    shellLeft.rotation.y = [0, .085, .135][phase];
    shellRight.rotation.y = [0, -.04, -.095][phase];
    shellLeft.rotation.z = [0, -.016, -.024][phase];
    innerSeed.rotation.z = [-.18, -.10, .045][phase];
    innerSeed.position.x = [0, .013, -.018][phase];
    innerSeed.position.z = [.095, .105, .134][phase];
    focusTarget.rotation.y = [0, .045, -.025][phase];
    key.intensity = [38, 36.5, 34.5][phase];
    pendantLight.intensity = [19, 18.5, 18][phase];
    windowBounce.intensity = [12, 12.9, 13.8][phase];
    keyTarget.position.x = [0, .08, .18][phase];
    keyTarget.updateMatrixWorld(true);
    focusTarget.updateMatrixWorld(true);
    focusTarget.userData.phase = phase;
  }
  function animate(dt, elapsed) {
    // Intentionally no idle sculpture motion: a settled change is only legible if rest is real.
    // Parent can call this every frame; its inputs do not introduce non-deterministic state.
  }
  applyPhase(0);
  scene.updateMatrixWorld(true);
  scene.userData.art = {
    title: 'OPEN VOLUME / 07', authored: true, externalAssets: false,
    roomBounds: { minX: -3.6, maxX: 3.6, minZ: -9, maxZ: 2.8, ceilingY: 3.9 },
    collisionBoxes: collisions,
    focalCenter: [0, 1.56, -5.3], focalRadius: .64,
    note: 'An original conservation atelier and split porcelain specimen. All geometry and texture pixels are generated in this module.'
  };
  focusTarget.userData.gazePoint = new THREE.Vector3(0, 1.56, -5.3);
  // Extra metadata is optional. Only walls/plinth/bench appear in occluders, never hero meshes.
  return { scene, focusTarget, occluders, applyPhase, animate, collisionBoxes: collisions, bounds: scene.userData.art.roomBounds };
}
