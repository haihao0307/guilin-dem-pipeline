import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {makeMetricPlasterField, PLASTER_METRIC_SCALE_METRES} from './metric-field-domain.mjs';
import {createNativePlaster, validatePlaster} from './plaster-native.mjs';
import {samplePlaster, mmXi, mmCell} from './fields.mjs';

const candidates = [
  ...(process.env.PLASTER_THREE_FILE ? [pathToFileURL(process.env.PLASTER_THREE_FILE)] : []),
  new URL('../../../../vendor/three.module.js', import.meta.url),
];
const threeURL = candidates.find(url => fs.existsSync(url));
if (!threeURL) throw Error('Set PLASTER_THREE_FILE to the host Three module');
const THREE = await import(threeURL);

function wall(bottom = .04, height = 2.6) {
  return {id:'metric-test', alongX:true, fixed:.3, start:.15, end:3.7, bottom, height, side:'front', openings:[]};
}

// The same unmodified source mmObserved algebra at a fixed nine-octave bound.
// This CPU check isolates coordinate anisotropy, not GPU derivative filtering.
function observed(x, y, params) {
  const q = [(x-params.center[0])/params.half[0], (y-params.center[1])/params.half[1], .11];
  const xi = mmXi(q, [-1.3,4.7,2.2]);
  let value = 0;
  for (let octave=0; octave<9; octave++) value += mmCell(xi, 2**octave) / 2**octave;
  return Math.tanh(.86*value);
}

function directionalRatio(params) {
  let du=0, dy=0;
  for(let y=.5; y<27; y+=.1) for(let x=.25; x<3.65; x+=.1) {
    du += (observed(x+.025,y,params)-observed(x-.025,y,params))**2;
    dy += (observed(x,y+.025,params)-observed(x,y-.025,params))**2;
  }
  return Math.sqrt(du/dy);
}

test('metric bridge uses one immutable centre and equal metre axes, without silently using wall height', () => {
  const center=[1.925,13.695], field=makeMetricPlasterField({center});
  assert.equal(PLASTER_METRIC_SCALE_METRES,1.8);
  assert.deepEqual(field.half,[1.8,1.8]);
  center[1]=0;
  assert.deepEqual(field.center,[1.925,13.695]);
  assert(Object.isFrozen(field) && Object.isFrozen(field.center) && Object.isFrozen(field.half));
  assert.throws(()=>makeMetricPlasterField());
  assert.throws(()=>makeMetricPlasterField({center:[0,NaN]}));
  assert.throws(()=>makeMetricPlasterField({center:[0,0],metresPerUnit:.001}));
});

test('legacy adapter remains explicitly available for A/B; tall-domain anisotropy is removed at unchanged source algebra', () => {
  const legacy={center:[1.925,13.695],half:[1.775,13.695]};
  assert.deepEqual(validatePlaster(wall(),legacy).half,legacy.half);
  const fixed=makeMetricPlasterField({center:legacy.center,metresPerUnit:1.775});
  const oldRatio=directionalRatio(legacy), fixedRatio=directionalRatio(fixed);
  assert(oldRatio>6 && oldRatio<6.8, `Frozen domain diagnostic changed: ${oldRatio}`);
  assert(fixedRatio>.9 && fixedRatio<1.1, `Metric source diagnostic changed: ${fixedRatio}`);
  console.log('Unfiltered source coordinate direction ratios:', {oldRatio,fixedRatio});
});

test('metric fields do not reset at floor boundaries or depend on the wall/region size', () => {
  const field=makeMetricPlasterField({center:[1.925,13.695]});
  const lower=validatePlaster(wall(.04,2.75),field);
  const upper=validatePlaster({...wall(2.79,2.75),start:-.25,end:3.9},field);
  for(const face of [-1,1]) for(const u of [.25,1.1,2.8]) {
    assert.deepEqual(samplePlaster(u,2.79,face,lower),samplePlaster(u,2.79,face,upper));
  }
});

test('field bridge changes only field inputs, with identical topology, carrier coordinates and allocation', () => {
  const w=wall(), regions=[{u0:w.start,u1:w.end,y0:w.bottom,y1:w.bottom+w.height}];
  const old=createNativePlaster({THREE,parentWall:w,regions,params:{center:[1.925,13.695],half:[1.775,13.695]}});
  const fixed=createNativePlaster({THREE,parentWall:w,regions,params:makeMetricPlasterField({center:[1.925,13.695]})});
  try {
    for(const key of ['vertices','triangles','bufferBytes','drawCalls','boundaryEdges','cellVisits']) assert.equal(fixed.proof[key],old.proof[key]);
    assert.deepEqual(fixed.geometry.index.array,old.geometry.index.array);
    assert.deepEqual(fixed.geometry.attributes.nativeFieldPoint.array,old.geometry.attributes.nativeFieldPoint.array);
    assert.equal(fixed.material.vertexShader,old.material.vertexShader);
    assert.equal(fixed.material.fragmentShader,old.material.fragmentShader);
    assert.deepEqual(fixed.material.uniforms.uPlasterHalf.value.toArray(),[1.8,1.8]);
    assert.notDeepEqual(fixed.geometry.attributes.position.array,old.geometry.attributes.position.array);
    for(const m of [old,fixed]) {
      assert(m.proof.thicknessRange[0]>=.008 && m.proof.thicknessRange[1]<=.025);
      const n=m.geometry.attributes.normal, indices=m.geometry.index.array;
      const front=m.proof.ranges.find(r=>r.kind==='front');
      for(const i of new Set(indices.slice(front.start,front.start+front.count))) assert(n.getZ(i)>.99);
    }
  } finally {old.dispose();fixed.dispose();}
});
