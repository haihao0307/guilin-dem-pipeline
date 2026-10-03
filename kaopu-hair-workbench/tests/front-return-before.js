/*
 * Original r04 tissue-lighting study. No third-party runtime/source code.
 * Geometry below deliberately retains the r03 H. magnifica tube construction.
 * Beer-Lambert attenuation + local single-scattering approximation, not a BSSRDF,
 * refraction solver, fluorescence model, measured tissue, or production claim.
 * References for the standard equations (independently implemented here):
 * https://pbr-book.org/4ed/Volume_Scattering/Transmittance
 * https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions
 * https://pbr-book.org/4ed/Reflection_Models/Roughness_Using_Microfacet_Theory
 */
(function(root){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=v=>{const length=Math.hypot(...v);if(length<1e-9)throw Error('Light direction must be nonzero');return v.map(x=>x/length);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const srgbToLinear=v=>v.map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4));
function freezeDeep(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeDeep);Object.freeze(value);}return value;}

// Hand-authored, photo-inspired appearance colors, NOT sampled/calibrated albedo.
// The cyan edge light in Wootton's flash/auto-WB image is not baked into pigment.
const PALETTES=freezeDeep({
 'wootton-olive-ivory':{
  label:'H. magnifica · pale olive / ivory',
  source:'https://commons.wikimedia.org/wiki/File:Heteractis_magnifica,_tent%C3%A1culos.jpg',
  credit:'Neville Wootton, CC BY 2.0, via Wikimedia Commons',
  license:'https://creativecommons.org/licenses/by/2.0/',
  observation:'Pale yellow-green shafts, broad milky tips, purple column. Flash and auto white balance; processing present. Cyan rim is not evidence of cyan albedo or fluorescence.',
  base:srgbToLinear([.61,.65,.38]),tip:srgbToLinear([.83,.85,.70]),
  column:srgbToLinear([.53,.28,.44]),disc:srgbToLinear([.48,.50,.29]),
  absorption:[1.05,.80,1.95],tipAbsorption:[.27,.24,.48],scattering:1.6
 },
 'pomfret-amber-yellow':{
  label:'H. magnifica · amber / yellow',
  source:'https://www.danielpomfret.co.uk/shop/macro-photography/heteractis-magnifica-magnificent-sea-anemone-maldives-009/',
  credit:'Daniel Pomfret; photograph is link-only, no reproduction license assumed',
  license:null,
  observation:'Amber-orange shafts graduating to yellow rounded tips, purple column. Lighting, white balance and processing are undocumented; this is an artistic appearance interpretation.',
  base:srgbToLinear([.70,.43,.18]),tip:srgbToLinear([.91,.76,.35]),
  column:srgbToLinear([.49,.24,.40]),disc:srgbToLinear([.51,.36,.18]),
  absorption:[.52,1.32,3.2],tipAbsorption:[.18,.43,1.2],scattering:1.55
 }
});
const DEBUG_MODES=freezeDeep({beauty:0,transmission:1,thickness:2,visibility:3,transmittance:4});
const DEFAULTS=freezeDeep({palette:'wootton-olive-ivory',transmission:1,lighting:'beauty',debug:'beauty',
 roughness:.47,wetness:.014,exposure:1.25,absorptionScale:1,scatteringScale:1,
 referenceDiameter:.06,phaseG:.32,keyIntensity:2.8,ambientIntensity:.20,
 shadowBias:.00065,shadowEnabled:false,shadowMapSize:1024,shadowTextureUnit:1});

