/** Original data-only comparison planner. It does not create motion or run AI.
 * Eighteen phase-shifted copies do not satisfy eighteen semantic motion IDs.
 * Native bakes are actor, opponent, role and rest-shape specific.
 */
const require=(x,m)=>{if(!x)throw new Error(m);};
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function createComparisonRound(library,characters,round,{arenaCount=18,allowSyntheticFixtures=false}={}) {
  require(Number.isInteger(arenaCount)&&arenaCount>0,'positive arena count required');
  require(Number.isInteger(round)&&round>=0,'nonnegative integer round required');
  require(typeof allowSyntheticFixtures==='boolean','fixture override must be boolean');
  require(Array.isArray(characters)&&characters.length===arenaCount*2,'exactly two characters per arena required');
  require(new Set(characters.map(c=>c.id)).size===characters.length,'unique character IDs required');
  for(const c of characters)require(typeof c.id==='string'&&c.id&&hash(c.restFingerprint),'character and shape-specific rest fingerprint required');
  require(Array.isArray(library),'motion library required');
  const semantic=new Set(library.map(c=>c.semanticMotionId));
  require(semantic.size>=arenaCount,`at least ${arenaCount} reviewed semantic motions required; have ${semantic.size}`);
  require(semantic.size===library.length,'phase/seed variants of the same semantic motion must not inflate the comparison set');
  const motions=library.slice(0,arenaCount);
  require(new Set(motions.map(c=>c.canonicalClipSha256)).size===arenaCount,'renaming the same clip is not action diversity');
  for(const m of motions) {
    require(typeof m.semanticMotionId==='string'&&m.semanticMotionId&&typeof m.takeId==='string'&&m.takeId,'semantic motion and immutable take IDs required');
    require(hash(m.canonicalClipSha256)&&m.actorCount===2,'approved paired canonical clip required');
    require(Number.isFinite(m.fps)&&m.fps>0&&Number.isFinite(m.durationSeconds)&&m.durationSeconds>0,'shared paired timing required');
    require(m.qualityStatus==='reviewed'&&m.redistributionApproved===true,'quality and rights review required');
    require(typeof m.semanticReviewEvidence==='string'&&m.semanticReviewEvidence,'human semantic review evidence required');
    require(!m.testFixture||allowSyntheticFixtures,'synthetic test catalogue is not a production action library');
    require(m.source?.kind==='self-authored-procedural'||m.source?.kind==='verified-model-output','explicit source kind required');
    if(m.source.kind==='verified-model-output')require(m.source.neuralInferenceExecuted===true&&hash(m.source.checkpointSha256)&&typeof m.source.runEvidence==='string'&&m.source.runEvidence,'model output requires actual run evidence');
    else require(m.source.neuralInferenceExecuted===false,'procedural motion cannot claim neural inference');
    require(Array.isArray(m.bakes),'per-character/partner/role bake records required');
  }
  const arenas=[];
  for(let a=0;a<arenaCount;a++) {
    const m=motions[(a+round)%arenaCount],pair=characters.slice(a*2,a*2+2);
    const actors=pair.map((c,j)=>{
      const other=pair[1-j],role=((j+Math.floor(round/arenaCount))%2)===0?'A':'B';
      const matches=m.bakes.filter(b=>b.characterId===c.id&&b.partnerId===other.id&&b.role===role);
      require(matches.length===1,`one calibrated bake required for ${m.takeId}/${c.id}/${other.id}/${role}`);
      const b=matches[0];require(b.restFingerprint===c.restFingerprint&&b.partnerRestFingerprint===other.restFingerprint,'actor/opponent shape changed; rebake before playback');
      require(hash(b.packetSha256),'native packet hash required');
      require(b.fps===m.fps&&Number.isInteger(b.frameCount)&&b.frameCount>1&&Math.abs((b.frameCount-1)/b.fps-m.durationSeconds)<1e-9,'actor bake timing must match the shared paired take');
      return {characterId:c.id,partnerId:other.id,role,restFingerprint:c.restFingerprint,packetSha256:b.packetSha256};
    });
    arenas.push({arenaIndex:a,semanticMotionId:m.semanticMotionId,takeId:m.takeId,canonicalClipSha256:m.canonicalClipSha256,
      clock:{startSeconds:0,fps:m.fps,durationSeconds:m.durationSeconds,loop:false},source:structuredClone(m.source),actors});
  }
  return {schema:'kaopu-arena-comparison-round/1',round,rolePass:Math.floor(round/arenaCount)%2,arenaCount,validationOnly:motions.some(m=>!!m.testFixture),
    distinctSemanticMotions:arenaCount,frameSynchronization:'one shared clock per pair; no random phase offsets',arenas};
}
