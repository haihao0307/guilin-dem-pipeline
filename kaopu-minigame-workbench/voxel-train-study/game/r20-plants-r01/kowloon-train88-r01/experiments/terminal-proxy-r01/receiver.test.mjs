// CPU protocol mocks only. Actual shader output and GPU early-stencil behavior
// require the separately controlled WebGL probe; these tests claim neither.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGroupQueryReceiver} from './proxy-receiver.mjs';
import {GEOMETRY_GROUP_NAMES} from '../../geometry-groups.mjs';
import {threeFragment} from '../../glsl-interface.mjs';

const SCENE='588042e14707b2dcab1e890c18fca2afdd20104eaecb7a5d3b25baa71c6a8d36';
const COMPACT='fa540676720626a10de4d1329b3b17aa240ede0e2e51414afc9bf164583801c2';
const source=readFileSync(new URL('./proxy-receiver.mjs',import.meta.url),'utf8');
const original=readFileSync(new URL('../group-cost-r01/profiled-receiver.mjs',import.meta.url),'utf8');
const shader=index=>`#version 300 es
precision highp float;
struct Params { vec4 options; }; struct HostFrame { vec4 viewport; }; struct GroupQueryControl { vec4 options; };
layout(std140) uniform P { Params params; };
layout(std140) uniform F { HostFrame frame; };
layout(std140) uniform C { GroupQueryControl control; };
uniform highp sampler2D group_1_binding_0_trace;
${index===0||index==='proxy'?'':'uniform highp sampler2D group_1_binding_1_previous;'}
uniform highp sampler2D group_1_binding_5_fullHitA;
out vec4 value;
void main() { value=vec4(${typeof index==='number'?index:91}.); } // original body ${index}
`;
const stencilNames=['STENCIL_FUNC','STENCIL_REF','STENCIL_VALUE_MASK','STENCIL_WRITEMASK','STENCIL_FAIL','STENCIL_PASS_DEPTH_FAIL','STENCIL_PASS_DEPTH_PASS'];
class Vector4 {
  constructor(x=0,y=0,z=0,w=0){this.isVector4=true;this.set(x,y,z,w);}
  set(x,y,z,w){Object.assign(this,{x,y,z,w});return this;}
  copy(other){return this.set(other.x,other.y,other.z,other.w);}
  clone(){return new Vector4(this.x,this.y,this.z,this.w);}
  toArray(){return [this.x,this.y,this.z,this.w];}
}
function harness({asymmetric=false,missing=null,sceneSHA=SCENE,compactSHA=COMPACT,proxyEntry='stationTerminalProxy',pixelRatio=2,stencilBits=8,complete=true,reverseDepth=false}={}) {
  const logs=[],materials=[],targets=[],fetches=[],values=new Map(),enabled=new Set();
  const gl={NEVER:512,LESS:513,EQUAL:514,LEQUAL:515,GREATER:516,NOTEQUAL:517,GEQUAL:518,ALWAYS:519,KEEP:7680,REPLACE:7681};
  for(const name of [...stencilNames,...stencilNames.map(name=>name.replace('STENCIL_','STENCIL_BACK_')),'STENCIL_CLEAR_VALUE','DEPTH_FUNC','DEPTH_WRITEMASK','VIEWPORT','SCISSOR_BOX','SCISSOR_TEST','STENCIL_TEST','DEPTH_TEST','MAX_DRAW_BUFFERS','MAX_COLOR_ATTACHMENTS','MAX_TEXTURE_SIZE','STENCIL_BITS','FRAMEBUFFER','FRAMEBUFFER_COMPLETE'])gl[name]=1000+Object.keys(gl).length;
  gl.getExtension=name=>name==='EXT_color_buffer_float'?{}:null;
  gl.getParameter=key=>key===gl.STENCIL_BITS?stencilBits:values.get(key);
  gl.checkFramebufferStatus=()=>complete?gl.FRAMEBUFFER_COMPLETE:0;
  gl.isContextLost=()=>false;
  gl.isEnabled=key=>enabled.has(key);
  for(const name of ['readPixels','fenceSync','beginQuery','getQueryParameter','finish','flush'])gl[name]=()=>{throw Error(`Forbidden runtime ${name}`);};
  values.set(gl.MAX_DRAW_BUFFERS,4);values.set(gl.MAX_COLOR_ATTACHMENTS,4);values.set(gl.MAX_TEXTURE_SIZE,4096);
  values.set(gl.DEPTH_FUNC,gl.GREATER);values.set(gl.DEPTH_WRITEMASK,false);
  values.set(gl.STENCIL_CLEAR_VALUE,7);
  const initialStencil=[gl.NOTEQUAL,3,0x3f,0x12,gl.REPLACE,gl.KEEP,gl.KEEP];
  stencilNames.forEach((name,index)=>{values.set(gl[name],initialStencil[index]);values.set(gl[name.replace('STENCIL_','STENCIL_BACK_')],initialStencil[index]);});
  if(asymmetric)values.set(gl.STENCIL_BACK_REF,5);
  enabled.add(gl.STENCIL_TEST);enabled.add(gl.SCISSOR_TEST);
  class RawShaderMaterial {
    constructor(options){Object.assign(this,{stencilWrite:false,stencilWriteMask:255,stencilFunc:gl.ALWAYS,stencilRef:0,stencilFuncMask:255,stencilFail:gl.KEEP,stencilZFail:gl.KEEP,stencilZPass:gl.KEEP,depthFunc:3},options);materials.push(this);}
    dispose(){this.disposed=true;}
  }
  class WebGLRenderTarget {
    constructor(width,height,options){Object.assign(this,{width,height,...options,id:targets.length,scissorTest:false,viewport:new Vector4(0,0,width,height),scissor:new Vector4(0,0,width,height)});this.textures=Array.from({length:options.count??1},()=>({isTexture:true,owner:this,pixels:Array.from({length:width*height},()=>[NaN,NaN,NaN,NaN])}));this.stencil=new Uint8Array(width*height).fill(9);targets.push(this);}
    dispose(){this.disposed=true;}
  }
  const THREE={Vector4,RawShaderMaterial,WebGLRenderTarget,FloatType:'float',RGBAFormat:'rgba',NearestFilter:'nearest',NoColorSpace:'none',GLSL3:'glsl3',NoBlending:0,KeepStencilOp:gl.KEEP,ReplaceStencilOp:gl.REPLACE,AlwaysStencilFunc:gl.ALWAYS,EqualStencilFunc:gl.EQUAL};
  ['NeverDepth','AlwaysDepth','LessDepth','LessEqualDepth','EqualDepth','GreaterEqualDepth','GreaterDepth','NotEqualDepth'].forEach((name,index)=>THREE[name]=index);
  THREE.BufferGeometry=class{setAttribute(name,value){this[name]=value;}dispose(){this.disposed=true;}};
  THREE.Float32BufferAttribute=class{constructor(array,itemSize){Object.assign(this,{array,itemSize});}};
  THREE.Scene=class{add(mesh){this.mesh=mesh;}};THREE.Camera=class{};
  THREE.Mesh=class{constructor(geometry,material){Object.assign(this,{geometry,material});}removeFromParent(){this.removed=true;}};
  const cache=new Map();
  const setTest=(key,value)=>{if(cache.get(key)!==value){cache.set(key,value);value?enabled.add(key):enabled.delete(key);}};
  const setValue=(key,value)=>{if(cache.get(key)!==value){cache.set(key,value);values.set(key,value);}};
  const setStencil=(index,value)=>{const key=gl[stencilNames[index]];if(cache.get(key)!==value){cache.set(key,value);values.set(key,value);values.set(gl[stencilNames[index].replace('STENCIL_','STENCIL_BACK_')],value);}};
  const stencil={setTest:value=>setTest(gl.STENCIL_TEST,value),setMask:value=>setStencil(3,value),setFunc:(func,ref,mask)=>{setStencil(0,func);setStencil(1,ref);setStencil(2,mask);},setOp:(fail,zFail,zPass)=>{setStencil(4,fail);setStencil(5,zFail);setStencil(6,zPass);},setClear:value=>setValue(gl.STENCIL_CLEAR_VALUE,value)};
  const depthEnums=[gl.NEVER,gl.ALWAYS,gl.LESS,gl.LEQUAL,gl.EQUAL,gl.GEQUAL,gl.GREATER,gl.NOTEQUAL];
  const depth={setTest:value=>setTest(gl.DEPTH_TEST,value),setMask:value=>setValue(gl.DEPTH_WRITEMASK,value),setFunc:value=>setValue(gl.DEPTH_FUNC,depthEnums[value]),getReversed:()=>reverseDepth};
  const state={buffers:{stencil,depth},viewport:value=>values.set(gl.VIEWPORT,value.toArray()),scissor:value=>values.set(gl.SCISSOR_BOX,value.toArray()),setScissorTest:value=>setTest(gl.SCISSOR_TEST,value)};
  let currentTarget=null,currentFace=4,currentMip=2;
  const logicalViewport=new Vector4(1,2,16,12),logicalScissor=new Vector4(2,3,7,5),currentViewport=logicalViewport.clone();
  const scaled=value=>new Vector4(...value.toArray().map(x=>Math.round(x*pixelRatio)));
  const renderer={state,capabilities:{isWebGL2:true},autoClear:true,shadowMap:{enabled:true},getContext:()=>gl,getRenderTarget:()=>currentTarget,getActiveCubeFace:()=>currentFace,getActiveMipmapLevel:()=>currentMip,getPixelRatio:()=>pixelRatio,getViewport:out=>out.copy(logicalViewport),getCurrentViewport:out=>out.copy(currentViewport),getScissor:out=>out.copy(logicalScissor),getScissorTest:()=>true,setViewport:value=>{logicalViewport.copy(value);currentViewport.copy(scaled(value));state.viewport(currentViewport);},setScissor:value=>{logicalScissor.copy(value);state.scissor(scaled(value));},setRenderTarget:(target,face=0,mip=0)=>{currentTarget=target;currentFace=face;currentMip=mip;currentViewport.copy(target?target.viewport:scaled(logicalViewport));state.viewport(currentViewport);state.scissor(target?target.scissor:scaled(logicalScissor));state.setScissorTest(target?target.scissorTest:true);logs.push({kind:'target',target});},clear:(color,depthFlag,stencilFlag)=>{assert.deepEqual([color,depthFlag,stencilFlag],[false,false,true]);stencil.setMask(0xffffffff);const pixels=covered(currentTarget);for(const p of pixels)currentTarget.stencil[p]=values.get(gl.STENCIL_CLEAR_VALUE);logs.push({kind:'clear',target:currentTarget,pixels});if(renderer.throwAt==='clear')throw Error('injected clear failure');},render:scene=>{
    const material=scene.mesh.material,proxy=material.name.includes('proxy diagnostic'),index=proxy?0:Number(/query (\d+):/.exec(material.name)?.[1]);
    depth.setFunc(material.depthFunc);depth.setTest(material.depthTest);depth.setMask(material.depthWrite);
    stencil.setTest(material.stencilWrite);if(material.stencilWrite){stencil.setMask(material.stencilWriteMask);stencil.setFunc(material.stencilFunc,material.stencilRef,material.stencilFuncMask);stencil.setOp(material.stencilFail,material.stencilZFail,material.stencilZPass);}
    const uniforms=Object.fromEntries(Object.entries(material.uniforms).map(([name,value])=>[name,value.value]));
    const trace=uniforms.group_1_binding_0_trace,previous=uniforms.group_1_binding_1_previous;
    const pixels=covered(currentTarget),passed=[];
    const record={kind:proxy?'classify':index===0?'heavy':'group',target:currentTarget,index,material,pixels,passed,previous,depthTest:material.depthTest,depthWrite:material.depthWrite,stencilWrite:material.stencilWrite,stencilRef:material.stencilRef,stencilFunc:material.stencilFunc,stencilWriteMask:material.stencilWriteMask,stencilZPass:material.stencilZPass};logs.push(record);
    if(renderer.throwAt===record.kind)throw Error(`injected ${record.kind} failure`);
    for(const p of pixels){
      const eligible=!enabled.has(gl.STENCIL_TEST)||values.get(gl.STENCIL_FUNC)===gl.ALWAYS||(values.get(gl.STENCIL_FUNC)===gl.EQUAL&&(currentTarget.stencil[p]&values.get(gl.STENCIL_VALUE_MASK))===(values.get(gl.STENCIL_REF)&values.get(gl.STENCIL_VALUE_MASK)));
      if(!eligible||(proxy&&!trace.known[p]))continue;
      passed.push(p);currentTarget.textures[0].pixels[p]=index===0?[trace.samples[p],p,1,0]:[previous.pixels[p][0]+index,p,index+1,0];
      if(enabled.has(gl.STENCIL_TEST)&&values.get(gl.STENCIL_PASS_DEPTH_PASS)===gl.REPLACE){const mask=values.get(gl.STENCIL_WRITEMASK);currentTarget.stencil[p]=(currentTarget.stencil[p]&~mask)|(values.get(gl.STENCIL_REF)&mask);}
    }
    // Three r170 restores depth test/write after each render, so tests must not
    // incorrectly assume draw-material state persists to the outer finally.
    depth.setTest(true);depth.setMask(true);
  }};
  function covered(target){const [x,y,w,h]=enabled.has(gl.SCISSOR_TEST)?values.get(gl.SCISSOR_BOX):[0,0,target.width,target.height];const result=[];for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)result.push(py*target.width+px);return result;}
  renderer.setRenderTarget(null,4,2);logs.length=0;
  if(missing){const [owner,key]=missing.split('.');delete (owner==='stencil'?stencil:owner==='depth'?depth:owner==='state'?state:renderer)[key];}
  const manifest={sourceSHA256:sceneSHA,groups:GEOMETRY_GROUP_NAMES.map((name,index)=>({name,index,outputs:4}))};
  const runtime={sourceSHA256:sceneSHA,outputs:Object.fromEntries(GEOMETRY_GROUP_NAMES.map((_,index)=>[`runtime-${index}`,{entry:'stationCompactQuery',sha256:index===0?compactSHA:`source-${index}`}]))};
  const fetch=async url=>{const path=new URL(url).pathname;fetches.push(path);let data;
    if(path.endsWith('/geometry-group-manifest.json'))data=manifest;
    else if(path.endsWith('/compact-trace-r01/generated/manifest.json'))data=runtime;
    else if(path.endsWith('/terminal-proxy-r01/generated/manifest.json'))data={sourceSHA256:sceneSHA,proxySourceSHA256:COMPACT,outputs:{proxy:{entry:proxyEntry,sha256:'proxy-sha'}}};
    else if(path.endsWith('/proxy.frag'))data=shader('proxy');
    else if(/\/runtime-\d+\.frag$/.test(path))data=shader(Number(/runtime-(\d+)/.exec(path)[1]));
    else throw Error(`Unexpected fetch ${path}`);
    return {ok:true,text:async()=>data,json:async()=>structuredClone(data)};
  };
  const frame={viewport:new Vector4(8,6,0,0)};
  const texture={isTexture:true,samples:Array.from({length:48},(_,i)=>i+.125),known:Array.from({length:48},(_,i)=>i%3!==0)};
  const args={width:8,height:6,traceTexture:texture};
  const snapshot=()=>({values:Array.from(values,([key,value])=>[key,Array.isArray(value)?value.slice():value]).filter(([key])=>key!==gl.MAX_DRAW_BUFFERS&&key!==gl.MAX_COLOR_ATTACHMENTS&&key!==gl.MAX_TEXTURE_SIZE),enabled:[...enabled].sort((a,b)=>a-b),target:currentTarget,face:currentFace,mip:currentMip,viewport:logicalViewport.toArray(),currentViewport:currentViewport.toArray(),scissor:logicalScissor.toArray(),autoClear:renderer.autoClear,shadow:renderer.shadowMap.enabled});
  async function create(options={}){const old=globalThis.fetch;globalThis.fetch=fetch;try{return await createGroupQueryReceiver({renderer,THREE,u:{},frame,compactTrace:true,...options});}finally{globalThis.fetch=old;}}
  return {create,renderer,THREE,gl,values,enabled,logs,materials,targets,fetches,args,texture,snapshot,frame};
}

