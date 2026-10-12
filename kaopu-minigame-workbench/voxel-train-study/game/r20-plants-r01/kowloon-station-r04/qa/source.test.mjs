import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{WGSL}from'../receiver.mjs';import{STATION_SCORE,VIEWS}from'../station-score.mjs';import{scanWGSLIdentifiers}from'./wgsl-identifiers.mjs';
test('locked original material modules have not been edited',()=>{const lock=JSON.parse(fs.readFileSync(new URL('../sources/SOURCE_LOCK.json',import.meta.url)));for(const[n,sha]of Object.entries(lock.sha256))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../mothers/'+n,import.meta.url))).digest('hex'),sha);});
test('whole station uses native function fields without meshes, textures or copied room scene',()=>{assert.match(WGSL,/fn stationField/);for(const token of['textureSample','sampler','vertexBuffer','THREE.','RoomField','geoBuilding'])assert(!WGSL.includes(token),token);assert.match(WGSL,/kpBrickBaseDistance/);assert.match(WGSL,/kpWoodMacroDisplacement/);assert.match(WGSL,/kpMetalCorrosion/);assert.match(WGSL,/kpStoneSurface/);});
test('all WGSL identifiers pass lexical gate',()=>assert.deepEqual(scanWGSLIdentifiers(WGSL),[]));
test('same score and camera set covers exterior, hall, platform and local materials',()=>{assert.equal(STATION_SCORE.authoredNotSurveyed,true);assert.equal(STATION_SCORE.hall.width,60);assert.equal(STATION_SCORE.tower.height,44);assert.deepEqual(STATION_SCORE.shed.centers,[-20,0,20]);for(const v of Object.values(VIEWS)){assert(v.eye.every(Number.isFinite));assert(v.target.every(Number.isFinite));assert(Math.hypot(...v.eye.map((x,i)=>x-v.target[i]))>1);}assert(VIEWS.hall.eye[1]>.85&&VIEWS.platform.eye[1]>.85);});
test('unresolved rays remain visible failures, not silently counted as sky',()=>{assert.match(WGSL,/atomicAdd\(&stats.exhausted/);assert.match(WGSL,/vec4<f32>\(1\.,0\.,1\.,1\.\)/);assert.match(WGSL,/return Trace\(t,2u,1400u/);});
test('spatial pruning preserves conservative exterior distance instead of dropping the building',()=>{for(const x of['hallBound','tb','shedBox'])assert(WGSL.includes('else{recordPart(&list,p,'+x+',0u,p,0.);}'));});

test('brick orientation and wood grain normals use explicit material axes',()=>{assert.match(WGSL,/select\(p.x,p.z,axis==12u\)/);assert.match(WGSL,/select\(normal,normal.zxy,h.seed==38.\)/);assert(!WGSL.includes('abs(q.x)>abs(q.z)'));});

test('analytic ground ray is domain clipped and cannot override nearer station',()=>{assert(WGSL.includes('fn groundRay('));assert(WGSL.includes('let end=min(limit,ground.x)'));assert(WGSL.includes('(ro+rd*land).z<=27.'));assert(WGSL.includes('(ro+rd*sea).z>=27.'));assert(!WGSL.includes('if(p.z>27.)'));});
test('angular features preserve their zero set with conservative frequency scaling',()=>{assert(WGSL.includes('(web-.034)/16.'));assert(WGSL.includes('(tick-.045)/6.'));});

test('six track boarding geometry leaves explicit ten centimetre designed envelope gap',()=>{for(const track of STATION_SCORE.tracks.centers){const d=Math.min(...STATION_SCORE.platforms.centers.map(p=>Math.abs(track-p)));assert(Math.abs(d-STATION_SCORE.platforms.halfWidth-STATION_SCORE.tracks.assumedVehicleHalfWidth-.1)<1e-9);}assert(WGSL.includes('rep(p.x-5.,10.,-3.,2.)'));});

test('hall columns flank openings and outer platform bounds contain stone edge',()=>{assert(WGSL.includes('rep(p.x-3.75,7.5,-4.,3.)'));assert(WGSL.includes('vec3<f32>(34,8,47.2)'));assert(WGSL.includes('vec3<f32>(3.4,.5,46.3)'));assert(WGSL.includes('vec3<f32>(1.23,.055,.13),30.'));});

test('one material evaluation precedes component union and is reused by shading',()=>{assert(WGSL.includes('candidate.d=evaluateStationGeometry(candidate,p'));assert(WGSL.includes('if(candidate.d<h.d)'));assert(WGSL.includes('nominal.d=h.baseD;let matter=evaluateStationMatter(nominal'));assert(WGSL.includes('fn resolveStationState('));assert(WGSL.includes('return sourceThickness*coverage'));assert(WGSL.includes('g.d=h.d-clamp(stationStoneHeight(h.q*.19)*.25,-.001,.001)-g.thickness'));assert(WGSL.includes('let g=evaluateStationGeometry(h,p,st)'));assert(!WGSL.includes('h.d=evaluateStationMatter(h,p'));});

test('platform benches lie halfway between columns',()=>{const centers=[-13.75,-36.25,-58.75,-81.25];for(const z of centers){const near=-10+Math.round((z+10)/7.5)*7.5;assert(Math.abs(z-near)-1.7>.42);}assert(WGSL.includes('rep(p.z+13.75,22.5,-3.,0.)'));});

test('coated solids supply real local source frames and extents',()=>{assert(WGSL.includes('stationPlasterParams(h.extent)'));assert(WGSL.includes('extent:vec3<f32>'));assert(!WGSL.includes('vec2<f32>(0.,1.4),vec2<f32>(2.,1.5)'));const field=fs.readFileSync(new URL('../station-field.mjs',import.meta.url),'utf8');assert(!field.includes(',13u,p,'));assert(!field.includes(',13u,tq,'));assert.equal((field.match(/recordCoated\(&list/g)||[]).length,17);});

test('roof acceleration bounds every barrel and refuses nearly axial rays',()=>{assert(WGSL.includes('for(var barrel= -1;barrel<=1;barrel++)'));assert(WGSL.includes('if(A<=.0000001){return 0.;}'));assert(WGSL.includes('if(length(q)<=r){return 0.;}'));});

test('procedural candidate capacity covers every recipe even without spatial pruning',()=>{const capacity=80,maxUnpruned=5+18+23+18+2+1;assert.equal(maxUnpruned,67);assert(maxUnpruned<capacity);assert(WGSL.includes('items:array<HitField,80>'));});

test('staged GPU keeps the complete shared field and only caches current ray intersections',()=>{assert(WGSL.includes('fn primaryRays('));assert(WGSL.includes('rayHits:array<Trace>'));assert(WGSL.includes('let tr=march(u.eye,rd,420.)'));assert(WGSL.includes('color=shade(tr,u.eye,rd)'));});

test('iron contact and section loss share an actual height datum',()=>{assert(WGSL.includes('kpMetalCorrosion(stationMetalCoordinates(h,p),st.age'));assert(WGSL.includes('kpMetalSurface(stationMetalCoordinates(h,p),st.age'));assert(WGSL.includes('select(p.y,p.y+.984,rail)'));});

test('wood is sampled in each actual slat or sleeper frame',()=>{assert(WGSL.includes('fn recordTimber('));assert(WGSL.includes('sourceSeed:f32'));assert(WGSL.includes('let face=abs(h.q)-h.extent'));assert(WGSL.includes('wp.seed=fract(wp.seed+h.sourceSeed*.61803398875)'));assert(!WGSL.includes('4u,bq.zxy,38.'));assert(WGSL.includes('if(revealed>0.){let exposed=kpStoneSurface'));});
