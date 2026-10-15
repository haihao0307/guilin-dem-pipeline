from pathlib import Path
P=Path('.');s=(P/'references/fiber-r05/app.mjs').read_text(encoding='utf-8-sig')
def change(a,b):
 global s
 assert a in s,a[:90]
 s=s.replace(a,b)
change("import * as THREE from '../three.module.js';","import * as THREE from '../references/fur-r02/three.module.js';")
change("from '../fiber-r02/kernel.mjs'","from './specimen.mjs'")
change("from '../fiber-r02/shaders.mjs'","from '../references/fiber-r02/shaders.mjs'")
change("from '../fiber-r03/stability.mjs'","from '../references/fiber-r03/stability.mjs'")
change("import {movingPositionFragment,fastNodeRadianceFragment,fastStableVertex,layer8Fragment,shadowPairFragment,packShadowFragment} from './shaders.mjs';","import {fastNodeRadianceFragment as originalRadiance,fastStableVertex,layer8Fragment,shadowPairFragment,packShadowFragment} from '../references/fiber-r05/shaders.mjs';\nimport {movingPositionFragment} from './shape-shader.mjs';\nconst fastNodeRadianceFragment=originalRadiance.replace('uniform vec3 sigmaA;','uniform vec3 sigmaA;uniform float weightDebug,styleLength;').replace(' return color;',' if(weightDebug>.5){float support=exp(-styleLength*progress/.018);return mix(vec3(.025,.23,.60),vec3(.8,.055,.018),support);} return color;');")
change("import {FurGuideMotion} from './motion.mjs';","import {StrandDynamics} from './physics.mjs';\nimport {STYLES} from './specimen.mjs';\nconst initialStyle=document.querySelector('meta[name=hair-style]')?.content||'medium';let style=initialStyle;")
change("const VERSION='HAIR-FIBER-R05-M3';","const VERSION='HAIR-FIBER-SYSTEM-R02';")
change("roughness:.30,variation:.36,diameter:70,frizz:.22,wave:1","roughness:.30,variation:.18,diameter:70,frizz:.10,wave:1")
change('let yaw=.12,pitch=.035,distance=.66','let yaw=.35,pitch=.035,distance=STYLES[style].distance')
change('const u={diameter','const u={silkiness:{value:.88},clumping:{value:.82},styleIndex:{value:style===\'long\'?1:0},rootY:{value:STYLES[style].rootY},weightDebug:{value:0},styleLength:{value:STYLES[style].length},diameter')
change("u.rootMap={value:tex(specimen.roots)};u.traitMap={value:tex(specimen.traits)};","u.rootMap={value:tex(specimen.roots)};u.traitMap={value:tex(specimen.traits)};const clumpTexture=new THREE.DataTexture(specimen.clumps,24,1,THREE.RGBAFormat,THREE.FloatType);clumpTexture.needsUpdate=true;u.clumpMap={value:clumpTexture};")
change('for(const x of[-.06,.06])for(const y of[-.16,.15])for(const z of[-.04,.04])','for(const x of[-.18,.18])for(const y of[-.25,.25])for(const z of[-.18,.18])')
change('const dynamics=new FurGuideMotion();','const dynamics=new StrandDynamics(initialStyle);')
change('dynamics.offsets,17,15','dynamics.offsets,85,33')
change('guideTexture.minFilter=guideTexture.magFilter=guideLinear?THREE.LinearFilter:THREE.NearestFilter;','guideTexture.minFilter=guideTexture.magFilter=THREE.NearestFilter;')
change('let renderedGuideState=null,simCPU=[];','const frameTexture=new THREE.DataTexture(dynamics.frames,85,33,THREE.RGBAFormat,THREE.FloatType);frameTexture.needsUpdate=true;u.guideFrames={value:frameTexture};\nlet renderedGuideState=null,simCPU=[];')
change('function dirtyDynamics(){guideTexture.needsUpdate=true;','function dirtyDynamics(){guideTexture.needsUpdate=true;frameTexture.needsUpdate=true;')
change("$('motionStats').textContent=`导向 ${dynamics.snapshot().guides} × 3 模式 · CPU ${dynamics.cpuMS.toFixed(3)} ms · 形变 ${ (dynamics.snapshot().maxOffset*1000).toFixed(1)} mm`;","const d=dynamics.snapshot();$('motionStats').textContent=`根梢连续权重 · 重力与弯曲 · 形变 ${(d.maxOffset*1000).toFixed(1)} mm`; ")
change("'R05 · 三模式弯曲 / 原精度光学'","STYLES[style].name+' · 实时三维'")
change('physics:"three-mode-bending"','physics:"gravity-xpbd-angular"')
change("else if(['wave','frizz'].includes(k))invalidate('geometry');","else if(['wave','frizz'].includes(k)){if(k==='wave'){dynamics.configure(style,p.wave);dirtyDynamics();}invalidate('geometry');}")
change("$('full').onclick=()=>setCamera({yaw:.12,pitch:.035,distance:.66,target:[0,-.002,0]});","$('full').onclick=()=>setCamera({yaw:.35,pitch:.035,distance:STYLES[style].distance,target:STYLES[style].target});")
change("$('macro').onclick=()=>setCamera({yaw:.08,pitch:0,distance:.20,target:[.012,-.015,.006]});","$('macro').onclick=()=>setCamera({yaw:.30,pitch:0,distance:style==='long'?.23:.16,target:dynamics.sample(42,.48)});")
start=s.index('let brushPointer=null;');end=s.index('const oldReset=',start);s=s[:start]+s[end:]
start=s.index('function guidePoint(i,t){');end=s.index('function pointerRay(e)',start);s=s[:start]+"function guidePoint(i,t){return new THREE.Vector3(...dynamics.sample(i,t));}\n"+s[end:]
change('initial:dynamics.sample(hit.i,hit.t)','initial:[0,0,0]')
change('/.00007-((dynamics.positions[i*3+2]-z)**2)/.00002','/.00010-((dynamics.positions[i*3+2]-z)**2)/.00008')
change("snapshot:()=>({version:VERSION,","snapshot:()=>({version:VERSION,style,shaderWeights:{guideInfluences:4,hierarchicalClumps:24,rootClumpWeight:0,silkiness:u.silkiness.value,clumping:u.clumping.value},")
change("lighting();new ResizeObserver(resize).observe($('view'));resize();",'''
function syncStyleUI(){
 document.querySelectorAll('[data-style]').forEach(e=>e.classList.toggle('selected',e.dataset.style===style));
 $('specimenName').textContent=STYLES[style].name;$('specimenDesc').textContent=style==='medium'?'约 12–14 厘米 · 轻扫分束 · 柔顺垂落':'约 30–34 厘米 · 细束聚散 · 自然垂落';
}
async function setStyle(value){
 if(!STYLES[value])throw Error('Invalid style');if(value===style)return;
 $('loading').hidden=false;$('loading').textContent='正在建立发束与重力平衡…';await new Promise(s=>requestAnimationFrame(()=>setTimeout(s,0)));
 style=value;dynamics.enabled=false;dynamics.sway=false;dynamics.paused=false;dynamics.configure(style,p.wave);u.styleIndex.value=style==='long'?1:0;u.rootY.value=STYLES[style].rootY;u.styleLength.value=STYLES[style].length;
 dirtyDynamics();syncStyleUI();$('full').click();$('windMotion').textContent='开启微风';$('swayRoots').classList.remove('selected');$('loading').hidden=true;wakeDynamics();
}
for(const e of document.querySelectorAll('[data-style]'))e.onclick=()=>setStyle(e.dataset.style);
for(const name of ['silkiness','clumping'])$(name).oninput=e=>{u[name].value=+e.target.value;$(name+'Value').textContent=e.target.value;invalidate('geometry');};
$('stiffness').oninput=e=>{dynamics.stiffness=+e.target.value;$('stiffnessValue').textContent=e.target.value;wakeDynamics();dynamics.active=true;};
$('damping').oninput=e=>{dynamics.damping=+e.target.value;$('dampingValue').textContent=e.target.value;};
$('swayRoots').onclick=()=>{dynamics.sway=!dynamics.sway;$('swayRoots').classList.toggle('selected',dynamics.sway);wakeDynamics();};
$('weightsView').onclick=()=>{u.weightDebug.value=1-u.weightDebug.value;$('weightsView').classList.toggle('selected',u.weightDebug.value>0);$('weightLegend').hidden=u.weightDebug.value===0;invalidate('shade');};
$('sideView').onclick=()=>setCamera({yaw:1.2,pitch:0,distance:STYLES[style].distance,target:STYLES[style].target});
$('exportRecipe').onclick=()=>{const blob=new Blob([JSON.stringify({version:VERSION,style,parameters:p,shaderWeights:{silkiness:u.silkiness.value,clumping:u.clumping.value},physics:dynamics.snapshot()},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='hair-r02-recipe.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
HAIR_LAB.setStyle=setStyle;HAIR_LAB.guidePoint=(g,t)=>guidePoint(g,t).toArray();HAIR_LAB.setSway=v=>{dynamics.sway=!!v;wakeDynamics();};
HAIR_LAB.setPhysics=(stiffness,damping)=>{dynamics.stiffness=stiffness;dynamics.damping=damping;};
HAIR_LAB.setWeights=(silkiness,clumping)=>{if(![silkiness,clumping].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid weights');u.silkiness.value=silkiness;u.clumping.value=clumping;invalidate('geometry');};
syncStyleUI();target.fromArray(STYLES[style].target);lighting();new ResizeObserver(resize).observe($('view'));resize();
''')
(P/'src/app.mjs').write_text(s,encoding='utf-8')
print('Prepared two-length weighted hair shader and gravity/XPBD dynamics')
