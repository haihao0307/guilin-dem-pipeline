"""Build a fifth-case integration candidate from the exact accepted four-case outputs."""
from pathlib import Path
import json,base64,hashlib,shutil
ROOT=Path(__file__).parent.parent
sha=lambda b:hashlib.sha256(b).hexdigest()
online=(ROOT/'dist/kuko-anemone-candidate.html').read_text()
offline=(ROOT/'dist/kuko-anemone-standalone.html').read_text()
assert sha(online.encode())=='0a3b3620f15c0bbe18a73572ff6a6d11f5846e2c477c95d361997b7a882dca9c'
assert sha(offline.encode())=='1fa206dccf30f8a33ac4265e9b3901a3d9840983472d542fcce13be08cf42fdc'
module=(ROOT/'full-cluster/feather-study/index.html').read_text()
assert sha(module.encode())=='acd3c4f3552a16d82af3b756b870e0d776a570b549439fe31b9d88b038710335'
css=(ROOT/'full-cluster/src/feather-catalog.css').read_text()
runtime=(ROOT/'full-cluster/src/feather-catalog.js').read_text()
preview='data:image/jpeg;base64,'+base64.b64encode((ROOT/'references/previews/feather-render.jpg').read_bytes()).decode()
runtime=runtime.replace('/*__FEATHER_PREVIEW__*/',preview)
escape=lambda s:s.replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
embed='window.FEATHER_MODULE_HTML='+escape(json.dumps(module))+';\n'
def augment(html,portable):
 html=html.replace('</head>','<style>'+css+'</style></head>',1)
 return html.replace('</body>','<script>'+(embed if portable else '')+runtime.replace('</script','<\\/script')+'</script></body>',1)
public=augment(online,False);standalone=augment(offline,True)
(ROOT/'dist/feather-integrated-candidate.html').write_text(public)
(ROOT/'dist/feather-integrated-standalone.html').write_text(standalone)
shutil.copytree(ROOT/'full-cluster/feather-study',ROOT/'dist/feather-study',dirs_exist_ok=True)
receipt={'onlineBytes':len(public.encode()),'onlineSha256':sha(public.encode()),'offlineBytes':len(standalone.encode()),'offlineSha256':sha(standalone.encode()),'featherSha256':sha(module.encode()),'baseOnlineSha256':sha(online.encode()),'baseOfflineSha256':sha(offline.encode()),'isolatedIntegrationCandidate':True,'physicalIPhoneTested':False}
(ROOT/'full-cluster/qa/feather-integration-build.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt))
