import {lashEnvelope,normalizeLength} from './Profiles.mjs';
import {random,curve2,cubic,visibleRim,bindOffsets,add,sub,mul,dot,unit,clamp,smooth} from '../brow-lash-r01/SurfaceBinding.mjs';
// Original rest-surface growth fields. No external eyebrow/lash geometry or bitmap.
export function grow(groom,g){
 const {model,frame:f,settings:s}=groom,grouped={upper:[],lower:[]};
 for(const side of ['right','left']){
  const rng=random(s.seed+(side==='left'?18223:3011)),L=i=>f.project(groom.landmark(i));
  const ids=side==='right'?{brow:[21,20,19,18,17],upper:[39,38,37,36],lower:[39,40,41,36]}:{brow:[22,23,24,25,26],upper:[42,43,44,45],lower:[42,47,46,45]};
  const brow=ids.brow.map(L),upper=ids.upper.map(L),lower=ids.lower.map(L),dir=Math.sign(brow.at(-1)[0]-brow[0][0]);
  const eyeOut=unit(sub(groom.landmark(ids.upper.at(-1)),groom.landmark(ids.upper[0])));
  const nativeEye=model.eyeSurface.eyes.find(e=>e.side===side),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const i of nativeEye.vertices){const a=model.positions,p=f.project([a[i*3],a[i*3+2],-a[i*3+1]]);for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}}
  const eyeCenter=f.world(min.map((v,k)=>(v+max[k])*.5));
  for(const kind of ['upper','lower']){
   const sign=kind==='upper'?1:-1,count=Math.round((kind==='upper'?132:60)*s.lashDensity),outline=kind==='upper'?upper:lower;
   for(let j=0;j<count;j++){
    const raw=.065+.875*(j+.1+.8*rng())/count,u=raw+.0035*Math.sin(raw*47)+.002*Math.sin(raw*101+(side==='left'?2:0));
    const a=curve2(upper,u),b=curve2(lower,u),q=curve2(outline,u),boundary=visibleRim(q[0],(a[1]+b[1])*.5,q[1],sign,groom.skinChart,groom.globeChart);
    if(boundary===null){groom.omitted[kind]++;continue;}
    const row=Math.floor(rng()*(kind==='upper'?3:2)),y=boundary+sign*(.00017+row*.00010+.00008*rng()),root=groom.display.query(q[0],y);
    if(!root){groom.omitted[kind]++;continue;}
    const base=add(root.position,mul(root.normal,.000008)),envelope=lashEnvelope(u),juvenile=rng()<.18;
    const length=(kind==='upper'?.0074:.0032)*envelope*(.92+.16*rng())*(juvenile?.72:1)*s.lashLength;
    const curl=s.lashCurl*(.85+.3*rng()),bundle=Math.floor(u*29),clump=(Math.sin(bundle*19.73+(side==='left'?7:2)))*.0002;
    const fan=(u-.36)*length*1.06+(rng()-.5)*length*.14+clump;
    const vector=(front,up,x)=>add(mul(f.front,front),add(mul(f.up,up*sign),mul(eyeOut,x)));
    const c1=add(base,vector(length*.30,-length*.015,fan*.17)),c2=add(base,vector(length*.67,length*.20*curl,fan*.65)),tip=add(base,vector(length*.79,length*.58*curl,fan));
    const points=normalizeLength(Array.from({length:17},(_,k)=>cubic(base,c1,c2,tip,k/16)),length),anchor=bindOffsets(root,points,g);
    const delta=sub(base,eyeCenter),polar=Math.atan2(dot(delta,f.up),dot(delta,f.front));
    const relative=points.map(p=>{const d=sub(p,base);return [dot(d,f.x),dot(d,f.up),dot(d,f.front)];});
    grouped[kind].push({kind,side,u,lengthM:length,points,anchor,root:anchor,normal:root.normal,radius:(kind==='upper'?.000033:.000024)*(.8+.35*rng())*(juvenile?.72:1)*s.fiberWidth,color:s.color,pigment:.6+.45*rng(),follow:{eyeCenter,polar,relative,points:points.map(p=>[...p])}});
    groom.rimRows.push({side,kind,u,rootXY:[q[0],y],offsetFromNativeVisibleRimMM:Math.abs(y-boundary)*1000});
   }
  }
 }
 return grouped;
}
// Roots follow exact skin barycentrics. Curve rotation follows the globe-relative
// lid angle, not one tessellation edge. This scope is shape-mode and local blinking.
export function followLash(strand,f){
 const a=strand.follow;if(!a)return strand.anchor.sampled;
 const root=strand.anchor.sampled[0],d=sub(root,a.eyeCenter),angle=clamp(Math.atan2(dot(d,f.up),dot(d,f.front))-a.polar,-1.35,1.35),c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<a.relative.length;i++){
  const q=a.relative[i],up=q[1]*c+q[2]*s,front=q[2]*c-q[1]*s,p=a.points[i];
  for(let k=0;k<3;k++)p[k]=root[k]+f.x[k]*q[0]+f.up[k]*up+f.front[k]*front;
 }
 return a.points;
}
