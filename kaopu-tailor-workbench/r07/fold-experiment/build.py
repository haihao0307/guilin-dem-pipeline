"""Controlled experiment, not a published garment fix.
Keep the inherited solver and every geometric quality gate. Change only straight
source-gathered boundary sampling and explicitly add two fold-point connections.
"""
from pathlib import Path
import subprocess,sys
P=Path(__file__).resolve().parent;ROOT=P.parent.parent;CAT=ROOT/'catalogue'
subprocess.run([sys.executable,str(ROOT/'r07/continuation/build.py')],check=True)
base=(CAT/'r074-test-module.mjs').read_text()
(CAT/'fold-control-test.mjs').write_text(base)
def once(s,a,b):
 assert s.count(a)==1,(a[:100],s.count(a));return s.replace(a,b)
s=once(base,'needleIntervals = /* @__PURE__ */ new Map(), edgeDiagnostics = [];','needleIntervals = /* @__PURE__ */ new Map(), foldFractions = new Map(), foldPlans = new Map(), edgeDiagnostics = [];')
s=once(s,'    let count = Math.max(counts.get(ka), counts.get(kb));','''    let count = Math.max(counts.get(ka), counts.get(kb));
    if(numericalStitchSpacingMm!==null && requiresGatheredStitchSites(s)){
      const ea=sourcePanels.get(s.a.panelId).edges[s.a.edge],eb=sourcePanels.get(s.b.panelId).edges[s.b.edge];
      const ratio=Math.max(s.lengthAMm,s.lengthBMm)/Math.min(s.lengthAMm,s.lengthBMm);
      if(ea.kind==='line'&&eb.kind==='line'&&ratio>1.000001&&ratio<2.99){
        const requested=globalThis.FOLD_INTERVAL_MM||12;
        const intervals=Math.max(1,Math.ceil(Math.min(s.lengthAMm,s.lengthBMm)/requested),Math.ceil(count/3));
        const a=(ratio+1)/4,b=(ratio-1)/2;
        const long=[0,a/ratio,(a+b)/ratio,1],short=[0,1-a,a,1];
        const fractions=local=>Array.from({length:intervals*3+1},(_,i)=>i===intervals*3?1:(Math.floor(i/3)+local[i%3])/intervals);
        foldFractions.set(ka,fractions(s.lengthAMm>s.lengthBMm?long:short));foldFractions.set(kb,fractions(s.lengthBMm>s.lengthAMm?long:short));
        counts.set(ka,intervals*3);counts.set(kb,intervals*3);
        needleIntervals.set(s.id,{intervals,subdivisions:3,subA:3,subB:3});
        foldPlans.set(s.id,{type:'prescribed-two-turn-micropleat',ratio,intervals,requestedIntervalMm:requested,
          longMaterialFractions:long,shortMaterialFractions:short,materialCoordinatesRescaled:false,physicalThicknessModel:false});
        continue;
      }
    }''')
s=once(s,'uvMm.push(table.at(i / count));','uvMm.push(table.at(foldFractions.has(key)?foldFractions.get(key)[i]:i/count));')
s=once(s,'return { id: s.id, a, b, easeMm: lb - la,','return { id: s.id, a, b, experimentalFoldConstruction:foldPlans.get(s.id)||null, experimentalFoldPairs:foldPlans.has(s.id)?Array.from({length:needle.intervals},(_,i)=>[[aa[i*3+1],bb[i*3+2]],[aa[i*3+2],bb[i*3+1]]]).flat():[], easeMm: lb - la,')
old='const pairs=this.spec.source?.experimentalSparseSewing?seam.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);'
assert s.count(old)==2,s.count(old)
s=s.replace(old,'const pairs=this.spec.source?.experimentalSparseSewing?[...seam.stitchVertexPairs,...(seam.experimentalFoldPairs||[])]:a.ids.map((v,i)=>[v,b.ids[i]]);')
# Keep strictIntersectionAudit including coplanar overlap and no shared-point
# blanket exclusions. Do not modify strain limits, mesh material, body or CCD flags.
(CAT/'fold-prescribed-test.mjs').write_text(s)
for name in ['fold-control-test.mjs','fold-prescribed-test.mjs']:subprocess.run(['node','--check',str(CAT/name)],check=True)
print('FOLD_EXPERIMENT_BUILD; NOT DEPLOYED')
