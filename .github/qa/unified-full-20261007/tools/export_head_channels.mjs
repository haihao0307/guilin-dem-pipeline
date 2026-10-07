/** Native teacher outputs for transfer-quality tests, never synthetic controls. */
import fs from 'node:fs';
import {loadAnny,loadGNM,loadMHR} from '../teachers.mjs';
const out=new URL('../research/head-channels/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const write=(n,a)=>fs.writeFileSync(new URL(n,out),Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const anny=loadAnny(),mhr=loadMHR(),gnm=loadGNM(),manifest={sources:{},gnm:{vertices:gnm.numVertices,expressions:gnm.expressionDim},cases:[]};
write('gnm-expression-basis.i8',gnm.expressionBasis);write('gnm-expression-scales.f32',gnm.expressionScales);
for(const teacher of ['anny','mhr']){
 const labels=teacher==='anny'?anny.facialActionLabels:mhr.meta.expression_names;
 const neutral=teacher==='anny'?anny.forward({phenotypes:{age:2/3}}).vertices:mhr.evaluate().vertices;
 const n=neutral.length,delta=new Float32Array(n*labels.length);
 for(let k=0;k<labels.length;k++){
  let v;if(teacher==='anny')v=anny.forward({phenotypes:{age:2/3},facialActions:{[labels[k]]:1}}).vertices;
  else{const s={...mhr.state,expression:new Float32Array(72)};s.expression[k]=1;v=mhr.evaluate(s).vertices;}
  for(let i=0;i<n;i++)delta[k*n+i]=v[i]-neutral[i];
 }
 write(teacher+'-neutral.f32',neutral);write(teacher+'-expression-deltas.f32',delta);
 manifest.sources[teacher]={labels,vertices:n/3,coordinates:teacher==='anny'?'metres Z-up':'centimetres Y-up'};
}
for(const [name,age]of[['newborn',-1/3],['baby',0],['child',1/3],['adult',2/3],['old',1]]){
 for(const [expression,actions]of[['neutral',{}],['blink',{eyeBlinkLeft:1,eyeBlinkRight:1}],['jawOpen',{jawOpen:1}],['tongueOut',{tongueOut:1}],['mixed',{jawOpen:.35,mouthSmileLeft:.5,mouthSmileRight:.5,eyeBlinkLeft:.25}]]){
  const s={phenotypes:{age},facialActions:actions},v=anny.forward(s).vertices,id='anny-'+name+'-'+expression;write(id+'.f32',v);manifest.cases.push({id,teacher:'anny',age,actions});
 }
}
for(const [name,values]of[['neutral',{}],['blink',{eyesClosed_L:1,eyesClosed_R:1}],['jawOpen',{jawDrop:1}],['gazeDown',{eyesLookDown_L:1,eyesLookDown_R:1}],['mixed',{jawDrop:.35,lipCornerPuller_L:.5,lipCornerPuller_R:.5,eyesClosed_L:.25}]]){
 const s={...mhr.state,expression:new Float32Array(72)};for(const[k,v]of Object.entries(values))s.expression[mhr.meta.expression_names.indexOf(k)]=v;
 const v=mhr.evaluate(s).vertices,id='mhr-adult-'+name;write(id+'.f32',v);manifest.cases.push({id,teacher:'mhr',expression:values});
}
fs.writeFileSync(new URL('manifest.json',out),JSON.stringify(manifest,null,2));console.log({exportedNativeExpressions:124,cases:manifest.cases.length});
