import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../../../vendor/three.module.js';
import {createWordFactory} from '../street/glyphs.mjs';

const provenance = JSON.parse(readFileSync(new URL('../street/glyphs-provenance.json',import.meta.url)));
const titles = provenance.families.flatMap(family => family.titles.map(text => ({text, family, style:family.style})));
const nearly = (actual, expected, epsilon=1e-7) => assert.ok(Math.abs(actual-expected)<=epsilon, `${actual} != ${expected}`);

function triangles(geometry, matrix) {
  const positions = geometry.attributes.position;
  const indices = geometry.index;
  const count = indices ? indices.count : positions.count;
  const result=[];
  for(let i=0;i<count;i+=3) result.push([0,1,2].map(j => new THREE.Vector3().fromBufferAttribute(positions,indices ? indices.getX(i+j) : i+j).applyMatrix4(matrix)));
  return result;
}
const crossArea = ([a,b,c]) => b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
const pointInTriangle = (p, [a,b,c]) => {
  const sign = (u,v) => (v.x-u.x)*(p.y-u.y)-(v.y-u.y)*(p.x-u.x);
  const s=[sign(a,b),sign(b,c),sign(c,a)];
  return s.every(v=>v>=0) || s.every(v=>v<=0);
};

function pointInPolygon(point, polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}

function verifyGlyph(mesh, family, height, depth) {
  const geometry=mesh.geometry, metadata=geometry.userData.glyph;
  const native=family.glyphs[metadata.character];
  assert.equal(metadata.solids,native.solids);
  assert.equal(metadata.counters,native.counters);
  assert.equal(metadata.nativeCurves,true);
  for(const attribute of Object.values(geometry.attributes)) {
    assert.ok(attribute.count>0);
    for(const value of attribute.array) assert.ok(Number.isFinite(value),'non-finite geometry attribute');
  }
  if(geometry.index) for(const index of geometry.index.array) assert.ok(index>=0 && index<geometry.attributes.position.count);
  const all=triangles(geometry,mesh.matrixWorld);
  assert.ok(all.length>0);
  for(const triangle of all) assert.ok(crossArea(triangle)>0,'zero-area runtime triangle');
  const front=all.filter(triangle=>triangle.every(p=>Math.abs(p.z-depth)<1e-8));
  assert.ok(front.length>0,'no +Z cap');
  for(const [a,b,c] of front) assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).z>0,'front cap faces away from +Z');
  const capArea=front.reduce((sum,triangle)=>sum+crossArea(triangle),0);
  let expectedArea=0, testedCounters=0;
  const world=p=>new THREE.Vector3(p.x,p.y,0).applyMatrix4(mesh.matrixWorld);
  const samples=geometry.parameters.shapes.map(shape=>{const s=shape.extractPoints(metadata.curveSegments);return {shape:s.shape.map(world),holes:s.holes.map(h=>h.map(world))};});
  for(const [shapeIndex,shape] of geometry.parameters.shapes.entries()) {
    assert.ok(shape.curves.some(curve=>curve.isQuadraticBezierCurve || curve.isCubicBezierCurve) || shape.curves.length>0);
    const sample=samples[shapeIndex];
    expectedArea+=Math.abs(THREE.ShapeUtils.area(sample.shape));
    for(const hole of sample.holes) {
      expectedArea-=Math.abs(THREE.ShapeUtils.area(hole));
      // Pick the interior of the counter's largest triangulated area, avoiding
      // a concave contour's possibly outside arithmetic mean.
      const holeTriangles=THREE.ShapeUtils.triangulateShape(hole,[]).map(face=>face.map(i=>new THREE.Vector3(hole[i].x,hole[i].y,depth)));
      const candidates=holeTriangles.filter(t=>crossArea(t)>0).sort((a,b)=>crossArea(b)-crossArea(a))
        .flatMap(triangle=>{const points=[];for(let a=1;a<8;a++)for(let b=1;b<8-a;b++){const c=8-a-b;if(c>0)points.push(triangle[0].clone().multiplyScalar(a/8).addScaledVector(triangle[1],b/8).addScaledVector(triangle[2],c/8));}return points;});
      // The dot in 海/母 is a real separate ink island inside a counter.
      // Exclude source-filled islands rather than incorrectly erasing them.
      const negativeSpace=candidates.filter(p=>!samples.some((other,index)=>index!==shapeIndex
        && pointInPolygon(p,other.shape) && !other.holes.some(h=>pointInPolygon(p,h))));
      assert.ok(negativeSpace.length>0,`counter has no tested negative space in ${metadata.character}`);
      for(const interior of negativeSpace) {
        assert.equal(front.some(triangle=>pointInTriangle(interior,triangle)),false,`filled counter in ${metadata.character}`);
      }
      testedCounters++;
    }
  }
  assert.equal(testedCounters,native.counters);
  nearly(capArea,expectedArea,Math.max(1e-10,expectedArea*2e-6));
  const nativeArea=Math.abs(native.native_contour_areas.reduce((sum,value)=>sum+value,0))*(metadata.height/family.units_per_em)**2*Math.abs(mesh.matrixWorld.elements[0]*mesh.matrixWorld.elements[5]-mesh.matrixWorld.elements[1]*mesh.matrixWorld.elements[4]);
  assert.ok(Math.abs(capArea-nativeArea)/nativeArea<.005,'curve approximation exceeds 0.5% native area');
  return all.length;
}


test('Every licensed native glyph preserves world-space counters, winding and area across five metre-scale render recipes',()=>{
const reports=[];
for(const [height,depth] of [[.1,.018],[.38,.018],[1,.018],[3,.018],[.38,0]]) {
  const factory=createWordFactory(THREE);const errors=[];let glyphs=0,triangles=0;
  for(const family of provenance.families) for(const text of Object.keys(family.glyphs)) {
    if(text===' ')continue;
    try {const word=factory.makeWord(text,{height,depth,style:family.style});word.updateMatrixWorld(true);for(const mesh of word.children){triangles+=verifyGlyph(mesh,family,height,depth);glyphs++;}}
    catch(error) { errors.push({glyph:family.style+'/'+text,message:error.message}); }
  }
  factory.dispose();reports.push({height,depth,glyphs,triangles,errors});
}
console.log(JSON.stringify(reports,null,2));assert(reports.every(r=>r.errors.length===0));
});
