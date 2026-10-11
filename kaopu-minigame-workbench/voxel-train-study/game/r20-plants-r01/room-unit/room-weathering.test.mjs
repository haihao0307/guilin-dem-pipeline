import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRoomSurfaceRecipe,evaluateRoomSurfaceField,createRoomMaterialLibrary,ROOM_MATERIAL_KINDS,ROOM_SURFACE_SHADER,ROOM_WEATHERING_REVISION,roomSmoothCarveMax} from './room-weathering.mjs';
const HOST=process.env.ROOM_HOST_ROOT??'/workspace/scratch/2f609cc83d31/train-plants-r01-20261010/candidate/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01';
const THREE=await import(pathToFileURL(HOST+'/../../vendor/three.module.js'));
const {createMaterialLibrary:createHostMaterialLibrary}=await import(pathToFileURL(HOST+'/street/materials.mjs'));
const make=(overrides={})=>createRoomSurfaceRecipe({seed:198107,ageYears:48,wetness:.38,rainExposure:.92,wallThickness:.18,
  sills:[{position:[.67,.93,.13],normal:[0,0,1],width:1.3,length:1.8}],
  drips:[{position:[1.34,2.14,.12],normal:[0,0,1],radius:.04,length:1.6,rust:1}],
  rainShadows:[{position:[0,2.70,.1],normal:[0,0,1],width:3.8,length:.5,strength:.9}],
  repairs:[{position:[-1.62,.9,.095],normal:[0,0,1],width:.3,height:.65}],...overrides});
const field=(p,r,n=[0,0,1])=>evaluateRoomSurfaceField(p,n,r);
const shaderOf=m=>{const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);return shader;};

