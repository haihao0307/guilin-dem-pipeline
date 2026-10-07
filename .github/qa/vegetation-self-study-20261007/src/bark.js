/**
 * Growth-coordinate pine bark study, revision 1. Units: metres, radians.
 * This is an experimental browser migration, NOT a Houdini cook or a game asset.
 * Geometry workflow studied: CorvaeOboro/zenv z_PLANTS_BARK (CC0).
 * 32-bit hash / Worley distance ordering ported from MaterialX mx_noise.glsl,
 * Apache-2.0, Copyright Contributors to the MaterialX Project.
 * See docs/bark/SOURCES.json, NOTICE and teacher-baseline.md.
 */
export const BARK_VERSION = 'pine-shell-study-r1';
export const BARK_SCHEMA = Object.freeze({
  version: BARK_VERSION, units: 'metres', seed: {default: 9, type: 'integer'},
  circumference: {default: 2.2, min: .05, max: 40, unit: 'm'},
  plateWidth: {default: .072, min: .012, max: .6, unit: 'm'},
  plateLength: {default: .32, min: .04, max: 1.2, unit: 'm'},
  thickness: {default: .016, min: 0, max: .12, unit: 'm'},
  peel: {default: .35, min: 0, max: 1},
  fissure: {default: .055, min: .025, max: .3, description: 'Cell inset fraction'},
  twist: {default: .035, min: -.3, max: .3, unit: 'turns/m'},
  flowWarp: {default: .22, min: 0, max: .28, unit: 'cell widths'},
  fiberStrength: {default: .8, min: 0, max: 2},
  wetness: {default: 0, min: 0, max: 1}, moss: {default: .12, min: 0, max: 1},
  deadwood: {default: 0, min: 0, max: 1},
  prerequisites: ['geometry.uv.x = circumference turn', 'geometry.uv.y = arc length (m)',
    'optional geometry.junction = attachment mask, 0..1', 'parent UV phase is shared at branch collars'],
  limitations: ['No native VDB remeshing', 'No automatic watertight branch union',
    'Houdini original cook unverified', 'No claim of AAA quality or exact source equivalence']
});
const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mod=(x,n)=>((x%n)+n)%n;
const rot=(x,k)=>((x<<k)|(x>>>(32-k)))>>>0;
// MaterialX / Bob Jenkins final mixer. Integer arithmetic deliberately wraps.
export function materialXHash3(x,y,z){
  const seed=(0xdeadbeef+12+13)>>>0;
  let a=(seed+(x>>>0))>>>0,b=(seed+(y>>>0))>>>0,c=(seed+(z>>>0))>>>0;
  c=((c^b)-rot(b,14))>>>0; a=((a^c)-rot(c,11))>>>0;
  b=((b^a)-rot(a,25))>>>0; c=((c^b)-rot(b,16))>>>0;
  a=((a^c)-rot(c,4))>>>0; b=((b^a)-rot(a,14))>>>0;
  return ((c^b)-rot(b,24))>>>0;
}
const rand=(x,y,k)=>materialXHash3(x,y,k)/4294967295;
function noise2(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),a=smooth(0,1,x-ix),b=smooth(0,1,y-iy);
  return mix(mix(rand(ix,iy,seed),rand(ix+1,iy,seed),a),mix(rand(ix,iy+1,seed),rand(ix+1,iy+1,seed),a),b);}
