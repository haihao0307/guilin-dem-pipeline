import assert from 'node:assert/strict';
import {growSketch} from './sketch-model.mjs';
import {intersectAssemblyRay} from './kowloon-building-mother-r01/r07/assemblies.mjs';
import {deriveGhostInspectionDisplay,renderGhost,restoreOpaque,isGhostInspectionPrimitive} from './ghost-inspection.mjs';

let checks=0;
const ok=(condition,message)=>{assert(condition,message);checks++;};
for(const caseId of ['cell','vertical','connected'])for(let stage=1;stage<=7;stage++){
  const {model,source}=growSketch({caseId,stage}),before=JSON.stringify(model),display=deriveGhostInspectionDisplay(model);
  ok(JSON.stringify(model)===before,'Display derivation leaves authoritative data unchanged');
  ok(source.patches.length===0,'Empty source sketch supported');
  const all=model.archetypes.flatMap(a=>a.primitives),kept=display.archetypes.flatMap(a=>a.spec.primitives);
  ok(kept.every(p=>all.includes(p)),'Retained display uses identical original primitives');
  ok(all.length===display.ghostIds.length+kept.length,'Every primitive accounted for once');
  ok(all.filter(p=>['column','beam','stair','floor','door'].includes(p.semanticClass)).every(p=>kept.includes(p)),'Interior structure, stairs, floors and doors stay opaque');
  ok(all.filter(p=>/:wall:(room-entry|room-A-entry|room-B-entry|rooms-divider)$/.test(p.nodeId)).every(p=>kept.includes(p)),'Interior room walls stay opaque');
  ok(all.filter(p=>/:cabin:floor$|:door-host:leaf:/.test(p.nodeId)).every(p=>kept.includes(p)),'Cabin floor and actual lift leaves stay opaque');
  ok(display.archetypes.every(a=>a.spec.primitives.length>0),'No invalid empty descriptor batches');
}
const sketch=growSketch({caseId:'connected',stage:7}),model=sketch.model,source=sketch.source;
const originalJSON=JSON.stringify(model),display=deriveGhostInspectionDisplay(model);
const firstHit=archetypes=>archetypes.map(a=>intersectAssemblyRay(a.spec??a,[3.2,sketch.roofElevation+5,2.8],[0,-1,0])).filter(h=>h.hit).sort((a,b)=>a.t-b.t)[0];
const fullHit=firstHit(model.archetypes),insideHit=firstHit(display.archetypes);
const primitiveFor=objectId=>model.archetypes.flatMap(a=>a.primitives).find(p=>p.objectId===objectId);
ok(primitiveFor(fullHit.objectId).semanticClass==='roof','Original downward ray first meets roof');
ok(insideHit&&insideHit.objectId!==fullHit.objectId&&insideHit.t>fullHit.t,'Display ray reveals a real interior hit, not merely recoloring the opaque roof');
ok(firstHit(model.archetypes).objectId===fullHit.objectId,'Authoritative physical ray still meets unchanged roof');
ok(isGhostInspectionPrimitive({nodeId:'custom',semanticClass:'column'},{inspectionDisplay:'ghost'}),'Explicit display tag can select a component');
ok(!isGhostInspectionPrimitive({nodeId:'roof',semanticClass:'roof'},null,{opaqueNodeIds:['roof']}),'Explicit opaque override wins');
ok(deriveGhostInspectionDisplay(model,{ghostWalls:false,ghostRoof:false,ghostLiftShell:false}).ghostIds.length===0,'All display ghost classes can be disabled');

