// Small authored presentation courts. No DEM, surveyed paving or vegetation is inferred.
// Material kernels are the exact retained KST1 concrete and STONE_STUDY kind-0 closure.
const RECEIVER=String.raw`
varying vec3 vCourtPosition;
uniform float uCourtKind;
KpSurface courtSurface(vec3 p,float fp){
 if(uCourtKind<.5)return kpConcreteStation(p,.32,.20,.08,fp);
 // Retained heritage receiver scale: .65 m source domain, not new stone noise.
 return kpStoneSurface(p*.19,.28,.18,.04,fp*.19);
}
vec3 courtBump(vec3 eyeP,vec3 n,float h){
 vec3 dx=dFdx(eyeP),dy=dFdy(eyeP),r1=cross(dy,n),r2=cross(n,dx);
 float det=dot(dx,r1);vec3 g=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);
 return normalize(abs(det)*n-g);
}
`;
export function courtDimensions(size){return {width:size.x+12,depth:size.z+12,border:1.05};}
function material(THREE,source,kind){
 const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,metalness:0});
 m.name=kind?'Retained STONE_STUDY kind-0 court edge':'Retained KST1 court concrete';
 m.customProgramCacheKey=()=>`kaopu-court-retained-${kind}-r01`;
 m.onBeforeCompile=s=>{
  s.uniforms.uCourtKind={value:kind};
  s.vertexShader='varying vec3 vCourtPosition;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCourtPosition=position;');
  s.fragmentShader=source+'\n'+RECEIVER+'\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float courtFP=max(length(dFdx(vCourtPosition)),length(dFdy(vCourtPosition)));
 KpSurface court= courtSurface(vCourtPosition,max(courtFP,.000001));
 diffuseColor.rgb*=court.albedo;`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=court.roughness;');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 // Receiver-only normal filtering; source material/geometry remains intact.
 float courtResolved=1.-smoothstep(.002,.025,courtFP);
 normal=courtBump(-vViewPosition,normal,court.height*courtResolved);`);
 };
 return m;
}
function quads(THREE,rects){
 const p=[],n=[];
 for(const [x0,z0,x1,z1]of rects){
  p.push(x0,0,z0,x0,0,z1,x1,0,z1,x0,0,z0,x1,0,z1,x1,0,z0);
  for(let i=0;i<6;i++)n.push(0,1,0);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.computeBoundingSphere();return g;
}
export async function installContext({THREE,context,ground,grid,objects,requestRender,source}){
 const response=await fetch(new URL('./mothers/context-stone.glsl',import.meta.url));
 if(!response.ok)throw Error('Missing retained court stone closure');
 const stone=await response.text(),full=source+'\n'+stone;
 const concrete=material(THREE,full,0),stoneMaterial=material(THREE,full,1),pads=[];
 for(const o of objects){
  const b=new THREE.Box3().setFromObject(o.mesh),c=b.getCenter(new THREE.Vector3()),d=courtDimensions(o.size);
  const x=d.width/2,z=d.depth/2,w=d.border,group=new THREE.Group();
  group.name=`Authored presentation court: ${o.entry.id}`;group.position.set(c.x,-.055,c.z);
  const floor=new THREE.Mesh(quads(THREE,[[-x+w,-z+w,x-w,z-w]]),concrete);
  const edge=new THREE.Mesh(quads(THREE,[[-x,-z,x,-z+w],[-x,z-w,x,z],[-x,-z+w,-x+w,z-w],[x-w,-z+w,x,z-w]]),stoneMaterial);
  floor.receiveShadow=edge.receiveShadow=true;group.add(floor,edge);context.add(group);pads.push({o,group,d});
 }
 context.remove(ground,grid);ground.geometry.dispose();ground.material.dispose();grid.geometry.dispose();
 for(const m of Array.isArray(grid.material)?grid.material:[grid.material])m.dispose();
 const sync=()=>{for(const p of pads)p.group.visible=p.o.group.visible;requestRender();};
 window.__KAOPU_TRIAL__.setContextHook(sync);sync();
 const record={kind:'small-authored-material-courts',surveyed:false,demDownloaded:false,ground:'KST1 concrete with STONE_STUDY kind-0 border',pads:pads.map(p=>({building:p.o.entry.id,widthM:p.d.width,depthM:p.d.depth,borderM:p.d.border})),plants:{count:0,status:'Private frozen vegetation library not redistributed; no substitute plants'},sourceFunctionBodies:'unchanged',normalHeight:'shading only',footprintFilter:'receiver approximation, not temporal-AA certification'};
 context.userData.provenance=record;window.__KAOPU_TRIAL__.contextProvenance=record;
 return record;
}
