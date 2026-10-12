import{FLOORS,loadWorld}from'../../runtime/world-data.mjs';
export const rows=Array.from({length:FLOORS.length},(_,i)=>Array.from(loadWorld().slice(i*16,i*16+6)));
export function samples(){const a=[];const push=(tag,p)=>a.push({tag,p:p.map(Math.fround)});
 for(const floor of FLOORS){const x=floor.cx,y=floor.base,z=floor.front,w=floor.width/2,inner=x+(floor.buildingId==='A'?1:-1)*(w-1.16);
  for(const e of[-.036,-.012,0,.012,.036]){push('front-window-edge/'+floor.id,[x+floor.width/6,y+1.48,z+e]);push('slab-neighbour/'+floor.id,[x,y+e,z+1]);push('stair-opening/'+floor.id,[inner,y+floor.height*.5+e,.25]);push('side-gap/'+floor.id,[x+(floor.buildingId==='A'?w:-w)+e,y+1.03,.25]);}
  push('roof-edge/'+floor.id,[x+w,y+floor.height,z]);
 }
 for(const s of[3,7,10]){const f=FLOORS[s],n=FLOORS[[17,21,24][[3,7,10].indexOf(s)]];for(let i=0;i<=8;i++)push('borrowed-link/'+s,[f.cx+f.width/2+(n.cx-n.width/2-f.cx-f.width/2)*i/8,f.base+(n.base-f.base)*i/8,.25]);}
 const cameras=[{id:'overall',eye:[-40,25,-56],target:[-.2,18.5,.5],tan:.42,aspect:.8},{id:'pair-cut',eye:[-24,27,-63],target:[-.2,19,.5],tan:.42,aspect:.8},{id:'frontage-diagnostic',eye:[-16.8,13.6,-16.8],target:[-8.5,12.8,-5.6],tan:.40,aspect:1.2}];
 const norm=p=>{const n=Math.hypot(...p);return p.map(x=>x/n)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(const c of cameras){const fw=norm(c.target.map((x,i)=>x-c.eye[i])),rt=norm(cross(fw,[0,1,0])),up=norm(cross(rt,fw));for(let iy=0;iy<7;iy++)for(let ix=0;ix<7;ix++){const nx=(ix-3)/3*.8,ny=(iy-3)/3*.8,rd=norm(fw.map((x,i)=>x+c.tan*(rt[i]*nx*c.aspect+up[i]*ny)));for(const floor of FLOORS){const t=(floor.front-c.eye[2])/rd[2];if(t<=0)continue;const p=c.eye.map((x,i)=>x+rd[i]*t);if(Math.abs(p[0]-floor.cx)<=floor.width/2+1&&p[1]>=floor.base-.4&&p[1]<=floor.base+floor.height+.4)push('camera-plane/'+c.id,p);}}}
 return a;
}
