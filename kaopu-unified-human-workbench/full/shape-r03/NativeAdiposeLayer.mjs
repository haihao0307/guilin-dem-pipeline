import {skinGNMRest} from '../src/HeadMath.mjs';
/** Opt-in R03 native-derived soft-tissue extrapolation.
 * Uses the official weight anchor displacement, subtracting weighted bone-head
 * displacement to avoid doubling skeletal widening. No coordinate scaling,
 * new mesh, weight pruning or joint mutation. R01/R02 never install this layer.
 * Pilot only: not a calibrated BMI model or an anatomical validation claim.
 */
export const ADIPOSE_SCHEMA='native-soft-tissue-r03/1';
const rounded=n=>n==='root'||/pelvis|spine|breast|upperleg|lowerleg|upperarm|lowerarm|shoulder/.test(n);
export function installNativeAdiposeLayer(model){
 if(model.r03Adipose)throw Error('R03 layer already installed');
 installHeadSoftTissue(model);
 const original=model.applyBodyDriver.bind(model),settings={amount:0},cache=new Map();
 model.r03Adipose={schema:ADIPOSE_SCHEMA,settings,set(amount){if(!Number.isFinite(amount)||amount<-.85||amount>2.5)throw Error('R03 adipose amount outside pilot bounds');settings.amount=amount;}};
 model.applyBodyDriver=context=>{original(context);const amount=settings.amount;if(amount<=0){model.r03Adipose.last={amount:0,requestedAmount:amount,bodyNativeWeightFloorPreserved:true};return;}
  const state=model.effectiveState;if(state.owners.rig!=='anny')throw Error('R03 pilot adipose layer requires Anny rig; MHR integration pending');
  if(state.anny.phenotypes.age<.52)throw Error('Adult soft-tissue extrapolation prohibited on children');
  const key=JSON.stringify([state.anny.phenotypes,state.anny.localChanges,Math.sign(amount)]);let delta=cache.get(key);
  if(!delta){const common={...state.anny.phenotypes},shape={localChanges:state.anny.localChanges},lo=model.anny.forward({...shape,phenotypes:{...common,weight:amount>0?.5:0}}),hi=model.anny.forward({...shape,phenotypes:{...common,weight:amount>0?1:.5}}),a=model.anny.arrays,n=model.anny.influences,src=new Float64Array(lo.vertices.length);
   for(let i=0;i<lo.vertices.length/3;i++){let gate=0,weightSum=0,shift=[0,0,0];for(let k=0;k<n;k++){const slot=i*n+k,j=a.vertex_bone_indices[slot],w=a.vertex_bone_weights[slot];weightSum+=w;if(rounded(model.anny.boneLabels[j]))gate+=w;for(let c=0;c<3;c++)shift[c]+=w*(hi.boneHeads[j*3+c]-lo.boneHeads[j*3+c]);}const g=Math.max(0,Math.min(1,gate/(weightSum||1)));for(let c=0;c<3;c++)src[i*3+c]=(hi.vertices[i*3+c]-lo.vertices[i*3+c]-shift[c])*g;}
   delta=model.bodyDriver.sampleAnny(src);
   // Smooth only the extrapolated displacement field, never the retained source
   // surface. Native fine creases are unsuitable for linear extrapolation.
   const adjacent=Array.from({length:model.bodyCount},()=>new Set());for(let t=0;t<model.faces.length;t+=3){const tri=Array.from(model.faces.slice(t,t+3));if(tri.some(i=>i>=model.bodyCount))continue;for(let c=0;c<3;c++){adjacent[tri[c]].add(tri[(c+1)%3]);adjacent[tri[c]].add(tri[(c+2)%3]);}}
   for(let pass=0;pass<48;pass++){const next=delta.slice();for(let i=0;i<adjacent.length;i++){const ns=adjacent[i];if(!ns.size)continue;for(let c=0;c<3;c++){let avg=0;for(const j of ns)avg+=delta[j*3+c];next[i*3+c]=delta[i*3+c]*.45+.55*avg/ns.size;}}delta=next;}
   // Reapply a smooth full-CSR body gate after field regularization.
   const weights=model.bodyDriver.annyWeights;for(let i=0;i<model.bodyCount;i++){let gate=0;for(let k=weights.ptr[i];k<weights.ptr[i+1];k++)if(rounded(model.anny.boneLabels[weights.joints[k]]))gate+=weights.values[k];for(let c=0;c<3;c++)delta[i*3+c]*=Math.min(1,gate);}
   cache.set(key,delta);
  }
  const result=model.lastBodyDriver,packet=result.packet,w=packet.weights,points=packet.restPositionsPerInfluence;
  for(let i=0;i<model.bodyCount;i++){for(let k=w.ptr[i];k<w.ptr[i+1];k++)for(let c=0;c<3;c++)points[k*3+c]+=delta[i*3+c]*amount;for(let c=0;c<3;c++)result.sharedRestVertices[i*3+c]+=delta[i*3+c]*amount;}
  const posed=model.bodyDriver.skinAnnyPacket(packet,result.rig.skinMatrices);context.pos.set(posed);result.vertices=posed;result.positions=posed;result.rig.restPositionsPerInfluence=points;
  model.r03Adipose.last={amount,method:'native-weight-anchor-delta-minus-weighted-joint-translation',childApplied:false,topologyUnchanged:true,weightsUnchanged:true,skeletonUnchanged:true};
 };
 return model.r03Adipose;
}

