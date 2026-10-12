import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{growthDirection}from'../src/GroomTopology.js';
const configs=[{style:'textured-fringe',partMM:-7,partOpen:8,flow:10},{style:'side-flow',partMM:-24,partOpen:28,flow:46},{style:'curtain-layer',partMM:0,partOpen:44,flow:60}];
const report={success:false,checks:[]};function check(name,ok){report.checks.push({name,pass:ok});assert(ok,name)}
try{
for(const config of configs){const style=config.style,a={...config,crownCover:0},b={...config,crownCover:100};
 for(const root of[[-.008,.397,.005],[-.030,.390,-.005],[.020,.391,.012],[.035,.375,-.038]])check(style+' root field not translated '+root,JSON.stringify(growthDirection(root,root,a))===JSON.stringify(growthDirection(root,root,b)));
 const rear=[.005,.375,-.045],point=[.012,.377,-.030];check(style+' posterior roots retain original descending field',JSON.stringify(growthDirection(point,rear,a))===JSON.stringify(growthDirection(point,rear,b)));
 const root=[-.007,.395,-.004],p=[.002,.397,.015];check(style+' existing mid-shaft actually responds to combing',JSON.stringify(growthDirection(p,root,a))!==JSON.stringify(growthDirection(p,root,b)));
}report.success=true;
}finally{const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../evidence');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/crown-root-field.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
