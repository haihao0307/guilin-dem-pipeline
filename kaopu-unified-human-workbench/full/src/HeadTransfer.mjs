import{identity,multiply,point,vector,xyz,componentFit,inverse3,sample,skinGNMRest}from'./HeadMath.mjs';
const TYPES={'<u4':Uint32Array,'<f4':Float32Array,'<f8':Float64Array};
const cavities=['oral_skin','nasal_skin','left_ocular_skin','right_ocular_skin'];
const zero=n=>Array(n).fill(0);
function inverseAffine(m){const a=inverse3([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]]),t=[m[3],m[7],m[11]],o=identity();for(let r=0;r<3;r++){for(let c=0;c<3;c++)o[r*4+c]=a[r*3+c];o[r*4+3]=-a.slice(r*3,r*3+3).reduce((s,x,c)=>s+x*t[c],0);}return o;}
function sourceCoordinates(name,v){if(name==='anny')return v;const o=new Float64Array(v.length);for(let i=0;i<v.length;i+=3){o[i]=v[i]/100;o[i+1]=-v[i+2]/100;o[i+2]=v[i+1]/100;}return o;}
export class HeadTransfer{
 constructor(meta,buffer){if(meta.schema!=='kaopu-semantic-head-adapter/1'||meta.gnmVertices!==17821||buffer.byteLength!==meta.binary.byteLength)throw Error('Unsupported head adapter');this.meta=meta;this.headOnlyAnnyLocalLabels=new Set(meta.headOnlyAnnyLocalLabels||[]);this.d={};for(const[n,a]of Object.entries(meta.arrays))this.d[n]=new TYPES[a.dtype](buffer,a.offset,a.length);this.outer=this.d.outer_ids;this.componentIds=Array.from({length:6},(_,c)=>Array.from(this.d.components).flatMap((v,i)=>v===c?[i]:[]));this.regionIds=Array.from({length:20},(_,c)=>Array.from(this.d.regions).flatMap((v,i)=>v===c?[i]:[]));}
 mapDelta(name,from,to,scale=1){const d=this.d,idx=d[name+'_indices'],b=d[name+'_bary'],A=d[name+'_source_to_gnm'],out=new Float64Array(17821*3);for(let i=0;i<this.outer.length;i++){const p=sample(from,idx,b,i),q=sample(to,idx,b,i),v=vector(A,q.map((x,k)=>(x-p[k])*scale));out.set(v,this.outer[i]*3);}return out;}
 /** Fixed-topology diffusion regularizes the cross-model source displacement,
  * never the retained GNM surface or native local-parameter fields. */
 attachMorphologyField(meta,buffer){if(meta.schema!=='registered-multisource-rbf-head/1'||meta.rows!==this.outer.length||meta.byteLength!==buffer.byteLength)throw Error('Head source field mismatch');const n=meta.controls;this.morphologyField={meta,sources:{anny:{indices:new Uint32Array(buffer,0,n*3),bary:new Float64Array(buffer,n*12,n*3)},mhr:{indices:new Uint32Array(buffer,n*36,n*3),bary:new Float64Array(buffer,n*48,n*3)}},points:new Float64Array(buffer,n*72,n*3),inverse:new Float64Array(buffer,n*96,(n+4)*n)};if(!Array.isArray(meta.controlRows)||meta.controlRows.length!==n)throw Error('Missing frozen source controls');for(const source of ['anny','mhr'])for(let i=0;i<n;i++)for(let k=0;k<3;k++){const row=meta.controlRows[i],binding=this.morphologyField.sources[source];if(binding.indices[i*3+k]!==this.d[source+'_indices'][row*3+k]||binding.bary[i*3+k]!==this.d[source+'_bary'][row*3+k])throw Error('Frozen source control mismatch: '+source);}}
 /** Evaluate the same smooth native source field at the actual GNM identity and
  * expression points. The original teacher remains the sole morphology source. */
 transportMorphology(model,from,to,out,{scale,head},source='anny'){
  const d=this.d,A=d[source+'_source_to_gnm'],Ai=inverseAffine(A),t=model.canonical.headTransform.translation,m=this.morphologyField,delta=new Float64Array(out.length);if(!m)throw Error('Source head field required');const binding=m.sources[source],N=m.meta.controls,coeff=new Float64Array((N+4)*3),nativeDelta=new Float64Array(N*3);
  for(let k=0;k<N;k++){const a=sample(from,binding.indices,binding.bary,k),b=sample(to,binding.indices,binding.bary,k);nativeDelta.set(vector(A,b.map((x,c)=>x-a[c])),k*3);}
  if(nativeDelta.every(v=>v===0))return delta;
  for(let row=0;row<N+4;row++)for(let k=0;k<N;k++){const w=m.inverse[row*N+k];for(let c=0;c<3;c++)coeff[row*3+c]+=w*nativeDelta[k*3+c];}
  for(let i=0;i<out.length/3;i++){
   const current=xyz(out,i).map((x,c)=>(x-head[c])/scale+model.referenceHead[c]-t[c]),p=current.map((x,c)=>(x-m.meta.center[c])/m.meta.scale),sourceDelta=[0,0,0];
   for(let k=0;k<N;k++){const dx=p[0]-m.points[k*3],dy=p[1]-m.points[k*3+1],dz=p[2]-m.points[k*3+2],r=Math.sqrt(dx*dx+dy*dy+dz*dz),w=r*r*r;sourceDelta[0]+=w*coeff[k*3];sourceDelta[1]+=w*coeff[k*3+1];sourceDelta[2]+=w*coeff[k*3+2];}
   for(let c=0;c<3;c++)sourceDelta[c]+=coeff[N*3+c]+coeff[(N+1)*3+c]*p[0]+coeff[(N+2)*3+c]*p[1]+coeff[(N+3)*3+c]*p[2];
   delta.set(sourceDelta.map(x=>x*scale),i*3);
  }
  this.morphologyFieldDiagnostic={method:'continuous-registered-native-source-RBF',controls:N,kernel:m.meta.kernel,regularization:m.meta.regularization,gnmGeometryFiltered:false,localControlsFiltered:false,internalGeometry:'same-continuous-field'};return delta;
 }

