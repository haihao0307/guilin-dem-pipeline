#!/usr/bin/env node
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {DYNAMIC_PATCH_PLAN,patchDynamicVerified} from './dynamic-patch-plan.mjs';
import {countExact} from './patch-plan.mjs';
import {projectionSourceURLs} from './source-layout.mjs';
import {frame,projectionForFrame,installSharedProjection} from './shared-projection.mjs';
import {fitRegion,fitRegionShared,mapCamera,depthStepM,installRegionOverview} from './camera.mjs';
import {float32DepthDiagnostic} from './shared-near-test-candidate.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),patched={};
const report={schema:'hk-dynamic-projection-cpu/1',passed:false,gpuStatus:'NOT RUN',sourceWrites:0,policy:'mode === map ? clamp(mapState.distance * .02, .15, 3000) : .15; far=150000',checks:{},viewports:[]};
const sources=projectionSourceURLs(import.meta.url,{publishedLayout:process.argv.includes('--published-layout')});
for(const [key,p]of Object.entries(DYNAMIC_PATCH_PLAN))patched[key]=(await patchDynamicVerified(key,await fs.readFile(sources[key]))).text;
assert.equal(countExact(patched.r03,'near=clipNear,far=clipFar'),4);assert.equal(countExact(patched.three,'adhesiveMassKg:6e4'),2);assert.equal(countExact(patched.three,'p.near=G.clipNear,p.far=G.clipFar,'),1);assert.equal(countExact(patched.three,'clipNear:p.near,clipFar:p.far,clipProjectionMatrix:p.projectionMatrix.elements.slice()'),1);report.checks.threeQAReadsActualCameraAndMatrix=true;
for(const key of['airport','city','outer']){assert.equal(countExact(patched[key],'near=clipNear,far=clipFar'),1);assert.equal(countExact(patched[key],'uniform float clipNear,clipFar;'),1);}
const config=JSON.parse(await fs.readFile(sources.hostPatches,'utf8'));
let html=patched.r03;for(const [from,to]of config.patches){assert.equal(countExact(html,from),1,'Existing host patch anchor changed: '+from.slice(0,80));html=html.replace(from,to.replace('__INTEGRATION_URL__','https://example.invalid/staging/integration.mjs'));}
for(const[from,to]of[['const hkBox=[HK.x0-HK.origin[0]','window.KaiTakSetup.prepareTerrain({HK,hkHeights,hkMask});const hkBox=[HK.x0-HK.origin[0]'],['detailPatches.push(q)}','window.KaiTakSetup.prepareDetail(q);detailPatches.push(q)}']]){assert.equal(countExact(html,from),1);html=html.replace(from,to);}
for(const key of['airport','city','outer']){const checked=spawnSync(process.execPath,['--input-type=module','--check'],{input:patched[key],encoding:'utf8',maxBuffer:256*1024});assert.equal(checked.status,0,key+' patched module syntax');}report.checks.patchedLayerModuleSyntaxChecked=3;
report.checks.existingHostPatchesReplayed=config.patches.length+2;
let scripts=0;for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){if(!match[1].trim())continue;const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:match[1],encoding:'utf8',maxBuffer:256*1024});assert.equal(result.status,0,'Assembled script syntax failed: '+String(result.stderr).slice(0,800));scripts++;}report.checks.assembledInlineScriptsSyntaxChecked=scripts;
// Test the exact patched cameraData wrapper after the real host's camera substitution.
const rawFn='function cameraData(){return mapCamera()}',wrapped=DYNAMIC_PATCH_PLAN.r03.patches.find(x=>x.from===rawFn).to,hostCameraRule=config.patches.find(x=>x[0]===rawFn),snippet=wrapped.replace(rawFn,hostCameraRule[1]);assert(html.includes(snippet));
const w={};installSharedProjection(w);const mapState={distance:100000},qa={},base=mapCamera({target:[0,0,0],distance:100000,yaw:0,pitch:-1.5});
const run=new Function('window','mapCamera','mapState','qa',snippet+';return{read:()=>cameraData(),setGame:g=>{trainIntegration=g;window.HKTrain88=g;}};')(w,()=>base,mapState,qa);
for(const [mode,distance,expected]of[['map',180,3.6],['map',2000,40],['map',65946.01623307906,1318.9203246615814],['map',140307.01820588077,2806.1403641176153],['follow',140307,.15],['platform',450,.15],['side',450,.15],['city',20000,.15]]){mapState.distance=distance;run.setGame({camera:()=>base,getState:()=>({mode})});const c=run.read();assert.equal(c.clipNear,expected);assert.equal(c.clipFar,150000);assert(Object.isFrozen(c));assert.equal(base.clipNear,undefined);assert.equal(qa.clipProjection.near,expected);}
assert.throws(()=>frame(base,{mode:'map',distance:NaN}),/finite/);report.checks.sameFrameCameraWrapperAndPolicyCases=8;
const src=patched.three+'\nexport{Mt as TestPerspectiveCamera};';const {TestPerspectiveCamera:Camera}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const mul=(m,v)=>[0,1,2,3].map(r=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);let maxNdcError=0;
const spatial=await import('data:text/javascript;base64,'+Buffer.from(patched.outerSpatial).toString('base64'));
for(const [width,height]of[[1920,1080],[1440,1080],[1080,1080],[390,844],[360,800],[375,812]]){
 const fit=fitRegion(width/height),sharedFit=fitRegionShared(width/height);assert(fit.supported);assert.equal(sharedFit.camera.clipNear,projectionForFrame({mode:'map',distance:fit.state.distance}).clipNear);assert.equal(sharedFit.camera.near,sharedFit.camera.clipNear);assert.equal(sharedFit.report.near,sharedFit.camera.clipNear);assert(sharedFit.report.allInside);const c=frame(fit.camera,{mode:'map',distance:fit.state.distance}),{clipNear:near,clipFar:far}=c,tc=new Camera(55,width/height,near,far);tc.position.set(...c.cam);tc.up.set(...c.up);tc.lookAt(...c.cam.map((x,i)=>x+c.fw[i]));tc.updateMatrixWorld(true);
 const depths=fit.report.corners.map(corner=>{const z=corner.viewDepthM,raw=[corner.clip[0],corner.clip[1],(far+near)/(far-near)*z-2*far*near/(far-near),z],actual=mul(tc.projectionMatrix.elements,mul(tc.matrixWorldInverse.elements,[...corner.world,1]));maxNdcError=Math.max(maxNdcError,...raw.slice(0,3).map((x,i)=>Math.abs(x/raw[3]-actual[i]/actual[3])));return {...float32DepthDiagnostic(z,{near,far}),oneD24LSBApproxM:depthStepM(z,24,{near,far})};});
 assert(depths.every(x=>!x.atOrBeyondClearDepth));const whole={min:[-37680,-100,-29720],max:[35640,1500,31270]};assert(spatial.likelyVisible(whole,c,width/height));
 report.viewports.push({width,height,clipNear:near,clipFar:far,distanceM:fit.state.distance,depthRangeM:fit.report.depthRangeM,allIdealFrustumCornersInside:fit.report.allInside,nonFusedCPUClearDepthRiskCount:depths.filter(x=>x.atOrBeyondClearDepth).length,depths});
}
assert(maxNdcError<2e-8);report.checks.actualThreeMaxNdcError=maxNdcError;report.checks.fullRegionCameraAndReportUseDynamicNear=true;
// Decode ocean shader and run only its existing source-string replacements; ensure one declaration.
const oceanMatch=patched.r03.match(/"ocean.vert":("(?:\\.|[^"\\])*")/);assert(oceanMatch);const ocean=JSON.parse(oceanMatch[1]),line=patched.r03.split('\n').find(x=>x.startsWith('const mapOceanVertex='));assert(line);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const oceanMapped=await new AsyncFunction('text',line+'return mapOceanVertex;')(async()=>ocean);assert.equal(countExact(oceanMapped,'uniform float clipNear,clipFar;'),1);assert.equal(countExact(oceanMapped,'uniform vec4 uHKBbox;'),1);report.checks.oceanSourceRemappingPreserved=true;
const production=projectionSourceURLs('file:///repo/kaopu-geography-workbench/hong-kong-main-city-r02/projection/verify-cpu.mjs');
assert.equal(production.three.href,'file:///repo/kaopu-geography-workbench/hong-kong-main-city-r01/integration-aligned.js');assert.equal(production.r03.href,'file:///repo/kaopu-geography-workbench/hong-kong-map-sea-r03/index.html');assert.equal(production.outer.href,'file:///repo/kaopu-geography-workbench/hong-kong-main-city-r02/projection/source-fixtures/outer-renderer.mjs');
const web=projectionSourceURLs('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/hong-kong-main-city-r02/projection/gpu-check.html');assert.equal(web.three.href,'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/hong-kong-main-city-r01/integration-aligned.js');report.checks.publishedSiblingAndResearchPathsResolved=true;
const savedGlobals=Object.fromEntries(['document','addEventListener','removeEventListener'].map(k=>[k,globalThis[k]]));
try{
 globalThis.document={createElement:()=>({dataset:{},textContent:'',setAttribute(){},after(){},remove(){}})};globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
 const uiHost={canvas:{width:390,height:844,addEventListener(){},removeEventListener(){}},mapState:{},requestFrame(){},qa:{}};
 const overview=installRegionOverview(uiHost,{setMode(){}},{buttonParent:{append(){}}});overview.focus();assert(overview.getState().active);assert.equal(uiHost.qa.fullRegionProjection.near,2806.1403641176153);assert.equal(uiHost.qa.fullRegionProjection.camera.near,uiHost.qa.fullRegionProjection.near);assert.equal(uiHost.qa.fullRegionProjection.report.near,uiHost.qa.fullRegionProjection.near);overview.cancel();assert(!overview.getState().active);assert.equal(uiHost.qa.fullRegionProjection.active,false);overview.dispose();report.checks.overviewCancelAndDynamicQASmokeTest=true;
}finally{for(const [k,v]of Object.entries(savedGlobals))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
report.passed=true;await fs.writeFile(path.join(here,'DYNAMIC-CPU-RESULTS.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,gpuStatus:report.gpuStatus,checks:report.checks,viewports:report.viewports.map(({width,height,clipNear,nonFusedCPUClearDepthRiskCount})=>({width,height,clipNear,nonFusedCPUClearDepthRiskCount}))},null,2));
