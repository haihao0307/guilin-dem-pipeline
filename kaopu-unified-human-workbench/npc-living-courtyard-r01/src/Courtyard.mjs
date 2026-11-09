/**
 * KAOPU living courtyard — original scene, authored for the two complete R07 people.
 * Units are metres; +Y is up, +Z is the open/front side. All runtime assets are
 * procedural geometry or in-document canvas textures. No network asset fetches.
 * Static geometry is merged by material to keep the street around the people cheap.
 */
export function createCourtyard(THREE) {
  const group = new THREE.Group();
  group.name = 'KAOPU-original-living-courtyard';
  const batches = new Map(), textures = [], dynamic = [], colliders = [];
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
  box(0, -.19, .2, 13.4, .3, 9.4, mats.foundation);
  box(0, -.055, .2, 13.25, .08, 9.25, mats.joint);
  const paverTints = [0xffffff,0xf1ece0,0xe2dfd4,0xf5e9d5,0xeae8df];
  for (let row = 0; row < 21; row++) {
    const z = -4.18 + row * .438;
    for (let column = 0; column < 21; column++) {
      let x = -6.33 + column * .625 + (row % 2) * .3125;
      if (x > 6.4) continue;
      box(x, -.026, z, .609, .052, .422, mats.paving, null, paverTints[Math.floor(random() * paverTints.length)]);
    }
  }
  box(-6.59,-.012,.2,.17,.025,9.38,mats.curb); box(6.59,-.012,.2,.17,.025,9.38,mats.curb);
  box(0,-.012,4.81,13.2,.025,.17,mats.curb); box(0,-.012,-4.41,13.2,.025,.17,mats.curb);
  // A narrow drain is flush with the front paving, away from all interaction targets.
  box(.4,.002,4.31,7.2,.008,.065,mats.iron);
  for(let i=0;i<66;i++) box(-3.1+i*.108,.008,4.31,.012,.006,.055,mats.brass);

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
    colliders.push({id:'building-'+cx,kind:'box',min:[cx-width/2,0,-4.44],max:[cx+width/2,2.82,-3.28]});
  }
  building(-3.62,5.05,mats.plasterLight,3.48);
  building(2.62,7.05,mats.plaster,3.63);
  // Subtle masonry quoins tie the façades to the same ground scale.
  for(const x of [-6.12,-1.12,-.90,6.12]) for(let i=0;i<8;i++) box(x,.18+i*.34,-3.185,.20,.29,.13,mats.stone,null,i%2?0xf1eade:0xffffff);
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
  colliders.push({id:'bakery-counter',kind:'box',min:[2.29,0,-1.10],max:[4.51,.95,-.40]});
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
  colliders.push({id:'recycling-counter',kind:'box',min:[-5.41,0,-1.05],max:[-4.19,.85,-.35]});
  const recycle={center:[-4.8,.425,-.70],size:[1.22,.85,.70],top:.85};

  // Continuous timber bench: both seat targets lie on actual slats at y=.46.
  const benchCenter=-3.05;
  for(let i=0;i<5;i++) box(benchCenter,.425,1.44+i*.105,2.60,.070,.092,mats.timber);
  for(const x of [-4.11,-1.99]) {
    box(x,.227,1.46,.065,.455,.065,mats.iron);
    box(x,.227,1.85,.065,.455,.065,mats.iron);
    box(x,.36,1.65,.07,.055,.50,mats.iron);
    box(x,.68,1.31,.062,.81,.062,mats.iron,[.09,0,0]);
    cylinder([x,0.12,1.45],[x,.37,1.84],.018,.018,mats.iron,8);
  }
  for(let i=0;i<4;i++) box(benchCenter,.655+i*.115,1.30-i*.012,2.60,.09,.060,mats.timber,[-.105,0,0]);
  for(const x of [-4.30,-1.80]) {
    box(x,.61,1.65,.055,.31,.055,mats.iron);
    box(x,.755,1.65,.09,.045,.49,mats.darkTimber);
  }
  colliders.push({id:'bench',kind:'seat',min:[-4.35,0,1.20],max:[-1.75,1.05,1.92],seatTop:.46});
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
    colliders.push({id:'pot-'+x+'-'+z,kind:'cylinder',center:[x,height*.5,z],radius:radius*1.05,height});
  }
  pot(-4.60,1.57,.24,.39,true);pot(-1.50,1.54,.27,.43,true);
  pot(-.63,-2.67,.24,.43,true);pot(5.72,-2.61,.29,.49,true);
  pot(6.10,3.72,.32,.53,false);

  // A slender olive tree provides a canopy at the left perimeter, away from all paths.
  const tx=-6.07,tz=.16;
  box(tx,.14,tz,.77,.28,.85,mats.stone);
  box(tx,.286,tz,.66,.018,.74,mats.soil);
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
  colliders.push({id:'olive-tree-planter',kind:'box',min:[tx-.385,0,tz-.425],max:[tx+.385,.30,tz+.425]});

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
  const spots={
    benchA:{stand:[-3.65,0,2.30],seat:[-3.65,.46,1.65],yaw:0},
    benchB:{stand:[-2.45,0,2.30],seat:[-2.45,.46,1.65],yaw:0},
    recycle:{stand:[-4.8,0,0],contact:[-4.8,.85,-.70],yaw:Math.PI},
    bakery:{stand:[3.4,0,0],contact:[3.4,.95,-.75],yaw:Math.PI},
    shelterA:{stand:[1.90,0,-1.80],yaw:0},
    shelterB:{stand:[4.90,0,-1.80],yaw:0},
    bottleStarts:[[-1.2,0,.4],[1,0,1.9],[3.2,0,2.5],[-4.5,0,3.1]]
  };
  const bounds=new THREE.Box3().setFromObject(group);
  const metrics={
    schema:'kaopu/courtyard-geometry@1',unit:'metre',floorY:0,sceneSource:'authored procedural 3D',
    staticDrawCalls:batches.size,dynamicDrawCalls:group.children.length-batches.size,
    meshCount:group.children.length,staticVertices,staticTriangles,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    seatTop:.46,bakeryCounterTop:.95,recyclingCounterTop:.85,externalAssets:0,
    bodySource:'separate complete canonical R07 actors supplied by host',
    colliders
  };
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
  }
  function dispose() {
    group.traverse(object=>{if(object.isMesh)object.geometry.dispose();});
    for(const mat of Object.values(mats))mat.dispose();
    for(const t of textures)t.dispose();
  }
  return {group,spots,bottles:new Map(),shop,recycle,bench,colliders,metrics,update,dispose};
}
