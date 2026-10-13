from pathlib import Path
import json,hashlib,os,subprocess
p=Path(__file__).resolve().parent
source=os.environ.get('GITHUB_SHA') or subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
html=(p/'index.html').read_text().replace('<link rel="stylesheet" href="workbench.css">','<style>'+(p/'workbench.css').read_text()+'</style>')
html=html.replace('href="TEACHER_INDEX.md"','href="https://github.com/haihao0307/guilin-dem-pipeline/blob/'+source+'/kaopu-hair-workbench/fusion/r14-loadfix/README.md"')
notice='\n'.join(f.read_text() for f in (p/'licenses').glob('*.txt'))+'\n'+(p/'native-head/face-transfer/THIRD_PARTY.txt').read_text()+'\n'+(p/'native-head/eye-materials/THIRD_PARTY.md').read_text()
payload='<template id="gnmHeadPayload" data-bytes="9930135">'+(p/'HEAD_PAYLOAD.b64').read_text()+'</template>'
code=(p/'bundle.js').read_text().replace('</script','<\\/script')
html=html.replace('<script type="module" src="bundle.js"></script>',payload+'<script type="module">/*!\n'+notice.replace('*/','* /')+'\n*/\n'+code+'</script>')
assert 'loadFixedAsset(' not in code
(p/'public-lite.html').write_text(html)
manifest={'version':'R14.2-L01','sourceRevision':source,'frozenAppearanceBuild':'c40a86c92b2fe37179e29a67628bf26303745d60','nativeHeadRevision':'99defb97123d8101fefddf5aa039991446f557a8','runtimeExternalAssetRequests':0,'head':json.loads((p/'HEAD_TRANSPORT.json').read_text()),'htmlBytes':len(html.encode()),'htmlSha256':hashlib.sha256(html.encode()).hexdigest(),'publicBrowserVerified':False,'appearanceChanged':False,'oldPathsModified':False,'cinematicAccepted':False}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
