'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
module.exports=function captureCurrent(modelRoot,outputDirectory){
const H=__dirname,R=path.resolve(modelRoot),O=path.resolve(outputDirectory),lock=JSON.parse(fs.readFileSync(path.join(H,'SOURCE_LOCK.json')));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const files=[...fs.readFileSync(path.join(R,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]).filter(x=>!['app.js','controls.js'].includes(x));
const hashes=Object.fromEntries(['index.html',...files].map(f=>[f,hash(path.join(R,f))]));
if(JSON.stringify(files)!==JSON.stringify(lock.loadOrder))throw Error('Actual page geometry load order changed; re-audit required');
for(const f of files)if(hashes[f]!==lock.sha256[f])throw Error('Source lock mismatch: '+f+'; do not reuse old exemptions without re-audit');
const c={};c.window=c;vm.createContext(c);for(const f of files)vm.runInContext(fs.readFileSync(path.join(R,f),'utf8'),c,{filename:f});
const D=c.DYNAMIC,G=D.gresleySolver,C=D.outerCrossheadCandidate,inst=D.snapshot({mode:'candidate',beta:.126});if(!C)throw Error('Missing actual outer replacement');
const parts=Object.fromEntries(c.SCENE.parts.map(p=>[p.id,p])),visible=new Set(c.SCENE.parts.filter(p=>D.visible(p,inst)).map(p=>p.id));
const ledger=JSON.parse(fs.readFileSync(path.join(H,'NO_WITNESS_STATUS_LEDGER.json')));
if(ledger.profileNoWitnessSameVisibleIDs.length!==223||ledger.profileNoWitnessSuppressedIDs.length!==30||ledger.outerCurrentNoWitness.length!==110)throw Error('Unexpected pending ledger counts');
for(const group of ['profileNoWitnessSameVisibleIDs','outerCurrentNoWitness'])for(const pair of ledger[group])if(pair.some(id=>!visible.has(id)))throw Error('Current pending pair is no longer visible: '+pair);
for(const pair of ledger.profileNoWitnessSuppressedIDs)if(pair.every(id=>visible.has(id)))throw Error('Historical pair unexpectedly reactivated: '+pair);
const requests=require('./read-witness-points')(),pool=[],poolIndex=new Map(),used=new Set(),visibility={};
function inverse(p,theta,v){const g=D.gresleyFrame(p,theta,inst);if(g)return G.transformPoint(v,g,true);const f=D.valveFrame(p,theta,inst);if(f)return D.valvePoint(v,f,true);return D.transform(v,theta,D.classify(p),true,inst);}
function matrix(id,theta){const p=parts[id],off=inverse(p,theta,[0,0,0]),cols=[[1,0,0],[0,1,0],[0,0,1]].map(v=>inverse(p,theta,v).map((x,j)=>x-off[j])),m={inverseOffset:off,inverseRows:[0,1,2].map(j=>cols.map(v=>v[j]))},key=JSON.stringify(m);if(!poolIndex.has(key)){poolIndex.set(key,pool.length);pool.push(m);}return poolIndex.get(key);}
for(const r of requests){r.frames={};r.nativeCandidateValues={};for(const id of r.groups.flat()){if(!parts[id]||!visible.has(id))throw Error('Requested invisible/nonexistent current field '+id);used.add(id);r.frames[id]=matrix(id,r.theta);if(parts[id].source==='outsideJoint')r.nativeCandidateValues[id]=C.worldScalar(id,r.xyz,r.theta,inst);}for(const id of r.originalPair||[])visibility[id]={exists:!!parts[id],visible:visible.has(id),source:parts[id]?.source};}
function fn(src,name){const re=new RegExp('float\\s+'+name+'\\s*\\(vec3\\s+p\\)\\s*\\{'),m=re.exec(src);if(!m)throw Error('Missing function '+name);let i=m.index+m[0].length,d=1;while(d){if(src[i]==='{')d++;if(src[i]==='}')d--;i++;}return src.slice(m.index,i);}
const S=c.SCENE.sources,frags=Object.fromEntries(Object.keys(S).map(k=>[k,[]]));frags.support.push(fn(S.support,'support_node_0'));frags.installation.push(fn(S.installation,'topologyWebOuter'));
for(const m of S.support.matchAll(/float\s+(frame_mount_\w+)\s*\(vec3\s+p\)/g))frags.support.push(fn(S.support,m[1]));
const minimal=[];for(const id of [...used].sort()){const p=parts[id];minimal.push({id,source:p.source,glsl_function:p.glsl_function});if(p.source!=='outsideJoint')frags[p.source].push(fn(S[p.source],p.glsl_function));}
const allowed=JSON.parse(fs.readFileSync(path.join(H,'ALLOWED_NEGATIVE_RELATIONS.json')));
const basis=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],samples=1441,relations=lock.rigidTrajectoryEvidence.map(x=>({pair:x.pair,samples,maximumFullAffineInverseDifference:0}));
const stationaryIds=[...new Set(allowed.filter(x=>x.classification==='intended_stationary_casting_union').flatMap(x=>x.pair))],stationaryReference=Object.fromEntries(stationaryIds.map(id=>[id,basis.map(p=>inverse(parts[id],.4,p))]));
let maximumStationaryTransformDrift=0;
for(let k=0;k<samples;k++){
 const theta=.4+k*2*Math.PI/(samples-1),needed=[...new Set([...relations.flatMap(x=>x.pair),...stationaryIds])],frames=Object.fromEntries(needed.map(id=>[id,basis.map(p=>inverse(parts[id],theta,p))]));
 for(const row of relations)for(let a=0;a<4;a++)for(let j=0;j<3;j++)row.maximumFullAffineInverseDifference=Math.max(row.maximumFullAffineInverseDifference,Math.abs(frames[row.pair[0]][a][j]-frames[row.pair[1]][a][j]));
 for(const id of stationaryIds)for(let a=0;a<4;a++)for(let j=0;j<3;j++)maximumStationaryTransformDrift=Math.max(maximumStationaryTransformDrift,Math.abs(frames[id][a][j]-stationaryReference[id][a][j]));
}
if(relations.some(x=>x.maximumFullAffineInverseDifference>1e-12)||maximumStationaryTransformDrift>1e-12)throw Error('Same-Time rigid/stationary relation broken');
for(const side of ['left','right']){const tag=side==='left'?'L':'R',eye=parts['stack_candidate/terminal_eye/'+tag],g=G.classify(eye.frameSourceId);if(g.type!=='translation'||g.anchor!==tag)throw Error('Terminal eye is not pure input translation');}
for(const row of allowed.filter(x=>x.classification==='intended_same_rigid_connection_union'))if(!relations.some(r=>JSON.stringify([...r.pair].sort())===JSON.stringify([...row.pair].sort())))throw Error('Allowed negative lacks actual trajectory proof');
const motionEvidence={sourceLocked:true,samples,relations,stationaryIds,maximumStationaryTransformDrift,wholeClearanceProof:false};
const data={installation:inst,sources:Object.fromEntries(Object.entries(frags).map(([k,v])=>[k,[...new Set(v)].join('\n')])),parts:minimal,hostCuts:c.SCENE.hostCuts,candidate:{version:C.version,parts:C.parts.map(p=>({id:p.id,ast:p.ast,origin:p.origin}))},matrixPool:pool,records:requests,motionEvidence};
for(const f of files)if(hash(path.join(R,f))!==hashes[f])throw Error('Concurrent source edit '+f);
const meta={modelDirectory:'r30',loadOrder:files,sha256:hashes,candidateVersion:C.version,installation:inst,defined:c.SCENE.parts.length,baselineVisible:c.SCENE.parts.filter(p=>D.visible(p,D.snapshot({mode:'baseline'}))).length,candidateVisible:visible.size,outerSuppress:C.suppress,originalWitnessVisibility:visibility,recordCount:requests.length,matrixCount:pool.length,scope:'Existing witnesses and stored points only, no new optimizer or collision search. All matrices regenerated from current index-loaded model.'};
fs.writeFileSync(path.join(O,'REPLAY_INPUTS.json'),JSON.stringify(data));fs.writeFileSync(path.join(O,'CURRENT_SOURCE_AND_VISIBILITY.json'),JSON.stringify(meta));return {data,meta,motionEvidence};
};
