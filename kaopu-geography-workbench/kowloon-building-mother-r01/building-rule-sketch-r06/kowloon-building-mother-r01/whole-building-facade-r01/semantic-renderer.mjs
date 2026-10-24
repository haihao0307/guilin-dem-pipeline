import {displayLimits,nativeDisplaySize} from '../../desktop-display.mjs';
import {buildRegistry,packRegistry,SEMANTIC_SHADE,SEMANTIC_PRESENT} from './semantic-registry.mjs';
import {withBoundedGlassEndpointVerification} from './glass-endpoint-roundoff.mjs';
import {validateMasks} from './host-integration.mjs';
import {StaticPrimaryHitCache,staticPrimaryCacheKey} from '../whole-building-floor-study-r01/static-primary-hit-cache.mjs';
import {packLiftFields,LIFT_FIELDS_GLSL} from '../whole-building-floor-study-r01/lift-field-pass.mjs';
import {buildEvidenceStairRailGLSL} from '../whole-building-floor-study-r01/stair-ray-rescue.mjs';
import {ASSEMBLY_ENTRY_GUARD_GLSL} from '../whole-building-floor-study-r01/ray-entry-guard.mjs';
import {packStructuralShadow,BOUNDED_SHADOW_GLSL,COLOR_CONTROL_GLSL} from '../whole-building-floor-study-r01/bounded-structural-shadow.mjs';
/** Original whole-building field compositor. A fullscreen triangle launches rays;
 * source patches and repeated floor functions never become object meshes.
 * Separate trace/nearest-hit reduction and material shading avoid inlining the
 * complete model once per lighting or secondary ray. */
import {buildCaseGLSL,packCaseDescriptors} from '../r07/cases.mjs';
import {packAssemblyDescriptors} from '../r07/assemblies.mjs';
import {applyFloorFinishDispatch} from '../whole-building-floor-study-r01/finish-dispatch.mjs';
import {buildPrimaryTileAssemblyGLSL as buildBoundedAssemblyGLSL,primaryPackedBounds,buildPrimaryTileIndex,primaryTileRows,readPrimaryTileList} from '../whole-building-floor-study-r01/primary-tile-index.mjs';
import {buildPrimarySceneIndex} from '../whole-building-floor-study-r01/primary-scene-index.mjs';
import {prepareTileFrame,prepareTileFrustum,aabbIntersectsTile,transformBounds} from '../whole-building-ground-r01/tile-visibility.mjs';
import {deriveStairRails,createRailInstance,packStairRailDescriptors,buildStairRailGLSL} from '../whole-building-ground-r01/rails.mjs';
import {buildAperturesGLSL,packApertureDescriptors} from '../r07/apertures.mjs';
import {buildPrimaryTileAperturesGLSL,aperturePackedBounds,buildPrimaryApertureIndex,apertureTileRow,readPrimaryApertureList} from '../whole-building-floor-study-r01/primary-aperture-index.mjs';
import {GpuLifecycle} from '../whole-building-ground-r01/gpu-lifecycle.mjs';
const VERTEX=`#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
const HEAD=`#version 300 es
precision highp float;
precision highp int;
`;
const CAMERA=`uniform vec2 uResolution;uniform vec3 uCameraEye,uTarget;uniform float uFov;
uniform int uRayMode;uniform sampler2D uRayOrigin,uRayDirection;
vec3 rayOrigin(){return uRayMode==0?uCameraEye:texelFetch(uRayOrigin,ivec2(gl_FragCoord.xy),0).xyz;}
bool rayActive(){return uRayMode==0||texelFetch(uRayOrigin,ivec2(gl_FragCoord.xy),0).w>.5;}
#define uEye rayOrigin()

