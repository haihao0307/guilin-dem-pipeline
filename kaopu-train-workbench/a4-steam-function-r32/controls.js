// Whole-object controls. Changes are queued; a frame uses one immutable setting.
window.RESEARCH_UI={
 views:{oblique:[24,13,15],left:[12,3.5,-4],right:[-12,3.5,-4],front:[10,6,22]},
 playing:false,dirty:false,busy:false,ready:false,sweepCache:new Map(),orbitEye:null,
 cameraEye(){const base=this.orbitEye||this.views[document.getElementById('view').value],target=[0,1.8,-4],scale=Number(document.getElementById('camera-distance').value);return base.map((v,i)=>target[i]+(v-target[i])*scale);},
 orbit(dx,dy,base=this.orbitEye||this.views[document.getElementById('view').value]){const target=[0,1.8,-4],v=base.map((n,i)=>n-target[i]),r=Math.hypot(...v),yaw=Math.atan2(v[0],v[2])+dx*.006,pitch=Math.max(-1.35,Math.min(1.35,Math.asin(v[1]/r)+dy*.006));this.orbitEye=[target[0]+r*Math.cos(pitch)*Math.sin(yaw),target[1]+r*Math.sin(pitch),target[2]+r*Math.cos(pitch)*Math.cos(yaw)];return this.orbitEye;},
 settings(){let mode=document.getElementById('installation').value,beta=Number(document.getElementById('inclination').value);return {appearance:SURFACE.snapshot(document.getElementById('appearance').value),installation:DYNAMIC.snapshot({mode,beta,steamRevision:document.getElementById('steam-revision').value,regulatorOpen:Number(document.getElementById('regulator').value)}),time:Number(document.getElementById('time').value),eye:this.cameraEye(),cut:document.getElementById('cutaway').checked?Number(document.getElementById('cut').value):100};},
 describe(s){const b=s.installation.beta,theta=.4+s.time,key=b.toFixed(6);if(!this.sweepCache.has(key))this.sweepCache.set(key,DYNAMIC.installationSweep(b));const sweep=this.sweepCache.get(key),current=DYNAMIC.localClearance(b,theta),mm=v=>(v*1000).toFixed(2),state=sweep.localStatus==='COLLISION'?'FAIL · 局部碰撞':sweep.localStatus==='BELOW_ASSUMED_5MM'?'FAIL · 低于假设 5 mm':'仅该采样局部阈值通过';
 document.getElementById('inclination-value').textContent=`${b.toFixed(3)} rad / ${(b*180/Math.PI).toFixed(3)}°`;
 document.getElementById('time-value').textContent=`${s.time.toFixed(3)} s · theta ${theta.toFixed(3)} rad`;
 document.getElementById('cut-value').textContent=s.cut===100?'外观完整':`X ≤ ${s.cut.toFixed(2)} m`;
 document.getElementById('inclination').disabled=s.installation.mode==='baseline';
 document.getElementById('cut').disabled=s.cut===100;
 document.getElementById('regulator').disabled=s.installation.mode!=='candidate'||s.installation.steamRevision!=='r32';
 document.getElementById('regulator-value').textContent=s.installation.mode==='candidate'&&s.installation.steamRevision==='r32'?'示意开度 '+s.installation.regulatorOpen.toFixed(2)+(s.installation.regulatorOpen===0?' · 阀座关断':' · 有开口，不代表流量或压力'):'保留旧态：新增调节阀未接入';
 document.getElementById('diagnostic').textContent=`${s.installation.mode==='baseline'?'保留失败基线':'官方拓扑 / 未量定尺寸整车候选'} · L = 3.500 m 固定\n中连杆 / 前动轴：${state}。当前相位间隙 ${mm(current)} mm；整周 1,441 个采样的最小间隙 ${mm(sweep.minimumMargin)} mm。\n同一采样中导板最小重叠 ${mm(sweep.minimumGuideOverlap)} mm，活塞端部余量 ${mm(sweep.minimumPistonEndMargin)} mm。半径、5 mm 阈值及安装尺寸均为推断。${s.installation.mode==='candidate'?'\n当前候选局部通过、整车功能仍有未完成项：侧置独立阀胸、共铸腹板与同相位阀头已接入；车架开口与枢轴支撑已接入，外贴端盖按官方实照构造并有有限紧固件，历史尺寸、汽路与强度仍待证。原中央安装失败保留在 R28。':''}`;
 document.getElementById('diagnostic').dataset.state=sweep.localStatus==='SAMPLED_LOCAL_THRESHOLD_ONLY'?'local':'fail';
 return s;
 },
 showRendered(theta,installation,appearance=SURFACE.snapshot()){document.getElementById('rendered').textContent=`已显示：${installation.mode==='baseline'?'失败基线':installation.steamRevision==='r32'?'R32 函数示意候选':'保留 R31 候选'} ${installation.beta.toFixed(3)} rad · theta ${theta.toFixed(3)} rad · ${appearance.mode==='waves'?'表面造波研究（非位移）':'原诊断色'}`;},
 async request({throwOnError=false}={}){
  const runId=window.A4_STARTUP?.state.runId;this.dirty=true;this.describe(this.settings());
  if(!this.ready)return {status:'not-ready',runId};if(this.busy)return {status:'queued',runId};
  const requestGeneration=(this.requestGeneration||0)+1;this.requestGeneration=requestGeneration;this.busy=true;let frame;
  try{
   while(this.dirty){
    if(window.A4_STARTUP&&runId!==window.A4_STARTUP.state.runId)return {status:'stale',runId};
    window.A4_STARTUP?.assertActive(runId);
    this.dirty=false;const s=this.describe(this.settings());DYNAMIC.selectInstallation(s.installation.mode,s.installation.beta);DYNAMIC.selectSteam(s.installation.steamRevision,s.installation.regulatorOpen);
    document.getElementById('rendered').textContent='整车帧正在计算；操作会合并为最新设置。';
    frame=await renderAt(s.time,{eye:s.eye},{cut:s.cut,initialTheta:.4,angularSpeed:1,installation:s.installation,appearance:s.appearance});
    if(window.A4_STARTUP&&runId!==window.A4_STARTUP.state.runId)return {status:'stale',runId};
    if(!frame||frame.done!==true||frame.glError!==0||!(frame.draws>0))throw Error('整车帧未完成有效提交；不能标记首帧已提交。');
    if(window.A4_STARTUP?.state.errors.length)throw Error('当前初始化已有诊断失败；需完整重新初始化。');
    if(this.playing){let control=document.getElementById('time');control.value=((s.time+.15)%(2*Math.PI)).toFixed(3);this.dirty=true;await new Promise(r=>setTimeout(r,80));}
   }
   if(window.A4_STARTUP&&runId!==window.A4_STARTUP.state.runId)return {status:'stale',runId};
   window.A4_STARTUP?.assertActive(runId);
   return {status:'submitted',runId,frame};
  }catch(e){
   if(window.A4_STARTUP&&runId!==window.A4_STARTUP.state.runId)return {status:'stale',runId};
   this.playing=false;QA.done=false;QA.errors.push(String(e));window.A4_STARTUP?.fail('整车帧计算失败：'+String(e),runId);
   document.getElementById('rendered').textContent='整车帧计算失败；未确认新帧。';document.getElementById('status').textContent=String(e);
   if(throwOnError)throw e;return {status:'failed',runId,error:String(e)};
  }finally{if(this.requestGeneration===requestGeneration&&(!window.A4_STARTUP||runId===window.A4_STARTUP.state.runId)){this.busy=false;document.getElementById('play').textContent=this.playing?'暂停逐帧':'逐帧播放';}}
 },
 install(){this.ready=true;if(this.listenersInstalled){this.describe(this.settings());return;}this.listenersInstalled=true;for(const id of ['installation','inclination','time','view','cutaway','cut','appearance','steam-revision','regulator','camera-distance'])document.getElementById(id).addEventListener('input',()=>{if(id==='view'){this.orbitEye=null;document.getElementById('camera-distance').value='1';}this.request();});
 const canvas=document.getElementById('c');let drag=null;canvas.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,eye:(this.orbitEye||this.views[document.getElementById('view').value]).slice()};canvas.setPointerCapture?.(e.pointerId);});canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;this.orbit(e.clientX-d.x,e.clientY-d.y,d.eye);this.request();});canvas.addEventListener('pointercancel',()=>{drag=null;});
 document.getElementById('example').addEventListener('click',()=>{document.getElementById('installation').value='candidate';document.getElementById('steam-revision').value='r32';document.getElementById('inclination').value='.126';this.request();});
 document.getElementById('baseline').addEventListener('click',()=>{this.playing=false;document.getElementById('installation').value='baseline';document.getElementById('time').value='0';document.getElementById('play').textContent='逐帧播放';this.request();});
 document.getElementById('collision').addEventListener('click',()=>{this.playing=false;document.getElementById('installation').value='baseline';document.getElementById('time').value=String(3.3545228223-.4);document.getElementById('cutaway').checked=true;document.getElementById('cut').value='0';document.getElementById('view').value='left';this.request();});
 document.getElementById('play').addEventListener('click',()=>{this.playing=!this.playing;document.getElementById('play').textContent=this.playing?'暂停逐帧':'逐帧播放';this.request();});
 this.describe(this.settings());}
};
