/* KAOPU anemone: original procedural geometry, no third-party runtime code.
   H. magnifica morphology reference: OIST photograph (2022-10-19), ADW.
   Motion is constrained kinematics driven by smooth seeded noise, NOT FSI. */
(function(root){'use strict';
const TAU=Math.PI*2, SEGMENTS=28;
const DEFAULTS=Object.freeze({count:360,length:0.7,thickness:0.03,curvature:1.4,current:0.45,direction:35,frequency:0.42,turbulence:0.3,seed:73,paused:false});
const RANGES={count:[120,560],length:[0.35,1.05],thickness:[0.015,0.045],curvature:[0.5,2.1],current:[0,1],direction:[-180,180],frequency:[0.08,0.9],turbulence:[0,0.8],seed:[1,9999]};
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function rng(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
function noise(x,seed){const i=Math.floor(x),t=x-i,u=t*t*(3-2*t);const hash=n=>{n=Math.imul(n^seed,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967295*2-1;};return hash(i)*(1-u)+hash(i+1)*u;}
function discHeight(x,z){const r=Math.hypot(x,z),a=Math.atan2(z,x);return .48-.04*r*r+(.08*Math.cos(a*3+.8)+.045*Math.sin(a*5-.3))*r*r;}
const DISC_RADIUS=1.1,DISC_RINGS=20,DISC_SIDES=96;
function discRadius(a){return DISC_RADIUS*(1+.055*Math.cos(3*a+.4)+.035*Math.sin(5*a-.6));}
function discPoint(row,side){const a=side/DISC_SIDES*TAU,r=discRadius(a)*(1-row/DISC_RINGS),x=r*Math.cos(a),z=r*Math.sin(a);return [x,discHeight(x,z),z];}
function discAttachmentInfo(x,z){let a=Math.atan2(z,x);if(a<0)a+=TAU;const side=Math.min(DISC_SIDES-1,Math.floor(a/TAU*DISC_SIDES)),guess=Math.floor((1-Math.hypot(x,z)/discRadius(a))*DISC_RINGS);
 for(let row=Math.max(0,guess-1);row<=Math.min(DISC_RINGS-1,guess+1);row++){const p=discPoint(row,side),q=discPoint(row+1,side),r=discPoint(row,side+1),t=discPoint(row+1,side+1);for(const [a,b,c]of [[p,q,r],[r,q,t]]){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>-1e-7){const ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],len=Math.hypot(...n);return {height:u*a[1]+v*b[1]+w*c[1],normal:n.map(v=>v/len),triangle:[a,b,c]};}}}
 throw Error('Tentacle root is outside oral-disc triangles');
}
function discAttachment(x,z){return discAttachmentInfo(x,z).height;}
function validate(data){const s={...DEFAULTS};for(const k in RANGES){const v=data[k];if(!Number.isFinite(v)||v<RANGES[k][0]||v>RANGES[k][1])throw Error('海葵参数越界: '+k);s[k]=['seed','count'].includes(k)?Math.round(v):v;}if(typeof data.paused!=='boolean')throw Error('无效暂停状态');s.paused=data.paused;return s;}
function roots(s){const random=rng(s.seed),out=[];for(let i=0;i<s.count;i++){const a=i*2.399963229728653+(random()-.5)*.4;const fraction=clamp(Math.sqrt(.003+(i+.5)/s.count*.997)+(random()-.5)*.035,.095,.985);const r=fraction*discRadius(a),x=Math.cos(a)*r,z=Math.sin(a)*r;const heading=Math.atan2(.5*Math.sin(a)+.75*Math.sin(2.6*x+1.7*z+.4),.5*Math.cos(a)+.75*Math.cos(2.6*x-1.8*z));out.push({x,y:discAttachment(x,z),z,a,r,heading:heading+(random()-.5)*.2,length:s.length*(.77+random()*.4),radius:s.thickness*(.84+random()*.3),phase:random()*TAU,variation:random(),lean:.13+random()*.2,curve:s.curvature*(.77+random()*.46)});}return out;}
function solve(s,rs,time,out=new Float32Array(rs.length*(SEGMENTS+1)*4)){
 const d=s.direction*Math.PI/180,dx=Math.cos(d),dz=Math.sin(d),t=time*s.frequency;
 const swell=Math.sin(t*TAU*.55)*.7+Math.sin(t*TAU*.217+1)*.3;
 for(let i=0;i<rs.length;i++){const r=rs[i],base=i*(SEGMENTS+1)*4;out[base]=r.x;out[base+1]=r.y;out[base+2]=r.z;out[base+3]=r.radius;let x=r.x,y=r.y,z=r.z;const step=r.length/SEGMENTS;
  for(let j=1;j<=SEGMENTS;j++){const u=(j-.5)/SEGMENTS,flex=u*u;const phase=r.phase;
   const local=noise(t*1.9-u*.9+r.x*.7+r.z*.5,s.seed+i%11);
   const shared=Math.sin(t*TAU*.55-u*1.5)+.23*Math.sin(t*TAU*.217+r.x*.5);
   const flow=s.current*(.55+shared*.6+swell*.15);const turb=s.turbulence*local;
   // Reference-led rest curvature is present even without motion/noise.
   const bend=clamp(r.lean+r.curve*Math.pow(u,.82),0,2.3),heading=r.heading+.16*Math.sin(u*2.7+phase);
   let vx=Math.cos(heading)*Math.sin(bend)+flex*(dx*flow*.7-dz*turb*.5);
   let vz=Math.sin(heading)*Math.sin(bend)+flex*(dz*flow*.7+dx*turb*.5);
   let vy=Math.cos(bend);const norm=Math.hypot(vx,vy,vz);x+=vx/norm*step;y+=vy/norm*step;z+=vz/norm*step;
   const o=base+j*4;out[o]=x;out[o+1]=y;out[o+2]=z;out[o+3]=j===SEGMENTS?r.length:r.radius;
  }
 }return out;
}
function metrics(s,rs,data){let lengthError=0,rootError=0,attachmentError=0,minY=Infinity,maxY=-Infinity;for(let i=0;i<rs.length;i++){const b=i*(SEGMENTS+1)*4,r=rs[i];attachmentError=Math.max(attachmentError,Math.abs(r.y-discAttachment(r.x,r.z)));rootError=Math.max(rootError,Math.hypot(data[b]-r.x,data[b+1]-r.y,data[b+2]-r.z));let length=0;for(let j=0;j<=SEGMENTS;j++){const o=b+j*4;minY=Math.min(minY,data[o+1]);maxY=Math.max(maxY,data[o+1]);if(j)length+=Math.hypot(data[o]-data[o-4],data[o+1]-data[o-3],data[o+2]-data[o-2]);}lengthError=Math.max(lengthError,Math.abs(length-r.length));}return {rootError,lengthError,attachmentError,minY,maxY,finite:[...data].every(Number.isFinite),tentacles:rs.length,segments:SEGMENTS};}
const api={DEFAULTS,RANGES,SEGMENTS,clamp,rng,noise,discHeight,discAttachment,discAttachmentInfo,discPoint,discRadius,DISC_RADIUS,DISC_RINGS,DISC_SIDES,validate,roots,solve,metrics};root.AnemoneCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
