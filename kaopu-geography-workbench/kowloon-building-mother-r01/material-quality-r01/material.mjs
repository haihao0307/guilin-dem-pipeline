/** Mesh-free material receiver. All field coordinates and microheight are metres.
 * Original timber functions and the original R07 66-function closure are retained.
 * Finishes are explicit design choices, NOT surveyed Kowloon material evidence.
 */
import {MOTHER_GLSL,MOTHER_SHA256,HOSTED_MATERIAL_DEFAULTS as R07_DEFAULTS,adaptHostedMaterialParameters as adaptR07} from '../r07/material.mjs';
import {TIMBER_FIELD_GLSL,TIMBER_EVALUATION_GLSL,TIMBER_CAPTURED_PARAMETERS} from './sources/timber-field-source.mjs';
export {MOTHER_GLSL,MOTHER_SHA256};
export {glassAbsorptionTransmittance,dielectricFresnel} from '../r07/material.mjs';
export const MATERIAL_MODES=Object.freeze({metal:0,wood:1,paintedWood:2});
export const HOSTED_MATERIAL_DEFAULTS=Object.freeze({...R07_DEFAULTS,
 frameMaterialMode:2,doorMaterialMode:1,woodScale:5.8,woodReliefM:.00020,
 woodRoughness:.57,woodClearcoat:.25,woodClearcoatRoughness:.32,
 paintRoughness:.31,paintClearcoat:.45,paintClearcoatRoughness:.23,paintReliefM:.000018,studyLighting:1,studyExposure:1,studyAreaStrength:1,studyEnvironmentStrength:1,localContactVisibility:1});
const RANGES=Object.freeze({frameMaterialMode:[0,2],doorMaterialMode:[0,2],woodScale:[.25,12],woodReliefM:[0,.00042],woodRoughness:[.18,.98],woodClearcoat:[0,1],woodClearcoatRoughness:[.06,1],paintRoughness:[.08,.98],paintClearcoat:[0,1],paintClearcoatRoughness:[.06,1],paintReliefM:[0,.00006],studyLighting:[0,1],studyExposure:[.25,4],studyAreaStrength:[0,2],studyEnvironmentStrength:[0,2],localContactVisibility:[0,1]});
export function adaptHostedMaterialParameters(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('Material parameters must be an object');
 const out=adaptR07(input);
 for(const[k,[lo,hi]]of Object.entries(RANGES)){const v=input[k]??HOSTED_MATERIAL_DEFAULTS[k];if(!Number.isFinite(v)||v<lo||v>hi||(k.endsWith('Mode')&&!Number.isInteger(v)))throw RangeError(k+' outside supported material range');out[k]=v;}
 return out;
}
export const MATERIAL_UNIFORM_BINDINGS=Object.freeze({
 uFrameColor:'frameColor',uDoorColor:'doorColor',uGlassColor:'glassColor',uFrameRoughness:'frameRoughness',uFrameMetallic:'frameMetallic',uGlassTransmission:'glassTransmission',uGlassIOR:'glassIOR',
 uFrameMaterialMode:'frameMaterialMode',uDoorMaterialMode:'doorMaterialMode',uWoodScale:'woodScale',u_microReliefM:'woodReliefM',uWoodRoughness:'woodRoughness',u_clearcoat:'woodClearcoat',uWoodClearcoatRoughness:'woodClearcoatRoughness',uPaintRoughness:'paintRoughness',uPaintClearcoat:'paintClearcoat',uPaintClearcoatRoughness:'paintClearcoatRoughness',uPaintReliefM:'paintReliefM',uStudyLighting:'studyLighting',uStudyExposure:'studyExposure',uStudyAreaStrength:'studyAreaStrength',uStudyEnvironmentStrength:'studyEnvironmentStrength',uLocalContactVisibility:'localContactVisibility'});
/** Aperture coefficients are already on texture unit 7 in the hosted renderer.
 * This private sampler alias works in baseline mode too, without referring to
 * aperture GLSL functions that do not exist in the baseline shader.
 */
