import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {KP_GRANITE_WGSL as wgsl} from '../mothers/granite-fields.mjs';
import {KP_STONE_WGSL as stone} from '../mothers/stone-fields.mjs';
import {scanWGSLIdentifiers} from './wgsl-identifiers.mjs';
import {params,filterParams,height,original,filtered,state,response,meanResponse,estimatePitMean,statisticalSf} from './granite-reference.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
function body(s,name){const re=new RegExp(`\\b(?:fn|float|vec[234]|StoneSample) ${name}\\(`),m=re.exec(s);assert(m,`Function ${name} exists`);const open=s.indexOf('{',m.index);let depth=1,end=open+1;while(depth&&end<s.length){if(s[end]==='{')depth++;if(s[end]==='}')depth--;end++;}return s.slice(m.index,end);}
function geometryClosure(name,seen=new Set){if(seen.has(name))return '';seen.add(name);const b=body(wgsl,name),deps=[...b.matchAll(/\b(gr_[a-zA-Z0-9_]+|kpGranite[A-Za-z]+)\(/g)].map(m=>m[1]);return b+deps.filter(x=>x!==name).map(x=>geometryClosure(x,seen)).join('');}
const samples=Array.from({length:18},(_,i)=>[(i-8)*.001173,.014+(i%5)*.002231,-.007+(i%7)*.001713]);
const vector=s=>[s.height,...s.albedo,s.roughness];
const near=(a,b,e=1e-12)=>assert(Math.abs(a-b)<e,`${a} != ${b} (tolerance ${e})`);
test('frozen original kind-0 leaf stays byte-identical; shared helpers are reused',()=>{
 assert.equal(hash(read('../mothers/stone-fields.mjs')),'c911825d6c698d7bc66ff3715c57915d0e964647b7b8835f5d412d08f710b75e');
 for(const name of ['st_hash33','st_valueNoise3','st_seedVector','st_srgbToLinear','st_sf','st_warp']){assert(!wgsl.includes(`fn ${name}(`));assert(stone.includes(`fn ${name}(`));assert(wgsl.includes(name+'('));}
 assert.deepEqual(scanWGSLIdentifiers(stone+'\n'+wgsl),[]);
});
test('verbatim source functions remain locked to existing original audit',()=>{
 const src=read('./granite-original-reference.glsl'),lock=JSON.parse(read('../sources/stone.json'));
 for(const name of ['hash33','valueNoise3','seedVector','srgbToLinear','sf','scell','stoneFields'])assert.equal(hash(body(src,name)),lock.source.shaderFunctionHashes[name]);
 assert.equal(hash(src),'fbeaa3ae04ede4b9572b97dec3a5f274637b89c7d71a40e7851766c875e3040e');
});
test('nominal metric design is 2 mm cells and all original height terms convert once',()=>{
 near(params.scaleM/(13*params.sourceScale),.002);near(params.scaleM/49,.0005306122448979592);
 near((-.0015-.0045-.000175-.007)*params.scaleM,-.00034255);
 near((.0015+.0045+.000175)*params.scaleM,.00016055);
 near(.003*params.scaleM,.000078);
 assert.match(wgsl,/const KP_GRANITE_SCALE_M:f32 = 0\.026;/);
 assert.match(wgsl,/\(f\.crystal\.y-0\.5\)\*0\.003\+\(f\.broad-0\.5\)\*0\.009\+\(f\.grain-0\.5\)\*0\.00035-f\.pits\*0\.007/);
 assert.match(wgsl,/h\*KP_GRANITE_SOURCE_RELIEF\*KP_GRANITE_SCALE_M/);
 for(const p of samples){const h=height(p);assert(h>=-.00034255&&h<=.00016055);near(h,original(p).height);}
});
test('geometry cannot depend on color, wet, age, roughness, footprint or filter functions',()=>{
 const code=geometryClosure('kpGraniteHeight');
 for(const token of ['gr_response','gr_pointResponse','gr_meanResponse','gr_statisticalSf','gr_filteredSurface','sourceWet','roughBias','roughness','albedo','physicalFootprint','age','repair','region','weather'])assert(!code.includes(token),token);
 assert.match(code,/gr_scell\(q\*13\.0\+seed\)/);assert.match(code,/st_valueNoise3\(q\*49\.0\+seed\)/);
 assert.match(wgsl,/for\(var z:i32= -1;z<=1;z\+\+\)/);assert.match(wgsl,/for\(var y:i32= -1;y<=1;y\+\+\)/);assert.match(wgsl,/for\(var x:i32= -1;x<=1;x\+\+\)/);assert.match(wgsl,/if\(d<md\)\{md=d;id=ix;\}/);
});
test('zero footprint is original kind 2 with the unchanged resolveStoneFabric bridge',()=>{
 for(const p of samples)for(const controls of [[0,0,0],[.6,.7,.2],[1,1,0],[1,.8,1],[-1,2,3]]){
  const s=state(...controls),raw=original(p,s.sourceWet,s.roughBias);
  assert.deepEqual(filtered(p,[0,0,1],...controls,0),raw);
  assert.deepEqual(filtered(p,[0,0,1],...controls,-.1),raw);
 }
 assert.match(wgsl,/if\(fp==0\.0\)\{return kpGraniteOriginalSurface\(pLocalM,sourceWet,roughBias\);\}/);
 for(const line of ['let retainedAge=a*(1.0-r);','let sourceWet=clamp(m*(0.45+0.55*retainedAge)*(1.0-0.45*r),0.0,1.0);','let roughBias=0.07*retainedAge+0.025*0.15-0.06*r;']){assert(stone.includes(line));assert(wgsl.includes(line));}
});
test('all footprint levels retain the same exact original height while appearance stays bounded',()=>{
 for(const p of samples)for(const normal of [[0,0,1],[.2,.4,.8],[0,0,0]])for(const fp of [0,1e-7,.0005,.001,.002,.004,.008,.016]){
  const s=filtered(p,normal,.7,.3,.1,fp);near(s.height,height(p));assert(vector(s).every(Number.isFinite));
  assert(s.albedo.every(c=>c>=0&&c<=1));assert(s.roughness>=.12&&s.roughness<=.98);
 }
});
test('near-plane quadrature converges to the point query away from source cell edges',()=>{
 const p=[.0027,.018,-.0031],s0=filtered(p,[0,0,1],.7,.3,.1,0),s1=filtered(p,[0,0,1],.7,.3,.1,1e-7);
 vector(s0).forEach((v,i)=>near(v,vector(s1)[i],1e-8));
});
test('statistical mineral integration averages linear responses, including original transition colors',()=>{
 near(meanResponse(.5,.5,0,0,0).roughness,.522478);
 for(const region of [0,.5,1]){
  const n=20000,expected={albedo:[0,0,0],roughness:0};
  for(let i=0;i<n;i++){const s=response((i+.5)/n,region,.5,filterParams.pitMean,.7,.02);expected.albedo=expected.albedo.map((v,j)=>v+s.albedo[j]/n);expected.roughness+=s.roughness/n;}
  const got=meanResponse(region,.5,filterParams.pitMean,.7,.02);
  got.albedo.forEach((v,i)=>near(v,expected.albedo[i],3e-5));near(got.roughness,expected.roughness,1e-10);
 }
});
test('far response has no unresolved cell speckle while intermediate region/weather remains',()=>{
 const far=samples.map(p=>filtered(p,[0,0,1],.7,.3,.1,.016)),mid=samples.map(p=>filtered(p,[0,0,1],.7,.3,.1,.004));
 for(const s of far){s.albedo.forEach((v,i)=>near(v,far[0].albedo[i]));near(s.roughness,far[0].roughness);}
 assert(Math.max(...mid.map(s=>s.albedo[0]))-Math.min(...mid.map(s=>s.albedo[0]))>1e-3);
 assert(Math.max(...far.map(s=>s.height))-Math.min(...far.map(s=>s.height))>1e-5);
 near(statisticalSf([1,2,3],1),.5);
 assert(!body(wgsl,'gr_meanResponse').includes('gr_scell'));
});
test('declared pore mean is reproducible source-field quadrature, not another noise',()=>{
 near(estimatePitMean(48),filterParams.pitMean,1e-14);
 assert(Math.abs(estimatePitMean(32)-filterParams.pitMean)<.0001);
 for(const token of ['textureSample','textureLoad','sampler','sin(','random','cache'])assert(!wgsl.replace(/\/\/[^\n]*/g,'').includes(token));
});
