"""Build R14 from the user's frozen R13C runtime, without modifying old paths.
The readable generated sources are committed along with this reproducible patch.
"""
from pathlib import Path
import shutil, json, re, hashlib
p=Path(__file__).resolve().parent
old=p.parent/'r13c'
for name in ['src','vendor','data','native-head','licenses','tests']:
    shutil.copytree(old/name,p/name,dirs_exist_ok=True)
for name in ['index.html','workbench.css','bundle.mjs','package.py','NATIVE_HEAD_LOCK.json']:
    shutil.copy2(old/name,p/name)

def edit(file, a, b, count=1):
    f=p/file;s=f.read_text();assert s.count(a)==count,(file,a,s.count(a));f.write_text(s.replace(a,b))

def instrumentation(folder):
    f=folder/'src/FiberMaterial.js';s=f.read_text()
    s=s.replace('uniform float guideMode;','uniform float guideMode;\nuniform float coverageAudit;')
    s=s.replace('guideMode: {value: guides ? 1 : 0}', 'coverageAudit:{value:0}, guideMode: {value: guides ? 1 : 0}')
    s=s.replace('gl_FragColor = vec4(max(color, vec3(0.0)), alpha);','if(coverageAudit>.5)color=vec3(0.0);\n  gl_FragColor = vec4(max(color, vec3(0.0)), alpha);')
    f.write_text(s)
    f=folder/'src/app.js';f.write_text(f.read_text()+'\n'+(p/'patches/audit-hook.js').read_text())

# A private CI-only reference changes diagnostic hooks, NOT old geometry/appearance.
reference=Path('/tmp/hair-r14-reference')
if reference.exists():shutil.rmtree(reference)
for name in ['src','vendor','data','native-head','licenses']:
    shutil.copytree(old/name,reference/name)
for name in ['index.html','workbench.css','bundle.mjs','package.py']:
    shutil.copy2(old/name,reference/name)
instrumentation(reference)

shutil.copy2(p/'patches/RootProfile.js',p/'src/RootProfile.js')
edit('src/LengthKernel.js',"import {HeadSegmentGuard}","import {rootGap,rootEnvelopeDerivative,rootDetailGain,rootClumpGain} from './RootProfile.js';\nimport {HeadSegmentGuard}")
edit('src/LengthKernel.js','export const RANGES={','export const RANGES={rootBlendMM:[2,16],crownCover:[0,100],')
edit('src/LengthKernel.js','density:100,width:100,roughness:48','rootBlendMM:8,crownCover:86,density:100,width:100,roughness:48')
edit('src/LengthKernel.js','project(p,gap=.0007){', '''projectEmergence(p,distance){
  const gap=rootGap(distance);if(distance>=.008)return this.project(p,gap);
  let result=p;
  for(let i=0;i<2;i++){const h=this.bvh.nearest(result),signed=dot(sub(result,h.p),h.n);if(signed>=gap)break;result=add(result,mul(h.n,gap-signed));}
  return result;
 }
 project(p,gap=.0007){''')
edit('src/LengthKernel.js','.35-.24*crownWeight(root)','.18-.09*crownWeight(root)')
edit('src/LengthKernel.js','d.volumeMM*(1-.78*crownWeight(root))*.001/Math.max(.008,length)*Math.PI*Math.cos(Math.PI*s)*(.35+.65*top)','rootEnvelopeDerivative(root,length,d,length*s)')
edit('src/LengthKernel.js','p=skin.project(p,.00075);','p=skin.projectEmergence(p,length*s);')
edit('src/LengthKernel.js','d.clump*.01*Math.sin(Math.PI*s*.85)*.55','d.clump*.01*Math.sin(Math.PI*s*.85)*.55*rootClumpGain(requested,d,requested*s)*(1-.45*crownWeight(root)*d.crownCover*.01)')
edit('src/LengthKernel.js','skin.project(point,.0008)','skin.projectEmergence(point,requested*s)')
edit('src/LengthKernel.js','if(j&&s>0){','if(j&&s>0&&rootDetailGain(requested,d,requested*s)>0){')
edit('src/LengthKernel.js','d.waveMM*.001*smooth(0,.25,s)*(.65+.35*seed)','d.waveMM*.001*rootDetailGain(requested,d,requested*s)*(.65+.35*seed)')
edit('src/LengthKernel.js','Math.sin(s*Math.PI*2.2+phase)*a','Math.sin(requested*s/.080*Math.PI*2+phase)*a')
edit('src/LengthKernel.js','Math.sin(s*22+finePhase)*a*.14','Math.sin(requested*s/.020*Math.PI*2+finePhase)*a*.08')
edit('src/LengthKernel.js','skin.project(points[j],.0007)','skin.projectEmergence(points[j],requested*s)')
# Keep the same finite part domain and smooth ear/occiput field.
f=p/'src/GroomTopology.js';s=f.read_text();start=s.index('export function enforceTrim(');end=s.index('export function growthDirection(',start)
s=s[:start]+(p/'patches/trim.js').read_text()+s[end:]
s=s.replace(' const core=1-smooth', ''' // Root flow crosses the old oversized crown opening; no duplicate lower hair.
 const cover=(d.crownCover??86)*.01*crownWeight(root)*.82;
 x=mix(x,.18+(d.flow-10)*.004,cover);z=mix(z,.85,cover);
 const core=1-smooth''')