export function bindHostedMaterialUniforms(gl,program,options={}){
 const p=adaptHostedMaterialParameters(options);
 for(const[name,key]of Object.entries(MATERIAL_UNIFORM_BINDINGS)){const loc=gl.getUniformLocation(program,name);if(loc===null)continue;Array.isArray(p[key])?gl.uniform3fv(loc,p[key]):gl.uniform1f(loc,p[key]);}
 const loc=gl.getUniformLocation(program,'uMaterialApertureDescriptors');if(loc!==null)gl.uniform1i(loc,7);
 return p;
}
const f=v=>Number.isInteger(v)?`${v}.0`:String(v);
const glslValue=v=>Array.isArray(v)?`vec${v.length}(${v.map(f).join(',')})`:f(v);
const dynamic=new Set(['u_clearcoat','u_microReliefM','u_cameraPosition','u_distanceFadeStart','u_distanceFadeEnd']);
const capturedConstants=Object.entries(TIMBER_CAPTURED_PARAMETERS).filter(([k])=>!dynamic.has(k)).map(([k,v])=>`const ${Array.isArray(v)?'vec'+v.length:'float'} ${k}=${glslValue(v)};`).join('\n');
// Only this explicit adapter substitution differs from the exact evaluation
// section. Pixel footprint is in physical metres, not a fake camera distance.
const evaluated=TIMBER_EVALUATION_GLSL.replace('    float distanceToCamera = length(u_cameraPosition - v_worldPosition);\n    float detailFade = 1.0 - smoothstep(u_distanceFadeStart, u_distanceFadeEnd, distanceToCamera);','    float detailFade = 1.0 - smoothstep(0.00035, 0.004, footprintM);');
if(evaluated===TIMBER_EVALUATION_GLSL)throw Error('Original timber evaluation source drift');
export const MATERIAL_GLSL=String.raw`
struct FieldSurface {vec3 baseColor;float roughness;float metallic;float height;float clearcoat;float clearcoatRoughness;float cavity;};
uniform float uAge,uWet,uMaterialEnabled;
uniform vec3 uFrameColor,uDoorColor,uGlassColor;
uniform float uFrameRoughness,uFrameMetallic,uGlassTransmission,uGlassIOR;
uniform float uFrameMaterialMode,uDoorMaterialMode,uWoodScale,u_microReliefM,uWoodRoughness,u_clearcoat,uWoodClearcoatRoughness;
uniform float uPaintRoughness,uPaintClearcoat,uPaintClearcoatRoughness,uPaintReliefM;
uniform float uStudyLighting,uStudyExposure,uStudyAreaStrength,uStudyEnvironmentStrength,uLocalContactVisibility;
${capturedConstants}
${TIMBER_FIELD_GLSL}
// One chart per rail/stile. Charts move rigidly with their actual aperture part.
// Diagonal assignment is an approximate mitred joint, not fabricated joinery.
#if FIELD_HOSTED
uniform highp sampler2D uMaterialApertureDescriptors;
vec4 materialApertureRecord(int i){ivec2 size=textureSize(uMaterialApertureDescriptors,0);return texelFetch(uMaterialApertureDescriptors,ivec2(i%size.x,i/size.x),0);}
#endif
void materialMemberChart(FieldHit h,vec3 n,out vec3 g,out vec3 gn,out bool solidDoor){
 g=h.local.yxz;gn=n.yxz;solidDoor=h.materialRole>4.5;
 #if FIELD_HOSTED
 int count=int(materialApertureRecord(0).x);
 for(int k=0;k<count;k++){
  int b=1+9*k;if(abs(materialApertureRecord(b+1).w-h.objectId)>.1)continue;
  vec4 outer=materialApertureRecord(b+4),inner=materialApertureRecord(b+6);
  bool ring=materialApertureRecord(b).w>.5;solidDoor=!ring&&h.materialRole>4.5;
  vec3 q=h.local-vec3(outer.xy,0.);
  if(!ring){g=q.yxz;gn=n.yxz;return;}
  vec2 edge=outer.zw-abs(q.xy);
  vec2 side=vec2(q.x<0.?-1.:1.,q.y<0.?-1.:1.);
  vec2 innerBoundary=inner.xy-outer.xy+side*inner.zw;
  bool hasHorizontal=side.y*innerBoundary.y<outer.w-.00001;
  bool horizontal=edge.y<edge.x&&hasHorizontal;
  vec2 centerLine=(side*outer.zw+innerBoundary)*.5;
  if(horizontal){g=vec3(q.x,q.y-centerLine.y,q.z);gn=n;}
  else{g=vec3(q.y,q.x-centerLine.x,q.z);gn=n.yxz;}
  return;
 }
 #endif
}
FieldSurface evaluateTimberField(vec3 grainMetres,vec3 grainNormal,float footprintM){
 vec3 g=grainMetres*uWoodScale,localNormal=normalize(grainNormal);
 float surfaceClass=step(.72,abs(localNormal.x));
 vec3 baseColor=u_agedSurfaceColor;float heightMeters=0.,roughness=uWoodRoughness,cavity=1.,ringCoordinateDebug=0.;
 ${evaluated}
 return FieldSurface(clamp(baseColor,0.,1.),roughness,0.,clamp(heightMeters,-.001,.001),u_clearcoat,uWoodClearcoatRoughness,cavity);
}
FieldSurface paintTimberField(FieldSurface wood,vec3 g,vec3 paintColor,float fp){
 // Opaque coating never leaks wood ALBEDO. Bounded wood relief can telegraph
 // through it, independently of the coating's orange-peel micro-normal.
 float gate=1.-smoothstep(.0003,.0015,fp);
 float orange=sin(g.x*TAU/.0017)*sin(g.y*TAU/.0011)*.5;
 float brush=sin(g.y*TAU/.0031+sin(g.x*TAU/.12)*.12)*.5;
 float h=wood.height*.12+(orange*.65+brush*.35)*uPaintReliefM*gate;
 return FieldSurface(clamp(paintColor,0.,1.),clamp(uPaintRoughness+orange*.035*gate,.08,.98),0.,h,uPaintClearcoat,uPaintClearcoatRoughness,1.);
}
FieldSurface sampleFieldMaterial(FieldHit hit,vec3 n,float footprint){
 vec3 p=hit.local;float fp=max(footprint,.00012);
 vec2 uv=abs(n.y)>.6?p.xz:(abs(n.x)>abs(n.z)?vec2(p.z,p.y):p.xy);
 if(hit.materialRole>5.5)return FieldSurface(uGlassColor,.08,0.,0.,0.,1.,1.);
 if(hit.materialRole>3.5){
  vec3 grain,gn;bool door;materialMemberChart(hit,n,grain,gn,door);
  vec3 color=door?uDoorColor:uFrameColor;float mode=door?uDoorMaterialMode:uFrameMaterialMode;
  if(mode<.5)return FieldSurface(color,uFrameRoughness,uFrameMetallic,0.,0.,1.,1.);
  FieldSurface wood=evaluateTimberField(grain,gn,fp);
  if(mode>1.5)return paintTimberField(wood,grain,color,fp);return wood;
 }
 if(hit.materialRole>2.5)return FieldSurface(vec3(.17,.39,.43),.3,.65,0.,0.,1.,1.);
 if(uMaterialEnabled<.5)return FieldSurface(hit.materialRole>1.5?vec3(.66,.61,.51):vec3(.53,.55,.50),.82,0.,0.,0.,1.,1.);
 KpSurface s;
 if(hit.materialRole>1.5){
  KpPlasterParams a=KpPlasterParams(vec2(0.,1.35),vec2(2.,1.5),.0165,.0014,0.,.013,.02,.0001,vec3(.48,.44,.35),vec3(.82,.76,.64),.0008,.000008,.018);
  s=kpPlasterOriginalField(vec3(uv,0.),a,fp).surface;
 }else s=kpConcreteStation(vec3(uv,0.),uAge,uWet,.04,fp);
 return FieldSurface(s.albedo,clamp(s.roughness,.07,1.),0.,s.height,0.,1.,1.);
}
vec3 fresnelSchlick(float v,vec3 f0){return f0+(1.-f0)*pow(clamp(1.-v,0.,1.),5.);}
float mqSmithG1(float n,float alpha2){return 2.*n/max(n+sqrt(alpha2+(1.-alpha2)*n*n),.000001);}
vec3 mqGGX(float roughness,vec3 f0,float nv,float nl,float nh,float vh){
 float a=max(roughness*roughness,.0036),a2=a*a,den=nh*nh*(a2-1.)+1.;
 float D=a2/max(PI*den*den,.000000000001),G=mqSmithG1(nv,a2)*mqSmithG1(nl,a2);
 return D*G*fresnelSchlick(vh,f0)/max(4.*nv*nl,.000001);
}
vec3 directBRDF(FieldSurface s,vec3 n,vec3 v,vec3 l,vec3 radiance){
 float nv=dot(n,v),nl=dot(n,l);if(nv<=0.||nl<=0.)return vec3(0.);
 vec3 h=normalize(v+l);float nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
 vec3 f0=mix(vec3(.04),s.baseColor,s.metallic),F=fresnelSchlick(vh,f0);
 vec3 base=mqGGX(s.roughness,f0,nv,nl,nh,vh)+(1.-F)*(1.-s.metallic)*s.baseColor/PI;
 // A dielectric top layer costs substrate energy on BOTH traversals. Never
 // add an unaccounted decorative coat highlight on top of the unchanged base.
 float coat=clamp(s.clearcoat,0.,1.);
 float transmission=(1.-coat*fresnelSchlick(nv,vec3(.04)).x)*(1.-coat*fresnelSchlick(nl,vec3(.04)).x);
 vec3 clear=mqGGX(s.clearcoatRoughness,vec3(.04),nv,nl,nh,vh)*coat;
 return (base*transmission+clear)*radiance*nl;
}
/** Approximate ambient receiver; caller must use instead of unattenuated base
 * ambient if claiming the coating is energy-accounted outside direct lights. */
vec3 materialAmbient(FieldSurface s,vec3 n,vec3 v,vec3 diffuseEnvironment){
 float exit=1.-s.clearcoat*fresnelSchlick(max(dot(n,v),0.),vec3(.04)).x;
 float entry=1.-s.clearcoat*.085714286; // cosine-weighted Schlick hemispheric mean
 return s.baseColor*(1.-s.metallic)*diffuseEnvironment*exit*entry*clamp(s.cavity,0.,1.);
}
// Fixed, authored material-inspection lighting. No photographed environment,
// no camera-follow light, no scene mesh, and no per-finish exposure correction.
struct MaterialLightFrame{vec3 origin;vec3 u;vec3 v;vec3 w;};
MaterialLightFrame materialLightFrame(){
 MaterialLightFrame f;f.origin=vec3(0.);f.u=vec3(1,0,0);f.v=vec3(0,1,0);f.w=vec3(0,0,1);
 #if FIELD_HOSTED
 if(materialApertureRecord(0).x>.5){f.origin=materialApertureRecord(1).xyz;f.u=materialApertureRecord(2).xyz;f.v=materialApertureRecord(3).xyz;f.w=materialApertureRecord(4).xyz;}
 #endif
 return f;
}
vec3 materialLightPoint(MaterialLightFrame f,vec3 q){return f.origin+q.x*f.u+q.y*f.v+q.z*f.w;}
vec3 materialStudySkyInFrame(vec3 d,MaterialLightFrame f){
 vec3 q=vec3(dot(d,f.u),dot(d,f.v),dot(d,f.w));
 vec3 ground=vec3(.12,.105,.085),horizon=vec3(.62,.72,.83),zenith=vec3(.20,.39,.72);
 vec3 sky=mix(horizon,zenith,smoothstep(0.,.9,q.y));
 float broadCloud=pow(max(.5+.5*sin(q.x*4.5+sin(q.z*3.2)),0.),3.);
 sky=mix(sky,vec3(.92,.94,.98),broadCloud*smoothstep(.06,.5,q.y)*.48);
 return mix(ground,sky,smoothstep(-.18,.10,q.y));
}
vec3 materialStudySky(vec3 d){return materialStudySkyInFrame(d,materialLightFrame());}
vec3 materialStudyEmitterRay(vec3 origin,vec3 direction,out float lightT){
 MaterialLightFrame f=materialLightFrame();lightT=1e20;vec3 result=vec3(0.);
 for(int light=0;light<2;light++){
  vec3 offset=light==0?vec3(-.55,.20,1.40):vec3(.55,-.20,1.70);
  vec2 halfSize=light==0?vec2(.35,.90):vec2(.25,.65);
  vec3 Le=light==0?vec3(9.,8.2,7.4):vec3(2.3,3.0,4.4);
  vec3 center=materialLightPoint(f,offset);float den=dot(direction,f.w);
  if(den<=.000001)continue; // one-sided emitter faces the window
  float t=dot(center-origin,f.w)/den;if(t<=.00001||t>=lightT)continue;
  vec3 q=origin+direction*t-center;
  if(abs(dot(q,f.u))<=halfSize.x&&abs(dot(q,f.v))<=halfSize.y){result=Le*uStudyAreaStrength;lightT=t;}
 }
 return result;
}
vec3 materialStudyEnvironment(vec3 origin,vec3 direction){float t;vec3 light=materialStudyEmitterRay(origin,direction,t);return t<1e19?light:materialStudySky(direction)*uStudyEnvironmentStrength;}
float materialLightNode(int index){return index==0?-.7745966692:(index==1?0.:.7745966692);}
float materialLightWeight(int index){return index==1?.8888888889:.5555555556;}
// Bounded contact visibility is geometric, not a dark seam texture.
// Two rays per shaded aperture point, one to each finite emitter centre.
// Only opaque parts of this same aperture instance within 0.20 m are queried.
// This is not full-building shadowing or a per-node soft-area visibility solve.
float materialLocalContactVisibility(vec3 point,vec3 normal,vec3 lightPoint,float objectId){
 #if FIELD_APERTURES
 if(uLocalContactVisibility<.5||objectId<4000.)return 1.;
 vec3 ro=point+normal*.000015,delta=lightPoint-ro;float lightDistance=length(delta);
 if(lightDistance<=.00003)return 1.;vec3 rd=delta/lightDistance;float end=min(lightDistance,.20);
 int ownInstance=int(floor((objectId-4000.)/8.)),count=int(apertureRecord(0).x);
 for(int k=0;k<count;k++){
  AperturePart part=apertureLoad(k);
  if(part.role==6.||int(floor((part.objectId-4000.)/8.))!=ownInstance)continue;
  if(apertureOccludesSegment(part,ro,rd,.000008,end))return 0.;
 }
 #endif
 return 1.;
}
vec3 materialStudyAreaLighting(vec3 p,FieldSurface surface,vec3 n,vec3 view,float objectId){
 MaterialLightFrame f=materialLightFrame();vec3 result=vec3(0.);
 for(int light=0;light<2;light++){
  vec3 center=materialLightPoint(f,light==0?vec3(-.55,.20,1.40):vec3(.55,-.20,1.70));
  vec2 halfSize=light==0?vec2(.35,.90):vec2(.25,.65);
  vec3 Le=light==0?vec3(9.,8.2,7.4):vec3(2.3,3.0,4.4);
  float visibility=materialLocalContactVisibility(p,n,center,objectId);
  for(int y=0;y<3;y++)for(int x=0;x<3;x++){
   vec3 delta=center+f.u*(halfSize.x*materialLightNode(x))+f.v*(halfSize.y*materialLightNode(y))-p;
   float distance2=max(dot(delta,delta),.01);vec3 l=delta*inversesqrt(distance2);
   float emitterCos=max(dot(l,f.w),0.);
   float solidAngle=emitterCos*halfSize.x*halfSize.y*materialLightWeight(x)*materialLightWeight(y)/distance2;
   // Each Gauss node represents finite source area. A normalized GGX-width
   // convolution approximates that sub-area, avoiding nine false pin highlights.
   // This is a disclosed finite-source approximation, not material-color editing.
   float sourceVariance=(halfSize.x*halfSize.x+halfSize.y*halfSize.y)/(81.*distance2);
   FieldSurface s=surface;
   s.roughness=min(pow(pow(surface.roughness,4.)+sourceVariance,.25),1.);
   s.clearcoatRoughness=min(pow(pow(surface.clearcoatRoughness,4.)+sourceVariance,.25),1.);
   result+=directBRDF(s,n,view,l,Le*(solidAngle*uStudyAreaStrength*visibility));
  }
 }
 return result;
}
float materialSequence(int i){if(i==0)return 0.;if(i==1)return .5;if(i==2)return .25;if(i==3)return .75;if(i==4)return .125;if(i==5)return .625;if(i==6)return .375;return .875;}
vec3 materialStudyEnvironmentSpecular(FieldSurface s,vec3 n,vec3 view){
 MaterialLightFrame frame=materialLightFrame();
 float nv=max(dot(n,view),.0001);vec3 tangent=normalize(cross(n,abs(n.y)<.9?vec3(0,1,0):vec3(1,0,0))),bitangent=cross(n,tangent),sum=vec3(0.);
 // Eight deterministic GGX-NDF samples per lobe. No scene-ray recursion and no
 // invented photo detail; low-order unoccluded environment lighting only.
 for(int layer=0;layer<2;layer++){
  if(layer==1&&s.clearcoat<=0.)continue;
  float rough=layer==0?s.roughness:s.clearcoatRoughness;
  float a=max(rough*rough,.0036),a2=a*a;
  vec3 f0=layer==0?mix(vec3(.04),s.baseColor,s.metallic):vec3(.04);
  for(int i=0;i<8;i++){
   float xi=(float(i)+.5)/8.,phi=TAU*materialSequence(i),ct=sqrt((1.-xi)/(1.+(a2-1.)*xi)),st=sqrt(max(1.-ct*ct,0.));
   vec3 h=tangent*(st*cos(phi))+bitangent*(st*sin(phi))+n*ct;
   float vh=max(dot(view,h),0.);vec3 l=reflect(-view,h);float nl=dot(n,l);if(nl<=0.||vh<=0.)continue;
   float G=mqSmithG1(nv,a2)*mqSmithG1(nl,a2),weight=G*vh/max(nv*ct,.000001);
   float layerEnergy=layer==0?(1.-s.clearcoat*fresnelSchlick(nv,vec3(.04)).x)*(1.-s.clearcoat*fresnelSchlick(nl,vec3(.04)).x):s.clearcoat;
   sum+=materialStudySkyInFrame(l,frame)*fresnelSchlick(vh,f0)*(weight*layerEnergy/8.);
  }
 }
 return sum*uStudyEnvironmentStrength;
}
vec3 materialStudyLighting(vec3 p,FieldSurface s,vec3 n,vec3 view,float ao,float objectId){
 MaterialLightFrame frame=materialLightFrame();
 vec3 diffuseEnvironment=mix(vec3(.13,.115,.095),vec3(.39,.46,.57),clamp(dot(n,frame.v)*.5+.5,0.,1.));
 return materialStudyAreaLighting(p,s,n,view,objectId)+materialStudyEnvironmentSpecular(s,n,view)+materialAmbient(s,n,view,diffuseEnvironment)*uStudyEnvironmentStrength*ao;
}
// A finite difference must not bridge two independently oriented member charts.
float materialMicroSlope(FieldHit hit,FieldSurface surface,vec3 materialNormal,vec3 localDirection,float footprint,float eps){
 FieldHit shifted=hit;shifted.local+=localDirection*eps;
 if(hit.materialRole>3.5&&hit.materialRole<5.5){vec3 a,an,b,bn;bool ad,bd;materialMemberChart(hit,materialNormal,a,an,ad);materialMemberChart(shifted,materialNormal,b,bn,bd);if(length(b-a)>eps*1.5)return 0.;}
 return clamp((sampleFieldMaterial(shifted,materialNormal,footprint).height-surface.height)/eps,-.3,.3);
}

`;

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>{const l=Math.hypot(...a);return a.map(x=>x/l);};
/** CPU reference for the shader's member chart, for rigid-coordinate tests. */
export function memberGrainCoordinates(part,localMetres,localNormal){
 if(!part?.outer||![localMetres,localNormal].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)))throw Error('Finite aperture-local metres and local normal required');
 const q=localMetres.map((v,i)=>v-(i<2?part.outer.center[i]:0));
 const side=q.map(x=>x<0?-1:1),innerBoundary=part.inner?.half.map((h,i)=>part.inner.center[i]-part.outer.center[i]+side[i]*h);
 const hasHorizontal=!!part.inner&&side[1]*innerBoundary[1]<part.outer.half[1]-.00001;
 const horizontal=hasHorizontal&&part.outer.half[1]-Math.abs(q[1])<part.outer.half[0]-Math.abs(q[0]);
 const g=horizontal?[...q]:[q[1],q[0],q[2]],n=horizontal?[...localNormal]:[localNormal[1],localNormal[0],localNormal[2]];
 if(part.inner){const axis=horizontal?1:0;g[1]-=(side[axis]*part.outer.half[axis]+innerBoundary[axis])*.5;}
 return {positionM:g,normal:n,memberAxis:horizontal?'rail-x':'stile-y',solidDoor:!part.inner,joinery:'approximate_mitred_chart_not_recovered_joint'};
}
export function clearcoatEnergyWeights(nv,nl,clearcoat){
 if(![nv,nl,clearcoat].every(Number.isFinite)||nv<0||nv>1||nl<0||nl>1||clearcoat<0||clearcoat>1)throw Error('Fresnel cosines and coverage require [0,1]');
 const f=c=>.04+.96*(1-c)**5;return {substrate:(1-clearcoat*f(nv))*(1-clearcoat*f(nl)),entryReflection:clearcoat*f(nl),exitReflection:clearcoat*f(nv)};
}
/** Direct GLSL BRDF CPU transcription, returns outgoing radiance times N.L. */
export function directMaterialBRDF(surface,normal,view,light,radiance=[1,1,1]){
 const n=norm(normal),v=norm(view),l=norm(light),nv=dot(n,v),nl=dot(n,l);if(nv<=0||nl<=0)return [0,0,0];
 const h=norm(v.map((x,i)=>x+l[i])),nh=Math.max(dot(n,h),0),vh=Math.max(dot(v,h),0),s={clearcoat:0,clearcoatRoughness:1,...surface};
 const fresnel=(c,f)=>f+(1-f)*(1-clamp(c))**5;
 function ggx(r,f0){const a=Math.max(r*r,.0036),a2=a*a,den=nh*nh*(a2-1)+1,D=a2/Math.max(Math.PI*den*den,.000000000001),g=x=>2*x/Math.max(x+Math.sqrt(a2+(1-a2)*x*x),.000001);return D*g(nv)*g(nl)*fresnel(vh,f0)/Math.max(4*nv*nl,.000001);}
 const energy=clearcoatEnergyWeights(nv,nl,s.clearcoat).substrate;
 return s.baseColor.map((c,i)=>{const f0=.04*(1-s.metallic)+c*s.metallic,base=ggx(s.roughness,f0)+(1-fresnel(vh,f0))*(1-s.metallic)*c/Math.PI;return (base*energy+ggx(s.clearcoatRoughness,.04)*s.clearcoat)*radiance[i]*nl;});
}
/** A bound, not a replacement signal: source amplitudes imply this height limit. */
export function materialHeightEnvelope(parameters={}){const p=adaptHostedMaterialParameters(parameters),wood=1.71*p.woodReliefM*TIMBER_CAPTURED_PARAMETERS.u_reliefScale;return {woodM:wood,paintedWoodM:wood*.12+p.paintReliefM*.5,normalOnly:true,geometryDisplacementM:0};}
