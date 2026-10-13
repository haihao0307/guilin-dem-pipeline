"""R03 wrapper generation. R02 files are read only; source mismatches fail closed."""
from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parent;old=P.parent/'motion-review-r02'
def replace(s,a,b):
 assert s.count(a)==1,(a[:90],s.count(a));return s.replace(a,b)
for name in ['Core.mjs','ThumbContact.mjs','CapturedCycles.mjs','NaturalRetarget.mjs','16_15-SOURCE.json','16_35-SOURCE.json','143_25-SOURCE.json','143_30-SOURCE.json']:(P/name).write_bytes((old/name).read_bytes())
s=(old/'Workbench.mjs').read_text();s="import {buildInteractionClip,InteractionDisplay} from './Runtime.mjs';\n"+s
s=s.replace('MOTION-REVIEW-R02','MOTION-REVIEW-R03').replace('R02 / 当前人物 R04','R03 / 掌面接触 · 拾取与双人递交').replace('Motion-R02-diagnostics','Motion-R03-diagnostics')
s=replace(s,"async buildClip(row,ticket){", "async buildClip(row,ticket){if(row.kind==='interaction')return buildInteractionClip(this,row,ticket);")
s=replace(s,'this.thumb=new ThumbContact(this.binding);','this.thumb=new ThumbContact(this.binding);this.interactionDisplay=new InteractionDisplay(this);this.receiverReady=true;this.contactMarkers=false;')
s=replace(s,"?initial:'walk-loop'", "?initial:'squat-cycle'")
s=replace(s,"bindUI(){const refresh=", "bindUI(){document.getElementById('mr-contact').onchange=e=>{this.contactMarkers=e.target.checked;this.apply(this.time);};document.getElementById('mr-receiver').onchange=e=>{this.receiverReady=e.target.checked;if(this.selection?.task==='give-object')void refresh();};const refresh=")
s=replace(s,"const ticket=++this.generation;if(!row.playable)", "if(this.interactionDisplay)this.interactionDisplay.update(null,null,0,false);const ticket=++this.generation;if(!row.playable)")
s=replace(s,"'|side:'+this.handSide", "'|side:'+this.handSide+'|receiver:'+this.receiverReady")
s=replace(s,"this.busy=false;this.intervals=[];this.cpu=[];", "this.busy=false;if(row.kind==='interaction')this.transition=null;this.intervals=[];this.cpu=[];")
s=replace(s,"this.followRoot();if(render)this.render();", "this.interactionDisplay.update(a,b,x-a,c.row.kind==='interaction');this.followRoot();if(render)this.render();")
s=replace(s,"c.row.kind==='hand'&&['grasp','carry'].includes(c.row.task)", "c.row.kind==='interaction'||c.row.kind==='hand'&&['grasp','carry'].includes(c.row.task)")
s=replace(s,"if(!this.ready)return;\n if(['handL'", "if(!this.ready)return;if(this.interactionDisplay.frameCamera(which)){this.angle=which;return;}\n if(['handL'")
s=replace(s,"sameMaterial:this.viewer.mesh.material===this.materialAtStart,errors:", "sameMaterial:this.viewer.mesh.material===this.materialAtStart,interaction:this.interactionDisplay?.report(),errors:")
s=replace(s,'<h3>实时诊断</h3>', '<h3>交互阶段</h3><p id="mr-interaction-status">选择交互动作查看接触阶段</p><label class="mr-option"><input id="mr-contact" type="checkbox"> 显示掌心 / 指面接触点</label><label class="mr-option"><input id="mr-receiver" type="checkbox" checked> 接收者准备好</label><h3>实时诊断</h3>')
s=s.replace('当前单人检查，不包含双人碰撞、真实负载、肌肉体积或衣服物理。切换过渡没有再次求解脚部接触。','递交使用两位同版本人物和同一个物体。当前为表面接触约束，不是重量、摩擦、肌肉或衣物物理。')
s=s.replace("this.prop.userData.kind!==a.shape", "this.prop.userData.kind!==a.shape+JSON.stringify([a.radius,a.halfExtentsNative])").replace("this.prop.userData.kind=a.shape", "this.prop.userData.kind=a.shape+JSON.stringify([a.radius,a.halfExtentsNative])")
(P/'Workbench.mjs').write_text(s)
c=(old/'Catalogue.mjs').read_text();c=replace(c,'export const CATALOGUE=[...NEW,...captured,...hands,','''const INTERACTIONS=[
 record('squat-cycle','下蹲 → 起身','00 接触交互 R03','interaction','参考 CMU22_14 下蹲高度时序，在当前固定骨长与双脚接触约束下重建，不冒充完整身体动捕重定向。',{task:'squat-cycle',duration:4.6}),
 record('squat-down','下蹲并保持','00 接触交互 R03','interaction','同一下蹲动作的下降段，保留蹲姿；不计作新的独立动捕。',{task:'squat-down',duration:2.3}),
 record('stand-up','从蹲姿起身','00 接触交互 R03','interaction','使用来源实际起身高度时序，不是简单倒放下降。',{task:'stand-up',duration:2.3}),
 record('pick-ground','地面拾取 → 起身持物','00 接触交互 R03','interaction','下蹲、掌面接近、包覆、接触检查、拾起与持物。接触建立前物体留在地面。',{task:'pick-ground',duration:5.8}),
 record('give-object','把物品递给另一人','00 接触交互 R03','interaction','真实第二人物接近并接住同一件包裹，双方接触后递出者松手。接收者未准备好时不转移。',{task:'give-object',duration:6.0})
];
const CONTACT_HANDS=hands.map(r=>r.task==='grasp'?{...r,kind:'interaction',group:'00 接触交互 R03',label:'握持小球 · 表面接触校准',note:'当前手掌与手指三角面测量，不再用手腕原点定位；支持左右手。',duration:5.8}:r.task==='carry'?{...r,kind:'interaction',group:'00 接触交互 R03',label:'双手抬箱 · 表面接触校准',note:'左右掌面与手指支撑箱体两侧和底缘，台面支撑到双手抬起；本项未增加负重行走或重量物理。',duration:5.8}:r);
export const CATALOGUE=[...INTERACTIONS,...CONTACT_HANDS.filter(r=>r.kind==='interaction'),...NEW,...captured,...CONTACT_HANDS.filter(r=>r.kind!=='interaction'),''')
c=replace(c,'bodyEntries:NEW.length+', 'bodyEntries:INTERACTIONS.length+NEW.length+')
(P/'Catalogue.mjs').write_text(c)
(P/'style.css').write_text((old/'style.css').read_text()+'\n#mr-interaction-status{border-left:3px solid #bccf9c;padding:8px 10px;background:#203139;color:#dceace!important;min-height:42px}#mr-head small{letter-spacing:0}\n')
b=(old/'build.cjs').read_text().replace('MOTION-REVIEW-R02','MOTION-REVIEW-R03').replace('动作 R02 · 连续走跑与拇指校准','动作 R03 · 掌面接触与拾取递交').replace("'SOURCE_REPORT.json'","'GUIDE.json'")
b=b.replace("originalMotionBuild:'773f717b38ff5adf776c99fc30f06c113b4727a6'","originalMotionBuild:'c5b573f90b2a2024beb8eb52bddf37f76dbcb255'")
b=b.replace("'no consumer GPU or physical mobile performance promise'","'no consumer GPU or physical mobile performance promise','point-SDF hand contact does not certify triangle self-collision or physical grasp forces','squat uses measured height envelope plus authored fixed-bone posture, not complete source retarget'")
(P/'build.cjs').write_text(b)
print('R03 wrappers generated; R02 sources unchanged')