import {normalizeWallScore,wallSeed,subtractOpening} from './wall-score.mjs';
// Pure construction plan. No external vertices, bitmaps or random frame state.
export function planWallUnit(input) {
  const s=normalizeWallScore(input),d=s.dimensions,o=s.opening,m=s.material;
  const {width:w,height:h,thickness:t}=d,front=t/2,rect=[-w/2,0,w/2,h],hole=[o.x-o.width/2,o.bottom,o.x+o.width/2,o.bottom+o.height];
  const parts=[],ports=[],runoffSources=[],rng=wallSeed(s.object.seed),isDoor=s.kind==='tile-door';
  const age=Math.min(1,m.ageYears/60),base={seed:s.object.seed,age,repair:m.repair,saltExposure:m.saltExposure,origin:[0,0,0],width:w,bays:1,floorHeight:h+.25,groundHeight:0,sillHeight:o.bottom,sillEdge:(w-o.width)/(2*w)};
  const recipes={
    wall:{family:'plaster',options:{...base,color:m.tint}},
    repair:{family:'plaster',options:{...base,color:'#c6bfaa',age:Math.min(1,m.repairAgeYears/60),repair:0}},
    sill:{family:'concrete',options:{...base,color:'#89877a'}},
    frame:{family:isDoor?'wood':'iron',options:{...base,color:isDoor?'#76654c':'#536058'}},
    glass:{family:'glass',options:{...base,color:'#72857a',opacity:.34,roughness:.32}},
    tile:{family:'ceramic',options:{...base,color:m.tint}},
    iron:{family:'iron',options:{...base,color:'#46534a'}},
    door:{family:'wood',options:{...base,color:'#726148',grainAxis:'y'}}};
  function box(key,x,y,z,a,b,c,tag,group='static',shade=1) {if(a>1e-7&&b>1e-7&&c>1e-7)parts.push({shape:'box',material:key,position:[x,y,z],size:[a,b,c],tag,group,shade});}
  function rod(key,a,b,r,tag,group='static') {parts.push({shape:'rod',material:key,a:a.slice(),b:b.slice(),radius:r,tag,group,shade:1});}
  function slab(r,z,depth,key,tag,shade=1){box(key,(r[0]+r[2])/2,(r[1]+r[3])/2,z,r[2]-r[0],r[3]-r[1],depth,tag,'static',shade);}
  for(const r of subtractOpening(rect,hole))slab(r,0,t,'wall','pierced-wall');
  // A repair is a younger layer with an actual edge and its own age; clipped
  // against the same opening used for structural geometry and navigation.
  const leftWidth=hole[0]+w/2,patchWidth=Math.max(.05,leftWidth*.80);
  const patch=[-w/2+.025,.12+rng()*.14,-w/2+.025+patchWidth,Math.min(h-.12,.6+m.repair*h*.68)];
  const repairRegions=m.repair>0?subtractOpening(patch,hole):[];
  if(!isDoor)for(const r of repairRegions)slab(r,front+.0025,.005,'repair','younger-plaster-repair');
  const fw=.042,frameZ=front+.023;
  box('frame',hole[0]+fw/2,o.bottom+o.height/2,frameZ,fw,o.height,.055,'left-opening-frame');
  box('frame',hole[2]-fw/2,o.bottom+o.height/2,frameZ,fw,o.height,.055,'right-opening-frame');
  box('frame',o.x,hole[3]-fw/2,frameZ,o.width,fw,.055,'head-opening-frame');
  if(!isDoor){
    box('frame',o.x,o.bottom+fw/2,frameZ,o.width,fw,.055,'bottom-opening-frame');
    box('frame',o.x,o.bottom+o.height/2,frameZ,.025,o.height,.055,'window-mullion');
    for(const side of [-1,1])box('glass',o.x+side*o.width/4,o.bottom+o.height/2,front-.025,o.width/2-fw*1.35,o.height-fw*2,.012,'window-pane');
    box('sill',o.x,o.bottom-.035,front+.055,o.width+.16,.07,.29,'projecting-window-sill');
    box('sill',o.x,o.bottom-.072,front+.178,o.width+.18,.016,.032,'sill-drip-edge');
    runoffSources.push({id:'sill-left',position:[hole[0],o.bottom,front+.01],direction:[0,-1,0]}, {id:'sill-right',position:[hole[2],o.bottom,front+.01],direction:[0,-1,0]});
  }
  let tileCount=0;
  if(isDoor) {
    const {width:tw,height:th,joint:j}=s.tile;
    for(let row=0;row<Math.ceil(h/th);row++)for(let col=0;col<Math.ceil(w/tw);col++){
      const tile=[-w/2+col*tw+j/2,row*th+j/2,Math.min(w/2,-w/2+(col+1)*tw-j/2),Math.min(h,(row+1)*th-j/2)];
      if(tile[2]<=tile[0]||tile[3]<=tile[1])continue;
      for(const r of subtractOpening(tile,hole)){slab(r,front+.005,.010,'tile','ceramic-tile',.965+rng()*.07);tileCount++;}
    }
    // The door is a separate rigid hinge assembly, not painted on the wall.
    if(s.door.enabled){
      const leafW=o.width-fw*2-.012,leafH=o.height-fw-.015;
      box('door',leafW/2,leafH/2,0,leafW,leafH,.036,'door-leaf','door');
      for(const y of [leafH*.25,leafH*.75])box('iron',.025,y,.025,.045,.085,.027,'door-hinge-plate','door');
      rod('iron',[leafW-.065,leafH*.48,.045],[leafW-.065,leafH*.48+.13,.045],.011,'door-handle','door');
    }
  }
  const pipePaths=[];
  if(s.pipe.enabled){
    // A traceable reserved endpoint, not a claim of a functioning steam plant.
    const x=w/2-.11,z=front+.10,r=s.pipe.radius;
    const points=[[x,h+.08,z],[x,.30,z],[x,.17,z+.13],[x,.17,z+.30]];
    for(let i=1;i<points.length;i++)rod('iron',points[i-1],points[i],r,'pipe-'+s.pipe.role);
    for(const y of [.58,h-.34]){
      box('iron',x,y,front+.015,.11,.026,.04,'pipe-wall-fixing');
      rod('iron',[x-.045,y,z],[x+.045,y,z],r*.35,'pipe-clamp');
    }
    ports.push({id:'pipe-inlet',type:'utility',role:s.pipe.role,direction:'in',position:points[0],normal:[0,1,0],radius:r,connected:false},
      {id:'pipe-outlet',type:'utility',role:s.pipe.role,direction:'out',position:points.at(-1),normal:[0,0,1],radius:r,connected:false});
    pipePaths.push({id:'wall-pipe',role:s.pipe.role,from:'pipe-inlet',to:'pipe-outlet',points});
  }
  const attachments=[];
  if(s.kind==='cage-window'){
    const x0=hole[0]-.075,x1=hole[2]+.075,y0=o.bottom-.065,y1=hole[3]+.09,z0=front+.04,z1=front+s.cage.depth,r=s.cage.barRadius;
    // Window cage, not an accessible balcony: it has no claimed standing floor.
    for(const y of [y0,y1]){
      rod('iron',[x0,y,z0],[x0,y,z1],r*1.35,'cage-return');rod('iron',[x1,y,z0],[x1,y,z1],r*1.35,'cage-return');rod('iron',[x0,y,z1],[x1,y,z1],r*1.35,'cage-front-rail');
    }
    const count=Math.ceil((x1-x0)/s.cage.barSpacing);
    for(let i=0;i<=count;i++){const x=x0+(x1-x0)*i/count;rod('iron',[x,y0,z1],[x,y1,z1],r,'cage-front-bar');}
    for(const x of [x0,x1]){
      rod('iron',[x,y0,z0],[x,y1,z0],r,'cage-wall-bar');
      for(const y of [y0,y1])box('iron',x,y,front+.012,.08,.10,.022,'cage-anchor-plate');
    }
    for(const f of [.32,.66])rod('iron',[x0,y0+(y1-y0)*f,z0],[x0,y0+(y1-y0)*f,z1],r,'cage-side-bar-left');
    for(const f of [.32,.66])rod('iron',[x1,y0+(y1-y0)*f,z0],[x1,y0+(y1-y0)*f,z1],r,'cage-side-bar-right');
    // Stable hanging sockets only. No invented occupants, garments or beds.
    for(const side of [-1,1]){
      const x=o.x+side*o.width*.32,y=y1-.07,z=z1+.065;
      rod('iron',[x,y,z1],[x,y,z],r*.75,'laundry-socket-arm');
      const loop=[];for(let i=0;i<=8;i++){const a=i*Math.PI/4;loop.push([x+Math.cos(a)*.025,y+Math.sin(a)*.025,z]);}
      for(let i=1;i<loop.length;i++)rod('iron',loop[i-1],loop[i],r*.45,'laundry-socket-loop');
      attachments.push({id:side<0?'laundry-left':'laundry-right',type:'hanging-socket',position:[x,y,z],normal:[0,0,1],occupied:false,loadRating:null,interactionImplemented:false});
    }
  }
  // Centred walking envelope leaves 30 mm on each side for the open leaf's
  // hinge-side thickness/hardware. This is geometry clearance, not a code rule.
  const clearWidth=o.width-fw*2-(isDoor&&s.door.enabled?.06:0),clearHeight=o.height-fw;
  const nodes=[
    {id:'join-left',type:'wall-join',position:[-w/2,0,0],normal:[-1,0,0],span:[t,h]},
    {id:'join-right',type:'wall-join',position:[w/2,0,0],normal:[1,0,0],span:[t,h]},
    {id:'join-top',type:'wall-join',position:[0,h,0],normal:[0,1,0],span:[w,t]},
    {id:'join-bottom',type:'wall-join',position:[0,0,0],normal:[0,-1,0],span:[w,t]}];
  const edges=[];
  if(isDoor){
    nodes.push({id:'inside',type:'walk',position:[o.x,0,-t/2-.20],normal:[0,0,-1]}, {id:'outside',type:'walk',position:[o.x,0,front+.30],normal:[0,0,1]});
    edges.push({id:'through-door',from:'inside',to:'outside',clearWidth,clearHeight,threshold:0,enabled:!s.door.enabled||s.door.open,requirement:'Clearance only; host must connect both nodes to walkable floors.'});
  }
  return{score:s,parts,recipes,opening:{...o,rect:hole,type:isDoor?'door':'window',physicalVoid:true,clearWidth,clearHeight},
    graph:{nodes,edges},ports,pipePaths,attachments,runoffSources,repairRegions,tileCount,
    hinge:isDoor&&s.door.enabled?{position:[hole[0]+fw+.006,0,frameZ+.035],openAngle:Math.PI*.53}:null};
}

