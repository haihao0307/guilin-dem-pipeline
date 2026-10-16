// Restores the original 88 controls and joins their clock to the existing host.
// No new motion integrator, teleport-on-start, or replacement vehicle is used.
export function installGameControlBridge(host,game){
 const clock=host.simulationClock;if(!clock||typeof clock.setPaused!=='function')throw Error('Existing host simulation clock unavailable');
 const ids=['depart','coast','emergency','drivePause','rate','throttleControl','brakeControl','trainHUD','driver','sceneTools','pause'];
 const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
 for(const id of ids)if(!el[id])throw Error('Original 88 control missing: '+id);
 const original={depart:el.depart.onclick,pause:game.pause.bind(game),tick:game.tick.bind(game),reviewAt:game.reviewAt.bind(game),reviewChainage:game.reviewChainage.bind(game)};
 let departed=false,transitions=0,lastPhase='ready';
 const badge=document.createElement('p');badge.id='gameStateR07';badge.setAttribute('aria-live','polite');el.driver.prepend(badge);
 const note='原88物理：汽门、制动、汽压、轮轴与整列沿同一线路推进；中心轨无贴邻站台，暂不提供上下客。';
 function state(){const g=game.getState(),p=game.drive.snapshot();return{ready:!!host.qa.ready,phase:!departed?'ready':g.paused?'paused':'running',gamePaused:g.paused,hostPaused:clock.paused,physicsPaused:p.paused,positionM:p.positionM,speedMps:p.speedMps,physicsTimeS:p.timeS,physicsTick:p.tick,controls:{...p.controls},wheelAngleRad:p.wheelAngleRad,routeLengthM:game.route.length,mode:g.mode,transitions,physicsSource:'retained 88 DrivingPhysics 120Hz',kinematicReplacement:false};}
 function sync(){const s=state();if(s.phase!==lastPhase){transitions++;lastPhase=s.phase;}badge.textContent=(s.phase==='ready'?'待发车':s.phase==='paused'?'游戏已暂停':'游戏运行中')+' · '+Math.abs(s.speedMps*3.6).toFixed(1)+' km/h';el.pause.textContent=s.phase==='ready'?'启动游戏':s.gamePaused?'继续游戏':'暂停游戏';el.drivePause.textContent=s.phase==='ready'?'启动':s.gamePaused?'继续':'暂停';el.depart.textContent=departed?'牵引 / 出发':'出发';el.depart.disabled=!s.ready;el.drivePause.disabled=!s.ready;el.pause.disabled=!s.ready;host.qa.gameControls={...s,driverVisible:getComputedStyle(el.trainHUD).display!=='none'};return s;}
 game.pause=(value=true)=>{original.pause(!!value);clock.setPaused(!!value);host.requestFrame();return sync();};
 el.depart.onclick=()=>{if(!host.qa.ready)return;original.depart();if(!game.getState().paused){departed=true;clock.setPaused(false);document.getElementById('trainNotice').textContent=note;}host.requestFrame();sync();};
 const toggle=()=>{if(!host.qa.ready)return;if(!departed)el.depart.click();else game.pause(!game.getState().paused);};
 el.drivePause.onclick=toggle;el.pause.onclick=toggle;
 game.tick=(dt,paused)=>{original.tick(dt,paused);if(departed&&game.getState().paused&&!clock.paused)clock.setPaused(true);sync();};
 const reset=(method,args)=>{const result=original[method](...args);departed=false;clock.setPaused(true);host.requestFrame();sync();return result;};
 game.reviewAt=(...args)=>reset('reviewAt',args);game.reviewChainage=(...args)=>reset('reviewChainage',args);
 // The existing selector used its closure directly; bind it to the same reset API.
 const review=document.getElementById('reviewLocation');review.onchange=e=>{if(e.target.value)game.reviewAt(e.target.value);e.target.value='';};
 const tools=el.sceneTools;for(const[id,title]of[['routeR04Toolbar','路线与隧道视图'],['consistR05Toolbar','整列、车厢与蒸汽']]){const bar=document.getElementById(id);if(!bar)continue;const d=document.createElement('details');d.className='gameAdvanced';const summary=document.createElement('summary');summary.textContent=title;d.append(summary,bar);tools.append(d);}
 const panelToggle=document.getElementById('nextPanels');if(panelToggle?.onclick){const fold=panelToggle.onclick;panelToggle.onclick=(e)=>{fold(e);el.trainHUD.scrollTop=0;};}
 el.trainHUD.setAttribute('aria-label','88号游戏驾驶控制');el.driver.querySelector('h3').textContent='88号 · 实际驾驶控制';document.getElementById('trainNotice').textContent=note;
 game.pause(true);
 const api={ready:true,start:()=>game.start(),pause:()=>game.pause(true),resume:()=>{if(!departed)game.start();else game.pause(false);},toggle,state,originalControlIds:ids.slice(),sameDrive:game.drive,sameRoute:game.route};
 if(!window.OceanMother?.pause||!window.OceanMother?.play)throw Error('Existing weather clock API unavailable');
 window.OceanMother.pause=()=>api.pause();window.OceanMother.play=()=>api.resume();
 window.HKGameR07=api;return api;
}
