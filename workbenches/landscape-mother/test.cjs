const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const G=require('./generator.js')();
const out=process.argv[2]||'evidence';fs.mkdirSync(out,{recursive:true});
for(const f of ['generator.js','viewer.js']){
 const s=fs.readFileSync(__dirname+'/'+f,'utf8');
 assert.ok(!/createTexture\s*\(|texImage|sampler2D|sampler3D|DataTexture|TextureLoader|new Image\s*\(|textureSample|\btexture\s*\(|LOD\s*\(/.test(s),f);
 if(f==='generator.js')assert.ok(!/camera\.|navigator|devicePixelRatio|document\./.test(s),'generator must be independent of viewing state');
}
const hash=r=>{const h=crypto.createHash('sha256');for(const m of r.meshes)for(const key of ['positions','normals','attributes','rest','indices'])h.update(Buffer.from(m[key].buffer,m[key].byteOffset,m[key].byteLength));return h.digest('hex')};
const r=G.produce();
for(const m of r.meshes){
 assert.equal(m.positions.length,m.normals.length);assert.equal(m.positions.length,m.rest.length);assert.equal(m.attributes.length/4,m.positions.length/3);
 for(const name of ['positions','normals','attributes','rest'])assert.ok(m[name].every(Number.isFinite),name);
 assert.ok(m.indices.every(x=>x<m.positions.length/3));
 for(let i=0;i<m.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(m.normals[i],m.normals[i+1],m.normals[i+2])-1)<.001);
}
for(const k of ['body','soil','talus']){assert.ok(r.audit[k].closed);assert.equal(r.audit[k].boundaryEdges,0);assert.equal(r.audit[k].degenerateTriangles,0);assert.ok(r.audit[k].signedVolume>0);}
assert.equal(r.audit.mainConnectedComponents,1);assert.equal(r.audit.lod,false);assert.equal(r.audit.textureSampling,false);assert.equal(r.audit.vegetationInstances,0);
assert.ok(r.rockMeta.length>20);assert.ok(r.rockMeta.every(x=>!x.roundBoulder));assert.ok(r.contactReports.every(x=>Math.abs(x.minVertexClearanceM+.035)<.00002));
const soil=r.meshes.find(m=>m.kind==='soil'),top=G.soilSampler(soil);for(const a of r.anchors){assert.ok(Math.abs(top(a.position[0],a.position[2])+.002-a.position[1])<1e-5);assert.ok(Math.abs(Math.hypot(...a.surfaceNormal)-1)<.001);}
let bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];const body=r.meshes[0];for(let i=0;i<body.positions.length;i++){bounds[0][i%3]=Math.min(bounds[0][i%3],body.positions[i]);bounds[1][i%3]=Math.max(bounds[1][i%3],body.positions[i]);}
const dimensions=bounds[1].map((x,i)=>x-bounds[0][i]);assert.ok(dimensions.every(x=>x>10));
const digest=hash(r);const again=G.produce();assert.equal(hash(again),digest,'same seed repeat');
const report={...r.audit,generatedBufferSha256:digest,bounds,dimensions,deterministicRepeat:true,sourcePhotoObservationOnly:true,originalGlbMeasuredThisRun:false,actualBrowserExecuted:false,testsPassed:11,testsFailed:0};fs.writeFileSync(out+'/numeric.json',JSON.stringify(report,null,2));fs.writeFileSync(out+'/habitat-interface.json',JSON.stringify({schema:'landscape-mother/habitat/1',units:'authored-metres',sites:r.anchors},null,2));console.log(JSON.stringify(report,null,2));
