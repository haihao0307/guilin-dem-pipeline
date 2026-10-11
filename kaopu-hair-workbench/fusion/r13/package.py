from pathlib import Path
import json,hashlib,subprocess
p=Path(__file__).parent
source_sha=subprocess.check_output(['git','rev-parse','HEAD']).decode().strip()
html=(p/'index.html').read_text().replace('<link rel="stylesheet" href="workbench.css">','<style>'+(p/'workbench.css').read_text()+'</style>')
html=html.replace('href="TEACHER_INDEX.md"','href="https://github.com/haihao0307/guilin-dem-pipeline/blob/'+source_sha+'/kaopu-hair-workbench/fusion/r13/TEACHER_INDEX.md"')
code=(p/'bundle.js').read_text().replace('</script','<\\/script')
notices='\n'.join((p/'licenses'/n).read_text() for n in ['THREE-LICENSE.txt','GNM-LICENSE.txt','MAKEHUMAN-BROWS.txt','PERM-MIT.txt','DIGITAL-SALON-MIT.txt'])
html=html.replace('<script type="module" src="bundle.js"></script>','<script type="module">/*!\n'+notices.replace('*/','* /')+'\n*/\n'+code+'</script>')
(p/'public-lite.html').write_text(html)
m={'version':'R13-M1','baseRevision':'5d420df72b94c089d38be934a02aa4b8323404fc','sourceRevision':source_sha,'oldPathsModified':False,'teacherHairstyleLoaded':False,'femaleRuntimeLoaded':False,'styles':['textured-fringe','side-flow','curtain-layer'],'lengthRangeMM':[45,160],'runtimeAssets':['fixed lossless GNM head, original hash checked'],'neuralModelRunning':False,'physics':False,'cinematicAccepted':False,'publicBrowserVerified':False,'htmlSha256':hashlib.sha256(html.encode()).hexdigest(),'htmlBytes':len(html.encode()),'bundleSha256':hashlib.sha256((p/'bundle.js').read_bytes()).hexdigest()}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2))
print(m['htmlBytes'],m['htmlSha256'])
