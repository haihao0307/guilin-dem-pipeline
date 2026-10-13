import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]),name=process.env.ACTION||'walk',lookID=process.env.LOOK||'K04';
const {makeSourceWorld}=await import(pathToFileURL(path.join(root,'new/SourcePhysics.mjs')));
const {RigidPoseSampler}=await import(pathToFileURL(path.join(root,'motion/kaopu-unified-human-workbench/motion-review-r01/Core.mjs')));
const {encodeClip,decodeClip}=await import(pathToFileURL(path.join(root,'parent/motion-cache.mjs')));
const {withSettings}=await import(pathToFileURL(path.join(root,'parent/material-settings.mjs')));
const {LOOKS}=await import(pathToFileURL(path.join(root,'parent/looks.mjs')));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=JSON.parse(fs.readFileSync(path.join(root,'probe/inputs',name+'.json'))),fit=JSON.parse(fs.readFileSync(path.join(root,'fitting',lookID+'.json'))),data={...source,oldBody:fit.oldBody},input=fit.rows.map(r=>({...r,positions:Float32Array.from(r.positions)}));
const settings={gravity:1,bend:1,softness:1,damping:7,clearanceMM:4};
const key=hash(JSON.stringify({actor:data.actor,rows:input.map(r=>({...r,positions:Array.from(r.positions)})),settings}));
const dest=path.join(root,'solved',lookID+'-'+name);fs.mkdirSync(dest,{recursive:true});
const report={passed:false,look:lookID,action:data.sourceAction,key,actorHash:hash(JSON.stringify(data.actor)),body:'HUMAN-INTEGRATED-R05',motionSource:'773f717b38ff5adf776c99fc30f06c113b4727a6',frames:0,checks:[],errors:[],referencePhysics:true,newMotionAuthoring:false,oldPhysicalFramesUsed:false,paperFit:fit.paperFit,fullSelfCollision:false,continuousCollision:false};const save=()=>fs.writeFileSync(path.join(dest,'REPORT.json'),JSON.stringify(report,null,2));save();
try{
 let world=await makeSourceWorld({rows:input,oldBody:data.oldBody,actor:data.actor,settings,wasm:fs.readFileSync(path.join(root,'parent/cloth-kernel.wasm'))});
 const sampler=new RigidPoseSampler(data.actor.rig),a=sampler.pack(data.rest.world),b=sampler.pack(data.poses[0].world);
 const solved=[],offsets=[],started=performance.now();let metadata,maxStretch=0;
 for(let i=0;i<8;i++)world.stepSource(data.rest,1/30);
 const boot=world.rows().map(r=>({...r,positions:Array.from(r.positions),normals:Array.from(r.normals)}));
 const bootProof=world.audit(true);if(bootProof.bodyMinimumSampleMM<-.1||bootProof.pairMinimumSampleMM<bootProof.pairTargetMM-.1)throw Error('Neutral contact criterion failed '+JSON.stringify(bootProof));
 const bootBytes=zlib.gzipSync(JSON.stringify({schema:'R05-native-original-boot/1',look:lookID,key,actorHash:report.actorHash,rows:boot,proof:bootProof,fitRows:fit.rows,paperFit:fit.paperFit}));fs.writeFileSync(path.join(dest,lookID+'-boot.json.gz'),bootBytes);report.boot={file:lookID+'-boot.json.gz',sha256:hash(bootBytes),bytes:bootBytes.length};save();
 // Construct the source clip's exact first pose without inventing an alignment motion.
 world=await makeSourceWorld({rows:input,oldBody:data.oldBody,actor:data.actor,settings,wasm:fs.readFileSync(path.join(root,'parent/cloth-kernel.wasm')),initialFrame:data.poses[0]});
 for(let i=0;i<8;i++)world.stepSource(data.poses[0],1/30);
 for(let i=0;i<data.poses.length;i++){
  if(i)world.stepSource(data.poses[i],Math.min(1/30,data.duration-(i-1)/30));
  const rows=world.rows();if(!metadata)metadata=rows.map((r,j)=>({...r,positions:Array.from(r.positions),normals:undefined,map:Array.from(world.solvers[j].map)}));
  maxStretch=Math.max(maxStretch,...rows.map(r=>r.audit.maxEdgeStretch));
  const offset=[0,0,0];let count=0;for(let j=0;j<rows.length;j++)for(let v=0;v<rows[j].positions.length;v+=3){for(let k=0;k<3;k++)offset[k]+=rows[j].positions[v+k]-metadata[j].positions[v+k];count++;}for(let k=0;k<3;k++)offset[k]/=count;
  solved.push(rows.map(r=>Float32Array.from(r.positions,(v,k)=>v-offset[k%3])));offsets.push(offset);
  if(i%10===0||i===data.poses.length-1){const q=world.audit(true);report.checks.push({...q,sourceFrame:i});if(q.bodyMinimumSampleMM<-.1||q.pairMinimumSampleMM<q.pairTargetMM-.1)throw Error('Original dense contact criterion failed '+JSON.stringify(q));}
  report.frames=i+1;if(i%30===0){save();console.log(lookID,name,i,data.poses.length);}
 }
 const proof={passed:true,checks:report.checks,maxEdgeStretch:maxStretch,wallTimeMS:performance.now()-started,bodyActorHash:report.actorHash,continuousCollision:false,fullSelfCollision:false};
 const binary=encodeClip({motion:data.sourceAction,recipe:key,rows:metadata,proof,sourceProtocol:'R05-native-original-motion/2',sourceDuration:data.duration,frameOffsets:offsets,initialAlignmentSeconds:0,initialization:"one-time native first-pose rest fit, then actual static constraint solve; not animation"},solved),decoded=decodeClip(binary);
 if(decoded.header.maxQuantisationErrorMM>.025)throw Error('Quantisation threshold');
 const gz=zlib.gzipSync(binary),file=lookID+'-'+name+'.bin.gz';fs.writeFileSync(path.join(dest,file),gz);
 Object.assign(report,{passed:true,file,bytes:gz.length,sha256:hash(gz),duration:data.duration,maxEdgeStretch:maxStretch,maxQuantisationErrorMM:decoded.header.maxQuantisationErrorMM,wallTimeMS:performance.now()-started,initialFit:world.fit.maxTransferredCoordinateM});
}catch(e){report.errors.push(e.stack||String(e));console.error(e);process.exitCode=1;}finally{save();}
