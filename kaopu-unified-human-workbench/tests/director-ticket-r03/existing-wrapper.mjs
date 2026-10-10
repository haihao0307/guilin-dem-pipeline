// Minimal call sequence for an already-loaded original workbench.
// This example creates no person, rig, renderer, camera or animation loop.
// Import paths below are those in the bounded delivery package.
import {createNativeActorHostBinding,createNativePalmSurfaceProvider} from './hand-anchor-r02.mjs';

export async function bindExistingWorkbenchHand({api=window.fullCommonWorkbench,parent,calibrationRecord,side='R'}={}) {
  if (!api?.motion || !parent?.isObject3D) throw Error('Existing workbench API and the same world Scene/Group are required');
  const motion=api.motion();
  motion.setPlaying(false);
  await motion.setMode('hand'); // Uses the existing original AnimatedHuman route.
  motion.setPlaying(false);
  motion.hand.pause();
  const actor=motion.actors[0],human=actor.human,originalParent=actor.group.parent;
  const archive=motion.controller.model.archive();
  const bytes=new TextEncoder().encode(JSON.stringify({positions:Array.from(human.positions),rest:human.rig.restMatrices.map(m=>Array.from(m)),state:human.state}));
  const shapeFingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const identity={topologySha256:archive.topologySha256,adapterFingerprint:archive.adapterFingerprint,shapeFingerprint};
  const calibration=calibrationRecord.calibrations.find(c=>c.side===side);
  if (calibration?.shapeFingerprint!==shapeFingerprint) throw Error('This actor shape needs its own measured palm calibration; do not reuse the default offset');
  const readIdentity=()=>{
    if(motion.actors[0]!==actor||actor.human!==human) throw Error('Actor changed; close this take and calibrate the current shape');
    return identity;
  };
  const binding=createNativeActorHostBinding({actor,readIdentity,
    isAutonomouslyPlaying:()=>motion.playing||motion.hand.playing,
    evaluateFrame:elapsed=>motion.hand.rig.evaluate(elapsed,{task:'open',duration:6,side})});
  const palm=createNativePalmSurfaceProvider({readNativeFrame:()=>binding.readFrame(),
    readNativeVertex:vertex=>human.sampleVertex(vertex),
    readNativeToWorld:()=>Array.from(human.mesh.matrixWorld.clone().transpose().elements),
    side,expectedTopology:identity.topologySha256,expectedFingerprint:identity.adapterFingerprint,
    expectedShapeFingerprint:shapeFingerprint,calibration});
  parent.add(actor.group); // Existing local metre placement is preserved.
  // Change actor.group.position/yaw only through the world's metre placement.
  // Keep group and ancestor scale at1. mesh already converts native Z to world Y.
  return {
    actor,group:actor.group,shapeFingerprint,
    update(host) {
      binding.update(host); // Same authoritative host.elapsed; updates actual skin first.
      return palm(host); // Row-major world matrix; its origin is the real skin triangle.
    },
    restoreParent(){originalParent.add(actor.group);}
  };
}

// Usage inside the director's existing render loop, after its native model loads:
// const hand=await bindExistingWorkbenchHand({api:fullCommonWorkbench,
//   parent:existingWorldScene,calibrationRecord:measuredPalmCalibration});
// const anchor=hand.update({elapsed:sessionView.elapsed});
// existingRenderer.render(existingWorldScene,existingCamera);
// For Three: new THREE.Matrix4().set(...anchor.matrix). No second transpose/axis flip.
// Do not release a ticket yet: complete real dynamic canPlace and hand/table reach first.