vec3 rayDirection(){if(uRayMode>0)return texelFetch(uRayDirection,ivec2(gl_FragCoord.xy),0).xyz;vec2 uv=(2.*gl_FragCoord.xy-uResolution)/uResolution.y;vec3 f=normalize(uTarget-uEye),r=normalize(cross(f,abs(f.y)>.999?vec3(0,0,1):vec3(0,1,0)));return normalize(f+tan(uFov*.5)*(uv.x*r+uv.y*cross(r,f)));}
`;
const REDUCE=`uniform sampler2D uPreviousHit,uPreviousNormal,uPreviousLocal;uniform bool uFirst;
layout(location=0)out vec4 outHit;layout(location=1)out vec4 outNormal;layout(location=2)out vec4 outLocal;
void previous(){ivec2 px=ivec2(gl_FragCoord.xy);if(uFirst){outHit=vec4(1e20,0.,0.,0.);outNormal=vec4(0.,1.,0.,0.);outLocal=vec4(0.);}else{outHit=texelFetch(uPreviousHit,px,0);outNormal=texelFetch(uPreviousNormal,px,0);outLocal=texelFetch(uPreviousLocal,px,0);}}
void accept(float t,FieldHit h,vec3 n,float instance){if(t<outHit.x||(t==outHit.x&&h.objectId<outHit.y)){outHit=vec4(t,h.objectId,h.materialRole,1.);outNormal=vec4(n,instance);outLocal=vec4(h.local,1.);}}
bool interval(vec3 low,vec3 high,vec3 ro,vec3 rd,float nearest,out float lo,out float hi){lo=0.;hi=nearest;for(int a=0;a<3;a++){if(abs(rd[a])<1e-12){if(ro[a]<low[a]||ro[a]>high[a])return false;}else{float x=(low[a]-ro[a])/rd[a],y=(high[a]-ro[a])/rd[a];lo=max(lo,min(x,y));hi=min(hi,max(x,y));if(hi<lo)return false;}}return hi>=lo;}
uniform vec3 uClipNormal;uniform float uClipOffset;uniform bool uClip;
uniform bool uSlice;uniform vec2 uSliceY;
bool clipInterval(vec3 ro,vec3 rd,inout float lo,inout float hi){if(uSlice){if(abs(rd.y)<1e-12){if(ro.y<uSliceY.x||ro.y>uSliceY.y)return false;}else{float a=(uSliceY.x-ro.y)/rd.y,b=(uSliceY.y-ro.y)/rd.y;lo=max(lo,min(a,b));hi=min(hi,max(a,b));if(hi<lo)return false;}}if(!uClip)return true;float p=dot(uClipNormal,ro)-uClipOffset,d=dot(uClipNormal,rd);if(abs(d)<1e-12){if(p<0.)return false;}else if(d>0.)lo=max(lo,-p/d);else hi=min(hi,-p/d);return hi>=lo;}
`;
const MASK=`
uniform int uMaskCount;uniform vec4 uMaskOrigin[16],uMaskU[16],uMaskV[16],uMaskW[16];
bool floorAcceptSource(int k,vec3 p){for(int i=0;i<uMaskCount;i++){if(abs(casePatchRecord(k,3).w-uMaskOrigin[i].w)>.1)continue;vec3 q=p-uMaskOrigin[i].xyz;if(abs(dot(q,uMaskU[i].xyz))<uMaskU[i].w&&abs(dot(q,uMaskV[i].xyz))<uMaskV[i].w&&abs(dot(q,uMaskW[i].xyz))<uMaskW[i].w)return false;}return true;}
`;
function sourceShader(s){return HEAD+buildCaseGLSL(s,{candidateHook:'floorAcceptSource'})+MASK+CAMERA+REDUCE+`
uniform vec3 uSourceMin,uSourceMax;
void main(){previous();if(!rayActive())return;vec3 rd=rayDirection();float lo,hi;if(!interval(uSourceMin,uSourceMax,uEye,rd,outHit.x,lo,hi)||!clipInterval(uEye,rd,lo,hi))return;float t;FieldHit h;int visits;if(caseTraceRay(uEye+rd*lo,rd,t,h,visits)&&t+lo<=hi){t+=lo;h.local=uEye+rd*t;accept(t,h,caseNormalForId(h.objectId),-1.);}}
`;}
function assemblyShader(s){return HEAD+applyFloorFinishDispatch(buildBoundedAssemblyGLSL(s))+CAMERA+REDUCE+ASSEMBLY_ENTRY_GUARD_GLSL+`
uniform int uInstanceCount;uniform vec4 uInstances[32];uniform vec3 uArchetypeMin,uArchetypeMax;
void main(){previous();if(!rayActive())return;vec3 rd=rayDirection();for(int i=0;i<uInstanceCount;i++){floorPrimaryCandidateInstance=uRayMode==0?i:-1;vec3 origin=uInstances[i].xyz,ro=uEye-origin;float boundsLo,boundsHi,clipLo=0.,clipHi=outHit.x;if(!interval(uArchetypeMin,uArchetypeMax,ro,rd,outHit.x,boundsLo,boundsHi)||!clipInterval(uEye,rd,clipLo,clipHi))continue;float hi=min(boundsHi,clipHi);if(hi<max(boundsLo,clipLo))continue;float start=assemblyEntryStart(uArchetypeMin,uArchetypeMax,ro,rd,uEye,origin,boundsLo,clipLo);float t;FieldHit h;int visits;if(caseTraceRayBounded(ro+rd*start,rd,hi-start+8.*1.1920929e-7*(1.+abs(hi)+abs(start)),t,h,visits)&&t+start>=clipLo&&t+start<=hi){t+=start;h.objectId+=uInstances[i].w;accept(t,h,fieldRayNormal,uInstances[i].w);}}}
`;}

function apertureShader(apertures){return HEAD+withBoundedGlassEndpointVerification(buildPrimaryTileAperturesGLSL(apertures))+CAMERA+REDUCE+`
void main(){floorPrimaryApertureRay=uRayMode==0;previous();if(!rayActive())return;vec3 rd=rayDirection();float lo=0.,hi=outHit.x;if(!clipInterval(uEye,rd,lo,hi))return;float t;FieldHit h;int visits;float skipId=uRayMode>0?texelFetch(uRayDirection,ivec2(gl_FragCoord.xy),0).w:0.;if(apertureTraceRayFiltered(uEye+rd*lo,rd,false,skipId,t,h,visits)&&t+lo<=hi)accept(t+lo,h,fieldRayNormal,-2.);}
`;}


function opticalRayShader(apertures){return HEAD+buildAperturesGLSL(apertures)+CAMERA+`
uniform sampler2D uHit,uNormal;uniform bool uReflection;
layout(location=0)out vec4 outOrigin;layout(location=1)out vec4 outDirection;layout(location=2)out vec4 outWeight;
float opticalF(float c){float f=(1.52-1.)/(1.52+1.);f*=f;return f+(1.-f)*pow(clamp(1.-c,0.,1.),5.);}
void main(){ivec2 px=ivec2(gl_FragCoord.xy);vec4 hit=texelFetch(uHit,px,0);outOrigin=vec4(0.);outDirection=vec4(0.);outWeight=vec4(0.);if(hit.w<.5||hit.z!=6.)return;
 vec3 rd=rayDirection(),outward=normalize(texelFetch(uNormal,px,0).xyz),point=uEye+rd*hit.x;bool inside=dot(rd,outward)>0.;vec3 facing=inside?-outward:outward;
 float entryF=inside?0.:opticalF(dot(-rd,facing)),path=inside?hit.x:0.;vec3 internalD=inside?rd:refract(rd,facing,1./1.52),exitPoint=point,exitNormal=outward;
 if(!inside&&!apertureGlassExit(hit.y,point,internalD,path,exitNormal,exitPoint)){outWeight=vec4(-1.);return;}
 float exitF=opticalF(max(dot(internalD,exitNormal),0.));vec3 transmitted=refract(internalD,-exitNormal,1.52);bool tir=dot(transmitted,transmitted)<.5;float refl=tir?1.:entryF;
 vec3 attenuation=exp(log(vec3(.975,.988,.98))*max(path,0.)/.006)*.97*(1.-entryF)*(1.-exitF);
 outWeight=vec4(tir?vec3(0.):attenuation,refl);
 vec3 dir=uReflection?reflect(rd,facing):transmitted,origin=uReflection?point:exitPoint;
 if(!uReflection&&tir)return;outOrigin=vec4(origin+dir*.00004,1.);outDirection=vec4(dir,hit.y);
}
`;}

const RAIL=HEAD+`struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};\n`+buildEvidenceStairRailGLSL()+CAMERA+REDUCE+`
uniform int uInstanceCount;uniform vec4 uInstances[32];uniform vec3 uRailX,uRailZ;
vec3 railDirectionLocal(vec3 p){return vec3(dot(p,uRailX),p.y,dot(p,uRailZ));}
void main(){previous();if(!rayActive())return;vec3 rd=rayDirection(),d=railDirectionLocal(rd);for(int i=0;i<uInstanceCount;i++){vec3 ro=railDirectionLocal(uEye-uInstances[i].xyz);float lo=0.,hi=outHit.x;if(!clipInterval(uEye,rd,lo,hi))continue;float t;vec3 p;int result=wholeRailTrace(ro+d*lo,d,hi-lo,t,p);t+=lo;if(result==1){vec3 n=wholeRailNormal(p);FieldHit h=FieldHit(0.,30000.+uInstances[i].w,3.,p);accept(t,h,uRailX*n.x+vec3(0,n.y,0)+uRailZ*n.z,uInstances[i].w);}else if(result<0&&t<outHit.x){outHit=vec4(t,0.,0.,3.);}}}
`;
const SHADE=SEMANTIC_SHADE;
const EMPTY=HEAD+`layout(location=0)out vec4 outHit;layout(location=1)out vec4 outNormal;layout(location=2)out vec4 outLocal;void main(){outHit=vec4(1e20,0,0,0);outNormal=vec4(0,1,0,0);outLocal=vec4(0);}`;
const STRUCTURAL_SHADOW=HEAD+CAMERA+BOUNDED_SHADOW_GLSL;
const PRESENT=SEMANTIC_PRESENT;
function program(g,source){const shaders=[];try{for(const [type,src]of [[g.VERTEX_SHADER,VERTEX],[g.FRAGMENT_SHADER,source]]){const s=g.createShader(type);shaders.push(s);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));}const p=g.createProgram();shaders.forEach(s=>g.attachShader(p,s));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}finally{shaders.forEach(s=>g.deleteShader(s));}}
/** Primary camera frusta cannot reject reflection/refraction rays. */
export function selectRayInstances(instances,{primaryRay,cullTiles,tile}){
 return primaryRay&&cullTiles?instances.filter(i=>!i.bounds||aabbIntersectsTile(tile,i.bounds)):instances;
}
export class WholeRenderer{
 constructor(canvas){this.canvas=canvas;const g=this.gl=canvas.getContext('webgl2',{alpha:false,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:true});if(!g||!g.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 Float32 rendering unavailable; no mesh substitute');this.displayLimits=displayLimits(g);g.disable(g.BLEND);g.disable(g.DEPTH_TEST);g.disable(g.DITHER);this.vao=g.createVertexArray();g.bindVertexArray(this.vao);this.lifecycle=new GpuLifecycle({gl:g,maxWaitMs:20000,maxInitializationMs:60000,onStop:e=>{this.error=e;this.staticPrimaryCache?.release();}});const info=g.getExtension('WEBGL_debug_renderer_info');this.gpu=info?g.getParameter(info.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);this.options={eye:[45,45,-65],target:[0,25,0],fov:45*Math.PI/180,source:true,design:true,cut:true,clipNormal:[0,0,1],clipOffset:0,identity:false,correctCoatG:true,boundedShadow:false};this.textures=[];this.programs=[];this.uniformLocations=new WeakMap();this.uniformLocationLookups=0;this.revision=0;this.requestRevision=0;this.busy=false;this.disposed=false;this.compileStats=[];this.staticPrimaryCache=new StaticPrimaryHitCache(g);this.stats={frames:0,modelTriangles:0,modelVertexBuffers:0,screenTrianglesPerDispatch:1};}
 texture(packed){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,packed.width,packed.height,0,g.RGBA,g.FLOAT,packed.data);for(const [key,val]of [[g.TEXTURE_MIN_FILTER,g.NEAREST],[g.TEXTURE_MAG_FILTER,g.NEAREST],[g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE],[g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE]])g.texParameteri(g.TEXTURE_2D,key,val);this.textures.push(t);return t;}
 compile(name,src){const t=performance.now(),p=program(this.gl,src);this.programs.push(p);this.compileStats.push({name,characters:src.length,compileLinkWallMs:performance.now()-t});return p;}
 compileLift(){if(!this.dynamicLiftProgram)this.dynamicLiftProgram=this.compile('host-bound-elevator',HEAD+'struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};\n'+CAMERA+REDUCE+LIFT_FIELDS_GLSL);return this.dynamicLiftProgram;}
 setModel(model,measured){if(this.busy)throw Error('Model replacement requires completed GPU frame');const g=this.gl;this.staticPrimaryCache.release();this.modelGeneration=(this.modelGeneration??0)+1;this.model=model;this.measured=measured;this.study=model.floorStudy??model.hostedComponents??null;this.allHostedComponents=model.hostedComponents??null;this.hostedVisibilityKey=null;this.structuralShadow=null;this.revision++;this.textures.forEach(t=>g.deleteTexture(t));this.textures=[];this.semanticRegistry=model.unifiedRegistry??buildRegistry(model,measured);this.semanticTexture=this.texture(packRegistry(this.semanticRegistry));this.apertureTexture=null;this.dynamicLiftTexture=null;this.primaryTileIndexTexture=null;this.primaryApertureIndexTexture=null;this.primaryApertureBounds=null;this.structuralShadowTexture=this.structuralShadow?this.texture(this.structuralShadow):null;if(this.structuralShadow&&!this.structuralShadowProgram)this.structuralShadowProgram=this.compile('bounded-structural-shadow',STRUCTURAL_SHADOW);if(measured.patches.length){if(!this.sourceProgram)this.sourceProgram=this.compile('source',sourceShader(measured));this.sourceTexture=this.texture(packCaseDescriptors(measured));}else this.sourceTexture=null;this.apertures=this.study?.apertures??[];if(this.apertures.length){const packedApertures=packApertureDescriptors(this.apertures);this.apertureTexture=this.texture(packedApertures);this.primaryApertureBounds=aperturePackedBounds(packedApertures,packedApertures.primitiveCount);if(!this.apertureProgram)this.apertureProgram=this.compile('hosted-aperture',apertureShader(this.apertures));}this.archetypes=model.archetypes.map(a=>{const spec=a.spec??a,packed=packAssemblyDescriptors(spec);return{id:a.id,spec,primaryBounds:primaryPackedBounds(packed,spec.primitives.length),texture:this.texture(packed),coreTexture:this.texture(packAssemblyDescriptors({...a,primitives:a.primitives.filter(p=>!p.nodeId.includes('-partition'))}))};});if(!this.assemblyProgram)this.assemblyProgram=this.compile('assembly',assemblyShader(this.archetypes[0].spec));if(!this.shadeProgram)this.shadeProgram=this.compile('semantic-flat-color-only',SHADE);if(!this.railProgram)this.railProgram=this.compile('continuous-rail',RAIL);if(!this.presentProgram)this.presentProgram=this.compile('frame-presentation',PRESENT);if(!this.emptyProgram)this.emptyProgram=this.compile('empty-field-initialization',EMPTY);this.railGroups=[];for(const stair of model.interfaces.stairs){let group=this.railGroups.find(r=>r.id===stair.archetypeId);if(!group){const template=stair.railTemplate??deriveStairRails(stair.layout);group={id:stair.archetypeId,template,texture:this.texture(packStairRailDescriptors(template)),instances:[]};this.railGroups.push(group);}group.instances.push({id:stair.id+':rail',floorId:stair.fromFloorId,toFloorId:stair.toFloorId,origin:stair.layout.origin.map((v,i)=>v+(i===1?stair.lowerElevation:0)),xAxis:stair.layout.X,zAxis:stair.layout.Z,objectId:model.interfaces.stairs.indexOf(stair)});}}
 targets(w,h){
  if(this.buffers?.[0].width===w&&this.buffers[0].height===h&&this.buffers.length===2)return;
  const g=this.gl;this.staticPrimaryCache.release();for(const b of this.buffers??[]){b.textures.forEach(t=>g.deleteTexture(t));g.deleteFramebuffer(b.fbo);}
  if(this.colorTarget){g.deleteTexture(this.colorTarget.texture);g.deleteFramebuffer(this.colorTarget.fbo);}
  for(const b of [this.structuralShadowTarget,this.rayTarget,...(this.opticalColors??[])].filter(Boolean)){(b.textures??[b.texture]).forEach(t=>g.deleteTexture(t));g.deleteFramebuffer(b.fbo);}this.rayTarget=null;this.opticalColors=[];this.structuralShadowTarget=null;
  // Optical/material passes are disabled in this inspection renderer.
  // Two exact Float32 MRT ping-pong targets suffice; hitTiles retains the
  // actual final target per tile. No geometry or hit precision changes.
  this.buffers=[0,1].map(()=>{const b={width:w,height:h,fbo:g.createFramebuffer(),textures:[]};g.bindFramebuffer(g.FRAMEBUFFER,b.fbo);for(let i=0;i<3;i++){const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,w,h,0,g.RGBA,g.FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+i,g.TEXTURE_2D,t,0);b.textures.push(t);}g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1,g.COLOR_ATTACHMENT2]);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Incomplete field target');return b;});
  const t=g.createTexture(),fbo=g.createFramebuffer();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA16F,w,h,0,g.RGBA,g.HALF_FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.bindFramebuffer(g.FRAMEBUFFER,fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);g.drawBuffers([g.COLOR_ATTACHMENT0]);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Incomplete presentation target');this.colorTarget={texture:t,fbo,width:w,height:h};
  // Do not allocate disabled structural-shadow, optical-ray or optical-color targets.


 }
 uniform(p,name){let locations=this.uniformLocations.get(p);if(!locations){locations=new Map();this.uniformLocations.set(p,locations);}if(!locations.has(name)){locations.set(name,this.gl.getUniformLocation(p,name));this.uniformLocationLookups++;}return locations.get(name);}
 bindTexture(p,name,unit,t){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,t);g.uniform1i(this.uniform(p,name),unit);}
 camera(p,w,h,options){const g=this.gl,L=n=>this.uniform(p,n);g.uniform2f(L('uResolution'),w,h);g.uniform3fv(L('uCameraEye'),options.eye);g.uniform3fv(L('uTarget'),options.target);g.uniform1f(L('uFov'),options.fov);return L;}
 async complete(initialization=false,stats=null){
  const start=performance.now(),before={...this.lifecycle.stats},submittedTiles=stats?.tilesSubmitted??null;
  if(!this.lifecycle.submit({phase:initialization?'initialization':'frame'}))throw Error('GPU frame rejected: '+JSON.stringify(this.lifecycle.snapshot().lastFailure));
  while(!this.lifecycle.poll()){
   if(this.error)throw Error('GPU stopped: '+JSON.stringify(this.error));
   const waitStart=performance.now();await new Promise(r=>setTimeout(r,8));
   if(stats){stats.pollSleepCount++;stats.pollSleepWallMs+=performance.now()-waitStart;}
  }
  if(stats){stats.fenceCount++;stats.fenceWallMs+=performance.now()-start;stats.fencePolls+=this.lifecycle.stats.polls-before.polls;stats.fenceBatches??=[];stats.fenceBatches.push({submittedTiles,wallMs:performance.now()-start,polls:this.lifecycle.stats.polls-before.polls,phase:initialization?'initialization':'frame'});}
 }
 updateHostedVisibility(visibleFloorIds){
  const h=this.allHostedComponents;if(!h)return;const key=JSON.stringify(visibleFloorIds?[...visibleFloorIds].sort():null);if(key===this.hostedVisibilityKey)return;this.hostedVisibilityKey=key;const g=this.gl;
  this.apertures=h.apertures.filter(a=>!visibleFloorIds||visibleFloorIds.includes(a.floorId));this.study={...h,apertures:this.apertures,sourceMasks:h.sourceMasks.filter(m=>!visibleFloorIds||visibleFloorIds.includes(m.floorId))};
  if(this.apertureTexture){g.deleteTexture(this.apertureTexture);this.textures=this.textures.filter(t=>t!==this.apertureTexture);}this.apertureTexture=null;this.primaryApertureBounds=null;
  if(this.apertures.length){const p=packApertureDescriptors(this.apertures);this.apertureTexture=this.texture(p);this.primaryApertureBounds=aperturePackedBounds(p,p.primitiveCount);}this.staticPrimaryCache.release();this.revision++;
 }
 async render({width=640,height=544,presentWidth=640,presentHeight=544,tileSize=128,gpuBatchTiles=this.options.gpuBatchTiles??8,cullTiles=true,visibleFloorIds=null,source=this.options.source,design=this.options.design,clipDesign=false,coreOnly=false,dynamicFields=[],displayArchetypes=null,skipPresent=false,requestRevision=this.requestRevision}={}){
  if(this.busy)throw Error('GPU frame already in progress');if(!Number.isInteger(gpuBatchTiles)||gpuBatchTiles<1||gpuBatchTiles>8)throw Error('GPU batch must contain 1..8 fixed-resolution tiles');this.updateHostedVisibility(visibleFloorIds);const allocation=nativeDisplaySize({cssWidth:width,cssHeight:height,dpr:1,limits:this.displayLimits});if(!Number.isInteger(width)||!Number.isInteger(height)||allocation.hidden||!allocation.native||presentWidth!==width||presentHeight!==height||tileSize<32||tileSize>256)throw Error('Native inspection framebuffer exceeds the explicit device/memory budget or presentation size differs');
  this.busy=true;this.hitDataComplete=false;this.hitTiles=[];const start=performance.now(),uniformLookupStart=this.uniformLocationLookups,revision=this.revision,o=structuredClone(this.options),g=this.gl,stats={passes:0,tilesCompleted:0,tilesPlanned:Math.ceil(width/tileSize)*Math.ceil(height/tileSize),width,height,presentWidth,presentHeight,visibleFloorIds,cancelled:false,maxTileWallMs:0,gpuBatchTiles,fenceCount:0,fencePolls:0,fenceWallMs:0,pollSleepCount:0,pollSleepWallMs:0,cpuSubmitWallMs:0,tilesSubmitted:0};
  try{
   if(this.canvas.width!==presentWidth||this.canvas.height!==presentHeight){this.canvas.width=presentWidth;this.canvas.height=presentHeight;}
   this.targets(width,height);if(g.getError()!==g.NO_ERROR)throw Error('原生帧缓冲分配失败；设备内存不足，未静默降低分辨率。');g.viewport(0,0,width,height);g.bindVertexArray(this.vao);g.enable(g.SCISSOR_TEST);
   const frame=prepareTileFrame({...o,width,height});
   const dynamic=design&&dynamicFields.length?packLiftFields(dynamicFields):null;
   if(dynamic){this.compileLift();if(!this.dynamicLiftTexture)this.dynamicLiftTexture=this.texture(dynamic);else{g.bindTexture(g.TEXTURE_2D,this.dynamicLiftTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,dynamic.width,dynamic.height,0,g.RGBA,g.FLOAT,dynamic.data);}}
   const staticState=[this.model.instances,this.study?.sourceMasks,this.study?.floorId,this.measured.bounds,this.archetypes.map(a=>[a.id,a.spec.bounds,this.staticPrimaryCache.identity(a.texture),this.staticPrimaryCache.identity(a.coreTexture)]),this.railGroups.map(g=>[g.id,g.instances,g.template.bounds,g.template.primitives.length,this.staticPrimaryCache.identity(g.texture)])];
   const cacheKey=staticPrimaryCacheKey({revision,generation:this.lifecycle.generation,staticState,collectionIds:[this.archetypes,this.apertures,this.railGroups,this.sourceTexture].map(x=>this.staticPrimaryCache.identity(x)),width,height,tileSize,cullTiles,source,design,clipDesign,coreOnly,visibleFloorIds,options:o});
   const cacheInfo=this.staticPrimaryCache.begin({enabled:!!dynamic&&!displayArchetypes&&o.staticHitCache!==false,key:cacheKey,width,height});stats.staticPrimaryCache=cacheInfo;
   stats.dynamicLiftFields=dynamic?.fields.length??0;stats.dynamicLiftPairsBefore=0;stats.dynamicLiftPairsAfter=0;stats.dynamicLiftPasses=0;

   const glassBounds=this.apertures.flatMap(a=>a.primitives.filter(p=>p.materialRole===6).map(p=>p.bounds));stats.opticalTiles=0;stats.opticalTilesRejected=0;
   const assemblies=design?(displayArchetypes??this.archetypes).map(archetype=>{const instances=this.model.instances.filter(i=>i.archetypeId===archetype.id&&(!visibleFloorIds||i.floorId===null||visibleFloorIds.includes(i.floorId))&&(!visibleFloorIds||i.kind!=='stair'||this.model.interfaces.stairs.some(s=>i.id===s.id+':instance'&&visibleFloorIds.includes(s.toFloorId))));instances.sort((a,b)=>{const d=i=>i.bounds?i.bounds.min.reduce((n,v,k)=>n+((v+i.bounds.max[k])*.5-o.eye[k])**2,0):0;return d(a)-d(b);});return{archetype,instances};}).filter(a=>a.instances.length):[];
   const railGroups=design?this.railGroups.map(group=>({group,instances:group.instances.filter(i=>!visibleFloorIds||(visibleFloorIds.includes(i.floorId)&&visibleFloorIds.includes(i.toFloorId))).map(i=>({...i,bounds:transformBounds(group.template.bounds,{origin:i.origin,xAxis:i.xAxis,yAxis:[0,1,0],zAxis:i.zAxis})}))})).filter(r=>r.instances.length):[];
   // One immutable index upload per frame. Unified scenes use sparse rows;
   // unsupported scenes, core-only and secondary traces retain full traversal.
   const indexStart=performance.now();this.primaryTileIndexToken=(this.primaryTileIndexToken??0)%16777215+1;
   const indexBuilder=this.model.placementMode==='metre_scale_comparison_NOT_geographic'?buildPrimarySceneIndex:this.model.placementMode==='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother'?buildPrimaryTileIndex:null;
   const primaryTileIndex=design&&cullTiles&&!coreOnly&&o.primitiveTileIndex!==false&&indexBuilder?indexBuilder({assemblies,frame,width,height,tileSize,token:this.primaryTileIndexToken}):null;
   if(primaryTileIndex){if(!this.primaryTileIndexTexture)this.primaryTileIndexTexture=this.texture(primaryTileIndex);else{g.bindTexture(g.TEXTURE_2D,this.primaryTileIndexTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,primaryTileIndex.width,primaryTileIndex.height,0,g.RGBA,g.FLOAT,primaryTileIndex.data);}}
   stats.primaryTileIndex={enabled:Boolean(primaryTileIndex),ranges:primaryTileIndex?.rangeCount??0,indices:primaryTileIndex?.indexCount??0,records:primaryTileIndex?.records??0,prepareUploadWallMs:performance.now()-indexStart,kind:primaryTileIndex?.kind??null};
   stats.primitiveCandidatePairsBefore=0;stats.primitiveCandidatePairsAfter=0;stats.primitiveEmptyInstancesSkipped=0;stats.passCounts={source:0,assembly:0,rail:0,aperture:0,shade:0,empty:0,dynamic:0};
   // Independent primary-ray aperture scheduling. Authoritative functions,
   // outward-neighbor coverage and secondary/reflection/refraction stay full.
   const apertureIndexStart=performance.now();
   const primaryApertureIndex=design&&cullTiles&&!coreOnly&&o.apertureTileIndex!==false&&this.primaryApertureBounds?buildPrimaryApertureIndex({bounds:this.primaryApertureBounds,frame,width,height,tileSize,token:this.primaryTileIndexToken}):null;
   if(primaryApertureIndex){if(!this.primaryApertureIndexTexture)this.primaryApertureIndexTexture=this.texture(primaryApertureIndex);else{g.bindTexture(g.TEXTURE_2D,this.primaryApertureIndexTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,primaryApertureIndex.width,primaryApertureIndex.height,0,g.RGBA,g.FLOAT,primaryApertureIndex.data);}}
   stats.apertureCandidatePairsBefore=0;stats.apertureCandidatePairsAfter=0;stats.apertureEmptyTilesSkipped=0;stats.primaryApertureIndex={enabled:Boolean(primaryApertureIndex),ranges:primaryApertureIndex?.rangeCount??0,indices:primaryApertureIndex?.indexCount??0,records:primaryApertureIndex?.records??0,prepareUploadWallMs:performance.now()-apertureIndexStart};
   Object.assign(stats,{cullTiles,assemblyPairsBefore:0,assemblyPairsAfter:0,railPairsBefore:0,railPairsAfter:0,emptyTiles:0});stats.cpuPrepareWallMs=performance.now()-start;
   for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize){
    if(revision!==this.revision||requestRevision!==this.requestRevision){stats.cancelled=true;if(stats.tilesSubmitted>stats.tilesCompleted){await this.complete(this.stats.frames===0,stats);stats.tilesCompleted=stats.tilesSubmitted;}return {...stats,wallMs:performance.now()-start};}
    const tileStart=performance.now(),tile=prepareTileFrustum(frame,{x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y)});g.scissor(x,y,Math.min(tileSize,width-x),Math.min(tileSize,height-y));let previous=null,next=0,locked=null,rayMode=0;
    const pass=(p,setup)=>{while(this.buffers[next]===locked)next=(next+1)%this.buffers.length;const dst=this.buffers[next];g.bindFramebuffer(g.FRAMEBUFFER,dst.fbo);g.useProgram(p);const L=this.camera(p,width,height,o);g.uniform1i(L('uRayMode'),rayMode);if(rayMode){this.bindTexture(p,'uRayOrigin',4,this.rayTarget.textures[0]);this.bindTexture(p,'uRayDirection',5,this.rayTarget.textures[1]);}g.uniform1i(L('uFirst'),previous?0:1);if(previous){this.bindTexture(p,'uPreviousHit',1,previous.textures[0]);this.bindTexture(p,'uPreviousNormal',2,previous.textures[1]);this.bindTexture(p,'uPreviousLocal',3,previous.textures[2]);}else for(let unit=1;unit<=3;unit++){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,null);}g.uniform3fv(L('uClipNormal'),o.clipNormal);g.uniform1f(L('uClipOffset'),o.clipOffset);g.uniform1i(L('uClip'),0);g.uniform1i(L('uSlice'),o.sliceY?1:0);g.uniform2fv(L('uSliceY'),o.sliceY??[-1e10,1e10]);setup(L);g.drawArrays(g.TRIANGLES,0,3);const kind=p===this.sourceProgram?'source':p===this.assemblyProgram?'assembly':p===this.railProgram?'rail':p===this.apertureProgram?'aperture':p===this.dynamicLiftProgram?'dynamic':'empty';stats.passCounts[kind]++;previous=dst;next=(next+1)%this.buffers.length;stats.passes++;};
 const trace=()=>{previous=null;next=0;
 const reuseStatic=rayMode===0&&cacheInfo.enabled&&cacheInfo.reused;
 if(reuseStatic){previous=this.staticPrimaryCache.target;cacheInfo.reuseTiles++;}
 else{
 if(source&&this.sourceTexture)pass(this.sourceProgram,L=>{this.bindTexture(this.sourceProgram,'caseDescriptors',0,this.sourceTexture);g.uniform3fv(L('uSourceMin'),this.measured.bounds.min);g.uniform3fv(L('uSourceMax'),this.measured.bounds.max);g.uniform1i(L('uClip'),o.cut?1:0);const masks=validateMasks(this.study?.sourceMasks??[],this.measured);g.uniform1i(L('uMaskCount'),design?masks.length:0);if(masks.length){g.uniform4fv(L('uMaskOrigin[0]'),new Float32Array(masks.flatMap(m=>[...m.frame.origin,m.sourceObjectId])));g.uniform4fv(L('uMaskU[0]'),new Float32Array(masks.flatMap(m=>[...m.frame.u,m.width/2])));g.uniform4fv(L('uMaskV[0]'),new Float32Array(masks.flatMap(m=>[...m.frame.v,m.height/2])));g.uniform4fv(L('uMaskW[0]'),new Float32Array(masks.flatMap(m=>[...m.frame.w,m.depth/2+.0001])));}});
 for(const {archetype,instances:allInstances} of assemblies){stats.assemblyPairsBefore+=allInstances.length;const candidates=selectRayInstances(allInstances,{primaryRay:rayMode===0,cullTiles,tile}),tileIndex=Math.floor(y/tileSize)*Math.ceil(width/tileSize)+Math.floor(x/tileSize),instances=candidates.filter(instance=>{const count=archetype.spec.primitives.length,row=primaryTileIndex?.rows.get(archetype.id)?.[tileIndex]?.get(instance),list=readPrimaryTileList(primaryTileIndex,row,count,{primaryRay:rayMode===0});stats.primitiveCandidatePairsBefore+=count;stats.primitiveCandidatePairsAfter+=list?.length??count;if(list?.length===0){stats.primitiveEmptyInstancesSkipped++;return false;}return true;});stats.assemblyPairsAfter+=instances.length;if(!instances.length)continue;if(instances.length>32)throw Error('Instance batch limit');pass(this.assemblyProgram,L=>{this.bindTexture(this.assemblyProgram,'assemblyDescriptors',0,coreOnly?archetype.coreTexture:archetype.texture);g.uniform1i(L('uPruneHitQueries'),o.pruneHitQueries===false?0:1);this.bindTexture(this.assemblyProgram,'uPrimaryTileIndex',6,this.primaryTileIndexTexture??archetype.texture);g.uniform1i(L('uPrimaryTileIndexEnabled'),rayMode===0&&primaryTileIndex?1:0);g.uniform1i(L('uPrimaryTileIndexToken'),this.primaryTileIndexToken);g.uniform4iv(L('uPrimaryTileIndexRows[0]'),primaryTileRows(rayMode===0?primaryTileIndex:null,archetype.id,Math.floor(y/tileSize)*Math.ceil(width/tileSize)+Math.floor(x/tileSize),instances));g.uniform1i(L('uInstanceCount'),instances.length);g.uniform4fv(L('uInstances[0]'),new Float32Array(instances.flatMap((i,k)=>[...i.translation,i.objectIdOffset??10000*(this.model.instances.indexOf(i)+1)])));g.uniform3fv(L('uArchetypeMin'),archetype.spec.bounds.min);g.uniform3fv(L('uArchetypeMax'),archetype.spec.bounds.max);g.uniform1i(L('uClip'),clipDesign?1:0);});}
 for(const {group,instances:allInstances} of railGroups){stats.railPairsBefore+=allInstances.length;const instances=selectRayInstances(allInstances,{primaryRay:rayMode===0,cullTiles,tile});stats.railPairsAfter+=instances.length;if(!instances.length)continue;pass(this.railProgram,L=>{this.bindTexture(this.railProgram,'uStairRailDescriptors',0,group.texture);g.uniform1i(L('uStairRailPieceCount'),group.template.primitives.length);g.uniform3fv(L('uStairRailBoundsMin'),group.template.bounds.min);g.uniform3fv(L('uStairRailBoundsMax'),group.template.bounds.max);g.uniform1i(L('uInstanceCount'),instances.length);g.uniform4fv(L('uInstances[0]'),new Float32Array(instances.flatMap(i=>[...i.origin,i.objectId])));g.uniform3fv(L('uRailX'),instances[0].xAxis);g.uniform3fv(L('uRailZ'),instances[0].zAxis);g.uniform1i(L('uClip'),clipDesign?1:0);});}

    // An empty, validated PRIMARY candidate list is exactly a no-hit pass.
    // Invalid metadata, unknown bounds, disabled culling and secondary rays
    // retain the full authoritative trace. Source-hole masks are NOT culled.
    const apertureRow=apertureTileRow(primaryApertureIndex,Math.floor(y/tileSize)*Math.ceil(width/tileSize)+Math.floor(x/tileSize));
    const apertureCandidates=rayMode===0?readPrimaryApertureList(primaryApertureIndex,apertureRow,this.primaryApertureBounds?.length??0):null;
    const apertureTileVisible=apertureCandidates===null||apertureCandidates.length>0;
    stats.apertureCandidatePairsBefore+=this.primaryApertureBounds?.length??0;
    stats.apertureCandidatePairsAfter+=apertureCandidates?.length??this.primaryApertureBounds?.length??0;
    if(!apertureTileVisible)stats.apertureEmptyTilesSkipped++;
    if(apertureTileVisible&&design&&this.apertures.length&&(!visibleFloorIds||this.study.floorId===null||visibleFloorIds.includes(this.study.floorId)))pass(this.apertureProgram,L=>{this.bindTexture(this.apertureProgram,'uApertureDescriptors',0,this.apertureTexture);this.bindTexture(this.apertureProgram,'uPrimaryApertureIndex',6,this.primaryApertureIndexTexture??this.apertureTexture);g.uniform1i(L('uPrimaryApertureIndexEnabled'),rayMode===0&&primaryApertureIndex?1:0);g.uniform1i(L('uPrimaryApertureIndexToken'),this.primaryTileIndexToken);g.uniform1i(L('uPrimaryApertureIndexRow'),rayMode===0?apertureTileRow(primaryApertureIndex,Math.floor(y/tileSize)*Math.ceil(width/tileSize)+Math.floor(x/tileSize)):-1);g.uniform1i(L('uClip'),clipDesign?1:0);});
    if(rayMode===0&&cacheInfo.enabled){if(!previous)pass(this.emptyProgram,()=>{});this.staticPrimaryCache.copyTile(previous,{x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y)});cacheInfo.buildTiles++;cacheInfo.copyOperations+=3;}
    }
    if(dynamic){const slots=dynamic.fields.map((f,k)=>({f,k})).filter(({f})=>rayMode!==0||!cullTiles||aabbIntersectsTile(tile,f.bounds)).map(({k})=>k);stats.dynamicLiftPairsBefore+=dynamic.fields.length;stats.dynamicLiftPairsAfter+=slots.length;if(slots.length){pass(this.dynamicLiftProgram,L=>{this.bindTexture(this.dynamicLiftProgram,'uLiftDescriptors',0,this.dynamicLiftTexture);g.uniform1i(L('uLiftCount'),slots.length);g.uniform1iv(L('uLiftIndices[0]'),new Int32Array(slots));g.uniform1i(L('uClip'),clipDesign?1:0);});stats.dynamicLiftPasses++;}}
    if(!previous){pass(this.emptyProgram,()=>{});stats.emptyTiles++;}return previous;};
    const primary=trace();
    const shade=(hitTarget,target)=>{g.bindFramebuffer(g.FRAMEBUFFER,target.fbo);g.useProgram(this.shadeProgram);this.camera(this.shadeProgram,width,height,o);g.uniform4i(this.uniform(this.shadeProgram,'uTile'),x,y,Math.min(tileSize,width-x),Math.min(tileSize,height-y));g.uniform1f(this.uniform(this.shadeProgram,'uSelectedId'),o.selectedId??-1);this.bindTexture(this.shadeProgram,'uNormal',2,hitTarget.textures[1]);this.bindTexture(this.shadeProgram,'uHit',1,hitTarget.textures[0]);this.bindTexture(this.shadeProgram,'uSemantic',0,this.semanticTexture);g.uniform1i(this.uniform(this.shadeProgram,'uSemanticCount'),this.semanticRegistry.length);g.drawArrays(g.TRIANGLES,0,3);stats.passes++;stats.passCounts.shade++;};
    const opticalEligible=false&&design&&glassBounds.length>0&&(!visibleFloorIds||this.study.floorId===null||visibleFloorIds.includes(this.study.floorId))&&!(o.diagnostic>0);
    const optical=opticalEligible&&(o.opticalTileCull===false||glassMayIntersectTile(glassBounds,tile));if(optical)stats.opticalTiles++;else if(opticalEligible)stats.opticalTilesRejected++;
    if(optical){locked=primary;for(let mode=0;mode<2;mode++){g.bindFramebuffer(g.FRAMEBUFFER,this.rayTarget.fbo);g.useProgram(this.opticalRayProgram);const L=this.camera(this.opticalRayProgram,width,height,o);g.uniform1i(L('uRayMode'),0);g.uniform1i(L('uReflection'),mode);this.bindTexture(this.opticalRayProgram,'uApertureDescriptors',0,this.apertureTexture);this.bindTexture(this.opticalRayProgram,'uHit',1,primary.textures[0]);this.bindTexture(this.opticalRayProgram,'uNormal',2,primary.textures[1]);g.drawArrays(g.TRIANGLES,0,3);stats.passes++;rayMode=1;const secondary=trace();shade(secondary,this.opticalColors[mode],1,false);}locked=null;rayMode=0;}
    shade(primary,this.colorTarget,0,optical);this.lastHitTarget=primary;this.hitTiles.push({x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y),target:primary});
    // Draw order and all Float32 hit buffers stay identical. WebGL commands
    // are already ordered; a CPU fence after every tile cannot improve accuracy.
    // Bound submitted work to eight unchanged tiles, then yield to input and GPU.
    stats.tilesSubmitted++;stats.cpuSubmitWallMs+=performance.now()-tileStart;
    if(stats.tilesSubmitted%gpuBatchTiles===0&&stats.tilesSubmitted<stats.tilesPlanned){
     await this.complete(this.stats.frames===0,stats);stats.tilesCompleted=stats.tilesSubmitted;
    }
    stats.maxTileWallMs=Math.max(stats.maxTileWallMs,performance.now()-tileStart);
   }
   if(revision!==this.revision||requestRevision!==this.requestRevision){stats.cancelled=true;if(stats.tilesSubmitted>stats.tilesCompleted){await this.complete(this.stats.frames===0,stats);stats.tilesCompleted=stats.tilesSubmitted;}return {...stats,wallMs:performance.now()-start};}
   g.disable(g.SCISSOR_TEST);if(!skipPresent){g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,presentWidth,presentHeight);g.useProgram(this.presentProgram);g.uniform1i(this.uniform(this.presentProgram,'uRawAlbedo'),o.diagnostic===3?1:0);this.bindTexture(this.presentProgram,'uColor',0,this.colorTarget.texture);g.uniform2f(this.uniform(this.presentProgram,'uPresentResolution'),presentWidth,presentHeight);g.drawArrays(g.TRIANGLES,0,3);}stats.presentationPasses=skipPresent?0:1;const error=g.getError();if(error!==g.NO_ERROR)throw Error('Field presentation GL error '+error);await this.complete(this.stats.frames===0,stats);stats.tilesCompleted=stats.tilesSubmitted;
   if(cacheInfo.enabled&&!cacheInfo.reused)this.staticPrimaryCache.commit(cacheKey);this.hitDataComplete=true;this.lastFrameOptions=o;stats.uniformLocationLookups=this.uniformLocationLookups-uniformLookupStart;this.stats.frames++;this.stats.last={...stats,compileLinkWallMs:this.compileStats.reduce((n,s)=>n+s.compileLinkWallMs,0),firstFrame:this.stats.frames===1,wallMs:performance.now()-start,revision,requestRevision,gpu:this.gpu,camera:o,logicalPasses:stats.passes/stats.tilesCompleted};return this.stats.last;
  }catch(error){this.staticPrimaryCache.invalidate();throw error;}finally{g.disable(g.SCISSOR_TEST);this.busy=false;}
 }
 /** Selection only re-shades the completed exact hit buffers. It never re-traces geometry. */
 async repaintSelection(){
  if(this.busy||!this.hitDataComplete)return false;
  const g=this.gl,o=this.lastFrameOptions??this.options,w=this.canvas.width,h=this.canvas.height,start=performance.now();
  g.bindVertexArray(this.vao);g.enable(g.SCISSOR_TEST);g.viewport(0,0,w,h);
  for(const tile of this.hitTiles){g.scissor(tile.x,tile.y,tile.width,tile.height);g.bindFramebuffer(g.FRAMEBUFFER,this.colorTarget.fbo);g.useProgram(this.shadeProgram);this.camera(this.shadeProgram,w,h,o);g.uniform4i(this.uniform(this.shadeProgram,'uTile'),tile.x,tile.y,tile.width,tile.height);g.uniform1f(this.uniform(this.shadeProgram,'uSelectedId'),this.options.selectedId??-1);this.bindTexture(this.shadeProgram,'uNormal',2,tile.target.textures[1]);this.bindTexture(this.shadeProgram,'uHit',1,tile.target.textures[0]);this.bindTexture(this.shadeProgram,'uSemantic',0,this.semanticTexture);g.uniform1i(this.uniform(this.shadeProgram,'uSemanticCount'),this.semanticRegistry.length);g.drawArrays(g.TRIANGLES,0,3);}
  g.disable(g.SCISSOR_TEST);g.bindFramebuffer(g.FRAMEBUFFER,null);g.useProgram(this.presentProgram);this.bindTexture(this.presentProgram,'uColor',0,this.colorTarget.texture);g.uniform2f(this.uniform(this.presentProgram,'uPresentResolution'),w,h);g.drawArrays(g.TRIANGLES,0,3);g.flush();this.lastSelection={wallMs:performance.now()-start,tracePasses:0,reusedHitTiles:this.hitTiles.length};return true;
 }
 readHit(x=0,y=0){const g=this.gl,tile=this.hitTiles?.find(t=>x>=t.x&&x<t.x+t.width&&y>=t.y&&y<t.y+t.height),target=tile?.target;if(!target||this.busy||!this.hitDataComplete)throw Error('Completed field target required');const out=[];g.bindFramebuffer(g.FRAMEBUFFER,target.fbo);for(let i=0;i<3;i++){g.readBuffer(g.COLOR_ATTACHMENT0+i);const a=new Float32Array(4);g.readPixels(x,y,1,1,g.RGBA,g.FLOAT,a);out.push(Array.from(a));}g.bindFramebuffer(g.FRAMEBUFFER,null);return {t:out[0][0],objectId:out[0][1],materialRole:out[0][2],status:out[0][3],normal:out[1].slice(0,3),local:out[2].slice(0,3)};}
 readPixels(){const g=this.gl,out=new Uint8Array(this.canvas.width*this.canvas.height*4);g.bindFramebuffer(g.FRAMEBUFFER,null);g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,out);return out;}
}

/** Primary-ray tile proof only; never cull the secondary ray scene with this frustum. */
export function glassMayIntersectTile(glassBounds,tile){return glassBounds.some(bounds=>aabbIntersectsTile(tile,bounds));}
