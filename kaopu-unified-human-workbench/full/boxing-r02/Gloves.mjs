import * as THREE from '../source/registration-vendor/three.module.js';

/** Original low-poly equipment, informed by ordinary boxing-glove construction.
 * No manufacturer image, logo, scan, or proprietary pattern is included.
 * Coordinates (metres at 1.75m stature): +Y wrist → knuckles, +Z hand back.
 * +X is the left glove's thumb side; the right glove is genuinely mirrored.
 * The root stays at lerp(wrist, finger3-1, .75), preserving R01 contact centres.
 */
export const GLOVE_SPEC = Object.freeze({
  schema:'original-structured-boxing-glove/2', referenceHeight:1.75,
  centreFraction:.75, axes:'+Y distal, +Z dorsal; +X left radial / right ulnar',
  features:['broad knuckle face','arched hand-back shell','attached curved thumb',
    'inset palm pad','palm seams','open wrist cuff','overlap fastening strap'],
  manufacturerReference:'https://www.hayabusafight.com/products/t3-boxing-gloves',
  provenance:'Original authored parametric geometry; structural reference only, not a scan or replica.',
});
const geometryCache=new Map();
const sharedMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:0});
sharedMaterial.name='original-glove-leather';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const pow=(v,p=.72)=>Math.sign(v)*Math.abs(v)**p;

