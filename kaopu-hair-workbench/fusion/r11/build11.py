#!/usr/bin/env python3
"""Build R11 from the byte-verified R10 source, exclusively in new r11 path."""
from pathlib import Path
import subprocess,json,re,os,shutil,urllib.request,hashlib,zipfile,importlib.util
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
BASE='d560e03d82bdfff0d4cd70c5383f609567151a30'
PATH='kaopu-hair-workbench/fusion/r10'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def read(path):return git('show',BASE+':'+path).decode()
def rep(s,a,b):
 if s.count(a)!=1:raise RuntimeError(f'Expected 1, found {s.count(a)}: {a[:130]}')
 return s.replace(a,b)
def write(path,s):
 p=OUT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
for source in git('ls-tree','-r','--name-only',BASE,'--',PATH).decode().splitlines():
 rel=Path(source).relative_to(PATH)
 if rel.parts[0] in ['src','vendor','data','licenses'] or (len(rel.parts)==1 and (rel.suffix=='.css' or rel.name=='TEACHER-GROOM-PROVENANCE.json')):
  p=OUT/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(git('show',BASE+':'+source))
for name in ['MakeHumanBrows.js','StrandCore.js','TeacherControls.js']:write('src/'+name,(OUT/name).read_text())
url='https://files2.makehumancommunity.org/asset_packs/eyebrows01/eyebrows01_cc0.zip'
tmp=Path('/tmp/kaopu-r11-eyebrows');tmp.mkdir(exist_ok=True);zf=tmp/'eyebrows.zip'
if not zf.exists():urllib.request.urlretrieve(url,zf)
assert hashlib.sha256(zf.read_bytes()).hexdigest()=='5425891dce613bef85c7117f7843cd49d57d1fb28127e76d77d2a2eaccb4fe78'
with zipfile.ZipFile(zf) as z:
 assert all(not n.startswith('/') and '..' not in Path(n).parts for n in z.namelist());z.extractall(tmp/'src')
