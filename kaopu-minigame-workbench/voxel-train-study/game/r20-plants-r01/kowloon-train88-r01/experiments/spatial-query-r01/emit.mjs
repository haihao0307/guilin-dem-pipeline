import fs from'node:fs';import crypto from'node:crypto';
import{createStationWGSL}from'../../../kowloon-station-r04/receiver.mjs';import{STATION_SCORE}from'../../../kowloon-station-r04/station-score.mjs';
import{createTerminalHallSampler,terminalHallMemberPoint}from'../../../kowloon-station-r04/native-terminal-hall.mjs';
import{createStationBinding}from'../../station-binding.mjs';import{hostConstructionWGSL}from'../../host-construction.mjs';
import{stationGeometryGroupSource}from'../../geometry-groups.mjs';import{extraction}from'../../shader-closure.mjs';
import{specializeTerminalStorage}from'../candidate-storage-r01/one-terminal-slot.mjs';
import{lowerHallHierarchy,instrumentReferenceHall}from'./hall-hierarchy.mjs';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),datums=JSON.parse(fs.readFileSync(new URL('../../qa/host-datums.json',import.meta.url))),construction=createStationBinding({score:STATION_SCORE,...datums}).construction,original=createStationWGSL({construction,hostWGSL:hostConstructionWGSL(construction.host)}),lowered=lowerHallHierarchy(original,{counters:true});
const hall=createTerminalHallSampler({...STATION_SCORE.hall,deck:construction.host.boardingIsland.topLocalYM},{compact:true,proxyBounds:true});
const points=[],labels=[];function add(p,label){points.push(p.map(Math.fround));labels.push(label);}
const old=JSON.parse(fs.readFileSync(new URL('../../generated/geometry-group-manifest.json',import.meta.url)));for(const[p,i]of old.probe.points.map((p,i)=>[p,i]))add(p,'whole-station-family-'+Math.floor(i/16));
for(const m of hall.parts.filter(m=>!m.binding.deferred&&(m.sourceFamily.includes('arch')||m.id.includes('oculus')||m.id.includes('fanlight')||m.sourceFamily.includes('column')||m.surface.role==='roof-metal')).filter((_,i)=>i%3===0)){
 const p=terminalHallMemberPoint(m,[m.extent[0],0,0]);for(const a of[[0,0,0],[1,-1,-1],[-1,-1,1],[-1,1,-1],[1,1,1]])add(p.map((x,k)=>x+a[k]*.00045),'physical-near-normal-'+m.id);
}
for(const b of lowered.original.blocks)for(const eps of[-.00001,0,.00001]){const p=b.center.slice();p[b.index%3]+=b.half[b.index%3]+.06+eps;add(p,'original-bound-switch-'+b.index);}
// Same function samples along fixed sun-like and ordinary-perspective rays;
// these are field/occlusion boundary probes, not a rendered shadow-image claim.
for(const direction of[[.62,.73,.29],[-.78,.31,.54]])for(const target of[[-25,7,0],[0,14,-35],[27,20,4],[-31,10,0]])for(let i=0;i<24;i++)add(target.map((x,k)=>x+direction[k]*(i-12)*.017),'sun-or-view-boundary-ray');
for(let i=0;i<128;i++)add([((i*17)%127-63)*2.4,((i*13)%43)-8,((i*29)%173-86)*3.1],'external-empty-space');
for(const x of[2047.999755859375,2047.9998779296875,2048,2048.000244140625,-2047.9998779296875,-2048,-2048.000244140625])for(const d of[-.00045,0,.00045])add([x+d,4,0],'fallback-coordinate-limit-with-normal-offset');add([50000,-3000,3],'fallback-far');
const entry=String.raw`
@group(1)@binding(0)var probePoints:texture_2d<f32>;
struct HierarchyResult{@location(0)a:vec4<f32>,@location(1)b:vec4<f32>,@location(2)c:vec4<f32>,@location(3)e:vec4<f32>,}
@fragment fn hierarchyProbe(@builtin(position)pixel:vec4<f32>)->HierarchyResult{
 let p=textureLoad(probePoints,vec2<i32>(pixel.xy),0).xyz;
 let h=stationDomain(p,u.debug==1.,u.debug==2.);
 return HierarchyResult(vec4<f32>(h.d,f32(h.id),h.baseD,h.seed),vec4<f32>(h.q,h.sourceSeed),vec4<f32>(h.extent,f32(stationRawCandidateCount)),vec4<f32>(select(0.,1.,stationCandidateOverflow),f32(stationHallBoundsVisited),f32(stationHallBlocksVisited),f32(stationHallBlocksSkipped)));
}
`;
const dir=new URL('./generated/',import.meta.url);fs.mkdirSync(dir,{recursive:true});const manifest={schema:'kaopu.hall-empty-space-hierarchy-experiment/1',originalSourceSHA256:sha(original),scope:'same original physical group0, exact GeometryHit comparison and warm query cost; no whole scene',points,labels,ages:[.05,.58,.95],skipModes:[0,1,2],repeats:3,hierarchy:lowered.metrics,variants:{}};
for(const[name,source]of[['reference',instrumentReferenceHall(original)],['hierarchy',lowered.source]]){const selected=stationGeometryGroupSource(source,0),part=extraction(selected),code=part.header+part.closure(['stationDomain'],entry)+entry;fs.writeFileSync(new URL(name+'.wgsl',dir),code);manifest.variants[name]={entry:'hierarchyProbe',sha256:sha(code),bytes:Buffer.byteLength(code)};if(name==='reference'){const single=specializeTerminalStorage(code);fs.writeFileSync(new URL('capacity.wgsl',dir),single.source);manifest.variants.capacity={entry:'hierarchyProbe',sha256:sha(single.source),bytes:Buffer.byteLength(single.source),proof:single.proof};}}
fs.writeFileSync(new URL('manifest.json',dir),JSON.stringify(manifest,null,2));console.log(JSON.stringify({points:points.length,variants:manifest.variants,hierarchy:manifest.hierarchy}));
