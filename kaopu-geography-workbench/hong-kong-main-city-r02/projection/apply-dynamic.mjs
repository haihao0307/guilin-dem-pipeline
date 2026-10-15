#!/usr/bin/env node
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {DYNAMIC_PATCH_PLAN,patchDynamicVerified} from './dynamic-patch-plan.mjs';
import {sha256} from './patch-plan.mjs';
import {projectionSourceURLs} from './source-layout.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),write=process.argv.includes('--write'),report={schema:'hk-dynamic-projection-patch/1',sourceWrites:0,files:{}};
const sources=projectionSourceURLs(import.meta.url,{publishedLayout:process.argv.includes('--published-layout')});
for(const [key,p]of Object.entries(DYNAMIC_PATCH_PLAN)){
 const source=fileURLToPath(sources[key]),bytes=await fs.readFile(source),r=await patchDynamicVerified(key,bytes);report.files[key]={source,inputSha256:r.inputSha256,outputSha256:r.outputSha256,replacements:r.replacements};
 if(write){const dst=path.join(here,'generated-dynamic',p.output);await fs.mkdir(path.dirname(dst),{recursive:true});await fs.writeFile(dst,r.text);}
 if(await sha256(await fs.readFile(source))!==r.inputSha256)throw Error('Source changed during audit');
}
await fs.writeFile(path.join(here,'DYNAMIC-PATCH-AUDIT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,files:7,sourceWrites:0,output:write?'projection/generated-dynamic':'audit only'}));