export function barkOptions(input={}){
  const out={};for(const [key,def] of Object.entries(BARK_SCHEMA))if(def&&typeof def==='object'&&'default'in def){
    const v=Number(input[key]??def.default);out[key]=Number.isFinite(v)?clamp(v,def.min??-2147483648,def.max??2147483647):def.default;
  }
  out.seed=out.seed|0;out.columns=Math.max(3,Math.round(out.circumference/out.plateWidth));
  out.plateWidth=out.circumference/out.columns;
  out.maxShells=Math.max(16,Math.floor(input.maxShells??6000));
  out.edgeSegments=Math.max(1,Math.min(3,Math.floor(input.edgeSegments??2)));
  out.phase=Number(input.phase)||0;out.arcOffset=Number(input.arcOffset)||0;
  return out;
}
function site(x,y,o){const k=mod(x,o.columns);return [x+.5+(rand(k,y,o.seed)-.5)*.93,y+.5+(rand(k,y,o.seed+1)-.5)*.93];}
const streamWarp=(t,v,o)=>o.flowWarp/o.columns*(Math.sin(TAU*t*3+v*2.3)+.46*Math.sin(TAU*t*5+v*19.3)+.16*Math.sin(TAU*t*7-v*43.1));
function forwardFlow(x,y,o){const v=y*o.plateLength-o.arcOffset;const t=x/o.columns;
  // Keep texture U unwrapped within a plate. Only the surface lookup wraps.
  return [t+o.phase+o.twist*v+streamWarp(t,v,o),v];}
function inverseFlow(u,v,o){const a=u-o.phase-o.twist*v;let t=a;
  for(let i=0;i<6;i++)t=a-streamWarp(t,v,o);
  return [mod(t,1)*o.columns,(v+o.arcOffset)/o.plateLength];}
export function sampleBarkField(u,v,options={}){
  const o=options.columns?options:barkOptions(options);const q=inverseFlow(u,v,o);let d1=1e12,d2=1e12,id=[0,0];
  const ix=Math.floor(q[0]),iy=Math.floor(q[1]);
  for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++){
    const p=site(x,y,o),d=(p[0]-q[0])**2+(p[1]-q[1])**2;
    if(d<d1){d2=d1;d1=d;id=[mod(x,o.columns),y];}else if(d<d2)d2=d;
  }
  const edge=Math.sqrt(d2)-Math.sqrt(d1),plate=smooth(o.fissure*.32,o.fissure*2.1,edge);
  const fiber=(noise2(q[0]*18,q[1]*2,o.seed+41)-.5)*1.4+(noise2(q[0]*70,q[1]*12,o.seed+43)-.5)*.5;
  const hue=rand(id[0],id[1],o.seed+17);
  const fine=noise2(q[0]*140,q[1]*130,o.seed+45)-.5;
  const weather=noise2(q[0]*4,q[1]*7,o.seed+47);
  const mossMask=o.moss*smooth(.4,.88,Math.sin(q[0]*.39+q[1]*.18)*.5+.5)*(1-plate*.7);
  const dark=[.042,.028,.020],clay=[mix(.19,.35,hue),mix(.105,.265,hue),mix(.055,.18,hue)],aged=[.32,.30,.265],green=[.071,.105,.026];
  const color=clay.map((c,k)=>mix(mix(dark[k],mix(c,aged[k],o.deadwood*.72),plate)*(1+fiber*.36*o.fiberStrength+fine*.16)*( .76+weather*.48),green[k],mossMask)*mix(1,.52,o.wetness));
  return {plate,edge,id,cellHeight:mix(.62,1.45,hue),fiber,height:o.thickness*plate*mix(.62,1.45,hue),color,
    roughness:clamp(mix(.91-hue*.13,.38,o.wetness)+mossMask*.09,.26,1),microHeight:(fiber*.0015+fine*.00065)*o.fiberStrength+plate*.0014};
}