const copyOutput=result=>result.a.pixels.map(value=>value.slice());
const materialState=material=>Object.fromEntries(Object.keys(material).filter(key=>key.startsWith('stencil')||key.startsWith('depth')).map(key=>[key,material[key]]));

test('default mode dispatches original cached materials, exact shader bodies, manifest order and A/B parity',async()=>{
  const h=harness(),receiver=await h.create(),result=receiver.query(h.args),draws=h.logs.filter(x=>['heavy','group'].includes(x.kind));
  assert.equal(receiver.proxyProof.enabled,false);assert.equal(h.targets.length,2);assert.equal(draws.length,GEOMETRY_GROUP_NAMES.length);
  assert.deepEqual(draws.map(x=>x.index),GEOMETRY_GROUP_NAMES.map((_,i)=>i));
  for(const [i,draw] of draws.entries()){assert.equal(draw.material.fragmentShader,threeFragment(shader(i)).text);assert.equal(draw.material,h.materials[i]);assert.equal(draw.target,h.targets[i%2]);if(i)assert.equal(draw.previous,h.targets[(i-1)%2].textures[0]);}
  assert.equal(result.a,h.targets[(GEOMETRY_GROUP_NAMES.length-1)%2].textures[0]);
  assert.deepEqual(h.logs.filter(x=>['clear','classify'].includes(x.kind)),[]);
  assert.throws(()=>receiver.setDiagnosticTerminalProxy(1),/boolean/);receiver.dispose();
});

