/* Original bounded 2D grading operations on an attributed GarmentCode MIT paper.
   No solved 3D positions enter this module. Source curves are sampled to 0.25 mm. */
import cdt2d from 'cdt2d';
import {clone,validate,fingerprint} from './core.mjs';
export const edgeLength=(p,key)=>{const e=p.edges[key];return e.slice(1).reduce((n,id,j)=>n+Math.hypot(...p.uvMm[id].map((x,k)=>x-p.uvMm[e[j]][k])),0);};
const inside=(q,p)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const segDist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export function meshPaper(input,{step=16}={}){
 const spec=clone(input);for(const p of spec.panels){const boundary=p.boundary.map(i=>p.uvMm[i]),constraints=p.boundary.map((i,j)=>[i,p.boundary[(j+1)%p.boundary.length]]),xs=boundary.map(q=>q[0]),ys=boundary.map(q=>q[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),count=p.uvMm.length;let row=0;
  for(let y=ymin+step*Math.sqrt(3)/4;y<ymax;y+=step*Math.sqrt(3)/2,row++)for(let x=xmin+step/2+(row%2)*step/2;x<xmax;x+=step){const q=[x,y];if(inside(q,boundary)&&constraints.every(([a,b])=>segDist(q,p.uvMm[a],p.uvMm[b])>step*.42))p.uvMm.push(q);}
  p.triangles=cdt2d(p.uvMm,constraints,{exterior:false}).map(t=>{const[a,b,c]=t.map(i=>p.uvMm[i]);return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?t:[t[0],t[2],t[1]];});p.temporaryGuideMaterialIds=Array.from({length:p.uvMm.length-count},(_,i)=>count+i);p.source.meshMethod='cdt2d@1.0.0 MIT, 16 mm interior spacing; updated 2D boundaries retained';
 }
 spec.source.meshing={method:'cdt2d@1.0.0 MIT',interiorSpacingMm:step,baseCurveChordDeviationMm:.25,allSourceStitchesRetained:true,sourceStitchCount:input.seams.length};validate(spec);return spec;
}
