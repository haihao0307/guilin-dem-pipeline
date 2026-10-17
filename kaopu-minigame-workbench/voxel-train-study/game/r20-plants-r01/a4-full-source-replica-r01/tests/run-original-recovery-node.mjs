import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {loadImage} from '@napi-rs/canvas';
globalThis.self=globalThis;
globalThis.ProgressEvent=class{constructor(type,props){this.type=type;Object.assign(this,props);}};
// Decode the actual retained image bytes with the installed canvas library; no placeholder textures.
globalThis.createImageBitmap=async(blob)=>await loadImage(Buffer.from(await blob.arrayBuffer()));
const originalFetch=globalThis.fetch;globalThis.fetch=async(input,options)=>{const url=input instanceof Request?input.url:String(input);if(url.startsWith('file:')){return new Response(await fs.readFile(fileURLToPath(url)));}return originalFetch(input,options);};
const {verifyRecovery}=await import('./original-recovery-browser.mjs');
const report=await verifyRecovery();
await fs.writeFile(new URL('../qa/ORIGINAL_RUNTIME_RECOVERY.json',import.meta.url),JSON.stringify(report.results,null,2));
await fs.writeFile(new URL('../provenance/ORIGINAL_RUNTIME_NODE_MAPPING.json',import.meta.url),JSON.stringify(report.mappings,null,2));
await fs.writeFile(new URL('../provenance/ORIGINAL_RUNTIME_CLOSURES.json',import.meta.url),JSON.stringify(report.closures,null,2));
await fs.writeFile(new URL('../provenance/CHASSIS_SELECTION_INVENTORY.json',import.meta.url),JSON.stringify(report.inventories,null,2));
console.log(JSON.stringify({...report,mappings:undefined,closures:undefined,inventories:undefined,execution:'Node CPU, actual image decode, no WebGL renderer'},null,2));
