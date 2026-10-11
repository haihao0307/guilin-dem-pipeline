"""Reproduce new R13C source only; immutable R12/R13 and native human stay read-only."""
from pathlib import Path
import shutil, re, os, json, hashlib, urllib.request
p=Path(__file__).resolve().parent
base=p.parent/'r13'
expected={'src/app.js':'be9b70965cde96f7365aa8c7244275304992119e7aa6e8561122f545eefc7673','src/FiberMaterial.js':'309abcc0eafebcef819448f0ffe8a202b5e4ee8eda6053cfea9204a23f76f09d','src/LengthKernel.js':'cb8ea1435edb5d7c59e4a88df6c3b83c7ce840eb3322d9e4973bcdbbe8e784d3'}
for f,h in expected.items():
    assert hashlib.sha256((base/f).read_bytes()).hexdigest()==h, 'Unexpected frozen source: '+f
for directory in ['src','vendor','licenses','data']:
    for source in (base/directory).rglob('*'):
        if source.is_file():
            target=p/source.relative_to(base);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
shutil.copy2(base/'workbench.css',p/'workbench.css')
def change(text,old,new):
    assert old in text, 'Missing immutable source anchor: '+old[:100]
    return text.replace(old,new)
s=(base/'src/FiberMaterial.js').read_text()
s=change(s,"['auto', 'blend', 'a2c']","['auto', 'blend', 'a2c', 'depth']")
s=change(s,'auto, blend or a2c','auto, blend, a2c or depth')
s=change(s,'uniform float guideMode;','uniform float guideMode;\nuniform float coverageDepth;')
s=change(s,'  if (alpha < 0.001) discard;', '''  if (alpha < 0.001) discard;
  if (coverageDepth > 0.5) {
    vec3 sampleKey=fract(vec3(floor(gl_FragCoord.xy).xyx)*0.1031+vFiberRandom*19.19);
    sampleKey+=dot(sampleKey,sampleKey.yzx+33.33);
    float threshold=fract((sampleKey.x+sampleKey.y)*sampleKey.z);
    if (alpha<=threshold) discard;
    alpha=1.0;
  }''')
