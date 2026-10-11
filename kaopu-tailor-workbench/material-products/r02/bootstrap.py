"""One-time source inheritance, not a runtime patcher. Never rewrites editable code."""
from pathlib import Path
import json,hashlib,os,shutil
P=Path(__file__).resolve().parent
OLD=P.parent/'r01'
UP=Path(os.environ['COTTON_SOURCE'])
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def text_missing(name,text):
 p=P/name
 if not p.exists():p.write_text(text)
def copy_missing(src,name):
 dst=P/name;dst.parent.mkdir(parents=True,exist_ok=True)
 if not dst.exists():shutil.copyfile(src,dst)
 return {'path':name,'source':str(src),'sourceSha256':digest(src),'copiedSha256':digest(dst)}
receipt=[]
for name in ['looks.mjs','outfits-r043.mjs','source-contract.mjs','sewn-normals-r0433.mjs','panel-grain.mjs']:
 receipt.append(copy_missing(OLD/name,name))
for f in sorted((OLD/'native').glob('*.gz')):receipt.append(copy_missing(f,'native/'+f.name))
for src,name in [(UP/'cotton-surface.js','cotton-surface.js'),(UP/'core.js','denim-core.js')]:
 receipt.append(copy_missing(src,name))
css=(OLD/'style.css').read_text()+'''\n.look-card{min-height:112px;padding:15px;display:flex;flex-direction:column;align-items:flex-start;text-align:left}.look-number{font-size:26px;font-weight:300;letter-spacing:.04em;opacity:.65;margin-bottom:12px}.look-card.knit{background:#e7dfd1}.look-card.leather{background:#ddd4c7}.look-card.denim{background:#d5e0e6}.chip{min-height:95px;padding:12px}.chip div{width:100%}.stage-tip{pointer-events:none}#status{min-height:42px}\n'''
text_missing('style.css',css)
materials=[]
for old in json.loads((OLD/'materials.json').read_text()):
 q={k:old[k] for k in ['id','family','label','sourcePreset','sheen'] if k in old}
 q['parameters']=old.get('parameters',old.get('sourceInfo',{}).get('parameters',{}))
 q.update(appearanceImageMaps=0,carrierSheets=0,materialPhysicsCalibrated=False)
 if q['family']=='denim':
  p=q['parameters'];name=q['sourcePreset'];dye={'raw':'#163553','vintage':'#426681','bleach':'#94aec3','black':'#272c33'}[name]
  q['geometry']={'warpPitch':.42,'weftPitch':.64,'thickness':p['thickness'],'slub':p['slub'],'weave':p['weave'],'warpDye':dye,'weftDye':'#5c5b55' if name=='black' else '#b8b4a5'}
  q['sourceVersion']='R09-inherited-R08-cotton-core; garment adapter, not complete R09'
  q['representation']='Closed interlaced yarn tubes; finite representative closed staple fibres'
 elif q['family']=='knit':
  q['sourceVersion']='R11 needle-curve and recipe adapter; full spectral system not transferred'
  q['representation']='Three closed plies, whole-stitch carriers and rear floats; finite representative fibres'
 else:
  q['sourceVersion']='R12-S1A equivalent R10 LeatherKernel'
  q['representation']='Closed inside/outside shell, edge walls and vertex-evaluated original grain field'
 materials.append(q)
text_missing('materials.json',json.dumps(materials,ensure_ascii=False,indent=2))
lock=json.loads((OLD/'SOURCE_LOCK.json').read_text())
lock.update(version='MP02-S1',parentCommit='c8e9b7b6979e26029bc7dd67411bbb8ecd336cb6',visualVerified=False,deliveryComplete=False)
lock['integrationSources']={
 'knit':{'repository':'haihao0307/Human-Fabric-Workbench','commit':'20b466073bb458408a078260a018460c81f627b9','directory':'previews/raywave-fabric-r11','scope':'needle curve, selected recipes and stitch-colour chart adapted; not complete optical or physical runtime'},
 'denim':{'repository':'haihao0307/Humanoid-Rig-Lab-Next','commit':'bef688f8152212bf57207aa99703a9be81a0272f','directory':'denim-workshop/r09','inheritedCoreDirectory':'denim-workshop/r08','scope':'cotton cross-section and interlacing adapter; no camera-facing fibre ribbons; not complete R09'},
 'leather':{'repository':'haihao0307/Humanoid-Rig-Lab-Next','commit':'dafd69cf7819e7c5a67e0dd2643e79fc154bdc7d','directory':'leather-workshop/r12','equivalentKernelBuild':'af389cc216ddd01e3b1aa66c972f42b2587bc797','scope':'R10 native field and selected recipes evaluated on closed geometry; no new physics'}}
lock['representation']={'appearanceImageMaps':0,'visibleCarrierSheets':0,'cameraFacingRibbons':0,'geometryDataTextures':'positions and normals only; not material images','oldPersonAndNativePacketsUnchanged':True}
text_missing('SOURCE_LOCK.json',json.dumps(lock,ensure_ascii=False,indent=2))
notice=(OLD/'THIRD_PARTY_NOTICES.md').read_text()
mit=notice[notice.index('MIT License — Copyright'):notice.index('## Leather')]
current='''# MP02 source notices and integration scope

Original KAOPU common-person assets, native garment records, Three.js and OrbitControls retain their original rights and attribution in the unchanged R04.3.4 workbench. This adapter grants no new blanket licence or commercial certification.

## Knit

The public centreline model is Keenan Crane's 2023 A Simple Parametric Model of Plain-Knit Yarns, https://github.com/keenancrane/plain-knit-yarn (MIT code, CC BY 4.0 note). Selected user-owned R11 recipe values and whole-stitch colour charts inform the new garment adapter. The original private research repository is not republished wholesale. There is no original Ray/Wave full spectral transport, complete carrier clock, knit simulation or all-fibre population in this integration.

'''+mit+'''
## Leather

Original KAOPU LeatherKernel R10 at af389cc216ddd01e3b1aa66c972f42b2587bc797, equivalent to the R12-S1A source-normalization baseline. Native procedural field and catalogue parameters are evaluated on a closed shell. No Adobe leather images, scanned material package or external garment mesh is included. Sub-mesh grain frequencies still use differential shading; not every pore is resolved as topological geometry.

## Denim

KAOPU R09 at bef688f8152212bf57207aa99703a9be81a0272f retains the R08 cotton-surface.js and core.js; these exact two small source cores are preserved with SHA-256 in INHERITANCE.json. Cotton cross-section functions are used by the solid-yarn shader; the whole standalone R09 renderer, compact camera-facing fibres and solver are not claimed to be transplanted. The new finite representative fibres use closed tubes, not image cards.

## Original garments and test boundary

Original solver coordinates and common-person identity remain unchanged. Geometric thickness does not by itself establish bending, stretching, friction, seam tension or new collision correctness. The two thread paths are a geometric demonstration, not a certified industrial lockstitch or seam-force simulation. Source checks and compiler checks are not browser or visual acceptance.
'''
text_missing('THIRD_PARTY_NOTICES.md',current)
text_missing('INHERITANCE.json',json.dumps({'copied':receipt,'originalGarmentsReadOnly':True,'visualVerified':False},indent=2))
assert len(materials)==12
print('Inheritance complete; all original directories untouched.')