test('S is independent; clear, classify, original heavy and restore stay inside one g0 observer interval',async()=>{
  const h=harness(),events=[],receiver=await h.create({terminalProxy:true,passObserver:event=>{events.push(event);h.logs.push({kind:event.stage,index:event.index});},diagnosticProxyObserver:event=>h.logs.push({kind:event.stage,target:event.target})});
  const baselineHarness=harness(),baselineReceiver=await baselineHarness.create();baselineReceiver.query(baselineHarness.args);const state=baselineHarness.snapshot();baselineReceiver.dispose();
  const savedMaterials=h.materials.map(materialState),result=receiver.query(h.args),s=receiver.diagnosticTerminalTarget();
  assert.equal(h.targets.length,3);assert.equal(s,h.targets[2]);assert.equal(s.depthBuffer,true);assert.equal(s.stencilBuffer,true);assert.equal(s.count,1);assert.equal(s.type,h.THREE.FloatType);assert.equal(s.samples,0);
  assert.deepEqual(h.snapshot(),state);assert.deepEqual(h.materials.map(materialState),savedMaterials);
  const g0=h.logs.slice(h.logs.findIndex(x=>x.kind==='begin'&&x.index===0),h.logs.findIndex(x=>x.kind==='end'&&x.index===0)+1);
  assert.deepEqual(g0.filter(x=>['begin','clear','classify','heavy-begin','heavy','heavy-end','end'].includes(x.kind)).map(x=>x.kind),['begin','clear','classify','heavy-begin','heavy','heavy-end','end']);
  assert.equal(g0.filter(x=>x.kind==='target').at(-1).target,null,'old render target restored before g0 timing ends');
  const draws=h.logs.filter(x=>['classify','heavy','group'].includes(x.kind));
  assert.equal(draws[0].target,s);assert.equal(draws[1].target,s);assert.equal(draws[1].material,h.materials[0]);
  assert.deepEqual([draws[0].stencilFunc,draws[0].stencilRef,draws[0].stencilZPass],[h.THREE.AlwaysStencilFunc,1,h.THREE.ReplaceStencilOp]);
  assert.deepEqual([draws[1].stencilFunc,draws[1].stencilRef,draws[1].stencilWriteMask,draws[1].stencilZPass],[h.THREE.EqualStencilFunc,0,0,h.THREE.KeepStencilOp]);
  assert.ok(draws.slice(0,2).every(x=>x.depthTest===false&&x.depthWrite===false));
  assert.equal(draws[2].previous,s.textures[0]);assert.equal(draws[2].target,h.targets[1]);
  for(const draw of draws.slice(3)){assert.equal(draw.target,h.targets[draw.index%2]);assert.equal(draw.previous,h.targets[(draw.index-1)%2].textures[0]);}
  assert.equal(result.a,h.targets[(GEOMETRY_GROUP_NAMES.length-1)%2].textures[0]);
  assert.deepEqual(draws[0].passed,h.texture.known.flatMap((known,i)=>known?[i]:[]));
  assert.deepEqual(draws[1].passed,h.texture.known.flatMap((known,i)=>known?[]:[i]));
  assert.equal(receiver.proxyProof.clear,1);assert.equal(receiver.proxyProof.classify,1);assert.equal(receiver.proxyProof.heavy,1);assert.equal(receiver.proxyProof.fallback,0);assert.ok(Object.isFrozen(receiver.proxyProof));
  assert.equal(events.length,GEOMETRY_GROUP_NAMES.length*2);receiver.dispose();
});

