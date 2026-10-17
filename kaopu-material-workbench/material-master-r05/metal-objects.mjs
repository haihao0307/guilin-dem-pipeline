// R05, metres. Geometry-only receiver repair of R02/R03 rack and sign.
// No material, load rating, engineering standard or corrosion law is invented here.
// KST1-derived 1.8 m rack span / 25 mm arms / 9 mm line / 100 mm sag retained.
export const METAL_RECEIVER_PROVENANCE = Object.freeze({
  baseline: '../material-master-r03/objects.mjs',
  frozenGeometry: '../material-master-r02/sources/kst1-architecture-original.mjs',
  frozenGeometrySHA256: '58179c67d384e0a9491a15b695e29232a80dd6a4b4ed9957e6915513e1fda9f9',
  materialMother: '../material-master-r02/sources/fh88-metal-original.mjs',
  materialMotherSHA256: 'bbf9376b7a0a69d85627bd6cf4e5662be2557ee67a0a8a83411878bff133d062',
  scope: 'New R05 rack/sign receivers only. R01–R04 and frozen mothers unchanged.'
});

// An annulus at each end, an outer skin and a reversed inner skin: actual wall
// thickness remains visible from either end, rather than an uncapped solid rod.
function pipeGeometry(T, length, outer, wall, segments = 24) {
  const inner = outer - wall, vertices = [], normals = [], uv = [], indices = [];
  const v = (x,y,z,nx,ny,nz,u,w) => { vertices.push(x,y,z); normals.push(nx,ny,nz); uv.push(u,w); return vertices.length/3-1; };
  for (const [radius, sign] of [[outer,1],[inner,-1]]) {
    const start = vertices.length/3;
    for(let j=0;j<=segments;j++) { const a=2*Math.PI*j/segments,c=Math.cos(a),s=Math.sin(a); for(const y of [-length/2,length/2]) v(radius*c,y,radius*s,sign*c,0,sign*s,j/segments,(y+length/2)/length); }
    for(let j=0;j<segments;j++) { const a=start+j*2,b=a+2; if(sign>0) indices.push(a,a+1,b,b,a+1,b+1); else indices.push(a,b,a+1,b,b+1,a+1); }
  }
  for(const sign of [-1,1]) { const start=vertices.length/3; for(let j=0;j<=segments;j++){const a=2*Math.PI*j/segments,c=Math.cos(a),s=Math.sin(a);for(const r of [inner,outer])v(r*c,sign*length/2,r*s,0,sign,0,j/segments,(r-inner)/wall);}for(let j=0;j<segments;j++){const a=start+j*2,b=a+2;if(sign>0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();g.userData.section={kind:'round-hollow',outerRadius:outer,innerRadius:inner,wallThickness:wall,length};return g;
}

// Four thin walls and four end strips, a hollow rectangular section along Y.
function rectTubeGeometry(T,length,width,depth,wall){
  const vertices=[],indices=[],uv=[];const X=width/2,Z=depth/2,x=X-wall,z=Z-wall,L=length/2;
  const outer=[[-X,-Z],[X,-Z],[X,Z],[-X,Z]],inner=[[-x,-z],[x,-z],[x,z],[-x,z]];
  const quad=(a,b,c,d)=>{const n=vertices.length/3;for(const p of [a,b,c,d])vertices.push(...p);uv.push(0,0,1,0,1,1,0,1);indices.push(n,n+1,n+2,n,n+2,n+3);};
  const p=(q,y)=>[q[0],y,q[1]];
  for(let j=0;j<4;j++){const k=(j+1)%4;quad(p(outer[j],-L),p(outer[j],L),p(outer[k],L),p(outer[k],-L));quad(p(inner[j],-L),p(inner[k],-L),p(inner[k],L),p(inner[j],L));quad(p(outer[j],L),p(inner[j],L),p(inner[k],L),p(outer[k],L));quad(p(outer[j],-L),p(outer[k],-L),p(inner[k],-L),p(inner[j],-L));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.section={kind:'rectangular-hollow',width,depth,wallThickness:wall,length};return g;
}

export function buildMetalObject(T, family, materials){
  if(!['rack','sign'].includes(family)) throw new RangeError(`R05 metal receiver does not implement ${family}`);
  for(const key of ['metal','masonry',family==='rack'?'cloth':'sign'])if(!materials?.[key])throw new TypeError(`Missing externally supplied ${key} material`);
  const root=new T.Group();root.name=`R05-${family}-receiver`;
  const audit={version:'R05',family,unit:'metre',provenance:METAL_RECEIVER_PROVENANCE,plates:[],anchors:[],members:[],connections:[],sections:[],before:[],changes:[],limitations:['Illustrative construction, not structural design or a load certification.','Section thickness and fastener paths are geometric; no thread helix, drilled bore CSG, structural corrosion loss or bolt pretension.']};
  const joints=[],objects=new Map(),Y=new T.Vector3(0,1,0),V=a=>new T.Vector3(...a);
  const arr=v=>v.toArray(),between=(a,b,t)=>arr(V(a).lerp(V(b),t));
  const put=(name,g,m,p=[0,0,0],role='metal')=>{if(objects.has(name))throw new Error(`Duplicate mesh ${name}`);const o=new T.Mesh(g,m);o.name=name;o.position.fromArray(p);o.castShadow=o.receiveShadow=true;o.userData.role=role;root.add(o);objects.set(name,o);return o;};
  const box=(name,w,h,d,p,m=materials.metal,role='metal')=>put(name,new T.BoxGeometry(w,h,d),m,p,role);
  const axial=(name,g,a,b,role='member')=>{const av=V(a),bv=V(b),o=put(name,g,materials.metal,arr(av.clone().add(bv).multiplyScalar(.5)),role);o.quaternion.setFromUnitVectors(Y,bv.sub(av).normalize());o.userData.axis={a:[...a],b:[...b]};return o;};
  const pipe=(name,a,b,r=.025,thickness=.0025,role='member')=>{const o=axial(name,pipeGeometry(T,V(a).distanceTo(V(b)),r,thickness),a,b,role);audit.sections.push({mesh:name,...o.geometry.userData.section});if(role==='member')audit.members.push({mesh:name,a:[...a],b:[...b],radius:r});return o;};
  const solid=(name,a,b,r,segments=24,role='fastener')=>axial(name,new T.CylinderGeometry(r,r,V(a).distanceTo(V(b)),segments),a,b,role);
  const contact=(member,target,at,from,kind='axis-enters-solid')=>audit.connections.push({member,target,at:[...at],from:[...from],kind});
  const sleeve=(name,a,b,inner,wall=.004)=>pipe(name,a,b,inner+wall,wall,'socket');
  const ring=(name,x,y,z,outer,inner,depth)=>pipe(name,[x,y,z],[x,y,z+depth],outer,outer-inner,'washer');
  const weld=(name,a,b,r)=>sleeve(name,a,b,r-.0003,.0028);
  const plate=(name,x,y,w,h,front,thickness=.012)=>{const back=front-thickness;box(name,w,h,thickness,[x,y,(front+back)/2],materials.metal,'baseplate');audit.plates.push({mesh:name,wall:'wall',back,front,width:w,height:h});return{name,x,y,front,back};};
  const anchor=(name,p,x,y)=>{
    const z0=p.back-.062,z1=p.front+.012;
    solid(`${name}-shaft`,[x,y,z0],[x,y,z1],.006);
    ring(`${name}-washer`,x,y,p.front,.014,.006,.003);
    solid(`${name}-head`,[x,y,p.front+.003],[x,y,p.front+.012],.0105,6);
    audit.anchors.push({shaft:`${name}-shaft`,plate:p.name,wall:'wall',axis:[x,y],embedded:.062});
    contact(`${name}-shaft`,p.name,[x,y,p.front],[x,y,z0]);
    contact(`${name}-shaft`,'wall',[x,y,p.back],[x,y,z0]);
  };
  const mount=(name,p,end,r,t)=>{
    const a=[p.x,p.y,p.front-.004],direction=V(end).sub(V(a)).normalize(),socketEnd=arr(V(a).addScaledVector(direction,.079));
    pipe(name,a,end,r,t);
    // Flat seat lies directly on the plate; the angled socket overlaps this seat.
    ring(`${name}-seat`,p.x,p.y,p.front,r+.014,r-.002,.008);
    sleeve(`${name}-socket`,a,socketEnd,r,.007);
    weld(`${name}-socket-weld`,between(a,socketEnd,.88),socketEnd,r+.007);
    contact(name,p.name,a,arr(V(a).addScaledVector(direction,.10)));
    audit.connections.push({member:name,target:`${name}-socket`,kind:'coaxial-seat',radialGap:0});
    joints.push([p.x,p.y,p.front]);return a;
  };
  const rackWallFront=-.06,signWallFront=.145;
  if(family==='rack'){
    const wallFront=rackWallFront,plateFront=wallFront+.012;
    box('wall',2.25,2.38,.12,[0,1.19,-.12],materials.masonry,'masonry');
    // Every crossbar's endpoint follows this actual incline, including the rear bars.
    const yAtZ=z=>1.72+.16*(z-plateFront)/(1.33-plateFront);
    const arms={};
    for(const [side,x]of [['left',-.9],['right',.9]]){
      const upper=plate(`${side}-upper-plate`,x,1.72,.15,.26,plateFront);
      const lower=plate(`${side}-lower-plate`,x,1.35,.15,.20,plateFront);
      for(const p of [upper,lower])for(const dx of [-.047,.047])for(const dy of (p===upper?[-.086,.086]:[-.057,.057]))anchor(`${p.name}-${dx<0?'l':'r'}-${dy<0?'b':'t'}`,p,x+dx,p.y+dy);
      // Reference line is unchanged at front z=1.33; the 25 mm beyond is an open tube lip.
      const upperEnd=[x,yAtZ(1.355),1.355];
      const mainStart=mount(`${side}-arm`,upper,upperEnd,.025,.0025);arms[side]={x,a:mainStart,b:upperEnd};
      const braceTip=between(mainStart,upperEnd,(1.24-mainStart[2])/(upperEnd[2]-mainStart[2])),braceStart=mount(`${side}-brace`,lower,braceTip,.019,.002);
      const mainD=V(upperEnd).sub(V(mainStart)).normalize();
      const ca=arr(V(braceTip).addScaledVector(mainD,-.027)),cb=arr(V(braceTip).addScaledVector(mainD,.027));
      sleeve(`${side}-brace-saddle`,ca,cb,.025,.0045);
      // The diagonal enters the saddle and upper arm; no lower loose endpoint.
      contact(`${side}-brace`,`${side}-brace-saddle`,braceTip,between(braceStart,braceTip,.90));
      contact(`${side}-brace`,`${side}-arm`,braceTip,between(braceStart,braceTip,.90));
      joints.push(braceTip);
    }
    for(const [index,z] of [.52,.92,1.33].entries()){
      // Using the actual arm equation also accounts for its 4 mm plate penetration.
      const ar=arms.left,t=(z-ar.a[2])/(ar.b[2]-ar.a[2]),y=ar.a[1]+(ar.b[1]-ar.a[1])*t;
      const points=[];for(let j=0;j<=36;j++){const q=j/36;points.push(new T.Vector3(-.9+1.8*q,y-.1*Math.sin(Math.PI*q),z));}
      const curve=new T.CatmullRomCurve3(points);const mesh=put(`line-${index}`,new T.TubeGeometry(curve,72,.009,12,false),materials.metal);
      mesh.userData.curve=points.map(p=>p.toArray());audit.members.push({mesh:mesh.name,a:arr(points[0]),b:arr(points.at(-1)),radius:.009,curved:true,sag:.1});
      for(const [side,x]of [['left',-.9],['right',.9]]){
        const at=[x,y,z],inside=[x+(x<0?.10:-.10),y-.01745,z];
        contact(mesh.name,`${side}-arm`,at,inside);
        // Low weld/saddle bead surrounds each crossing at its actual location.
        const d=V(arms[side].b).sub(V(arms[side].a)).normalize();
        weld(`${side}-line-${index}-weld`,arr(V(at).addScaledVector(d,-.011)),arr(V(at).addScaledVector(d,.011)),.025);
        joints.push(at);
      }
      if(index===2){
        const cloth=new T.PlaneGeometry(.45,.56,18,20),pos=cloth.attributes.position;
        for(let i=0;i<pos.count;i++){const xx=pos.getX(i)-.28,v=(.28-pos.getY(i))/.56,top=y-.1*Math.sin(Math.PI*(xx+.9)/1.8);pos.setXYZ(i,xx,top-v*.56,z+.008+.025*Math.sin(xx*25)*v);}
        cloth.computeVertexNormals();put('cloth',cloth,materials.cloth,[0,0,0],'cloth');
        for(const x of [-.28-.45*.38,-.28+.45*.38]){const cy=y-.1*Math.sin(Math.PI*(x+.9)/1.8);box(`cloth-clip-${x<-.28?'left':'right'}`,.016,.045,.025,[x,cy-.005,z+.009],materials.metal,'clip');}
      }
    }
    audit.before=[
      {id:'rack-upper-plate-gap',quantity:'plateBackMinusWallFront',metres:.046,count:2},
      {id:'rack-lower-brace-missing-plate',quantity:'unmountedEndpoints',count:2,endpointZ:.04,wallFront:-.06},
      {id:'rack-line-rear-axis-offset',quantity:'endpointYMinusArmY',metres:1.88-(1.72+.16*(.52-.04)/1.29),z:.52,count:2},
      {id:'rack-line-middle-axis-offset',quantity:'endpointYMinusArmY',metres:1.88-(1.72+.16*(.92-.04)/1.29),z:.92,count:2},
      {id:'rack-upper-arm-seat-gap',quantity:'axisStartMinusPlateFront',metres:.026,count:2}
    ];
    audit.changes=['Four flush 12 mm baseplates, sixteen 12 mm anchor shafts through the plates into the wall.','25/19 mm radius tubular arms/diagonals have 2.5/2 mm walls, seated sockets and saddle joints.','Three 1.8 m crossbars keep 9 mm radius and 100 mm sag; each endpoint follows its inclined arm.','Cloth top follows the actual front line and has two connected clips.'];
    root.userData.wallFront=wallFront;
    root.userData.cameraTargets={overall:[0,1.35,.49],connection:[-.9,1.72,-.02],close:[-.9,1.70,.14],rear:[0,1.65,.35],section:[.9,1.88,1.355]};
  }else{
    const wallFront=signWallFront,plateFront=wallFront+.012;
    const x0=-.45,x1=1.05,y0=1,y1=2.45,z=.66;
    box('wall',.28,2.8,.65,[-.88,1.4,-.18],materials.masonry,'masonry');
    const rect=(name,a,b)=>{const o=axial(name,rectTubeGeometry(T,V(a).distanceTo(V(b)),.065,.09,.003),a,b);audit.sections.push({mesh:name,...o.geometry.userData.section});audit.members.push({mesh:name,a,b,width:.065,depth:.09});return o;};
    // Long horizontal sections close the corners; side sections butt directly into them.
    rect('frame-bottom',[x0-.0325,y0,z],[x1+.0325,y0,z]);
    rect('frame-top',[x0-.0325,y1,z],[x1+.0325,y1,z]);
    rect('frame-left',[x0,y0+.0325,z],[x0,y1-.0325,z]);
    rect('frame-right',[x1,y0+.0325,z],[x1,y1-.0325,z]);
    for(const [side,x]of [['left',x0],['right',x1]])for(const [edge,y]of [['bottom',y0+.0325],['top',y1-.0325]]){
      // Four shallow weld beads at each butt seam, directly touching both sections.
      for(const dz of [-.045,.045])box(`frame-${side}-${edge}-weld-z${dz}`,.066,.003,.003,[x,y,z+dz]);
      for(const dx of [-.0325,.0325])box(`frame-${side}-${edge}-weld-x${dx}`,.003,.003,.09,[x+dx,y,z]);
      audit.connections.push({member:`frame-${side}`,target:`frame-${edge}`,kind:'butt-face',at:[x,y,z]});
    }
    for(const [level,y]of [['bottom',y0],['top',y1]]){
      const upper=plate(`${level}-arm-plate`,-.88,y,.13,.22,plateFront);
      const lower=plate(`${level}-brace-plate`,-.88,y-.23,.13,.18,plateFront);
      for(const p of [upper,lower])for(const dx of [-.043,.043])for(const dy of p===upper?[-.075,.075]:[-.055,.055])anchor(`${p.name}-${dx<0?'l':'r'}-${dy<0?'b':'t'}`,p,p.x+dx,p.y+dy);
      const tip=[x0,y,z],a=mount(`${level}-arm`,upper,tip,.038,.003),b=mount(`${level}-brace`,lower,tip,.031,.0025);
      contact(`${level}-arm`,`frame-${level}`,tip,between(a,tip,.78));
      contact(`${level}-brace`,`frame-${level}`,tip,between(b,tip,.78));
      const d=V(tip).sub(V(a)).normalize();
      weld(`${level}-arm-frame-weld`,arr(V(tip).addScaledVector(d,-.041)),arr(V(tip).addScaledVector(d,-.027)),.038);
      contact(`${level}-brace`,`${level}-arm`,tip,between(b,tip,.86));
      joints.push(tip);
    }
    const railZ=.6295,railRows=[y0+.09,1.70,y1-.09];
    for(const [index,y]of railRows.entries()){
      const a=[x0,y,railZ],b=[x1,y,railZ];pipe(`rear-rail-${index}`,a,b,.018,.002);
      contact(`rear-rail-${index}`,'frame-left',a,[x0+.12,y,railZ]);contact(`rear-rail-${index}`,'frame-right',b,[x1-.12,y,railZ]);
      for(const [side,x]of [['left',x0+.0325],['right',x1-.0325]])weld(`rear-rail-${index}-${side}-weld`,[x-.004,y,railZ],[x+.004,y,railZ],.018);
    }
    box('sign-panel',1.38,1.33,.025,[(x0+x1)/2,(y0+y1)/2,z],materials.sign,'sign');
    for(const [ix,x]of [x0+.08,x1-.08].entries())for(const [iy,y]of [y0+.09,y1-.09].entries()){
      const name=`panel-bolt-${ix}-${iy}`,front=z+.0125,rear=railZ-.018,shaftA=[x,y,rear-.012],shaftB=[x,y,front+.012];
      solid(`${name}-shaft`,shaftA,shaftB,.005);
      ring(`${name}-front-washer`,x,y,front,.012,.005,.003);
      solid(`${name}-head`,[x,y,front+.003],shaftB,.009,6);
      ring(`${name}-rear-washer`,x,y,rear-.003,.012,.005,.003);
      solid(`${name}-nut`,[x,y,rear-.011],[x,y,rear-.003],.009,6);
      contact(`${name}-shaft`,'sign-panel',[x,y,z],shaftA);
      contact(`${name}-shaft`,`rear-rail-${iy===0?0:2}`,[x,y,railZ],shaftA);
      joints.push([x,y,front]);
    }
    audit.before=[
      {id:'sign-wall-plate-gap',quantity:'plateBackMinusWallFront',metres:.005,count:2},
      {id:'sign-lower-brace-missing-plate',quantity:'unmountedEndpoints',count:2,endpointZ:.18,wallFront:.145},
      {id:'sign-rear-rail-shortfall',quantity:'railEndMinusFrameInnerSide',metres:.0175,count:6},
      {id:'sign-panel-bolt-gap',quantity:'boltRearMinusPanelFront',metres:.030,count:4},
      {id:'sign-panel-to-rail-gap',quantity:'panelBackMinusRailFront',metres:.0245,count:3}
    ];
    audit.changes=['Four flush 12 mm wall plates receive all four arm/brace roots; sixteen anchor shafts penetrate plates and masonry.','Frame keeps its 1.5 × 1.45 m centreline envelope and 65 × 90 mm members, now hollow 3 mm sections with butt seams/welds.','Rear rails span into the actual frame side sections and move 24.5 mm forward to meet the panel back; outer rows move 30 mm to align the fasteners.','Four panel bolts pass through the panel and actual rear rail walls, with front/rear washers and rear nuts.'];
    root.userData.wallFront=wallFront;
    root.userData.cameraTargets={overall:[.03,1.40,.31],connection:[-.88,2.33,.17],close:[-.60,2.38,.49],rear:[.30,1.70,.61],section:[1.05,2.45,.66]};
  }
  root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root);
  audit.bounds={min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new T.Vector3()).toArray()};
  root.userData.jointOrigins=joints.slice(0,16);root.userData.audit=audit;root.userData.stats={parts:objects.size,anchors:audit.anchors.length,sections:audit.sections.length,connections:audit.connections.length};
  root.userData.cameraTarget=root.userData.cameraTargets.overall;
  root.userData.materialReceivers={metal:[...objects.values()].filter(o=>o.material===materials.metal).map(o=>o.name),masonry:['wall']};
  return root;
}
