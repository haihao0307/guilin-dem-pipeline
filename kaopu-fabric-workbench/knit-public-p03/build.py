from pathlib import Path
import hashlib,json,os,re,shutil,subprocess,urllib.request

ROOT=Path(__file__).resolve().parent
P02=ROOT.parent/'knit-public-p02'
if not (P02/'main.mjs').exists():
    raise FileNotFoundError('P02 source baseline is required')

for name in ('main.mjs','template.html','jacket-refined.mjs','THIRD_PARTY_NOTICES.txt'):
    shutil.copy2(P02/name,ROOT/name)

s=(ROOT/'main.mjs').read_text()
parent_hash=hashlib.sha256(s.encode()).hexdigest()
def rep(a,b,n=1):
    global s
    count=s.count(a)
    if count!=n: raise AssertionError((a[:120],count,n))
    s=s.replace(a,b)

rep("import {makeJacket,shadeFlyaways} from './jacket-refined.mjs';","import {shadeFlyaways} from './jacket-refined.mjs';\nimport {softenCarrierMaterial,makeWoolEnvelope} from './wool-envelope.mjs';")
rep("const VERSION='KNIT-PUBLIC-P02';","const VERSION='KNIT-PUBLIC-P03';")
s=s.replace('kaopu:knit:public:p02','kaopu:knit:public:p03')
rep("const settings={fuzz:1,length:.95,detail:1,twist:.55,mottle:.18,pattern:'plain',color:'#d3c4af',shape:'jersey',mode:'fiber'};","const settings={fuzz:1.18,length:1.15,detail:1.12,twist:.46,mottle:.24,pattern:'plain',color:'#c7b59e',shape:'jersey',mode:'fiber'};")
rep('let shaders=[],jacket=null,activeView="whole";','let shaders=[],jacket=null,wool=null,activeView="whole";')
rep(" const wx=(c-(cols-1)/2+p[0])*pitch,wy=(r-(rows-1)/2)*spacing+p[1]*pitch;\n let wz=p[2]*pitch;", " const id=r*cols+c,jx=(hash(id*149+11)-.5)*.14,jy=(hash(id*233+17)-.5)*.18;\n const tensionX=.96+.08*hash(id*307+19),tensionY=.95+.10*hash(id*401+23);\n const wx=(c-(cols-1)/2+jx+p[0]*tensionX)*pitch,wy=(r-(rows-1)/2+jy)*spacing+p[1]*pitch*tensionY;\n let wz=p[2]*pitch*(.94+.12*hash(id*503+29));\n wz+=.00022*Math.sin(t*TAU*(1.65+1.35*hash(id*607+31))+hash(id*701+37)*TAU)*Math.sin(Math.PI*t);")
rep("    const a=j/sides*TAU,tw=a+t*TAU*2.8*settings.twist;\n    const irregular=1+.055*Math.cos(3*tw)+.022*Math.sin(5*a+phase+t*11);\n    const n=B.clone().multiplyScalar(Math.cos(a)).addScaledVector(N,Math.sin(a));\n    const v=p.clone().addScaledVector(n,radius*breathing*irregular);\n    positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);uvs.push(t*9+hash(id)*.1,j/sides);colors.push(col.r,col.g,col.b);", "    const a=j/sides*TAU,tw=a+t*TAU*2.8*settings.twist,cb=Math.cos(a),sn=Math.sin(a);\n    const slow=Math.sin(t*(13.7+hash(id*809+41)*8.3)+phase),fine=Math.sin(t*(37.1+hash(id*907+43)*14.7)+phase*2.1);\n    const rb=radius*breathing*(.94+.060*Math.cos(3*tw)+.035*slow+.018*fine);\n    const rn=radius*breathing*(.76+.065*Math.sin(2*tw+phase)+.040*slow-.015*fine);\n    const n=B.clone().multiplyScalar(cb/Math.max(rb,1e-6)).addScaledVector(N,sn/Math.max(rn,1e-6)).normalize();\n    const v=p.clone().addScaledVector(B,cb*rb).addScaledVector(N,sn*rn);\n    positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);uvs.push(t*9+hash(id)*.1,j/sides);colors.push(col.r,col.g,col.b);")
rep('  for(let h=0;h<960;h++){','  for(let h=0;h<0;h++){')
pattern=r" const material=new THREE\.MeshPhysicalMaterial\([\s\S]*? material\.customProgramCacheKey=\(\)=>VERSION;"
replacement=" const material=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.97,metalness:0,sheen:.72,sheenColor:new THREE.Color('#e8ddc9'),sheenRoughness:1,ior:1.36,specularIntensity:.18,side:THREE.DoubleSide});\n shaders=[];\n softenCarrierMaterial(material,{uniforms,version:VERSION});"
s,new_count=re.subn(pattern,replacement,s,count=1)
if new_count!=1: raise AssertionError(('carrier material block',new_count))
rep(" if(mesh){group.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}"," if(wool){wool.dispose();wool=null;}\n if(mesh){group.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}")
rep(" mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);\n jacket?.dispose();jacket=makeJacket({cols,rows,radius,frame,hash,colorAt,settings,uniforms,store,lighting});group.add(jacket.mesh);", " mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);\n wool=makeWoolEnvelope({geometry,cols,rows,radius,frame,hash,colorAt,settings,uniforms,store,lighting});group.add(wool.group);jacket=null;")
rep('vertices=positions.length/3;triangles=indices.length/3+hairCount*8;builds++;buildMs=performance.now()-start;building=false;',"vertices=positions.length/3;triangles=indices.length/3+hairCount*8+(wool?.report().triangles||0);builds++;buildMs=performance.now()-start;building=false;")
rep(" $('counts').textContent=`${cols*rows} 针目 · 30,720 贴伏长纤维 + ${hairCount.toLocaleString()} 短绒`;"," const wr=wool?.report();$('counts').textContent=`${cols*rows} 针目 · ${wr?.stapleFibres.toLocaleString()||0} 包覆纤维 + ${wr?.haloFibres.toLocaleString()||0} 绒毛`;" )
rep("function applyMode(){const on=settings.mode==='fiber';uniforms.fuzz.value=on?settings.fuzz:0;uniforms.detail.value=on?settings.detail:0;if(fur)fur.visible=on;if(jacket)jacket.mesh.visible=on;if(mesh){mesh.material.sheen=on?1:0;mesh.material.roughness=on?.88:.50;}dirty=true;}","function applyMode(){const on=settings.mode==='fiber';uniforms.fuzz.value=on?settings.fuzz:0;uniforms.detail.value=on?settings.detail:0;if(fur)fur.visible=false;if(jacket)jacket.mesh.visible=false;if(wool)wool.setVisible(on);if(mesh){mesh.material.sheen=on?.72:0;mesh.material.roughness=on?.97:.56;mesh.material.color.setScalar(on?.80:1);}dirty=true;}")
rep("v<0||v>1.6","v<0||v>1.8")
rep("settings.mode==='fiber'?'贴伏纤维层 + 短绒（P02）':'关闭细节的载纱对照（不是原生 R15）'","settings.mode==='fiber'?'有限长度羊毛包覆 + 强化短绒（P03）':'关闭包覆层的载纱对照（不是原生 R15）'")
rep('hairCount,jacket:jacket?.report(),lighting:', 'hairCount,jacket:null,woolEnvelope:wool?.report(),lighting:')
rep("$('status').textContent='交互已就绪 · 公共独立样片';","$('status').textContent='交互已就绪 · P03 羊毛包覆候选';")
(ROOT/'main.mjs').write_text(s)

