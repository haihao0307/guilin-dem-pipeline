import {createBackheadSystemGeometry} from './backhead-system-geometry.mjs';
/**
 * KAOPU FH88: independently authored backhead/control mother, isolated r02.
 * Native SI frame X forward / Y left / Z up. Rear-facing service face at X=0.
 * Only scalar design inputs and named connections are retained. BufferGeometry
 * is disposable render output, NOT a claim of a mesh-free renderer.
 * Source names/material categories and a reference screenshot informed anatomy;
 * no source vertices, normals, indices, UVs, images or animation samples are used.
 * Candidate fittings/routes are NOT a certified reproduction or fluid model.
 */
export const BACKHEAD_DESIGN = Object.freeze({
  widthM: 2.30, heightM: 1.90, depthM: .40,
  shellThicknessM: .022, pipeRadiusM: .014, branchRadiusM: .010,
  bendRadiusM: .045, couplingRadiusM: .022, wheelRadiusM: .070,
  wheelRimRadiusM: .008, gaugeRadiusM: .102,
  fireholeWidthM: .61, fireholeHeightM: .40, fireholeCenterZM: .48,
  firedoorOpenRad: 0, regulatorAngleRad: -.34,
  wearAmount: .62, oxidationAmount: .50, heatMarkAmount: .65,
  resolution: 1,
  dimensionStatus: 'Authored FH88 fit limits, not a source survey or calibrated A4 measurements.'
});
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const mix = (a,b,t) => a+(b-a)*t;
const dist = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
const point = (a,b,t) => a.map((v,i)=>mix(v,b[i],t));
const gaussian = (v,s) => Math.exp(-(v*v)/(s*s));
// Independent smooth value noise, never baked into sparse mesh vertices.
const MICROFINISH_GLSL=`
float finishHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float finishNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(finishHash(i),finishHash(i+vec3(1,0,0)),f.x),mix(finishHash(i+vec3(0,1,0)),finishHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(finishHash(i+vec3(0,0,1)),finishHash(i+vec3(1,0,1)),f.x),mix(finishHash(i+vec3(0,1,1)),finishHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float filteredFinish(vec3 nativeM){vec3 q=nativeM*165.;float footprint=max(length(dFdx(q)),length(dFdy(q)));return(finishNoise(q)-.5)*(1.-smoothstep(.35,1.2,footprint));}
`;
const PATH_LENGTH_CACHE=new WeakMap();
const nearestOnPolyline = (p,path) => {
  let best = {distance: Infinity,t:0,side:0,point:path[0]};
  let metrics=PATH_LENGTH_CACHE.get(path);
  if(!metrics){const lengths=path.slice(1).map((b,i)=>dist(path[i],b));metrics={lengths,total:lengths.reduce((a,b)=>a+b,0)};PATH_LENGTH_CACHE.set(path,metrics);}
  const {lengths,total}=metrics;let accumulated=0;
  for(let i=0;i<lengths.length;i++){
    const a=path[i],b=path[i+1],v=b.map((n,j)=>n-a[j]);
    const u=clamp(p.reduce((s,n,j)=>s+(n-a[j])*v[j],0)/(lengths[i]**2||1));
    const q=point(a,b,u),d=dist(p,q);
    if(d<best.distance)best={distance:d,t:(accumulated+u*lengths[i])/(total||1),point:q,side:p[2]-q[2]};
    accumulated+=lengths[i];
  }
  return best;
};
export function validateBackheadParameters(p){
  for(const [k,v] of Object.entries(p))if(typeof v==='number'&&!Number.isFinite(v))throw Error('NONFINITE_BACKHEAD_PARAMETER:'+k);
  for(const key of ['widthM','heightM','depthM','shellThicknessM','pipeRadiusM','branchRadiusM','bendRadiusM','couplingRadiusM','wheelRadiusM','wheelRimRadiusM','gaugeRadiusM','fireholeWidthM','fireholeHeightM'])if(!(p[key]>0))throw Error('NONPOSITIVE_BACKHEAD_PARAMETER:'+key);
  if(p.widthM<1.75||p.widthM>2.8||p.heightM<1.55||p.heightM>2.35||p.depthM<.32||p.depthM>.65)throw Error('BACKHEAD_CANDIDATE_FIT_OUT_OF_RANGE');
  if(p.shellThicknessM>.045||p.pipeRadiusM>.024||p.branchRadiusM>p.pipeRadiusM||p.couplingRadiusM<=p.pipeRadiusM||p.couplingRadiusM>.036||p.bendRadiusM<2*p.pipeRadiusM||p.bendRadiusM>.075)throw Error('BACKHEAD_PIPE_OR_WALL_DOMAIN_INVALID');
  if(p.wheelRadiusM<.035||p.wheelRadiusM>.090||p.wheelRimRadiusM>p.wheelRadiusM*.20||p.gaugeRadiusM<.07||p.gaugeRadiusM>.12)throw Error('BACKHEAD_CONTROL_DOMAIN_INVALID');
  if(p.fireholeWidthM>.40*p.widthM||p.fireholeHeightM>.28*p.heightM||p.fireholeCenterZM-p.fireholeHeightM/2<.12||p.fireholeCenterZM+p.fireholeHeightM/2>.58*p.heightM)throw Error('BACKHEAD_FIREHOLE_DOMAIN_INVALID');
  if(p.firedoorOpenRad<0||p.firedoorOpenRad>1.25||Math.abs(p.regulatorAngleRad)>.8||p.wearAmount<0||p.wearAmount>1||p.oxidationAmount<0||p.oxidationAmount>1||p.heatMarkAmount<0||p.heatMarkAmount>1||p.resolution<.5||p.resolution>2)throw Error('BACKHEAD_APPEARANCE_OR_CONTROL_RANGE');
  return true;
}
/** Analytic appearance fields share the same positions, paths and radii as form. */
export function backheadDomain(p,d,xyz){
  const center=d.center||[0,0,p.fireholeCenterZM];
  const ellipse=Math.hypot(xyz[1]/(p.fireholeWidthM/2), (xyz[2]-p.fireholeCenterZM)/(p.fireholeHeightM/2));
  const thermal=gaussian(Math.max(0,ellipse-1),1.25)*gaussian(xyz[0],.28)*p.heatMarkAmount;
  const line=d.path?nearestOnPolyline(xyz,d.path):null;
  const r=Math.hypot(xyz[1]-center[1],xyz[2]-center[2]);
  const angle=Math.atan2(xyz[2]-center[2],xyz[1]-center[1]);
  let touch=d.touch||0,crevice=d.crevice||0,edge=0;
  if(d.type==='handwheel')touch=gaussian(r-(d.radius||p.wheelRadiusM),p.wheelRimRadiusM*1.9)*(.60+.40*Math.sin(angle+1.1)**2);
  if(d.type==='gauge')edge=gaussian(r-(d.radius||p.gaugeRadiusM),.010)*.72;
  if(d.type==='door')edge=gaussian(ellipse-.96,.10)*.60;
  if(line){crevice=Math.max(crevice,gaussian(line.t,.045)+gaussian(1-line.t,.045));touch=Math.max(touch,.10*Math.sin(line.t*Math.PI)**2);}
  const wear=clamp((touch+edge)*p.wearAmount);
  const underside=line?clamp(-line.side/(d.radius||p.pipeRadiusM)*.5+.5):.45;
  const oxidation=clamp((.17+.46*crevice+.27*underside)*p.oxidationAmount*(1-wear));
  const grain=clamp(.40+.24*gaussian(xyz[1]-.23,.58)*gaussian(xyz[2]-.85,.70)+.13*gaussian(xyz[0]+.12,.20));
  const chips=(d.material==='paint'||d.material==='red')?clamp((wear-.10)*.80)*(.40+.60*grain):0;
  return {heat:clamp(thermal*(d.heatFactor??1)),wear,oxidation,crevice:clamp(crevice),grain,chips,axial:line?.t??0};
}
const PALETTES={
  iron: {base:[.078,.092,.098],metal:.76,rough:.55},
  steel:{base:[.25,.28,.29],metal:.84,rough:.35},
  copper:{base:[.55,.265,.104],metal:.90,rough:.36},
  brass:{base:[.62,.43,.16],metal:.90,rough:.30},
  paint:{base:[.036,.082,.058],metal:0,rough:.37},
  red:{base:[.30,.022,.019],metal:0,rough:.40},
  ivory:{base:[.82,.78,.64],metal:.02,rough:.54},
  ink:{base:[.008,.013,.012],metal:.03,rough:.44},
  glass:{base:[.68,.83,.82],metal:0,rough:.10}
};
function shade(p,d,xyz){
  const f=backheadDomain(p,d,xyz),pal=PALETTES[d.material||'steel'],c=pal.base.slice();
  const isMetal=['iron','steel','copper','brass'].includes(d.material);
  const soot=f.heat*(d.material==='iron'?.44:.12);
  const oxide=d.material==='copper'?[.105,.175,.129]:[.095,.065,.041];
  for(let i=0;i<3;i++){
    c[i]=mix(c[i],oxide[i],f.oxidation*(isMetal?.62:.12));
    c[i]=mix(c[i],[.025,.021,.017][i],soot);
    c[i]=mix(c[i],pal.base[i]*1.22+.032,f.wear*(isMetal?.65:.18));
    c[i]=mix(c[i],[.35,.38,.37][i],f.chips*.85);
    c[i]=clamp(c[i]);
  }
  return {color:c,roughness:clamp(pal.rough+f.oxidation*.26+soot*.18-f.wear*.22,.08,.95),metalness:clamp(mix(pal.metal,.87,f.chips)*(1-f.oxidation*.38)*(1-soot*.80)),fields:f};
}
function surfaceMaterial(T,kind){
  const mat=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:1,side:T.FrontSide});
  mat.name='native-backhead-'+kind+'-field';
  if(kind==='glass'){mat.transparent=true;mat.opacity=.14;mat.depthWrite=false;}
  mat.userData={mother:'backhead',nativeDomain:'part scalar dimensions and assembly-native XYZ',bakedVertexFields:'low-frequency service fields only',heatIsAppearanceOnly:true,appearanceRevision:'native-coating-r04',coatingIsDielectric:kind==='paint'||kind==='red',parameterStatus:'Authored candidates; not calibrated measurements',fineFinish:'fragment footprint filtered; no vertex micrograin'};
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 bhSurface; varying vec2 vBhSurface; varying vec3 vBhNative;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBhSurface=bhSurface; vBhNative=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vBhSurface; varying vec3 vBhNative;\n'+MICROFINISH_GLSL);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(vBhSurface.x'+(kind==='glass'?'':'+filteredFinish(vBhNative)*.026')+',.08,.95);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=clamp(vBhSurface.y,0.,1.);');
  };
  mat.customProgramCacheKey=()=>`native-backhead-coating-r04-${kind}`;
  return mat;
}
function roundedPath(T,coords,r){
  const path=new T.CurvePath(),v=coords.filter((c,i)=>i===0||dist(c,coords[i-1])>1e-8).map(c=>new T.Vector3(...c));if(v.length<2)throw Error('BACKHEAD_EMPTY_PATH');let from=v[0];
  for(let i=1;i<v.length-1;i++){
    const a=v[i-1],b=v[i],c=v[i+1],cut=Math.min(r,a.distanceTo(b)*.30,b.distanceTo(c)*.30);
    const enter=b.clone().lerp(a,cut/a.distanceTo(b)),leave=b.clone().lerp(c,cut/b.distanceTo(c));
    if(from.distanceTo(enter)>1e-9)path.add(new T.LineCurve3(from,enter));
    path.add(new T.QuadraticBezierCurve3(enter,b,leave));from=leave;
  }
  if(from.distanceTo(v.at(-1))>1e-9)path.add(new T.LineCurve3(from,v.at(-1)));return path;
}
export function createBackheadMother(T,overrides={}){
  const p={...BACKHEAD_DESIGN,...overrides};validateBackheadParameters(p);
  const root=new T.Group();root.name='KAOPU FH88 authored backhead and controls';
  const parts=[],ports=[],components=[],connections=[],attachments=[];
  const materials=Object.fromEntries(Object.keys(PALETTES).map(k=>[k,surfaceMaterial(T,k)]));
  const sx=p.depthM/.40,sy=p.widthM/2.30,sz=p.heightM/1.90;
  const P=(x,y,z)=>[x*sx,y*sy,z*sz], V=a=>new T.Vector3(...a);
  const R=n=>Math.max(4,Math.round(n*p.resolution));
  const component=(id,role,sourceGroups=[],parent='backhead-frame')=>{const c={id,role,parent,sourceGroups,sourceRelation:'Observed category; native dimensions and detailed topology independently authored'};components.push(c);return c;};
  component('backhead-frame','arched steel mounting boundary',[],'cab-floor');
  function add(g,id,d,parent='backhead-frame'){
    const pos=g.attributes.position,old=g.index,idx=[],A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3();let removed=0;
    for(let i=0;i<(old?old.count:pos.count);i+=3){const ids=[0,1,2].map(j=>old?old.getX(i+j):i+j);A.fromBufferAttribute(pos,ids[0]);B.fromBufferAttribute(pos,ids[1]).sub(A);C.fromBufferAttribute(pos,ids[2]).sub(A);if(B.cross(C).lengthSq()>1e-20)idx.push(...ids);else removed++;}
    g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();
    const colors=[],surface=[],fields=[];
    for(let i=0;i<pos.count;i++){const v=[pos.getX(i),pos.getY(i),pos.getZ(i)],s=shade(p,d,v);colors.push(...s.color);surface.push(s.roughness,s.metalness);fields.push(s.fields.heat,s.fields.wear,s.fields.oxidation);}
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('bhSurface',new T.Float32BufferAttribute(surface,2));g.setAttribute('bhDomains',new T.Float32BufferAttribute(fields,3));
    g.userData={transientNativeRenderOutput:true,removedDegenerateTriangles:removed};
    const m=new T.Mesh(g,materials[d.material||'steel']);m.name=id;m.castShadow=m.receiveShadow=d.material!=='glass';
    m.userData={mother:'backhead',partId:id,functionalParent:parent,domain:d,sourceBuffersUsed:false,shapeAndMaterialShareDomain:true};root.add(m);parts.push(m);return m;
  }
  const box=(id,c,s,d,parent)=>{const g=new T.BoxGeometry(...s,R(2),R(3),R(3));g.translate(...c);return add(g,id,d,parent);};
  const cylinder=(id,a,b,r,d,parent,r2=r,n=24)=>{const g=new T.CylinderGeometry(r2,r,dist(a,b),R(n),R(2));g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),V(b).sub(V(a)).normalize()));g.translate(...point(a,b,.5));return add(g,id,d,parent);};
  const ring=(id,c,major,minor,d,parent,normal=[-1,0,0],arc=Math.PI*2)=>{const g=new T.TorusGeometry(major,minor,R(8),R(48),arc);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),V(normal).normalize()));g.translate(...c);return add(g,id,d,parent);};
  const bolt=(id,c,parent,r=.008)=>{cylinder(id,c,[c[0]-.010*sx,c[1],c[2]],r,{material:'steel',type:'bolt',center:c,touch:.4,crevice:.2},parent,r,6);};
  const port=(id,c,direction,r,owner,kind='candidate-pipe')=>{if(ports.some(a=>a.id===id))throw Error('DUPLICATE_PORT:'+id);const q={id,positionM:c,direction,radiusM:r,owner,kind,functionIdentity:kind.includes('interface')&&kind.includes('floor')?'authored mechanical mounting':'unverified authored candidate; source functional identity undetermined'};ports.push(q);return q;};
  const get=id=>{const q=ports.find(v=>v.id===id);if(!q)throw Error('MISSING_PORT:'+id);return q;};
  const framePort=(id,c,kind='mounting')=>port(id,c,[-1,0,0],.01,'backhead-frame',kind);
  const mount=(id,c,owner,size=.075)=>{
    const foot=[-.013*sx,c[1],c[2]],domain={material:'paint',type:'mount',center:foot,touch:.25,crevice:.40};
    box(id+'.foot',foot,[.028*sx,size*sy,size*sz],domain,owner);
    cylinder(id+'.standoff',foot,c,.011,{material:'steel',type:'mount',center:c,crevice:.50},owner);
    for(const s of [-1,1])bolt(id+'.bolt'+s,[-.03*sx,c[1]+s*size*.32*sy,c[2]],owner,.006);
    attachments.push({id,owner,fromM:foot,toM:c,role:'mechanical mounting to arched backhead'});
  };
  // Shaped steel wrapper with a true firehole cut-out, not a generic dashboard.
  const outline=new T.Shape();outline.moveTo(-1.04*sy,0);outline.lineTo(1.04*sy,0);outline.lineTo(1.10*sy,1.28*sz);outline.bezierCurveTo(1.10*sy,1.66*sz,.60*sy,1.89*sz,0,1.89*sz);outline.bezierCurveTo(-.60*sy,1.89*sz,-1.10*sy,1.66*sz,-1.10*sy,1.28*sz);outline.closePath();
  const hole=new T.Path();hole.absellipse(0,p.fireholeCenterZM,p.fireholeWidthM/2,p.fireholeHeightM/2,0,2*Math.PI,true);outline.holes.push(hole);
  const shell=new T.ExtrudeGeometry(outline,{depth:p.shellThicknessM,bevelEnabled:false,curveSegments:R(32),steps:1});
  // Local shape (u,v,w) => native (X=w,Y=u,Z=v).
  shell.applyMatrix4(new T.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1));
  add(shell,'backhead.arched-perforated-plate',{material:'iron',type:'shell',heatFactor:.8});
  const perimeter=outline.getPoints(R(42)).map(v=>[-.008*sx,v.x,Math.max(.011,Math.min(p.heightM-.011,v.y))]);perimeter.push(perimeter[0]);
  add(new T.TubeGeometry(roundedPath(T,perimeter,.004),R(180),.011,R(8),true),'backhead.rolled-perimeter',{material:'steel',type:'mount',path:perimeter,touch:.18});
  for(const side of [-1,1])for(let j=0;j<9;j++)bolt(`backhead.edge-bolt.${side}.${j}`,P(-.020,side*(1.01-j*.014),.11+j*.157),'backhead-frame');
  for(const side of [-1,1]){box(`backhead.floor-shoe.${side}`,P(0,side*.77,.030),[.10*sx,.19*sy,.06*sz],{material:'iron',type:'mount',touch:.18});framePort(`cab.floor.${side}`,P(0,side*.77,0),'cab-floor-interface');framePort(`cab.seat-mount.${side}`,P(-.20,side*1.01,.44),'separate-seat-interface');}
  // Firehole flange, refractory throat, hinged cover, hinge knuckles and latch.
  component('firedoor','closed oval firehole door with hinge and latch',[152]);
  const fireCenter=[-.030*sx,0,p.fireholeCenterZM],frY=p.fireholeWidthM/2,frZ=p.fireholeHeightM/2;
  const ovalPoints=(x,ry,rz,n=96)=>Array.from({length:n+1},(_,i)=>[x,Math.cos(i/n*Math.PI*2)*ry,p.fireholeCenterZM+Math.sin(i/n*Math.PI*2)*rz]);
  for(const [name,x,ry,rz,rr,mat] of [['throat',.002,frY,frZ,.030,'iron'],['rim',-.038,frY+.034,frZ+.027,.020,'steel']]){
    const path=ovalPoints(x*sx,ry,rz);add(new T.TubeGeometry(roundedPath(T,path,.003),R(128),rr,R(10),true),'firedoor.'+name,{material:mat,type:'door',center:fireCenter},'firedoor');
  }
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2;bolt('firedoor.flange-bolt.'+i,[-.052*sx,Math.cos(a)*(frY+.065),p.fireholeCenterZM+Math.sin(a)*(frZ+.060)],'firedoor');}
  const cover=new T.Shape();cover.absellipse(0,p.fireholeCenterZM,frY+.002,frZ+.002,0,2*Math.PI,false);
  const doorG=new T.ExtrudeGeometry(cover,{depth:.026*sx,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:R(2),curveSegments:R(30)});doorG.applyMatrix4(new T.Matrix4().set(0,0,1,-.070*sx, 1,0,0,0, 0,1,0,0, 0,0,0,1));
  const door=add(doorG,'firedoor.moving-cover',{material:'iron',type:'door',center:fireCenter},'firedoor');
  const hingeY=frY+.045, hingeX=-.085*sx,hingeParts=[door];
  for(const s of [-1,1]){
    const z=p.fireholeCenterZM+s*frZ*.61;
    hingeParts.push(box(`firedoor.hinge-strap.${s}`,[hingeX,frY*.66,z],[.035*sx,.28*frY,.040],{material:'steel',type:'door',center:fireCenter,touch:.14},'firedoor'));
    for(let k=0;k<3;k++)cylinder(`firedoor.hinge-knuckle.${s}.${k}`,[hingeX,hingeY,z-.032+k*.023],[hingeX,hingeY,z-.013+k*.023],.020,{material:'steel',type:'door',center:fireCenter,crevice:.8},'firedoor');
    cylinder(`firedoor.hinge-pin.${s}`,[hingeX,hingeY,z-.041],[hingeX,hingeY,z+.044],.008,{material:'brass',type:'bolt',touch:.5},'firedoor');
  }
  const latchZ=p.fireholeCenterZM;
  hingeParts.push(cylinder('firedoor.latch-bar',[-.108*sx,-frY-.045,latchZ],[-.108*sx,-frY+.13,latchZ+.035],.011,{material:'steel',type:'door',center:fireCenter,touch:.9},'firedoor'));
  hingeParts.push(cylinder('firedoor.handled-grip',[-.155*sx,-frY+.10,latchZ+.035],[-.245*sx,-frY+.10,latchZ+.035],.015,{material:'ink',type:'handle',center:fireCenter,touch:1},'firedoor'));
  box('firedoor.latch-keeper',[-.069*sx,-frY-.033,latchZ],[.045*sx,.04,.080],{material:'steel',type:'mount',center:fireCenter,touch:.5},'firedoor');
  if(p.firedoorOpenRad){const pivot=new T.Vector3(hingeX,hingeY,p.fireholeCenterZM),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-p.firedoorOpenRad);for(const m of hingeParts){m.geometry.translate(-pivot.x,-pivot.y,-pivot.z);m.geometry.applyQuaternion(q);m.geometry.translate(pivot.x,pivot.y,pivot.z);m.geometry.computeBoundingBox();}}
  framePort('firedoor.hinge',[hingeX,hingeY,p.fireholeCenterZM]);
  // Functional systems replace the former 9-valve serial loop and 4 toy dials.
  const systems=createBackheadSystemGeometry(T,p,{root,parts,ports,components,connections,attachments,add,box,cylinder,ring,bolt,mount,roundedPath:(TT,coords,r)=>roundedPath(TT,coords,r)});
  const coverageStatus={status:'independent-FH88-functional-layout-not-physically-integrated',functionalRevision:systems.contract.revision,sourceCategoryCoverage:{152:'preserved independently authored firedoor anatomy',154:'seat interfaces belong to separate cab',160:'independent branch controls selected by system roles',166:'manifold and regulator cross-shaft/stuffing box',179:'two authored FH88 absolute-pressure dials with numbers and units'},unresolved:systems.contract.missingSystems};
  root.userData={mother:'backhead',version:'native-functional-r05',parameters:p,components,connections,attachments,ports,coverageStatus,functionalContract:systems.contract,coordinateFrame:'SI X forward / Y left / Z up; service face toward -X',sourceBuffersUsed:false,sourceTexturesUsed:false,sourceAnimationUsed:false,meshIsTransientRenderOutput:true,meshFreeRendererCompleted:false,physicalFluidNetworkCertified:false,physicalIntegrationComplete:false,physicalStateBindings:[],instrumentCalibrationVerified:false,instrumentsComplete:false,staticGaugePreview:null,instrumentReadings:[],seatsIncluded:false};
  systems.updateFromPhysics(null);
  return {root,parts,ports,parameters:p,coverageStatus,functionalContract:systems.contract,updateFromPhysics:systems.updateFromPhysics,setRegulatorFraction:systems.setRegulatorFraction,setRegulator:systems.setRegulator};
}