const tentacleVertex=`#version 300 es
precision highp float;
layout(location=0) in vec2 param;
uniform highp sampler2D joints;
uniform mat4 vp;
out vec3 world;
out vec3 normal;
out float axial;
out float variation;
out vec3 tubeTangent;
out vec3 tubeRadial;
// x = local uncapped radius, y = local radial position, z = cap axial radius,
// w = signed axial distance from cap centre. All are in model/world units.
out vec4 tubeShape;
out float tubeShaftLength;
out vec2 tissueCoordinates;
vec3 center(int j,int id){return texelFetch(joints,ivec2(clamp(j,0,28),id),0).xyz;}
void main(){
 int id=gl_InstanceID;
 float radius=texelFetch(joints,ivec2(0,id),0).w;
 float curveLength=texelFetch(joints,ivec2(28,id),0).w;
 float capLength=radius/curveLength;
 float s=param.x<.85?param.x/.85*(1.-capLength):(1.-capLength)+capLength*(param.x-.85)/.15;
 float v=s*28.0;int j=int(floor(v));
 vec3 p=mix(center(j,id),center(j+1,id),fract(v));
 vec3 t=normalize(center(min(j+1,28),id)-center(max(j-1,0),id));
 // Same stable r03 orthonormal frame, including its antipodal branch.
 vec3 n;vec3 b;
 if(t.z<-.99999){n=vec3(0.,-1.,0.);b=vec3(-1.,0.,0.);}
 else{float k=1./(1.+t.z);n=vec3(1.-t.x*t.x*k,-t.x*t.y*k,-t.x);b=vec3(-t.x*t.y*k,1.-t.y*t.y*k,-t.y);}
 vec3 ring=b*cos(param.y)+n*sin(param.y);
 float cap=clamp((s-(1.-capLength))/capLength,0.,1.);
 float shaftProfile=(1.-.1*s)*(1.+.07*exp(-pow((s-.9)/.06,2.)));
 float profile=shaftProfile*sqrt(max(0.,1.-cap*cap));
 world=p+ring*radius*profile;
 normal=normalize(ring*sqrt(max(0.,1.-cap*cap))+t*cap);
 axial=s;variation=fract(sin(float(id)*127.1)*43758.5453);
 tubeTangent=t;tubeRadial=ring;
 tubeShape=vec4(radius*shaftProfile,radius*profile,radius,(s-(1.-capLength))*curveLength);
 tubeShaftLength=curveLength-radius;
 tissueCoordinates=vec2(cos(param.y),sin(param.y));
 gl_Position=vp*vec4(world,1.);
}`;

const bodyVertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 vertexNormal;
uniform mat4 vp;
out vec3 world;out vec3 normal;out float axial;out float variation;
out vec3 tubeTangent;out vec3 tubeRadial;out vec4 tubeShape;
out float tubeShaftLength;out vec2 tissueCoordinates;
void main(){
 world=position;normal=vertexNormal;axial=-1.;variation=0.;
 tubeTangent=vec3(0.,1.,0.);tubeRadial=vec3(1.,0.,0.);
 tubeShape=vec4(0.);tubeShaftLength=0.;tissueCoordinates=vec2(0.);
 gl_Position=vp*vec4(world,1.);
}`;

const shadowFragment=`#version 300 es
precision highp float;
void main(){}
`;

const fragment=`#version 300 es
precision highp float;
in vec3 world;in vec3 normal;in float axial;in float variation;
in vec3 tubeTangent;in vec3 tubeRadial;in vec4 tubeShape;
in float tubeShaftLength;in vec2 tissueCoordinates;
uniform vec3 eye;
uniform vec3 uBaseColor,uTipColor,uColumnColor,uDiscColor;
uniform vec3 uAbsorption,uTipAbsorption;
uniform float uScattering,uReferenceDiameter,uPhaseG;
uniform vec3 uLightDirection,uKeyRadiance,uAmbientRadiance;
uniform float uTransmission,uRoughness,uWetness,uExposure;
uniform int uDebugMode;
uniform highp sampler2D uShadowDepth;
uniform mat4 uLightVP;
uniform float uShadowEnabled,uShadowTexel,uShadowBias;
out vec4 color;
const float PI=3.141592653589793;

