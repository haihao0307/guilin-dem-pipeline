from pathlib import Path
import re,hashlib,json,os,sys,subprocess
P=Path(__file__).resolve().parent;R02=P.parent/'fiber-r02';R03=P.parent/'fiber-r03'
sha=lambda b:hashlib.sha256(b).hexdigest()
locks={R02/'kernel.mjs':'e6f628a028b7bab6494dd3921094bb3373ca55c0eb2e9cac404429f219ec9cbb',R02/'shaders.mjs':'d21c524bcccd28d2a550bb58fec2cad84891a4fb126db2b18a47774e61fa7cf5',R03/'stability.mjs':'7c9f83b1cd5e9da3bc17774d820bacac342ef2f08253eae45663a4f2893542cc'}
for p,h in locks.items():assert sha(p.read_bytes())==h,str(p)
subprocess.run([sys.executable,str(P/'prepare.py')],check=True)
three=Path(sys.argv[1]).read_text();assert sha(three.encode())=='f7cee3c7533449a1505cc12cb5128b89e3d4fd3d7ea62b05f9f5464a217472ee'
def wrap(name,text):
 names=re.findall(r'export (?:const|function|class)\s+(\w+)',text);text=re.sub(r'^import .*?;\n','',text,flags=re.M)
 return 'const '+name+'=(()=>{\n'+text.replace('export ','')+'\nreturn {'+','.join(names)+'};})();\n'
m=re.search(r'export\s*\{([^}]+)\};?\s*$',three);assert m
exports=[]
for part in m.group(1).split(','):
 pair=part.strip().split(' as ');exports.append(pair[1]+':'+pair[0] if len(pair)==2 else pair[0])
bundle='const THREE=(()=>{'+three[:m.start()]+';return {'+','.join(exports)+'};})();\n'
bundle+=wrap('baseKernel',(R02/'kernel.mjs').read_text())+wrap('old',(R02/'shaders.mjs').read_text())
bundle+=wrap('STAB',(R03/'stability.mjs').read_text().replace("import {vertex,fragment} from '../fiber-r02/shaders.mjs';",'const {vertex,fragment}=old;'))
bundle+=wrap('MOTION',(P/'motion.mjs').read_text())
f=(P/'shaders.mjs').read_text().replace("import {positionFragment,fragment,shadowFragment} from '../fiber-r02/shaders.mjs';",'const {positionFragment,fragment,shadowFragment}=old;').replace("import {stableVertex,layerFragment,nodeRadianceFragment} from '../fiber-r03/stability.mjs';",'const {stableVertex,layerFragment,nodeRadianceFragment}=STAB;')
bundle+=wrap('FAST',f)
a=re.sub(r'^import .*?;\n','',(P/'app.mjs').read_text(),flags=re.M)
a='const {COUNT,SEGMENTS,makeRoots,hashFloats,MATERIALS,halton}=baseKernel;\nconst {stableVertex,nodeRadianceFragment,frontFragment,layerFragment,resolveFragment,STEP_METRES}=STAB;\nconst {FurGuideMotion}=MOTION;\nconst {movingPositionFragment,fastNodeRadianceFragment,fastStableVertex,layer8Fragment,shadowPairFragment,packShadowFragment}=FAST;\n'+a
source=os.environ.get('GITHUB_SHA','local-research');script=bundle+a
h=(P/'index.html').read_text().replace('content="local-research"','content="'+source+'"').replace('<script type="module" src="./app.mjs"></script>','<script>'+script.replace('</script','<\\/script')+'</script>')
(P/'site').mkdir(exist_ok=True);(P/'site/preview.html').write_text(h);(P/'site/runtime.js').write_text(script)
subprocess.run(['node','--check',str(P/'site/runtime.js')],check=True)
manifest={'version':'HAIR-FIBER-R05-M3','source':source,'baseline':'254ff866885e2581156cac8f3956615bfe027944','htmlBytes':len(h.encode()),'htmlSHA256':sha(h.encode()),'rootSignature':'eaadb8b8','strands':10000,'geometrySegments':80,'opticalNodesPerStrand':81,'guides':85,'bendingModes':3,'stepHz':120,'layers':8,'layerDraws':'one on eight-MRT hardware; two on four-MRT hardware','shadowGeometryDraws':3,'physics':'reduced bending modes, not inextensible rod/contact','filmQualityAccepted':False,'hardwareFPSCertified':False,'oldVersionsChanged':False,'files':{n:sha((P/n).read_bytes()) for n in ['motion.mjs','shaders.mjs','bridge.js','prepare.py','build.py','app.mjs','index.html']}}
(P/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
