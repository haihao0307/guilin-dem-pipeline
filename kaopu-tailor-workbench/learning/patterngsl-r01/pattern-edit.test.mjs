import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyPatternEdit,validateEditablePattern,samplePatternEdge,stablePatternJSON} from './pattern-edit-kernel.mjs';
function sample(){
 const panel=id=>({id,sourcePanelId:id,verticesMm:[[0,0],[10,0],[10,10],[0,10]],boundary:[0,1,2,3],placement:{translationMm:[20,100,30],rotationDegreesXYZ:[0,180,0],rotationConvention:'intrinsic XYZ'},edges:[
  {id:0,kind:'line',endpoints:[0,1],controlPointsMm:[]},
  {id:1,kind:'quadratic',endpoints:[1,2],controlPointsMm:[[12,5]]},
  {id:2,kind:'cubic',endpoints:[2,3],controlPointsMm:[[8,12],[2,12]]},
  {id:3,kind:'circle',endpoints:[3,0],arc:{centerMm:[0,5],radiusMm:5,startAngleDegrees:90,sweepDegrees:180}}
 ]});
 return{schema:'kaopu-explicit-pattern-edit@1',units:'mm',revision:0,panels:[panel('P0001'),panel('P0002')],stitches:[{id:'s',a:{panelId:'P0001',edgeId:0,reverse:false},b:{panelId:'P0002',edgeId:0,reverse:true}}],editHistory:[],simulationReady:false};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('all four explicit curve types retain independent parameters',()=>{
 const d=sample();assert.deepEqual(validateEditablePattern(d).curveTypes,['circle','cubic','line','quadratic']);
 const p=d.panels[0];assert.deepEqual(samplePatternEdge(p,p.edges[0],.5),[5,0]);assert.deepEqual(samplePatternEdge(p,p.edges[1],.5),[11,5]);assert.deepEqual(samplePatternEdge(p,p.edges[2],.5),[5,11.5]);
 const c=samplePatternEdge(p,p.edges[3],.5);near(c[0],-5);near(c[1],5);
});
test('uniform panel scale transforms vertices, Bezier controls and arc geometry consistently',()=>{
 const old=sample(),before=stablePatternJSON(old),r=applyPatternEdit(old,{type:'scalePanels',panelIds:['P0001','P0002'],factor:1.2,anchorMm:[2,3]});
 for(let ei=0;ei<4;ei++)for(const t of[0,.2,.5,.9,1]){const a=samplePatternEdge(old.panels[0],old.panels[0].edges[ei],t),b=samplePatternEdge(r.document.panels[0],r.document.panels[0].edges[ei],t);near(b[0],2+1.2*(a[0]-2));near(b[1],3+1.2*(a[1]-3));}
 assert.deepEqual(r.document.panels[0].placement,old.panels[0].placement);assert.deepEqual(r.document.stitches,old.stitches);assert.equal(before,stablePatternJSON(old));assert.equal(r.document.simulationReady,false);assert.equal(r.needsFreshMeshing,true);
});
test('curve adjustment affects the selected control, not endpoint references or other panel',()=>{
 const old=sample(),r=applyPatternEdit(old,{type:'curveControl',panelIds:['P0001'],edgeId:1,controlIndex:0,positionMm:[14,5]});
 assert.deepEqual(samplePatternEdge(r.document.panels[0],r.document.panels[0].edges[1],.5),[12,5]);assert.deepEqual(r.document.panels[0].verticesMm,old.panels[0].verticesMm);assert.deepEqual(r.document.panels[1],old.panels[1]);
});
test('a sleeve-spread style translation changes initial placement, NOT sleeve circumference',()=>{
 const old=sample(),r=applyPatternEdit(old,{type:'translatePlacement',panelIds:['P0001'],deltaMm:[100,0,0]});
 assert.deepEqual(r.document.panels[0].placement.translationMm,[120,100,30]);assert.deepEqual(r.document.panels[0].verticesMm,old.panels[0].verticesMm);assert.deepEqual(r.document.panels[0].edges,old.panels[0].edges);assert.deepEqual(r.document.stitches,old.stitches);assert.equal(r.needsFreshMeshing,false);assert.equal(r.needsFreshDrape,true);
});
test('component removal explicitly removes only incident stitches and preserves remaining stable IDs',()=>{
 const old=sample();assert.throws(()=>applyPatternEdit(old,{type:'removePanels',panelIds:['P0001']}),/explicit/);
 const r=applyPatternEdit(old,{type:'removePanels',panelIds:['P0001'],removeIncidentStitches:true});assert.deepEqual(r.changes.removedStitchIds,['s']);assert.equal(r.document.stitches.length,0);assert.equal(r.document.panels[0].id,'P0002');assert.equal(old.panels.length,2);assert.equal(old.stitches.length,1);
});
test('invalid edits reject atomically',()=>{
 const old=sample(),before=stablePatternJSON(old);
 for(const op of[
  {type:'scalePanels',panelIds:['missing'],factor:2},{type:'scalePanels',panelIds:['P0001'],factor:-1},
  {type:'scalePanels',panelIds:['P0001'],factor:Infinity},{type:'translatePlacement',panelIds:['P0001'],deltaMm:[0,NaN,0]},
  {type:'curveControl',panelIds:['P0001'],edgeId:3,controlIndex:0,positionMm:[0,0]},
  {type:'curveControl',panelIds:['P0001'],edgeId:1,controlIndex:2,positionMm:[0,0]},
  {type:'removePanels',panelIds:['P0001','P0002'],removeIncidentStitches:true}
 ]){assert.throws(()=>applyPatternEdit(old,op));assert.equal(stablePatternJSON(old),before);}
});
test('malformed stitch references and non-closed ordered boundaries are rejected, not guessed',()=>{
 const a=sample();a.stitches[0].b.edgeId=999;assert.throws(()=>validateEditablePattern(a),/reference/);
 const b=sample();b.panels[0].boundary=[1,0,2,3];assert.throws(()=>validateEditablePattern(b),/closed loop/);
});
test('property key order is canonical, vertex and stitch orientation order is never sorted',()=>{
 const a=sample(),b=JSON.parse(JSON.stringify(a),(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).reverse()):v);
 assert.equal(stablePatternJSON(a),stablePatternJSON(b));b.panels[0].verticesMm.reverse();assert.notEqual(stablePatternJSON(a),stablePatternJSON(b));
});
