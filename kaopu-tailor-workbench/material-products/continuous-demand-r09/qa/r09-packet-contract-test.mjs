import fs from 'node:fs';import zlib from 'node:zlib';import assert from 'node:assert/strict';
import{refineSewnBoundaries}from'../r09-board/seam-refinement.mjs';import{refineRiseTriangles}from'../r09-board/rise-refinement.mjs';import{assertFiniteCoordinates,materialHash,sha,stable}from'../r09-board/source-contract.mjs';
// Explicit shape/schema and reference validator for the retained source format.
function validate(p){
 assert.equal(p.spec.schema,'kaopu-sewing-graph@1','Unsupported sewing graph schema');
 assert.ok(Array.isArray(p.spec.panels)&&p.spec.panels.length>0);assert.ok(Array.isArray(p.spec.seams));assert.ok(Array.isArray(p.record.activeSeams));
 const panels=new Map(p.spec.panels.map(panel=>[panel.id,panel]));assert.equal(panels.size,p.spec.panels.length);
 for(const panel of panels.values()){
  assert.equal(typeof panel.id,'string');assert.ok(Array.isArray(panel.uvMm));
  for(const uv of panel.uvMm)assert.ok(uv.length===2&&uv.every(Number.isFinite));
  const vertex=i=>Number.isInteger(i)&&i>=0&&i<panel.uvMm.length;
  assert.ok(Array.isArray(panel.boundary)&&panel.boundary.every(vertex));assert.ok(panel.edges&&typeof panel.edges==='object');
  for(const edge of Object.values(panel.edges))assert.ok(Array.isArray(edge)&&edge.length>=2&&edge.every(vertex));
  for(const tri of panel.triangles)assert.ok(tri.length===3&&new Set(tri).size===3&&tri.every(vertex));
 }
 const seams=new Set();for(const seam of p.spec.seams){
  assert.ok(!seams.has(seam.id));seams.add(seam.id);
  for(const endpoint of[seam.a,seam.b])assert.ok(panels.get(endpoint.panelId)?.edges[endpoint.edge]);
  for(const pair of seam.stitchVertexPairs){assert.equal(pair.length,2);for(let k=0;k<2;k++){const endpoint=seam[k?'b':'a'];assert.ok(panels.get(endpoint.panelId).edges[endpoint.edge].includes(pair[k]),'Stitch site outside declared edge');}}
 }
 for(const id of p.record.activeSeams)assert.ok(seams.has(id));
 for(const xyz of p.record.positionsMm)assert.ok(xyz.length===3&&xyz.every(Number.isFinite));assertFiniteCoordinates(p.spec,p.record.positionsMm.flat());
 for(const key of['paperSHA256','materialSHA256','recipeHash'])assert.match(p.binding[key],/^[a-f0-9]{64}$/);
 if(p.record.contactRefinement){const r=p.record.contactRefinement;assert.equal(r.schema,'kaopu/rise-material-triangle-refinement@1');assert.equal(r.paperContoursChanged,false);assert.equal(r.materialAreaChanged,false);assert.equal(r.newClothPatches,0);for(const site of r.inserted){const panel=panels.get(site.panel);assert.ok(panel&&site.index<panel.uvMm.length);assert.ok(site.parentTriangle.length===3&&site.parentTriangle.every(i=>i<site.index));assert.ok(Math.abs(site.barycentric.reduce((a,b)=>a+b,0)-1)<1e-12);}}
}
const report={schema:'kaopu-sewing-graph@1',cases:[],negative:[]};
for(const id of['T01','T03','T08','T17','P01','P02','P04']){
 const source=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../r09-board/native/'+id+'.json.gz',import.meta.url)))),packet=await refineRiseTriangles(await refineSewnBoundaries(source));validate(packet);
 if(id.startsWith('P')){assert.equal(await materialHash(packet.spec),packet.binding.materialSHA256);assert.equal(await sha(stable(packet.spec.panels)),packet.binding.paperSHA256);}
 report.cases.push({id,schemaPassed:true,referencesPassed:true,finiteCoordinatesPassed:true,currentRefinementHashCheck:id.startsWith('P')?'passed':'not_applicable_unmodified_source'});
 if(id==='P02'){
  const wrong=structuredClone(packet);wrong.spec.schema='kaopu-sewing-graph@999';assert.throws(()=>validate(wrong),/schema/);report.negative.push('Unsupported schema rejected');
  const broken=structuredClone(packet);broken.spec.seams[0].a.panelId='missing';assert.throws(()=>validate(broken));report.negative.push('Missing panel reference rejected');
 }
}
fs.writeFileSync(new URL('./r09-packet-contract-test.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
