import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as I from '../street/instrument.mjs';
import {createRoutePlan,resolveChunk,desiredChunks} from '../street/route-plan.mjs';
import {createStreetDistrict} from '../street-district.mjs';
import {kcrRoute} from '../../r17/timetable.mjs';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const routeScore=()=>json('../street/route.score.json');
const anchor=()=>json('../street/first-street.score.json');
const host=kcrRoute(1978);

function retainedArchitecture(handle){
  const keys=['buildings','windows','cages','openCasements','balconies','shops','shopsOpen','shopsClosed','signs','signSupports','buildingBounds','piercedOpenings'];
  return {
    features:Object.fromEntries(keys.map(key=>[key,structuredClone(handle.stats[key])])),
    // Canopies remain present at every LOD. Compare the authored rest pose,
    // pinning, and explicit-time animation, not just their overall AABB.
    canopies:handle.cloth.filter(c=>c.kind==='canopy').map(c=>({
      seed:c.seed,rest:Array.from(c.rest),pinned:Array.from(c.pinned),
      positions:Array.from(c.mesh.geometry.attributes.position.array),
      indices:Array.from(c.mesh.geometry.index.array),
    })),
  };
}

test('Every parcel preserves canopy poses and structural decisions across near/mid/far LOD',()=>{
  const p=createRoutePlan(routeScore(),host),template=anchor(),pool=I.createSharedResources();
  try{
    for(const parcel of p.chunks){
      let expected;
      for(const detail of ['near','mid','far']){
        const handle=I.build(resolveChunk(p,parcel,template,detail),{shared:pool,timeSeconds:2.75});
        try{
          const actual=retainedArchitecture(handle);
          if(detail==='near')expected=actual;
          else assert.deepEqual(actual,expected,`${parcel.id}: ${detail} must simplify the same architecture, not change its random decisions`);
        }finally{I.dispose(handle);}
      }
    }
    assert.equal(pool.snapshot().referenceTotal,0);
  }finally{pool.dispose();}
});

test('Failed generation still consumes the fixed per-update attempt budget without retry loops',async()=>{
  let calls=0;
  const instrument={...I,build(){calls++;throw new Error('Injected generation failure');}};
  const score=routeScore(),district=createStreetDistrict({routeScore:score,anchorScore:anchor(),instrument});
  await district.ready;
  try{
    const target=[-8,0,1],desired=desiredChunks(createRoutePlan(score,host),target[0]);
    for(let frame=0;frame<desired.length;frame++){
      const before=calls;
      assert.doesNotThrow(()=>district.update({distance:0,elapsed:0},host,{cameraTarget:target}));
      assert(calls-before<=score.streaming.maxBuildsPerFrame,'A failed attempt must count against the frame cap');
      assert.equal(district.proof.lastUpdateAttempts,calls-before);
    }
    assert.equal(calls,desired.length,'A permanently failed parcel should not be retried every animation frame');
    assert.equal(district.proof.buildAttempts,calls);
    assert.equal(district.proof.pending,0);
    assert.equal(district.proof.status,'error');
    assert.match(district.proof.error,/Injected generation failure/);
    assert.equal(district.handles.length,0);
    assert.equal(district.proof.shared.referenceTotal,0);
  }finally{district.dispose();}
});

test('Rejected LOD replacement retains its rendered predecessor and shared resource ownership',async()=>{
  let reject=false,calls=0;
  const instrument={...I,
    build(...args){calls++;return I.build(...args);},
    measure(handle){const m=I.measure(handle);return reject?{...m,expandedTriangles:1_000_000}:m;},
  };
  const district=createStreetDistrict({routeScore:routeScore(),anchorScore:anchor(),instrument});
  await district.ready;
  try{
    for(let n=0;n<16;n++){
      district.update({distance:0,elapsed:2.75},host,{cameraTarget:[7,2,0]});
      assert.equal(district.proof.error,undefined);
      if(!district.proof.pending)break;
    }
    assert.equal(district.proof.pending,0);
    const before={handles:district.handles,load:district.proof.loadCount,unload:district.proof.unloadCount,
      references:district.proof.shared.referenceTotal,triangles:district.proof.metrics.expandedTriangles,calls};
    reject=true;
    // Crossing the nearest-parcel boundary requests one downgrade and one
    // upgrade while keeping the resident parcel set unchanged.
    district.update({distance:0,elapsed:2.75},host,{cameraTarget:[9,2,0]});
    assert.equal(calls-before.calls,2);
    assert.equal(district.proof.lastUpdateAttempts,2);
    assert.equal(district.proof.status,'error');
    assert.match(district.proof.error,/Prospective live street budget exceeded/);
    assert.equal(district.proof.loadCount,before.load);
    assert.equal(district.proof.unloadCount,before.unload);
    assert.deepEqual(district.handles,before.handles);
    assert(district.handles.every(h=>!h.disposed&&h.root.parent===district.root));
    assert.equal(district.proof.shared.referenceTotal,before.references);
    assert.equal(district.proof.metrics.expandedTriangles,before.triangles);
    assert.equal(district.proof.events.filter(e=>e.kind==='budget-lod').length,0,'No hidden recursive LOD fallback');
  }finally{district.dispose();}
});