t=(ROOT/'template.html').read_text()
t=t.replace('KNIT PUBLIC P02','KNIT PUBLIC P03').replace('PUBLIC P02','PUBLIC P03').replace('PUBLIC-P02','PUBLIC-P03')
t=t.replace('毛线表面 · P02','羊毛包覆 · P03')
t=t.replace('检查贴伏纤维、短绒覆盖与轮廓。<br>直接拖动旋转，滚轮靠近；不加雾或模糊。','检查有限长度包覆纤维、绒毛密度与柔软轮廓。<br>不使用雾、Bloom 或参考图贴片；可近看纱体是否仍像硬绳。')
t=t.replace('短绒覆盖 <output data-output="fuzz">0.82</output><input aria-label="短绒覆盖" data-param="fuzz" type="range" min="0" max="1" step=".02" value=".82"','羊毛包覆 <output data-output="fuzz">1.18</output><input aria-label="羊毛包覆" data-param="fuzz" type="range" min="0" max="1.35" step=".01" value="1.18"')
t=t.replace('绒毛长度 <output data-output="length">0.85</output><input aria-label="绒毛长度" data-param="length" type="range" min=".1" max="1.6" step=".05" value=".85"','绒毛长度 <output data-output="length">1.15</output><input aria-label="绒毛长度" data-param="length" type="range" min=".1" max="1.8" step=".05" value="1.15"')
t=t.replace('纱体细节 <output data-output="detail">0.85</output><input aria-label="纱体细节" data-param="detail" type="range" min="0" max="1.4" step=".05" value=".85"','包覆细节 <output data-output="detail">1.12</output><input aria-label="包覆细节" data-param="detail" type="range" min="0" max="1.4" step=".04" value="1.12"')
t=t.replace('捻度 <output data-output="twist">0.55</output><input aria-label="捻度" data-param="twist" type="range" min=".1" max="1.2" step=".05" value=".55"','捻度 <output data-output="twist">0.46</output><input aria-label="捻度" data-param="twist" type="range" min=".1" max="1.2" step=".04" value=".46"')
t=t.replace('value="#b8a284"','value="#c7b59e"').replace('混色纤维 <output data-output="mottle">0.18</output>','混色纤维 <output data-output="mottle">0.24</output>').replace('value=".18"></label>','value=".24"></label>')
t=t.replace('检查贴伏纤维、短绒覆盖与轮廓。','检查羊毛包覆、短绒密度与轮廓。')
t=t.replace('纤维表面 + 短绒','有限长度羊毛包覆 + 强化短绒')
t=t.replace('正在生成线圈与纤维','正在生成包覆纤维与绒毛层')
t=t.replace('本页是新写的独立材质样片，不含私有 R15 / R01.2 代码、数据表或模型。静态布片不提供布料物理；针目为外观研究路径，不能直接用于织机。配色花纹不是实体麻花。参数保存在当前浏览器；材质重置不会重置 EB1。尚未认证影视级效果或实机性能。','本页从公开 P02 隔离派生，不含私有 R15 / R01.2 代码、数据表或模型。P03 将连续规则细线改为重叠的有限长度羊毛纤维，并增加稳定绒毛层；静态布片不提供布料物理。参数保存在当前浏览器；材质重置不会重置 EB1。当前仍是视觉候选，未声明影视级、用户通过或实机性能。')
(ROOT/'template.html').write_text(t)