spec=importlib.util.spec_from_file_location('extract_brows',OUT/'extract_brows.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.extract(tmp/'src',OUT/'data')
for repo,rev,label in [('digital-salon/Digital-Salon','4aacd4913a48d0b32012a672da2b35f27fc8f171','DIGITAL-SALON'),('c-he/perm','5885a2ab66f128d7f0acb88c4518b21b7b4ad9cb','PERM')]:
 license=urllib.request.urlopen(f'https://raw.githubusercontent.com/{repo}/{rev}/LICENSE',timeout=30).read().decode();assert license.startswith('MIT License');write(f'licenses/{label}-MIT.txt',license)
write('licenses/MAKEHUMAN-BROWS.txt','Mindfront (Sweden), MakeHuman Community Eyebrows01, CC0. Original meshes explicitly contain # license CC0. Source pack SHA256 and per-OBJ digests: data/BROW_PROVENANCE.json. Ordered triangular cross-sections were reduced to centrelines and retargeted to the GNM surface; no MakeHuman head mesh is shipped. Original authorship remains acknowledged.\n')
hair=(OUT/'src/HairLayer.js').read_text()
hair="import {sampleTriangle,DETAIL_DEFAULTS,applyDetailLayer} from './StrandCore.js';\n"+hair
hair=rep(hair,'const u=Math.sqrt(rng()),v=rng();b=[1-u,u*(1-v),u*v];','b=sampleTriangle(rng);')
a='  for(let i=0;i<count;i++)for(let j=0;j<per;j++){const q=i*per+j,a=(i*per+Math.max(0,j-1))*3'
hair=rep(hair,a,'  applyDetailLayer(this);\n'+a)
a='  const regionChanged=setFusion(patch);'
b="  const beforeDetail=JSON.stringify(this.detailOptions||DETAIL_DEFAULTS);this.detailOptions={...(this.detailOptions||DETAIL_DEFAULTS)};for(const k of Object.keys(DETAIL_DEFAULTS))if(Number.isFinite(patch[k]))this.detailOptions[k]=patch[k];const detailChanged=beforeDetail!==JSON.stringify(this.detailOptions);\n"+a
hair=rep(hair,a,b)
a="(styleChanged||regionChanged.some(k=>['hairSideLength','hairNapeLength','hairFlyaways'].includes(k))||['length','volume','frizz'].some(changed))"
hair=rep(hair,a,"(detailChanged||styleChanged||regionChanged.some(k=>['hairSideLength','hairNapeLength','hairFlyaways'].includes(k))||['length','volume','frizz'].some(changed))")
write('src/HairLayer.js',hair)
main=(OUT/'src/experiment.js').read_text()
main="import {MakeHumanBrows} from './MakeHumanBrows.js';\nimport {BROW_LIBRARY} from '../data/BrowData.js';\nimport {TEACHER_CONTROLS,TEACHER_DEFAULTS} from './TeacherControls.js';\nimport {encodeStrand,buildSpringTopology} from './StrandCore.js';\nlet makeBrows=null;\n"+main
main=rep(main,"installFusionUI();\nlet groom=","Object.assign(DEFAULT_GROOM,TEACHER_DEFAULTS);installFusionUI();installTeachersUI();\nlet groom=")
a=" syncLegacyLighting();editorDepth++;setRadiusMode(state.radiusMode);applyHair();applyBrows();applyBeard();applyVisibility();editorDepth--;"
b=" makeBrows=new MakeHumanBrows(model,positions,normals);scene.add(makeBrows.mesh);configureFiber(makeBrows.mesh,'brows');\n"+a
main=rep(main,a,b)
main=rep(main,"teacherMeshes[1].visible=groom.browsVisible;","teacherMeshes[1].visible=groom.browsVisible&&groom.browsModel===0;if(makeBrows)makeBrows.mesh.visible=groom.browsVisible&&groom.browsModel>0;")
main=rep(main,"function applyBrows(){","function applyBrows(){\n applyLibraryBrows();")
main=rep(main,"legacyFace.update(positions,normals);state.case=which;","legacyFace.update(positions,normals);makeBrows?.update(positions,normals);state.case=which;")
main=rep(main,"function syncEditorUI(){","function syncEditorUI(){\n syncTeachersUI();")
main=rep(main,"legacyFace=null;materialPairs.length=0;","legacyFace=null;makeBrows=null;materialPairs.length=0;")
main=rep(main,"else if(key.endsWith('Visible'))","else if(key==='browsModel'){if(!Number.isInteger(v)||v<0||v>14)throw Error('Invalid eyebrow style');next[key]=v;}else if(key.endsWith('Visible'))")
main=rep(main,"let sceneComplete=false;",(OUT/'teacher-runtime.js').read_text()+"\nlet sceneComplete=false;")
main=rep(main,"window.groomStudy={fusionDiagnostics,","window.groomStudy={teachersDiagnostics,guidePacket,browCamera,fusionDiagnostics,")
a=" const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));"
b=" if(groom.browsVisible&&groom.browsModel>0&&makeBrows){for(let i=0;i<makeBrows.count;i++){if(!makeBrows.selected[i])continue;points.push(...makeBrows.positions.subarray(i*makeBrows.per*3,i*makeBrows.per*3+3));colors.push(.9,.5,.95)}}\n"+a
main=rep(main,a,b)
main=main.replace('R10.0','R11.0').replace('R10 默认','R11 默认').replace('R10 参数','R11 参数').replace('R10 存档','R11 存档').replace('有效的 R10','有效的 R11').replace('fusion.r10','fusion.r11').replace('kaopu-hair-r10.json','kaopu-hair-r11.json')
write('src/experiment.js',main)
html=read(PATH+'/index.html').replace('R10.0','R11.0').replace('R10','R11')
html=html.replace('原自然眉','自然浓度').replace('沿老师原眉毛方向裁剪；发根继续绑定真实皮肤','新增 14 款 Mindfront 原眉丝与分区形态控制；也可切回 R9 原老师眉毛。').replace('data-wb-back href="../../../kaopu-human-overview/"','data-wb-back href="https://haihao0307.github.io/guilin-dem-pipeline/kaopu-human-overview/"')
write('index.html',html)
imports=json.loads(re.search(r'<script type="importmap">(.*?)</script>',html).group(1))['imports'];imports={k:'./'+str((OUT/v.split('?')[0]).relative_to(ROOT)) for k,v in imports.items()}
write('bundle.mjs',"import esbuild from 'esbuild';import fs from 'node:fs';const result=await esbuild.build({entryPoints:['"+str((OUT/'src/experiment.js').relative_to(ROOT))+"'],bundle:true,format:'esm',write:false,minify:true,target:'es2022',legalComments:'inline',alias:"+json.dumps(imports)+"});fs.writeFileSync('"+str((OUT/'bundle.js').relative_to(ROOT))+"',result.outputFiles[0].text);\n")
package=read(PATH+'/package.py')
write('package.py',package.replace("code=(p/'bundle.js').read_text()","code='/*!\\n'+(p/'licenses/PERM-MIT.txt').read_text()+'\\n'+(p/'licenses/DIGITAL-SALON-MIT.txt').read_text()+'\\n*/\\n'+(p/'bundle.js').read_text()"))
write('BUILD_MANIFEST.json',json.dumps({'version':'R11.0','baseRevision':BASE,'sourceRevision':os.getenv('GITHUB_SHA','local'),'source':'R3+R9 verified R10 plus selected MakeHuman / Perm / Digital Salon adaptations','oldPathsModified':False,'oneScene':True,'singleHead':True,'eyebrowLibraryStyles':14,'eyebrowSourceStrands':23087,'permNeuralModelRunning':False,'cudaSolverRunning':False,'physics':False,'ten24Loaded':False,'productionAccepted':False,'publicBrowserVerified':False},indent=2))
print('R11 source build complete; old R3/R9/R10 are unchanged')
