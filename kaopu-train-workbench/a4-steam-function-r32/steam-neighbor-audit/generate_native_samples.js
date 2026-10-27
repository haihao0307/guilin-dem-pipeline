'use strict';
const fs=require('fs'),crypto=require('crypto'),path=require('path'),source=path.join(__dirname,'steam-path.js'),C=require(source).create();let seed=73019;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const samples=[];
for(const beta of [.11,.126,.16])for(const p of C.parts)for(let j=0;j<9;j++){const xyz=p.aabb_min.map((v,k)=>v+rnd()*(p.aabb_max[k]-v));samples.push({id:p.id,beta,xyz,value:C.worldScalar(p.id,xyz,.4,{mode:'candidate',beta})});}
console.log(JSON.stringify({sourceHash:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),parts:C.parts.map(p=>({id:p.id,ast:p.ast,diagnosticWitnesses:p.diagnosticWitnesses||[]})),hostCuts:C.hostCuts,domains:C.domains,samples}));
