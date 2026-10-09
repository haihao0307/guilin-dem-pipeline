/** Exact byte contract used by R03 numeric QA. Not a mesh/Jolt shape hash. */
export function nativeRestFingerprintBytes({names,parents,restMatrices}){
 const rest=Array.from({length:names.length},(_,i)=>Array.from(restMatrices[i]?.length===16?restMatrices[i]:restMatrices.slice(i*16,i*16+16)));
 if(rest.some(m=>m.length!==16||!m.every(Number.isFinite)))throw Error('Invalid native rest matrices');
 return new TextEncoder().encode(JSON.stringify({names:Array.from(names),parents:Array.from(parents),rest}));
}
export async function nativeRestFingerprint(skeleton){const bytes=nativeRestFingerprintBytes(skeleton);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
