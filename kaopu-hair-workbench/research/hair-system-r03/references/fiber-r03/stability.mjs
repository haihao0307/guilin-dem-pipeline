/** R03-S1: single-frame analytic coverage and continuously partitioned optical depth.
 * Optical functions below are imported verbatim from the frozen R02 shader.
 * Layer colour mixtures and node-radiance interpolation are approximations.
 * This is not a full OIT sort, path tracer, temporal reprojection, or hair physics.
 */
import {vertex,fragment} from '../fiber-r02/shaders.mjs';
export const LAYERS=8;
export const STEP_METRES=.0015;
export function intervalCoverage(offset, width, footprint=1){
 if(![offset,width,footprint].every(Number.isFinite)||width<0||footprint<=0)throw Error('Invalid coverage input');
 return Math.max(0,Math.min(offset+footprint/2,width/2)-Math.max(offset-footprint/2,-width/2))/footprint;
}
export function partition(depth, step=STEP_METRES){
 if(!Number.isFinite(depth)||!Number.isFinite(step)||step<=0)throw Error('Invalid depth');
 const x=Math.max(0,Math.min(LAYERS-1,depth/step));return Array.from({length:LAYERS},(_,i)=>Math.max(0,1-Math.abs(x-i)));
}
export function compose(layers,background=[0,0,0]){
 let T=1;const rgb=[0,0,0];
 for(const a of layers){const tau=Math.max(0,a[3]);if(tau>1e-8){const tr=Math.exp(-tau);for(let j=0;j<3;j++)rgb[j]+=T*(1-tr)*a[j]/tau;T*=tr;}}
 return {rgb:rgb.map((c,i)=>c+T*background[i]),transmittance:T};
}
const opticalPrefix=fragment.slice(0,fragment.indexOf('void main(){'));
const opticalBody=fragment.slice(fragment.indexOf(' vec3 V=normalize(eyePosition-wPos)'),fragment.lastIndexOf(' gl_FragColor=vec4(color,1.0);'));
export const nodeRadianceFragment = opticalPrefix + `
uniform sampler2D positionMap,rootMap,traitMap;
uniform mat4 cameraView,cameraProjection;
uniform vec2 viewport;
uniform float diameter;
layout(location=0) out vec4 rad0;
layout(location=1) out vec4 rad1;
layout(location=2) out vec4 rad2;
layout(location=3) out vec4 rad3;
vec3 atNode(int i){return texelFetch(positionMap,ivec2(i%1024,i/1024),0).xyz;}
vec3 evaluateRadiance(float side){sideCoord=side;
${opticalBody}
 return color;
}
void main(){
 int id=int(gl_FragCoord.x)+int(gl_FragCoord.y)*1024;
 int root=id/81,node=id%81;
 if(root>=10000){rad0=rad1=rad2=rad3=vec4(0.);return;}
 vec4 rd=texelFetch(rootMap,ivec2(root%128,root/128),0);
 vec4 tr=texelFetch(traitMap,ivec2(root%128,root/128),0);
 wPos=atNode(id);wTangent=normalize(atNode(root*81+min(80,node+1))-atNode(root*81+max(0,node-1)));
 progress=float(node)/80.;seedValue=rd.w;
 float physical=diameter*tr.y*mix(1.,.08,smoothstep(.72,1.,progress));
 float pixelWorld=-(cameraView*vec4(wPos,1.)).z*2./(viewport.y*cameraProjection[1][1]);
 coverageScale=min(1.,physical/max(physical,pixelWorld*1.20));
 if(coverageScale<=.60){rad0=vec4(evaluateRadiance(0.),1.);rad1=rad2=rad3=rad0;}
 else {rad0=vec4(evaluateRadiance(-.75),1.);rad1=vec4(evaluateRadiance(-.25),1.);rad2=vec4(evaluateRadiance(.25),1.);rad3=vec4(evaluateRadiance(.75),1.);}
}`;
// Wider *raster footprint*, with physical diameter preserved in coverage.
export const stableVertex = vertex
 .replace('varying vec3 wPos,wTangent;',`varying vec3 wPos,wTangent;
 varying vec3 color0,color1,color2,color3;
 varying float relativeDepth;
 uniform sampler2D radiance0,radiance1,radiance2,radiance3;
 uniform float eyeDistance;`)
 .replace('float expanded=max(physical,pixelWorld*1.20);coverageScale=min(1.0,physical/expanded);',
 `float expanded=physical+pixelWorld*2.;coverageScale=physical/expanded;
 int id=gl_InstanceID*81+node;ivec2 at=ivec2(id%1024,id/1024);
 color0=texelFetch(radiance0,at,0).rgb;color1=texelFetch(radiance1,at,0).rgb;
 color2=texelFetch(radiance2,at,0).rgb;color3=texelFetch(radiance3,at,0).rgb;
 relativeDepth=-vp.z-eyeDistance;`);
