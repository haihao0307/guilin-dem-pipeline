import fs from'node:fs';import crypto from'node:crypto';
import{createStationWGSL}from'../kowloon-station-r04/receiver.mjs';
import{STATION_SCORE}from'../kowloon-station-r04/station-score.mjs';
import{createStationBinding}from'./station-binding.mjs';
import{hostConstructionWGSL}from'./host-construction.mjs';
import{GEOMETRY_GROUP_NAMES}from'./geometry-groups.mjs';
import{createGroupRuntimeWGSL}from'./group-runtime.mjs';
import{createGroupedRayStages}from'./group-ray-stages.mjs';
const datums=JSON.parse(fs.readFileSync(new URL('./qa/host-datums.json',import.meta.url)));
const construction=createStationBinding({score:STATION_SCORE,...datums}).construction;
const source=createStationWGSL({construction,hostWGSL:hostConstructionWGSL(construction.host)});
const dir=new URL('./generated/',import.meta.url),manifest={sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),outputs:{}};
function emit(name,entry,code){if(/--(?=\d)|\+\+(?=\d)/.test(code))throw Error('Ambiguous literal '+name);fs.writeFileSync(new URL(name+'.wgsl',dir),code);manifest.outputs[name]={entry,bytes:Buffer.byteLength(code),sha256:crypto.createHash('sha256').update(code).digest('hex')};}
for(let i=0;i<GEOMETRY_GROUP_NAMES.length;i++)emit('group-runtime-'+i,'stationGroupQuery',createGroupRuntimeWGSL(source,i));
for(const[name,value]of Object.entries(createGroupedRayStages(source)))emit(name,value.entry,value.source);
fs.writeFileSync(new URL('group-runtime-manifest.json',dir),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
