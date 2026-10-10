// Raster utilities for synthetic character surface fields. No external inputs.
export const FIELD_WIDTH=1024,FIELD_HEIGHT=1280,FIELD_SCALE=1024/180;
export const FIELD_RECT=[-90,180,180,225];
export const clamp01=x=>Math.max(0,Math.min(1,x));
export const rasterPoint=(x,y)=>[(x+90)*FIELD_SCALE,(y-180)*FIELD_SCALE];
export function fieldCanvas(){const c=document.createElement('canvas');c.width=FIELD_WIDTH;c.height=FIELD_HEIGHT;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#000';x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='lighter';return x;}
export function fieldBlob(c,x,y,rx,ry,amount,angle=0,hard=.25){
 if(amount<=0||rx<=0||ry<=0)return;const p=rasterPoint(x,y);c.save();c.translate(...p);c.rotate(angle);c.scale(rx*FIELD_SCALE,ry*FIELD_SCALE);const g=c.createRadialGradient(0,0,0,0,0,1),v=Math.round(clamp01(amount)*255);g.addColorStop(0,`rgb(${v},${v},${v})`);g.addColorStop(hard,`rgb(${v},${v},${v})`);g.addColorStop(1,'#000');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
}
export function fieldCurve(c,points,width,amount){
 if(amount<=0||points.length<2)return;
 const p=points.map(q=>rasterPoint(...q));
 for(const [mult,a]of [[3,.08],[2,.14],[1.35,.25],[.75,.53]]){
  const left=[],right=[];
  for(let i=0;i<p.length;i++){
   const t=i/(p.length-1),before=p[Math.max(0,i-1)],after=p[Math.min(p.length-1,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],len=Math.hypot(dx,dy)||1;
   const taper=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.48),variation=.82+.12*Math.sin(t*12+points[0][0])+.06*Math.sin(t*27+points[0][1]),r=width*FIELD_SCALE*mult*.5*taper*variation;
   left.push([p[i][0]-dy/len*r,p[i][1]+dx/len*r]);right.push([p[i][0]+dy/len*r,p[i][1]-dx/len*r]);
  }
  c.beginPath();[...left,...right.reverse()].forEach((q,i)=>{if(i)c.lineTo(...q);else c.moveTo(...q);});c.closePath();
  const v=Math.round(clamp01(amount*a)*255),gradient=c.createLinearGradient(...p[0],...p.at(-1));gradient.addColorStop(0,'#000');gradient.addColorStop(.12,`rgb(${v*.65},${v*.65},${v*.65})`);gradient.addColorStop(.35,`rgb(${v},${v},${v})`);gradient.addColorStop(.68,`rgb(${v*.9},${v*.9},${v*.9})`);gradient.addColorStop(.88,`rgb(${v*.55},${v*.55},${v*.55})`);gradient.addColorStop(1,'#000');c.fillStyle=gradient;c.fill();
 }
}
export function wrinklePath(x0,y0,x1,y1,bend,r,irregularity){const points=[],phase=r()*6.28;for(let i=0;i<=40;i++){const t=i/40,edge=Math.sin(Math.PI*t),jitter=(Math.sin(t*7+phase)*.6+Math.sin(t*19+phase)*.20)*irregularity;points.push([x0+(x1-x0)*t,y0+(y1-y0)*t+bend*4*t*(1-t)+jitter*edge]);}return points;}
export function hashField(a){let h=2166136261;for(const x of a)h=Math.imul(h^x,16777619);return(h>>>0).toString(16);}
