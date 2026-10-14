import assert from'node:assert/strict';import{random,SurfaceChart,bindOffsets,sampleOffsets,anchorFrame,cubic}from'./SurfaceBinding.mjs';
import{BoundSurfaceSampler}from'./BoundSurfaceSampler.mjs';
const checks=[];const check=(name,f)=>{f();checks.push({name,passed:true});};
check('stable random identity',()=>{const a=random(725),b=random(725),c=random(726);const x=Array.from({length:200},a),y=Array.from({length:200},b),z=Array.from({length:200},c);assert.deepEqual(x,y);assert.notDeepEqual(x,z);assert(x.every(v=>v>=0&&v<1));});
const positions=new Float32Array([0,0,0,.08,0,0,0,.06,0]),indices=new Uint16Array([0,1,2]),frame={project:p=>p,front:[0,0,1]},g={attributes:{position:{array:positions}},morphAttributes:{position:[{array:new Float32Array([0,0,.005,0,0,.005,0,0,.005])}]},morphTargetsRelative:true};
check('exact front triangle barycentrics',()=>{const c=new SurfaceChart(positions,indices,frame),hit=c.query(.02,.02);assert(hit);assert(Math.abs(hit.weights.reduce((a,b)=>a+b,0)-1)<1e-12);assert(Math.abs(hit.position[0]-.02)<1e-12);assert.equal(c.query(-.02,.02),null);});
check('attached root and strand translate with native morph',()=>{const c=new SurfaceChart(positions,indices,frame),hit=c.query(.02,.02),curve=[[.02,.02,.00001],[.02,.023,.001]],a=bindOffsets(hit,curve,g),out=sampleOffsets(a,g,[1]);for(let i=0;i<curve.length;i++){assert(Math.abs(out[i][2]-curve[i][2]-.005)<1e-8);assert(Math.abs(out[i][0]-curve[i][0])<1e-10);}const f=anchorFrame(a,g,[1]);assert(Math.abs(f.center[2]-.005)<1e-8);});
check('cubic endpoints remain exact',()=>{const a=[1,2,3],b=[2,3,4],c=[3,4,5],d=[4,5,6];assert.deepEqual(cubic(a,b,c,d,0),a);assert.deepEqual(cubic(a,b,c,d,1),d);});
check('pooled transport agrees with scalar reference under nonrigid relative and absolute morphs',()=>{
 const rng=random(47129),base=new Float32Array([0,0,0,.08,0,.002,0,.06,.001,.09,.07,.008]),index={count:6,array:new Uint16Array([0,1,2,1,3,2])};
 for(const relative of[true,false]){
 const target=new Float32Array(base.length);for(let i=0;i<target.length;i++)target[i]=(relative?0:base[i])+(rng()-.5)*.009;
 const geom={attributes:{position:{array:base}},index,morphAttributes:{position:[{array:target}]},morphTargetsRelative:relative};const anchors=[];
 for(let n=0;n<200;n++){const ids=n%2?[1,3,2]:[0,1,2],u=rng(),v=rng()*(1-u),weights=[u,v,1-u-v],position=[0,1,2].map(k=>ids.reduce((s,i,j)=>s+base[i*3+k]*weights[j],0));const pts=Array.from({length:5},()=>position.map(v=>v+(rng()-.5)*.008));anchors.push(bindOffsets({ids,weights},pts,geom));}
 const sampler=new BoundSurfaceSampler(geom,anchors);for(const weight of[0,.01,.37,.72,1]){sampler.update(geom,[weight]);for(const a of anchors){const expected=sampleOffsets(a,geom,[weight]);for(let i=0;i<expected.length;i++)for(let k=0;k<3;k++)assert(Math.abs(expected[i][k]-a.sampled[i][k])<1e-12);}}
 assert.equal(sampler.triangles.length,2);assert.equal(sampler.vertices.length,4);
 }
});
console.log(JSON.stringify({version:'BROW-LASH-R01',checks},null,2));
