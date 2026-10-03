/* KAOPU anemone: original procedural geometry, no third-party runtime code.
   H. magnifica morphology reference: OIST photograph (2022-10-19), ADW.
   Motion is constrained kinematics driven by smooth seeded noise, NOT FSI. */
(function(root){'use strict';
const TAU=Math.PI*2, SEGMENTS=28;
const DEFAULTS=Object.freeze({count:320,length:0.7,thickness:0.022,current:0.45,direction:35,frequency:0.42,turbulence:0.3,seed:73,paused:false});
const RANGES={count:[120,560],length:[0.35,1.05],thickness:[0.012,0.036],current:[0,1],direction:[-180,180],frequency:[0.08,0.9],turbulence:[0,0.8],seed:[1,9999]};
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function rng(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
function noise(x,seed){const i=Math.floor(x),t=x-i,u=t*t*(3-2*t);const hash=n=>{n=Math.imul(n^seed,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967295*2-1;};return hash(i)*(1-u)+hash(i+1)*u;}
function discHeight(x,z){const r=Math.hypot(x,z),a=Math.atan2(z,x);return .48-.055*r*r+.036*Math.cos(a*3+.8)*r*r;}
const DISC_RADIUS=1.1,DISC_RINGS=20,DISC_SIDES=96;
function discPoint(row,side){const r=DISC_RADIUS*(1-row/DISC_RINGS),a=side/DISC_SIDES*TAU,x=r*Math.cos(a),z=r*Math.sin(a);return [x,discHeight(x,z),z];}
function discAttachment(x,z){let a=Math.atan2(z,x);if(a<0)a+=TAU;const side=Math.min(DISC_SIDES-1,Math.floor(a/TAU*DISC_SIDES)),guess=Math.floor((1-Math.hypot(x,z)/DISC_RADIUS)*DISC_RINGS);
 for(let row=Math.max(0,guess-1);row<=Math.min(DISC_RINGS-1,guess+1);row++){const p=discPoint(row,side),q=discPoint(row+1,side),r=discPoint(row,side+1),t=discPoint(row+1,side+1);for(const [a,b,c]of [[p,q,r],[r,q,t]]){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>-1e-7)return u*a[1]+v*b[1]+w*c[1];}}
 throw Error('Tentacle root is outside oral-disc triangles');
}
function validate(data){const s={...DEFAULTS};for(const k in RANGES){const v=data[k];if(!Number.isFinite(v)||v<RANGES[k][0]||v>RANGES[k][1])throw Error('海葵参数越界: '+k);s[k]=['seed','count'].includes(k)?Math.round(v):v;}if(typeof data.paused!=='boolean')throw Error('无效暂停状态');s.paused=data.paused;return s;}
function roots(s){const random=rng(s.seed),out=[];for(let i=0;i<s.count;i++){const r=Math.sqrt(.035+(i+.5)/s.count*.965)*1.095;const a=i*2.399963229728653+(random()-.5)*.23;const x=Math.cos(a)*r,z=Math.sin(a)*r;out.push({x,y:discAttachment(x,z),z,a,r,length:s.length*(.73+random()*.39),radius:s.thickness*(.82+random()*.34),phase:random()*TAU,variation:random(),lean:.2+random()*.35});}return out;}
function solve(s,rs,time,out=new Float32Array(rs.length*(SEGMENTS+1)*4)){
 const d=s.direction*Math.PI/180,dx=Math.cos(d),dz=Math.sin(d),t=time*s.frequency;
 const swell=Math.sin(t*TAU*.55)*.7+Math.sin(t*TAU*.217+1)*.3;
 for(let i=0;i<rs.length;i++){const r=rs[i],base=i*(SEGMENTS+1)*4;out[base]=r.x;out[base+1]=r.y;out[base+2]=r.z;out[base+3]=r.radius;let x=r.x,y=r.y,z=r.z;const step=r.length/SEGMENTS;
  for(let j=1;j<=SEGMENTS;j++){const u=(j-.5)/SEGMENTS,flex=u*u;const phase=r.phase;
   const local=noise(t*1.9-u*.9+r.x*.7+r.z*.5,s.seed+i%11);
   const shared=Math.sin(t*TAU*.55-u*1.5)+.23*Math.sin(t*TAU*.217+r.x*.5);
   const flow=s.current*(.55+shared*.6+swell*.15);const turb=s.turbulence*local;
   const lean=r.lean*(.45+u*.7);
   let vx=Math.cos(r.a)*lean+flex*(dx*flow*1.7-dz*turb+.16*Math.sin(phase+u*3));
   let vz=Math.sin(r.a)*lean+flex*(dz*flow*1.7+dx*turb+.16*Math.cos(phase+u*3));
   let vy=1-flex*.25;const norm=Math.hypot(vx,vy,vz);x+=vx/norm*step;y+=vy/norm*step;z+=vz/norm*step;
   const o=base+j*4;out[o]=x;out[o+1]=y;out[o+2]=z;out[o+3]=r.radius;
  }
 }return out;
}
function metrics(s,rs,data){let lengthError=0,rootError=0,attachmentError=0,minY=Infinity,maxY=-Infinity;for(let i=0;i<rs.length;i++){const b=i*(SEGMENTS+1)*4,r=rs[i];attachmentError=Math.max(attachmentError,Math.abs(r.y-discAttachment(r.x,r.z)));rootError=Math.max(rootError,Math.hypot(data[b]-r.x,data[b+1]-r.y,data[b+2]-r.z));let length=0;for(let j=0;j<=SEGMENTS;j++){const o=b+j*4;minY=Math.min(minY,data[o+1]);maxY=Math.max(maxY,data[o+1]);if(j)length+=Math.hypot(data[o]-data[o-4],data[o+1]-data[o-3],data[o+2]-data[o-2]);}lengthError=Math.max(lengthError,Math.abs(length-r.length));}return {rootError,lengthError,attachmentError,minY,maxY,finite:[...data].every(Number.isFinite),tentacles:rs.length,segments:SEGMENTS};}
const api={DEFAULTS,RANGES,SEGMENTS,clamp,rng,noise,discHeight,discAttachment,discPoint,DISC_RADIUS,DISC_RINGS,DISC_SIDES,validate,roots,solve,metrics};root.AnemoneCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
