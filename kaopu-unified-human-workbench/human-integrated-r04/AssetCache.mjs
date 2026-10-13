const P=globalThis.__LIP_STARTUP__;const alive=s=>{if(s?.aborted)throw s.reason||new DOMException('Cancelled','AbortError')};
export const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export function mark(stage){P.stage=stage;P.events.push({stage,ms:performance.now()});P.notify?.();}
export function loadVerified(url,expected,signal){return globalThis.__LIP_P3__.transport.loadVerified(url,expected,signal);}
export async function inflate(data){return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
export async function loadParts(parts,prefix,expected,signal,resolve=x=>new URL(x,prefix).href){
 const buffers=await Promise.all(parts.map(part=>loadVerified(resolve(part.file||part.url.split('/').at(-1)),part.sha256,signal)));
 alive(signal);const raw=await inflate(new Blob(buffers));alive(signal);if(await sha(raw)!==expected)throw Error('原始权重校验失败');return raw;
}
