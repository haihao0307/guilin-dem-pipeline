// Raster utilities for synthetic character surface fields. No user images,
// external inputs, uploads, executable strings or network access.
export const FIELD_WIDTH=1024,FIELD_HEIGHT=1280,FIELD_SCALE=1024/180;
export const FIELD_RECT=[-90,180,180,225];
export const clamp01=x=>Math.max(0,Math.min(1,x));
export const rasterPoint=(x,y)=>[(x+90)*FIELD_SCALE,(y-180)*FIELD_SCALE];
export function fieldCanvas(){const c=document.createElement('canvas');c.width=FIELD_WIDTH;c.height=FIELD_HEIGHT;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#000';x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='lighter';return x;}
export function fieldBlob(c,x,y,rx,ry,amount,angle=0,hard=.25){
 if(amount<=0||rx<=0||ry<=0)return;const p=rasterPoint(x,y);c.save();c.translate(...p);c.rotate(angle);c.scale(rx*FIELD_SCALE,ry*FIELD_SCALE);const g=c.createRadialGradient(0,0,0,0,0,1),v=Math.round(clamp01(amount)*255);g.addColorStop(0,`rgb(${v},${v},${v})`);g.addColorStop(hard,`rgb(${v},${v},${v})`);g.addColorStop(1,'#000');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
}
export function fieldCurve(c,points,width,amount){
 if(amount<=0)return;for(const [mult,a]of [[3,.08],[2,.14],[1.35,.25],[.75,.53]]){c.beginPath();points.forEach(([x,y],i)=>{const p=rasterPoint(x,y);if(i)c.lineTo(...p);else c.moveTo(...p);});c.lineWidth=width*FIELD_SCALE*mult;c.lineCap='round';c.lineJoin='round';const v=Math.round(clamp01(amount*a)*255);c.strokeStyle=`rgb(${v},${v},${v})`;c.stroke();}
}
export function wrinklePath(x0,y0,x1,y1,bend,r,irregularity){const points=[],phase=r()*6.28;for(let i=0;i<=28;i++){const t=i/28,edge=Math.sin(Math.PI*t),jitter=(Math.sin(t*11+phase)*.55+Math.sin(t*27+phase)*.25)*irregularity;points.push([x0+(x1-x0)*t,y0+(y1-y0)*t+bend*4*t*(1-t)+jitter*edge]);}return points;}
export function hashField(a){let h=2166136261;for(const x of a)h=Math.imul(h^x,16777619);return(h>>>0).toString(16);}
