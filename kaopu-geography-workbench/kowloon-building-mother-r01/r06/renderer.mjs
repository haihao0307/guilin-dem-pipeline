/** Original direct field renderer. No model meshes, vertex arrays or index buffers. */
import {buildFieldGLSL,packFieldDescriptors} from './field.mjs';
import {buildCaseGLSL,packCaseDescriptors} from './cases.mjs';
import {buildAssemblyGLSL,packAssemblyDescriptors} from './assemblies.mjs';
import {buildContextGLSL} from './context.mjs';
import {MOTHER_GLSL,MATERIAL_GLSL} from './material.mjs';
const VERTEX=`#version 300 es
precision highp float;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
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
const SHADE=String.raw`
float displayDistance(vec3 p){float d=mapField(p).distance;if(uCutaway>.5)d=max(d,-p.x-.2);return d;}
vec3 colorId(float id){return .35+.6*cos(vec3(0.,2.,4.)+id*1.37);}
vec4 shadeFieldHit(vec3 rd,float t,FieldHit h,int steps,int status,vec3 n){
 vec3 p=uEye+rd*t;
 vec3 sky=mix(vec3(.82,.87,.86),vec3(.48,.62,.67),clamp(rd.y*.6+.4,0.,1.));
 if(status==3){return vec4(.85,.12,.55,1.);}
 if(status!=1){return vec4(sky,1.);}
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
 float eps=max(footprint,.0008);FieldHit ht=h;ht.local=h.local+localTangent*eps;FieldHit hb=h;hb.local=h.local+localBitangent*eps;
 float dh1=(sampleFieldMaterial(ht,materialNormal,footprint).height-surface.height)/eps,dh2=(sampleFieldMaterial(hb,materialNormal,footprint).height-surface.height)/eps;
 n=normalize(n-clamp(dh1,-.3,.3)*tangent-clamp(dh2,-.3,.3)*bitangent);
 vec3 view=normalize(uEye-p),sun=normalize(vec3(-.55,1.,-.45));
 float ao=1.;if(uOcclusion>.5)for(int i=1;i<=3;i++){float r=float(i)*.14;ao-=max(r-max(displayDistance(p+n*r),0.),0.)/(r*9.);}
 vec3 color=directBRDF(surface,n,view,sun,vec3(3.0,2.85,2.65));
 color+=directBRDF(surface,n,view,normalize(vec3(.5,.4,.7)),vec3(.5,.65,.8));
 color+=surface.baseColor*(1.-surface.metallic)*mix(vec3(.12,.14,.13),vec3(.3,.36,.38),n.y*.5+.5)*clamp(ao,.35,1.);
 color+=surface.baseColor*surface.metallic*.14;
 color=color/(1.+color);color=pow(max(color,vec3(0.)),vec3(1./2.2));
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
 const code=spec.fieldKind==='measured-surface'?buildCaseGLSL(spec):spec.fieldKind==='evidence-assembly'?buildAssemblyGLSL(spec):spec.fieldKind==='case-context'?buildContextGLSL(spec):buildFieldGLSL(spec),source=typeof code==='string'?code:code.source;
 const surface=['measured-surface','evidence-assembly','case-context'].includes(spec.fieldKind),head=HEAD+'#define FIELD_CONTEXT '+(spec.fieldKind==='case-context'?'1':'0')+'\n#define FIELD_TRACE_VARIANT '+traceVariant+'\n#define FIELD_SURFACE '+(surface?'1':'0')+'\n#define FIELD_MEASURED '+(spec.fieldKind==='measured-surface'?'1':'0')+'\n';
 const stage=n=>head+'#define FIELD_KERNEL_STAGE '+n+'\n',renderHead=stage(0)+source+MOTHER_GLSL+MATERIAL_GLSL+CAMERA+SHADE+DIAGNOSTIC;
 return {source,head,split:!surface&&traceVariant===0,
  direct:renderHead+DIRECT,
  primary:stage(1)+source+CAMERA+RAY_INPUT+MRT+PRIMARY,
  rescue:stage(2)+source+CAMERA+RAY_INPUT+MRT+INPUT_MRT+RESCUE,
  shade:stage(1)+source+MOTHER_GLSL+MATERIAL_GLSL+CAMERA+SHADE+DIAGNOSTIC+INPUT_MRT+SPLIT_SHADE,
  rayPrimary:stage(1)+'#define FIELD_RAY_PROBE 1\n'+source+CAMERA+RAY_INPUT+MRT+PRIMARY,
  rayRescue:stage(2)+'#define FIELD_RAY_PROBE 1\n'+source+CAMERA+RAY_INPUT+MRT+INPUT_MRT+RESCUE,
  rayResult:HEAD+INPUT_MRT+SPLIT_PROBE};
}
/** Describes the actual rendering query; finite test counts are not march budgets. */
export function rendererDiagnosticContract(spec,traceVariant=0,traceMode=0){
 const kind=spec.fieldKind;
 if(kind==='measured-surface')return {rayMethod:'finite measured-plane and boundary intersection with BVH',metric:'BVH node visits',stepCap:spec.nodes.length,stepCapKind:'finite query upper bound, not a march budget',iterationBudget:null,unresolvedExpected:false,hitEpsilon:'ray/plane residual plus finite-boundary distance <0.00002m in the GPU predicate',stepRule:'finite source plane intersections with outer-loop and hole predicates; BVH traversal, no ray marching',missCondition:'BVH traversal found no source patch satisfying the ray/plane and finite-boundary predicates'};
 if(kind==='evidence-assembly')return {rayMethod:'finite authored-prism plane and union-boundary intersection',metric:'finite host plane tests',stepCap:spec.counts.analyticBoundaryPlanes,stepCapKind:'finite query upper bound, not a march budget',iterationBudget:null,unresolvedExpected:false,hitEpsilon:'no distance-march hit epsilon; finite cap/side-domain tests and union seam checks at +/-0.00001m',stepRule:'enumerate exact finite authored cap and side candidates; reject buried union seams, no ray marching',missCondition:'all relevant finite authored plane candidates failed their own domains or were buried inside the authored union'};
 if(kind==='case-context')return {rayMethod:'display-restricted measured BVH plus rigid authored finite-domain intersection',metric:'source BVH visits + authored finite plane tests',stepCap:spec.measured.nodes.length+spec.counts.analyticBoundaryPlanes,stepCapKind:'combined finite query upper bound, not a march budget',iterationBudget:null,unresolvedExpected:false,hitEpsilon:'source finite-surface predicate <0.00002m; authored exact cap/side domains with +/-0.00001m union seam checks',stepRule:'query both independent finite-field paths; apply source display interval without adding caps; choose nearest eligible hit, no ray marching',missCondition:'neither the display-restricted measured source nor the authored finite-domain query produced an eligible hit'};
 if(traceVariant===4)return {rayMethod:'empty diagnostic path',metric:'no field queries',stepCap:0,stepCapKind:'diagnostic query count',iterationBudget:0,unresolvedExpected:false,hitEpsilon:'not applicable to the empty diagnostic path',stepRule:'diagnostic background only; not a production geometry query',missCondition:'empty diagnostic path intentionally reports background'};
 if(traceVariant===3)return {rayMethod:'conservative-distance diagnostic path',metric:'whole-field diagnostic march iterations',stepCap:512,stepCapKind:'march iteration budget',iterationBudget:512,unresolvedExpected:true,hitEpsilon:'diagnostic abs(distance) < max(0.00015m,t*0.000025)',stepRule:'diagnostic abs(distance)*0.8 advance with 512-iteration cap; not the primary/rescue production kernel',missCondition:'ray exits finite bounds; budget exhaustion remains unresolved'};
 const analytic=traceVariant===1||traceVariant===2?traceVariant:traceMode;
 if(analytic)return {rayMethod:'analytic diagnostic isolation',metric:'rail march iterations; excludes structural plane, normal and attribute query costs',stepCap:analytic===1?0:512,stepCapKind:'rail march iteration budget',iterationBudget:analytic===1?0:512,unresolvedExpected:analytic!==1,hitEpsilon:analytic===1?'exact finite structural candidate predicates':'rail abs(distance) < max(0.00015m,local ray t*0.000025)',stepRule:analytic===1?'finite structural boundaries only; rail tracing disabled':analytic===2?'rail-only conservative tracing with 512-iteration cap; structural candidates disabled':'finite structural candidates plus rail-only conservative tracing with 512-iteration cap',missCondition:'enabled finite candidates rejected all hits and any enabled rail interval exhausted geometrically; rail budget exhaustion remains unresolved'};
 return {rayMethod:'conservative primary with finite-boundary and rail rescue',metric:'primary + rescue rail march iterations; excludes normal and attribute field queries',stepCap:512,stepCapKind:'shared primary and rescue march iteration budget',iterationBudget:512,unresolvedExpected:true,hitEpsilon:'kernel primary/rescue 0.00001m; grazing or non-boundary candidates require analytic recovery',stepRule:'conservative primary with shared512 march-iteration budget; unresolved/grazing recovery uses exact finite structural boundaries and rail-only conservative tracing; no unsafe minimum step',missCondition:'finite boundary tests rejected all candidates and rail interval exhausted geometrically; budget exhaustion remains unresolved'};
}
export class FieldRenderer{
 constructor(canvas){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 is unavailable. No mesh fallback is used.');
  gl.disable(gl.DITHER);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);this.floatExtension=gl.getExtension('EXT_color_buffer_float');this.timerExtension=gl.getExtension('EXT_disjoint_timer_query_webgl2');const info=gl.getExtension('WEBGL_debug_renderer_info');this.gpu=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  this.vertexBufferCount=0;this.indexBufferCount=0;this.modelTriangles=0;this.screenTrianglesPerPass=1;this.options={eye:[7,7,-7],target:[0,1.8,2.5],fov:45*Math.PI/180,cutaway:0,renderMode:0,age:.18,wet:.08,materialEnabled:1,occlusion:0,traceMode:0};
 }
 setSpec(spec){
  const start=performance.now(),gl=this.gl,sources=buildRendererSources(spec,this.traceVariant??0),programs={},compileMs={};let descriptors=null,assemblyDescriptors=null,fieldDescriptors=null;
  try{
   if(sources.split&&(!this.floatExtension||gl.getParameter(gl.MAX_DRAW_BUFFERS)<3||gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)<3))throw Error('Direct split-field rendering requires three Float32 color attachments. No mesh fallback is used.');
   for(const name of sources.split?['primary','rescue','shade']:['direct']){const at=performance.now();programs[name]=program(gl,sources[name]);compileMs[name]=performance.now()-at;}
   if(spec.fieldKind==='measured-surface'||spec.fieldKind==='case-context')descriptors=this.createDescriptors(spec.fieldKind==='case-context'?spec.measured:spec);
   if(spec.fieldKind==='evidence-assembly'||spec.fieldKind==='case-context')assemblyDescriptors=this.uploadDescriptors(packAssemblyDescriptors(spec.fieldKind==='case-context'?spec.assembly:spec));
   if(!spec.fieldKind){const packed=packFieldDescriptors(spec);fieldDescriptors={...this.uploadDescriptors(packed),schema:packed.schema,planeCount:packed.planeCount,domainCount:packed.domainCount};}
  }catch(e){for(const p of Object.values(programs))gl.deleteProgram(p);if(descriptors)gl.deleteTexture(descriptors.texture);if(assemblyDescriptors)gl.deleteTexture(assemblyDescriptors.texture);if(fieldDescriptors)gl.deleteTexture(fieldDescriptors.texture);throw e;}
  for(const p of Object.values(this.programs??{}))gl.deleteProgram(p);for(const p of this.probePrograms?.values()??[])gl.deleteProgram(p);for(const p of Object.values(this.rayProbePrograms??{}))gl.deleteProgram(p);if(this.descriptors)gl.deleteTexture(this.descriptors.texture);if(this.assemblyDescriptors)gl.deleteTexture(this.assemblyDescriptors.texture);if(this.fieldDescriptors)gl.deleteTexture(this.fieldDescriptors.texture);
  this.programs=programs;this.probePrograms=new Map();this.rayProbePrograms=null;this.descriptors=descriptors;this.assemblyDescriptors=assemblyDescriptors;this.fieldDescriptors=fieldDescriptors;this.sources=sources;this.renderProgram=programs.shade??programs.direct;this.spec=spec;this.fieldSource=sources.source;this.probeHead=sources.head;this.compileCount=(this.compileCount??0)+1;
  this.firstDrawPending=true;this.compileProfile={firstDrawSyncWallMs:null,firstDrawResolution:null,firstDrawMeasurement:'first full-frame draw plus gl.finish and one-pixel default-framebuffer readback; includes deferred driver work and target allocation, excludes prior queued work; not isolated GPU time',traceVariant:this.traceVariant??0,sourceCharacters:sources.source.length,renderCompileLinkWallMs:performance.now()-start,renderPassCompileMs:compileMs,splitFieldStages:sources.split,descriptorTexture:descriptors?{width:descriptors.width,height:descriptors.height,bytes:descriptors.bytes,kind:'finite source plane and boundary query records',textureUnit:0}:null,assemblyDescriptorTexture:assemblyDescriptors?{width:assemblyDescriptors.width,height:assemblyDescriptors.height,bytes:assemblyDescriptors.bytes,kind:'finite authored prism, plane, boundary and adjacency query records',textureUnit:5}:null,fieldDescriptorTexture:fieldDescriptors?{width:fieldDescriptors.width,height:fieldDescriptors.height,bytes:fieldDescriptors.bytes,schema:fieldDescriptors.schema,planeCount:fieldDescriptors.planeCount,domainCount:fieldDescriptors.domainCount,kind:'analytic structural plane and finite-domain query records',textureUnit:6}:null,probesCompiledLazily:true,probeCompileMs:{},rayProbeInterface:sources.split?'same primary/rescue interfaces and Float32 MRT transport as production render':'single-pass source or diagnostic interface'};
 }
 createDescriptors(spec){return this.uploadDescriptors(packCaseDescriptors(spec));}
 uploadDescriptors(packed){const gl=this.gl,texture=gl.createTexture();try{gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,packed.width,packed.height,0,gl.RGBA,gl.FLOAT,packed.data);this.textureParameters();return {texture,width:packed.width,height:packed.height,bytes:packed.data.byteLength};}catch(e){gl.deleteTexture(texture);throw e;}}
 textureParameters(){const g=this.gl;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);}
 createTarget(width,height,count=3){const g=this.gl,target={width,height,textures:[],framebuffer:g.createFramebuffer()};try{g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);const attachments=[];for(let i=0;i<count;i++){const t=g.createTexture();target.textures.push(t);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,width,height,0,g.RGBA,g.FLOAT,null);this.textureParameters();g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+i,g.TEXTURE_2D,t,0);attachments.push(g.COLOR_ATTACHMENT0+i);}g.drawBuffers(attachments);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Float32 field framebuffer incomplete');return target;}catch(e){this.deleteTarget(target);throw e;}finally{g.bindFramebuffer(g.FRAMEBUFFER,null);}}
 deleteTarget(target){if(!target)return;for(const t of target.textures)this.gl.deleteTexture(t);this.gl.deleteFramebuffer(target.framebuffer);}
 ensureTargets(){const {width,height}=this.canvas;if(this.targets?.[0].width===width&&this.targets[0].height===height)return this.targets;for(const t of this.targets??[])this.deleteTarget(t);this.targets=[];try{this.targets.push(this.createTarget(width,height));this.targets.push(this.createTarget(width,height));}catch(e){for(const t of this.targets)this.deleteTarget(t);this.targets=null;throw e;}return this.targets;}
 setTraceVariant(variant){if(![0,1,2,3,4].includes(variant))throw Error('Invalid diagnostic trace variant');this.traceVariant=variant;this.setSpec(this.spec);}
 ensureProbe(kind){if(!this.probePrograms.has(kind)){const start=performance.now(),stage=this.sources.split?1:0,p=program(this.gl,this.probeHead+'#define FIELD_KERNEL_STAGE '+stage+'\n#define PROBE_KIND '+kind+'\n'+this.fieldSource+(kind===2?MOTHER_GLSL+MATERIAL_GLSL:'')+PROBE);this.probePrograms.set(kind,p);this.compileProfile.probeCompileMs[kind]=performance.now()-start;}return this.probePrograms.get(kind);}
 ensureRayProbes(){if(!this.rayProbePrograms){const start=performance.now(),p={};try{for(const [name,key] of [['primary','rayPrimary'],['rescue','rayRescue'],['result','rayResult']])p[name]=program(this.gl,this.sources[key]);}catch(e){for(const v of Object.values(p))this.gl.deleteProgram(v);throw e;}this.rayProbePrograms=p;this.compileProfile.probeCompileMs[4]=performance.now()-start;}return this.rayProbePrograms;}
 uniforms(p){const g=this.gl,o=this.options,L=n=>g.getUniformLocation(p,n);g.uniform1f(L('uAge'),o.age);g.uniform1f(L('uWet'),o.wet);g.uniform1f(L('uMaterialEnabled'),o.materialEnabled);if(this.descriptors){g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.descriptors.texture);g.uniform1i(L(this.spec.fieldKind==='case-context'?'contextSource_caseDescriptors':'caseDescriptors'),0);}if(this.assemblyDescriptors){g.activeTexture(g.TEXTURE0+5);g.bindTexture(g.TEXTURE_2D,this.assemblyDescriptors.texture);g.uniform1i(L(this.spec.fieldKind==='case-context'?'contextDesign_assemblyDescriptors':'assemblyDescriptors'),5);}if(this.fieldDescriptors){g.activeTexture(g.TEXTURE0+6);g.bindTexture(g.TEXTURE_2D,this.fieldDescriptors.texture);g.uniform1i(L('fieldBoundaryDescriptors'),6);}return L;}
 setCamera(p,width,height,diagnostic=0){const g=this.gl,o=this.options,L=this.uniforms(p);g.uniform2f(L('uResolution'),width,height);for(const[n,v]of [['uEye',o.eye],['uTarget',o.target],['uBoundsMin',this.spec.bounds.min],['uBoundsMax',this.spec.bounds.max]])g.uniform3fv(L(n),v);g.uniform1f(L('uFov'),o.fov);g.uniform1f(L('uCutaway'),o.cutaway);g.uniform1f(L('uOcclusion'),o.occlusion);g.uniform1i(L('uRenderMode'),o.renderMode);g.uniform1i(L('uTraceMode'),o.traceMode??0);g.uniform1i(L('uDiagnostic'),diagnostic);return L;}
 unbindInputTextures(){const g=this.gl;for(let unit=1;unit<=4;unit++){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,null);}g.activeTexture(g.TEXTURE0);}
 bindInputs(p,target,primary=null){const g=this.gl;for(const [i,name] of ['uState','uNormalId','uLocalRole'].entries()){g.activeTexture(g.TEXTURE0+i+1);g.bindTexture(g.TEXTURE_2D,target.textures[i]);g.uniform1i(g.getUniformLocation(p,name),i+1);}if(primary){g.activeTexture(g.TEXTURE0+4);g.bindTexture(g.TEXTURE_2D,primary.textures[0]);g.uniform1i(g.getUniformLocation(p,'uPrimaryState'),4);}}
 pass(p,target,width,height,{input=null,primary=null,diagnostic=0,points=null,directions=null}={}){const gl=this.gl;this.unbindInputTextures();gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer??null);gl.bindVertexArray(this.vao);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.viewport(0,0,width,height);gl.useProgram(p);const L=this.setCamera(p,width,height,diagnostic);if(points){gl.uniform3fv(L('uPoints[0]'),new Float32Array(points.flat()));gl.uniform3fv(L('uDirections[0]'),new Float32Array(directions.flat()));gl.uniform1f(L('uCutaway'),0);}if(input)this.bindInputs(p,input,primary);gl.drawArrays(gl.TRIANGLES,0,3);}
 isSplitActive(){return this.sources.split&&(this.options.traceMode??0)===0;}
 draw({diagnostic=false}={}){
  const gl=this.gl,{width,height}=this.canvas,d=typeof diagnostic==='number'?diagnostic:diagnostic?1:0,first=this.firstDrawPending;
  if(first)this.synchronizePixel();const start=first?performance.now():0;
  if(this.isSplitActive()){const [primary,final]=this.ensureTargets();this.pass(this.programs.primary,primary,width,height);this.pass(this.programs.rescue,final,width,height,{input:primary});this.pass(this.programs.shade,null,width,height,{input:final,primary,diagnostic:d});this.lastScreenPasses=3;
  }else{if(!this.programs.direct){const at=performance.now();this.programs.direct=program(gl,this.sources.direct);this.compileProfile.renderPassCompileMs.directDiagnostic=performance.now()-at;}this.pass(this.programs.direct,null,width,height,{diagnostic:d});this.lastScreenPasses=1;}
  if(first){this.synchronizePixel();this.compileProfile.firstDrawSyncWallMs=performance.now()-start;this.compileProfile.firstDrawResolution={width,height};this.compileProfile.firstDrawDiagnostic=d;this.firstDrawPending=false;}
  this.drawCount=(this.drawCount??0)+1;const err=gl.getError();if(err)throw Error('WebGL error '+err);
 }

 resize(width,height){width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));if(this.canvas.width===width&&this.canvas.height===height)return;this.canvas.width=width;this.canvas.height=height;this.draw();}
 // readPixels is the blocking synchronization point in browser/GPU-process runs.
 // gl.finish alone was observed to return before queued remote rendering completed.
 synchronizePixel(target=null){const g=this.gl,pixel=target?new Float32Array(4):new Uint8Array(4);g.finish();g.bindFramebuffer(g.FRAMEBUFFER,target?.framebuffer??null);g.readBuffer(target?g.COLOR_ATTACHMENT0:g.BACK);g.readPixels(0,0,1,1,g.RGBA,target?g.FLOAT:g.UNSIGNED_BYTE,pixel);const err=g.getError();if(err)throw Error('One-pixel field synchronization failed: '+err);return pixel;}
 readTarget(target,attachment=0){const g=this.gl,out=new Float32Array(target.width*target.height*4);g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);g.readBuffer(g.COLOR_ATTACHMENT0+attachment);g.readPixels(0,0,target.width,target.height,g.RGBA,g.FLOAT,out);g.bindFramebuffer(g.FRAMEBUFFER,null);g.readBuffer(g.BACK);const err=g.getError();if(err)throw Error('Float32 field readback failed: '+err);return out;}
 probe(points,kind=0,directions=null){
  if(!this.floatExtension)throw Error('Float GPU query readback unavailable; parity is not verified');if(!points.length||points.length>128)throw Error('Probe requires1..128points');if(kind===4&&(!directions||directions.length!==points.length))throw Error('Ray probe requires one direction per point');
  const g=this.gl,temporary=[];try{
   if(kind===4&&this.sources.split){const p=this.ensureRayProbes(),primary=this.createTarget(points.length,1);temporary.push(primary);const final=this.createTarget(points.length,1);temporary.push(final);const result=this.createTarget(points.length,1,1);temporary.push(result);this.pass(p.primary,primary,points.length,1,{points,directions});this.pass(p.rescue,final,points.length,1,{input:primary,points,directions});this.pass(p.result,result,points.length,1,{input:final});const out=this.readTarget(result);return points.map((_,i)=>Array.from(out.slice(i*4,i*4+4)));}
   const p=this.ensureProbe(kind),target=this.createTarget(points.length,1,1);temporary.push(target);this.unbindInputTextures();g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);g.useProgram(p);g.bindVertexArray(this.vao);g.disable(g.BLEND);g.disable(g.DEPTH_TEST);g.disable(g.SCISSOR_TEST);const L=this.uniforms(p);g.uniform3fv(L('uPoints[0]'),new Float32Array(points.flat()));if(directions)g.uniform3fv(L('uDirections[0]'),new Float32Array(directions.flat()));g.viewport(0,0,points.length,1);g.drawArrays(g.TRIANGLES,0,3);const out=this.readTarget(target);return points.map((_,i)=>Array.from(out.slice(i*4,i*4+4)));
  }finally{g.bindFramebuffer(g.FRAMEBUFFER,null);this.unbindInputTextures();for(const t of temporary)this.deleteTarget(t);g.viewport(0,0,this.canvas.width,this.canvas.height);}
 }
 diagnostics(){
  const g=this.gl,pixels=this.canvas.width*this.canvas.height,split=this.isSplitActive();let hits=0,misses=0,unresolved=0,sum=0,max=0,rescuePixelCount=null,meanPrimarySteps=null,maxPrimarySteps=null;const histogram=Array(split?513:256).fill(0),ids={},unresolvedPixelSamples=[];let diagnosticPixelIndex=0;
  const count=(steps,status,objectId)=>{sum+=steps;max=Math.max(max,steps);histogram[steps]=(histogram[steps]??0)+1;if(status===1){hits++;ids[objectId]=(ids[objectId]??0)+1;}else if(status===2)misses++;else{unresolved++;if(unresolvedPixelSamples.length<16)unresolvedPixelSamples.push({x:diagnosticPixelIndex%this.canvas.width,y:Math.floor(diagnosticPixelIndex/this.canvas.width),origin:'bottom-left',steps,status});}diagnosticPixelIndex++;};
  if(split){this.draw();const primary=this.readTarget(this.targets[0]),final=this.readTarget(this.targets[1]),normalId=this.readTarget(this.targets[1],1);rescuePixelCount=0;maxPrimarySteps=0;let primarySum=0;for(let i=0;i<final.length;i+=4){count(Math.round(final[i+2]),Math.round(final[i+1]),Math.round(normalId[i+3]));const steps=Math.round(primary[i+3]);primarySum+=steps;maxPrimarySteps=Math.max(maxPrimarySteps,steps);if(Math.round(primary[i+1])===3)rescuePixelCount++;}meanPrimarySteps=primarySum/pixels;for(const sample of unresolvedPixelSamples){const i=(sample.y*this.canvas.width+sample.x)*4;sample.primaryState=Array.from(primary.slice(i,i+4));sample.finalState=Array.from(final.slice(i,i+4));sample.stateLayout=['rayT','status','marchIterations','primaryIterations'];}
  }else{this.draw({diagnostic:true});const a=new Uint8Array(pixels*4);g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);for(let i=0;i<a.length;i+=4){const d=decodeDiagnosticPixel(a[i],a[i+1],a[i+2]);count(d.steps,d.status,d.objectId);}if(!this.spec.fieldKind){this.draw({diagnostic:2});g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);rescuePixelCount=0;let primarySum=0;maxPrimarySteps=0;for(let i=0;i<a.length;i+=4){primarySum+=a[i];maxPrimarySteps=Math.max(maxPrimarySteps,a[i]);if(a[i+1]>127)rescuePixelCount++;}meanPrimarySteps=primarySum/pixels;}this.draw();}
  return {width:this.canvas.width,height:this.canvas.height,pixels,hits,misses,unresolved,rescuePixelCount,meanPrimarySteps,maxPrimarySteps,meanSteps:sum/pixels,maxSteps:max,...rendererDiagnosticContract(this.spec,this.traceVariant??0,this.options.traceMode??0),stepCountsSaturateAt255:!split,readback:split?'exact Float32 primary and final MRT attachments':'8-bit packed diagnostic pass',screenPassesPerFrame:split?3:1,structuralPlaneCount:this.spec.structurePlanes?.length??null,ambientOcclusionEnabled:!!this.options.occlusion,histogram,unresolvedPixelSamples,camera:{eye:[...this.options.eye],target:[...this.options.target],fov:this.options.fov},visibleObjectPixels:ids,unresolvedColor:'#d91f8c'};
 }
 async benchmarkStages(frames=3){
  if(!this.isSplitActive())throw Error('Per-stage benchmark requires the production split-field path');
  if(!Number.isInteger(frames)||frames<1||frames>32)throw Error('Per-stage benchmark requires 1..32 samples');
  const gl=this.gl,{width,height}=this.canvas,spec=this.spec,options=JSON.stringify(this.options),initializationFrames=this.firstDrawPending?1:0;
  if(this.firstDrawPending)this.draw();
  const [primary,final]=this.ensureTargets(),samples={primary:[],rescue:[],shade:[]},warmupFrames=2;
  for(let i=0;i<warmupFrames+frames;i++){
   await new Promise(r=>requestAnimationFrame(r));
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
 async benchmark(frames=12){const timings=[];for(let i=0;i<frames+2;i++){await new Promise(r=>requestAnimationFrame(r));const start=performance.now();this.draw();this.gl.finish();this.gl.readPixels(0,0,1,1,this.gl.RGBA,this.gl.UNSIGNED_BYTE,new Uint8Array(4));if(i>=2)timings.push(performance.now()-start);}return {measurement:'wallclock draw plus gl.finish and pixel readback, not isolated GPU timer',quantileMethod:'nearest rank: ceil(q*n)-1',samples:timings,medianMs:nearestRankQuantile(timings,.5),p95Ms:nearestRankQuantile(timings,.95),width:this.canvas.width,height:this.canvas.height,gpu:this.gpu,timerExtensionAvailable:!!this.timerExtension,modelTriangles:0,screenTrianglesPerPass:1,screenPassesPerFrame:this.lastScreenPasses,screenTrianglesPerFrame:this.lastScreenPasses,vertexBuffers:0,indexBuffers:0};}
 snapshot(){return {gpu:this.gpu,width:this.canvas.width,height:this.canvas.height,drawCount:this.drawCount,compileCount:this.compileCount,compileProfile:this.compileProfile,modelTriangles:0,vertexBuffers:0,indexBuffers:0,screenTrianglesPerPass:1,screenPassesPerFrame:this.isSplitActive()?3:1,screenTrianglesPerFrame:this.isSplitActive()?3:1,floatQueryReadback:!!this.floatExtension,renderer:this.isSplitActive()?'WebGL2 direct analytic field: primary Float32 MRT, unresolved-only rescue, shared shade':'WebGL2 direct analytic field ray evaluation',noMeshFallback:true};}
}
