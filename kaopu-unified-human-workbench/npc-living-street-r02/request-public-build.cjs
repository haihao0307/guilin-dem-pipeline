#!/usr/bin/env node
'use strict';
// Request a build of the existing branch-backed Pages site. Never alter its
// configuration, source, domain, access controls, or deployment destination.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo='haihao0307/guilin-dem-pipeline';
const origin='https://haihao0307.github.io/guilin-dem-pipeline/';
const token=process.env.GITHUB_TOKEN;
const checkOnly=process.argv.slice(2).join(' ')==='--check';
assert(process.argv.length===2||checkOnly,'Only --check is supported');
assert(token,'The current repository workflow token is required');
assert.equal(process.env.GITHUB_REPOSITORY,repo);
assert(/^[a-f0-9]{40}$/.test(process.env.SOURCE_HEAD||''));
const out=process.env.NPC_HTTP_OUT||'/tmp/street-public-http';
fs.mkdirSync(out,{recursive:true});
async function request(suffix,method='GET'){
  const response=await fetch('https://api.github.com/repos/'+repo+suffix,{
    method,redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28','User-Agent':'npc-living-street-verified-publisher'}});
  const text=await response.text();
  assert.equal(response.status,method==='POST'?201:200,'Existing site API '+method+' '+suffix+' returned HTTP '+response.status);
  return JSON.parse(text);
}
(async()=>{
  const configuration=await request('/pages');
  assert.equal(configuration.build_type,'legacy','Only the existing branch-backed Pages mode is authorized');
  assert.equal(configuration.source?.branch,'gh-pages');
  assert.equal(configuration.source?.path,'/');
  assert.equal(configuration.html_url,origin);
  assert.equal(configuration.public,true);
  const existingSite={buildType:configuration.build_type,source:configuration.source,url:configuration.html_url};
  if(checkOnly){
    fs.writeFileSync(path.join(out,'pages-preflight.json'),JSON.stringify({checkedAt:new Date().toISOString(),existingSite,configurationChanged:false},null,2)+'\n');
    console.log(JSON.stringify({preflightPassed:true,existingSite}));return;
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'INTEGRATION_STATUS.json'),'utf8')).releaseCandidate,true,'Diagnostic-only integration builds may never request publication');
  const publishedSHA=process.env.PAGES_SOURCE_SHA;
  assert(/^[a-f0-9]{40}$/.test(publishedSHA||''),'The successfully pushed gh-pages commit is required');
  const build=await request('/pages/builds','POST');
  const receipt={schema:'kaopu/existing-pages-build-request@1',sourceHead:process.env.SOURCE_HEAD,
    pagesSourceSHA:publishedSHA,
    requestedAt:new Date().toISOString(),repository:repo,
    existingSite,
    response:build,configurationChanged:false,publicURLVerified:false};
  fs.writeFileSync(path.join(out,'pages-build-request.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({requested:true,repository:repo,sourceBranch:'gh-pages',status:build.status,
    sourceHead:process.env.SOURCE_HEAD,publicURLVerified:false}));
  const deadline=Date.now()+1200000;
  while(Date.now()<deadline){
    const latest=await request('/pages/builds/latest');
    const row={checkedAt:new Date().toISOString(),status:latest.status,commit:latest.commit,
      error:latest.error,createdAt:latest.created_at,updatedAt:latest.updated_at,pagesSourceSHA:publishedSHA};
    fs.writeFileSync(path.join(out,'pages-build-latest.json'),JSON.stringify(row,null,2)+'\n');
    if(latest.status==='errored'&&latest.commit===publishedSHA)throw Error('The requested existing Pages build failed: '+String(latest.error?.message));
    if(latest.status==='built'&&/^[a-f0-9]{40}$/.test(latest.commit||'')){
      let containsPublishedCommit=latest.commit===publishedSHA;
      if(!containsPublishedCommit){
        const comparison=await request('/compare/'+publishedSHA+'...'+latest.commit);
        containsPublishedCommit=['ahead','identical'].includes(comparison.status);
        row.relationship=comparison.status;
      }
      if(containsPublishedCommit){
        row.containsPublishedCommit=true;row.publicURLVerified=false;
        fs.writeFileSync(path.join(out,'pages-build-verified.json'),JSON.stringify(row,null,2)+'\n');
        console.log(JSON.stringify({existingPagesBuildPassed:true,commit:latest.commit,pagesSourceSHA:publishedSHA}));return;
      }
    }
    await new Promise(resolve=>setTimeout(resolve,20000));
  }
  throw Error('Existing Pages did not report a completed build containing the published commit within 20 minutes');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
