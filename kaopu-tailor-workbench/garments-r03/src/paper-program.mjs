/* Original bounded 2D grading operations on an attributed GarmentCode MIT paper.
   No solved 3D positions enter this module. Source curves are sampled to 0.25 mm. */
import cdt2d from 'cdt2d';
import {clone,validate,fingerprint} from './core.mjs';
export const PROGRAM='kaopu-teacher-shorts-grading@1';
export const edgeLength=(p,key)=>{const e=p.edges[key];return e.slice(1).reduce((n,id,j)=>n+Math.hypot(...p.uvMm[id].map((x,k)=>x-p.uvMm[e[j]][k])),0);};
const inside=(q,p)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const segDist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export function gradePaper(base,{legDeltaMm=0,waistEaseMm=0}={}){
 if(!Number.isFinite(legDeltaMm)||legDeltaMm< -60||legDeltaMm>60||!Number.isFinite(waistEaseMm)||waistEaseMm<0||waistEaseMm>40)throw Error('仅支持裤长 −60…+60 mm、腰口松量 0…40 mm');
 const spec=clone(base),original=Object.fromEntries(base.panels.map(p=>[p.id,p])),panels=Object.fromEntries(spec.panels.map(p=>[p.id,p]));
 const waistSeams=spec.seams.filter(s=>s.a.panelId.startsWith('wb_')&&s.b.panelId.startsWith('pant_'));
 const waistKeys=p=>waistSeams.filter(s=>s.b.panelId===p.id).map(s=>s.b.edge);
 const fractions={front:base.source.measurementSnapshot.waist.frontArcMm/base.source.measurementSnapshot.waist.circumferenceMm,back:base.source.measurementSnapshot.waist.backArcMm/base.source.measurementSnapshot.waist.circumferenceMm};
 // Use source waist arcs if source measurements use another explicit field naming.
 const totalTop=edgeLength(original.wb_front,'e6')+edgeLength(original.wb_back,'e0');
 if(!Number.isFinite(fractions.front)||!Number.isFinite(fractions.back)){fractions.front=edgeLength(original.wb_front,'e6')/totalTop;fractions.back=1-fractions.front;}
 const operationRecords=[];
 for(const p of spec.panels.filter(p=>p.id.startsWith('pant_'))){
  const old=original[p.id],front=p.id.includes('_f_'),keys=waistKeys(p),length=keys.reduce((n,k)=>n+edgeLength(old,k),0),waistIds=keys.flatMap(k=>old.edges[k]),waistY=Math.min(...waistIds.map(i=>old.uvMm[i][1])),centerX=old.uvMm[waistIds.reduce((a,b)=>Math.abs(old.uvMm[a][0])>Math.abs(old.uvMm[b][0])?a:b)][0];
  const lowerSide=Object.values(old.edges).find(ids=>old.uvMm[ids[0]][0]===0&&old.uvMm[ids.at(-1)][0]===0);const hipY=Math.min(...lowerSide.map(i=>old.uvMm[i][1])),innerKey={pant_f_l:'e8',pant_f_r:'e1',pant_b_l:'e1',pant_b_r:'e11'}[p.id],crotchY=Math.min(...old.edges[innerKey].map(i=>old.uvMm[i][1])),delta=waistEaseMm*fractions[front?'front':'back']/2;
  p.uvMm=old.uvMm.map(([x,y])=>{const f=Math.max(0,Math.min(1,(y-hipY)/(waistY-hipY)));return[x+(x-centerX)*delta/length*f,y+(y>=crotchY?legDeltaMm*(y-crotchY)/(-crotchY):0)];});
  operationRecords.push({panelId:p.id,legGradeBelowDatumMm:crotchY,waistGradeAboveDatumMm:hipY,waistNetAdditionMm:delta,mode:'piecewise-linear paper-coordinate grading; not 3D scale'});
 }
 if(waistEaseMm){for(const p of spec.panels.filter(p=>p.id.startsWith('wb_'))){
  const old=original[p.id],front=p.id==='wb_front',topKey=front?'e6':'e0',seams=waistSeams.filter(s=>s.a.panelId===p.id).sort((a,b)=>+a.a.edge.slice(1)-+b.a.edge.slice(1));
  const lengths=seams.map(s=>edgeLength(panels[s.b.panelId],s.b.edge)*edgeLength(old,s.a.edge)/edgeLength(original[s.b.panelId],s.b.edge));
  const top=edgeLength(old,topKey)+waistEaseMm*fractions[front?'front':'back'],bottom=lengths.reduce((a,b)=>a+b,0),h=35,phi=(bottom-top)/h;
  if(phi<=.001||phi>=Math.PI)throw Error('腰头圆弧超出本例可支持范围');
  const rt=top/phi,rb=rt+h,topIds=old.edges[topKey],xc=(old.uvMm[topIds[0]][0]+old.uvMm[topIds.at(-1)][0])/2;
  const point=(r,theta)=>[xc+r*Math.sin(theta),r*Math.cos(theta)-rt*Math.cos(phi/2)];
  const direction=front?1:-1;let traveled=0;
  for(let k=0;k<seams.length;k++){const ids=p.edges[seams[k].a.edge],length=lengths[k];ids.forEach((id,j)=>{const t=(traveled+length*j/(ids.length-1))/bottom;p.uvMm[id]=point(rb,direction*(t-.5)*phi);});traveled+=length;}
  const topDir=old.uvMm[topIds.at(-1)][0]>old.uvMm[topIds[0]][0]?1:-1;
  topIds.forEach((id,j)=>{p.uvMm[id]=point(rt,topDir*(j/(topIds.length-1)-.5)*phi);});
  const other=Object.keys(p.edges).filter(k=>k!==topKey&&!seams.some(s=>s.a.edge===k));
  for(const key of other){const ids=p.edges[key],a=[...p.uvMm[ids[0]]],b=[...p.uvMm[ids.at(-1)]];ids.forEach((id,j)=>p.uvMm[id]=a.map((x,k)=>x+(b[k]-x)*j/(ids.length-1)));}
 }}
 for(const s of spec.seams)s.easeMm=edgeLength(panels[s.b.panelId],s.b.edge)-edgeLength(panels[s.a.panelId],s.a.edge);
 spec.revision=1;spec.id='kaopu-short-paper-'+legDeltaMm+'-'+waistEaseMm;
 spec.source.onlineProgram={id:PROGRAM,controls:{legDeltaMm,waistEaseMm},operationRecords,meaning:'bounded own 2D grading of attributed six-panel teacher pattern; not complete official generator port',sourcePaperFingerprint:fingerprint(base)};
 return spec;
}
export function meshPaper(input,{step=16}={}){
 const spec=clone(input);for(const p of spec.panels){const boundary=p.boundary.map(i=>p.uvMm[i]),constraints=p.boundary.map((i,j)=>[i,p.boundary[(j+1)%p.boundary.length]]),xs=boundary.map(q=>q[0]),ys=boundary.map(q=>q[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),count=p.uvMm.length;let row=0;
  for(let y=ymin+step*Math.sqrt(3)/4;y<ymax;y+=step*Math.sqrt(3)/2,row++)for(let x=xmin+step/2+(row%2)*step/2;x<xmax;x+=step){const q=[x,y];if(inside(q,boundary)&&constraints.every(([a,b])=>segDist(q,p.uvMm[a],p.uvMm[b])>step*.42))p.uvMm.push(q);}
  p.triangles=cdt2d(p.uvMm,constraints,{exterior:false}).map(t=>{const[a,b,c]=t.map(i=>p.uvMm[i]);return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?t:[t[0],t[2],t[1]];});p.temporaryGuideMaterialIds=Array.from({length:p.uvMm.length-count},(_,i)=>count+i);p.source.meshMethod='cdt2d@1.0.0 MIT, 16 mm interior spacing; updated 2D boundaries retained';
 }
 spec.source.meshing={method:'cdt2d@1.0.0 MIT',interiorSpacingMm:step,baseCurveChordDeviationMm:.25,all28SourceStitchesRetained:true};validate(spec);return spec;
}
export function paperSummary(spec){return {program:spec.source.onlineProgram,panels:spec.panels.length,seams:spec.seams.length,waistTopMm:edgeLength(spec.panels.find(p=>p.id==='wb_front'),'e6')+edgeLength(spec.panels.find(p=>p.id==='wb_back'),'e0'),particleCount:spec.panels.reduce((n,p)=>n+p.uvMm.length,0),triangleCount:spec.panels.reduce((n,p)=>n+p.triangles.length,0),netMaterialAreaMm2:spec.panels.reduce((n,p)=>n+p.triangles.reduce((a,t)=>{const[u,v,w]=t.map(i=>p.uvMm[i]);return a+Math.abs((v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]))/2;},0),0)};}
