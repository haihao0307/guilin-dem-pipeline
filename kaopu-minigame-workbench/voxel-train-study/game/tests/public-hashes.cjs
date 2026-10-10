const fs=require('node:fs'),{createHash}=require('node:crypto');
const manifest=require('./public-manifest.json'),base='https://haihao0307.github.io/guilin-dem-pipeline/';
(async()=>{
  let results=[];
  for(let attempt=0;attempt<18;attempt++){
    results=await Promise.all(manifest.files.map(async file=>{try{const response=await fetch(base+file.path,{signal:AbortSignal.timeout(15000)});if(!response.ok)return{...file,status:response.status,ok:false};const data=Buffer.from(await response.arrayBuffer()),sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');return{...file,status:response.status,actualSha:sha,bytes:data.length,ok:sha===file.sha};}catch(error){return{...file,ok:false,error:String(error)};}}));
    if(results.every(x=>x.ok)||results.some(x=>x.status===401||x.status===403))break;
    await new Promise(resolve=>setTimeout(resolve,10000));
  }
  const report={checkedAt:new Date().toISOString(),base,candidate:manifest.candidate,releaseCommit:manifest.release_commit,allMatched:results.every(x=>x.ok),files:results};
  fs.writeFileSync('driver-public-hashes.json',JSON.stringify(report,null,2));
  if(!report.allMatched)throw new Error('Public asset gate failed: '+results.filter(x=>!x.ok).map(x=>x.path+' ('+(x.status||x.error)+')').join(', '));
  console.log('All '+manifest.files.length+' public asset hashes match, including all protected classic files');
})().catch(error=>{console.error(error);process.exit(1);});

