import {recoverNativeEyeLayers,fitNativeIris} from './NativeEyeLayers.mjs';
const VERSION='kaopu/native-corneal-bridge@2-research-quad-safe-v2';
const GLSL=`
uniform float uE2Mode,uE2IOR;
uniform vec3 uE2O[2],uE2U[2],uE2V[2],uE2Z[2],uE2H[2];
varying float vE2Layer;varying vec3 vE2Normal;
vec3 e2InnerNormal=vec3(0.,0.,1.);vec3 e2HitView=vec3(0.);float e2Refracted=0.;float e2Reject=0.;
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
 else{float disc=B*B-4.*A*C;if(disc>=0.){float s=sqrt(disc),stableQ=-.5*(B+(B>=0.?s:-s));float t0=stableQ/A,t1=abs(stableQ)>1e-12?C/stableQ:-1.;if(t0>1e-7)t=min(t,t0);if(t1>1e-7)t=min(t,t1);}}
 bool validRay=t>1e-7&&t<0.05;q+=d*(validRay?t:0.);
 // Defer cutout until AFTER all fwidth/texture/bump derivatives. Early discard
 // makes neighboring derivative quads undefined at the optical aperture edge.
 e2Reject=(!validRay||length(q)>1.035)?1.:0.;
 float hx=2.*H.x*q.x+H.y*q.y,hy=H.y*q.x+2.*H.z*q.y;
 // Quad-wide evaluation must not widen the visible optical support gate.
 e2InnerNormal=normalize(Z-hx*U-hy*V);e2HitView=P+D*(validRay?t:0.);e2Refracted=(vFEye.z>.01&&vCSType>3.5)?1.-e2Reject:0.;return q;
}
`;
export function patchCornealShader(shader,U){
 Object.assign(shader.uniforms,U);
 if(!shader.fragmentShader.includes('vec3 e1IrisColor()'))throw Error('E2 requires attached E1 native tissue module');
 shader.vertexShader='attribute float e2Layer;varying float vE2Layer;varying vec3 vE2Normal;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvE2Layer=e2Layer;vE2Normal=normalize(normalMatrix*objectNormal);');
 const coordinateAnchor='vec2 e1TissueCoordinates(){return vFEye.xy;}';
 if(!shader.fragmentShader.includes(coordinateAnchor))throw Error('E2 requires the explicit E1 tissue coordinate hook');
 shader.fragmentShader=shader.fragmentShader.replace(coordinateAnchor,GLSL+'\nvec2 e1TissueCoordinates(){return e2Lookup();}');
 shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() {\nif(uE2Mode>.5&&uE2Mode<1.5&&vE2Layer>1.5)discard;');
 if(!shader.fragmentShader.includes('vec3 fDiffuse=totalDiffuse;'))throw Error('E2 requires native post-derivative output anchor');
 shader.fragmentShader=shader.fragmentShader.replace('vec3 fDiffuse=totalDiffuse;','if(uE2Mode>1.5&&vE2Layer>1.5&&vFEye.z>.01&&vCSType>3.5&&e2Reject>.5)discard;\nvec3 fDiffuse=totalDiffuse;');
 shader.fragmentShader=shader.fragmentShader.replace('e1OuterNormal=normal;', 'e1OuterNormal=normal;\nif(uE2Mode>1.5&&e2Refracted>.5)normal=e2InnerNormal;');
 return shader;
}
/** All stages use the existing host material/depth buffer. No blend transparency,
 * no new eyeball, no eye/lid vertex motion and no shadow-map setting change.
 * The optical stage evaluates a fitted existing inner iris, not a new mesh.
 */
