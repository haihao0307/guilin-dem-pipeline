// Small integrity-checked loader for the official MIT-licensed npm package.
// The package contains the real embedded WASM. No substitute/mock fallback.
export const JOLT_URL='https://cdn.jsdelivr.net/npm/jolt-physics@1.1.0/dist/jolt-physics.wasm-compat.js';
export const JOLT_SHA256='011233a5fff762d6f0f5b50726b315246bf68cb182f0a10024559d04f4c257de';
export default async function initJolt(options={}){
 let module;
 if(globalThis.process?.versions?.node){
  const url=process.env.JOLT_NODE_MODULE;if(!url?.startsWith('file:'))throw Error('Set JOLT_NODE_MODULE to the verified official jolt-physics@1.1.0 WASM module file URL.');
  const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');const bytes=await readFile(new URL(url));
  if(createHash('sha256').update(bytes).digest('hex')!==JOLT_SHA256)throw Error('Jolt official npm module integrity mismatch');module=await import(url);
 }else{
  const response=await fetch(JOLT_URL,{mode:'cors',credentials:'omit',signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Jolt CDN unavailable: HTTP '+response.status);
  const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==JOLT_SHA256)throw Error('Jolt CDN integrity mismatch; engine not started');
  const url=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));try{module=await import(url);}finally{URL.revokeObjectURL(url);}
 }
 const J=await module.default(options);if(typeof J.RShapeCast!=='function'||typeof J.JoltInterface!=='function')throw Error('Jolt WASM initialization failed');return J;
}