s=s.replace("version:'R13C-topology@3'","version:'R14-root-topology@1'")
s=s.replace('innerCapMeshes:0','innerCapMeshes:0,rootCollarMetres:true,trimMethod:"first-crossing-cut-and-arc-resample"')
s=s.replace('mix(.003,.008,smooth(.018,.055,r))','mix(.0035,.007,smooth(.026,.070,r))')
f.write_text(s)
# Real root-shaft inspection reuses the SAME geometry and material, only its index.
edit('src/app.js',"hair.visible=inspection==='fibers';",'''if(hair.userData.fullIndex)hair.geometry.setIndex(hair.userData.fullIndex);
 hair.visible=inspection==='fibers'||inspection==='root-shafts';
 if(inspection==='root-shafts'){
  const ids=[],per=compiled.per;for(let i=0;i<count;i++)if(compiled.active[i]){let arc=0;for(let j=0;j<compiled.segments&&arc<.008;j++){const q=(i*per+j)*3,v=(i*per+j)*2;ids.push(v,v+1,v+2,v+1,v+3,v+2);arc+=Math.hypot(...[0,1,2].map(k=>compiled.curves[q+k+3]-compiled.curves[q+k]));}}
  hair.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(ids),1));
 }''')
edit('src/app.js','compiled=result;recipe=next;','hair.userData.fullIndex=geometry.index;compiled=result;recipe=next;')
edit('src/app.js',"shapeControls:[['partMM'","shapeControls:[['rootBlendMM','起根过渡长度'],['crownCover','冠部发流覆盖'],['partMM'")
edit('src/app.js',"['volumeMM','根部 / 头顶蓬松']","['volumeMM','中段 / 头顶蓬松']")
edit('src/app.js','有限分缝 / 冠旋连续场 · 鬓角独立收束','毫米级起根 · 冠部连续覆盖 · 真剪短后颈')
edit('index.html','<button data-inspect="roots">真实发根</button>','<button data-inspect="roots">发根位置</button><button data-inspect="root-shafts">起根段约8 mm</button>')
for name in ['src/app.js','index.html','package.py']:
 f=p/name;s=f.read_text().replace('R13C.3','R14.0').replace('kaopu.hair.r13c.groomDNA','kaopu.hair.r14.groomDNA').replace('KAOPU-R13C-GroomDNA','KAOPU-R14-GroomDNA').replace('R13C GroomDNA','R14 GroomDNA').replace('R13C 存档','R14 存档').replace('/fusion/r13c/README.md','/fusion/r14/README.md');f.write_text(s)
edit('package.py',"'userFrozenPreview':'a827dc71191a8394c3e98973cac5dde45fc1f716'","'userFrozenPreview':'c0816ec8388195bb79b12fc82e11ce2d3fa07d56'")
instrumentation(p)
# Existing independent tests remain; update only the expected new topology version.
edit('tests/browser.mjs',"d.topology.version==='R13C-topology@3'","d.topology.version==='R14-root-topology@1'")
(p/'README.md').write_text('''# R14.0 发根与顶部覆盖候选

Parent immutable webpage: c0816ec8388195bb79b12fc82e11ce2d3fa07d56 / fusion/r13c/public-lite.html.

原64k潜在发根、种子724、原生ET18头、发色、单丝半径、灯光、深度覆盖模式保留。不增加头皮黑帽或第二层短毛。

RootProfile: 起根高度从20微米锚点连续变化；最初8毫米使用原生三角形距离，不用粗距离网格替代根部。抬升在根部为零斜率，极短发抑制波纹；聚束延后到起根段之外。
GroomTopology: 冠部局部前向梳理覆盖原大开口；保留有限额前分缝。鬓角/后颈按第一次越界真实剪短并弧长重采样，不压平余下顶点。
两项可保存参数：起根过渡长度2–16mm、冠部发流覆盖0–100；它们改变真实曲线，不是透明度。起根段查看重用同一发丝网格的前约8mm，不是点云冒充根段。

## 原始方法与边界
SideFX Guide Groom: https://www.sidefx.com/docs/houdini/nodes/sop/guidegroom.html — Lock Root、Ray Bias、Smooth、Cut/Extend、Resample；只迁移原则，未移植Houdini求解器。
Three Material: https://threejs.org/docs/pages/Material.html — depthWrite / alphaToCoverage / blending。
继承原Perm宏/细分离、Digital Salon导向/跟随与原MakeHuman眉毛。没有运行其神经/CUDA求解器。

## 验证与约束
upgrade.py只读旧r13c，仅写r14。CI中的/tmp/hair-r14-reference仅追加测量接口，几何、头部、色彩、光照和半径均为原R13C。
coverageAudit是顶视固定世界区域的白头皮/黑真实发丝ID渲染，保留真实深度和MSAA；不是生物密度测量、不是美术验收，也不涂黑正常画面的头皮。
rootAudit检查固定抽样根点的原生表面间隙和12mm以下短发反向转折。证据还须经人工查看。
当前无动态物理、自碰撞、肩/衣服碰撞。手机只测390×844视口，不是实机。64k顶点内存预算未提升，但导向与精确根部投射增加生成计算；不能声称普通手机影视特写实时。
视觉验收未通过前不得称影视级、最终成品或用户认可。
''')
(p/'TAKEOVER_ANCHOR.json').write_text(json.dumps({'userFrozenBuild':'c0816ec8388195bb79b12fc82e11ce2d3fa07d56','inheritedBranchHead':'dc36a8fc7b145ca3b217cd1a3e0c2987fa9b1877','scope':'r14 only; old workbenches immutable','rootSeed':724,'defaultRoots':64000,'newScalpCap':False,'newHead':False},indent=2))
print('R14 source ready, old workbenches untouched')
