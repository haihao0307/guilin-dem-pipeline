/** Read existing known browser artifacts, do NOT claim a new cloth solve. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditSeamSpans} from './seam-span.mjs';
import {fromNativeAnalytic,applyPatternEdit,samplePatternEdge,stablePatternJSON} from './pattern-edit-kernel.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const input=process.argv[2],out=process.argv[3];
if(!input||!out)throw Error('Usage: node audit-existing.mjs <evidence-r072-directory> <output-directory>');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected=JSON.parse(fs.readFileSync(path.join(here,'REFERENCE_INPUTS.json'),'utf8'));
fs.mkdirSync(out,{recursive:true});const cases=[];
for(const file of expected.caseFiles){
 const raw=fs.readFileSync(path.join(input,file.name));assert.equal(sha(raw),file.sha256,'Reference file changed: '+file.name);
 const record=JSON.parse(raw),materialBefore=stablePatternJSON(record.snapshot.spec);
 const start=performance.now(),audit=auditSeamSpans(record.snapshot.spec,record.positionsMm,{activeSeamIds:record.activeSeams});
 const ms=performance.now()-start;
 assert.equal(stablePatternJSON(record.snapshot.spec),materialBefore,'Audit changed material');
 assert.equal(sha(fs.readFileSync(path.join(input,file.name))),file.sha256,'Audit changed reference file');
 const name=file.name.replace('-result.json','');
 const summary={name,referenceRecordSHA256:file.sha256,oldStaticGatePassed:record.staticGate?.passed??null,
  maxNeedleGapMm:audit.maxNeedleGapMm,maxSpanLowerBoundMm:audit.maxSpanLowerBoundMm,maxSpanUpperBoundMm:audit.maxSpanUpperBoundMm,
  measuredSeams:audit.measuredSeams,separatedSeamIds:audit.separatedSeamIds,unresolvedSeamIds:audit.unresolvedSeamIds,
  largestTwo:audit.rows.toSorted((a,b)=>b.span.lowerBoundMm-a.span.lowerBoundMm).slice(0,2),
  auditCPUTimeMs:ms,clothRecomputed:false,browserRerun:false,sourceRecordUntouched:true};
 cases.push(summary);fs.writeFileSync(path.join(out,`${name}-span-audit.json`),JSON.stringify(audit,null,2));
 console.log(JSON.stringify({name,needleMm:summary.maxNeedleGapMm,spanMm:[summary.maxSpanLowerBoundMm,summary.maxSpanUpperBoundMm],oldGatePassed:summary.oldStaticGatePassed,separated:summary.separatedSeamIds,auditCPUTimeMs:ms}));
}
const defaultCase=cases.find(c=>c.name==='default');
assert.equal(defaultCase.maxNeedleGapMm,0);assert.ok(defaultCase.maxSpanLowerBoundMm>4&&defaultCase.maxSpanUpperBoundMm<4.25,'Known free-edge gap was not detected');
assert.equal(defaultCase.unresolvedSeamIds.length,0);assert.ok(cases.every(c=>c.oldStaticGatePassed));
const analyticPath=path.join(input,expected.analyticFile.name),bytes=fs.readFileSync(analyticPath);assert.equal(sha(bytes),expected.analyticFile.sha256);
const native=JSON.parse(bytes),nativeBefore=JSON.stringify(native),edit=fromNativeAnalytic(native);
assert.deepEqual(edit.validation.curveTypes,['circle','cubic','line','quadratic']);
const renamed=fromNativeAnalytic({...native,panels:[...native.panels].reverse()});
assert.equal(stablePatternJSON(edit),stablePatternJSON(renamed),'Native array order changed canonical result');
const all=edit.panels.map(p=>p.id),scaled=applyPatternEdit(edit,{type:'scalePanels',panelIds:all,factor:1.1}).document;
for(let pi=0;pi<edit.panels.length;pi++)for(let ei=0;ei<edit.panels[pi].edges.length;ei++)for(const t of[0,.25,.5,.75,1]){
 const a=samplePatternEdge(edit.panels[pi],edit.panels[pi].edges[ei],t),b=samplePatternEdge(scaled.panels[pi],scaled.panels[pi].edges[ei],t);
 assert.ok(a.every((v,k)=>Math.abs(b[k]-v*1.1)<1e-6),'Scale/curve inconsistency');
}
const panel=edit.panels.find(p=>p.edges.some(e=>e.kind==='cubic')),edge=panel.edges.find(e=>e.kind==='cubic'),cp=edge.controlPointsMm[0];
const changedCurve=applyPatternEdit(edit,{type:'curveControl',panelIds:[panel.id],edgeId:edge.id,controlIndex:0,positionMm:[cp[0]+2,cp[1]]});
const moved=applyPatternEdit(edit,{type:'translatePlacement',panelIds:[panel.id],deltaMm:[100,0,0]});
assert.deepEqual(moved.document.panels.find(p=>p.id===panel.id).verticesMm,panel.verticesMm);
const removedIDs=edit.panels.filter(p=>['skirt_front','skirt_back'].includes(p.sourcePanelId)).map(p=>p.id);
const removed=applyPatternEdit(edit,{type:'removePanels',panelIds:removedIDs,removeIncidentStitches:true});
assert.equal(JSON.stringify(native),nativeBefore);assert.equal(sha(fs.readFileSync(analyticPath)),expected.analyticFile.sha256);
const editTests={schema:edit.schema,isOfficialPatternGSL:false,defaultNativePanelCount:edit.panels.length,defaultNativeSeamCount:edit.stitches.length,
 allFourCurveTypesPreserved:true,panelOrderCanonicalWithoutVertexSorting:true,panelScaleSampledConsistencyPassed:true,
 curveControlTransactionPassed:changedCurve.document.revision===1,placementDoesNotChangeMaterial:true,
 explicitComponentRemoval:{removedPanelIds:removedIDs,removedStitchIds:removed.changes.removedStitchIds,remainingPanelCount:removed.document.panels.length},
 originalNativeFileUnchanged:true,newBrowserEditorIntegrated:false,editedGarmentsReSimulated:false};
const summary={schema:'kaopu-patterngsl-learning-validation@1',reference:expected.origin,cases,editingCoreTests:editTests,
 interpretation:'Existing R072 garments were re-audited read-only. A passed old needle-only gate did not prove full boundary closure. The editing tests prove transactions/geometry preservation only, not draping or manufacturing.',
 newGarmentDelivered:false,dynamicWearCertified:false,
 sourceHashes:Object.fromEntries(['seam-span.mjs','pattern-edit-kernel.mjs'].map(f=>[f,sha(fs.readFileSync(path.join(here,f)))]))};
fs.writeFileSync(path.join(out,'LEARNING_REPORT.json'),JSON.stringify(summary,null,2));
