import {loadNativeActorResources,createNativeActor} from './NativeActor.mjs';
/** Minimal integration only. Caller owns the existing Scene, one renderer and
 * worldSeconds. Call update once per host tick; do not add another rAF. */
export async function attachOriginalRescueActors({THREE,worldRoot,actorSnapshots,sampleSupport,onProgress,signal}={}) {
  if(!worldRoot?.isObject3D)throw Error('Existing worldRoot required');
  const resources=await loadNativeActorResources({signal,onProgress}),actors=new Map();
  try{
    for(const snapshot of actorSnapshots){const actor=await createNativeActor({THREE,resources,id:snapshot.id,sampleSupport,color:snapshot.id==='crew'?0x328eab:0x927550});worldRoot.add(actor.group);actors.set(snapshot.id,actor);}
  }catch(error){for(const actor of actors.values())actor.dispose();throw error;}
  return {actors,update({worldSeconds,actors:snapshots}){const reports=[];for(const snapshot of snapshots){const actor=actors.get(snapshot.id);if(!actor)throw Error('Unknown rescue actor '+snapshot.id);reports.push(actor.applyFrame({worldSeconds,actor:snapshot}));}return reports;},dispose(){for(const actor of actors.values())actor.dispose();actors.clear();}};
}
