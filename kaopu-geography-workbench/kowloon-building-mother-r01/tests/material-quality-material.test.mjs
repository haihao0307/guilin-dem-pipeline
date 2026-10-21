import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MOTHER_GLSL,MOTHER_SHA256,MATERIAL_GLSL,HOSTED_MATERIAL_DEFAULTS,adaptHostedMaterialParameters,bindHostedMaterialUniforms,MATERIAL_UNIFORM_BINDINGS,memberGrainCoordinates,clearcoatEnergyWeights,directMaterialBRDF,materialHeightEnvelope,glassAbsorptionTransmittance} from '../material-quality-r01/material.mjs';
import * as original from '../r07/material.mjs';
import {TIMBER_SOURCE_SHA256,TIMBER_CLOSURE_SHA256,TIMBER_FIELD_GLSL,TIMBER_EVALUATION_GLSL} from '../material-quality-r01/sources/timber-field-source.mjs';
import {sampleTimberReference,samplePaintReference,materialReferenceNormal} from '../material-quality-r01/material-reference.mjs';
import {deriveAperture} from '../r07/apertures.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const provenance=JSON.parse(await readFile(new URL('../material-quality-r01/sources/timber-provenance.json',import.meta.url)));
const host={origin:[0,0,0],u:[1,0,0],v:[0,1,0],w:[0,0,1]};
const window=deriveAperture({instanceId:1,host,width:1.2,height:1.4}),frame=window.primitives.find(p=>p.part==='frame');
function functionBody(source,name){const re=new RegExp('(?:float|vec[234])\\s+'+name+'\\s*\\([^;]*?\\)\\s*\\{'),m=re.exec(source);assert.ok(m,name);let i=m.index+m[0].length,depth=1;while(depth){if(source[i]==='{')depth++;if(source[i]==='}')depth--;i++;}return source.slice(m.index,i);}
test('unchanged R07 66-function mother closure is re-exported, not relabelled',()=>{
 assert.equal(MOTHER_GLSL,original.MOTHER_GLSL);assert.equal(MOTHER_SHA256,original.MOTHER_SHA256);
 assert.equal((MOTHER_GLSL.match(/^(?:float|vec[234]|Kp\w+)\s+\w+\s*\(/gm)||[]).length,66);
});
test('18 actual upstream timber dependency functions retain exact hashes',()=>{
 assert.equal(TIMBER_SOURCE_SHA256,'ce6a10b73516cb3fe64b389c167daab6625354e2ea9a67c08ca6ab94c8b5df9c');
 assert.equal(provenance.transportIntegrity.historicalManifestMatch,true);
 assert.equal(provenance.transportIntegrity.receivedBytes-provenance.transportIntegrity.correctedBytes,1);
 assert.equal(sha(TIMBER_FIELD_GLSL),TIMBER_CLOSURE_SHA256);assert.equal(TIMBER_CLOSURE_SHA256,provenance.closureSHA256);
 assert.equal(provenance.functions.length,18);
 for(const f of provenance.functions){assert.equal(sha(functionBody(TIMBER_FIELD_GLSL,f.name)),f.sha256,f.name);assert.ok(MATERIAL_GLSL.includes(functionBody(TIMBER_FIELD_GLSL,f.name)));}
 assert.equal(sha(TIMBER_EVALUATION_GLSL),provenance.evaluationSHA256);
 assert.doesNotMatch(TIMBER_FIELD_GLSL,/void main|applyParallax|perturbNormalArb|createBox|a_position/);
});
test('source rights and receiver changes are disclosed, not relicensed',()=>{
 assert.match(provenance.rights.userProjectSources,/No uniform MIT license/);
 assert.match(provenance.receiverAdaptations.join(' '),/5.8/);assert.match(provenance.receiverAdaptations.join(' '),/approximate/);
 assert.match(provenance.receiverAdaptations.join(' '),/opaque paint/);
});
test('material input ranges reject invalid modes, unbounded relief and bad optics',()=>{
 const out=adaptHostedMaterialParameters();assert.equal(out.frameMaterialMode,2);assert.equal(out.doorMaterialMode,1);
 for(const p of [{frameMaterialMode:1.5},{doorMaterialMode:3},{woodScale:0},{woodScale:13},{woodReliefM:.001},{woodRoughness:NaN},{paintReliefM:Infinity},{paintClearcoat:-1},{paintClearcoatRoughness:0},{glassIOR:0},{frameColor:[1,2,3]}])assert.throws(()=>adaptHostedMaterialParameters(p));
 for(const p of [null,[],false])assert.throws(()=>adaptHostedMaterialParameters(p));
 const input={frameColor:[.1,.2,.3]};const result=adaptHostedMaterialParameters(input);result.frameColor[0]=.9;assert.equal(input.frameColor[0],.1);
});
test('uniform binder exposes actual modes, physical metres, color and coat parameters',()=>{
 const calls=new Map(),gl={getUniformLocation:(_,k)=>k,uniform1f:(k,v)=>calls.set(k,v),uniform3fv:(k,v)=>calls.set(k,v),uniform1i:(k,v)=>calls.set(k,v)};
 const p=bindHostedMaterialUniforms(gl,{}, {woodReliefM:.00014,frameMaterialMode:1});
 assert.equal(calls.get('u_microReliefM'),.00014);assert.equal(calls.get('uFrameMaterialMode'),1);assert.equal(calls.get('uMaterialApertureDescriptors'),7);
 for(const[k,v]of Object.entries(MATERIAL_UNIFORM_BINDINGS))assert.deepEqual(calls.get(k),p[v]);
 assert.doesNotThrow(()=>bindHostedMaterialUniforms({...gl,getUniformLocation:()=>null},{},{}));
});
test('rail and stile grains follow distinct real local member directions',()=>{
 const top=memberGrainCoordinates(frame,[.11,.67,.06],[0,0,1]),side=memberGrainCoordinates(frame,[.57,.11,.06],[0,0,1]);
 assert.equal(top.memberAxis,'rail-x');assert.equal(side.memberAxis,'stile-y');assert.ok(Math.abs(top.positionM[1])<1e-12);assert.ok(Math.abs(side.positionM[1])<1e-12);
 const shifted=memberGrainCoordinates(frame,[.12,.67,.06],[0,0,1]);assert.ok(Math.abs(shifted.positionM[0]-top.positionM[0]-.01)<1e-12);
 const rotatedNormal=memberGrainCoordinates(frame,[.57,.11,.06],[1,0,0]);assert.deepEqual(rotatedNormal.normal,[0,1,0]);
});
test('open-bottom door frame never invents a horizontal sill grain chart',()=>{
 const door=deriveAperture({kind:'door',instanceId:2,host,width:.9,height:2.1}),jamb=door.primitives.find(p=>p.part==='frame'),leaf=door.primitives.find(p=>p.part==='leaf');
 assert.equal(memberGrainCoordinates(jamb,[.43,-1.049,.06],[0,0,1]).memberAxis,'stile-y');
 assert.equal(memberGrainCoordinates(jamb,[0,1.02,.06],[0,0,1]).memberAxis,'rail-x');
 assert.equal(memberGrainCoordinates(leaf,[0,.2,.01],[0,0,1]).solidDoor,true);
});
test('physical grain scale is explicit and does not normalize geometry extents',()=>{
 const a=sampleTimberReference([.17,.031,.042],[0,0,1],.00012,{woodScale:2}),b=sampleTimberReference([.34,.062,.084],[0,0,1],.00012,{woodScale:1});assert.deepEqual(a,b);
 const scaledFrame={...frame,outer:{...frame.outer,half:frame.outer.half.map(x=>x*2)},inner:{...frame.inner,half:frame.inner.half.map(x=>x*2)}};
 const aChart=memberGrainCoordinates(frame,[.11,.67,.06],[0,0,1]),bChart=memberGrainCoordinates(scaledFrame,[.11,1.34,.06],[0,0,1]);assert.equal(aChart.positionM[0],bChart.positionM[0]);
});
test('real timber signals vary and stay in physical/color/roughness bounds',()=>{
 let minH=Infinity,maxH=-Infinity,minColor=Infinity,maxColor=-Infinity;
 for(let i=0;i<240;i++){
  const p=[Math.sin(i*12.31)*1.2,Math.cos(i*5.73)*.08,Math.sin(i*8.21)*.04],n=i%4===0?[1,0,0]:i%4===1?[0,1,0]:[0,0,1],params={woodReliefM:i%2?.00042:.0002,woodScale:i%3?5.8:1},s=sampleTimberReference(p,n,.00012,params),bound=materialHeightEnvelope(params);
  assert.ok(s.baseColor.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert.ok(s.roughness>=.18&&s.roughness<=.98);assert.equal(s.metallic,0);assert.ok(Math.abs(s.height)<=bound.woodM);
  assert.ok(Object.values(s.signals).every(x=>Number.isFinite(x)&&x>=0&&x<=1));
  minH=Math.min(minH,s.height);maxH=Math.max(maxH,s.height);minColor=Math.min(minColor,s.baseColor[0]);maxColor=Math.max(maxColor,s.baseColor[0]);
 }
 assert.ok(maxH-minH>.00002,'not flat zero-height');assert.ok(maxColor-minColor>.04,'not a flat brown color');
});
test('opaque paint hides wood albedo, but has nonzero bounded microheight',()=>{
 const color=[.17,.25,.27],heights=[];
 for(let i=0;i<80;i++){const p=[i*.0031,.029+i*.0007,.03],s=samplePaintReference(p,[0,0,1],color,.00012);assert.deepEqual(s.baseColor,color);assert.ok(Math.abs(s.height)<=materialHeightEnvelope().paintedWoodM);assert.ok(s.roughness>=.08&&s.roughness<=.98);assert.equal(s.metallic,0);heights.push(s.height);}
 assert.ok(Math.max(...heights)-Math.min(...heights)>.000005);
});
test('microheight reaches shading normals only, fades by metre pixel footprint',()=>{
 const point=[.123,.027,.03],n=[0,0,1],normal=materialReferenceNormal(p=>sampleTimberReference(p,n),point,n);
 assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-12);assert.ok(Math.abs(normal[0])+Math.abs(normal[1])>1e-5);
 assert.equal(sampleTimberReference(point,n,.004).height,0);assert.equal(sampleTimberReference(point,n,.00012,{woodReliefM:0}).height,0);
 assert.deepEqual(materialReferenceNormal(p=>sampleTimberReference(p,n,.004),point,n),n);
 assert.match(MATERIAL_GLSL,/heightMeters = microSignal \* u_microReliefM \* u_reliefScale \* detailFade/);
 assert.equal(materialHeightEnvelope().geometryDisplacementM,0);
});
test('clearcoat reserves substrate energy on entry and exit rather than adding a highlight',()=>{
 assert.deepEqual(clearcoatEnergyWeights(.5,.5,0),{substrate:1,entryReflection:0,exitReflection:0});
 const normal=clearcoatEnergyWeights(1,1,1);assert.ok(Math.abs(normal.substrate-.9216)<1e-12);
 assert.equal(clearcoatEnergyWeights(0,1,1).substrate,0);assert.throws(()=>clearcoatEnergyWeights(-1,1,1));
 assert.match(MATERIAL_GLSL,/base\*transmission\+clear/);assert.match(MATERIAL_GLSL,/materialAmbient/);
});
test('integrated white diffuse plus GGX coat has bounded reflected energy',()=>{
 const N=4096,golden=Math.PI*(3-Math.sqrt(5));
 for(const coat of [0,.45,1]){let sum=[0,0,0];const s={baseColor:[1,1,1],roughness:.4,metallic:0,clearcoat:coat,clearcoatRoughness:.23};for(let i=0;i<N;i++){const z=(i+.5)/N,r=Math.sqrt(1-z*z),phi=i*golden,l=[r*Math.cos(phi),r*Math.sin(phi),z],value=directMaterialBRDF(s,[0,0,1],[0,0,1],l);sum=sum.map((x,k)=>x+value[k]*2*Math.PI/N);}assert.ok(sum.every(x=>Number.isFinite(x)&&x>=0&&x<=1.015),JSON.stringify({coat,sum}));}
});
test('finite oblique direct BRDF and metal/wood separation',()=>{
 for(const mode of ['wood','paint','metal'])for(let i=1;i<30;i++){const s={baseColor:[.2,.3,.4],roughness:.1+i*.02,metallic:mode==='metal'?1:0,clearcoat:mode==='paint'?.8:0,clearcoatRoughness:.23};assert.ok(directMaterialBRDF(s,[0,0,1],[.9,0,.1],[Math.sin(i),Math.cos(i),.1]).every(x=>Number.isFinite(x)&&x>=0));}
});
test('glass absorption contract remains unchanged and metres-based',()=>{
 assert.deepEqual(glassAbsorptionTransmittance(.006),original.glassAbsorptionTransmittance(.006));const a=glassAbsorptionTransmittance(.006),b=glassAbsorptionTransmittance(.012);a.forEach((c,i)=>assert.ok(Math.abs(c*c-b[i])<1e-12));
});
