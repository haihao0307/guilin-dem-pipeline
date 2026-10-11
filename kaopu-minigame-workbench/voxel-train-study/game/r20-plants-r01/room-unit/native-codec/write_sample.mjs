import {writeFile,mkdir,readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash,webcrypto} from 'node:crypto';import assert from 'node:assert/strict';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const {encode,decode,verifyDependencyBytes,pinnedDependencies}=await import('./codec.mjs');
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(dir),deps={};for(const p of pinnedDependencies())deps[p.id]=new Uint8Array(await readFile(path.join(root,p.id.replace('__','/'))));await verifyDependencyBytes(deps);
const b=await encode({}),r=await decode(b);assert.equal(r.kind,'dwelling');assert.equal(r.width,3.6);
await mkdir(path.join(dir,'samples'),{recursive:true});await writeFile(path.join(dir,'samples/old-dwelling.KaoPu'),b);await writeFile(path.join(dir,'samples/old-dwelling.score.json'),JSON.stringify(r,null,2));
console.log(JSON.stringify({file:'old-dwelling.KaoPu',bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),score:r,dependencies:pinnedDependencies()},null,2));
