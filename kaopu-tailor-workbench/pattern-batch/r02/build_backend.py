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
source=P/'native/kaopu-tailor-workbench/catalogue/native-adapter.mjs'
s=source.read_text(encoding='utf8')
s="import {addInternalReinforcement,scheduleInternalStages} from '../../../../reinforce.mjs';\n"+s
s="import {warmStartAllowances} from '../../../../warm-start.mjs';\nlet batchWarmStart=null;\n"+s
s=s.replace('p.uvMm.length > 3e3','p.uvMm.length > 12e3').replace('p.triangles.length > 6e3','p.triangles.length > 24e3')
s=s.replace('lab = new GarmentLab2(spec, sdf,','scheduleInternalStages(spec);lab = new GarmentLab2(spec, sdf,')
s=s.replace('lab.pipeline43=corrected43;','if(batchWarmStart)warmStartAllowances(lab,batchWarmStart);lab.pipeline43=corrected43;')
s=s.replace('const corrected43=config?.variant43||!new Set(', 'const corrected43=config?.variant43??!new Set(')
s=s.replace("function r043Frames(stage){return", "function r043Frames(stage){if(spec?.source.priorSewingContinuation&&spec.stages.some(s=>s.id===stage&&s.seams.length&&s.seams.every(id=>!id.endsWith('__inner'))))return 1;return")
extension='''
export function __batchState(){return {spec,analytic,lab,nativeBinding,stages,stageIndex,stageFrame}};
export async function __loadBatch(ticket,{reinforce=true,warmStart=null,variant43=undefined,continuation=false}={}){
 stop();requestId=1;resetContinuation();spec=analytic=lab=null;batchWarmStart=warmStart;
 analytic=prepareNativeSource(await recoverExplicitPantsCuffGathering(ticket.pattern));
 spec=compileWithinNativeBudget(analytic,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:ticket.bodyIdentity.id}});
 if(reinforce)spec=addInternalReinforcement(spec);
 if(continuation&&warmStart){spec.source.priorSewingContinuation={initializationOnly:true,allOriginalStagesActivatedBeforeNewRows:true};scheduleInternalStages(spec)}
 validate2(spec);
 spec.source.patternBatchTicket={id:ticket.id,recipeHash:ticket.recipeHash,geometryHash:ticket.geometryHash,contentSHA256:ticket.contentSHA256};
 config={kind:'analytic',variant43};
 nativeBinding={schema:'kaopu-native-pattern-batch-binding@1',presetId:ticket.id,person:R04_LOCK.person,
   sourceRecipeHash:ticket.recipeHash,sourceGeometryHash:ticket.geometryHash,batchContentSHA256:ticket.contentSHA256,
   bodyMutationAllowed:false,internalReinforcement:reinforce,materialHash:await materialHash(spec)};
 return {spec,binding:nativeBinding,fitPreflight:preflightSizing(analytic)};
}
'''
dest=D/'native/kaopu-tailor-workbench/catalogue/batch-adapter.mjs';dest.write_text(s+extension,encoding='utf8')
# Reinforcing rows are interior cloth lines, not new boundary half-space guides.
# They still enter the same XPBD stitch list and material solve at the parent stage.
for rel in ['native/kaopu-tailor-workbench/r07/stability/refinement.mjs','native/kaopu-tailor-workbench/r07/assembly.mjs','correctives/r043b/seam-frames.mjs','correctives/r043c/seam-frames.mjs']:
    f=D/rel;t=f.read_text(encoding='utf8');t=t.replace('for(const seam of lab.spec.seams){','for(const seam of lab.spec.seams){\n  if(seam.isInternalReinforcement)continue;')
    t=t.replace('for(const t of pb.triangles)if(', 'for(const t of pb.triangles)if((!pb.reinforcementCut||t.every(i=>i<pb.reinforcementCut.originalMaterialVertexCount))&&')
    t=t.replace('pb.boundary.includes(v)', '(pb.reinforcementCut?.netBoundaryMaterialIds||pb.boundary).includes(v)')
    f.write_text(t,encoding='utf8')
f=D/'correctives/r043b/hinge-bending.mjs';t=f.read_text(encoding='utf8')
t=t.replace('let offset=0;', 'let offset=0,foldHinges=0;')
t=t.replace('if(c.length!==2)continue;', "if(c.length!==2)continue;const net=p.reinforcementCut?.originalMaterialVertexCount;if(net&&a<net&&b<net&&((c[0]<net)!==(c[1]<net))){foldHinges++;continue;}")
t=t.replace('hinges:weights.length,weight,', 'hinges:weights.length,foldHinges,foldConstruction:\"new allowance fold lines permit a crease; original net material bending unchanged\",weight,')
f.write_text(t,encoding='utf8')
(D/'SOURCE_MANIFEST.json').write_text(json.dumps({'sourceBaseline':'ca6f090c5652bbe848e909f755b0ac5e80b4c969','files':copied,'adaptations':['new frozen-ticket entry','explicit seam allowance and second row','interior rows excluded only from boundary orientation guides; included in solver and audits']},indent=2),encoding='utf8')
print('Prepared source solver',len(copied),'files')
