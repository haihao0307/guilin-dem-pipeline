/**
 * KAOPU living street R02 — expanded real geometry around six complete R07 people.
 * Units are metres; +Y is up, +Z is the open/front side. All runtime assets are
 * procedural geometry or in-document canvas textures. No network asset fetches.
 * Static geometry is merged by material to keep the street around the people cheap.
 */
import {STREET_LAYOUT} from './WorldLayout.mjs';

export function createCourtyard(THREE) {
  const group = new THREE.Group();
  group.name = 'KAOPU-living-street-r02';
  const batches = new Map(), textures = [], dynamic = [];
  const colliders = structuredClone(STREET_LAYOUT.colliders);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  let seed = 184703;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + (b - a) * random();
  const color = hex => new THREE.Color(hex);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function canvasTexture(width, height, paint, repeat = null) {
    if (typeof document === 'undefined') return null; // Numeric geometry QA has no DOM.
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw Error('Courtyard material canvas is unavailable');
    paint(context, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat); }
    texture.anisotropy = 2;
    textures.push(texture);
    return texture;
  }
  const plasterTexture = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#f7f3e8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9500; i++) {
      const g = Math.floor(range(170, 240)); c.fillStyle = `rgba(${g},${g - 4},${g - 13},${range(.025, .09)})`;
      c.fillRect(random() * w, random() * h, range(.5, 2), range(.5, 2));
    }
  }, [2, 2]);
  const timberTexture = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#dfc09a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const y = random() * h; c.strokeStyle = `rgba(80,43,22,${range(.04, .22)})`;
      c.lineWidth = range(.4, 1.5); c.beginPath(); c.moveTo(0, y);
      c.bezierCurveTo(w * .3, y + range(-6, 6), w * .7, y + range(-6, 6), w, y + range(-2, 2)); c.stroke();
    }
  }, [1, .5]);
  const pavingTexture = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#f3eee4'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      c.fillStyle = random() > .4 ? 'rgba(70,61,48,.055)' : 'rgba(255,255,250,.18)';
      c.fillRect(random() * w, random() * h, range(.5, 1.4), range(.5, 1.4));
    }
  });

  const material = (name, hex, roughness = .8, options = {}) => {
    const m = new THREE.MeshStandardMaterial({color:hex, roughness, metalness:0, vertexColors:true, ...options});
    m.name = 'courtyard/' + name; return m;
  };
  const mats = {
    foundation: material('limestone-plinth', 0x9e9a86, .96),
    paving: material('cut-sandstone', 0xd8d0b9, .93, {map:pavingTexture}),
    joint: material('paving-joints', 0xa79c84, 1),
    curb: material('perimeter-stone', 0xbdb59e, .95),
    plaster: material('warm-lime-plaster', 0xf2e7cf, .94, {map:plasterTexture}),
    plasterLight: material('pale-lime-plaster', 0xe9e5d3, .94, {map:plasterTexture}),
    stone: material('weathered-dressed-stone', 0xb5a78d, .96, {map:pavingTexture}),
    roof: material('clay-roof-tile', 0x9e543f, .88),
    roofEdge: material('clay-roof-edge', 0xb97152, .9),
    timber: material('oiled-walnut', 0xa57547, .72, {map:timberTexture}),
    darkTimber: material('dark-walnut', 0x6c4b31, .78, {map:timberTexture}),
    green: material('bakery-painted-wood', 0x31574d, .72),
    fabric: material('cotton-awning', 0x466c5a, .96, {side:THREE.DoubleSide}),
    brass: material('aged-brass', 0x9d8955, .5, {metalness:.62}),
    iron: material('painted-iron', 0x35433e, .67, {metalness:.42}),
    glassDark: material('recessed-window', 0x293d35, .34, {metalness:.1}),
    recess: material('deep-recess', 0x514b3e, .95),
    terracotta: material('terracotta-planters', 0xaf6f50, .98),
    soil: material('garden-soil', 0x4f4934, 1),
    bark: material('tree-bark', 0x6b6248, .97, {map:timberTexture}),
    leaf: material('olive-foliage', 0x6f8050, .94, {side:THREE.DoubleSide}),
    leafDark: material('deep-foliage', 0x3e684b, .98, {side:THREE.DoubleSide}),
    flowers: material('white-geraniums', 0xf3ddc9, .96, {side:THREE.DoubleSide}),
    flowerRose: material('rose-geraniums', 0xd89181, .96, {side:THREE.DoubleSide}),
    lamp: material('warm-lantern-glass', 0xf3d89b, .45, {emissive:0xffb75a, emissiveIntensity:.55}),
    bread: material('bread-crust', 0xbd8349, .9),
    breadScore: material('bread-cut', 0xe1c293, .96),
    label: material('cream-label', 0xf1e2c2, .86)
  };

  function addGeometry(geometry, mat, matrix = null, tint = 0xffffff) {
    let batch = batches.get(mat);
    if (!batch) { batch = {position:[], normal:[], uv:[], color:[], count:0}; batches.set(mat, batch); }
    const g = geometry.clone(); if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const ids = g.index?.array, count = ids ? ids.length : p.count, col = color(tint);
    for (let i = 0; i < count; i++) {
      const j = ids ? ids[i] : i;
      batch.position.push(p.getX(j), p.getY(j), p.getZ(j));
      batch.normal.push(n.getX(j), n.getY(j), n.getZ(j));
      batch.uv.push(uv ? uv.getX(j) : 0, uv ? uv.getY(j) : 0);
      batch.color.push(col.r, col.g, col.b);
    }
    batch.count++; g.dispose();
  }
  function transform(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    return dummy.matrix;
  }
  function box(x, y, z, sx, sy, sz, mat, rot = null, tint = 0xffffff) {
    addGeometry(boxGeo, mat, transform(x, y, z, sx, sy, sz, ...(rot || [0, 0, 0])), tint);
  }
  function cylinder(a, b, r1, r2, mat, segments = 10, tint = 0xffffff) {
    const direction = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), length = direction.length();
    const geo = new THREE.CylinderGeometry(r2, r1, length, segments, 1, false);
    dummy.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    dummy.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize()); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    addGeometry(geo, mat, dummy.matrix, tint); geo.dispose();
  }
  function triangles(vertices, mat, tint = 0xffffff) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals(); addGeometry(g, mat, null, tint); g.dispose();
  }
  function quad(a, b, c, d, mat, tint = 0xffffff) { triangles([...a, ...b, ...c, ...a, ...c, ...d], mat, tint); }
  function sign(text, x, y, z, width, height, options = {}) {
    const {background='#244a40',foreground='#f0e1bd',font='serif',small='',border=true} = options;
    const texture = canvasTexture(1024, 256, (c, w, h) => {
      c.fillStyle = background; c.fillRect(0, 0, w, h);
      if (border) { c.strokeStyle = foreground; c.globalAlpha = .45; c.lineWidth = 3; c.strokeRect(18, 16, w - 36, h - 32); c.globalAlpha = 1; }
      c.fillStyle = foreground; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${small ? 92 : 108}px ${font}`; c.fillText(text, w / 2, small ? h * .43 : h / 2);
      if (small) { c.font = '29px sans-serif'; c.globalAlpha = .8; c.fillText(small, w / 2, h * .78); }
    });
    const mat = new THREE.MeshStandardMaterial({color:0xffffff, map:texture, roughness:.92});
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    mesh.position.set(x, y, z); mesh.name = 'courtyard/sign-' + text; group.add(mesh);
    return mesh;
  }
  function leaf(center, length, width, rotation, mat, tint = 0xffffff) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,-length/2,-width/2,0,-length*.12,0,length*.035,0, width/2,0,-length*.12,0,0,length/2, -width/2,0,length*.18, width/2,0,length*.18], 3));
    g.setIndex([0,1,2,0,2,3,1,5,2,3,2,6,5,4,2,6,2,4]); g.computeVertexNormals();
    addGeometry(g, mat, transform(...center, 1,1,1, ...rotation), tint); g.dispose();
  }

  // The paving surface is exactly y=0. The thin foundation is visible only at its edge.
  box(0, -.19, 2, 26, .3, 14, mats.foundation);
  box(0, -.055, 2, 25.85, .08, 13.85, mats.joint);
  const paverTints = [0xffffff,0xf1ece0,0xe2dfd4,0xf5e9d5,0xeae8df];
  for (let row = 0; row < 32; row++) {
    const z = -4.78 + row * .438;
    for (let column = 0; column < 42; column++) {
      let x = -12.70 + column * .625 + (row % 2) * .3125;
      if (x > 12.70) continue;
      box(x, -.026, z, .609, .052, .422, mats.paving, null, paverTints[Math.floor(random() * paverTints.length)]);
    }
  }
  box(-12.92,-.012,2,.16,.025,13.98,mats.curb); box(12.92,-.012,2,.16,.025,13.98,mats.curb);
  box(0,-.012,8.92,25.84,.025,.16,mats.curb); box(0,-.012,-4.92,25.84,.025,.16,mats.curb);
  // A narrow drain is flush with the front paving, away from all interaction targets.
  box(0,.002,8.40,24,.008,.065,mats.iron);
  for(let i=0;i<220;i++) box(-11.8+i*.108,.008,8.40,.012,.006,.055,mats.brass);

  function building(cx, width, mat, roofHeight) {
    box(cx,1.41,-3.86,width,2.82,1.16,mat);
    box(cx,.24,-3.253,width+.025,.48,.10,mats.stone);
    box(cx,2.75,-3.20,width+.11,.18,.16,mats.stone);
    const left=cx-width/2-.16,right=cx+width/2+.16;
    quad([left,2.85,-3.02],[right,2.85,-3.02],[right,roofHeight,-3.83],[left,roofHeight,-3.83],mats.roof);
    quad([left,roofHeight,-3.83],[right,roofHeight,-3.83],[right,2.85,-4.57],[left,2.85,-4.57],mats.roof);
    triangles([left,2.82,-3.02,left,roofHeight,-3.83,left,2.82,-4.57, right,2.82,-4.57,right,roofHeight,-3.83,right,2.82,-3.02],mat);
    const count=Math.ceil(width/.24);
    for(let i=0;i<=count;i++) {
      const x=left+(right-left)*i/count;
      cylinder([x,2.87,-3.01],[x,roofHeight+.012,-3.83],.032,.026,mats.roofEdge,6);
      cylinder([x,roofHeight+.012,-3.83],[x,2.87,-4.57],.026,.032,mats.roofEdge,6);
    }
    cylinder([left,roofHeight+.025,-3.83],[right,roofHeight+.025,-3.83],.075,.075,mats.roofEdge,10);
    box(cx,2.83,-3.035,width+.30,.09,.09,mats.darkTimber);
  }
  for(const facade of STREET_LAYOUT.facades)building(facade.x,facade.width,mats[facade.material],facade.height);
  // Subtle masonry quoins tie the façades to the same ground scale.
  for(const x of [-12.01,-6.84,-6.12,-1.12,-.90,6.12,7.08,12.08]) for(let i=0;i<8;i++) box(x,.18+i*.34,-3.185,.20,.29,.13,mats.stone,null,i%2?0xf1eade:0xffffff);
  // Left house windows, with a true layered frame, slatted shutters, sill and lintel.
  function houseWindow(x, y, width=1.12, height=1.30) {
    box(x,y,-3.205,width+.19,height+.18,.10,mats.darkTimber);
    box(x,y,-3.142,width,height,.05,mats.glassDark);
    box(x,y-height/2-.095,-3.06,width+.34,.12,.28,mats.stone);
    box(x,y,-3.095,.042,height,.06,mats.timber); box(x,y,-3.095,width,.042,.06,mats.timber);
    for(const s of [-1,1]) {
      box(x+s*(width/2+.235),y,-3.12,.37,height+.10,.07,mats.green);
      for(let i=0;i<9;i++) box(x+s*(width/2+.235),y-height*.43+i*height*.108,-3.065,.31,.04,.046,mats.green,[.25,0,0],i%2?0xdfe3d8:0xffffff);
    }
  }
  houseWindow(-4.63,1.73,1.10,1.35);
  houseWindow(-2.27,1.73,.95,1.35);
  houseWindow(11.23,1.70,.78,1.22);
  // House door sits behind the roaming area, not on a navigable target.
  box(-.05,1.07,-3.18,.98,2.13,.13,mats.darkTimber);
  box(-.05,1.10,-3.095,.82,1.95,.045,mats.green);
  box(-.05,1.53,-3.059,.59,.77,.025,mats.glassDark);
  for(const x of [-.35,.25]) box(x,.56,-3.05,.04,.75,.025,mats.timber);
  box(.23,1.02,-3.025,.035,.18,.055,mats.brass);
  box(-.05,.035,-3.02,1.16,.07,.36,mats.stone);

  // Bakery shopfront and canopy. Characters approach the detached service counter.
  box(3.38,1.46,-3.19,3.15,2.11,.12,mats.green);
  box(3.38,1.51,-3.115,2.91,1.86,.05,mats.recess);
  for(const x of [1.95,2.90,3.86,4.81]) box(x,1.50,-3.04,.065,1.90,.09,mats.green);
  box(3.38,1.18,-3.035,2.92,.065,.09,mats.green);
  box(3.38,.58,-3.025,3.15,.13,.28,mats.timber);
  for(let i=0;i<7;i++) {
    const x=2.16+i*.39;
    cylinder([x-.105,.79,-3.00],[x+.105,.79,-3.00],.055,.05,mats.bread,10, i%2?0xf5dfbb:0xffffff);
    cylinder([x-.085,1.41,-3.00],[x+.085,1.41,-3.00],.050,.045,mats.bread,10);
  }
  sign('麦香面包房',3.38,2.51,-3.035,3.14,.44,{small:'BREAD · COFFEE · A SLOW AFTERNOON'});
  // Canopy fabric consists of a pitched sheet and individual scalloped valances.
  quad([1.35,2.45,-1.10],[5.37,2.45,-1.10],[5.37,2.68,-3.08],[1.35,2.68,-3.08],mats.fabric);
  for(let i=0;i<16;i++) {
    const x=1.35+(i+.5)*4.02/16;
    box(x,2.385,-1.10,4.02/16-.003,.14,.024,mats.fabric);
    const geo=new THREE.CylinderGeometry(.126,.126,.023,12,1,false,0,Math.PI);
    addGeometry(geo,mats.fabric,transform(x,2.316,-1.10,1,1,1,Math.PI/2,0,0));geo.dispose();
  }
  for(const x of [1.38,5.34]) {
    cylinder([x,2.43,-1.1],[x,2.66,-3.13],.018,.018,mats.iron,8);
    cylinder([x,1.88,-3.16],[x,2.43,-1.15],.014,.014,mats.iron,8);
  }
  box(3.4,.43,-.75,2.10,.86,.58,mats.green);
  for(let i=0;i<12;i++) box(2.39+i*.183,.43,-.447,.025,.77,.021,mats.darkTimber);
  box(3.4,.905,-.75,2.22,.09,.70,mats.timber);
  box(3.4,.05,-.75,2.18,.10,.64,mats.darkTimber);
  box(3.31,.969,-.75,1.44,.038,.44,mats.darkTimber);
  box(4.23,.991,-.75,.27,.08,.23,mats.brass);
  const breadMeshes=[];
  const breadGeometry = new THREE.SphereGeometry(1,12,8);
  for(let i=0;i<6;i++) {
    const bread=new THREE.Mesh(breadGeometry,mats.bread.clone());
    // Each loaf has an independent mesh because purchases change real stock display.
    bread.material.vertexColors=false;bread.name='bakery-loaf-'+i;
    bread.position.set(2.82+(i%3)*.37,1.03+(i>=3?.02:0),-.65-(i>=3?.20:0));
    bread.scale.set(.16,.07,.082);bread.rotation.y=i%2?.12:-.16;
    bread.castShadow=true; bread.receiveShadow=true;group.add(bread);breadMeshes.push(bread);
  }
  const shopStatus = sign('营业中',4.25,1.17,-.365,.45,.19,{background:'#f1e6ce',foreground:'#345549',border:false});
  const statusTextures={open:shopStatus.material.map,closed:null};
  statusTextures.closed=canvasTexture(512,192,(c,w,h)=>{c.fillStyle='#e3d5bf';c.fillRect(0,0,w,h);c.fillStyle='#795947';c.font='72px serif';c.textAlign='center';c.textBaseline='middle';c.fillText('暂时休息',w/2,h/2);});
  const shop={counter:{center:[3.4,.475,-.75],size:[2.22,.95,.70],top:.95},bread:breadMeshes,statusSign:shopStatus,open:true,stock:6};

  // Reuse station. The top is intentionally reachable from z=0 without stepping through it.
  box(-4.8,.40,-.70,1.15,.80,.64,mats.green);
  box(-4.8,.825,-.70,1.22,.05,.70,mats.timber);
  for(const x of [-5.10,-4.50]) {
    box(x,.43,-.362,.50,.64,.028,mats.iron);
    for(let i=0;i<4;i++) box(x,.30+i*.10,-.34,.40,.018,.016,mats.green);
  }
  box(-4.8,1.075,-.975,1.20,.34,.045,mats.darkTimber);
  sign('空瓶回收',-4.8,1.075,-.947,1.10,.26,{background:'#dfd1af',foreground:'#48604b',border:false});
  for(let i=0;i<4;i++) {
    cylinder([-5.15+i*.20,.86,-.78],[-5.15+i*.20,1.05,-.78],.033,.026,mats.glassDark,8);
    cylinder([-5.15+i*.20,1.05,-.78],[-5.15+i*.20,1.09,-.78],.015,.015,mats.brass,8);
  }
  const recycle={center:[-4.8,.425,-.70],size:[1.22,.85,.70],top:.85};

  // Three separate benches retain the same measured slats and contact height.
  function streetBench({x,z}) {
    for(let i=0;i<5;i++) box(x,.425,z-.21+i*.105,2.60,.070,.092,mats.timber);
    for(const dx of [-1.06,1.06]) {
      box(x+dx,.227,z-.19,.065,.455,.065,mats.iron);
      box(x+dx,.227,z+.20,.065,.455,.065,mats.iron);
      box(x+dx,.36,z,.07,.055,.50,mats.iron);
      box(x+dx,.68,z-.34,.062,.81,.062,mats.iron,[.09,0,0]);
      cylinder([x+dx,0.12,z-.20],[x+dx,.37,z+.19],.018,.018,mats.iron,8);
    }
    for(let i=0;i<4;i++) box(x,.655+i*.115,z-.35-i*.012,2.60,.09,.060,mats.timber,[-.105,0,0]);
    for(const dx of [-1.25,1.25]) {
      box(x+dx,.61,z,.055,.31,.055,mats.iron);
      box(x+dx,.755,z,.09,.045,.49,mats.darkTimber);
    }
  }
  for(const item of STREET_LAYOUT.benches)streetBench(item);
  const bench={center:[-3.05,.46,1.65],width:2.60,depth:.49,seatTop:.46,backZ:1.30};

  function pot(x,z,radius=.25,height=.39,flower=false) {
    cylinder([x,.025,z],[x,height-.04,z],radius*.72,radius,mats.terracotta,16);
    cylinder([x,height-.075,z],[x,height,z],radius*1.045,radius*1.045,mats.terracotta,16);
    cylinder([x,height-.035,z],[x,height-.023,z],radius*.88,radius*.88,mats.soil,14);
    for(let i=0;i<30;i++) {
      const a=random()*Math.PI*2,d=Math.sqrt(random())*radius*.87;
      const p=[x+Math.cos(a)*d,height+range(.04,.30),z+Math.sin(a)*d];
      leaf(p,range(.12,.27),range(.045,.10),[range(-.6,.6),a,range(-.8,.8)],mats.leafDark,i%3?0xffffff:0xdce5b8);
      if(flower&&i%3===0) {
        const stemTop=height+range(.22,.42),px=p[0],pz=p[2];
        cylinder([px,height-.02,pz],[px,stemTop,pz],.006,.004,mats.leafDark,5);
        for(let petal=0;petal<5;petal++) {
          const a=petal*Math.PI*2/5;
          leaf([px+Math.cos(a)*.025,stemTop,pz+Math.sin(a)*.025],.065,.045,[.20,a,0],i%2?mats.flowers:mats.flowerRose);
        }
      }
    }
  }
  for(const p of STREET_LAYOUT.pots)pot(p.x,p.z,p.radius,p.height,p.flower);

  // Three hand-authored olive canopies sit outside the six interaction lanes.
  for(const tree of STREET_LAYOUT.trees) {
  const tx=tree.x,tz=tree.z;
  box(tx,.14,tz,tree.radius*2,.28,tree.depth*2,mats.stone);
  box(tx,.286,tz,tree.radius*2-.11,.018,tree.depth*2-.11,mats.soil);
  cylinder([tx,.27,tz],[tx+.10,2.17,tz-.05],.09,.052,mats.bark,12);
  const branchEnds=[];
  for(let i=0;i<9;i++) {
    const a=i*2.39996,reach=range(.5,1.00),y=range(2.1,3.25);
    const endpoint=[tx+Math.cos(a)*reach,y,tz+Math.sin(a)*reach*.78];
    cylinder([tx+.07,range(1.3,2),tz],endpoint,.035,.012,mats.bark,7);branchEnds.push(endpoint);
  }
  for(let i=0;i<600;i++) {
    const end=branchEnds[i%branchEnds.length],a=random()*Math.PI*2,r=Math.sqrt(random())*.53;
    const p=[end[0]+Math.cos(a)*r,end[1]+range(-.23,.42),end[2]+Math.sin(a)*r*.70];
    leaf(p,range(.11,.24),range(.038,.078),[range(-1,1),range(-Math.PI,Math.PI),range(-.9,.9)],i%5?mats.leaf:mats.leafDark,i%4?0xffffff:0xdce2b6);
  }
  }

  // Creeping foliage softens one façade junction; it remains outside navigable space.
  for(let i=0;i<160;i++) {
    const y=range(.3,2.70),x=-1.05+Math.sin(y*3)*.13+range(-.18,.18);
    leaf([x,y,-3.075],range(.10,.18),range(.07,.12),[Math.PI/2+range(-.25,.25),range(-Math.PI,Math.PI),0],mats.leafDark,i%3?0xffffff:0xc9d69d);
  }

  function lantern(x) {
    box(x,2.12,-3.08,.10,.34,.13,mats.iron);
    cylinder([x,2.30,-3.04],[x,2.30,-2.88],.015,.015,mats.iron,8);
    box(x,2.11,-2.80,.16,.29,.15,mats.lamp);
    for(const sx of [-1,1])for(const sz of [-1,1])box(x+sx*.092,2.11,-2.80+sz*.087,.019,.32,.019,mats.iron);
    box(x,2.28,-2.80,.23,.035,.21,mats.iron); box(x,1.94,-2.80,.22,.035,.20,mats.iron);
  }
  lantern(.80);lantern(5.75);

  // A small wall clock and enamel house number support human scale without UI clutter.
  cylinder([-5.85,2.38,-3.12],[-5.85,2.38,-3.01],.12,.12,mats.iron,24);
  cylinder([-5.85,2.38,-3.00],[-5.85,2.38,-2.99],.105,.105,mats.label,24);
  box(-5.85,2.42,-2.981,.012,.075,.009,mats.iron,[0,0,-.55]);
  box(-5.81,2.38,-2.979,.082,.012,.009,mats.iron);
  sign('08',.65,1.68,-3.045,.18,.19,{background:'#e1ded0',foreground:'#40564d',border:true});

  // The second shelter is an actual shop canopy, with three separate standing
  // spaces behind its clear front edge. It is not an invisible rain target.
  const tea=STREET_LAYOUT.canopies.find(c=>c.id==='tea');
  box(-9.43,1.38,-3.18,3.36,2.25,.12,mats.darkTimber);
  box(-9.43,1.39,-3.11,3.10,2.05,.05,mats.glassDark);
  for(const x of [-10.92,-9.95,-8.96,-7.95])box(x,1.39,-3.065,.065,2.09,.065,mats.green);
  box(-9.43,.58,-3.04,3.42,.13,.26,mats.timber);
  box(-9.43,1.26,-3.065,3.1,.045,.045,mats.green);
  sign('青叶茶铺',-9.43,2.52,-3.035,3.22,.43,{background:'#67734c',small:'TEA · PLANTS · EVERYDAY THINGS'});
  quad([tea.left,tea.frontY,tea.frontZ],[tea.right,tea.frontY,tea.frontZ],
    [tea.right,tea.backY,tea.backZ],[tea.left,tea.backY,tea.backZ],mats.fabric,0xd1dab4);
  for(let i=0;i<17;i++) {
    const x=tea.left+(i+.5)*(tea.right-tea.left)/17;
    box(x,2.38,tea.frontZ,(tea.right-tea.left)/17-.003,.14,.024,mats.fabric,null,0xd1dab4);
  }
  for(const x of [tea.left+.03,tea.right-.03]) {
    cylinder([x,tea.frontY-.02,tea.frontZ],[x,tea.backY-.02,tea.backZ],.018,.018,mats.iron,8);
    cylinder([x,1.88,-3.16],[x,2.43,-1.15],.014,.014,mats.iron,8);
  }
  for(let i=0;i<7;i++) {
    const x=-10.65+i*.41;
    cylinder([x,.67,-2.98],[x,.88,-2.98],.085,.07,mats.terracotta,12);
    for(let k=0;k<7;k++)leaf([x+range(-.10,.10),.94+range(0,.10),-3+range(-.08,.08)],.19,.06,[range(-.4,.4),random()*Math.PI*2,0],mats.leafDark);
  }
  lantern(-11.71);lantern(-7.15);lantern(7.17);

  // Editable window: both glass panes and wooden frames physically pivot.
  // Handles are child geometry, so the reported target follows the exact same
  // transform as the visible handle. The small sweep clears the standing lane.
  const windowSpec=STREET_LAYOUT.window,windowPivots=[],windowHandles=[];
  box(windowSpec.x,windowSpec.y,-3.205,windowSpec.width+.20,windowSpec.height+.18,.10,mats.darkTimber);
  box(windowSpec.x,windowSpec.y,-3.14,windowSpec.width,windowSpec.height,.05,mats.recess);
  box(windowSpec.x,windowSpec.y-windowSpec.height*.5-.09,-3.06,windowSpec.width+.36,.12,.28,mats.stone);
  const dynamicMaterials=[];
  function liveMaterial(mat) {const m=mat.clone();m.vertexColors=false;dynamicMaterials.push(m);return m;}
  const liveWood=liveMaterial(mats.green),liveGlass=liveMaterial(mats.glassDark),liveBrass=liveMaterial(mats.brass);
  function liveBox(parent,x,y,z,sx,sy,sz,mat) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const paneHalf=windowSpec.width*.5;
  for(const side of [-1,1]) {
    const pivot=new THREE.Group(),direction=-side;
    pivot.position.set(windowSpec.x+side*paneHalf,windowSpec.y,-3.01);
    pivot.name='street/windowA/'+(side<0?'left':'right');
    liveBox(pivot,direction*paneHalf*.5,0,-.012,paneHalf-.04,windowSpec.height-.04,.04,liveGlass);
    for(const x of [direction*.025,direction*(paneHalf-.025)])liveBox(pivot,x,0,.018,.05,windowSpec.height,.06,liveWood);
    for(const y of [-windowSpec.height*.5+.025,windowSpec.height*.5-.025])liveBox(pivot,direction*paneHalf*.5,y,.018,paneHalf,.05,.06,liveWood);
    liveBox(pivot,direction*paneHalf*.5,0,.018,paneHalf,.035,.06,liveWood);
    const handle=liveBox(pivot,direction*(paneHalf-.06),windowSpec.handleHeight-windowSpec.y,.10,.035,.14,.035,liveBrass);
    handle.name='street/windowA/'+(side<0?'left':'right')+'-handle';
    group.add(pivot);windowPivots.push(pivot);windowHandles.push(handle);dynamic.push(pivot);
  }
  sign('邻里小屋',9.47,2.50,-3.035,2.43,.35,{background:'#dfd6bd',foreground:'#5e6c52',border:false});

  // A raised flower bed and permanently mounted brass watering tap create a
  // real controllable affordance without a pretend hand-carried prop.
  const planter=STREET_LAYOUT.carePlanter,px=planter.center[0],pz=planter.center[2];
  box(px,.23,pz,planter.size[0],.46,planter.size[2],mats.stone);
  box(px,.495,pz,planter.size[0]+.04,.09,planter.size[2]+.04,mats.terracotta);
  const soilMaterial=liveMaterial(mats.soil),flowerSoil=liveBox(group,px,.512,pz,planter.size[0]-.13,.018,planter.size[2]-.13,soilMaterial);
  flowerSoil.name='street/planterA/living-soil';
  const flowersGroup=new THREE.Group();flowersGroup.name='street/planterA/living-flowers';flowersGroup.position.set(px,.52,pz);group.add(flowersGroup);
  const leafLive=liveMaterial(mats.leafDark),petalLive=liveMaterial(mats.flowerRose),flowerStems=[];
  const budGeometry=new THREE.SphereGeometry(.035,7,5);
  for(let i=0;i<18;i++) {
    const plant=new THREE.Group(),x=(i%6-2.5)*.225,z=(Math.floor(i/6)-1)*.21,h=.19+random()*.16;
    plant.position.set(x,0,z);flowersGroup.add(plant);
    liveBox(plant,0,h*.5,0,.012,h,.012,leafLive);
    const leafMesh=liveBox(plant,.026,h*.44,0,.09,.018,.037,leafLive);leafMesh.rotation.z=.35;
    for(let k=0;k<5;k++) {
      const a=k*Math.PI*2/5,m=new THREE.Mesh(budGeometry,petalLive);
      m.position.set(Math.cos(a)*.025,h,Math.sin(a)*.025);m.scale.set(1,.45,1);m.castShadow=true;plant.add(m);
    }
    flowerStems.push({group:plant,bend:(i%2?1:-1)*(.13+random()*.10)});
  }
  // Preserve every flower vertex while batching its stem/leaves and petals.
  // Each plant keeps its own moisture pose; there is no distance-based LOD.
  for(const plant of flowerStems) {
    const byMaterial=new Map();
    for(const child of [...plant.group.children]) {
      child.updateMatrix();const g=child.geometry.clone().applyMatrix4(child.matrix);
      const ids=g.index?.array,p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
      let batch=byMaterial.get(child.material);
      if(!batch){batch={position:[],normal:[],uv:[]};byMaterial.set(child.material,batch);}
      for(let at=0;at<(ids?ids.length:p.count);at++) {
        const i=ids?ids[at]:at;
        batch.position.push(p.getX(i),p.getY(i),p.getZ(i));batch.normal.push(n.getX(i),n.getY(i),n.getZ(i));
        batch.uv.push(u?u.getX(i):0,u?u.getY(i):0);
      }
      g.dispose();plant.group.remove(child);
    }
    for(const [mat,batch]of byMaterial) {
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(batch.position,3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normal,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uv,2));
      const mesh=new THREE.Mesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;plant.group.add(mesh);
    }
  }
  budGeometry.dispose();
  // The valve body is at the front; the spout points away from the visitor.
  cylinder([9.7,.03,2.65],[9.7,.97,2.65],.045,.040,mats.brass,12);
  cylinder([9.7,.98,2.65],[9.7,.98,2.25],.040,.040,mats.brass,12);
  cylinder([9.7,.98,2.25],[9.7,.92,2.25],.041,.038,mats.brass,12);
  cylinder([9.7,.02,2.65],[9.7,.07,2.65],.095,.095,mats.iron,12);
  cylinder([9.7,1.04,2.65],[9.7,1.04,2.77],.025,.025,mats.brass,10);
  const valve=new THREE.Group();valve.position.set(9.7,1.04,2.77);valve.name='street/planterA/water-valve';group.add(valve);
  liveBox(valve,0,0,.025,.18,.025,.035,liveBrass);liveBox(valve,0,0,.025,.025,.18,.035,liveBrass);
  const valveHandle=liveBox(valve,.07,0,.06,.035,.035,.035,liveBrass);
  valveHandle.name='street/planterA/valve-handle';
  const streamMaterial=new THREE.MeshStandardMaterial({color:0x9fcec8,transparent:true,opacity:.70,roughness:.14,metalness:.08,depthWrite:false});
  dynamicMaterials.push(streamMaterial);
  const stream=new THREE.Mesh(new THREE.CylinderGeometry(.014,.022,.393,10,1),streamMaterial);
  stream.position.set(9.7,.715,2.25);stream.visible=false;stream.name='street/planterA/actual-water-stream';group.add(stream);dynamic.push(stream);
  sign('一起照顾花园',9.7,.30,2.611,1.13,.19,{background:'#e2d3b6',foreground:'#536e53',border:false});

  // Flush rain puddles and wet paving are driven by the actual weather state.
  const puddleMaterial=new THREE.MeshStandardMaterial({color:0x95aca1,transparent:true,opacity:0,roughness:.22,metalness:.15,depthWrite:false});
  dynamicMaterials.push(puddleMaterial);
  for(const [x,z,sx,sz]of [[-7.1,1.0,1.4,.47],[-.4,4.8,1.9,.62],[6.7,.9,1.25,.38],[-9.1,6.7,1.4,.53],[9.9,6.6,1.8,.49]]) {
    const puddle=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.002,30),puddleMaterial);
    puddle.position.set(x,.003,z);puddle.scale.set(sx,1,sz);puddle.name='street/rain-puddle';puddle.visible=false;group.add(puddle);dynamic.push(puddle);
  }
  for(const lamp of STREET_LAYOUT.lamps) {
    cylinder([lamp.x,.05,lamp.z],[lamp.x,2.76,lamp.z],.055,.040,mats.iron,10);
    cylinder([lamp.x,0,lamp.z],[lamp.x,.15,lamp.z],.16,.12,mats.iron,12);
    box(lamp.x,2.9,lamp.z,.25,.32,.25,mats.lamp);
    for(const dx of [-.14,.14])for(const dz of [-.14,.14])box(lamp.x+dx,2.9,lamp.z+dz,.025,.38,.025,mats.iron);
    box(lamp.x,3.12,lamp.z,.37,.08,.37,mats.green);
    cylinder([lamp.x,3.13,lamp.z],[lamp.x,3.26,lamp.z],.055,.018,mats.brass,8);
  }

  // Small hanging cloth tags are true geometry. Wind moves their pivots only;
  // no decorative item participates in the NPC decision stream.
  const windTags=[];
  for(let i=0;i<9;i++) {
    const tag=new THREE.Group();tag.position.set(-10.95+i*.38,2.31,-1.11);tag.name='street/tea-canopy-tag-'+i;
    const cloth=liveBox(tag,0,-.075,0,.16,.15,.008,i%2?liveWood:liveBrass);cloth.castShadow=false;group.add(tag);windTags.push(tag);
  }

  // Finalize the static batches; each material is one draw call regardless of brick/leaf count.
  let staticVertices=0,staticTriangles=0;
  for(const [mat,data] of batches) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.normal,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.color,3));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,mat);mesh.name=mat.name+'/merged';
    mesh.castShadow=!['courtyard/cut-sandstone','courtyard/paving-joints','courtyard/limestone-plinth'].includes(mat.name);
    mesh.receiveShadow=true;group.add(mesh);staticVertices+=data.position.length/3;staticTriangles+=data.position.length/9;
  }
  boxGeo.dispose();
  const spots=structuredClone(STREET_LAYOUT.spots);
  const bounds=new THREE.Box3().setFromObject(group);
  let totalMeshCount=0;
  group.traverse(object=>{if(object.isMesh)totalMeshCount++;});
  const metrics={
    schema:'kaopu/living-street-geometry@2',unit:'metre',floorY:0,sceneSource:'authored procedural 3D',
    staticDrawCalls:batches.size,dynamicDrawCalls:totalMeshCount-batches.size,
    meshCount:totalMeshCount,rootObjectCount:group.children.length,staticVertices,staticTriangles,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    seatTop:.46,bakeryCounterTop:.95,recyclingCounterTop:.85,externalAssets:0,
    environment:{windowSweepRad:windowSpec.maxOpenRad,waterValveSweepRad:Math.PI/2,actualHandleSurfaceTargets:true,
      fixtures:['windowA','planterA'],wetPaving:true,windGeometry:true},
    bodySource:'six separate complete canonical R07 actors supplied by host',
    footprintM:[26,14],seatCount:6,shelterCount:6,layoutVersion:STREET_LAYOUT.version,
    colliders
  };
  const environment={windowProgress:0,watering:0,plantMoisture:.30,wetness:0,wind:0,time:0};
  const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
  const drySoil=mats.soil.color.clone(),wetSoil=new THREE.Color(0x302f22);
  const dryPaving=mats.paving.color.clone(),wetPaving=new THREE.Color(0xc1bda7);
  function setWindowProgress(value) {
    environment.windowProgress=clamp01(value);
    windowPivots.forEach((pivot,i)=>{pivot.rotation.y=(i?1:-1)*windowSpec.maxOpenRad*environment.windowProgress;});
    group.updateMatrixWorld(true);
  }
  function setWindowOpen(open) {setWindowProgress(open?1:0);}
  function setWatering(value) {
    environment.watering=clamp01(value);valve.rotation.z=environment.watering*Math.PI/2;
    stream.visible=environment.watering>.02;
    stream.scale.x=stream.scale.z=.4+.6*environment.watering;
    group.updateMatrixWorld(true);
  }
  function setPlantWater(value) {
    environment.plantMoisture=clamp01(value);
    soilMaterial.color.copy(drySoil).lerp(wetSoil,environment.plantMoisture);
    for(const plant of flowerStems)plant.group.rotation.z=plant.bend*(1-environment.plantMoisture);
  }
  /** Returns the FRONT SURFACE of the actual handle, not its volume centre.
   * A future progress can be sampled before committing the visible transform.
   * Window targetOpen=false reverses progress from fully open to fully shut.
   */
  function getInteractionTarget(id,progress=undefined,targetOpen=true) {
    if(id==='windowA') {
      const amount=progress===undefined?environment.windowProgress:targetOpen?clamp01(progress):1-clamp01(progress);
      const a=-windowSpec.maxOpenRad*amount,dx=paneHalf-.06,dz=.1175;
      return [windowSpec.x-paneHalf+dx*Math.cos(a)+dz*Math.sin(a),windowSpec.handleHeight,-3.01-dx*Math.sin(a)+dz*Math.cos(a)];
    }
    if(id==='planterA') {
      const amount=progress===undefined?environment.watering:clamp01(progress),a=Math.PI/2*amount;
      return [9.7+.07*Math.cos(a),1.04+.07*Math.sin(a),2.8475];
    }
    throw Error('Unknown street interaction '+id);
  }
  function setWeather({raining=false,wetness=null,wind=0}={}) {
    environment.wetness=wetness===null?(raining?1:0):clamp01(wetness);
    environment.wind=clamp01(wind);
    mats.paving.roughness=.93-.28*environment.wetness;
    mats.paving.color.copy(dryPaving).lerp(wetPaving,environment.wetness);
    puddleMaterial.opacity=.19*environment.wetness;
    for(const child of dynamic)if(child.name==='street/rain-puddle')child.visible=environment.wetness>.02;
  }
  function environmentReport() {
    const actualWindow=windowHandles[0].localToWorld(V(0,0,.0175)),actualValve=valveHandle.localToWorld(V(0,0,.0175));
    return {...environment,windowHandle:actualWindow.toArray(),valveHandle:actualValve.toArray(),
      expectedWindowHandle:getInteractionTarget('windowA'),expectedValveHandle:getInteractionTarget('planterA'),waterVisible:stream.visible};
  }
  let previousOpen=true,previousStock=6;
  function update(state={},dt=0) {
    const open=state.shop?.open??state.shopOpen??true;
    const stock=state.shop?.stock??state.shopStock??6;
    if(open!==previousOpen) {
      shop.open=open;shopStatus.material.map=open?statusTextures.open:statusTextures.closed;
      shopStatus.material.needsUpdate=true;previousOpen=open;
    }
    if(stock!==previousStock) {
      shop.stock=stock;breadMeshes.forEach((mesh,index)=>{mesh.visible=index<Math.max(0,Math.min(6,stock));});previousStock=stock;
    }
    const e=state.environment||{};
    // These values originate in acknowledged NPC/world actions. Time alone
    // never changes a window or enables water.
    if(Number.isFinite(e.windowProgress))setWindowProgress(e.windowProgress);
    // A logical windowOpen target must not overwrite the contact-driven pose
    // during an in-flight action. Reset code may explicitly setWindowOpen().
    if(Number.isFinite(e.watering))setWatering(e.watering);
    if(Number.isFinite(e.plantMoisture))setPlantWater(e.plantMoisture);
    setWeather({raining:state.raining??false,wetness:e.wetness??null,wind:e.windStrength??e.wind??state.windStrength??0});
    environment.time=Number.isFinite(state.time)?state.time:environment.time+Math.max(0,dt);
    for(let i=0;i<windTags.length;i++)windTags[i].rotation.x=Math.sin(environment.time*2.2+i*.7)*environment.wind*.34;
  }
  setWindowProgress(0);setWatering(0);setPlantWater(.30);
  function dispose() {
    group.traverse(object=>{if(object.isMesh)object.geometry.dispose();});
    for(const mat of Object.values(mats))mat.dispose();
    for(const mat of dynamicMaterials)mat.dispose();
    for(const t of textures)t.dispose();
  }
  return {group,spots,bottles:new Map(),shop,recycle,bench,colliders,metrics,layout:STREET_LAYOUT,
    environment,environmentReport,getInteractionTarget,setWindowProgress,setWindowOpen,setWatering,setPlantWater,setWeather,update,dispose};
}
