import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
vm.runInThisContext(fs.readFileSync(path.join(root,'src/instrument.js'),'utf8'));
const A=globalThis.KaopuFishSpineFin,score=new Uint8Array(fs.readFileSync(path.join(root,'data/MUSKELLUNGE_RESOLVED_SPINE_FIN_SCORE_R06.kfc6'))),h=await A.build(score);
const report={startedAt:new Date().toISOString(),abi:A.ABI,checks:{},humanAcceptance:false};
const check=(name,passed,details)=>{report.checks[name]={passed,...details};if(!passed)throw Error(name+' failed '+JSON.stringify(details));};
const options=(mode,finGains=Array(7).fill(1))=>({mode,finGains,speed:1,amplitude:1});
const run=(mode,gains,t=2)=>{A.reset(h,mode,options(mode,gains));for(let i=0;i<Math.round(t*60);i++)A.update(h,1/60,options(mode,gains));};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
try{
 const old=fs.readFileSync(path.join(root,'../local-r05/data/MUSKELLUNGE_RESOLVED_WEIGHTED_EYE_SCORE_R05.kfc5'));
 const newPayload=score.subarray(16+new DataView(score.buffer).getUint32(8,true)),oldPayload=old.subarray(16+old.readUInt32LE(8));
 check('sourceGeometryAtlasAndBindingsUnchanged',Buffer.from(newPayload).equals(oldPayload),{vertices:h.positions.length/3,triangles:h.indices.length/3,payloadSha256:crypto.createHash('sha256').update(newPayload).digest('hex')});
 const body=[],tips=Array(8).fill(-1),roots=Array(8).fill(-1);
 for(let i=0;i<h.positions.length/3;i++){const id=h.partInfo[2*i],t=h.partInfo[2*i+1];if(!id&&body.length<256&&i%127===0)body.push(i);if(id){if(tips[id]<0||t>h.partInfo[2*tips[id]+1])tips[id]=i;if(roots[id]<0||t<h.partInfo[2*roots[id]+1])roots[id]=i;}}
 run('TURN_LEFT',Array(7).fill(0));const bodyZero=body.map(i=>A.deformPoint(h,i));const bodyState=Array.from(h.state.body.q);
 run('TURN_LEFT',Array(7).fill(1.8));let delta=Math.max(...body.map((i,j)=>distance(A.deformPoint(h,i),bodyZero[j])));
 check('finGainsCannotAlterBody',delta===0&&JSON.stringify(Array.from(h.state.body.q))===JSON.stringify(bodyState),{sampledBodyVertices:body.length,maxBodyDeltaM:delta});
 let maskDelta=0;for(const i of body){const o=i*3,w=h.weights.slice(i*12,i*12+12),pi=h.partInfo.subarray(i*2,i*2+2),p=h.positions.subarray(o,o+3),root=h.partRoot.subarray(o,o+3);const a=A.deformMaterial(h,p,[0,0,1],null,w,pi,root).position;w[0]=w[0]?0:255;w[1]=w[1]?0:255;const b=A.deformMaterial(h,p,[0,0,1],null,w,pi,root).position;maskDelta=Math.max(maskDelta,distance(a,b));}
 check('obsoleteBodyHeadMasksCannotAlterTransport',maskDelta===0,{maxDeltaM:maskDelta});
 run('TURN_LEFT');const before=body.map(i=>A.deformPoint(h,i)),q=Array.from(h.state.body.q),v=Array.from(h.state.body.v),time=h.state.time;A.setMode(h,'TURN_RIGHT');
 check('modeSwitchPreservesSpineAndVelocity',JSON.stringify(q)===JSON.stringify(Array.from(h.state.body.q))&&JSON.stringify(v)===JSON.stringify(Array.from(h.state.body.v))&&time===h.state.time&&body.every((i,j)=>distance(A.deformPoint(h,i),before[j])===0),{modeTime:h.state.modeTime,totalTime:h.state.time});
 let rigidError=0,orthogonality=0;
 for(let j=0;j<25;j++){const x=h.metadata.continuum.body.sourceXM+(h.metadata.continuum.body.endXM-h.metadata.continuum.body.sourceXM)*j/24,f=A.spineFrame(h,x);for(let k=0;k<8;k++){const a=[x,f.restCenter[1]+.03*Math.cos(k*Math.PI/4),f.restCenter[2]+.03*Math.sin(k*Math.PI/4)],b=[x,f.restCenter[1]-.04,f.restCenter[2]+.02];rigidError=Math.max(rigidError,Math.abs(distance(A.transportSpine(h,a,[0,1,0],x).position,A.transportSpine(h,b,[0,1,0],x).position)-distance(a,b)));}const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);orthogonality=Math.max(orthogonality,Math.abs(dot(f.T,f.U)),Math.abs(dot(f.T,f.N)),Math.abs(dot(f.U,f.N)));}
 check('fullSectionsRemainRigid',rigidError<1e-12&&orthogonality<1e-12,{rigidErrorM:rigidError,orthogonality});
 const finResults=[];
 for(let id=1;id<=7;id++){const gains=Array(7).fill(0);run('FIN_FAN',gains,3);const tip0=A.deformPoint(h,tips[id]),root0=A.deformPoint(h,roots[id]);gains[id-1]=1;run('FIN_FAN',gains,3);const tipDelta=distance(tip0,A.deformPoint(h,tips[id])),rootDelta=distance(root0,A.deformPoint(h,roots[id]));const otherFinMax=Math.max(...Object.keys(h.state.parts).filter(k=>+k!==id).map(k=>Math.max(...Array.from(h.state.parts[k].q,Math.abs))));finResults.push({id,label:h.metadata.continuum.parts.find(p=>p.id===id).name,tipVertex:tips[id],tipParameter:h.partInfo[2*tips[id]+1]/65535,tipDeltaM:tipDelta,rootDeltaM:rootDelta,otherFinMax,bodyMax:Math.max(...Array.from(h.state.body.q,Math.abs))});}
 check('allSevenFinsIndependent',finResults.every(f=>f.tipDeltaM>1e-6&&f.otherFinMax===0&&f.bodyMax===0&&f.tipParameter>.98),{fins:finResults});
 const modeResults=[];for(const mode of Object.keys(h.metadata.motion.modes)){run(mode,Array(7).fill(1.8),3);const snap=A.snapshot(h);const finite=[...snap.q,...snap.eye,...snap.response,...h.state.pitch.q,...body.slice(0,32).flatMap(i=>A.deformPoint(h,i))].every(Number.isFinite);modeResults.push({mode,finite});}
 check('sixteenModesFinite',modeResults.length===16&&modeResults.every(x=>x.finite),{modes:modeResults});
 run('CRUISE');const sixty=JSON.stringify(A.snapshot(h));A.reset(h,'CRUISE',options('CRUISE'));for(let i=0;i<60;i++)A.update(h,1/30,options('CRUISE'));check('fixedStepReplay',sixty===JSON.stringify(A.snapshot(h)),{durationS:2,steps:'120x1/60 versus 60x1/30'});
 run('EYE_TRACK');const bodyEye=Array.from(h.state.body.q),eyeBefore=A.snapshot(h).eye;for(let i=0;i<60;i++)A.update(h,1/60,{...options('EYE_TRACK'),eyeYawOffset:.15});check('eyesIndependentOfBody',JSON.stringify(bodyEye)===JSON.stringify(Array.from(h.state.body.q))&&Math.abs(A.snapshot(h).eye[0]-eyeBefore[0])>.05,{eyeBefore,eyeAfter:A.snapshot(h).eye});
 report.passed=true;
}catch(error){report.passed=false;report.error=String(error.stack||error);process.exitCode=1;}
report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'evidence/MOTION_REGRESSION_REPORT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
