const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const {geometryStats,sourceGates}=require('./surface-guards.cjs'),baseline=require('../face-relation-r45/candidate.json'),input=require('./direct-input.json');
const OUT='joey-local-head-control-r50-differential';fs.mkdirSync(OUT,{recursive:true});
const compact=r=>{const x={...r};delete x.area;delete x.delta;return x;};const hash=p=>crypto.createHash('sha256').update(Buffer.from(new Float32Array(p).buffer)).digest('hex');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1080}});page.setDefaultTimeout(600000);try{
await page.goto('http://127.0.0.1:8765/native/kaopu-unified-human-workbench/');await page.evaluate(()=>fullCommonWorkbench.load());await page.waitForFunction(()=>fullCommonWorkbench.diagnostics().ready&&!fullCommonWorkbench.diagnostics().busy&&fullCommonWorkbench.motion());await page.evaluate(()=>fullCommonWorkbench.motion().setMode('shape'));const original=await page.evaluate(()=>fullCommonWorkbench.archive());const neutral=structuredClone(baseline);neutral.state.owners.expression='anny';neutral.state.anny.facialActions={};await page.evaluate(a=>fullCommonWorkbench.restore(a),neutral);assert.deepEqual(await page.evaluate(()=>fullCommonWorkbench.archive()),neutral);const beforeCommon=await page.evaluate(()=>Array.from(fullCommonWorkbench.positions()));assert.equal(hash(beforeCommon),'abc06dcb488cdff4a63213190b05a43785828d345ef880537c6c328f1709e039');
await page.addScriptTag({content:fs.readFileSync(require.resolve('./differential-guards.cjs'),'utf8')});
const data=await page.evaluate(({probes,amplitude})=>{
  const m=fullCommonWorkbench.motion().controller.model,g=m.gnm,D=170,N=g.numVertices,scale=m.headScale;
  if(g.meta.identityNames.length!==253||g.meta.identityNames.slice(0,D).some((n,i)=>n!==`head_${String(i).padStart(3,'0')}`))throw Error('Unexpected native head axes');
  const skin=Array.from(g.componentId).map((c,i)=>c===0?i:-1).filter(i=>i>=0),K=skin.length,map=new Int32Array(N).fill(-1);skin.forEach((v,i)=>map[v]=i);
  const adj=Array.from({length:K},()=>new Set());for(let f=0;f<g.triangles.length;f+=3){const v=[g.triangles[f],g.triangles[f+1],g.triangles[f+2]].map(i=>map[i]);if(v.some(i=>i<0))continue;for(let a=0;a<3;a++){adj[v[a]].add(v[(a+1)%3]);adj[v[a]].add(v[(a+2)%3]);}}
  const neighbors=adj.map(s=>Array.from(s));if(neighbors.some(s=>!s.length))throw Error('Unconnected source skin vertex');
  const P=skin.map(v=>Array.from(g._bind.slice(v*3,v*3+3))),region=skin.map(v=>g.regionId[v]),area=new Float64Array(K);
  for(let f=0;f<g.triangles.length;f+=3){const v=[g.triangles[f],g.triangles[f+1],g.triangles[f+2]].map(i=>map[i]);if(v.some(i=>i<0))continue;const a=P[v[1]].map((x,j)=>x-P[v[0]][j]),b=P[v[2]].map((x,j)=>x-P[v[0]][j]),tri=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])*scale*scale/2;for(const i of v)area[i]+=tri/3;}const totalArea=area.reduce((a,b)=>a+b,0);if(!(totalArea>0)||Array.from(area).some(a=>!(a>0)))throw Error('Uncovered source skin surface');
  // Distance is measured along the original source surface, not in photo pixels.
  function distances(seeds){const out=new Float64Array(K).fill(Infinity),used=new Uint8Array(K);for(const i of seeds)out[i]=0;for(let k=0;k<K;k++){let at=-1,best=Infinity;for(let i=0;i<K;i++)if(!used[i]&&out[i]<best){best=out[i];at=i;}if(at<0)break;used[at]=1;for(const j of neighbors[at]){const q=best+Math.hypot(...P[at].map((x,a)=>x-P[j][a]));if(q<out[j])out[j]=q;}}return out;}
  const protect=region.map((r,i)=>![11,12,15,16,19].includes(r)||P[i][1]>.225||P[i][2]<.065),chin=region.map((r,i)=>r===19?i:-1).filter(i=>i>=0);
  const dc=distances(chin),dp=distances(protect.map((v,i)=>v?i:-1).filter(i=>i>=0)),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
  const mask=P.map((p,i)=>protect[i]?0:Math.max(0,1-(dc[i]/.065)**2)**2*smooth(dp[i]/.015));
  for(let i=0;i<K;i++)if(mask[i]===0)protect[i]=true;
  if(Math.max(...mask)<.9)throw Error('Chin target unexpectedly suppressed');
  const J=new Float64Array(K*3*D);for(let i=0;i<K;i++)for(let a=0;a<3;a++)for(let d=0;d<D;d++)J[(i*3+a)*D+d]=g.identityBasis[d*N*3+skin[i]*3+a]*g.identityScales[d]*scale;

 const before=P.flatMap(p=>p.map(x=>x*scale)),faces=[];for(let i=0;i<g.triangles.length;i+=3){const f=[g.triangles[i],g.triangles[i+1],g.triangles[i+2]].map(x=>map[x]);if(f.every(x=>x>=0))faces.push(...f);}
 const groups=region.map(r=>r>=0&&r<20?r:20),rows=[];
 for(const probe of probes){const c=probe.coefficients.map(x=>x*amplitude),after=before.slice();for(let i=0;i<K*3;i++){let d=0;for(let k=0;k<D;k++)d+=J[i*D+k]*c[k];after[i]+=d;}
  let coreArea=0,positiveArea=0,residual=0,norm=0,dot=0;for(let i=0;i<K;i++)if(mask[i]>0){const target=[0,0,.001*mask[i]*amplitude],delta=[0,1,2].map(a=>after[3*i+a]-before[3*i+a]);residual+=area[i]*delta.reduce((s,x,a)=>s+(x-target[a])**2,0);norm+=area[i]*target.reduce((s,x)=>s+x*x,0);dot+=area[i]*delta.reduce((s,x,a)=>s+x*target[a],0);if(mask[i]>.5){coreArea+=area[i];if(delta[2]>0)positiveArea+=area[i];}}
  rows.push({id:probe.id,after,targetGain:dot/norm,targetRelativeError:Math.sqrt(residual/norm),corePositiveAreaFraction:positiveArea/coreArea});
 }
 window.__sourceControlGuard={map:Array.from(map),protect,region,mask};
  const criticalIds=[0,1,2,3,4,5,6,7,8,9,10,13,14,17,18],critical=i=>criticalIds.includes(groups[i]);
 const normalGram=new Float64Array(D*D),edgeGram=new Float64Array(D*D),triRows=[],edgeRows=[],seen=new Set();let nt=0,ne=0,skippedTriangles=0,skippedEdges=0;
 const candidate=rows.find(r=>r.id==='forward-setting5').after;
 const cross=(p,ids)=>{const[a,b,c]=ids,u=[0,1,2].map(k=>p[3*b+k]-p[3*a+k]),v=[0,1,2].map(k=>p[3*c+k]-p[3*a+k]);return[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]};
 function add(A,rr){for(let d=0;d<D;d++)for(let e=0;e<=d;e++){let v=0;for(const row of rr)v+=row[d]*row[e];A[d*D+e]+=v;}}
 for(let f=0;f<faces.length;f+=3){const ids=faces.slice(f,f+3);if(ids.some(i=>protect[i])){const nr=normalRows(before,J,ids,D);if(nr){add(normalGram,nr.rows);nt++;const a=cross(before,ids),b=cross(candidate,ids),angle=Math.acos(Math.max(-1,Math.min(1,a.reduce((s,x,k)=>s+x*b[k],0)/(Math.hypot(...a)*Math.hypot(...b)))));triRows.push({id:f/3,ids:ids.map(i=>skin[i]),critical:ids.some(critical),value:angle,rows:nr.rows.map(r=>Array.from(r)),centroid:ids.reduce((p,i)=>p.map((v,k)=>v+P[i][k]/3),[0,0,0])});}else skippedTriangles++;}
 for(let k=0;k<3;k++){let a=ids[k],b=ids[(k+1)%3];if(a>b)[a,b]=[b,a];const key=a+','+b;if(seen.has(key)||(!protect[a]&&!protect[b]))continue;seen.add(key);const er=edgeRow(before,J,a,b,D);if(er){add(edgeGram,[er.row]);ne++;const l=Math.hypot(...[0,1,2].map(k=>candidate[3*b+k]-candidate[3*a+k]));edgeRows.push({ids:[skin[a],skin[b]],critical:critical(a)||critical(b),value:Math.abs(l/er.length-1),rows:[Array.from(er.row)],lengthM:er.length});}else skippedEdges++;}}
 function sym(A,count){if(!count)throw Error('Missing differential coverage');for(let d=0;d<D;d++)for(let e=0;e<=d;e++){A[d*D+e]/=count;A[e*D+d]=A[d*D+e];}return Array.from(A)}
 const worstVertices=skin.map((v,i)=>({id:v,i,group:groups[i],guard:protect[i],d:Math.hypot(...[0,1,2].map(k=>candidate[3*i+k]-before[3*i+k]))})).filter(r=>r.guard).sort((a,b)=>b.d-a.d).slice(0,128).map(r=>({...r,sourcePosition:P[r.i],rows:[0,1,2].map(k=>Array.from(J.slice((3*r.i+k)*D,(3*r.i+k+1)*D)))}));
 return{schema:'source-differential-guard-response/1',axisCount:D,normalCount:nt,edgeCount:ne,skippedTriangles,skippedEdges,normalGram:sym(normalGram,nt),edgeGram:sym(edgeGram,ne),normalWeighting:'Uniform valid protected triangles, not area-weighted. Derivative of unit normal in radians.',edgeWeighting:'Uniform protected edges, relative length derivative.',baselineThresholds:{crossLength:1e-12,edgeLength:1e-9},worstTriangles:triRows.sort((a,b)=>b.value-a.value).slice(0,192),worstEdges:edgeRows.sort((a,b)=>b.value-a.value).slice(0,192),worstVertices,sourceProbe:'forward-setting5 at four nominal units; private observations absent',boundary:'First-order constraints and response statistics only; candidate still requires all actual finite-deformation gates. Worst rows are an active-set seed, not an exhaustive guarantee.'};

},{probes:input.rows,amplitude:input.amplitude});
await page.evaluate(a=>fullCommonWorkbench.restore(a),original);assert.deepEqual(await page.evaluate(()=>fullCommonWorkbench.archive()),original);data.archiveRestored=true;fs.writeFileSync(OUT+'/differential-summary.json',JSON.stringify(data));console.log('Differential coverage',data.normalCount,data.edgeCount);
}catch(e){fs.writeFileSync(OUT+'/failure.json',JSON.stringify({error:e.stack}));throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
