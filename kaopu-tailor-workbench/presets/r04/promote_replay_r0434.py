"""Promote a real target-browser result, not an edited mesh. Keep both failed and successful evidence."""
from pathlib import Path
import json,gzip,hashlib,os,shutil,subprocess
P=Path(__file__).resolve().parent;D=P/'qa-r0434-replay'
load=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
def gap(a,b):
 assert len(a)==len(b) and all(len(u)==len(v) for u,v in zip(a,b))
 return max(abs(x-y) for u,v in zip(a,b) for x,y in zip(u,v))
r=load(P/'R0434_REPLAY_REPORT.json');assert r['passed'] and r['actualPublicBrowser'] and r['outputToleranceMm']==1e-5
assert all(c['passed'] for c in r['checks'])
manifest=load(P/'R0434_MANIFEST.json')
for name,meta in manifest['files'].items():assert sha(P/name)==meta['sha256'],('A runtime or published input changed outside the replay repair',name)
index=load(P/'assets/results/index.json');old={id:sha(P/'assets/results'/row['file']) for id,row in index['rows'].items()};oldpictures={id:sha(P/'assets/results'/row['thumb']) for id,row in index['rows'].items()}
assert old['T08']==r['beforeRecordSHA256'];node=json.loads(gzip.decompress((P/'assets/results'/index['rows']['T08']['file']).read_bytes()))
a=json.loads(gzip.decompress((D/'T08-run1.json.gz').read_bytes()));packet=json.loads(gzip.decompress((D/'T08-run2.json.gz').read_bytes()))
assert gap(a['record']['positionsMm'],packet['record']['positionsMm'])<1e-5
assert packet['binding']==a['binding']==packet['record']['nativeBinding']
assert all(packet['binding'][k]==node['binding'][k] for k in ['person','presetId','recipeHash','paperSHA256','nativeAnchor','patternSizingOrigin'])
assert packet['record']['staticGate']['passed'] and packet['record']['staticGate']['thresholds']==node['record']['staticGate']['thresholds']
assert len(packet['spec']['panels'])==len(node['spec']['panels']);rest_gap=0
for x,y in zip(packet['spec']['panels'],node['spec']['panels']):
 assert x['id']==y['id'] and x['triangles']==y['triangles'];rest_gap=max(rest_gap,gap(x['uvMm'],y['uvMm']))