export const BARK_GLSL = `
uniform float bColumns,bPlateLength,bThickness,bFissure,bTwist,bWarp,bFiber,bWet,bMoss,bDead,bPhase,bArc;
uniform int bSeed;
varying vec2 vBarkUv;
uint bRot(uint x,int k){return (x<<uint(k))|(x>>uint(32-k));}
uint bHash(int x,int y,int z){uint s=0xdeadbeefu+25u;uint a=s+uint(x),b=s+uint(y),c=s+uint(z);
c=(c^b)-bRot(b,14);a=(a^c)-bRot(c,11);b=(b^a)-bRot(a,25);c=(c^b)-bRot(b,16);
a=(a^c)-bRot(c,4);b=(b^a)-bRot(a,14);return (c^b)-bRot(b,24);}
float bRandom(int x,int y,int z){return float(bHash(x,y,z))/4294967295.0;}
float bNoise(vec2 p,int s){ivec2 c=ivec2(floor(p));vec2 f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(bRandom(c.x,c.y,s),bRandom(c.x+1,c.y,s),f.x),mix(bRandom(c.x,c.y+1,s),bRandom(c.x+1,c.y+1,s),f.x),f.y);}
int bWrap(int x){return int(mod(float(x),bColumns));}
vec2 bSite(int x,int y){int a=bWrap(x);return vec2(float(x)+.5,float(y)+.5)+
 (vec2(bRandom(a,y,bSeed),bRandom(a,y,bSeed+1))-.5)*.93;}
vec2 bFlow(vec2 uv){float a=uv.x-bPhase-bTwist*uv.y;float t=a;
for(int i=0;i<6;i++)t=a-bWarp/bColumns*(sin(6.28318530718*t*3.+uv.y*2.3)+.46*sin(6.28318530718*t*5.+uv.y*19.3)+.16*sin(6.28318530718*t*7.-uv.y*43.1));
return vec2(fract(t)*bColumns,(uv.y+bArc)/bPlateLength);}
vec4 bCell(vec2 q){ivec2 c=ivec2(floor(q));float d1=1e8,d2=1e8;vec2 id=vec2(0.);
for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){int x=c.x+i,y=c.y+j;vec2 p=bSite(x,y)-q;float d=dot(p,p);
if(d<d1){d2=d1;d1=d;id=vec2(float(bWrap(x)),float(y));}else if(d<d2)d2=d;}
return vec4(sqrt(d1),sqrt(d2),id);}
vec3 bReliefNormal(vec3 p,vec3 n,float h){vec3 dx=dFdx(p),dy=dFdy(p);vec3 r1=cross(dy,n),r2=cross(n,dx);
float det=dot(dx,r1);return normalize(abs(det)*n-sign(det)*(dFdx(h)*r1+dFdy(h)*r2));}
`;

export function createBarkMaterial(THREE,input={}){
  const o=barkOptions(input);
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,metalness:0,side:THREE.FrontSide});
  const uniforms={bColumns:{value:o.columns},bPlateLength:{value:o.plateLength},bThickness:{value:o.thickness},
    bFissure:{value:o.fissure},bTwist:{value:o.twist},bWarp:{value:o.flowWarp},bFiber:{value:o.fiberStrength},
    bWet:{value:o.wetness},bMoss:{value:o.moss},bDead:{value:o.deadwood},bSeed:{value:o.seed},bPhase:{value:o.phase},bArc:{value:o.arcOffset}};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 vBarkUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvBarkUv=uv;');
    shader.fragmentShader=BARK_GLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 bq=bFlow(vBarkUv);vec4 bc=bCell(bq);float be=bc.y-bc.x;
      float bp=smoothstep(bFissure*.32,bFissure*2.1,be);
      float br=bRandom(int(bc.z),int(bc.w),bSeed+17);
      float bf=(bNoise(bq*vec2(18.,2.),bSeed+41)-.5)*1.4+(bNoise(bq*vec2(70.,12.),bSeed+43)-.5)*.5;
      float fine=bNoise(bq*vec2(140.,130.),bSeed+45)-.5;
      float weather=bNoise(bq*vec2(4.,7.),bSeed+47);
      vec3 dark=vec3(.042,.028,.020);vec3 clay=mix(vec3(.19,.105,.055),vec3(.35,.265,.18),br);
      clay=mix(clay,vec3(.32,.30,.265),bDead*.72);
      vec3 barkColor=mix(dark,clay,bp);
      barkColor*=(1.+bf*.36*bFiber+fine*.16)*(.76+weather*.48);
      float mossMask=bMoss*smoothstep(.4,.88,sin(bq.x*.39+bq.y*.18)*.5+.5)*(1.-bp*.7);
      barkColor=mix(barkColor,vec3(.071,.105,.026),mossMask);
      diffuseColor.rgb*=barkColor*mix(1.,.52,bWet);
      float bMicro=(bf*.0015+fine*.00065)*bFiber+bp*.0014;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor=clamp(mix(.91-br*.13,.38,bWet)+mossMask*.09,.26,1.);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\nnormal=bReliefNormal(-vViewPosition,normal,bMicro);');
    material.userData.shaderCompiled=true;
  };
  material.customProgramCacheKey=()=>BARK_VERSION;
  material.userData={...material.userData,barkVersion:BARK_VERSION,barkOptions:o,barkUniforms:uniforms,
    originalCookVerified:false,source:'CorvaeOboro/zenv + MaterialX, experimental migration'};
  return material;
}