export function buildWallGeometry(plan,THREE,materials){
  const batches=new Map(),geometries=[];
  function append(part){
    const g=part.shape==='box'?new THREE.BoxGeometry(...part.size):new THREE.CylinderGeometry(part.radius,part.radius,new THREE.Vector3(...part.a).distanceTo(new THREE.Vector3(...part.b)),8,1,false);
    if(part.shape==='box')g.translate(...part.position);
    else{const a=new THREE.Vector3(...part.a),b=new THREE.Vector3(...part.b),delta=b.clone().sub(a);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());}
    const key=part.group+'/'+part.material;let b=batches.get(key);if(!b){b={position:[],normal:[],color:[],indices:[],group:part.group,key:part.material,tags:new Set()};batches.set(key,b);}
    const base=b.position.length/3,p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++){b.position.push(p.getX(i),p.getY(i),p.getZ(i));b.normal.push(n.getX(i),n.getY(i),n.getZ(i));b.color.push(part.shade,part.shade,part.shade);}
    for(const i of g.index.array)b.indices.push(base+i);b.tags.add(part.tag);g.dispose();
  }
  for(const part of plan.parts)append(part);
  const root=new THREE.Group(),doorGroup=new THREE.Group();root.name='Native wall '+plan.score.object.id;
  if(plan.hinge){doorGroup.name='door-hinge';doorGroup.position.fromArray(plan.hinge.position);root.add(doorGroup);}
  let triangles=0,bytes=0;
  for(const b of batches.values()){
    const g=new THREE.BufferGeometry();for(const key of ['position','normal','color'])g.setAttribute(key,new THREE.Float32BufferAttribute(b[key],3));g.setIndex(b.indices);g.computeBoundingBox();g.computeBoundingSphere();geometries.push(g);
    triangles+=g.index.count/3;bytes+=g.index.array.byteLength;for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;
    const mesh=new THREE.Mesh(g,materials.get(b.key));mesh.name=b.group+'/'+b.key;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.wallTags=[...b.tags];(b.group==='door'?doorGroup:root).add(mesh);
  }
  return{root,doorGroup,geometries,stats:{triangles,geometryBytes:bytes,drawCalls:batches.size,parts:plan.parts.length,tileCount:plan.tileCount},dispose(){for(const g of geometries)g.dispose();root.removeFromParent();root.clear();}};
}
