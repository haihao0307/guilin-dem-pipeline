import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {sha,materialHash} from './source-contract.mjs';
import {prepareAssembly} from './native/kaopu-tailor-workbench/r07/assembly.mjs';
const base=new URL('./',import.meta.url),dir=new URL('native/kaopu-tailor-workbench/catalogue/',base);
const read=async p=>JSON.parse(await fs.readFile(new URL(p,base),'utf8'));
const source=await fs.readFile(new URL('budget-probe.mjs',dir),'utf8');
if(!source.includes('/back|btorso|_b(?:_|$)/'))throw Error('Correction not applied');
const original=new URL('r042-before-probe.mjs',dir);
await fs.writeFile(original,source.replace('/back|btorso|_b(?:_|$)/','/back|btorso|_b_/'));
try {
 const before=await import(original),after=await import(new URL('budget-probe.mjs',dir));
 const catalogue=await read('assets/catalogue.json'),lock=await read('assets/identity.json');
 const bodyBytes=await fs.readFile(new URL('assets/common-body.json',base));
 if(await sha(bodyBytes)!==lock.bodyFileSHA256)throw Error('Original person collider changed');
 const body=JSON.parse(bodyBytes),checks=[],rows=[];
 const check=(name,passed,detail=null)=>{checks.push({name,passed:!!passed,detail});if(!passed)throw Error(name)};
 let coincidentBefore=0;
 for(const row of catalogue.rows){
  const bytes=await fs.readFile(new URL(row.nativePaper,base));check('Original paper bytes '+row.id,await sha(bytes)===row.compressedSHA256);
  const paper=JSON.parse(gunzipSync(bytes));let a,b,ea,eb;
  try{a=await before.meshProbe(structuredClone(paper))}catch(e){ea=e.message}
  try{b=await after.meshProbe(structuredClone(paper))}catch(e){eb=e.message}
  check('Same material capability '+row.id,!!a===!!b&&(!ea||ea===eb),{before:ea||'meshed',after:eb||'meshed'});
  if(!a){rows.push({id:row.id,materialRejected:eb});continue}
  const ma=await materialHash(a),mb=await materialHash(b);check('Unchanged UV triangles and stitches '+row.id,ma===mb);
  prepareAssembly(a,body);prepareAssembly(b,body);
  const pairs=[];
  for(const p of b.panels.filter(p=>/_b$/.test(p.id))){
   const front=b.panels.find(q=>q.id===p.id.replace(/_b$/,'_f'));if(!front)continue;
   const oa=a.panels.find(q=>q.id===p.id),of=a.panels.find(q=>q.id===front.id);
   const z=q=>q.uvMm.reduce((s,[u,v])=>s+q.placement.rigidBasis[6]*u+q.placement.rigidBasis[7]*v+q.placement.translationMm[2],0)/q.uvMm.length;
   const oldGap=z(of)-z(oa),gap=z(front)-z(p);if(Math.abs(oldGap)<.001)coincidentBefore++;
   check('Rear piece remains behind corresponding front '+row.id+' '+p.id,p.source.bodySide==='back'&&front.source.bodySide==='front'&&gap>1,{beforeGapMm:oldGap,afterGapMm:gap});
   pairs.push({back:p.id,front:front.id,beforeGapMm:oldGap,afterGapMm:gap});
  }
  rows.push({id:row.id,materialSHA256:mb,pairs});
 }
 check('Reproduced the old coincident-plane bug',coincidentBefore>0,{pairs:coincidentBefore});
 const result={schema:'kaopu-panel-side-regression@1',passed:true,checks,rows,originalCoincidentPairs:coincidentBefore,personGeometryModified:false,clothMaterialModified:false,solverMathModified:false,staticThresholdsModified:false};
 await fs.writeFile(new URL('SIDE_REGRESSION.json',base),JSON.stringify(result,null,2));
 console.log('SIDE_REGRESSION_PASS',checks.length,'old coincident pairs',coincidentBefore);
} finally {await fs.unlink(original).catch(()=>{})}
