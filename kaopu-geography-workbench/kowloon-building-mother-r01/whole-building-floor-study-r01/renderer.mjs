import {packLiftFields,LIFT_FIELDS_GLSL} from './lift-field-pass.mjs';
import {buildEvidenceStairRailGLSL} from './stair-ray-rescue.mjs';
import {ASSEMBLY_ENTRY_GUARD_GLSL} from './ray-entry-guard.mjs';
import {packStructuralShadow,BOUNDED_SHADOW_GLSL,COLOR_CONTROL_GLSL} from './bounded-structural-shadow.mjs';
/** Original whole-building field compositor. A fullscreen triangle launches rays;
 * source patches and repeated floor functions never become object meshes.
 * Separate trace/nearest-hit reduction and material shading avoid inlining the
 * complete model once per lighting or secondary ray. */
import {buildCaseGLSL,packCaseDescriptors} from '../r07/cases.mjs';
import {packAssemblyDescriptors} from '../r07/assemblies.mjs';
import {applyFloorFinishDispatch} from './finish-dispatch.mjs';
import {buildPrimaryTileAssemblyGLSL as buildBoundedAssemblyGLSL,primaryPackedBounds,buildPrimaryTileIndex,primaryTileRows} from './primary-tile-index.mjs';
import {prepareTileFrame,prepareTileFrustum,aabbIntersectsTile,transformBounds} from '../whole-building-ground-r01/tile-visibility.mjs';
import {MOTHER_GLSL,MATERIAL_GLSL,HOSTED_MATERIAL_DEFAULTS} from '../r07/material.mjs';
import {deriveStairRails,createRailInstance,packStairRailDescriptors,buildStairRailGLSL} from '../whole-building-ground-r01/rails.mjs';
import {buildAperturesGLSL,packApertureDescriptors} from '../r07/apertures.mjs';
import {buildPrimaryTileAperturesGLSL,aperturePackedBounds,buildPrimaryApertureIndex,apertureTileRow} from './primary-aperture-index.mjs';
import {FLOOR_MATERIAL_GLSL} from '../floor-materials-r01/material-adapter.mjs';
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
uniform int uMaskCount;uniform vec4 uMaskOrigin[8],uMaskU[8],uMaskV[8],uMaskW[8];
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

function apertureShader(apertures){return HEAD+buildPrimaryTileAperturesGLSL(apertures)+CAMERA+REDUCE+`
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
const SHADE=HEAD+`struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};\n`+MOTHER_GLSL+MATERIAL_GLSL+FLOOR_MATERIAL_GLSL+CAMERA+`
uniform sampler2D uHit,uNormal,uLocal;uniform bool uIdentity;out vec4 outColor;
uniform int uDiagnostic;
uniform bool uOptics;uniform sampler2D uTransmittedColor,uReflectedColor,uOpticalWeight;
uniform vec3 uStudyX,uStudyZ;uniform sampler2D uMaterialFrames;
vec4 materialFrameRecord(int i){ivec2 z=textureSize(uMaterialFrames,0);return texelFetch(uMaterialFrames,ivec2(i%z.x,i/z.x),0);}
vec3 memberDirection(float objectId,vec3 d){int count=int(materialFrameRecord(0).x);for(int k=0;k<count;k++){int b=1+9*k;vec4 u=materialFrameRecord(b+1);if(abs(u.w-objectId)<.1)return vec3(dot(d,u.xyz),dot(d,materialFrameRecord(b+2).xyz),dot(d,materialFrameRecord(b+3).xyz));}return d;}

