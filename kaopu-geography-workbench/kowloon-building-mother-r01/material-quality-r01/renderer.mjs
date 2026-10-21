/** Original direct field renderer. No model meshes, vertex arrays or index buffers. */
import {buildFieldGLSL,packFieldDescriptors} from '../r07/field.mjs';
import {buildCaseGLSL,packCaseDescriptors} from '../r07/cases.mjs';
import {buildAssemblyGLSL,packAssemblyDescriptors} from '../r07/assemblies.mjs';
import {buildContextGLSL} from '../r07/context.mjs';
import {buildHostedSceneGLSL} from '../r07/hosted-scene.mjs';
import {packApertureDescriptors} from '../r07/apertures.mjs';
import {MOTHER_GLSL,MATERIAL_GLSL,HOSTED_MATERIAL_DEFAULTS,adaptHostedMaterialParameters,bindHostedMaterialUniforms} from './material.mjs';
const VERTEX=`#version 300 es
precision highp float;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
const QUALITY_PRESENT=`#version 300 es
precision highp float;
uniform highp sampler2D uQualityColor;uniform int uQualitySamples;
out vec4 outColor;
void main(){ivec2 p=ivec2(gl_FragCoord.xy)*uQualitySamples;vec3 linearColor=vec3(0.);for(int y=0;y<2;y++)for(int x=0;x<2;x++){if(x>=uQualitySamples||y>=uQualitySamples)continue;vec3 c=texelFetch(uQualityColor,p+ivec2(x,y),0).rgb;linearColor+=pow(max(c,vec3(0.)),vec3(2.2));}linearColor/=float(uQualitySamples*uQualitySamples);outColor=vec4(pow(linearColor,vec3(1./2.2)),1.);}`;
const HEAD=`#version 300 es
precision highp float;
precision highp int;
`;
const CAMERA=String.raw`
uniform vec2 uResolution;
uniform vec3 uEye,uTarget,uBoundsMin,uBoundsMax;
uniform float uFov,uCutaway,uOcclusion;
uniform int uRenderMode,uDiagnostic,uTraceMode;
vec3 cameraRay(){vec2 uv=(2.*gl_FragCoord.xy-uResolution)/uResolution.y;vec3 f=normalize(uTarget-uEye),right=normalize(cross(f,vec3(0,1,0))),up=cross(right,f);return normalize(f+tan(uFov*.5)*(uv.x*right+uv.y*up));}
`;
// Both production glass shading and Float32 optical probes call this SAME path.
// Status: 1 transmission, 2 total internal reflection (sky approximation),
// 3 unresolved finite exit. Primary miss/non-glass is handled by each caller.
const HOSTED_OPTICS=String.raw`
#if FIELD_HOSTED
uniform float uSceneReflection;
struct HostedGlassTrace{int status;float pathLength;float entryF;float exitF;float energy;bool startsInside;vec3 exitPoint;vec3 exitNormal;vec3 transmitted;vec3 transmittance;bool behindFound;float behindT;FieldHit behind;vec3 behindNormal;int behindVisits;};
float hostedFresnel(float c){float f=(uGlassIOR-1.)/(uGlassIOR+1.);f*=f;return f+(1.-f)*pow(clamp(1.-c,0.,1.),5.);}
HostedGlassTrace hostedTraceGlassHit(vec3 ro,vec3 rd,float t,FieldHit h,vec3 outward){
 HostedGlassTrace g;g.status=3;g.pathLength=0.;g.entryF=0.;g.exitF=0.;g.energy=0.;g.startsInside=dot(rd,outward)>0.;g.exitPoint=ro+rd*t;g.exitNormal=outward;g.transmitted=vec3(0.);g.transmittance=vec3(0.);g.behindFound=false;g.behindT=-1.;g.behind=FieldHit(1e20,0.,0.,g.exitPoint);g.behindNormal=vec3(0,1,0);g.behindVisits=0;
 vec3 facing=g.startsInside?-outward:outward;
 g.entryF=g.startsInside?0.:hostedFresnel(max(dot(-rd,facing),0.));
 vec3 internalDirection=g.startsInside?rd:refract(rd,facing,1./uGlassIOR);
 g.pathLength=g.startsInside?t:0.;
 if(!g.startsInside){if(dot(internalDirection,internalDirection)<.5){g.status=2;return g;}vec3 paneEntry=g.exitPoint;if(!apertureGlassExit(h.objectId,paneEntry,internalDirection,g.pathLength,g.exitNormal,g.exitPoint))return g;}
 // The finite exit can be a pane edge, not merely the parallel back plane.
 g.exitF=hostedFresnel(max(dot(internalDirection,g.exitNormal),0.));
 g.transmitted=refract(internalDirection,-g.exitNormal,uGlassIOR);
 if(dot(g.transmitted,g.transmitted)<.5){g.status=2;return g;}
 g.energy=(1.-g.entryF)*(1.-g.exitF);
 g.transmittance=exp(log(max(uGlassColor,vec3(.02)))*(max(g.pathLength,0.)/.006))*uGlassTransmission*g.energy;
 g.behindFound=hostedTraceRayFiltered(g.exitPoint+g.transmitted*.00003,g.transmitted,h.objectId,g.behindT,g.behind,g.behindVisits);g.behindNormal=fieldRayNormal;
 if(!g.behindFound){g.behindT=-1.;g.behind.objectId=0.;}
 g.status=1;return g;
}
#endif
`;
const OPTICS_PROBE=String.raw`
uniform vec3 uPoints[128],uDirections[128];
layout(location=0)out vec4 outPath;
layout(location=1)out vec4 outExit;
layout(location=2)out vec4 outDirection;
layout(location=3)out vec4 outTransmission;
void main(){int i=int(gl_FragCoord.x);vec3 ro=uPoints[i],rd=normalize(uDirections[i]);float t;FieldHit h;int visits;bool found=caseTraceRay(ro,rd,t,h,visits);
 outPath=vec4(found?0.:-1.,0.,0.,0.);outExit=vec4(0.);outDirection=vec4(0.);outTransmission=vec4(0.,0.,0.,-1.);
 if(!found||h.materialRole!=6.)return;
 HostedGlassTrace g=hostedTraceGlassHit(ro,rd,t,h,fieldRayNormal);
 outPath=vec4(float(g.status),g.pathLength,g.entryF,g.exitF);outExit=vec4(g.exitPoint,g.startsInside?1.:0.);outDirection=vec4(g.transmitted,g.behindFound?g.behind.objectId:0.);outTransmission=vec4(g.transmittance,g.behindT);
}`;

const SHADE=String.raw`
float displayDistance(vec3 p){
 #if FIELD_HOSTED
 float d=displayMapDistance(p);
 #else
 float d=mapField(p).distance;
 #endif
if(uCutaway>.5)d=max(d,-p.x-.2);return d;}
vec3 colorId(float id){return .35+.6*cos(vec3(0.,2.,4.)+id*1.37);}
// Current receiver keeps the frozen R07 finite-pane transmission calculation.
// Reflection adds ONE actual displayed-scene ray, with authored sky on a miss.
// TIR still uses sky only; second glass hits terminate without recursive optics.
// Secondary terminal shading uses geometric normals and an approximate footprint.
#if FIELD_HOSTED
vec3 hostedSky(vec3 d){
 if(uStudyLighting>.5)return materialStudySky(d)*uStudyEnvironmentStrength;
 // Authored analytic daylight lighting environment, not a captured Hong Kong sky.
 vec3 base=mix(vec3(.72,.78,.83),vec3(.19,.39,.64),smoothstep(-.12,.85,d.y));
 float sun=pow(max(dot(d,normalize(vec3(-.55,1.,-.45))),0.),500.);
 float cloud=(.5+.5*sin(d.x*9.+sin(d.z*13.)))*(.5+.5*sin(d.z*11.-d.x*4.));
 return mix(base,vec3(.92,.94,.96),smoothstep(.60,.84,cloud)*smoothstep(.05,.35,d.y)*.56)+vec3(8.,7.6,6.8)*sun;
}
vec3 hostedEnvironment(vec3 origin,vec3 direction){return uStudyLighting>.5?materialStudyEnvironment(origin,direction):hostedSky(direction);}
vec3 hostedDisplayColor(vec3 radiance){radiance*=uStudyLighting>.5?uStudyExposure:1.;vec3 mapped=radiance/(1.+radiance);return pow(max(mapped,vec3(0.)),vec3(1./2.2));}
vec3 hostedTerminalShade(FieldHit h,vec3 n,vec3 rd,float t,vec3 worldPoint){
 if(dot(n,rd)>0.)n=-n;
 FieldSurface s=sampleFieldMaterial(h,contextMaterialDirection(h,n),max(t*.0008,.001));
 if(uStudyLighting>.5)return materialStudyLighting(worldPoint,s,n,-rd,1.);
 vec3 color=directBRDF(s,n,-rd,normalize(vec3(-.55,1.,-.45)),vec3(3.,2.85,2.65));
 color+=directBRDF(s,n,-rd,normalize(vec3(.5,.4,.7)),vec3(.5,.65,.8));
 return color+materialAmbient(s,n,-rd,mix(vec3(.12,.14,.13),vec3(.3,.36,.38),n.y*.5+.5));
}
vec3 hostedReflection(vec3 origin,vec3 direction,float skipId){
 float t;FieldHit h;int visits;
 bool found=hostedTraceRayFiltered(origin,direction,skipId,t,h,visits);
 vec3 n=fieldRayNormal;
 // One actual reflected scene ray. A second glass hit is terminal, not recursion.
 // Analytic luminous panels belong to the authored lighting rig, not model
 // geometry. A visible emitter before the scene hit must actually be luminous.
 if(uStudyLighting>.5){float lightT;vec3 emission=materialStudyEmitterRay(origin,direction,lightT);if(lightT<1e19&&(!found||lightT<t))return emission;}
 return found?hostedTerminalShade(h,n,direction,t,origin+direction*t):hostedEnvironment(origin,direction);
}
vec3 hostedGlassRadiance(vec3 ro,vec3 rd,float t,FieldHit h,vec3 outward){
 HostedGlassTrace g=hostedTraceGlassHit(ro,rd,t,h,outward);vec3 facing=g.startsInside?-outward:outward;
 if(g.status==2)return hostedEnvironment(ro+rd*t,reflect(rd,facing)); // internal TIR remains an explicitly bounded environment approximation
 if(g.status!=1)return vec3(.95,.05,.5);
 vec3 through=g.behindFound?hostedTerminalShade(g.behind,g.behindNormal,g.transmitted,g.behindT,g.exitPoint+g.transmitted*(g.behindT+.00003)):hostedEnvironment(g.exitPoint,g.transmitted);
 vec3 reflected=reflect(rd,facing);vec3 reflection=uSceneReflection>.5?hostedReflection(ro+rd*t+reflected*.00003,reflected,h.objectId):hostedEnvironment(ro+rd*t,reflected);
 return through*g.transmittance+reflection*(1.-g.energy);
}
#endif

