import * as W from '../source/world.mjs';
const sample=W.landformSample();
const errors=[];
if(!(sample.rear>sample.upperSlope&&sample.upperSlope>sample.midSlope&&sample.midSlope>sample.footslope&&sample.footslope>=sample.plain-.8))errors.push('elevation_order');
for(const f of W.fields){const [x,z]=f.point(f.k,.5,.45);const y=W.ground(x,z);if(!Number.isFinite(y))errors.push('field_ground_'+f.id);}
for(const a of W.fieldActors){const f=W.fieldById[a.fieldId];const [x,z]=f.point(f.k,a.u,a.v);const d=W.ground(x,z)-f.bed;if(Math.abs(d)>1.5)errors.push('actor_ground_'+a.id+':'+d);}
console.log(JSON.stringify({version:W.VERSION,ok:!errors.length,errors,sample,zones:W.landformZones,actors:W.fieldActors.map(a=>a.id)},null,2));if(errors.length)process.exit(1);
