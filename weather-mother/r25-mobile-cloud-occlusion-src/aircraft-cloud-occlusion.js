(()=>{'use strict';
const base=window.WeatherMobileR23;
if(!base)return;
const cloudCanvas=document.getElementById('c');
if(!cloudCanvas)return;
const overlay=document.createElement('canvas');
overlay.id='aircraft-cloud-occlusion-r25';
overlay.setAttribute('aria-label','R25 手机安全飞机云雾遮挡层');
Object.assign(overlay.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'3',pointerEvents:'none',background:'transparent'});
cloudCanvas.insertAdjacentElement('afterend',overlay);
const ctx=overlay.getContext('2d',{alpha:true,desynchronized:true});
if(!ctx)return;
const sat=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=sat((x-a)/(b-a));return t*t*(3-2*t);};
const qa={
  version:'WM-R25-MOBILE-CLOUD-OCCLUSION-20260911',ready:false,frames:0,errors:[],
  overlayContext:'2d',cloudContext:'webgl1',directPass:true,sharedDepth:false,depthFBO:false,
  opticalOcclusion:true,occlusionModel:'cpu-mirror-beer-lambert',failOpen:true,failOpenCount:0,
  aircraftGeometry:'procedural-mobile-direct-pass-candidate',alphaPixels:0,alphaSum:0,bounds:[0,0,0,0],
  lastRoll:0,lastPitch:0,cloudVisibleInvariant:false,targetTransmittance:1,liveTransmittance:1,
  freeProbe:1,edgeProbe:1,insideProbe:1
};
let visible=true,lastW=0,lastH=0,lastDpr=0,targetT=1,liveT=1,debugT=null,frameNo=0;
function yo(x,y,z){return .5+.5*Math.cos(Math.cos(z)*Math.cos(x)+Math.cos(y)*Math.cos(y)+Math.cos(y)*Math.cos(x));}
function bands(x,y,z){let a=.5,s=0,n=0;for(let i=0;i<5;i++){s+=a*yo(x,y,z);n+=a;const nx=.86*x-.28*y-.42*z,ny=.18*x+.95*y-.23*z,nz=.47*x+.12*y+.88*z;x=nx*2+.37;y=ny*2+.19;z=nz*2+.53;a*=.5;}return s/n;}
function ell(x,y,z,cx,cy,cz,rx,ry,rz){const dx=(x-cx)/rx,dy=(y-cy)/ry,dz=(z-cz)/rz;return Math.sqrt(dx*dx+dy*dy+dz*dz)-1;}
function cloudSdf(x,y,z,scene){let d=9;if(scene==='sea'){
  d=Math.min(d,ell(x,y,z,-4.5,3.15,-7.0,5.1,.78,4.3));d=Math.min(d,ell(x,y,z,2.2,3.55,-9.8,5.6,.88,5.0));d=Math.min(d,ell(x,y,z,-2.5,4.05,-13.8,6.0,1.0,4.2));d=Math.min(d,ell(x,y,z,5.2,4.4,-17.0,5.8,.82,4.0));
}else{
  d=Math.min(d,ell(x,y,z,-4.2,3.65,-7.0,4.3,1.55,3.7));d=Math.min(d,ell(x,y,z,.3,4.0,-8.7,4.1,1.85,4.0));d=Math.min(d,ell(x,y,z,4.4,3.7,-11.2,3.5,1.65,3.8));d=Math.min(d,ell(x,y,z,-1.7,5.0,-12.0,2.7,2.1,3.0));d=Math.min(d,ell(x,y,z,2.0,5.4,-13.7,2.35,2.0,2.7));d=Math.min(d,ell(x,y,z,-5.8,4.75,-13.5,2.8,1.8,3.0));
}return d;}
function densityAt(x,y,z,scene,time){const d=cloudSdf(x,y,z,scene);if(d>.42||y<1.35||y>7.5)return 0;const low=bands(x*.72,y*.72,z*.72+time*.004),mid=bands(x*1.85+11.3,y*1.85+7.1,z*1.85+3.7),hi=yo(x*7.3+2.1,y*7.3+5.7,z*7.3+13.);const erode=(low-.52)*.24+(mid-.5)*.10+(hi-.5)*.025;const shape=1-smooth(-.28,.18,d+erode),baseGate=smooth(1.45,1.85,y),topGate=1-smooth(6.25,7.15,y);return sat(shape*baseGate*topGate*(scene==='sea'?.78:1.08));}
function probeTransmittance(position,scene='silver',time=0,yaw=0,pitch=-.02){
  if(!position||position.length<3)return 1;const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),fx=sy*cp,fy=sp,fz=-cy*cp;const length=2.4,steps=10,ds=length/steps;let od=0;
  for(let i=0;i<steps;i++){const q=ds*(i+.5),x=position[0]+fx*q,y=position[1]+fy*q,z=position[2]+fz*q;od+=densityAt(x,y,z,scene,time)*ds;}
  return Math.exp(-1.10*od);
}
function resize(){const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(innerWidth*dpr)),h=Math.max(1,Math.round(innerHeight*dpr));if(w===lastW&&h===lastH&&dpr===lastDpr)return;overlay.width=w;overlay.height=h;lastW=w;lastH=h;lastDpr=dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
function poly(points,fill,stroke,width=1){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function ellipse(x,y,rx,ry,fill,stroke){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function drawAircraft(state,T){const w=innerWidth,h=innerHeight,scale=Math.max(.72,Math.min(1.08,w/390)),cx=w*.5,cy=h*.69+Math.max(-18,Math.min(18,state.pitch*38));ctx.save();ctx.globalAlpha=.04+.96*T;ctx.translate(cx,cy);ctx.rotate(-state.roll*.72);ctx.scale(scale,scale);ctx.shadowColor='rgba(7,18,29,.28)';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
  poly([[-88,6],[-23,-8],[23,-8],[88,6],[82,16],[23,8],[-23,8],[-82,16]],'rgba(109,122,132,.96)','rgba(28,42,53,.55)',1.2);
  for(const x of [-51,-26,26,51]){ellipse(x,6,8.2,11.5,'rgba(75,88,99,.98)','rgba(24,34,43,.72)');ellipse(x,3.5,5.1,6.2,'rgba(31,40,48,.95)','rgba(185,195,200,.45)');}
  poly([[-35,43],[-10,35],[10,35],[35,43],[31,50],[10,46],[-10,46],[-31,50]],'rgba(96,108,118,.98)','rgba(28,42,53,.55)',1.1);poly([[0,42],[5,27],[11,45],[7,55],[-2,55],[-5,46]],'rgba(87,100,111,.98)','rgba(24,36,46,.62)',1.1);
  const g=ctx.createLinearGradient(0,-60,0,60);g.addColorStop(0,'rgba(178,186,190,.96)');g.addColorStop(.52,'rgba(118,131,141,.99)');g.addColorStop(1,'rgba(72,84,94,.99)');poly([[-8,53],[-13,29],[-12,-7],[-8,-47],[0,-64],[8,-47],[12,-7],[13,29],[8,53]],g,'rgba(30,43,53,.72)',1.2);poly([[-5,-31],[-3,-45],[0,-51],[3,-45],[5,-31],[0,-25]],'rgba(82,111,130,.9)','rgba(219,232,238,.45)',.9);
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle='rgba(237,242,241,.56)';ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(-86,6);ctx.lineTo(-22,-8);ctx.moveTo(-8,-47);ctx.lineTo(0,-64);ctx.stroke();ctx.restore();qa.bounds=[Math.round(cx-96*scale),Math.round(cy-70*scale),Math.round(192*scale),Math.round(130*scale)];}
function measureAlpha(){try{const dpr=Math.min(devicePixelRatio||1,1.5),[x,y,w,h]=qa.bounds,sx=Math.max(0,Math.floor(x*dpr)),sy=Math.max(0,Math.floor(y*dpr)),sw=Math.min(overlay.width-sx,Math.ceil(w*dpr)),sh=Math.min(overlay.height-sy,Math.ceil(h*dpr));if(sw<=0||sh<=0)return;const data=ctx.getImageData(sx,sy,sw,sh).data;let n=0,sum=0;for(let i=3;i<data.length;i+=16){const a=data[i];sum+=a;if(a>12)n++;}qa.alphaPixels=n;qa.alphaSum=sum;}catch(e){qa.errors.push(String(e));}}
function updateTransmittance(state){if(frameNo%6===0){try{targetT=probeTransmittance(state.position,state.scene||base.qa.scene||'silver',state.time||0,state.yaw||0,state.pitch||0);if(!Number.isFinite(targetT))throw Error('non-finite cloud transmittance');}catch(e){qa.errors.push(String(e));qa.failOpenCount++;targetT=1;}}liveT+=(targetT-liveT)*.14;qa.targetTransmittance=targetT;qa.liveTransmittance=liveT;}
function frame(){try{resize();ctx.clearRect(0,0,innerWidth,innerHeight);const state=base.getState();qa.lastRoll=state.roll||0;qa.lastPitch=state.pitch||0;qa.cloudVisibleInvariant=Boolean(base.qa&&base.qa.ready&&base.qa.variance>12&&base.qa.errors.length===0);updateTransmittance(state);const T=debugT==null?liveT:debugT;if(visible)drawAircraft(state,T);qa.frames++;frameNo++;if(qa.frames===6||qa.frames%12===0)measureAlpha();qa.freeProbe=probeTransmittance([0,4.4,4.8],'silver',0,0,-.02);qa.edgeProbe=probeTransmittance([0,4.0,-3.5],'silver',0,0,-.02);qa.insideProbe=probeTransmittance([0,4.0,-6.0],'silver',0,0,-.02);qa.ready=qa.frames>=6&&qa.alphaPixels>20&&qa.cloudVisibleInvariant&&Number.isFinite(liveT);}catch(e){qa.errors.push(String(e));qa.failOpenCount++;liveT=targetT=1;}requestAnimationFrame(frame);}
addEventListener('resize',resize);
window.WeatherMobileR25={qa,getState:()=>({...base.getState(),aircraftDirectPass:true,aircraftVisible:visible,sharedDepth:false,depthFBO:false,opticalOcclusion:true,cloudTransmittance:debugT==null?liveT:debugT}),setAircraftVisible:v=>{visible=Boolean(v);},probeTransmittance,setDebugTransmittanceOverride:v=>{debugT=v==null?null:sat(Number(v));},measureNow:()=>{measureAlpha();return {alphaPixels:qa.alphaPixels,alphaSum:qa.alphaSum};},captureOverlay:()=>overlay.toDataURL(),overlayCanvas:overlay,cloud:base};
const badge=document.querySelector('.badge');if(badge)badge.textContent='CLOUD-FIRST · OPTICAL OCCLUSION';const brand=document.querySelector('.brand');if(brand)brand.textContent='WEATHER MOTHER / R25 MOBILE';requestAnimationFrame(frame);
})();