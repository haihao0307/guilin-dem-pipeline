#!/usr/bin/env python3
"""R12 source transforms against frozen R11. No old workbench is written."""
from pathlib import Path
import shutil, re, json, hashlib
P=Path(__file__).resolve().parent
ROOT=P.parents[2]
BASE=P.parent/'r11'
for folder in ['src','vendor','data','licenses']:
    shutil.copytree(BASE/folder,P/folder,dirs_exist_ok=True)
for name in ['index.html','experiment.css','bundle.mjs','package.py','TEACHER-GROOM-PROVENANCE.json','TEACHERS.md']:
    shutil.copyfile(BASE/name,P/name)

def patch(name,old,new,count=1):
    f=P/name;s=f.read_text();n=s.count(old)
    if n!=count:raise RuntimeError(f'{name}: expected {count} occurrences, found {n}: {old[:90]}')
    f.write_text(s.replace(old,new))

def append(name,text):
    with (P/name).open('a') as f:f.write(text)

# New controls are numeric, range checked by the existing transactional editor.
rows="""
CONTROL_GROUPS.scalp.push(
 ['hairEarTaper','耳周渐短',0,100,1,40],
 ['hairNapeTaper','后颈渐短',0,100,1,55],
 ['hairEarContour','耳周轮廓不规则度',0,100,1,40],
 ['hairNapeContour','后颈轮廓不规则度',0,100,1,55]);
CONTROL_GROUPS.beard.push(
 ['beardChinLength','下巴长度比例',25,140,1,105],
 ['beardMoustacheLength','上唇长度比例',25,140,1,75],
 ['beardJawLength','下颌长度比例',25,140,1,95],
 ['beardCheekLength','脸颊长度比例',25,140,1,65],
 ['beardSideburnLength','鬓须长度比例',25,140,1,80],
 ['beardDirectionScatter','须流自然偏差',0,100,1,28]);
"""
patch('src/FusionFields.js','export const FUSION_DEFAULTS=',rows+'\nexport const FUSION_DEFAULTS=')
patch('src/FusionFields.js','/** R10 shared authored controls.',"import {beardField} from './RegionFields.js';\n/** R12 shared authored controls.")
patch('src/FusionFields.js','margin-retreat)','margin-retreat-edgeRetreat(p))')
patch('src/FusionFields.js',"export function regionalLength(p){const w=regionWeights(p);return (1-w.side+w.side*fusion.hairSideLength/100)*(1-w.nape+w.nape*fusion.hairNapeLength/100)}", """export function regionalLength(p,margin=Infinity){const w=regionWeights(p);const edge=Math.exp(-Math.max(0,margin)/.014);return (1-w.side+w.side*fusion.hairSideLength/100)*(1-w.nape+w.nape*fusion.hairNapeLength/100)*(1-.65*w.ear*edge*fusion.hairEarTaper/100)*(1-.70*w.nape*edge*fusion.hairNapeTaper/100)}""")
append('src/FusionFields.js',r'''
/** Bounded, C1 continuous value noise; used as a density mask, NOT displaced roots. */
export function organicNoise(p,scale=290){
 const v=p.map(x=>x*scale),c=v.map(Math.floor),f=v.map((x,k)=>{const t=x-c[k];return t*t*(3-2*t)});
 const h=(x,y,z)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295};
 let out=0;for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)out+=h(c[0]+x,c[1]+y,c[2]+z)*(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);return out;
}
export function edgeRetreat(p){const w=regionWeights(p),v=.7*organicNoise(p)+.3*organicNoise(p,710);return (.000022*w.ear*fusion.hairEarContour+.00003*w.nape*fusion.hairNapeContour)*(.15+.85*v);}
export function normalizedBeardWeights(p){const a=beardField(p).weights||[0,0,0,0,0],sum=a.reduce((s,x)=>s+x,0);return sum>1e-12?a.map(x=>x/sum):[0,0,0,0,0];}
export function blendedBeardCoverage(p,coverage){return clamp(normalizedBeardWeights(p).reduce((s,w,i)=>s+w*clamp(coverage[i]??0),0));}
export function beardLengthScale(p){const v=[fusion.beardChinLength,fusion.beardMoustacheLength,fusion.beardJawLength,fusion.beardCheekLength,fusion.beardSideburnLength];return normalizedBeardWeights(p).reduce((s,w,i)=>s+w*v[i]/100,0);}
export function blendedBeardDirection(p,random=.5){const w=normalizedBeardWeights(p),d=[0,0,0];for(let i=0;i<5;i++){const v=beardDirection(p,i);for(let k=0;k<3;k++)d[k]+=w[i]*v[k];}const scatter=fusion.beardDirectionScatter/100;d[0]+=(random-.5)*.38*scatter;d[2]+=(organicNoise(p,180)-.5)*.24*scatter;return normalize(d);}
''')
patch('src/RegionFields.js',"return {weight:0,zone:0};const zones=", "return {weight:0,zone:0,weights:[0,0,0,0,0]};const zones=")
patch('src/RegionFields.js',"return {zone:best.zone,weight:1-zones.reduce((a,b)=>a*(1-Math.min(1,b.weight)),1)};", "const weights=[0,0,0,0,0];for(const item of zones)weights[item.zone]=item.weight;return {zone:best.zone,weights,weight:1-zones.reduce((a,b)=>a*(1-Math.min(1,b.weight)),1)};")
root='binding.templateRoots.subarray(i*3,i*3+3)'
patch('src/HairLayer.js','regionalLength('+root+')','regionalLength('+root+',binding.safetyMargin('+root+'))')
patch('src/HairLayer.js',"['hairSideLength','hairNapeLength'].includes(k)","['hairSideLength','hairNapeLength','hairEarTaper','hairNapeTaper'].includes(k)")
patch('src/HairLayer.js',"['hairSideLength','hairNapeLength','hairFlyaways'].includes(k)","['hairSideLength','hairNapeLength','hairEarTaper','hairNapeTaper','hairFlyaways'].includes(k)")

