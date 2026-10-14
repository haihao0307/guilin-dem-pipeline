"""Pinned source composition; output is self-contained and old versions are read-only."""
from pathlib import Path
import re,hashlib,json,os,sys,subprocess
P=Path(__file__).resolve().parent; R02=P.parent/'fiber-r02';R03=P.parent/'fiber-r03'
sha=lambda b:hashlib.sha256(b).hexdigest()
locks={str(R02/'kernel.mjs'):'e6f628a028b7bab6494dd3921094bb3373ca55c0eb2e9cac404429f219ec9cbb',str(R02/'shaders.mjs'):'d21c524bcccd28d2a550bb58fec2cad84891a4fb126db2b18a47774e61fa7cf5',str(R03/'stability.mjs'):'7c9f83b1cd5e9da3bc17774d820bacac342ef2f08253eae45663a4f2893542cc'}
for p,h in locks.items():assert sha(Path(p).read_bytes())==h, p
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
f=(P/'motion-shaders.mjs').read_text().replace("import {positionFragment} from '../fiber-r02/shaders.mjs';",'const {positionFragment}=old;').replace("import {nodeRadianceFragment,stableVertex} from '../fiber-r03/stability.mjs';",'const {nodeRadianceFragment,stableVertex}=STAB;')
bundle+=wrap('FAST',f)
a=(P/'app.mjs').read_text();a=re.sub(r'^import .*?;\n','',a,flags=re.M)
a='const {COUNT,SEGMENTS,makeRoots,hashFloats,MATERIALS,halton}=baseKernel;\nconst {stableVertex,nodeRadianceFragment,frontFragment,layerFragment,resolveFragment,STEP_METRES}=STAB;\nconst {FurGuideMotion}=MOTION;\nconst {movingPositionFragment,fastNodeRadianceFragment,fastStableVertex}=FAST;\n'+a
source=os.environ.get('GITHUB_SHA','local-research');script=bundle+a
h=(P/'index.html').read_text().replace('content="local-research"','content="'+source+'"').replace('<script type="module" src="./app.mjs"></script>','<script>'+script.replace('</script','<\\/script')+'</script>')
(P/'site').mkdir(exist_ok=True);(P/'site/preview.html').write_text(h);(P/'site/runtime.js').write_text(script)
subprocess.run(['node','--check',str(P/'site/runtime.js')],check=True)
manifest={'version':'HAIR-FIBER-R04-FUR1','source':source,'baseline':'a5c4881394ef4e0ac2198fb6f0e4089bfee27605','motionTeacherBuild':'e845835b3e04c56a65c405ff87aece955b161b4d','motionTeacherSource':'f0fa23fc92ae3848be9dca7dd29ac56a0b782b74','teacherAppSHA256':'8515146fbf1e788a70624a8aee47dc9a2a1b597405c9013e057c5b6e5e3f5842','htmlBytes':len(h.encode()),'htmlSHA256':sha(h.encode()),'rootSignature':'eaadb8b8','strands':10000,'geometrySegments':80,'guides':85,'stepHz':120,'spring':33,'damping':8.5,'physics':'bounded guide-tip springs only','temporalReprojection':False,'collisionSolver':False,'filmQualityAccepted':False,'hardwareFPSCertified':False,'nodeRadianceSamples':[21,81],'opticalInterpolationApproximation':True,'changedOldWorkbenches':False,'sourceFiles':{n:sha((P/n).read_bytes()) for n in ['app.mjs','index.html','motion.mjs','motion-shaders.mjs','runtime.fragment.js','prepare.py','build.py']}}
(P/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
