import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../../../vendor/three.module.js';
import {createWordFactory} from '../street/glyphs.mjs';

const provenance = JSON.parse(readFileSync(new URL('../street/glyphs-provenance.json', import.meta.url)));
const titles = provenance.families.flatMap(family => family.titles.map(text => ({text, family, style:family.style})));
const nearly = (actual, expected, epsilon=1e-7) => assert.ok(Math.abs(actual-expected)<=epsilon, `${actual} != ${expected}`);

function triangles(geometry) {
  const positions = geometry.attributes.position;
  const indices = geometry.index;
  const count = indices ? indices.count : positions.count;
  const result=[];
  for(let i=0;i<count;i+=3) result.push([0,1,2].map(j => new THREE.Vector3().fromBufferAttribute(positions,indices ? indices.getX(i+j) : i+j)));
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
  const all=triangles(geometry);
  assert.ok(all.length>0);
  for(const triangle of all) assert.ok(crossArea(triangle)>0,'zero-area runtime triangle');
  const front=all.filter(triangle=>triangle.every(p=>Math.abs(p.z-depth)<1e-8));
  assert.ok(front.length>0,'no +Z cap');
  for(const [a,b,c] of front) assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).z>0,'front cap faces away from +Z');
  const capArea=front.reduce((sum,triangle)=>sum+crossArea(triangle),0);
  let expectedArea=0, testedCounters=0;
  const samples=geometry.parameters.shapes.map(shape=>shape.extractPoints(metadata.curveSegments));
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
        .map(triangle=>triangle.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/3));
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
  const nativeArea=Math.abs(native.native_contour_areas.reduce((sum,value)=>sum+value,0))*(height/family.units_per_em)**2;
  assert.ok(Math.abs(capArea-nativeArea)/nativeArea<.005,'curve approximation exceeds 0.5% native area');
  return all.length;
}

test('delivery is a licensed finite Bézier-function subset, never baked geometry or raster',()=>{
  const source=readFileSync(new URL('../street/glyphs.mjs',import.meta.url));
  assert.equal(source.length,provenance.module_bytes);
  assert.equal(createHash('sha256').update(source).digest('hex'),provenance.module_sha256);
  assert.ok(source.length<80_000);
  assert.equal(provenance.source_font_binaries_distributed,false);
  assert.equal(provenance.raster_data,false);
  assert.equal(provenance.baked_vertex_or_index_buffers,false);
  assert.equal(provenance.families.reduce((sum,f)=>sum+Object.keys(f.glyphs).length,0),16);
  assert.ok(!/Float32Array|Uint(?:16|32)Array|BufferAttribute|TextureLoader|CanvasTexture|data:image/.test(source.toString()));
  assert.ok(source.includes(Buffer.from('quadraticCurveTo')));
  assert.ok(source.includes(Buffer.from('bezierCurveTo')));
  const license=readFileSync(new URL('../street/glyphs-LICENSE.txt',import.meta.url),'utf8');
  assert.ok(license.includes('SIL OPEN FONT LICENSE Version 1.1'));
  assert.ok(license.includes('Reserved Font Name Bakudai'));
  assert.ok(license.includes('2017-2024 Adobe'));
});

for(const height of [.1,.38,1,3]) test(`all 16 glyphs: valid finite extrusion, 20 preserved counters, bounds at height ${height}`,()=>{
  const factory=createWordFactory(THREE);
  let counters=0, triangleCount=0;
  for(const {text,family,style} of titles){
    const options={height,depth:.015,style};
    const word=factory.makeWord(text,options);
    const bounds=new THREE.Box3().setFromObject(word);
    const measure=factory.measure(text,options);
    nearly(bounds.min.x+bounds.max.x,0);
    nearly(bounds.min.y,0);
    nearly(bounds.max.y,height);
    nearly(bounds.min.z,0);
    nearly(bounds.max.z,.015);
    nearly(bounds.max.x-bounds.min.x,measure.width);
    nearly(measure.height,height);
    for(const mesh of word.children){
      triangleCount+=verifyGlyph(mesh,family,height,.015);
      counters+=mesh.geometry.userData.glyph.counters;
    }
  }
  assert.equal(counters,20);
  assert.equal(triangleCount,25188);
  factory.dispose();
});

