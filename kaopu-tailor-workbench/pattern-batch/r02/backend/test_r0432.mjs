import assert from'node:assert/strict';
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{gunzipSync}from'node:zlib';
import{compatibleSeamClearance}from'./seam-clearance-r0432.mjs';
import{refinementGuides}from'./native/kaopu-tailor-workbench/r07/stability/refinement.mjs';
const P=path.dirname(fileURLToPath(import.meta.url)),index=JSON.parse(fs.readFileSync(P+'/assets/results/index.json'));
const report={passed:false,checks:[],materialChanged:false,qualityThresholdsChanged:false};
function check(name,fn){fn();report.checks.push({name,passed:true});}
for(const[id,row]of Object.entries(index.rows)){
 const packet=JSON.parse(gunzipSync(fs.readFileSync(P+'/assets/results/'+row.file))),spec=packet.spec;
 let n=0;const offsets=new Map(spec.panels.map(p=>{const o=n;n+=p.uvMm.length;return[p.id,o]})),lab={spec,offsets};
 const before=JSON.stringify(spec),base=refinementGuides(lab),baseJSON=JSON.stringify(base),out=compatibleSeamClearance(lab,base);
 check(id+' original material and guide array stay immutable',()=>{assert.equal(JSON.stringify(spec),before);assert.equal(JSON.stringify(base),baseJSON)});
 check(id+' no added/deleted/reindexed guide rows',()=>{assert.equal(out.rows.length,base.length);out.rows.forEach((g,i)=>assert.deepEqual(g.ids,base[i].ids));});
 check(id+' only the construction-side boundary margin changes',()=>{
  out.rows.forEach((g,i)=>{if(g.margin!==base[i].margin){assert.equal(base[i].margin,.0003);assert.equal(g.margin,.00006);}});
  assert.equal(out.report.distanceTubeAdded,false);assert.equal(out.report.acceptanceThresholdsChanged,false);
  assert(out.report.excluded.every(r=>r.ratio>1.12));
 });
 if(id==='P06'){check('P06 has real affected source boundary guides',()=>assert(out.report.changedBoundaryRows>0));}
}
for(const v of[NaN,Infinity,-.1,.00011])check('invalid construction margin '+v,()=>assert.throws(()=>compatibleSeamClearance({},{},{sideMarginM:v})));
report.passed=true;fs.writeFileSync(P+'/R0432_CONTRACT_TESTS.json',JSON.stringify(report,null,2));console.log('R0432_CONTRACTS',report.checks.length);
