from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parents[1]
src=P/'src'
a=(P/'references/fiber-r05/app.mjs').read_text(encoding='utf-8')
def change(old,new):
 global a
 assert old in a,old[:120]
 a=a.replace(old,new)
change("import * as THREE from '../three.module.js';", "import * as THREE from '../references/fur-r02/three.module.js';")
change("from '../fiber-r02/kernel.mjs'", "from './specimen.mjs'")
change("from '../fiber-r02/shaders.mjs'", "from '../references/fiber-r02/shaders.mjs'")
change("from '../fiber-r03/stability.mjs'", "from '../references/fiber-r03/stability.mjs'")
change("import {movingPositionFragment,fastNodeRadianceFragment,fastStableVertex,layer8Fragment,shadowPairFragment,packShadowFragment} from './shaders.mjs';", "import {fastNodeRadianceFragment,fastStableVertex,layer8Fragment,shadowPairFragment,packShadowFragment} from '../references/fiber-r05/shaders.mjs';\nimport {movingPositionFragment} from './shape-shader.mjs';")
change("import {FurGuideMotion} from './motion.mjs';", "import {StrandDynamics as HairGuideMotion} from './physics.mjs';\nimport {groom} from './specimen.mjs';")
change("const VERSION='HAIR-FIBER-R05-M3';", "const VERSION='HAIR-FIBER-SYSTEM-R01';")
change('dynamics.offsets,17,15','dynamics.offsets,85,25')
change('guideTexture.minFilter=guideTexture.magFilter=guideLinear?THREE.LinearFilter:THREE.NearestFilter;', 'guideTexture.minFilter=guideTexture.magFilter=THREE.NearestFilter;')
start=a.index('function guidePoint(i,t){');end=a.index('function pointerRay(e)',start)
a=a[:start]+'''function guidePoint(i,t){
 const x=dynamics.positions[i*3],z=dynamics.positions[i*3+2],s=t*.94;
 return new THREE.Vector3(...groom(x,z,s,p.wave)).add(new THREE.Vector3(...dynamics.sample(i,s)));
}
'''+a[end:]
change("$('motionStats').textContent=`导向 ${dynamics.snapshot().guides} × 3 模式 · CPU ${dynamics.cpuMS.toFixed(3)} ms · 形变 ${ (dynamics.snapshot().maxOffset*1000).toFixed(1)} mm`;", "const d=dynamics.snapshot(); $('motionStats').textContent=`85 条导向 · 25 节点 · 形变 ${(d.maxOffset*1000).toFixed(1)} mm · 导向伸长 ${(d.maxRelativeStretch*100).toFixed(3)}%`; ")
change("'R05 · 三模式弯曲 / 原精度光学'", "'长发样束 · 纤维光学 / 可旋转'")
change('physics:"three-mode-bending"','physics:"length-constrained-guides"')
change("else if(['wave','frizz'].includes(k))invalidate('geometry');", "else if(['wave','frizz'].includes(k)){if(k==='wave'){dynamics.configure(p.wave);dirtyDynamics();}invalidate('geometry');}")
change("lighting();new ResizeObserver(resize).observe($('view'));resize();", '''
$('stiffness').oninput=e=>{dynamics.stiffness=+e.target.value;$('stiffnessValue').textContent=e.target.value;};
$('damping').oninput=e=>{dynamics.damping=+e.target.value;$('dampingValue').textContent=e.target.value;};
$('sideView').onclick=()=>setCamera({yaw:1.25,pitch:0,distance:.63,target:[0,-.002,0]});
$('exportRecipe').onclick=()=>{const blob=new Blob([JSON.stringify({version:VERSION,specimen:'long-terminal-hair',parameters:p,physics:{stiffness:dynamics.stiffness,damping:dynamics.damping,wind:dynamics.wind},roots:signature},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='hair-recipe.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
HAIR_LAB.guidePoint=(g,t)=>guidePoint(g,t).toArray();
HAIR_LAB.setPhysics=(stiffness,damping)=>{if(!Number.isFinite(stiffness)||stiffness<0||stiffness>1||!Number.isFinite(damping)||damping<.3||damping>10)throw Error('Invalid physics');dynamics.stiffness=stiffness;dynamics.damping=damping;};
lighting();new ResizeObserver(resize).observe($('view'));resize();
''')
a=a.replace('new FurGuideMotion()', 'new HairGuideMotion()')
(src/'app.mjs').write_text(a,encoding='utf-8')
print('Prepared long-hair-only renderer; no pile or guard/undercoat branches')
