// One pointer vocabulary for phone, tablet and mouse. All coordinates remain metres.
export function installMobileShell(S, surface, record) {
  const $=id=>document.getElementById(id),canvas=$('gl'),panel=$('panel');
  let toolbarTimer=0,lastTap=0,gesture=null,holdTimer=0;
  const pointers=new Map(),stats={rotate:0,pinch:0,pan:0,focus:0,cancel:0};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const toolbar=$('touchToolbar'),menu=$('menuButton');
  const reveal=()=>{toolbar.hidden=false;clearTimeout(toolbarTimer);toolbarTimer=setTimeout(()=>{if(!panel.classList.contains('open'))toolbar.hidden=true},5500)};
  function setPanel(open,tab='view'){
    panel.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));
    panel.setAttribute('aria-hidden',String(!open));panel.inert=!open;
    if(open){
      for(const e of panel.querySelectorAll('section'))e.hidden=e.dataset.tab!==tab;
      for(const e of panel.querySelectorAll('[data-tab-button]'))e.classList.toggle('active',e.dataset.tabButton===tab);
      clearTimeout(toolbarTimer);toolbar.hidden=true;
    }else reveal();
  }
  menu.onclick=()=>setPanel(!panel.classList.contains('open'));
  $('sheetClose').onclick=()=>setPanel(false);
  for(const b of document.querySelectorAll('[data-tab-button]'))b.onclick=()=>setPanel(true,b.dataset.tabButton);
  for(const b of toolbar.querySelectorAll('[data-action]'))b.onclick=()=>{
    const a=b.dataset.action;if(a==='weather')setPanel(true,'weather');else{ $(a).click();reveal(); }
  };
  const oldToggle=$('panelToggle');if(oldToggle)oldToggle.onclick=menu.onclick;
  function busy(){S.lastInteraction=performance.now();S.mobileGesture=pointers.size;}
  function pan(dx,dy){
    if(S.ground){const f=[-Math.sin(S.theta),-Math.cos(S.theta)],r=[Math.cos(S.theta),-Math.sin(S.theta)];
      const x=S.eye[0]+(-dy*f[0]+dx*r[0])*.35,z=S.eye[2]+(-dy*f[1]+dx*r[1])*.35,y=surface(x,z);
      if(Number.isFinite(y))S.eye=[x,y+1.61,z];
    }else{
      const scale=2*S.r*Math.tan(Math.PI/8)/innerHeight;
      S.cur[0]-=(dx*Math.cos(S.theta)+dy*Math.sin(S.theta))*scale;
      S.cur[1]+=(dx*Math.sin(S.theta)-dy*Math.cos(S.theta))*scale;
    }
    stats.pan++;busy();
  }
  function focus(x,y){
    if(!S.ready||S.ground)return;
    const norm=v=>{const d=Math.hypot(...v)||1;return v.map(a=>a/d)};
    const f=norm(S.target.map((v,i)=>v-S.eye[i])),r=norm([-f[2],0,f[0]]),u=[-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]];
    const a=(x/innerWidth*2-1)*innerWidth/innerHeight*.41421356,b=(1-y/innerHeight*2)*.41421356;
    const d=norm(f.map((v,i)=>v+r[i]*a+u[i]*b));
    // March toward the DEM surface and refine the actual intersection, never clamp a label.
    let prev=0,hit=null;
    for(let t=2;t<1400000;t=t*1.06+10){
      const px=S.eye[0]+d[0]*t,pz=S.eye[2]+d[2]*t,h=surface(px,pz);
      if(Number.isFinite(h)&&S.eye[1]+d[1]*t<=h){
        let lo=prev,hi=t;for(let i=0;i<18;i++){const m=(lo+hi)/2,hh=surface(S.eye[0]+d[0]*m,S.eye[2]+d[2]*m);if(Number.isFinite(hh)&&S.eye[1]+d[1]*m<=hh)hi=m;else lo=m}
        hit=[S.eye[0]+d[0]*hi,S.eye[2]+d[2]*hi];break;
      }prev=t;
    }
    if(hit){S.cur=hit;S.targetHeight=null;S.r=Math.max(80,S.r*.5);S.lastEye=null;stats.focus++;record('touchFocus',hit)}
    busy();
  }
  function snapshot(){const ps=[...pointers.values()];if(ps.length<2)return null;const [a,b]=ps;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y),angle:Math.atan2(b.y-a.y,b.x-a.x)}}
  canvas.onpointerdown=e=>{
    if(!S.ready)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button,moved:false,time:performance.now()});
    clearTimeout(holdTimer);gesture=snapshot();busy();
    if(pointers.size===1)holdTimer=setTimeout(()=>{const p=pointers.get(e.pointerId);if(p&&!p.moved){p.moved=true;focus(p.x,p.y)}},550);
  };
  canvas.onpointermove=e=>{
    const p=pointers.get(e.pointerId);if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(Math.hypot(p.x-p.startX,p.y-p.startY)>5){p.moved=true;clearTimeout(holdTimer)}
    if(pointers.size>=2){
      const next=snapshot();if(gesture&&next.d>8&&gesture.d>8){
        if(!S.ground){S.r=clamp(S.r*gesture.d/next.d,10,1200000);stats.pinch++;}
        pan(next.x-gesture.x,next.y-gesture.y);
      }gesture=next;
    }else if(p.button===2||e.shiftKey)pan(dx,dy);
    else{S.theta-=dx*.004;if(S.ground)S.pitch=clamp(S.pitch-dy*.003,-1.4,1.4);else S.phi=clamp(S.phi+dy*.003,.002,1.54);stats.rotate++;}
    busy();
  };
  function release(e){
    const p=pointers.get(e.pointerId);clearTimeout(holdTimer);
    if(p&&pointers.size===1&&!p.moved&&performance.now()-p.time<500&&e.type==='pointerup'){
      if(performance.now()-lastTap<300)focus(p.x,p.y);else{setPanel(false);reveal()};lastTap=performance.now();
    }
    if(pointers.size>1)for(const item of pointers.values())item.moved=true;
    pointers.delete(e.pointerId);gesture=null;if(e.type!=='pointerup')stats.cancel++;busy();
  }
  canvas.onpointerup=release;canvas.onpointercancel=release;canvas.onlostpointercapture=release;
  canvas.ondblclick=e=>{if(e.pointerType!=='touch')focus(e.clientX,e.clientY)};
  canvas.oncontextmenu=e=>e.preventDefault();
  canvas.addEventListener('wheel',busy,{passive:true});
  addEventListener('blur',()=>{pointers.clear();gesture=null;clearTimeout(holdTimer)});
  addEventListener('keydown',e=>{if(e.code==='Escape')setPanel(false)});
  $('dayReview').onclick=()=>{S.weather.setCalendarPlaying(false);S.weather.setHour(12);$('calendarToggle').checked=false;record('reviewNoon',true)};
  setPanel(false);toolbar.hidden=true;
  S.mobile={stats,get pointerCount(){return pointers.size},get sheetOpen(){return panel.classList.contains('open')},open:setPanel};
  window.__WZ_TOUCH__={stats,open:setPanel,focus};
  setTimeout(()=>{$('gestureHint').hidden=true},8500);
}