// Intersect an inward ray with a LOCAL finite cylinder + upper half ellipsoid.
// A rounded cap is not treated as a zero-radius cylinder. A cap ray directed
// along the shaft can travel through the shaft: tips are not uniformly thin.
// Centreline curvature/taper along this local chord are approximations.
float tissuePath(vec3 direction){
 vec3 t=normalize(tubeTangent);
 vec3 radial=normalize(tubeRadial-t*dot(tubeRadial,t));
 vec3 p=radial*tubeShape.y;
 float z=tubeShape.w;
 float dz=dot(direction,t);
 vec3 d=direction-t*dz;
 float r=max(tubeShape.x,.00001),h=max(tubeShape.z,.00001);
 float A=dot(d,d),B=dot(p,d),C=dot(p,p)-r*r;
 float hit=10000.;
 if(A>.000001){
  float discriminant=B*B-A*C;
  if(discriminant>=0.){
   float q=(-B+sqrt(discriminant))/A;
   float qz=z+q*dz;
   if(q>.000001&&qz<=.00001&&qz>=-tubeShaftLength-.00001)hit=q;
  }
 }
 // The ellipsoid's axial radius remains the original r03 cap length.
 float ea=A/(r*r)+dz*dz/(h*h);
 float eb=B/(r*r)+z*dz/(h*h);
 float ec=dot(p,p)/(r*r)+z*z/(h*h)-1.;
 float ed=eb*eb-ea*ec;
 if(ed>=0.&&ea>.000001){
  float q=(-eb+sqrt(ed))/ea;
  if(q>.000001&&z+q*dz>=-.00001)hit=min(hit,q);
 }
 if(dz<-.000001){
  float q=(-tubeShaftLength-z)/dz;
  if(q>.000001&&length(p+q*d)<=r+.00001)hit=min(hit,q);
 }
 return hit<9999.?clamp(hit,0.,tubeShaftLength+h):0.;
}

