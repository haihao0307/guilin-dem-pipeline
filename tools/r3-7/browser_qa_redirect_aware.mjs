import {readFile,writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const sourcePath=join(here,'browser_qa.mjs');
const generatedPath=join(here,'.browser_qa_redirect_aware.generated.mjs');
let source=await readFile(sourcePath,'utf8');
const from='const initialUnique=[...new Set(soilRequests)];';
const to="const initialUnique=[...new Set(soilRequests.map(u=>new URL(u).pathname.split('/').at(-1)))];";
if(!source.includes(from))throw new Error('R3.7 QA source no longer contains expected initial request dedupe line');
source=source.replace(from,to);
await writeFile(generatedPath,source,'utf8');
try{
  await import(pathToFileURL(generatedPath).href+`?v=${Date.now()}`);
}finally{
  await unlink(generatedPath).catch(()=>{});
}