function clip(poly,nx,ny,c){const result=[];if(!poly.length)return result;let p=poly[poly.length-1],pd=p[0]*nx+p[1]*ny-c;
  for(const q of poly){const qd=q[0]*nx+q[1]*ny-c;
    if((pd<=1e-10)!==(qd<=1e-10)){const t=pd/(pd-qd);result.push([mix(p[0],q[0],t),mix(p[1],q[1],t)]);}
    if(qd<=1e-10)result.push(q);p=q;pd=qd;
  }return result;
}
function platePolygon(x,y,o,minY,maxY){const s=site(x,y,o);let poly=[[x-2,y-2],[x+3,y-2],[x+3,y+3],[x-2,y+3]];
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)if(dx||dy){const t=site(x+dx,y+dy,o),nx=t[0]-s[0],ny=t[1]-s[1];poly=clip(poly,nx,ny,(t[0]*t[0]+t[1]*t[1]-s[0]*s[0]-s[1]*s[1])*.5);}
  poly=clip(poly,0,-1,-minY);return clip(poly,0,1,maxY);
}

/** Indexed UV surface lookup. Does not collapse duplicated seam vertices. */
export function createBarkSurfaceSampler(THREE,geometry){
  const pos=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  if(!pos||!uv)throw new Error('Bark shell requires position and growth UV attributes');
  if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
  const normal=geometry.getAttribute('normal'),junction=geometry.getAttribute('junction'),index=geometry.index;
  let minV=Infinity,maxV=-Infinity;for(let i=0;i<uv.count;i++){minV=Math.min(minV,uv.getY(i));maxV=Math.max(maxV,uv.getY(i));}
  const bins=new Map(),nx=32,ny=64,range=Math.max(maxV-minV,1e-6);
  const bx=u=>Math.max(0,Math.min(nx-1,Math.floor(u*nx))),by=v=>Math.max(0,Math.min(ny-1,Math.floor((v-minV)/range*ny)));
  const n=index?index.count:pos.count;let triangles=0;
  for(let t=0;t+2<n;t+=3){const ids=[index?index.getX(t):t,index?index.getX(t+1):t+1,index?index.getX(t+2):t+2];
    const us=ids.map(i=>uv.getX(i)),vs=ids.map(i=>uv.getY(i));if(Math.max(...us)-Math.min(...us)>.5)continue;
    const det=(us[1]-us[0])*(vs[2]-vs[0])-(us[2]-us[0])*(vs[1]-vs[0]);
    const e1=new THREE.Vector3().fromBufferAttribute(pos,ids[1]).sub(new THREE.Vector3().fromBufferAttribute(pos,ids[0]));
    const e2=new THREE.Vector3().fromBufferAttribute(pos,ids[2]).sub(new THREE.Vector3().fromBufferAttribute(pos,ids[0]));
    const radius=Math.abs(det)>1e-14?e1.multiplyScalar(vs[2]-vs[0]).addScaledVector(e2,-(vs[1]-vs[0])).length()/Math.abs(det)/TAU:0;
    const tri={ids,us,vs,radius};for(let x=bx(Math.min(...us));x<=bx(Math.max(...us));x++)for(let y=by(Math.min(...vs));y<=by(Math.max(...vs));y++){
      const k=y*nx+x;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(tri);
    }triangles++;
  }
  let misses=0;
  const sample=(u,v)=>{u=mod(u,1);v=clamp(v,minV+range*1e-8,maxV-range*1e-8);
    const list=bins.get(by(v)*nx+bx(u))||[];
    for(const t of list){const [a,b,c]=t.us,[d,e,f]=t.vs,den=(e-f)*(a-c)+(c-b)*(d-f);if(Math.abs(den)<1e-14)continue;
      const w0=((e-f)*(u-c)+(c-b)*(v-f))/den,w1=((f-d)*(u-c)+(a-c)*(v-f))/den,w2=1-w0-w1;
      if(Math.min(w0,w1,w2)<-1e-5)continue;
      const w=[w0,w1,w2],p=new THREE.Vector3(),nrm=new THREE.Vector3();let j=0;
      for(let k=0;k<3;k++){const i=t.ids[k];p.x+=pos.getX(i)*w[k];p.y+=pos.getY(i)*w[k];p.z+=pos.getZ(i)*w[k];
        nrm.x+=normal.getX(i)*w[k];nrm.y+=normal.getY(i)*w[k];nrm.z+=normal.getZ(i)*w[k];if(junction)j+=junction.getX(i)*w[k];}
      return {position:p,normal:nrm.normalize(),junction:clamp(j),uv:[u,v],radius:t.radius};
    }misses++;return null;
  };
  return {sample,minV,maxV,triangles,get misses(){return misses;}};
}

