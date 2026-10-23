/** QA ONLY. Copy next to site index.html in disposable staging, never ship.
 * Call before the renderer's first render. It uses the unchanged compiled
 * aperture shader and full 77-part textures in a 1x1 offscreen Float32 target.
 * It never presents a reduced-resolution product image. */
import {intersectAperturesRay,packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {prepareTileFrame} from './kowloon-building-mother-r01/whole-building-ground-r01/tile-visibility.mjs';
import {buildPrimaryApertureIndex,readPrimaryApertureList} from './kowloon-building-mother-r01/whole-building-floor-study-r01/primary-aperture-index.mjs';

export function apertureProbeRay(apertures,objectId=3004026){
 const part=apertures.flatMap(a=>a.primitives).find(p=>p.objectId===objectId);
 if(!part||part.part!=='leaf')throw Error('Expected original warehouse personnel-door leaf absent');
 const target=part.origin.map((v,k)=>v+part.u[k]*part.outer.center[0]+part.v[k]*part.outer.center[1]);
 // Axis-aligned top-entry avoids thin-leaf cap cancellation at world x about101.
 const eye=target.map((v,k)=>v+part.v[k]*(part.outer.half[1]+.3)),direction=target.map((v,k)=>v-eye[k]);
 const expected=intersectAperturesRay(apertures,eye,direction);
 if(!expected.hit||expected.objectId!==objectId)throw Error('CPU probe ray does not actually hit expected aperture '+JSON.stringify(expected));
 return {eye,target,direction,fov:.02,objectId,expected};
}
export async function runApertureColdProbe(renderer){
 const r=renderer,g=r.gl;
 if(r.busy||r.stats.frames!==0)throw Error('Probe requires fresh initialized renderer before first frame');
 r.updateHostedVisibility(null);
 const ray=apertureProbeRay(r.apertures),packed=packApertureDescriptors(r.apertures);
 if(packed.primitiveCount!==77)throw Error('Probe requires full frozen R07 77-part texture');
 const width=1,height=1,token=123,frame=prepareTileFrame({...ray,width,height});
 const primary=buildPrimaryApertureIndex({bounds:r.primaryApertureBounds,frame,width,height,tileSize:1,token});
 if(!primary)throw Error('Probe primary index invalid');
 const list=readPrimaryApertureList(primary,1,packed.primitiveCount);
 if(!list?.includes(76))throw Error('Probe primary list lacks expected packed part76');
 const report={kind:'qa-only-one-pixel-aperture-cold-probe',scope:'Diagnostic only, not product framebuffer or native performance acceptance',partCount:packed.primitiveCount,descriptorDimensions:[packed.width,packed.height],descriptorRecords:packed.records,neighborToken:r.apertureNeighborToken,neighborRecords:r.apertureNeighbors?.records,ray,primaryCandidates:list,shaderCompile:r.compileStats.map(x=>({...x})),draws:[],passed:false};
 const p=r.apertureProgram,primaryTexture=r.texture(primary),o={...r.options,...ray};
 r.targets(width,height);g.viewport(0,0,width,height);g.bindVertexArray(r.vao);g.disable(g.SCISSOR_TEST);
 for(let attempt=0;attempt<2;attempt++){
  const wallStart=performance.now(),draw={attempt:attempt+1,phase:attempt?'warm-single-pixel':'cold-single-pixel',startedMs:wallStart};report.draws.push(draw);
  try{
   g.bindFramebuffer(g.FRAMEBUFFER,r.buffers[0].fbo);g.useProgram(p);const L=r.camera(p,width,height,o);
   g.uniform1i(L('uRayMode'),0);g.uniform1i(L('uFirst'),1);g.uniform1i(L('uClip'),0);g.uniform1i(L('uSlice'),0);
   g.uniform3fv(L('uClipNormal'),[0,0,1]);g.uniform1f(L('uClipOffset'),0);g.uniform2fv(L('uSliceY'),[-1e10,1e10]);
   for(let unit=1;unit<=5;unit++){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,null);}
   // Set inactive ray/previous samplers to distinct valid units, as full renderer does.
   for(const [name,unit]of [['uPreviousHit',1],['uPreviousNormal',2],['uPreviousLocal',3],['uRayOrigin',4],['uRayDirection',5]])g.uniform1i(L(name),unit);
   r.bindTexture(p,'uApertureDescriptors',0,r.apertureTexture);
   r.bindTexture(p,'uPrimaryApertureIndex',6,primaryTexture);g.uniform1i(L('uPrimaryApertureIndexEnabled'),1);g.uniform1i(L('uPrimaryApertureIndexToken'),token);g.uniform1i(L('uPrimaryApertureIndexRow'),1);
   r.bindTexture(p,'uApertureNeighbors',7,r.apertureNeighborTexture);g.uniform1i(L('uApertureNeighborIndexEnabled'),1);g.uniform1i(L('uApertureNeighborAabbFirst'),1);g.uniform1i(L('uApertureNeighborToken'),r.apertureNeighborToken);
   g.drawArrays(g.TRIANGLES,0,3);draw.submitWallMs=performance.now()-wallStart;draw.glErrorAfterSubmit=g.getError();
   const stats={tilesSubmitted:1,fenceCount:0,fenceWallMs:0,fencePolls:0,pollSleepCount:0,pollSleepWallMs:0};draw.stats=stats;
   await r.complete(true,stats);
   draw.totalWallMs=performance.now()-wallStart;draw.fields=[];
   for(let attachment=0;attachment<3;attachment++){g.readBuffer(g.COLOR_ATTACHMENT0+attachment);const a=new Float32Array(4);g.readPixels(0,0,1,1,g.RGBA,g.FLOAT,a);draw.fields.push(Array.from(a));}
   draw.glErrorAfterRead=g.getError();draw.hitId=draw.fields[0][1];draw.validHit=draw.fields[0][3]===1&&draw.hitId===ray.objectId&&Number.isFinite(draw.fields[0][0]);
   if(!draw.validHit||draw.glErrorAfterSubmit!==g.NO_ERROR||draw.glErrorAfterRead!==g.NO_ERROR)throw Error('GPU probe did not return expected real aperture hit');
  }catch(error){draw.totalWallMs=performance.now()-wallStart;draw.error=String(error);draw.lifecycle=r.lifecycle.snapshot();report.error=draw.error;return report;}
 }
 report.passed=report.draws.every(d=>d.validHit)&&JSON.stringify(report.draws[0].fields)===JSON.stringify(report.draws[1].fields);return report;
}
