const fs=require('fs'),path=require('path'),crypto=require('crypto'),E=require('../r29/cover_geometry');
const dir=path.resolve(process.argv[2]);const pack=JSON.parse(fs.readFileSync(path.join(dir,'COVER_EXPORT.json'))),beta=JSON.parse(fs.readFileSync(path.join(dir,'BROADPHASE.json'))).installation.beta;
let seed=49831;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const rows=[];for(const p of pack.parts){const lo=p.aabb_min,hi=p.aabb_max,points=[lo.map((x,i)=>(x+hi[i])/2),...Array.from({length:8},(_,k)=>lo.map((v,i)=>k&(1<<i)?hi[i]:v)),...Array.from({length:32},()=>lo.map((v,i)=>v+(hi[i]-v)*rnd()))];for(const point of points)rows.push({id:p.id,point,scalar:E.scalar(p.shape,point,{beta})});}
fs.writeFileSync(path.join(dir,'NATIVE_COVER_SCALAR_REFERENCE.json'),JSON.stringify(rows));
fs.writeFileSync(path.join(dir,'COVER_AST_INPUT_SHA256.json'),JSON.stringify(Object.fromEntries(['cover_geometry.js','middle_cover_export.js','COVER_EXPORT.json'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../r29',name))).digest('hex')])),null,2));
console.log(JSON.stringify({beta,coverParts:pack.parts.length,fieldSamples:rows.length}));