test('g0 restores non-default target, active face/mip, logical and physical raster overrides before observer end',async()=>{
  const h=harness({pixelRatio:1.5});
  const host=new h.THREE.WebGLRenderTarget(16,12,{count:1,depthBuffer:true,stencilBuffer:true});host.viewport.set(0,0,16,12);host.scissor.set(3,4,5,6);host.scissorTest=true;
  h.renderer.setRenderTarget(host,2,1);h.renderer.setViewport(new Vector4(2,4,6,8));h.renderer.setScissor(new Vector4(1,2,3,4));h.renderer.state.setScissorTest(false);
  let before,after;const receiver=await h.create({terminalProxy:true,passObserver:event=>{if(event.index===0){if(event.stage==='begin')before=h.snapshot();else after=h.snapshot();}}});
  receiver.query(h.args);assert.deepEqual(after,before);assert.equal(h.renderer.getRenderTarget(),host);assert.equal(h.renderer.getActiveCubeFace(),2);assert.equal(h.renderer.getActiveMipmapLevel(),1);receiver.dispose();
});

test('baseline/candidate toggles reuse exact original objects and output parity for full, sparse, overlapping and empty rectangles',async()=>{
  for(const rects of [null,[{x:1,y:1,w:3,h:2},{x:6,y:4,w:2,h:1}],[{x:0,y:0,w:4,h:4},{x:2,y:2,w:4,h:3}],[]]){
    const h=harness(),receiver=await h.create(),args={...h.args,rects},baseline=copyOutput(receiver.query(args)),originalObjects=h.materials.slice(0,GEOMETRY_GROUP_NAMES.length),a=h.targets[0],b=h.targets[1];
    h.logs.length=0;receiver.setDiagnosticTerminalProxy(true);const candidate=copyOutput(receiver.query(args));assert.deepEqual(candidate,baseline);
    const clear=h.logs.filter(x=>x.kind==='clear'),fast=h.logs.filter(x=>x.kind==='classify'),heavy=h.logs.filter(x=>x.kind==='heavy');
    assert.equal(clear.length,rects?.length??1);assert.equal(fast.length,clear.length);assert.equal(heavy.length,clear.length);assert.deepEqual(clear.map(x=>x.pixels),fast.map(x=>x.pixels));assert.deepEqual(clear.map(x=>x.pixels),heavy.map(x=>x.pixels));
    if(clear.length)assert.ok(h.logs.indexOf(clear.at(-1))<h.logs.indexOf(fast[0]),'all requested stencil clears precede classification');
    const s=receiver.diagnosticTerminalTarget(),covered=new Set(clear.flatMap(x=>x.pixels));for(let p=0;p<48;p++)if(!covered.has(p))assert.equal(s.stencil[p],9,'stencil outside requested rectangles untouched');
    receiver.setDiagnosticTerminalProxy(false);h.logs.length=0;assert.deepEqual(copyOutput(receiver.query(args)),baseline);assert.equal(h.targets[0],a);assert.equal(h.targets[1],b);assert.deepEqual(h.materials.slice(0,GEOMETRY_GROUP_NAMES.length),originalObjects);assert.equal(h.materials.length,GEOMETRY_GROUP_NAMES.length+1);assert.equal(h.logs.filter(x=>x.kind==='classify').length,0);receiver.dispose();
  }
});

