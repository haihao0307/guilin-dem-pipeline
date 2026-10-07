import fs from'node:fs';import assert from'node:assert/strict';import{createBodyAdapter}from'./load-adapter.mjs';import{I,mul}from'./math.mjs';
const a=createBodyAdapter(),cases=JSON.parse(fs.readFileSync(new URL('experiment-r1/repair-test-report.json',import.meta.url))).cases,results={};
const max=(x,y)=>{let m=0;for(let i=0;i<x.length;i++)m=Math.max(m,Math.abs(x[i]-y[i]));return m;};
for(const[name,c]of Object.entries({...cases,identity_expression_pose:{pose:{44:.4,46:1},identity:{0:.6,1:-.3},expression:{0:.3,20:.2}}})){
 const s=a.zeroState();for(const[g,vs]of Object.entries(c))if(['pose','identity','expression'].includes(g))for(const[k,v]of Object.entries(vs))s[g][k]=v;
 const r=a.evaluate(s),packet=a.influenceRestPacket(r),reskinned=a.skinInfluenceRestPacket(packet),plain=max(reskinned,r.vertices)*1000;
 const G=I();G[3]=.01;G[7]=-.02;G[11]=.015;const cranial=new Set(a.names.map((n,j)=>j>=110?j:-1).filter(j=>j>=0)),skin=packet.skinMatrices.map((m,j)=>cranial.has(j)?mul(G,m):m),modified=a.skinInfluenceRestPacket(packet,skin),expected=reskinned.slice();let partial=0,maxDoubleWeightCounterexample=0;
 for(let i=0;i<a.bodyCount;i++){let mass=0;for(let k=packet.weights.ptr[i];k<packet.weights.ptr[i+1];k++)if(cranial.has(packet.weights.joints[k]))mass+=packet.weights.values[k];for(let c=0;c<3;c++)expected[i*3+c]+=mass*[.01,-.02,.015][c];if(mass>.05&&mass<.95){partial++;maxDoubleWeightCounterexample=Math.max(maxDoubleWeightCounterexample,mass*(1-mass)*.02*1000);}}
 const bridge=max(modified,expected)*1000;assert.ok(plain<.001);assert.ok(bridge<.001);assert.ok(partial>0);assert.equal(packet.targetPosedMatrices.length,127);
 results[name]={defaultFormulaUnchanged:true,packetVersusDefaultMaxComponentMM:plain,analyticPartialCranialTranslationMaxComponentMM:bridge,mixedWeightVertices:partial,wrongExtraWeightMaxErrorMM:maxDoubleWeightCounterexample,jointCount:127,slotCount:packet.weights.values.length};
}
fs.writeFileSync(new URL('cranial-hook-report.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
