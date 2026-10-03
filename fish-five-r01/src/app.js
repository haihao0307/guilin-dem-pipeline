import {mountProductionContext} from './production-context-r09.js';
import {cancelPendingAssets,loadPhase} from './asset-reader-r06.js';
import {createOcularBatch,deformInto} from './ocular-batch-r07.js';
import * as MotionCycle from './motion-cycle-r05.js';
import {createBarracudaModule} from './barracuda-adapter.js';
import {createSourceLoader} from './source-loader.js';
import {mountSpecimenCatalog} from './specimen-catalog.js';
import * as Ocular from './ocular-r04.js';
import * as Oral from './oral-r04.js';
import oralMetadata from '../data/oral-runtime-r04.json';
import * as THREE from '../vendor/three.module.js';
const Behavior=globalThis.FishBehavior,$=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const manifest=JSON.parse($('manifest').textContent),items=manifest.items;
const LABELS={barracuda:['海狼鱼','R14 · 原连续脊椎、独立鱼鳍与海底鱼群'],herring:['鲱鱼','HERRING · 原群游模型中的单鱼'],'tuna-yellow-label':['黄鳍标签金枪鱼','TUNA FISH · 保留源文件夹名称'],'tuna-blue-label':['蓝鳍标签金枪鱼','ANIMATED TUNA · 具体物种待核实'],colorful:['彩色珊瑚鱼','COLORFULL FISH · 保留源色与形态'],picasso:['毕加索标签鱼','PICASSO FISH · 素材标签，生物身份待核实']};
const state={selected:'barracuda',group:true,mode:'cruise',playing:true,bones:false,reference:false,time:0,frames:0,loaded:false,loading:false,orbit:{yaw:0,pitch:.10,distance:2.15},pointer:null};
const production=mountProductionContext({getFishId:()=>state.selected,labels:LABELS});
const cycle=MotionCycle.create();
function refreshModes(){document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));$('automatic').classList.toggle('active',cycle.automatic);$('automatic').setAttribute('aria-pressed',String(cycle.automatic));}
const barracuda=createBarracudaModule($('stage'));
const sourceLoader=createSourceLoader(),textureCache=new Map(),scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0b2838,.027);
const canvas=$('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const camera=new THREE.PerspectiveCamera(36,1,.01,80),target=new THREE.Vector3();scene.add(new THREE.HemisphereLight(0xc0edf1,0x123642,2));const key=new THREE.DirectionalLight(0xe1f1e6,2.6);key.position.set(-1,4,3);scene.add(key);const rim=new THREE.DirectionalLight(0x719db9,1.6);rim.position.set(1,1,-3);scene.add(rim);
// Neutral procedural illumination, no invented fish surface details or external HDR.
const lightScene=new THREE.Scene(),lightGeo=new THREE.SphereGeometry(10,32,16),lightMat=new THREE.ShaderMaterial({side:THREE.BackSide,vertexShader:'varying vec3 sky;void main(){sky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 sky;void main(){vec3 d=normalize(sky);vec3 c=mix(vec3(.12,.15,.18),vec3(.65,.72,.76),smoothstep(-.4,.8,d.y));float key=pow(max(0.,dot(d,normalize(vec3(-.4,.8,.5)))),18.);gl_FragColor=vec4(c+vec3(2.0)*key,1.);}' });lightScene.add(new THREE.Mesh(lightGeo,lightMat));const pmrem=new THREE.PMREMGenerator(renderer),envTarget=pmrem.fromScene(lightScene,.08);scene.environment=envTarget.texture;scene.environmentIntensity=.65;pmrem.dispose();lightGeo.dispose();lightMat.dispose();
const specimens=new THREE.Group();scene.add(specimens);let score=null,behavior=null,poseTex=null,finTex=null,bodyMeshes=[],eyes=[],boneLines=null,sourceMeshes=[],generation=0,ocularBatch=null,finBindings=[],posesDirty=true,posesBones=null,posesReference=null;
const PALETTE={herring:0x799193,'tuna-yellow-label':0xa5a373,'tuna-blue-label':0x859396,colorful:0x9d954e,picasso:0xb59d67};
// Analytic orthonormal spine transport. Same source address -> same transform.
const DEFORM_GLSL=`
uniform sampler2D fishPose; uniform sampler2D fishFinAngles; uniform float fishCount;
uniform vec3 finRoots[16]; uniform vec3 finAxes[16];
attribute float actorAddress; attribute vec2 finInfo; attribute vec3 finGradient;
attribute float oralWeight; attribute vec3 oralGradient; uniform vec3 oralPivot,oralAxis;
float jawAngle(){return texture2D(fishFinAngles,vec2(.5/16.0,(actorAddress+.5)/fishCount)).x;}
vec3 rotateAxis(vec3 p,vec3 a,float angle){float L=length(a);if(L<0.000001||abs(angle)<0.0000001)return p;vec3 n=a/L;float c=cos(angle),s=sin(angle);return p*c+cross(n,p)*s+n*dot(n,p)*(1.0-c);}
vec4 poseAt(float index,float row){return texture2D(fishPose,vec2((index+.5)/65.0,(actorAddress*2.0+row+.5)/(fishCount*2.0)));}
void spineAt(float x,out vec3 c,out vec3 side){float u=clamp(x+.5,0.0,1.0)*64.0;float a=floor(u),b=min(a+1.0,64.0);c=mix(poseAt(a,0.0).xyz,poseAt(b,0.0).xyz,fract(u));side=normalize(mix(poseAt(a,1.0).xyz,poseAt(b,1.0).xyz,fract(u)));vec3 tangent=vec3(side.z,0.0,-side.x);c+=tangent*(x-clamp(x,-.5,.5));}
float finAngle(vec3 p){int id=int(finInfo.x+.5);if(id<=0)return 0.0;vec4 v=texture2D(fishFinAngles,vec2((float(id)+.5)/16.0,(actorAddress+.5)/fishCount));return (v.x*sin(v.y+v.z*(p.x-finRoots[id].x))+v.w)*finInfo.y;}
vec3 oralPoint(vec3 p){float a=jawAngle();return p+oralWeight*(oralPivot+rotateAxis(p-oralPivot,oralAxis,a)-p);}
void oralJacobian(vec3 p,out vec3 X,out vec3 Y,out vec3 Z){float a=jawAngle();vec3 d=oralPivot+rotateAxis(p-oralPivot,oralAxis,a)-p;X=mix(vec3(1,0,0),rotateAxis(vec3(1,0,0),oralAxis,a),oralWeight)+d*oralGradient.x;Y=mix(vec3(0,1,0),rotateAxis(vec3(0,1,0),oralAxis,a),oralWeight)+d*oralGradient.y;Z=mix(vec3(0,0,1),rotateAxis(vec3(0,0,1),oralAxis,a),oralWeight)+d*oralGradient.z;}
// Source material address stays attached to its original spine section.
vec3 finPoint(vec3 p){int id=int(finInfo.x+.5);return id>0?finRoots[id]+rotateAxis(p-finRoots[id],finAxes[id],finAngle(p)):p;}
vec3 fishLocal(vec3 p){vec3 q=finPoint(oralPoint(p)),c,s;spineAt(p.x,c,s);vec3 t=vec3(s.z,0.,-s.x);return c+t*(q.x-p.x)+vec3(0.,q.y,0.)+s*q.z;}
vec3 fishNormal(vec3 p,vec3 n){
 vec3 q=finPoint(oralPoint(p)),Jx,Jy,Jz;oralJacobian(p,Jx,Jy,Jz);int id=int(finInfo.x+.5);
 if(id>0&&length(finAxes[id])>.000001){vec3 a=normalize(finAxes[id]);float angle=finAngle(p);vec4 w=texture2D(fishFinAngles,vec2((float(id)+.5)/16.,(actorAddress+.5)/fishCount));float phase=w.y+w.z*(p.x-finRoots[id].x),base=w.x*sin(phase)+w.w;vec3 da=base*finGradient+vec3(finInfo.y*w.x*w.z*cos(phase),0,0),angular=cross(a,q-finRoots[id]);Jx=rotateAxis(Jx,a,angle)+angular*da.x;Jy=rotateAxis(Jy,a,angle)+angular*da.y;Jz=rotateAxis(Jz,a,angle)+angular*da.z;}
 vec3 c,s,ca,sa,cb,sb;spineAt(p.x,c,s);spineAt(p.x-.0001,ca,sa);spineAt(p.x+.0001,cb,sb);vec3 t=vec3(s.z,0,-s.x),dt=vec3(sb.z-sa.z,0,-sb.x+sa.x)/.0002,ds=(sb-sa)/.0002,dc=(cb-ca)/.0002;
 vec3 extra=dc-t+dt*(q.x-p.x)+ds*q.z;
 vec3 X=t*Jx.x+vec3(0,Jx.y,0)+s*Jx.z+extra,Y=t*Jy.x+vec3(0,Jy.y,0)+s*Jy.z,Z=t*Jz.x+vec3(0,Jz.y,0)+s*Jz.z;
 vec3 nn=n.x*cross(Y,Z)+n.y*cross(Z,X)+n.z*cross(X,Y);float L=length(nn);return L>.000001?nn/L:normalize(n);
}
`;
function canonicalFinKind(fin){const name=String(fin.kind||fin.name||'').toLowerCase();if(/caud|tail|尾/.test(name))return 'caudal';if(/anal|臀/.test(name))return 'anal';if(/dors|背/.test(name))return 'dorsal';if(/pelv|腹/.test(name))return 'pelvic';if(/right|右|neg/.test(name))return 'pectoralRight';return 'pectoralLeft';}
async function unpack(id){return sourceLoader.load(id);}
function imageURI(image){return typeof image==='string'?image:image.uri||image.dataURI||image.dataUri||image.src;}
function destroyTextureSet(textures){for(const texture of textures)texture.dispose();textures.length=0;}
function releaseTextureId(id){const entry=textureCache.get(id);if(entry){entry.cancelled=true;destroyTextureSet(entry.textures);textureCache.delete(id);}}
function releaseTexturesExcept(id){for(const key of textureCache.keys())if(key!==id)releaseTextureId(key);}
async function createTextures(data,owner){
 let entry=textureCache.get(data.id);
 if(!entry){
  entry={textures:[],owners:new Set(),cancelled:false,promise:null};textureCache.set(data.id,entry);
  entry.promise=Promise.all((data.images||data.textures||[]).map(async im=>{
   let uri,objectURL=null;
   if((im?.encodedBytes||im?.bytes) instanceof Uint8Array){objectURL=URL.createObjectURL(new Blob([im.encodedBytes||im.bytes],{type:im.mimeType||im.mime||'application/octet-stream'}));uri=objectURL;}
   else{uri=imageURI(im);if(!uri?.startsWith('data:'))throw Error('原贴图必须内嵌');}
   const image=new Image();image.decoding='async';
   try{await new Promise((resolve,reject)=>{image.onload=()=>{image.onload=image.onerror=null;resolve();};image.onerror=()=>{image.onload=image.onerror=null;reject(Error('源贴图解码失败'));};image.src=uri;});}
   finally{if(objectURL)URL.revokeObjectURL(objectURL);}
   if(entry.cancelled)throw Error('已释放过期源贴图');
   const tex=new THREE.Texture(image);tex.needsUpdate=true;tex.flipY=false;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();entry.textures.push(tex);return tex;
  })).catch(error=>{entry.cancelled=true;destroyTextureSet(entry.textures);if(textureCache.get(data.id)===entry)textureCache.delete(data.id);throw error;});
 }
 entry.owners.add(owner);try{return await entry.promise;}finally{entry.owners.delete(owner);}
}
const textureDescriptors=new WeakMap();
function materialFor(data,index,textures,finUniforms,deform=true){
 const m=data.materials[index]||{},pbr=m.pbrMetallicRoughness||{},color=pbr.baseColorFactor||[1,1,1,1],ex=m.extensions||{},unlit=!!ex.KHR_materials_unlit;
 const params={color:new THREE.Color(...color.slice(0,3)),side:m.doubleSided?THREE.DoubleSide:THREE.FrontSide,transparent:m.alphaMode==='BLEND',opacity:color[3]??1,alphaTest:m.alphaMode==='MASK'?(m.alphaCutoff??.5):0};
 const getTexture=(desc,srgb=false)=>{
  if(!desc)return null;let idx=desc.index;const decl=data.textureDefinitions?.[idx]||data.gltfTextures?.[idx];if(decl)idx=decl.source;
  const tr=desc.extensions?.KHR_texture_transform,offset=tr?.offset||[0,0],repeat=tr?.scale||[1,1],rotation=tr?.rotation||0,channel=tr?.texCoord??(desc.texCoord||0);
  const key=JSON.stringify([idx,srgb,channel,offset,repeat,rotation]);let cache=textureDescriptors.get(textures);if(!cache){cache=new Map();textureDescriptors.set(textures,cache);}if(cache.has(key))return cache.get(key);
  const t=textures[idx]?.clone();if(!t)throw Error('源材质贴图索引不存在');t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.channel=channel;
  if(tr){t.offset.fromArray(offset);t.repeat.fromArray(repeat);t.rotation=rotation;}t.needsUpdate=true;cache.set(key,t);t.addEventListener('dispose',()=>{if(cache.get(key)===t)cache.delete(key);});return t;
 };
 params.map=getTexture(pbr.baseColorTexture,true);
 if(!unlit){params.roughness=pbr.roughnessFactor??1;params.metalness=pbr.metallicFactor??1;params.normalMap=getTexture(m.normalTexture);if(m.normalTexture)params.normalScale=new THREE.Vector2(m.normalTexture.scale??1,m.normalTexture.scale??1);params.roughnessMap=getTexture(pbr.metallicRoughnessTexture);params.metalnessMap=params.roughnessMap;params.aoMap=getTexture(m.occlusionTexture);params.aoMapIntensity=m.occlusionTexture?.strength??1;params.emissiveMap=getTexture(m.emissiveTexture,true);params.emissive=new THREE.Color(...(m.emissiveFactor||[0,0,0]));params.emissiveIntensity=ex.KHR_materials_emissive_strength?.emissiveStrength??1;if(ex.KHR_materials_specular){const spec=ex.KHR_materials_specular;params.specularIntensity=spec.specularFactor??1;params.specularColor=new THREE.Color(...(spec.specularColorFactor||[1,1,1]));params.specularIntensityMap=getTexture(spec.specularTexture);params.specularColorMap=getTexture(spec.specularColorTexture,true);}}
 const mat=unlit?new THREE.MeshBasicMaterial(params):ex.KHR_materials_specular?new THREE.MeshPhysicalMaterial(params):new THREE.MeshStandardMaterial(params);
 mat.userData.sourceMaterial={index,name:m.name,unlit,specularFactor:ex.KHR_materials_specular?.specularFactor,baseDimensions:params.map?[params.map.image.width,params.map.image.height]:null};
 if(deform){mat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{fishPose:{value:poseTex},fishFinAngles:{value:finTex},fishCount:{value:behavior.actors.length},...finUniforms});shader.vertexShader=DEFORM_GLSL+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal = fishNormal(position, objectNormal);').replace('#include <begin_vertex>','vec3 transformed = fishLocal(position);');mat.userData.shader=shader;};mat.customProgramCacheKey=()=> 'FISH_SOURCE_MATERIAL_ORAL_JACOBIAN_R04';}return mat;
}
function disposeSpecimen(){
 ocularBatch?.dispose();ocularBatch=null;
 const geometries=new Set(),materials=new Set(),textures=new Set();
 specimens.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});
 for(const m of materials){for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','specularIntensityMap','specularColorMap'])if(m[k])textures.add(m[k]);m.dispose();}
 for(const t of textures)t.dispose();for(const g of geometries)g.dispose();
 specimens.clear();bodyMeshes=[];sourceMeshes=[];eyes=[];boneLines=null;finBindings=[];poseTex?.dispose();finTex?.dispose();poseTex=finTex=null;posesDirty=true;
}
function makePoseTextures(count){poseTex=new THREE.DataTexture(new Float32Array(65*2*count*4),65,2*count,THREE.RGBAFormat,THREE.FloatType);poseTex.minFilter=poseTex.magFilter=THREE.NearestFilter;finTex=new THREE.DataTexture(new Float32Array(16*count*4),16,count,THREE.RGBAFormat,THREE.FloatType);finTex.minFilter=finTex.magFilter=THREE.NearestFilter;}
function sourcePositions(p,data){if(data.schema==="FISH_COMPACT_PRODUCT_10"){if(p.paramAddress||p.residual||p.base)throw Error("Compact product must not retain source reconstruction");return p.positions;}const C=data.parameterization.coefficients;if(!C||!p.paramAddress||!p.residual)throw Error('缺少源采样参数函数');const out=new Float32Array(p.positions.length),poly=(c,x)=>c.reduceRight((a,v)=>a*x+v,0);for(let i=0;i<out.length/3;i++){const x=p.paramAddress[i*2]-.5,theta=p.paramAddress[i*2+1],base=[x,poly(C[0],x)+Math.max(Math.abs(poly(C[2],x)),.001)*Math.sin(theta),poly(C[1],x)+Math.max(Math.abs(poly(C[3],x)),.001)*Math.cos(theta)];for(let k=0;k<3;k++)out[i*3+k]=base[k]+p.residual[i*3+k];}return out;}
function makeBody(data,textures){const count=behavior.actors.length,roots=Array.from({length:16},()=>new THREE.Vector3()),axes=Array.from({length:16},()=>new THREE.Vector3());for(const f of data.rig.fins){if(f.id>=16)throw Error('Fin slot exceeds measured rig');roots[f.id].fromArray(f.root);axes[f.id].fromArray(f.axis);}
const oral=oralMetadata.specimens.find(s=>s.id===data.id),rec=oral?.productionRecommendation;
const uniforms={finRoots:{value:roots},finAxes:{value:axes},oralPivot:{value:new THREE.Vector3().fromArray(rec?.pivotCanonical||[0,0,0])},oralAxis:{value:new THREE.Vector3().fromArray(rec?.axisCanonical||[0,0,1])}};data.primitives.forEach((p,primitiveIndex)=>{const geometry=new THREE.BufferGeometry(),positions=sourcePositions(p,data);geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(p.normals instanceof Float32Array?p.normals:Float32Array.from(p.normals),3));geometry.setAttribute('uv',new THREE.BufferAttribute(p.uvs instanceof Float32Array?p.uvs:Float32Array.from(p.uvs),2));geometry.setIndex(new THREE.BufferAttribute(p.indices instanceof Uint32Array?p.indices:Uint32Array.from(p.indices),1));const f=new Float32Array(positions.length/3*2);for(let i=0;i<f.length/2;i++){f[i*2]=p.finId?.[i]||0;f[i*2+1]=p.finWeight?.[i]||0;}geometry.setAttribute('finInfo',new THREE.BufferAttribute(f,2));geometry.setAttribute('finGradient',new THREE.BufferAttribute(p.finGradient instanceof Float32Array?p.finGradient:Float32Array.from(p.finGradient||new Float32Array(positions.length)),3));const oralWeight=new Float32Array(positions.length/3),oralGradient=new Float32Array(positions.length),binding=rec?.bindings.find(b=>b.primitive===primitiveIndex);if(binding){binding.indices.forEach((v,j)=>{oralWeight[v]=binding.constrainedSubtreeWeight[j];oralGradient.set(binding.constrainedGradient.slice(j*3,j*3+3),v*3);});}
geometry.setAttribute('oralWeight',new THREE.BufferAttribute(oralWeight,1));geometry.setAttribute('oralGradient',new THREE.BufferAttribute(oralGradient,3));geometry.setAttribute('actorAddress',new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i),1));geometry.computeBoundingSphere();
const material=materialFor(data,p.material||0,textures,uniforms),mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.name='sampled-fish-'+data.id;mesh.userData.primitive=p;specimens.add(mesh);bodyMeshes.push(mesh);
const ref=new THREE.Mesh(geometry,materialFor(data,p.material||0,textures,uniforms,false));ref.visible=false;ref.name='frozen-source-'+data.id;specimens.add(ref);sourceMeshes.push(ref);
});}
function makeEyes(data){ocularBatch=createOcularBatch({THREE,data,count:behavior.actors.length,palette:PALETTE});eyes=ocularBatch.eyes;for(const batch of ocularBatch.batches)specimens.add(batch);}
function makeBones(){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(4092),3));boneLines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xaff9d8,transparent:true,opacity:.85,depthTest:false}));boneLines.frustumCulled=false;boneLines.visible=state.bones;specimens.add(boneLines);}
let activeFinCount=0,lastReadout='',lastReadoutAt=0;
async function select(id,options={}){
 const stamp=++generation,group=options.group??state.group;state.loading=true;state.requested=id;api.error=null;cancelPendingAssets(id);sourceLoader.cancelPendingExcept(id);globalThis.__FISH_BOOT__?.start(id);
 $('loading').classList.toggle('switching',state.loaded);$('loading').classList.remove('done');$('loadingText').textContent='准备 '+LABELS[id][0]+'…';
 try{
  if(id==='barracuda'){
   await barracuda.mount();if(stamp!==generation)return;
   disposeSpecimen();releaseTexturesExcept(null);sourceLoader.clear();score=null;behavior=null;state.selected=id;state.group=group;barracuda.configure(state);canvas.style.display='none';barracuda.activate(true);
  }else{
   const data=await unpack(id);if(stamp!==generation)return;
   loadPhase(id,'prepare');const textures=await createTextures(data,stamp);if(stamp!==generation){if(state.selected!==id&&state.requested!==id&&!textureCache.get(id)?.owners.size)releaseTextureId(id);return;}
   // Commit only after all asynchronous source work has finished. Earlier
   // requests cannot dispose or overwrite the currently visible specimen.
   barracuda.activate(false);disposeSpecimen();state.selected=id;state.group=group;score=data;
   behavior=Behavior.create(id,group?30:1,2601002);if(!behavior.actors&&behavior.fish)behavior.actors=behavior.fish;
   makePoseTextures(behavior.actors.length);makeBody(data,textures);makeEyes(data);makeBones();
   finBindings=score.rig.fins.map(f=>({f,kind:canonicalFinKind(f),median:score.id==='picasso'&&['dorsal','anal'].includes(canonicalFinKind(f))}));
   headLocal.set(0,0,0);for(const eye of score.eyes){headLocal.x+=eye.center[0];headLocal.y+=eye.center[1];headLocal.z+=eye.center[2];}headLocal.multiplyScalar(1/score.eyes.length);headLocal.x=(headLocal.x-.5)*.5;headPoint[0]=headLocal.x;headPoint[1]=headLocal.y;headPoint[2]=headLocal.z;
   sourceLoader.releaseExcept(id);releaseTexturesExcept(id);
   const measured=eyes[0].objects.map(item=>{const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(item.baseQ).toArray()),optic=item.opticAxis.clone().multiply(new THREE.Vector3().fromArray(item.localRadii)).normalize();return {...item.eye,sourceFrame:{x:axes[0],y:axes[1],normal:axes[2]},opticAxis:optic.toArray()};});
   const rec=oralMetadata.specimens.find(s=>s.id===id)?.productionRecommendation;for(const actor of behavior.actors){actor.ocularR04=Ocular.create(id,2601002,actor.index,measured);actor.oralR04=Oral.create(id,2601002,actor.index,rec?.signedMaxAngleRad||0);}

   activeFinCount=score.rig.fins.filter(f=>score.primitives.some(p=>p.finId.some((value,j)=>value===f.id&&p.finWeight[j]>0))).length;
   state.orbit.distance=group?10:2.15;state.orbit.yaw=0;state.orbit.pitch=.10;state.pointer=null;target.set(0,0,0);
   for(const actor of behavior.actors){target.x+=actor.position[0];target.y+=actor.position[1];target.z+=actor.position[2];}target.multiplyScalar(1/behavior.actors.length);
   updatePoses();canvas.style.display='block';resize();updateCamera(0);renderer.render(scene,camera);
   // The texture cache owns decoded images for shared materials/context restore.
   // Adopted products no longer retain a second encoded image package in JS RAM.
   if(data.schema==='FISH_COMPACT_PRODUCT_10')for(const image of data.textures){delete image.encodedBytes;delete image.uri;}
  }
  updateUI();catalog.setActive(id);state.loaded=true;api.ready=true;state.loading=false;state.requested=null;lastReadout='';frame.last=performance.now();$('loading').classList.add('done');globalThis.__FISH_BOOT__?.ready();
 }catch(error){if(stamp!==generation)return;state.loading=false;console.error(error);$('loadingText').textContent='加载失败：'+error.message;api.error=String(error.stack||error);globalThis.__FISH_BOOT__?.fail(error);}
}
const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),euler=new THREE.Euler(),scale=new THREE.Vector3(1,1,1),actorPosition=new THREE.Vector3(),cameraCenter=new THREE.Vector3(),headLocal=new THREE.Vector3(),headPoint=[0,0,0],bonePoint=new THREE.Vector3(),boneTip=new THREE.Vector3(),behaviorInput={mode:'cruise',pointer:null,centered:false},ocularInput={mode:'cruise',turnRate:0},oralInput={mode:'cruise',effort:0};
function actorMatrix(actor){euler.set(actor.roll||0,actor.yaw||0,-(actor.pitch||0),'YZX');quat.setFromEuler(euler);return matrix.compose(actorPosition.fromArray(actor.position),quat,scale);}
function writeBone(point,m,array,cursor){bonePoint.fromArray(point).applyMatrix4(m);if(cursor+3<=array.length){array[cursor++]=bonePoint.x;array[cursor++]=bonePoint.y;array[cursor++]=bonePoint.z;}return cursor;}
function updatePoses(force=true){
 if(!behavior||!poseTex)return;
 if(!force&&!posesDirty&&posesBones===state.bones&&posesReference===state.reference)return;
 const positions=poseTex.image.data,angles=finTex.image.data,bones=boneLines?.geometry.attributes.position.array;let boneCursor=0;if(bones)bones.fill(0);
 for(let i=0;i<behavior.actors.length;i++){
  const a=behavior.actors[i],s=Behavior.sampleSpine(a,state.selected,65);angles[(i*16)*4]=a.oralR04.output.lower;
  for(let j=0;j<65;j++){let k=(i*130+j)*4;positions.set(s.centers[j],k);positions[k+3]=1;k=(i*130+65+j)*4;positions.set(s.binormals[j],k);positions[k+3]=1;}
  for(const binding of finBindings){const {f,kind,median}=binding,k=(i*16+f.id)*4,wave=a.finWaves?.[kind];angles[k]=wave?.amplitude||0;angles[k+1]=wave?.phase||0;angles[k+2]=median?12:0;angles[k+3]=wave?.bias||0;}
  const m=actorMatrix(a);for(const mesh of bodyMeshes)mesh.setMatrixAt(i,m);
  if(i===0)for(const ref of sourceMeshes){ref.matrixAutoUpdate=false;ref.matrix.copy(m);ref.matrixWorldNeedsUpdate=true;}
  if(eyes[i])ocularBatch.updateActor(eyes[i],a,s,state.selected,Ocular,m);
  if(state.bones&&i===0){
   for(let j=0;j<64;j+=2){boneCursor=writeBone(s.centers[j],m,bones,boneCursor);boneCursor=writeBone(s.centers[j+2],m,bones,boneCursor);}
   for(const f of score.rig.fins){deformInto(bonePoint,f.root,s);deformInto(boneTip,f.tip||f.root,s);bonePoint.applyMatrix4(m);boneTip.applyMatrix4(m);if(boneCursor+6<=bones.length){bones[boneCursor++]=bonePoint.x;bones[boneCursor++]=bonePoint.y;bones[boneCursor++]=bonePoint.z;bones[boneCursor++]=boneTip.x;bones[boneCursor++]=boneTip.y;bones[boneCursor++]=boneTip.z;}}
  }
 }
 for(const mesh of bodyMeshes)mesh.instanceMatrix.needsUpdate=true;
 ocularBatch.flush(!state.reference);poseTex.needsUpdate=true;finTex.needsUpdate=true;
 if(boneLines){boneLines.visible=state.bones&&!state.reference;boneLines.geometry.attributes.position.needsUpdate=true;boneLines.geometry.setDrawRange(0,boneCursor/3);}
 for(const m of bodyMeshes)m.visible=!state.reference&&!m.userData.primitive.ocular&&!/cornea/i.test(m.userData.primitive.name);for(const m of sourceMeshes)m.visible=state.reference;
 posesDirty=false;posesBones=state.bones;posesReference=state.reference;
}
function updateUI(){production.refresh();const id=state.selected;if(id==='barracuda'){$('fishTitle').textContent=LABELS[id][0];$('fishSubtitle').textContent=LABELS[id][1];document.querySelectorAll('.fish-choice').forEach(b=>b.classList.toggle('active',b.dataset.fish===id));$('single').classList.toggle('active',!state.group);$('group').classList.toggle('active',state.group);$('skeleton').classList.toggle('active',state.bones);$('profileInfo').innerHTML='<p class=eyebrow>02 / 海狼鱼制作基线</p><div class=profile-row><span>轻量成品形体</span><span>'+(barracuda.api?.handle.metadata.counts.vertices?.toLocaleString()||'准备中')+' 点</span></div><div class=profile-row><span>独立鱼鳍</span><span>7 组</span></div><div class=profile-row><span>原海底场景</span><span>R14</span></div><p class=note>海狼鱼和新增鱼种共用选择、活动、单鱼与鱼群接口；眼部按原眼窝深度贴合，降低黑圈与金色反差，保留独立扫视；口部保留原姿态；下颌与鳃盖后续需专门校验，避免拉坏源表面。</p>';return;}$('fishTitle').textContent=LABELS[id][0];$('fishSubtitle').textContent=LABELS[id][1];document.querySelectorAll('.fish-choice').forEach(b=>b.classList.toggle('active',b.dataset.fish===id));$('single').classList.toggle('active',!state.group);$('group').classList.toggle('active',state.group);$('skeleton').classList.toggle('active',state.bones);const v=score.primitives.reduce((s,p)=>s+p.positions.length/3,0),t=score.primitives.reduce((s,p)=>s+p.indices.length/3,0);$('profileInfo').innerHTML=`<p class="eyebrow">02 / 当前制作配置</p><div class="profile-row"><strong>离线测量形体</strong><span>${v.toLocaleString()} 点</span></div><div class="profile-row"><span>成品拓扑</span><span>${t.toLocaleString()} 三角</span></div><div class="profile-row"><span>程序脊椎</span><span>连续截面搬运</span></div><div class="profile-row"><span>独立鱼鳍</span><span>${score.rig.fins.filter(f=>score.primitives.some(p=>p.finId.some((id,j)=>id===f.id&&p.finWeight[j]>0))).length} 组</span></div><div class="profile-row"><span>当前视图</span><span>${state.group?'30 条同种':'单条观察'}</span></div>`;const bodyMaterial=bodyMeshes.find(m=>!m.userData.primitive.ocular)?.material.userData.sourceMaterial;const dims=bodyMaterial?.baseDimensions;if(dims)$('profileInfo').insertAdjacentHTML('beforeend',`<div class=profile-row><span>成品身体材质</span><span>${dims[0]} × ${dims[1]}</span></div>${Math.min(...dims)<=512?'<p class=note>原素材细节较少；放大不能恢复不存在的纹理。当前使用离线测量生成的形体与材质成品。</p>':''}`);$('credits').replaceChildren();for(const item of items){const source=item.source||{},extra=source.asset?.extras||{},p=document.createElement('p'),a=document.createElement('a');a.textContent=extra.title||source.title||LABELS[item.id][0];a.href=extra.source||'#';a.target='_blank';a.rel='noopener';a.style.color='#94c1be';p.append(a,document.createTextNode(' — '+(extra.author||'')+' · '));const license=document.createElement('a');license.textContent='CC-BY 4.0';license.href='https://creativecommons.org/licenses/by/4.0/';license.target='_blank';license.rel='noopener';license.style.color='#94c1be';p.append(license,document.createTextNode('。已进行源采样参数化、脊椎／鳍绑定与眼睛适配。'));$('credits').append(p);}}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(w<1||h<1)return;if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
function updateCamera(dt=1/60){const o=state.orbit,c=cameraCenter;
 if(state.group){c.set(0,0,0);for(const a of behavior.actors){c.x+=a.position[0];c.y+=a.position[1];c.z+=a.position[2];}c.multiplyScalar(1/behavior.actors.length);}else c.fromArray(behavior.actors[0].position);
 if(o.detail&&!state.group){deformInto(c,headPoint,Behavior.sampleSpine(behavior.actors[0],state.selected));c.applyMatrix4(actorMatrix(behavior.actors[0]));}
 target.lerp(c,1-Math.exp(-dt*5));const cp=Math.cos(o.pitch),sp=Math.sin(o.pitch),sy=Math.sin(o.yaw),cy=Math.cos(o.yaw);let distance=o.distance*Math.max(1,.96/camera.aspect);
 if(state.group&&o.autoFit!==false){
  const tanV=Math.tan(camera.fov*Math.PI/360),tanH=tanV*camera.aspect;let required=0;
  // A camera framing calculation only: full source envelopes and every member
  // determine the overview. This does not pull fish into a display formation.
  for(const a of behavior.actors){const x=a.position[0]-target.x,y=a.position[1]-target.y,z=a.position[2]-target.z,half=a.half,r=half?Math.hypot(...half):1,depth=x*sy*cp+y*sp+z*cy*cp,right=x*cy-z*sy,up=-x*sy*sp+y*cp-z*cy*sp;required=Math.max(required,depth+r+(Math.abs(right)+r)/tanH,depth+r+(Math.abs(up)+r)/tanV);}
  const fitted=Math.max(distance,required*1.08);o.fitDistance=o.fitDistance===undefined?fitted:o.fitDistance+(fitted-o.fitDistance)*(1-Math.exp(-dt*4));distance=o.fitDistance;
 }
 camera.position.set(target.x+sy*cp*distance,target.y+sp*distance,target.z+cy*cp*distance);camera.lookAt(target);
}
function updateReadout(now){if(now-lastReadoutAt<250)return;lastReadoutAt=now;const legacy=state.selected==='barracuda',a=behavior?.actors[0],html=legacy?'<b>'+ (state.group?'海狼鱼 · 30 条同种群游':'海狼鱼 · 单鱼观察')+'</b><br>'+({'cruise':'巡游','hover':'缓游','burst':'加速','turn':'转向','rest':'静止'})[state.mode]+' · '+(cycle.automatic?'自动轮播':'手动观察')+' · 连续脊椎与海底场景':`<b>${state.group?'同种群体 · 30 个独立状态':'单鱼 · 当前活动'}</b><br>${({'cruise':'巡游','hover':'缓游','burst':'加速','turn':'转向','rest':'静止'})[state.mode]} · ${Number(a?.frequency||0).toFixed(2)} Hz · ${activeFinCount} 组鱼鳍<br>源色／源拓扑保留 · 表面连续传导`;if(html!==lastReadout){$('readout').innerHTML=html;lastReadout=html;}const status=legacy?'海狼 · '+(state.group?'30':'1')+' FISH':`${state.group?30:1} FISH · ${renderer.info.render.triangles.toLocaleString()} TRI`;if($('runtimeStatus').textContent!==status)$('runtimeStatus').textContent=status;}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,Math.max(0,(now-(frame.last||now))/1000));frame.last=now;if(!state.loaded||document.hidden)return;const scheduled=MotionCycle.update(cycle,dt,{playing:state.playing,visible:!document.hidden,loaded:state.loaded&&!state.loading});if(cycle.automatic&&state.mode!==scheduled.mode){state.mode=scheduled.mode;refreshModes();}if(state.selected==='barracuda'){barracuda.configure(state);state.frames++;updateReadout(now);return;}if(state.playing){behaviorInput.mode=ocularInput.mode=oralInput.mode=state.mode;behaviorInput.pointer=state.pointer;behaviorInput.centered=!state.group;Behavior.update(behavior,dt,behaviorInput);for(const actor of behavior.actors){ocularInput.turnRate=actor.turnRate;oralInput.effort=actor.threat;const scan=Ocular.update(actor.ocularR04,dt,ocularInput),mouth=Oral.update(actor.oralR04,dt,oralInput);if(actor.cranialR04){actor.cranialR04.eye=scan;actor.cranialR04.oral=mouth;}else actor.cranialR04={eye:scan,oral:mouth};}state.time+=dt;posesDirty=true;}updatePoses(false);resize();updateCamera(dt);renderer.render(scene,camera);state.frames++;updateReadout(now);}
const catalog=mountSpecimenCatalog({items:[{id:'barracuda'},...items],labels:LABELS,onSelect:id=>select(id)});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=MotionCycle.setManual(cycle,b.dataset.mode).mode;refreshModes();production.enter('behavior');});$('automatic').onclick=()=>{MotionCycle.setAutomatic(cycle,!cycle.automatic);refreshModes();};$('play').onclick=()=>{state.playing=!state.playing;$('play').textContent=state.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',state.playing?'暂停':'播放');};$('single').onclick=()=>{production.enter('spine');if(state.group){select(state.requested||state.selected,{group:false});}};$('group').onclick=()=>{production.enter('behavior');if(!state.group){select(state.requested||state.selected,{group:true});}};$('skeleton').onclick=()=>{production.enter('spine');state.bones=!state.bones;$('skeleton').classList.toggle('active',state.bones);};$('reset').onclick=()=>{MotionCycle.reset(cycle);state.mode=cycle.mode;refreshModes();if(state.selected==='barracuda'){barracuda.reset();return;}Behavior.reset(behavior);posesDirty=true;const measured=eyes[0].objects.map(item=>{const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(item.baseQ).toArray()),optic=item.opticAxis.clone().multiply(new THREE.Vector3().fromArray(item.localRadii)).normalize();return {...item.eye,sourceFrame:{x:axes[0],y:axes[1],normal:axes[2]},opticAxis:optic.toArray()};});const rec=oralMetadata.specimens.find(s=>s.id===state.selected)?.productionRecommendation;for(const actor of behavior.actors){actor.ocularR04=Ocular.create(state.selected,2601002,actor.index,measured);actor.oralR04=Oral.create(state.selected,2601002,actor.index,rec?.signedMaxAngleRad||0);}state.orbit={yaw:0,pitch:.10,distance:state.group?10:2.15};state.pointer=null;};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{const head=b.dataset.view==='head',id=state.selected;if(head)production.enter('cranial');if(head&&state.group){await select(id,{group:false});if(state.selected!==id||state.loading)return;}if(state.selected==='barracuda'){barracuda.view(b.dataset.view);return;}state.orbit.detail=head;if(state.group){state.orbit.autoFit=true;delete state.orbit.fitDistance;}state.orbit.distance=head?.52:state.group?10:2.15;state.orbit.yaw=head?.24:b.dataset.view==='oblique'?.62:0;state.orbit.pitch=b.dataset.view==='top'?1.48:b.dataset.view==='oblique'?.28:.05;});
const pointerNDC=new THREE.Vector2(),pointerRay=new THREE.Raycaster(),pointerPlane=new THREE.Plane(),pointerHit=new THREE.Vector3(),pointerArray=[0,0,0];let drag=null;canvas.addEventListener('pointerdown',e=>{if(e.button===0){drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);}});canvas.addEventListener('pointermove',e=>{if(drag){state.orbit.yaw-=(e.clientX-drag.x)*.006;state.orbit.pitch=clamp(state.orbit.pitch+(e.clientY-drag.y)*.006,-1.48,1.48);drag.x=e.clientX;drag.y=e.clientY;}else if(state.group&&state.loaded){const r=canvas.getBoundingClientRect();pointerNDC.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pointerRay.setFromCamera(pointerNDC,camera);pointerPlane.normal.subVectors(camera.position,target).normalize();pointerPlane.constant=-pointerPlane.normal.dot(target);const p=pointerRay.ray.intersectPlane(pointerPlane,pointerHit);if(p){pointerArray[0]=p.x;pointerArray[1]=p.y;pointerArray[2]=p.z;}state.pointer=p?pointerArray:null;}});for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,()=>drag=null);canvas.addEventListener('pointerleave',()=>{state.pointer=null;});canvas.addEventListener('wheel',e=>{e.preventDefault();if(state.group&&state.orbit.autoFit!==false){state.orbit.distance=state.orbit.fitDistance||state.orbit.distance;state.orbit.autoFit=false;}state.orbit.distance=clamp(state.orbit.distance*Math.exp(e.deltaY*.001),state.group?4:state.orbit.detail?.26:.7,state.group?60:5);},{passive:false});addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(e.target.tagName)){e.preventDefault();$('play').click();}});
const api=globalThis.__FIVE_FISH__={ready:false,state,manifest,production,renderer,camera,scene,Behavior,Ocular,Oral,MotionCycle,cycle,oralMetadata,DEFORM_GLSL,THREE,sourcePositions,select,retry(){return select(state.requested||state.selected,{group:state.group});},setMode(mode){state.mode=MotionCycle.setManual(cycle,mode).mode;refreshModes();},setAutomatic(enabled=true){MotionCycle.setAutomatic(cycle,enabled);refreshModes();},async setGroup(value){await select(state.selected,{group:!!value});},registry:[{id:'barracuda',baseline:'R14'},...items.map(i=>({id:i.id,baseline:'SOURCE_SAMPLED_R02'}))],get barracuda(){return barracuda;},get score(){return score;},get behavior(){return behavior;},get meshes(){return bodyMeshes;},get poseTexture(){return poseTex;},get finTexture(){return finTex;},get eyes(){return eyes;},get ocularBatches(){return ocularBatch?.batches||[];},sourceLoaderStats(){return sourceLoader.stats();},textureCacheStats(){return [...textureCache].map(([id,e])=>({id,count:e.textures.length,pending:!e.textures.length}));},updatePoses,reference(enabled){production.enter('surface');state.reference=!!enabled;updatePoses();},captureState(){if(state.selected==='barracuda'){const r=barracuda.api.renderer;return {id:state.selected,group:state.group,mode:state.mode,frames:r.frames,instances:state.group?30:1,sourceVertexCount:r.h.metadata.counts.vertices,sourceTriangleCount:r.h.metadata.counts.triangles,legacyVersion:'R14',sourceHead:manifest.buildSourceHead,activeInstrument:r.state.mode};}return {id:state.selected,group:state.group,mode:state.mode,frames:state.frames,sourceVertexCount:score?.primitives.reduce((n,p)=>n+p.positions.length/3,0),sourceTriangleCount:score?.primitives.reduce((n,p)=>n+p.indices.length/3,0),instances:behavior?.actors.length,pose:Behavior.snapshot(behavior),sourceHead:manifest.buildSourceHead};}};
select(globalThis.__FISH_BOOT__?.requested||'barracuda').then(()=>{api.ready=state.loaded;requestAnimationFrame(frame);});