test('all-known and all-unresolved CPU masks route original heavy coverage exactly',async()=>{
  for(const known of [true,false]){const h=harness();h.texture.known.fill(known);const receiver=await h.create({terminalProxy:true});receiver.query(h.args);const fast=h.logs.find(x=>x.kind==='classify'),heavy=h.logs.find(x=>x.kind==='heavy');assert.equal(fast.passed.length,known?48:0);assert.equal(heavy.passed.length,known?0:48);receiver.dispose();}
});

test('asymmetric or missing state support falls back to original A before clears or heavy QA callbacks',async()=>{
  for(const options of [{asymmetric:true},{missing:'stencil.setOp'},{missing:'depth.setFunc'},{missing:'state.scissor'},{missing:'renderer.getCurrentViewport'}]){
    const h=harness(options),receiver=await h.create({terminalProxy:true,diagnosticProxyObserver:()=>assert.fail('fallback must not run proxy observer')});
    // Removing a state method prevents the mock's original render too. Keep the
    // ordinary renderer implementation functional via its local buffer closures.
    if(options.missing==='depth.setFunc')h.renderer.render=scene=>{h.logs.push({kind:'ordinary-fallback',target:h.renderer.getRenderTarget(),material:scene.mesh.material});};
    if(options.missing==='stencil.setOp')h.renderer.render=scene=>{h.logs.push({kind:'ordinary-fallback',target:h.renderer.getRenderTarget(),material:scene.mesh.material});};
    if(options.missing==='state.scissor')h.renderer.setRenderTarget=(target)=>{h.logs.push({kind:'target',target});};
    if(options.missing==='state.scissor')h.renderer.render=()=>{};
    receiver.query(h.args);assert.equal(receiver.proxyProof.fallback,1);assert.match(receiver.proxyProof.lastFallback,/asymmetric|missing/);assert.equal(receiver.proxyProof.lastMode,'original-fallback');assert.equal(h.targets.length,2);assert.equal(h.logs.filter(x=>['clear','classify','heavy-begin','heavy-end'].includes(x.kind)).length,0);receiver.dispose();
  }
});

