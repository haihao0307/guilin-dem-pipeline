import assert from 'node:assert/strict';
import * as K from './r045_round02_kernel.mjs';
const checks=[]; const ok=(name,pass,detail)=>{checks.push({name,pass,detail}); if(!pass) throw new Error(`${name}: ${JSON.stringify(detail)}`)};
const ids=[...K.nodes.map(n=>n.id),...K.edges.map(e=>e.id)]; ok('unique-identities',new Set(ids).size===ids.length,{count:ids.length});
const transfer=K.edges.filter(e=>e.transportPermitted); ok('no-inferred-water-state',transfer.every(e=>e.currentGateState===null&&e.currentFlowM3s===null&&e.storedVolumeM3===null),{interfaces:transfer.length});
const nodeIds=new Set(K.nodes.map(n=>n.id)); ok('valid-transfer-endpoints',transfer.every(e=>nodeIds.has(e.from)&&nodeIds.has(e.to)),{});
const adj=new Map(K.nodes.map(n=>[n.id,[]])); for(const e of transfer)adj.get(e.from).push(e.to);
function reaches(a,b){const q=[a],seen=new Set(q);while(q.length){const n=q.shift();if(n===b)return true;for(const m of adj.get(n)||[])if(!seen.has(m)){seen.add(m);q.push(m)}}return false}
ok('all-sources-reach-front-river',['SRC-A','SRC-B','SRC-C'].every(s=>reaches(s,'RIVER')),{});
const temp=new Set(),perm=new Set(); let cycle=false; function dfs(n){if(temp.has(n)){cycle=true;return}if(perm.has(n))return;temp.add(n);for(const m of adj.get(n)||[])dfs(m);temp.delete(n);perm.add(n)} for(const n of nodeIds)dfs(n);ok('transfer-graph-acyclic',!cycle,{});
let maxRise=-Infinity,riseAt=null,prev=K.height(0,K.WORLD.slope0);for(let z=K.WORLD.slope0+4;z<=145;z+=4){const h=K.height(0,z),r=h-prev;if(r>maxRise){maxRise=r;riseAt=z}prev=h}ok('single-forward-descent',maxRise<.55,{maxRisePer4m:maxRise,riseAt});
let beyondMax=0;for(let x=-210;x<=210;x+=10)for(let z=190;z<=205;z+=5)beyondMax=Math.max(beyondMax,K.suitability(x,z));ok('no-opposite-agricultural-wall',beyondMax===0,{beyondMaxSuitability:beyondMax});
let rzMin=Infinity,rzMax=-Infinity;for(let x=-230;x<=230;x+=5){const z=K.riverZ(x);rzMin=Math.min(rzMin,z);rzMax=Math.max(rzMax,z)}ok('front-river-terminal-band',rzMin>=154&&rzMax<=188,{rzMin,rzMax});
const reliefSamples=[{id:'A',valleyX:-126,divideX:-67},{id:'B',valleyX:3,divideX:66},{id:'C',valleyX:119,divideX:190}].map(q=>{const vals=[-120,-90,-60,-30].map(z=>K.height(q.divideX,z)-K.height(q.valleyX,z));return{id:q.id,mean:vals.reduce((a,b)=>a+b,0)/vals.length,vals}});
const reliefMeans=reliefSamples.map(q=>q.mean),reliefMean=reliefMeans.reduce((a,b)=>a+b,0)/3,reliefStd=Math.sqrt(reliefMeans.reduce((s,v)=>s+(v-reliefMean)**2,0)/3);
ok('hydrology-shaped-ridge-valley-relief',Math.min(...reliefMeans)>1.35,{reliefSamples,reliefStd});
ok('catchment-asymmetry-present',reliefStd>.35,{reliefMeans,reliefStd});
const fanProfiles=K.fanHeads.map(f=>{const samples=[0,16,32,48,64].map(dz=>{const x=f.x+Math.tan(f.azimuth)*dz;return K.fanField(x,f.z+dz)});return{id:f.id,samples,declining:samples.every((v,i)=>i===0||v<samples[i-1])}});
ok('foothill-fan-proxy-declines-downfan',fanProfiles.every(f=>f.declining),{fanProfiles});
const fanContinuity=[];for(const f of K.fanHeads){let worst=-Infinity,at=null,prev=K.height(f.x,f.z-28);for(let dz=-24;dz<=72;dz+=4){const x=f.x+Math.tan(f.azimuth)*Math.max(0,dz),h=K.height(x,f.z+dz),r=h-prev;if(r>worst){worst=r;at=dz}prev=h}fanContinuity.push({id:f.id,worstRisePer4m:worst,at})}
ok('fan-transition-no-cliff',fanContinuity.every(f=>f.worstRisePer4m<.85),{fanContinuity});
let permitted=0,total=0,streamPerm=0,streamN=0,interPerm=0,interN=0;for(let x=-200;x<=200;x+=4)for(let z=-155;z<=8;z+=4){const p=K.terracePermission(x,z);total++;if(p>.65)permitted++;const d=K.nearestStreamDistance(x,z);if(d<6){streamPerm+=p;streamN++}else if(d>18){interPerm+=p;interN++}}
const permittedFraction=permitted/total,streamMean=streamPerm/(streamN||1),interMean=interPerm/(interN||1);
ok('terrace-permission-is-mask-not-everywhere',permittedFraction>.18&&permittedFraction<.62,{permittedFraction});
ok('terrace-zones-avoid-major-gullies',streamMean<.12&&interMean>streamMean+.25,{streamMean,interMean});
const snap=K.snapshot();ok('no-sediment-simulation-overclaim',snap.physicsClaims.sedimentTransportSimulation===false&&snap.physicsClaims.realFlowRates===false,{physicsClaims:snap.physicsClaims});
const result={version:K.VERSION,passed:checks.every(x=>x.pass),checks,summary:{nodes:K.nodes.length,edges:K.edges.length,permittedTransfers:transfer.length,maxRisePer4m:maxRise,riverZ:[rzMin,rzMax],ridgeValleyReliefMean:reliefMean,ridgeValleyReliefStd:reliefStd,terracePermittedFraction:permittedFraction,streamPermissionMean:streamMean,interfluvePermissionMean:interMean,fanProfiles}};
console.log(JSON.stringify(result,null,2));
