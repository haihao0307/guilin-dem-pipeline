import {VERSION,settings,PRESETS} from './EyeParameters.mjs';
import {createIrisAtlas} from './IrisField.mjs';

const declarations=`
uniform sampler2D uE1Atlas;
uniform vec3 uE1Outer,uE1Inner;
uniform vec2 uE1IrisRadiusMM;
uniform float uE1Enabled,uE1PupilMM,uE1LimbusMM,uE1ReliefMM,uE1WetRoughness;
float e1IrisMask=0.;float e1HeightM=0.;vec3 e1OuterNormal=vec3(0.,0.,1.);vec3 e1CachedColor=vec3(0.);
vec2 e1TissueCoordinates(){return vFEye.xy;}
vec3 e1IrisColor(){
 float irisMM=mix(uE1IrisRadiusMM.x,uE1IrisRadiusMM.y,step(.5,vFEye.w));
 vec2 tissueQ=e1TissueCoordinates();
 float r=length(tissueQ),aa=max(fwidth(r),.0005),pupilR=uE1PupilMM/(2.*irisMM);
 float iris=1.-smoothstep(1.-aa,1.+aa,r),pupil=1.-smoothstep(pupilR-aa,pupilR+aa,r);
 float materialR=clamp((r-pupilR)/max(.05,1.-pupilR),0.,1.);
 // atan(0,0) has no defined GLSL value. The pupil-center angle is arbitrary.
 float angle=dot(tissueQ,tissueQ)>0.?atan(tissueQ.y,tissueQ.x):0.;
 float azimuth=angle/6.28318530718+.5+vFEye.w*.06844;
 vec4 tissue=texture2D(uE1Atlas,vec2(azimuth,materialR));
 float pigment=tissue.a-.5,collar=1.-smoothstep(.12,.48,materialR);
 vec3 irisColor=mix(uE1Outer,uE1Inner,collar);
 irisColor*=exp(-pigment*vec3(1.4,2.0,2.5))*(.52+tissue.r)*mix(1.,.72,tissue.b);
 float limbus=1.-smoothstep(1.-uE1LimbusMM/irisMM,1.,r);
 irisColor*=mix(.19,1.,limbus);
 e1IrisMask=iris*(1.-pupil)*vFEye.z*uE1Enabled;
 // Metres at the normal-perturbation stage. The outer wet normal is kept independent.
 e1HeightM=(tissue.g*2.-1.)*uE1ReliefMM*.001*e1IrisMask;
 vec3 sclera=vec3(.69,.71,.66);
 vec3 color=mix(sclera,irisColor,iris);
 return mix(color,vec3(.0015,.0015,.0018),pupil);
}
`;