# Preserve the R11 root union and area sampling; blend only the actual zone fields.
f=P/'src/FacialHairLayer.js'
s=f.read_text();s="import {blendedBeardCoverage,beardLengthScale,blendedBeardDirection} from './FusionFields.js';\n"+s;f.write_text(s)
patch('src/FacialHairLayer.js',"this.options.zoneCoverage?.[this.rootKinds[i]]??(this.rootKinds[i]===1?this.options.moustacheCoverage:this.options.chinCoverage)","blendedBeardCoverage(this.templateRoots.subarray(i*3,i*3+3),this.options.zoneCoverage||[this.options.chinCoverage,this.options.moustacheCoverage,1,1,1])")
patch('src/FacialHairLayer.js',"direction=Array.from(this.directions.subarray(i*3,i*3+3));","direction=this.name==='beard'?blendedBeardDirection(this.templateRoots.subarray(i*3,i*3+3),this.random[i]):Array.from(this.directions.subarray(i*3,i*3+3));")
patch('src/FacialHairLayer.js',"requested=length*(this.name==='brows'?", "requested=length*(this.name==='beard'?beardLengthScale(this.templateRoots.subarray(i*3,i*3+3)):1)*(this.name==='brows'?")
patch('src/FacialHairLayer.js',"(.00022+this.options.length*.19)*s", "(.00012+this.guideLengths[i]*.13)*(.75+.5*this.random[i])*s")
patch('src/FacialHairLayer.js',"const lateral=normalize(cross(normal,sub(b,a))),curl=", "const qa=(i*per+Math.max(0,j-1))*3,qb=(i*per+Math.min(segments,j+1))*3,guideAxis=[0,1,2].map(k=>this.currentGuideSupports[qb+k]-this.currentGuideSupports[qa+k]);let sideAxis=cross(normal,guideAxis);if(Math.hypot(...sideAxis)<1e-9)sideAxis=cross(normal,sub(b,a));if(Math.hypot(...sideAxis)<1e-9)sideAxis=cross(normal,sub(c,a));const lateral=normalize(sideAxis),curl=")
patch('src/FacialHairLayer.js',"fusion.beardSoftness,fusion.beardCurl,fusion.beardVariation]", "fusion.beardSoftness,fusion.beardCurl,fusion.beardVariation,fusion.beardChinLength,fusion.beardMoustacheLength,fusion.beardJawLength,fusion.beardCheekLength,fusion.beardSideburnLength,fusion.beardDirectionScatter]")

