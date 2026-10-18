// Reuse the recipient's 43-guide solver, regional constraints and authored paths.
// No import of the donor's 96-guide Groom, HairRenderer or app entry point.
export function photoRuntimePorts(photo){
 const {motion,binding,dynamics,viewer}=photo;
 if(!motion||!binding||!dynamics||!viewer||typeof photo.update!=='function')throw Error('Expected recipient PhotoDynamics');
 const originalUpdate=photo.update,originalFastSolve=dynamics.fastSolve;
 return{
  advanceMotion(dt){if(motion.playing)motion.advance(dt);},
  updatePose(dt){binding.updateFrame();if(dt>0)motion.updateKinematics(binding.frame,dt);},
  simulate(dt){
   const beforeStep=dynamics.beforeStep;
   // The old hook advances animation again. Retain only current root refresh
   // for this call, and restore it even if the target solver rejects a pose.
   dynamics.beforeStep=()=>binding.updateFrame();
   try{return originalUpdate.call(photo,dt);}finally{dynamics.beforeStep=beforeStep;}
  },
  prepareMotion(){motion.prepareRender();},
  prepareContacts(){photo.prepareRender();},
  invalidateShadows(){viewer.renderer.shadowMap.needsUpdate=true;},
  setSolveBudget({fastSolve}){dynamics.fastSolve=fastSolve;},
  release(){dynamics.fastSolve=originalFastSolve;}
 };
}
