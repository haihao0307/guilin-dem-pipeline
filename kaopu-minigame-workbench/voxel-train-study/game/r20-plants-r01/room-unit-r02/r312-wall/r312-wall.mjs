import {original} from './original-shaders.mjs';
import {fragmentShader} from './adapter-shaders.mjs';
export {original} from './original-shaders.mjs';
export const DEFAULTS=Object.freeze({seed:312,activeCourse:43,materialFamily:0,rockType:0,coreOffset:-.006,coreRelief:.012,coreMicro:.0014,soilColor:1.10,layerOut:[0,.006,.011,.016,.021],layerReveal:[0,.022,.048,.078,.112],layerColors:['#82502a','#9a6638','#b28758','#d0b88e','#e0d3b5'],plasterCenter:[.68,1.58],plasterSize:[1.30,1.00],plasterRelief:.005,plasterMicro:.001,showPlaster:true,bindingMode:'legacy',proxyCulling:'double',door:null,mode:'wall'});
export function validateOptions(input={}){
 const p={...DEFAULTS,...input};
 for(const [k,min,max] of [['activeCourse',1,43],['materialFamily',0,3],['rockType',0,7],['seed',0,65535]])if(!Number.isInteger(p[k])||p[k]<min||p[k]>max)throw Error('R3.12 invalid '+k);
 for(const [k,min,max]of [['coreOffset',-.018,.028],['coreRelief',0,.03],['coreMicro',0,.003],['soilColor',0,2],['plasterRelief',0,.014],['plasterMicro',0,.003]])if(!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error('R3.12 out-of-source-range '+k);
 if(!['double','adaptive'].includes(p.proxyCulling))throw Error('Invalid proxyCulling');
 if(!['legacy','declared'].includes(p.bindingMode))throw Error('Explicit binding mode required');
 if(!['wall','bricks','soil','mother'].includes(p.mode))throw Error('Invalid mode');
 for(const [k,n]of [['layerOut',5],['layerReveal',5],['layerColors',5],['plasterCenter',2],['plasterSize',2]])if(!Array.isArray(p[k])||p[k].length!==n)throw Error('Invalid '+k);
 for(const x of p.layerOut)if(!Number.isFinite(x)||x<0||x>.028)throw Error('Invalid layerOut');
 for(const x of p.layerReveal)if(!Number.isFinite(x)||x<0||x>.18)throw Error('Invalid layerReveal');
 for(const x of p.layerColors)if(!/^#[0-9a-f]{6}$/i.test(x))throw Error('Invalid layerColor');
 if(p.door){const d={x:0,bottom:0,width:.9,height:2.05,...p.door};if(!Object.values(d).every(Number.isFinite)||d.width<=0||d.height<=0||Math.abs(d.x)+d.width/2>=1.95||d.bottom<0||d.bottom+d.height>2.85)throw Error('Door outside declared original wall domain');p.door=d;}
 if(p.width!==undefined&&p.width!==4||p.thickness!==undefined&&p.thickness!==.48923)throw Error('R3.12 first adapter retains original 4 m width and .48923 m masonry thickness; do not scale silently');
 return p;
}
const linearHex=h=>[1,3,5].map(i=>Math.pow(parseInt(h.slice(i,i+2),16)/255,2.2));
const noVersion=s=>s.replace(/^#version 300 es\n/,'');
export function createR312Wall({THREE,...input}={}){
 if(!THREE?.RawShaderMaterial)throw Error('Supply existing THREE; adapter does not load dependencies');
 const p=validateOptions(input),group=new THREE.Group();group.name='R3.12 original field wall';
 const materials=[],geometries=[],meshes=[],proxies=[];
 const proof={sourceSha256:original.sourceSha256,sourceVersion:'3.12',motherKernel:'R2.14.8.1',bindingMode:p.bindingMode,sourceFunctionsPreserved:true,originalLighting:true,geometryOpeningAdapter:!!p.door,proxyCulling:p.proxyCulling,proxySideSwitches:0,proxyFallbackUpdates:0,proxySides:{},hookCalls:0,shaderCompiles:0,gpuVerified:false,limitations:['Original finite tracing tolerances retained','No shadow-map SDF depth adapter','No physics mesh/collision or raycast adapter','No non-unit scaling','Original lighting is wall-local; host-light migration unimplemented']};
 const shared={uViewProj:{value:new THREE.Matrix4()},uCamera:{value:new THREE.Vector3()},uViewDir:{value:new THREE.Vector3()},uOrtho:{value:0},uCameraRight:{value:new THREE.Vector3()},uCameraUp:{value:new THREE.Vector3()}};
 const top=p.activeCourse*.06115+(p.activeCourse-1)*.008822619047619-.01;
 const doorUniforms={r312DoorEnabled:{value:p.door?1:0},r312DoorCenter:{value:new THREE.Vector3(p.door?.x||0,(p.door?.bottom||0)+(p.door?.height||2.05)/2,0)},r312DoorHalf:{value:new THREE.Vector3((p.door?.width||.9)/2,(p.door?.height||2.05)/2,1)}};
 const fullColors=p.layerColors.map(h=>new THREE.Vector3(...linearHex(h)));
 function commonUniforms(){return {...shared,...doorUniforms,uSoilTop:{value:top},uCoreOffset:{value:p.coreOffset},uCoreRelief:{value:p.coreRelief},uCoreMicro:{value:p.coreMicro},uSoilColor:{value:p.soilColor},uLayerOut:{value:[...p.layerOut]},uLayerReveal:{value:[...p.layerReveal]},uLayerColor:{value:fullColors.map(x=>x.clone())},uPlasterCenter:{value:new THREE.Vector2(...p.plasterCenter)},uPlasterHalf:{value:new THREE.Vector2(p.plasterSize[0]/2,p.plasterSize[1]/2)},uPlasterRelief:{value:p.plasterRelief},uPlasterMicro:{value:p.plasterMicro}};}
 function add(kind,count,instanceCount=1,extra={}){
  const uniforms={...commonUniforms(),...extra};
  const mat=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:noVersion(original[kind+'VS']),fragmentShader:noVersion(fragmentShader(kind)),uniforms,side:THREE.DoubleSide,depthTest:true,depthWrite:true,depthFunc:THREE.LessEqualDepth,toneMapped:false});
  mat.name='R312-'+kind+'-'+materials.length;
  if(kind!=='brick')proxies.push({material:mat,kind,center:kind==='soil'?[0,.5*(top+.12),0]:[...p.plasterCenter,-.300],half:kind==='soil'?[2.16,.5*(top+.14),.36]:[p.plasterSize[0]/2+.13,p.plasterSize[1]/2+.13,.105]});mat.onBeforeCompile=()=>{proof.shaderCompiles++;};
  const geo=kind==='brick'?new THREE.InstancedBufferGeometry():new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));if(kind==='brick')geo.instanceCount=instanceCount;geo.setDrawRange(0,count);
  const mesh=new THREE.Mesh(geo,mat);mesh.name=mat.name;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};mesh.onBeforeRender=(_r,_s,camera)=>{updateCamera(camera);proof.hookCalls++;};
  group.add(mesh);meshes.push(mesh);materials.push(mat);geometries.push(geo);return mat;
 }
 if(p.mode==='mother'||p.mode==='wall'||p.mode==='bricks'){
  const counts=p.mode==='mother'?[1,0,0]:[Math.ceil(p.activeCourse/2)*34+Math.floor(p.activeCourse/2)*32,Math.floor(p.activeCourse/2)*2,p.activeCourse===43?32:0];
  counts.forEach((n,b)=>{if(n)add('brick',6,n,{uMotherMode:{value:p.mode==='mother'?1:0},uBuiltCourses:{value:p.activeCourse},uBatch:{value:b},uSessionSeed:{value:p.seed},uVariation:{value:p.mode==='mother'?0:.82},uMaterialFamily:{value:p.materialFamily},uRockType:{value:p.rockType}});});
 }
 if(p.mode==='wall'||p.mode==='soil'){
  if(p.bindingMode==='legacy')for(let i=0;i<5;i++)add('soil',36,1,{uLayerOut:{value:[p.layerOut[i],0,0,0,0]},uLayerReveal:{value:[p.layerReveal[i],0,0,0,0]},uLayerColor:{value:[fullColors[i].clone(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]}});
  else add('soil',36);
 }
 if(p.mode==='wall'&&p.showPlaster)add('plaster',36,1,p.bindingMode==='legacy'?{uLayerOut:{value:[0,0,0,0,0]},uLayerReveal:{value:[0,0,0,0,0]}}:{});
 const inv=new THREE.Matrix4(),viewProj=new THREE.Matrix4(),cp=new THREE.Vector3(),cd=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3();
 function updateCamera(camera){
  if(!camera)throw Error('Existing host camera required');group.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
  const e=group.matrixWorld.elements,a=[Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10])];if(a.some(x=>Math.abs(x-1)>1e-5))throw Error('R3.12 adapter requires rigid metre-preserving transform');
  inv.copy(group.matrixWorld).invert();viewProj.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);shared.uViewProj.value.multiplyMatrices(viewProj,group.matrixWorld);
  camera.getWorldPosition(cp);shared.uCamera.value.copy(cp.applyMatrix4(inv));camera.getWorldDirection(cd);shared.uViewDir.value.copy(cd.transformDirection(inv));shared.uOrtho.value=camera.isOrthographicCamera?1:0;
  if(p.proxyCulling==='adaptive')for(const proxy of proxies){
   const decision=selectProxyFace({cameraLocal:shared.uCamera.value.toArray(),center:proxy.center,half:proxy.half,localToView:new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,group.matrixWorld).elements,near:camera.near});
   const side=decision==='entry'?THREE.FrontSide:decision==='exit'?THREE.BackSide:THREE.DoubleSide;
   if(proxy.material.side!==side){proxy.material.side=side;proxy.material.needsUpdate=true;proof.proxySideSwitches++;}
   proof.proxySides[proxy.material.name]=decision;if(decision==='double')proof.proxyFallbackUpdates++;
  }
  right.setFromMatrixColumn(camera.matrixWorld,0).transformDirection(inv);up.setFromMatrixColumn(camera.matrixWorld,1).transformDirection(inv);shared.uCameraRight.value.copy(right);shared.uCameraUp.value.copy(up);
 }
 return {group,materials,meshes,proof,parameters:p,updateCamera,setCamera:updateCamera,dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.removeFromParent();}};
}

// Original BOX_I has outward CCW winding. Clip-plane overlap is deliberately
// conservative: entry-only coverage is unsafe if the near plane cuts the proxy.
export function selectProxyFace({cameraLocal,center,half,localToView,near}){
 const eps=1e-5;
 const inside=cameraLocal.every((v,i)=>Math.abs(v-center[i])<half[i]-eps);
 let minDepth=Infinity,maxDepth=-Infinity;
 for(let mask=0;mask<8;mask++){
  const q=center.map((v,i)=>v+((mask>>i)&1?1:-1)*half[i]),e=localToView;
  const depth=-(e[2]*q[0]+e[6]*q[1]+e[10]*q[2]+e[14]);
  minDepth=Math.min(minDepth,depth);maxDepth=Math.max(maxDepth,depth);
 }
 if(inside)return 'exit';
 if(minDepth<=near+eps&&maxDepth>=near-eps)return 'double';
 if(cameraLocal.some((v,i)=>Math.abs(Math.abs(v-center[i])-half[i])<=eps))return 'double';
 return inside?'exit':'entry';
}
