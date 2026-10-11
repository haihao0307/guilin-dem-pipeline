import assert from 'node:assert/strict';
import {hashSpecimen,GROWTH_GRID_STEP,botanicalKeys} from './rules/native78-bounded-signature-reference.mjs';
const fixture=()=>({geometry:{positions:new Float32Array([1,2,3]),normals:new Float32Array([0,1,0]),indices:new Uint32Array([0,1,2]),barkCoordinates69:new Float32Array([1,2e-15,1,0.1])},growth:{profile:{species:'ficus-microcarpa',seed:761014,stage:'juvenile'},value:0.1234,organs:3,unknownField:'included'},surfaces:{resources:[{id:'leaf',bytes:new Uint8Array([12,34,56,255])}]}});
const names=[];
async function differs(name,mutate){const a=fixture(),before=await hashSpecimen(a);mutate(a);assert.notEqual(await hashSpecimen(a),before,name);names.push(name);}
function nextF32(array,index){new Uint32Array(array.buffer,array.byteOffset,array.length)[index]++;}
await differs('one ULP position rejects',s=>nextF32(s.geometry.positions,0));
await differs('index change rejects',s=>s.geometry.indices[0]++);
await differs('one ULP normal rejects',s=>nextF32(s.geometry.normals,1));
await differs('bark radius ULP rejects',s=>nextF32(s.geometry.barkCoordinates69,3));
await differs('bark travel ULP rejects',s=>nextF32(s.geometry.barkCoordinates69,2));
await differs('bark direction outside threshold rejects',s=>s.geometry.barkCoordinates69[1]=2e-12);
await differs('growth change above maximum rejects',s=>s.growth.value+=1.1e-12);
await differs('growth integer remains exact',s=>s.growth.organs++);
await differs('profile remains exact',s=>s.growth.profile.seed++);
await differs('unknown field included',s=>s.growth.unknownField='modified');
await differs('unknown numeric field outside growth remains exact',s=>s.unknown=1.1);
await differs('resource pixel remains exact',s=>s.surfaces.resources[0].bytes[0]++);
await differs('array order remains exact',s=>s.geometry.indices.reverse());
for(const [name,mutate] of [['NaN scalar rejects',s=>s.growth.value=NaN],['NaN array rejects',s=>s.geometry.positions[1]=NaN]]){const s=fixture();mutate(s);await assert.rejects(hashSpecimen(s),/Nonfinite/);names.push(name);}
{
const s=fixture(),before=await hashSpecimen(s);s.geometry.barkCoordinates69[1]=-3e-15;assert.equal(await hashSpecimen(s),before);names.push('bounded direction near-zero signature accepts');
s.growth.value+=Number.EPSILON/8;assert.equal(await hashSpecimen(s),before);names.push('bounded growth last bit signature accepts');
}
{
const s=fixture(),positions=s.geometry.positions,bark=s.geometry.barkCoordinates69,values=JSON.stringify(s),bytes=new Uint8Array(bark.buffer).slice();await hashSpecimen(s);assert.strictEqual(s.geometry.positions,positions);assert.strictEqual(s.geometry.barkCoordinates69,bark);assert.deepEqual(new Uint8Array(bark.buffer),bytes);assert.equal(JSON.stringify(s),values);names.push('signature does not mutate input');
}
{
const s=fixture();s.extra=s.geometry.positions;const a=await hashSpecimen(s);s.extra=new Float32Array(s.geometry.positions);assert.notEqual(await hashSpecimen(s),a);names.push('typed-view alias preserved');
const data=new ArrayBuffer(24),v=new Float32Array(data,0,3),w=new Float32Array(data,12,3);v.set([1,2,3]);w.set([1,2,3]);s.extra=v;s.extra2=w;const b=await hashSpecimen(s);s.extra2=new Float32Array(w);assert.notEqual(await hashSpecimen(s),b);names.push('backing-store alias preserved');
}
{
class CompactLeaf{constructor(value){this.storage=value;}get attachment(){return [this.storage,0,0];}get normal(){return [0,1,0];}}
const s=fixture();s.growth.leaf=new CompactLeaf(0.12);const a=await hashSpecimen(s);assert(botanicalKeys(s.growth.leaf).includes('attachment'));Object.defineProperty(s.growth.leaf,'attachment',{get:()=>[0.2,0,0]});assert.notEqual(await hashSpecimen(s),a);names.push('prototype getters included');
}
assert(GROWTH_GRID_STEP<1e-12);console.log(JSON.stringify({passed:names.length,tests:names,growthMaxPairDifferenceExclusive:GROWTH_GRID_STEP,barkNearZeroMaxPairDifferenceExclusive:2e-12},null,2));
