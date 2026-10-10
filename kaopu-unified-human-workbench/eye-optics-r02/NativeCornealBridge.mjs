import {recoverNativeEyeLayers,fitNativeIris} from './NativeEyeLayers.mjs';
const VERSION='kaopu/native-corneal-bridge@2-research';
const GLSL=`
uniform float uE2Mode,uE2IOR;
uniform vec3 uE2O[2],uE2U[2],uE2V[2],uE2Z[2],uE2H[2];
varying float vE2Layer;varying vec3 vE2Normal;
vec3 e2InnerNormal=vec3(0.,0.,1.);float e2Refracted=0.;
vec2 e2Lookup(){
 if(uE2Mode<1.5||vE2Layer<1.5)return vFEye.xy;
 int side=int(step(.5,vFEye.w));
 vec3 P=-vViewPosition,N=normalize(vE2Normal),I=normalize(P);
 if(dot(I,N)>0.)N=-N;
 vec3 D=refract(I,N,1./uE2IOR),p=P-uE2O[side],U=uE2U[side],V=uE2V[side],Z=uE2Z[side],H=uE2H[side];
 vec2 q=vec2(dot(p,U),dot(p,V)),d=vec2(dot(D,U),dot(D,V));
 float z=dot(p,Z),dz=dot(D,Z);
 float A=-(H.x*d.x*d.x+H.y*d.x*d.y+H.z*d.y*d.y);
 float B=dz-2.*H.x*q.x*d.x-H.y*(q.x*d.y+q.y*d.x)-2.*H.z*q.y*d.y;
 float C=z-H.x*q.x*q.x-H.y*q.x*q.y-H.z*q.y*q.y,t=1e10;
 if(abs(A)<1e-9){if(abs(B)>1e-7)t=-C/B;}
 else{float disc=B*B-4.*A*C;if(disc>=0.){float s=sqrt(disc),t0=(-B-s)/(2.*A),t1=(-B+s)/(2.*A);if(t0>1e-7)t=min(t,t0);if(t1>1e-7)t=min(t,t1);}}
 q+=d*t;
 // Outside the fitted iris aperture expose the actual inner sclera. No alpha blending.
 if(t<=1e-7||t>0.05||length(q)>1.035)discard;
 float hx=2.*H.x*q.x+H.y*q.y,hy=H.y*q.x+2.*H.z*q.y;
 e2InnerNormal=normalize(Z-hx*U-hy*V);e2Refracted=1.;return q;
}
`;
export function patchCornealShader(shader,U){
 Object.assign(shader.uniforms,U);
 if(!shader.fragmentShader.includes('vec3 e1IrisColor()'))throw Error('E2 requires attached E1 native tissue module');
 shader.vertexShader='attribute float e2Layer;varying float vE2Layer;varying vec3 vE2Normal;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvE2Layer=e2Layer;vE2Normal=normalize(normalMatrix*objectNormal);');
 shader.fragmentShader=shader.fragmentShader.replace('vec3 e1IrisColor()',GLSL+'\nvec3 e1IrisColor()');
 shader.fragmentShader=shader.fragmentShader.replace('float r=length(vFEye.xy),aa=', 'vec2 e2TissueQ=e2Lookup();float r=length(e2TissueQ),aa=');
 shader.fragmentShader=shader.fragmentShader.replace('atan(vFEye.y,vFEye.x)/6.28318530718','atan(e2TissueQ.y,e2TissueQ.x)/6.28318530718');
 shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() {\nif(uE2Mode>.5&&uE2Mode<1.5&&vE2Layer>1.5)discard;');
 shader.fragmentShader=shader.fragmentShader.replace('e1OuterNormal=normal;', 'e1OuterNormal=normal;\nif(uE2Mode>1.5&&e2Refracted>.5)normal=e2InnerNormal;');
 return shader;
}
/** All stages use the existing host material/depth buffer. No blend transparency,
 * no new eyeball, no eye/lid vertex motion and no shadow-map setting change.
 * The optical stage evaluates a fitted existing inner iris, not a new mesh.
 */
