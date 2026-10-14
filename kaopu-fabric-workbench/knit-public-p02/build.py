from pathlib import Path
import hashlib,json,os,subprocess,urllib.request
ROOT=Path(__file__).resolve().parent;OLD=ROOT.parent/'knit-public-p01'
s=(OLD/'main.mjs').read_text();oldhash=hashlib.sha256(s.encode()).hexdigest()
def rep(a,b,n=1):
 global s
 assert s.count(a)==n,(a[:100],s.count(a));s=s.replace(a,b)
rep("import * as THREE from 'three';","import * as THREE from 'three';\nimport {makeJacket} from './jacket.mjs';")
rep("const VERSION='KNIT-PUBLIC-P01';","const VERSION='KNIT-PUBLIC-P02';")
s=s.replace('kaopu:knit:public:p01','kaopu:knit:public:p02')
rep('const settings={fuzz:.82,length:.85,detail:.85','const settings={fuzz:1,length:.95,detail:1')
rep('let shaders=[];','let shaders=[],jacket=null;')
rep('for(let h=0;h<320;h++)','for(let h=0;h<960;h++)')
rep('const hid=id*337+h','const hid=id*997+h')
rep('const len=(fly?.0014:.00024)+(fly?.0015:.00070)','const len=(fly?.0014:.00032)+(fly?.0015:.00094)')
rep('normal', 'normal',s.count('normal')) # Explicit no-op: native carrier normal field retained.
rep('mesh.receiveShadow=true;group.add(mesh);','mesh.receiveShadow=true;group.add(mesh);\n jacket?.dispose();jacket=makeJacket({cols,rows,radius,frame,hash,colorAt,settings,uniforms,store});group.add(jacket.mesh);')
rep('projectionMatrix[1][1]*.000026/','projectionMatrix[1][1]*.000035/')
rep('uDensity)*.80','uDensity)*.94')
rep('if(fur)fur.visible=on;','if(fur)fur.visible=on;if(jacket)jacket.mesh.visible=on;')
rep("${cols*rows} 针目 · ${hairCount.toLocaleString()} 条代表纤维","${cols*rows} 针目 · 30,720 贴伏长纤维 + ${hairCount.toLocaleString()} 短绒")
rep("'纤维表面 + 短绒'","'贴伏纤维层 + 短绒（P02）'")
rep('frames,vertices,triangles,hairCount,lighting:', 'frames,vertices,triangles,hairCount,jacket:jacket?.report(),lighting:')
rep("clothPhysics:false,phoneHardwareTested:false","clothPhysics:false,phoneHardwareTested:false,visualReferenceMatched:false")
(ROOT/'main.mjs').write_text(s)
template=(OLD/'template.html').read_text().replace('PUBLIC P01','PUBLIC P02').replace('PUBLIC-P01','PUBLIC-P02').replace('公共独立样片','P02 可见纤维修订').replace('从线圈到毛线','毛线表面 · P02')
(ROOT/'template.html').write_text(template)
subprocess.run(['npm','install','--no-audit','--no-fund','--no-save','three@0.180.0','esbuild@0.25.10'],cwd=ROOT,check=True)
url='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/7dcbcaeaf20af630195e1be2c6ff7ec8ba63467f/lighting/eb1/eb1.js'
b=urllib.request.urlopen(url,timeout=30).read();assert hashlib.sha256(b).hexdigest()=='39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572';(ROOT/'eb1-public.js').write_bytes(b)
subprocess.run(['node','--check','main.mjs'],cwd=ROOT,check=True);subprocess.run(['node','--check','jacket.mjs'],cwd=ROOT,check=True)
subprocess.run([str(ROOT/'node_modules/.bin/esbuild'),'main.mjs','--bundle','--minify','--format=iife','--target=es2022','--legal-comments=inline','--outfile=bundle.js'],cwd=ROOT,check=True)
code=(ROOT/'bundle.js').read_text().replace('</script','<\\/script');(ROOT/'index.html').write_text(template.replace('/*__BUNDLE__*/',code))
(ROOT/'THIRD_PARTY_NOTICES.txt').write_text((OLD/'THIRD_PARTY_NOTICES.txt').read_text())
m={'version':'KNIT-PUBLIC-P02','sourceCommit':os.getenv('GITHUB_SHA'),'P01Base':'3df3869059a3382da14b2b8138de5a02262c6b38','parentSourceSHA256':oldhash,'htmlSHA256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'htmlBytes':(ROOT/'index.html').stat().st_size,'EB1SHA256':hashlib.sha256(b).hexdigest(),'three':'0.180.0','publicURLVerified':False,'visualReviewed':False,'userVisualAccepted':False,'privateRuntimeImported':False,'clothPhysics':False,'carrierPathUnchanged':True,'newDiscreteLOD':False,'animationCache':False,'risk':'More transparent geometry and table fetches; no hardware FPS claim. Long surface fibres are geometric representatives, not every physical wool fibre.'}
(ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(json.dumps(m))