test('missing S stencil, incomplete S, or reverse depth uses original A without clear, classification or heavy callbacks',async()=>{
  for(const options of [{stencilBits:0},{complete:false},{reverseDepth:true}]){
    const h=harness(options),receiver=await h.create({terminalProxy:true,diagnosticProxyObserver:()=>assert.fail('unsupported target must not run observer')});receiver.query(h.args);
    assert.equal(receiver.proxyProof.fallback,1);assert.match(receiver.proxyProof.lastFallback,/stencil|incomplete|reverse-depth/);assert.equal(h.logs.filter(x=>['clear','classify'].includes(x.kind)).length,0);assert.equal(h.logs.find(x=>x.kind==='heavy').target,h.targets[0]);receiver.dispose();
  }
});

test('throwing clear, light or heavy restores g0 state; later throws retain original behavior and reentrancy',async()=>{
  for(const stage of ['clear','classify','heavy','group']){
    const h=harness(),receiver=await h.create({terminalProxy:true}),before=h.snapshot(),materials=h.materials.map(materialState);h.renderer.throwAt=stage;
    assert.throws(()=>receiver.query(h.args),new RegExp(`injected ${stage} failure`));if(stage!=='group')assert.deepEqual(h.snapshot(),before);else{const base=harness(),control=await base.create();base.renderer.throwAt='group';assert.throws(()=>control.query(base.args),/injected group/);assert.deepEqual(h.snapshot(),base.snapshot());control.dispose();}assert.deepEqual(h.materials.map(materialState),materials);assert.equal(receiver.proof.status,'failed');
    delete h.renderer.throwAt;receiver.query(h.args);assert.equal(receiver.proof.status,'dispatched-unvalidated');receiver.dispose();assert.ok(h.targets.every(target=>target.disposed));assert.ok(h.materials.every(material=>material.disposed));
  }
});