subprocess.run(['npm','install','--no-audit','--no-fund','--no-save','three@0.180.0','esbuild@0.25.10'],cwd=ROOT,check=True)
url='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/7dcbcaeaf20af630195e1be2c6ff7ec8ba63467f/lighting/eb1/eb1.js'
b=urllib.request.urlopen(url,timeout=30).read();eb1_hash=hashlib.sha256(b).hexdigest();assert eb1_hash=='39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572';(ROOT/'eb1-public.js').write_bytes(b)
subprocess.run(['node','--check','main.mjs'],cwd=ROOT,check=True)
subprocess.run(['node','--check','wool-envelope.mjs'],cwd=ROOT,check=True)
subprocess.run([str(ROOT/'node_modules/.bin/esbuild'),'main.mjs','--bundle','--minify','--format=iife','--target=es2022','--legal-comments=inline','--outfile=bundle.js'],cwd=ROOT,check=True)
code=(ROOT/'bundle.js').read_text().replace('</script','<\\/script')
(ROOT/'index.html').write_text(t.replace('/*__BUNDLE__*/',code))
manifest={
 'version':'KNIT-PUBLIC-P03','sourceCommit':os.getenv('GITHUB_SHA'),'P02Head':'d3e2c5d39a884bcc15b89232ec8e6a4ecb1e7ee9','P02SourceSHA256':parent_hash,
 'htmlSHA256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'htmlBytes':(ROOT/'index.html').stat().st_size,'EB1SHA256':eb1_hash,'three':'0.180.0',
 'publicURLVerified':False,'visualReviewed':False,'userVisualAccepted':False,'referenceQualityAchieved':False,'privateRuntimeImported':False,'clothPhysics':False,
 'carrierPathJittered':True,'carrierCrossSection':'asymmetric compressed multi-lobe','surfaceFibres':'finite overlapping staples in stable clumps','shellLayers':2,
 'stapleFibres':16*20*176,'haloFibres':16*20*320,'newDiscreteLOD':False,'animationCache':False,
 'risk':'Transparent fibre layers and shadow samples add GPU cost. Shell/staple representatives approximate unresolved wool fibres; no consumer-GPU, phone, cinematic or reference-match claim.',
 'status':'SOURCE_CANDIDATE_AWAITING_RUNTIME_AND_VISUAL_REVIEW'
}
(ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False))
