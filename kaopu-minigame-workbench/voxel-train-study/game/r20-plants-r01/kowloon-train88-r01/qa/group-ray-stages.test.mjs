import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{createStationWGSL}from'../../kowloon-station-r04/receiver.mjs';
import{STATION_SCORE}from'../../kowloon-station-r04/station-score.mjs';
import{createStationBinding}from'../station-binding.mjs';import{hostConstructionWGSL}from'../host-construction.mjs';
import{createGroupedRayStages}from'../group-ray-stages.mjs';import{STEP_ENTRY,NORMAL_ENTRY}from'../runtime-entries.mjs';
const datums=JSON.parse(fs.readFileSync(new URL('./host-datums.json',import.meta.url))),construction=createStationBinding({score:STATION_SCORE,...datums}).construction,source=createStationWGSL({construction,hostWGSL:hostConstructionWGSL(construction.host)}),stages=createGroupedRayStages(source);
function fn(s,name){s=s.replace(/\/\/[^\n]*/g,'');const i=s.indexOf('fn '+name+'(');assert(i>=0);const open=s.indexOf('{',i);let d=1,e=open+1;for(;d;e++){if(s[e]==='{')d++;if(s[e]==='}')d--;}return s.slice(i,e).replace(/\s+/g,'');}
test('same roof/floor advance equations replace only same-point alternate full-domain distance reads',()=>{
 const a=stages['group-advance'].source;
 for(const [name,old]of[['barrelAdvance','stationDomain(p,true,false).d'],['floorAdvance','stationDomain(p,false,true).d']])assert.equal(fn(a,name),fn(source,name).replace(old,'stationOtherDistance'));
 assert.doesNotMatch(a,/fn stationDomain\(/);for(const x of ['clamp(tr.x*.000015,.00065,.004)','max(max(max(abs(h.d)*.60,barrelAdvance(p,rd,h)),floorAdvance(p,rd,h)),.00018)','tr.z>=frame.controls.z']){assert(a.includes(x));assert(STEP_ENTRY.includes(x));}
 assert(a.includes('if(tr.w!=0.){return tr;}'));assert(a.includes('alternate.y==999.'));assert(a.includes('!all(abs(a)<vec4<f32>(1e30))'));
});
test('ray initialization uses the original exact near/far interval and status meanings',()=>{const a=stages['group-init'].source;for(const x of ['stationRayInterval(ray[0],ray[1],hostRayLength(pixel.xy))','vec4<f32>(interval.x,0.,0.,0.)','vec4<f32>(0.,0.,0.,2.)'])assert(a.includes(x));});
test('staged normal retains the same 5 tetrahedral samples and exact field metadata; errors become explicit unresolved rays',()=>{
 const receiver=fs.readFileSync(new URL('../function-receiver.mjs',import.meta.url),'utf8'),pack=stages['group-normal-pack'].source;
 assert(receiver.includes('[[0,0,0],[1,-1,-1],[-1,-1,1],[-1,1,-1],[1,1,1]]'));assert(receiver.includes('axes[i].map(x=>x*.00045)'));assert(NORMAL_ENTRY.includes('axes[i]*.00045'));
 for(const x of ['vec4<f32>(b.xyz,a.w)','vec4<f32>(c.xyz,b.w)','vec4<f32>(0.,0.,0.,a.z)','normalControl.axisAndStep.xyz*a.x','gradient=normalize(gradient)','textureLoad(previousError,ij,0).x'])assert(pack.includes(x));
 assert(receiver.includes('texelFetch(errorMap,p,0).x>.5)tr.w=3.'));assert(receiver.includes('main.geometry.textures.slice(0,3).forEach'));
});
test('all emitted stage constants are declared and no full geometry gets re-inlined in advancement or packing',()=>{for(const[n,{source:s}]of Object.entries(stages)){const code=s.replace(/\/\/[^\n]*/g,'');for(const c of new Set(code.match(/\b[A-Z][A-Z0-9_]{2,}\b/g)||[]))assert(code.includes('const '+c+':')||code.includes('const '+c+'='),n+' lacks '+c);assert(!s.includes('fn stationDomain('));assert(s.length<24000,n+' grew a full construction closure');}});
test('host queries preserve full-hit input before alternate query and perform all groups before every advance',()=>{const r=fs.readFileSync(new URL('../function-receiver.mjs',import.meta.url),'utf8');assert(r.includes('const complete=grouped.query(options)'));assert(r.includes('renderStage(copyMaterial,t.fullField,t.coverage.rects)'));assert(r.includes('fullHitTexture:t.fullField.texture,skip:3'));assert(r.indexOf('const complete=grouped.query')<r.indexOf('const alternate=grouped.query'));assert(r.includes('iteration<1400'));assert(r.includes('if(iteration%16===15){const active=isActive(t.rays[last].texture,t)'));assert(r.includes('if(!active)break;'));assert(r.includes('diagnosticProgress:testResolution?'));assert(r.includes("if(event.stage==='group-submitted'){gl.finish()"));assert(r.includes('grouped.dispose()'));});
