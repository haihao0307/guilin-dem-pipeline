from pathlib import Path
import hashlib, json, subprocess
p=Path(__file__).resolve().parent
revision=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
html=(p/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="workbench.css">','<style>'+(p/'workbench.css').read_text()+'</style>')
html=html.replace('href="TEACHER_INDEX.md"','href="https://github.com/haihao0307/guilin-dem-pipeline/blob/'+revision+'/kaopu-hair-workbench/fusion/r13c/README.md"')
notices='\n'.join(f.read_text() for f in (p/'licenses').glob('*.txt'))
notices+='\n'+(p/'native-head/face-transfer/THIRD_PARTY.txt').read_text()+'\n'+(p/'native-head/eye-materials/THIRD_PARTY.md').read_text()
code=(p/'bundle.js').read_text().replace('</script','<\\/script')
html=html.replace('<script type="module" src="bundle.js"></script>','<script type="module">/*!\n'+notices.replace('*/','* /')+'\n*/\n'+code+'</script>')
(p/'public-lite.html').write_text(html)
manifest={'version':'R13C.2','sourceRevision':revision,'userFrozenPreview':'a827dc71191a8394c3e98973cac5dde45fc1f716','inheritedHeadRevision':'78698827a763e706924da97d785f8f373ce055ce','nativeHeadRevision':'99defb97123d8101fefddf5aa039991446f557a8','oldPathsModified':False,'oneVisibleHead':True,'coverage':'continuous strand coverage, native MSAA when available, nearest-depth writes','teacherHairstyleLoaded':False,'physics':False,'hairHairCollision':False,'bodyCollision':False,'cinematicAccepted':False,'publicBrowserVerified':False,'htmlBytes':len(html.encode()),'htmlSha256':hashlib.sha256(html.encode()).hexdigest(),'bundleSha256':hashlib.sha256((p/'bundle.js').read_bytes()).hexdigest(),'sources':[]}
for f in sorted((p/'src').glob('*.js')):
 manifest['sources'].append({'path':str(f.relative_to(p)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size})
(p/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print(manifest['version'],manifest['htmlBytes'],manifest['htmlSha256'])
