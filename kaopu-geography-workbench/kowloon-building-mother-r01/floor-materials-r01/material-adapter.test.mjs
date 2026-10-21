import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {FLOOR_MATERIAL_GLSL,FLOOR_MATERIAL_DEFAULTS,buildFloorMaterialGLSL,sampleTileCell,normalizeFloorMaterialOptions} from './material-adapter.mjs';
import * as source from './sources/field-sources.mjs';
const provenance=JSON.parse(readFileSync(new URL('./sources/provenance.json',import.meta.url)));
const near=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('each imported original field closure matches its recorded bytes',()=>{for(const s of provenance.sources.filter(s=>s.closureExport))assert.equal(createHash('sha256').update(source[s.closureExport]).digest('hex'),s.closureSHA256);});
test('original ceramic and metal functions actually reach the receiver outputs',()=>{
 assert.match(FLOOR_MATERIAL_GLSL,/fmR04_ctEvaluate\(color,rough,height,coat,coatRough,chip,deposit\)/);
 assert.match(FLOOR_MATERIAL_GLSL,/fmR06_metalField\(p,fp\)/);
 assert.match(FLOOR_MATERIAL_GLSL,/s.coverageF0=m.coverageF0/);
 assert.match(FLOOR_MATERIAL_GLSL,/fmP_kpPlasterOriginalField/);
 assert.doesNotMatch(FLOOR_MATERIAL_GLSL.replace(/\/\/[^\n]*/g,''),/new T\.|Mesh|rayTrace|caseTraceRay|mapField\(/);
});
test('material mode and metre bounds reject invalid input',()=>{
 for(const options of [{floorTileM:[0,.2]},{floorJointM:-1},{bevelDropM:.01},{woodReliefM:.03},{doorFinish:'metal'},{frameCoatColor:[NaN,0,0]}])assert.throws(()=>normalizeFloorMaterialOptions(options));
 assert.throws(()=>sampleTileCell(12,[0,0,0]));assert.throws(()=>sampleTileCell(10,[0,0,0],-1));assert.throws(()=>sampleTileCell(10,[0,Infinity,0]));
});
test('floor uses metre X/Z while exterior uses metre X/Y, no extent normalization',()=>{
 const a=sampleTileCell(10,[.1,0,.1]),b=sampleTileCell(10,[.1,99,.1]);assert.deepEqual(a,b);
 const c=sampleTileCell(11,[.1,.02,0]),d=sampleTileCell(11,[.1,.02,-88]);assert.deepEqual(c,d);
 near(a.pitchM[0],.301);near(a.pitchM[1],.301);near(c.pitchM[0],.201);near(c.pitchM[1],.051);
});
test('cell IDs and coordinates are stable under zoom and arbitrary evaluation order',()=>{
 const point=[1.233,.031,-.271],a=sampleTileCell(10,point,1e-6),b=sampleTileCell(10,point,.02);assert.deepEqual(a.cell,b.cell);assert.deepEqual(a.localM,b.localM);
 sampleTileCell(11,[-6.3,.12,0]);assert.deepEqual(sampleTileCell(10,point,1e-6),a);
});
test('exact one-pitch translations increment integer cell and preserve local metres',()=>{
 for(const role of [10,11])for(const point of [[.06,.013,.04],[-.06,-.013,-.04]]){
 const a=sampleTileCell(role,point,.0001),shift=[...point];shift[0]+=a.pitchM[0];shift[role===10?2:1]-=a.pitchM[1];const b=sampleTileCell(role,shift,.0001);
 assert.deepEqual(b.cell,[a.cell[0]+1,a.cell[1]-1]);a.localM.forEach((v,i)=>near(v,b.localM[i]));near(a.tileMask,b.tileMask);near(a.bevelHeightM,b.bevelHeightM);
 }
});
test('negative chart coordinates use floor cells and reconstruct original point',()=>{
 for(let i=-30;i<=30;i++)for(const role of [10,11]){const p=[i*.031+.003,i*.017-.002,-i*.023+.001],s=sampleTileCell(role,p);s.uvM.forEach((v,k)=>near(v,(s.cell[k]+.5)*s.pitchM[k]+s.localM[k]));}
});
test('physical joint width is not stretched by tile pitch or floor size',()=>{
 for(const role of [10,11]){const s=sampleTileCell(role,[0,0,0]),axis=role===10?2:1,base=[0,0,0];base[axis]=s.pitchM[1]/2;const grout=sampleTileCell(role,base,1e-7);assert.equal(grout.tileMask,0);near(grout.bevelHeightM,-FLOOR_MATERIAL_DEFAULTS.groutRecessM);
 base[0]=s.jointM*.5+.002;assert.equal(sampleTileCell(role,base,1e-7).tileMask,1);base[0]=s.jointM*.5-.00005;assert.equal(sampleTileCell(role,base,1e-7).tileMask,0);}
});
test('all material height is explicitly shading-only with bounded periodic profile',()=>{
 for(let i=0;i<500;i++){const s=sampleTileCell(i%2?10:11,[Math.sin(i)*3,Math.cos(i)*2,i*.002],.0001);assert.equal(s.geometryDisplacementM,0);assert.ok(s.bevelHeightM>=-.0015-1e-12&&s.bevelHeightM<=1e-12);assert.ok(s.tileMask>=0&&s.tileMask<=1);}
});
test('bounded slice uses painted door and no unshipped timber dependency',()=>{assert.doesNotMatch(FLOOR_MATERIAL_GLSL,/fmW_woodSignals/);assert.throws(()=>buildFloorMaterialGLSL({doorFinish:'wood'}));assert.match(FLOOR_MATERIAL_GLSL,/if\(role<13.5\)return fmMetal/);assert.ok(FLOOR_MATERIAL_GLSL.length<30000);});

test('generated GLSL function/block delimiters are balanced before browser compile gate',()=>{
 const text=FLOOR_MATERIAL_GLSL.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');let depth=0;
 for(const c of text){if(c==='{')depth++;else if(c==='}')depth--;assert.ok(depth>=0);}
 assert.equal(depth,0);assert.match(text,/FloorMaterialSample fmDoor[\s\S]*?return fmDielectric[^;]+;\s*}\s*FloorMaterialSample sampleFloorMaterial/);
});
