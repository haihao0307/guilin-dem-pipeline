import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRecipe,createEvaluator,evaluatePart,mergeParts,stageToOBJ,QUALITY,progress,sampleMantle,sampleMantleMid} from '../coral-growth.mjs';
const Q={steps:8,cols:16,tube:16,pad:16};
const hash=stage=>{const h=createHash('sha256');for(const p of stage.parts){h.update(p.id);h.update(p.positions);h.update(p.indices);}return h.digest('hex');};
function checkMesh(part){
 assert.ok(part.positions.length>0,part.id);assert.equal(part.positions.length%3,0);assert.equal(part.indices.length%3,0);
 for(const v of part.positions)assert.ok(Number.isFinite(v),`${part.id} nonfinite`);
 const edges=new Map();
 for(let i=0;i<part.indices.length;i+=3){const ids=Array.from(part.indices.subarray(i,i+3));for(const v of ids)assert.ok(v>=0&&v<part.positions.length/3,`${part.id} index`);assert.equal(new Set(ids).size,3,`${part.id} degenerate ids`);
  const p=ids.map(k=>Array.from(part.positions.subarray(k*3,k*3+3))),a=p[1].map((v,i)=>v-p[0][i]),b=p[2].map((v,i)=>v-p[0][i]);assert.ok(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])>1e-12,`${part.id} zero area`);
  for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=a<b?`${a}/${b}`:`${b}/${a}`,value=edges.get(key)||{n:0,w:0};value.n++;value.w+=a<b?1:-1;edges.set(key,value);}
 }
 for(const [key,e] of edges){assert.equal(e.n,2,`${part.id} edge ${key} incidence`);assert.equal(e.w,0,`${part.id} edge ${key} inconsistent orientation`);}
}

