// Importing the CPU runner establishes the same real-image decoding and file-fetch environment.
import './run-original-recovery-node.mjs';
import {restoreOriginal} from '../src/original-chassis-recovery.mjs';
const originalFetch=globalThis.fetch,tests=[];
for(const [suffix,expected]of[['object.json','SOURCE_OBJECT_HASH_MISMATCH'],['fields.bin.gz','SOURCE_PAYLOAD_HASH_MISMATCH'],['images/000_Glass_baseColor.png','SOURCE_IMAGE_HASH_MISMATCH']]){
 globalThis.fetch=async(input,options)=>{const response=await originalFetch(input,options),url=input instanceof Request?input.url:String(input);if(url.endsWith('/a4/'+suffix)){const bytes=new Uint8Array(await response.arrayBuffer());bytes[0]^=1;return new Response(bytes);}return response;};
 let error=null;try{await restoreOriginal('a4');}catch(e){error=e.message;}finally{globalThis.fetch=originalFetch;}
 if(!error?.includes(expected))throw Error('CORRUPTION_WAS_NOT_REJECTED '+suffix);tests.push({test:'reject corrupted '+suffix,status:'PASS',error});
}
let caught=false;try{await restoreOriginal('unknown');}catch(e){caught=e.message==='UNKNOWN_ORIGINAL';}if(!caught)throw Error('UNKNOWN_SOURCE_NOT_REJECTED');tests.push({test:'reject unknown source',status:'PASS'});
const fs=await import('node:fs/promises');await fs.writeFile(new URL('../qa/ORIGINAL_RECOVERY_NEGATIVE.json',import.meta.url),JSON.stringify(tests,null,2));console.log(JSON.stringify(tests,null,2));
