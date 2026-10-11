#!/usr/bin/env python3
"""Reproducible R10 integration. Only this new directory is written.
All source reads use the frozen git revision, never the current moving Pages.
"""
from pathlib import Path
import subprocess, shutil, hashlib, json, re, os
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
BASE='40861390bb57673c677a08d5216286d2dcbcf4da'
R3='kaopu-hair-workbench/qa/isolated-groom-r03'
R9='kaopu-hair-workbench/qa/gnm-groom-editor'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def read(path):return git('show',BASE+':'+path).decode()
def write(path,s):
 p=OUT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
def rep(s,a,b,n=1):
 if s.count(a)!=n:raise RuntimeError(f'Patch anchor expected {n}, got {s.count(a)}: {a[:110]}')
 return s.replace(a,b)
# Copy the actual R9 implementation, not a screenshot or an iframe.
paths=git('ls-tree','-r','--name-only',BASE,'--',R9).decode().splitlines()
for path in paths:
 rel=Path(path).relative_to(R9)
 if rel.parts[0] in ['src','vendor','data','licenses'] or (len(rel.parts)==1 and rel.suffix in ['.css','.json','.md']):
  p=OUT/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(git('show',BASE+':'+path))
fields=(OUT/'FusionFields.js').read_text().replace('Math.exp(-((z+.002)/.046)**2)','Math.exp(-(((z+.002)/.046)**2))')
write('FusionFields.js',fields);write('src/FusionFields.js',fields)
# Same material / opacity layer for the retained R3 top and the R9 teacher.
for name in ['FiberMaterial.js','HairOpacityShadows.js']:
 write('src/'+name,read(R3+'/src/'+name))
