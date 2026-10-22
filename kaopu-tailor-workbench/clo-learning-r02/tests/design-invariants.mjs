import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {changeSkirtDesign, OPERATION_VERSION, LIMITS, DEFAULTS} from '../src/design-operation.mjs';

// Independent material-space checks. No solver run, viewer mutation, or use of
// production measurePaper() as an oracle. Dimensions and areas come from paper.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceFile='upstream/kaopu-tailor-workbench/presets/r04/assets/papers/S03.json.gz';
const expectedDecodedSHA='3e54c6322a46ea7232644f341a4f5ea300d0b20a24a1d45765138b707d753baa';
const hash=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b,message)=>assert.deepEqual(canonical(a),canonical(b),message);
const near=(a,b,message,tolerance=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${message}: actual ${a}; expected ${b}; tolerance ${tolerance}`);
const frozen=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
const panel=(paper,id)=>paper.panels.find(p=>p.id===id);
const edge=(p,id)=>p.edges.find(e=>e.index===id);
const endpointGeometry=p=>({verticesMm:p.verticesMm,placement:p.placement,boundary:p.boundary,edges:p.edges.map(e=>({index:e.index,endpoints:e.endpoints,kind:e.kind,controlPointsMm:e.controlPointsMm??[],arc:e.arc??null}))});
function sampledArea(p){
  const points=p.boundary.flatMap(id=>edge(p,id).sampledPointsMm.slice(0,-1));
  return points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
}
function dimensions(paper){
  const front=panel(paper,'skirt_front'),back=panel(paper,'skirt_back');
  const left=edge(back,18),right=edge(back,19);
  const apexId=left.endpoints.find(i=>right.endpoints.includes(i));
  const roots=[left,right].map(e=>e.endpoints.find(i=>i!==apexId));
  const rootPoints=roots.map(i=>back.verticesMm[i]);
  near(rootPoints[0][1],rootPoints[1][1],'opening roots share one hem');
  return {
    frontHeightMm:Math.max(...front.verticesMm.map(v=>v[1]))-Math.min(...front.verticesMm.map(v=>v[1])),
    backHeightMm:Math.max(...back.verticesMm.map(v=>v[1]))-Math.min(...back.verticesMm.map(v=>v[1])),
    openingDepthMm:back.verticesMm[apexId][1]-rootPoints[0][1],
    openingWidthMm:Math.abs(rootPoints[0][0]-rootPoints[1][0]),
    apexId,apexY:back.verticesMm[apexId][1],
    areas:Object.fromEntries(paper.panels.map(p=>[p.id,Math.abs(sampledArea(p))])),
    totalAreaMm2:paper.panels.reduce((s,p)=>s+Math.abs(sampledArea(p)),0)
  };
}
const seamIdentity=s=>({id:s.id,a:s.a,b:s.b,isDart:s.isDart,stageId:s.stageId,sourceStitchIndex:s.sourceStitchIndex,direction:s.direction,rightWrong:s.rightWrong});
const gatherIdentity=g=>g&&Object.fromEntries(Object.entries(g).filter(([k])=>!/^projectedLength/.test(k)));
const report={schema:'kaopu-r02-independent-design-invariants/1',taskId:'CLO-LEARNING-PILOT-R02-20261022',startedAt:new Date().toISOString(),passed:false,method:'Source-pinned, immutable paper; independent dimensions, polygon area, protected geometry and all source seam relationships. No physical solver or browser execution.',cases:[],checks:[],invalidRequests:[],limits:['2D correctness does not imply static fit, self-contact response, or production validity.','Boundary samples certify the supplied sampled geometry, not every unsampled analytic curve.']};
const check=async(id,fn)=>{try{const details=await fn();report.checks.push({id,passed:true,...(details??{})});}catch(error){report.checks.push({id,passed:false,error:String(error.message??error)});}};
const results=new Map();
let base,baseText,baseDimensions,zero,zeroDimensions;
try{
  const packed=await fs.readFile(path.join(root,sourceFile)),decoded=gunzipSync(packed);
  assert.equal(hash(decoded),expectedDecodedSHA,'fixture must be the frozen S03 source, not a regenerated substitute');
  baseText=decoded.toString();base=frozen(JSON.parse(baseText));
  report.source={file:sourceFile,decodedSHA256:hash(decoded),packedSHA256:hash(packed),recipeHash:base.recipeHash,geometryHash:base.geometryHash};
  report.operationSourceSHA256=hash(await fs.readFile(path.join(root,'src/design-operation.mjs')));
  report.operationVersion=OPERATION_VERSION;report.defaults=DEFAULTS;report.limits=LIMITS;
  assert.equal(OPERATION_VERSION,'kaopu-s03-length-and-opening/2');
  assert.equal(base.panels.length,4);assert.equal(base.seams.length,20);
  assert.equal(base.seams.filter(s=>s.isDart).length,6);
  for(const id of [18,19])assert.ok(!base.seams.some(s=>[s.a,s.b].some(r=>r.panelId==='skirt_back'&&r.edge===id)),'opening sides are free cut edges, not seams');
  baseDimensions=dimensions(base);
  near(baseDimensions.openingWidthMm,20,'source opening width');
  near(baseDimensions.openingDepthMm,86.10410305727925,'source opening depth');
  zero=await changeSkirtDesign(base,0,0,{requestId:1,expectedRevision:0});
  zeroDimensions=dimensions(zero.paper);
  const front=panel(base,'skirt_front'),back=panel(base,'skirt_back');
  const bottomWidth=p=>{const y=Math.min(...p.verticesMm.map(v=>v[1]));const xs=p.verticesMm.filter(v=>v[1]===y).map(v=>v[0]);return Math.max(...xs)-Math.min(...xs);};
  const frontWidth=bottomWidth(front),backWidth=bottomWidth(back);
  report.independentAreaLaw={frontWidthMm:frontWidth,backWidthMm:backWidth,openingWidthMm:20,expression:'area(H,S) - area(0,0) = (frontWidth + backWidth) * H - openingWidth / 2 * S; mm²',reference:'Same reconstructed zero-edit paper, avoiding differences between source and bridge curve sampling.'};
  const cases=[];
  for(const h of [-40,0,100])for(const s of [-40,0,80])cases.push([h,s]);
  if(!cases.some(([h,s])=>h===DEFAULTS.deltaMm&&s===DEFAULTS.slitDeltaMm))cases.push([DEFAULTS.deltaMm,DEFAULTS.slitDeltaMm]);
  let request=10;
  for(const [h,s] of cases){
    const row={deltaMm:h,slitDeltaMm:s,passed:false};
    try{
      const requestId=request++,revision=7;
      const changed=await changeSkirtDesign(base,h,s,{requestId,expectedRevision:revision}),out=changed.paper,d=dimensions(out);
      results.set(`${h},${s}`,changed);
      same(out.panels.map(p=>p.id),base.panels.map(p=>p.id),'source panel evaluation order');
      same(out.seams.map(seamIdentity),base.seams.map(seamIdentity),'all 20 source seam identities, directions and order');
      same(out.bodyCm,base.bodyCm,'body measurements unchanged');same(out.design,base.design,'not a silent high-level parameter regeneration');
      near(d.frontHeightMm,baseDimensions.frontHeightMm+h,'front dimension');near(d.backHeightMm,baseDimensions.backHeightMm+h,'back dimension');
      near(d.openingDepthMm,baseDimensions.openingDepthMm+s,'independent opening depth');near(d.openingWidthMm,20,'opening width');
      near(d.areas.skirt_front-zeroDimensions.areas.skirt_front,frontWidth*h,'front material area law',1e-5);
      near(d.areas.skirt_back-zeroDimensions.areas.skirt_back,backWidth*h-10*s,'back material area law',1e-5);
      near(d.totalAreaMm2-zeroDimensions.totalAreaMm2,(frontWidth+backWidth)*h-10*s,'whole material area law',1e-5);
      for(const original of base.panels){
        const edited=panel(out,original.id);const originalHem=Math.min(...original.verticesMm.map(v=>v[1]));
        assert.equal(edited.verticesMm.length,original.verticesMm.length,'no source material point deleted');
        same(edited.placement,original.placement,'original placements');same(edited.boundary,original.boundary,'closed boundary order');
        for(let i=0;i<original.verticesMm.length;i++){
          const before=original.verticesMm[i],after=edited.verticesMm[i];
          near(after[0],before[0],'all material widths fixed',0);
          if(original.id==='skirt_back'&&i===baseDimensions.apexId){near(after[1],originalHem-h+d.openingDepthMm,'tip position from dimensions');}
          else if(/^skirt_/.test(original.id)&&before[1]===originalHem){near(after[1],originalHem-h,'common hem position');}
          else same(after,before,`${original.id} protected waist/dart/hip point ${i}`);
        }
        same(edited.edges.map(e=>({index:e.index,endpoints:e.endpoints,kind:e.kind,controlPointsMm:e.controlPointsMm??[],arc:e.arc??null})),original.edges.map(e=>({index:e.index,endpoints:e.endpoints,kind:e.kind,controlPointsMm:e.controlPointsMm??[],arc:e.arc??null})),'curve control geometry and source references');
        near(edited.signedAreaMm2,sampledArea(edited),'independently recomputed cached area',1e-7);
        assert.equal(edited.selfIntersectionDiagnostic.crossings.length,0,'no sampled panel crossings');
        if(/^wb_/.test(original.id))same(endpointGeometry(edited),endpointGeometry(original),'whole waistband unchanged');
      }
      for(let i=0;i<base.seams.length;i++){
        const original=base.seams[i],edited=out.seams[i],lengthChange=['s6','s9'].includes(original.id)?h:0;
        near(edited.lengthAMm-original.lengthAMm,lengthChange,'source seam A rest length');near(edited.lengthBMm-original.lengthBMm,lengthChange,'source seam B rest length');
        same(gatherIdentity(edited.gathering),gatherIdentity(original.gathering),'source gathering coefficients and orientations');
        if(edited.gathering){near(edited.gathering.projectedLengthAMm,edited.lengthAMm/edited.gathering.ruffleCoefficientA,'projected seam A');near(edited.gathering.projectedLengthBMm,edited.lengthBMm/edited.gathering.ruffleCoefficientB,'projected seam B');}
      }
      for(const id of [18,19])assert.ok(!out.seams.some(v=>[v.a,v.b].some(ref=>ref.panelId==='skirt_back'&&ref.edge===id)),'free opening is not sewn shut');
      const retained=base.interfaces.filter(i=>/^wb_/.test(i.component)&&i.name==='top');
      same(out.interfaces,retained,'only the two unchanged waistband-top interfaces retained');assert.equal(out.interfaces.length,2);
      assert.equal(out.validation.analytic2DPass,true);assert.equal(out.validation.physicalFitStatus,'not-run');assert.equal(out.validation.originalRulesRechecked,false);assert.equal(out.officialOracleCm,null);assert.equal(out.source.continuationEdits.requiresFreshDrape,true);assert.equal(out.source.continuationEdits.originalBodyModified,false);
      assert.equal(out.source.continuationEdits.revision,revision+1);
      const op=changed.operation;assert.equal(op.deltaMm,h);assert.equal(op.slitDeltaMm,s);assert.equal(op.requestId,requestId);assert.equal(op.expectedRevision,revision);assert.equal(op.schema,OPERATION_VERSION);
      assert.equal(changed.requestHash,hash(JSON.stringify(canonical(op))),'operation envelope hash includes both dimensions and request identity');
      assert.equal(changed.protectedGeometryPassed,true);assert.equal(changed.independentDimensionsPassed,true);
      near(changed.measurements.after.frontLengthMm,d.frontHeightMm,'returned front dimension independently checked');near(changed.measurements.after.slitDepthMm,d.openingDepthMm,'returned opening dimension independently checked');
      same(base,JSON.parse(baseText),'frozen original remains unmodified');
      Object.assign(row,{passed:true,frontLengthMm:d.frontHeightMm,backLengthMm:d.backHeightMm,openingDepthMm:d.openingDepthMm,openingMouthWidthMm:d.openingWidthMm,materialAreaDeltaMm2:d.totalAreaMm2-zeroDimensions.totalAreaMm2,hipClearanceMm:Math.min(back.verticesMm[1][1],back.verticesMm[16][1])-d.apexY,sourceSeamCount:out.seams.length,physicalFitStatus:out.validation.physicalFitStatus,operationSHA256:changed.requestHash});
    }catch(error){row.error=String(error.stack??error);}
    report.cases.push(row);
  }
  await check('zero-edit-retains-all-original-control-geometry',()=>{for(const original of base.panels)same(endpointGeometry(panel(zero.paper,original.id)),endpointGeometry(original));});
  await check('opening-only-edit-does-not-alter-other-panels-or-seams',()=>{
    const a=results.get('0,-40').paper,b=results.get('0,80').paper;
    for(const id of ['skirt_front','wb_front','wb_back'])same(endpointGeometry(panel(a,id)),endpointGeometry(panel(b,id)));
    for(let i=0;i<panel(a,'skirt_back').verticesMm.length;i++)if(i!==baseDimensions.apexId)same(panel(a,'skirt_back').verticesMm[i],panel(b,'skirt_back').verticesMm[i]);
    for(let i=0;i<a.seams.length;i++){near(a.seams[i].lengthAMm,b.seams[i].lengthAMm,'opening cannot alter a stitched material edge');near(a.seams[i].lengthBMm,b.seams[i].lengthBMm,'opening cannot alter a stitched material edge');}
  });
  await check('parameter-envelope-and-material-geometry-distinguish-both-axes',async()=>{
    const a=await changeSkirtDesign(base,0,0,{requestId:500,expectedRevision:2});
    const h=await changeSkirtDesign(base,10,0,{requestId:500,expectedRevision:2});
    const s=await changeSkirtDesign(base,0,10,{requestId:500,expectedRevision:2});
    const h2=await changeSkirtDesign(base,10,0,{requestId:501,expectedRevision:2});
    assert.equal(new Set([a.requestHash,h.requestHash,s.requestHash,h2.requestHash]).size,4);
    assert.equal(new Set([a.paper.geometryHash,h.paper.geometryHash,s.paper.geometryHash]).size,3);
    same(h.paper.geometryHash,h2.paper.geometryHash,'request identity does not alter cutting geometry');
  });
  await check('stale-physical-pass-and-oracle-not-inherited',async()=>{
    const old=structuredClone(base);old.validation={...old.validation,physicalFitStatus:'passed',garmentFitAccepted:true};old.officialOracleCm={obsoletePhysicalPass:true};
    const fresh=await changeSkirtDesign(frozen(old),0,10);
    assert.equal(fresh.paper.validation.physicalFitStatus,'not-run');assert.notEqual(fresh.paper.validation.garmentFitAccepted,true);assert.equal(fresh.paper.officialOracleCm,null);assert.equal(fresh.paper.source.continuationEdits.requiresFreshDrape,true);
  });
  const bad=[
    ['hem-under-range',-50,0],['hem-over-range',110,0],['opening-under-range',0,-50],['opening-over-range',0,90],['hem-off-grid',5,0],['opening-off-grid',0,5],['hem-NaN',NaN,0],['opening-NaN',0,NaN],['hem-infinity',Infinity,0],['opening-infinity',0,-Infinity],['hem-string','20',0],['opening-string',0,'20'],['hem-null',null,0],['opening-null',0,null],['hem-boolean',false,0],['opening-boolean',0,true],
    ['request-zero',0,0,{requestId:0}],['request-fraction',0,0,{requestId:1.5}],['request-unsafe',0,0,{requestId:Number.MAX_SAFE_INTEGER+1}],['revision-negative',0,0,{expectedRevision:-1}],['revision-fraction',0,0,{expectedRevision:.5}],['revision-overflow',0,0,{expectedRevision:Number.MAX_SAFE_INTEGER}],
    ['wrong-schema',0,0,{},b=>({...b,schema:'wrong'})],['wrong-units',0,0,{},b=>({...b,units:'cm'})],['wrong-recipe',0,0,{},b=>({...b,recipeHash:'wrong'})],['wrong-geometry',0,0,{},b=>({...b,geometryHash:'wrong'})],
    ['incremental-derived-paper-is-not-the-frozen-source',0,10,{},()=>results.get('100,80').paper],
    ['opening-bound-to-a-seam',0,10,{},b=>{const v=structuredClone(b);v.seams[0].a={panelId:'skirt_back',edge:18,reverse:false};return v;}]
  ];
  for(const [id,h,s,options={},transform=b=>b] of bad){
    const candidate=frozen(transform(base));const before=JSON.stringify(candidate);let rejected=false,error;
    try{await changeSkirtDesign(candidate,h,s,options);}catch(e){rejected=true;error=String(e.message??e);}
    const unchanged=JSON.stringify(candidate)===before;report.invalidRequests.push({id,rejected,sourceUnchanged:unchanged,error});
  }
  await check('invalid-requests-fail-without-input-mutation',()=>assert.ok(report.invalidRequests.every(r=>r.rejected&&r.sourceUnchanged)));
  await check('source-still-identical-after-all-requests',()=>same(base,JSON.parse(baseText)));
}catch(error){report.fatal=String(error.stack??error);}
report.completedAt=new Date().toISOString();
report.passed=!report.fatal&&report.cases.length>=9&&report.cases.every(r=>r.passed)&&report.checks.length>=6&&report.checks.every(r=>r.passed)&&report.invalidRequests.every(r=>r.rejected&&r.sourceUnchanged);
const output=path.join(root,'evidence/DESIGN_INVARIANTS.json');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,checks:report.checks.length,rejectedInvalidRequests:report.invalidRequests.filter(r=>r.rejected).length,report:output,failures:[...report.cases.filter(r=>!r.passed),...report.checks.filter(r=>!r.passed),...report.invalidRequests.filter(r=>!r.rejected||!r.sourceUnchanged)],fatal:report.fatal},null,2));
if(!report.passed)process.exitCode=1;
