/** Original lossless native-frame cache. No rig reduction, skin rewrite or NN.
 * The payload mirrors full/boxing/AnimatedHuman's existing matrix consumption.
 * Nearest-frame sampling is deliberate: there is no matrix-element lerp.
 * This path is for already-calibrated Anny104 poses, not raw SOMA rotations.
 */
const fail = (ok, why) => { if (!ok) throw new Error(why); };
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
function matrices(value, n, label) {
  fail(Array.isArray(value) && value.length === n, `${label}: bone count`);
  return value.map(m => {
    fail(m?.length === 16 && Array.from(m).every(finite), `${label}: finite row-major 4x4 required`);
    fail(Math.abs(m[12]) + Math.abs(m[13]) + Math.abs(m[14]) + Math.abs(m[15]-1) < 1e-6, `${label}: homogeneous row-major matrix required`);
    return Array.from(m);
  });
}
export function bakeNativePacket({evaluate, names, parents, restFingerprint, fps, frameCount, source}) {
  fail(typeof evaluate === 'function', 'evaluate callback required');
  fail(names?.length === 104 && new Set(names).size === 104 && names.every(x=>typeof x==='string' && x), 'exact named Anny104 hierarchy required');
  fail(parents?.length === 104 && parents[0] === -1 && Array.from(parents).slice(1).every((p,i)=>Number.isInteger(p) && p>=0 && p<=i), 'topologically ordered Anny104 hierarchy required');
  fail(typeof restFingerprint === 'string' && /^[a-f0-9]{64}$/.test(restFingerprint), 'shape-specific rest fingerprint required');
  fail(finite(fps) && fps > 0 && Number.isInteger(frameCount) && frameCount>0, 'positive FPS and frame count required');
  fail(source?.kind === 'self-authored-procedural' && source.neuralInferenceExecuted === false, 'R01 bake requires honest procedural provenance');
  const frames=[];
  for(let i=0;i<frameCount;i++) {
    const f=evaluate(i/fps);
    fail(f.rootTranslation?.length===3 && Array.from(f.rootTranslation).every(finite), 'finite native root required');
    frames.push({posedMatrices:matrices(f.posedMatrices,104,'posed'),skinMatrices:matrices(f.skinMatrices,104,'skin'),
      rootTranslation:Array.from(f.rootTranslation),footContacts:structuredClone(f.footContacts ?? {}),
      state:structuredClone(f.state ?? null),metrics:structuredClone(f.metrics ?? {})});
  }
  return {schema:'kaopu-native-motion-packet/1',skeleton:{id:'anny104',names:Array.from(names),parents:Array.from(parents),restFingerprint},
    coordinates:{units:'metres',up:'+Z',forward:'-Y',matrixOrder:'row-major',vectors:'column'},
    fps,durationSeconds:(frameCount-1)/fps,rootTranslationAlreadyInMatrices:true,
    sampling:'nearest-clamped-frame',source:structuredClone(source),frames};
}
export function createNativePacketPlayer(packet,{names,parents,restFingerprint}) {
  fail(packet?.schema==='kaopu-native-motion-packet/1','wrong native packet schema');
  fail(packet.skeleton?.id==='anny104','SOMA77 is not Anny104: calibrated retarget required');
  fail(names?.length===104 && new Set(names).size===104 && names.every(x=>typeof x==='string'&&x), 'exact named Anny104 hierarchy required');
  fail(parents?.length===104 && parents[0]===-1 && Array.from(parents).slice(1).every((p,i)=>Number.isInteger(p)&&p>=0&&p<=i), 'topologically ordered Anny104 hierarchy required');
  fail(typeof restFingerprint==='string' && /^[a-f0-9]{64}$/.test(restFingerprint), 'valid rest fingerprint required');
  fail(JSON.stringify(packet.skeleton.names)===JSON.stringify(Array.from(names)) && JSON.stringify(packet.skeleton.parents)===JSON.stringify(Array.from(parents)), 'bone hierarchy mismatch');
  fail(packet.skeleton.restFingerprint===restFingerprint,'rest shape mismatch; rebake for this character');
  fail(packet.rootTranslationAlreadyInMatrices===true,'ambiguous root ownership');
  fail(packet.coordinates?.units==='metres' && packet.coordinates.up==='+Z' && packet.coordinates.forward==='-Y' && packet.coordinates.matrixOrder==='row-major' && packet.coordinates.vectors==='column','native coordinate mismatch');
  fail(packet.sampling==='nearest-clamped-frame','unsupported sampling policy');
  fail(packet.source?.kind==='self-authored-procedural' && packet.source.neuralInferenceExecuted===false,'R01 packet requires honest procedural provenance');
  fail(finite(packet.fps) && packet.fps>0 && packet.frames?.length>0, 'invalid packet timing');
  fail(Math.abs(packet.durationSeconds-(packet.frames.length-1)/packet.fps)<1e-9,'duration mismatch');
  // Validate and take a private snapshot. Caller mutations cannot corrupt playback.
  const fps=packet.fps;
  const frames=packet.frames.map(f=>{
    fail(f.rootTranslation?.length===3 && Array.from(f.rootTranslation).every(finite),'finite native root required');
    return {...structuredClone(f),posedMatrices:matrices(f.posedMatrices,names.length,'posed'),skinMatrices:matrices(f.skinMatrices,names.length,'skin')};
  });
  return {evaluate(seconds) {
    fail(finite(seconds),'finite playback time required');
    const index=Math.max(0,Math.min(frames.length-1,Math.round(seconds*fps)));
    // Independent snapshots preserve the producer's mutable-buffer semantics safely.
    return {...structuredClone(frames[index]),frameIndex:index,rootTranslationAlreadyInMatrices:true};
  }};
}