assert rest_gap<1e-9
assert len(packet['spec']['seams'])==len(node['spec']['seams'])
for x,y in zip(packet['spec']['seams'],node['spec']['seams']):assert all(x[k]==y[k] for k in ['id','a','b','stitchVertexPairs'])
# Independent browser-created packet is copied intact: no smoothing or coordinate edits.
packet.update(complete=True,sourceRun=os.environ['GITHUB_SHA'],nativeRuntimeSourceCommit=manifest['runtimeSourceCommit'],review='R0434: two independent actual Chromium Worker solves agree; Node/compiler floating-point divergence remains recorded, not hidden')
target=P/'assets/results'/index['rows']['T08']['file'];target.write_bytes(gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
from PIL import Image,ImageStat
pngs={'T08':D/'T08.png',**{x['id']:D/(x['id']+'.png') for x in r['outfits']}}
assert len(pngs)==25 and all(x['passedDisplay'] for x in r['outfits'])
for id,source in pngs.items():
 im=Image.open(source);im.load();assert im.size==(320,400) and max(ImageStat.Stat(im.convert('RGB')).stddev)>5
 dest=P/('assets/results/'+index['rows']['T08']['thumb'] if id=='T08' else 'assets/outfits/'+id+'.png');shutil.copy2(source,dest)
index['rows']['T08'].update(sha256=sha(target),qualityPassed=True,thumbReady=True,thumbSHA256=sha(pngs['T08']),kind='NATIVE_R0434_INDEPENDENT_BROWSER_REPLAY',sourceCommit=manifest['runtimeSourceCommit'],sourceRun=os.environ['GITHUB_SHA'])
index['r0434BrowserReplay']={'styles':['T08'],'report':'R0434_REPLAY_REPORT.json','toleranceMm':1e-5,'solverMathChanged':False,'cachedVerticesManuallyEdited':False}
write(P/'assets/results/index.json',index)
for id,row in index['rows'].items():
 if id!='T08':assert sha(P/'assets/results'/row['file'])==old[id] and sha(P/'assets/results'/row['thumb'])==oldpictures[id]
assert len(index['rows'])==60 and sum(v['qualityPassed'] for v in index['rows'].values())==22
base=load(P/'qa-r0434-first-public/R0434_PUBLIC_REPORT.json');assert base['passed'] and base['actualPublicBrowser'] and len(base['styles'])==60 and len(base['outfits'])==432
base['sourceCommit']=os.environ['GITHUB_SHA'];base['actualPublicBrowser']=False
base['incrementalReplayCertificate']={'priorActualHTTPS':r['url'],'priorPublicReport':'qa-r0434-first-public/R0434_PUBLIC_REPORT.json','unchangedRuntimeVerifiedAgainstWholeManifest':True,'changedStyles':['T08'],'changedOutfits':[x['id'] for x in r['outfits']],'unchangedStyles':59,'unchangedOutfits':408,'scope':'Prior actual-public full regression plus separately executed actual-public native replay and affected outfit rendering. A NEW full HTTPS regression is still required after publication.'}
for row in base['styles']:
 if row['id']=='T08':
  row.update(passedDisplay=True,staticPassed=True,physicalFailures=[],views=r['views'],thumbSHA256=sha(pngs['T08']),normalAudits=[],normalAuditScope='To be measured again by final complete public regression')
changed={x['id']:x for x in r['outfits']}
for i,row in enumerate(base['outfits']):
 if row['id'] in changed:base['outfits'][i]=changed[row['id']]
 else:assert sha(P/'assets/outfits'/(row['id']+'.png'))==row['thumbSHA256']
write(P/'R0434_BROWSER_REPORT.json',base)
proof={'sourceCommit':os.environ['GITHUB_SHA'],'previousPublishedURL':r['url'],'changedNativeResults':['T08'],'changedPreviewIDs':list(pngs),'unchangedNativeResults':{id:h for id,h in old.items() if id!='T08'},'unchangedOutfitPreviews':408,'beforeSHA256':old['T08'],'afterSHA256':sha(target),'beforeMaterialSHA256':node['binding']['materialSHA256'],'afterMaterialSHA256':packet['binding']['materialSHA256'],'maximumCompilerRestDifferenceMm':rest_gap,'nodeBrowserOutputDifferenceMm':gap(node['record']['positionsMm'],packet['record']['positionsMm']),'independentBrowserOutputDifferenceMm':gap(a['record']['positionsMm'],packet['record']['positionsMm']),'originalOutputToleranceMm':1e-5,'originalTopologyAndSeamsUnchanged':True,'originalPaperUnchanged':True,'sameOriginalPerson':True,'thresholdsChanged':False,'solverMathChanged':False,'solvedVerticesEdited':False,'all60GarmentsAccepted':False,'remainingStaticFailures':38}
write(P/'R0434_REPLAY_PROMOTION.json',proof)
release=P/'release_r0434.py';text=release.read_text();needle=" files.update(str(f.relative_to(P)) for f in (P/'person-core').rglob('*') if f.is_file())"
assert text.count(needle)==1;text=text.replace(needle,needle+"\n files.update(['R0434_REPLAY_REPORT.json','R0434_REPLAY_PROMOTION.json'])")
needle="protected=['kaopu-tailor-workbench/presets/r0432-eeca9dee0c3a'";assert text.count(needle)==1;text=text.replace(needle,"protected=['kaopu-tailor-workbench/presets/r0434-2318c29107e7','kaopu-tailor-workbench/presets/r0432-eeca9dee0c3a'")
release.write_text(text)
print('R0434_BROWSER_NATIVE_REPLAY_PROMOTED',json.dumps(proof),flush=True)