test('zero-depth planar geometry also preserves counters and front-facing triangles',()=>{
  const factory=createWordFactory(THREE);
  for(const {text,family,style} of titles) for(const mesh of factory.makeWord(text,{height:1,depth:0,style}).children) verifyGlyph(mesh,family,1,0);
  factory.dispose();
});

test('deterministic runtime geometry, shared cache, and shared caller materials',()=>{
  const factory=createWordFactory(THREE), other=createWordFactory(THREE);
  const material=new THREE.MeshStandardMaterial({color:0xc04030});
  for(const {text,style} of titles){
    const options={height:.38,depth:.015,style,material};
    const a=factory.makeWord(text,options), b=factory.makeWord(text,options), c=other.makeWord(text,options);
    for(let i=0;i<a.children.length;i++){
      assert.equal(a.children[i].geometry,b.children[i].geometry);
      assert.equal(a.children[i].material,material);
      assert.equal(b.children[i].material,material);
      assert.deepEqual(a.children[i].geometry.attributes.position.array,c.children[i].geometry.attributes.position.array);
      assert.deepEqual(a.children[i].geometry.attributes.normal.array,c.children[i].geometry.attributes.normal.array);
    }
  }
  const a=factory.makeWord('金禾冰室'), b=factory.makeWord('同豐藥房',{style:'serif'});
  for(const mesh of [...a.children,...b.children]) assert.equal(mesh.material,a.children[0].material);
  let callerMaterialDisposals=0;material.addEventListener('dispose',()=>callerMaterialDisposals++);
  factory.dispose();other.dispose();
  assert.equal(callerMaterialDisposals,0);
  material.dispose();
});

test('cache disposal can release resources once or defer to scene ownership',()=>{
  const factory=createWordFactory(THREE);
  const word=factory.makeWord('麗華戲院');
  let geometryDisposals=0, materialDisposals=0;
  for(const mesh of word.children) mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);
  word.children[0].material.addEventListener('dispose',()=>materialDisposals++);
  factory.dispose({resources:false});
  assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);
  const replacement=factory.makeWord('麗華戲院');
  assert.notEqual(replacement.children[0].geometry,word.children[0].geometry);
  const geometries=new Set([...word.children,...replacement.children].map(m=>m.geometry));
  for(const geometry of geometries) geometry.dispose();
  word.children[0].material.dispose();replacement.children[0].material.dispose();
  factory.dispose({resources:false});
  assert.equal(geometryDisposals,4);assert.equal(materialDisposals,1);
  const regular=createWordFactory(THREE), regularWord=regular.makeWord('金禾冰室');
  let once=0;regularWord.children[0].geometry.addEventListener('dispose',()=>once++);
  regular.dispose();regular.dispose();assert.equal(once,1);
});

test('unknown glyphs, wrong family, empty text and invalid dimensions throw',()=>{
  const factory=createWordFactory(THREE);
  assert.throws(()=>factory.makeWord('未知'),/Unsupported Traditional glyph/);
  assert.throws(()=>factory.makeWord('麗華戲院',{style:'serif'}),/Unsupported Traditional glyph/);
  assert.throws(()=>factory.makeWord('同豐藥房',{style:'brush'}),/Unsupported Traditional glyph/);
  assert.throws(()=>factory.makeWord('同豐藥房',{style:'toString'}),/Unknown glyph style/);
  assert.throws(()=>factory.makeWord(''),/nonempty/);
  for(const height of [0,-1,Infinity,NaN]) assert.throws(()=>factory.makeWord('金',{height}),/height/);
  for(const depth of [-1,Infinity,NaN]) assert.throws(()=>factory.makeWord('金',{depth}),/depth/);
  factory.dispose();
});