# Evaluate the local curling frame on current deformed guide supports, not world axes.
patch('src/FacialHairLayer.js', 'this.minNormalLength=Infinity;this.minSignedSurfaceOffset=Infinity;', "this.minNormalLength=Infinity;this.minSignedSurfaceOffset=Infinity;this.currentGuideSupports ||= new Float32Array(this.guideTriangles.length*3);for(let q=0;q<this.guideTriangles.length;q++){const t=this.guideTriangles[q];for(let axis=0;axis<3;axis++){let value=0;for(let k=0;k<3;k++)value+=positions[tr[t*3+k]*3+axis]*this.guideBarycentrics[q*3+k];this.currentGuideSupports[q*3+axis]=value;}}")

# Named facial presets must not inherit hidden jaw/cheek/sideburn settings.
for tag in ['moustache','goatee','both']:
    needle=tag+':{beardVisible:true,'
    patch('src/experiment.js',needle,needle+'beardJawCoverage:0,beardCheekCoverage:0,beardSideburnCoverage:0,')
patch('src/experiment.js',"stubble:{beardVisible:true,", "stubble:{beardVisible:true,beardJawCoverage:90,beardCheekCoverage:70,beardSideburnCoverage:85,")
# Root inspection really hides every eyebrow layer.
patch('src/experiment.js',"legacyFace.regions.beard.mesh.visible=false;\n}","legacyFace.regions.beard.mesh.visible=false;if(makeBrows)makeBrows.mesh.visible=false;teacherMeshes[1].visible=false;\n}")
# Extend source diagnostics with hashes of actual GPU/source buffers, not proxies.
patch('src/experiment.js',"window.groomStudy={teachersDiagnostics", "window.groomStudy={r12Diagnostics,teachersDiagnostics")
append('src/experiment.js',r'''
function r12Diagnostics(){
 const h=legacyHair,b=legacyFace?.regions.beard;if(!h||!b)return {ready:false};
 const per=h.options.segments+1,ids=[];for(let i=0;i<h.options.count;i++)if(h.binding.templateRoots[i*3+1]>.368)ids.push(i);
 const crown=new Float32Array(ids.length*per*3);ids.forEach((i,j)=>crown.set(h.latestPoints.subarray(i*per*3,(i+1)*per*3),j*per*3));
 const zones=Array.from({length:5},()=>({roots:0,active:0,meanLength:0,minLength:Infinity,maxLength:0}));for(let i=0;i<b.options.count;i++){const z=zones[b.rootKinds[i]],l=b.guideLengths[i];z.roots++;z.meanLength+=l;z.minLength=Math.min(z.minLength,l);z.maxLength=Math.max(z.maxLength,l)}for(const z of zones)z.meanLength/=Math.max(1,z.roots);
 for(let j=0;j<b.geometry.drawRange.count;j+=b.options.segments*6){const i=Math.floor(b.geometry.index.array[j]/((b.options.segments+1)*2));zones[b.rootKinds[i]].active++;}
 return {version:'R12.0',ready,crownRoots:ids.length,crownCurveHash:hash(crown),scalpCurveHash:hash(h.latestPoints),scalpRootHash:h.diagnostics().rootHash,beardRootHash:b.diagnostics().rootHash,beardCurveHash:hash(b.latestPoints),beardZones:zones,beardStats:b.diagnostics(),controlCount:Object.keys(DEFAULT_GROOM).length,oneHead:scene.children.filter(o=>o===head).length,rootInspection:rootsVisible,visibleBrowLayers:[teacherMeshes[1],makeBrows?.mesh,legacyFace.regions.brows.mesh].filter(m=>m?.visible).length};
}
function frozenSibling(name){const q=decodeURIComponent(location.search.slice(1).split('&')[0]);return q.startsWith('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/')?'https://htmlpreview.github.io/?'+new URL(name,q).href:new URL(name,location.href).href;}
const femaleLink=document.createElement('a');femaleLink.id='femaleEntry';femaleLink.href=frozenSibling('female.html');femaleLink.textContent='原女性 · 私有入口';document.querySelector('.wb-header').append(femaleLink);
const refinementBox=document.createElement('section');refinementBox.id='r12Refinement';refinementBox.innerHTML='<h2>耳周与后颈精修</h2><p>只调整边缘的渐短与疏密，不移动发根，不改头顶主发束。</p><div class="row"><button id="r11EdgeCompare">R11 边缘对照</button><button id="r12EdgeRestore">R12 自然边缘</button></div>';$('fusionRegions').prepend(refinementBox);
$('r11EdgeCompare').onclick=()=>setGroom({hairEarTaper:0,hairNapeTaper:0,hairEarContour:0,hairNapeContour:0});
$('r12EdgeRestore').onclick=()=>setGroom({hairEarTaper:40,hairNapeTaper:55,hairEarContour:40,hairNapeContour:55});
''')
# This release keeps the old schema and migrates missing new keys to defaults.
for name in ['src/experiment.js','index.html','bundle.mjs']:
    f=P/name;s=f.read_text().replace('fusion/r11/','fusion/r12/').replace('R11.0','R12.0').replace('R11 默认','R12 默认').replace('R11 毛发参数','R12 毛发参数');f.write_text(s)
