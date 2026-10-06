// Viewport and browser chrome only. The R01 scene and authored camera remain unchanged.
export function createViewportControls({stage,onResize,onLayoutChange}){
  const $=id=>document.getElementById(id),root=document.documentElement;
  const modeButton=$('layoutToggle'),fullButton=$('fullscreenToggle'),toolsButton=$('toolsToggle'),bar=document.querySelector('.controls');
  let mode='reference',statusTimer;
  const fromUrl=()=>new URLSearchParams(location.search).get('layout')==='reference'?'reference':'immersive';
  function apply(next,{writeUrl=false,restoreCamera=false}={}){
    mode=next==='reference'?'reference':'immersive';root.dataset.layout=mode;
    modeButton.textContent=mode==='immersive'?'原版视图':'沉浸视图';
    modeButton.setAttribute('aria-label',mode==='immersive'?'切换到原版视图':'切换到沉浸视图');
    modeButton.dataset.current=mode;
    if(writeUrl){const url=new URL(location.href);url.searchParams.set('layout',mode);history.replaceState(history.state,'',url);}
    if(restoreCamera)onLayoutChange();else onResize();
  }
  function status(text){clearTimeout(statusTimer);$('viewStatus').textContent=text;$('viewStatus').hidden=false;statusTimer=setTimeout(()=>{$('viewStatus').hidden=true;},5000);}
  function syncFullscreen(){const active=document.fullscreenElement===stage;fullButton.innerHTML=active?'⛶ <span>退出全屏</span>':'⛶ <span>全屏</span>';fullButton.setAttribute('aria-label',active?'退出全屏':'进入全屏');fullButton.setAttribute('aria-pressed',String(active));requestAnimationFrame(onResize);}
  modeButton.addEventListener('click',()=>apply(mode==='immersive'?'reference':'immersive',{writeUrl:true,restoreCamera:true}));
  toolsButton.addEventListener('click',()=>{const open=bar.dataset.expanded!=='true';bar.dataset.expanded=String(open);toolsButton.setAttribute('aria-expanded',String(open));toolsButton.setAttribute('aria-label',open?'收起控制工具':'展开控制工具');});
  fullButton.addEventListener('click',async()=>{
    if(document.fullscreenElement){try{await document.exitFullscreen();}catch{status('可以用浏览器的退出全屏操作返回。');}return;}
    apply('immersive',{writeUrl:true,restoreCamera:mode!=='immersive'});
    if(typeof stage.requestFullscreen!=='function'){status('当前浏览器未提供全屏，已切到沉浸视图。');return;}
    try{await stage.requestFullscreen();}catch{status('浏览器未进入全屏，可以继续使用沉浸视图。');}
  });
  document.addEventListener('fullscreenchange',syncFullscreen);
  window.addEventListener('popstate',()=>apply(fromUrl()));
  apply(fromUrl());syncFullscreen();
  return{getState:()=>({layout:mode,fullscreen:document.fullscreenElement===stage,fullscreenSupported:typeof stage.requestFullscreen==='function',toolsExpanded:bar.dataset.expanded==='true'}),setLayout:next=>apply(next,{writeUrl:true,restoreCamera:true})};
}
