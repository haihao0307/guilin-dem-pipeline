import {createExample,validate,cut,ClothLab,fingerprint} from './core.mjs';
const $=id=>document.getElementById(id),colours={A:'#d9b978',B:'#94a6d6'};
let spec,lab=null,preview=null,revision=0,running=false,valid=false,lastFrame=0,yaw=-0.33,pitch=0.2,imported=false;
const report=(text,type='')=>{$('gate').textContent=text;$('gate').className='gate '+type;};
function rebuild(){
  imported=false;['width','height','example'].forEach(id=>$(id).disabled=false);
  revision++;const mode=$('example').value;
  spec=createExample({width:+$('width').value,height:+$('height').value,ease:mode==='ease'?0.08:0,invalid:{direction:'direction',easeError:'ease',reference:'reference'}[mode]||'none',revision});
  $('widthValue').textContent=$('width').value+' mm';$('heightValue').textContent=$('height').value+' mm';
  resetState();
}
function resetState(){
  lab=null;preview=null;running=false;
  try{const r=validate(spec);valid=true;$('validation').textContent=`校验通过 · ${r.panelCount} 片 / ${r.seams.length} 条有向缝`;preview=new ClothLab(cut(spec));preview.gravity=false;$('validation').className='validity';report('先校验并冻结裁片，再开始缝制');}
  catch(e){valid=false;$('validation').textContent=e.message;$('validation').className='validity error';report('已阻止制缝：'+e.message,'error');}
  $('cut').disabled=!valid;$('revision').textContent=`版本 ${spec.revision}${imported?' · 已导入':''}`;$('stage').textContent='纸样草稿';
  updateControls();updateStats();draw();
}
function updateControls(){
  $('sew').disabled=!lab||lab.active.size>0;
  $('pause').disabled=!lab;$('pause').textContent=running?'暂停':'继续';
  $('release').disabled=!lab||lab.pins.size===0;
  $('detach').disabled=!lab||lab.active.size===0;
  $('exportResult').disabled=!lab;
  $('exportPattern').disabled=!spec||!valid;
}
function flags(){if(!lab)return;lab.gravity=$('gravity').checked;lab.obstacle=$('obstacle').checked;lab.pull=$('pull').checked;}
function stateTitle(){if(!lab)return '纸样草稿';if(lab.seamDetached&&!lab.active.size)return '接缝已拆除';if(lab.active.size)return lab.pins.size?'接缝求解 · 托持中':'接缝求解 · 托持已解除';return '原材料裁片已冻结';}
function updateStats(){
  const state=lab||preview;if(!state){$('stitches').textContent='0';['gap','strain','pins'].forEach(id=>$(id).textContent='—');$('record').textContent=JSON.stringify(spec.seams,null,2);return;}
  const m=state.metrics();$('stitches').textContent=m.activeStitches;$('gap').textContent=m.maxSeamGapMm.toFixed(2)+' mm';$('strain').textContent=(m.maxPrincipalStrain*100).toFixed(2)+' %';$('strain').className=m.maxPrincipalStrain>0.05?'bad':'';$('pins').textContent=m.pins;
  $('identity').textContent=`${spec.panels.length} 块布片 · ${m.vertexCount} 个材料点 / ${m.triangleCount} 个三角形 · 冻结指纹 ${m.restSignature}（非安全哈希）`;
  $('runtime').textContent=lab?`${running?'计算中':'已暂停'} · ${m.elapsed.toFixed(1)} s`:'尚未求解';$('stage').textContent=stateTitle();
  $('record').textContent=JSON.stringify({schema:spec.schema,revision:spec.revision,seams:spec.seams,stages:spec.stages,activeSeams:[...state.active],completedConstraintStages:[...state.completed],restSignature:m.restSignature,acceptance:{geometry:'original_material_mesh',seamNumericGate:m.activeStitches>0&&m.maxSeamGapMm<=1.2&&m.maxPrincipalStrain<=.05,bodyContact:'not_implemented',selfCollision:'not_implemented',productionReady:false}},null,2);
  if(!lab)return;
  if(!m.finite){running=false;report('求解出现非有限值，已停止。没有切换到替代衣壳。','error');}
  else if(m.maxPrincipalStrain>.05)report(`应变门槛未通过：最大 ${(m.maxPrincipalStrain*100).toFixed(1)}% ＞ 5%。保留失败，需改进材料/工序；不放宽门槛。`,'error');
  else if(lab.seamDetached&&!lab.active.size)report('针脚约束已移除。勾选“向两侧轻拉”可观察布片分离；材料身份和原始尺寸不变。','warn');
  else if(m.activeStitches&&m.maxSeamGapMm<=1.2)report(`小样接缝数值门槛暂时满足 · 间隙 ${m.maxSeamGapMm.toFixed(2)} mm。${m.pins?'仍有临时托持。':'临时托持已解除。'}未验证自碰撞、人体接触或成衣。`,'warn');
  else if(m.activeStitches)report(`正在按 1.2 秒过程收紧针脚，当前最大间隙 ${m.maxSeamGapMm.toFixed(1)} mm；不把中间态当缝好。`,'warn');
  else report('裁片与材料坐标已冻结。点击“激活接缝”实际增加针脚约束。');
}
$('cut').onclick=()=>{try{lab=new ClothLab(cut(spec));flags();running=false;$('cut').disabled=true;updateControls();updateStats();draw();}catch(e){report(e.message,'error');}};
$('sew').onclick=()=>{try{lab.activate('join',spec);lab.seamDetached=false;running=true;updateControls();updateStats();}catch(e){report(e.message,'error');}};
$('pause').onclick=()=>{running=!running;updateControls();updateStats();};
$('release').onclick=()=>{lab.releasePins();running=true;updateControls();updateStats();};
$('detach').onclick=()=>{lab.detach();running=true;updateControls();updateStats();};
$('reset').onclick=()=>{$('gravity').checked=false;$('obstacle').checked=false;$('pull').checked=false;$('example').value='straight';rebuild();};
for(const id of ['width','height'])$(id).addEventListener('input',rebuild);
$('example').onchange=rebuild;
for(const id of ['gravity','obstacle','pull'])$(id).onchange=()=>{flags();if(lab){running=true;updateControls();}draw();};
$('view').onchange=()=>{[yaw,pitch]={perspective:[-.33,.2],front:[0,0],side:[Math.PI/2,0],top:[0,Math.PI/2]}[$('view').value];draw();};
let drag=null;$('cloth').onpointerdown=e=>{drag=[e.clientX,e.clientY,yaw,pitch];$('cloth').setPointerCapture(e.pointerId);};$('cloth').onpointermove=e=>{if(!drag)return;yaw=drag[2]+(e.clientX-drag[0])*.008;pitch=Math.max(-1.45,Math.min(1.45,drag[3]+(e.clientY-drag[1])*.008));draw();};$('cloth').onpointerup=()=>drag=null;$('cloth').onpointercancel=()=>drag=null;
function download(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
$('exportPattern').onclick=()=>download(`kaopu-paper-r${spec.revision}.json`,spec);
$('exportResult').onclick=()=>download(`kaopu-seam-experiment-r${spec.revision}.json`,lab.export());
$('import').onchange=async e=>{const f=e.target.files[0];if(!f)return;running=false;try{if(f.size>1500000)throw Error('文件超过 1.5 MB 小样限制');const next=JSON.parse(await f.text());validate(next);spec=next;imported=true;resetState();['width','height','example'].forEach(id=>$(id).disabled=true);report('已导入并校验纸样。请重新冻结、缝合；未恢复旧三维缓存。');}catch(err){report('导入失败，保留原纸样：'+err.message,'error');}finally{e.target.value='';updateControls();}};
function canvas(id){const c=$(id),r=c.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);if(c.width!==Math.round(r.width*dpr)||c.height!==Math.round(r.height*dpr)){c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);}const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);return {ctx,w:r.width,h:r.height};}
function path(ctx,pts,close=false){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();}
function drawPaper(){const {ctx,w,h}=canvas('paper');ctx.font='10px system-ui';let offset=0;const layouts=spec.panels.map(p=>{const maxX=Math.max(...p.uvMm.map(x=>x[0])),maxY=Math.max(...p.uvMm.map(x=>x[1])),o=offset;offset+=maxX+40;return {p,maxX,maxY,o};});const maxH=Math.max(...layouts.map(p=>p.maxY)),scale=Math.min((w-46)/(offset-40),(h-85)/maxH),baseX=(w-(offset-40)*scale)/2,baseY=46;
  ctx.strokeStyle='#222c32';ctx.lineWidth=1;for(let x=10;x<w;x+=25){path(ctx,[[x,0],[x,h]]);ctx.stroke();}for(let y=10;y<h;y+=25){path(ctx,[[0,y],[w,y]]);ctx.stroke();}
  for(const {p,maxX,maxY,o} of layouts){const map=uv=>[baseX+(uv[0]+o)*scale,baseY+uv[1]*scale],color=colours[p.id]||'#b0bcb6';path(ctx,p.boundary.map(i=>map(p.uvMm[i])),true);ctx.fillStyle=color+'24';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle=color;ctx.font='bold 12px system-ui';ctx.fillText(`${p.id} / ${maxX.toFixed(0)} × ${maxY.toFixed(0)} mm`,baseX+o*scale,baseY-15);
    const edge=p.edges.join;if(edge){ctx.strokeStyle=color;ctx.setLineDash([4,4]);path(ctx,edge.map(i=>map(p.uvMm[i])));ctx.stroke();ctx.setLineDash([]);for(const n of p.edgeNotches?.join||[]){const raw=n.t*(edge.length-1),i=Math.min(edge.length-2,Math.floor(raw)),t=raw-i,a=p.uvMm[edge[i]],b=p.uvMm[edge[i+1]],pt=map(a.map((x,k)=>x+(b[k]-x)*t));ctx.fillStyle=color;ctx.beginPath();ctx.arc(...pt,3,0,Math.PI*2);ctx.fill();ctx.font='9px system-ui';ctx.fillText(n.id,pt[0]+5,pt[1]-4);}}
    const q1=map([maxX*.42,maxY*.38]),q2=map([maxX*.42,maxY*.68]);ctx.strokeStyle=color+'99';path(ctx,[q1,q2,[q2[0]-4,q2[1]-6],q2,[q2[0]+4,q2[1]-6]]);ctx.stroke();ctx.fillStyle=color+'aa';ctx.font='9px system-ui';ctx.fillText('布纹',q1[0]+5,q1[1]+12);
  }
  ctx.fillStyle='#89979f';ctx.font='9px system-ui';ctx.fillText('裁切轮廓与材料点为同一来源 · 纸样本身不随仿真改变',16,h-17);
}
function drawCloth(){const {ctx,w,h}=canvas('cloth'),state=lab||preview;if(!state){ctx.fillStyle='#e9a187';ctx.font='12px system-ui';ctx.fillText('校验未通过，不启动求解',24,h/2);return;}const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),scale=Math.min(w/0.53,h/0.5);
  const project=p=>{const x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy,y=p[1]+.045;return [w/2+x*scale,h/2-(y*cp-z*sp)*scale,y*sp+z*cp];};
  ctx.strokeStyle='#303a41';ctx.lineWidth=1;for(let i=-4;i<=4;i++){path(ctx,[project([i*.05,state.floorY,-.2]),project([i*.05,state.floorY,.2])]);ctx.stroke();path(ctx,[project([-.2,state.floorY,i*.05]),project([.2,state.floorY,i*.05])]);ctx.stroke();}
  if(state.obstacle){for(let ring=0;ring<3;ring++){const pts=[];for(let i=0;i<=64;i++){const t=i*Math.PI/32,r=state.sphere.radius,p=[Math.cos(t)*r,Math.sin(t)*r,0];if(ring===1)[p[1],p[2]]=[p[2],p[1]];if(ring===2)[p[0],p[2]]=[p[2],p[0]];pts.push(project(p.map((v,k)=>v+state.sphere.center[k])));}ctx.strokeStyle='#72a09a66';path(ctx,pts);ctx.stroke();}}
  const ps=state.positions.map(project),tris=state.triangles.map(t=>({...t,z:t.ids.reduce((s,i)=>s+ps[i][2],0)/3})).sort((a,b)=>a.z-b.z);
  for(const t of tris){const c=colours[t.panelId]||'#adb8aa';path(ctx,t.ids.map(i=>ps[i]),true);ctx.fillStyle=c+'b9';ctx.fill();ctx.strokeStyle=c+'55';ctx.lineWidth=.45;ctx.stroke();}
  for(const c of state.seamConstraints){ctx.strokeStyle='#95ddb5';ctx.lineWidth=1;path(ctx,[ps[c.a],ps[c.b]]);ctx.stroke();ctx.fillStyle='#a1e2bd';ctx.beginPath();ctx.arc(ps[c.a][0],ps[c.a][1],1.6,0,Math.PI*2);ctx.fill();}
  for(const [id] of state.pins){const p=ps[id];ctx.fillStyle='#f3e4bd';ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);ctx.fill();ctx.font='9px system-ui';ctx.fillText('临时托持',p[0]+7,p[1]-5);}
  ctx.fillStyle='#89979f';ctx.font='9px system-ui';ctx.fillText('显示网格 = 求解网格，无补洞与目标形状回退',16,h-17);
}
function draw(){drawPaper();drawCloth();}
let frameCount=0;function frame(now){if(running&&lab&&!document.hidden){if(now-lastFrame>13){lab.step(1/60);lastFrame=now;drawCloth();if(++frameCount%6===0)updateStats();}}requestAnimationFrame(frame);}
window.addEventListener('resize',draw);document.addEventListener('visibilitychange',()=>lastFrame=performance.now());
window.__TAILOR_QA__={getState:()=>({valid,revision:spec.revision,signature:fingerprint(spec),running,metrics:(lab||preview)?.metrics(),stage:stateTitle()}),step:n=>{if(!lab)throw Error('not cut');for(let i=0;i<n;i++)lab.step();updateStats();draw();return lab.metrics();}};
rebuild();requestAnimationFrame(frame);
