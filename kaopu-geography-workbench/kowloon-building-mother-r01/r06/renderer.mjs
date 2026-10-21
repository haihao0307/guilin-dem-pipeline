/** Original direct field renderer. No model meshes, vertex arrays or index buffers. */
import {buildFieldGLSL} from './field.mjs';
import {buildCaseGLSL} from './cases.mjs';
import {MOTHER_GLSL,MATERIAL_GLSL} from './material.mjs';
const VERTEX=`#version 300 es
precision highp float;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
const HEAD=`#version 300 es
precision highp float;
precision highp int;
`;
const RENDER=String.raw`
uniform vec2 uResolution;
uniform vec3 uEye,uTarget,uBoundsMin,uBoundsMax;
uniform float uFov,uCutaway;
uniform int uRenderMode,uDiagnostic;
out vec4 outColor;
float displayDistance(vec3 p){float d=mapField(p).distance;if(uCutaway>.5)d=max(d,-p.x-.2);return d;}
vec3 displayNormal(vec3 p){float e=.0004;return normalize(vec3(displayDistance(p+vec3(e,0,0))-displayDistance(p-vec3(e,0,0)),displayDistance(p+vec3(0,e,0))-displayDistance(p-vec3(0,e,0)),displayDistance(p+vec3(0,0,e))-displayDistance(p-vec3(0,0,e))));}
vec2 rayBox(vec3 ro,vec3 rd){vec3 inv=1./rd,a=(uBoundsMin-ro)*inv,b=(uBoundsMax-ro)*inv;vec3 lo=min(a,b),hi=max(a,b);return vec2(max(max(lo.x,lo.y),lo.z),min(min(hi.x,hi.y),hi.z));}
vec3 colorId(float id){return .35+.6*cos(vec3(0.,2.,4.)+id*1.37);}
void main(){
 vec2 uv=(2.*gl_FragCoord.xy-uResolution)/uResolution.y;
 vec3 f=normalize(uTarget-uEye),right=normalize(cross(f,vec3(0,1,0))),up=cross(right,f);
 vec3 rd=normalize(f+tan(uFov*.5)*(uv.x*right+uv.y*up));
 float t=0.;int status=2,steps=0;FieldHit h;
 #if FIELD_SURFACE
 bool found=caseTraceRay(uEye,rd,t,h,steps);status=found?1:2;
 #else
 fieldTraceRayClipped(uEye,rd,uCutaway>.5?-.2:-1e20,t,h,steps,status);
 #endif
 vec3 p=uEye+rd*t;
 if(uDiagnostic==1){outColor=vec4(float(min(steps,255))/255.,float(status)/255.,status==1?(h.objectId>=1000.?h.objectId-999.:(h.objectId==101.?1.:h.objectId==102.?2.:h.objectId==201.?3.:h.objectId==202.?4.:h.objectId==203.?5.:h.objectId==301.?6.:7.))/255.:0.,1.);return;}
 vec3 sky=mix(vec3(.82,.87,.86),vec3(.48,.62,.67),clamp(rd.y*.6+.4,0.,1.));
 if(status==3){outColor=vec4(.85,.12,.55,1.);return;}
 if(status!=1){outColor=vec4(sky,1.);return;}
 #if FIELD_SURFACE
 vec3 n=caseN[int(h.objectId)-1000];
 #else
 vec3 n=displayNormal(p);
 #endif
 if(dot(n,rd)>0.)n=-n;
 if(uRenderMode==1){outColor=vec4(colorId(h.objectId)*(.4+.6*max(dot(n,normalize(vec3(-.4,1.,-.5))),0.)),1.);return;}
 if(uRenderMode==2){float s=float(steps)/100.;outColor=vec4(clamp(vec3(s,.7-s*.4,1.-s),0.,1.),1.);return;}
 float footprint=max(t*2.*tan(uFov*.5)/uResolution.y,.0001);
 FieldSurface surface=sampleFieldMaterial(h,n,footprint);
 // The same final field query provides material role and local coordinates.
 // Material microheight is shading only, never a hidden silhouette deformation.
 vec3 tangent=normalize(cross(n,abs(n.y)<.9?vec3(0,1,0):vec3(1,0,0))),bitangent=cross(n,tangent);
 float eps=max(footprint,.0008);FieldHit ht=h;ht.local=h.local+tangent*eps;FieldHit hb=h;hb.local=h.local+bitangent*eps;
 float dh1=(sampleFieldMaterial(ht,n,footprint).height-surface.height)/eps,dh2=(sampleFieldMaterial(hb,n,footprint).height-surface.height)/eps;
 n=normalize(n-clamp(dh1,-.3,.3)*tangent-clamp(dh2,-.3,.3)*bitangent);
 vec3 view=normalize(uEye-p),sun=normalize(vec3(-.55,1.,-.45));
 float ao=1.;for(int i=1;i<=3;i++){float r=float(i)*.14;ao-=max(r-max(displayDistance(p+n*r),0.),0.)/(r*9.);}
 vec3 color=directBRDF(surface,n,view,sun,vec3(3.0,2.85,2.65));
 color+=directBRDF(surface,n,view,normalize(vec3(.5,.4,.7)),vec3(.5,.65,.8));
 color+=surface.baseColor*(1.-surface.metallic)*mix(vec3(.12,.14,.13),vec3(.3,.36,.38),n.y*.5+.5)*clamp(ao,.35,1.);
 color+=surface.baseColor*surface.metallic*.14;
 color=color/(1.+color);color=pow(max(color,vec3(0.)),vec3(1./2.2));
 outColor=vec4(color,1.);
}`;
const PROBE=String.raw`
uniform vec3 uPoints[128],uDirections[128];uniform int uProbeKind;out vec4 outColor;
void main(){int i=int(gl_FragCoord.x);vec3 p=uPoints[i];FieldHit h=mapField(p);
 if(uProbeKind==4){float t;int steps,status;
 #if FIELD_SURFACE
 bool found=caseTraceRay(p,normalize(uDirections[i]),t,h,steps);status=found?1:2;
 #else
 fieldTraceRay(p,normalize(uDirections[i]),t,h,steps,status);
 #endif
 outColor=vec4(status==1?t:0.,h.objectId,float(status),float(steps));return;}
 if(uProbeKind==0)outColor=vec4(h.distance,h.objectId,h.materialRole,1.);
 else if(uProbeKind==1)outColor=vec4(fieldNormal(p),h.distance);
 else if(uProbeKind==2){FieldSurface s=sampleFieldMaterial(h,fieldNormal(p),.001);outColor=vec4(s.baseColor,s.roughness);}
 else outColor=vec4(h.local,1.);
}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error('Field shader compile failed: '+log);}return s;}
function program(gl,fragment){const p=gl.createProgram(),vs=shader(gl,gl.VERTEX_SHADER,VERTEX),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
const quantile=(a,q)=>a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*q)];
export class FieldRenderer{
 constructor(canvas){this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 is unavailable. No mesh fallback is used.');gl.disable(gl.DITHER);this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);this.floatExtension=gl.getExtension('EXT_color_buffer_float');this.timerExtension=gl.getExtension('EXT_disjoint_timer_query_webgl2');const info=gl.getExtension('WEBGL_debug_renderer_info');this.gpu=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);this.vertexBufferCount=0;this.indexBufferCount=0;this.modelTriangles=0;this.screenTrianglesPerPass=1;this.options={eye:[7,7,-7],target:[0,1.8,2.5],fov:45*Math.PI/180,cutaway:0,renderMode:0,age:.18,wet:.08,materialEnabled:1};}
 setSpec(spec){const gl=this.gl,code=spec.fieldKind==='measured-surface'?buildCaseGLSL(spec):buildFieldGLSL(spec),source=typeof code==='string'?code:code.source;let render,probe;try{render=program(gl,HEAD+'#define FIELD_SURFACE '+(spec.fieldKind==='measured-surface'?'1':'0')+'\n'+source+MOTHER_GLSL+MATERIAL_GLSL+RENDER);probe=program(gl,HEAD+'#define FIELD_SURFACE '+(spec.fieldKind==='measured-surface'?'1':'0')+'\n'+source+MOTHER_GLSL+MATERIAL_GLSL+PROBE);}catch(e){if(render)gl.deleteProgram(render);throw e;}if(this.renderProgram)gl.deleteProgram(this.renderProgram);if(this.probeProgram)gl.deleteProgram(this.probeProgram);this.renderProgram=render;this.probeProgram=probe;this.spec=spec;this.fieldSource=source;this.compileCount=(this.compileCount??0)+1;}
 uniforms(p){const g=this.gl,o=this.options,L=n=>g.getUniformLocation(p,n);g.uniform1f(L('uAge'),o.age);g.uniform1f(L('uWet'),o.wet);g.uniform1f(L('uMaterialEnabled'),o.materialEnabled);return L;}
 draw({diagnostic=false}={}){const gl=this.gl,c=this.canvas,o=this.options;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindVertexArray(this.vao);gl.viewport(0,0,c.width,c.height);gl.useProgram(this.renderProgram);const L=this.uniforms(this.renderProgram);gl.uniform2f(L('uResolution'),c.width,c.height);for(const[n,v]of [['uEye',o.eye],['uTarget',o.target],['uBoundsMin',this.spec.bounds.min],['uBoundsMax',this.spec.bounds.max]])gl.uniform3fv(L(n),v);gl.uniform1f(L('uFov'),o.fov);gl.uniform1f(L('uCutaway'),o.cutaway);gl.uniform1i(L('uRenderMode'),o.renderMode);gl.uniform1i(L('uDiagnostic'),diagnostic?1:0);gl.drawArrays(gl.TRIANGLES,0,3);this.drawCount=(this.drawCount??0)+1;const err=gl.getError();if(err)throw Error('WebGL error '+err);}
 resize(width,height){this.canvas.width=Math.max(1,Math.round(width));this.canvas.height=Math.max(1,Math.round(height));this.draw();}
 probe(points,kind=0,directions=null){if(!this.floatExtension)throw Error('Float GPU query readback unavailable; parity is not verified');if(!points.length||points.length>128)throw Error('Probe requires1..128points');const g=this.gl,t=g.createTexture(),fb=g.createFramebuffer();try{g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,points.length,1,0,g.RGBA,g.FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Float query framebuffer incomplete');g.useProgram(this.probeProgram);g.bindVertexArray(this.vao);const L=this.uniforms(this.probeProgram);g.uniform3fv(L('uPoints[0]'),new Float32Array(points.flat()));g.uniform1i(L('uProbeKind'),kind);if(directions)g.uniform3fv(L('uDirections[0]'),new Float32Array(directions.flat()));g.viewport(0,0,points.length,1);g.drawArrays(g.TRIANGLES,0,3);const out=new Float32Array(points.length*4);g.readPixels(0,0,points.length,1,g.RGBA,g.FLOAT,out);return points.map((_,i)=>Array.from(out.slice(i*4,i*4+4)));}finally{g.bindFramebuffer(g.FRAMEBUFFER,null);g.deleteFramebuffer(fb);g.deleteTexture(t);g.viewport(0,0,this.canvas.width,this.canvas.height);}}
 diagnostics(){const g=this.gl;this.draw({diagnostic:true});const a=new Uint8Array(this.canvas.width*this.canvas.height*4);g.readPixels(0,0,this.canvas.width,this.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);let hits=0,misses=0,unresolved=0,sum=0,max=0;const histogram=Array(256).fill(0),ids={};for(let i=0;i<a.length;i+=4){const steps=a[i],status=a[i+1];sum+=steps;max=Math.max(max,steps);histogram[steps]++;if(status===1){hits++;const id=this.spec.fieldKind==='measured-surface'?a[i+2]+999:[0,101,102,201,202,203,301,401][a[i+2]];ids[id]=(ids[id]??0)+1;}else if(status===2)misses++;else unresolved++;}this.draw();return {width:this.canvas.width,height:this.canvas.height,pixels:a.length/4,hits,misses,unresolved,meanSteps:sum/(a.length/4),maxSteps:max,metric:this.spec.fieldKind==='measured-surface'?'BVH node visits':'rail-only march steps; structural faces analytic',stepCap:this.spec.fieldKind==='measured-surface'?this.spec.nodes.length:512,stepCountsSaturateAt255:true,histogram,visibleObjectPixels:ids,hitEpsilon:'max(0.00015m,rayDistance*0.000025)',stepRule:'analytic finite structural boundaries; rail-only conservative march with no unsafe minimum step',missCondition:'finite boundary tests rejected all candidates and rail interval exhausted geometrically; budget exhaustion remains unresolved',unresolvedColor:'#d91f8c'};}
 async benchmark(frames=12){const timings=[];for(let i=0;i<frames+2;i++){await new Promise(r=>requestAnimationFrame(r));const start=performance.now();this.draw();this.gl.finish();this.gl.readPixels(0,0,1,1,this.gl.RGBA,this.gl.UNSIGNED_BYTE,new Uint8Array(4));if(i>=2)timings.push(performance.now()-start);}return {measurement:'wallclock draw plus gl.finish and pixel readback, not isolated GPU timer',samples:timings,medianMs:quantile(timings,.5),p95Ms:quantile(timings,.95),width:this.canvas.width,height:this.canvas.height,gpu:this.gpu,timerExtensionAvailable:!!this.timerExtension,modelTriangles:0,screenTrianglesPerPass:1,vertexBuffers:0,indexBuffers:0};}
 snapshot(){return {gpu:this.gpu,width:this.canvas.width,height:this.canvas.height,drawCount:this.drawCount,compileCount:this.compileCount,modelTriangles:0,vertexBuffers:0,indexBuffers:0,screenTrianglesPerPass:1,floatQueryReadback:!!this.floatExtension,renderer:'WebGL2 direct analytic field ray evaluation',noMeshFallback:true};}
}