# Restore historical labels changed above by intentional version replacement.
patch('src/experiment.js',"r11EdgeCompare\">R11 边缘对照", "r11EdgeCompare\">R11 边缘对照")
patch('src/experiment.js', 'setGroom(v.groom);setCase(v.case);', 'setGroom({...DEFAULT_GROOM,...v.groom});setCase(v.case);')
patch('src/experiment.js', "sourceRevision:'40861390bb57673c677a08d5216286d2dcbcf4da'", "sourceRevision:'__R12_SOURCE_REVISION__',baseRevision:'653c9ec7f7fce99d19e69a5cf99f66c7e96f6cbd'")
f=P/'src/experiment.js';s=f.read_text().replace("localStorage.setItem('kaopu.hair.fusion.r11'", "localStorage.setItem('kaopu.hair.fusion.r12'").replace("localStorage.getItem('kaopu.hair.fusion.r11')", "(localStorage.getItem('kaopu.hair.fusion.r12')||localStorage.getItem('kaopu.hair.fusion.r11'))").replace('R11 参数','R12 参数').replace('R11 存档','R12 / R11 存档').replace('kaopu-hair-r11.json','kaopu-hair-r12.json');f.write_text(s)
f=P/'index.html';s=f.read_text().replace('R11 胡须','R12 胡须').replace('R11 是融合测试版','R12 是精修测试版');f.write_text(s)

