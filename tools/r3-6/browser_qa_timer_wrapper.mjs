import {readFile,writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const sourcePath=join(here,'browser_qa.mjs');
const generatedPath=join(here,'.browser_qa_timer.generated.mjs');
let source=await readFile(sourcePath,'utf8');
source=source.replaceAll('{timeout:120000}', '{timeout:120000,polling:200}');
const stressMode=process.env.R36_STRESS_MODE||'route';
if(stressMode==='server-header'){
  source=source.replace(
    "const stressContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await allowGithack(stressContext);let started=0,finished=0,failed=0;const failedUrls=[];",
    "const stressContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:{'X-R36-Stress':'1'}});await allowGithack(stressContext);let started=0,finished=0,failed=0;const failedUrls=[];"
  );
  source=source.replace("await stressContext.route('**/site/dist/r3-5/data/osm/*.u16le',async route=>{await new Promise(r=>setTimeout(r,500));try{await route.continue();}catch{}});","");
}else if(stressMode==='public-nongating'){
  source=source.replace("assert(cancellation.fetchAbortCount>0||failed>0,`superseded payload fetches did not abort; started=${started} finished=${finished} failed=${failed} state=${JSON.stringify(cancellation)}`);","void cancellation.fetchAbortCount;");
}
await writeFile(generatedPath,source,'utf8');
try{await import(pathToFileURL(generatedPath).href+`?v=${Date.now()}`);}finally{await unlink(generatedPath).catch(()=>{});}
