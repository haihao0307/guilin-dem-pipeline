import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const repo=path.resolve('..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const file='data/production-cards-r09.json',r=JSON.parse(fs.readFileSync(file)),products=JSON.parse(fs.readFileSync('data/r10/registry.json'));
for(const c of r.cards){const p=products.items.find(i=>i.id===c.id);if(!p)throw Error('Product missing '+c.id);c.runtimeProduct={file:'fish-five-r01/data/'+p.file,sha256:p.sha256,format:p.format,sourceUsedOfflineOnly:true,fullyProceduralAppearance:false};c.measurements.surface.runtimePolicy='OFFLINE_SOURCE_COMPACT_DERIVED_PRODUCT_R10';}
for(const b of r.implementationBindings)b.sha256=sha(fs.readFileSync(path.join(repo,b.path)));
for(const name of ['compact-legacy-r10.js','source-codec-r07.js']){const p='fish-five-r01/src/'+name;if(!r.implementationBindings.some(b=>b.path===p))r.implementationBindings.push({path:p,sha256:sha(fs.readFileSync(path.join(repo,p)))});}
fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');