vec4 shadeFieldHit(vec3 rd,float t,FieldHit h,int steps,int status,vec3 n){
 vec3 p=uEye+rd*t;
 vec3 sky=mix(vec3(.82,.87,.86),vec3(.48,.62,.67),clamp(rd.y*.6+.4,0.,1.));
 if(status==3){return vec4(.85,.12,.55,1.);}
 if(status!=1){
 #if FIELD_HOSTED
 return vec4(hostedDisplayColor(hostedEnvironment(uEye,rd)),1.);
 #else
 return vec4(sky,1.);
 #endif
 }
 #if FIELD_HOSTED
 if(uRenderMode==0&&h.materialRole>5.5){return vec4(hostedDisplayColor(hostedGlassRadiance(uEye,rd,t,h,n)),1.);}
 #endif
 if(dot(n,rd)>0.)n=-n;
 if(uRenderMode==1){return vec4(colorId(h.objectId)*(.4+.6*max(dot(n,normalize(vec3(-.4,1.,-.5))),0.)),1.);}
 if(uRenderMode==2){float s=float(steps)/100.;return vec4(clamp(vec3(s,.7-s*.4,1.-s),0.,1.),1.);}
 float footprint=max(t*2.*tan(uFov*.5)/uResolution.y,.0001);
 vec3 materialNormal=n;
 #if FIELD_CONTEXT
 materialNormal=contextMaterialDirection(h,n);
 #endif
 FieldSurface surface=sampleFieldMaterial(h,materialNormal,footprint);
 // The same final field query provides material role and local coordinates.
 // Material microheight is shading only, never a hidden silhouette deformation.
 vec3 tangent=normalize(cross(n,abs(n.y)<.9?vec3(0,1,0):vec3(1,0,0))),bitangent=cross(n,tangent);
 vec3 localTangent=tangent,localBitangent=bitangent;
 #if FIELD_CONTEXT
 localTangent=contextMaterialDirection(h,tangent);localBitangent=contextMaterialDirection(h,bitangent);
 #endif
 float eps=max(footprint,.0008);
 float dh1=materialMicroSlope(h,surface,materialNormal,localTangent,footprint,eps),dh2=materialMicroSlope(h,surface,materialNormal,localBitangent,footprint,eps);
 n=normalize(n-clamp(dh1,-.3,.3)*tangent-clamp(dh2,-.3,.3)*bitangent);
 vec3 view=normalize(uEye-p),sun=normalize(vec3(-.55,1.,-.45));
 float ao=1.;if(uOcclusion>.5)for(int i=1;i<=3;i++){float r=float(i)*.14;ao-=max(r-max(displayDistance(p+n*r),0.),0.)/(r*9.);}
 vec3 color;
 #if FIELD_HOSTED
 if(uStudyLighting>.5)color=materialStudyLighting(p,surface,n,view,clamp(ao,.35,1.));else{
 #endif
 color=directBRDF(surface,n,view,sun,vec3(3.0,2.85,2.65));
 color+=directBRDF(surface,n,view,normalize(vec3(.5,.4,.7)),vec3(.5,.65,.8));
 color+=materialAmbient(surface,n,view,mix(vec3(.12,.14,.13),vec3(.3,.36,.38),n.y*.5+.5))*clamp(ao,.35,1.);
 #if FIELD_HOSTED
 }
 color=hostedDisplayColor(color);
 #else
 color=color/(1.+color);color=pow(max(color,vec3(0.)),vec3(1./2.2));
 #endif
 return vec4(color,1.);
 }