// A rigid metric face chart; a canonical normal prevents camera-facing flips
// from reversing the periodic phase. No normalized-UV/extent rescaling.
vec3 studyChart(vec3 p,vec3 n,float role){if(role==13.||role==14.||role==6.)return p;vec3 q=vec3(dot(p,uStudyX),p.y,dot(p,uStudyZ)),nn=vec3(dot(n,uStudyX),n.y,dot(n,uStudyZ));if(role==10.)return q;if(abs(nn.y)>.9)return vec3(q.x,q.z,q.y);if(nn.z<0.||(nn.z==0.&&nn.x<0.))nn=-nn;vec3 u=normalize(cross(vec3(0,1,0),nn));return vec3(dot(q,u),q.y,dot(q,nn));}
vec3 studyDirection(vec3 d,vec3 n,float role,float objectId){return (role==13.||role==14.)?memberDirection(objectId,d):studyChart(d,n,role);}
// Tangent-plane ray differential, bounded by the enclosing chart-aligned box.
// It is NOT an exact parallelogram/ellipse filter. No neighboring hit records
// are differenced across object edges. Secondary rays use a conservative local
// cone approximation, not a claim of recursive ray differentials.
vec2 studyFootprint(FieldHit h,vec3 n,vec3 rd,float distance,float base){
 vec3 f=normalize(uTarget-uCameraEye),r=normalize(cross(f,abs(f.y)>.999?vec3(0,0,1):vec3(0,1,0))),up=cross(r,f);
 float den=dot(n,rd);if(uRayMode>0||abs(den)<.0001)return vec2(base/max(abs(den),.0001));
 float k=2.*tan(uFov*.5)/uResolution.y*max(dot(rd,f),.0001);
 vec3 dx=(r-rd*dot(rd,r))*k,dy=(up-rd*dot(rd,up))*k;
 dx=distance*(dx-rd*dot(n,dx)/den);dy=distance*(dy-rd*dot(n,dy)/den);
 vec3 a=studyDirection(dx,n,h.materialRole,h.objectId),b=studyDirection(dy,n,h.materialRole,h.objectId);
 return max(h.materialRole==10.?abs(a.xz)+abs(b.xz):abs(a.xy)+abs(b.xy),vec2(.000001));
}
${COLOR_CONTROL_GLSL}
uniform bool uCorrectCoatG;uniform bool uBoundedShadow;uniform sampler2D uStructuralVisibility;
vec3 floorLight(FloorMaterialSample m,vec3 n,vec3 v,vec3 l,vec3 radiance){
 float nl=max(dot(n,l),0.),nv=max(dot(n,v),.0001);vec3 h=normalize(v+l);float nh=max(dot(n,h),0.),vh=max(dot(v,h),0.),a=max(.035,m.roughness);a*=a;float a2=a*a,den=nh*nh*(a2-1.)+1.;float D=a2/(3.14159265*den*den);float k=(m.roughness+1.);k=k*k/8.;float G=(nl/(nl*(1.-k)+k))*(nv/(nv*(1.-k)+k));vec3 F=m.coverageF0+(1.-m.coverageF0)*pow(1.-vh,5.);vec3 diffuse=m.coverageDiffuse*(1.-F)/3.14159265;vec3 spec=D*G*F/max(4.*nl*nv,.0001);float ca=max(.04,m.clearcoatRoughness);ca*=ca;float cd=nh*nh*(ca*ca-1.)+1.;float coatD=ca*ca/(3.14159265*cd*cd);float coatF=.04+.96*pow(1.-vh,5.);float coatG=coatGeometry(m.clearcoatRoughness,nl,nv);float coat= m.clearcoat*coatD*(uCorrectCoatG?coatG:G)*coatF/max(4.*nl*nv,.0001);return ((diffuse+spec)*(1.-m.clearcoat*coatF)+vec3(coat))*radiance*nl;
}
vec3 shadeFloor(FieldHit h,vec3 n,vec3 rd,float fp,float distance){
 vec2 footprint=studyFootprint(h,n,rd,distance,fp);fp=max(footprint.x,footprint.y);
 vec3 q=studyChart(h.local,n,h.materialRole),nn=studyDirection(n,n,h.materialRole,h.objectId);FloorMaterialSample m=sampleFloorMaterialFootprint(h.materialRole,q,nn,footprint,mod(h.objectId,65536.));
 if(uDiagnostic==3)return m.coverageDiffuse;
 if(uDiagnostic!=4){vec3 tangent=normalize(cross(n,abs(n.y)<.9?vec3(0,1,0):vec3(1,0,0))),bt=cross(n,tangent);float e=max(fp,.0005);vec3 dt=studyDirection(tangent,n,h.materialRole,h.objectId)*e,db=studyDirection(bt,n,h.materialRole,h.objectId)*e;
 float dh1=(sampleFloorMaterialFootprint(h.materialRole,q+dt,nn,footprint,mod(h.objectId,65536.)).height-m.height)/e,dh2=(sampleFloorMaterialFootprint(h.materialRole,q+db,nn,footprint,mod(h.objectId,65536.)).height-m.height)/e;n=normalize(n-clamp(dh1,-.5,.5)*tangent-clamp(dh2,-.5,.5)*bt);}
 float structuralVisibility=uBoundedShadow?texelFetch(uStructuralVisibility,ivec2(gl_FragCoord.xy),0).r:1.;vec3 color=floorLight(m,n,-rd,normalize(vec3(-.6,1.,-.7)),vec3(3.2,3.,2.75))*structuralVisibility;color+=floorLight(m,n,-rd,normalize(vec3(.7,.5,.5)),vec3(.75,.9,1.1));color+=m.coverageDiffuse*mix(vec3(.12,.14,.16),vec3(.3,.34,.38),n.y*.5+.5)*m.cavity;return color;
}

uniform bool uDatumVisible;uniform float uDatumY;uniform vec4 uDatumXZ;
vec3 datumAnnotation(vec3 color,vec3 rd,float surfaceT){
 if(!uDatumVisible||abs(rd.y)<1e-9)return color;
 float t=(uDatumY-uEye.y)/rd.y;if(t<=0.||t>=surfaceT)return color;
 vec3 p=uEye+rd*t;if(p.x<uDatumXZ.x||p.z<uDatumXZ.y||p.x>uDatumXZ.z||p.z>uDatumXZ.w)return color;
 float fp=max(t*2.*tan(uFov*.5)/uResolution.y,.018);
 vec2 lines=abs(mod(p.xz+1.,2.)-1.);
 float mask=1.-smoothstep(fp*.4,fp*1.15,min(lines.x,lines.y));
 return mix(color,vec3(.18,.62,.63),mask*.72);
}

