import pathlib,json,hashlib,shutil
R=pathlib.Path(__file__).resolve().parents[3]
W=R/'kaopu-tailor-workbench';P=W/'presets/r04';D=W/'pattern-batch/r02/backend'
selection=[{'path':'kaopu-tailor-workbench/presets/r04/'+x['path'],'sha':x['sourceGitBlob']} for x in json.loads((D/'SOURCE_MANIFEST.json').read_text())['files']]
copied=[]
for row in selection:
    original=R/row['path'];rel=original.relative_to(P)
    if rel.parts[0] in ('native','correctives') or str(rel).replace('\\','/') in ('assets/common-body.json','assets/common-body.sdfd.gz','assets/body-sdf-grid.json','assets/identity.json') or len(rel.parts)==1 and original.suffix=='.mjs':
        data=original.read_bytes();actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        if actual!=row['sha']:raise ValueError('Source changed: '+str(rel))
        dest=D/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);copied.append({'path':rel.as_posix(),'sourceGitBlob':actual})
contract=D/'source-contract.mjs';ct=contract.read_text(encoding='utf8');ct=ct.replace('return sha(stable({panels:', 'return sha(stable({...(spec.elasticStays?{elasticStays:spec.elasticStays}:{}),panels:');contract.write_text(ct,encoding='utf8')
source=P/'native/kaopu-tailor-workbench/catalogue/native-adapter.mjs'
s=source.read_text(encoding='utf8')
s="import {addInternalReinforcement,scheduleInternalStages} from '../../../../reinforce.mjs';\n"+s
s="import {warmStartAllowances} from '../../../../warm-start.mjs';\nlet batchWarmStart=null;\n"+s
s="import {prepareFinishGuides,addFinishedEdges,initializeFinishPanels,contactSnapshot,applyFinishContact,measureFinish,installElasticStays,prepareFinishFixtures} from '../../../../finish.mjs';\n"+s
s="import {addInteriorReinforcement} from '../../../../inside-reinforce.mjs';\n"+s
s=s.replace('p.uvMm.length > 3e3','p.uvMm.length > 12e3').replace('p.triangles.length > 6e3','p.triangles.length > 24e3')
s=s.replace('lab = new GarmentLab2(spec, sdf,','scheduleInternalStages(spec);lab = new GarmentLab2(spec, sdf,')
s=s.replace('scheduleInternalStages(spec);lab = new GarmentLab2', 'prepareFinishFixtures(spec,sdf,body);scheduleInternalStages(spec);lab = new GarmentLab2')
s=s.replace("stage==='sides'&&!spec.source.radialAssembly43b?.enabled", "stage==='sides'&&!spec.source.radialAssembly43b?.enabled&&!spec.source.finishRevision?.strapless")
s=s.replace('lab.pipeline43=corrected43;','if(batchWarmStart)warmStartAllowances(lab,batchWarmStart);lab.pipeline43=corrected43;')
s=s.replace('if(batchWarmStart)warmStartAllowances(lab,batchWarmStart);', 'if(batchWarmStart)warmStartAllowances(lab,batchWarmStart);if(spec.source.finishRevision)initializeFinishPanels(lab);')
s=s.replace('lab.pipeline43=corrected43;', 'installElasticStays(lab);lab.pipeline43=corrected43;')
s=s.replace("else if(stage==='release'){\n     lab.releasePins();","else if(stage==='release'){\n     if(spec.source.finishRevision?.strapless){const closure=finalizeCloseSeams(lab);lab.elasticEnabled=true;lab.finishProof.elasticActivation={phase:'after sewing, before gravity',closure,preGravitySeamGapMm:lab.metrics().activeMaxGapMm};}lab.releasePins();")
s=s.replace("else if(stage==='release'){","else if(stage==='elastic-fit'){finalizeCloseSeams(lab);lab.releasePins();lab.setGravity(0);lab.elasticEnabled=true;lab.finishProof.elasticFitSeconds=2;}else if(stage==='release'){")
s=s.replace(' + 16;', ' + 256;')
s=s.replace('for (let sub3 = 0; sub3 < this.substeps; sub3++) {', 'for (let sub3 = 0; sub3 < this.substeps; sub3++) {const finishBefore=contactSnapshot(this);')
s=s.replace('const damping = Math.exp(-20 * h);', 'applyFinishContact(this,finishBefore,h);const damping = Math.exp(-20 * h);')
s=s.replace("}else lab.step();","}else lab.step();")
s=s.replace("else {if(stage==='release'&&lab.pipeline43)lab.setGravity((stageFrame+1)/120);lab.step();}","else {if(stage==='release'&&lab.pipeline43)lab.setGravity((stageFrame+1)/120);lab.step();if(stage==='wear'&&stageFrame%60===59)(lab.finishProof.wearTrace||=[]).push({seconds:(stageFrame+1)/60,...measureFinish(lab)});}")
s=s.replace("record.trial={", "record.finishConstruction=lab.finishProof||null;record.finishContact=lab.finishContactReport||null;record.elasticStay=lab.elasticStayProof||null;record.trial={")
s=s.replace('if(spec.source.finishRevision)initializeFinishPanels(lab);', 'if(spec.source.finishRevision){initializeFinishPanels(lab);lab.finishProof.afterInitialization=measureFinish(lab);}')
s=s.replace('"release","refine","joint"];', '"release","refine","joint",...(spec.source.finishRevision?["wear"]:[])];')
s=s.replace('stages = [...spec.source.assemblyExperiment,', 'stages = [...spec.source.assemblyExperiment,')
s=s.replace('totalFrames = stages.reduce(', 'if(spec.source.finishRevision?.strapless)stages=[...spec.source.assemblyExperiment,...(spec.source.finishRevision.waistSupport?[]:["elastic-fit"]),"release","wear"];totalFrames = stages.reduce(')
s=s.replace('function r043Frames(stage){', 'function r043Frames(stage){if(stage===\"elastic-fit\")return 120;if(stage===\"wear\")return spec.source.finishRevision?.strapless?600:180;')
s=s.replace("else {lab.activate(stage);", "else if(stage==='wear'){lab.releasePins();lab.setGravity(1);lab.finishProof.beforeWear=measureFinish(lab);}else {lab.activate(stage);")
s=s.replace("if(stage==='joint'){jointInfo=", "if(stage==='wear'){lab.finishProof.afterWear=measureFinish(lab);lab.finishProof.wearSeconds=spec.source.finishRevision.strapless?10:3;if(spec.source.finishRevision.strapless){closureInfo=finalizeCloseSeams(lab);lab.finishProof.physicalContactContinuation=true;lab.finishProof.quasiStaticFrictionlessPassSkipped=true;}}if(stage==='joint'){jointInfo=")
s=s.replace('const corrected43=config?.variant43||!new Set(', 'const corrected43=config?.variant43??!new Set(')
s=s.replace("function r043Frames(stage){", "function r043Frames(stage){if(spec?.source.priorSewingContinuation&&spec.stages.some(s=>s.id===stage&&s.seams.length&&s.seams.every(id=>!id.endsWith('__inner'))))return 1;")
s=s.replace("if(!check.finite||check.maxPrincipalStrain>5)throw Error", "if(spec.source.finishRevision&&check.finite&&check.maxPrincipalStrain>5){const before=check.maxPrincipalStrain;let extra=0;lab.kernel.prepare(1/720,lab.elapsed);while(check.finite&&check.maxPrincipalStrain>5&&extra<2400){for(let j=0;j<80;j++){lab.kernel.globalProject(lab.constraints.length,30,.002,100,50);lab.kernel.vertices(.0035);lab.kernel.surfaces();}extra+=80;check=lab.metrics();}for(const v of lab.velocity)v.fill(0);r043Recovery.push({stage,beforeMaxStrain:before,afterMaxStrain:check.maxPrincipalStrain,finishConstructionIterations:extra,thresholdUnchanged:true});}if(!check.finite||check.maxPrincipalStrain>5)throw Error")
extension='''
export function __batchState(){return {spec,analytic,lab,nativeBinding,stages,stageIndex,stageFrame}};
export async function __loadBatch(ticket,{reinforce=true,warmStart=null,variant43=undefined,continuation=false,finish=false,mirrorLegStart=false}={}){
 stop();requestId=1;resetContinuation();spec=analytic=lab=null;batchWarmStart=warmStart;
 analytic=prepareNativeSource(await recoverExplicitPantsCuffGathering(ticket.pattern));
 spec=compileWithinNativeBudget(analytic,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:ticket.bodyIdentity.id}});
 if(finish)prepareFinishGuides(spec,analytic,(uv,edges)=>(0,import_cdt2d3.default)(uv,edges,{exterior:false}));
 if(reinforce)spec=finish?addInteriorReinforcement(spec,(uv,edges)=>(0,import_cdt2d3.default)(uv,edges,{exterior:false})):addInternalReinforcement(spec);
 if(finish)addFinishedEdges(spec);
 if(mirrorLegStart)spec.source.initialLegSymmetry={sourceSide:mirrorLegStart==='right'?'right':'left',targetSide:mirrorLegStart==='right'?'left':'right',fullBelowMaterialYmm:350,blendEndsMaterialYmm:600,initializationOnly:true,paperRestUnchanged:true};
 if(continuation&&warmStart){spec.source.priorSewingContinuation={initializationOnly:true,allOriginalStagesActivatedBeforeNewRows:true};scheduleInternalStages(spec)}
 validate2(spec);
 spec.source.patternBatchTicket={id:ticket.id,recipeHash:ticket.recipeHash,geometryHash:ticket.geometryHash,contentSHA256:ticket.contentSHA256};
 config={kind:'analytic',variant43};
 nativeBinding={schema:'kaopu-native-pattern-batch-binding@1',presetId:ticket.id,person:R04_LOCK.person,
   sourceRecipeHash:ticket.recipeHash,sourceGeometryHash:analytic.geometryHash,batchContentSHA256:ticket.contentSHA256,
   bodyMutationAllowed:false,internalReinforcement:reinforce,materialHash:await materialHash(spec)};
 return {spec,binding:nativeBinding,fitPreflight:preflightSizing(analytic)};
}
'''
dest=D/'native/kaopu-tailor-workbench/catalogue/batch-adapter.mjs';dest.write_text(s+extension,encoding='utf8')
# Reinforcing rows are interior cloth lines, not new boundary half-space guides.
# They still enter the same XPBD stitch list and material solve at the parent stage.
for rel in ['native/kaopu-tailor-workbench/r07/stability/refinement.mjs','native/kaopu-tailor-workbench/r07/assembly.mjs','correctives/r043b/seam-frames.mjs','correctives/r043c/seam-frames.mjs']:
    f=D/rel;t=f.read_text(encoding='utf8');t=t.replace('for(const seam of lab.spec.seams){','for(const seam of lab.spec.seams){\n  if(seam.isInternalReinforcement)continue;')
    t=t.replace('if(seam.isInternalReinforcement)continue;', 'if(seam.isInternalReinforcement||seam.isFinishConstruction)continue;')
    t=t.replace('for(const t of pb.triangles)if(', 'for(const t of pb.triangles)if((!pb.reinforcementCut||t.every(i=>i<pb.reinforcementCut.originalMaterialVertexCount))&&')
    t=t.replace('pb.boundary.includes(v)', '(pb.reinforcementCut?.netBoundaryMaterialIds||pb.boundary).includes(v)')
    t=t.replace('face.find(i=>i!==a0&&i!==a1)', '_finishInner(pa,a0,a1,face.find(i=>i!==a0&&i!==a1))')
    t=t.replace('face.find(v=>v!==a0&&v!==a1)', '_finishInner(pa,a0,a1,face.find(v=>v!==a0&&v!==a1))')
    t=t.replace('aFace.find(i=>i!==a0&&i!==a1)', '_finishInner(pa,a0,a1,aFace.find(i=>i!==a0&&i!==a1))')
    t=t.replace('bFace.find(i=>i!==be[k]&&i!==be[k+1])', '_finishInner(pb,be[k],be[k+1],bFace.find(i=>i!==be[k]&&i!==be[k+1]))')
    t=t.replace('const v=t.find(v=>v!==edge[j]&&v!==edge[j+1]);', 'const v=_finishInner(pb,edge[j],edge[j+1],t.find(v=>v!==edge[j]&&v!==edge[j+1]));')
    t=t.replace('const v=t.find(v=>v!==be[j]&&v!==be[j+1]);', 'const v=_finishInner(pb,be[j],be[j+1],t.find(v=>v!==be[j]&&v!==be[j+1]));')
    t+='''
// A narrow folded seam needs a net-cloth orientation reference beyond its fold,
// otherwise the old half-space rule fights the newly sewn second row.
function _finishInner(p,a,b,near){
 if(p.reinforcementCut?.schema!=='interior-narrow-fold-cut@1')return near;
 const A=p.uvMm[a],B=p.uvMm[b],C=p.uvMm[near],dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),side=Math.sign(dx*(C[1]-A[1])-dy*(C[0]-A[0])),mid=[(A[0]+B[0])/2,(A[1]+B[1])/2];let best=near,score=Infinity;
 for(let i=0;i<p.uvMm.length;i++){const q=p.uvMm[i],height=(dx*(q[1]-A[1])-dy*(q[0]-A[0]))/L*side;if(height<5)continue;const d=(q[0]-mid[0])**2+(q[1]-mid[1])**2;if(d<score){score=d;best=i}}
 return best;
}
'''
    f.write_text(t,encoding='utf8')
f=D/'correctives/r043b/hinge-bending.mjs';t=f.read_text(encoding='utf8')
t=t.replace('let offset=0;', 'let offset=0,foldHinges=0;')
t=t.replace('if(c.length!==2)continue;', "if(c.length!==2)continue;const net=p.reinforcementCut?.originalMaterialVertexCount;if(net&&a<net&&b<net&&((c[0]<net)!==(c[1]<net))){foldHinges++;continue;}")
t=t.replace('hinges:weights.length,weight,', 'hinges:weights.length,foldHinges,foldConstruction:\"new allowance fold lines permit a crease; original net material bending unchanged\",weight,')
f.write_text(t,encoding='utf8')
(D/'SOURCE_MANIFEST.json').write_text(json.dumps({'sourceBaseline':'ca6f090c5652bbe848e909f755b0ac5e80b4c969','files':copied,'adaptations':['new frozen-ticket entry','explicit seam allowance and second row','interior rows excluded only from boundary orientation guides; included in solver and audits']},indent=2),encoding='utf8')
print('Prepared source solver',len(copied),'files')
