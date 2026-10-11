// Diagnostic-only single-factor controls. Never imported by the production factory.
import {WATER_CHEAP_GLSL} from '../weather-cache/glsl.mjs';
const PERTURB='n=perturb(n,worldP,microGate*uPlasterMicro*(.26*obs+.18*pu)+uGrainHeight*grain);';
const BASE='vec3 base=mix(uPaletteDark,uPaletteLight,.58+.08*obs+.22*pm);base*=.94+uGrainColor*grain;';
const ROUGH='float rough=clamp(.95+.032*(-obs),.86,.997);';
const PLANE='nativeDiagPlaneWorldNormal';
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Diagnostic signature changed: '+a);return s.replace(a,b);};
function replaceBody(source,name,body){
  const signature=new RegExp('\\bvoid\\s+'+name+'\\s*\\('),match=signature.exec(source);
  if(!match)throw Error('Missing diagnostic function '+name);
  const start=source.indexOf('{',match.index);let depth=1,end=start+1;
  for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}
  if(depth)throw Error('Unbalanced diagnostic source '+name);
  return source.slice(0,start+1)+body+source.slice(end-1);
}
export const STRIPE_DIAGNOSTIC_MODES=Object.freeze([
  {id:'wet-native',parent:null,change:'Unmodified wet production materials'},
  {id:'dry-api',parent:'wet-native',change:'Only hood.setWaterEnabled(false); no forced uniform refresh'},
  {id:'dry-shader-bypass',parent:'dry-api',change:'Additionally make nativeApplyWater a no-op on every water-bound material'},
  {id:'dry-no-micro',parent:'dry-shader-bypass',change:'Only remove plaster perturb call, retaining geometry normals and original dry field'},
  {id:'dry-plane-normal',parent:'dry-no-micro',change:'Only replace plaster shading normal with each coat carrier-plane world normal'},
  {id:'dry-constant-base',parent:'dry-plane-normal',change:'Only set plaster base=.48 and roughness=.95, retaining lighting'},
  {id:'unlit-plaster-constant',parent:'dry-constant-base',change:'Only replace plaster output by uniform unlit .55 grey; other geometry stays visible'},
  {id:'water-mask',parent:'wet-native',change:'Diagnostic plaster output is exact V26 water mask, without tone map'},
  {id:'water-components',parent:'water-mask',change:'Exact retained V26 contributions: red=streak*.92, green=broad*verticalGate*.32, blue=lowerDamp*.58'},
  {id:'normal-deviation',parent:'dry-shader-bypass',change:'Diagnostic plaster output is .5+64*(interpolated normal-carrier normal)'},
  {id:'primitive-boundaries',parent:'unlit-plaster-constant',change:'Diagnostic barycentric edges plus unique per-triangle colours, exact original positions'},
]);

export function stripeDiagnosticFragment(original,mode,{plaster=false,water=false}={}){
  if(!STRIPE_DIAGNOSTIC_MODES.some(m=>m.id===mode))throw Error('Unknown stripe diagnostic mode');
  let shader=original;
  const bypass=!['wet-native','dry-api','water-mask','water-components'].includes(mode);
  if(water&&bypass)shader=replaceBody(shader,'nativeApplyWater','/* QA hard water bypass */');
  if(!plaster||mode==='wet-native'||mode==='dry-api'||mode==='dry-shader-bypass')return shader;
  if(['dry-no-micro','dry-plane-normal','dry-constant-base','unlit-plaster-constant'].includes(mode))shader=once(shader,PERTURB,'/* QA no micro-normal perturbation */');
  if(['dry-plane-normal','dry-constant-base','normal-deviation'].includes(mode))shader=once(shader,'precision highp float;','precision highp float;uniform vec3 '+PLANE+';');
  if(['dry-plane-normal','dry-constant-base'].includes(mode))shader=once(shader,'/* QA no micro-normal perturbation */','n=normalize('+PLANE+');');
  if(mode==='dry-constant-base'){
    shader=once(shader,BASE,'vec3 base=vec3(.48);');
    shader=once(shader,ROUGH,'float rough=.95;');
  }
  if(mode==='unlit-plaster-constant')shader=replaceBody(shader,'main','frag=vec4(vec3(.55),1.);');
  if(mode==='normal-deviation')shader=replaceBody(shader,'main','frag=vec4(vec3(.5)+64.*(normalize(vWorldNormal)-normalize('+PLANE+')),1.);');
  if(mode==='water-mask'){
    if(!water)throw Error('Water-mask diagnostic requires the actual V26 receiver binding');
    shader=replaceBody(shader,'main','float mask=w26WaterAtReceiverWithLow(vReceiverPosition,vNativeMaterialState);frag=vec4(vec3(mask),1.);');
  }
  if(mode==='water-components'){
    if(!water)throw Error('Water-components diagnostic requires the actual V26 receiver binding');
    const components=once(once(WATER_CHEAP_GLSL,'float waterMaskFromCached(','vec3 nativeDiagWaterContributions('),'return waterMask;','return vec3(streak*.92,broad*verticalGate*.32,lowerDamp*.58);');
    shader=once(shader,'void main(){',components+'\nvoid main(){');
    shader=replaceBody(shader,'main','vec3 parent=w26ReceiverToParent*(vReceiverPosition-w26ParentOriginMetres);vec3 parts=nativeDiagWaterContributions(parent/w26FieldScaleMetres,w26ParentNormal,parent,w26FullDimensionsMetres,w26WaterSeed,vNativeMaterialState);frag=vec4(parts,1.);');
  }
  return shader;
}