void main(){ivec2 px=ivec2(gl_FragCoord.xy);vec4 hit=texelFetch(uHit,px,0);vec3 rd=rayDirection();if(hit.w>2.5){outColor=vec4(.95,.08,.55,1.);return;}if(hit.w<.5){outColor=vec4(datumAnnotation(mix(vec3(.84,.89,.9),vec3(.4,.54,.65),rd.y*.5+.5),rd,1e20),1.);return;}if(hit.z==6.&&uOptics){vec4 weight=texelFetch(uOpticalWeight,px,0);if(weight.x<0.){outColor=vec4(.95,.08,.55,1.);return;}outColor=vec4(texelFetch(uTransmittedColor,px,0).rgb*weight.rgb+texelFetch(uReflectedColor,px,0).rgb*weight.a,1.);return;}vec3 n=normalize(texelFetch(uNormal,px,0).xyz);if(dot(n,rd)>0.)n=-n;FieldHit h=FieldHit(0.,hit.y,hit.z,texelFetch(uLocal,px,0).xyz);if(uDiagnostic==1){outColor=vec4(.45+.3*cos(vec3(0,2,4)+h.objectId*.317),1.);return;}if(uDiagnostic==2){outColor=vec4(n*.5+.5,1.);return;}float fp=max(hit.x*2.*tan(uFov*.5)/uResolution.y,.0001);if(h.materialRole>=9.5){vec3 c=shadeFloor(h,n,rd,fp,hit.x);if(uIdentity)c=.45+.3*cos(vec3(0,2,4)+h.objectId*.317);outColor=vec4(max(c,vec3(0)),1.);return;}FieldSurface s=sampleFieldMaterial(h,n,fp);if(uDiagnostic==3){outColor=vec4(max(s.baseColor,vec3(0)),1.);return;}if(uIdentity)s.baseColor=.45+.3*cos(vec3(0,2,4)+hit.y*.317);vec3 tangent=normalize(cross(n,abs(n.y)<.9?vec3(0,1,0):vec3(1,0,0))),bt=cross(n,tangent);FieldHit a=h,b=h;float e=max(fp,.001);a.local+=tangent*e;b.local+=bt*e;float dh1=(sampleFieldMaterial(a,n,fp).height-s.height)/e,dh2=(sampleFieldMaterial(b,n,fp).height-s.height)/e;n=normalize(n-clamp(dh1,-.3,.3)*tangent-clamp(dh2,-.3,.3)*bt);vec3 c=directBRDF(s,n,-rd,normalize(vec3(-.6,1.,-.7)),vec3(3.2,3.,2.75));c+=directBRDF(s,n,-rd,normalize(vec3(.7,.5,.5)),vec3(.75,.9,1.1));c+=s.baseColor*(1.-s.metallic)*mix(vec3(.16,.18,.2),vec3(.32,.38,.43),n.y*.5+.5);c+=s.baseColor*s.metallic*.16;outColor=vec4(datumAnnotation(max(c,vec3(0)),rd,hit.x),1.);}
`;
const EMPTY=HEAD+`layout(location=0)out vec4 outHit;layout(location=1)out vec4 outNormal;layout(location=2)out vec4 outLocal;void main(){outHit=vec4(1e20,0,0,0);outNormal=vec4(0,1,0,0);outLocal=vec4(0);}`;
const STRUCTURAL_SHADOW=HEAD+CAMERA+BOUNDED_SHADOW_GLSL;
const PRESENT=HEAD+COLOR_CONTROL_GLSL+`uniform bool uRawAlbedo;uniform sampler2D uColor;uniform vec2 uPresentResolution;out vec4 outColor;
void main(){ivec2 size=textureSize(uColor,0);if(all(equal(size,ivec2(uPresentResolution))))outColor=texelFetch(uColor,ivec2(gl_FragCoord.xy),0);else outColor=texture(uColor,gl_FragCoord.xy/uPresentResolution);vec3 c=max(outColor.rgb,vec3(0.));outColor=vec4(uRawAlbedo?encodeLinearSrgb(c):pow(c/(1.+c),vec3(1./2.2)),1.);}`;
function program(g,source){const shaders=[];try{for(const [type,src]of [[g.VERTEX_SHADER,VERTEX],[g.FRAGMENT_SHADER,source]]){const s=g.createShader(type);shaders.push(s);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));}const p=g.createProgram();shaders.forEach(s=>g.attachShader(p,s));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}finally{shaders.forEach(s=>g.deleteShader(s));}}
/** Primary camera frusta cannot reject reflection/refraction rays. */
export function selectRayInstances(instances,{primaryRay,cullTiles,tile}){
 return primaryRay&&cullTiles?instances.filter(i=>!i.bounds||aabbIntersectsTile(tile,i.bounds)):instances;
}
export class WholeRenderer{
 constructor(canvas){this.canvas=canvas;const g=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!g||!g.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 Float32 rendering unavailable; no mesh substitute');g.disable(g.BLEND);g.disable(g.DEPTH_TEST);g.disable(g.DITHER);this.vao=g.createVertexArray();g.bindVertexArray(this.vao);this.lifecycle=new GpuLifecycle({gl:g,maxWaitMs:20000,maxInitializationMs:60000,onStop:e=>{this.error=e;}});const info=g.getExtension('WEBGL_debug_renderer_info');this.gpu=info?g.getParameter(info.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);this.options={eye:[45,45,-65],target:[0,25,0],fov:45*Math.PI/180,source:true,design:true,cut:true,clipNormal:[0,0,1],clipOffset:0,identity:false,correctCoatG:true,boundedShadow:false};this.textures=[];this.programs=[];this.revision=0;this.requestRevision=0;this.busy=false;this.disposed=false;this.compileStats=[];this.stats={frames:0,modelTriangles:0,modelVertexBuffers:0,screenTrianglesPerDispatch:1};}
 texture(packed){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,packed.width,packed.height,0,g.RGBA,g.FLOAT,packed.data);for(const [key,val]of [[g.TEXTURE_MIN_FILTER,g.NEAREST],[g.TEXTURE_MAG_FILTER,g.NEAREST],[g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE],[g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE]])g.texParameteri(g.TEXTURE_2D,key,val);this.textures.push(t);return t;}
 compile(name,src){const t=performance.now(),p=program(this.gl,src);this.programs.push(p);this.compileStats.push({name,characters:src.length,compileLinkWallMs:performance.now()-t});return p;}
 compileLift(){if(!this.dynamicLiftProgram)this.dynamicLiftProgram=this.compile('host-bound-elevator',HEAD+'struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};\n'+CAMERA+REDUCE+LIFT_FIELDS_GLSL);return this.dynamicLiftProgram;}
 setModel(model,measured){if(this.busy)throw Error('Model replacement requires completed GPU frame');const g=this.gl;this.model=model;this.measured=measured;this.study=model.floorStudy??null;this.structuralShadow=packStructuralShadow(model);this.revision++;this.textures.forEach(t=>g.deleteTexture(t));this.textures=[];this.apertureTexture=null;this.dynamicLiftTexture=null;this.primaryTileIndexTexture=null;this.primaryApertureIndexTexture=null;this.primaryApertureBounds=null;this.structuralShadowTexture=this.structuralShadow?this.texture(this.structuralShadow):null;if(this.structuralShadow&&!this.structuralShadowProgram)this.structuralShadowProgram=this.compile('bounded-structural-shadow',STRUCTURAL_SHADOW);if(!this.sourceProgram)this.sourceProgram=this.compile('source',sourceShader(measured));this.sourceTexture=this.texture(packCaseDescriptors(measured));this.apertures=this.study?.apertures??[];if(this.apertures.length){const packedApertures=packApertureDescriptors(this.apertures);this.apertureTexture=this.texture(packedApertures);this.primaryApertureBounds=aperturePackedBounds(packedApertures,packedApertures.primitiveCount);if(!this.apertureProgram)this.apertureProgram=this.compile('hosted-aperture',apertureShader(this.apertures));if(!this.opticalRayProgram)this.opticalRayProgram=this.compile('finite-glass-ray-generation',opticalRayShader(this.apertures));}this.archetypes=model.archetypes.map(a=>{const spec=a.spec??a,packed=packAssemblyDescriptors(spec);return{id:a.id,spec,primaryBounds:primaryPackedBounds(packed,spec.primitives.length),texture:this.texture(packed),coreTexture:this.texture(packAssemblyDescriptors({...a,primitives:a.primitives.filter(p=>!p.nodeId.includes('-partition'))}))};});if(!this.assemblyProgram)this.assemblyProgram=this.compile('assembly',assemblyShader(this.archetypes[0].spec));if(!this.shadeProgram)this.shadeProgram=this.compile('material-only',SHADE);if(!this.railProgram)this.railProgram=this.compile('continuous-rail',RAIL);if(!this.presentProgram)this.presentProgram=this.compile('frame-presentation',PRESENT);if(!this.emptyProgram)this.emptyProgram=this.compile('empty-field-initialization',EMPTY);this.railGroups=[];for(const stair of model.interfaces.stairs){let group=this.railGroups.find(r=>r.id===stair.archetypeId);if(!group){const template=stair.railTemplate??deriveStairRails(stair.layout);group={id:stair.archetypeId,template,texture:this.texture(packStairRailDescriptors(template)),instances:[]};this.railGroups.push(group);}group.instances.push({id:stair.id+':rail',floorId:stair.fromFloorId,toFloorId:stair.toFloorId,origin:stair.layout.origin.map((v,i)=>v+(i===1?stair.lowerElevation:0)),xAxis:stair.layout.X,zAxis:stair.layout.Z,objectId:model.interfaces.stairs.indexOf(stair)});}}
 targets(w,h){
  if(this.buffers?.[0].width===w&&this.buffers[0].height===h&&Boolean(this.rayTarget)===Boolean(this.apertures.length))return;
  const g=this.gl;for(const b of this.buffers??[]){b.textures.forEach(t=>g.deleteTexture(t));g.deleteFramebuffer(b.fbo);}
  if(this.colorTarget){g.deleteTexture(this.colorTarget.texture);g.deleteFramebuffer(this.colorTarget.fbo);}
  for(const b of [this.structuralShadowTarget,this.rayTarget,...(this.opticalColors??[])].filter(Boolean)){(b.textures??[b.texture]).forEach(t=>g.deleteTexture(t));g.deleteFramebuffer(b.fbo);}this.rayTarget=null;this.opticalColors=[];this.structuralShadowTarget=null;
  this.buffers=[0,1,2].map(()=>{const b={width:w,height:h,fbo:g.createFramebuffer(),textures:[]};g.bindFramebuffer(g.FRAMEBUFFER,b.fbo);for(let i=0;i<3;i++){const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,w,h,0,g.RGBA,g.FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+i,g.TEXTURE_2D,t,0);b.textures.push(t);}g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1,g.COLOR_ATTACHMENT2]);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Incomplete field target');return b;});
  const t=g.createTexture(),fbo=g.createFramebuffer();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA16F,w,h,0,g.RGBA,g.HALF_FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.bindFramebuffer(g.FRAMEBUFFER,fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);g.drawBuffers([g.COLOR_ATTACHMENT0]);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Incomplete presentation target');this.colorTarget={texture:t,fbo,width:w,height:h};
  const make=(count,float)=>{const b={width:w,height:h,fbo:g.createFramebuffer(),textures:[]};g.bindFramebuffer(g.FRAMEBUFFER,b.fbo);for(let i=0;i<count;i++){const tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);g.texImage2D(g.TEXTURE_2D,0,float?g.RGBA32F:g.RGBA16F,w,h,0,g.RGBA,float?g.FLOAT:g.HALF_FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+i,g.TEXTURE_2D,tex,0);b.textures.push(tex);}g.drawBuffers(Array.from({length:count},(_,i)=>g.COLOR_ATTACHMENT0+i));if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Optical field FBO incomplete');b.texture=b.textures[0];return b;};this.structuralShadowTarget=make(1,false);if(this.apertures.length){this.rayTarget=make(3,true);this.opticalColors=[make(1,false),make(1,false)];}

 }
 bindTexture(p,name,unit,t){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,t);g.uniform1i(g.getUniformLocation(p,name),unit);}
 camera(p,w,h,options){const g=this.gl,L=n=>g.getUniformLocation(p,n);g.uniform2f(L('uResolution'),w,h);g.uniform3fv(L('uCameraEye'),options.eye);g.uniform3fv(L('uTarget'),options.target);g.uniform1f(L('uFov'),options.fov);return L;}
 async complete(initialization=false){if(!this.lifecycle.submit({phase:initialization?'initialization':'frame'}))throw Error('GPU frame rejected: '+JSON.stringify(this.lifecycle.snapshot().lastFailure));while(!this.lifecycle.poll()){if(this.error)throw Error('GPU stopped: '+JSON.stringify(this.error));await new Promise(r=>setTimeout(r,8));}}
 async render({width=640,height=544,presentWidth=640,presentHeight=544,tileSize=128,cullTiles=true,visibleFloorIds=null,source=this.options.source,design=this.options.design,clipDesign=false,coreOnly=false,dynamicFields=[],requestRevision=this.requestRevision}={}){
  if(this.busy)throw Error('GPU frame already in progress');if(width*height>900000||width<1||height<1||tileSize<32||tileSize>256)throw Error('Render pixel/tile budget exceeded');
  this.busy=true;this.hitDataComplete=false;this.hitTiles=[];const start=performance.now(),revision=this.revision,o=structuredClone(this.options),g=this.gl,stats={passes:0,tilesCompleted:0,tilesPlanned:Math.ceil(width/tileSize)*Math.ceil(height/tileSize),width,height,presentWidth,presentHeight,visibleFloorIds,cancelled:false,maxTileWallMs:0};
  try{
   if(this.canvas.width!==presentWidth||this.canvas.height!==presentHeight){this.canvas.width=presentWidth;this.canvas.height=presentHeight;}
   this.targets(width,height);g.viewport(0,0,width,height);g.bindVertexArray(this.vao);g.enable(g.SCISSOR_TEST);
   const frame=prepareTileFrame({...o,width,height});
   const dynamic=design&&dynamicFields.length?packLiftFields(dynamicFields):null;
   if(dynamic){this.compileLift();if(!this.dynamicLiftTexture)this.dynamicLiftTexture=this.texture(dynamic);else{g.bindTexture(g.TEXTURE_2D,this.dynamicLiftTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,dynamic.width,dynamic.height,0,g.RGBA,g.FLOAT,dynamic.data);}}
   stats.dynamicLiftFields=dynamic?.fields.length??0;stats.dynamicLiftPairsBefore=0;stats.dynamicLiftPairsAfter=0;stats.dynamicLiftPasses=0;

   const glassBounds=this.apertures.flatMap(a=>a.primitives.filter(p=>p.materialRole===6).map(p=>p.bounds));stats.opticalTiles=0;stats.opticalTilesRejected=0;
   const assemblies=design?this.archetypes.map(archetype=>{const instances=this.model.instances.filter(i=>i.archetypeId===archetype.id&&(!visibleFloorIds||i.floorId===null||visibleFloorIds.includes(i.floorId))&&(!visibleFloorIds||i.kind!=='stair'||this.model.interfaces.stairs.some(s=>i.id===s.id+':instance'&&visibleFloorIds.includes(s.toFloorId))));instances.sort((a,b)=>{const d=i=>i.bounds?i.bounds.min.reduce((n,v,k)=>n+((v+i.bounds.max[k])*.5-o.eye[k])**2,0):0;return d(a)-d(b);});return{archetype,instances};}).filter(a=>a.instances.length):[];
   const railGroups=design?this.railGroups.map(group=>({group,instances:group.instances.filter(i=>!visibleFloorIds||(visibleFloorIds.includes(i.floorId)&&visibleFloorIds.includes(i.toFloorId))).map(i=>({...i,bounds:transformBounds(group.template.bounds,{origin:i.origin,xAxis:i.xAxis,yAxis:[0,1,0],zAxis:i.zAxis})}))})).filter(r=>r.instances.length):[];
   // One immutable index upload per frame. Only the independent evidence floor
   // participates; all old scenes, core-only and secondary traces fail open.
   const indexStart=performance.now();this.primaryTileIndexToken=(this.primaryTileIndexToken??0)%16777215+1;
   const primaryTileIndex=design&&cullTiles&&!coreOnly&&o.primitiveTileIndex!==false&&this.model.placementMode==='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother'?buildPrimaryTileIndex({assemblies,frame,width,height,tileSize,token:this.primaryTileIndexToken}):null;
   if(primaryTileIndex){if(!this.primaryTileIndexTexture)this.primaryTileIndexTexture=this.texture(primaryTileIndex);else{g.bindTexture(g.TEXTURE_2D,this.primaryTileIndexTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,primaryTileIndex.width,primaryTileIndex.height,0,g.RGBA,g.FLOAT,primaryTileIndex.data);}}
   stats.primaryTileIndex={enabled:Boolean(primaryTileIndex),ranges:primaryTileIndex?.rangeCount??0,indices:primaryTileIndex?.indexCount??0,records:primaryTileIndex?.records??0,prepareUploadWallMs:performance.now()-indexStart};
   // Independent primary-ray aperture scheduling. Authoritative functions,
   // outward-neighbor coverage and secondary/reflection/refraction stay full.
   const apertureIndexStart=performance.now();
   const primaryApertureIndex=design&&cullTiles&&!coreOnly&&o.apertureTileIndex!==false&&this.model.placementMode==='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother'&&this.primaryApertureBounds?buildPrimaryApertureIndex({bounds:this.primaryApertureBounds,frame,width,height,tileSize,token:this.primaryTileIndexToken}):null;
   if(primaryApertureIndex){if(!this.primaryApertureIndexTexture)this.primaryApertureIndexTexture=this.texture(primaryApertureIndex);else{g.bindTexture(g.TEXTURE_2D,this.primaryApertureIndexTexture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,primaryApertureIndex.width,primaryApertureIndex.height,0,g.RGBA,g.FLOAT,primaryApertureIndex.data);}}
   stats.primaryApertureIndex={enabled:Boolean(primaryApertureIndex),ranges:primaryApertureIndex?.rangeCount??0,indices:primaryApertureIndex?.indexCount??0,records:primaryApertureIndex?.records??0,prepareUploadWallMs:performance.now()-apertureIndexStart};
   Object.assign(stats,{cullTiles,assemblyPairsBefore:0,assemblyPairsAfter:0,railPairsBefore:0,railPairsAfter:0,emptyTiles:0});
   for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize){
    if(revision!==this.revision||requestRevision!==this.requestRevision){stats.cancelled=true;return {...stats,wallMs:performance.now()-start};}
    const tileStart=performance.now(),tile=prepareTileFrustum(frame,{x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y)});g.scissor(x,y,Math.min(tileSize,width-x),Math.min(tileSize,height-y));let previous=null,next=0,locked=null,rayMode=0;
    const pass=(p,setup)=>{while(this.buffers[next]===locked)next=(next+1)%3;const dst=this.buffers[next];g.bindFramebuffer(g.FRAMEBUFFER,dst.fbo);g.useProgram(p);const L=this.camera(p,width,height,o);g.uniform1i(L('uRayMode'),rayMode);if(rayMode){this.bindTexture(p,'uRayOrigin',4,this.rayTarget.textures[0]);this.bindTexture(p,'uRayDirection',5,this.rayTarget.textures[1]);}g.uniform1i(L('uFirst'),previous?0:1);if(previous){this.bindTexture(p,'uPreviousHit',1,previous.textures[0]);this.bindTexture(p,'uPreviousNormal',2,previous.textures[1]);this.bindTexture(p,'uPreviousLocal',3,previous.textures[2]);}else for(let unit=1;unit<=3;unit++){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,null);}g.uniform3fv(L('uClipNormal'),o.clipNormal);g.uniform1f(L('uClipOffset'),o.clipOffset);g.uniform1i(L('uClip'),0);g.uniform1i(L('uSlice'),o.sliceY?1:0);g.uniform2fv(L('uSliceY'),o.sliceY??[-1e10,1e10]);setup(L);g.drawArrays(g.TRIANGLES,0,3);previous=dst;next=(next+1)%3;stats.passes++;};
 const trace=()=>{previous=null;next=0;
 if(source)pass(this.sourceProgram,L=>{this.bindTexture(this.sourceProgram,'caseDescriptors',0,this.sourceTexture);g.uniform3fv(L('uSourceMin'),this.measured.bounds.min);g.uniform3fv(L('uSourceMax'),this.measured.bounds.max);g.uniform1i(L('uClip'),o.cut?1:0);const masks=this.study?.sourceMasks??[];g.uniform1i(L('uMaskCount'),design?masks.length:0);if(masks.length){g.uniform4fv(L('uMaskOrigin[0]'),new Float32Array(masks.flatMap(m=>[...m.frame.origin,m.sourceObjectId])));g.uniform4fv(L('uMaskU[0]'),new Float32Array(masks.flatMap(m=>[...m.frame.u,m.width/2])));g.uniform4fv(L('uMaskV[0]'),new Float32Array(masks.flatMap(m=>[...m.frame.v,m.height/2])));g.uniform4fv(L('uMaskW[0]'),new Float32Array(masks.flatMap(m=>[...m.frame.w,m.depth/2+.0001])));}});
 for(const {archetype,instances:allInstances} of assemblies){stats.assemblyPairsBefore+=allInstances.length;const instances=selectRayInstances(allInstances,{primaryRay:rayMode===0,cullTiles,tile});stats.assemblyPairsAfter+=instances.length;if(!instances.length)continue;if(instances.length>32)throw Error('Instance batch limit');pass(this.assemblyProgram,L=>{this.bindTexture(this.assemblyProgram,'assemblyDescriptors',0,coreOnly?archetype.coreTexture:archetype.texture);g.uniform1i(L('uPruneHitQueries'),o.pruneHitQueries===false?0:1);this.bindTexture(this.assemblyProgram,'uPrimaryTileIndex',6,this.primaryTileIndexTexture??archetype.texture);g.uniform1i(L('uPrimaryTileIndexEnabled'),rayMode===0&&primaryTileIndex?1:0);g.uniform1i(L('uPrimaryTileIndexToken'),this.primaryTileIndexToken);g.uniform4iv(L('uPrimaryTileIndexRows[0]'),primaryTileRows(rayMode===0?primaryTileIndex:null,archetype.id,Math.floor(y/tileSize)*Math.ceil(width/tileSize)+Math.floor(x/tileSize),instances));g.uniform1i(L('uInstanceCount'),instances.length);g.uniform4fv(L('uInstances[0]'),new Float32Array(instances.flatMap((i,k)=>[...i.translation,i.objectIdOffset??10000*(this.model.instances.indexOf(i)+1)])));g.uniform3fv(L('uArchetypeMin'),archetype.spec.bounds.min);g.uniform3fv(L('uArchetypeMax'),archetype.spec.bounds.max);g.uniform1i(L('uClip'),clipDesign?1:0);});}
 for(const {group,instances:allInstances} of railGroups){stats.railPairsBefore+=allInstances.length;const instances=selectRayInstances(allInstances,{primaryRay:rayMode===0,cullTiles,tile});stats.railPairsAfter+=instances.length;if(!instances.length)continue;pass(this.railProgram,L=>{this.bindTexture(this.railProgram,'uStairRailDescriptors',0,group.texture);g.uniform1i(L('uStairRailPieceCount'),group.template.primitives.length);g.uniform3fv(L('uStairRailBoundsMin'),group.template.bounds.min);g.uniform3fv(L('uStairRailBoundsMax'),group.template.bounds.max);g.uniform1i(L('uInstanceCount'),instances.length);g.uniform4fv(L('uInstances[0]'),new Float32Array(instances.flatMap(i=>[...i.origin,i.objectId])));g.uniform3fv(L('uRailX'),instances[0].xAxis);g.uniform3fv(L('uRailZ'),instances[0].zAxis);g.uniform1i(L('uClip'),clipDesign?1:0);});}

    if(design&&this.apertures.length&&(!visibleFloorIds||visibleFloorIds.includes(this.study.floorId)))pass(this.apertureProgram,L=>{this.bindTexture(this.apertureProgram,'uApertureDescriptors',0,this.apertureTexture);this.bindTexture(this.apertureProgram,'uPrimaryApertureIndex',6,this.primaryApertureIndexTexture??this.apertureTexture);g.uniform1i(L('uPrimaryApertureIndexEnabled'),rayMode===0&&primaryApertureIndex?1:0);g.uniform1i(L('uPrimaryApertureIndexToken'),this.primaryTileIndexToken);g.uniform1i(L('uPrimaryApertureIndexRow'),rayMode===0?apertureTileRow(primaryApertureIndex,Math.floor(y/tileSize)*Math.ceil(width/tileSize)+Math.floor(x/tileSize)):-1);g.uniform1i(L('uClip'),clipDesign?1:0);});
    if(dynamic){const slots=dynamic.fields.map((f,k)=>({f,k})).filter(({f})=>rayMode!==0||!cullTiles||aabbIntersectsTile(tile,f.bounds)).map(({k})=>k);stats.dynamicLiftPairsBefore+=dynamic.fields.length;stats.dynamicLiftPairsAfter+=slots.length;if(slots.length){pass(this.dynamicLiftProgram,L=>{this.bindTexture(this.dynamicLiftProgram,'uLiftDescriptors',0,this.dynamicLiftTexture);g.uniform1i(L('uLiftCount'),slots.length);g.uniform1iv(L('uLiftIndices[0]'),new Int32Array(slots));g.uniform1i(L('uClip'),clipDesign?1:0);});stats.dynamicLiftPasses++;}}
    if(!previous){pass(this.emptyProgram,()=>{});stats.emptyTiles++;}return previous;};
    const primary=trace();
    const shade=(hitTarget,target,mode,optics)=>{const shadow=!!(o.boundedShadow&&this.structuralShadow&&!(o.diagnostic>0)&&!o.identity);if(shadow){const p=this.structuralShadowProgram;g.bindFramebuffer(g.FRAMEBUFFER,this.structuralShadowTarget.fbo);g.useProgram(p);const S=this.camera(p,width,height,o);g.uniform1i(S('uRayMode'),mode);this.bindTexture(p,'uStructuralDescriptors',0,this.structuralShadowTexture);this.bindTexture(p,'uHit',1,hitTarget.textures[0]);this.bindTexture(p,'uNormal',2,hitTarget.textures[1]);if(mode){this.bindTexture(p,'uRayOrigin',7,this.rayTarget.textures[0]);this.bindTexture(p,'uRayDirection',8,this.rayTarget.textures[1]);}g.drawArrays(g.TRIANGLES,0,3);stats.passes++;stats.structuralShadowPasses=(stats.structuralShadowPasses??0)+1;}g.bindFramebuffer(g.FRAMEBUFFER,target.fbo);g.useProgram(this.shadeProgram);const L=this.camera(this.shadeProgram,width,height,o);this.bindTexture(this.shadeProgram,'uHit',1,hitTarget.textures[0]);this.bindTexture(this.shadeProgram,'uNormal',2,hitTarget.textures[1]);this.bindTexture(this.shadeProgram,'uLocal',3,hitTarget.textures[2]);g.uniform1i(L('uRayMode'),mode);if(mode){this.bindTexture(this.shadeProgram,'uRayOrigin',7,this.rayTarget.textures[0]);this.bindTexture(this.shadeProgram,'uRayDirection',8,this.rayTarget.textures[1]);}g.uniform1i(L('uDiagnostic'),o.diagnostic??0);g.uniform1i(L('uCorrectCoatG'),o.correctCoatG!==false?1:0);g.uniform1i(L('uBoundedShadow'),shadow?1:0);this.bindTexture(this.shadeProgram,'uStructuralVisibility',10,this.structuralShadowTarget.texture);g.uniform1i(L('uOptics'),optics?1:0);if(optics){this.bindTexture(this.shadeProgram,'uTransmittedColor',4,this.opticalColors[0].texture);this.bindTexture(this.shadeProgram,'uReflectedColor',5,this.opticalColors[1].texture);this.bindTexture(this.shadeProgram,'uOpticalWeight',6,this.rayTarget.textures[2]);}else{for(const [name,unit]of [['uTransmittedColor',4],['uReflectedColor',5],['uOpticalWeight',6]])this.bindTexture(this.shadeProgram,name,unit,this.sourceTexture);}g.uniform1i(L('uIdentity'),o.identity?1:0);this.bindTexture(this.shadeProgram,'uMaterialFrames',9,this.apertureTexture??this.sourceTexture);g.uniform3fv(L('uStudyX'),this.study?.frame?.X??[1,0,0]);g.uniform3fv(L('uStudyZ'),this.study?.frame?.Z??[0,0,1]);const datum=o.datum;g.uniform1i(L('uDatumVisible'),mode===0&&datum?.visible?1:0);g.uniform1f(L('uDatumY'),datum?.localY??0);g.uniform4fv(L('uDatumXZ'),datum?.xz??[-1,-1,1,1]);g.uniform1f(L('uAge'),.14);g.uniform1f(L('uWet'),.03);g.uniform1f(L('uMaterialEnabled'),1);g.uniform3fv(L('uFrameColor'),HOSTED_MATERIAL_DEFAULTS.frameColor);g.uniform3fv(L('uDoorColor'),HOSTED_MATERIAL_DEFAULTS.doorColor);g.uniform1f(L('uFrameRoughness'),.3);g.uniform1f(L('uFrameMetallic'),.65);g.drawArrays(g.TRIANGLES,0,3);stats.passes++;
};
    const opticalEligible=design&&glassBounds.length>0&&(!visibleFloorIds||visibleFloorIds.includes(this.study.floorId))&&!(o.diagnostic>0);
    const optical=opticalEligible&&(o.opticalTileCull===false||glassMayIntersectTile(glassBounds,tile));if(optical)stats.opticalTiles++;else if(opticalEligible)stats.opticalTilesRejected++;
    if(optical){locked=primary;for(let mode=0;mode<2;mode++){g.bindFramebuffer(g.FRAMEBUFFER,this.rayTarget.fbo);g.useProgram(this.opticalRayProgram);const L=this.camera(this.opticalRayProgram,width,height,o);g.uniform1i(L('uRayMode'),0);g.uniform1i(L('uReflection'),mode);this.bindTexture(this.opticalRayProgram,'uApertureDescriptors',0,this.apertureTexture);this.bindTexture(this.opticalRayProgram,'uHit',1,primary.textures[0]);this.bindTexture(this.opticalRayProgram,'uNormal',2,primary.textures[1]);g.drawArrays(g.TRIANGLES,0,3);stats.passes++;rayMode=1;const secondary=trace();shade(secondary,this.opticalColors[mode],1,false);}locked=null;rayMode=0;}
    shade(primary,this.colorTarget,0,optical);this.lastHitTarget=primary;this.hitTiles.push({x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y),target:primary});
    await this.complete(this.stats.frames===0);stats.tilesCompleted++;stats.maxTileWallMs=Math.max(stats.maxTileWallMs,performance.now()-tileStart);
   }
   if(revision!==this.revision||requestRevision!==this.requestRevision){stats.cancelled=true;return {...stats,wallMs:performance.now()-start};}
   g.disable(g.SCISSOR_TEST);g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,presentWidth,presentHeight);g.useProgram(this.presentProgram);g.uniform1i(g.getUniformLocation(this.presentProgram,'uRawAlbedo'),o.diagnostic===3?1:0);this.bindTexture(this.presentProgram,'uColor',0,this.colorTarget.texture);g.uniform2f(g.getUniformLocation(this.presentProgram,'uPresentResolution'),presentWidth,presentHeight);g.drawArrays(g.TRIANGLES,0,3);stats.presentationPasses=1;const error=g.getError();if(error!==g.NO_ERROR)throw Error('Field presentation GL error '+error);await this.complete(this.stats.frames===0);
   this.hitDataComplete=true;this.stats.frames++;this.stats.last={...stats,wallMs:performance.now()-start,revision,requestRevision,gpu:this.gpu,camera:o,logicalPasses:stats.passes/stats.tilesCompleted};return this.stats.last;
  }finally{g.disable(g.SCISSOR_TEST);this.busy=false;}
 }
 readHit(x=0,y=0){const g=this.gl,tile=this.hitTiles?.find(t=>x>=t.x&&x<t.x+t.width&&y>=t.y&&y<t.y+t.height),target=tile?.target;if(!target||this.busy||!this.hitDataComplete)throw Error('Completed field target required');const out=[];g.bindFramebuffer(g.FRAMEBUFFER,target.fbo);for(let i=0;i<3;i++){g.readBuffer(g.COLOR_ATTACHMENT0+i);const a=new Float32Array(4);g.readPixels(x,y,1,1,g.RGBA,g.FLOAT,a);out.push(Array.from(a));}g.bindFramebuffer(g.FRAMEBUFFER,null);return {t:out[0][0],objectId:out[0][1],materialRole:out[0][2],status:out[0][3],normal:out[1].slice(0,3),local:out[2].slice(0,3)};}
 readPixels(){const g=this.gl,out=new Uint8Array(this.canvas.width*this.canvas.height*4);g.bindFramebuffer(g.FRAMEBUFFER,null);g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,out);return out;}
}

/** Primary-ray tile proof only; never cull the secondary ray scene with this frustum. */
export function glassMayIntersectTile(glassBounds,tile){return glassBounds.some(bounds=>aabbIntersectsTile(tile,bounds));}
