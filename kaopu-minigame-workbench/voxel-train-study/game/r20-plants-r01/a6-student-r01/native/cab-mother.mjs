/**
 * FH88 independently authored cab mother, isolated native r02.
 * SI frame: X forward, Y left, Z up; coordinates are TRAIN coordinates.
 * Source screenshot and object-name categories informed anatomy only. No source
 * geometry, images, sampled animation, or engineering dimensions are embedded.
 * This is an authored fit candidate, not an A4 survey or certified vehicle cab.
 */
export const CAB_DESIGN = Object.freeze({
  rearXM:-8.40, frontXM:-6.34, widthM:2.60, floorZM:1.85,
  floorThicknessM:.085, roofMaxZM:3.96, roofRiseM:.35,
  roofThicknessM:.038, wallThicknessM:.038, wallInsetM:.105,
  windowOpenFraction:.75, leftDoorOpenRad:0, rightDoorOpenRad:0,
  wearAmount:.58, grimeAmount:.45, resolution:1,
  humanHeightM:1.917,
  dimensionStatus:'Authored FH88 fit candidates; not measured source engineering dimensions.'
});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const gauss=(x,s)=>Math.exp(-x*x/(s*s));
// Independent smooth value noise, never baked into sparse mesh vertices.
const MICROFINISH_GLSL=`
float finishHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float finishNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(finishHash(i),finishHash(i+vec3(1,0,0)),f.x),mix(finishHash(i+vec3(0,1,0)),finishHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(finishHash(i+vec3(0,0,1)),finishHash(i+vec3(1,0,1)),f.x),mix(finishHash(i+vec3(0,1,1)),finishHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float filteredFinish(vec3 nativeM){vec3 q=nativeM*165.;float footprint=max(length(dFdx(q)),length(dFdy(q)));return(finishNoise(q)-.5)*(1.-smoothstep(.35,1.2,footprint));}
`;
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
export function validateCabParameters(p){
  for(const [k,v] of Object.entries(p))if(typeof v==='number'&&!Number.isFinite(v))throw Error('NONFINITE_CAB_PARAMETER:'+k);
  if(p.frontXM-p.rearXM<1.90||p.frontXM-p.rearXM>2.50||p.widthM<2.45||p.widthM>2.7432)throw Error('CAB_CANDIDATE_ENVELOPE_RANGE');
  if(p.floorZM<1.65||p.floorZM>2.05||p.roofMaxZM>3.9878||p.roofMaxZM-p.floorZM<2.02||p.humanHeightM!==1.917)throw Error('CAB_HUMAN_OR_HEIGHT_CONTRACT');
  if(p.floorThicknessM<.05||p.floorThicknessM>.13||p.roofThicknessM<.018||p.roofThicknessM>.06||p.wallThicknessM<.02||p.wallThicknessM>.06||p.wallInsetM<.105||p.wallInsetM>.14||p.roofRiseM<.20||p.roofRiseM>.39)throw Error('CAB_SHELL_DOMAIN_RANGE');
  if(p.widthM/2-p.wallInsetM<1.16)throw Error('CAB_SEAT_BACKHEAD_SIDEWALL_CLEARANCE_FAILED');
  if(p.floorZM+1.71+.027>cabRoofUndersideAtY(p,p.widthM/2-p.wallInsetM)-.010)throw Error('CAB_WINDOW_UPPER_FRAME_ROOF_CLEARANCE_FAILED');
  if(p.windowOpenFraction<0||p.windowOpenFraction>1||p.leftDoorOpenRad<0||p.leftDoorOpenRad>1.65||p.rightDoorOpenRad<0||p.rightDoorOpenRad>1.65||p.wearAmount<0||p.wearAmount>1||p.grimeAmount<0||p.grimeAmount>1||p.resolution<.5||p.resolution>2)throw Error('CAB_CONTROL_OR_APPEARANCE_RANGE');
  const highestHead=p.floorZM+p.humanHeightM;
  if(cabRoofUndersideAtY(p,.64,true)<highestHead+.015)throw Error('CAB_STANDING_HEAD_CLEARANCE_FAILED');
  return true;
}
export function cabRoofTopAtY(p,y){return p.roofMaxZM-.006-p.roofRiseM*(y/(p.widthM/2))**2;}
export function cabRoofUndersideAtY(p,y,atRib=false){return cabRoofTopAtY(p,y)-p.roofThicknessM-(atRib?.033:0);}
/** Appearance is evaluated in the same native coordinates that define each part. */
export function cabSurfaceDomain(p,d,xyz){
  const [x,y,z]=xyz,c=d.center||[0,0,0],size=d.size||[1,1,1];
  let edge=0;
  // A plate face is not an edge: two box boundaries must meet for wear.
  if(d.size){const gaps=xyz.map((v,i)=>Math.abs(Math.abs(v-c[i])-size[i]/2)).sort((a,b)=>a-b);edge=gauss(gaps[1],.023);}
  if(d.kind==='roof')edge=Math.max(gauss(Math.abs(y)-p.widthM/2,.055),gauss(x-p.rearXM,.035),gauss(x-p.frontXM,.035));
  const travel=clamp(gauss(y-.40,.34)+gauss(y+.40,.34));
  const floorWear=d.kind==='floor'?travel*(.64+.36*gauss(x-(p.rearXM+p.frontXM)/2,.85)):0;
  let axial=.5;
  if(d.path){const a=d.path[0],b=d.path[1],v=b.map((n,i)=>n-a[i]),l2=v.reduce((n,k)=>n+k*k,0);axial=clamp(xyz.reduce((n,k,i)=>n+(k-a[i])*v[i],0)/(l2||1));edge=Math.max(edge,gauss(axial,.05),gauss(axial-1,.05));}
  const touch=(d.touch||0)*(d.kind==='handle'?(.40+.60*gauss(axial-.53,.28)):1);
  const wear=clamp((touch*.83+edge*.18+floorWear*.64)*p.wearAmount);
  const roofCrown=clamp(1-(y/(p.widthM/2))**2),frontDeposit=gauss(x-p.frontXM,.60)*roofCrown;
  const sheltered=d.kind==='seal'?.95:d.kind==='glass'?.12:d.kind==='roof'?.28+.40*frontDeposit:.34+.12*gauss(z-p.floorZM,.25);
  const grime=clamp((sheltered+(1-wear)*edge*.25+(d.crevice||0)*.32)*p.grimeAmount);
  // Broad contact patches remain stable when tessellation/resolution changes.
  const grain=clamp(.45+.20*gauss(x-(p.rearXM+.68),.65)*gauss(y+.18,.85)+.12*gauss(z-p.floorZM,.40));
  const wet=d.kind==='glass'?clamp(.16+.34*gauss(z-(d.bottomZM??2.6),.11)):0;
  const chips=d.material==='paint'?clamp((wear-.055)*1.4)*edge*(.32+.40*grain):0;
  return {wear,grime,grain,wet,chips};
}
// Linear reflectance candidates. The green coating is dielectric; only wear
// through its thickness exposes conductive metal. Values are not lab samples.
const PALETTE={paint:{c:[.036,.082,.058],r:.37,m:0},steel:{c:[.28,.31,.32],r:.32,m:.88},iron:{c:[.060,.065,.064],r:.56,m:.72},rubber:{c:[.018,.022,.022],r:.90,m:0},brass:{c:[.62,.43,.16],r:.28,m:.91},wood:{c:[.22,.13,.065],r:.71,m:0},leather:{c:[.047,.052,.039],r:.65,m:0},glass:{c:[.70,.87,.86],r:.10,m:0}};
function makeMaterial(T,kind){
  const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:1});m.name='cab-native-'+kind+'-field';
  if(kind==='glass'){m.transparent=true;m.opacity=.19;m.depthWrite=false;}
  m.userData={nativeShapeAndAppearanceDomain:true,textureMapsUsed:false,appearanceRevision:'native-coating-r04',parameterStatus:'Authored candidates; not calibrated measurements',coatingIsDielectric:kind==='paint',fineFinish:'fragment footprint filtered; no vertex micrograin'};
  m.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 cabSurface; varying vec2 vCabSurface; varying vec3 vCabNative;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCabSurface=cabSurface; vCabNative=position;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vCabSurface; varying vec3 vCabNative;\n'+MICROFINISH_GLSL)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(vCabSurface.x'+(kind==='glass'?'':'+filteredFinish(vCabNative)*.026')+',.06,.98);')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=clamp(vCabSurface.y,0.,1.);');
  };
  m.customProgramCacheKey=()=>`cab-native-coating-r04-${kind}`;return m;
}
function rectPath(T,x0,z0,x1,z1,r=.025,shape=false){
  const q=shape?new T.Shape():new T.Path();r=Math.max(0,Math.min(r,(x1-x0)/2,(z1-z0)/2));
  q.moveTo(x0+r,z0);q.lineTo(x1-r,z0);q.quadraticCurveTo(x1,z0,x1,z0+r);q.lineTo(x1,z1-r);q.quadraticCurveTo(x1,z1,x1-r,z1);q.lineTo(x0+r,z1);q.quadraticCurveTo(x0,z1,x0,z1-r);q.lineTo(x0,z0+r);q.quadraticCurveTo(x0,z0,x0+r,z0);q.closePath();return q;
}
export function createCabMother(T,overrides={}){
  const p={...CAB_DESIGN,...overrides};validateCabParameters(p);
  const root=new T.Group();root.name='FH88 independently authored cab mother';
  const parts=[],ports=[],components=[],attachments=[],openings=[],seats=[],accessRoutes=[];
  const materials=Object.fromEntries(Object.keys(PALETTE).map(k=>[k,makeMaterial(T,k)]));
  const R=n=>Math.max(4,Math.round(n*p.resolution)),V=a=>new T.Vector3(...a);
  const rear=p.rearXM,front=p.frontXM,F=p.floorZM,H=p.widthM/2,wall=H-p.wallInsetM;
  const L=front-rear,scaleX=L/2.06, X=v=>rear+(v+8.40)*scaleX, Z=v=>F+(v-1.85), sideHeaderZ=cabRoofUndersideAtY(p,wall)-.006;
  const comp=(id,role,parent='cab',sourceCategory=null)=>{components.push({id,role,parent,sourceCategory,sourceRelation:sourceCategory?'Observed category only; detailed geometry independently authored':'Independent candidate'});return id;};
  comp('cab','rigid native train-coordinate cab assembly',null);comp('floor','floor and mechanically connected support frame');comp('roof','curved sheet, seam bands, bows, gutters and rivets','cab','Roof Rivets_18; Roof Gutters_32');comp('front-bulkhead','open boiler throat and supporting front boundary');comp('rear-bulkhead','rear wall with central tender passage and two windows');
  function add(g,id,d,owner){
    const pos=g.attributes.position,old=g.index,idx=[],A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3();let removed=0;
    for(let i=0;i<(old?old.count:pos.count);i+=3){const ids=[0,1,2].map(j=>old?old.getX(i+j):i+j);A.fromBufferAttribute(pos,ids[0]);B.fromBufferAttribute(pos,ids[1]).sub(A);C.fromBufferAttribute(pos,ids[2]).sub(A);if(B.cross(C).lengthSq()>1e-20)idx.push(...ids);else removed++;}
    g.setIndex(idx);if(!g.userData.analyticRoofNormals)g.computeVertexNormals();g.computeBoundingBox();
    const colors=[],surface=[],domain=[],base=PALETTE[d.material||'steel'],pal=d.material==='paint'&&d.kind==='roof'?{...base,c:[.030,.037,.035],r:.49}:base;
    for(let i=0;i<pos.count;i++){
      const v=[pos.getX(i),pos.getY(i),pos.getZ(i)],f=cabSurfaceDomain(p,d,v),c=pal.c.slice();
      for(let j=0;j<3;j++){
        c[j]=mix(c[j],[.033,.028,.021][j],f.grime*.32);
        c[j]=mix(c[j],pal.c[j]*1.12+.012,f.wear*(d.material==='paint'?.18:.36));
        c[j]=mix(c[j],[.30,.32,.31][j],f.chips);
        if(d.material==='wood')c[j]*=.92+.08*f.grain;
      }
      const coating=d.material==='paint',metal=coating?mix(pal.m,.87,f.chips):pal.m;
      colors.push(...c);surface.push(clamp(pal.r+f.grime*.19-f.wear*.16+(coating?f.chips*.06:0)+f.wet*.1,.06,.98),clamp(metal*(1-f.grime*.38)));domain.push(f.wear,f.grime,f.wet);
    }
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('cabSurface',new T.Float32BufferAttribute(surface,2));g.setAttribute('cabDomains',new T.Float32BufferAttribute(domain,3));g.userData={...g.userData,transientNativeRenderOutput:true,removedDegenerateTriangles:removed};
    const m=new T.Mesh(g,materials[d.material||'steel']);m.name=id;m.castShadow=m.receiveShadow=d.material!=='glass';m.userData={mother:'cab',partId:id,functionalParent:owner,domain:d,shapeAndMaterialShareDomain:true,sourceBuffersUsed:false,collisionRole:d.material==='glass'?'glazing':'solid'};root.add(m);parts.push(m);return m;
  }
  const box=(id,c,s,d,owner)=>{const g=new T.BoxGeometry(...s,R(2),R(2),R(2));g.translate(...c);return add(g,id,{...d,center:c,size:s},owner);};
  const cylinder=(id,a,b,r,d,owner,n=16)=>{const len=distance(a,b);if(len<1e-7)throw Error('CAB_ZERO_LENGTH_MEMBER:'+id);const g=new T.CylinderGeometry(r,r,len,R(n),d.kind==='handle'?R(12):R(2));g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),V(b).sub(V(a)).normalize()));g.translate(...a.map((x,i)=>(x+b[i])/2));return add(g,id,{...d,path:[a,b],radius:r},owner);};
  const plateXZ=(id,shape,cy,depth,d,owner)=>{const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:R(8),steps:1});g.applyMatrix4(new T.Matrix4().set(1,0,0,0,0,0,-1,cy+depth/2,0,1,0,0,0,0,0,1));return add(g,id,d,owner);};
  const plateYZ=(id,shape,cx,depth,d,owner)=>{const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:R(8),steps:1});g.applyMatrix4(new T.Matrix4().set(0,0,1,cx-depth/2,1,0,0,0,0,1,0,0,0,0,0,1));return add(g,id,d,owner);};
  function ringXZ(id,b,y,border,depth,mat,owner,r=.035){const [x0,z0,x1,z1]=b,q=rectPath(T,x0-border,z0-border,x1+border,z1+border,r+border,true);q.holes.push(rectPath(T,x0,z0,x1,z1,r));return plateXZ(id,q,y,depth,{material:mat,kind:mat==='rubber'?'seal':'frame',crevice:.55},owner);}
  function ringYZ(id,b,x,border,depth,mat,owner,r=.025){const [y0,z0,y1,z1]=b,q=rectPath(T,y0-border,z0-border,y1+border,z1+border,r+border,true);q.holes.push(rectPath(T,y0,z0,y1,z1,r));return plateYZ(id,q,x,depth,{material:mat,kind:mat==='rubber'?'seal':'frame',crevice:.55},owner);}
  function port(id,pos,owner,role,normal=[1,0,0]){const frame=new T.Object3D();frame.name=id+'.rigid-frame';frame.position.fromArray(pos);frame.userData={rigidInstallFrame:true,owner,role};root.add(frame);const item={id,owner,role,positionM:pos.slice(),normal:normal.slice(),axes:{forward:[1,0,0],left:[0,1,0],up:[0,0,1]},matrix:new T.Matrix4().makeTranslation(...pos).toArray(),rigid:true,scale:[1,1,1],frameObjectName:frame.name};ports.push(item);return item;}
  const attach=(id,owner,from,to,partIds,role='physical mechanical connection')=>attachments.push({id,owner,fromM:from,toM:to,partIds,role});
  function bolt(id,c,axis,owner,r=.008){const a=c.map((v,i)=>v-axis[i]*.006),b=c.map((v,i)=>v+axis[i]*.003);return cylinder(id,a,b,r,{material:'steel',kind:'fastener',touch:.2,crevice:.8},owner,8);}
  // Floor top is the exact crew datum, not an arbitrary visual pedestal.
  box('floor.continuous-structural-plate',[(rear+front)/2,0,F-p.floorThicknessM/2],[L,2*wall,p.floorThicknessM],{material:'iron',kind:'floor'},'floor');
  for(const y of[-.82,.82])box('floor.longitudinal-rail.'+y,[(rear+front)/2,y,F-.13],[L,.082,.12],{material:'iron',kind:'frame'},'floor');
  for(const xx of[X(-8.28),X(-7.47),X(-6.54)])box('floor.crossmember.'+xx,[xx,0,F-.15],[.085,2*wall,.15],{material:'iron',kind:'frame'},'floor');
  // Native wood walking inserts are flush; grooves never cut through support.
  for(let i=0;i<12;i++){const w=(2*wall-.10)/12,y=-wall+.05+w*(i+.5);box('floor.flush-board.'+i,[(rear+front)/2,y,F-.004],[L-.09,w-.003,.008],{material:'wood',kind:'floor'},'floor');}
  for(const xx of[X(-8.28),X(-6.54)])for(const y of[-.83,.83]){const id='floor.mount.'+xx+'.'+y;box(id+'.shoe',[xx,y,F-.207],[.20,.19,.035],{material:'steel',kind:'mount',crevice:.6},'floor');port(id,[xx,y,F-.225],'floor','underframe mounting plane',[0,0,-1]);attach(id,'floor',[xx,y,F-.225],[xx,y,F-.11],[id+'.shoe','floor.crossmember.'+xx]);}
  // Curved closed roof volume. End caps and lower face have real thickness.
  function roofVolume(id,x0,x1,halfWidth,thickness,offset,d){
    const verts=[],idx=[],NY=R(72),NX=Math.max(1,Math.ceil((x1-x0)*22));
    const rows=(bottom)=>{const start=verts.length/3;for(let i=0;i<=NX;i++)for(let j=0;j<=NY;j++){const x=x0+(x1-x0)*i/NX,y=-halfWidth+2*halfWidth*j/NY;verts.push(x,y,cabRoofTopAtY(p,y)+offset-(bottom?thickness:0));}return start;};
    const top=rows(false),bottom=rows(true),stride=NY+1;
    const quad=(a,b,c,d,flip=false)=>{if(flip)idx.push(a,c,b,a,d,c);else idx.push(a,b,c,a,c,d)};
    for(let i=0;i<NX;i++)for(let j=0;j<NY;j++){const a=i*stride+j,b=a+stride;quad(a,b,b+1,a+1);quad(bottom+a,bottom+b,bottom+b+1,bottom+a+1,true);}
    // Split boundary vertices retain explicit hard edge normal domains.
    const edge=(ids,flip)=>{for(let i=0;i<ids.length-1;i++){const a=ids[i],b=ids[i+1],k=verts.length/3;for(const v of[a,b,bottom+b,bottom+a])verts.push(...verts.slice(v*3,v*3+3));quad(k,k+1,k+2,k+3,flip)}};
    edge(Array.from({length:NY+1},(_,j)=>j),false);edge(Array.from({length:NY+1},(_,j)=>NX*stride+j),true);edge(Array.from({length:NX+1},(_,i)=>i*stride),true);edge(Array.from({length:NX+1},(_,i)=>i*stride+NY),false);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();
    g.userData.a6RoofTessellation={longitudinalSegments:NX,crossSegments:NY,shape:'shared C2 master curve evaluated at every native vertex'};
    return add(g,id,d,'roof');
  }
  roofVolume('roof.formed-double-skin-sheet',rear,front,H,p.roofThicknessM,0,{material:'paint',kind:'roof'});
  for(const [i,xx] of [X(-8.31),X(-7.69),X(-7.10),X(-6.40)].entries()){
    roofVolume('roof.interior-bow.'+i,xx-.018,xx+.018,wall+.012,.033,-p.roofThicknessM,{material:'iron',kind:'roof',crevice:.6});
    for(const s of[-1,1]){const c=[xx,s*wall,cabRoofUndersideAtY(p,wall)-.015];box('roof.bow-foot.'+i+'.'+s,c,[.09,.07,.085],{material:'steel',kind:'mount'},'roof');attach('roof.bow-mount.'+i+'.'+s,'roof',[xx,s*wall,sideHeaderZ-.04],c,['roof.bow-foot.'+i+'.'+s,'roof.interior-bow.'+i]);}
  }
  for(const xx of[X(-8.29),X(-6.43)]){roofVolume('roof.external-seam.'+xx,xx-.021,xx+.021,H-.01,.008,.002,{material:'paint',kind:'roof',crevice:.5});for(let i=0;i<17;i++){const y=-(H-.055)+2*(H-.055)*i/16,dz=-2*p.roofRiseM*y/(H*H),normal=V([0,-dz,1]).normalize().toArray();bolt('roof.rivet.'+xx+'.'+i,[xx,y,cabRoofTopAtY(p,y)+.001],normal,'roof',.007);}}
  for(const s of[-1,1]){
    const y=s*(H-.022),z=cabRoofTopAtY(p,s*H)-.017,q=new T.Shape();q.moveTo(y-.022,z+.034);q.lineTo(y-.022,z);q.quadraticCurveTo(y,z-.012,y+.022,z);q.lineTo(y+.022,z+.034);q.lineTo(y+.017,z+.034);q.lineTo(y+.017,z+.005);q.quadraticCurveTo(y,z-.003,y-.017,z+.005);q.lineTo(y-.017,z+.034);q.closePath();plateYZ('roof.open-rain-gutter.'+s,q,(rear+front)/2,L-.025,{material:'paint',kind:'roof',crevice:.9},'roof');
    const a=[rear+.035,y,z+.002],b=[rear+.035,s*(H-.034),z-.17];cylinder('roof.gutter-drain.'+s,a,b,.008,{material:'steel',kind:'drain'},'roof');port('roof.drain.'+s,b,'roof','rain drain outlet; drainage capacity unverified',[0,0,-1]);
  }
  // Side walls have holes and door notches before any frames or glass are added.
  const doorL=X(-8.30),doorR=X(-7.76),doorTop=Z(3.48),win=[X(-7.64),Z(2.64),X(-6.53),Z(3.56)];
  for(const s of[-1,1]){
    const side=s===1?'left':'right',owner=comp('side.'+side,'side sheet with real window and doorway','cab','Window Frames_14; Hand Rails Side_15'),y=s*wall;
    const shape=new T.Shape();shape.moveTo(rear,F);shape.lineTo(doorL,F);shape.lineTo(doorL,doorTop);shape.lineTo(doorR,doorTop);shape.lineTo(doorR,F);shape.lineTo(front,F);shape.lineTo(front,sideHeaderZ);shape.lineTo(rear,sideHeaderZ);shape.closePath();shape.holes.push(rectPath(T,...win,.045));plateXZ('side.'+side+'.perforated-sheet',shape,y,p.wallThicknessM,{material:'paint',kind:'wall'},owner);
    ringXZ('window.'+side+'.structural-frame',win,y,.027,.068,'steel',owner,.045);ringXZ('window.'+side+'.rubber-reveal',[win[0]+.009,win[1]+.009,win[2]-.009,win[3]-.009],y,.010,.071,'rubber',owner,.032);
    const clear=[win[0]+.026,win[1]+.026,win[2]-.026,win[3]-.026],mid=(clear[0]+clear[2])/2,paneW=(clear[2]-clear[0])/2;
    for(const [name,x0,x1,yy] of[['fixed-front',mid-.010,clear[2],y+s*.021],['sliding-rear',clear[0]+p.windowOpenFraction*paneW,mid+.010+p.windowOpenFraction*paneW,y-s*.021]]){
      const pane=[x0+.012,clear[1]+.010,x1-.012,clear[3]-.010];ringXZ('window.'+side+'.'+name+'.sash',pane,yy,.013,.018,'paint',owner,.018);plateXZ('window.'+side+'.'+name+'.glass',rectPath(T,...pane,.018,true),yy,.004,{material:'glass',kind:'glass',bottomZM:pane[1]},owner);
      if(name==='sliding-rear')box('window.'+side+'.sliding-catch',[x0+.027,yy-s*.021,(clear[1]+clear[3])/2],[.034,.025,.065],{material:'brass',kind:'handle',touch:1},owner);
    }
    for(const z of[win[1]-.012,win[3]+.012])box('window.'+side+'.slide-track.'+z,[(win[0]+win[2])/2,y-s*.038,z],[win[2]-win[0]+.035,.013,.014],{material:'steel',kind:'track',touch:.4},owner);
    openings.push({id:'window.'+side,owner,plane:'XZ',normal:[0,s,0],wallYM:y,structuralBoundsM:win.slice(),clearBoundsM:clear,openFraction:p.windowOpenFraction,rayOpenPointM:[clear[0]+Math.max(.025,p.windowOpenFraction*paneW*.50),y,(clear[1]+clear[3])/2],state:'one fixed pane and one explicitly sliding pane; function is authored'});
    // Door posts and lintel do not span the walking threshold.
    for(const xx of[doorL-.014,doorR+.014])box('door.'+side+'.jamb.'+xx,[xx,y,(F+doorTop)/2],[.036,.069,doorTop-F],{material:'steel',kind:'frame'},owner);
    box('door.'+side+'.lintel',[(doorL+doorR)/2,y,doorTop+.01],[doorR-doorL+.065,.069,.041],{material:'steel',kind:'frame'},owner);
    box('door.'+side+'.flush-threshold',[(doorL+doorR)/2,y,F-.012],[doorR-doorL,.105,.024],{material:'steel',kind:'floor',touch:1},owner);
    const doorOwner=comp('door.'+side,'hinged side leaf with separate glazing and real upper aperture',owner),doorParts=[],leafBounds=[doorL+.012,F+.022,doorR-.012,doorTop-.018],doorWin=[doorL+.069,Z(2.62),doorR-.069,Z(3.34)],leaf=rectPath(T,...leafBounds,.018,true);leaf.holes.push(rectPath(T,...doorWin,.032));
    doorParts.push(plateXZ('door.'+side+'.leaf-with-window-hole',leaf,y,p.wallThicknessM*.72,{material:'paint',kind:'door',touch:.3},doorOwner));doorParts.push(ringXZ('door.'+side+'.window-frame',doorWin,y,.017,.044,'steel',doorOwner,.032));doorParts.push(ringXZ('door.'+side+'.window-seal',[doorWin[0]+.007,doorWin[1]+.007,doorWin[2]-.007,doorWin[3]-.007],y,.008,.046,'rubber',doorOwner,.025));doorParts.push(plateXZ('door.'+side+'.window-glass',rectPath(T,...[doorWin[0]+.015,doorWin[1]+.015,doorWin[2]-.015,doorWin[3]-.015],.02,true),y,.004,{material:'glass',kind:'glass',bottomZM:doorWin[1]},doorOwner));
    const hinge=[doorL,y+s*.033,F],angle=s*(s===1?p.leftDoorOpenRad:p.rightDoorOpenRad);
    for(const [i,z] of[Z(2.11),Z(3.16)].entries()){
      box('door.'+side+'.hinge-fixed-leaf.'+i,[doorL-.027,y+s*.024,z],[.06,.028,.09],{material:'steel',kind:'hinge'},owner);
      doorParts.push(box('door.'+side+'.hinge-moving-leaf.'+i,[doorL+.031,y+s*.024,z],[.069,.028,.09],{material:'steel',kind:'hinge'},doorOwner));
      cylinder('door.'+side+'.hinge-pin.'+i,[hinge[0],hinge[1],z-.06],[hinge[0],hinge[1],z+.06],.012,{material:'brass',kind:'hinge',touch:.3},owner);
      attach('door.'+side+'.hinge-mount.'+i,doorOwner,[doorL-.027,y+s*.024,z],[doorL+.031,y+s*.024,z],['door.'+side+'.hinge-fixed-leaf.'+i,'door.'+side+'.hinge-moving-leaf.'+i,'door.'+side+'.hinge-pin.'+i]);
    }
    doorParts.push(box('door.'+side+'.latch-body',[doorR-.050,y+s*.025,Z(2.47)],[.038,.029,.072],{material:'brass',kind:'handle',touch:.9},doorOwner));doorParts.push(cylinder('door.'+side+'.latch-handle',[doorR-.053,y+s*.047,Z(2.48)],[doorR-.145,y+s*.047,Z(2.48)],.008,{material:'brass',kind:'handle',touch:1},doorOwner));box('door.'+side+'.latch-keeper',[doorR+.015,y+s*.027,Z(2.47)],[.037,.031,.069],{material:'steel',kind:'hinge'},owner);
    const pivot=V(hinge),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),angle);if(angle)for(const m of doorParts){m.geometry.translate(-pivot.x,-pivot.y,-pivot.z);m.geometry.applyQuaternion(q);m.geometry.translate(pivot.x,pivot.y,pivot.z);m.geometry.computeBoundingBox();m.userData.articulation={pivotM:hinge,axis:[0,0,1],angleRad:angle};}
    port('door.'+side+'.hinge',hinge,doorOwner,'door rigid hinge axis',[0,0,1]);port('door.'+side+'.entry',[(doorL+doorR)/2,y,F],owner,'floor-level side access',[0,s,0]);openings.push({id:'door.'+side,owner,plane:'XZ',wallYM:y,clearBoundsM:[doorL+.025,F+.025,doorR-.025,doorTop-.025],angleRad:Math.abs(angle),state:'outward opening authored hinge; external sweep is not static envelope'});
    // Five useful treads, twin stringers, and bolts connect to the floor frame.
    const stepsOwner=comp('steps.'+side,'five non-floating treads on connected stringers',owner),cx=(doorL+doorR)/2,stepY=s*(wall+.007),outside=s*(H-.015);
    for(const xx of[cx-.211,cx+.211]){
      const strA=[xx,s*(wall-.035),F-1.31],strB=[xx,s*(wall-.035),F-.075];cylinder('steps.'+side+'.stringer.'+xx,strA,strB,.018,{material:'iron',kind:'frame'},stepsOwner);
      box('steps.'+side+'.frame-bracket.'+xx,[xx,s*(wall-.055),F-.11],[.09,.13,.12],{material:'steel',kind:'mount'},stepsOwner);attach('steps.'+side+'.frame-mount.'+xx,stepsOwner,[xx,s*(wall-.095),F-.11],strB,['steps.'+side+'.frame-bracket.'+xx,'steps.'+side+'.stringer.'+xx]);
      bolt('steps.'+side+'.mount-bolt.'+xx,[xx,s*(wall+.012),F-.11],[0,s,0],stepsOwner);
    }
    for(let i=0;i<5;i++){
      const z=F-1.18+i*.265,id='steps.'+side+'.tread.'+i,cy=s*(wall+.010);box(id,[cx,cy,z-.015],[doorR-doorL-.065,.19,.030],{material:'steel',kind:'step',touch:.95},stepsOwner);
      for(let j=0;j<6;j++)box(id+'.raised-grip.'+j,[cx-.18+j*.072,cy,z+.003],[.009,.165,.006],{material:'iron',kind:'step',touch:1},stepsOwner);
      for(const xx of[cx-.211,cx+.211]){box(id+'.support.'+xx,[xx,s*(wall-.025),z-.035],[.043,.16,.046],{material:'iron',kind:'mount'},stepsOwner);attach(id+'.mount.'+xx,stepsOwner,[xx,s*(wall-.035),z-.035],[xx,cy,z-.015],[id+'.support.'+xx,id]);}
      port(id+'.top',[cx,cy,z+.006],stepsOwner,'step contact patch',[0,0,1]);
    }
    const railOwner=comp('handrail.'+side,'two grab rails with positive wall mounts',owner,'Hand Rails Side_15; Grab Rails Rear_33');
    for(const [j,xx] of[doorL-.046,doorR+.046].entries()){
      const ry=s*(wall+.055),a=[xx,ry,F-.13],b=[xx,ry,Z(3.31)];cylinder('handrail.'+side+'.grip.'+j,a,b,.016,{material:'steel',kind:'handle',touch:.95},railOwner);
      for(const [k,z] of[Z(2.00),Z(2.57),Z(3.27)].entries()){
        const foot=[xx,y,z],end=[xx,ry,z];box('handrail.'+side+'.foot.'+j+'.'+k,foot,[.061,.030,.082],{material:'paint',kind:'mount'},railOwner);cylinder('handrail.'+side+'.standoff.'+j+'.'+k,foot,end,.013,{material:'steel',kind:'mount'},railOwner);bolt('handrail.'+side+'.bolt.'+j+'.'+k,[xx,y+s*.023,z+.022],[0,s,0],railOwner);attach('handrail.'+side+'.mount.'+j+'.'+k,railOwner,foot,end,['handrail.'+side+'.foot.'+j+'.'+k,'handrail.'+side+'.standoff.'+j+'.'+k,'handrail.'+side+'.grip.'+j]);
      }
    }
    accessRoutes.push({id:'side-entry.'+side,viaPort:'door.'+side+'.entry',requiresDoorOpenRad:1.45,pointsM:[[cx,outside,F-1.18],[cx,stepY,F-.12],[cx,s*(wall-.20),F],[X(-8.03),s*.40,F],[X(-7.33),s*.40,F]],sideDoorClearHeightM:doorTop-F-.05,postureRequirement:'Full-size adult requires a ducking/turning entry pose; no anatomy scaling allowed.',status:'authored floor/step route; full articulated human passage and external fouling pending'});
  }
  // Rear open tender passage, side windows and framed reveals.
  const passageHalf=.59,rearCX=rear+.057,rearPassageSideZ=cabRoofUndersideAtY(p,passageHalf)-.050,rearPassageCrownZ=cabRoofUndersideAtY(p,0)-.050,rearShape=new T.Shape();rearShape.moveTo(-wall,F);rearShape.lineTo(-passageHalf,F);rearShape.lineTo(-passageHalf,rearPassageSideZ);rearShape.quadraticCurveTo(0,2*rearPassageCrownZ-rearPassageSideZ,passageHalf,rearPassageSideZ);rearShape.lineTo(passageHalf,F);rearShape.lineTo(wall,F);rearShape.lineTo(wall,sideHeaderZ);for(let i=1;i<=48;i++){const y=wall-2*wall*i/48;rearShape.lineTo(y,cabRoofUndersideAtY(p,y)-.006);}rearShape.closePath();
  for(const s of[-1,1]){const a=s>0?[.71,Z(2.70),1.075,Z(3.35)]:[-1.075,Z(2.70),-.71,Z(3.35)];rearShape.holes.push(rectPath(T,...a,.035));ringYZ('rear.window-frame.'+s,a,rearCX,.023,.064,'steel','rear-bulkhead');ringYZ('rear.window-seal.'+s,[a[0]+.009,a[1]+.009,a[2]-.009,a[3]-.009],rearCX,.009,.069,'rubber','rear-bulkhead');plateYZ('rear.window-glass.'+s,rectPath(T,a[0]+.018,a[1]+.018,a[2]-.018,a[3]-.018,.022,true),rearCX,.004,{material:'glass',kind:'glass',bottomZM:a[1]},'rear-bulkhead');openings.push({id:'rear.window.'+s,plane:'YZ',wallXM:rearCX,structuralBoundsM:a,state:'fixed glazed structural aperture'});}
  plateYZ('rear.perforated-wall-with-open-passage',rearShape,rearCX,p.wallThicknessM,{material:'paint',kind:'wall'},'rear-bulkhead');
  for(const s of[-1,1])box('rear.passage-jamb.'+s,[rearCX,s*(passageHalf+.016),(F+rearPassageSideZ)/2],[.075,.034,rearPassageSideZ-F],{material:'steel',kind:'frame'},'rear-bulkhead');
  box('rear.flush-passage-threshold',[rearCX,0,F-.014],[.11,2*passageHalf,.028],{material:'steel',kind:'floor',touch:1},'rear-bulkhead');port('cab.tender-passage',[rear,0,F],'rear-bulkhead','rear central gangway interface; bridge to tender is external',[-1,0,0]);
  // Front bulkhead preserves a real open boiler throat; no control is part of a seat.
  const bhHalf=1.105,throatTop=F+1.90,frontShape=new T.Shape();frontShape.moveTo(-wall,F);frontShape.lineTo(-bhHalf,F);frontShape.lineTo(-bhHalf,F+1.27);frontShape.bezierCurveTo(-bhHalf,F+1.66,-.60,throatTop,0,throatTop);frontShape.bezierCurveTo(.60,throatTop,bhHalf,F+1.66,bhHalf,F+1.27);frontShape.lineTo(bhHalf,F);frontShape.lineTo(wall,F);frontShape.lineTo(wall,sideHeaderZ);for(let i=1;i<=48;i++){const y=wall-2*wall*i/48;frontShape.lineTo(y,cabRoofUndersideAtY(p,y)-.007);}frontShape.closePath();plateYZ('front.open-boiler-throat-bulkhead',frontShape,front-.021,p.wallThicknessM,{material:'paint',kind:'wall'},'front-bulkhead');
  for(const s of[-1,1]){const c=[X(-6.55),s*.77,F-.017];box('front.backhead-floor-mount.'+s,c,[.14,.23,.034],{material:'steel',kind:'mount',crevice:.6},'floor');port('cab.backhead-floor.'+s,[X(-6.55),s*.77,F],'floor','backhead shoe floor contact',[0,0,1]);}
  port('cab.boiler-join',[front,0,F],'front-bulkhead','boiler/cab rigid datum, throat shape candidate',[1,0,0]);port('cab.backhead-install',[X(-6.55),0,F],'floor','backhead module origin; native axes preserved; controls face -X',[-1,0,0]);
  // Independent seats are outboard of the full-size standing driver's body lane.
  for(const s of[-1,1]){
    const side=s>0?'left':'right',owner=comp('seat.'+side,'independent floor-mounted seat; control console is a different component','floor','Seats_72'),cx=X(-7.43),cy=s*.94,cushionZ=F+.50;
    box('seat.'+side+'.floor-foot',[cx,cy,F+.012],[.23,.24,.024],{material:'steel',kind:'mount',crevice:.8},owner);
    cylinder('seat.'+side+'.pedestal',[cx,cy,F+.024],[cx,cy,cushionZ-.045],.043,{material:'iron',kind:'seat'},owner,28);
    box('seat.'+side+'.pan',[cx,cy,cushionZ-.027],[.43,.38,.044],{material:'steel',kind:'seat'},owner);
    box('seat.'+side+'.cushion',[cx+.011,cy,cushionZ+.012],[.41,.36,.048],{material:'leather',kind:'seat',touch:.8},owner);
    for(const sy of[-1,1])cylinder('seat.'+side+'.back-stay.'+sy,[cx-.179,cy+sy*.135,cushionZ-.034],[cx-.195,cy+sy*.135,cushionZ+.42],.012,{material:'steel',kind:'seat'},owner);
    box('seat.'+side+'.back-shell',[cx-.199,cy,cushionZ+.265],[.035,.385,.34],{material:'paint',kind:'seat'},owner);
    box('seat.'+side+'.back-pad',[cx-.177,cy,cushionZ+.265],[.025,.35,.31],{material:'leather',kind:'seat',touch:.65},owner);
    for(const dx of[-.08,.08])for(const dy of[-.075,.075])bolt('seat.'+side+'.floor-bolt.'+dx+'.'+dy,[cx+dx,cy+dy,F+.026],[0,0,1],owner);
    attach('seat.'+side+'.floor-attachment',owner,[cx,cy,F],[cx,cy,cushionZ-.045],['seat.'+side+'.floor-foot','seat.'+side+'.pedestal','seat.'+side+'.pan']);port('cab.seat.'+side,[cx,cy,cushionZ+.036],owner,'seat cushion top; seated human pose not yet verified',[0,0,1]);seats.push({id:owner,independentFromBackhead:true,floorContactM:[cx,cy,F],cushionTopM:[cx+.011,cy,cushionZ+.036],facing:[1,0,0],standingDriverLaneExcluded:true});
  }
  // Rigid frames use unit scale; inherited crew anatomy is not shrunk to fit.
  const driver=[X(-7.33),.40,F],fireman=[X(-7.91),-.38,F];
  port('crew.driver.install',driver,'floor','rigid full-size standing driver foot datum',[0,0,1]);port('crew.fireman.install',fireman,'floor','candidate full-size standing fireman foot datum',[0,0,1]);
  port('crew.driver.hand-control-candidate',[X(-6.84),.37,F+1.16],'floor','reach target only; controls / hands assembly verification required',[-1,0,0]);
  const crewClearance={humanHeightM:p.humanHeightM,uniformScale:1,driverAnchorM:driver,firemanAnchorM:fireman,standingLaneRadiusM:.24,driverHeadTopZM:F+p.humanHeightM,minimumAnalyticRoofClearanceM:cabRoofUndersideAtY(p,.64,true)-(F+p.humanHeightM),floorTopZM:F,eyePointCandidateM:[X(-7.33),.20,F+1.64],eyePointStatus:'Approximate retained crew eye sample; final posed mesh belongs to assembly verification',sideWindowStructuralTopZM:win[3],sideWindowClearTopZM:win[3]-.026,certification:'sampled cab-only clearance, not complete animated human collision verification'};
  const coverageStatus={status:'isolated-native-candidate-not-approved',families:['cab-shell-glazing','crew-cab-installation'],implemented:['curved roof with thickness, bows, fasteners, gutters and drain outlets','perforated side walls and physically framed/sealed sliding glass panes','two hinged side access leaves, five treads each, mounted grab rails','continuous floor with flush walking boards and support members','open rear tender passage and glazed rear windows','open boiler throat and explicit backhead installation/floor ports','two independent seats and unit-scale rigid crew install frames','shared geometric and material wear/grime/contact domains'],unresolved:['All geometry, articulation, join dimensions and historical functionality are independently authored candidates, not certified A4 detail.','Full 3D crew pose/limb collision, hand-control contact and head-window sightlines require assembly verification.','Side door access requires a ducking/turning full-size entry pose. The taller rear passage has standing clearance; its external tender bridge is not supplied.','Open-door external sweep and step/wheel fouling are not established by this cab-only module.','No stress, vehicle gauge, drainage flow, heat, fire safety or operational certification.','No browser or GPU visual review in this CPU-only handoff.']};
  root.userData={mother:'cab',version:'native-r02',parameters:p,components,attachments,openings,seats,accessRoutes,crewClearance,ports,coordinateFrame:'native train SI X forward / Y left / Z up; global-coordinate geometry; root identity',sourceBuffersUsed:false,sourceTexturesUsed:false,sourceAnimationUsed:false,meshIsTransientRenderOutput:true,meshFreeRendererCompleted:false,historicalFunctionVerified:false,coverageStatus};root.updateMatrixWorld(true);
  return {root,parts,ports,parameters:p,coverageStatus};
}
