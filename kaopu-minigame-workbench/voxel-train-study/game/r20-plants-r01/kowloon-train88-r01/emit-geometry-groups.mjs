import fs from'node:fs';import crypto from'node:crypto';
import{createStationWGSL}from'../kowloon-station-r04/receiver.mjs';
import{STATION_SCORE}from'../kowloon-station-r04/station-score.mjs';
import{terminalHallMembers}from'../kowloon-station-r04/native-terminal-hall.mjs';
import{createStationBinding}from'./station-binding.mjs';
import{hostConstructionWGSL}from'./host-construction.mjs';
import{RUNTIME_HEADER}from'./runtime-entries.mjs';
import{extraction}from'./shader-closure.mjs';
import{GEOMETRY_GROUP_NAMES,stationGeometryGroupSource}from'./geometry-groups.mjs';
const datums=JSON.parse(fs.readFileSync(new URL('./qa/host-datums.json',import.meta.url)));
const construction=createStationBinding({score:STATION_SCORE,...datums}).construction;
const source=createStationWGSL({construction,hostWGSL:hostConstructionWGSL(construction.host)});
const f=n=>Number.isInteger(n)?n+'.':String(n),v=a=>'vec3<f32>('+a.map(f).join(',')+')';
const anchor=terminalHallMembers({...STATION_SCORE.hall,deck:construction.host.boardingIsland.topLocalYM}).anchors[0].at;
const entry=String.raw`
struct GeometryGroupResult{@location(0)a:vec4<f32>,@location(1)b:vec4<f32>,@location(2)c:vec4<f32>,@location(3)e:vec4<f32>,}
@fragment fn geometryGroupProbe(@builtin(position)pixel:vec4<f32>)->GeometryGroupResult{
 let i=u32(pixel.x);let family=i/16u;let x=f32(i%16u);var p=vec3<f32>(x*.4-3.2,6.95,8.35);
 if(family==1u){p=${v(anchor)}+vec3<f32>(-.01,.035+x*.024,-.40+x*.06);}
 if(family==2u){p=vec3<f32>(27.72,x*2.6+.85,4.);}
 if(family==3u){p=vec3<f32>(x*1.25-10.,SHED_CY+sqrt(max(0.,SHED_RADIUS*SHED_RADIUS-(x*1.25-10.)*(x*1.25-10.)))+.05,-35.);}
 if(family==4u){p=vec3<f32>(-29.801,.85+x*.56,-32.5);}
 if(family==5u){p=vec3<f32>(10.,.848+x*.0002,-35.);}
 if(family==6u){p=vec3<f32>(-5.+RAIL_CENTER_OFFSET+.012,RAIL_CROWN-x*.01,-35.);}
 if(family==7u){p=vec3<f32>(9.72,1.4+x*.048,-36.);}
 if(family==8u){p=vec3<f32>(x*4.-30.,9.2,${f(STATION_SCORE.bridge.bridgeZ)});}
 if(family==9u){p=vec3<f32>(GOODS_X+3.,1.+x*.32,GOODS_CENTER);}
 if(family==10u){p=vec3<f32>(SHORE_X+x*2.,-.20,0.);}
 if(family==11u){p=vec3<f32>(x*2.-12.,.83,SHED_FRONT-1.);}
 let h=stationField(p);
 return GeometryGroupResult(vec4<f32>(h.d,f32(h.id),h.baseD,h.seed),vec4<f32>(h.q,h.sourceSeed),vec4<f32>(h.extent,f32(stationRawCandidateCount)),vec4<f32>(select(0.,1.,stationCandidateOverflow),0.,0.,0.));
}
`;
const dir=new URL('./generated/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const points=Array.from({length:192},(_,i)=>{const family=Math.floor(i/16),x=i%16,{shed,site}=STATION_SCORE;const cy=shed.eave-Math.sqrt(shed.radius*shed.radius-shed.span*shed.span/4);return[
 [x*.4-3.2,6.95,8.35],anchor.map((a,j)=>a+[-.01,.035+x*.024,-.40+x*.06][j]),[27.72,x*2.6+.85,4.],
 [x*1.25-10.,cy+Math.sqrt(Math.max(0,shed.radius*shed.radius-(x*1.25-10.)**2))+.05,-35.],[-29.801,.85+x*.56,-32.5],
 [10.,.848+x*.0002,-35.],[-5.+construction.railCenterOffsetM+.012,construction.railTopLocalM-x*.01,-35.],[9.72,1.4+x*.048,-36.],
 [x*4.-30.,9.2,STATION_SCORE.bridge.bridgeZ],[site.goods.centerX+3.,1.+x*.32,site.goods.front-site.goods.length/2],
 [site.shoreX+x*2.,-.20,0.],[x*2.-12.,.83,shed.front-1.]
 ][family];});
const manifest={schema:'kaopu.station.geometry-groups/1',sourceSHA256:sha(source),construction,merge:'physical winner, contiguous original-order strict minimum, sum rawCount, any overflow or sum>96 fails id999',probe:{width:192,height:1,ages:[.05,.58,.95],points},groups:[]};
for(let i=0;i<GEOMETRY_GROUP_NAMES.length;i++){
 const selected=stationGeometryGroupSource(source,i),part=extraction(selected),body=part.closure(['stationField'],entry),usesHostFrame=/\bframe\./.test(body);
 const code=part.header+(usesHostFrame?RUNTIME_HEADER:'')+body+entry;
 if(/--(?=\d)|\+\+(?=\d)/.test(code))throw Error('Ambiguous numeric literal in group '+i);
 const stem='group-'+i;fs.writeFileSync(new URL(stem+'.wgsl',dir),code);
 manifest.groups.push({index:i,name:GEOMETRY_GROUP_NAMES[i],stem,outputs:4,usesHostFrame,bytes:Buffer.byteLength(code),sha256:sha(code)});
}
fs.writeFileSync(new URL('geometry-group-manifest.json',dir),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
