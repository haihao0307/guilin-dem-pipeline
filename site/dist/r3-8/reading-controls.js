/** UI only. Does not create a world, change terrain, or alter evidence values. */
export function installReadingControls(){
  if(document.getElementById('panel-toggle'))return;
  const panel=document.querySelector('.focus-panel'),views=document.querySelector('.view-switch'),stage=document.getElementById('stage');
  if(!panel||!views||!stage)return;
  panel.id='view-settings';
  const mobile=()=>matchMedia('(max-width:760px)').matches;
  const button=document.createElement('button');button.id='panel-toggle';button.type='button';button.setAttribute('aria-controls',panel.id);
  views.append(button);views.setAttribute('aria-label','地图与设置');
  function show(open){panel.hidden=!open;button.setAttribute('aria-expanded',String(open));button.textContent=open?'收起设置':'位置与证据';document.documentElement.dataset.wenzhouSettingsOpen=String(open);}
  button.addEventListener('click',()=>show(panel.hidden));show(!mobile());
  document.getElementById('location').addEventListener('change',()=>{if(mobile())show(false);});
  const eye=document.getElementById('eye-card');if(eye)stage.append(eye);
  const eyeButton=document.getElementById('eye-view');
  const observer=new MutationObserver(()=>{if(eyeButton.getAttribute('aria-pressed')==='true')show(false);});
  observer.observe(eyeButton,{attributes:true,attributeFilter:['aria-pressed']});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){show(false);button.focus();}});
  const style=document.createElement('style');style.id='reading-controls-style';style.textContent=`
    #panel-toggle{border-left:1px solid #60748855;border-radius:7px}
    #panel-toggle[aria-expanded="true"]{background:#20313f}
    .focus-panel{width:240px}
    #eye-card{position:absolute;top:112px;right:28px;max-width:310px;z-index:2;pointer-events:none}
    @media(max-width:760px){
      .focus-panel{width:calc(100% - 28px);max-height:calc(100dvh - 286px);background:#13212ef5}
      .focus-panel select{font-size:13px;min-height:40px}
      #eye-card{left:14px;right:14px;top:126px;max-width:none}
      #panel-toggle{min-width:82px}
    }
  `;document.head.append(style);
  const historical=window.__WENZHOU_HISTORY_1942===true;
  if(historical){
    document.title='小温州 · 1940s Map Mother';
    const caption=document.querySelector('.brand p');if(caption)caption.textContent='1940s Map Mother · 历史海陆回退';
  }else{
    document.title='小温州 · 三维地形 R3.9.1';
    const caption=document.querySelector('.brand p');if(caption)caption.textContent='真实 DEM · R3.9.1';
  }
  const heading=document.querySelector('#info h2');if(heading)heading.textContent=historical?'1940s Map Mother · 历史状态':'R3.9.1 · 同一地点的环境证据';
  document.documentElement.dataset.wenzhouReadingControls=historical?'1940s-map-mother':'R3.9.1';
}