export function attachNativeCornealBridge(skin,{THREE}={}){
 if(skin.cornealBridge)return skin.cornealBridge;if(!skin.eyeOptics)throw Error('Attach native eye tissue module first');
 const viewer=skin.viewer,model=viewer.model,material=skin.material,mesh=viewer.mesh,binding=recoverNativeEyeLayers(model),touched=new Map();
 const beforeCompile=material.onBeforeCompile,beforeKey=material.customProgramCacheKey,beforeRender=mesh.onBeforeRender,beforeDispose=skin.dispose;
 const U={uE2Mode:{value:0},uE2IOR:{value:1.336}};for(const n of['O','U','V','Z','H'])U['uE2'+n]={value:[new THREE.Vector3(),new THREE.Vector3()]};
 let disposed=false,compiles=0,fits=[],lastVersion=-1,mode='original';
 function assign(geometry,data){if(geometry.attributes.e2Layer)return; touched.set(geometry,geometry.attributes.e2Layer);geometry.setAttribute('e2Layer',new THREE.BufferAttribute(data,1));}
 function attributes(){assign(viewer.nativeGeometry,binding.layers);for(const surface of viewer.surfaces.values()){let data=binding.layers;for(const layer of surface.levels){const next=new Float32Array(layer.geometry.attributes.position.count);next.set(data);for(let j=0;j<layer.pairs.length;j++){const[a,b]=layer.pairs[j];if(data[a]!==data[b])throw Error('Eye layer crossed a refinement edge');next[layer.oldCount+j]=(data[a]+data[b])*.5;}assign(layer.geometry,next);data=next;}}}
 const transform=new THREE.Matrix4(),rotation=new THREE.Matrix3();
 function refresh(camera){attributes();const g=viewer.nativeGeometry;if(g.attributes.position.version!==lastVersion){fits=binding.eyes.map(e=>({...fitNativeIris(e.interior,g.attributes.position.array,g.attributes.fEye.array),side:e.side}));lastVersion=g.attributes.position.version;}
  transform.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);rotation.setFromMatrix4(transform);
  for(const fit of fits){const side=fit.side==='left'?0:1;U.uE2O.value[side].fromArray(fit.O).applyMatrix4(transform);for(const n of['U','V','Z'])U['uE2'+n].value[side].fromArray(fit[n]).applyMatrix3(rotation);U.uE2H.value[side].fromArray(fit.H);}
 }
 mesh.onBeforeRender=function(renderer,scene,camera,...rest){beforeRender.call(this,renderer,scene,camera,...rest);refresh(camera);};
 material.onBeforeCompile=shader=>{beforeCompile.call(material,shader);patchCornealShader(shader,U);compiles++;};material.customProgramCacheKey=()=>beforeKey.call(material)+'/'+VERSION;
 const report=()=>({version:VERSION,mode,ior:U.uE2IOR.value,iorUnit:'dimensionless effective air-to-eye index',iorEvidence:'single effective boundary approximation; default aqueous 1.336, not a calibrated corneal thickness',classification:binding.eyes.map(e=>({side:e.side,interiorVertices:e.interior.length,exteriorVertices:e.exterior.length,sourceGapMM:e.sourceGapMM})),fits:fits.map(({side,samples,rmsMicrometres,irisRadiusMM})=>({side,samples,rmsMicrometres,irisRadiusMM})),compiles,disposed,transparent:material.transparent,depthWrite:material.depthWrite,depthTest:material.depthTest,geometryAndLidsUnchanged:true,transport:'existing exterior normal / fitted existing interior quadratic / single effective Snell boundary; no spectral volume, caustics or eyelid shadow added'});
 const api={report,uniforms:U,setMode(next){if(!['original','interior-diagnostic','tissue-only','refracted-tissue'].includes(next))throw Error('Unknown native optical stage');mode=next;U.uE2Mode.value=next==='interior-diagnostic'?1:next==='refracted-tissue'?2:0;skin.eyeOptics.enabled(next==='tissue-only'||next==='refracted-tissue');viewer.render();return report();},setIOR(n){if(!Number.isFinite(n)||n<1||n>1.5)throw Error('Effective IOR outside research range [1,1.5]');U.uE2IOR.value=n;viewer.render();return report();},dispose(){if(disposed)return;disposed=true;mesh.onBeforeRender=beforeRender;material.onBeforeCompile=beforeCompile;material.customProgramCacheKey=beforeKey;material.needsUpdate=true;for(const[g,a]of touched){if(a)g.setAttribute('e2Layer',a);else g.deleteAttribute('e2Layer');}skin.dispose=beforeDispose;delete skin.cornealBridge;}};
 skin.cornealBridge=api;skin.dispose=function(){api.dispose();return beforeDispose.call(this);};attributes();material.needsUpdate=true;api.setMode('original');return api;
}