test('same seed produces byte-identical recipe and geometry',()=>{
 const a=createRecipe(),b=createRecipe();assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(hash(createEvaluator(a,Q)(1)),hash(createEvaluator(b,Q)(1)));
});
test('rewind and repeated stages reproduce exactly; no history mutation',()=>{
 const r=createRecipe(),frozen=JSON.stringify(r),evaluate=createEvaluator(r,Q),first=evaluate(.63),h=hash(first);evaluate(1);evaluate(.14);assert.equal(hash(evaluate(.63)),h);assert.equal(JSON.stringify(r),frozen);
});
test('lineage is complete and children never precede parent arrival',()=>{
 for(const density of [.45,1,1.6]){
  const r=createRecipe({density}),map=new Map(r.records.map(p=>[p.id,p]));assert.equal(map.size,r.records.length);
  for(const p of r.records){assert.ok(p.birth+1e-10>=p.parentArrival,`${p.id} birth`);if(!p.parent)continue;const parent=map.get(p.parent);assert.ok(parent,`${p.id} parent exists`);if(parent.type==='base')continue;const arrival=parent.birth+parent.duration*p.attachmentMaterialT;assert.ok(Math.abs(p.parentArrival-arrival)<1e-8,`${p.id} parent arrival`);assert.ok(p.birth>=arrival-1e-10);}
  assert.ok(r.endTime<=1,'all records mature by stage 1');
 }
});
test('low connected pads, unequal buds, primary stems, then lamellae',()=>{
 const r=createRecipe(),e=createEvaluator(r,Q);assert.equal(e(0).parts.length,8);assert.equal(e(.02).parts.length,8);assert.equal(e(.18).lineage.filter(p=>p.type==='stem'&&p.active).length,7);assert.equal(e(.18).lineage.filter(p=>p.type==='mantle'&&p.active).length,0);
 const heights=r.records.filter(p=>p.type==='stem').map(p=>p.tip[1]);assert.equal(heights.filter(v=>v>1.1).length,3);assert.ok(Math.max(...heights)>Math.min(...heights)*4);
 const stages=[0,.08,.18,.35,.55,.75,1].map(t=>e(t));assert.ok(stages.at(-1).lineage.filter(p=>p.type==='mantle'&&p.active).length>400);
 for(let i=1;i<stages.length;i++)assert.ok(stages[i].parts.length>=stages[i-1].parts.length);
 // Each elliptical foot pad overlaps the low central pad in plan view.
 const pads=r.records.filter(p=>p.type==='base');for(const p of pads.slice(1))assert.ok((p.origin[0]/(p.axes[0]+pads[0].axes[0]))**2+(p.origin[2]/(p.axes[2]+pads[0].axes[2]))**2<1);
});
test('seed, density, fold and time change actual mesh geometry',()=>{
 const r=createRecipe(),base=hash(createEvaluator(r,Q)(1));assert.notEqual(hash(createEvaluator(createRecipe({seed:18}),Q)(1)),base);assert.notEqual(hash(createEvaluator(createRecipe({fold:.4}),Q)(1)),base);assert.notEqual(hash(createEvaluator(r,Q)(.55)),base);
 const low=createRecipe({density:.5}),high=createRecipe({density:1.5});assert.ok(high.records.filter(p=>p.type==='mantle').length>low.records.filter(p=>p.type==='mantle').length*2);
 assert.equal(JSON.stringify(low.records.find(p=>p.id==='stem-0')),JSON.stringify(high.records.find(p=>p.id==='stem-0')),'density must not resample main layout');
});
test('old material vertices persist and mantle thickness follows folded normals',()=>{
 const r=createRecipe(),petal=r.records.find(p=>p.type==='mantle');
 const a=evaluatePart(petal,petal.birth+petal.duration*.61,Q),b=evaluatePart(petal,petal.birth+petal.duration*.93,Q);
 const key=(p,i)=>`${p[i]},${p[i+1]},${p[i+2]}`,later=new Set();for(let i=0;i<b.positions.length;i+=3)later.add(key(b.positions,i));let persistent=0;for(let i=0;i<a.positions.length;i+=3)if(later.has(key(a.positions,i)))persistent++;
 assert.ok(persistent>=a.positions.length/3-2*(Q.cols+1),'all fixed material rows retained except moving frontier row');
 for(const u of [0,.2,.5,.87,.94,1])for(const v of [0,.2,.5,.8,1]){const top=sampleMantle(petal,u,v,1,Q),bottom=sampleMantle(petal,u,v,-1,Q),mid=sampleMantleMid(petal,u,v);assert.ok(Math.abs(Math.hypot(...top.map((p,i)=>p-bottom[i]))-petal.thickness)<1e-8);for(let i=0;i<3;i++)assert.ok(Math.abs((top[i]+bottom[i])/2-mid[i])<1e-10);}
 const top=sampleMantle(petal,.94,.5,1,Q),bottom=sampleMantle(petal,.94,.5,-1,Q);assert.ok(Math.hypot(top[0]-bottom[0],top[2]-bottom[2])>.001,'fold normal is not only global Y');
 const stem=r.records.find(p=>p.type==='stem'),x=evaluatePart(stem,stem.birth+stem.duration*.51,Q),y=evaluatePart(stem,stem.birth+stem.duration*.9,Q);assert.deepEqual(Array.from(x.positions.slice(0,10*Q.tube*3)),Array.from(y.positions.slice(0,10*Q.tube*3)));
});
test('all active pieces finite, nonempty, consistently oriented closed shells',()=>{
 const r=createRecipe(),evaluate=createEvaluator(r,Q);
 for(const t of [0,.081,.253,.419,.637,1]){const stage=evaluate(t);for(const p of stage.parts)checkMesh(p);}
 // Individual shell incidence is not proof of a connected watertight union or no intersections.
});
test('time clamped, invalid parameters sanitized, maturity independent of history',()=>{
 const r=createRecipe({density:NaN,fold:Infinity}),e=createEvaluator(r,Q);assert.equal(r.params.density,1);assert.equal(r.params.fold,1);assert.equal(hash(e(-5)),hash(e(0)));assert.equal(hash(e(9)),hash(e(1)));assert.equal(progress(.1,.2,.3),0);assert.equal(progress(1,.2,.3),1);
});
test('OBJ keeps original named pieces and current-stage index bounds',()=>{
 const e=createEvaluator(createRecipe(),Q),stage=e(.35),obj=stageToOBJ(stage),v=obj.split('\n').filter(l=>l.startsWith('v ')),faces=obj.split('\n').filter(l=>l.startsWith('f '));assert.equal(obj.split('\n').filter(l=>l.startsWith('o ')).length,stage.parts.length);assert.match(obj,/NOT a watertight unified union/);
 for(const line of faces)for(const id of line.slice(2).split(' ').map(Number))assert.ok(id>=1&&id<=v.length);const merged=mergeParts(stage.parts);assert.equal(merged.positions.length/3,v.length);assert.equal(merged.indices.length/3,faces.length);
});
test('default preview mature stage passes complete finite/index checks',()=>{
 const r=createRecipe(),e=createEvaluator(r,QUALITY.preview),stage=e(1),m=mergeParts(stage.parts);assert.equal(stage.parts.length,479);assert.ok(m.positions.length/3>300000);assert.ok(m.indices.length/3>650000);for(const p of m.positions)assert.ok(Number.isFinite(p));for(const i of m.indices)assert.ok(i<m.positions.length/3);
});
