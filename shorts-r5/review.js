/* Only fitting review and the original HumanLab commands; no second animator. */
(() => {
 const $=id=>document.getElementById(id);let ready=false;
 const output=(message,error=false)=>{const el=$('r5-status');if(el){el.textContent=message;el.dataset.error=String(error);}};
 const download=(data,name)=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 const boot=setInterval(()=>{
  if(window.__startupError){output('启动失败：'+window.__humanStartup?.message,true);clearInterval(boot);return;}
  if(!window.HumanLab?.compact?.skirt||window.__humanStartup?.status!=='ready'){output(window.__compactLoading?.message||window.__humanStartup?.message||'正在从原人物参数生成身体与短裤…');return;}
  clearInterval(boot);ready=true;const lab=window.HumanLab,garment=()=>lab.compact.skirt;
  const camera=(view='quarter',close=false)=>{
   lab.setCameraFollow(false);lab.focus('body');const r=lab.renderer;
   r.yaw=lab.agent.yaw+({front:0,back:Math.PI,left:Math.PI/2,right:-Math.PI/2,quarter:.35}[view]??.35);r.pitch=close?.04:.015;
   r.distance=close?1.35:2.7;r.target=[lab.agent.pos[0],lab.agent.pos[1]+(close?-.035:0),lab.agent.pos[2]];r.projection='perspective';lab.render();
  };
  const action=kind=>{
   try{
    if(kind==='reset'){lab.setAuto(false);lab.agent.reset();lab.advance(.15);camera();output('已恢复原人物站立。');return;}
    if(kind==='pause'){lab.agent.paused=!lab.agent.paused;lab.setAuto(!lab.agent.paused);output(lab.agent.paused?'已暂停，可旋转检查短裤。':'动作继续。');return;}
    const commands={walk:'向前走1米',turn:'向左转90度',sit:'坐在地上',stand:'站起来',wave:'挥手'};
    if(!commands[kind])throw Error('未知测试动作');
    lab.command(commands[kind]);lab.setCameraFollow(true);lab.setAuto(true);output('原人物动作：'+commands[kind]);
   }catch(e){output(e.message,true);}
  };
  for(const el of document.querySelectorAll('[data-r5-action]'))el.onclick=()=>action(el.dataset.r5Action);
  for(const el of document.querySelectorAll('[data-r5-view]'))el.onclick=()=>camera(el.dataset.r5View,el.dataset.close==='true');
  $('r5-export').onclick=()=>download(garment().card,'SHORTS_ORIGINAL_R5_CARD.json');
  const card=garment().card,f=card.fit;
  $('r5-data').textContent=`原人物 ${Math.round(card.source.heightM*1000)} mm\n腰围参考 ${Math.round(f.waistCircumference*1000)} mm\n臀围参考 ${Math.round(f.hipCircumference*1000)} mm\n裤长 ${Math.round(f.outseam*1000)} mm\n一体裤裆 · 折叠腰头 · 两个裤脚\n${card.topology.triangles.toLocaleString()} 个三角面`;
  for(const b of document.querySelectorAll('#r5-ui button'))b.disabled=false;
  window.ShortsR5={version:'R5.0-original-connected',card:()=>garment().card,report:()=>garment().report,action,camera,ready:true,originalHumanSource:card.source.commit};
  window.__SHORTS_R5_READY__=true;
  try{localStorage.setItem('shorts-original-r5-card',JSON.stringify(card));}catch{}
  camera();lab.setAuto(true);output('已就绪：原 R2 人物 + 自动适配短裤');
  setInterval(()=>{if(lab.agent.error)output('原动作系统：'+lab.agent.error,true);},500);
 },150);
 addEventListener('error',e=>{if(!ready)output('启动错误：'+(e.message||e.target?.src||'资源失败'),true);},true);
 addEventListener('unhandledrejection',e=>output('运行错误：'+(e.reason?.message||e.reason),true));
})();
