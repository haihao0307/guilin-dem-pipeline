import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedResources} from '../street/instrument.mjs';
import {SHOP_CATALOG} from '../street/glyphs.mjs';
function handle(pool,index=0){const shop=SHOP_CATALOG[index];return {root:pool.makeWord(shop.text,{style:shop.style,height:.82,depth:.018})};}
function geometrySet(h){const out=new Set();h.root.traverse(o=>{if(o.geometry)out.add(o.geometry);});return out;}
test('CPU cache budget validates and live geometry is never evicted, even above a zero idle budget',()=>{
 for(const n of [-1,NaN,-Infinity])assert.throws(()=>createSharedResources({cacheBudgetBytes:n}));
 const p=createSharedResources({cacheBudgetBytes:0}),h=handle(p);p.retain(h);const active=p.snapshot();assert(active.activeBytes>0);assert.equal(active.cpuBytes,active.activeBytes);assert.equal(active.evictedGlyphs,0);assert.throws(()=>p.dispose(),/referenced/);p.release(h);const empty=p.snapshot();assert.equal(empty.activeBytes,0);assert.equal(empty.cpuBytes,0);assert.equal(empty.referenceTotal,0);assert(empty.evictedGlyphs>0);p.dispose();p.dispose();
});
test('Two chunk owners share the same glyphs and final GPU release occurs only at last owner',()=>{
 const p=createSharedResources({cacheBudgetBytes:0}),a=handle(p),b=handle(p);p.retain(a);p.retain(b);const geometries=geometrySet(a);assert.deepEqual(geometrySet(b),geometries);let releases=0;for(const g of geometries)g.addEventListener('dispose',()=>releases++);p.release(a);assert.equal(releases,0);assert.equal(p.snapshot().referenceTotal,geometries.size);p.release(b);assert.equal(releases,geometries.size);assert.equal(p.snapshot().cpuBytes,0);p.dispose();
});
test('Bounded cache keeps a recent idle word reusable, trims only idle words and fully disposes',()=>{
 const p=createSharedResources(),a=handle(p);p.retain(a);const original=geometrySet(a);p.release(a);const b=handle(p);assert.deepEqual(geometrySet(b),original);p.retain(b);assert.equal(p.snapshot().wordFactory.evictions,0);p.release(b);p.dispose();assert.equal(p.snapshot().cpuBytes,0);assert.equal(p.snapshot().referenceTotal,0);
});
test('Abandoned unretained word construction is explicitly trimmable without leaking zero-budget glyphs',()=>{
 const p=createSharedResources({cacheBudgetBytes:0});handle(p);assert(p.snapshot().cpuBytes>0);p.trim();assert.equal(p.snapshot().cpuBytes,0);p.dispose();
});