/** Head soft tissue uses native head-fat and submental target differences.
 * Upper cranium and internal eye/dental components stay fixed. A broad continuous field avoids cheek-region islands. Native bone matrices,
 * GNM joints, dentition and the source identity remain untouched. */
function installHeadSoftTissue(model){
 const original=model.applySemanticHead.bind(model),ht=model.headTransfer,N=model.gnm.numVertices,outer=new Set(ht.outer),adj=Array.from({length:N},()=>new Set()),tri=model.gnm.triangles;
 for(let t=0;t<tri.length;t+=3){const ids=Array.from(tri.slice(t,t+3));if(ids.some(i=>!outer.has(i)))continue;for(let c=0;c<3;c++){adj[ids[c]].add(ids[(c+1)%3]);adj[ids[c]].add(ids[(c+2)%3]);}}
 const cache=new Map();model.applySemanticHead=context=>{original(context);const amount=model.r03Adipose?.settings.amount||0;if(!amount){model.r03HeadSoftTissue=null;return;}if(model.effectiveState.anny.phenotypes.age<.52)throw Error('Adult head soft-tissue layer prohibited on children');const state=model.effectiveState,rig=model.lastHeadRig;if(!rig)throw Error('Shared rest head required');
  const key=JSON.stringify([state.anny.phenotypes,state.anny.localChanges,Math.sign(amount)]);let delta=cache.get(key);
  if(!delta){const args={phenotypes:state.anny.phenotypes},local={...state.anny.localChanges,'head-fat-incr':0,'neck-double-incr':0};const a=model.anny.forward({...args,localChanges:local}),b=model.anny.forward({...args,localChanges:{...local,'head-fat-incr':amount>0?1:-1,'neck-double-incr':amount>0?.7:0}});delta=ht.mapDelta('anny',a.vertices,b.vertices,1);
   // Regularize only the added displacement, not facial identity geometry.
   for(let pass=0;pass<120;pass++){const next=delta.slice();for(const i of ht.outer){if(!adj[i].size)continue;for(let c=0;c<3;c++){let avg=0;for(const j of adj[i])avg+=delta[j*3+c];next[i*3+c]=.65*delta[i*3+c]+.35*avg/adj[i].size;}}delta=next;}cache.set(key,delta);}
  const rest=rig.restVertices.slice(),eyeIDs=ht.regionIds[6].concat(ht.regionIds[7]),eyeZ=eyeIDs.reduce((s,i)=>s+rest[i*3+2],0)/eyeIDs.length,fade=.055*context.scale;let max=0,cranialMoved=0;
  for(const i of ht.outer){const t=Math.max(0,Math.min(1,(eyeZ+.006*context.scale-rest[i*3+2])/fade)),upper=t*t*(3-2*t),w=upper*Math.abs(amount)*.80;for(let c=0;c<3;c++){const d=delta[i*3+c]*w;rest[i*3+c]+=d;max=Math.max(max,Math.abs(d));if(upper===0&&d!==0)cranialMoved++;}}
  const extra=rest.map((v,i)=>v-rig.restVertices[i]);ht.extend(extra);for(let i=0;i<rest.length;i++)rest[i]=rig.restVertices[i]+extra[i];const posed=skinGNMRest(model,rest,rig.jointsRest,context.scale);model.headWorldOverride=posed.vertices;model.activeGNMRootRestMatrix=posed.rootMatrix;model.lastHeadRig={...rig,restVertices:rest,jointsPosed:posed.jointsPosed};model.r03HeadSoftTissue={source:'native head-fat + neck-double field',maxDisplacementMM:max*1000,upperCraniumChangedVertices:cranialMoved,upperCraniumPinned:true,eyeAndDentalComponentsFixed:true,oralSkinContinuous:true,amount};
 };
}
