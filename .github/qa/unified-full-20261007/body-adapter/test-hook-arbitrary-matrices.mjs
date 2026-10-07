import fs from'node:fs';import assert from'node:assert/strict';import{createBodyAdapter}from'./load-adapter.mjs';import{mul,inv,point,vector,quaternionMatrix}from'./math.mjs';
const a=createBodyAdapter(),s=a.zeroState();s.pose[4]=.3;s.pose[44]=.4;s.pose[46]=1;s.pose[47]=.7;s.identity[0]=.6;s.identity[1]=-.3;s.expression[0]=.3;const r=a.evaluate(s),packet=a.influenceRestPacket(r),report={};
const max=(x,y)=>{let d=0;for(let i=0;i<x.length;i++)d=Math.max(d,Math.abs(x[i]-y[i]));return d;};
function perSource(finalSkin){
 const frames=finalSkin.map((m,j)=>mul(m,mul(r.targetRestMatrices[j],a.sourceBindInverse[j]))),deltas=new Float64Array(a.engine.meta.vertices*3),out=new Float32Array(a.bodyCount*3);
 for(let v=0;v<a.engine.meta.vertices;v++){
  const o=v*3,d=[(r.native.rest[o]-a.nativeNeutral.rest[o])/100,-(r.native.rest[o+2]-a.nativeNeutral.rest[o+2])/100,(r.native.rest[o+1]-a.nativeNeutral.rest[o+1])/100];
  for(const[j,w]of a.sourceInfluences[v]){const q=vector(frames[j],d);for(let c=0;c<3;c++)deltas[o+c]+=w*r.targetBinding.scales[j]*q[c];}
 }
 for(let i=0;i<a.bodyCount;i++){
  const sum=[0,0,0],p=Array.from(r.restVertices.slice(i*3,i*3+3));for(let k=a.weights.ptr[i];k<a.weights.ptr[i+1];k++){const q=point(finalSkin[a.weights.joints[k]],p);for(let c=0;c<3;c++)sum[c]+=a.weights.values[k]*q[c];}
  for(let k=0;k<3;k++){const v=a.mapIndices[i*3+k],w=a.mapBary[i*3+k]/a.mapWeightSums[i];for(let c=0;c<3;c++)sum[c]+=w*deltas[v*3+c];}out.set(sum,i*3);
 }return out;
}
const G=quaternionMatrix([Math.sin(.2),0,0,Math.cos(.2)],[.02,-.01,.03],1.08);
const scenarios={rest_root_then_body:r.skinMatrices.map((m,j)=>j>=110?mul(m,G):m),posed_world_root:r.skinMatrices.map((m,j)=>j>=110?mul(G,m):m),arbitrary_per_joint:r.skinMatrices.map((m,j)=>mul(m,quaternionMatrix([Math.sin((j%7)*.025),0,0,Math.cos((j%7)*.025)],[.001*(j%3),-.002*(j%5),.001*(j%4)],1+.002*(j%6))))};
for(const[name,skin]of Object.entries(scenarios)){
 const direct=perSource(skin),fromSkin=a.skinInfluenceRestPacket(packet,{skinMatrices:skin}),posed=skin.map((m,j)=>mul(m,r.targetRestMatrices[j])),fromPosed=a.skinInfluenceRestPacket(packet,{posedMatrices:posed});
 report[name]={packetVersusPerSourceMaxMM:max(fromSkin,direct)*1000,posedVersusSkinInputMaxMM:max(fromSkin,fromPosed)*1000,joints:posed.length};assert.ok(report[name].packetVersusPerSourceMaxMM<.001);assert.ok(report[name].posedVersusSkinInputMaxMM<.001);
}
report.compositionOrderObservableMaxMM=max(a.skinInfluenceRestPacket(packet,{skinMatrices:scenarios.rest_root_then_body}),a.skinInfluenceRestPacket(packet,{skinMatrices:scenarios.posed_world_root}))*1000;assert.ok(report.compositionOrderObservableMaxMM>.01);
fs.writeFileSync(new URL('hook-arbitrary-matrix-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
