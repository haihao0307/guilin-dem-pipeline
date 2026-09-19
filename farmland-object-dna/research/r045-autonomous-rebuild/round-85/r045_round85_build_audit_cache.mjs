import fs from 'node:fs';
const q=JSON.parse(fs.readFileSync(new URL('./r045_round85_qa_result.json',import.meta.url),'utf8'));
if(!q.audit?.plan||!q.audit?.rivers||!q.audit?.before||!q.audit?.after)throw new Error('R85 audit inputs missing');
const A=q.audit,m=q.metrics||{},before=A.before,after=A.after,nz=before.length-1,nx=before[0].length-1;
// Use the authoritative 6 m QA raster already produced by the numeric gate.
// Recomputing a separate dense raster through the full predecessor chain adds
// runtime but no evidence and can make browser evidence arrive after the source
// has moved. The fixed view therefore renders the exact audited node field.
let mn=Infinity,mx=-Infinity,maxDense=0,denseChanged=0;for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){mn=Math.min(mn,before[j][i],after[j][i]);mx=Math.max(mx,before[j][i],after[j][i]);const d=Math.abs(after[j][i]-before[j][i]);maxDense=Math.max(maxDense,d);if(d>.0005)denseChanged++}
const data={version:q.version,qaContract:q.qaContract,sourceSha:q.sourceSha,terrain:{x0:A.x0,x1:A.x1,z0:A.z0,z1:A.z1,nx,nz,before,after,sharedMin:mn,sharedMax:mx},rivers:A.rivers,planSpec:A.planSpec,plan:A.plan,exactChanges:m.changedPoints||[],nodeChanges:m.nodeChangedPoints||[],state:{qaPassed:q.passed===true,candidates:m.candidates||0,sampleCount:m.sampleCount||0,changedQueries:m.changedQueries||0,nodeChanged:m.nodeChanged||0,benchPairs:m.benchPairCount||0,benchBefore:m.benchBeforeMean||0,benchAfter:m.benchAfterMean||0,benchRatio:m.benchGradientRatio||0,balanceRatio:m.balanceRatio||0,maxChange:m.maxChange||0,projected:m.projected||0,maxInc:m.maxInc||0,maxDense,denseChanged,visualAcceptance:false},generatedAt:new Date().toISOString(),source:'R045.85 fixed-view diagnostic: accepted R045.84 versus query-safe broad-bench plateau redistribution. A/B render the exact authoritative 6 m numeric-audit raster with one shared height range and identical hillshade. Orange marks actual physical query changes. Higher display density is deliberately not treated as additional terrain evidence.'};
fs.writeFileSync(new URL('./r045_round85_audit_cache.mjs',import.meta.url),`export const AUDIT=${JSON.stringify(data)};\n`);
console.log(JSON.stringify(data.state,null,2));
