/** One-shot UI control recipe only. No simulation clock, force or pose writes. */
export function createDemoStart({snapshot,applyControls,setPaused}){
 let used=false,emergencyLocked=false,mode='manual';
 const state=()=>({used,emergencyLocked,mode});
 return {
  state,
  available(){return !used&&!emergencyLocked&&Math.abs(snapshot().speedMps)<1e-4;},
  start(){
   if(emergencyLocked)return {applied:false,reason:'急刹后演示已锁定，请先复位；手动操纵仍可用。'};
   if(used)return {applied:false,reason:'演示只设定一次；现由你操纵，重新演示请复位。'};
   if(Math.abs(snapshot().speedMps)>=1e-4)return {applied:false,reason:'列车未停稳，不能自动改设前进；请先停车。'};
   const before=snapshot();
   try{
    // Both patches are synchronous with no intervening clock advance.
    applyControls({throttle:0,reverser:1});
    applyControls({brake:0,cutoff:.55,throttle:.30});
    setPaused(false);
   }catch(error){
    applyControls({...before.controls,throttle:0});
    applyControls(before.controls);
    setPaused(before.paused);
    throw error;
   }
   used=true;mode='demo';
   return {applied:true,reason:'已一次设定前进、松刹、30%油门和55%截汽；等待制动逐渐缓解，实际起步由牵引和阻力决定。'};
  },
  manual(){mode='manual';},
  emergency(){emergencyLocked=true;mode='emergency';applyControls({throttle:0,brake:1});},
  reset(){used=false;emergencyLocked=false;mode='manual';return state();}
 };
}
export function motionReason(s,assist={}){
 if(s.paused&&assist.mode==='emergency')return {code:'emergency-paused',short:'急刹/暂停',text:'急刹后模拟暂停；自动演示已锁定，复位后可再演示。'};
 if(s.paused)return {code:'paused',short:'模拟暂停',text:assist.used||assist.emergencyLocked||Math.abs(s.speedMps)>=1e-4?'模拟已暂停；继续请点“运行模拟”，重新演示请先复位。':'模拟已暂停。演示起步会松刹给油；“运行模拟”只启动时钟。'};
 const v=Math.abs(s.speedMps),c=s.controls;
 if(v>.02)return assist.mode==='emergency'?{code:'emergency',short:'紧急制动',text:'紧急制动中：油门关闭，制动力逐渐建立。'}:{code:c.brake>.01?'braking':'moving',short:c.brake>.01?'制动中':'行驶中',text:c.brake>.01?'列车正在制动。':'列车行驶中；油门、截汽和制动由你控制。'};
 if(assist.mode==='emergency')return v>=1e-4?{code:'emergency-creeping',short:'低速制动',text:'列车仍在低速制动；演示已锁定。'}:{code:'emergency-stopped',short:'急刹停车',text:'急刹停车；演示已锁定，复位后可重新演示。手动操纵仍可用。'};
 if(c.brake>.01)return {code:'brake-command',short:v>=1e-4?'低速制动':'制动停车',text:(v>=1e-4?'低速制动：':'停车：')+'制动 '+Math.round(c.brake*100)+'%'+(c.throttle<=.001?'，油门关闭。':'。')+(!assist.used&&!assist.emergencyLocked&&v<1e-4?' 可手动松刹给油，或点一次演示起步。':' 请手动操纵；重新演示需复位。')};
 if(c.reverser===0)return {code:'neutral',short:'方向中立',text:'方向在中立位，不能产生牵引；请选前进或后退。'};
 if(c.throttle<=.001)return {code:'throttle-closed',short:'油门关闭',text:'油门关闭，当前没有驱动输入；请开油门。'};
 if(s.brakeFraction>.02)return {code:'brake-releasing',short:'缓解制动',text:'正在缓解制动；请稍候观察，起步还受牵引和阻力影响。'};
 if(s.waterKg<=0)return {code:'no-water',short:'无可用水',text:'可用水已耗尽，无法继续供汽。'};
 if(s.diagnostics.tractionLimitedBySupply)return {code:'supply-limited',short:'供汽受限',text:'供汽受限，当前速度很低；请检查锅炉和蒸汽状态。'};
 return {code:'low-speed',short:'低速起步',text:'速度很低；观察牵引与制动状态，必要时手动调整油门。'};
}