class Builder{
 constructor(mirror){this.positions=[];this.colors=[];this.indices=[];this.mirror=mirror;this.parts=[];}
 vertex(p,c){const i=this.positions.length/3;let [x,y,z]=p;if(y>=-.071){const radial=Math.hypot(x,z),limit=Math.sqrt(Math.max(0,.1012**2-y*y));if(radial>limit){x*=limit/radial;z*=limit/radial;}}this.positions.push(x*this.mirror,y,z);this.colors.push(c.r,c.g,c.b);return i;}
 tri(a,b,c){this.indices.push(a,...(this.mirror===1?[b,c]:[c,b]));}
 quad(a,b,c,d){this.tri(a,b,c);this.tri(a,c,d);}
 part(name,fn){const start=this.indices.length;fn();this.parts.push({name,triangles:(this.indices.length-start)/3});}
 geometry(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));g.setIndex(this.indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.name='original-structured-glove';g.userData={parts:this.parts,triangles:this.indices.length/3,vertices:this.positions.length/3};return g;}
}
// Main shell is a hand-shaped superelliptic loft, not stacked ellipsoids. The
// last rings flatten into a broad padded striking face instead of a ball pole.
const shellProfile=[
 [-.117,.046,.040,.042],[-.111,.049,.042,.044],[-.074,.053,.045,.068],
 [-.055,.057,.038,.087],[-.040,.063,.042,.096],[-.025,.065,.046,.098],[.013,.063,.054,.084],
 [.050,.061,.051,.055],[.075,.056,.046,.047],[.086,.046,.036,.037],
 [.091,.028,.020,.022],
];
const shellPoint=(p,t,extra=0)=>{const [y,rx,dorsal,palmar]=p,s=Math.sin(t);return [pow(Math.cos(t))*(rx+extra),y,pow(s)*((s>=0?dorsal:palmar)+extra)];};
function ringLoft(b,profiles,segments,color,{end=true}={}){
 const rings=profiles.map((p,i)=>Array.from({length:segments},(_,j)=>{const t=j/segments*Math.PI*2;return b.vertex(shellPoint(p,t),typeof color==='function'?color(i,j,t):color);}));
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){const k=(j+1)%segments;b.quad(rings[i][j],rings[i+1][j],rings[i+1][k],rings[i][k]);}
 if(end){const p=profiles.at(-1),c=b.vertex([0,p[0]+.002,0],typeof color==='function'?color(profiles.length-1,0,0):color);for(let j=0;j<segments;j++)b.tri(c,rings.at(-1)[(j+1)%segments],rings.at(-1)[j]);}
 return rings;
}
function ribbon(b,points,width,color,normal){
 const ids=points.map((p,i)=>{const a=V(...points[Math.max(0,i-1)]),d=V(...points[Math.min(points.length-1,i+1)]).sub(a).normalize(),n=typeof normal==='function'?normal(p):V(...normal),side=d.cross(n).normalize().multiplyScalar(width/2);return [b.vertex([p[0]-side.x,p[1]-side.y,p[2]-side.z],color),b.vertex([p[0]+side.x,p[1]+side.y,p[2]+side.z],color)];});
 for(let i=0;i<ids.length-1;i++)b.quad(ids[i][0],ids[i][1],ids[i+1][1],ids[i+1][0]);
}
function tube(b,points,radii,color,segments=8){
 const rings=points.map((p,i)=>{const d=V(...points[Math.min(i+1,points.length-1)]).sub(V(...points[Math.max(i-1,0)])).normalize(),x=V(0,0,1).cross(d).normalize(),z=d.clone().cross(x).normalize(),r=radii[i];return Array.from({length:segments},(_,j)=>{const t=j/segments*Math.PI*2,q=V(...p).addScaledVector(x,Math.cos(t)*r).addScaledVector(z,Math.sin(t)*r*.85);return b.vertex(q.toArray(),color);});});
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){const k=(j+1)%segments;b.quad(rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]);}
 for(const [i,flip]of [[0,true],[rings.length-1,false]]){const c=b.vertex(points[i],color);for(let j=0;j<segments;j++){const k=(j+1)%segments;if(flip)b.tri(c,rings[i][k],rings[i][j]);else b.tri(c,rings[i][j],rings[i][k]);}}
}
// Query the already-authored shell triangles, rather than a different smooth
// equation. Tiny surface details therefore cannot cut into its faceted surface.
function palmSurfaceZ(b,x,y,partName='padded-hand-shell',dorsal=false){
 let z=dorsal?-Infinity:Infinity,start=0,count=0;for(const part of b.parts){if(part.name===partName){count=part.triangles*3;break;}start+=part.triangles*3;}
 for(let i=start;i<start+count;i+=3){const a=b.indices[i]*3,c=b.indices[i+1]*3,d=b.indices[i+2]*3,p=b.positions;
  const ax=p[a]/b.mirror,ay=p[a+1],bx=p[c]/b.mirror,by=p[c+1],cx=p[d]/b.mirror,cy=p[d+1],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;
  const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,w=1-u-v;
  if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7)z=(dorsal?Math.max:Math.min)(z,u*p[a+2]+v*p[c+2]+w*p[d+2]);
 }return z;
}
function buildGeometry(side,color){
 const b=new Builder(side==='R'?-1:1),team=new THREE.Color(color),dark=new THREE.Color(0x202934),palm=team.clone().multiplyScalar(.36),edge=team.clone().multiplyScalar(.52).lerp(new THREE.Color(0x787d7b),.12),accent=team.clone().multiplyScalar(.65);
 b.part('padded-hand-shell',()=>ringLoft(b,shellProfile,20,(i,j,t)=>{if(i<=2)return dark;if(Math.sin(t)>=-.67)return team;const x=shellPoint(shellProfile[i],t)[0],y=shellProfile[i][0],panel=THREE.MathUtils.smoothstep(y,-.055,-.025)*(1-THREE.MathUtils.smoothstep(y,.040,.065))*(1-THREE.MathUtils.smoothstep(Math.abs(x),.023,.057));return palm.clone().lerp(team,panel*.12);}));
 // Palm padding is the continuous hand shell itself, with a subdued integrated
 // panel. No near-coplanar overlay or triangle fan can z-fight with that shell.
 b.part('integrated-palm-padding',()=>{});
 b.part('open-cuff-lining',()=>{
  const outer=[],inner=[],deep=[];for(let j=0;j<20;j++){const t=j/20*Math.PI*2;outer.push(b.vertex(shellPoint(shellProfile[0],t),dark));inner.push(b.vertex([pow(Math.cos(t))*.041,-.117,pow(Math.sin(t))*.038],edge));deep.push(b.vertex([pow(Math.cos(t))*.041,-.097,pow(Math.sin(t))*.038],dark));}
  for(let j=0;j<20;j++){const k=(j+1)%20;b.quad(outer[j],outer[k],inner[k],inner[j]);b.quad(inner[j],inner[k],deep[k],deep[j]);}
 });
 b.part('attached-curved-thumb',()=>tube(b,[[.035,-.048,-.025],[.055,-.030,-.050],[.063,-.006,-.065],[.055,.016,-.074],[.038,.025,-.079],[.025,.022,-.080]],[.019,.020,.019,.018,.017,.010],team));
 b.part('wrist-fastening-band',()=>ringLoft(b,[[-.108,.0535,.047,.053],[-.1068,.0535,.047,.053],[-.104,.055,.049,.055],[-.0805,.057,.050,.070],[-.078,.056,.049,.072],[-.0768,.056,.049,.072]],12,i=>(i<2||i>3)?edge:team,{end:false}));
 // Binding is represented by narrow rows within the same band surface, so it
 // cannot intersect the fastening band or break into bright sawtooth slivers.
 b.part('integrated-cuff-binding',()=>{});
 b.part('strap-overlap-tab',()=>{
  // A small raised rounded fastening end, lying on the dorsal cuff. No logo.
  const surface=(x,y,lift)=>palmSurfaceZ(b,x,y,'wrist-fastening-band',true)+lift,p=[[-.026,-.102],[-.032,-.097],[-.032,-.085],[-.026,-.080],[.023,-.080],[.029,-.085],[.029,-.097],[.023,-.102]],out=p.map(([x,y])=>b.vertex([x,y,surface(x,y,.00045)],dark)),inside=p.map(([x,y])=>{const xx=x*.9,yy=-.091+(y+.091)*.77;return b.vertex([xx,yy,surface(xx,yy,.0018)],team);}),c=b.vertex([0,-.091,surface(0,-.091,.0018)],team);
  for(let j=0;j<8;j++){const k=(j+1)%8;b.quad(out[j],inside[j],inside[k],out[k]);b.tri(c,inside[k],inside[j]);}
 });
 b.part('palm-and-thumb-seams',()=>{
  // The long seam separates the back pad from the darker palm surface.
  for(const sign of [-1,1]){const ps=shellProfile.slice(3,10).map(p=>{const t=sign===1?-Math.PI*.23:Math.PI*1.23;return shellPoint(p,t,.0008);});ribbon(b,ps,.00065,edge,p=>V(p[0],0,p[2]).normalize());}
  const seam=[[-.043,.031],[-.022,.034],[.005,.034],[.029,.031]].map(([x,y])=>[x,y,palmSurfaceZ(b,x,y)-.00045]);ribbon(b,seam,.00065,edge,[0,0,-1]);
  ribbon(b,[[.040,-.042,-.047],[.061,-.026,-.067],[.066,-.005,-.080],[.053,.016,-.087],[.036,.023,-.090]],.00065,accent,[0,0,-1]);
 });
 b.part('palm-vent-stitches',()=>{
  for(let row=0;row<2;row++)for(let i=0;i<4;i++){const x=-.024+i*.013,y=-.005+row*.014,c=palm.clone().multiplyScalar(.68),v=(dx,dy)=>b.vertex([x+dx,y+dy,palmSurfaceZ(b,x+dx,y+dy)-.00035],c),a=v(-.00055,-.0008),d=v(-.00055,.0008),cc=v(.00055,.0008),e=v(.00055,-.0008);b.quad(a,d,cc,e);}
 });
 const g=b.geometry();g.userData.side=side;g.userData.color=team.getHex();g.userData.contactCentre=[0,0,0];g.userData.frontReachM=.093;g.userData.referenceRadiusM=.10125;return g;
}
export function createGloveGeometry({side='L',color=0x2f90b6}={}){
 if(side!=='L'&&side!=='R')throw Error('Glove side must be L or R');const key=side+':'+new THREE.Color(color).getHexString();if(!geometryCache.has(key))geometryCache.set(key,buildGeometry(side,color));return geometryCache.get(key);
}
const readNativePosition=(m,out)=>out.set(m[3],m[11],-m[7]);
export class StructuredGlove extends THREE.Mesh{
 constructor({side='L',color=0x2f90b6,height=1.75,names=null}={}){
  super(createGloveGeometry({side,color}).clone(),sharedMaterial);this.baseGeometry=createGloveGeometry({side,color});this.name='structured-glove-'+side;this.side=side;this.height=height;
  const index=n=>names?names.indexOf(n+'.'+side):-1;this.index=index('wrist');this.knuckle=index('finger3-1');this.radial=index('finger2-1');this.ulnar=index('finger5-1');this.thumb=index('finger1-1');this.forearm=index('lowerarm01');
  this._w=V();this._k=V();this._elbow=V();this._forearm=V();this._cuffDirection=V();this._cuffQ=new THREE.Quaternion();this._inverseQ=new THREE.Quaternion();this._p=V();this._n=V();this._r=V();this._u=V();this._x=V();this._y=V();this._z=V();this._basis=new THREE.Matrix4();this.scale.setScalar(height/GLOVE_SPEC.referenceHeight);
  this.userData={...this.geometry.userData,schema:GLOVE_SPEC.schema,anatomicalOrientation:true,sharedBaseGeometry:true,sharedGeometry:false,articulatedCuff:true,drawCalls:1};this.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);this.geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);this.frustumCulled=false;this._cuffVertices=Uint16Array.from(Array.from({length:this.baseGeometry.attributes.position.count},(_,i)=>i).filter(i=>this.baseGeometry.attributes.position.getY(i)<-.068));this.userData.cuffVerticesUpdated=this._cuffVertices.length;
 }
 /** Positions are in the actor group's view-Y-up coordinates. radial/ulnar are
  * index/pinky metacarpal bases; providing both gives the exact wrist roll.
  * A dorsal vector can be supplied instead if those positions are unavailable.
  */
 update({wrist,knuckle,radial=null,ulnar=null,dorsal=null,forearmDirection=null,height=this.height}={}){
  if(!wrist||!knuckle)return this;this._w.copy(wrist);this._k.copy(knuckle);this._y.subVectors(this._k,this._w);if(this._y.lengthSq()<1e-12)return this;this._y.normalize();
  if(radial&&ulnar){this._x.subVectors(radial,ulnar).multiplyScalar(this.side==='L'?1:-1);this._x.addScaledVector(this._y,-this._x.dot(this._y));}
  else if(dorsal)this._x.crossVectors(this._y,dorsal);
  else {this._z.set(0,0,1);if(Math.abs(this._z.dot(this._y))>.97)this._z.set(1,0,0);this._x.crossVectors(this._y,this._z);}
  if(this._x.lengthSq()<1e-12)return this;this._x.normalize();this._z.crossVectors(this._x,this._y).normalize();this._x.crossVectors(this._y,this._z).normalize();this._basis.makeBasis(this._x,this._y,this._z);this.quaternion.setFromRotationMatrix(this._basis);this.position.copy(this._w).lerp(this._k,GLOVE_SPEC.centreFraction);this.height=height;this.scale.setScalar(height/GLOVE_SPEC.referenceHeight);this.deformCuff(forearmDirection,this._w.distanceTo(this._k)*GLOVE_SPEC.centreFraction/this.scale.x);return this;
 }
 /** Bend only the wrist sleeve toward the forearm; the fist volume and contact
  * centre remain fixed. CPU deformation avoids custom shaders or added draws. */
 deformCuff(forearmDirection,wristDistance){
  const src=this.baseGeometry.attributes.position,srcN=this.baseGeometry.attributes.normal,dst=this.geometry.attributes.position,dstN=this.geometry.attributes.normal;
  if(forearmDirection){this._inverseQ.copy(this.quaternion).invert();this._cuffDirection.copy(forearmDirection).normalize().applyQuaternion(this._inverseQ);this._cuffQ.setFromUnitVectors(this._y.set(0,1,0),this._cuffDirection);}else this._cuffQ.identity();
  const wristY=-wristDistance,span=.030;let touched=false;
  for(const i of this._cuffVertices){const y=src.getY(i);const amount=THREE.MathUtils.clamp((-.068-y)/span,0,1),weight=amount*amount*(3-2*amount);this._p.fromBufferAttribute(src,i);this._n.fromBufferAttribute(srcN,i);if(weight>0){const x=this._p.x,z=this._p.z;this._p.y-=wristY;this._p.applyQuaternion(this._cuffQ);this._p.y+=wristY;this._p.set(x+(this._p.x-x)*weight,y+(this._p.y-y)*weight,z+(this._p.z-z)*weight);const nx=this._n.x,ny=this._n.y,nz=this._n.z;this._n.applyQuaternion(this._cuffQ).set(nx+(this._n.x-nx)*weight,ny+(this._n.y-ny)*weight,nz+(this._n.z-nz)*weight).normalize();}dst.setXYZ(i,this._p.x,this._p.y,this._p.z);dstN.setXYZ(i,this._n.x,this._n.y,this._n.z);touched=true;}
  if(touched){dst.needsUpdate=true;dstN.needsUpdate=true;}
 }
 /** Canonical row-major native-Z-up matrices from BoxingRig.evaluate(). */
 updateFromPose(posedMatrices,height=this.height){
  if(this.index<0||this.knuckle<0)return this;const w=posedMatrices[this.index],k=posedMatrices[this.knuckle];if(!w||!k)return this;
  readNativePosition(w,this._w);readNativePosition(k,this._k);let radial=null,ulnar=null;if(this.radial>=0&&this.ulnar>=0){radial=readNativePosition(posedMatrices[this.radial],this._r);ulnar=readNativePosition(posedMatrices[this.ulnar],this._u);}
  let forearmDirection=null;if(this.forearm>=0&&posedMatrices[this.forearm]){readNativePosition(posedMatrices[this.forearm],this._elbow);forearmDirection=this._forearm.subVectors(this._w,this._elbow);}
  return this.update({wrist:this._w,knuckle:this._k,radial,ulnar,forearmDirection,height});
 }
 // The immutable authoring base and material are shared; each lightweight cuff
 // owns its posed position/normal buffers to avoid cross-character interference.
 dispose(){this.geometry.dispose();}
}
export function createGlovePair(options={}){return ['L','R'].map(side=>new StructuredGlove({...options,side}));}
export function gloveDiagnostics(){return {schema:GLOVE_SPEC.schema,materialCount:1,sharedBaseGeometryCount:geometryCache.size,posedGeometryPolicy:'One independent geometry per glove; position and normal buffers update only the cuff; authoring bases remain shared and unchanged',mutableBuffersPerGlove:2,cuffVerticesUpdatedPerGlove:209,variants:[...geometryCache.values()].map(g=>({side:g.userData.side,color:g.userData.color,triangles:g.userData.triangles,vertices:g.userData.vertices,bounds:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},parts:g.userData.parts}))};}