region=read(R3+'/src/RegionFields.js')
region=rep(region,'(y-.274)/.032,(z-.017)/.024','(y-.274)/.031,(z-.017)/.023')
region=rep(region,'(d-1.06)*.024*lateral','(d-1.025)*.023*lateral')
# Weighted union removes square density cuts between jaw/cheek/chin regions.
region=rep(region,"return zones.reduce((a,b)=>b.weight>a.weight?b:a,{weight:0,zone:0});", "const best=zones.reduce((a,b)=>b.weight>a.weight?b:a,{weight:0,zone:0});return {zone:best.zone,weight:1-zones.reduce((a,b)=>a*(1-Math.min(1,b.weight)),1)};")
write('src/RegionFields.js',region)
hair=read(R3+'/src/RefinedHairLayer.js')
hair="import {fusion,setFusion,regionalDensity,regionalLength,shortDirection} from './FusionFields.js';\n"+hair
hair=rep(hair,"const edge=smooth(.0002,.007,this.safetyMargin(p)-options.hairlineHeight*.006*this.frontWeight(p));", "const edge=regionalDensity(p,this.safetyMargin(p)-options.hairlineHeight*.006*this.frontWeight(p));")
hair=rep(hair,"if(style==='swept-back')direction=", "if(style==='short-crop')return shortDirection(p,progress,r);\n  if(style==='swept-back')direction=")
hair=rep(hair,"part=-.027+.045*rootZ", "part=-.027+fusion.hairPart*.0003+.045*rootZ")
hair=rep(hair,"const gather=Math.sin(Math.PI*progress)*.34;", "const gather=Math.sin(Math.PI*progress)*fusion.hairClump/100;")
hair=rep(hair,"const wx=x-.018,wz=z+.028,wd=Math.hypot(wx,wz),whorl=.94*", "const wx=x-(.018+fusion.hairWhorlX*.00025),wz=z-(-.028+fusion.hairWhorlZ*.00025),wd=Math.hypot(wx,wz),whorl=fusion.hairWhorl/100*")
hair=rep(hair,"f=j/segments*length/maxLength*binding.guideEnds[i]", "f=j/segments*Math.min(1,length/maxLength*regionalLength(binding.templateRoots.subarray(i*3,i*3+3)))*binding.guideEnds[i]")
hair=rep(hair,"(.0015+.0025*r2)*s*s:0", "(.0015+.0025*r2)*s*s*fusion.hairFlyaways/25:0")
hair=rep(hair,"setAppearance(patch={}){\n  const previous=", "setAppearance(patch={}){\n  const regionChanged=setFusion(patch);const signature=JSON.stringify([fusion.hairPart,fusion.hairWhorlX,fusion.hairWhorlZ,fusion.hairWhorl,fusion.hairShortFlow,fusion.hairClump]);const flowChanged=this.fusionFlowSignature!==signature;this.fusionFlowSignature=signature;if(flowChanged)this.binding.guideCache.clear();\n  const previous=")
hair=rep(hair,"styleChanged=changed('style');", "styleChanged=changed('style')||flowChanged;")
hair=rep(hair,".some(changed))this.applyDrawRange();", ".some(changed)||regionChanged.length)this.applyDrawRange();")
hair=rep(hair,"if(styleChanged||changed('length'))this.prepareSupports();", "if(styleChanged||changed('length')||regionChanged.length)this.prepareSupports();")
hair=rep(hair,"(styleChanged||['length','volume','frizz'].some(changed))", "(styleChanged||regionChanged.length||['length','volume','frizz'].some(changed))")
write('src/HairLayer.js',hair)
face=read(R3+'/src/FacialHairLayer.js')
face="import {fusion,setFusion,beardDirection,beardBoundary} from './FusionFields.js';\n"+face
face=rep(face,"return beardField(p).weight;", "return beardBoundary(beardField(p).weight,p);")
# Guides must not stop at an arbitrary argmax label seam inside continuous skin.
face=rep(face,"guideMask(p,root){if(this.name==='beard'&&beardField(p).zone!==this.rootKinds[root])return 0;return this.mask(p);}", "guideMask(p,root){return this.mask(p);}")
face=rep(face,"isMoustache?[sign*.45,-.85,0]:zone===3?[sign*.25,-1,-.12]:[sign*.06,-1,0]", "beardDirection(p,zone)")
face=rep(face,"let accepted=0,attempts=0;", "const spacing=.00045,grid=new Map(),gridKey=(x,y,z)=>x+','+y+','+z;const tooClose=p=>{if(this.name==='brows')return false;const c=p.map(v=>Math.floor(v/spacing));for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const q of grid.get(gridKey(c[0]+x,c[1]+y,c[2]+z))||[])if(Math.hypot(...p.map((v,k)=>v-q[k]))<spacing)return true;return false};\n  let accepted=0,attempts=0;")
face=rep(face,"if(rng()>this.mask(p))continue;", "if(rng()>this.mask(p)||tooClose(p))continue;if(this.name==='beard'){const key=gridKey(...p.map(v=>Math.floor(v/spacing)));if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p)}")
face=rep(face,"length*(.48+.62*this.random[i])*medialFeather", "length*(this.name==='brows'?(.48+.62*this.random[i]):(.78+(this.random[i]-.5)*(.25+fusion.beardVariation*.008)))*medialFeather")
face=rep(face,"for(let a=0;a<3;a++)this.latestPoints[q*3+a]=surface[a]+normal[a]*lift;", "const lateral=normalize(cross(normal,sub(b,a))),curl=this.name==='beard'?fusion.beardCurl*.0000025*Math.sin(s*10+this.random[i]*19)*s*s*Math.min(1,this.options.length/.004):0;\n   for(let a=0;a<3;a++)this.latestPoints[q*3+a]=surface[a]+normal[a]*lift+lateral[a]*curl;")
face=rep(face,"const oldLength=this.options.length;", "const oldLength=this.options.length,regionalChanged=setFusion(patch).some(k=>k.startsWith('beard'));")
face=rep(face,"if(oldLength!==this.options.length){", "if(oldLength!==this.options.length||regionalChanged){")
write('src/FacialHairLayer.js',face)
main=read(R9+'/src/experiment.js')
main="import {CONTROL_GROUPS,FUSION_DEFAULTS,fusion,setFusion,regionWeights} from './FusionFields.js';\n"+main
main=rep(main,"let groom={...DEFAULT_GROOM},panel='hair';", "Object.assign(DEFAULT_GROOM,FUSION_DEFAULTS,{style:'side-sweep',hairLength:82,hairVolume:75,beardWidth:90});installFusionUI();\nlet groom={...DEFAULT_GROOM},panel='hair';")
main=rep(main,"target=new THREE.Vector3(0,.24,.025)", "target=new THREE.Vector3(0,.265,.025)")
main=rep(main,"scene.add(new THREE.HemisphereLight(0xffffff,0x393130,.35))", "scene.add(new THREE.HemisphereLight(0xffffff,0x393130,.8))")
main=rep(main,"state.shadowFilter==='wide'?THREE.PCFShadowMap:THREE.PCFSoftShadowMap", "THREE.PCFShadowMap")
main=rep(main,"l.shadow.radius=1.5;", "l.shadow.radius=12;")
main=rep(main,"legacyHair=new LegacyHairLayer(model,positions,normals);legacyFace=new LegacyFacialLayer(model,positions,normals);", "legacyHair=new LegacyHairLayer(model,positions,normals,{count:fusionQuality(),segments:fusionQuality()>=64000?16:12,seed:724,volume:.018,frizz:.00015});legacyFace=new LegacyFacialLayer(model,positions,normals,{beard:{count:7200,segments:9}});")
main=rep(main,"addRadiusAttribute(legacyHair.mesh,.00028)", "addRadiusAttribute(legacyHair.mesh,fusionQuality()>=64000?.00005:.000075)")
main=rep(main,"name==='brows'?.00015:.00012", "name==='brows'?.000055:.000065")
main=rep(main,"setRadiusMode(state.radiusMode);applyVisibility();editorDepth--;", "setRadiusMode(state.radiusMode);applyHair();applyBrows();applyBeard();applyVisibility();editorDepth--;")
main=rep(main,"legacyHair.setAppearance({style:groom.style", "legacyHair.setAppearance({...groom,frizz:groom.hairFrizz*.0000125,style:groom.style")
main=rep(main,"volume:groom.hairVolume/100*.012", "volume:groom.hairVolume/100*.024")
main=rep(main,"applyVisibility();renderer.shadowMap.needsUpdate=true;\n}\nfunction applyBrows()", "refreshFusionRadii();applyVisibility();renderer.shadowMap.needsUpdate=true;\n}\nfunction applyBrows()")
main=rep(main,"legacyFace.setAppearance('beard',{visible:groom.beardVisible", "legacyFace.setAppearance('beard',{...groom,zoneCoverage:[groom.chinCoverage,groom.moustacheCoverage,groom.beardJawCoverage,groom.beardCheekCoverage,groom.beardSideburnCoverage].map(v=>v/100),visible:groom.beardVisible")
main=rep(main,"{color:groom.beardColor,radiusScale:groom.beardWidth/100});applyVisibility();", "{color:groom.beardColor,roughness:groom.beardRoughness/100,radiusScale:groom.beardWidth/100});refreshFusionRadii();applyVisibility();")
main=rep(main,"legacyFace.regions.beard.mesh.visible=groom.beardVisible;", "legacyFace.regions.beard.mesh.visible=groom.beardVisible;if(rootsVisible)refreshFusionRoots();")
main=rep(main,"function setStyle(name){if(!HAIR_STYLES.includes(name))throw Error('Unknown hair style');groom.style=name;applyHair();syncUI();render();}", "function setStyle(name){if(!HAIR_STYLES.includes(name))throw Error('Unknown hair style');const short=['side-sweep','swept-back','short-crop'].includes(name);setGroom({style:name,hairLength:short?(name==='short-crop'?72:82):100,hairVolume:name==='short-crop'?18:75});}")
main=rep(main,"function resetAll(){batch(()=>{setRotate(false);", "function resetAll(){rootsVisible=false;refreshFusionRoots();batch(()=>{setRotate(false);")
main=rep(main,"const short=['side-sweep','swept-back','short-crop'].includes(groom.style);", "const short=['side-sweep','swept-back','short-crop'].includes(groom.style);$('fusionRegions').querySelectorAll('input').forEach(el=>el.disabled=!short||!ready);")
main=rep(main,"version:'GNM groom editor r9 / accepted R8 shading'", "version:'R10.0 R3+R9 fusion',fusion:fusionDiagnostics()")
main=rep(main,"let sceneComplete=false;", (OUT/'fusion-runtime.js').read_text()+"\nlet sceneComplete=false;")
main=rep(main,"window.groomStudy={get ready()", "window.groomStudy={fusionDiagnostics,fusionCamera,setRoots,fusionSnapshot,loadFusionSnapshot,get ready()")
main=main.replace('原 R8 质感已载入 · 选发型或切换眉毛、胡须开始调整','R10.0 融合版 · R3 分区短发 / R9 老师长发 / 五区胡须').replace('原 R8 质感已载入 · 可旋转并调整毛发','R10.0 融合版已载入 · 可调整分区、发根与胡须').replace('已恢复原 R8 发束、颜色、灯光与视角','已恢复 R10 默认侧梳与灯光').replace('真实头皮三角面上的分区短发 · 与原长发共用 R8 材质与投影','R3 区域发根 + 连续短发流向 · 与 R9 长发共用头部、材质和编辑器')
write('src/experiment.js',main)
html=read(R9+'/experiment.html').replace('<title>人 · 发型与毛发编辑</title>','<title>KAOPU · R10 人物毛发融合工作台</title>')
html=html.replace('<details id="legacyStyles">','<details id="legacyStyles" open>').replace('旧短发结构对照 · 外观待改进','R3 融合短发 · 主要测试入口').replace('保留三种真实头皮短发练习；发际线和整体外观尚未达到当前长发质量','保留侧梳、后梳头顶质感；修正短发流向，增加耳周、后颈和左右分区。').replace('恢复 R8 默认','恢复 R10 默认')
html=html.replace('当前支持上唇与下巴两个真实皮肤区域；不包含脸颊络腮胡','五区真实皮肤发根：上唇、下巴、下颌、脸颊、鬓须。区界连续融合，嘴唇保持避让。').replace('胡须覆盖仅限上唇与下巴。','R10 胡须扩展为五个连续区域；具体自然度待本轮视觉验收。')
html=html.replace('min="45" max="100" step="1" value="100"','min="45" max="100" step="1" value="82"',1)
for old,new in [('../gnm-opacity-experiment/experiment.html','https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/qa/gnm-opacity-experiment/experiment.html'),('../gnm-study/','https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/qa/gnm-study/')]:html=html.replace(old,new)
html=html.replace('原曲线仍有少量发根半径接触未达标。','R10 是融合测试版，不是影视质量完成声明。原曲线仍有少量发根半径接触未达标。')
write('index.html',html)
# Bundle by the existing import map. No runtime build, iframe, or login required.
imports=json.loads(re.search(r'<script type="importmap">(.*?)</script>',html).group(1))['imports']
imports={key:'./'+str((OUT/value.split('?')[0]).relative_to(ROOT)) for key,value in imports.items()}
write('bundle.mjs',"import esbuild from 'esbuild';import fs from 'node:fs';\nconst aliases="+json.dumps(imports)+";\nconst result=await esbuild.build({entryPoints:['"+str((OUT/'src/experiment.js').relative_to(ROOT))+"'],bundle:true,format:'esm',write:false,minify:true,target:'es2022',alias:aliases});fs.writeFileSync('"+str((OUT/'bundle.js').relative_to(ROOT))+"',result.outputFiles[0].text);\n")
write('finalize.py',(OUT/'package.py').read_text())
write('BUILD_MANIFEST.json',json.dumps({'version':'R10.0','baseRevision':BASE,'sourceRevision':os.getenv('GITHUB_SHA','local'),'sources':{'R3':R3,'R9':R9},'oldPathsModified':False,'oneScene':True,'singleHead':True,'physics':False,'ten24Loaded':False,'productionAccepted':False,'publicBrowserVerified':False,'licenses':'GNM and teacher source provenance retained; no Houdini/MetaHuman proprietary code copied'},indent=2))
write('RESEARCH.md','''# R10 learned methods and implementation mapping
Checked 2026-10-11; official primary sources only. No closed commercial code copied.

- Houdini localized guide groom / skin attributes / generate / deform separation: https://www.sidefx.com/docs/houdini/fur/workflow.html -> preserved genuine skin triangle+barycentric binding; independent regional density, flow, length, frizz and root taper.
- Houdini skin collision-aware editing: https://www.sidefx.com/docs/houdini/nodes/sop/guidegroom.html -> preserved supported surface walks and lip/eye masks. This does NOT implement VDB collision or Vellum dynamics.
- Blender interpolation and minimum-distance root distribution: https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/hair/generation/interpolate_hair_curves.html -> retained R3 follicular unit roots, added minimum-distance beard roots, retained R9 teacher source island binding.
- MetaHuman regional bangs/top/sides/back/sideburns and region blending: https://dev.epicgames.com/documentation/metahuman/mh-groom-hairstyle-generator -> independent regional controls; continuous short directional field; continuous beard mask union instead of argmax seams.
- Original artist curves: Daniel Bystedt, Blender Hair Styles demo, CC BY-SA, provenance preserved. https://www.blender.org/download/demo-files/

## What changed in code
R3 RefinedHairLayer replaces R9 old scalp only in this directory. R3 extended five-zone facial layer replaces the old two-zone R9 facial layer. R9 TeacherGroomBinding, TeacherGroomEditor and original eyebrow guides remain. R3 optical material and shadow module are shared. The old two directories are byte-for-byte untouched.
The old short field combined opposed front/back vectors and rounded clump cells. Short flow now uses a continuous off-centre crown field, regional downward flow, no rounded cells. R3 side-sweep/swept-back direction and volume are retained except controllable regional length, margins and the ear exclusion adjustment.
The old beard guideMask stopped at an argmax region label, creating clipped internal boundaries. Now guides can cross adjacent valid beard zones while retaining eye/lip and skin constraints. Density/length/width and tangent-plane irregularity are separately controlled.

## Deliberate boundaries
Not a complete reproduction of Houdini, Blender, MetaHuman, Marschner scattering, dynamic hair contacts or biological follicle segmentation. Region masks are calibrated grooming fields on the fixed GNM template, not universal anatomy. 96k is a high-memory near-view setting; 64k and 36k presets are provided, without hardware FPS claims. TEN24 original female asset is not substituted or falsely advertised as loaded. Other animal/fur/shell experiments are reference-only, not layered on a human head.
''')
write('README.md','''# R10.0 R3 + R9 unified human grooming candidate
New path only. Frozen source: 40861390bb57673c677a08d5216286d2dcbcf4da.

One real GNM head, one renderer, six hairstyle presets, R9 teacher brows and R3 expanded five-zone beard. Default: R3 side-sweep. Root inspection, top/ear/nape/beard cameras, regional density and direction, per-region length, taper, beard irregularity, schema-checked local save/restore/import/export.

Open public-lite.html through the delivered fixed-commit public preview. It contains the bundled JS/CSS, but fetches SHA-verified GNM head and sampler assets from the original fixed public source; it is not an offline asset package.

Reproduce: python kaopu-hair-workbench/fusion/r10/build.py ; node kaopu-hair-workbench/fusion/r10/bundle.mjs ; python kaopu-hair-workbench/fusion/r10/finalize.py . esbuild is required for bundling.

See RESEARCH.md and BUILD_MANIFEST.json. See evidence after Actions for the actual tested build. Inherited old tests do not certify new bytes. Old R3/R9/other workbench routes are not overwritten. Do not merge this branch automatically.
''')
print('R10 fusion sources built at',OUT)
