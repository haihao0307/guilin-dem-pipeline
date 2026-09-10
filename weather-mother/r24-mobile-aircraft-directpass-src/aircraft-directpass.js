(()=>{'use strict';
const base=window.WeatherMobileR23;
if(!base)return;
const cloudCanvas=document.getElementById('c');
if(!cloudCanvas)return;
const overlay=document.createElement('canvas');
overlay.id='aircraft-directpass-r24';
overlay.setAttribute('aria-label','R24 手机安全飞机直绘层');
Object.assign(overlay.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'3',pointerEvents:'none',background:'transparent'});
cloudCanvas.insertAdjacentElement('afterend',overlay);
const ctx=overlay.getContext('2d',{alpha:true,desynchronized:true});
if(!ctx)return;
const qa={
  version:'WM-R24-MOBILE-AIRCRAFT-DIRECTPASS-20260911',ready:false,frames:0,errors:[],
  overlayContext:'2d',cloudContext:'webgl1',directPass:true,sharedDepth:false,
  aircraftGeometry:'procedural-mobile-direct-pass-candidate',alphaPixels:0,bounds:[0,0,0,0],
  lastRoll:0,lastPitch:0,cloudVisibleInvariant:false
};
let visible=true,lastW=0,lastH=0,lastDpr=0;
function resize(){
  const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(innerWidth*dpr)),h=Math.max(1,Math.round(innerHeight*dpr));
  if(w===lastW&&h===lastH&&dpr===lastDpr)return;
  overlay.width=w;overlay.height=h;lastW=w;lastH=h;lastDpr=dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
function poly(points,fill,stroke,width=1){
  ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function ellipse(x,y,rx,ry,fill,stroke){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function drawAircraft(state){
  const w=innerWidth,h=innerHeight;
  const scale=Math.max(.72,Math.min(1.08,w/390));
  const cx=w*.5,cy=h*.69+Math.max(-18,Math.min(18,state.pitch*38));
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-state.roll*.72);ctx.scale(scale,scale);
  ctx.shadowColor='rgba(7,18,29,.28)';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
  // Far wing first: broad, continuous, intentionally simple mobile-safe geometry.
  poly([[-88,6],[-23,-8],[23,-8],[88,6],[82,16],[23,8],[-23,8],[-82,16]],'rgba(109,122,132,.96)','rgba(28,42,53,.55)',1.2);
  // Four engine nacelles make this a deliberate multi-engine aircraft proxy rather than a HUD icon.
  for(const x of [-51,-26,26,51]){
    ellipse(x,6,8.2,11.5,'rgba(75,88,99,.98)','rgba(24,34,43,.72)');
    ellipse(x,3.5,5.1,6.2,'rgba(31,40,48,.95)','rgba(185,195,200,.45)');
  }
  // Tailplane and vertical fin.
  poly([[-35,43],[-10,35],[10,35],[35,43],[31,50],[10,46],[-10,46],[-31,50]],'rgba(96,108,118,.98)','rgba(28,42,53,.55)',1.1);
  poly([[0,42],[5,27],[11,45],[7,55],[-2,55],[-5,46]],'rgba(87,100,111,.98)','rgba(24,36,46,.62)',1.1);
  // Fuselage, read as a rear/chase-view body. Nose recedes upward into the cloud field.
  const g=ctx.createLinearGradient(0,-60,0,60);g.addColorStop(0,'rgba(178,186,190,.96)');g.addColorStop(.52,'rgba(118,131,141,.99)');g.addColorStop(1,'rgba(72,84,94,.99)');
  poly([[-8,53],[-13,29],[-12,-7],[-8,-47],[0,-64],[8,-47],[12,-7],[13,29],[8,53]],g,'rgba(30,43,53,.72)',1.2);
  // Canopy / dorsal highlight.
  poly([[-5,-31],[-3,-45],[0,-51],[3,-45],[5,-31],[0,-25]],'rgba(82,111,130,.9)','rgba(219,232,238,.45)',.9);
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  // Small sun-facing edge highlights, never used as fake cloud silver lining.
  ctx.strokeStyle='rgba(237,242,241,.56)';ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(-86,6);ctx.lineTo(-22,-8);ctx.moveTo(-8,-47);ctx.lineTo(0,-64);ctx.stroke();
  ctx.restore();
  qa.bounds=[Math.round(cx-96*scale),Math.round(cy-70*scale),Math.round(192*scale),Math.round(130*scale)];
}
function measureAlpha(){
  try{
    const dpr=Math.min(devicePixelRatio||1,1.5),[x,y,w,h]=qa.bounds;
    const sx=Math.max(0,Math.floor(x*dpr)),sy=Math.max(0,Math.floor(y*dpr)),sw=Math.min(overlay.width-sx,Math.ceil(w*dpr)),sh=Math.min(overlay.height-sy,Math.ceil(h*dpr));
    if(sw<=0||sh<=0)return;
    const data=ctx.getImageData(sx,sy,sw,sh).data;let n=0;for(let i=3;i<data.length;i+=16)if(data[i]>28)n++;
    qa.alphaPixels=n;
  }catch(e){qa.errors.push(String(e));}
}
function frame(){
  try{
    resize();ctx.clearRect(0,0,innerWidth,innerHeight);
    const state=base.getState();qa.lastRoll=state.roll||0;qa.lastPitch=state.pitch||0;
    qa.cloudVisibleInvariant=Boolean(base.qa&&base.qa.ready&&base.qa.variance>12&&base.qa.errors.length===0);
    if(visible)drawAircraft(state);
    qa.frames++;if(qa.frames===6||qa.frames%120===0)measureAlpha();
    qa.ready=qa.frames>=6&&qa.alphaPixels>20&&qa.cloudVisibleInvariant;
  }catch(e){qa.errors.push(String(e));}
  requestAnimationFrame(frame);
}
addEventListener('resize',resize);
window.WeatherMobileR24={
  qa,
  getState:()=>({...base.getState(),aircraftDirectPass:true,aircraftVisible:visible,sharedDepth:false}),
  setAircraftVisible:v=>{visible=Boolean(v);},
  captureOverlay:()=>overlay.toDataURL(),
  overlayCanvas:overlay,
  cloud:base
};
const badge=document.querySelector('.badge');if(badge)badge.textContent='CLOUD-FIRST · AIRCRAFT DIRECT';
const brand=document.querySelector('.brand');if(brand)brand.textContent='WEATHER MOTHER / R24 MOBILE';
requestAnimationFrame(frame);
})();