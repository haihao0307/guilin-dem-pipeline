/** R05: same 81-node optical evaluation, coalesced geometry passes, modal displacement.
 * No material replacement, random coverage, opacity floor or whole-image blur.
 */
import {positionFragment,fragment,shadowFragment} from '../fiber-r02/shaders.mjs';
import {stableVertex,layerFragment,nodeRadianceFragment} from '../fiber-r03/stability.mjs';
const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Shader anchor missing: '+a);return s.replace(a,b);};
const field=`
uniform sampler2D guideMotion,modalBasis;uniform bool guideLinear;
vec3 atGuide(ivec2 at,int m){return texelFetch(guideMotion,at+ivec2(0,m*5),0).xyz;}
vec3 sampleGuide(vec2 root,int m){
 vec2 v=clamp(vec2((root.x+.031)/.062*16.,(root.y+.006)/.012*4.),vec2(0.),vec2(16.,4.));
 if(guideLinear)return texture2D(guideMotion,(v+vec2(.5,.5+float(m*5)))/vec2(17.,15.)).xyz;
 ivec2 a=min(ivec2(floor(v)),ivec2(15,3));vec2 f=v-vec2(a);
 return mix(mix(atGuide(a,m),atGuide(a+ivec2(1,0),m),f.x),mix(atGuide(a+ivec2(0,1),m),atGuide(a+ivec2(1,1),m),f.x),f.y);
}
vec3 bendOffset(vec2 root,int node){vec3 b=texelFetch(modalBasis,ivec2(node,0),0).xyz;return sampleGuide(root,0)*b.x+sampleGuide(root,1)*b.y+sampleGuide(root,2)*b.z;}
`;
export const movingPositionFragment=replace(replace(positionFragment,'vec4 rootData,trait;','vec4 rootData,trait;\n'+field),'gl_FragColor=vec4(curve(float(node)/80.0),1.0);','gl_FragColor=vec4(curve(float(node)/80.0)+bendOffset(rootData.xy,node),1.0);');
export const fastStableVertex=stableVertex;
// Hoist view/material invariants out of the THREE light evaluations; equations retained.
const preparation=`
float pSo,pCo,pH,pGo,pGt,pV,pS,pTheta;vec3 pN,pB,pAr,pAtt,pAtrt,pTail;
void prepareFiber(vec3 T,vec3 V,vec3 absorption){
 pSo=clamp(dot(T,V),-.999,.999);pCo=sqrt(1.-pSo*pSo);
 pN=normalize(V-T*pSo);pB=normalize(cross(T,pN));
 pH=mix(seedValue*1.8-.9,clamp(sideCoord,-.96,.96),smoothstep(.60,1.,coverageScale));
 pGo=asin(pH);float etaP=sqrt(1.55*1.55-pSo*pSo)/pCo;pGt=asin(clamp(pH/etaP,-.99,.99));
 float ct=sqrt(1.-sq(pSo/1.55));vec3 Tr=exp(-absorption*(2.*cos(pGt)/ct));
 float f=fresnel(pCo*sqrt(1.-pH*pH));pAr=vec3(f);pAtt=sq(1.-f)*Tr;pAtrt=pAtt*Tr*f;pTail=pAtrt*Tr*f/max(vec3(.0001),vec3(1.)-Tr*f);
 float bm=clamp(roughness*(.93+.14*seedValue),.18,.58),bn=.43;
 pV=sq(.726*bm+.812*bm*bm+3.7*pow(bm,20.));pS=.6266571*(.265*bn+1.194*bn*bn+5.372*pow(bn,22.));pTheta=asin(pSo);
}
vec3 fiber(vec3 T,vec3 V,vec3 L,vec3 absorption){
 float si=clamp(dot(T,L),-.999,.999),ci=sqrt(1.-si*si),phi=atan(dot(L,pB),dot(L,pN)),alpha=.035;
 float r=longitudinal(si,ci,sin(pTheta-2.*alpha),abs(cos(pTheta-2.*alpha)),pV)*azimuth(phi,-2.*pGo,pS);
 float tt=longitudinal(si,ci,sin(pTheta+alpha),abs(cos(pTheta+alpha)),.25*pV)*azimuth(phi,2.*pGt-2.*pGo+PI,pS);
 float trt=longitudinal(si,ci,sin(pTheta+4.*alpha),abs(cos(pTheta+4.*alpha)),4.*pV)*azimuth(phi,4.*pGt-2.*pGo+2.*PI,pS);
 vec3 internal=pAtt*tt+pAtrt*trt+pTail*longitudinal(si,ci,pSo,pCo,4.*pV)/(2.*PI);
 if(mode>.5&&mode<1.5)return pAr*r;if(mode>1.5&&mode<2.5)return internal;return pAr*r+internal;
}
`;
let radiance=nodeRadianceFragment;
const start=radiance.indexOf('vec3 fiber('),end=radiance.indexOf('float channel(');if(start<0||end<=start)throw Error('Optics anchors missing');
radiance=radiance.slice(0,start)+preparation+radiance.slice(end);
radiance=replace(radiance,'for(int i=0;i<3;i++){','prepareFiber(T,V,absorption);\n for(int i=0;i<3;i++){');
export const fastNodeRadianceFragment=radiance;
let all=layerFragment.replace('layout(location=3) out vec4 layer3;','layout(location=3) out vec4 layer3;\nlayout(location=4) out vec4 layer4;\nlayout(location=5) out vec4 layer5;\nlayout(location=6) out vec4 layer6;\nlayout(location=7) out vec4 layer7;');
all=all.replace(/layerBase/g,'0.');
all=replace(all,'layer3=q*max(0.,1.-abs(layer-(0.+3.)));','layer3=q*max(0.,1.-abs(layer-3.));\n layer4=q*max(0.,1.-abs(layer-4.));layer5=q*max(0.,1.-abs(layer-5.));layer6=q*max(0.,1.-abs(layer-6.));layer7=q*max(0.,1.-abs(layer-7.));');
all=all.replace('uniform float 0.,layerStep;','uniform float layerStep;');
export const layer8Fragment=all;
export const shadowPairFragment=`precision highp float;
varying float sideCoord,coverageScale;
layout(location=0) out vec4 nearOpacity;layout(location=1) out vec4 farOpacity;
void main(){float aa=max(fwidth(sideCoord),.02),cov=coverageScale*(1.-smoothstep(1.-aa,1.+aa,abs(sideCoord)));float z=gl_FragCoord.z;
 nearOpacity=cov*clamp((vec4(.125,.25,.375,.5)-vec4(z))*128.+.5,0.,1.);
 farOpacity=cov*clamp((vec4(.625,.75,.875,1.)-vec4(z))*128.+.5,0.,1.);}`;
export const packShadowFragment=`precision highp float;varying vec2 vUv;uniform sampler2D nearMap,farMap;
void main(){ivec2 at=ivec2(gl_FragCoord.xy);gl_FragColor=at.x<384?texelFetch(nearMap,at,0):texelFetch(farMap,at-ivec2(384,0),0);}`;
