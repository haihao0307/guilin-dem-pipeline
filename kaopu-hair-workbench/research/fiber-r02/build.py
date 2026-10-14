from pathlib import Path
import re, sys, json, hashlib, os
here=Path(__file__).resolve().parent
vendor=Path(sys.argv[1]) if len(sys.argv)>1 else here/'three.module.js'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(vendor.read_bytes())=='f7cee3c7533449a1505cc12cb5128b89e3d4fd3d7ea62b05f9f5464a217472ee', 'pinned Three.js r169 bytes required'
text=vendor.read_text()
assert '169' in text[:250] and 'Three.js Authors' in text[:250], 'pinned Three.js r169 is required'
m=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',text)
assert m, 'self-contained Three module expected'
items=[]
for pair in m.group(1).split(','):
 p=re.split(r'\s+as\s+',pair.strip());items.append((p[-1]+':'+p[0]) if len(p)==2 else p[0])
three='globalThis.THREE=(()=>{'+text[:m.start()]+'return {'+','.join(items)+'};})();'
chunks=[]
for f in ['kernel.mjs','shaders.mjs','app.mjs']:
 s=(here/f).read_text();s=re.sub(r'^import .*?;\s*$', '', s,flags=re.M);s=re.sub(r'\bexport\s+(?=(?:const|function|class)\b)','',s);chunks.append(s)
source=os.environ.get('GITHUB_SHA','LOCAL_UNPUBLISHED')
html=(here/'index.template.html').read_text().replace('__THREE__',three).replace('__APP__','\n'.join(chunks)).replace('__SOURCE__',source).replace('__SHORT__',source[:12])
if '<link rel="icon"' not in html:html=html.replace('<head>','<head><link rel="icon" href="data:,">',1)
assert '</script' not in three.lower(), 'unsafe embedded library'
out=here/'site';out.mkdir(exist_ok=True);(out/'preview.html').write_text(html)
files=['kernel.mjs','shaders.mjs','app.mjs','build.py','index.template.html','tests/core.mjs','tests/browser.mjs']
manifest={'version':'HAIR-FIBER-R02','source':source,'htmlSHA256':sha(html.encode()),'htmlBytes':len(html.encode()),'threeRevision':'169','threeSHA256':sha(vendor.read_bytes()),'sourceFiles':{f:sha((here/f).read_bytes()) for f in files},'denseIndependentStrands':10000,'segmentsPerStrand':80,'positionCache':'GPU RGBA32F 810000 nodes; rebuilt only after shape changes','visibilityGBuffer':True,'stochasticCoverage':True,'deferredFiberShading':True,'gpuFenceRequiredForReady':True,'physics':False,'filmQualityAccepted':False,'eb1':False,'imageGenerationUsed':False,'oldScalpChanged':False,'publicVerified':False}
(here/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(manifest,ensure_ascii=False))
