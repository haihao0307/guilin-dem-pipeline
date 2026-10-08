// R06 UI adapter. Existing gameplay listeners retain every original control ID.
// The renderer owns quality persistence and DPR; this module only requests a mode.
let controller;
export function initSettingsUI(){
  if(controller){controller.sync();return controller;}
  const $=id=>document.getElementById(id),root=$('driverGame'),dialog=$('settingsScreen');
  if(!root||!dialog)return null;
  const opener=$('openSettings'),closer=$('closeSettings'),sheet=dialog.querySelector('.settings-sheet'),quality=$('renderQuality');
  const state=()=>window.__trainDriver?.getState?.();
  let returnFocus=null,pausedBySettings=false,priorPauseScreenHidden=true,inertBefore=new Map();
  const focusables=()=>[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length);
  const validQuality=mode=>['clear','auto','smooth'].includes(mode);
  function syncQuality(){const mode=state()?.qualityMode;if(validQuality(mode))quality.value=mode;}
  function syncSignal(){
    const v=state(),locked=['doors-opening','unloading','boarding','ready-depart','doors-closing'].includes(v?.phase);
    const stop=!v?.started||v.paused||v.phase==='summary'||v.finishing||locked||v.station?.canOpen;
    const label=!v?.started?'等待发车':v.paused?'停车 · 暂停':v.phase==='summary'||v.finishing?'停车 · 收车':locked?'停车 · 接送':v.station?.canOpen?'停车 · 开门':'可以行车';
    $('railSignal').dataset.state=stop?'stop':'clear';
    $('railSignal').setAttribute('aria-label','行车提示：'+label);
    $('signalArm').setAttribute('transform',stop?'rotate(0 80 24)':'rotate(-45 80 24)');
    if($('signalLabel').textContent!==label)$('signalLabel').textContent=label;
  }
  function open(){
    if(!dialog.hidden)return;
    returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:opener;
    const v=state();pausedBySettings=!!(v?.started&&!v.paused&&v.phase!=='summary');
    priorPauseScreenHidden=$('pauseScreen').hidden;
    if(pausedBySettings){$('pause').click();$('pauseScreen').hidden=true;}
    $('settingsPauseHint').textContent=pausedBySettings?'行车已暂停。关闭设置后继续驾驶。':v?.paused?'行车已暂停。关闭设置后仍保持暂停。':'调整视角与画面，回来继续这一趟。';
    inertBefore=new Map([...root.children].filter(el=>el!==dialog).map(el=>[el,el.inert]));
    for(const el of inertBefore.keys())el.inert=true;
    dialog.hidden=false;opener.setAttribute('aria-expanded','true');root.dataset.settingsOpen='true';
    syncQuality();syncSignal();closer.focus({preventScroll:true});
  }
  function close({resume=true,restoreFocus=true}={}){
    if(dialog.hidden)return;
    dialog.hidden=true;opener.setAttribute('aria-expanded','false');delete root.dataset.settingsOpen;
    for(const[el,inert]of inertBefore)el.inert=inert;inertBefore.clear();
    const v=state();
    if(pausedBySettings&&resume&&v?.paused&&v.phase!=='summary')$('resume').click();
    else if(v?.paused)$('pauseScreen').hidden=priorPauseScreenHidden;
    pausedBySettings=false;
    if(restoreFocus){const target=returnFocus?.isConnected&&!returnFocus.closest('[hidden],[inert]')?returnFocus:opener;target.focus({preventScroll:true});}
    syncSignal();
  }
  opener.addEventListener('click',open);closer.addEventListener('click',()=>close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
  // Capture before the game's document shortcuts, including P, so menu navigation
  // can never change throttle, brake, station state, or pause behind the dialog.
  document.addEventListener('keydown',e=>{
    if(dialog.hidden)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
    if(e.key==='Tab'){
      const items=focusables(),first=items[0],last=items.at(-1);
      if(!first){e.preventDefault();sheet.focus();}
      else if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus();}
    }
    // Stop only global gaming keys; native input/select keyboard behavior remains.
    if(['KeyW','KeyS','KeyE','KeyP','ArrowUp','ArrowDown','Space'].includes(e.code))e.stopImmediatePropagation();
  },true);
  document.addEventListener('keyup',e=>{if(!dialog.hidden&&['KeyW','KeyS','KeyE','KeyP','ArrowUp','ArrowDown','Space'].includes(e.code))e.stopImmediatePropagation();},true);
  document.addEventListener('focusin',e=>{if(!dialog.hidden&&!dialog.contains(e.target))closer.focus({preventScroll:true});});
  quality.value='clear';
  quality.addEventListener('change',()=>{
    if(validQuality(quality.value))window.dispatchEvent(new CustomEvent('train-quality-change',{detail:{mode:quality.value}}));
  });
  window.addEventListener('train-quality-change',e=>{if(validQuality(e.detail?.mode))quality.value=e.detail.mode;});
  $('toggleHints').addEventListener('click',()=>{queueMicrotask(()=>{$('helpDetails').hidden=$('toggleHints').getAttribute('aria-expanded')!=='true';});});
  // Fullscreen is an existing game action. Keep its settings label in sync.
  function syncFullscreen(){$('fullScreen').textContent=document.fullscreenElement?'退出全屏':'全屏显示';}
  document.addEventListener('fullscreenchange',syncFullscreen);
  // Restart/recover keep their existing game handlers. Dismiss the menu without
  // issuing an additional resume after a restart created the next session.
  $('restart').addEventListener('click',()=>{queueMicrotask(()=>close({resume:false}));});
  $('recover').addEventListener('click',()=>{queueMicrotask(()=>close());});
  const ns='http://www.w3.org/2000/svg';
  function decoratePlatforms(){
    for(const g of $('mapStations').children){
      if(g.querySelector('.map-platform'))continue;
      const point=g.querySelector('circle');if(!point)continue;
      const platform=document.createElementNS(ns,'rect');platform.classList.add('map-platform');
      platform.setAttribute('x',String(Number(point.getAttribute('cx'))-13));platform.setAttribute('y',String(Number(point.getAttribute('cy'))-4));
      platform.setAttribute('width','26');platform.setAttribute('height','8');platform.setAttribute('rx','0.5');
      g.insertBefore(platform,point);
    }
  }
  const mapObserver=new MutationObserver(decoratePlatforms);mapObserver.observe($('mapStations'),{childList:true});decoratePlatforms();
  const statusObserver=new MutationObserver(()=>{syncSignal();syncQuality();});
  for(const id of ['notch','stationHint','pause'])statusObserver.observe($(id),{childList:true});
  controller={open,close,sync(){syncQuality();syncSignal();syncFullscreen();decoratePlatforms();},get isOpen(){return !dialog.hidden;}};
  controller.sync();return controller;
}
// Safe before or after app readiness; app may call initSettingsUI() again to sync.
initSettingsUI();
