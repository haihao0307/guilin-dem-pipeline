/* The original HumanLab owns every action, pose and transition. */
(() => {
 const $=id=>document.getElementById(id);let ready=false,pendingReset=false;
 const output=(message,error=false)=>{const el=$('r5-status');if(el){el.textContent=message;el.dataset.error=String(error);}};
 const download=(data,name)=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 const boot=setInterval(()=>{
  if(window.__startupError){output('启动失败：'+window.__humanStartup?.message,true);clearInterval(boot);return;}
  if(!window.HumanLab?.compact?.skirt||window.__humanStartup?.status!=='ready'){output(window.__compactLoading?.message||window.__humanStartup?.message||'正在从原人物参数生成身体与短裤…');return;}
  clearInterval(boot);ready=true;const lab=window.HumanLab,garment=()=>lab.compact.skirt;
  const camera=(view='quarter',close=false)=>{lab.setCameraFollow(false);lab.focus('body');const r=lab.renderer;r.yaw=lab.agent.yaw+({front:0,back:Math.PI,left:Math.PI/2,right:-Math.PI/2,quarter:.35}[view]??.35);r.pitch=close?.04:.015;r.distance=close?1.35:2.7;r.target=[lab.agent.pos[0],lab.agent.pos[1]+(close?-.035:0),lab.agent.pos[2]];r.projection='perspective';lab.render();};
  const finishReset=()=>{lab.agent.reset();pendingReset=false;lab.advance(.15);camera();output('已恢复原人物站立。');};
  const action=kind=>{
   try{
    if(kind==='reset'){if(lab.agent.activity().error){location.reload();return{accepted:true,reloading:true};}lab.agent.cancel();lab.agent.paused=false;if(lab.agent.activity().readyForTask)finishReset();else{pendingReset=true;lab.setAuto(true);output('停止当前任务，等待原动作收脚后复位…');}return{accepted:true,pendingReset};}
    if(kind==='stand')throw Error('原起身动作存在落脚可达问题，本轮暂不启用；请用站立复位返回站姿。');
    if(kind==='pause'){lab.agent.paused=!lab.agent.paused;lab.setAuto(!lab.agent.paused);output(lab.agent.paused?'已暂停，可旋转检查短裤。':'动作继续。');return{accepted:true};}
    if(pendingReset||!lab.agent.activity().readyForTask)throw Error('当前动作或收脚尚未结束，请稍候；暂停后可检查服装。');
    const commands={walk:'向前走1米',turn:'向左转90度',sit:'坐在地上',wave:'挥手'};if(!commands[kind])throw Error('未知测试动作');
    const plan=lab.command(commands[kind]);lab.setCameraFollow(true);lab.setAuto(true);output('原人物动作：'+commands[kind]);return{accepted:true,plan};
   }catch(e){output(e.message,true);return{accepted:false,error:e.message};}
  };
  for(const el of document.querySelectorAll('[data-r5-action]'))el.onclick=()=>action(el.dataset.r5Action);
  for(const el of document.querySelectorAll('[data-r5-view]'))el.onclick=()=>camera(el.dataset.r5View,el.dataset.close==='true');
  $('r5-export').onclick=()=>download(garment().card,'SHORTS_ORIGINAL_R5_CARD.json');
  const card=garment().card,f=card.fit;$('r5-data').textContent=`原人物 ${Math.round(card.source.heightM*1000)} mm\n腰围参考 ${Math.round(f.waistCircumference*1000)} mm\n臀围参考 ${Math.round(f.hipCircumference*1000)} mm\n裤长 ${Math.round(f.outseam*1000)} mm\n连续裤裆 · 折叠腰头 · 两个裤脚\n原人体 8 权重蒙皮\n${card.topology.triangles.toLocaleString()} 个三角面`;
  for(const b of document.querySelectorAll('#r5-ui button')){b.disabled=b.dataset.r5Action==='stand';if(b.disabled)b.title='原动作触发落脚不可达，本轮不计为通过；用站立复位返回站姿。';}
  window.ShortsR5={version:'R5.3-original-body-binding',card:()=>garment().card,report:()=>garment().report,action,camera,ready:true,originalHumanSource:card.source.commit};window.__SHORTS_R5_READY__=true;
  try{localStorage.setItem('shorts-original-r5-card',JSON.stringify(card));}catch{}
  camera();lab.setAuto(true);output('已就绪：原 R2 人物 + 自动适配短裤');
  setInterval(()=>{const a=lab.agent.activity();if(pendingReset&&a.readyForTask){try{finishReset();}catch(e){pendingReset=false;output(e.message,true);}}for(const b of document.querySelectorAll('[data-r5-action]'))if(!['reset','pause'].includes(b.dataset.r5Action))b.disabled=b.dataset.r5Action==='stand'||pendingReset||!a.readyForTask;if(a.error)output('原动作系统：'+a.error,true);},200);
 },150);
 addEventListener('error',e=>{if(!ready)output('启动错误：'+(e.message||e.target?.src||'资源失败'),true);},true);
 addEventListener('unhandledrejection',e=>output('运行错误：'+(e.reason?.message||e.reason),true));
})();
