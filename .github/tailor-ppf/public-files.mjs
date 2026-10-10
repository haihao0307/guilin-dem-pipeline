import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.PPF_PUBLIC_BASE||'https://haihao0307.github.io/guilin-dem-pipeline';
const scope=JSON.parse(await fs.readFile('.github/tailor-ppf/public-scope.json','utf8'));
const report={base,rows:[],errors:[]};
for(let start=0;start<scope.length;start+=4){
  await Promise.all(scope.slice(start,start+4).map(async row=>{
    let last;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(base+'/'+row.path,{signal:AbortSignal.timeout(45000)});
        if(!response.ok)throw Error('HTTP '+response.status);
        const bytes=Buffer.from(await response.arrayBuffer());
        const git=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
        assert.equal(git,row.sha||row.gitSha);report.rows.push({path:row.path,bytes:bytes.length,sha:git,attempt});return;
      }catch(error){last=error.message;if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
    }
    report.errors.push({path:row.path,error:last});
  }));
}
await fs.mkdir('ppf-public-hash',{recursive:true});await fs.writeFile('ppf-public-hash/result.json',JSON.stringify(report,null,2));
assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.rows.length,scope.length);
console.log(JSON.stringify({publicFiles:report.rows.length,shaMatched:true}));
