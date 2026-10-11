from pathlib import Path
import subprocess,hashlib,json,re
p=Path(__file__).parent
base='80b4ba2862343a9a14a02686ccb3207f8cceaffb'
source='kaopu-hair-workbench/fusion/r11/public-lite.html'
original=subprocess.check_output(['git','show',base+':'+source]).decode()
css=(p/'layout.css').read_text()
updated=original.replace('</head>','<style id="r11-layout-correction">'+css+'</style></head>',1)
assert updated!=original
scripts=lambda s:re.findall(r'<script\b[^>]*>(.*?)</script>',s,flags=re.S)
assert scripts(updated)==scripts(original),'Runtime script bytes must remain unchanged'
(p/'public-lite.html').write_text(updated)
m={'version':'R11.0','displayRevision':1,'change':'Gallery caption wrapping and mobile header/control layout only','coreCommit':base,'coreHtmlSha256':hashlib.sha256(original.encode()).hexdigest(),'htmlSha256':hashlib.sha256(updated.encode()).hexdigest(),'scriptHashes':[hashlib.sha256(s.encode()).hexdigest() for s in scripts(original)],'allRuntimeScriptsUnchanged':True,'physics':False,'permNeuralModelRunning':False,'publicBrowserVerified':False}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2))
print('CSS-only correction; all runtime scripts byte-identical',m['htmlSha256'])