# Never inherit earlier success claims into a new version manifest.
m={'version':'R12.0','baseRevision':'653c9ec7f7fce99d19e69a5cf99f66c7e96f6cbd','oldPathsModified':False,'eyebrowLibraryStyles':14,'eyebrowSourceStrands':23087,'newRegionalControls':10,'singleHead':True,'physics':False,'permNeuralModelRunning':False,'cudaSolverRunning':False,'ten24Loaded':False,'productionAccepted':False,'publicBrowserVerified':False}
(P/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2))
# Keep a stable source-level import-map entry for local developer inspection.
print('R12 generated from frozen R11; old paths untouched')
shutil.copyfile(P/'AssetLoader.js',P/'src/AssetLoader.js')
patch('src/experiment.js',"import {MakeHumanBrows}","import {loadFixedAsset} from './AssetLoader.js';\nimport {MakeHumanBrows}")
f=P/'src/experiment.js';s=f.read_text()
start=s.index('async function loadAsset(kind)');end=s.index('function geometryFromBinding',start)
s=s[:start]+r'''async function loadAsset(kind){
 if(assetCache.has(kind))return assetCache.get(kind);const[file,size,expected]=ASSETS[kind];
 const packed='__R12_ASSET_BASE__',base=packed.startsWith('https://')?packed:new URL('assets/',location.href).href;
 const result=await loadFixedAsset({primary:base+file+'.gz',fallback:ASSET_BASE+file,signal:sessionSignal,size,sha256:expected,onProgress:(n,mode)=>{$('loadingText').textContent='原 GNM '+kind+' · '+(mode==='compressed'?'无损压缩':'原数据')+' '+(n/1e6).toFixed(1)+' MB';$('progress').value=Math.min(.97,n/size);},onFallback:reason=>{$('loadingText').textContent='主资源未通过读取，尝试同一模型原数据';records.push({kind,recoveredFrom:reason})}});
 records.push({kind,bytes:size,sha256:expected,transport:result.transport});const parsed=parseContainer(result.buffer);assetCache.set(kind,parsed);return parsed;
}
''' + s[end:]
f.write_text(s)
append('src/experiment.js',"\nrefinementBox.querySelectorAll('button').forEach(b=>b.disabled=!ready);\n")
# Female original remains private. Publish only a self-contained code viewer.
female=ROOT/'kaopu-hair-workbench/handoffs/ten24-original-local'
shutil.copytree(female/'runtime-import',P/'female-src',dirs_exist_ok=True)
viewer=P/'female-src/viewer.js'
viewer.write_text(viewer.read_text()+"\nwindow.__ten24 ||= {loaded:false,loading:false,viewerReady:true,reason:'private-original-assets-required'};\n")
html=(female/'index.html').read_text();html=re.sub(r'<script type="importmap">.*?</script>','',html,flags=re.S)
html=html.replace('<title>TEN24 原女性 · 私有毛发工作台</title>','<title>R12 原女性 · 私有文件入口</title>')
html=html.replace('href="../../../kaopu-human-overview/"','id="backToFusion" href="public-lite.html"')
html=html.replace('← 返回总工作台','← 返回 R12 毛发融合台')
for href in re.findall(r'<link rel="stylesheet" href="([^"]+)">',html):
    css=(female/href).resolve().read_text();html=html.replace('<link rel="stylesheet" href="'+href+'">','<style>'+css+'</style>')
html=html.replace('<script src="../../../kaopu-human-overview/workbench-ui.js"></script>','<script>'+(ROOT/'kaopu-human-overview/workbench-ui.js').read_text()+'</script>')
base_url='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/handoffs/ten24-original-local/'
for href in re.findall(r'href="([^"]+)"',html):
    if href=='public-lite.html' or href.startswith(('http','#')):continue
    html=html.replace('href="'+href+'"','href="'+base_url+href+'"')
html=html.replace('src="runtime-import/viewer.js"','src="female-src/viewer.js"')
html=html.replace('<p class="intro">','<p class="note">R12 已将此入口所需的运行代码打包；本页不公开分发原女性模型。未选择原 runtime 时不会显示另一个人物冒充。</p><p class="intro">',1)
html=html.replace('</body>',r'''<script>const q=decodeURIComponent(location.search.slice(1).split('&')[0]);document.querySelector('#backToFusion').href=q.startsWith('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/')?'https://htmlpreview.github.io/?'+new URL('public-lite.html',q).href:new URL('public-lite.html',location.href).href;</script></body>''')
(P/'female-source.html').write_text(html)
print('R12 loader and private original viewer prepared')
