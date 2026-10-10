"""R04-SOURCE-3: continue the original pipeline, no replacement geometry.
The legacy validators and solver thresholds remain unchanged. Only retry mesh
sampling for a positively identified vertex-count budget rejection.
"""
from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parent
worker=P/'native/kaopu-tailor-workbench/catalogue/native-adapter.mjs'
s=worker.read_text()
marker='// R04_BOUNDED_MATERIAL_SAMPLING_V1'
if marker not in s:
 original=s
 addition=r'''
// R04_BOUNDED_MATERIAL_SAMPLING_V1
const originalMaterialValidator=validate2;
validate2=function(value){
 try{return originalMaterialValidator(value)}catch(error){
  // Enrich an error, never turn failed validation into success.
  const code=String(error.message||'');
  if(code.startsWith('MATERIAL_COORDINATES: ')){
   const id=code.slice('MATERIAL_COORDINATES: '.length),p=value.panels.find(p=>p.id===id);
   if(p&&Array.isArray(p.uvMm)&&p.uvMm.length>3000&&p.uvMm.every(x=>finite2(x)&&x.every(v=>Math.abs(v)<=2000))){
    error.nativeVertexBudget={panelId:id,count:p.uvMm.length,limit:3000,boundaryCount:p.boundary.length};
   }
  }
  throw error;
 }
};
function compileWithinNativeBudget(input,options){
 const attempts=[];
 for(const step of [16,18,20,22,24,28,32]){
  try{
   const result=compileAnalytic(input,{...options,interiorStepMm:step});
   result.source.meshing.budgetPolicy={schema:'kaopu-native-mesh-budget@1',attempts,selectedInteriorStepMm:step,originalDefaultInteriorStepMm:16,boundarySamplingChanged:false,chordToleranceMm:.25,numericalStitchSpacingMm:12,validatorBudgetRaised:false,physicalQualityThresholdsChanged:false};
   return result;
  }catch(error){
   if(!error.nativeVertexBudget||error.nativeVertexBudget.boundaryCount>=3000)throw error;
   attempts.push({interiorStepMm:step,...error.nativeVertexBudget});
  }
 }
 throw Error('NATIVE_MESH_BUDGET_EXHAUSTED: original validator retained; no substitute garment.');
}
'''
 needle='spec=compileAnalytic(analytic,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:'
 assert s.count(needle)==1
 s=s.replace(needle,needle.replace('compileAnalytic','compileWithinNativeBudget'))
 s+=addition
 proof=json.loads((P/'assets/ADAPTER_PROOF.json').read_text())
 for name,start,end in [('compileAnalytic','function compileAnalytic(', '// garment-catalogue-assembly-20261007/src/workbench-worker.mjs'),('tick','function tick(token)', '// This extension is assembled')]:
  a=original[original.index(start):original.index(end,original.index(start))]
  b=s[s.index(start):s.index(end,s.index(start))]
  assert a==b,name
 proof['boundedSamplingExtension']={'beforeAdapterSHA256':hashlib.sha256(original.encode()).hexdigest(),'afterAdapterSHA256':hashlib.sha256(s.encode()).hexdigest(),'nativeNumericalRegionsUnchanged':True,'validatorAcceptanceUnchanged':True,'onlyInteriorStepAdjustedOnProvenVertexBudgetError':True,'originalBoundariesUnchanged':True}
 worker.write_text(s)
 (P/'assets/ADAPTER_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
reference=s[:s.index('self.onmessage = async')]
reference+='\n'+s[s.index(marker):]
reference+='\nexport async function meshProbe(input,opts={}){const a=await recoverExplicitPantsCuffGathering(input);return compileWithinNativeBudget(a,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:"common-native-default-r04"},...opts})}\n'
(worker.parent/'budget-probe.mjs').write_text(reference)
if not (P/'SOURCE3_RUNTIME_MIGRATED.json').exists():
 f=P/'app.mjs';s=f.read_text().replace("version:'R04-SOURCE-2'","version:'R04-SOURCE-3'")
 s=s.replace("if(eligible()&&!cache.rows[id]&&readiness.rows[id]?.status!=='native-material-ready')","if(eligible()&&!cache.rows[id]&&readiness.rows[id]?.status==='native-material-rejected')")
 s=s.replace('spec=d.spec;record=d.record;', 'if(token!==serial||!eligible())return;spec=d.spec;record=d.record;')
 s=s.replace("?wanted:'J06'","?wanted:'T01'")
 s=s.replace("const token=serial;if(eligible()&&cache.rows[id])", "if(eligible()&&!cache.rows[id]&&cache.failed?.[id]){phase='failed';message('该款原求解尚未成功：'+cache.failed[id].reason,true);controls();} const token=serial;if(eligible()&&cache.rows[id])")
 s=s.replace("clothComputedForOtherPerson:false", "clothComputedForOtherPerson:false,actualResultCount:Object.keys(cache.rows).length,nativeMaterialCount:readiness.summary.nativeMaterialsReady,staticPassCount:Object.values(cache.rows).filter(r=>r.qualityPassed).length,all60GarmentsAccepted:false")
 f.write_text(s)
 f=P/'index.html';s=f.read_text().replace('R04 · 原系统接回','R04.1 · 原人物 / 原裁缝').replace('原系统来源修正','原人物与原裁缝');f.write_text(s)
 print('R04_NATIVE_CONTINUATION_READY')
 (P/'SOURCE3_RUNTIME_MIGRATED.json').write_text('{"runtimeMigrationApplied":true}')
