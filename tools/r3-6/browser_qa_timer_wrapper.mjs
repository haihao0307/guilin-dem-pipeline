import {readFile,writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const sourcePath=join(here,'browser_qa.mjs');
const generatedPath=join(here,'.browser_qa_timer.generated.mjs');
let source=await readFile(sourcePath,'utf8');
source=source.replaceAll('{timeout:120000}', '{timeout:120000,polling:200}');
await writeFile(generatedPath,source,'utf8');
try{await import(pathToFileURL(generatedPath).href+`?v=${Date.now()}`);}finally{await unlink(generatedPath).catch(()=>{});}
