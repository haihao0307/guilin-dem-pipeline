// Display-managed white is composited after the hair's radiometric exposure.
// The source snapshots remain unchanged for comparison.
import {fastNodeRadianceFragment as source} from '../references/fiber-r05/shaders.mjs';
import {resolveFragment} from '../references/fiber-r03/stability.mjs';
function replace(s,a,b){if(!s.includes(a))throw Error('Optics anchor missing: '+a);return s.replace(a,b);}
let shader=replace(source,'uniform vec3 sigmaA;','uniform vec3 sigmaA;uniform float weightDebug,styleLength;uniform vec3 lightPositions[3];');
shader=replace(shader,'const float LIGHT_RADIANCE_SCALE=.35;','const float LIGHT_RADIANCE_SCALE=.75;');
shader=replace(shader,'float bm=clamp(roughness*(.93+.14*seedValue),.18,.58),bn=.43;','float bm=clamp(roughness*(.90+.20*seedValue),.28,.58),bn=.58;');
shader=replace(shader,'vec3 direct=fiber(T,V,normalize(lightDirs[i]),absorption);',`
 // Five solid-angle samples of a finite softbox; energy is averaged, not added.
 vec3 delta=lightPositions[i]-wPos;float distance2=dot(delta,delta);vec3 L=normalize(delta);
 vec3 A=normalize(cross(L,vec3(0.,1.,0.))),B=cross(L,A);float radius=.18;
 vec3 direct=.20*fiber(T,V,L,absorption);
 direct+=.20*fiber(T,V,normalize(delta+radius*(A+B)),absorption);
 direct+=.20*fiber(T,V,normalize(delta+radius*(A-B)),absorption);
 direct+=.20*fiber(T,V,normalize(delta+radius*(-A+B)),absorption);
 direct+=.20*fiber(T,V,normalize(delta-radius*(A+B)),absorption);
 direct*=.49/distance2*sqrt(max(.0,1.-pow(dot(T,L),2.)));`);
shader=replace(shader,'if(mode<.5)color+=base*.016;','if(mode<.5)color+=base*.055;');
shader=replace(shader,' return color;',' if(weightDebug>.5){float support=exp(-styleLength*progress/.018);return mix(vec3(.025,.23,.60),vec3(.8,.055,.018),support);} return color;');
export const fastNodeRadianceFragment=shader;
export const whiteResolveFragment=replace(resolveFragment,'gl_FragColor=vec4(col+T*backdrop,1.);','gl_FragColor=vec4(col,1.-T);');
export const displayFragment=`precision highp float;uniform sampler2D image;uniform float exposure;uniform vec3 backdrop;varying vec2 vUv;
vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){vec4 q=texture2D(image,vUv);float alpha=clamp(q.a,0.,1.);vec3 x=q.rgb/max(alpha,1e-6)*exposure;
 // A shared luminance shoulder preserves pigment ratios instead of clipping each channel toward white.
 float y=dot(x,vec3(.2126,.7152,.0722)),shoulder=y/(1.+y);vec3 c=x*(shoulder/max(y,1e-6));
 float peak=max(c.r,max(c.g,c.b));if(peak>1.)c/=peak;
 gl_FragColor=vec4(srgb(mix(backdrop,c,alpha)),1.);}`;
