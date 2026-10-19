const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
module.exports=async function checkWorld(page,rootExpression,expectedDataset='student'){
 const raw=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'world-anchor-fixture.json.gz')));if(crypto.createHash('sha256').update(raw).digest('hex')!=='3cd077c08924bef23322e768e3975daba28cab7e38e647be30275b4dbb61bceb')throw Error('FIXTURE_SHA');
 const code=fs.readFileSync(path.join(__dirname,'world-anchor-api.mjs'),'utf8'),fixture=JSON.parse(raw);if(crypto.createHash('sha256').update(code).digest('hex')!=='1c86e226906f3ffaed94e3b43c530ddf4ad81d26c9c9c2e415d14dcd88e844bc')throw Error('API_SHA');
 await page.evaluate(async({code,fixture})=>{window.__poseAssert=(await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code))).assertRuntimePose;window.__poseFixture=fixture;},{code,fixture});
 return page.evaluate(({rootExpression,expectedDataset})=>{
 const s=rootExpression==='A4_STUDENT.source'?A4_STUDENT.source:rootExpression==='EXPERIMENT.source'?EXPERIMENT.source:EXPERIMENT.student;
 const restore=()=>{s.mixer.stopAllAction();s.nodes.forEach((n,i)=>{const r=s.rest[i];n.position.copy(r.position);n.quaternion.copy(r.quaternion);n.scale.copy(r.scale);n.matrix.copy(r.matrix);});s.root.updateMatrixWorld(true);};
 const duration=s.model.animations[0].duration,results=[];
 for(const phase of __poseFixture.phases){if(phase.mode==='rest')restore();else{s.setTime(phase.playbackTimeSeconds==null?phase.timeSeconds:phase.playbackTimeSeconds%duration);}s.root.updateMatrixWorld(true);
 results.push(__poseAssert(__poseFixture,phase.id,{expectedDataset,getWorldMatrix:i=>s.nodes[i]?.matrixWorld,getVertexLocal:(node,primitive,index)=>{const p=s.primitives.find(p=>p.sourceNode===node&&p.primitive===primitive),a=p?.object.geometry.attributes.position;return a?[a.getX(index),a.getY(index),a.getZ(index)]:null;}}));}
 restore();return{results,selectedAnchorCoverageOnly:true,restDistinctFromZero:true,lastKeyDistinctFromWrap:true,loopNormalizedBeforeClampedSampler:true,physicalMechanismCertified:false};
 },{rootExpression,expectedDataset});
};
