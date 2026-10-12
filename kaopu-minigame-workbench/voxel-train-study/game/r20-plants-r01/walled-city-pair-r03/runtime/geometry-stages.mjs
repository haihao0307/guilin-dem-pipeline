import {GEOMETRY_WGSL} from './geometry.mjs';
import {receiverWGSL} from './receiver.mjs';
import {WAVEFRONT_WGSL} from './wavefront.mjs';
export const GEOMETRY_GROUPS=['shell','openings','stairs','exterior','life','service','roofs-and-links'];
function fn(source,name){const start=source.indexOf('fn '+name+'(');if(start<0)throw Error('missing '+name);const open=source.indexOf('{',start);let at=open+1,depth=1;while(depth&&at<source.length){if(source[at]==='{')depth++;if(source[at]==='}')depth--;at++;}if(depth)throw Error('unbalanced '+name);return{start,end:at,text:source.slice(start,at),body:source.slice(open+1,at-1)};}
function between(body,a,b){const i=body.indexOf(a),j=body.indexOf(b,i+a.length);if(i<0||j<0)throw Error('geometry boundary missing: '+a);return body.slice(i+a.length,j);}
const original=fn(GEOMETRY_WGSL,'storey'),b=original.body;
const lead=b.slice(0,b.indexOf('let wall=.11;'));
const local=between(b,'let wall=.11;','// Main slab');
const slab=between(b,'// Main slab leaves a real alternating switchback stair opening next to the gap.','// Front and rear');
const inner=slab.slice(0,slab.indexOf('let slabQ='));
const front=between(b,'// Front and rear apertures programmeCode the actual storey footprint and programme.','// Both sides');
const side=between(b,'// Both sides contain real windows and gap-side doors to shared landings.','// Life split');
const partition=between(b,'// Life split: side stair/service strip, small front work/sleep area, rear wet/storage.','// Two flights');
const sep=/let sepZ=[^;]+;/.exec(partition)?.[0];if(!sep)throw Error('missing shared wet divider');
const stairs=between(b,'// Two flights and a true half-height turning platform, with continuous handrail.','// Shared balcony');
const exterior=between(b,'// Shared balcony is only generated when a rent/addition event grants access.','// Joint-aligned');
const pipes=between(b,'// Joint-aligned water and drainage, not arbitrary noise streaks.','if(abs(p.x-inner)>1.0');
const lifeMatch=/if\(abs\(p.x-inner\)>1.0[^\n]+/.exec(b);if(!lifeMatch)throw Error('missing life receiver');
const life=lifeMatch[0].replace('h=wetService(h,p,s);','');
const parts=[
 slab.slice(slab.indexOf('let slabQ='))+(front+side).replace(/h=(?:windowParts|householdFrontageOpenings)\([^;]+;/g,'')+partition.replace(sep,''),
 (front+side).replace(/h=(?:choose|householdFrontageShell)\([^;]+;/g,''),
 stairs,exterior+pipes,life,'h=wetService(h,p,s);'
];
export const GEOMETRY_PARTITION_PROOF={sourceStorey:original.text,groups:parts,common:lead+'let wall=.11;'+local+inner+sep,rule:'Each original h-changing field operation appears once across six storey groups. Per-group min plus repeated shared exclusion is equivalent to global min.'};
export function geometryChunkSource(index){if(!Number.isInteger(index)||index<0||index>=7)throw Error('invalid geometry group');let geometry=GEOMETRY_WGSL;
 if(index<6){const specialized='fn storey(h0:GeoHit,p:vec3<f32>,s:u32)->GeoHit{'+GEOMETRY_PARTITION_PROOF.common+parts[index]+'return h;}';geometry=geometry.slice(0,original.start)+specialized+geometry.slice(original.end);const q=fn(geometry,'querySettlement');const cut=q.body.indexOf('h=roof(');if(cut<0)throw Error('missing roof boundary');const replacement='fn queryChunk(p:vec3<f32>,maximum:f32)->GeoHit{'+q.body.slice(0,cut)+'return h;}';geometry=geometry.slice(0,q.start)+replacement+geometry.slice(q.end);}
 else{const q=fn(geometry,'querySettlement');const start=q.body.indexOf('let storeyCount='),end=q.body.indexOf('h=roof(');if(start<0||end<0)throw Error('missing floor loop boundary');const replacement='fn queryChunk(p:vec3<f32>,maximum:f32)->GeoHit{'+q.body.slice(0,start)+q.body.slice(end)+'}';geometry=geometry.slice(0,q.start)+replacement+geometry.slice(q.end);}
 return geometry;
}
export function geometryStageWGSL(index){return receiverWGSL(geometryChunkSource(index))+'\n'+WAVEFRONT_WGSL+String.raw`
@compute @workgroup_size(64) fn queryGeometryChunk(@builtin(global_invocation_id) gid:vec3<u32>){
 let id=gid.x;if(id>=1024u){return;}let c=contexts[id];if(c.counts.y==0u){return;}
 fieldCompetition=true;fieldExcludedCount=c.counts.x;for(var j=0u;j<fieldExcludedCount;j++){fieldExcluded[j]=c.excluded[j];}
 let h=queryChunk(c.point.xyz,220.);fieldCompetition=false;
 geometryCandidates[${index}u*1024u+id]=h;
}
`;}
