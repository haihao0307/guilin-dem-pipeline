#!/usr/bin/env node
'use strict';
// Read only the isolated URL produced by this source build. Never accept an
// older cached page or a successful HTTP response with different HTML bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const build=JSON.parse(fs.readFileSync(path.join(__dirname,'BUILD.json')));
assert.match(build.sourceHead,/^[a-f0-9]{40}$/);
const expected='https://haihao0307.github.io/guilin-dem-pipeline/npc-life-observation/r03-20261020/'+build.sourceHead+'/';
assert.equal(build.publicURL,expected);
const out=process.env.NPC_HTTP_OUT||'/tmp/npc-live-http';fs.mkdirSync(out,{recursive:true});
const report={sourceHead:build.sourceHead,url:expected,expectedSHA256:build.previewSHA256,startedAt:new Date().toISOString(),attempts:[],passed:false};
const save=()=>fs.writeFileSync(path.join(out,'public-http.json'),JSON.stringify(report,null,2));
(async()=>{
  const deadline=Date.now()+20*60*1000;
  while(Date.now()<deadline){
    const attempt={at:new Date().toISOString()};
    try{
      const response=await fetch(expected,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});
      attempt.status=response.status;attempt.finalURL=response.url;
      if(response.ok){
        const bytes=Buffer.from(await response.arrayBuffer());attempt.bytes=bytes.length;attempt.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
        if(response.status===200&&response.url===expected&&attempt.bytes===build.previewBytes&&attempt.sha256===build.previewSHA256){
          const metaResponse=await fetch(expected+'BUILD.json',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
          assert.equal(metaResponse.status,200);const meta=await metaResponse.json();
          assert.equal(meta.sourceHead,build.sourceHead);assert.equal(meta.previewSHA256,build.previewSHA256);assert.equal(meta.previewBytes,build.previewBytes);assert.equal(meta.version,'NPC-LIFE-OBSERVATION-R03');assert.equal(meta.standalone,true);assert.equal(meta.publicURL,expected);
          report.passed=true;report.finishedAt=new Date().toISOString();report.buildMetadataVerified=true;
        }
      }
    }catch(error){attempt.error=error.message;}
    report.attempts.push(attempt);save();console.log(JSON.stringify({publicHTML:attempt.status||attempt.error,sha256:attempt.sha256||null,passed:report.passed}));
    if(report.passed)return;
    await new Promise(resolve=>setTimeout(resolve,20000));
  }
  throw Error('The exact isolated public HTML was not available within the bounded publication window');
})().catch(error=>{report.failure=error.message;save();console.error(error);process.exitCode=1;});
