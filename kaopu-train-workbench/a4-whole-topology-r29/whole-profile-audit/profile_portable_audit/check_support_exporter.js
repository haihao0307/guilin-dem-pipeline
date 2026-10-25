const fs=require('fs'),path=require('path'),E=require('../r29/frame-support-study/support_export');
const dir=path.resolve(process.argv[2]||path.join(__dirname,'final_beta0126'));
const parts=JSON.parse(fs.readFileSync(path.join(dir,'parts.json'))).filter(p=>p.id.startsWith('frame_support/'));
let seed=9273;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const rows=[];for(const p of parts){const lo=p.aabb_min,hi=p.aabb_max,points=[lo.map((x,i)=>(x+hi[i])/2),...Array.from({length:8},(_,k)=>lo.map((v,i)=>k&(1<<i)?hi[i]:v)),...Array.from({length:32},()=>lo.map((v,i)=>v+(hi[i]-v)*rnd()))];for(const point of points)rows.push({id:p.id,point,scalar:E.scalar(p.shape,point)});}
fs.writeFileSync(path.join(dir,'NATIVE_SUPPORT_SCALAR_REFERENCE.json'),JSON.stringify(rows));console.log(JSON.stringify({supportParts:parts.length,fieldSamples:rows.length}));
