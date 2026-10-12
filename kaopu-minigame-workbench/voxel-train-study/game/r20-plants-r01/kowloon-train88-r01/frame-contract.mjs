// Prevent stale screen-space intersections from being treated as world geometry.
// This is the CPU contract for the staged receiver, not a renderer itself.
const copy=x=>JSON.parse(JSON.stringify(x));
export function frameKey({projection,cameraToWorld,state,resolution,sourceSHA256}){
 if(!projection?.every(Number.isFinite)||projection.length!==16||!cameraToWorld?.every(Number.isFinite)||cameraToWorld.length!==16)throw Error('Invalid camera');
 if(!resolution?.every(Number.isInteger)||resolution.length!==2||resolution.some(x=>x<=0))throw Error('Invalid framebuffer');
 if(!sourceSHA256||!Number.isFinite(state?.tick)||!Number.isFinite(state?.distanceM))throw Error('Unbound scene state');
 return JSON.stringify([sourceSHA256,resolution,projection,cameraToWorld,state]);
}
export function createFrameContract(){let generation=0,inflight=null,ready=null,lost=false,disposed=false;const proof={submitted:0,accepted:0,stale:0,invalidated:0,contextLosses:0,stationSurfaceMeshes:0,appearanceTextures:0};
 return{
  begin(frame){if(disposed||lost)throw Error('Receiver unavailable');const token={generation,key:frameKey(frame),frame:copy(frame)};inflight=token;proof.submitted++;return token;},
  finish(token,receipt){if(disposed||lost||token!==inflight||token.generation!==generation){proof.stale++;return false;}if(!receipt?.geometryComplete||receipt.unresolved||receipt.overflow||!Number.isFinite(receipt.gpuMs)||receipt.gpuMs<0)throw Error('Incomplete/unresolved function frame');ready={key:token.key,frame:token.frame,receipt:copy(receipt)};inflight=null;proof.accepted++;return true;},
  readyFor(frame){return !disposed&&!lost&&ready?.key===frameKey(frame);},
  invalidate(reason){generation++;ready=null;inflight=null;proof.invalidated++;proof.reason=String(reason);},
  lose(){lost=true;generation++;ready=null;inflight=null;proof.contextLosses++;},
  restore(){if(disposed)throw Error('Disposed receiver');lost=false;generation++;ready=null;inflight=null;},
  dispose(){disposed=true;generation++;inflight=null;ready=null;},
  snapshot(){return{...proof,generation,inflight:!!inflight,ready:!!ready,lost,disposed};}
 };
}
