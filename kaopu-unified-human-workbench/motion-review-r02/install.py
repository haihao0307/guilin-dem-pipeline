from pathlib import Path
P=Path(__file__).resolve().parent;B=P.parent;OLD=B/'motion-review-r01'
def change(s,a,b):
    assert s.count(a)==1,('Anchor drift',a[:110],s.count(a))
    return s.replace(a,b)
s=(B/'full/activity-r01/NativeCapturedRetarget.mjs').read_text().replace("from '../boxing/Motion.mjs'","from '../full/boxing/Motion.mjs'")
s=change(s,'this.lastFrame=-1;this.anchors=','this.orientation={};this.lastFrame=-1;this.anchors=')
s=change(s,'yaw=Math.atan2(direction[1],direction[0])-Math.atan2(f.toe[1]-f.ankle[1],f.toe[0]-f.ankle[0]),pitch=Math.atan2(direction[2],Math.hypot(direction[0],direction[1]))-f.referencePitch;','rawYaw=Math.atan2(direction[1],direction[0]),rawPitch=Math.atan2(direction[2],Math.hypot(direction[0],direction[1]))-f.referencePitch,filtered=stableFoot(this,S,rawYaw,rawPitch,Math.atan2(-back[1],-back[0]),Math.atan2(f.toe[1]-f.ankle[1],f.toe[0]-f.ankle[0]),Math.hypot(direction[0],direction[1])),yaw=filtered[0],pitch=filtered[1];')
s=change(s,'forward=unit([direction[0],direction[1],0])','forward=unit(mv(flat,sub(f.toe,f.ankle)).map((v,k)=>k===2?0:v))')
helper='''
// Foot yaw is ill-conditioned near a vertical toe vector. Use the captured
// pelvis heading and SAME filtered pitch axis, not raw noisy yaw.
function stableFoot(self,side,yaw,pitch,bodyHeading,restHeading,horizontal){
 const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x)),reliable=clamp(horizontal/.10,0,1),local=clamp(wrap(yaw-bodyHeading),-.40,.40)*reliable;
 const wanted=[bodyHeading+local-restHeading,clamp(pitch,-1.25,.85)],previous=self.orientation[side];
 if(previous){const gain=1-Math.exp(-1/(120*.018));wanted[0]=previous[0]+clamp(wrap(wanted[0]-previous[0])*gain,-3/120,3/120);wanted[1]=previous[1]+clamp((wanted[1]-previous[1])*gain,-12/120,12/120);}
 self.orientation[side]=wanted;return wanted;
}
'''
s=change(s,'export class NativeCapturedRetarget',helper+'\nexport class NativeCapturedRetarget');(P/'NaturalRetarget.mjs').write_text(s)
s=(B/'full/activity-r01/CapturedActivityController.mjs').read_text().replace("from'./NativeWalkRetarget.mjs'","from'../full/activity-r01/NativeWalkRetarget.mjs'").replace("from'./NativeCapturedRetarget.mjs'","from'./NaturalRetarget.mjs'");(P/'CapturedController.mjs').write_text(s)
(P/'Core.mjs').write_text((OLD/'Core.mjs').read_text())
s=(OLD/'Catalogue.mjs').read_text()
new='''const NEW=[
 record('walk-loop','连续行走','00 连续移动与自然动作','capture2','CMU 16_15：稳定完整步态周期；尾段与原始前置帧融合，位移逐周期累计。平地支撑校准，不是刚体平衡模拟。',{sourceKey:'walkCycle',continuous:true}),
 record('run-loop','连续跑步','00 连续移动与自然动作','capture2','CMU 16_35：持续跑/慢跑周期，不含急停。脚踝朝向滤波、周期接缝和支撑阶段校准。',{sourceKey:'runCycle',continuous:true}),
 record('natural-wave','站立挥手','00 连续移动与自然动作','capture2','CMU 143_25 原始 Waving，全身真人捕捉重定向；手指和拇指不是实测数据，保持本人物自然张手。',{sourceKey:'waveNatural',continuous:false}),
 record('natural-stretch','伸展与打哈欠姿态','00 连续移动与自然动作','capture2','CMU 143_30 原始 Stretch And Yawn：保留全身伸展时序。没有凭空补造与原录像同步的嘴部口型。',{sourceKey:'stretchNatural',continuous:false})
];
'''
s=change(s,'export const CATALOGUE=[',new+'export const CATALOGUE=[...NEW,');s=change(s,'bodyEntries:captured.length+hands.length+boxing.length','bodyEntries:NEW.length+captured.length+hands.length+boxing.length');(P/'Catalogue.mjs').write_text(s)
s=(OLD/'Workbench.mjs').read_text()
s=change(s,"const SOURCES={walk,run,jump}","import {ThumbContact} from './ThumbContact.mjs';\nimport {buildCapturedClip} from './CapturedCycles.mjs';\nimport walkCycle from './16_15-SOURCE.json';\nimport runCycle from './16_35-SOURCE.json';\nimport waveNatural from './143_25-SOURCE.json';\nimport stretchNatural from './143_30-SOURCE.json';\nconst NEW_SOURCES={walkCycle,runCycle,waveNatural,stretchNatural};\nconst SOURCES={walk,run,jump}")
s=s.replace('R01 / 当前人物 R04','R02 / 当前人物 R04').replace('MOTION-REVIEW-R01','MOTION-REVIEW-R02').replace('KAOPU-Motion-R01-diagnostics','KAOPU-Motion-R02-diagnostics')
s=change(s,'<button data-mr-view="hands">手部</button>','<button data-mr-view="handL">左手近看</button><button data-mr-view="handR">右手近看</button>')
s=change(s,'<button id="mr-export">','<label class="mr-option"><input id="mr-thumb" type="checkbox" checked> 拇指外侧包覆修正</label><label class="mr-option">手部演示 <select id="mr-hand-side"><option value="L">左手</option><option value="R">右手</option></select></label><label class="mr-option">连续移动 <select id="mr-root-mode"><option value="forward">向前移动</option><option value="in-place">原地检查</option></select></label><p class="mr-warning">连续动作是真实周期采样，不是重播停止片段。拇指使用当前手框架校准；接触与软组织仍有误差。</p><button id="mr-export">')
s=change(s,"this.role=0;this.interpolate=true;","this.role=0;this.thumbEnabled=true;this.handSide='L';this.rootMode='forward';this.interpolate=true;")
s=change(s,'this.sampler=new RigidPoseSampler(this.binding.rig);','this.sampler=new RigidPoseSampler(this.binding.rig);this.thumb=new ThumbContact(this.binding);');s=change(s,"?initial:'walk'","?initial:'walk-loop'")
s=change(s,' bindUI(){'," bindUI(){const refresh=async()=>{const t=this.time,was=this.playing,view=this.angle;await this.select(this.selection.id,{autoplay:false});this.seek(t);this.view(view);this.play(was);};$('mr-thumb').onchange=e=>{this.thumbEnabled=e.target.checked;void refresh();};$('mr-hand-side').onchange=e=>{this.handSide=e.target.value;void refresh();};$('mr-root-mode').onchange=e=>{this.rootMode=e.target.value;this.lastRoot=null;this.apply(this.time);this.view('three');};")
s=change(s,' async buildClip(row,ticket){'," async buildClip(row,ticket){if(row.kind==='capture2')return buildCapturedClip(this.binding,row,NEW_SOURCES[row.sourceKey],this.sampler,{alive:()=>ticket===this.generation,notify:x=>this.status(x)});")
s=change(s,'sample=t=>controller.sample(t);',"sample=t=>this.handSide==='R'&&['fist','open','pinch','reach-turn'].includes(row.task)?controller.rig.evaluate(t,{task:row.task,side:'R',duration:6,fistTension:row.tension,poseOutput:false}):controller.sample(t);")
s=change(s,'frame=sample(t);',"frame=this.thumb.repair(sample(t),{...row,handSide:this.handSide},t,{enabled:this.thumbEnabled});");s=change(s,'metrics.push({...frame.metrics});','metrics.push({...frame.metrics,thumb:frame.thumbReport});')
s=change(s,"const key=id+'|'+(row.kind==='boxing'?this.role:row.role??0);","const key=id+'|'+(row.kind==='boxing'?this.role:row.role??0)+'|thumb:'+this.thumbEnabled+'|side:'+this.handSide;")
s=change(s,'this.clip=clip;this.time=0;',"this.clip=clip;this.time=0;$('mr-loop').checked=!!clip.continuous;")
s=change(s,"if(this.angle==='face')this.view('three');","if(['face','handL','handR'].includes(this.angle)&&row.kind==='capture2')this.view('three');else if(this.angle==='face')this.view('three');")
s=change(s,'if(value&&this.time>=this.clip.duration-.0001)','if(value&&!this.clip.continuous&&this.time>=this.clip.duration-.0001)');s=change(s,'this.time=clamp(t,0,this.clip.duration);','this.time=clamp(t,0,this.clip.continuous?86400:this.clip.duration);')
s=change(s,'const c=this.clip,x=clamp(t*c.fps,0,c.frames.length-1),','const c=this.clip,cycles=c.continuous?Math.floor(t/c.duration):0,localTime=c.continuous?t-cycles*c.duration:t,x=clamp(localTime*c.fps,0,c.frames.length-1),')
s=change(s,'if(this.transition){let w=',"if(c.continuous){for(let k=0;k<3;k++)pose.p[c.rootIndex*3+k]+=c.displacement[k]*(this.rootMode==='forward'?cycles:-localTime/c.duration);}if(this.transition){let w=")
s=change(s,'this.lastRoot=offset;}','this.lastRoot=offset;if(this.floor){this.floor.position.x=Math.round(p.x/2)*2;this.floor.position.z=Math.round(p.z/2)*2;}}')
s=change(s,"view(which='three'){if(!this.ready)return;",'''view(which='three'){if(!this.ready)return;
 if(['handL','handR','hands'].includes(which)){
  this.angle=which;const s=which==='handR'?'R':'L',v=this.viewer,h=this.binding.height,j=this.binding.names.indexOf('wrist.'+s),m=this.sampler.world[j],skin=m.clone().multiply(this.sampler.inverse[j]);
  const world=p=>new THREE.Vector3(p.x,p.z,-p.y),dir=a=>world(new THREE.Vector3(...a).transformDirection(skin)),F=dir(this.thumb.rig.hand[s].forward),N=dir(this.thumb.rig.hand[s].palm),U=new THREE.Vector3().crossVectors(F,N).normalize().multiplyScalar(s==='L'?1:-1),p=world(new THREE.Vector3().setFromMatrixPosition(m)),target=p.addScaledVector(F,h*.040);
  const look=N.clone().multiplyScalar(.65).addScaledVector(F,.30).addScaledVector(U,.65).normalize();v.orbit.target.copy(target);v.camera.position.copy(target).addScaledVector(look,h*.24);v.camera.zoom=1;v.camera.updateProjectionMatrix();v.orbit.update();this.lastRoot=null;this.render();return;
 }
''')
s=change(s,'if(next>=this.clip.duration){',"if(next>=this.clip.duration&&!(this.clip.continuous&&$('mr-loop').checked)){")
s=change(s,"$('mr-timeline').value=this.time;","$('mr-timeline').value=this.clip?.continuous?this.time%this.clip.duration:this.time;if(this.clip?.continuous)$('mr-time').textContent=`${this.time.toFixed(1)} s · 第 ${Math.floor(this.time/this.clip.duration)+1} 周期`;")
s=change(s,'counts:COUNTS,binding:',"counts:COUNTS,continuous:!!this.clip?.continuous,rootMode:this.rootMode,cycleCount:this.clip?.continuous?Math.floor(this.time/this.clip.duration):0,thumbEnabled:this.thumbEnabled,handSide:this.handSide,clipMetrics:this.clip?.metrics,binding:")
(P/'Workbench.mjs').write_text(s)
(P/'style.css').write_text((OLD/'style.css').read_text()+'\n#mr-viewport #stage>button,#mr-viewport #stage>.hud{display:none!important}#mr-info .mr-warning{font-size:11px}.mr-option select{max-width:140px}@media(min-width:961px){#mr-info{padding-top:12px}}\n')
print('Generated R02 only; original R01/full/R04 unchanged')