// Receiver-plane-aware comparison filtering over the existing orthographic
// DEPTH_COMPONENT map. Never interpolate raw depths across separate blockers.
// The four continuous weights per axis are a [1,2,1] tent convolved with
// bilinear comparison reconstruction: 16 fetches, rather than 36 duplicates.
float shadowVisibility(vec3 point,vec3 receiverNormal,float localRadius){
 vec4 clip=uLightVP*vec4(point,1.);
 vec3 q=clip.xyz/clip.w*.5+.5;
 if(any(lessThan(q,vec3(0.)))||any(greaterThan(q,vec3(1.))))return 0.;
 vec3 rx=vec3(uLightVP[0][0],uLightVP[1][0],uLightVP[2][0]);
 vec3 ry=vec3(uLightVP[0][1],uLightVP[1][1],uLightVP[2][1]);
 vec3 rz=vec3(uLightVP[0][2],uLightVP[1][2],uLightVP[2][2]);
 float sx=length(rx),sy=length(ry),sz=length(rz);
 vec3 receiver=normalize(receiverNormal);
 float nz=dot(receiver,rz/sz);
 float safeNz=(nz<0.?-1.:1.)*max(abs(nz),.12);
 // d(normalized depth)/d(shadow UV), not a single centre depth reused at
 // neighbouring texels. For an orthographic map this follows the plane equation.
 vec2 plane=-vec2(dot(receiver,rx/sx)*sz/sx,dot(receiver,ry/sy)*sz/sy)/safeNz;
 float worldTexel=max(2.*uShadowTexel/sx,2.*uShadowTexel/sy);
 float depthPerWorld=.5*sz;
 float radiusLimit=localRadius>0.?localRadius*.08:worldTexel*.5;
 float biasLimit=min(worldTexel*.5,radiusLimit);
 float slope=min(sqrt(max(0.,1.-nz*nz))/max(abs(nz),.12),2.);
 // uShadowBias remains an upper bound, not an unbounded additional offset.
 // Additional comparison bias <= 0.5 texel AND 8% of local tube radius.
 float biasWorld=min(min(uShadowBias/depthPerWorld,biasLimit),worldTexel*(.10+.18*slope));
 float bias=biasWorld*depthPerWorld;
 // Near a silhouette a plane is a poor model for a curved tube. Bound its
 // extrapolation separately; this is not permission to move the receiver.
 float planeLimit=min(worldTexel*2.,localRadius>0.?localRadius*.5:worldTexel*2.)*depthPerWorld;
 vec2 pixel=q.xy/uShadowTexel-.5;
 ivec2 base=ivec2(floor(pixel));
 vec2 f=fract(pixel);
 vec4 wx=vec4(1.-f.x,2.-f.x,1.+f.x,f.x);
 vec4 wy=vec4(1.-f.y,2.-f.y,1.+f.y,f.y);
 ivec2 size=textureSize(uShadowDepth,0);
 float result=0.;
 for(int y=0;y<4;y++)for(int x=0;x<4;x++){
  ivec2 texel=base+ivec2(x-1,y-1);
  if(any(lessThan(texel,ivec2(0)))||any(greaterThanEqual(texel,size)))continue;
  vec2 offset=(vec2(texel)+.5)*uShadowTexel-q.xy;
  float receiverDepth=q.z+clamp(dot(plane,offset),-planeLimit,planeLimit);
  float depth=texelFetch(uShadowDepth,texel,0).r;
  result+=wx[x]*wy[y]*step(receiverDepth-bias,depth);
 }
 return result/16.;
}
// Source-side EXIT of the unchanged local chord. Its normal is distinct from
// the visible-side normal; reusing that normal would correct the wrong plane.
// No derivatives are evaluated inside the non-uniform transmission branch.
float shadowVisibility(vec3 point){
 vec3 t=normalize(tubeTangent),l=normalize(uLightDirection);
 vec3 radial=normalize(tubeRadial-t*dot(tubeRadial,t));
 float escape=max(.002,tubeShape.x*.14);
 float chord=max(0.,dot(point-world,l)-escape);
 float z=tubeShape.w+chord*dot(l,t);
 vec3 p=radial*tubeShape.y+chord*(l-t*dot(l,t));
 vec3 entryNormal;
 if(z>0.)entryNormal=p/max(tubeShape.x*tubeShape.x,.00000001)+t*z/max(tubeShape.z*tubeShape.z,.00000001);
 else if(z<=-tubeShaftLength+.00001)entryNormal=-t;
 else entryNormal=p;
 if(dot(entryNormal,entryNormal)<.000000000001)entryNormal=l;
 return shadowVisibility(point,entryNormal,tubeShape.x);
}
vec3 fresnel(float cosine){return vec3(uWetness)+(vec3(1.)-vec3(uWetness))*pow(1.-cosine,5.);}
float ggx(vec3 n,vec3 v,vec3 l,float roughness){
 vec3 hv=l+v;if(dot(hv,hv)<.000001)return 0.;
 vec3 h=normalize(hv);
 float nl=max(dot(n,l),0.),nv=max(dot(n,v),.0001),nh=max(dot(n,h),0.);
 float a=roughness*roughness,a2=a*a;
 float denominator=nh*nh*(a2-1.)+1.;
 float distribution=a2/(PI*denominator*denominator);
 // Height-correlated Smith masking for an isotropic GGX distribution.
 float masking=.5/max(nl*sqrt(nv*nv*(1.-a2)+a2)+nv*sqrt(nl*nl*(1.-a2)+a2),.0001);
 return distribution*masking*nl;
}
float phaseHG(float cosine){
 float g=uPhaseG;
 return (1.-g*g)/(4.*PI*pow(max(1.+g*g-2.*g*cosine,.001),1.5));
}
vec3 linearToSRGB(vec3 c){
 vec3 low=c*12.92,high=1.055*pow(c,vec3(1./2.4))-.055;
 return mix(high,low,lessThanEqual(c,vec3(.0031308)));
}
void main(){
 vec3 n=normalize(normal),v=normalize(eye-world),l=normalize(uLightDirection);
 // Compute the actual rasterized receiver plane before any divergent branch.
 // Analytic shading normals remain untouched; only shadow comparisons use it.
 vec3 receiverNormal=cross(dFdx(world),dFdy(world));
 receiverNormal=dot(receiverNormal,receiverNormal)>.000000000001?normalize(receiverNormal):n;
 float nv=max(dot(n,v),.001),nl=dot(n,l);
 bool tentacle=axial>=0.;
 vec2 uv=tissueCoordinates;
 // Low-contrast, attached-to-tissue unevenness; no borrowed bubble-tip stripes.
 float mottling=sin(axial*47.+variation*19.+uv.x*2.3)*sin(axial*19.-uv.y*3.1+variation*31.);
 float tip=tentacle?smoothstep(.73+variation*.045,.99,axial+mottling*.006):0.;
 vec3 base;
 if(tentacle){
  base=mix(uBaseColor*(.94+.12*variation),uTipColor,tip);
  base*=1.+mottling*.035;
 }else{
  base=mix(uColumnColor,uDiscColor,smoothstep(.16,.48,world.y));
  if(length(world.xz)<.04&&world.y>.47)base*=.30;
 }
 float roughness=clamp(uRoughness+tip*.06+mottling*.023+(variation-.5)*.025,.32,.72);
 // Artistic falloff for the dim environmental fill, not ambient occlusion.
 float ambientAccess=mix(.24,1.,smoothstep(.38,1.06,world.y));
 float shadow=uShadowEnabled>.5?shadowVisibility(world,receiverNormal,tentacle?tubeShape.x:0.):1.;
 vec3 surfaceF=fresnel(max(dot(v,normalize(l+v+vec3(.000001))),0.));
 vec3 reflected=base*(vec3(1.)-surfaceF)*(.82*max(nl,0.)/PI)*uKeyRadiance*shadow;
 reflected+=surfaceF*ggx(n,v,l,roughness)*uKeyRadiance*shadow;
 // A broad, dim cool water fill. It is lighting, not a cyan material/emission.
 reflected+=base*uAmbientRadiance*ambientAccess*(.62+.38*max(n.y,0.));
 vec3 transmitted=vec3(0.),beam=vec3(0.);
 float path=0.,entryVisibility=0.;
 if(tentacle&&nl<0.){
  path=tissuePath(l);
  vec3 sigmaA=mix(uAbsorption,uTipAbsorption,tip)*(1.+mottling*.075);
  float sigmaS=uScattering*mix(1.,.90,tip);
  float opticalDistance=path/uReferenceDiameter;
  // Actual Beer-Lambert beam transmittance in a homogeneous local chord.
  beam=exp(-(sigmaA+vec3(sigmaS))*opticalDistance);
  // sigma_s*d*exp(-sigma_t*d): one-scattering straight-chord approximation.
  // No unlit emission; both direction and source-side light visibility matter.
  vec3 singleScatter=vec3(sigmaS*opticalDistance)*beam;
  float phase=phaseHG(dot(-l,v));
  float sourceCosine=max(-nl,0.);
  vec3 sourceSide=world+l*(path+max(.002,tubeShape.x*.14));
  // Without a light depth pass we cannot establish that the entry is lit.
  // Conservatively omit transmission instead of faking buried-tip visibility.
  entryVisibility=uShadowEnabled>.5?shadowVisibility(sourceSide):0.;
  transmitted=uKeyRadiance*singleScatter*phase*sourceCosine*entryVisibility*uTransmission*2.4;
 }
 vec3 result=reflected+transmitted;
 if(uDebugMode==1)result=transmitted;
 if(uDebugMode==2){
  float viewPath=tentacle?tissuePath(-v):0.;
  // Black = zero, white = one reference diameter. Linear diagnostic values.
  color=vec4(vec3(clamp(viewPath/uReferenceDiameter,0.,1.)),1.);return;
 }
 if(uDebugMode==3){color=vec4(shadow,entryVisibility,0.,1.);return;}
 if(uDebugMode==4){color=vec4(beam,1.);return;}
 // Exponential shoulder in linear light, then exact sRGB transfer.
 result=vec3(1.)-exp(-max(result,vec3(0.))*uExposure);
 color=vec4(linearToSRGB(result),1.);
}`;

function checkedNumber(value,name,min,max){if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid optical '+name);return value;}
function options(input={}){
 const o={...DEFAULTS,...input};
 if(!Object.hasOwn(PALETTES,o.palette))throw Error('Unknown photo-inspired palette');
 if(!['beauty','front','back'].includes(o.lighting))throw Error('Unknown lighting preset');
 if(!Object.hasOwn(DEBUG_MODES,o.debug))throw Error('Unknown optical debug mode');
 for(const [key,min,max]of [['transmission',0,1],['roughness',.32,.72],['wetness',0,.06],['exposure',.1,4],['absorptionScale',0,4],['scatteringScale',0,4],['referenceDiameter',.005,.25],['phaseG',0,.65],['keyIntensity',0,8],['ambientIntensity',0,1],['shadowBias',0,.01],['shadowMapSize',64,8192],['shadowTextureUnit',0,15]])checkedNumber(o[key],key,min,max);
 if(typeof o.shadowEnabled!=='boolean')throw Error('shadowEnabled must be boolean');
 if(o.shadowTextureUnit!==1||o.shadowMapSize!==1024)throw Error('Shadow resources are fixed: texture unit 1, map size 1024');
 return o;
}
function lighting(mode='beauty',eye=[.5,3.5,3.3],target=[0,.55,0]){
 if(mode==='beauty')return norm([-.55,.50,-.66]);
 const view=norm(eye.map((x,i)=>x-target[i]));
 if(mode==='front')return view;
 if(mode==='back')return view.map(x=>-x);
 throw Error('Unknown lighting preset');
}
function lightMatrix(direction,center=[0,.62,0],extent=2.55){
 const z=norm(direction),up=Math.abs(z[1])>.96?[0,0,1]:[0,1,0],x=norm(cross(up,z)),y=cross(z,x);
 const eye=center.map((c,i)=>c+z[i]*4.5);
 const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
 const near=.1,far=9.;
 const p=[1/extent,0,0,0,0,1/extent,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1];
 const out=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=p[k*4+r]*view[c*4+k];
 return out;
}
const locationCache=new WeakMap();
function applyUniforms(gl,program,input={},view={}){
 const o=options(input),p=PALETTES[o.palette];
 let cache=locationCache.get(program);if(!cache){cache=new Map();locationCache.set(program,cache);}
 const loc=name=>{if(!cache.has(name))cache.set(name,gl.getUniformLocation(program,name));return cache.get(name);};
 const f=(name,value)=>gl.uniform1f(loc(name),value),v3=(name,value)=>gl.uniform3fv(loc(name),value);
 const direction=view.lightDirection?norm(view.lightDirection):lighting(o.lighting,view.eye,view.target);
 const matrix=view.lightVP||lightMatrix(direction);
 v3('uBaseColor',p.base);v3('uTipColor',p.tip);v3('uColumnColor',p.column);v3('uDiscColor',p.disc);
 v3('uAbsorption',p.absorption.map(x=>x*o.absorptionScale));v3('uTipAbsorption',p.tipAbsorption.map(x=>x*o.absorptionScale));
 v3('uLightDirection',direction);v3('uKeyRadiance',[1.,.975,.91].map(x=>x*o.keyIntensity));
 v3('uAmbientRadiance',[.66,.84,.91].map(x=>x*o.ambientIntensity));
 f('uScattering',p.scattering*o.scatteringScale);f('uReferenceDiameter',o.referenceDiameter);f('uPhaseG',o.phaseG);
 f('uTransmission',o.transmission);f('uRoughness',o.roughness);f('uWetness',o.wetness);f('uExposure',o.exposure);
 f('uShadowEnabled',o.shadowEnabled?1:0);f('uShadowTexel',1/o.shadowMapSize);f('uShadowBias',o.shadowBias);
 gl.uniform1i(loc('uShadowDepth'),o.shadowTextureUnit);gl.uniform1i(loc('uDebugMode'),DEBUG_MODES[o.debug]);
 gl.uniformMatrix4fv(loc('uLightVP'),false,matrix);
 return {options:o,lightDirection:direction,lightVP:matrix};
}

// CPU reference kernels support honest equation/edge-case tests. They do not
// stand in for shader compilation, shadow-pass or real-pixel browser validation.
function beerLambert(distance,absorption,scattering,referenceDiameter=.06){
 checkedNumber(distance,'distance',0,100);checkedNumber(scattering,'scattering',0,100);
 checkedNumber(referenceDiameter,'referenceDiameter',.00001,100);
 if(!Array.isArray(absorption)||absorption.length!==3)throw Error('absorption must be RGB');
 const d=distance/referenceDiameter;
 const beam=absorption.map(a=>Math.exp(-(checkedNumber(a,'absorption',0,100)+scattering)*d));
 return {beam,singleScatter:beam.map(t=>scattering*d*t)};
}
function localPath({radialRadius:r,capRadius:h,radialPosition:rho,axialPosition:z,shaftLength},direction){
 for(const [name,value]of Object.entries({r,h,rho,shaftLength}))checkedNumber(value,name,0,100);
 if(r<=0||h<=0||!Number.isFinite(z))throw Error('Invalid local tissue geometry');
 const [dx,dy,dz]=norm(direction),A=dx*dx+dy*dy,B=rho*dx,C=rho*rho-r*r;
 let hit=10000;
 if(A>1e-6){const discriminant=B*B-A*C;if(discriminant>=0){const q=(-B+Math.sqrt(discriminant))/A,qz=z+q*dz;if(q>1e-6&&qz<=1e-5&&qz>=-shaftLength-1e-5)hit=q;}}
 const ea=A/(r*r)+dz*dz/(h*h),eb=B/(r*r)+z*dz/(h*h),ec=rho*rho/(r*r)+z*z/(h*h)-1,ed=eb*eb-ea*ec;
 if(ed>=0&&ea>1e-6){const q=(-eb+Math.sqrt(ed))/ea;if(q>1e-6&&z+q*dz>=-1e-5)hit=Math.min(hit,q);}
 if(dz<-1e-6){const q=(-shaftLength-z)/dz;if(q>1e-6&&Math.hypot(rho+q*dx,q*dy)<=r+1e-5)hit=Math.min(hit,q);}
 return hit<9999?clamp(hit,0,shaftLength+h):0;
}
// CPU mirrors of the shadow comparison kernel only. These are test oracles for
// the plane/footprint/weight arithmetic, not evidence of GPU image quality.
function shadowReceiver(lightVP,receiverNormal,localRadius,texel,depthBias){
 const n=norm(receiverNormal),rx=[lightVP[0],lightVP[4],lightVP[8]],ry=[lightVP[1],lightVP[5],lightVP[9]],rz=[lightVP[2],lightVP[6],lightVP[10]];
 const sx=Math.hypot(...rx),sy=Math.hypot(...ry),sz=Math.hypot(...rz);
 if(![sx,sy,sz].every(x=>Number.isFinite(x)&&x>0))throw Error('Invalid orthographic shadow frame');
 checkedNumber(localRadius,'localRadius',0,100);checkedNumber(texel,'shadow texel',.000001,1);checkedNumber(depthBias,'shadow bias',0,1);
 const nz=dot(n,rz.map(x=>x/sz)),safeNz=(nz<0?-1:1)*Math.max(Math.abs(nz),.12);
 const plane=[-dot(n,rx.map(x=>x/sx))*sz/sx/safeNz,-dot(n,ry.map(x=>x/sy))*sz/sy/safeNz];
 const worldTexel=Math.max(2*texel/sx,2*texel/sy),depthPerWorld=.5*sz;
 const biasLimit=Math.min(worldTexel*.5,localRadius>0?localRadius*.08:worldTexel*.5);
 const slope=Math.min(Math.sqrt(Math.max(0,1-nz*nz))/Math.max(Math.abs(nz),.12),2);
 const biasWorld=Math.min(depthBias/depthPerWorld,biasLimit,worldTexel*(.10+.18*slope));
 const planeLimitWorld=Math.min(worldTexel*2,localRadius>0?localRadius*.5:worldTexel*2);
 return {plane,worldTexel,depthPerWorld,biasLimit,biasWorld,bias:biasWorld*depthPerWorld,planeLimitWorld,planeLimit:planeLimitWorld*depthPerWorld};
}
function shadowVisibilityReference({uv,depth,width,height,receiver,depthAt}){
 if(uv.some(x=>x<0||x>1)||depth<0||depth>1)return 0;
 const pixel=[uv[0]*width-.5,uv[1]*height-.5],base=pixel.map(Math.floor),f=pixel.map((x,i)=>x-base[i]);
 const weights=f.map(x=>[1-x,2-x,1+x,x]);let result=0;
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
  const tx=base[0]+x-1,ty=base[1]+y-1;if(tx<0||ty<0||tx>=width||ty>=height)continue;
  const offset=[(tx+.5)/width-uv[0],(ty+.5)/height-uv[1]];
  const receiverDepth=depth+clamp(dot(receiver.plane,offset),-receiver.planeLimit,receiver.planeLimit);
  result+=weights[0][x]*weights[1][y]*(receiverDepth-receiver.bias<=depthAt(tx,ty)?1:0);
 }
 return result/16;
}
const api={revision:'r04-tissue-optics',tentacleVertex,vertex:tentacleVertex,bodyVertex,fragment,shadowFragment,
 PALETTES,DEFAULTS,DEBUG_MODES,options,lighting,lightMatrix,applyUniforms,beerLambert,localPath,srgbToLinear,shadowReceiver,shadowVisibilityReference};
root.AnemoneOptics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
