#!/usr/bin/env node
// Read source files; output ONLY below this module's projection/generated directory.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PATCH_PLAN,patchVerified,sha256} from './patch-plan.mjs';
import {projectionSourceURLs} from './source-layout.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),out=path.join(here,'generated');
const sources=projectionSourceURLs(import.meta.url,{publishedLayout:process.argv.includes('--published-layout')});
const write=process.argv.includes('--write'),report={schema:'hk-projection-150km-patch-audit/1',sourceWrites:0,writeGenerated:write,files:{}};
for(const [key,p]of Object.entries(PATCH_PLAN)){
 const source=fileURLToPath(sources[key]);
 const raw=await fs.readFile(source),r=await patchVerified(key,raw);report.files[key]={source,inputBytes:raw.length,inputSha256:r.inputSha256,outputSha256:r.outputSha256,outputBytes:Buffer.byteLength(r.text),replacements:r.replacements};
 if(write){const dst=path.join(out,p.output);await fs.mkdir(path.dirname(dst),{recursive:true});await fs.writeFile(dst,r.text);}
 if(await sha256(await fs.readFile(source))!==r.inputSha256)throw Error('Source changed during read-only patch audit: '+p.source);
}
await fs.writeFile(path.join(here,'PATCH-AUDIT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,files:Object.keys(report.files).length,sourceWrites:0,output:write?'projection/generated':'audit only'}));