export function attachNativeCornealBridge(skin,{THREE}={}){
 if(skin.cornealBridge)return skin.cornealBridge;if(!skin.eyeOptics)throw Error('Attach native eye tissue module first');
 const viewer=skin.viewer,model=viewer.model,material=skin.material,mesh=viewer.mesh,binding=recoverNativeEyeLayers(model),touched=new Map(),previousE1Enabled=skin.eyeOptics.report().enabled;
 for(const g of[viewer.nativeGeometry,...Array.from(viewer.surfaces.values()).flatMap(s=>s.levels.map(l=>l.geometry))])if(g.attributes.e2Layer)throw Error('Existing e2Layer attribute collision');
 const beforeCompile=material.onBeforeCompile,beforeKey=material.customProgramCacheKey,beforeRender=mesh.onBeforeRender,beforeDispose=skin.dispose;
 const U={uE2Mode:{value:0},uE2IOR:{value:1.336}};for(const n of['O','U','V','Z','H'])U['uE2'+n]={value:[new THREE.Vector3(),new THREE.Vector3()]};
 let disposed=false,compiles=0,fits=[],lastVersion=-1,mode='original';
 function assign(geometry,data){if(geometry.attributes.e2Layer){if(!touched.has(geometry))touched.set(geometry,undefined);return;}touched.set(geometry,undefined);geometry.setAttribute('e2Layer',new THREE.BufferAttribute(data,1));}
 function attributes(){assign(viewer.nativeGeometry,binding.layers);for(const surface of viewer.surfaces.values()){let data=binding.layers;for(const layer of surface.levels){if(layer.geometry.attributes.e2Layer){data=layer.geometry.attributes.e2Layer.array;assign(layer.geometry,data);continue;}const next=new Float32Array(layer.geometry.attributes.position.count);next.set(data);for(let j=0;j<layer.pairs.length;j++){const[a,b]=layer.pairs[j];if(data[a]!==data[b])throw Error('Eye layer crossed a refinement edge');next[layer.oldCount+j]=(data[a]+data[b])*.5;}assign(layer.geometry,next);data=next;}}}
 const transform=new THREE.Matrix4(),rotation=new THREE.Matrix3();
 function refresh(camera){attributes();const g=viewer.nativeGeometry;if(g.attributes.position.version!==lastVersion){fits=binding.eyes.map(e=>({...fitNativeIris(e.interior,g.attributes.position.array,g.attributes.fEye.array),side:e.side}));lastVersion=g.attributes.position.version;}
  transform.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);rotation.setFromMatrix4(transform);
  const a=rotation.elements,c0=new THREE.Vector3(a[0],a[1],a[2]),c1=new THREE.Vector3(a[3],a[4],a[5]),c2=new THREE.Vector3(a[6],a[7],a[8]);if([c0,c1,c2].some(c=>Math.abs(c.lengthSq()-1)>1e-5)||Math.max(Math.abs(c0.dot(c1)),Math.abs(c0.dot(c2)),Math.abs(c1.dot(c2)))>1e-5||rotation.determinant()<0)throw Error('E2 requires the native rigid mesh transform; bake scaling into native positions first');
  for(const fit of fits){const side=fit.side==='left'?0:1;U.uE2O.value[side].fromArray(fit.O).applyMatrix4(transform);for(const n of['U','V','Z'])U['uE2'+n].value[side].fromArray(fit[n]).applyMatrix3(rotation);U.uE2H.value[side].fromArray(fit.H);}
 }
 mesh.onBeforeRender=function(renderer,scene,camera,...rest){beforeRender.call(this,renderer,scene,camera,...rest);refresh(camera);};
 material.onBeforeCompile=shader=>{beforeCompile.call(material,shader);patchCornealShader(shader,U);compiles++;};material.customProgramCacheKey=()=>beforeKey.call(material)+'/'+VERSION;
 const report=()=>({version:VERSION,mode,ior:U.uE2IOR.value,iorUnit:'dimensionless effective air-to-eye index',iorEvidence:'single effective boundary approximation; default aqueous 1.336, not a calibrated corneal thickness',classification:binding.eyes.map(e=>({side:e.side,interiorVertices:e.interior.length,exteriorVertices:e.exterior.length,sourceGapMM:e.sourceGapMM})),fits:fits.map(({side,samples,rmsMicrometres,maxResidualMicrometres,irisRadiusMM})=>({side,samples,rmsMicrometres,maxResidualMicrometres,irisRadiusMM,support:'native iris/pupil plus narrow sclera transition ring; geometric residual is not a ray-error bound'})),compiles,disposed,activeOnCurrentMaterial:mesh.material===material,supportedMaterial:'existing beauty material only; gray/grid keep original diagnostics',transparent:material.transparent,depthWrite:material.depthWrite,depthTest:material.depthTest,geometryAndLidsUnchanged:true,transport:'existing exterior normal / fitted existing interior quadratic / single effective Snell boundary; no spectral volume, caustics or eyelid shadow added'});
 const api={report,uniforms:U,setMode(next){if(disposed)throw Error('E2 disposed');if(!['original','interior-diagnostic','tissue-only','refracted-tissue'].includes(next))throw Error('Unknown native optical stage');mode=next;U.uE2Mode.value=next==='interior-diagnostic'?1:next==='refracted-tissue'?2:0;skin.eyeOptics.enabled(next==='tissue-only'||next==='refracted-tissue');viewer.render();return report();},setIOR(n){if(disposed)throw Error('E2 disposed');if(!Number.isFinite(n)||n<1||n>1.5)throw Error('Effective IOR outside research range [1,1.5]');U.uE2IOR.value=n;viewer.render();return report();},dispose(){if(disposed)return;skin.eyeShadowDiagnostic?.dispose();disposed=true;mesh.onBeforeRender=beforeRender;material.onBeforeCompile=beforeCompile;material.customProgramCacheKey=beforeKey;material.needsUpdate=true;for(const[g,a]of touched){if(a)g.setAttribute('e2Layer',a);else g.deleteAttribute('e2Layer');}skin.dispose=beforeDispose;delete skin.cornealBridge;skin.eyeOptics.uniforms.uE1Enabled.value=previousE1Enabled?1:0;}};
 skin.cornealBridge=api;skin.dispose=function(){api.dispose();return beforeDispose.call(this);};attributes();material.needsUpdate=true;api.setMode('original');return api;
}