test('S and every retired texture remain forbidden as query inputs; resize replaces all targets safely',async()=>{
  const h=harness(),receiver=await h.create({terminalProxy:true});receiver.query(h.args);const s=receiver.diagnosticTerminalTarget(),oldTargets=h.targets.slice();
  assert.throws(()=>receiver.query({...h.args,traceTexture:s.textures[0]}),/aliases/);
  h.frame.viewport.set(4,3,0,0);receiver.query({...h.args,width:4,height:3});assert.ok(oldTargets.every(target=>target.disposed));
  assert.throws(()=>receiver.query({...h.args,width:4,height:3,fullHitTexture:s.textures[0]}),/aliases/);receiver.dispose();assert.throws(()=>receiver.setDiagnosticTerminalProxy(false),/disposed/);
});

test('source locks and opt-in validation reject drift before any draw',async()=>{
  for(const options of [{sceneSHA:'different'},{compactSHA:'different'},{proxyEntry:'wrong'}]){const h=harness(options);await assert.rejects(h.create(),/identity/);assert.equal(h.logs.length,0);}
  const h=harness();await assert.rejects(h.create({terminalProxy:'yes'}),/explicit/);await assert.rejects(h.create({terminalProxy:true,compactTrace:false}),/compact/);await assert.rejects(h.create({diagnosticProxyObserver:true}),/observer/);
});

test('static guards preserve original reflection, 12-group loop and shader code; runtime contains no GPU readback/query/reset',()=>{
  const reflection=text=>text.slice(text.indexOf('    for (let index = 0; index < reflected.length; index++)'),text.indexOf('    if(terminalReflected)')>0?text.indexOf('    if(terminalReflected)'):text.indexOf('  } catch (error)'));
  assert.equal(reflection(source).trim(),reflection(original).trim());
  const originalShed=original.slice(original.indexOf('  function shedPlan('),original.indexOf('  let targets ='));
  assert.ok(source.includes(originalShed));
  assert.ok(source.includes('for (let index = 0; index < materials.length; index++)'));
  assert.ok(source.includes('output = targets[index % 2];'));
  assert.equal(GEOMETRY_GROUP_NAMES.length,12);
  assert.doesNotMatch(source,/\b(?:readPixels|readRenderTargetPixels|fenceSync|finish|flush|beginQuery|endQuery|getQueryParameter|resetState)\s*\(/);
  assert.doesNotMatch(source,/\.needsUpdate\s*=/);
  assert.match(source,/terminalProxy = false/);assert.match(source,/source identity changed/);
});
