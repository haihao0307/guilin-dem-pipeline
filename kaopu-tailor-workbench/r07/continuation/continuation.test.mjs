import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fromNativeAnalytic,applyPatternEdit,stablePatternJSON} from '../../learning/patterngsl-r01/pattern-edit-kernel.mjs';
import {rebuildEditedAnalytic} from './native-edit-bridge.mjs';
import {compileAnalytic} from '../../catalogue/r074-test-module.mjs';
import {polylineGapBounds} from '../../learning/patterngsl-r01/seam-span.mjs';
import {prepareContinuationAssembly} from './assembly.mjs';
const native=JSON.parse(fs.readFileSync(new URL('../../garment-pattern-catalogue-r01/examples/LongSleeve-default.json',import.meta.url)));
const original=stablePatternJSON(native),doc=fromNativeAnalytic(native);
const mesh=p=>compileAnalytic(p,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'anny-adult-neutral-r01'}});
const apply=op=>applyPatternEdit(doc,op).document;
const ids=doc.panels.map(p=>p.id);
test('no-op bridge preserves exact original vertices, body and declared references',async()=>{
 const out=await rebuildEditedAnalytic(native,doc);assert.deepEqual(out.bodyCm,native.bodyCm);assert.deepEqual(out.design,native.design);
 for(const p of out.panels){const q=native.panels.find(q=>q.id===p.id);assert.deepEqual(p.verticesMm,q.verticesMm);for(const e of p.edges)assert.ok(Math.abs(e.lengthMm-q.edges[e.index].lengthMm)<.001,[p.id,e.index,e.lengthMm,q.edges[e.index].lengthMm]);}
 assert.equal(out.seams.length,native.seams.length);assert.equal(out.validation.analytic2DPass,true);assert.equal(out.officialOracleCm,null);
 assert.equal(stablePatternJSON(native),original);
});
test('uniform material scale recomputes curves, lengths, areas and a fresh material triangulation',async()=>{
 const operation={type:'scalePanels',panelIds:ids,factor:1.02,anchorMm:[0,0]},edited=apply(operation),out=await rebuildEditedAnalytic(native,edited,{operations:[operation]}),spec=mesh(out);
 assert.equal(spec.source.recipeHash,out.recipeHash);assert.notEqual(out.recipeHash,native.recipeHash);assert.deepEqual(out.bodyCm,native.bodyCm);
 for(const p of out.panels){const q=native.panels.find(q=>q.id===p.id);assert.ok(Math.abs(p.edges[0].lengthMm/q.edges[0].lengthMm-1.02)<1e-6);assert.ok(spec.panels.find(m=>m.id===p.id).triangles.length>0);}
 assert.equal(out.source.continuationEdits.originalBodyModified,false);assert.equal(stablePatternJSON(native),original);
});
test('Bezier control editing recomputes source-relative curvature and mesh',async()=>{
 const p=doc.panels.find(p=>p.edges.some(e=>e.kind==='cubic')),e=p.edges.find(e=>e.kind==='cubic'),operation={type:'curveControl',panelIds:[p.id],edgeId:e.id,controlIndex:0,positionMm:[e.controlPointsMm[0][0],e.controlPointsMm[0][1]+.25]};
 const out=await rebuildEditedAnalytic(native,apply(operation),{operations:[operation]}),q=out.panels.find(q=>q.id===p.sourcePanelId);
 assert.deepEqual(q.edges[e.id].controlPointsMm[0],operation.positionMm);assert.notDeepEqual(q.edges[e.id].curvature,native.panels.find(q=>q.id===p.sourcePanelId).edges[e.id].curvature);
 assert.ok(mesh(out).panels.length===native.panels.length);assert.equal(out.validation.analytic2DPass,true);
});
test('explicit removal drops exactly incident seams, no invented replacement panel',async()=>{
 const id=ids[0],name=doc.panels[0].sourcePanelId,operation={type:'removePanels',panelIds:[id],removeIncidentStitches:true},out=await rebuildEditedAnalytic(native,apply(operation),{operations:[operation]});
 const expected=native.seams.filter(s=>s.a.panelId!==name&&s.b.panelId!==name);
 assert.equal(out.panels.length,native.panels.length-1);assert.deepEqual(out.seams.map(s=>s.id).sort(),expected.map(s=>s.id).sort());
 assert.equal(out.validation.physicalFitStatus,'not-run');assert.ok(mesh(out).panels.every(p=>p.id!==name));
});
test('placement changes do not modify material UV or edge lengths',async()=>{
 const operation={type:'translatePlacement',panelIds:[ids[0]],deltaMm:[5,0,3]},out=await rebuildEditedAnalytic(native,apply(operation),{operations:[operation]});
 for(const p of out.panels){const q=native.panels.find(q=>q.id===p.id);assert.deepEqual(p.verticesMm,q.verticesMm);for(const e of p.edges)assert.ok(Math.abs(e.lengthMm-q.edges[e.index].lengthMm)<.001);}
 const name=doc.panels[0].sourcePanelId,p=out.panels.find(p=>p.id===name),q=native.panels.find(p=>p.id===name);assert.deepEqual(p.placement.translationMm,q.placement.translationMm.map((v,i)=>v+operation.deltaMm[i]));
});
test('automatic envelope does not erase explicit initial placement',()=>{
 const p=mesh(native),chosen=p.panels[0];p.source.continuationExplicitPlacementPanels=[chosen.id];chosen.source.originalPlacement.translationMm=[5,1000,25];
 prepareContinuationAssembly(p,{positionsMm:[[0,1000,50],[0,1000,-50],[10,1010,50]]});assert.deepEqual(chosen.placement.translationMm,[5,1000,25]);
});
test('a mismatched base geometry is rejected rather than applying edits to another garment',async()=>{
 const d=structuredClone(doc);d.source.geometryHash='wrong';await assert.rejects(rebuildEditedAnalytic(native,d),/different source recipe/);
});
test('invalid scale and implicit incident deletion leave original untouched',()=>{
 assert.throws(()=>apply({type:'scalePanels',panelIds:ids,factor:-1}));assert.throws(()=>apply({type:'removePanels',panelIds:[ids[0]]}));assert.equal(stablePatternJSON(native),original);
});
test('independent sampling rejects a closed but self-crossed material boundary',async()=>{
 const base={schema:'kaopu-analytic-sewing-pattern@1',units:'mm',source:{commit:'fixture'},recipeHash:'base',geometryHash:'geometry',bodyCm:{height:175},design:{},panels:[{id:'square',verticesMm:[[0,0],[20,0],[20,20],[0,20]],edges:[0,1,2,3].map((i)=>({id:'e'+i,index:i,kind:'line',endpoints:[i,(i+1)%4],lengthMm:20,sampledPointsMm:[],curvature:null})),boundary:[0,1,2,3],placement:{translationMm:[0,0,0],rotationDegreesXYZ:[0,0,0],matrix3:[[1,0,0],[0,1,0],[0,0,1]]}}],seams:[],darts:[],interfaces:[],validation:{analytic2DPass:true}};
 const d=fromNativeAnalytic(base);d.panels[0].verticesMm=[[0,0],[20,20],[20,0],[0,20]];
 await assert.rejects(rebuildEditedAnalytic(base,d),/failed 2D checks/);
});
test('zero needle endpoint gaps do not hide an interior material-edge gap',()=>{
 const result=polylineGapBounds([[0,0,0],[5,4,0],[10,0,0]],[[0,0,0],[10,0,0]],{toleranceMm:.001});assert.ok(result.lowerBoundMm>=4);assert.equal(result.resolved,true);
});