 /** Apply a second teacher field through the same lifecycle deformation.
  * This is F(p+d)-F(p), so an MHR facial/identity delta is not pasted back in
  * adult proportions after the Anny lifecycle layer has moved the face. */
 transportCompoundDelta(model,lifecycle,reference,nativeDelta,context){
  const after=reference.slice();this.add(after,nativeDelta);const a=this._compoundMorphDelta||this.transportMorphology(model,this.d.anny_neutral,lifecycle,reference,context),b=this.transportMorphology(model,this.d.anny_neutral,lifecycle,after,context),result=nativeDelta.slice();this._compoundMorphDelta=b;
  for(let i=0;i<result.length;i++)result[i]+=b[i]-a[i];return result;
 }

 extend(delta){for(const group of cavities){const ids=this.d[group+'_ids'],boundary=this.d[group+'_boundary'],weights=this.d[group+'_weights'];for(let r=0;r<ids.length;r++)for(let c=0;c<3;c++){let x=0;for(let k=0;k<boundary.length;k++)x+=weights[r*boundary.length+k]*delta[boundary[k]*3+c];delta[ids[r]*3+c]=x;}}return delta;}
 add(out,delta){for(let i=0;i<out.length;i++)out[i]+=delta[i];}
 place(model,v,scale,head){const out=new Float64Array(v.length),t=model.canonical.headTransform.translation;for(let i=0;i<v.length;i+=3){out[i]=head[0]+scale*(v[i]+t[0]-model.referenceHead[0]);out[i+1]=head[1]+scale*(-v[i+2]+t[1]-model.referenceHead[1]);out[i+2]=head[2]+scale*(v[i+1]+t[2]-model.referenceHead[2]);}return out;}
 mhrState(model,state,{expression=false,correctives=false,pose=false}={}){const owner=state.owners.headShape||'gnm',p=pose?state.mhr.pose.slice():zero(204);if(state.owners.headRig==='gnm')for(let i=24;i<=29;i++)p[i]=0;const e=expression?state.mhr.expression.slice():zero(72);if(state.owners.gaze!=='expression')for(let i=0;i<72;i++)if(model.mhrMeta.expression_names[i].startsWith('eyesLook'))e[i]=0;return{identity:state.headShapeComposition==='shared-layers/1'||owner==='mhr'?state.mhr.identity:zero(45),pose:p,expression:e,correctives};}
 actions(state,{gazeOnly=false}={}){const out={};for(const[k,v]of Object.entries(state.anny.facialActions)){const gaze=k.startsWith('eyeLook');if(gazeOnly?!gaze:(gaze&&state.owners.gaze!=='expression'))continue;out[k]=v;}return out;}
 moveDental(before,after,{upper=false,lower=true}={}){const fits={};for(const[c,ids]of[[3,this.regionIds[17]],[4,this.regionIds[19]]]){if((c===3&&!upper)||(c===4&&!lower))continue;const fit=componentFit(before,after,ids,{scale:upper});fits[c]=fit;for(const i of this.componentIds[c])after.set(point(fit.matrix,xyz(before,i)),i*3);}return fits;}
 /** A native component affine is conjugated into the canonical head frame.
  * Body placement/cranial scale is factored out for Anny, then applied once. */
 shapeEye(model,name,sourceNow,referenceBind,out,joints,{scale,head}){const d=this.d,A=d[name+'_source_to_gnm'],M=inverseAffine(A),t=model.canonical.headTransform.translation,ref=d[name+'_neutral'],res=[];for(let eye=0;eye<2;eye++){const fit=componentFit(ref,sourceNow,d[name+'_eye_'+eye+'_ids'],{affine:name==='anny',scale:name==='mhr'});res.push(fit.maxResidual*1000);const apply=p=>{let q=point(M,[p[0],-p[2],p[1]]);q=point(fit.matrix,q);if(name==='anny')q=q.map((x,k)=>(x-head[k])/scale+model.referenceHead[k]);q=point(A,q);return q.map((x,k)=>head[k]+scale*(x+t[k]-model.referenceHead[k]));};for(const i of this.componentIds[eye+1])out.set(apply(xyz(referenceBind,i)),i*3);joints.set(apply(xyz(model.gnm._jointsBind,eye+2)),(eye+2)*3);}return res;}
 /** Shared morphology uses the exact registered source component delta, in
  * the same placed rest frame as the skin. Composing on the current component
  * preserves GNM identity/expression and preceding source layers. */
 composeEyeShape(model,name,sourceNow,out,joints,{scale,head},referenceSource=null){
  const d=this.d,A=d[name+'_source_to_gnm'],M=inverseAffine(A),t=model.canonical.headTransform.translation,res=[];
  const apply=(fit,p)=>{let q=p.map((x,c)=>(x-head[c])/scale+model.referenceHead[c]-t[c]);q=point(M,q);q=point(fit.matrix,q);q=point(A,q);return q.map((x,c)=>head[c]+scale*(x+t[c]-model.referenceHead[c]));};
  for(let eye=0;eye<2;eye++){
   const fit=componentFit(referenceSource||d[name+'_neutral'],sourceNow,d[name+'_eye_'+eye+'_ids'],{affine:name==='anny',scale:name==='mhr'});res.push(fit.maxResidual*1000);
   for(const i of this.componentIds[eye+1])out.set(apply(fit,xyz(out,i)),i*3);
   joints.set(apply(fit,xyz(joints,eye+2)),(eye+2)*3);
  }return res;
 }
 embedNativeTongue(model,out,{scale,head}){
  const ids=this.d.tongue_ids,reference=this.place(model,model.gnm.template,scale,head),fit=componentFit(reference,out,ids,{affine:true});
  for(let i=0;i<ids.length;i++){const delta=vector(fit.matrix,xyz(this.d.tongue_rest_delta,i).map(x=>x*scale));for(let c=0;c<3;c++)out[ids[i]*3+c]+=delta[c];}
 }
 attachOralToDentition(before,after,lowerFit){
  const d=this.d;if(!lowerFit)return;
  for(const i of d.oral_dental_upper)after.set(xyz(before,i),i*3);
  for(const i of d.oral_dental_lower)after.set(point(lowerFit.matrix,xyz(before,i)),i*3);
  const ids=d.oral_dental_free,boundary=d.oral_dental_boundary,w=d.oral_dental_weights;
  for(let row=0;row<ids.length;row++)for(let c=0;c<3;c++){let delta=0;for(let k=0;k<boundary.length;k++)delta+=w[row*boundary.length+k]*(after[boundary[k]*3+c]-before[boundary[k]*3+c]);after[ids[row]*3+c]=before[ids[row]*3+c]+delta;}
 }
 gaze(model,state,out,joints,{scale,head,bodyRest},sourceBase){
  const source=state.owners.gaze==='rig'?(state.owners.rig==='anny'?'anny':null):state.owners.gaze==='expression'?state.owners.expression:null;
  this.gazeDiagnostic={source,method:source==='mhr'?'native-periorbital-field-only':null,independentMHRGlobeRotationImplemented:false};
  // The MHR eye-look blendshape still deforms its mapped native skin field.
  // A rigid eyeball rotation must not be invented from an eyelid-cap fit.
  if(!source||source==='gnm'||source==='mhr')return[];
  const d=this.d,shape={phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges},base=model.anny.forward(shape),pose={};
  for(const key of['eye.L','eye.R'])pose[key]={rotation:state.anny.pose[key]||[0,0,0],translation:state.anny.translations[key]||[0,0,0]};
  const nativeRig=state.owners.gaze==='rig',result=model.anny.forward(nativeRig?{...shape,pose}:{...shape,facialActions:this.actions(state,{gazeOnly:true})});
  const A=d.anny_source_to_gnm,M=inverseAffine(A),res=[];
  for(let eye=0;eye<2;eye++){
   const j=model.anny.boneLabels.indexOf(eye===0?'eye.L':'eye.R'),ids=d['anny_eye_'+eye+'_ids'];
   let fit;
   if(nativeRig){const R=multiply(result.bonePoses.slice(j*16,j*16+16),inverseAffine(base.bonePoses.slice(j*16,j*16+16)));let max=0;for(const i of ids)max=Math.max(max,Math.hypot(...point(R,xyz(base.vertices,i)).map((x,c)=>x-result.vertices[i*3+c])));fit={matrix:R,maxResidual:max};}
   else fit=componentFit(base.vertices,result.vertices,ids,{affine:true});
   res.push(fit.maxResidual*1000);
   const R=fit.matrix,center=xyz(joints,eye+2),linear=identity();
   for(let c=0;c<3;c++){const e=[0,0,0];e[c]=1;const v=vector(A,vector(R,vector(M,e)));for(let r=0;r<3;r++)linear[r*4+c]=v[r];}
   const ca=xyz(base.boneHeads,j),shift=vector(A,point(R,ca).map((x,c)=>x-ca[c]));
   for(const i of this.componentIds[eye+1]){const delta=xyz(out,i).map((x,c)=>x-center[c]),q=vector(linear,delta);out.set(q.map((x,c)=>x+center[c]+shift[c]),i*3);}for(let c=0;c<3;c++)joints[(eye+2)*3+c]+=shift[c];
  }
  this.gazeDiagnostic={source,method:nativeRig?'native-eye-bone-pose-delta':'native-72-vertex-eye-component-affine',componentFitMaxMM:res,independentMHRGlobeRotationImplemented:false};return res;
 }

