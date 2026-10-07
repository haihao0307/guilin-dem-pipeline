import{I,mul,inv,position,sourceWorld,vector,quaternionMatrix}from'./math.mjs';
import{buildTargetBinding}from'./TargetBinding.mjs';
/** Fixed-canonical-body adapter. Every native influence is retained.
 * Immutable surface correspondence is constructed offline in generate-mapping.py.
 * Shape + expression + nonlinear correctives are evaluated in native rest space,
 * transferred influence-by-influence, then skinned exactly once by this driver.
 */
export class MHRBodyAdapter{
 constructor({engine,anny,canonical,mapIndices,mapBary,topologySha256}){
  if(topologySha256!==canonical.topologySha256)throw Error('Body mapping topology mismatch');
  this.engine=engine;this.anny=anny;this.canonical=canonical;this.bodyCount=canonical.annyRecipes.length;
  if(mapIndices.length!==this.bodyCount*3||mapBary.length!==this.bodyCount*3)throw Error('Invalid body mapping');
  this.mapIndices=mapIndices;this.mapBary=mapBary;this.names=engine.meta.joint_names;this.parents=engine.d.parents;
  this.zeroState=()=>({identity:new Float32Array(45),pose:new Float32Array(204),expression:new Float32Array(72),correctives:true});
  this.nativeNeutral=engine.evaluate(this.zeroState());this.sourceBind=sourceWorld(this.nativeNeutral.joints);
  this.sourceLocal=this.sourceBind.map((m,j)=>this.parents[j]<0?m:mul(inv(this.sourceBind[this.parents[j]]),m));
  this.sourceBindInverse=this.sourceBind.map(inv);
  const d=engine.d;this.sourceInfluences=Array.from({length:engine.meta.vertices},()=>[]);for(let k=0;k<d.skin_weights.length;k++)this.sourceInfluences[d.skin_verts[k]].push([d.skin_joints[k],d.skin_weights[k]]);
  this.mapWeightSums=new Float64Array(this.bodyCount);const ptr=[0],indices=[],weights=[];
  for(let i=0;i<this.bodyCount;i++){const row=new Map();let total=0;for(let k=0;k<3;k++){const s=mapIndices[i*3+k],b=mapBary[i*3+k];if(!Number.isInteger(s)||s>=engine.meta.vertices||!Number.isFinite(b)||b<0)throw Error('Invalid barycentric map');for(const[j,w]of this.sourceInfluences[s]){row.set(j,(row.get(j)||0)+b*w);total+=b*w;}}if(Math.abs(total-1)>1e-5)throw Error('Mapping is not a partition of unity');this.mapWeightSums[i]=total;for(const[j,w]of[...row].sort((a,b)=>a[0]-b[0]))if(w>0){indices.push(j);weights.push(w/total);}ptr.push(indices.length);}
  this.weights={ptr:new Uint32Array(ptr),joints:new Uint16Array(indices),values:new Float64Array(weights),truncated:false};
  this.headColumns={rotation:[24,25,26,27,28,29],lengthFlexible:[131],scale:[136,137,138,140],note:'Head-only surface semantics must be integrated by the head adapter. All 204 MHR rig values remain native while MHR owns the rig.'};
 }
 targetRest({phenotypes=this.canonical.referenceAnnyPhenotypes,localChanges={},targetRestVertices=null}={}){
  const a=this.anny.forward({phenotypes,localChanges}),r=new Float32Array(this.bodyCount*3);
  this.canonical.annyRecipes.forEach(([u,v,t],i)=>{for(let k=0;k<3;k++)r[i*3+k]=a.vertices[u*3+k]*(1-t)+a.vertices[v*3+k]*t;});
  if(targetRestVertices){if(targetRestVertices.length!==r.length||!targetRestVertices.every(Number.isFinite))throw Error('Invalid fixed-topology rest body');r.set(targetRestVertices);}
  const binding=buildTargetBinding({sourceBind:this.sourceBind,jointNames:this.names,parents:this.parents,annyBoneNames:this.anny.boneLabels,annyRestHeads:a.boneHeads});
  return{vertices:r,anny:a,binding};
 }
 evaluate(state,options={}){
  if(options.rigOwner&&options.rigOwner!=='mhr')throw Error('MHRBodyAdapter must not evaluate saved MHR values while Anny owns the rig');
  for(const [name,length]of[['identity',45],['pose',204],['expression',72]])if(!state[name]||state[name].length!==length||!Array.from(state[name]).every(Number.isFinite))throw Error('Invalid MHR '+name);
  if(typeof state.correctives!=='boolean')throw Error('Invalid corrective toggle');for(let i=0;i<204;i++){const[lo,hi]=this.engine.meta.pose_limits[i];if(state.pose[i]<lo||state.pose[i]>hi)throw Error('MHR native limit '+i);}
  const t=performance.now(),native=this.engine.evaluate(state),target=this.targetRest(options),binding=target.binding,sourcePose=sourceWorld(native.joints),posed=[],skin=[],affected=[];
  const poseIsZero=Array.from(state.pose).every(x=>x===0);
  for(let j=0;j<this.names.length;j++){
   const p=this.parents[j],o=j*7,jp=native.jointParameters;
   affected[j]=(p>=0&&affected[p])||Array.from(jp.subarray(o,o+7)).some(v=>v!==0);
   if(!affected[j]){posed[j]=binding.bind[j].slice();skin[j]=I();continue;}
   // Use native local parameters, not a subtraction of rounded Float32 global
   // matrices. Thus head-only changes cannot introduce tiny full-body jitter.
   const x=jp[o+3]/2,y=jp[o+4]/2,z=jp[o+5]/2,sx=Math.sin(x),sy=Math.sin(y),sz=Math.sin(z),cx=Math.cos(x),cy=Math.cos(y),cz=Math.cos(z);
   const q=[sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];
   const pre=quaternionMatrix(Array.from(this.engine.d.prerotation.subarray(j*4,j*4+4))),translation=vector(inv(pre),[jp[o]/100,jp[o+1]/100,jp[o+2]/100]);
   const ratio=p<0||j<=1?1:binding.scales[p],delta=quaternionMatrix(q,translation.map(v=>v*ratio),Math.exp(jp[o+6]*0.6931471824645996));
   const targetLocal=mul(binding.local[j],delta);posed[j]=p<0?targetLocal:mul(posed[p],targetLocal);skin[j]=mul(posed[j],inv(binding.bind[j]));
  }
  // Each source rest delta retains its original source-joint influence. Averaging
  // deltas first then applying averaged weights creates cross terms and is wrong.
  const transported=new Float64Array(this.engine.meta.vertices*3);
  const deltaFrames=posed.map((m,j)=>mul(m,this.sourceBindInverse[j]));
  for(let s=0;s<this.sourceInfluences.length;s++){
   const k=s*3,delta=[(native.rest[k]-this.nativeNeutral.rest[k])/100,-(native.rest[k+2]-this.nativeNeutral.rest[k+2])/100,(native.rest[k+1]-this.nativeNeutral.rest[k+1])/100];
   if(delta.every(x=>x===0))continue;
   for(const[j,w]of this.sourceInfluences[s]){const d=vector(deltaFrames[j],delta),scale=binding.scales[j];for(let c=0;c<3;c++)transported[k+c]+=w*scale*d[c];}
  }
  const vertices=new Float32Array(target.vertices.length),shapeDisplacement=new Float32Array(vertices.length),weights=this.weights;
  for(let i=0;i<this.bodyCount;i++){
   const o=i*3,x=target.vertices[o],y=target.vertices[o+1],z=target.vertices[o+2],v=[0,0,0];
   if(poseIsZero){v[0]=x;v[1]=y;v[2]=z;}else for(let k=weights.ptr[i];k<weights.ptr[i+1];k++){const m=skin[weights.joints[k]],w=weights.values[k];for(let c=0;c<3;c++)v[c]+=w*(m[c*4]*x+m[c*4+1]*y+m[c*4+2]*z+m[c*4+3]);}
   for(let k=0;k<3;k++){const s=this.mapIndices[o+k],w=this.mapBary[o+k]/this.mapWeightSums[i];for(let c=0;c<3;c++)shapeDisplacement[o+c]+=w*transported[s*3+c];}
   for(let c=0;c<3;c++)vertices[o+c]=v[c]+shapeDisplacement[o+c];
  }
  if(!vertices.every(Number.isFinite))throw Error('Nonfinite body output');
  const attachment={};for(const name of ['c_spine3','c_neck','c_neck_twist1_proc','c_head']){const j=this.names.indexOf(name),m=posed[j];attachment[name]={index:j,rest:binding.bind[j],posed:m,skin:skin[j],restPosition:position(binding.bind[j]),posedPosition:position(m),worldScale:Math.hypot(m[0],m[4],m[8]),referenceDisplacementScale:binding.scales[j]};}
  return{vertices,restVertices:target.vertices,shapeDisplacement,native,names:this.names,parents:this.parents,targetRestMatrices:binding.bind,targetPosedMatrices:posed,skinMatrices:skin,skinWeights:weights,attachment,sourceBindMatrices:this.sourceBind,sourcePosedMatrices:sourcePose,targetBinding:binding,topologySha256:this.canonical.topologySha256,bodyCount:this.bodyCount,headOnlyGeometryCovered:false,headColumns:this.headColumns,inputState:{identity:Array.from(state.identity),pose:Array.from(state.pose),expression:Array.from(state.expression),correctives:state.correctives},targetShape:{phenotypes:structuredClone(options.phenotypes||this.canonical.referenceAnnyPhenotypes),localChanges:structuredClone(options.localChanges||{})},evaluationMs:performance.now()-t};
 }
 /** Exact factorization hook for adding a rigid cranial branch BEFORE the one
  * final skinning pass. Each CSR influence slot gets its own target-rest point.
  * Never average these slots into one rest point before skinning. The ordinary
  * evaluate() path above is intentionally unchanged. */
 influenceRestPacket(result){
  if(result.topologySha256!==this.canonical.topologySha256||result.bodyCount!==this.bodyCount)throw Error('Influence packet topology mismatch');
  const weights=this.weights,restPositions=new Float64Array(weights.values.length*3),frames=result.targetRestMatrices.map((m,j)=>mul(m,this.sourceBindInverse[j])),nativeRest=result.native.rest;
  for(let i=0;i<this.bodyCount;i++){
   const lookup=new Map();for(let k=weights.ptr[i];k<weights.ptr[i+1];k++){lookup.set(weights.joints[k],k);restPositions.set(result.restVertices.subarray(i*3,i*3+3),k*3);}
   for(let c=0;c<3;c++){
    const source=this.mapIndices[i*3+c],bary=this.mapBary[i*3+c]/this.mapWeightSums[i],o=source*3;
    const delta=[(nativeRest[o]-this.nativeNeutral.rest[o])/100,-(nativeRest[o+2]-this.nativeNeutral.rest[o+2])/100,(nativeRest[o+1]-this.nativeNeutral.rest[o+1])/100];
    if(delta.every(v=>v===0))continue;
    for(const[j,w]of this.sourceInfluences[source]){
     const slot=lookup.get(j);if(slot===undefined||bary===0||w===0)continue;
     const d=vector(frames[j],delta),factor=bary*w*result.targetBinding.scales[j]/weights.values[slot];
     for(let k=0;k<3;k++)restPositions[slot*3+k]+=factor*d[k];
    }
   }
  }
  return{schema:'mhr-body-joint-conditioned-rest/1',topologySha256:result.topologySha256,vertexCount:this.bodyCount,coordinateSystem:'common target-rest metre Z-up',matrixConvention:'row-major; column vectors',weights,restPositionsPerInfluence:restPositions,targetRestMatrices:result.targetRestMatrices,targetPosedMatrices:result.targetPosedMatrices,skinMatrices:result.skinMatrices,names:this.names,parents:this.parents,sourceState:result.inputState,targetShape:result.targetShape};
 }
 /** One skin pass with caller-owned FINAL matrices. Pass an array of skin
  * matrices, {skinMatrices}, or {posedMatrices}. No root-transform composition
  * order is imposed here. For a rest-space G followed by body skin, the caller
  * supplies skin[j]*G; a posed-world G instead would compose on the other side. */
 skinInfluenceRestPacket(packet,matrixInput=packet.skinMatrices){
  let skinMatrices=matrixInput;
  if(!Array.isArray(matrixInput)){
   if(!matrixInput||Number(!!matrixInput.skinMatrices)+Number(!!matrixInput.posedMatrices)!==1)throw Error('Supply exactly one final skin or posed matrix array');
   skinMatrices=matrixInput.skinMatrices||matrixInput.posedMatrices.map((m,j)=>mul(m,inv(packet.targetRestMatrices[j])));
  }
  if(packet.topologySha256!==this.canonical.topologySha256||skinMatrices.length!==this.names.length||skinMatrices.some(m=>m.length!==16||!Array.from(m).every(Number.isFinite)))throw Error('Invalid packet skinning input');
  const out=new Float32Array(packet.vertexCount*3),w=packet.weights,p=packet.restPositionsPerInfluence;
  for(let i=0;i<packet.vertexCount;i++){const v=[0,0,0];for(let k=w.ptr[i];k<w.ptr[i+1];k++){const m=skinMatrices[w.joints[k]],x=p[k*3],y=p[k*3+1],z=p[k*3+2];for(let c=0;c<3;c++)v[c]+=w.values[k]*(m[c*4]*x+m[c*4+1]*y+m[c*4+2]*z+m[c*4+3]);}out.set(v,i*3);}
  if(!out.every(Number.isFinite))throw Error('Nonfinite influence packet result');return out;
 }
 /** Baked evaluated common body and posed skeleton. This is an exact snapshot;
  * an ordinary static LBS export alone cannot reproduce the nonlinear MHR MLP. */
 exportSnapshot(result){return{schema:'mhr-canonical-body-snapshot/1',topologySha256:result.topologySha256,bodyCount:this.bodyCount,vertices:Array.from(result.vertices),jointNames:this.names,parents:Array.from(this.parents),matrixConvention:'row-major, metre, Z-up',sourceState:result.inputState,targetShape:result.targetShape,jointWorld:result.targetPosedMatrices,snapshotBindWorld:result.targetPosedMatrices,inverseSnapshotBindWorld:result.targetPosedMatrices.map(inv),referenceBindWorld:result.targetRestMatrices,weights:{ptr:Array.from(this.weights.ptr),joints:Array.from(this.weights.joints),values:Array.from(this.weights.values)},deformation:'Baked pose with posed snapshot bind, so applying exported jointWorld * inverseSnapshotBindWorld is identity and does not skin the baked mesh twice. referenceBindWorld is provenance, not the baked mesh skin bind. Future animated frames must evaluate MHR rest-space MLP and this adapter, or bake per-frame mesh deltas.'};}
}
