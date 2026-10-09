/** Canonical Anny is Z-up/-Y-forward; Three view is Y-up. Vectors exclude translation. */
export function nativeVectorToWorld(e,n){const v=[n[0],n[2],-n[1]];return [0,1,2].map(k=>e[k]*v[0]+e[4+k]*v[1]+e[8+k]*v[2]);}
export function worldVectorToNative(e,w){const v=[0,1,2].map(k=>e[k*4]*w[0]+e[k*4+1]*w[1]+e[k*4+2]*w[2]);return [v[0],-v[2],v[1]];}
export function requireRigidActorTransform(e){
  const determinant=e[0]*(e[5]*e[10]-e[9]*e[6])-e[4]*(e[1]*e[10]-e[9]*e[2])+e[8]*(e[1]*e[6]-e[5]*e[2]);
  if(!Number.isFinite(determinant)||Math.abs(determinant-1)>1e-6)throw Error('Contact axis vectors require a proper right-handed actor rotation');
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){let dot=0;for(let k=0;k<3;k++)dot+=e[a*4+k]*e[b*4+k];if(Math.abs(dot-(a===b?1:0))>1e-6)throw Error('Contact basis requires an unscaled orthonormal actor transform');}
}
export function contactOverlay(actor,response){
  if(!response?.lastContact)return undefined;
  const event=response.lastContact;
  if(!event.source?.startsWith('JoltPhysics.js/')||!event.contactPoint?.every(Number.isFinite))throw Error('Contact response has no verified Jolt event');
  const e=actor.group.matrixWorld.elements;
  requireRigidActorTransform(e);
  return {space:'native-local-z-up',source:'jolt-shape-cast',eventId:event.eventId||[event.pairId,event.attackerId,event.defenderId,event.hand,event.time].join(':'),
    torsoDisplacementNative:worldVectorToNative(e,response.offset),headRotationVectorNativeRadians:worldVectorToNative(e,response.head)};
}
/** Exact R02 glove center, with no cuff/normal buffer upload during physics substeps. */
export function updateGloveCentersOnly(actor){
  for(const g of actor.gloves){const w=actor.latest.posedMatrices[g.index],k=actor.latest.posedMatrices[g.knuckle];if(!w||!k)throw Error('Glove anatomical endpoints missing');
    g.position.set(w[3]+(k[3]-w[3])*.75,w[11]+(k[11]-w[11])*.75,-w[7]+(-k[7]+w[7])*.75);
  }
}
