import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'dist/KAOPU_FISH_PARAMETRIC_SCHOOL_R09_WORKBENCH.html'));
const build=JSON.parse(fs.readFileSync(path.join(root,'evidence/BUILD_RECEIPT.json'))),qa=JSON.parse(fs.readFileSync(path.join(root,'evidence/local-BROWSER_REPORT.json')));
const hash=crypto.createHash('sha256').update(html).digest('hex');
if(hash!==build.sha256||hash!==qa.sourceHtmlSha256||!qa.passed)throw Error('Candidate not verified');
for(const file of ['SURFACE_CONTINUITY_REPORT.json','GPU_SURFACE_REPORT.json','GPU_INSTANCE_REPORT.json','MOTION_CAPTURE_REPORT.json','SCHOOL_REGRESSION_REPORT.json','INDEPENDENT_VERIFIER.json']){const gate=JSON.parse(fs.readFileSync(path.join(root,'evidence',file)));if(!(gate.passed||gate.verdict==='PASS_LOCAL_PROMOTE'))throw Error('Missing publish gate '+file);if(file==='INDEPENDENT_VERIFIER.json'&&gate.htmlSha256!==hash)throw Error('Verifier build hash mismatch');}
const credential=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},windowsHide:true});
if(credential.status!==0)throw Error('GitHub credential helper unavailable');
const fields=Object.fromEntries(credential.stdout.trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
if(!fields.password)throw Error('No GitHub credential returned');
const apiBase='https://api.github.com/repos/haihao0307/guilin-dem-pipeline';
async function api(endpoint,method='GET',body){const res=await fetch(apiBase+endpoint,{method,headers:{Authorization:'Bearer '+fields.password,Accept:'application/vnd.github+json','User-Agent':'Codex-fish-R09','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});const data=await res.json();if(!res.ok)throw Error(`GitHub ${method} ${endpoint}: ${res.status} ${data.message||''}`);return data;}
const ref=await api('/git/ref/heads/gh-pages'),parent=ref.object.sha,base=await api('/git/commits/'+parent);
console.log('Publishing verified R09 through official GitHub API, parent',parent);
const expectedBlobSha=crypto.createHash('sha1').update(`blob ${html.length}\0`).update(html).digest('hex');
// A timed-out upload may already have stored the immutable blob. Recover it
// before resending the large payload; no branch has changed at this stage.
const existingBlob=await fetch(apiBase+'/git/blobs/'+expectedBlobSha,{headers:{Authorization:'Bearer '+fields.password,Accept:'application/vnd.github+json','User-Agent':'Codex-fish-R09'},signal:AbortSignal.timeout(120000)});
await existingBlob.body?.cancel();
if(!existingBlob.ok&&existingBlob.status!==404)throw Error('GitHub blob recovery status '+existingBlob.status);
const blob=existingBlob.ok?{sha:expectedBlobSha}:await api('/git/blobs','POST',{encoding:'utf-8',content:html.toString('utf8')});
if(blob.sha!==expectedBlobSha)throw Error('GitHub stored a different HTML blob');
console.log('Stored exact HTML blob',blob.sha);
const knowledge=await api('/git/blobs','POST',{encoding:'utf-8',content:fs.readFileSync(path.join(root,'../knowledge/fish-motion/README.md'),'utf8')});
const measurements=await api('/git/blobs','POST',{encoding:'utf-8',content:fs.readFileSync(path.join(root,'evidence/SCHOOL_REGRESSION_REPORT.json'),'utf8')});
const tree=await api('/git/trees','POST',{base_tree:base.tree.sha,tree:[{path:'kaopu-fish-r09/index.html',mode:'100644',type:'blob',sha:blob.sha},{path:'kaopu-fish-r09/knowledge/README.md',mode:'100644',type:'blob',sha:knowledge.sha},{path:'kaopu-fish-r09/knowledge/SCHOOL_REGRESSION_REPORT.json',mode:'100644',type:'blob',sha:measurements.sha}]});
const commit=await api('/git/commits','POST',{message:'fix(fish): preserve continuous fin skin and finite root normals R09',tree:tree.sha,parents:[parent]});
await api('/git/refs/heads/gh-pages','PATCH',{sha:commit.sha,force:false});
const receipt={publishedAt:new Date().toISOString(),provider:'GitHub official REST Git Data API',parentSha:parent,publishedCommit:commit.sha,blobSha:blob.sha,htmlSha256:hash,path:'kaopu-fish-r09/index.html',url:'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-fish-r09/',force:false,unrelatedTreePreserved:true,shareAllowed:false};
fs.writeFileSync(path.join(root,'evidence/PUBLISH_COMMIT_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
