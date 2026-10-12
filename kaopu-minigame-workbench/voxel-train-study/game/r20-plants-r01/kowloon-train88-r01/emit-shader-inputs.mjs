import{RUNTIME_HEADER,STEP_ENTRY,NORMAL_ENTRY,MATTER_HEADER,MATTER_ENTRY}from'./runtime-entries.mjs';
import fs from'node:fs';import crypto from'node:crypto';import{WGSL,createStationWGSL}from'../kowloon-station-r04/receiver.mjs';
import{STATION_SCORE}from'../kowloon-station-r04/station-score.mjs';
import{createStationBinding}from'./station-binding.mjs';
import{hostConstructionWGSL}from'./host-construction.mjs';
// Source extraction only, no expression translation, new noise or material rewrite.
// Naga is the sole WGSL -> GLSL compiler. Interfaces are raster fragment stages
// because ES300 has no storage buffers, compute stages or shader atomic counters.
function extraction(WGSL){const src=WGSL.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
function blocks(keyword){const map=new Map(),re=new RegExp('\\b'+keyword+'\\s+(\\w+)\\s*','g');let m;while((m=re.exec(src))){const open=src.indexOf('{',re.lastIndex);if(open<0)throw Error('Missing body '+m[1]);let depth=1,end=open+1;for(;depth;end++){if(src[end]==='{')depth++;if(src[end]==='}')depth--;if(end>=src.length)throw Error('Unclosed '+m[1]);}map.set(m[1],src.slice(m.index,end));re.lastIndex=end;}return map;}
const fns=blocks('fn'),structs=blocks('struct');
const privateGlobals=[...src.matchAll(/\bvar<private>\s+\w+\s*:[^;]+;/g)].map(m=>m[0]);
const constants=[...src.matchAll(/\bconst\s+\w+\s*:[^;]+;/g)].map(m=>m[0]);
function closure(roots){const chosen=new Set();function add(n){if(chosen.has(n))return;if(!fns.has(n))throw Error('Missing function '+n);chosen.add(n);const b=fns.get(n);for(const m of b.matchAll(/\b(\w+)\s*\(/g))if(fns.has(m[1])&&m[1]!==n)add(m[1]);}roots.forEach(add);return[...fns].filter(([n])=>chosen.has(n)).map(([,s])=>s).join('\n');}
const header=[...structs].filter(([n])=>!['Stats','Trace'].includes(n)).map(([,s])=>s).join('\n')+'\n'+privateGlobals.join('\n')+'\n'+constants.join('\n')+'\n@group(0)@binding(0)var<uniform>u:Params;\n';
return{header,closure};}
const {header,closure}=extraction(WGSL);
const hostDatums=JSON.parse(fs.readFileSync(new URL('./qa/host-datums.json',import.meta.url)));
const construction=createStationBinding({score:STATION_SCORE,...hostDatums}).construction;
const hostWGSL=createStationWGSL({construction,hostWGSL:hostConstructionWGSL(construction.host)});
const host=extraction(hostWGSL);
const matter=String.raw`
@fragment fn materialProbe(@builtin(position) pixel:vec4<f32>)->@location(0)vec4<f32>{let index=u32(pixel.x);let row=u32(pixel.y);let family=index/32u;let cell=index%32u;let ids=array<u32,6>(1u,2u,3u,4u,13u,17u);let q=vec3<f32>(f32(cell)*.13-1.5,.1+f32(cell%3u)*.037,.03+f32(cell%5u)*.021);let p=vec3<f32>(f32(cell)*.11,.15+f32(cell%8u)*.12,8.3);let h=HitField(0.,ids[family],q,select(19.,38.,family==3u),0.,vec3<f32>(2.,1.5,.3),0.);let m=evaluateStationMatter(h,p,vec3<f32>(0.,1.,0.),.0005);if(row==0u){return vec4<f32>(m.d,m.surface.height,m.surface.roughness,f32(m.layer));}if(row==1u){return vec4<f32>(m.surface.albedo,m.microHeight);}let st=resolveStationState(p);return vec4<f32>(st.age,st.wet,st.repair,st.retained);}
`;
const geometry=String.raw`
@fragment fn geometryProbe(@builtin(position) pixel:vec4<f32>)->@location(0)vec4<f32>{let i=u32(pixel.x);let family=i/32u;let cell=f32(i%32u);var p=vec3<f32>(cell*.2-3.2,6.95,8.35);if(family==1u){p=vec3<f32>(27.72,cell*1.3+.85,4.);}if(family==2u){p=vec3<f32>(10.,.848+cell*.0001,-35.);}if(family==3u){p=vec3<f32>(10.199,1.+cell*.24,-32.5);}if(family==4u){p=vec3<f32>(9.72,1.4+cell*.024,-36.);}if(family==5u){p=vec3<f32>(GOODS_X+3.,1.+cell*.16,GOODS_CENTER);}let h=stationField(p);return vec4<f32>(h.d,f32(h.id),h.baseD,h.sourceSeed);}
`;
const output=new URL('./generated/',import.meta.url);fs.mkdirSync(output,{recursive:true});const sources={material:header+closure(['evaluateStationMatter'])+matter,geometry:header+closure(['stationField'])+geometry,hostgeometry:host.header+RUNTIME_HEADER+host.closure(['stationField'])+geometry,step:host.header+RUNTIME_HEADER+host.closure(['stationField','barrelAdvance','floorAdvance'])+STEP_ENTRY,normal:host.header+RUNTIME_HEADER+host.closure(['stationField'])+NORMAL_ENTRY,matter:host.header+RUNTIME_HEADER+MATTER_HEADER+host.closure(['evaluateStationMatter'])+MATTER_ENTRY};const manifest={source:'../kowloon-station-r04/receiver.mjs assembled WGSL',sourceSHA256:crypto.createHash('sha256').update(WGSL).digest('hex'),hostSourceSHA256:crypto.createHash('sha256').update(hostWGSL).digest('hex'),hostConstruction:construction,emission:'same field generator; unchanged source mother functions; transitive call closure only',outputs:{}};for(const[n,s]of Object.entries(sources)){if(/atomic|var<storage|@compute|textureSample/.test(s))throw Error('Unsupported raster interface '+n);fs.writeFileSync(new URL(n+'.wgsl',output),s);manifest.outputs[n]={bytes:Buffer.byteLength(s),sha256:crypto.createHash('sha256').update(s).digest('hex')};}fs.writeFileSync(new URL('manifest.json',output),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