s=change(s,"const useMSAA = record.coverageAA && record.coverageResolve !== 'blend' && record.samples > 1;","const depthCoverage=record.coverageResolve==='depth';\n  const useMSAA = !depthCoverage && record.coverageAA && record.coverageResolve !== 'blend' && record.samples > 1;")
s=change(s,'const useBlend = !useMSAA && (record.coverageAA || material.uniforms.fiberOpacity.value < 1);','const useBlend = !depthCoverage && !useMSAA && (record.coverageAA || material.uniforms.fiberOpacity.value < 1);')
s=change(s,'material.blending = THREE.NormalBlending;',"material.blending = depthCoverage?THREE.NoBlending:THREE.NormalBlending;\n  material.uniforms.coverageDepth.value=depthCoverage?1:0;")
s=change(s,'record.coverageMode = !record.coverageAA ?',"record.coverageMode = depthCoverage ? 'stable-strand-coverage-depth' : !record.coverageAA ?")
s=change(s,'guideMode: {value: guides ? 1 : 0},','coverageDepth:{value:0}, guideMode: {value: guides ? 1 : 0},')
s=change(s,"'non-MSAA fallback uses order-dependent alpha blending'","'depth coverage uses stable spatial samples, not temporal reconstruction; sparse strands may show sampling noise'")
(p/'src/FiberMaterial.js').write_text(s)
s=(base/'src/LengthKernel.js').read_text()
s="import {partSign,canInterpolate,trimLength,rootVisibility,enforceTrim,growthDirection,coherentPhase,TOPOLOGY_SPEC} from './GroomTopology.js';\n"+s
s=change(s,"'textured-fringe':{name:'微分碎盖',lengthMM:85,partMM:-7,partOpen:18,volumeMM:16,sideRatio:42,backRatio:48,fringeRatio:65,clump:48,waveMM:.60,tipVariation:24,flow:10}","'textured-fringe':{name:'微分碎盖 · 耳侧收短',lengthMM:85,partMM:-7,partOpen:8,volumeMM:10,sideRatio:32,backRatio:40,fringeRatio:62,clump:25,waveMM:.40,tipVariation:22,flow:10,sideburnMM:14,napeMM:18}")
s=change(s,"'side-flow':{name:'偏长侧分',lengthMM:110,partMM:-27,partOpen:56,volumeMM:21,sideRatio:55,backRatio:60,fringeRatio:92,clump:34,waveMM:.3,tipVariation:13,flow:42}","'side-flow':{name:'自然侧分 · 冠部后收',lengthMM:110,partMM:-24,partOpen:28,volumeMM:12,sideRatio:34,backRatio:43,fringeRatio:73,clump:22,waveMM:.28,tipVariation:16,flow:46,sideburnMM:16,napeMM:20}")
s=change(s,"'curtain-layer':{name:'中分层次刘海',lengthMM:135,partMM:0,partOpen:82,volumeMM:18,sideRatio:65,backRatio:70,fringeRatio:100,clump:32,waveMM:.65,tipVariation:18,flow:65}","'curtain-layer':{name:'中分层次 · 短鬓角',lengthMM:135,partMM:0,partOpen:44,volumeMM:12,sideRatio:42,backRatio:50,fringeRatio:82,clump:23,waveMM:.45,tipVariation:17,flow:60,sideburnMM:18,napeMM:24}")
s=change(s,'export const RANGES={','export const RANGES={sideburnMM:[4,30],napeMM:[6,40],')
s=re.sub(r'export function partSide\(p,d\)\{[^\n]+\}', 'export const partSide=partSign;',s)
s=change(s,'return d.lengthMM*.001*scale*(1-d.tipVariation*.01*(.5-r));','return trimLength(p,d,d.lengthMM*.001*scale*(1-d.tipVariation*.01*(.5-r)));')
a=s.index('export function fieldDirection(');b=s.index('\nconst pause=',a);s=s[:a]+'export const fieldDirection=growthDirection;\n'+s[b:]
s=change(s,'if(g.side!==side)continue;','if(!canInterpolate(root,g.root,d))continue;')
s=change(s,"if(id[0]<0)throw Error('分缝一侧缺少导向');","if(id[0]<0)throw Error('局部发区缺少兼容导向');")
s=change(s,'phase=random01(guides[near.id[0]].id+441)*Math.PI*2','phase=coherentPhase(root)')
s=change(s,'(d.density/100)*mix(.15,1,smooth(.0002,.005,scalpMargin(root)))','(d.density/100)*mix(.15,1,smooth(.0002,.005,scalpMargin(root)))*rootVisibility(root)')
s=change(s,'point=add(point,mul(sub(primary.root,root),gather));','const bundle=[0,0,0];for(let k=0;k<3;k++)for(let z=0;z<3;z++)bundle[z]+=guides[near.id[k]].root[z]*near.w[k];\n   point=add(point,mul(sub(bundle,root),gather));')
s=change(s,'skin.earGuard.apply(pts);skin.headGuard.apply(pts);','enforceTrim(root,pts,d);skin.earGuard.apply(pts);skin.headGuard.apply(pts);')
s=change(s,'skin.earGuard.apply(finalPoints);skin.headGuard.apply(finalPoints);','enforceTrim(root,finalPoints,d);skin.earGuard.apply(finalPoints);skin.headGuard.apply(finalPoints);')
s=change(s,'return{recipe:d,curves,','return{topology:TOPOLOGY_SPEC,recipe:d,curves,');(p/'src/LengthKernel.js').write_text(s)
ref='99defb97123d8101fefddf5aa039991446f557a8';dest=p/'native-head';records=[];seen=set()
queue=['full/ui/skin/CommonSkinLayer.mjs','face-transfer/FaceSurface.mjs','face-transfer/FaceSkin.mjs','identity-lab/IdentityModel.mjs','identity-lab/IdentitySkin.mjs','eye-materials/NaturalEyeState.mjs','eye-materials/OcularRefinement.mjs','lip-structure/LipState.mjs','lip-structure/LipSurface.mjs','face-transfer/THIRD_PARTY.txt','eye-materials/THIRD_PARTY.md']
while queue:
    rel=queue.pop(0)
    if rel in seen:continue
    seen.add(rel);target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True)
    if os.environ.get('NATIVE_SOURCE_DIR'):data=(Path(os.environ['NATIVE_SOURCE_DIR'])/rel).read_bytes()
    else:
        url=f'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/{ref}/kaopu-unified-human-workbench/{rel}'
        with urllib.request.urlopen(url,timeout=90) as response:data=response.read()
    assert len(data)<10000000,'Unexpected native asset size'
    records.append({'path':rel,'bytes':len(data),'sourceSha256':hashlib.sha256(data).hexdigest()})
    if target.suffix not in ['.js','.mjs']:target.write_bytes(data);continue
    s=data.decode()
    for dep in re.findall(r"(?:from\s+|import\s*)['\"]([^'\"]+)['\"]",s):
        if not dep.startswith('.'):continue
        dependency=(target.parent/dep).resolve()
        if 'registration-vendor/three.module.js' in str(dependency):
            local=os.path.relpath(p/'vendor/three.module.js',target.parent).replace('\\','/');s=s.replace("'"+dep+"'","'"+local+"'")
        else:queue.append(str(dependency.relative_to(dest.resolve())))
    if rel=='face-transfer/FaceSkin.mjs':
        s="import detailURL from './assets/detail.png';\nimport chromaURL from './assets/chroma.png';\n"+s
        s=change(s,"['detail.png','chroma.png'].map(name=>loader.loadAsync(new URL('./assets/'+name,import.meta.url).href)","[detailURL,chromaURL].map(url=>loader.loadAsync(url)")
        queue.extend(['face-transfer/assets/detail.png','face-transfer/assets/chroma.png'])
    if rel=='lip-structure/LipMath.mjs':
        s=change(s,'const display=a=>[a[0],a[2],-a[1]];','const display=a=>a.slice(); /* Native Y-up head adapter. */')
        assert '*/return {x:display(X)' in s, 'Native lip-frame return must not be swallowed by an inline comment'
    target.write_text(s)
