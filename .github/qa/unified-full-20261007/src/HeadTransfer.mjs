import{identity,multiply,point,vector,xyz,componentFit,inverse3,sample,skinGNMRest}from'./HeadMath.mjs';
const TYPES={'<u4':Uint32Array,'<f4':Float32Array,'<f8':Float64Array};
const cavities=['oral_skin','nasal_skin','left_ocular_skin','right_ocular_skin'];
const zero=n=>Array(n).fill(0);
function inverseAffine(m){const a=inverse3([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]]),t=[m[3],m[7],m[11]],o=identity();for(let r=0;r<3;r++){for(let c=0;c<3;c++)o[r*4+c]=a[r*3+c];o[r*4+3]=-a.slice(r*3,r*3+3).reduce((s,x,c)=>s+x*t[c],0);}return o;}
function sourceCoordinates(name,v){if(name==='anny')return v;const o=new Float64Array(v.length);for(let i=0;i<v.length;i+=3){o[i]=v[i]/100;o[i+1]=-v[i+2]/100;o[i+2]=v[i+1]/100;}return o;}
export class HeadTransfer{
 constructor(meta,buffer){if(meta.schema!=='kaopu-semantic-head-adapter/1'||meta.gnmVertices!==17821||buffer.byteLength!==meta.binary.byteLength)throw Error('Unsupported head adapter');this.meta=meta;this.d={};for(const[n,a]of Object.entries(meta.arrays))this.d[n]=new TYPES[a.dtype](buffer,a.offset,a.length);this.outer=this.d.outer_ids;this.componentIds=Array.from({length:6},(_,c)=>Array.from(this.d.components).flatMap((v,i)=>v===c?[i]:[]));this.regionIds=Array.from({length:20},(_,c)=>Array.from(this.d.regions).flatMap((v,i)=>v===c?[i]:[]));}
 mapDelta(name,from,to,scale=1){const d=this.d,idx=d[name+'_indices'],b=d[name+'_bary'],A=d[name+'_source_to_gnm'],out=new Float64Array(17821*3);for(let i=0;i<this.outer.length;i++){const p=sample(from,idx,b,i),q=sample(to,idx,b,i),v=vector(A,q.map((x,k)=>(x-p[k])*scale));out.set(v,this.outer[i]*3);}return out;}
 extend(delta){for(const group of cavities){const ids=this.d[group+'_ids'],boundary=this.d[group+'_boundary'],weights=this.d[group+'_weights'];for(let r=0;r<ids.length;r++)for(let c=0;c<3;c++){let x=0;for(let k=0;k<boundary.length;k++)x+=weights[r*boundary.length+k]*delta[boundary[k]*3+c];delta[ids[r]*3+c]=x;}}return delta;}
 add(out,delta){for(let i=0;i<out.length;i++)out[i]+=delta[i];}
 place(model,v,scale,head){const out=new Float64Array(v.length),t=model.canonical.headTransform.translation;for(let i=0;i<v.length;i+=3){out[i]=head[0]+scale*(v[i]+t[0]-model.referenceHead[0]);out[i+1]=head[1]+scale*(-v[i+2]+t[1]-model.referenceHead[1]);out[i+2]=head[2]+scale*(v[i+1]+t[2]-model.referenceHead[2]);}return out;}
 mhrState(model,state,{expression=false,correctives=false,pose=false}={}){const owner=state.owners.headShape||'gnm',p=pose?state.mhr.pose.slice():zero(204);if(state.owners.headRig==='gnm')for(let i=24;i<=29;i++)p[i]=0;const e=expression?state.mhr.expression.slice():zero(72);if(state.owners.gaze!=='expression')for(let i=0;i<72;i++)if(model.mhrMeta.expression_names[i].startsWith('eyesLook'))e[i]=0;return{identity:owner==='mhr'?state.mhr.identity:zero(45),pose:p,expression:e,correctives};}
 actions(state,{gazeOnly=false}={}){const out={};for(const[k,v]of Object.entries(state.anny.facialActions)){const gaze=k.startsWith('eyeLook');if(gazeOnly?!gaze:(gaze&&state.owners.gaze!=='expression'))continue;out[k]=v;}return out;}
 moveDental(before,after,{upper=false,lower=true}={}){const fits={};for(const[c,ids]of[[3,this.regionIds[17]],[4,this.regionIds[19]]]){if((c===3&&!upper)||(c===4&&!lower))continue;const fit=componentFit(before,after,ids,{scale:upper});fits[c]=fit;for(const i of this.componentIds[c])after.set(point(fit.matrix,xyz(before,i)),i*3);}return fits;}
 /** A native component affine is conjugated into the canonical head frame.
  * Body placement/cranial scale is factored out for Anny, then applied once. */
 shapeEye(model,name,sourceNow,referenceBind,out,joints,{scale,head}){const d=this.d,A=d[name+'_source_to_gnm'],M=inverseAffine(A),t=model.canonical.headTransform.translation,ref=d[name+'_neutral'],res=[];for(let eye=0;eye<2;eye++){const fit=componentFit(ref,sourceNow,d[name+'_eye_'+eye+'_ids'],{affine:name==='anny',scale:name==='mhr'});res.push(fit.maxResidual*1000);const apply=p=>{let q=point(M,[p[0],-p[2],p[1]]);q=point(fit.matrix,q);if(name==='anny')q=q.map((x,k)=>(x-head[k])/scale+model.referenceHead[k]);q=point(A,q);return q.map((x,k)=>head[k]+scale*(x+t[k]-model.referenceHead[k]));};for(const i of this.componentIds[eye+1])out.set(apply(xyz(referenceBind,i)),i*3);joints.set(apply(xyz(model.gnm._jointsBind,eye+2)),(eye+2)*3);}return res;}
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
  const {bodyRest,scale,head}=context,shapeOwner=state.owners.headShape||'gnm',expressionOwner=state.owners.expression,gazeOwner=state.owners.gaze||'gnm';
  let preparedCorrective=null;if(state.owners.rig==='mhr'&&state.mhr.correctives){const engine=model.bodyDriver.mhr.engine,ms=this.mhrState(model,state,{pose:true}),on=engine.evaluate({...ms,correctives:true}),off=engine.evaluate({...ms,correctives:false}),a=sourceCoordinates('mhr',off.rest),b=sourceCoordinates('mhr',on.rest);const delta=this.extend(this.mapDelta('mhr',a,b,scale));if(delta.some(x=>x!==0))preparedCorrective=delta;}
  if(shapeOwner==='gnm'&&expressionOwner==='gnm'&&gazeOwner==='gnm'&&!preparedCorrective){model.headWorldOverride=null;model.activeGNMRootRestMatrix=null;this.last={nativeGNMPath:true};return;}
  const g=model.gnm,d=this.d,base=this.place(model,g._bind,scale,head),out=base.slice(),joints=this.place(model,g._jointsBind,scale,head),shape={phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges},sources={anny:bodyRest.vertices};let shapeDelta=new Float64Array(out.length),eyeShapeError=[];
  if(shapeOwner==='anny'){const normalized=new Float64Array(bodyRest.vertices.length);for(let i=0;i<normalized.length;i+=3)for(let c=0;c<3;c++)normalized[i+c]=(bodyRest.vertices[i+c]-head[c])/scale+model.referenceHead[c];shapeDelta=this.extend(this.mapDelta('anny',d.anny_neutral,normalized,scale));}
  if(shapeOwner==='mhr'){const result=model.bodyDriver.mhr.engine.evaluate(this.mhrState(model,state));sources.mhr=sourceCoordinates('mhr',result.vertices);shapeDelta=this.extend(this.mapDelta('mhr',d.mhr_neutral,sources.mhr,scale));}
  this.add(out,shapeDelta);
  if(shapeOwner!=='gnm'){
   const fits=this.moveDental(base,out,{upper:true,lower:true});if(fits[4])for(const i of this.componentIds[5])out.set(point(fits[4].matrix,xyz(base,i)),i*3);
   eyeShapeError=this.shapeEye(model,shapeOwner,sources[shapeOwner],g._bind,out,joints,context);
  }
  let exprDelta=new Float64Array(out.length),tongueDelta=null;
  if(expressionOwner==='anny'){const result=model.anny.forward({...shape,facialActions:this.actions(state)});exprDelta=this.extend(this.mapDelta('anny',bodyRest.vertices,result.vertices));const ids=d.tongue_ids,idx=d.tongue_indices,bary=d.tongue_bary,A=d.anny_source_to_gnm;tongueDelta=new Float64Array(ids.length*3);for(let i=0;i<ids.length;i++){const p=sample(bodyRest.vertices,idx,bary,i),q=sample(result.vertices,idx,bary,i);tongueDelta.set(vector(A,q.map((x,c)=>x-p[c])),i*3);}}
  if(expressionOwner==='mhr'){const engine=model.bodyDriver.mhr.engine,ms=this.mhrState(model,state),before=sources.mhr||sourceCoordinates('mhr',engine.evaluate(ms).vertices),after=sourceCoordinates('mhr',engine.evaluate(this.mhrState(model,state,{expression:true})).vertices);sources.mhr=before;exprDelta=this.extend(this.mapDelta('mhr',before,after,scale));}
  const beforeExpression=out.slice();this.add(out,exprDelta);
  if(expressionOwner!=='gnm'){const fits=this.moveDental(beforeExpression,out);if(tongueDelta){for(let i=0;i<d.tongue_ids.length;i++)for(let c=0;c<3;c++)out[d.tongue_ids[i]*3+c]=beforeExpression[d.tongue_ids[i]*3+c]+tongueDelta[i*3+c];}else if(fits[4])for(const i of this.componentIds[5])out.set(point(fits[4].matrix,xyz(beforeExpression,i)),i*3);}
  let correctiveMaxMM=0;
  if(preparedCorrective){for(let i=0;i<preparedCorrective.length;i++)correctiveMaxMM=Math.max(correctiveMaxMM,Math.abs(preparedCorrective[i])*1000);this.add(out,preparedCorrective);}
  const gazeError=this.gaze(model,state,out,joints,context,sources),posed=skinGNMRest(model,out,joints,scale);
  if(!posed.vertices.every(Number.isFinite))throw Error('Nonfinite common head');model.headWorldOverride=posed.vertices;model.activeGNMRootRestMatrix=posed.rootMatrix;model.lastHeadRig={jointsRest:joints,jointsPosed:posed.jointsPosed,nativeParents:Array.from(g.jointParents),nativeWeights:g.skinningWeights,restVertices:out};this.last={shapeOwner,expressionOwner,gazeOwner,vertices:17821,outerVertices:this.outer.length,cavityVertices:1064,eyeShapeFitMaxMM:eyeShapeError,gazeComponentFitMaxMM:gazeError,gaze:this.gazeDiagnostic,correctiveMaxMM,fieldMapFixed:true,tongueNativeAnny:expressionOwner==='anny',gnmDentalTopologyPreserved:true};
 }
}
