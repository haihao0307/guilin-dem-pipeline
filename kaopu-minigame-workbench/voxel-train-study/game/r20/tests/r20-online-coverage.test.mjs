import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as I from '../street/instrument.mjs';
import {createRoutePlan} from '../street/route-plan.mjs';
import {createStreetDistrict} from '../street-district.mjs';
import {kcrRoute} from '../timetable.mjs';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const routeScore=()=>json('../street/route.score.json');
const anchor=()=>json('../street/first-street.score.json');
const route=kcrRoute(1978),cameraTarget=[-17,2.3,1.2];

// Actual distance/Session elapsed observations from the trusted-UI WebGL
// recording in GitHub Actions run 38042577648, commit 995229a540d6c37396b85e7cdeae75a69e360aa7.
// Source: browser/result.json final.observation.samples, plus the final native
// second-stop state. These are sampled observations, not every original frame.
// Replaying each observation with exactly one update is deliberately conservative:
// there are no intermediate frames or screenshot-pause settling opportunities.
const recordedJourney=[
  [13.560000000000004,32.36666666666739],[21.73600000000001,34.36666666666728],
  [31.83200000000002,36.366666666667165],[43.84800000000003,38.36666666666705],
  [57.784000000000034,40.36666666666694],[73.64000000000004,42.36666666666682],
  [96.80160000000004,44.933333333333344],[102.3413333333334,45.49999999999998],
  [123.12533333333342,47.499999999999865],[145.82933333333344,49.49999999999975],
  [170.45333333333346,51.49999999999964],[197.45600000000016,53.533333333332855],
  [200.66324444444462,53.766666666666175],[235.09926666666698,56.299999999999365],
  [261.7869333333339,58.29999999999925],[286.73266666666746,60.19999999999914],
  [312.56233333333455,62.19999999999903],[337.9520000000017,64.19999999999892],
  [362.901666666669,66.19999999999881],[390.2421333333365,68.43333333333202],
  [415.4498333333373,70.5333333333319],[439.00616666667156,72.53333333333178],
  [462.122500000006,74.53333333333167],[488.1623333333406,76.83333333333154],
  [494.48860000000764,77.39999999999817],[516.5342666666756,79.39999999999806],
  [523.7850444444539,80.06666666666469],[532.0630000000099,80.83333333333131],
  [553.3533333333448,82.8333333333312],[574.2036666666799,84.83333333333108],
  [594.6140000000147,86.83333333333097],[618.5256000000168,89.23333333333083],
  [622.1901333333506,89.63333333333081],[633.072800000019,91.6333333333307],
  [642.3331000000197,100.23333333333021],[651.4061000000199,106.23333333332987],
  [662.2468000000198,119.1999999999958],[672.9618000000196,125.19999999999546],
  [680.1987666666859,131.83333333332843],[690.1493333333526,145.63333333332764],
  [696.8200444444632,185.73333333332536],
];

function fixedStepJourney(step){
  const positions=[];
  for(let distance=step;distance<700;distance+=step)positions.push([distance,distance/18]);
  positions.push([700,700/18]);
  return positions;
}

async function verifyOnlineCoverage(journey){
  const score=routeScore(),plan=createRoutePlan(score,route),created=[];
  let attempts=0;
  const instrument={...I,build(...args){attempts++;const handle=I.build(...args);created.push(handle);return handle;}};
  const district=createStreetDistrict({routeScore:score,anchorScore:anchor(),instrument});
  await district.ready;
  try{
    // Initial stationary loading is allowed. No journey point is settled below.
    for(let frame=0;frame<32;frame++){
      district.update({distance:0,elapsed:0},route,{cameraTarget});
      assert.equal(district.proof.error,undefined);
      if(!district.proof.pending)break;
    }
    assert.equal(district.proof.pending,0,'Initial stationary district must finish loading');
    for(const [distance,elapsed] of journey){
      const before=attempts;
      district.update({distance,elapsed},route,{cameraTarget});
      const proof=district.proof,focus=distance+cameraTarget[0];
      assert.equal(proof.error,undefined,`Budget/generation error at ${distance}m: ${proof.error}`);
      assert(attempts-before<=2,`More than two actual builds at ${distance}m`);
      assert.equal(proof.lastUpdateAttempts,attempts-before);
      assert.equal(proof.focus,focus);
      assert.equal(proof.elapsed,elapsed);
      const resident=new Map(proof.activeChunks.map(c=>[c.id,c]));
      const byDistance=plan.chunks.slice().sort((a,b)=>Math.abs(a.center-8-focus)-Math.abs(b.center-8-focus));
      assert(resident.has(byDistance[0].id),`Nearest parcel missing at ${distance}m: ${byDistance[0].id}`);
      // The manager's canonical parcel focus is center-8. Every parcel in the
      // +/-70m protected viewing interval needs a real rendered silhouette,
      // although fine-detail work is allowed to remain pending.
      const protectedParcels=plan.chunks.filter(c=>Math.abs(c.center-8-focus)<=70);
      const missing=protectedParcels.filter(c=>!resident.has(c.id)).map(c=>`${c.id}@${c.center}`);
      assert.deepEqual(missing,[],`Visible +/-70m coverage holes at ${distance}m; pending=${proof.pending}`);
      assert.equal(district.handles.length,resident.size);
      assert(resident.size<=score.streaming.maxActiveChunks);
      assert(proof.metrics.expandedTriangles<=score.streaming.maxExpandedTriangles);
      assert(proof.metrics.geometryBytes<=score.streaming.maxGeometryBytes);
      assert.equal(proof.metrics.textures,0);
      for(const handle of district.handles){
        const parcel=resident.get(handle.score.object.id);
        assert(parcel&&handle.root.parent===null&&!handle.disposed);
        assert.equal(handle.stats.buildings,2,'Coverage requires actual two-building geometry');
        assert(handle.stats.expandedTriangles>0);
        assert.equal(handle.root.position.x,0);assert.equal(district.renderBatches.root.position.x,-distance);assert.equal(proof.renderBatch.renderTriangles,proof.metrics.expandedTriangles);
        assert.equal(handle.state.time,elapsed);
      }
    }
    assert(district.proof.unloadCount>0,'The trip must exercise real streaming release');
    assert(district.proof.shared.gpuLastReferenceReleases>0,'Released ownership must dispose shared GPU resources');
    assert(created.some(h=>h.disposed),'Old generated parcels must be released during the journey');
  }finally{district.dispose();}
  assert.equal(district.proof.status,'disposed');
  assert.equal(district.root.children.length,0);
  assert.equal(district.handles.length,0);
  assert.equal(district.proof.shared.referenceTotal,0);
  assert.equal(district.proof.shared.cpuBytes,0);
  assert.equal(district.proof.metrics.geometryBytes,0);
  assert.equal(district.proof.metrics.instanceBytes,0);
  assert(created.every(h=>h.disposed),'Final disposal must release every created handle');
}

test('Actual recorded trip retains +/-70m street silhouettes with one update per observed position',async()=>{
  await verifyOnlineCoverage(recordedJourney);
});

for(const step of [24,36])test(`${step}m per update cannot starve the nearest or +/-70m street silhouettes`,async()=>{
  await verifyOnlineCoverage(fixedStepJourney(step));
});
