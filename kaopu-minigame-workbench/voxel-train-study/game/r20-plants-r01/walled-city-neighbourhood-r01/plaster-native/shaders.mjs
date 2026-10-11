import {plasterSource} from './source-plaster.mjs';
export const retainedFunctionNames=['mmRotate','mmWarp','mmXi','mmCell','mmObserved','mmGeomMacroFast','mmGeomMicroFast','plasterMacroField','plasterMicroField','perturb'];
export const retainedFunctions=retainedFunctionNames.map(k=>plasterSource.functions[k]).join('\n');
export function plasterVertex(){return `precision highp float;
uniform mat4 modelMatrix;uniform mat4 uViewProj;uniform mat4 uReceiverMatrix;uniform mat3 uNormalWorld;
in vec3 position;in vec3 normal;in vec3 nativeFieldPoint;in vec2 nativeMaterialState;
out vec3 vWorldPoint;out vec3 vWorldNormal;out vec3 vFieldPoint;out vec3 vReceiverPosition;out vec2 vNativeMaterialState;
void main(){vec4 world=modelMatrix*vec4(position,1.);vWorldPoint=world.xyz;vWorldNormal=uNormalWorld*normal;vFieldPoint=nativeFieldPoint;vReceiverPosition=(uReceiverMatrix*vec4(position,1.)).xyz;vNativeMaterialState=nativeMaterialState;gl_Position=uViewProj*world;}`;}
export function plasterFragment(){return `precision highp float;precision highp int;
uniform vec3 uCamera;uniform vec3 uViewDir;uniform int uOrtho;
uniform vec2 uPlasterCenter;uniform vec2 uPlasterHalf;uniform float uPlasterMicro;
uniform vec3 uPaletteDark;uniform vec3 uPaletteLight;uniform float uGrainWavelength;uniform float uGrainColor;
uniform float uGrainHeight;uniform vec2 uGrainFilter;uniform vec2 uMicroFilter;
in vec3 vWorldPoint;in vec3 vWorldNormal;in vec3 vFieldPoint;in vec3 vReceiverPosition;in vec2 vNativeMaterialState;out vec4 frag;
${retainedFunctions}
// Adaptation: original grain direction, explicit metre wavelength, conservative
// cycles-per-pixel attenuation. Original 9% centimetre striping is not retained.
float nativeFilteredGrain(vec3 p){float phase=dot(p,normalize(vec3(83.,-61.,97.)))*(6.283185307179586/uGrainWavelength);float cycles=(abs(dFdx(phase))+abs(dFdy(phase)))/6.283185307179586;float gate=1.-smoothstep(uGrainFilter.x,uGrainFilter.y,cycles);return sin(phase)*gate;}
// Original shade algebra retained apart from the documented grain/palette,
// derivative carrier and parent-local to world-normal coordinate bridge.
vec3 nativeShadePlaster(vec3 p,vec3 worldP,vec3 n,vec3 rd){
 float obs=mmObserved(vec3((p.xy-uPlasterCenter)/max(uPlasterHalf,vec2(.08)),p.z*2.),vec3(-1.3,4.7,2.2)),pm=plasterMacroField(p),pu=plasterMicroField(p),grain=nativeFilteredGrain(p);
 float footprint=max(length(dFdx(p)),length(dFdy(p))),microGate=1.-smoothstep(uMicroFilter.x,uMicroFilter.y,footprint);
 n=perturb(n,worldP,microGate*uPlasterMicro*(.26*obs+.18*pu)+uGrainHeight*grain);
 vec3 base=mix(uPaletteDark,uPaletteLight,.58+.08*obs+.22*pm);base*=.94+uGrainColor*grain;
 float rough=clamp(.95+.032*(-obs),.86,.997);
 // NATIVE_PLASTER_MATERIAL_STATE_SLOT: modify base/rough here before lighting.
 // vReceiverPosition is mesh.matrix * true position, independent of root motion.
 // vNativeMaterialState is a host-supplied interpolated low-frequency vec2.
 vec3 L=normalize(vec3(-.94,.30,-.16)),V=normalize(-rd),H=normalize(L+V);
 float nl=max(dot(n,L),0.),nh=max(dot(n,H),0.);
 vec3 hemi=mix(vec3(.085,.083,.078),vec3(.38,.37,.34),n.y*.5+.5),rim=base*.19*max(dot(n,normalize(vec3(.62,.16,.77))),0.);
 return base*(hemi+vec3(2.45,2.31,2.08)*nl/3.14159265)+rim+(1.-rough)*pow(nh,8.)*vec3(.24);
}
void main(){vec3 rd=uOrtho==1?normalize(uViewDir):normalize(vWorldPoint-uCamera);vec3 col=nativeShadePlaster(vFieldPoint,vWorldPoint,normalize(vWorldNormal),rd);
 col=pow(max(col/(1.+col),0.),vec3(1./2.2));frag=vec4(col,1.);}`;}