function mockRenderer(){
  let textureId=0;
  const calls=[],draws=[];
  const gl={NO_ERROR:0,TEXTURE_2D:1,RGBA16F:2,RGBA:3,HALF_FLOAT:4,TEXTURE_MIN_FILTER:5,TEXTURE_MAG_FILTER:6,NEAREST:7,TEXTURE_WRAP_S:8,TEXTURE_WRAP_T:9,CLAMP_TO_EDGE:10,FRAMEBUFFER:11,COLOR_ATTACHMENT0:12,SCISSOR_TEST:13,BLEND:14,TRIANGLES:15,
    createTexture:()=>({id:++textureId}),deleteTexture:()=>{},bindTexture:()=>{},texImage2D:()=>{},texParameteri:()=>{},bindFramebuffer:()=>{},readBuffer:()=>{},copyTexSubImage2D:()=>{},disable:()=>{},bindVertexArray:()=>{},viewport:()=>{},useProgram:()=>{},uniform1f:()=>{},drawArrays:()=>draws.push('composite'),getError:()=>0};
  const renderer={gl,model,measured:source,modelGeneration:1,requestRevision:7,busy:false,hitDataComplete:true,
    canvas:{width:320,height:240},displayLimits:{bytesPerPixel:112,framebufferBudgetBytes:768*1024*1024,reserveBytes:64*1024*1024},textures:[],stats:{frames:0},options:{selectedId:-1},vao:{},colorTarget:{fbo:{},texture:{id:'color'}},calls,draws,
    texture(){const t=gl.createTexture();this.textures.push(t);return t;},compile:()=>({}),bindTexture:()=>{},uniform:()=>({}),
    setModel(m,s){this.model=m;this.measured=s;this.modelGeneration++;this.textures=[];},
    async render(options){calls.push(options);this.stats.frames++;if(this.cancelScene===calls.length)this.requestRevision++;return{cancelled:options.requestRevision!==undefined&&options.requestRevision!==this.requestRevision,passes:5,wallMs:1,presentationPasses:options.skipPresent?0:1};},
    async complete(){if(this.cancelComposite)this.requestRevision++;},
  };
  return renderer;
}
const opts={width:320,height:240,presentWidth:320,presentHeight:240,source:false,design:true,requestRevision:7};
const renderer=mockRenderer(),stats=await renderGhost(renderer,model,source,opts,{opacity:.25});
ok(stats.ghostInspection&&!stats.cancelled&&stats.scenePasses===2&&stats.compositePasses===1,'Exactly two scenes and one composite');
ok(renderer.calls.length===2&&renderer.calls.every(c=>c.skipPresent),'No intermediate pass presents to the canvas');
ok(renderer.calls[0].displayArchetypes===null&&renderer.calls[1].displayArchetypes.length>0,'Full scene then filtered interior, same renderer/model');
ok(renderer.model===model&&JSON.stringify(model)===originalJSON,'Full original model and graph survive renderGhost');
ok(stats.picking==='interior-first-hit'&&renderer.draws.length===1,'Picking explicitly comes from the last interior trace');
const textureCount=renderer.textures.length;
await renderGhost(renderer,model,source,opts,{opacity:.5});
ok(renderer.textures.length===textureCount,'Repeated frame/opacity change reuses bounded display textures');
const restored=await restoreOpaque(renderer,model,source,opts);
ok(!restored.ghostInspection&&renderer.calls.at(-1).displayArchetypes===null&&!renderer.calls.at(-1).skipPresent,'Opaque restoration uses the original render/presentation path');
for(const scene of[1,2]){
  const cancelled=mockRenderer();cancelled.cancelScene=scene;
  const result=await renderGhost(cancelled,model,source,opts);
  ok(result.cancelled&&cancelled.draws.length===0,'Cancelled scene never presents a stale composite');
  ok(cancelled.model===model&&!cancelled.busy,'Cancellation preserves the full model and releases busy state');
}
const cancelled=mockRenderer();cancelled.cancelComposite=true;
const result=await renderGhost(cancelled,model,source,opts);
ok(result.cancelled&&!cancelled.hitDataComplete,'Revision changed during final fence invalidates stale picking');
await assert.rejects(()=>renderGhost(mockRenderer(),model,source,opts,{opacity:2}),/opacity/);checks++;
ok(JSON.stringify(model)===originalJSON,'Every mock render/restore/cancel path leaves model JSON unchanged');
console.log(JSON.stringify({passed:true,checks,modelDataUnchanged:true,actualInteriorRayRevealed:true,maxScenePasses:2,intermediatePresentation:false,pixelQA:'pending_real_WebGL_browser_check',physicalRefraction:false},null,2));
