#!/usr/bin/env node
'use strict';
/**
 * Read-only, exact-build HTTP availability gate for the isolated Pages URL.
 * No upload, browser execution, screenshot, or visual acceptance occurs here.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');

const HELP=`Usage: node wait-public.cjs [--help]

Read-only HTTP checks for exactly:
  https://haihao0307.github.io/guilin-dem-pipeline/npc-living-street/r02-20261020/<SOURCE_HEAD>/

Environment:
  SOURCE_HEAD                    Exact 40-hex Git commit; otherwise BUILD.sourceHead.
                                 If both exist, they must be identical.
  NPC_LOCAL_HTML                 Local expected HTML (default: ./dist/index.html).
  NPC_LOCAL_BUILD                Local build metadata (default: ./BUILD.json).
                                 Default paths are relative to this script.
  NPC_HTTP_OUT                   Evidence directory (default: /tmp/street-public-http).
  NPC_HTTP_TOTAL_TIMEOUT_MS       Total polling deadline (default: 1200000).
  NPC_HTTP_REQUEST_TIMEOUT_MS     Deadline for each response, including its body
                                 (default: 15000; also bounded by total time left).
  NPC_HTTP_POLL_INTERVAL_MS       Delay between attempts (default: 20000).

Requires Node.js with built-in fetch. Local HTML must match BUILD.previewSHA256.
Both remote HTML and BUILD.json must return exact HTTP 200 without redirects at
their exact expected URLs. Remote HTML bytes and required build fields must match.
public-http.json and attempt-NNNN.json preserve successful and failed attempts,
including request timeouts. Exit 0 means HTTP byte/metadata checks passed only;
exit 1 means local validation, availability, or deadline checks failed.
This script never publishes files and never asserts browser or visual acceptance.
`;
if(process.argv.slice(2).includes('--help')){process.stdout.write(HELP);process.exit(0);}

const EXPECTED_SCHEMA='kaopu/npc-living-street-build@2';
const EXPECTED_VERSION='NPC-LIVING-STREET-R02';
const URL_PREFIX='https://haihao0307.github.io/guilin-dem-pipeline/npc-living-street/r02-20261020/';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const iso=()=>new Date().toISOString();
const present=value=>value!==undefined&&value!==null&&value!=='';
const report={schema:'kaopu/npc-living-street-public-http@2',version:EXPECTED_VERSION,
  scope:'HTTP-only exact HTML bytes and build metadata; no browser or visual acceptance',
  startedAt:iso(),attempts:[],passed:false,browserVerified:false,visualAcceptance:false,productionReady:false};
let out=path.resolve(process.env.NPC_HTTP_OUT||'/tmp/street-public-http');

function numberFromEnvironment(name,fallback){
  const raw=process.env[name];if(!present(raw))return fallback;
  assert.match(raw,/^[1-9][0-9]*$/,name+' must be a positive integer number of milliseconds');
  const n=Number(raw);assert(Number.isSafeInteger(n)&&n<=86400000,name+' must be at most 86400000 ms');return n;
}
function writeJSON(file,value){
  const temporary=file+'.tmp-'+process.pid;
  fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');fs.renameSync(temporary,file);
}
function save(attempt=null){
  fs.mkdirSync(out,{recursive:true});
  if(attempt)writeJSON(path.join(out,'attempt-'+String(attempt.number).padStart(4,'0')+'.json'),attempt);
  writeJSON(path.join(out,'public-http.json'),report);
}
function requireHead(value,label){assert.equal(typeof value,'string',label+' must be a string');assert.match(value,/^[a-fA-F0-9]{40}$/,label+' must be exactly 40 hex characters');}
function requireURL(value,expected,label){assert.equal(value,expected,label+' must identify this exact isolated build URL');}

/** Fetch never follows redirects. Its timer includes headers and the full body. */
async function readExactResponse(url,evidence,{deadline,requestTimeoutMS,maxBytes,accept}){
  const remaining=deadline-performance.now();
  if(remaining<=0)throw Error('Total polling deadline expired before '+url);
  const timeoutMS=Math.max(1,Math.min(requestTimeoutMS,Math.floor(remaining)));
  const controller=new AbortController();let timedOut=false;
  evidence.requestedURL=url;evidence.startedAt=iso();evidence.timeoutMS=timeoutMS;
  const began=performance.now();
  const timer=setTimeout(()=>{timedOut=true;controller.abort(new Error('HTTP request deadline exceeded'));},timeoutMS);
  try {
    const response=await fetch(url,{redirect:'manual',signal:controller.signal,
      headers:{Accept:accept,'Cache-Control':'no-cache','Pragma':'no-cache'}});
    evidence.status=response.status;evidence.finalURL=response.url;evidence.redirected=response.redirected;
    evidence.headers=Object.fromEntries(['content-type','content-length','etag','last-modified','cache-control','age','location','x-github-request-id']
      .map(key=>[key,response.headers.get(key)]).filter(([,value])=>value!==null));
    if(response.status!==200||response.redirected||response.url!==url){
      // Reject 3xx/201/204/etc. before reading unrelated response bodies.
      if(response.body)await response.body.cancel();
      assert.equal(response.status,200,'Exact HTTP 200 required for '+url);
      assert.equal(response.redirected,false,'Redirects are forbidden for '+url);
      assert.equal(response.url,url,'Unexpected response URL');
    }
    const chunks=[];let bytes=0;
    if(response.body){
      const reader=response.body.getReader();
      try {
        for(;;){
          const {done,value}=await reader.read();if(done)break;
          bytes+=value.byteLength;evidence.bodyBytesRead=bytes;
          if(bytes>maxBytes){controller.abort();throw Error('Response exceeds bounded decoded-body limit of '+maxBytes+' bytes');}
          chunks.push(Buffer.from(value));
        }
      }finally{reader.releaseLock();}
    }
    const body=Buffer.concat(chunks,bytes);
    evidence.bytes=bytes;evidence.sha256=hash(body);evidence.httpExact=true;
    return body;
  }catch(error){
    evidence.error=String(error?.message||error);evidence.timedOut=timedOut;
    if(error?.name)evidence.errorName=error.name;
    throw error;
  }finally{
    clearTimeout(timer);evidence.finishedAt=iso();evidence.durationMS=Math.round(performance.now()-began);
  }
}

