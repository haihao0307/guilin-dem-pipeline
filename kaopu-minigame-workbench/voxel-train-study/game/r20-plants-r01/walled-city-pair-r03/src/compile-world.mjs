import fs from'node:fs';import crypto from'node:crypto';import{compileHouseholdGrowth,HOUSEHOLD_GROWTH}from'./household-growth.mjs';
const base=JSON.parse(fs.readFileSync(new URL('./life-world.json',import.meta.url),'utf8'));
const floors=compileHouseholdGrowth(base.floors),events=[...base.events,...HOUSEHOLD_GROWTH];
const packed=[];for(const f of floors)packed.push(f.cx,f.base,f.width,f.height,f.front,f.rear,f.programmeCode,f.balcony,f.age,f.repair,f.phase,f.level,f.buildingId==='A'?1:2,f.growth?f.growth.bay+1:0,f.growth?.depthM??0,f.growth?.year??0);
const hash=crypto.createHash('sha256').update(JSON.stringify({buildings:base.buildings,floors,events})).digest('hex');
const world={...base.world,snapshotId:hash,baseSnapshotId:base.world.snapshotId,counts:{...base.world.counts,householdGrowthEvents:HOUSEHOLD_GROWTH.length}};
const code='export const WORLD_INFO='+JSON.stringify(world)+';\nexport const FLOORS='+JSON.stringify(floors)+';\nexport const BUILDINGS='+JSON.stringify(base.buildings)+';\nexport const EVENTS='+JSON.stringify(events)+';\nexport const HOUSEHOLD_GROWTH='+JSON.stringify(HOUSEHOLD_GROWTH)+';\nexport function loadWorld({growthEnabled=true}={}){const a=new Float32Array('+JSON.stringify(packed)+');if(!growthEnabled)for(let i=0;i<a.length;i+=16){a[i+13]=0;a[i+14]=0;a[i+15]=0;}return a;}\n';
fs.writeFileSync(new URL('../runtime/world-data.mjs',import.meta.url),code);console.log(JSON.stringify({snapshotId:hash,parameterBytes:packed.length*4,growth:HOUSEHOLD_GROWTH.map(e=>e.id)}));
