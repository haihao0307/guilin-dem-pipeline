import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {FieldRenderer,buildRendererSources,nearestRankQuantile} from '../r06/renderer.mjs';
import {deriveField} from '../r06/field.mjs';
import {deriveMeasuredCase} from '../r06/cases.mjs';
const spec=deriveField();
function preprocessed(source){const r=spawnSync('cpp',['-P','-Wundef','-Werror'],{input:source.replace(/^#version.*\n/,''),encoding:'utf8',maxBuffer:2**22});assert.equal(r.status,0,r.stderr);return r.stdout;}
test('production primary and shade preprocess away the analytic rescue body, while rescue omits primary loop',()=>{
 const s=buildRendererSources(spec);assert.equal(s.split,true);
 for(const source of [s.primary,s.shade,s.rayPrimary]){const p=preprocessed(source);assert.doesNotMatch(p,/FIELD_BOUNDARY_EQUATIONS|fieldBoundaryDomain|fieldTraceRayAnalyticClipped|fieldTraceRescueFromClipped/);}
 const rescue=preprocessed(s.rescue);assert.doesNotMatch(rescue,/fieldTracePrimaryOnlyClipped|fieldTraceRayHybridClipped/);assert.match(rescue,/fieldTraceRescueFromClipped\(ro,rd/);
});
test('MRT stores safe absolute t, explicit status, total and primary count; only status 3 invokes rescue',()=>{
 const s=buildRendererSources(spec);assert.match(s.primary,/outState=vec4\(t,float\(status\),float\(steps\),float\(primarySteps\)\)/);assert.match(s.primary,/outNormalId=status==1\?vec4\(n,h.objectId\):vec4\(0\.\)/);assert.match(s.primary,/outLocalRole=status==1\?vec4\(h.local,h.materialRole\):vec4\(0\.\)/);
 assert.match(s.rescue,/if\(int\(state.y\)!=3\)\{outState=state;/);assert.match(s.rescue,/state.x,usedPrimarySteps,t,h,steps,status/);assert.match(s.shade,/int\(primary.y\)==3\?1\.:0\./);
});
test('production ray probe uses same split entry points and MRT transport, not combined-reference claims',()=>{
 const s=buildRendererSources(spec);for(const [a,b]of [[s.primary,s.rayPrimary],[s.rescue,s.rayRescue]]){assert.equal(a,b.replace('#define FIELD_RAY_PROBE 1\n',''));}assert.match(s.rayPrimary,/rd=normalize\(uDirections\[i\]\)/);assert.match(s.rayResult,/state.y,state.z/);
});
test('three-sample p95 is maximum, not median',()=>{assert.equal(nearestRankQuantile([30,10,20],.95),30);assert.equal(nearestRankQuantile([30,10,20],.5),20);});

// This mock verifies lifecycle/routing and exact diagnostic decoding only.
// It does not claim shader compilation, rendered correctness or GPU performance.
function mockGL(){
 let id=0,active=100,fb=null,p=null,read=20;const bound=new Map(),draws=[],deletedTextures=[],deletedFramebuffers=[];
 const g={TEXTURE0:100,TEXTURE_2D:10,RGBA32F:11,RGBA:12,FLOAT:13,UNSIGNED_BYTE:14,FRAMEBUFFER:15,FRAMEBUFFER_COMPLETE:16,COLOR_ATTACHMENT0:20,BACK:25,MAX_DRAW_BUFFERS:30,MAX_COLOR_ATTACHMENTS:31,RENDERER:32,VERTEX_SHADER:33,FRAGMENT_SHADER:34,COMPILE_STATUS:35,LINK_STATUS:36,TRIANGLES:37,NEAREST:38,TEXTURE_MIN_FILTER:39,TEXTURE_MAG_FILTER:40,TEXTURE_WRAP_S:41,TEXTURE_WRAP_T:42,CLAMP_TO_EDGE:43,DITHER:44,BLEND:45,DEPTH_TEST:46,SCISSOR_TEST:47,CULL_FACE:48,
 draws,deletedTextures,deletedFramebuffers,textureCalls:[],disable(){},createVertexArray(){return {id:++id};},bindVertexArray(){},getExtension(n){return n==='EXT_color_buffer_float'?{}:null;},getParameter(n){return n===30||n===31?8:'mock GPU, not render evidence';},
 createShader(type){return {id:++id,type};},shaderSource(s,source){s.source=source;},compileShader(){},getShaderParameter(){return true;},deleteShader(){},createProgram(){return {id:++id,shaders:[],uniforms:{}};},attachShader(p,s){p.shaders.push(s);},linkProgram(){},getProgramParameter(){return true;},deleteProgram(p){p.deleted=true;},
 createTexture(){return {id:++id};},activeTexture(n){active=n;},bindTexture(_,t){bound.set(active,t);},texImage2D(...args){const t=bound.get(active);t.width=args[3];t.height=args[4];t.data=args[8];g.textureCalls.push(args);},texParameteri(){},deleteTexture(t){deletedTextures.push(t);},createFramebuffer(){return {id:++id,textures:[]};},bindFramebuffer(_,f){fb=f;},framebufferTexture2D(_,attachment,__,t){fb.textures[attachment-g.COLOR_ATTACHMENT0]=t;},drawBuffers(){},checkFramebufferStatus(){return g.FRAMEBUFFER_COMPLETE;},deleteFramebuffer(f){deletedFramebuffers.push(f);},
 useProgram(value){p=value;},getUniformLocation(_,name){return name;},uniform1f(n,v){p.uniforms[n]=v;},uniform1i(n,v){p.uniforms[n]=v;},uniform2f(n,...v){p.uniforms[n]=v;},uniform3fv(n,v){p.uniforms[n]=Array.from(v);},viewport(...v){g.viewportValue=v;},
 drawArrays(mode,first,count){assert.equal(mode,g.TRIANGLES);assert.equal(first,0);assert.equal(count,3);for(const name of ['uState','uNormalId','uLocalRole','uPrimaryState'])if(name in p.uniforms){const sampled=bound.get(g.TEXTURE0+p.uniforms[name]);assert.ok(!fb||!fb.textures.includes(sampled),'cannot sample an attached output texture');}draws.push({p,fb,uniforms:structuredClone(p.uniforms)});if(g.onDraw)g.onDraw({p,fb});},
 readBuffer(n){read=n;},readPixels(x,y,w,h,format,type,out){const data=fb?.textures[read-g.COLOR_ATTACHMENT0]?.readback;if(data)out.set(data);},getError(){return 0;},finish(){}};return g;
}
const rendererWithMock=()=>{const gl=mockGL(),canvas={width:2,height:1,getContext:()=>gl},renderer=new FieldRenderer(canvas);renderer.setSpec(spec);return {renderer,gl,canvas};};
test('render uses separate Float32 primary/final targets and exactly three full-screen draws with identical camera',()=>{
 const {renderer:r,gl}=rendererWithMock();r.draw();assert.equal(gl.draws.length,3);const [a,b,c]=gl.draws;assert.ok(a.fb&&b.fb&&a.fb!==b.fb);assert.equal(c.fb,null);for(const key of ['uEye','uTarget','uFov','uResolution','uCutaway']){assert.deepEqual(a.uniforms[key],b.uniforms[key]);assert.deepEqual(a.uniforms[key],c.uniforms[key]);}assert.equal(a.fb.textures.length,3);assert.equal(b.fb.textures.length,3);assert.equal(gl.textureCalls.length,6);assert.ok(gl.textureCalls.every(x=>x[2]===gl.RGBA32F&&x[7]===gl.FLOAT));assert.equal(r.snapshot().screenTrianglesPerFrame,3);assert.equal(r.snapshot().modelTriangles,0);
 r.resize(3,2);assert.equal(gl.deletedTextures.length,6);assert.equal(gl.deletedFramebuffers.length,2);assert.equal(r.snapshot().screenPassesPerFrame,3);
});
test('diagnostics decode true Float32 counts above 255 and zero-extra-step analytic rescue',()=>{
 const {renderer:r,gl}=rendererWithMock();gl.onDraw=({p,fb})=>{if(!fb)return;if(p===r.programs.primary)fb.textures[0].readback=new Float32Array([2,3,128,128,3,3,128,128]);if(p===r.programs.rescue){fb.textures[0].readback=new Float32Array([2,1,128,128,3,3,512,128]);fb.textures[1].readback=new Float32Array([0,1,0,101,0,0,0,0]);}};const d=r.diagnostics();assert.equal(d.rescuePixelCount,2);assert.equal(d.hits,1);assert.equal(d.unresolved,1);assert.equal(d.maxSteps,512);assert.equal(d.meanSteps,320);assert.equal(d.meanPrimarySteps,128);assert.equal(d.histogram[512],1);assert.equal(d.stepCountsSaturateAt255,false);assert.deepEqual(d.visibleObjectPixels,{'101':1});
});
test('ray probes compile lazily, perform same split stages and delete all temporary attachments',()=>{
 const {renderer:r,gl}=rendererWithMock();assert.equal(r.rayProbePrograms,null);r.probe([[0,2,0]],4,[[0,-1,0]]);assert.ok(r.rayProbePrograms);assert.equal(gl.draws.length,3);assert.equal(gl.deletedTextures.length,7);assert.equal(gl.deletedFramebuffers.length,3);assert.equal(gl.draws[0].uniforms.uCutaway,0);assert.equal(gl.draws[1].uniforms.uCutaway,0);assert.match(r.compileProfile.rayProbeInterface,/same primary\/rescue interfaces/);
});
test('measured render and lazy probes bind finite-record descriptor sampler and release replaced texture',()=>{
 const {renderer:r,gl}=rendererWithMock(),score=JSON.parse(readFileSync(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json',import.meta.url))),measured=deriveMeasuredCase(score);r.setSpec(measured);const old=r.descriptors.texture;assert.equal(r.sources.split,false);r.draw();assert.equal(gl.draws.at(-1).uniforms.caseDescriptors,0);r.probe([[0,0,0]]);assert.equal(gl.draws.at(-1).uniforms.caseDescriptors,0);r.setSpec(measured);assert.ok(gl.deletedTextures.includes(old));assert.equal(r.snapshot().screenPassesPerFrame,1);
});