const primitiveVertex=`precision highp float;
uniform mat4 modelMatrix;uniform mat4 uViewProj;
in vec3 position;in vec3 nativeDiagBarycentric;in float nativeDiagPrimitive;
out vec3 diagBarycentric;flat out float diagPrimitive;
void main(){diagBarycentric=nativeDiagBarycentric;diagPrimitive=nativeDiagPrimitive;gl_Position=uViewProj*modelMatrix*vec4(position,1.);}`;
const primitiveFragment=`precision highp float;
in vec3 diagBarycentric;flat in float diagPrimitive;out vec4 frag;
void main(){vec3 width=fwidth(diagBarycentric);vec3 edge=smoothstep(vec3(0.),width*1.05,diagBarycentric);float inside=min(edge.x,min(edge.y,edge.z));vec3 color=.3+.65*fract(vec3(.6180339,.4142135,.7320508)*(diagPrimitive+1.));frag=vec4(mix(vec3(0.),color,inside),1.);}`;

export function makePrimitiveDiagnosticGeometry(THREE,source,{maxBytes=64*1024*1024}={}){
  const count=source.index?source.index.count:source.attributes.position.count;
  if(count%3)throw Error('Triangle source required');
  const bytes=count*28;
  if(bytes>maxBytes)throw Error('Primitive diagnostic exceeds explicit transient-byte budget');
  const positions=new Float32Array(count*3),barycentric=new Float32Array(count*3),primitive=new Float32Array(count),p=source.attributes.position;
  for(let i=0;i<count;i++){
    const vertex=source.index?source.index.getX(i):i;
    positions.set([p.getX(vertex),p.getY(vertex),p.getZ(vertex)],i*3);
    barycentric[i*3+i%3]=1;primitive[i]=Math.floor(i/3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('nativeDiagBarycentric',new THREE.BufferAttribute(barycentric,3));
  geometry.setAttribute('nativeDiagPrimitive',new THREE.BufferAttribute(primitive,1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return {geometry,bytes,triangles:count/3};
}

function difference(a,b){let changed=0,total=0,max=0;for(let i=0;i<a.length;i+=4){let any=false;for(let k=0;k<3;k++){const d=Math.abs(a[i+k]-b[i+k]);total+=d;max=Math.max(max,d);any ||= d!==0;}if(any)changed++;}return {changedPixels:changed,maxChannelDifference:max,meanAbsoluteChannelDifference:total/(a.length/4*3)};}
const sameArray=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

/** Call immediately after the host's open borrowed-door shot. The host keeps its
 * exact camera, visibility, clock, doors and lights. No browser or RAF is created.
 * The final restored-wet frame must equal wet-native before this run can pass.
 */
export async function runPlasterStripeDiagnostics({THREE,renderer,scene,camera,hood,report=async()=>{},frames=2,maxPrimitiveBytes=64*1024*1024}={}){
  if(!THREE||!renderer?.getContext||!scene||!camera||!hood?.setWaterEnabled)throw Error('Supply current host scene, camera, hood and renderer');
  if(!Number.isInteger(frames)||frames<2||frames>3)throw Error('Use two or three completed diagnostic frames');
  const expectedPosition=[-.2,7,-8.6],expectedTarget=[-2.2,6.55,-4.65];
  if(camera.position.distanceTo(new THREE.Vector3(...expectedPosition))>1e-6)throw Error('Run diagnostics at the exact R02 borrowed-door camera');
  const expectedDirection=new THREE.Vector3(...expectedTarget).sub(camera.position).normalize();
  if(camera.getWorldDirection(new THREE.Vector3()).distanceTo(expectedDirection)>1e-6)throw Error('Borrowed-door target changed');
  const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new THREE.Vector2()),materials=new Map(),meshes=[],shots=[],pixelsByMode=new Map();
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const cameraMatrix=[...camera.matrixWorld.elements],projection=[...camera.projectionMatrix.elements];
  const eligible=new Set();scene.traverseVisible(o=>{if(o.isMesh)eligible.add(o);});
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const category=mesh.userData.sourceCategory,plaster=category==='plaster';
    meshes.push({mesh,geometry:mesh.geometry,visible:mesh.visible,matrixWorld:[...mesh.matrixWorld.elements]});
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      if(!material?.isRawShaderMaterial)continue;
      const water=!!material.uniforms?.nativeWaterStrength;
      if(!water&&!plaster)continue;
      if(materials.has(material)){if(plaster)throw Error('Plaster diagnostic expects the existing per-coat materials');continue;}
      materials.set(material,{material,mesh,plaster,water,vertex:material.vertexShader,fragment:material.fragmentShader,waterStrength:material.uniforms.nativeWaterStrength?.value,planePresent:Object.hasOwn(material.uniforms,PLANE),planeUniform:material.uniforms[PLANE]});
    }
  });
  const waterValues=()=>[...materials.values()].filter(r=>r.water).map(r=>({material:r.material.name,mesh:r.mesh.name,value:r.material.uniforms.nativeWaterStrength.value}));
  const initialWater=waterValues(),transient=[];let transientBytes=0;
  const roiDefinitions=[{id:'left-wall',x0:70,x1:274,y:80},{id:'right-wall',x0:520,x1:750,y:200}];
  const samplePixel=(buffer,x,y)=>Array.from(buffer.slice(((size.y-1-y)*size.x+x)*4,((size.y-1-y)*size.x+x)*4+3));
  const raycaster=new THREE.Raycaster(),rayProbes=[];
  const visiblePlaster=[...materials.values()].filter(r=>r.plaster&&eligible.has(r.mesh)).map(r=>r.mesh);
  for(const roi of roiDefinitions)for(let x=roi.x0;x<=roi.x1;x+=8){
    raycaster.setFromCamera(new THREE.Vector2((x+.5)/size.x*2-1,1-(roi.y+.5)/size.y*2),camera);
    const hit=raycaster.intersectObjects(visiblePlaster,false)[0];if(!hit)continue;
    const local=hit.object.worldToLocal(hit.point.clone()),g=hit.object.geometry,face=hit.face;
    const a=new THREE.Vector3().fromBufferAttribute(g.attributes.position,face.a),b=new THREE.Vector3().fromBufferAttribute(g.attributes.position,face.b),c=new THREE.Vector3().fromBufferAttribute(g.attributes.position,face.c);
    const bary=THREE.Triangle.getBarycoord(local,a,b,c,new THREE.Vector3());
    const state=g.attributes.nativeMaterialState;
    const low=[0,1].map(k=>[face.a,face.b,face.c].reduce((s,index,j)=>s+state.array[index*2+k]*bary.getComponent(j),0));
    rayProbes.push({pixel:[x,roi.y],mesh:hit.object.name,wallId:hit.object.userData.wallId,faceIndex:hit.faceIndex,vertexIndices:[face.a,face.b,face.c],barycentric:bary.toArray(),worldPoint:hit.point.toArray(),localPoint:local.toArray(),interpolatedWorldNormal:hit.normal.clone().transformDirection(hit.object.matrixWorld).toArray(),cachedLow:low});
  }
  function setShader(material,vertex,fragment){if(material.vertexShader!==vertex||material.fragmentShader!==fragment){material.vertexShader=vertex;material.fragmentShader=fragment;material.needsUpdate=true;}}
  function restoreGeometry(){for(const r of meshes){r.mesh.geometry=r.geometry;r.mesh.visible=r.visible;}}
  function restoreMaterials(){for(const r of materials.values()){setShader(r.material,r.vertex,r.fragment);if(r.water)r.material.uniforms.nativeWaterStrength.value=r.waterStrength;if(r.planePresent)r.material.uniforms[PLANE]=r.planeUniform;else delete r.material.uniforms[PLANE];}}
  async function capture(mode){
    const times=[];let buffer;
    for(let frame=0;frame<frames;frame++){
      if(!sameArray(camera.matrixWorld.elements,cameraMatrix)||!sameArray(camera.projectionMatrix.elements,projection))throw Error('Camera moved during stripe controls');
      for(const r of meshes)if(!sameArray(r.mesh.matrixWorld.elements,r.matrixWorld))throw Error('Geometry transform moved during stripe controls: '+r.mesh.name);
      const t=performance.now();renderer.render(scene,camera);buffer=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,buffer);
      const error=gl.getError();times.push({frame,completedMs:performance.now()-t,glError:error,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});if(error)throw Error('Stripe control GL error '+error);
    }
    pixelsByMode.set(mode,buffer);
    const scanlines=roiDefinitions.map(roi=>({...roi,rgb:Array.from({length:roi.x1-roi.x0+1},(_,i)=>samplePixel(buffer,roi.x0+i,roi.y))}));
    const shot={name:'plaster-stripe-'+mode,position:[...camera.position.toArray()],cameraMatrix,projection,times,scanlines,waterUniforms:waterValues(),png:renderer.domElement.toDataURL()};
    shots.push(shot);await report({stage:'shot',...shot});
  }
  try{
    for(const {id:mode} of STRIPE_DIAGNOSTIC_MODES){
      restoreGeometry();
      hood.setWaterEnabled(['wet-native','water-mask','water-components'].includes(mode));
      for(const r of materials.values()){
        const shader=stripeDiagnosticFragment(r.fragment,mode,r);
        if(r.plaster){
          const face=r.mesh.userData.plasterProof?.faces?.[0];if(face!==1&&face!==-1)throw Error('Missing fixed coat plane');
          r.material.uniforms[PLANE]={value:new THREE.Vector3(0,0,face).transformDirection(r.mesh.matrixWorld)};
        }
        setShader(r.material,r.vertex,shader);
      }
      if(mode==='primitive-boundaries'){
        for(const r of materials.values())if(r.plaster){
          if(!eligible.has(r.mesh)||!frustum.intersectsObject(r.mesh)){r.mesh.visible=false;continue;}
          const d=makePrimitiveDiagnosticGeometry(THREE,r.mesh.geometry,{maxBytes:maxPrimitiveBytes-transientBytes});
          transient.push(d.geometry);transientBytes+=d.bytes;r.mesh.geometry=d.geometry;
          setShader(r.material,primitiveVertex,primitiveFragment);
        }
      }
      await capture(mode);
    }
    restoreGeometry();restoreMaterials();hood.setWaterEnabled(true);await capture('restored-wet');
    const comparisons={
      wetVersusDry:difference(pixelsByMode.get('wet-native'),pixelsByMode.get('dry-api')),
      apiDryVersusShaderBypass:difference(pixelsByMode.get('dry-api'),pixelsByMode.get('dry-shader-bypass')),
      restoredWetVersusOriginal:difference(pixelsByMode.get('wet-native'),pixelsByMode.get('restored-wet')),
    };
    for(const item of STRIPE_DIAGNOSTIC_MODES.filter(m=>m.parent))comparisons[item.parent+'__'+item.id]=difference(pixelsByMode.get(item.parent),pixelsByMode.get(item.id));
    if(comparisons.restoredWetVersusOriginal.changedPixels)throw Error('Stripe diagnostic did not restore bit-identical wet scene');
    return {modes:STRIPE_DIAGNOSTIC_MODES,shots,comparisons,initialWater,rayProbes,roiDefinitions,transientPrimitiveBytes:transientBytes,maxPrimitiveBytes,geometryTopologyChangedOnlyForDiagnosticBarycentrics:true,mainSourcesChanged:false,cameraAndTransformsLocked:true,visualAcceptance:false};
  }finally{
    restoreGeometry();restoreMaterials();for(const geometry of transient)geometry.dispose();
  }
}
