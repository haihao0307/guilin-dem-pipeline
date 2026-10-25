// Whole-object controls. Changes are queued; a frame uses one immutable setting.
window.RESEARCH_UI={
 views:{oblique:[24,13,15],left:[12,3.5,-4],right:[-12,3.5,-4],front:[10,6,22]},
 playing:false,dirty:false,busy:false,ready:false,sweepCache:new Map(),
 settings(){let mode=document.getElementById('installation').value,beta=Number(document.getElementById('inclination').value);return {appearance:SURFACE.snapshot(document.getElementById('appearance').value),installation:DYNAMIC.snapshot({mode,beta}),time:Number(document.getElementById('time').value),eye:this.views[document.getElementById('view').value],cut:document.getElementById('cutaway').checked?Number(document.getElementById('cut').value):100};},
 describe(s){const b=s.installation.beta,theta=.4+s.time,key=b.toFixed(6);if(!this.sweepCache.has(key))this.sweepCache.set(key,DYNAMIC.installationSweep(b));const sweep=this.sweepCache.get(key),current=DYNAMIC.localClearance(b,theta),mm=v=>(v*1000).toFixed(2),state=sweep.localStatus==='COLLISION'?'FAIL · 局部碰撞':sweep.localStatus==='BELOW_ASSUMED_5MM'?'FAIL · 低于假设 5 mm':'仅该采样局部阈值通过';
 document.getElementById('inclination-value').textContent=`${b.toFixed(3)} rad / ${(b*180/Math.PI).toFixed(3)}°`;
 document.getElementById('time-value').textContent=`${s.time.toFixed(3)} s · theta ${theta.toFixed(3)} rad`;
 document.getElementById('cut-value').textContent=s.cut===100?'外观完整':`X ≤ ${s.cut.toFixed(2)} m`;
 document.getElementById('inclination').disabled=s.installation.mode==='baseline';
 document.getElementById('cut').disabled=s.cut===100;
 document.getElementById('diagnostic').textContent=`${s.installation.mode==='baseline'?'保留失败基线':'推断整体候选，不是史实修复'} · L = 3.500 m 固定\n中连杆 / 前动轴：${state}。当前相位间隙 ${mm(current)} mm；整周 1,441 个采样的最小间隙 ${mm(sweep.minimumMargin)} mm。\n同一采样中导板最小重叠 ${mm(sweep.minimumGuideOverlap)} mm，活塞端部余量 ${mm(sweep.minimumPistonEndMargin)} mm。半径、5 mm 阈值及安装尺寸均为推断。${s.installation.mode==='candidate'?'\n整体仍 FAIL：当前函数候选与车架 / 中缸场相交，真实开口与安装待证。不能据此断言真实机车相撞；表面研究不修复实体干涉。':''}`;
 document.getElementById('diagnostic').dataset.state=sweep.localStatus==='SAMPLED_LOCAL_THRESHOLD_ONLY'?'local':'fail';
 return s;
 },
 showRendered(theta,installation,appearance=SURFACE.snapshot()){document.getElementById('rendered').textContent=`已显示：${installation.mode==='baseline'?'失败基线':'推断候选'} ${installation.beta.toFixed(3)} rad · theta ${theta.toFixed(3)} rad · ${appearance.mode==='waves'?'表面造波研究（非位移）':'原诊断色'}`;},
 async request(){this.dirty=true;this.describe(this.settings());if(!this.ready||this.busy)return;this.busy=true;try{while(this.dirty){this.dirty=false;const s=this.describe(this.settings());DYNAMIC.selectInstallation(s.installation.mode,s.installation.beta);document.getElementById('rendered').textContent='整车帧正在计算；操作会合并为最新设置。';await renderAt(s.time,{eye:s.eye},{cut:s.cut,initialTheta:.4,angularSpeed:1,installation:s.installation,appearance:s.appearance});if(this.playing){let control=document.getElementById('time');control.value=((s.time+.15)%(2*Math.PI)).toFixed(3);this.dirty=true;await new Promise(r=>setTimeout(r,80));}}}catch(e){this.playing=false;QA.errors.push(String(e));document.getElementById('status').textContent=String(e);}finally{this.busy=false;document.getElementById('play').textContent=this.playing?'暂停逐帧':'逐帧播放';}},
 install(){this.ready=true;for(const id of ['installation','inclination','time','view','cutaway','cut','appearance'])document.getElementById(id).addEventListener('input',()=>this.request());
 document.getElementById('example').addEventListener('click',()=>{document.getElementById('installation').value='candidate';document.getElementById('inclination').value='.126';this.request();});
 document.getElementById('baseline').addEventListener('click',()=>{this.playing=false;document.getElementById('installation').value='baseline';document.getElementById('time').value='0';document.getElementById('play').textContent='逐帧播放';this.request();});
 document.getElementById('collision').addEventListener('click',()=>{this.playing=false;document.getElementById('installation').value='baseline';document.getElementById('time').value=String(3.3545228223-.4);document.getElementById('cutaway').checked=true;document.getElementById('cut').value='0';document.getElementById('view').value='left';this.request();});
 document.getElementById('play').addEventListener('click',()=>{this.playing=!this.playing;document.getElementById('play').textContent=this.playing?'暂停逐帧':'逐帧播放';this.request();});
 this.describe(this.settings());}
};
