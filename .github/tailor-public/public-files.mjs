import fs from 'node:fs';import crypto from 'node:crypto';
const base=process.env.TAILOR_URL||'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected=JSON.parse(fs.readFileSync('kaopu-tailor-workbench/UNIFIED-MANIFEST.json'));
const entries=[...expected.files,...expected.sharedDependencies,{path:'UNIFIED-MANIFEST.json',sha256:hash(fs.readFileSync('kaopu-tailor-workbench/UNIFIED-MANIFEST.json'))}];
const report=[];
for(const e of entries){let res,buf;for(let trial=0;trial<3;trial++){res=await fetch(new URL(e.path,base),{cache:'no-store'});if(res.ok){buf=Buffer.from(await res.arrayBuffer());break;}if(res.status<500)break;}if(!res?.ok)throw Error(e.path+' HTTP '+res?.status);const digest=hash(buf);if(digest!==e.sha256)throw Error(e.path+' hash mismatch');report.push({path:e.path,bytes:buf.length,sha256:digest,status:res.status});}
fs.mkdirSync('tailor-public-hash',{recursive:true});fs.writeFileSync('tailor-public-hash/result.json',JSON.stringify({base,passed:true,count:report.length,files:report},null,2));console.log('TAILOR_PUBLIC_HASH '+report.length+'/'+entries.length+' exact');
