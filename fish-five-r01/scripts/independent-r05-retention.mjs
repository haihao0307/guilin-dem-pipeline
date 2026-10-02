import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baselinePath=path.join(root,'dist/KAOPU_FISH_SCOREMAKER_R04.html');
const expectedBaseline='f9b06189683bd79f846b5de47d997253ef9c21c0be3bdee13aa3fac7b905be75';
if(!arg('html')||!arg('expected-html')){console.log('DRAFT_ONLY: baseline extraction ready; no candidate provided, no browser used.');process.exit(0);}
const baselineBuffer=fs.readFileSync(baselinePath),candidateBuffer=fs.readFileSync(path.resolve(arg('html')));
if(sha(baselineBuffer)!==expectedBaseline)throw Error('Immutable R04 baseline hash mismatch');
if(sha(candidateBuffer)!==arg('expected-html'))throw Error('Frozen R05 candidate hash mismatch');
const before=baselineBuffer.toString('utf8'),after=candidateBuffer.toString('utf8');
const carrier=(html,id)=>{const m=html.match(new RegExp('<script[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)</script>'));if(!m)throw Error('Missing source carrier '+id);return m[1].trim();};
const score=(html,id)=>JSON.parse(zlib.gunzipSync(Buffer.from(carrier(html,'score-'+id),'base64')));
const legacy=html=>{const text=carrier(html,'barracudaModule'),compressed=/<script[^>]*data-encoding="gzip-base64"[^>]*id="barracudaModule"/.test(html);return compressed?zlib.gunzipSync(Buffer.from(text,'base64')):Buffer.from(JSON.parse(text));};
const report={schema:'fish.independent-r05-source-retention/1',status:'PARTIAL_SOURCE_RETENTION_ONLY',baselineHtmlSha256:expectedBaseline,testedHtmlSha256:arg('expected-html'),createdAt:new Date().toISOString(),rows:[],failures:[],visualAcceptance:false,productionReady:false};
const check=(id,key,pass)=>{report.rows.push({id,key,pass});if(!pass)report.failures.push(id+':'+key);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
check('barracuda','original-R14-carrier-byte-identical',legacy(before).equals(legacy(after)));
for(const id of ['herring','tuna-yellow-label','tuna-blue-label','colorful','picasso']){
 const a=score(before,id),b=score(after,id);
 check(id,'primitive-count',a.primitives.length===b.primitives.length);
 for(let i=0;i<a.primitives.length;i++){
  const p=a.primitives[i],q=b.primitives[i];
  for(const key of ['positions','base','residual','paramAddress','normals','uvs','indices','material','sourceMesh','sourceNode','name','ocular','finId','finWeight','finGradient'])check(id,'primitive-'+i+'-'+key,!!q&&same(p[key],q[key]));
 }
 for(const key of ['materials','textures','canonical','parameterization','source'])check(id,key,same(a[key],b[key]));
 check(id,'eye-count',a.eyes.length===b.eyes.length);
 for(let i=0;i<a.eyes.length;i++)for(const key of ['side','center','normal','radius','sourceMeshIds','localRadii','sourceFrame','sourceBoundMin','sourceBoundMax','sourceLocalBoundMin','sourceLocalBoundMax','sourcePointCount'])check(id,'eye-'+i+'-'+key,same(a.eyes[i][key],b.eyes[i]?.[key]));
 // New jaw motion metadata is recorded without treating missing provenance as PASS.
 const jaw=b.rig?.jaw??b.rig?.mouth??b.mouth??null;
 report.rows.push({id,key:'jaw-metadata-review-required',status:jaw?'MEASUREMENT_REVIEW_REQUIRED':'UNKNOWN_OR_NOT_EXPOSED',jaw});
}
report.noProtectedDifference=report.failures.length===0;
report.remainingGates=['jaw-source-provenance-and-support','actual-eye-visibility-and-temporal-control','actual-GPU-mouth-strain-and-normal','runtime-lifecycle-performance','independent-visual-review','public-browser'];
fs.writeFileSync(path.join(root,'evidence/INDEPENDENT_R05_SOURCE_RETENTION.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,noProtectedDifference:report.noProtectedDifference,failures:report.failures}));
if(report.failures.length)process.exitCode=1;
