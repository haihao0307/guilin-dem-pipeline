/**
 * KST1 original street architecture instrument, metres / X-street Y-up Z-lateral.
 * All vertices are evaluated from architectural/cloth functions at build time.
 * This is a pier-and-spandrel facade: openings are real voids with room reveals.
 * Repeated timber, steel, brick and shop parts share primitive instanced geometry.
 */
export function buildArchitecture(score, { THREE, materials, makeWord, sharedGeometry = null }) {
  if (!THREE || !materials?.get || typeof makeWord !== 'function') {
    throw new TypeError('Street architecture requires THREE, materials.get and makeWord.');
  }
  const detail=score.performance.detail, near=detail==='near', far=detail==='far';
  const root = new THREE.Group();
  root.name = 'KST1-original-hong-kong-street';
  root.userData.instrument = 'kaopu.street.architecture';
  root.userData.noCameraSideFacade = true;
  const seed = Number(score.object?.seed ?? 1978) >>> 0;
  const buildings = score.construction?.buildings || [];
  const density = score.construction?.windowCageDensity ?? 0.82;
  const signDensity = score.construction?.signDensity ?? 1;
  const cloth = [], geometries = new Set(), usedMaterials = new Set(), batches = new Map(), litBuildings = new Set();
  const stats = {
    buildings: buildings.length, windows: 0, cages: 0, openCasements: 0,
    shutters: 0, balconies: 0, shops: 0, shopsOpen: 0, shopsClosed: 0, shopLights: 0, signs: 0, signSupports: 0,
    laundry: 0, clothPieces: 0, instances: 0, expandedTriangles: 0,
    drawCalls: 0, materials: 0, railClearanceVerified: false,
    facadeFamilies: [], facadeVariants: [], signShapes: [], piercedOpenings: [], buildingBounds: [], retailFixtures: [],
  };
  const average = key => buildings.length ? buildings.reduce((s, b) => s + (b[key] ?? 0.5), 0) / buildings.length : 0.5;
  const shared = { age: average('age'), repair: average('repair'), seed };
  const mat = (family, color, opts = shared) => {
    const value = materials.get(family, { ...opts, color });
    usedMaterials.add(value); return value;
  };
  // Fixed palette, rather than allocating a material per object or per pane.
  const M = {
    iron: mat('iron', '#30483f'), rust: mat('iron', '#70503a'), wire: mat('iron', '#252e28'),
    zinc: mat('zinc', '#777970'), concrete: mat('concrete', '#77786b'),
    dark: mat('concrete', '#202b27'), room: mat('plaster', '#5b5c4b'),
    wood: mat('wood', '#514335'), woodLight: mat('wood', '#8b8065'),
    glass: mat('glass', '#233b37'), glassWarm: mat('glass', '#786d49'),
    paper: mat('paper', '#c7b893'), ceramic: mat('ceramic', '#bfb798'),
    terracotta: mat('ceramic', '#875642'), clothCream: mat('cloth', '#bcb093'),
    clothBlue: mat('cloth', '#536f73'), clothGreen: mat('cloth', '#52604a'),
    clothRed: mat('cloth', '#855547'), signCream: mat('sign', '#c7bb96'),
    signRed: mat('sign', '#7d3229'), signDark: mat('sign', '#243c33'),
    signGold: mat('sign', '#a99651'), lamp: mat('neon', '#e3c383'),
  };
  const unitBox = own(sharedGeometry?sharedGeometry.primitive('unitBox',()=>new THREE.BoxGeometry(1, 1, 1)):new THREE.BoxGeometry(1, 1, 1));
  const unitRod = own(sharedGeometry?sharedGeometry.primitive('unitRod',()=>new THREE.CylinderGeometry(1, 1, 1, 5, 1, true)):new THREE.CylinderGeometry(1, 1, 1, 5, 1, true));
  const unitRound = own(sharedGeometry?sharedGeometry.primitive('unitRound',()=>new THREE.CylinderGeometry(1, 1, 1, 12, 1, false)):new THREE.CylinderGeometry(1, 1, 1, 12, 1, false));
  const unitCone = own(sharedGeometry?sharedGeometry.primitive('unitCone',()=>new THREE.CylinderGeometry(0.24, 1, 1, 10, 1, false)):new THREE.CylinderGeometry(0.24, 1, 1, 10, 1, false));
  const unitSphere = own(sharedGeometry?sharedGeometry.primitive('unitSphere',()=>new THREE.SphereGeometry(1, 8, 5)):new THREE.SphereGeometry(1, 8, 5));
  const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), dir = new THREE.Vector3();
  const bounds = new THREE.Box3();
  function own(g) {
    if (!g.attributes.normal) g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere(); geometries.add(g); return g;
  }
  function instance(geometry, material, position, scale, quaternion = null, tag = '') {
    const key = `${geometry.uuid}:${material.uuid}`;
    let batch = batches.get(key);
    if (!batch) { batch = { geometry, material, matrices: [], tags: new Set() }; batches.set(key, batch); }
    transform.position.fromArray(position); transform.scale.fromArray(scale);
    if (quaternion) transform.quaternion.copy(quaternion); else transform.quaternion.identity();
    transform.updateMatrix(); batch.matrices.push(transform.matrix.clone());
    if (tag) batch.tags.add(tag);
    usedMaterials.add(material);
  }
  function box(material, x, y, z, w, h, d, angle = 0, tag = '') {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const q = angle ? new THREE.Quaternion().setFromAxisAngle(up, angle) : null;
    instance(unitBox, material, [x, y, z], [w, h, d], q, tag);
  }
  function rod(material, a, b, radius = 0.022, tag = '') {
    if((far&&radius<.022)||(!near&&radius<.012))return;
    vA.fromArray(a); vB.fromArray(b); dir.subVectors(vB, vA);
    const length = dir.length(); if (length < 1e-6) return;
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.multiplyScalar(1 / length));
    instance(unitRod, material, vA.add(vB).multiplyScalar(0.5).toArray(), [radius, length, radius], q, tag);
  }
  function round(material, x, y, z, radius, height, geometry = unitRound, quaternion = null) {
    instance(geometry, material, [x, y, z], [radius, height, radius], quaternion);
  }
  function line(material, points, radius = 0.015, tag = '') {
    for (let i = 1; i < points.length; i++) rod(material, points[i - 1], points[i], radius, tag);
  }
  function rng(s) {
    let n = s >>> 0;
    return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function gridMesh(material, nu, nv, point, name, parent = root, pinned = null, clothSeed = 0) {
    const points = [], indices = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) points.push(...point(i / nu, j / nv));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      // v normally runs downward/outward: this order has a front-facing normal.
      indices.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); g.setIndex(indices);
    own(g);
    const mesh = new THREE.Mesh(g, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false; parent.add(mesh); usedMaterials.add(material);
    if (pinned) {
      const mask = new Uint8Array((nu + 1) * (nv + 1));
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) mask[j * (nu + 1) + i] = pinned(i / nu, j / nv) ? 1 : 0;
      cloth.push({ mesh, rest: new Float32Array(g.attributes.position.array), pinned: mask, seed: clothSeed, kind: name });
    }
    return mesh;
  }
  function cornice(b, y, stone, brick) {
    for (const [projection, h, dy] of [[0.28, 0.12, 0], [0.36, 0.11, 0.11], [0.48, 0.15, 0.24], [0.54, 0.07, 0.35]]) {
      box(stone, b.x, y + dy, b.frontZ + projection / 2, b.width + 0.18, h, projection, 0, 'tiered-cornice');
    }
    if (brick && near) for (let j = 0, n = Math.floor(b.width / 0.28); j < n; j++) {
      box(stone, b.x - b.width / 2 + (j + 0.5) * b.width / n, y - 0.1, b.frontZ + 0.24, 0.12, 0.17, 0.23, 0, 'cornice-dentil');
    }
  }
  // Profile choices are architectural recipes, not material variations. Defaults
  // depend on building identity only, so near/mid/far retain the same silhouette.
  const GRAMMARS = {
    brick_shophouse: { ratio: .67, recess: .14, roof: 'stepped_parapet', windows: 'paired_casement', balconies: 'alternating' },
    timber_verandah: { ratio: .80, recess: .14, roof: 'pitched_roof', windows: 'tall_transom', balconies: 'continuous' },
    plaster_recessed: { ratio: .60, recess: -.31, roof: 'flat_parapet', windows: 'paired_casement', balconies: 'alternating' },
    masonry_pilaster: { ratio: .65, recess: -.10, roof: 'stepped_parapet', windows: 'tripartite', balconies: 'alternating' },
    enclosed_balcony: { ratio: .88, recess: .63, roof: 'corrugated_shed', windows: 'ribbon_slider', balconies: 'enclosed' },
  };
  const panelProfiles = new Map();
  function panelGeometry(profile) {
    if (profile === 'fascia' || profile === 'segmented') return unitBox;
    if (!panelProfiles.has(profile)) {
      const make = () => {
        const shape = new THREE.Shape();
        if (profile === 'blade') {
          // Lobed top and tapered foot, like the raised vertical tablets in
          // IMG_8219. This silhouette is original, not traced image geometry.
          shape.moveTo(-.38,-.5); shape.lineTo(.38,-.5); shape.lineTo(.47,-.43);
          shape.lineTo(.43,.19); shape.quadraticCurveTo(.60,.31,.38,.36);
          shape.quadraticCurveTo(.52,.5,0,.5); shape.quadraticCurveTo(-.52,.5,-.38,.36);
          shape.quadraticCurveTo(-.60,.31,-.43,.19); shape.lineTo(-.47,-.43); shape.closePath();
        } else {
          const r=.17;
          shape.moveTo(-.5+r,-.5); shape.lineTo(.5-r,-.5); shape.quadraticCurveTo(.5,-.5,.5,-.5+r);
          shape.lineTo(.5,.5-r); shape.quadraticCurveTo(.5,.5,.5-r,.5); shape.lineTo(-.5+r,.5);
          shape.quadraticCurveTo(-.5,.5,-.5,.5-r); shape.lineTo(-.5,-.5+r); shape.quadraticCurveTo(-.5,-.5,-.5+r,-.5);
        }
        const g = new THREE.ExtrudeGeometry(shape,{depth:1,steps:1,bevelEnabled:false,curveSegments:3});
        g.translate(0,0,-.5); return g;
      };
      panelProfiles.set(profile,own(sharedGeometry ? sharedGeometry.primitive('sign-profile-'+profile,make) : make()));
    }
    return panelProfiles.get(profile);
  }
  function windowLeaf(material, glass, x, y, z, width, h, angle, hingeSide = -1, slats = false, pattern = 'paired_casement') {
    if(far){box(glass,x,y,z-.08,width-.08,h-.08,.02,0,'distant-window-glazing');return;}
    const direction = -hingeSide;
    const hx = x + hingeSide * width / 2;
    // Rotate around the real jamb; one leaf moves forward while retaining its frame.
    const centerX = hx + Math.cos(angle) * direction * width / 2;
    const centerZ = z + Math.sin(angle) * direction * width / 2;
    const position = (u, v, depth = 0) => [centerX + Math.cos(angle) * u - Math.sin(angle) * depth, y + v, centerZ + Math.sin(angle) * u + Math.cos(angle) * depth];
    const leafBox = (m, u, v, w, height, d = 0.06, depth = 0) => box(m, ...position(u, v, depth), w, height, d, -angle, 'window-leaf');
    for (const u of [-width / 2, width / 2]) leafBox(material, u, 0, 0.055, h + 0.06);
    for (const v of [-h / 2, h / 2]) leafBox(material, 0, v, width, 0.055);
    if (slats) {
      for (let j = 0; j < (near?19:5); j++) {
        const yy = -h / 2 + 0.11 + j * (h - 0.22) / (near?18:4);
        // Thin louvre boards remain separate from the gaps between them.
        leafBox(material, 0, yy, width - 0.06, 0.047, 0.065);
      }
      stats.shutters++;
    } else {
      const cuts = pattern === 'tall_transom' ? [-.5,.14,.33,.5]
        : pattern === 'ribbon_slider' || pattern === 'tripartite' ? [-.5,.16,.5] : [-.5,-1/6,1/6,.5];
      for (let row = 1; row < cuts.length; row++) {
        leafBox(glass, 0, (cuts[row-1]+cuts[row])*h/2, width - 0.09, (cuts[row]-cuts[row-1])*h - 0.065, 0.014, -0.014);
        if (row < cuts.length-1) leafBox(material,0,cuts[row]*h,width,.045,.072);
      }
    }
  }
  function cage(x, y, z, width, h, depth, ornate, r) {
    const front = z + depth, back = z + 0.12, bottom = y - h / 2, top = y + h / 2;
    if(far){for(const xx of [x-width/2,x+width/2])rod(M.iron,[xx,bottom,front],[xx,top,front],.027,'cage-corner');for(const yy of [bottom,top])rod(M.iron,[x-width/2,yy,front],[x+width/2,yy,front],.027,'cage-frame');stats.cages++;return;}
    for (const xx of [x - width / 2, x + width / 2]) {
      rod(M.iron, [xx, bottom, front], [xx, top, front], 0.027, 'cage-corner');
      for (const yy of [bottom, top, y]) rod(M.iron, [xx, yy, back], [xx, yy, front], 0.024, 'cage-return');
      for (const t of [0.35, 0.68]) rod(M.iron, [xx, bottom, back + (front - back) * t], [xx, top, back + (front - back) * t], 0.014, 'cage-side-bar');
      box(M.rust, xx, top, back - 0.01, 0.095, 0.18, 0.05, 0, 'cage-wall-plate');
      rod(M.iron, [xx, bottom - 0.25, back], [xx, bottom + 0.04, front], 0.027, 'cage-support-brace');
    }
    for (const yy of [bottom, y - h * 0.20, y + h * 0.21, top]) rod(M.iron, [x - width / 2, yy, front], [x + width / 2, yy, front], 0.024);
    const bars = near?Math.max(7,Math.ceil(width/.18)):far?2:Math.max(3,Math.ceil(width/.42));
    for (let j = 1; j < bars; j++) {
      const xx = x - width / 2 + j * width / bars;
      rod(M.iron, [xx, bottom, front], [xx, top, front], 0.0145, 'dense-cage-bar');
    }
    // A small repeating steel motif, not a solid decorative panel.
    if (ornate && near) for (let j = 0; j < 3; j++) {
      const cx = x + (j - 1) * width * 0.23, pts = [];
      for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2; pts.push([cx + 0.095 * Math.sin(a), y + 0.16 * Math.sin(2 * a), front + 0.018]); }
      line(M.iron, pts, 0.012);
    }
    stats.cages++;
  }
  function balcony(b, x, floorY, bay, timber, trim, wood) {
    const front = b.frontZ + (timber ? 1.48 : 1.25), w = bay * 0.98;
    box(trim, x, floorY + 0.06, (b.frontZ + front) / 2, w, 0.17, front - b.frontZ + 0.12, 0, 'balcony-slab');
    for (const dy of [0.23, 1.03]) rod(M.iron, [x - w / 2, floorY + dy, front], [x + w / 2, floorY + dy, front], 0.030);
    const bars = Math.max(6, Math.ceil(w / 0.28));
    for (let j = 0; j <= bars; j++) {
      const xx = x - w / 2 + j * w / bars;
      rod(M.iron, [xx, floorY + 0.21, front], [xx, floorY + 1.04, front], j === 0 || j === bars ? 0.033 : 0.019);
      if (timber && j < bars && j % 2 === 0) rod(M.iron, [xx, floorY + 0.23, front - 0.025], [xx + w / bars, floorY + 1.02, front - 0.025], 0.016);
    }
    for (const xx of [x - w / 2, x + w / 2]) {
      rod(M.iron, [xx, floorY + 1.03, b.frontZ + 0.10], [xx, floorY + 1.03, front], 0.025);
      rod(M.iron, [xx, floorY - 0.55, b.frontZ + 0.03], [xx, floorY - 0.02, front - 0.1], 0.032, 'balcony-knee-brace');
      if (timber) {
        box(wood, xx, floorY + b.floorHeight / 2, front - 0.03, 0.10, b.floorHeight, 0.10, 0, 'verandah-post');
        for (const side of [-1, 1]) rod(wood, [xx + side * 0.36, floorY + b.floorHeight - 0.14, front - 0.03], [xx, floorY + b.floorHeight - 0.53, front - 0.03], 0.035, 'verandah-knee');
      }
    }
    if (timber) box(wood, x, floorY + b.floorHeight - 0.11, front - 0.03, w, 0.15, 0.14);
    stats.balconies++;
  }
  function laundry(b, x, y, localSeed) {
    const r = rng(localSeed), z = b.frontZ + 1.33;
    for (const xx of [x - 0.9, x + 0.9]) rod(M.iron, [xx, y - 0.16, b.frontZ + 0.04], [xx, y, z], 0.025, 'laundry-bracket');
    const pts = [];
    for (let j = 0; j <= 18; j++) { const t = j / 18; pts.push([x - 0.9 + 1.8 * t, y - 0.1 * Math.sin(Math.PI * t), z]); }
    line(M.wire, pts, 0.009, 'laundry-line');
    for (let j = 0; j < 3; j++) {
      const cx = x - 0.59 + j * 0.59, width = 0.32 + r() * 0.10, height = 0.58 + r() * 0.28;
      const top = y - 0.09 * Math.sin(Math.PI * (cx - x + 0.9) / 1.8);
      const material = j === 1 ? M.clothBlue : M.clothCream;
      gridMesh(material, 8, 9, (u, v) => [cx + (u - 0.5) * width, top - v * height + Math.sin(u * 11 + j) * 0.018 * v, z + Math.sin(u * Math.PI * 5 + j) * 0.025 * (0.2 + v) + 0.035 * v * v], 'laundry', root, (u, v) => v === 0, localSeed + j);
      for (const xx of [cx - width * 0.38, cx + width * 0.38]) box(M.woodLight, xx, top + 0.015, z + 0.01, 0.025, 0.080, 0.039, 0, 'laundry-peg');
      stats.laundry++;
    }
  }
  function canopy(b, x, width, top, depth, drop, material, localSeed, striped = false) {
    const r = rng(localSeed), front = b.frontZ + 0.16;
    const stripes = Math.max(8, Math.ceil(width / 0.30));
    // One cloth mesh per colour, with stripes composed from runtime vertices.
    for (let band = 0; band < (striped ? 2 : 1); band++) {
      const positions = [], indices = [], pinned = [];
      for (let i = 0; i < stripes; i++) {
        if (striped && i % 2 !== band) continue;
        const base = positions.length / 3;
        for (let j = 0; j <= 5; j++) for (let edge = 0; edge < 2; edge++) {
          const u = (i + edge) / stripes, t = j / 5;
          const sag = 0.065 * Math.sin(Math.PI * u) * Math.sin(Math.PI * t);
          positions.push(x - width / 2 + u * width, top - t * drop - sag, front + depth * t);
          pinned.push(j === 0 || j === 5 ? 1 : 0);
        }
        for (let j = 0; j < 5; j++) { const a = base + j * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        // Scalloped / slightly frayed hanging edge.
        const a = positions.length / 3, u0 = i / stripes, u1 = (i + 1) / stripes;
        for (const u of [u0, u1]) positions.push(x - width / 2 + u * width, top - drop, front + depth);
        for (const u of [u0, u1]) positions.push(x - width / 2 + u * width, top - drop - 0.16 - 0.028 * Math.sin(i * 1.7), front + depth + 0.017);
        pinned.push(1, 1, 0, 0); indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); own(g);
      const mesh = new THREE.Mesh(g, band === 1 ? M.clothCream : material); mesh.name = 'pitched-canvas-canopy'; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; root.add(mesh);
      cloth.push({ mesh, rest: new Float32Array(g.attributes.position.array), pinned: new Uint8Array(pinned), seed: localSeed + band, kind: 'canopy' });
    }
    for (const xx of [x - width * 0.46, x + width * 0.46]) {
      rod(M.iron, [xx, top - 0.78, front - 0.05], [xx, top - drop, front + depth], 0.026, 'awning-diagonal-support');
      rod(M.iron, [xx, top, front], [xx, top - drop, front + depth], 0.022, 'awning-rib');
      box(M.rust, xx, top - 0.63, front - 0.06, 0.12, 0.35, 0.055);
    }
    for (const [t, y] of [[0, top], [1, top - drop]]) rod(M.iron, [x - width / 2, y, front + depth * t], [x + width / 2, y, front + depth * t], 0.024, 'awning-cross-rail');
  }
  function fittedWord(text, style, x, y, z, maxW, height, material, rotationY = 0, parent = root) {
    if(far)return null;
    const word = makeWord(text, { height, depth: near?0.018:0, style, material });
    word.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(word);
    const actual = Math.max(0.001, bb.max.x - bb.min.x), scale = Math.min(1, maxW / actual);
    word.scale.multiplyScalar(scale); word.position.set(x, y, z); word.rotation.y = rotationY;
    word.name = `sculpted-sign:${text}`; word.userData.text = text; parent.add(word);
    word.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) usedMaterials.add(o.material); });
    return word;
  }
  function signMaterial(b, shop, index, color) {
    return mat('sign', color, { ...shared, age: shop.signAge ?? b.age, repair: 0, seed: seed + index * 103, origin: [b.x, 0, b.frontZ] });
  }
  function fascia(b, shop, x, w, index, r) {
    const shape = shop.signShape || ['fascia','segmented','rounded','blade'][index % 4];
    const h = clamp(shop.signHeight ?? (shape === 'segmented' ? .79 : shape === 'rounded' ? 1.13 : 1.02),.58,1.35);
    const y = 3.67 + (index % 2 ? .08 : 0), z = b.frontZ + .29;
    const dark = index % 4 === 2 || index % 4 === 1;
    const board = signMaterial(b,shop,index,dark?'#243c33':'#c7bb96'), text = dark?M.signCream:M.signRed;
    if (shape === 'segmented') {
      // Separate enamel character tablets, with daylight between panels.
      const chars=Array.from(shop.text), pitch=(w-.25)/chars.length, pw=Math.min(pitch-.055,h*.94);
      for(const yy of [y-h*.39,y+h*.39])box(M.iron,x,yy,z,w-.10,.06,.17,0,'segmented-sign-support-rail');
      for(let j=0;j<chars.length;j++){
        const xx=x+(j-(chars.length-1)/2)*pitch;
        box(M.signGold,xx,y,z+.04,pw+.045,h,.11,0,'segmented-sign-enamel-rim');
        box(board,xx,y,z+.106,pw,h-.07,.026,0,'segmented-sign-character-tablet');
        fittedWord(chars[j],shop.signStyle||'brush',xx,y-h*.28,z+.135,pw-.08,h*.62,text);
      }
    } else if (shape === 'rounded') {
      instance(panelGeometry('rounded'),M.iron,[x,y,z],[w-.08,h,.23],null,'rounded-sign-rim');
      instance(panelGeometry('rounded'),board,[x,y,z+.132],[w-.18,h-.10,.03],null,'rounded-painted-board');
      fittedWord(shop.text,shop.signStyle||'brush',x,y-h*.235,z+.16,w-.47,h*.52,text);
    } else {
      // Blade shops use a narrow wall transom plus their tall, shaped outrigger.
      const bh=shape==='blade'?h*.68:h;
      box(M.iron,x,y,z,w-.08,bh,.23,0,shape==='blade'?'blade-shop-transom':'fascia-steel-box');
      box(board,x,y,z+.132,w-.18,bh-.10,.03,0,'sign-painted-board');
      for(const yy of [y-bh*.40,y+bh*.40])box(M.signGold,x,yy,z+.153,w-.27,.026,.025,0,'sign-frame');
      fittedWord(shop.text,shop.signStyle||'brush',x,y-bh*.235,z+.17,w-.42,bh*.53,text);
    }
    for (const xx of [x-w*.30,x+w*.30]) {
      rod(M.iron,[xx,y+h*.40,b.frontZ],[xx,y+h*.40,z+.13],.032,'fascia-wall-support');
      box(M.rust,xx,y+h*.39,b.frontZ+.015,.15,.17,.04);
    }
    stats.signShapes.push({shop:shop.id,shape,height:h});stats.signs++;stats.signSupports+=2;
    // Painted column tablets accompany older fascia/blade premises only.
    if(shape==='fascia'||shape==='blade'){
      const columnX=x-w/2+.13,cy=1.96,columnW=.38;
      box(M.wood,columnX,cy,b.frontZ+.23,columnW,2.12,.11,0,'column-sign-frame');
      box(signMaterial(b,shop,index,'#c7bb96'),columnX,cy,b.frontZ+.292,columnW-.06,2.04,.022);
      const chars=near?Array.from(shop.text):[],pitch=Math.min(.43,1.83/Math.max(1,chars.length));
      for(let j=0;j<chars.length;j++)fittedWord(chars[j],shop.signStyle||'brush',columnX,cy+(chars.length-1)*pitch/2-j*pitch-.13,b.frontZ+.31,columnW-.10,Math.min(.31,pitch*.78),M.signRed);
      stats.signs++;
    }
  }
  function projectingSign(b,shop,x,y,index) {
    const shape=shop.signShape||['fascia','segmented','rounded','blade'][index%4];
    // All variants stay within the former 3.25m setback; their two trusses
    // attach to the wall at real heights and remain independent of text LOD.
    const width=shape==='blade'?1.16:shape==='segmented'?1.20:1.35+(index%2)*.19;
    const h=shape==='blade'?4.45:shape==='rounded'?3.75:index%2?3.4:4.0,z=b.frontZ+2.12;
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=Math.PI/2;root.add(g);
    const boardMat=signMaterial(b,shop,index,index%2?'#c7bb96':'#7d3229');
    const panel=(geometry,material,px,py,pz,w,hh,d)=>{
      const m=new THREE.Mesh(geometry,material);m.position.set(px,py,pz);m.scale.set(w,hh,d);m.castShadow=m.receiveShadow=true;g.add(m);
    };
    if(shape==='segmented'){
      const n=Array.from(shop.text).length;
      for(let j=0;j<n;j++)panel(unitBox,boardMat,0,h/2-(j+.5)*h/n,0,width,h/n-.08,.17);
      for(const xx of [-width/2,width/2])panel(unitBox,M.iron,xx,0,0,.05,h+.08,.22);
    }else if(shape==='rounded'||shape==='blade'){
      panel(panelGeometry(shape),M.signCream,0,0,0,width+.10,h+.10,.20);
      panel(panelGeometry(shape),boardMat,0,0,.002,width,h,.22);
    }else{
      panel(unitBox,boardMat,0,0,0,width,h,.17);
      for(const xx of [-width/2,width/2])panel(unitBox,M.iron,xx,0,0,.045,h+.08,.22);
      for(const yy of [-h/2,h/2])panel(unitBox,M.iron,0,yy,0,width,.045,.22);
    }
    const chars=Array.from(shop.text),contentH=h*(shape==='blade'?.80:shape==='rounded'?.92:1);
    const glyphH=Math.min(.68,contentH/chars.length*.70),contentY=shape==='blade'?-h*.025:0;
    for(const face of [1,-1])for(let j=0;j<chars.length;j++){
      const yy=contentY+contentH/2-(j+.5)*contentH/chars.length-glyphH*.42;
      fittedWord(chars[j],shop.signStyle||'brush',0,yy,face*.124,width*.71,glyphH,index%2?M.signRed:M.signCream,face===1?0:Math.PI,g);
    }
    for(const dy of [-h*.34,h*.34])for(const dx of [-.09,.09]){
      const base=[x+dx,y+dy,b.frontZ+.06],tip=[x+dx,y+dy,z+width/2];
      rod(M.iron,base,tip,.038,'sign-outrigger');
      rod(M.iron,[base[0],base[1]+.87,base[2]],tip,.031,'sign-diagonal-brace');
      rod(M.iron,[x-.09,y+dy,z],[x+.09,y+dy,z],.025);
      box(M.rust,base[0],base[1],base[2],.18,.34,.065);
    }
    stats.signs++;stats.signSupports+=4;
  }
  function jar(x, base, z, r = 0.09, h = 0.23, material = M.ceramic) {
    round(material, x, base + h * 0.42, z, r, h * 0.77);
    round(material, x, base + h * 0.87, z, r * 0.70, h * 0.18);
    round(M.wood, x, base + h + 0.014, z, r * 0.77, 0.035);
    box(M.paper, x, base + h * 0.45, z + r + 0.003, r * 1.08, h * 0.34, 0.009);
  }
  function wallClock(x, y, z, radius = 0.26) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    round(M.wood, x, y, z, radius + 0.03, 0.07, unitRound, q);
    round(M.paper, x, y, z + 0.042, radius, 0.013, unitRound, q);
    for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6; rod(M.wood, [x + Math.sin(a) * radius * 0.79, y + Math.cos(a) * radius * 0.79, z + 0.053], [x + Math.sin(a) * radius * 0.91, y + Math.cos(a) * radius * 0.91, z + 0.053], 0.007); }
    rod(M.iron, [x, y, z + 0.071], [x + radius * 0.44, y + radius * 0.28, z + 0.071], 0.015);
    rod(M.iron, [x, y, z + 0.072], [x - radius * 0.12, y + radius * 0.7, z + 0.072], 0.011);
  }
  function shopInterior(b, shop, x, sw, index, wood, r) {
    const w = sw - 0.42, f = b.frontZ, rear = f - 1.62;
    const fixtures = [], open = shop.open !== false;
    if(!near){
      // Consume the exact authored near-stock sequence before omitting goods.
      // Detail choice must not change subsequent signs or canopy dimensions.
      const shelfWidth=shop.type==='cinema'?w*.40:w*.82;
      if(shop.type!=='watch'&&shop.type!=='hardware')for(let j=0;j<8*Math.max(4,Math.floor(shelfWidth/.28));j++)r();
      box(M.room,x,1.65,rear,w,3.18,.12,0,'shop-rear-wall');
      for(const xx of [x-w/2,x+w/2]){box(wood,xx,1.62,f-.8,.10,3.22,1.65,0,'shop-side-reveal');box(wood,xx,1.45,f+.02,.15,2.9,.18,0,'folded-shop-shutter');}
      box(wood,x,3.18,f,w+.12,.15,.23);box(M.concrete,x,.022,f-.75,w+.02,.07,1.92);
      if(open){stats.shopsOpen++;box(wood,x,.60,rear+.95,w*.60,1.2,.56,0,'shop-counter');for(const yy of [1.1,1.8,2.4])box(wood,x,yy,rear+.2,w*.78,.07,.36,0,'shop-shelf');}
      else{stats.shopsClosed++;for(let j=0;j<5;j++)box(wood,x-w/2+(j+.5)*w/5,1.49,f+.05,w/5-.015,2.86,.08,0,'closed-timber-shop-leaf');}
      stats.shops++;stats.retailFixtures.push({shop:shop.type,fixtures:['real recessed entrance',open?'counter and shelving':'closed timber leaves'],detail});return;
    }
    // The rear wall is 1.6m behind an unglazed, walk-in entrance.
    box(M.room, x, 1.65, rear, w, 3.18, 0.12, 0, 'shop-rear-wall');
    box(wood, x, 0.48, rear + 0.072, w - 0.04, 0.80, 0.026);
    for (const xx of [x - w / 2, x + w / 2]) {
      box(M.room, xx, 1.62, f - 0.79, 0.075, 3.22, 1.62, 0, 'shop-side-reveal');
      box(wood, xx, 1.62, f + 0.02, 0.11, 3.25, 0.19, 0, 'shop-timber-jamb');
      for (let leaf = 0; leaf < 3; leaf++) {
        box(wood, xx + (xx < x ? 1 : -1) * (0.065 + 0.035 * (leaf % 2)), 1.45, f - leaf * 0.16, 0.085, 2.78, 0.18, 0, 'folded-shop-shutter');
        for (const yy of [0.31, 0.91, 1.53, 2.2, 2.71]) box(M.woodLight, xx + (xx < x ? 0.10 : -0.10), yy, f - leaf * 0.16 + 0.09, 0.095, 0.033, 0.026);
      }
    }
    box(wood, x, 3.18, f - 0.02, w + 0.12, 0.15, 0.23);
    box(M.dark, x, 3.24, f - 0.76, w, 0.06, 1.65);
    box(M.concrete, x, 0.022, f - 0.75, w + 0.02, 0.07, 1.92);
    const cols = Math.max(5, Math.round(w / 0.41));
    for (let row = 0; row < 4; row++) for (let col = 0; col < cols; col++) box((row + col) % 3 ? M.paper : wood, x - w / 2 + (col + 0.5) * w / cols, 0.062, f + 0.04 - row * 0.38, w / cols - 0.017, 0.012, 0.36);
    rod(M.iron, [x - w / 2, 3.07, f + 0.06], [x + w / 2, 3.07, f + 0.06], 0.035, 'shop-upper-track');
    if (open) {
      fixtures.push('open entrance', 'folded timber leaves', 'tile floor'); stats.shopsOpen++;
    } else {
      const count = Math.max(8, Math.round(w / 0.22));
      for (let p = 0; p < count; p++) box(wood, x - w / 2 + (p + 0.5) * w / count, 1.49, f + 0.054, w / count - 0.012, 2.86, 0.080, 0, 'closed-timber-shop-leaf');
      for (const yy of [0.31, 1.05, 2.12, 2.73]) box(M.woodLight, x, yy, f + 0.104, w - 0.04, 0.055, 0.028, 0, 'closed-shop-cross-rail');
      for (const xx of [x - w * 0.43, x + w * 0.43]) for (const yy of [0.48, 2.49]) box(M.iron, xx, yy, f + 0.123, 0.13, 0.043, 0.018, 0, 'closed-shop-hinge');
      fixtures.push('closed panelled timber leaves', 'tile floor'); stats.shopsClosed++;
    }
    for (const xx of [x - w * 0.23, x + w * 0.23]) {
      rod(M.wire, [xx, 3.18, f - 0.65], [xx, 2.78, f - 0.65], 0.012, 'lamp-suspension');
      round(M.iron, xx, 2.74, f - 0.65, 0.20, 0.14, unitCone);
      instance(unitSphere, M.lamp, [xx, 2.64, f - 0.65], [0.053, 0.069, 0.053], null, 'lamp-bulb');
    }
    if (open && !litBuildings.has(b.id) && stats.shopLights < 2) {
      const light = new THREE.PointLight(0xffcf8c, 5.0, 3.8, 2);
      light.position.set(x - w * 0.23, 2.62, f - 0.65);
      light.name = 'bounded-shop-pendant-light'; light.castShadow = false; root.add(light);
      litBuildings.add(b.id); stats.shopLights++;
    }
    const shelfW = shop.type === 'cinema' ? w * 0.40 : w * 0.82, shelfX = shop.type === 'cinema' ? x + w * 0.22 : x;
    for (const xx of [shelfX - shelfW / 2, shelfX + shelfW / 2]) box(wood, xx, 1.39, rear + 0.31, 0.065, 2.6, 0.36, 0, 'shelf-upright');
    for (let row = 0; row < 4; row++) {
      const y = 0.51 + row * 0.50;
      box(M.woodLight, shelfX, y, rear + 0.33, shelfW, 0.060, 0.48, 0, 'shop-shelf');
      for (const xx of [shelfX - shelfW * 0.43, shelfX + shelfW * 0.43]) rod(M.iron, [xx, y - 0.19, rear + 0.08], [xx, y - 0.024, rear + 0.55], 0.018, 'shelf-bracket');
      const count = Math.max(4, Math.floor(shelfW / 0.28));
      for (let j = 0; j < count; j++) {
        const xx = shelfX - shelfW * 0.45 + (j + 0.5) * shelfW * 0.9 / count;
        if (shop.type === 'watch') {
          if (row >= 2 && j % 2 === 0) wallClock(xx, y + 0.20, rear + 0.14, 0.13);
          else { box(M.wood, xx, y + 0.11, rear + 0.36, 0.14, 0.16, 0.17); box(M.signGold, xx, y + 0.11, rear + 0.451, 0.085, 0.10, 0.014); }
        } else if (shop.type === 'hardware') {
          box(M.iron,xx,y+.12,rear+.33,.15,.18,.22,0,'hardware-tins');
        } else if (shop.type === 'cinema') {
          const bw = 0.048 + r() * 0.035; box(j % 3 ? M.paper : M.signRed, xx, y + 0.16, rear + 0.30, bw, 0.26 + r() * 0.09, 0.23);
        } else jar(xx, y + 0.033, rear + 0.33, 0.074 + r() * 0.022, 0.21 + r() * 0.08, shop.type === 'pharmacy' ? M.terracotta : M.ceramic);
      }
    }
    fixtures.push('supported timber shelves');
    const cw = w * (shop.type === 'cinema' ? 0.36 : 0.48), cx = x - w * 0.22, cz = f - 0.21;
    box(wood, cx, 0.52, cz, cw, 0.91, 0.66, 0, 'open-shop-counter');
    box(M.woodLight, cx, 0.997, cz, cw + 0.07, 0.095, 0.76);
    for (let j = 0; j < 3; j++) box(wood, cx + (j - 1) * cw * 0.29, 0.54, cz + 0.347, cw * 0.25, 0.57, 0.024);
    for (const yy of [0.16, 0.89]) box(M.woodLight, cx, yy, cz + 0.365, cw, 0.043, 0.035);
    for (const xx of [cx - cw * 0.41, cx + cw * 0.41]) box(M.wood, xx, 0.085, cz, 0.09, 0.14, 0.59);
    fixtures.push('panelled timber counter');
    if (shop.type === 'tea') {
      for (let level = 0; level < 3; level++) {
        const y = 1.11 + level * 0.19;
        round(M.woodLight, cx - cw * 0.18, y, cz + 0.04, 0.22, 0.16);
        for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6; rod(M.wood, [cx - cw * 0.18 + Math.sin(a) * 0.223, y - 0.072, cz + 0.04 + Math.cos(a) * 0.223], [cx - cw * 0.18 + Math.sin(a) * 0.223, y + 0.072, cz + 0.04 + Math.cos(a) * 0.223], 0.007); }
      }
      for (let j = 0; j < 3; j++) { round(M.ceramic, cx + cw * 0.20 + j * 0.13, 1.069, cz + 0.1, 0.062, 0.050, unitCone); }
      for (const xx of [x + w * 0.25, x + w * 0.42]) {
        round(M.woodLight, xx, 0.52, f - 0.89, 0.15, 0.065);
        for (const dx of [-0.08, 0.08]) for (const dz of [-0.08, 0.08]) rod(M.wood, [xx + dx, 0.49, f - 0.89 + dz], [xx + dx * 1.45, 0.05, f - 0.89 + dz * 1.45], 0.020);
      }
      fixtures.push('bamboo steamers', 'ceramics', 'stools');
    } else if (shop.type === 'pharmacy') {
      for (let j = 0; j < 3; j++) jar(cx + (j - 1) * cw * 0.23, 1.046, cz + 0.01, 0.085, 0.26, M.terracotta);
      fixtures.push('labelled herbal jars');
    } else if (shop.type === 'watch') {
      wallClock(x, 2.63, rear + 0.14, 0.28);
      box(M.signGold, cx, 1.19, cz, cw * 0.86, 0.04, 0.60);
      for (const xx of [cx - cw * 0.43, cx + cw * 0.43]) box(M.glass, xx, 1.11, cz, 0.012, 0.19, 0.59);
      box(M.glass, cx, 1.11, cz + 0.30, cw * 0.86, 0.19, 0.013);
      fixtures.push('watch display', 'analogue wall clocks');
    } else if (shop.type === 'hardware') {
      for(let j=0;j<4;j++) {const hx=cx+(j-1.5)*.19;rod(M.iron,[hx,1.06,cz-.20],[hx,1.06,cz+.23],.025,'hardware-pipe-stock');}
      fixtures.push('metal stock', 'boxed tins');
    } else {
      // Original graphic blocks, not imported poster images or fake raster lettering.
      const px = x - w * 0.26;
      box(M.wood, px, 2.05, rear + 0.082, w * 0.42, 1.35, 0.06);
      box(M.paper, px, 2.05, rear + 0.12, w * 0.39, 1.29, 0.025);
      for (let j = 0; j < 5; j++) box(j === 0 ? M.signRed : M.wood, px, 2.49 - j * 0.23, rear + 0.14, w * (j === 0 ? 0.31 : 0.25), j === 0 ? 0.21 : 0.05, 0.010);
      fixtures.push('framed cinema poster', 'ticket counter');
    }
    stats.retailFixtures.push({ shop: shop.id, fixtures }); stats.shops++;
  }
  function serviceWires(b, height) {
    for (const y of [3.42, 7.42, 11.3, 15.5]) {
      if (y > height - 0.9) continue;
      for (let bundle = 0; bundle < 3; bundle++) {
        const pts = [];
        for (let j = 0; j <= 14; j++) { const t = j / 14; pts.push([b.x - b.width / 2 + b.width * t, y - (score.construction.wireSag ?? 0.36) * 0.55 * Math.sin(Math.PI * t) - bundle * 0.034, b.frontZ + 0.30 + bundle * 0.019]); }
        line(M.wire, pts, 0.011, 'facade-service-cable');
      }
      const x = b.x + b.width * 0.31;
      box(M.iron, x, y - 0.15, b.frontZ + 0.37, 0.27, 0.34, 0.14, 0, 'junction-box');
      const loop = [];
      for (let j = 0; j <= 20; j++) { const a = j / 20 * Math.PI * 2; loop.push([x + 0.13 * Math.sin(a), y - 0.5 + 0.20 * Math.cos(a), b.frontZ + 0.41]); }
      line(M.wire, loop, 0.011, 'service-loop');
    }
    const x = b.x + b.width * 0.475, pipe = [];
    pipe.push([x, 0.06, b.frontZ + 0.37]);
    for (let f = 0; f <= b.floors; f++) {
      const y = b.groundHeight + f * b.floorHeight;
      pipe.push([x, y - 0.23, b.frontZ + 0.37], [x, y + 0.02, b.frontZ + 0.52], [x, y + 0.49, b.frontZ + 0.52], [x, y + 0.72, b.frontZ + 0.37]);
      box(M.iron, x, y - 0.34, b.frontZ + 0.29, 0.16, 0.06, 0.21, 0, 'downpipe-wall-strap');
    }
    line(M.rust, pipe, 0.045, 'kinked-rain-pipe');
  }
  function roof(b,H,wall,trim,bi){
    const profile=b.roofProfile;
    box(M.concrete,b.x,H-.04,b.frontZ-b.depth/2,b.width,.19,b.depth,0,'roof-slab');
    if(profile==='stepped_parapet'){
      // Three stepped masonry bays replace the repeated, unbroken cornice.
      for(let j=-1;j<=1;j++){
        const w=b.width/3,hh=j===0?.99:.53,x=b.x+j*w;
        box(wall,x,H+hh/2,b.frontZ-.10,w+.02,hh,.29,0,'stepped-parapet');
        box(trim,x,H+hh+.035,b.frontZ+.02,w+.10,.09,.43,0,'parapet-coping');
      }
    }else{
      const hh=profile==='pitched_roof'?.30:.56;
      box(wall,b.x,H+hh/2,b.frontZ-.10,b.width+.02,hh,.29,0,'parapet');
      box(trim,b.x,H+hh+.03,b.frontZ+.03,b.width+.14,.10,.44,0,'parapet-coping');
    }
    if(profile==='pitched_roof'){
      // A full-width pitched zinc roof belongs to the timber frame, rather than
      // placing the same little rooftop box onto every facade family.
      gridMesh(M.zinc,near?18:far?4:8,2,(u,v)=>[
        b.x-b.width/2-.14+u*(b.width+.28),
        H+.37+(1-Math.abs(v*2-1))*.91+Math.sin(u*Math.PI*36)*.018,
        b.frontZ-b.depth-.13+v*(b.depth+.35)],'pitched-zinc-roof');
      for(const zz of [b.frontZ-b.depth-.10,b.frontZ+.18])box(M.wood,b.x,H+.31,zz,b.width+.30,.12,.13,0,'pitched-roof-eave');
    }else if(profile!=='flat_parapet'){
      const sx=b.x+(bi%2?-.8:.65),sz=b.frontZ-2.10,sw=profile==='corrugated_shed'?b.width*.48:2.5;
      box(M.zinc,sx,H+.74,sz-.95,sw,1.45,.065,0,'roof-shed-back');
      for(const xx of [sx-sw/2,sx+sw/2])box(M.wood,xx,H+.76,sz,.07,1.51,1.96,0,'roof-shed-end');
      gridMesh(M.zinc,near?28:far?4:10,2,(u,v)=>[sx-sw/2-.14+u*(sw+.28),H+1.47+v*.22+Math.sin(u*Math.PI*28)*.025,sz-1.08+v*2.2],'corrugated-roof-shed');
    }
    round(M.zinc,b.x-b.width*.25,H+.68,b.frontZ-3.68,.53,1.20);
    for(const yy of [H+.21,H+1.08])for(let j=0;j<12;j++){
      const a=j*Math.PI/6,a2=(j+1)*Math.PI/6;
      rod(M.iron,[b.x-b.width*.25+Math.sin(a)*.54,yy,b.frontZ-3.68+Math.cos(a)*.54],[b.x-b.width*.25+Math.sin(a2)*.54,yy,b.frontZ-3.68+Math.cos(a2)*.54],.023);
    }
    rod(M.iron,[b.x+.7,H,b.frontZ-1.2],[b.x+.7,H+3.1,b.frontZ-1.2],.023,'roof-aerial');
    for(const yy of [H+2.18,H+2.55,H+2.92])rod(M.iron,[b.x-.08,yy,b.frontZ-1.2],[b.x+1.47,yy,b.frontZ-1.2],.017);
  }
  for (let bi = 0; bi < buildings.length; bi++) {
    const input=buildings[bi],grammar=GRAMMARS[input.facade]||GRAMMARS.plaster_recessed;
    const b={...input,floorHeight:input.floorHeight??3.03,groundHeight:input.groundHeight??4.2,
      roofProfile:input.roofProfile||grammar.roof,windowPattern:input.windowPattern||grammar.windows,balconyPattern:input.balconyPattern||grammar.balconies};
    const r=rng(seed+bi*10001+811),brick=b.facade==='brick_shophouse',timber=b.facade==='timber_verandah';
    const pilaster=b.facade==='masonry_pilaster',recessed=b.facade==='plaster_recessed',enclosed=b.facade==='enclosed_balcony';
    const H=b.groundHeight+b.floors*b.floorHeight,bay=b.width/b.bays,w=bay*grammar.ratio;
    const h=Math.min(enclosed?1.92:2.12,b.floorHeight-.65),frameZ=b.frontZ+grammar.recess;
    const opts={...shared,seed:seed+bi*311,age:b.age,repair:b.repair,origin:[b.x,0,b.frontZ],floorHeight:b.floorHeight,groundHeight:b.groundHeight,width:b.width,bays:b.bays,sillHeight:1.49-h/2-.185,sillEdge:.5-(w+.32)/(2*bay)};
    const wall=mat(brick?'brick':'plaster',brick?(b.brickTint||score.appearance?.brickTint||'#78503b'):(b.plasterTint||score.appearance?.plasterTint||'#b0aa91'),opts);
    const trim=mat('plaster',brick?'#aaa18c':enclosed?'#a4a393':recessed?'#a49e89':'#8f9785',opts);
    const wood=mat('wood',b.woodTint||(timber?score.appearance?.woodTint||'#344a40':'#4c3e30'),opts);
    const joinery=enclosed?M.zinc:wood;
    stats.facadeFamilies.push(b.facade);
    stats.facadeVariants.push({id:b.id,facade:b.facade,roofProfile:b.roofProfile,windowPattern:b.windowPattern,balconyPattern:b.balconyPattern,recess:grammar.recess});
    stats.buildingBounds.push({id:b.id,min:[b.x-b.width/2,0,b.frontZ-b.depth],max:[b.x+b.width/2,H+3.2,b.frontZ+3.25]});
    // Keep the authored footprint, interior room backs and shop thresholds.
    // Enclosed balconies are a light, projecting upper-storey addition only.
    box(wall,b.x,H/2,b.frontZ-b.depth,b.width,H,.22,0,'rear-wall');
    for(const xx of [b.x-b.width/2+.115,b.x+b.width/2-.115])box(wall,xx,H/2,b.frontZ-b.depth/2,.23,H,b.depth,0,'building-end-return');
    box(wall,b.x,b.groundHeight-.14,b.frontZ-.48,b.width,.28,1.10,0,'shop-head-lintel');
    for(const xx of [b.x-b.width/2+.12,b.x+b.width/2-.12])box(trim,xx,H/2,b.frontZ+.10,pilaster?.43:.30,H,.25,0,'corner-pilaster');
    for(let f=0;f<b.floors;f++){
      const y0=b.groundHeight+f*b.floorHeight,wy=y0+(enclosed?1.62:1.49);
      box(M.dark,b.x,y0-.08,b.frontZ-b.depth/2,b.width-.22,.15,b.depth-.10,0,'interior-floor-slab');
      for(let q=0;q<=b.bays;q++){
        let xx=b.x-b.width/2+q*bay;
        const pw=q===0||q===b.bays?(bay-w)/2:bay-w;
        if(q===0)xx+=pw/2;else if(q===b.bays)xx-=pw/2;
        box(wall,xx,y0+b.floorHeight/2,b.frontZ-.37,pw,b.floorHeight,.74,0,'masonry-pier');
        if((brick||pilaster)&&q>0&&q<b.bays){
          box(trim,xx,y0+b.floorHeight/2,b.frontZ+.06,pilaster?.36:.19,b.floorHeight,pilaster?.35:.25,0,pilaster?'masonry-bay-pilaster':'brick-pilaster');
          if(pilaster)for(const yy of [y0+.16,y0+b.floorHeight-.19])box(trim,xx,yy,b.frontZ+.15,.57,.23,.45,0,'pilaster-capital-and-base');
        }
      }
      for(const[lo,hi]of [[y0,wy-h/2],[wy+h/2,y0+b.floorHeight]])if(hi>lo)
        box(wall,b.x,(lo+hi)/2,b.frontZ-.37,b.width,hi-lo,.74,0,'masonry-spandrel');
      if(brick)cornice(b,y0+.13,trim,true);
      else if(enclosed){
        // IMG_8223/8246: linked apron, overhanging slab and thin metal ribbon
        // joinery. Opaque panels stop below glazing; rooms remain actual voids.
        box(trim,b.x,y0+.045,b.frontZ+.42,b.width+.16,.18,1.08,0,'enclosed-balcony-slab');
        box(wall,b.x,y0+.40,b.frontZ+.57,b.width-.16,.62,.15,0,'enclosed-balcony-apron');
        for(const xx of [b.x-b.width/2+.12,b.x+b.width/2-.12])box(trim,xx,wy,b.frontZ+.26,.12,h+.13,.72,0,'enclosed-balcony-end-return');
        stats.balconies++;
      }else if(pilaster){
        box(trim,b.x,y0+.10,b.frontZ+.15,b.width+.12,.18,.46,0,'masonry-string-course');
        box(trim,b.x,y0+.26,b.frontZ+.10,b.width+.05,.09,.32,0,'masonry-string-bead');
      }else box(trim,b.x,y0+.05,b.frontZ+(timber?.13:.015),b.width+.14,timber?.18:.12,timber?.42:.22,0,timber?'verandah-ledge':'flush-plaster-floor-band');
      for(let q=0;q<b.bays;q++){
        const x=b.x-b.width/2+(q+.5)*bay;
        stats.windows++;stats.piercedOpenings.push({building:b.id,floor:f+1,bay:q,center:[x,wy,b.frontZ],width:w,height:h,roomDepth:1.62,frameZ});
        box(M.dark,x,wy,b.frontZ-1.66,w+.18,h+.18,.10,0,'recessed-room-back');
        // Jambs reach the true joinery plane; no facade card covers the holes.
        const revealFront=Math.max(b.frontZ,frameZ),revealDepth=revealFront-(b.frontZ-.90);
        for(const xx of [x-w/2,x+w/2])box(trim,xx,wy,revealFront-revealDepth/2,.055,h,revealDepth,0,'window-deep-reveal');
        for(const yy of [wy-h/2,wy+h/2])box(trim,x,yy,revealFront-revealDepth/2,w+.07,.055,revealDepth);
        if(!enclosed)box(trim,x,wy-h/2-.10,b.frontZ+(recessed?.015:.23),w+(pilaster?.48:.32),.17,recessed?.24:.61,0,recessed?'inset-plaster-sill':'deep-sill');
        if(pilaster){
          box(trim,x,wy+h/2+.14,b.frontZ+.17,w+.49,.20,.43,0,'pilaster-window-hood');
          for(const xx of [x-w*.44,x+w*.44])box(trim,xx,wy+h/2-.02,b.frontZ+.14,.13,.20,.33,0,'window-hood-corbel');
        }
        const leaves=b.windowPattern==='tripartite'?3:2;
        for(let j=0;j<=leaves;j++)box(joinery,x-w/2+j*w/leaves,wy,frameZ-.035,.070,h+.09,.095,0,enclosed?'ribbon-window-mullion':'window-jamb');
        for(const yy of [wy-h/2,wy+h/2])box(joinery,x,yy,frameZ-.035,w+.09,.075,.11);
        const opens=r()<.57,openSide=r()<.5?-1:1;
        for(let leaf=0;leaf<leaves;leaf++){
          const side=leaf===0?-1:1,leafW=w/leaves*.96,leafX=x+(leaf-(leaves-1)/2)*w/leaves;
          const canOpen=leaves===2||leaf!==1,angle=opens&&side===openSide&&canOpen&&b.windowPattern!=='ribbon_slider'?-side*(.38+r()*.48):0;
          const slide=b.windowPattern==='ribbon_slider'&&opens&&leaf===0?w*.10:0;
          windowLeaf(joinery,f===0||r()<.12?M.glassWarm:M.glass,leafX+slide,wy,frameZ+(slide?.055:0),leafW,h-.08,angle,side,false,b.windowPattern);
          if(angle)stats.openCasements++;
        }
        if(timber||(brick&&(f+q)%3===0)){
          const side=(f+q)%2?1:-1,leaf=w*.33,shutterAngle=side*(.17+r()*.35);
          if(!far)windowLeaf(wood,M.glass,x+side*(w/2+leaf*.44),wy,b.frontZ+.20,leaf,h+.03,shutterAngle,-side,true);
        }
        if(r()<density)cage(x,wy,Math.max(b.frontZ+.14,frameZ+.02),w+.25,h+.20,.42+r()*.26,brick&&(f+q)%4===0,r);
        const openBalcony=b.balconyPattern==='continuous'||b.balconyPattern==='alternating'&&(brick?f===1:((f+q+bi)%3===1));
        if(!enclosed&&openBalcony)balcony(b,x,y0,bay,timber,trim,wood);
        if(near&&(f===0||f===2)&&q===Math.floor(b.bays/2))laundry(b,x,y0+2.11,seed+bi*100+f);
        if((f*b.bays+q+bi)%4===1){
          const ax=x+w*.30,ay=wy-h*.35-.22,az=enclosed?.95:.56;
          box(M.zinc,ax,ay,b.frontZ+az,.72,.43,.66,0,'window-air-conditioner');
          for(let j=0;j<(near?6:0);j++)box(M.dark,ax,ay-.15+j*.06,b.frontZ+az+.342,.59,.020,.018,0,'air-conditioner-grille');
          for(const xx of [ax-.27,ax+.27])rod(M.rust,[xx,ay-.42,b.frontZ+.04],[xx,ay-.21,b.frontZ+az+.30],.025,'air-conditioner-bracket');
        }
      }
      if(f===0)canopy(b,b.x,b.width*.95,y0+2.79,brick?.9:enclosed?.68:1.13,brick?.27:enclosed?.22:.37,brick?M.clothBlue:M.clothGreen,seed+bi*10+70);
    }
    roof(b,H,wall,trim,bi);
    if(!far)serviceWires(b,H);
    const shops = b.shops || [], sw = b.width / Math.max(1, shops.length);
    const bladeShop=shops.findIndex(shop=>shop.signShape==='blade');
    const projectingShop=bladeShop>=0?bladeShop:bi%Math.max(1,shops.length);
    for (let si = 0; si < shops.length; si++) {
      const shop = shops[si], x = b.x - b.width / 2 + (si + 0.5) * sw, shopIndex = bi * 2 + si;
      for (const xx of [x - sw / 2 + 0.07, x + sw / 2 - 0.07]) box(trim, xx, b.groundHeight / 2, b.frontZ + 0.09, 0.25, b.groundHeight, 0.49, 0, 'shop-pier');
      shopInterior(b, shop, x, sw, shopIndex, wood, r);
      if (r() < signDensity) fascia(b, shop, x, sw, shopIndex, r);
      if (si === projectingShop && r() < signDensity) projectingSign(b, shop, x + sw * 0.38, bi === 0 ? 9.08 : 10.81, shopIndex);
      canopy(b, x, sw * 0.96, 3.30 + (si % 2) * 0.07, 1.70 + r() * 0.32, 0.49 + r() * 0.19, [M.clothGreen, M.clothRed, M.clothCream, M.clothBlue][shopIndex % 4], seed + bi * 30 + si, shopIndex % 2 === 0);
    }
    // Flush side-walk and inset drain remain wholly outside the rail envelope.
    const walkFront = Math.min(-2.40, b.frontZ + 3.1);
    box(M.concrete, b.x, 0.025, (b.frontZ + walkFront) / 2, b.width, 0.09, walkFront - b.frontZ + 0.10, 0, 'sidewalk');
    box(M.dark, b.x, 0.065, b.frontZ + 0.72, b.width - 0.06, 0.012, 0.11, 0, 'flush-drain');
    for (let j = 0; j < (near?Math.ceil(b.width/.48):0); j++) {
      const xx = b.x - b.width / 2 + 0.22 + j * 0.48;
      for (let slot = 0; slot < 4; slot++) box(M.iron, xx - 0.13 + slot * 0.075, 0.071, b.frontZ + 0.72, 0.024, 0.017, 0.15, 0, 'drain-grate');
    }
  }
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    for (let i = 0; i < batch.matrices.length; i++) mesh.setMatrixAt(i, batch.matrices[i]);
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = `street-batch:${batch.material.name || batch.material.uuid}`;
    mesh.userData.parts = [...batch.tags];
    if (mesh.computeBoundingBox) mesh.computeBoundingBox(); if (mesh.computeBoundingSphere) mesh.computeBoundingSphere();
    root.add(mesh);
  }
  root.updateMatrixWorld(true);
  // Count expanded geometry, including batched instances, cloth and sculpted text.
  const railHalf = score.construction.railClearance?.halfWidth ?? 1.6;
  const railHeight = score.construction.railClearance?.height ?? 4.75;
  root.traverse(o => {
    if (!o.isMesh) return;
    const count = o.isInstancedMesh ? o.count : 1;
    const tri = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    stats.expandedTriangles += tri * count; stats.instances += o.isInstancedMesh ? count : 0; stats.drawCalls++;
    geometries.add(o.geometry);
    const mm = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mm) usedMaterials.add(m);
    // Every generated object lies in the far-side zone; this conservative AABB
    // test includes the matrix-transformed bounds of every individual instance.
    const check = matrix => {
      bounds.copy(o.geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position)).applyMatrix4(matrix);
      if (bounds.max.y > 0 && bounds.min.y < railHeight && bounds.max.z > -railHalf && bounds.min.z < railHalf) {
        throw new Error(`Street architecture intersects the swept railway clearance: ${o.name}`);
      }
      if (bounds.max.z > 0) throw new Error('Camera side +Z must remain permanently open.');
    };
    if (o.isInstancedMesh) {
      const local = new THREE.Matrix4(), world = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, local); world.multiplyMatrices(o.matrixWorld, local); check(world); }
    } else check(o.matrixWorld);
  });
  stats.expandedTriangles = Math.round(stats.expandedTriangles); stats.materials = usedMaterials.size;
  stats.detail=detail;stats.clothPieces = cloth.length; stats.railClearanceVerified = true;
  root.userData.stats = stats;
  return { root, cloth, stats, resources: { geometries: [...geometries], materials: [...usedMaterials] } };
}