const coverageGLSL=`
 float halfFootprint=max(.5*fwidth(sideCoord),1e-5);
 float cov=clamp((min(sideCoord+halfFootprint,coverageScale)-max(sideCoord-halfFootprint,-coverageScale))/(2.*halfFootprint),0.,1.);
`;
export const frontFragment=`precision highp float;
varying float sideCoord,coverageScale,relativeDepth;
void main(){${coverageGLSL}if(cov<.001)discard;gl_FragColor=vec4(relativeDepth,0.,0.,1.);}`;
export const layerFragment=`precision highp float;
varying vec3 color0,color1,color2,color3;
varying float sideCoord,coverageScale,relativeDepth;
uniform sampler2D frontMap;
uniform vec2 viewport;
uniform float layerBase,layerStep;
layout(location=0) out vec4 layer0;
layout(location=1) out vec4 layer1;
layout(location=2) out vec4 layer2;
layout(location=3) out vec4 layer3;
void main(){
 ${coverageGLSL}
 if(cov<=.00001)discard;
 float opticalSide=clamp(sideCoord/max(coverageScale,1e-4),-.75,.75);
 float sc=(opticalSide+.75)*2.;
 vec3 col=sc<1.?mix(color0,color1,sc):(sc<2.?mix(color1,color2,sc-1.):mix(color2,color3,sc-2.));
 float front=texture(frontMap,gl_FragCoord.xy/viewport).r;
 float layer=clamp((relativeDepth-front)/layerStep,0.,7.);
 float tau=-log(max(1.-cov,.00001));
 vec4 q=vec4(max(col,vec3(0.))*tau,tau);
 layer0=q*max(0.,1.-abs(layer-layerBase));
 layer1=q*max(0.,1.-abs(layer-(layerBase+1.)));
 layer2=q*max(0.,1.-abs(layer-(layerBase+2.)));
 layer3=q*max(0.,1.-abs(layer-(layerBase+3.)));
}`;
export const resolveFragment=`precision highp float;
varying vec2 vUv;
uniform vec3 backdrop;
uniform sampler2D layer0,layer1,layer2,layer3,layer4,layer5,layer6,layer7;
void addLayer(vec4 q,inout vec3 col,inout float T){
 if(q.a>.00001){float tr=exp(-q.a);col+=T*(1.-tr)*q.rgb/q.a;T*=tr;}
}
void main(){vec3 col=vec3(0.);float T=1.;
 addLayer(texture2D(layer0,vUv),col,T);addLayer(texture2D(layer1,vUv),col,T);
 addLayer(texture2D(layer2,vUv),col,T);addLayer(texture2D(layer3,vUv),col,T);
 addLayer(texture2D(layer4,vUv),col,T);addLayer(texture2D(layer5,vUv),col,T);
 addLayer(texture2D(layer6,vUv),col,T);addLayer(texture2D(layer7,vUv),col,T);
 gl_FragColor=vec4(col+T*backdrop,1.);
}`;
