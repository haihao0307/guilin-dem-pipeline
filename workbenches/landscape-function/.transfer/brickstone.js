/* Stone-only port from haihao0307/HOUSE@53a4b072, experiments/atelier-r4/src/kernel.js.
 * Retained: seeded noise, stone/rubble/dressed/pebble envelopes, beds, plane cuts,
 * finite rotated chip cutters. Landscape mesh extraction and placement are adapters.
 * No brick, adobe, fibers, UI, shadow sampler or external dependencies imported. */
'use strict';
const BrickStone=(()=>{
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,norm=v=>{let d=Math.hypot(...v)||1;return v.map(x=>x/d)};
function rng(s){return()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296}}
function hash(x,y,z,s){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1274126177)^s;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
function noise(x,y,z,s){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);x-=ix;y-=iy;z-=iz;x=x*x*(3-2*x);y=y*y*(3-2*y);z=z*z*(3-2*z);return mix(mix(mix(hash(ix,iy,iz,s),hash(ix+1,iy,iz,s),x),mix(hash(ix,iy+1,iz,s),hash(ix+1,iy+1,iz,s),x),y),mix(mix(hash(ix,iy,iz+1,s),hash(ix+1,iy,iz+1,s),x),mix(hash(ix,iy+1,iz+1,s),hash(ix+1,iy+1,iz+1,s),x),y),z)}
function derive(master,layer){let v=master>>>0;for(let i=0;i<layer.length;i++)v=Math.imul(v^layer.charCodeAt(i),16777619)>>>0;return v}
const profiles=Object.freeze({stone:{name:'层状毛石',seed:8231,damage:.55,relief:.74,shader:1},rubble:{name:'不规则毛石',seed:9298,damage:.62,relief:.68,shader:2},dressed:{name:'粗凿砌筑石',seed:10365,damage:.40,relief:.38,shader:5},pebble:{name:'建筑卵石',seed:7179,damage:.06,relief:.22,shader:6}});
function field(family,shape,seed){
 if(!profiles[family]||!['sample','long','half','thin','wedge'].includes(shape)||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('石材配方无效');
 const c=profiles[family],isPebble=family==='pebble',isStone=!isPebble,ss=derive(seed,'shape'),ds=derive(seed,'damage'),R=rng(ss),D=rng(ds),h=shape==='long'?[1.32,.56,.43]:shape==='half'?[.74,.80,.44]:shape==='thin'?[1.20,.69,.23]:[1.17,.80,.44];
 if(isPebble){h[0]=shape==='long'?1.30:shape==='half'?.77:1.04;h[1]=shape==='thin'?.44:.76;h[2]=shape==='thin'?.67:.74;for(let a=0;a<3;a++)h[a]*=.93+R()*.14}
 if(family==='rubble'){h[0]*=.90+R()*.13;h[1]*=.92+R()*.19;h[2]*=1.32+R()*.28}if(family==='stone')h[2]*=1.1;
 const planes=[];if(family==='rubble')for(let j=0;j<9;j++){let n=norm([R()*2-1,R()*2-1,R()*2-1]);planes.push([...n,(Math.abs(n[0])*h[0]+Math.abs(n[1])*h[1]+Math.abs(n[2])*h[2])*(.61+R()*.27)])}
 const phase=R()*20,beds=[],cuts=[];let level=-h[1]*1.1;while(level<h[1]*1.2){level+=.09+R()*.22;beds.push([level,(R()-.5)*.16])}
 function faceEvent(axis,sign,u,v,ru,rv,rd,angle,kind){const o=[0,1,2].filter(a=>a!==axis),C=[0,0,0],A=[0,0,0],B=[0,0,0],W=[0,0,0];C[o[0]]=u;C[o[1]]=v;C[axis]=sign*(h[axis]+rd*.30);A[o[0]]=1;B[o[1]]=1;W[axis]=sign;const U=A.map((a,k)=>a*Math.cos(angle)+B[k]*Math.sin(angle)),V=A.map((a,k)=>-a*Math.sin(angle)+B[k]*Math.cos(angle)),r=[ru,rv,rd];cuts.push({C,U,V,W,r,kind,ext:[0,1,2].map(a=>Math.abs(U[a])*ru+Math.abs(V[a])*rv+Math.abs(W[a])*rd+.12)})}
 const count=Math.round(c.damage*(isPebble?15:55));
 for(let k=0;k<count;k++){const axis=[2,2,1,0][Math.floor(k/2)%4],sign=k%2?1:-1,o=[0,1,2].filter(a=>a!==axis),a=(D()*1.92-.96)*h[o[0]],b=(D()*1.90-.95)*h[o[1]],large=k%10===0;let ru=large?.20+D()*.26:.035+D()*.11,rv=large?.12+D()*.14:ru*(.55+D()*.55),rd=large?.10+D()*.085:.038+D()*.085;if(isStone){ru*=1.1;rv*=.58}if(isPebble){ru*=.36;rv*=.36;rd*=.35}const angle=isStone?-.16+(D()-.5)*.32:D()*6.28;faceEvent(axis,sign,a,b,ru,rv,rd,angle,large||isStone?'chip':'pit')}
 if(c.damage>0&&!isPebble)for(let k=0;k<9;k++){let yy=(k/9-.46)*h[1]*1.8+(D()-.5)*.24,xx=(D()-.5)*1.25*h[0];faceEvent(2,k%3===0?-1:1,xx,yy,.24+D()*.38,.025+D()*.035,(.08+D()*.11)*c.damage,-.13+(D()-.5)*.2,'chip')}
 if(isStone&&c.damage>0)for(let k=0;k<18;k++){let ax=[2,2,0,1][Math.floor(k/2)%4],sign=k%2?1:-1,o=[0,1,2].filter(a=>a!==ax);faceEvent(ax,sign,(D()*1.72-.86)*h[o[0]],(D()*1.72-.86)*h[o[1]],.055+D()*.11,.018+D()*.018,.035+c.damage*.045,-.22+(D()-.5)*.66,'chip')}
 if(shape==='half')faceEvent(0,1,.08,.04,.54,.44,.20,0,'chip');
 function sample(px,py,pz){let a=noise(px*2.8+phase,py*2.8,pz*2.8,ss)-.5,b=noise(px*12,py*12,pz*12,ss+711)-.5,bedOffset=0;
  if(family==='stone'){let w=py+px*.14+pz*.10;for(let b of beds){if(w>b[0])bedOffset=b[1];else break}}
  const r=.036,qx=Math.abs(px+.018*a)-h[0]+r,qy=Math.abs(py+.02*a)-h[1]+r,qz=Math.abs(pz)-h[2]-bedOffset*c.relief+r;
  let sd=Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-r;
  if(isPebble)sd=(Math.hypot(px/h[0],py/h[1],pz/h[2])-1)*Math.min(...h);
  if(shape==='wedge')sd=Math.max(sd,py+px*.30-h[1]*.78);for(let p of planes)sd=Math.max(sd,px*p[0]+py*p[1]+pz*p[2]-p[3]);
  sd+=a*(family==='rubble'?.16:.060)*c.relief+(b*(isStone?.072:.052)+Math.pow(clamp((b+.5-.35)/.36),.32)*.035)*c.relief;
  for(let t of cuts){let x=px-t.C[0],y=py-t.C[1],z=pz-t.C[2];if(Math.abs(x)>t.ext[0]||Math.abs(y)>t.ext[1]||Math.abs(z)>t.ext[2])continue;let u=(x*t.U[0]+y*t.U[1]+z*t.U[2])/t.r[0],v=(x*t.V[0]+y*t.V[1]+z*t.V[2])/t.r[1],w=(x*t.W[0]+y*t.W[1]+z*t.W[2])/t.r[2],mm=Math.min(...t.r),n=t.kind==='chip'?Math.max(Math.abs(u)*.92+Math.abs(v)*.27,Math.abs(v)*.96+Math.abs(w)*.18,Math.abs(w)*.86+Math.abs(u)*.22,(Math.abs(u)+Math.abs(v)+Math.abs(w))*.53):Math.hypot(u,v,w);sd=Math.max(sd,-((n-1)*mm+b*Math.min(.095,mm*1.12)))}
  return sd;
 }
 return{sample,h,profile:c,seed,shape,planes,beds,cuts,bounds:[h.map(v=>-v-.25),h.map(v=>v+.25)]};
}
return{profiles,field,noise,hash,rng,derive};
})();
if(typeof module!=='undefined')module.exports=BrickStone;
