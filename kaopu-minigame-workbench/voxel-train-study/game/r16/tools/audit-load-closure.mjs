import {readFileSync,writeFileSync,statSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),study=resolve(root,'../..'),seen=new Map(),queue=[resolve(root,'app.mjs')];
while(queue.length){const path=queue.shift();if(seen.has(path))continue;const bytes=readFileSync(path),source=bytes.toString();seen.set(path,{path:relative(study,path),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))queue.push(resolve(dirname(path),match[1]));}
const modules=[...seen.values()],street=modules.filter(r=>r.path.includes('/r16/street/')||r.path.endsWith('/r16/street-district.mjs'));
for(const r of modules)if(r.path.includes('city-assets')||r.path.includes('/r15/'))throw new Error('Frozen R15 dependency leaked into R16');
const assets=['index.html','game.css','street/first-street.score.json'].map(p=>{const f=resolve(root,p),b=readFileSync(f);return{path:relative(study,f),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};});
const icon=resolve(root,'../../icon.svg');assets.push({path:relative(study,icon),bytes:statSync(icon).size});
const evidence={scope:'Static same-origin import/resource byte counts; HTTP compression and cache not measured',modules,assets,sharedStreetCodeBytes:street.reduce((s,r)=>s+r.bytes,0),initialEntryClosureBytes:modules.concat(assets).reduce((s,r)=>s+r.bytes,0),streetExternalMeshes:0,streetImageTextures:0,hostGeneratedCanvasTexturesPreserved:true,optionalAudio:'Existing R14 recorded audio/music preserved and fetched by gesture as before; not included in initial-entry total',gpuVerified:false};
writeFileSync(resolve(root,'evidence/load-closure.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({modules:modules.length,initialEntryClosureBytes:evidence.initialEntryClosureBytes,sharedStreetCodeBytes:evidence.sharedStreetCodeBytes}));
