"""Self-contained renderer. Uses pinned local Three bytes, never a remote runtime CDN."""
from pathlib import Path
import re,hashlib,json,os,sys
HERE=Path(__file__).resolve().parent
BASE=HERE.parent/'fiber-r02'
def sha(b): return hashlib.sha256(b).hexdigest()
locks={'kernel.mjs':'e6f628a028b7bab6494dd3921094bb3373ca55c0eb2e9cac404429f219ec9cbb','shaders.mjs':'d21c524bcccd28d2a550bb58fec2cad84891a4fb126db2b18a47774e61fa7cf5'}
for name,digest in locks.items():
 if sha((BASE/name).read_bytes())!=digest: raise ValueError('Frozen R02 module changed: '+name)
three=Path(sys.argv[1]).read_text()
if sha(three.encode())!='f7cee3c7533449a1505cc12cb5128b89e3d4fd3d7ea62b05f9f5464a217472ee': raise ValueError('Three r169 bytes mismatch')
def wrap_module(name,text):
 names=re.findall(r'export (?:const|function|class)\s+(\w+)',text)
 text=re.sub(r'^import .*?;\n','',text,flags=re.M)
 return 'const '+name+'=(()=>{\n'+text.replace('export ','')+'\nreturn {'+','.join(names)+'};})();\n'
m=re.search(r'export\s*\{([^}]+)\};?\s*$',three)
if not m: raise ValueError('Unexpected Three module format')
exports=[]
for part in m.group(1).split(','):
 pair=part.strip().split(' as ');exports.append(pair[1]+':'+pair[0] if len(pair)==2 else pair[0])
bundle='const THREE=(()=>{'+three[:m.start()]+';return {'+','.join(exports)+'};})();\n'
bundle+=wrap_module('baseKernel',(BASE/'kernel.mjs').read_text())
bundle+=wrap_module('old',(BASE/'shaders.mjs').read_text())
stab=(HERE/'stability.mjs').read_text().replace("import {vertex,fragment} from '../fiber-r02/shaders.mjs';","const {vertex,fragment}=old;")
bundle+=wrap_module('STAB',stab)
app=(HERE/'app.mjs').read_text()
app=app.replace("import * as THREE from '../three.module.js';",'')
app=app.replace("import {COUNT,SEGMENTS,makeRoots,hashFloats,MATERIALS,halton} from '../fiber-r02/kernel.mjs';",'const {COUNT,SEGMENTS,makeRoots,hashFloats,MATERIALS,halton}=baseKernel;')
app=app.replace("import * as old from '../fiber-r02/shaders.mjs';",'')
app=app.replace("import {stableVertex,nodeRadianceFragment,frontFragment,layerFragment,resolveFragment,STEP_METRES} from './stability.mjs';",'const {stableVertex,nodeRadianceFragment,frontFragment,layerFragment,resolveFragment,STEP_METRES}=STAB;')
source=os.environ.get('SOURCE_SHA',os.environ.get('GITHUB_SHA','local-research'))
html=(HERE/'index.html').read_text().replace('content="local-research"','content="'+source+'"').replace('<script type="module" src="./app.mjs"></script>','<script>'+ (bundle+app).replace('</script','<\\/script')+'</script>')
site=HERE/'site';site.mkdir(exist_ok=True);(site/'preview.html').write_text(html)
manifest={'version':'HAIR-FIBER-R03-S1','source':source,'htmlBytes':len(html.encode()),'htmlSHA256':sha(html.encode()),'lockedR02':locks,'threeSHA256':sha(three.encode()),'files':{f:sha((HERE/f).read_bytes()) for f in ['app.mjs','stability.mjs','index.html','build.py']},'count':10000,'segments':80,'rootSignature':'eaadb8b8','deterministicCoverage':True,'layers':8,'layerColourMixing':'approximate; no exact per-pixel sort','radianceInterpolation':'81 samples per strand; four cross-section values for resolved strands','temporalReprojection':False,'physics':False,'filmQualityAccepted':False,'oldVersionsChanged':False,'imageGenerationUsed':False}
(HERE/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