 compute(model,state,context){
  this._compoundMorphDelta=null;this.morphologyFieldDiagnostic=null;const shared=state.headShapeComposition==='shared-layers/1';
  const {bodyRest,scale,head}=context,shapeOwner=state.owners.headShape||'gnm',expressionOwner=state.owners.expression,gazeOwner=state.owners.gaze||'gnm';
  let preparedCorrective=null;if(state.owners.rig==='mhr'&&state.mhr.correctives){const engine=model.bodyDriver.mhr.engine,ms=this.mhrState(model,state,{pose:true}),on=engine.evaluate({...ms,correctives:true}),off=engine.evaluate({...ms,correctives:false}),a=sourceCoordinates('mhr',off.rest),b=sourceCoordinates('mhr',on.rest);const delta=this.extend(this.mapDelta('mhr',a,b,scale));if(delta.some(x=>x!==0))preparedCorrective=delta;}
  const sharedActive=shared&&(Object.entries(state.anny.phenotypes).some(([k,v])=>v!==(model.canonical.referenceAnnyPhenotypes[k]??.5))||Object.values(state.anny.localChanges).some(v=>v!==0)||state.mhr.identity.some(v=>v!==0));
  if(shapeOwner==='gnm'&&expressionOwner==='gnm'&&gazeOwner==='gnm'&&!preparedCorrective&&!sharedActive){model.headWorldOverride=null;model.activeGNMRootRestMatrix=null;this.last={nativeGNMPath:true};return;}
  const g=model.gnm,d=this.d,base=this.place(model,g._bind,scale,head),out=base.slice(),joints=this.place(model,g._jointsBind,scale,head),shape={phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges},sources={anny:bodyRest.vertices};let shapeDelta=new Float64Array(out.length),eyeShapeError=[];
  const shapeLayers=[];let lifecycleSource=null,compoundReference=base.slice(),dentalReference=base;
  if(shared||shapeOwner==='anny'){
   const normalized=new Float64Array(bodyRest.vertices.length);for(let i=0;i<normalized.length;i+=3)for(let c=0;c<3;c++)normalized[i+c]=(bodyRest.vertices[i+c]-head[c])/scale+model.referenceHead[c];
   let delta;
   if(shared){
    const global=Object.values(state.anny.localChanges).some(v=>v!==0)?model.anny.forward({phenotypes:state.anny.phenotypes}).vertices:bodyRest.vertices,globalNormalized=new Float64Array(global.length);for(let i=0;i<global.length;i+=3)for(let c=0;c<3;c++)globalNormalized[i+c]=(global[i+c]-head[c])/scale+model.referenceHead[c];
    if(!Object.entries(state.anny.phenotypes).some(([k,v])=>v!==(model.canonical.referenceAnnyPhenotypes[k]??.5))&&!Object.values(state.anny.localChanges).some(v=>v!==0))globalNormalized.set(d.anny_neutral);
    lifecycleSource=globalNormalized;delta=this.transportMorphology(model,d.anny_neutral,globalNormalized,out,context);this._compoundMorphDelta=delta.slice();dentalReference=base.slice();this.add(dentalReference,delta);
    // Local detail remains its original native field, applied after morphology.
    this.add(delta,this.extend(this.mapDelta('anny',globalNormalized,normalized,scale)));
   }else delta=this.extend(this.mapDelta('anny',d.anny_neutral,normalized,scale));
   this.add(shapeDelta,delta);shapeLayers.push({source:'anny',vertices:normalized,delta});
  }
  if(shared?state.mhr.identity.some(v=>v!==0):shapeOwner==='mhr'){
   const result=model.bodyDriver.mhr.engine.evaluate(this.mhrState(model,state));sources.mhr=sourceCoordinates('mhr',result.vertices);
   let delta=shared?this.transportMorphology(model,d.mhr_neutral,sources.mhr,compoundReference,context,'mhr'):this.extend(this.mapDelta('mhr',d.mhr_neutral,sources.mhr,scale));if(shared&&lifecycleSource){const native=delta;delta=this.transportCompoundDelta(model,lifecycleSource,compoundReference,native,context);this.add(compoundReference,native);this.add(dentalReference,delta);}this.add(shapeDelta,delta);shapeLayers.push({source:'mhr',vertices:sources.mhr,delta});
  }
  this.add(out,shapeDelta);
  if(shared||shapeOwner!=='gnm'){
   const fits=this.moveDental(shared?dentalReference:base,out,{upper:true,lower:true});
   if(fits[4]){for(const i of this.componentIds[5])out.set(point(fits[4].matrix,xyz(shared?dentalReference:base,i)),i*3);}
   if(shared){
    const eyePoints=joints.slice(6);if(sources.mhr)this.add(eyePoints,this.transportMorphology(model,d.mhr_neutral,sources.mhr,eyePoints,context,'mhr'));if(lifecycleSource)this.add(eyePoints,this.transportMorphology(model,d.anny_neutral,lifecycleSource,eyePoints,context));joints.set(eyePoints,6);
    if(Object.values(state.anny.localChanges).some(v=>v!==0)){const layer=shapeLayers.find(x=>x.source==='anny');if(layer)eyeShapeError.push(...this.composeEyeShape(model,'anny',layer.vertices,out,joints,context,lifecycleSource));}
   }
   else eyeShapeError=this.shapeEye(model,shapeOwner,sources[shapeOwner],g._bind,out,joints,context);
  }
  let exprDelta=new Float64Array(out.length),tongueDelta=null;
  if(expressionOwner==='anny'){const reference=shared?d.anny_neutral:bodyRest.vertices,result=model.anny.forward(shared?{phenotypes:model.canonical.referenceAnnyPhenotypes,facialActions:this.actions(state)}:{...shape,facialActions:this.actions(state)}),factor=shared?scale:1;exprDelta=this.extend(this.mapDelta('anny',reference,result.vertices,factor));const ids=d.tongue_ids,idx=d.tongue_indices,bary=d.tongue_bary,A=d.anny_source_to_gnm;tongueDelta=new Float64Array(ids.length*3);for(let i=0;i<ids.length;i++){const p=sample(reference,idx,bary,i),q=sample(result.vertices,idx,bary,i);tongueDelta.set(vector(A,q.map((x,c)=>(x-p[c])*factor)),i*3);}}
  if(expressionOwner==='mhr'){const engine=model.bodyDriver.mhr.engine,ms=this.mhrState(model,state),before=sources.mhr||sourceCoordinates('mhr',engine.evaluate(ms).vertices),after=sourceCoordinates('mhr',engine.evaluate(this.mhrState(model,state,{expression:true})).vertices);sources.mhr=before;exprDelta=this.extend(this.mapDelta('mhr',before,after,scale));}
  if(shared&&lifecycleSource&&['anny','mhr'].includes(expressionOwner)){const native=exprDelta;exprDelta=this.transportCompoundDelta(model,lifecycleSource,compoundReference,native,context);this.add(compoundReference,native);}
  if(expressionOwner==='anny')this.embedNativeTongue(model,out,context);
  const beforeExpression=out.slice();this.add(out,exprDelta);
  if(expressionOwner!=='gnm'){const fits=this.moveDental(beforeExpression,out);this.attachOralToDentition(beforeExpression,out,fits[4]);if(tongueDelta){for(let i=0;i<d.tongue_ids.length;i++)for(let c=0;c<3;c++)out[d.tongue_ids[i]*3+c]=beforeExpression[d.tongue_ids[i]*3+c]+tongueDelta[i*3+c];}else if(fits[4])for(const i of this.componentIds[5])out.set(point(fits[4].matrix,xyz(beforeExpression,i)),i*3);}
  let correctiveMaxMM=0;
  if(shared&&lifecycleSource&&preparedCorrective)preparedCorrective=this.transportCompoundDelta(model,lifecycleSource,compoundReference,preparedCorrective,context);
  if(preparedCorrective){for(let i=0;i<preparedCorrective.length;i++)correctiveMaxMM=Math.max(correctiveMaxMM,Math.abs(preparedCorrective[i])*1000);this.add(out,preparedCorrective);}
  const gazeError=this.gaze(model,state,out,joints,context,sources),posed=skinGNMRest(model,out,joints,scale);
  if(!posed.vertices.every(Number.isFinite))throw Error('Nonfinite common head');model.headWorldOverride=posed.vertices;model.activeGNMRootRestMatrix=posed.rootMatrix;model.lastHeadRig={jointsRest:joints,jointsPosed:posed.jointsPosed,nativeParents:Array.from(g.jointParents),nativeWeights:g.skinningWeights,restVertices:out};this.last={morphologyField:this.morphologyFieldDiagnostic,shapeComposition:state.headShapeComposition||'legacy-owner/1',shapeLayers:shapeLayers.map(l=>({source:l.source,maxDisplacementMM:Math.max(...l.delta.map(Math.abs))*1000})),shapeOwner,expressionOwner,gazeOwner,vertices:17821,outerVertices:this.outer.length,cavityVertices:1064,eyeShapeFitMaxMM:eyeShapeError,gazeComponentFitMaxMM:gazeError,gaze:this.gazeDiagnostic,correctiveMaxMM,fieldMapFixed:true,tongueNativeAnny:expressionOwner==='anny',tongueRestEmbedding:expressionOwner==='anny'?'registered-native-component':'GNM',oralAttachments:'native-GNM-dental-contact-anchors',gnmDentalTopologyPreserved:true};
 }
}
