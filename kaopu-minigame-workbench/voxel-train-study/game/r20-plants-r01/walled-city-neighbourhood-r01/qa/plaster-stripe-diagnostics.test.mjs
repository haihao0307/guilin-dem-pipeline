import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {plasterVertex,plasterFragment,retainedFunctions} from '../plaster-native/shaders.mjs';
import {plasterWetShader} from '../surface-bindings.mjs';
import {createNativePlaster} from '../plaster-native/plaster-native.mjs';
import {makeBuildingRecipe} from '../building-plan.mjs';
import {makeSurfacePlan} from '../surface-plan.mjs';
import {STRIPE_DIAGNOSTIC_MODES,stripeDiagnosticFragment,makePrimitiveDiagnosticGeometry} from './plaster-stripe-diagnostics.mjs';
const THREE=await import(process.env.PLASTER_THREE_FILE?pathToFileURL(process.env.PLASTER_THREE_FILE):new URL('../../../../vendor/three.module.js',import.meta.url));
const dry=plasterFragment(),wet=plasterWetShader(dry);

test('baseline and API dry leave actual material source byte-identical',()=>{
  for(const id of ['wet-native','dry-api'])assert.equal(stripeDiagnosticFragment(wet,id,{plaster:true,water:true}),wet);
  assert.equal(stripeDiagnosticFragment('irrelevant','dry-no-micro',{}),'irrelevant');
});
test('hard bypass changes only water mixing function and cannot depend on uniform refresh',()=>{
  const s=stripeDiagnosticFragment(wet,'dry-shader-bypass',{plaster:true,water:true});
  assert(s.includes('void nativeApplyWater(inout vec3 base,inout float rough,float mask){/* QA hard water bypass */}'));
  assert(s.includes('n=perturb(n,worldP,'));assert(s.includes(retainedFunctions));
  assert(s.includes('if(nativeWaterStrength>0.)nativeApplyWater'));
});
test('successive material controls remove one named factor without mutating mother functions',()=>{
  for(const {id}of STRIPE_DIAGNOSTIC_MODES){const s=stripeDiagnosticFragment(wet,id,{plaster:true,water:true});assert(s.includes(retainedFunctions),id);assert.equal((s.match(/void main\(\)/g)||[]).length,1,id);}
  const micro=stripeDiagnosticFragment(wet,'dry-no-micro',{plaster:true,water:true});assert(!micro.includes('n=perturb(n,worldP,'));assert(!micro.includes('n=normalize(nativeDiagPlaneWorldNormal)'));assert(micro.includes('vec3 base=mix('));
  const plane=stripeDiagnosticFragment(wet,'dry-plane-normal',{plaster:true,water:true});assert(plane.includes('n=normalize(nativeDiagPlaneWorldNormal)'));assert(plane.includes('vec3 base=mix('));
  const constant=stripeDiagnosticFragment(wet,'dry-constant-base',{plaster:true,water:true});assert(constant.includes('vec3 base=vec3(.48);'));assert(constant.includes('float rough=.95;'));assert(constant.includes('vec3 L=normalize('));
  const unlit=stripeDiagnosticFragment(wet,'unlit-plaster-constant',{plaster:true,water:true});assert(unlit.includes('void main(){frag=vec4(vec3(.55),1.);}'));
});
test('water diagnostic exposes the actual receiver and exact retained contribution algebra',()=>{
  const mask=stripeDiagnosticFragment(wet,'water-mask',{plaster:true,water:true});assert(mask.includes('float mask=w26WaterAtReceiverWithLow(vReceiverPosition,vNativeMaterialState)'));
  const s=stripeDiagnosticFragment(wet,'water-components',{plaster:true,water:true});assert(s.includes('return vec3(streak*.92,broad*verticalGate*.32,lowerDamp*.58);'));assert(s.includes('nativeDiagWaterContributions(parent/w26FieldScaleMetres,w26ParentNormal,parent,w26FullDimensionsMetres,w26WaterSeed,vNativeMaterialState)'));
  assert.throws(()=>stripeDiagnosticFragment(dry,'water-mask',{plaster:true,water:false}));
  assert.throws(()=>stripeDiagnosticFragment(wet.replace('n=perturb(n,worldP,','n=changed(n,worldP,'),'dry-no-micro',{plaster:true,water:true}));
});
test('primitive diagnostic preserves every triangle position exactly and is byte-bounded',()=>{
  const wall={id:'tiny',alongX:true,start:0,end:.4,fixed:0,bottom:0,height:.4,side:'front',openings:[]};
  const m=createNativePlaster({THREE,parentWall:wall,regions:[{u0:0,u1:.4,y0:0,y1:.4}]}),d=makePrimitiveDiagnosticGeometry(THREE,m.geometry);
  try{const s=m.geometry,p=d.geometry.attributes.position,b=d.geometry.attributes.nativeDiagBarycentric,t=d.geometry.attributes.nativeDiagPrimitive;
    assert.equal(d.triangles,m.proof.triangles);assert.equal(d.bytes,s.index.count*28);
    for(let i=0;i<s.index.count;i++){const j=s.index.getX(i);assert.deepEqual([p.getX(i),p.getY(i),p.getZ(i)],[s.attributes.position.getX(j),s.attributes.position.getY(j),s.attributes.position.getZ(j)]);assert.equal(b.getX(i)+b.getY(i)+b.getZ(i),1);assert.equal(t.getX(i),Math.floor(i/3));}
    assert.throws(()=>makePrimitiveDiagnosticGeometry(THREE,s,{maxBytes:d.bytes-1}));
    assert.equal(m.material.vertexShader,plasterVertex());
  }finally{d.geometry.dispose();m.dispose();}
});
test('R02 exact borrowed-door frustum needs a bounded diagnostic geometry allocation',()=>{
  const recipe=makeBuildingRecipe(),surfaces=makeSurfacePlan(recipe),camera=new THREE.PerspectiveCamera(43,800/600,.05,150);
  camera.position.set(-.2,7,-8.6);camera.lookAt(-2.2,6.55,-4.65);camera.updateMatrixWorld(true);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  let bytes=0,objects=0,triangles=0;
  for(const wall of recipe.walls){const unit=recipe.units.find(u=>u.id===wall.unit);if(unit.level>2||wall.side==='front')continue;
    for(const coat of surfaces.walls.find(w=>w.wallId===wall.id).coatings){const m=createNativePlaster({THREE,parentWall:wall,...coat});m.mesh.updateMatrixWorld(true);if(frustum.intersectsObject(m.mesh)){bytes+=m.geometry.index.count*28;objects++;triangles+=m.proof.triangles;}m.dispose();}
  }
  assert(bytes>0&&bytes<64*1024*1024);console.log('R02 primitive diagnostic budget:',{objects,triangles,bytes});
});