test('CPU field is deterministic, seed-specific and immutable',()=>{
  const r=make(),p=[.12,.47,.095],a=field(p,r);assert.deepEqual(a,field(p,r));assert.deepEqual(a,field(p,make()));
  assert.notDeepEqual(a,field(p,make({seed:77})));assert(Object.isFrozen(r));assert(Object.isFrozen(r.sills[0].position));
  assert.equal(createRoomSurfaceRecipe(r),r);assert.equal(r.coordinateSpace,'baked-room-local-metres');
});
test('audited MIT smax kernel is actually used for three bounded millimetre carve layers',()=>{
  assert.equal(roomSmoothCarveMax(.002,.002,.004),.003);assert.equal(roomSmoothCarveMax(.007,.001,.001),.007);
  assert.equal((ROOM_SURFACE_SHADER.field.match(/=rwSmoothCarveMax\(/g)??[]).length,3);
  assert(ROOM_SURFACE_SHADER.field.includes('maximumErosion=min(.011,rwWallThickness*.075)'));
  for(const wallThickness of [.035,.18,1])for(const seed of [0,198107,90]) {
    const r=make({wallThickness,seed,damageStrength:1.8,reliefStrength:2});
    for(let i=0;i<80;i++){const f=field([Math.sin(i)*1.8,(i%23)/8,.095],r);
      assert(f.erosionDepth<=Math.min(.011,wallThickness*.075)+1e-12);assert(f.plasterThickness>=.003&&f.plasterThickness<=.016);assert(Math.abs(f.height)<=.012);
      for(const [key,value] of Object.entries(f))assert(Number.isFinite(value),key+' must be finite');}
  }
});
test('initial age causes real damage; changing wetness never resets or invents elapsed ageing',()=>{
  let oldDamage=0,youngDamage=0;for(let i=0;i<100;i++){const p=[i*.027, .35+(i%7)*.18,.095];oldDamage+=field(p,make()).damage;youngDamage+=field(p,make({ageYears:0})).damage;}
  assert(oldDamage>10);assert.equal(youngDamage,0);
  const old=make(),rain=make({wetness:1}),dry=make({wetness:0});assert.deepEqual(field([.1,.2,.095],rain),field([.1,.2,.095],dry));assert.equal(old.ageYears,48);
});
test('lower splash/tide zone is strong and spatially bounded',()=>{
  const r=make({sills:[],drips:[],rainShadows:[],repairs:[]});
  assert(field([0,.07,.095],r).damp>.55);assert(field([0,1.75,.095],r).damp<.005);
  assert.equal(field([0,.07,.095],make({groundContact:false,sills:[],drips:[],repairs:[]})).damp,0);
});
test('sill runoff starts below the real sill, at narrow edges, and does not rise upward',()=>{
  const r=make({drips:[],rainShadows:[],repairs:[],groundContact:false});
  assert(field([.02,.68,.13],r).runoff>.5);assert(field([.02,1.14,.13],r).runoff<1e-9);
  assert(field([-1,.68,.13],r).runoff<1e-9);assert(field([.02,-1.3,.13],r).runoff<1e-9);
});
test('iron anchor creates a downward rust streak, with no arbitrary uphill streak',()=>{
  const r=make({sills:[],rainShadows:[],repairs:[],groundContact:false});
  const under=field([1.34,1.65,.12],r),above=field([1.34,2.40,.12],r),beside=field([1.0,1.65,.12],r);
  assert(under.rust>.4);assert.equal(above.rust,0);assert(beside.rust<.001);assert(under.damp>.4);
});
test('an eave shields rainfall under its actual span, without deleting ground moisture',()=>{
  const base={groundContact:false,repairs:[],drips:[],sills:[{position:[0,2.7,.1],normal:[0,0,1],width:1,length:1.2}]};
  const exposed=field([.5,2.5,.1],make({...base,rainShadows:[]}));
  const sheltered=field([.5,2.5,.1],make({...base,rainShadows:[{position:[0,2.72,.1],normal:[0,0,1],width:3,length:.6,strength:1}]}));
  assert(sheltered.shadow>.9);assert(sheltered.runoff<exposed.runoff*.2);
});
test('side-plane emitters use room Z as horizontal span and reject the opposite face',()=>{
  const r=make({groundContact:false,sills:[{position:[1.92,1,-2.6],normal:[1,0,0],width:1.1,length:1.7}],drips:[],rainShadows:[],repairs:[]});
  const side=field([1.92,.75,-3.15],r,[1,0,0]);assert(side.runoff>.5);
  assert.equal(field([1.92,.75,-3.15],r,[-1,0,0]).runoff,0);
  assert(field([1.92,1.3,-3.15],r,[1,0,0]).runoff===0);
});
test('fresh repair is a small feathered field area, reducing the same damage and damp',()=>{
  const r=make(),plain=make({repairs:[]}),center=[-1.62,.9,.095];
  assert(field(center,r).repair>.99);assert(field(center,r).damage<field(center,plain).damage*.12+1e-9);
  assert.equal(field([-.5,.9,.095],r).repair,0);
  const edge=[];for(let x=-1.83;x<-1.4;x+=.005)edge.push(field([x,.9,.095],r).repair);
  assert(edge.some(v=>v>.05&&v<.95),'boundary must feather rather than form a replacement overlay rectangle');
});
test('CPU/GLSL use matching bounded erosion terms, integer hash, and three non-fractal noise samples',()=>{
  const glsl=ROOM_SURFACE_SHADER.field;
  for(const phrase of ['q*.61','q*3.7','q*17.3','(f.macro-.49)*.009+f.damp*.0015','(f.meso-.49)*.025+f.damp*.002','(f.chip-.54)*.012','f.damage=clamp(f.erosionDepth/.009','f.height=clamp((f.plasterThickness-.01)*rwReliefStrength,-.012,.012)','uvec3 q=uvec3(ivec3(floor(p)))'])assert(glsl.includes(phrase),phrase);
  assert(!/sdFbm|raymarch|sampler2D|texture2D|iTime/.test(glsl));assert(ROOM_SURFACE_SHADER.surface.includes('if(rwFootprint<.019)'));assert(ROOM_SURFACE_SHADER.surface.includes('rwWeaveWeight'));
});
test('all eight real Three r170 materials receive valid source hooks without stacked host fields',()=>{
  assert.equal(THREE.REVISION,'170');const host=createHostMaterialLibrary(THREE),lib=createRoomMaterialLibrary(THREE,{recipe:make(),hostLibrary:host});
  try {for(const kind of ROOM_MATERIAL_KINDS) {
    const m=lib.get(kind),shader=shaderOf(m);assert(m.isMeshStandardMaterial);assert.equal(m.userData.room.kind,kind);assert(m.userData.room.hostReused);
    assert(shader.vertexShader.includes('vRoomPosition=transformed'));assert(shader.vertexShader.includes('vRoomNormal=objectNormal'));
    assert(shader.fragmentShader.includes('RoomField rwF=rwField(rwP,rwN)'));assert(!shader.fragmentShader.includes('stNoise('));assert(!shader.fragmentShader.includes('vStreetPosition'));
    assert.equal(shader.uniforms.rwAge.value,48/58);assert.equal(shader.uniforms.rwSillCount.value,1);assert.equal(shader.uniforms.rwSillA.value.length,6);
    assert.equal(shader.uniforms.rwDripA.value.length,8);assert.equal(shader.uniforms.rwWallThickness.value,.18);
    assert.equal(m.userData.room.coordinateSpace,'baked-room-local-metres');for(const v of Object.values(m))assert(!v?.isTexture);
  }}finally{lib.dispose();host.dispose();}
});
test('library cache, cloth edge bounds, live wetness and first-frame age remain correctly bound',()=>{
  const lib=createRoomMaterialLibrary(THREE,{recipe:make()});try {
    const a=lib.get('plaster'),b=lib.get('iron',{wetness:.1}),c=lib.get('cloth',{color:'#b48e61',clothBounds:[-1,1,0,2]});
    assert.equal(a,lib.get('plaster'));assert.notEqual(c,lib.get('cloth'));assert.equal(c.userData.room.uniforms.rwClothBounded.value,1);
    assert.deepEqual(c.userData.room.uniforms.rwClothBounds.value.toArray(),[-1,1,0,2]);
    const shader=shaderOf(a),age=shader.uniforms.rwAge.value;lib.update(100000,{wetness:.95});assert.equal(shader.uniforms.rwAge.value,age);assert.equal(shader.uniforms.rwWetness.value,.95);assert.equal(b.userData.room.uniforms.rwWetness.value,.1);
    assert.equal(lib.proof.elapsedChangesAge,false);assert.equal(lib.proof.overlayMeshes,0);assert.equal(lib.proof.gpuCompilationVerified,false);assert.equal(lib.proof.maxCloseupNoiseEvaluations,4);
    lib.update(0,{wetness:0});assert.equal(shader.uniforms.rwAge.value,age);assert.equal(shader.uniforms.rwWetness.value,0);
  }finally{lib.dispose();}
});
test('injected host remains caller-owned; owned factories and owned materials dispose exactly once',()=>{
  const host=createHostMaterialLibrary(THREE),lib=createRoomMaterialLibrary(THREE,{hostLibrary:host});let disposed=0,hostDisposed=0;
  lib.get('plaster').addEventListener('dispose',()=>disposed++);host.materials[0].addEventListener('dispose',()=>hostDisposed++);
  lib.dispose();lib.dispose();assert.equal(disposed,1);assert.equal(hostDisposed,0);host.dispose();assert.equal(hostDisposed,1);assert.throws(()=>lib.get('plaster'),/disposed/);assert.throws(()=>lib.update(0),/disposed/);
  let factoryDisposed=0;const owned=createRoomMaterialLibrary(THREE,{createHostMaterialLibrary:(...args)=>{const h=createHostMaterialLibrary(...args),old=h.dispose;h.dispose=()=>{factoryDisposed++;old();};return h;}});
  owned.get('wood');owned.dispose();owned.dispose();assert.equal(factoryDisposed,1);
});
test('explicit failure is preferable to silent shader incompatibility or hidden budget growth',()=>{
  assert.throws(()=>make({sills:Array.from({length:7},()=>({}))}),/at most 6/);assert.throws(()=>make({groundY:NaN}),/finite/);assert.throws(()=>make({drips:[{normal:[0,0,0]}]}),/nonzero/);
  const lib=createRoomMaterialLibrary(THREE,{maxMaterials:1});try {
    const m=lib.get('plaster');assert.throws(()=>lib.get('iron'),/budget/);assert.throws(()=>lib.get('texture'),/Unknown/);assert.throws(()=>lib.update(NaN),/finite/);
    assert.throws(()=>m.onBeforeCompile({uniforms:{},vertexShader:'void main(){}',fragmentShader:'void main(){}'}),/Unsupported/);
    assert.throws(()=>lib.get('cloth',{clothBounds:[1,0,0,2]}),/clothBounds/);
  }finally{lib.dispose();}
});