export function patchEyeShader(shader,U){
 const token='vec3 fEyeColor()';if(!shader.fragmentShader.includes(token))throw Error('E1 requires ET12/ET13 FaceSkin fEyeColor; no fallback color sphere');
 const anchor='#include <lights_physical_fragment>',lighting='#include <lights_fragment_begin>';
 for(const a of[anchor,lighting,'void main() {'])if(!shader.fragmentShader.includes(a))throw Error('E1 shader anchor missing: '+a);
 Object.assign(shader.uniforms,U);
 shader.fragmentShader=shader.fragmentShader.replace(token,'vec3 e1PreviousEyeColor()');
 // Append after all FaceSkin varyings by using the old function as insertion point.
 shader.fragmentShader=shader.fragmentShader.replace('vec3 e1PreviousEyeColor()',declarations+'\nvec3 e1PreviousEyeColor()');
 const at=shader.fragmentShader.indexOf('vec3 e1PreviousEyeColor()'),open=shader.fragmentShader.indexOf('{',at);let depth=1,end=open+1;
 for(;end<shader.fragmentShader.length&&depth;end++){if(shader.fragmentShader[end]==='{')depth++;else if(shader.fragmentShader[end]==='}')depth--;}
 shader.fragmentShader=shader.fragmentShader.slice(0,end)+'\nvec3 fEyeColor(){return uE1Enabled>.5?e1CachedColor:e1PreviousEyeColor();}\n'+shader.fragmentShader.slice(end);
 // Compute candidate sampling on every helper invocation, before the host varying
 // eye gate. The uniform-only branch preserves the original shader-off path.
 shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() {\nif(uE1Enabled>.5)e1CachedColor=e1IrisColor();');
 shader.fragmentShader=shader.fragmentShader.replace(anchor,`
 e1OuterNormal=normal;
 vec3 e1ViewDx=dFdx(-vViewPosition),e1ViewDy=dFdy(-vViewPosition);
 float e1HeightDx=dFdx(e1HeightM),e1HeightDy=dFdy(e1HeightM);
 if(uE1Enabled>.5&&vFEye.z>.01&&vCSType>3.5){
  vec3 er1=cross(e1ViewDy,normal),er2=cross(normal,e1ViewDx);float ed=dot(e1ViewDx,er1);
  if(abs(ed)>1e-14)normal=normalize(abs(ed)*normal-sign(ed)*(e1HeightDx*er1+e1HeightDy*er2));
  roughnessFactor=mix(.25,.65,e1IrisMask);
 }
 ${anchor}`);
 shader.fragmentShader=shader.fragmentShader.replace(lighting,`
 #ifdef USE_CLEARCOAT
 if(uE1Enabled>.5&&vFEye.z>.01&&vCSType>3.5){
  clearcoatNormal=e1OuterNormal;
  // Three's clearcoat F0 is 0.04. Weight .52 approximates an air/tear F0 of 0.0207.
  // No film thickness or interference is claimed by this coverage approximation.
  material.clearcoat=.52;material.clearcoatRoughness=uE1WetRoughness;
 }
 #endif
 ${lighting}`);
 return shader;
}

/** Same bind calculation as FaceFields; no vertex re-selection, rescaling or socket replacement. */
export function nativeIrisRadiiMM(model){
 const g=model?.gnm;if(!g)throw Error('E1 requires native GNM data');
 return[1,2].map(id=>{const c=[0,0,0];let count=0;for(let i=0;i<g.numVertices;i++)if(g.componentId[i]===id&&g.materialId[i]===6){for(let k=0;k<3;k++)c[k]+=g.template[i*3+k];count++;}if(!count)throw Error('Missing native pupil component '+id);for(let k=0;k<3;k++)c[k]/=count;let r=0;for(let i=0;i<g.numVertices;i++)if(g.componentId[i]===id&&g.materialId[i]===5)r=Math.max(r,Math.hypot(g.template[i*3]-c[0],g.template[i*3+1]-c[1]));if(!(r>.001&&r<.02))throw Error('Invalid native iris radius '+r);return r*1000;});
}

/** Install after attachFaceSkin. THREE is dependency-injected so the same host runtime is used.
 * Native geometry, identity fields, eye centres, eyelids, animation and skin textures are untouched.
 * This first candidate intentionally does not enable refraction on an unverified native cornea.
 */
export function attachNativeEyeOptics(skin,{THREE,parameters={}}={}){
 if(!THREE)throw Error('Pass the host-compatible THREE module explicitly');
 if(skin.eyeOptics)return skin.eyeOptics;if(!skin.faceExtension)throw Error('Attach FaceSkin first');
 const material=skin.material,previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey,previousDispose=skin.dispose;
 const radii=nativeIrisRadiiMM(skin.viewer.model);let p=settings(parameters),atlas,texture,disposed=false,compiles=0;
 const U={uE1Atlas:{value:null},uE1Enabled:{value:1},uE1Outer:{value:new THREE.Vector3()},uE1Inner:{value:new THREE.Vector3()},uE1IrisRadiusMM:{value:new THREE.Vector2(...radii)},uE1PupilMM:{value:p.pupilDiameterMM},uE1LimbusMM:{value:p.limbusWidthMM},uE1ReliefMM:{value:p.irisReliefMM},uE1WetRoughness:{value:p.wetRoughness}};
 function updateAtlas(){atlas=createIrisAtlas(p.preset);const next=new THREE.DataTexture(atlas.data,atlas.width,atlas.height,THREE.RGBAFormat);next.colorSpace=THREE.NoColorSpace;next.wrapS=THREE.RepeatWrapping;next.wrapT=THREE.ClampToEdgeWrapping;next.generateMipmaps=true;next.minFilter=THREE.LinearMipmapLinearFilter;next.magFilter=THREE.LinearFilter;next.needsUpdate=true;U.uE1Atlas.value=next;texture?.dispose();texture=next;U.uE1Outer.value.fromArray(PRESETS[p.preset].outerLinear);U.uE1Inner.value.fromArray(PRESETS[p.preset].innerLinear);}
 const report=()=>({version:VERSION,derivativePolicy:'quad-wide candidate sampling and gradients before varying tissue gate',parameters:{...p},nativeBindIrisRadiiMM:radii,dimensionalConvention:'GNM bind-space mm; current anisotropic deformation not calibrated',activeParameters:['preset','pupilDiameterMM','limbusWidthMM','irisReliefMM','wetRoughness'],atlas:atlas.report,compiles,disposed,enabled:U.uE1Enabled.value===1,oneMaterial:skin.material===material,geometryUnchanged:true,refractionEnabled:false,refractionBlocker:'Native corneal surface/eye-axis correspondence must be validated before ET08 optics can be migrated',tearFilmGeometry:false,measuredPigment:false});
 const api={report,uniforms:U,set(values={}){for(const k of Object.keys(values))if(!['preset','pupilDiameterMM','limbusWidthMM','irisReliefMM','wetRoughness'].includes(k))throw Error('Parameter belongs to the optical reference and is not active in native E1: '+k);if(disposed)throw Error('E1 disposed');const next=settings({...p,...values});if(next.pupilDiameterMM>=2*Math.min(...radii)-.4)throw RangeError('Pupil exceeds native iris annulus');const changed=next.preset!==p.preset;p=next;if(changed)updateAtlas();U.uE1PupilMM.value=p.pupilDiameterMM;U.uE1LimbusMM.value=p.limbusWidthMM;U.uE1ReliefMM.value=p.irisReliefMM;U.uE1WetRoughness.value=p.wetRoughness;skin.viewer.render();return report();},enabled(value){U.uE1Enabled.value=value?1:0;skin.viewer.render();return report();},dispose(){if(disposed)return;skin.cornealBridge?.dispose();disposed=true;texture.dispose();material.onBeforeCompile=previousCompile;material.customProgramCacheKey=previousKey;material.needsUpdate=true;delete skin.eyeOptics;skin.dispose=previousDispose;}};
 material.onBeforeCompile=shader=>{previousCompile.call(material,shader);patchEyeShader(shader,U);compiles++;};material.customProgramCacheKey=()=>previousKey.call(material)+'/'+VERSION+'/quad-safe-v1';
 skin.dispose=function(){api.dispose();return previousDispose.call(this);};skin.eyeOptics=api;updateAtlas();material.needsUpdate=true;skin.viewer.render();return api;
}
