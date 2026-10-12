import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
import{rootGap,rootEnvelopeDerivative,rootDetailGain,rootClumpGain}from'../src/RootProfile.js';
import{enforceTrim}from'../src/GroomTopology.js';
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../evidence'),report={success:false,checks:[]};
function check(name,value,detail){report.checks.push({name,pass:!!value,detail});console.log(value?'PASS':'FAIL',name,detail??'');assert(value,name);}
try{
 const d={volumeMM:30,rootBlendMM:8,crownCover:86,flow:10};
 for(const L of[.003,.006,.012,.030,.085,.140]){
  check('zero initial lift slope '+L,Math.abs(rootEnvelopeDerivative([0,.399,.005],L,d,0))<1e-12);
  for(let j=0;j<=64;j++)assert(Number.isFinite(rootEnvelopeDerivative([.03,.35,.01],L,d,L*j/64)));
 }
 check('3mm stubble cannot inherit a long-hair lift loop',Array.from({length:65},(_,j)=>rootEnvelopeDerivative([.04,.29,-.04],.003,d,.003*j/64)).every(x=>x===0));
 check('root clamp does not jump straight to 0.8mm',Math.abs(rootGap(0)-.00002)<1e-12&&rootGap(.000125)<.000022&&rootGap(.006)===.00055);
 check('short stubble has no long-hair oscillation',rootDetailGain(.003,d,.003)===0&&rootDetailGain(.008,d,.008)===0);
 check('first 8mm are not gathered into a distant bundle',rootClumpGain(.085,d,.004)===0&&rootClumpGain(.085,d,.008)===0&&rootClumpGain(.085,d,.040)>0);
 const root=[0,.294,-.055],points=[root.slice(),[.01,.277,-.055],[.03,.260,-.055],[.045,.243,-.055],[.065,.239,-.055]],anchor=JSON.stringify(points[0]);
 enforceTrim(root,points,d);
 check('real cut preserves the original anchor',JSON.stringify(points[0])===anchor);
 check('real cut stops at first nape crossing',Math.abs(points.at(-1)[1]-.261)<1e-10&&points.at(-1)[0]<.03,points);
 check('cut resampling leaves no flattened multi-point tail',points.slice(0,-1).every(p=>p[1]>.261)&&points.every(p=>p.every(Number.isFinite)));
 let segments=[];for(let j=1;j<points.length;j++)segments.push(Math.hypot(...points[j].map((x,k)=>x-points[j-1][k])));check('trimmed segments are nondegenerate',Math.min(...segments)>.001,segments);
 report.success=true;
}finally{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/root-profile.json',JSON.stringify(report,null,2));}