`;
const DIAGNOSTIC=String.raw`
vec4 diagnosticPixel(int steps,int status,float id){return vec4(float(min(steps,255))/255.,(float(status)+8.*floor(id/256.))/255.,mod(id,256.)/255.,1.);}
`;
const DIRECT=String.raw`
out vec4 outColor;
vec2 rayBox(vec3 ro,vec3 rd){vec3 inv=1./rd,a=(uBoundsMin-ro)*inv,b=(uBoundsMax-ro)*inv;vec3 lo=min(a,b),hi=max(a,b);return vec2(max(max(lo.x,lo.y),lo.z),min(min(hi.x,hi.y),hi.z));}
void main(){
 vec3 rd=cameraRay();float t=0.;int status=2,steps=0;FieldHit h;h.distance=1e20;h.objectId=0.;h.materialRole=0.;h.local=uEye;
 #if FIELD_SURFACE
 bool found=caseTraceRay(uEye,rd,t,h,steps);status=found?1:2;
 #else
 #if FIELD_TRACE_VARIANT == 4
 status=2;
 #elif FIELD_TRACE_VARIANT == 3
 vec2 rr=rayBox(uEye,rd);t=max(rr.x,0.);float finish=rr.y;status=2;
 if(finish>=t){status=3;for(int i=0;i<512;i++){steps=i+1;h=mapField(uEye+rd*t);float d=h.distance;if(abs(d)<max(.00015,t*.000025)){status=1;break;}t+=abs(d)*.8;if(t>finish){status=2;break;}}}
 if(status==1)fieldRayNormal=fieldNormal(uEye+rd*t);
 #else
 fieldTraceRayModeClipped(uEye,rd,uCutaway>.5?-.2:-1e20,uTraceMode,t,h,steps,status);
 #endif
 #endif
 if(uDiagnostic==2){
 #if FIELD_SURFACE
 outColor=vec4(float(min(steps,255))/255.,0.,0.,1.);
 #else
 outColor=vec4(float(min(fieldPrimarySteps,255))/255.,fieldRayUsedRescue?1.:0.,0.,1.);
 #endif
 return;}
 if(uDiagnostic==1){outColor=diagnosticPixel(steps,status,status==1?h.objectId:0.);return;}
 vec3 n=vec3(0,1,0);
 #if FIELD_MEASURED
 if(status==1)n=caseNormalForId(h.objectId);
 #else
 n=fieldRayNormal;
 #endif
 outColor=shadeFieldHit(rd,t,h,steps,status,n);
}`;
// Float32 MRT stores exact per-pixel query results, never drawable object geometry.
// The rescue target is distinct from every sampled primary texture.
const RAY_INPUT=String.raw`
#ifndef FIELD_RAY_PROBE
#define FIELD_RAY_PROBE 0
#endif
#if FIELD_RAY_PROBE
uniform vec3 uPoints[128],uDirections[128];
void inputRay(out vec3 ro,out vec3 rd){int i=int(gl_FragCoord.x);ro=uPoints[i];rd=normalize(uDirections[i]);}
#else
void inputRay(out vec3 ro,out vec3 rd){ro=uEye;rd=cameraRay();}
#endif
`;
const MRT=String.raw`
layout(location=0) out vec4 outState;
layout(location=1) out vec4 outNormalId;
layout(location=2) out vec4 outLocalRole;
void storeHit(float t,int status,int steps,int primarySteps,FieldHit h,vec3 n){
 outState=vec4(t,float(status),float(steps),float(primarySteps));
 outNormalId=status==1?vec4(n,h.objectId):vec4(0.);
 outLocalRole=status==1?vec4(h.local,h.materialRole):vec4(0.);
}
`;
const PRIMARY=String.raw`
void main(){vec3 ro,rd;inputRay(ro,rd);float t;int status,steps;FieldHit h;
 fieldTracePrimaryOnlyClipped(ro,rd,uCutaway>.5?-.2:-1e20,t,h,steps,status);
 storeHit(t,status,steps,steps,h,fieldRayNormal);
}`;
const INPUT_MRT=String.raw`
uniform highp sampler2D uState,uNormalId,uLocalRole;
`;
const RESCUE=String.raw`
void main(){ivec2 pixel=ivec2(gl_FragCoord.xy);vec4 state=texelFetch(uState,pixel,0);
 if(int(state.y)!=3){outState=state;outNormalId=texelFetch(uNormalId,pixel,0);outLocalRole=texelFetch(uLocalRole,pixel,0);return;}
 vec3 ro,rd;inputRay(ro,rd);float t;int status,steps;FieldHit h;int usedPrimarySteps=int(state.w);
 fieldTraceRescueFromClipped(ro,rd,uCutaway>.5?-.2:-1e20,state.x,usedPrimarySteps,t,h,steps,status);
 storeHit(t,status,steps,usedPrimarySteps,h,fieldRayNormal);
}`;
const SPLIT_SHADE=String.raw`
uniform highp sampler2D uPrimaryState;
out vec4 outColor;
void main(){ivec2 pixel=ivec2(gl_FragCoord.xy);vec4 state=texelFetch(uState,pixel,0),ni=texelFetch(uNormalId,pixel,0),lr=texelFetch(uLocalRole,pixel,0);int status=int(state.y),steps=int(state.z);
 if(uDiagnostic==2){vec4 primary=texelFetch(uPrimaryState,pixel,0);outColor=vec4(min(primary.w,255.)/255.,int(primary.y)==3?1.:0.,0.,1.);return;}
 if(uDiagnostic==1){outColor=diagnosticPixel(steps,status,status==1?ni.w:0.);return;}
 FieldHit h;h.distance=0.;h.objectId=ni.w;h.materialRole=lr.w;h.local=lr.xyz;
 outColor=shadeFieldHit(cameraRay(),state.x,h,steps,status,ni.xyz);
}`;
const SPLIT_PROBE=String.raw`
out vec4 outColor;
void main(){ivec2 pixel=ivec2(gl_FragCoord.xy);vec4 state=texelFetch(uState,pixel,0),ni=texelFetch(uNormalId,pixel,0);outColor=vec4(int(state.y)==1?state.x:0.,ni.w,state.y,state.z);}
`;
const PROBE=String.raw`
uniform vec3 uPoints[128],uDirections[128];out vec4 outColor;
void main(){int i=int(gl_FragCoord.x);vec3 p=uPoints[i];
#if PROBE_KIND == 4
 FieldHit h;float t;int steps,status;
 #if FIELD_SURFACE
 bool found=caseTraceRay(p,normalize(uDirections[i]),t,h,steps);status=found?1:2;
 #else
 fieldTraceRay(p,normalize(uDirections[i]),t,h,steps,status);
 #endif
 outColor=vec4(status==1?t:0.,h.objectId,float(status),float(steps));
#else
 FieldHit h=mapField(p);
 #if PROBE_KIND == 0
 outColor=vec4(h.distance,h.objectId,h.materialRole,1.);
 #elif PROBE_KIND == 1
 outColor=vec4(fieldNormal(p),h.distance);
 #elif PROBE_KIND == 2
 vec3 materialNormal=fieldNormal(p);
 #if FIELD_CONTEXT
 materialNormal=contextMaterialDirection(h,materialNormal);
 #endif
 FieldSurface s=sampleFieldMaterial(h,materialNormal,.001);outColor=vec4(s.baseColor,s.roughness);
 #else
 outColor=vec4(h.local,1.);
 #endif
#endif
}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error('Field shader compile failed: '+log);}return s;}
function program(gl,fragment){const p=gl.createProgram();let vs,fs;try{vs=shader(gl,gl.VERTEX_SHADER,VERTEX);fs=shader(gl,gl.FRAGMENT_SHADER,fragment);gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}catch(e){gl.deleteProgram(p);throw e;}finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}}
export const decodeDiagnosticPixel=(r,g,b)=>({steps:r,status:g%8,objectId:b+256*Math.floor(g/8)});
export const nearestRankQuantile=(a,q)=>a.slice().sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*q)-1)];
/** Source construction is exported for CPU checks; compiling it is not GPU parity evidence. */
export function buildRendererSources(spec,traceVariant=0){
 const code=spec.fieldKind==='measured-surface'?buildCaseGLSL(spec):spec.fieldKind==='evidence-assembly'?buildAssemblyGLSL(spec):spec.fieldKind==='case-context'?buildContextGLSL(spec):spec.fieldKind==='hosted-context'?buildHostedSceneGLSL(spec):buildFieldGLSL(spec),source=typeof code==='string'?code:code.source;
 const surface=['measured-surface','evidence-assembly','case-context','hosted-context'].includes(spec.fieldKind),head=HEAD+'#define FIELD_HOSTED '+(spec.fieldKind==='hosted-context'?'1':'0')+'\n#define FIELD_CONTEXT '+(['case-context','hosted-context'].includes(spec.fieldKind)?'1':'0')+'\n#define FIELD_TRACE_VARIANT '+traceVariant+'\n#define FIELD_SURFACE '+(surface?'1':'0')+'\n#define FIELD_MEASURED '+(spec.fieldKind==='measured-surface'?'1':'0')+'\n';
 const stage=n=>head+'#define FIELD_KERNEL_STAGE '+n+'\n',renderHead=stage(0)+source+MOTHER_GLSL+MATERIAL_GLSL+CAMERA+HOSTED_OPTICS+SHADE+DIAGNOSTIC;
 return {source,head,split:!surface&&traceVariant===0,
  direct:renderHead+DIRECT,
  primary:stage(1)+source+CAMERA+RAY_INPUT+MRT+PRIMARY,
  rescue:stage(2)+source+CAMERA+RAY_INPUT+MRT+INPUT_MRT+RESCUE,
  shade:stage(1)+source+MOTHER_GLSL+MATERIAL_GLSL+CAMERA+HOSTED_OPTICS+SHADE+DIAGNOSTIC+INPUT_MRT+SPLIT_SHADE,
  rayPrimary:stage(1)+'#define FIELD_RAY_PROBE 1\n'+source+CAMERA+RAY_INPUT+MRT+PRIMARY,
  rayRescue:stage(2)+'#define FIELD_RAY_PROBE 1\n'+source+CAMERA+RAY_INPUT+MRT+INPUT_MRT+RESCUE,
  rayResult:HEAD+INPUT_MRT+SPLIT_PROBE,
  opticsProbe:spec.fieldKind==='hosted-context'?stage(0)+source+'uniform vec3 uGlassColor; uniform float uGlassTransmission,uGlassIOR;\n'+HOSTED_OPTICS+OPTICS_PROBE:null};
}
/** Current display receiver contract; never mutates the frozen R07 recipe. */
export function materialQualityOpticalContract(spec,options={}){
 if(spec?.fieldKind!=='hosted-context')return spec?.opticalContract??null;
 return {...spec.opticalContract,receiverRevision:'material-quality-r01',
  reflection:options.sceneReflection===0?'authored_analytic_environment_only':'one_actual_displayed_scene_reflection_ray_with_analytic_environment_miss',
  reflectionWeight:'combined_two_interface_Fresnel_weight_on_one_reflected_ray_not_separate_internal_reflection_paths',
  lightingEnvironment:options.studyLighting===0?'legacy_authored_analytic_daylight':'fixed_aperture_anchored_authored_two_rectangle_lights_and_analytic_sky_not_captured_Hong_Kong_illumination',
  areaLightApproximation:options.studyLighting===0?'disabled_legacy_two_directional_lights':'two_3x3_Gauss_BRDF_integrals_with_finite_source_GGX_width_approximation_no_per_sample_shadows',
  environmentSpecular:options.studyLighting===0?'disabled_legacy_diffuse_ambient_only':'eight_GGX_NDF_samples_per_lobe_analytic_sky_only_unoccluded_no_scene_rays',
  exposure:options.studyLighting===0?1:(options.studyExposure??1),
  primaryBackground:'same_analytic_environment_and_fixed_exposure_display_conversion_as_glass_environment',
  transmission:'unchanged_R07_finite_pane_Snell_Fresnel_Beer_Lambert_metres',
  secondaryShading:'geometric_normal_and_approximate_secondary_distance_footprint_no_microheight_normal',
  multiplePanes:'second_pane_is_terminal_tinted_surface_not_recursive_transmission',
  totalInternalReflection:'analytic_environment_only_approximation_no_internal_bounce'};
}
/** Describes the actual rendering query; finite test counts are not march budgets. */
export function rendererDiagnosticContract(spec,traceVariant=0,traceMode=0,options={}){
 const kind=spec.fieldKind;
 if(kind==='hosted-context')return {rayMethod:'finite source candidate filtering plus authored and hosted analytic domains',metric:'source BVH visits + authored and hosted finite-domain candidate tests',stepCap:null,stepCapKind:'finite query count, not a march budget',iterationBudget:null,unresolvedExpected:false,hitEpsilon:'source finite-plane residual <0.00002m; hosted exact rounded-rectangle interval predicates with Float32 tolerance',stepRule:'retain only selected patch masks; continue source traversal after rejected candidates; analytic hosted interval endpoints, no ray marching',missCondition:'all finite source, authored and hosted candidates rejected',opticalModel:materialQualityOpticalContract(spec,options)};
 if(kind==='measured-surface')return {rayMethod:'finite measured-plane and boundary intersection with BVH',metric:'BVH node visits',stepCap:spec.nodes.length,stepCapKind:'finite query upper bound, not a march budget',iterationBudget:null,unresolvedExpected:false,hitEpsilon:'ray/plane residual plus finite-boundary distance <0.00002m in the GPU predicate',stepRule:'finite source plane intersections with outer-loop and hole predicates; BVH traversal, no ray marching',missCondition:'BVH traversal found no source patch satisfying the ray/plane and finite-boundary predicates'};
 if(kind==='evidence-assembly')return {rayMethod:'finite authored-prism plane and union-boundary intersection',metric:'finite host plane tests',stepCap:spec.counts.analyticBoundaryPlanes,stepCapKind:'finite query upper bound, not a march budget',iterationBudget:null,unresolvedExpected:false,hitEpsilon:'no distance-march hit epsilon; finite cap/side-domain tests and union seam checks at +/-0.00001m',stepRule:'enumerate exact finite authored cap and side candidates; reject buried union seams, no ray marching',missCondition:'all relevant finite authored plane candidates failed their own domains or were buried inside the authored union'};
 if(kind==='case-context')return {rayMethod:'display-restricted measured BVH plus rigid authored finite-domain intersection',metric:'source BVH visits + authored finite plane tests',stepCap:spec.measured.nodes.length+spec.counts.analyticBoundaryPlanes,stepCapKind:'combined finite query upper bound, not a march budget',iterationBudget:null,unresolvedExpected:false,hitEpsilon:'source finite-surface predicate <0.00002m; authored exact cap/side domains with +/-0.00001m union seam checks',stepRule:'query both independent finite-field paths; apply source display interval without adding caps; choose nearest eligible hit, no ray marching',missCondition:'neither the display-restricted measured source nor the authored finite-domain query produced an eligible hit'};
 if(traceVariant===4)return {rayMethod:'empty diagnostic path',metric:'no field queries',stepCap:0,stepCapKind:'diagnostic query count',iterationBudget:0,unresolvedExpected:false,hitEpsilon:'not applicable to the empty diagnostic path',stepRule:'diagnostic background only; not a production geometry query',missCondition:'empty diagnostic path intentionally reports background'};
 if(traceVariant===3)return {rayMethod:'conservative-distance diagnostic path',metric:'whole-field diagnostic march iterations',stepCap:512,stepCapKind:'march iteration budget',iterationBudget:512,unresolvedExpected:true,hitEpsilon:'diagnostic abs(distance) < max(0.00015m,t*0.000025)',stepRule:'diagnostic abs(distance)*0.8 advance with 512-iteration cap; not the primary/rescue production kernel',missCondition:'ray exits finite bounds; budget exhaustion remains unresolved'};
 const analytic=traceVariant===1||traceVariant===2?traceVariant:traceMode;
 if(analytic)return {rayMethod:'analytic diagnostic isolation',metric:'rail march iterations; excludes structural plane, normal and attribute query costs',stepCap:analytic===1?0:512,stepCapKind:'rail march iteration budget',iterationBudget:analytic===1?0:512,unresolvedExpected:analytic!==1,hitEpsilon:analytic===1?'exact finite structural candidate predicates':'rail abs(distance) < max(0.00015m,local ray t*0.000025)',stepRule:analytic===1?'finite structural boundaries only; rail tracing disabled':analytic===2?'rail-only conservative tracing with 512-iteration cap; structural candidates disabled':'finite structural candidates plus rail-only conservative tracing with 512-iteration cap',missCondition:'enabled finite candidates rejected all hits and any enabled rail interval exhausted geometrically; rail budget exhaustion remains unresolved'};
 return {rayMethod:'conservative primary with finite-boundary and rail rescue',metric:'primary + rescue rail march iterations; excludes normal and attribute field queries',stepCap:512,stepCapKind:'shared primary and rescue march iteration budget',iterationBudget:512,unresolvedExpected:true,hitEpsilon:'kernel primary/rescue 0.00001m; grazing or non-boundary candidates require analytic recovery',stepRule:'conservative primary with shared512 march-iteration budget; unresolved/grazing recovery uses exact finite structural boundaries and rail-only conservative tracing; no unsafe minimum step',missCondition:'finite boundary tests rejected all candidates and rail interval exhausted geometrically; budget exhaustion remains unresolved'};
}
/** One active source suite only. No hash collisions or multi-version cache. */
export function rendererSourcesEqual(a,b){if(!a||!b)return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&a[k]===b[k]);}
let nextRendererId=0,nextResourceId=0;const resourceIds=new WeakMap();
const resourceId=o=>{if(!o)return null;if(!resourceIds.has(o))resourceIds.set(o,++nextResourceId);return resourceIds.get(o);};
export class FieldRenderer{
 constructor(canvas,{resourceEpoch=1,profileFirstDraw=false}={}){
  this.rendererId=++nextRendererId;this.resourceEpoch=resourceEpoch;this.profileFirstDraw=profileFirstDraw;this.invalidated=false;this.initializedProgramKeys=new Set();this.initializationCompletions=0;
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 is unavailable. No mesh fallback is used.');if(gl.isContextLost())throw Error('Cannot create field resources in a lost context');
  gl.disable(gl.DITHER);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);this.floatExtension=gl.getExtension('EXT_color_buffer_float');this.timerExtension=gl.getExtension('EXT_disjoint_timer_query_webgl2');const info=gl.getExtension('WEBGL_debug_renderer_info');this.gpu=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  this.capabilities={maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxRenderbufferSize:gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),maxDrawBuffers:gl.getParameter(gl.MAX_DRAW_BUFFERS),maxColorAttachments:gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),maxTextureUnits:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)};if(!this.vao||!this.floatExtension||this.capabilities.maxDrawBuffers<3||this.capabilities.maxColorAttachments<3||this.capabilities.maxTextureUnits<8)throw Error('Required field GPU capabilities unavailable');
  this.vertexBufferCount=0;this.indexBufferCount=0;this.modelTriangles=0;this.screenTrianglesPerPass=1;this.options={eye:[7,7,-7],target:[0,1.8,2.5],fov:45*Math.PI/180,cutaway:0,renderMode:0,age:.18,wet:.08,materialEnabled:1,occlusion:0,traceMode:0,...structuredClone(HOSTED_MATERIAL_DEFAULTS)};
 }
 setSpec(spec){
  this.assertLive();
  const start=performance.now(),gl=this.gl,sources=buildRendererSources(spec,this.traceVariant??0),reusedPrograms=!!this.programs&&rendererSourcesEqual(this.sources,sources),programs=reusedPrograms?this.programs:{},compileMs={};let descriptors=null,assemblyDescriptors=null,fieldDescriptors=null,apertureDescriptors=null;
  try{
   if(sources.split&&(!this.floatExtension||gl.getParameter(gl.MAX_DRAW_BUFFERS)<3||gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)<3))throw Error('Direct split-field rendering requires three Float32 color attachments. No mesh fallback is used.');
   for(const name of reusedPrograms?[]:sources.split?['primary','rescue','shade']:['direct']){const at=performance.now();programs[name]=program(gl,sources[name]);compileMs[name]=performance.now()-at;}
   if(['measured-surface','case-context','hosted-context'].includes(spec.fieldKind))descriptors=this.createDescriptors(['case-context','hosted-context'].includes(spec.fieldKind)?spec.measured:spec);
   if(['evidence-assembly','case-context','hosted-context'].includes(spec.fieldKind))assemblyDescriptors=this.uploadDescriptors(packAssemblyDescriptors(['case-context','hosted-context'].includes(spec.fieldKind)?spec.assembly:spec));
   if(spec.fieldKind==='hosted-context')apertureDescriptors=this.uploadDescriptors(packApertureDescriptors(spec.apertures));
   if(!spec.fieldKind){const packed=packFieldDescriptors(spec);fieldDescriptors={...this.uploadDescriptors(packed),schema:packed.schema,planeCount:packed.planeCount,domainCount:packed.domainCount};}
  }catch(e){if(!reusedPrograms)for(const p of Object.values(programs))gl.deleteProgram(p);if(descriptors)gl.deleteTexture(descriptors.texture);if(assemblyDescriptors)gl.deleteTexture(assemblyDescriptors.texture);if(fieldDescriptors)gl.deleteTexture(fieldDescriptors.texture);if(apertureDescriptors)gl.deleteTexture(apertureDescriptors.texture);throw e;}
  if(!reusedPrograms){for(const p of Object.values(this.programs??{}))gl.deleteProgram(p);for(const p of this.probePrograms?.values()??[])gl.deleteProgram(p);if(this.opticsProbeProgram)gl.deleteProgram(this.opticsProbeProgram);for(const p of Object.values(this.rayProbePrograms??{}))gl.deleteProgram(p);}if(this.descriptors)gl.deleteTexture(this.descriptors.texture);if(this.assemblyDescriptors)gl.deleteTexture(this.assemblyDescriptors.texture);if(this.fieldDescriptors)gl.deleteTexture(this.fieldDescriptors.texture);if(this.apertureDescriptors)gl.deleteTexture(this.apertureDescriptors.texture);
  this.programs=programs;if(!reusedPrograms){this.probePrograms=new Map();this.rayProbePrograms=null;this.opticsProbeProgram=null;}this.descriptors=descriptors;this.assemblyDescriptors=assemblyDescriptors;this.fieldDescriptors=fieldDescriptors;this.apertureDescriptors=apertureDescriptors;this.sources=sources;this.renderProgram=programs.shade??programs.direct;this.spec=spec;this.fieldSource=sources.source;this.probeHead=sources.head;this.compileCount=(this.compileCount??0)+(reusedPrograms?0:1);this.specUpdateCount=(this.specUpdateCount??0)+1;this.programReuseCount=(this.programReuseCount??0)+(reusedPrograms?1:0);this.lastSpecUpdate={reusedPrograms,descriptorTexturesReplaced:true,wallMs:performance.now()-start};
  if(!reusedPrograms)this.firstDrawPending=true;const nextCompileProfile={firstDrawSyncWallMs:null,firstDrawResolution:null,firstDrawMeasurement:'first full-frame draw plus gl.finish and one-pixel default-framebuffer readback; includes deferred driver work and target allocation, excludes prior queued work; not isolated GPU time',traceVariant:this.traceVariant??0,sourceCharacters:sources.source.length,renderCompileLinkWallMs:performance.now()-start,renderPassCompileMs:compileMs,splitFieldStages:sources.split,descriptorTexture:descriptors?{width:descriptors.width,height:descriptors.height,bytes:descriptors.bytes,kind:'finite source plane and boundary query records',textureUnit:0}:null,assemblyDescriptorTexture:assemblyDescriptors?{width:assemblyDescriptors.width,height:assemblyDescriptors.height,bytes:assemblyDescriptors.bytes,kind:'finite authored prism, plane, boundary and adjacency query records',textureUnit:5}:null,fieldDescriptorTexture:fieldDescriptors?{width:fieldDescriptors.width,height:fieldDescriptors.height,bytes:fieldDescriptors.bytes,schema:fieldDescriptors.schema,planeCount:fieldDescriptors.planeCount,domainCount:fieldDescriptors.domainCount,kind:'analytic structural plane and finite-domain query records',textureUnit:6}:null,apertureDescriptorTexture:apertureDescriptors?{width:apertureDescriptors.width,height:apertureDescriptors.height,bytes:apertureDescriptors.bytes,kind:'finite hosted aperture analytic coefficients, not sampled geometry',textureUnit:7}:null,probesCompiledLazily:true,probeCompileMs:{},rayProbeInterface:sources.split?'same primary/rescue interfaces and Float32 MRT transport as production render':'single-pass source or diagnostic interface'};
  this.compileProfile=reusedPrograms?{...this.compileProfile,descriptorTexture:nextCompileProfile.descriptorTexture,assemblyDescriptorTexture:nextCompileProfile.assemblyDescriptorTexture,fieldDescriptorTexture:nextCompileProfile.fieldDescriptorTexture,apertureDescriptorTexture:nextCompileProfile.apertureDescriptorTexture,reusedPrograms:true,descriptorUpdateWallMs:this.lastSpecUpdate.wallMs}:{...nextCompileProfile,reusedPrograms:false,descriptorUpdateWallMs:null};
  if(!reusedPrograms)this.initializedProgramKeys.clear();
 }
 createDescriptors(spec){return this.uploadDescriptors(packCaseDescriptors(spec));}
 uploadDescriptors(packed){this.assertLive();const gl=this.gl,texture=gl.createTexture();try{gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,packed.width,packed.height,0,gl.RGBA,gl.FLOAT,packed.data);this.textureParameters();return {texture,width:packed.width,height:packed.height,bytes:packed.data.byteLength};}catch(e){gl.deleteTexture(texture);throw e;}}
 textureParameters(){const g=this.gl;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);}
 createTarget(width,height,count=3){this.assertLive();if(width>this.capabilities.maxTextureSize||height>this.capabilities.maxTextureSize)throw Error('Field target exceeds GPU texture dimensions');const g=this.gl,target={width,height,textures:[],framebuffer:g.createFramebuffer()};try{g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);const attachments=[];for(let i=0;i<count;i++){const t=g.createTexture();target.textures.push(t);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,width,height,0,g.RGBA,g.FLOAT,null);this.textureParameters();g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+i,g.TEXTURE_2D,t,0);attachments.push(g.COLOR_ATTACHMENT0+i);}g.drawBuffers(attachments);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Float32 field framebuffer incomplete');return target;}catch(e){this.deleteTarget(target);throw e;}finally{g.bindFramebuffer(g.FRAMEBUFFER,null);}}
 deleteTarget(target){if(!target)return;for(const t of target.textures)this.gl.deleteTexture(t);this.gl.deleteFramebuffer(target.framebuffer);}
 ensureTargets(){this.assertLive();const {width,height}=this.canvas;if(this.targets?.[0].width===width&&this.targets[0].height===height)return this.targets;for(const t of this.targets??[])this.deleteTarget(t);this.targets=[];try{this.targets.push(this.createTarget(width,height));this.targets.push(this.createTarget(width,height));}catch(e){for(const t of this.targets)this.deleteTarget(t);this.targets=null;throw e;}return this.targets;}
 setTraceVariant(variant){if(![0,1,2,3,4].includes(variant))throw Error('Invalid diagnostic trace variant');this.traceVariant=variant;this.setSpec(this.spec);}
 ensureProbe(kind){if(!this.probePrograms.has(kind)){const start=performance.now(),stage=this.sources.split?1:0,p=program(this.gl,this.probeHead+'#define FIELD_KERNEL_STAGE '+stage+'\n#define PROBE_KIND '+kind+'\n'+this.fieldSource+(kind===2?MOTHER_GLSL+MATERIAL_GLSL:'')+PROBE);this.probePrograms.set(kind,p);this.compileProfile.probeCompileMs[kind]=performance.now()-start;}return this.probePrograms.get(kind);}
 ensureOpticsProbe(){if(this.spec?.fieldKind!=='hosted-context')throw Error('Optical probes require a hosted scene');if(!this.floatExtension||this.gl.getParameter(this.gl.MAX_DRAW_BUFFERS)<4)throw Error('Optical parity requires four Float32 attachments; not verified');if(!this.opticsProbeProgram){const start=performance.now();this.opticsProbeProgram=program(this.gl,this.sources.opticsProbe);this.compileProfile.opticsProbeCompileMs=performance.now()-start;}return this.opticsProbeProgram;}
 /** The production glass transport function, not a second test implementation.
  * The four attachments are numeric query results, never drawable geometry. */
 probeOptics(origins,directions){
  this.assertLive();
  if(!Array.isArray(origins)||!origins.length||origins.length>128||!Array.isArray(directions)||directions.length!==origins.length||origins.some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x)))||directions.some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x))||Math.hypot(...p)<1e-12))throw Error('Optical probe requires 1..128 finite nonzero rays');
  const p=this.ensureOpticsProbe(),target=this.createTarget(origins.length,1,4);try{this.pass(p,target,origins.length,1,{points:origins,directions});const a=[0,1,2,3].map(i=>this.readTarget(target,i)),names={'-1':'primary_miss',0:'non_glass',1:'transmitted',2:'total_internal_reflection',3:'optical_path_unresolved'};return origins.map((_,i)=>{const k=i*4;return {status:names[Math.round(a[0][k])]??'invalid',statusCode:a[0][k],pathLength:a[0][k+1],entryFresnel:a[0][k+2],exitFresnel:a[0][k+3],exitPoint:Array.from(a[1].slice(k,k+3)),startsInside:a[1][k+3]>.5,transmittedDirection:Array.from(a[2].slice(k,k+3)),transmittance:Array.from(a[3].slice(k,k+3)),nextObjectId:a[2][k+3],nextT:a[3][k+3]};});}finally{if(!this.invalidated&&!this.gl.isContextLost()){this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null);this.deleteTarget(target);this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}}
 }
 ensureRayProbes(){if(!this.rayProbePrograms){const start=performance.now(),p={};try{for(const [name,key] of [['primary','rayPrimary'],['rescue','rayRescue'],['result','rayResult']])p[name]=program(this.gl,this.sources[key]);}catch(e){for(const v of Object.values(p))this.gl.deleteProgram(v);throw e;}this.rayProbePrograms=p;this.compileProfile.probeCompileMs[4]=performance.now()-start;}return this.rayProbePrograms;}
 uniforms(p){const g=this.gl,o=this.options,L=n=>g.getUniformLocation(p,n);g.uniform1f(L('uSceneReflection'),o.sceneReflection===0?0:1);g.uniform1f(L('uAge'),o.age);g.uniform1f(L('uWet'),o.wet);g.uniform1f(L('uMaterialEnabled'),o.materialEnabled);const material=adaptHostedMaterialParameters(o);bindHostedMaterialUniforms(g,p,material);for(const [name,key] of [['uFrameColor','frameColor'],['uDoorColor','doorColor'],['uGlassColor','glassColor']])g.uniform3fv(L(name),material[key]);for(const [name,key] of [['uFrameRoughness','frameRoughness'],['uFrameMetallic','frameMetallic'],['uGlassTransmission','glassTransmission'],['uGlassIOR','glassIOR']])g.uniform1f(L(name),material[key]);if(this.apertureDescriptors){g.activeTexture(g.TEXTURE0+7);g.bindTexture(g.TEXTURE_2D,this.apertureDescriptors.texture);g.uniform1i(L('uApertureDescriptors'),7);}if(this.descriptors){g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.descriptors.texture);g.uniform1i(L(['case-context','hosted-context'].includes(this.spec.fieldKind)?'contextSource_caseDescriptors':'caseDescriptors'),0);}if(this.assemblyDescriptors){g.activeTexture(g.TEXTURE0+5);g.bindTexture(g.TEXTURE_2D,this.assemblyDescriptors.texture);g.uniform1i(L(['case-context','hosted-context'].includes(this.spec.fieldKind)?'contextDesign_assemblyDescriptors':'assemblyDescriptors'),5);}if(this.fieldDescriptors){g.activeTexture(g.TEXTURE0+6);g.bindTexture(g.TEXTURE_2D,this.fieldDescriptors.texture);g.uniform1i(L('fieldBoundaryDescriptors'),6);}return L;}
 setCamera(p,width,height,diagnostic=0){const g=this.gl,o=this.options,L=this.uniforms(p);g.uniform2f(L('uResolution'),width,height);for(const[n,v]of [['uEye',o.eye],['uTarget',o.target],['uBoundsMin',this.spec.bounds.min],['uBoundsMax',this.spec.bounds.max]])g.uniform3fv(L(n),v);g.uniform1f(L('uFov'),o.fov);g.uniform1f(L('uCutaway'),o.cutaway);g.uniform1f(L('uOcclusion'),o.occlusion);g.uniform1i(L('uRenderMode'),o.renderMode);g.uniform1i(L('uTraceMode'),o.traceMode??0);g.uniform1i(L('uDiagnostic'),diagnostic);return L;}
 unbindInputTextures(){const g=this.gl;for(let unit=1;unit<=4;unit++){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,null);}g.activeTexture(g.TEXTURE0);}
 bindInputs(p,target,primary=null){const g=this.gl;for(const [i,name] of ['uState','uNormalId','uLocalRole'].entries()){g.activeTexture(g.TEXTURE0+i+1);g.bindTexture(g.TEXTURE_2D,target.textures[i]);g.uniform1i(g.getUniformLocation(p,name),i+1);}if(primary){g.activeTexture(g.TEXTURE0+4);g.bindTexture(g.TEXTURE_2D,primary.textures[0]);g.uniform1i(g.getUniformLocation(p,'uPrimaryState'),4);}}
 pass(p,target,width,height,{input=null,primary=null,diagnostic=0,points=null,directions=null,clip=null}={}){this.assertLive();const gl=this.gl;this.unbindInputTextures();gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer??null);gl.bindVertexArray(this.vao);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.viewport(0,0,width,height);gl.useProgram(p);const L=this.setCamera(p,width,height,diagnostic);if(points){gl.uniform3fv(L('uPoints[0]'),new Float32Array(points.flat()));gl.uniform3fv(L('uDirections[0]'),new Float32Array(directions.flat()));gl.uniform1f(L('uCutaway'),0);}if(input)this.bindInputs(p,input,primary);if(clip){gl.enable(gl.SCISSOR_TEST);gl.scissor(clip.x,clip.y,clip.width,clip.height);}gl.drawArrays(gl.TRIANGLES,0,3);gl.disable(gl.SCISSOR_TEST);}
 createQualityTarget(plan){
  this.assertLive();if(this.isSplitActive())throw Error('Tiled material-quality sampling currently supports direct source/hosted cases only, not the signed stair kernel');
  const limit=Math.min(this.capabilities.maxTextureSize,this.capabilities.maxRenderbufferSize);
  if(![plan.traceWidth,plan.traceHeight].every(n=>Number.isSafeInteger(n)&&n>0&&n<=limit))throw Error('Quality color target exceeds GPU dimensions');
  if(this.capabilities.maxTextureUnits<9)throw Error('Quality presentation requires texture image unit 8 (at least nine units)');
  const g=this.gl,target={width:plan.traceWidth,height:plan.traceHeight,textures:[],framebuffer:g.createFramebuffer(),plan};
  try{const texture=g.createTexture();target.textures.push(texture);g.bindTexture(g.TEXTURE_2D,texture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA8,target.width,target.height,0,g.RGBA,g.UNSIGNED_BYTE,null);this.textureParameters();g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,texture,0);g.drawBuffers([g.COLOR_ATTACHMENT0]);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Quality color target incomplete');return target;}catch(e){this.deleteTarget(target);throw e;}finally{g.bindFramebuffer(g.FRAMEBUFFER,null);g.bindTexture(g.TEXTURE_2D,null);}
 }
 drawQualityTile(target,tile){this.assertLive();if(!this.programs.direct)throw Error('Direct field program unavailable');this.pass(this.programs.direct,target,target.width,target.height,{clip:tile});this.drawCount=(this.drawCount??0)+1;}
 presentQualityTarget(target){
  this.assertLive();const g=this.gl;if(!this.qualityPresentProgram)this.qualityPresentProgram=program(g,QUALITY_PRESENT);
  this.canvas.width=target.plan.width;this.canvas.height=target.plan.height;g.bindFramebuffer(g.FRAMEBUFFER,null);g.bindVertexArray(this.vao);g.disable(g.BLEND);g.disable(g.DEPTH_TEST);g.disable(g.SCISSOR_TEST);g.viewport(0,0,this.canvas.width,this.canvas.height);g.useProgram(this.qualityPresentProgram);g.activeTexture(g.TEXTURE0+8);g.bindTexture(g.TEXTURE_2D,target.textures[0]);g.uniform1i(g.getUniformLocation(this.qualityPresentProgram,'uQualityColor'),8);g.uniform1i(g.getUniformLocation(this.qualityPresentProgram,'uQualitySamples'),target.plan.samplesPerAxis);g.drawArrays(g.TRIANGLES,0,3);g.bindTexture(g.TEXTURE_2D,null);
 }
 isSplitActive(){return this.sources?.split&&(this.options.traceMode??0)===0;}
 // The default framebuffer and RGBA8 scissored color target are separate
 // first-use domains. A signaled screen fence never certifies the other one.
 initializationKey(domain='screen'){
  if(!['screen','quality-rgba8'].includes(domain))throw Error('Unknown program initialization domain');
  if(domain==='quality-rgba8')return 'quality-rgba8:direct:'+resourceId(this.programs?.direct);
  return this.isSplitActive()?['primary','rescue','shade'].map(k=>resourceId(this.programs?.[k])).join(':'):'direct:'+resourceId(this.programs?.direct);
 }
 needsInitialization(domain='screen'){return !!this.spec&&!this.initializedProgramKeys.has(this.initializationKey(domain));}
 prepareInitialization(domain='screen'){this.assertLive();if((domain==='quality-rgba8'||!this.isSplitActive())&&!this.programs.direct){const at=performance.now();this.programs.direct=program(this.gl,this.sources.direct);this.compileProfile.renderPassCompileMs.directDiagnostic=performance.now()-at;}return this.initializationKey(domain);}
 completeInitialization(key,domain='screen'){this.assertLive();if(key!==this.initializationKey(domain))return false;this.initializedProgramKeys.add(key);this.initializationCompletions++;return true;}
 initializationSnapshot(domain='screen'){return {domain,required:this.needsInitialization(domain),programKey:this.initializationKey(domain),completedProgramKeys:[...this.initializedProgramKeys],completions:this.initializationCompletions};}
 draw({diagnostic=false}={}){
  this.assertLive();const gl=this.gl,{width,height}=this.canvas,d=typeof diagnostic==='number'?diagnostic:diagnostic?1:0,first=this.firstDrawPending,profile=first&&this.profileFirstDraw;
  if(profile)this.synchronizePixel();const start=profile?performance.now():0;
  if(this.isSplitActive()){const [primary,final]=this.ensureTargets();this.pass(this.programs.primary,primary,width,height);this.pass(this.programs.rescue,final,width,height,{input:primary});this.pass(this.programs.shade,null,width,height,{input:final,primary,diagnostic:d});this.lastScreenPasses=3;
  }else{if(!this.programs.direct){const at=performance.now();this.programs.direct=program(gl,this.sources.direct);this.compileProfile.renderPassCompileMs.directDiagnostic=performance.now()-at;}this.pass(this.programs.direct,null,width,height,{diagnostic:d});this.lastScreenPasses=1;}
  if(first){if(profile)this.synchronizePixel();this.compileProfile.firstDrawSyncWallMs=profile?performance.now()-start:null;this.compileProfile.firstDrawMeasurement=profile?'explicit QA first-frame draw plus finish/readback wall time, not isolated GPU time':'ordinary interactive first draw was submitted without finish/readback profiling';this.compileProfile.firstDrawResolution={width,height};this.compileProfile.firstDrawDiagnostic=d;this.firstDrawPending=false;}
  this.drawCount=(this.drawCount??0)+1;const err=gl.getError();if(err)throw Error('WebGL error '+err);
 }

 resize(width,height){width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));if(this.canvas.width===width&&this.canvas.height===height)return;this.canvas.width=width;this.canvas.height=height;this.draw();}
 // readPixels is the blocking synchronization point in browser/GPU-process runs.
 // gl.finish alone was observed to return before queued remote rendering completed.
 synchronizePixel(target=null){this.assertLive();const g=this.gl,pixel=target?new Float32Array(4):new Uint8Array(4);g.finish();g.bindFramebuffer(g.FRAMEBUFFER,target?.framebuffer??null);g.readBuffer(target?g.COLOR_ATTACHMENT0:g.BACK);g.readPixels(0,0,1,1,g.RGBA,target?g.FLOAT:g.UNSIGNED_BYTE,pixel);const err=g.getError();if(err)throw Error('One-pixel field synchronization failed: '+err);return pixel;}
 readTarget(target,attachment=0){this.assertLive();const g=this.gl,out=new Float32Array(target.width*target.height*4);g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);g.readBuffer(g.COLOR_ATTACHMENT0+attachment);g.readPixels(0,0,target.width,target.height,g.RGBA,g.FLOAT,out);g.bindFramebuffer(g.FRAMEBUFFER,null);g.readBuffer(g.BACK);const err=g.getError();if(err)throw Error('Float32 field readback failed: '+err);return out;}
 probe(points,kind=0,directions=null){
  this.assertLive();
  if(!this.floatExtension)throw Error('Float GPU query readback unavailable; parity is not verified');if(!points.length||points.length>128)throw Error('Probe requires1..128points');if(kind===4&&(!directions||directions.length!==points.length))throw Error('Ray probe requires one direction per point');
  const g=this.gl,temporary=[];try{
   if(kind===4&&this.sources.split){const p=this.ensureRayProbes(),primary=this.createTarget(points.length,1);temporary.push(primary);const final=this.createTarget(points.length,1);temporary.push(final);const result=this.createTarget(points.length,1,1);temporary.push(result);this.pass(p.primary,primary,points.length,1,{points,directions});this.pass(p.rescue,final,points.length,1,{input:primary,points,directions});this.pass(p.result,result,points.length,1,{input:final});const out=this.readTarget(result);return points.map((_,i)=>Array.from(out.slice(i*4,i*4+4)));}
   const p=this.ensureProbe(kind),target=this.createTarget(points.length,1,1);temporary.push(target);this.unbindInputTextures();g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);g.useProgram(p);g.bindVertexArray(this.vao);g.disable(g.BLEND);g.disable(g.DEPTH_TEST);g.disable(g.SCISSOR_TEST);const L=this.uniforms(p);g.uniform3fv(L('uPoints[0]'),new Float32Array(points.flat()));if(directions)g.uniform3fv(L('uDirections[0]'),new Float32Array(directions.flat()));g.viewport(0,0,points.length,1);g.drawArrays(g.TRIANGLES,0,3);const out=this.readTarget(target);return points.map((_,i)=>Array.from(out.slice(i*4,i*4+4)));
  }finally{if(!this.invalidated&&!g.isContextLost()){g.bindFramebuffer(g.FRAMEBUFFER,null);this.unbindInputTextures();for(const t of temporary)this.deleteTarget(t);g.viewport(0,0,this.canvas.width,this.canvas.height);}}
 }
 diagnostics(){
  this.assertLive();
  const g=this.gl,pixels=this.canvas.width*this.canvas.height,split=this.isSplitActive();let hits=0,misses=0,unresolved=0,sum=0,max=0,rescuePixelCount=null,meanPrimarySteps=null,maxPrimarySteps=null;const histogram=Array(split?513:256).fill(0),ids={},unresolvedPixelSamples=[];let diagnosticPixelIndex=0;
  const count=(steps,status,objectId)=>{sum+=steps;max=Math.max(max,steps);histogram[steps]=(histogram[steps]??0)+1;if(status===1){hits++;ids[objectId]=(ids[objectId]??0)+1;}else if(status===2)misses++;else{unresolved++;if(unresolvedPixelSamples.length<16)unresolvedPixelSamples.push({x:diagnosticPixelIndex%this.canvas.width,y:Math.floor(diagnosticPixelIndex/this.canvas.width),origin:'bottom-left',steps,status});}diagnosticPixelIndex++;};
  if(split){this.draw();const primary=this.readTarget(this.targets[0]),final=this.readTarget(this.targets[1]),normalId=this.readTarget(this.targets[1],1);rescuePixelCount=0;maxPrimarySteps=0;let primarySum=0;for(let i=0;i<final.length;i+=4){count(Math.round(final[i+2]),Math.round(final[i+1]),Math.round(normalId[i+3]));const steps=Math.round(primary[i+3]);primarySum+=steps;maxPrimarySteps=Math.max(maxPrimarySteps,steps);if(Math.round(primary[i+1])===3)rescuePixelCount++;}meanPrimarySteps=primarySum/pixels;for(const sample of unresolvedPixelSamples){const i=(sample.y*this.canvas.width+sample.x)*4;sample.primaryState=Array.from(primary.slice(i,i+4));sample.finalState=Array.from(final.slice(i,i+4));sample.stateLayout=['rayT','status','marchIterations','primaryIterations'];}
  }else{this.draw({diagnostic:true});const a=new Uint8Array(pixels*4);g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);for(let i=0;i<a.length;i+=4){const d=decodeDiagnosticPixel(a[i],a[i+1],a[i+2]);count(d.steps,d.status,d.objectId);}if(!this.spec.fieldKind){this.draw({diagnostic:2});g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);rescuePixelCount=0;let primarySum=0;maxPrimarySteps=0;for(let i=0;i<a.length;i+=4){primarySum+=a[i];maxPrimarySteps=Math.max(maxPrimarySteps,a[i]);if(a[i+1]>127)rescuePixelCount++;}meanPrimarySteps=primarySum/pixels;}this.draw();}
  return {width:this.canvas.width,height:this.canvas.height,pixels,hits,misses,unresolved,rescuePixelCount,meanPrimarySteps,maxPrimarySteps,meanSteps:sum/pixels,maxSteps:max,...rendererDiagnosticContract(this.spec,this.traceVariant??0,this.options.traceMode??0,this.options),stepCountsSaturateAt255:!split,readback:split?'exact Float32 primary and final MRT attachments':'8-bit packed diagnostic pass',screenPassesPerFrame:split?3:1,structuralPlaneCount:this.spec.structurePlanes?.length??null,ambientOcclusionEnabled:!!this.options.occlusion,histogram,unresolvedPixelSamples,camera:{eye:[...this.options.eye],target:[...this.options.target],fov:this.options.fov},visibleObjectPixels:ids,unresolvedColor:'#d91f8c'};
 }
 async benchmarkStages(frames=3){
  this.assertLive();
  if(!this.isSplitActive())throw Error('Per-stage benchmark requires the production split-field path');
  if(!Number.isInteger(frames)||frames<1||frames>32)throw Error('Per-stage benchmark requires 1..32 samples');
  const gl=this.gl,{width,height}=this.canvas,spec=this.spec,options=JSON.stringify(this.options),initializationFrames=this.firstDrawPending?1:0;
  if(this.firstDrawPending)this.draw();
  const [primary,final]=this.ensureTargets(),samples={primary:[],rescue:[],shade:[]},warmupFrames=2;
  for(let i=0;i<warmupFrames+frames;i++){
   await new Promise(r=>requestAnimationFrame(r));this.assertLive();
   if(this.spec!==spec||this.canvas.width!==width||this.canvas.height!==height||JSON.stringify(this.options)!==options||!this.isSplitActive())throw Error('Scene changed during per-stage benchmark; timings are not comparable');
   this.synchronizePixel();
   for(const [name,target,draw] of [
    ['primary',primary,()=>this.pass(this.programs.primary,primary,width,height)],
    ['rescue',final,()=>this.pass(this.programs.rescue,final,width,height,{input:primary})],
    ['shade',null,()=>this.pass(this.programs.shade,null,width,height,{input:final,primary})]
   ]){const start=performance.now();draw();this.synchronizePixel(target);const elapsed=performance.now()-start;if(i>=warmupFrames)samples[name].push(elapsed);}
   this.drawCount=(this.drawCount??0)+1;this.lastScreenPasses=3;const err=gl.getError();if(err)throw Error('Per-stage benchmark WebGL error '+err);
  }
  const primaryState=this.readTarget(primary),finalState=this.readTarget(final),count=(a)=>{const r={hits:0,misses:0,unresolved:0,invalid:0,meanSteps:0,maxSteps:0};for(let i=0;i<a.length;i+=4){const status=a[i+1],steps=a[i+2];if(status===1)r.hits++;else if(status===2)r.misses++;else if(status===3)r.unresolved++;else r.invalid++;r.meanSteps+=steps;r.maxSteps=Math.max(r.maxSteps,steps);}r.meanSteps/=width*height;return r;},primaryCounts=count(primaryState),finalCounts=count(finalState),stages={};
  for(const [name,a] of Object.entries(samples))stages[name]={samples:a,medianMs:nearestRankQuantile(a,.5),p95Ms:nearestRankQuantile(a,.95)};
  stages.rescue.unresolvedInputPixels=primaryCounts.unresolved;stages.rescue.passthroughPixels=primaryCounts.hits+primaryCounts.misses;
  return {measurement:'per-pass wallclock state setup and draw plus gl.finish and one-pixel readback from that pass target; not isolated GPU timer',interpretation:'Each pass is synchronized by its own blocking one-pixel readback. Prior finish-only near-zero stage measurements are invalid and superseded. Stage times do not equal or replace the unsplit full-frame benchmark. Rescue runs only for primary status 3; other pixels use passthrough.',quantileMethod:'nearest rank: ceil(q*n)-1',width,height,pixels:width*height,warmupFrames,sampleFrames:frames,initializationFrames,gpu:this.gpu,options:JSON.parse(options),stages,statusCounts:{primary:primaryCounts,final:finalCounts},rescuePixelCount:primaryCounts.unresolved,synchronizationReadback:'one pixel per pass inside timing: RGBA/FLOAT from primary and rescue COLOR_ATTACHMENT0; RGBA/UNSIGNED_BYTE from default framebuffer for shade',readback:'Full Float32 primary and final state attachments for status counts after the final measured frame; outside timing',stepCap:512,modelTriangles:0,screenTrianglesPerPass:1,screenPassesPerFrame:3,screenTrianglesPerFrame:3,vertexBuffers:0,indexBuffers:0};
 }
 async benchmark(frames=12){this.assertLive();if(!Number.isInteger(frames)||frames<1||frames>32)throw Error('Benchmark requires 1..32 frames');const timings=[];for(let i=0;i<frames+2;i++){await new Promise(r=>requestAnimationFrame(r));this.assertLive();const start=performance.now();this.draw();this.gl.finish();this.gl.readPixels(0,0,1,1,this.gl.RGBA,this.gl.UNSIGNED_BYTE,new Uint8Array(4));if(i>=2)timings.push(performance.now()-start);}return {measurement:'wallclock draw plus gl.finish and pixel readback, not isolated GPU timer',quantileMethod:'nearest rank: ceil(q*n)-1',samples:timings,medianMs:nearestRankQuantile(timings,.5),p95Ms:nearestRankQuantile(timings,.95),width:this.canvas.width,height:this.canvas.height,gpu:this.gpu,timerExtensionAvailable:!!this.timerExtension,modelTriangles:0,screenTrianglesPerPass:1,screenPassesPerFrame:this.lastScreenPasses,screenTrianglesPerFrame:this.lastScreenPasses,vertexBuffers:0,indexBuffers:0};}
 assertLive(){if(this.invalidated||this.gl.isContextLost()){const e=Error('Field GPU operation interrupted by context generation change');e.name='AbortError';throw e;}}
 invalidate(contextLost=false){this.invalidated=true;this.resourcesLost=this.resourcesLost||contextLost||this.gl.isContextLost();}
 dispose(){
  if(!this.resourcesLost&&!this.gl.isContextLost()){const g=this.gl;for(const p of Object.values(this.programs??{}))g.deleteProgram(p);for(const p of this.probePrograms?.values()??[])g.deleteProgram(p);for(const p of Object.values(this.rayProbePrograms??{}))g.deleteProgram(p);if(this.opticsProbeProgram)g.deleteProgram(this.opticsProbeProgram);if(this.qualityPresentProgram)g.deleteProgram(this.qualityPresentProgram);for(const key of ['descriptors','assemblyDescriptors','fieldDescriptors','apertureDescriptors'])if(this[key])g.deleteTexture(this[key].texture);for(const t of this.targets??[])this.deleteTarget(t);if(this.vao)g.deleteVertexArray(this.vao);}
  this.invalidated=true;
 }
 resourceSnapshot(){return {initialization:this.initializationSnapshot(),qualityInitialization:this.initializationSnapshot('quality-rgba8'),rendererId:this.rendererId,resourceEpoch:this.resourceEpoch,invalidated:this.invalidated,capabilities:{...this.capabilities},vao:resourceId(this.vao),programs:Object.fromEntries(Object.entries(this.programs??{}).map(([k,v])=>[k,resourceId(v)])),descriptorTextures:Object.fromEntries(['descriptors','assemblyDescriptors','fieldDescriptors','apertureDescriptors'].filter(k=>this[k]).map(k=>[k,resourceId(this[k].texture)])),targets:(this.targets??[]).map(t=>({width:t.width,height:t.height,framebuffer:resourceId(t.framebuffer),textures:t.textures.map(resourceId)})),probePrograms:[...(this.probePrograms?.values()??[])].map(resourceId),rayProbePrograms:Object.values(this.rayProbePrograms??{}).map(resourceId),opticsProbeProgram:resourceId(this.opticsProbeProgram),profileFirstDraw:this.profileFirstDraw};}
 snapshot(){return {resources:this.resourceSnapshot(),gpu:this.gpu,width:this.canvas.width,height:this.canvas.height,drawCount:this.drawCount,compileCount:this.compileCount,specUpdateCount:this.specUpdateCount,programReuseCount:this.programReuseCount,lastSpecUpdate:this.lastSpecUpdate,compileProfile:this.compileProfile,modelTriangles:0,vertexBuffers:0,indexBuffers:0,screenTrianglesPerPass:1,screenPassesPerFrame:this.isSplitActive()?3:1,screenTrianglesPerFrame:this.isSplitActive()?3:1,floatQueryReadback:!!this.floatExtension,renderer:this.isSplitActive()?'WebGL2 direct analytic field: primary Float32 MRT, unresolved-only rescue, shared shade':'WebGL2 direct analytic field ray evaluation',noMeshFallback:true,opticalModel:materialQualityOpticalContract(this.spec,this.options)};}
}
