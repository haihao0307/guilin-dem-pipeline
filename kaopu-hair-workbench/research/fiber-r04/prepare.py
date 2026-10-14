"""Create an inspectable R04 runtime from hash-locked R03, without modifying R02/R03."""
from pathlib import Path
import hashlib
P=Path(__file__).resolve().parent; B=P.parent/'fiber-r03'
def sha(s):return hashlib.sha256(s).hexdigest()
def rep(s,a,b):
 if s.count(a)!=1:raise ValueError('Expected one source anchor: '+a[:90])
 return s.replace(a,b,1)
a=(B/'app.mjs').read_text()
assert sha(a.encode())=='2d2f70274144ba56c0f5a37323150c951a702755b984d058c22135ed167d6ace'
a=rep(a,"from './stability.mjs';","from '../fiber-r03/stability.mjs';\nimport {movingPositionFragment,fastNodeRadianceFragment,fastStableVertex} from './motion-shaders.mjs';\nimport {FurGuideMotion} from './motion.mjs';")
a=a.replace('HAIR-FIBER-R03-S1','HAIR-FIBER-R04-FUR1').replace('kaopu.hair.fiber-r03','kaopu.hair.fiber-r04')
a=rep(a,'mk(old.fullscreenVertex,old.positionFragment)','mk(old.fullscreenVertex,movingPositionFragment)')
a=rep(a,'mk(old.fullscreenVertex,nodeRadianceFragment','mk(old.fullscreenVertex,fastNodeRadianceFragment')
a=a.replace('mk(stableVertex,','mk(fastStableVertex,')
a=rep(a,'rt?rt.height:height','mat===radMat?Math.ceil(COUNT*u.shadeCount.value/1024):(rt?rt.height:height)')
a=rep(a,'function render(){\n updateCamera();','function render(){\n renderedGuideState=dynamics.snapshot();\n updateCamera();')
a=rep(a,'function tick(t){request=0;try{','function tick(t){request=0;try{\n advanceDynamics(t);')
a=rep(a,'}else if(motion)request=requestAnimationFrame(tick);','}else if(motion||(!dynamics.paused&&(dynamics.enabled||dynamics.active)))request=requestAnimationFrame(tick);')
a=rep(a,"$('status').textContent=p.path==='stable'?'R03 · 单帧连续覆盖'", "$('motionStats').textContent=`导向 ${dynamics.snapshot().guides} · CPU ${dynamics.cpuMS.toFixed(3)} ms · 形变 ${ (dynamics.snapshot().maxOffset*1000).toFixed(1)} mm`;\n $('status').textContent=p.path==='stable'?'R04 · 原光学 / 导向毛梢运动'")
a=rep(a,'window.HAIR_LAB={version:VERSION,',(P/'runtime.fragment.js').read_text()+'\nwindow.HAIR_LAB={version:VERSION,')
a=rep(a,'physics:false,temporalReprojection:false,','physics:"bounded-guide-spring",guideMotion:dynamics.snapshot(),renderedGuideState,simulationCPU:simCPU.slice(),opticalSamples:u.shadeCount.value,temporalReprojection:false,')
a=rep(a,'capture:()=>r.domElement.toDataURL', 'setWindEnabled:windEnabled,setWind:v=>{dynamics.setWind(v);wakeDynamics();},resetDynamics,setOpticalSamples,readMotionNodes,\n stepDynamics:dt=>{if(!manual)throw Error("Manual test required");dynamics.advance(dt);dirtyDynamics();},\n testBrush:(gain=1)=>{const w=new Float32Array(85);for(let i=0;i<85;i++)w[i]=Math.exp(-dynamics.positions[i*3]**2/.00014);dynamics.setBrush(w,[12,-3,3],gain);dirtyDynamics();},\n capture:()=>r.domElement.toDataURL')
(P/'app.mjs').write_text(a)
h=(B/'index.html').read_text().replace('R03','R04')
h=h.replace('<div id="stats"></div>','<div id="stats"></div><div id="motionStats" style="font-size:11px;color:#a1afbd;margin-top:7px"></div>')
controls='''<h2>毛领运动逻辑 / 保留头发质感</h2>
<div class="row"><button id="windMotion">开启微风</button><button id="pauseMotion">暂停发丝</button></div>
<div class="row"><button id="impulseMotion">拨动一次</button><button id="brushMotion">局部拨毛</button></div>
<div class="row"><button id="resetMotion">恢复静态发束</button></div>
<label>风力 <output id="windGainValue">0.32</output><input id="windGain" type="range" min="0" max="1.5" step=".01" value=".32"></label>
<label>光学计算对照<select id="opticalSamples"><option value="21">21 点光学插值 / 实验加速</option><option value="81">81 点原精度 / 静态对照</option></select></label>
<div class="note">局部拨毛开启后，左键拖动发束；松手回弹。两种光学计算都保留 10,000 根 × 80 段几何。微风来自导向弹簧，不是整束旋转；不含人体/衣物碰撞。</div>'''
h=h.replace('<h2>绘制对照</h2>',controls+'<h2>绘制对照</h2>')
h=h.replace('尚未接入发丝动力学、EB1 或整头人物。','已接入毛领导向毛梢弹簧；未实现完整弹性杆、碰撞、EB1 或整头人物。')
h=h.replace('R04-S1 /','R04-FUR1 /')
(P/'index.html').write_text(h)
print('Prepared R04 app and UI from pinned R03:',len(a))
