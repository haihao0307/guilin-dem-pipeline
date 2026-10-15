// Regenerate next-version runtime only; never writes source/first-version files.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath}from'node:url';
import {patchDynamicVerified,DYNAMIC_PATCH_PLAN}from'./projection/dynamic-patch-plan.mjs';import{applyAgeRuntime}from'./apply-age-runtime.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),base=path.join(root,'hong-kong-main-city-r01');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Next runtime anchor not unique: '+a.slice(0,60));return s.replace(a,b);};
const report={sourceWrites:0,files:{}};
for(const key of['airport','city','citySpatial','outer','outerSpatial']){
 const spec=DYNAMIC_PATCH_PLAN[key],r=await patchDynamicVerified(key,await fs.readFile(path.join(root,spec.source)));let s=r.text,dst;
 if(key==='airport')dst='airport.mjs';
 if(key==='city'){
  s=once(s,'const [manifest,datumData,datumCoverage]=await Promise.all([','const [manifest,datumData,datumCoverage,revisionDates]=await Promise.all([');
  s=once(s,"get(new URL('./datum/coverage.json',import.meta.url)).then(r=>r.json())]);","get(new URL('./datum/coverage.json',import.meta.url)).then(r=>r.json()),get(new URL('./revision-dates.json',import.meta.url)).then(r=>r.json())]);");
  s=once(s,"['资料更新',t.datasetRevision?.date]","['资料更新',revisionDates.tiles[chunk.tile]?revisionDates.tiles[chunk.tile].hongKongDate+' (HKT, UTC+08:00); 原时间 '+revisionDates.tiles[chunk.tile].utcTimestamp:t.datasetRevision?.date]");
  s=once(s,'建筑更新日：逐楼记录；','建筑资料更新日：香港时间 UTC+08:00，逐楼记录；');
  dst='city-buildings/runtime.mjs';s=once(s,"from './vendor/three.module.js'","from '../../hong-kong-main-city-r01/city-buildings/vendor/three.module.js'");s=once(s,"new URL('./data/',import.meta.url)","new URL('./data-historical/',import.meta.url)");s=once(s,"from './data/runtime/reconstruct-robust.mjs'","from './data-historical/runtime/reconstruct-robust.mjs'");s=once(s,'CONCURRENCY=2','CONCURRENCY=1');
  s=once(s,'lastUpdate=-Infinity;updateStatus();requestFrame();}','lastUpdate=-Infinity;updateStatus();requestFrame();if(lastCamera&&!disposed&&enabled)queueMicrotask(()=>schedule(lastCamera));}');
 }
 if(key==='city')s=applyAgeRuntime(s);
 if(key==='citySpatial')dst='city-buildings/spatial.mjs';
 if(key==='outer'){
  dst='runtime/outer-renderer.mjs';s=s.replace("'./data/height-spectrum.mjs'","'../outer-terrain/data/height-spectrum.mjs'").replace("'./mesh.mjs'","'../outer-terrain/mesh.mjs'").replace("'./spatial.mjs'","'./outer-spatial.mjs'").replace("new URL('./data/manifest.json',import.meta.url)","new URL('../outer-terrain/data/manifest.json',import.meta.url)");
  s=once(s,'let enabled=true,disposed=false,desired=', 'let lastCamera=null,enabled=true,disposed=false,desired=');s=once(s,'function draw(c,s,e){if(disposed)return;frames++;','function draw(c,s,e){if(disposed)return;lastCamera=c;frames++;');s=once(s,'lastSchedule=-Infinity;status();requestFrame();}}','lastSchedule=-Infinity;status();requestFrame();if(lastCamera&&!disposed&&enabled)queueMicrotask(()=>schedule(lastCamera));}}');
 }
 if(key==='outerSpatial')dst='runtime/outer-spatial.mjs';
 await fs.mkdir(path.dirname(path.join(here,dst)),{recursive:true});await fs.writeFile(path.join(here,dst),s);report.files[dst]={source:spec.source,inputSha256:r.inputSha256};
}
for(const name of['geometry.mjs','kowloon-scale-guides.mjs','airport-1970.json','base-host-patches.json','SOURCES.md'])await fs.copyFile(path.join(base,name),path.join(here,name));
await fs.cp(path.join(base,'city-buildings/datum'),path.join(here,'city-buildings/datum'),{recursive:true});
await fs.writeFile(path.join(here,'RUNTIME-BUILD-RECEIPT.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
