import fs from'node:fs';import assert from'node:assert/strict';import{createBodyAdapter}from'./load-adapter.mjs';import{CommonBodyDriver}from'./CommonBodyDriver.mjs';import{I,mul,inv,point,vector,quaternionMatrix}from'./math.mjs';
const adapter=createBodyAdapter(),d=new CommonBodyDriver({mhrAdapter:adapter}),a=adapter.anny;
const state=()=>({owners:{rig:'anny',headRig:'body',expression:'gnm'},anny:{phenotypes:{gender:.5,age:2/3,muscle:.5,weight:.5,height:.5,proportions:.5},localChanges:{},pose:{},translations:{},facialActions:{}},mhr:{identity:Array(45).fill(0),pose:Array(204).fill(0),expression:Array(72).fill(0),correctives:true}});
const clone=s=>structuredClone(s),max=(x,y)=>{let m=0;for(let i=0;i<x.length;i++)m=Math.max(m,Math.abs(x[i]-y[i]));return m;};
const report={scope:'independent fixed canonical body driver; no head geometry or neck repair',topologySha256:adapter.canonical.topologySha256,bodyCount:9253,tests:{},ageAnchors:{}};
const check=(name,pass,extra={})=>{assert.ok(pass,name);report.tests[name]={passed:true,...extra};};
function directAnny(result,sharedDeltaOverride=null,wrongCollapsed=false){
 const zero=result.nativeResult.zero,delta=sharedDeltaOverride||result.sharedRestDisplacement,w=a.arrays,out=new Float32Array(9253*3);
 for(let i=0;i<9253;i++){
  const sum=[0,0,0],[u,v,t]=adapter.canonical.annyRecipes[i];
  for(const[source,b]of[[u,1-t],[v,t]])if(b)for(let k=0;k<a.influences;k++){
   const slot=source*a.influences+k,weight=b*w.vertex_bone_weights[slot];if(!weight)continue;const j=w.vertex_bone_indices[slot];
   const p=wrongCollapsed?Array.from(zero.vertices.slice(source*3,source*3+3)):point(Array.from(zero.boneTransforms.slice(j*16,j*16+16)),Array.from(zero.restVertices.slice(source*3,source*3+3)));
   for(let c=0;c<3;c++)p[c]+=delta[i*3+c];const q=point(result.rig.skinMatrices[j],p);for(let c=0;c<3;c++)sum[c]+=weight*q[c];
  }out.set(sum,i*3);
 }return out;
}
function directMHR(result){
 const native=result.nativeResult,skin=result.rig.skinMatrices,frames=skin.map((m,j)=>mul(m,mul(native.targetRestMatrices[j],adapter.sourceBindInverse[j]))),delta=new Float64Array(adapter.engine.meta.vertices*3),out=new Float32Array(9253*3);
 for(let v=0;v<adapter.engine.meta.vertices;v++){const o=v*3,p=[(native.native.rest[o]-adapter.nativeNeutral.rest[o])/100,-(native.native.rest[o+2]-adapter.nativeNeutral.rest[o+2])/100,(native.native.rest[o+1]-adapter.nativeNeutral.rest[o+1])/100];for(const[j,w]of adapter.sourceInfluences[v]){const q=vector(frames[j],p);for(let c=0;c<3;c++)delta[o+c]+=w*native.targetBinding.scales[j]*q[c];}}
 for(let i=0;i<9253;i++){const sum=[0,0,0],p=Array.from(native.restVertices.slice(i*3,i*3+3)),w=adapter.weights;for(let k=w.ptr[i];k<w.ptr[i+1];k++){const q=point(skin[w.joints[k]],p);for(let c=0;c<3;c++)sum[c]+=w.values[k]*q[c];}for(let k=0;k<3;k++){const v=adapter.mapIndices[i*3+k],b=adapter.mapBary[i*3+k]/adapter.mapWeightSums[i];for(let c=0;c<3;c++)sum[c]+=b*delta[v*3+c];}out.set(sum,i*3);}return out;
}
const neutral=state(),n=d.evaluate(neutral),nativeNeutral=d.sampleAnny(a.forward({phenotypes:neutral.anny.phenotypes}).vertices);
check('neutral_byte_exact',max(n.vertices,nativeNeutral)===0);check('same_canonical_body_count',n.vertices.length===9253*3&&n.headGeometryEvaluated===false&&n.neckRepairApplied===false);
for(const rig of['anny','mhr']){
 const s=state();s.owners.rig=rig;s.mhr.identity[0]=.6;s.mhr.identity[11]=-.3;s.anny.pose={'root':[0,0,20],'lowerarm01.L':[25,0,0]};s.mhr.pose[46]=1;s.mhr.pose[142]=.1;
 const before=JSON.stringify(s),r=d.evaluate(s);check(rig+'_state_not_mutated',JSON.stringify(s)===before);check(rig+'_joint_count',r.rig.names.length===(rig==='anny'?104:127));
 const quiet=clone(s);if(rig==='anny'){quiet.mhr.pose[46]=.2;quiet.mhr.pose[142]=-.1;quiet.mhr.correctives=false;}else{quiet.anny.pose={'root':[40,10,0],'lowerarm01.L':[-50,0,0]};quiet.anny.translations={root:[.2,0,0]};}
 check(rig+'_inactive_rig_fields_exact',max(r.vertices,d.evaluate(quiet).vertices)===0);
 const inactiveExpression=clone(s);inactiveExpression.mhr.expression[24]=.7;check(rig+'_inactive_mhr_expression_exact',max(r.vertices,d.evaluate(inactiveExpression).vertices)===0);
 const activeExpression=clone(inactiveExpression);activeExpression.owners.expression='mhr';check(rig+'_active_mhr_expression_changes_body',max(r.vertices,d.evaluate(activeExpression).vertices)>1e-7);
 const off=clone(s);off.mhr.identity.fill(0);check(rig+'_shared_mhr_identity_active',max(r.vertices,d.evaluate(off).vertices)>.0001);
 const first=r.vertices.slice(),other=clone(s);other.owners.rig=rig==='anny'?'mhr':'anny';d.evaluate(other);check(rig+'_source_switch_back_exact',max(first,d.evaluate(s).vertices)===0);
 const snap=d.exportSnapshot(r);let round=0;for(let i=0;i<9253;i++){const p=Array.from(r.vertices.slice(i*3,i*3+3)),sum=[0,0,0],w=r.rig.weights;for(let k=w.ptr[i];k<w.ptr[i+1];k++){const j=w.joints[k],q=point(mul(snap.jointWorld[j],snap.snapshotInverseBindWorld[j]),p);for(let c=0;c<3;c++)sum[c]+=w.values[k]*q[c];}round=Math.max(round,max(sum,p)*1000);}check(rig+'_snapshot_roundtrip',round<.001,{maxComponentMM:round});
}
// Both rigs agree exactly on the shared zero-articulation shape, including MHR identity.
const shared=state();shared.mhr.identity[0]=.6;shared.mhr.identity[22]=.4;shared.anny.localChanges={'l-upperarm-fat-incr':.2};const srA=d.evaluate(shared);shared.owners.rig='mhr';const srM=d.evaluate(shared);check('same_shared_rest_both_rigs',max(srA.vertices,srM.vertices)===0);
for(const age of[-1/3,0,1/3,2/3,1]){
 const s=state();s.anny.phenotypes.age=age;const z=d.evaluate(s),expected=d.sampleAnny(a.forward({phenotypes:s.anny.phenotypes}).vertices);assert.equal(max(z.vertices,expected),0);
 s.anny.pose={'upperarm01.L':[25,10,-15],'lowerarm01.L':[35,-10,5],'wrist.L':[10,15,0],'neck01':[5,0,3]};const posed=d.evaluate(s),packet=d.skinAnnyPacket(posed.packet,posed.rig.skinMatrices),native=d.sampleAnny(posed.nativeResult.posed.vertices),packetError=max(packet,native)*1000;
 assert.ok(packetError<.001);s.mhr.identity[0]=.3;s.mhr.identity[18]=-.2;const combined=d.evaluate(s),gold=directAnny(combined),error=max(combined.vertices,gold)*1000;assert.ok(error<.001);
 const wrong=directAnny(combined,null,true);report.ageAnchors[String(age)]={neutralByteExact:true,nativeAnnyPoseByteExact:max(posed.vertices,native)===0,conditionedPacketNativeMaxComponentMM:packetError,combinedIdentityPosePerSourceMaxComponentMM:error,wrongCollapsedZeroRestMaxComponentMM:max(combined.vertices,wrong)*1000};
}
// Caller-supplied G is in common rest coordinates and acts BEFORE outer body skin.
const G=quaternionMatrix([Math.sin(.15),0,0,Math.cos(.15)],[.01,-.02,.015]);
for(const rig of['anny','mhr']){
 const s=state();s.owners={rig,headRig:'gnm',expression:'mhr'};s.mhr.identity[0]=.5;s.mhr.expression[24]=.25;
 s.anny.pose={root:[0,0,30],'lowerarm01.L':[25,10,0],neck01:[25,0,0],head:[0,20,0],'eye.L':[0,0,15]};s.mhr.pose[4]=.3;s.mhr.pose[46]=1;s.mhr.pose[24]=.2;s.mhr.pose[27]=.15;
 const saved=JSON.stringify(s),r=d.evaluate(s,{gnmRootRestMatrix:G}),cleared=clone(s);check(rig+'_suppressed_cranial_values_saved',JSON.stringify(s)===saved);for(let i=24;i<=29;i++)cleared.mhr.pose[i]=0;for(const name of['neck01','head','eye.L'])delete cleared.anny.pose[name];
 check(rig+'_gnm_owner_suppresses_saved_cranial_pose',max(r.vertices,d.evaluate(cleared,{gnmRootRestMatrix:G}).vertices)===0);
 const packetGold=rig==='mhr'?directMHR(r):directAnny(r);check(rig+'_gnm_root_packet_gold',max(r.vertices,packetGold)*1000<.001,{maxComponentMM:max(r.vertices,packetGold)*1000});
 const cranial=new Set(r.rig.cranialIndices),wrongSkin=r.rig.originalSkinMatrices.map((m,j)=>cranial.has(j)?mul(G,m):m),wrong=rig==='mhr'?adapter.skinInfluenceRestPacket(r.packet,{skinMatrices:wrongSkin}):d.skinAnnyPacket(r.packet,wrongSkin);
 check(rig+'_root_order_counterexample',max(r.vertices,wrong)*1000>1,{wrongOrderMaxComponentMM:max(r.vertices,wrong)*1000});
 let matricesError=0;for(const j of cranial)matricesError=Math.max(matricesError,max(r.rig.skinMatrices[j],mul(r.rig.originalSkinMatrices[j],G)));check(rig+'_cranial_matrix_order_exact',matricesError===0);
 const noG=d.evaluate(s);for(const alias of['neck02','head']){check(rig+'_'+alias+'_body_attachment_excludes_gnm',max(r.attachmentBodySkinMatrices[alias],noG.attachmentSkinMatrices[alias])===0);check(rig+'_'+alias+'_final_attachment_includes_gnm',max(r.attachmentSkinMatrices[alias],mul(r.attachmentBodySkinMatrices[alias],G))===0);}
 const own=clone(s);own.owners.headRig='body';const withG=d.evaluate(own,{gnmRootRestMatrix:G}),withoutG=d.evaluate(own);check(rig+'_body_head_owner_disables_gnm_G',max(withG.vertices,withoutG.vertices)===0&&!withG.gnmRootApplied);
 const rotationsOff=clone(own);for(let i=24;i<=29;i++)rotationsOff.mhr.pose[i]=0;for(const name of['neck01','head','eye.L'])delete rotationsOff.anny.pose[name];check(rig+'_body_head_owner_activates_native_cranial_pose',max(withoutG.vertices,d.evaluate(rotationsOff).vertices)>1e-5);
}
// Age-specific native bind contributions must also survive G in rest space.
for(const age of[-1/3,0,1/3,2/3,1]){const s=state();s.owners.headRig='gnm';s.anny.phenotypes.age=age;s.anny.pose={root:[0,0,25],'lowerarm01.L':[20,10,0]};s.mhr.identity[0]=.3;const r=d.evaluate(s,{gnmRootRestMatrix:G}),gold=directAnny(r);check('anny_age_'+age+'_gnm_and_root_per_source_gold',max(r.vertices,gold)*1000<.001,{maxComponentMM:max(r.vertices,gold)*1000});}
// Identity-root neutral is exact even when inactive saved articulation is nonzero.
for(const rig of['anny','mhr']){const s=state();s.owners={rig,headRig:'gnm',expression:'gnm'};s.anny.pose={head:[20,0,0]};s.mhr.pose[24]=.3;s.mhr.pose[27]=.2;const r=d.evaluate(s,{gnmRootRestMatrix:I()});check(rig+'_neutral_with_saved_inactive_head_pose',max(r.vertices,n.vertices)===0);}
report.passed=true;fs.writeFileSync(new URL('common-body-driver-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,testCount:Object.keys(report.tests).length,ageAnchors:report.ageAnchors,examples:report.tests.anny_root_order_counterexample},null,2));