async function main(){
  assert.equal(process.argv.length,2,'Unknown argument. Use --help; all settings use environment variables.');
  assert.equal(typeof fetch,'function','Node.js with built-in fetch is required');
  const htmlPath=path.resolve(process.env.NPC_LOCAL_HTML||path.join(__dirname,'dist/index.html'));
  const buildPath=path.resolve(process.env.NPC_LOCAL_BUILD||path.join(__dirname,'BUILD.json'));
  report.local={htmlPath,buildPath};save();
  const build=JSON.parse(fs.readFileSync(buildPath,'utf8'));
  assert.equal(build.schema,EXPECTED_SCHEMA,'Unexpected local BUILD schema');
  assert.equal(build.version,EXPECTED_VERSION,'Unexpected local BUILD version');
  assert.equal(typeof build.previewSHA256,'string','BUILD.previewSHA256 is required');
  assert.match(build.previewSHA256,/^[a-f0-9]{64}$/,'BUILD.previewSHA256 must be a lowercase SHA256');
  const envHead=process.env.SOURCE_HEAD,buildHead=build.sourceHead;
  if(present(envHead))requireHead(envHead,'SOURCE_HEAD');
  if(present(buildHead))requireHead(buildHead,'BUILD.sourceHead');
  if(present(envHead)&&present(buildHead))assert.equal(envHead,buildHead,'SOURCE_HEAD and BUILD.sourceHead differ');
  const sourceHead=present(envHead)?envHead:buildHead;requireHead(sourceHead,'Source commit');
  const expectedURL=URL_PREFIX+sourceHead+'/',metadataURL=expectedURL+'BUILD.json';
  if(present(build.publicURL))requireURL(build.publicURL,expectedURL,'Local BUILD.publicURL');
  const localHTML=fs.readFileSync(htmlPath),expectedSHA256=hash(localHTML);
  assert.equal(expectedSHA256,build.previewSHA256,'Local HTML bytes do not match BUILD.previewSHA256');
  if(present(build.previewBytes))assert.equal(localHTML.byteLength,build.previewBytes,'Local HTML byte count differs from BUILD.previewBytes');
  const config={totalTimeoutMS:numberFromEnvironment('NPC_HTTP_TOTAL_TIMEOUT_MS',20*60*1000),
    requestTimeoutMS:numberFromEnvironment('NPC_HTTP_REQUEST_TIMEOUT_MS',15000),
    pollIntervalMS:numberFromEnvironment('NPC_HTTP_POLL_INTERVAL_MS',20000)};
  Object.assign(report,{sourceHead,url:expectedURL,metadataURL,expectedSHA256,expectedBytes:localHTML.byteLength,config,
    localValidated:true,expectedMetadata:{schema:build.schema,version:build.version,previewSHA256:build.previewSHA256,sourceHead,
      ...(present(build.publicURL)?{publicURL:build.publicURL}:{})}});
  report.pollingStartedAt=iso();
  const started=performance.now(),deadline=started+config.totalTimeoutMS;
  save();
  while(performance.now()<deadline){
    const attempt={number:report.attempts.length+1,startedAt:iso(),passed:false,html:{},build:{}};
    report.attempts.push(attempt);save(attempt);
    try {
      await readExactResponse(expectedURL,attempt.html,{deadline,requestTimeoutMS:config.requestTimeoutMS,
        maxBytes:Math.max(localHTML.byteLength+65536,131072),accept:'text/html'});
      assert.equal(attempt.html.sha256,expectedSHA256,'Remote HTML SHA256 differs from the exact local build');
      assert.equal(attempt.html.bytes,localHTML.byteLength,'Remote HTML byte count differs from the exact local build');
      attempt.html.bytesVerified=true;
      const metaBytes=await readExactResponse(metadataURL,attempt.build,{deadline,requestTimeoutMS:config.requestTimeoutMS,
        maxBytes:1024*1024,accept:'application/json'});
      const remote=JSON.parse(metaBytes.toString('utf8'));
      assert(remote&&typeof remote==='object'&&!Array.isArray(remote),'Remote BUILD must be a JSON object');
      attempt.build.metadata=Object.fromEntries(['schema','version','previewSHA256','sourceHead','publicURL'].filter(k=>Object.hasOwn(remote,k)).map(k=>[k,remote[k]]));
      assert.equal(remote.schema,build.schema,'Remote BUILD.schema differs');
      assert.equal(remote.version,build.version,'Remote BUILD.version differs');
      assert.equal(remote.previewSHA256,build.previewSHA256,'Remote BUILD.previewSHA256 differs');
      assert.equal(remote.sourceHead,sourceHead,'Remote BUILD.sourceHead differs');
      if(Object.hasOwn(remote,'publicURL'))requireURL(remote.publicURL,expectedURL,'Remote BUILD.publicURL');
      if(present(build.publicURL))assert.equal(remote.publicURL,build.publicURL,'Remote BUILD.publicURL is missing or differs');
      if(present(remote.previewBytes))assert.equal(remote.previewBytes,localHTML.byteLength,'Remote BUILD.previewBytes differs');
      assert(performance.now()<=deadline,'Total polling deadline expired before verification completed');
      attempt.build.metadataVerified=true;attempt.passed=true;report.passed=true;report.buildMetadataVerified=true;
    }catch(error){attempt.error=String(error?.message||error);}
    attempt.finishedAt=iso();report.elapsedMS=Math.round(performance.now()-started);
    if(report.passed)report.finishedAt=iso();
    save(attempt);
    console.log(JSON.stringify({attempt:attempt.number,htmlStatus:attempt.html.status??null,
      htmlSHA256:attempt.html.sha256??null,buildStatus:attempt.build.status??null,
      passed:attempt.passed,error:attempt.error??null,evidence:path.join(out,'public-http.json')}));
    if(report.passed)return;
    const remaining=deadline-performance.now();if(remaining<=0)break;
    await new Promise(resolve=>setTimeout(resolve,Math.min(config.pollIntervalMS,remaining)));
  }
  report.deadlineExceeded=true;
  throw Error('The exact isolated HTML and BUILD.json were not verified within the bounded HTTP availability window');
}

main().catch(error=>{
  report.failure=String(error?.message||error);report.finishedAt=iso();
  try{save();}catch(saveError){console.error('Could not save HTTP evidence: '+saveError.message);}
  console.error(report.failure);process.exitCode=1;
});