(p/'NATIVE_HEAD_LOCK.json').write_text(json.dumps({'revision':ref,'sources':records,'adaptations':['single Three instance','inline original atlas URLs','LipMath native Y-up display conversion'],'fullBodyViewer':False},indent=2))
f=p/'src/NativeHead.js';s=f.read_text();s=s.replace('face:skin.faceExtension,','face:{version:skin.faceExtension.version,ready:skin.faceExtension.ready,shaderCompiles:skin.faceExtension.shaderCompiles,errors:skin.faceExtension.errors},');f.write_text(s)
s=(base/'src/app.js').read_text();s="import {installNativeHead,NATIVE_HEAD_REVISION} from './NativeHead.js';\nimport {anatomicalRegion,TOPOLOGY_SPEC,finitePart} from './GroomTopology.js';\n"+s
s=change(s,'let recipe={...INITIAL},model,','let nativeHead;\nlet recipe={...INITIAL},model,')
s=s.replace('R13-M1','R13C.1').replace('kaopu.hair.r13-m1.groomDNA','kaopu.hair.r13c.groomDNA').replace("coverageResolve:'blend'","coverageResolve:'depth'")
s=change(s,"antialias:true,alpha:false","antialias:new URLSearchParams(location.hash.slice(1)).get('aa')!=='0',alpha:false")
s=change(s,'errors.push(String(e.message||e));','errors.push(String(e.stack||e.message||e));')
s=change(s,"head.name='single-original-GNM-head';","nativeHead=await installNativeHead({gnm:model,positions,geometry,mesh:head,renderer,render:draw});")
s=change(s,'skin=new SkinField(model);','skin=new SkinField(nativeHead.collisionModel);')
s=change(s,'geometry.attributes.normal.array);scene.add(brows.mesh)','nativeHead.geometry.attributes.normal.array);scene.add(brows.mesh)')
s=change(s,'opacity:capability,renderGate:','headIntegration:nativeHead?.report(),topology:TOPOLOGY_SPEC,fiber:handle?Fiber.fiberMaterialDiagnostics(handle.material):null,opacity:capability,renderGate:')
s=change(s,"['sideRatio','侧面长度比例'],","['sideRatio','耳上侧面长度'],['sideburnMM','鬓角独立长度'],['napeMM','后颈独立长度'],")
s=s.replace('分缝两侧独立导向 · 发根保持','有限分缝 / 冠旋连续场 · 鬓角独立收束')
s=change(s,'subject:{assetSha256:','subject:{nativeHeadRevision:NATIVE_HEAD_REVISION,assetSha256:')
s=change(s,'guideData:()=>compiled?.guides.map(g=>({rootId:g.id,root:g.root,side:g.side,points:g.points}))','guideData:()=>compiled?.guides.map(g=>({rootId:g.id,root:g.root,side:g.side,region:anatomicalRegion(g.root),partWeight:finitePart(g.root,recipe),points:g.points}))')
s=change(s,'items.push({id,root:',"items.push({id,active:!!compiled.active[id],zone:anatomicalRegion(roots.templateRoots.subarray(id*3,id*3+3)),root:")
s=change(s,'window.lengthGroom={diagnostics,',"window.lengthGroom={diagnostics,coverageMode:mode=>{Fiber.setFiberModes(handle.material,{coverageResolve:mode});draw();},reverseHairOrder:()=>{const a=hair.geometry.index.array;for(let lo=0,hi=a.length-3;lo<hi;lo+=3,hi-=3)for(let k=0;k<3;k++){const t=a[lo+k];a[lo+k]=a[hi+k];a[hi+k]=t;}hair.geometry.index.needsUpdate=true;draw();},setHeadTone:value=>nativeHead.setTone(value),")
(p/'src/app.js').write_text(s)
s=(base/'index.html').read_text().replace('R13-M1','R13C.1').replace('R13 ·','R13C ·').replace('短发到中长发','连续发流与实体遮挡').replace('偏长侧分','自然侧分').replace('中分层次刘海','中分层次')
s=s.replace('</header>','<p class="notice">人物总工作台 ET18 头部 · 连续发流 · 鬓角独立收短 · 静态候选，非影视级验收</p></header>',1);(p/'index.html').write_text(s)
s=(base/'bundle.mjs').read_text().replace("target:'es2022',minify:true","target:'es2022',loader:{'.png':'dataurl'},minify:true");(p/'bundle.mjs').write_text(s)
print('R13C readable source ready; native source files',len(records))