/** Closed, separately extruded bark plates following the supplied trunk, not a cylinder primitive. */
export function createBarkShellGeometry(THREE,baseGeometry,input={}){
  const o=barkOptions(input),sampler=createBarkSurfaceSampler(THREE,baseGeometry);
  const positions=[],uvs=[],indices=[],plateIds=[],reliefs=[],junctions=[];let plateCount=0,omitted=0;
  const minY=(sampler.minV+o.arcOffset)/o.plateLength,maxY=(sampler.maxV+o.arcOffset)/o.plateLength;
  const add=(q,h,id)=>{const uv=forwardFlow(q[0],q[1],o),s=sampler.sample(uv[0],uv[1]);if(!s)return -1;
    const fade=(1-smooth(.18,.86,s.junction))*smooth(.025,.14,s.radius),d=h*fade;
    s.position.addScaledVector(s.normal,d);const i=positions.length/3;positions.push(s.position.x,s.position.y,s.position.z);
    uvs.push(uv[0],uv[1]);plateIds.push(id);reliefs.push(d);junctions.push(s.junction);return i;};
  for(let y=Math.floor(minY)-1;y<=Math.ceil(maxY);y++)for(let x=0;x<o.columns;x++){
    if(plateCount>=o.maxShells){omitted++;continue;}const polygon=platePolygon(x,y,o,minY+1e-5,maxY-1e-5);if(polygon.length<3)continue;
    const center=polygon.reduce((a,p)=>[a[0]+p[0]/polygon.length,a[1]+p[1]/polygon.length],[0,0]);
    const outer=[];for(let k=0;k<polygon.length;k++)for(let j=0;j<o.edgeSegments;j++){
      const a=polygon[k],b=polygon[(k+1)%polygon.length],f=j/o.edgeSegments;
      const q=[mix(a[0],b[0],f),mix(a[1],b[1],f)],chip=1-rand(x*37+k*5+j,y,o.seed+29)*.065;
      outer.push([mix(center[0],q[0],chip),mix(center[1],q[1],chip)]);
    }
    const seed=rand(x,y,o.seed+17),thickness=o.thickness*mix(.62,1.45,seed),inset=1-o.fissure*mix(.8,1.3,rand(x,y,o.seed+3));
    const n=outer.length,rows=[],pStart=positions.length/3,iStart=indices.length;
    const reliefAt=q=>{
      const fiberWarp=noise2(q[0]*1.9,q[1]*2.8,o.seed+21)*.7;
      const ridge=Math.pow(Math.abs(Math.sin(q[0]*31+fiberWarp+Math.sin(q[1]*5)*.25)),7);
      const fracture=noise2(q[0]*7,q[1]*17,o.seed+23);
      const layers=noise2(q[0]*3.5,q[1]*11,o.seed+25);
      return thickness*(.72+.28*layers-.29*ridge*o.fiberStrength+.18*(fracture-.5));
    };
    const centerIndex=add(center,reliefAt(center),plateCount),rowScale=[.15,.30,.45,.60,.73,.84,.92,1,.94];
    let valid=centerIndex>=0;
    for(let ring=0;ring<rowScale.length;ring++){
      const row=[];for(let k=0;k<n;k++){
        const rad=rowScale[ring]*inset,q=[mix(center[0],outer[k][0],rad),mix(center[1],outer[k][1],rad)];
        const along=q[1]-center[1],peelEdge=smooth(-.1,.45,along)*o.peel*thickness*1.15;
        const tooth=(rand(x*37+k,y,o.seed+8)-.5)*thickness*.22;
        const edgeBlend=smooth(.55,1,rowScale[ring]);
        let h=ring===rowScale.length-1?.0002:reliefAt(q)+peelEdge*edgeBlend+tooth*edgeBlend;
        const idx=add(q,h,plateCount);valid=valid&&idx>=0;row.push(idx);
      }rows.push(row);
    }
    const hasRelief=reliefs.slice(pStart).some(h=>h>1e-7);
    if(!valid||!hasRelief){positions.length=pStart*3;uvs.length=pStart*2;plateIds.length=pStart;reliefs.length=pStart;junctions.length=pStart;indices.length=iStart;continue;}
    // Top fan + bevel rings + side wall. Winding is corrected from sampled surface normals below.
    for(let k=0;k<n;k++){const kk=(k+1)%n;indices.push(centerIndex,rows[0][k],rows[0][kk]);
      for(let r=0;r<rows.length-1;r++)indices.push(rows[r][k],rows[r+1][k],rows[r+1][kk],rows[r][k],rows[r+1][kk],rows[r][kk]);
    }
    const bottom=add(center,.0002,plateCount);for(let k=0;k<n;k++)indices.push(bottom,rows[rows.length-1][(k+1)%n],rows[rows.length-1][k]);
    plateCount++;
  }
  // UV cylinder direction can be CW or CCW. Correct all plates together by first outward-facing top triangle.
  if(indices.length){const a=indices[0],b=indices[1],c=indices[2],pa=new THREE.Vector3().fromArray(positions,a*3),
    pb=new THREE.Vector3().fromArray(positions,b*3),pc=new THREE.Vector3().fromArray(positions,c*3),uv=[uvs[a*2],uvs[a*2+1]],s=sampler.sample(...uv);
    if(s&&pb.sub(pa).cross(pc.sub(pa)).dot(s.normal)<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('barkPlate',new THREE.Float32BufferAttribute(plateIds,1));
  geometry.setAttribute('barkRelief',new THREE.Float32BufferAttribute(reliefs,1));geometry.setAttribute('junction',new THREE.Float32BufferAttribute(junctions,1));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.bark={version:BARK_VERSION,options:o,plates:plateCount,triangles:indices.length/3,vertices:positions.length/3,
    uvLookupMisses:sampler.misses,omittedByBudget:omitted,watertightPlates:true,branchUnion:false,secondaryGrowthRadiusGate:true,originalCookVerified:false};
  return geometry;
}

export function createBarkBundle(THREE,baseGeometry,input={}){
  const material=createBarkMaterial(THREE,input),shellMaterial=createBarkMaterial(THREE,input);
  const shellGeometry=createBarkShellGeometry(THREE,baseGeometry,input);
  let disposed=false;return {material,shellMaterial,shellGeometry,stats:shellGeometry.userData.bark,
    dispose(){if(disposed)return;disposed=true;material.dispose();shellMaterial.dispose();shellGeometry.dispose();}};
}
