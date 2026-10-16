const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'..'),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'PUBLIC-FILES.json')));let bytes=0;
for(const f of manifest.files){const p=path.resolve(root,f.path);assert(p.startsWith(root+path.sep));const b=fs.readFileSync(p);assert.equal(b.length,f.bytes,f.path);assert.equal(digest(b),f.sha256,f.path);bytes+=b.length;}
assert.equal(bytes,manifest.totalBytes);
const dependencies=JSON.parse(fs.readFileSync(path.join(root,'FIXED-DEPENDENCIES.json')));
for(const f of dependencies.files){let p=path.resolve(root,f.path);if(/hong-kong-map-sea-r03\/(index.html|station-data.js)$/.test(p)){const alternate=path.join(path.dirname(p),'publish-final',path.basename(p));if(fs.existsSync(alternate))p=alternate;}const b=fs.readFileSync(p);assert.equal(b.length,f.bytes,f.path);assert.equal(digest(b),f.sha256,f.path);}

const reused=path.resolve(root,'../hong-kong-main-city-r02/city-buildings');
const age=JSON.parse(fs.readFileSync(path.join(reused,'age-evidence.json'))),eligible=new Map(age.eligibleObjects.map(x=>[x.objectId,x]));
const ground=JSON.parse(fs.readFileSync(path.join(root,'../hong-kong-main-city-r03/city-buildings/ground-display-policy.json'))),allowed=new Set(ground.defaultAllowedObjectIds),pending=new Set(ground.terrainPendingObjectIds);
assert.equal(allowed.size,642);assert.equal(pending.size,71);assert.equal(ground.supportDependencyPendingCount,69);assert.equal(ground.shoreCoveragePendingCount,2);
for(const id of allowed){assert(!pending.has(id));const e=eligible.get(id);assert(e&&e.evidenceDate<'1997-01-01'&&e.datumCovered);}
const terrain=JSON.parse(fs.readFileSync(path.join(root,'../hong-kong-main-city-r03/terrain/data/manifest.json')));assert.equal(terrain.patches.length,4);
console.log(JSON.stringify({passed:true,files:manifest.files.length,bytes,fixedDependencies:dependencies.files.length,allowed:allowed.size,pending:pending.size,terrainPatches:terrain.patches.length,actualBrowserTested:false},null,2));

const plan=JSON.parse(fs.readFileSync(path.join(root,'route/route-plan.json')));assert(plan.lengthM>30000&&plan.lengthM<40000);for(const id of ['kowloon','second']){const stop=plan.stops.find(s=>s.id===id);assert(stop);assert.equal(stop.boardingEnabled,false);assert.equal(stop.platformAdjacent,false);}assert.equal(plan.stops.length,5);
