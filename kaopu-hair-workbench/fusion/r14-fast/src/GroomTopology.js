/** R13C: one anatomically-local root domain, finite front part and crown field.
 * Engineering calibration for the native GNM head (metres / Y up), not a
 * biological population model. Labels do not make empty stripes in the scalp.
 * SideFX: part curves constrain interpolation; groups/masks remain distinct.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const unit=v=>{const n=Math.hypot(...v);return n>1e-10?v.map(x=>x/n):[.06,-.2,1];};
export function partX(p,d){return d.partMM*.001+.00045*Math.sin(p[2]*81)+.00025*Math.sin(p[2]*173+1.1);}
export function finitePart(p,d){return smooth(.008,.033,p[2])*smooth(.338,.370,p[1])*(1-smooth(.056,.075,Math.abs(p[0])));}
export function partSign(p,d){return p[0]>=partX(p,d)?1:-1;}
export function canInterpolate(a,b,d){
 const da=a[0]-partX(a,d),db=b[0]-partX(b,d);if(da*db>=0)return true;
 const t=da/(da-db),p=a.map((v,k)=>mix(v,b[k],t));return finitePart(p,d)<.22;
}
export function zoneWeights(p){
 const x=Math.abs(p[0]),y=p[1],z=p[2],lateral=smooth(.043,.067,x),low=1-smooth(.304,.342,y);
 const temporal=lateral*(1-smooth(.053,.084,z))*smooth(.006,.036,z),sideburn=temporal*(1-smooth(.301,.326,y));
 const nape=(1-smooth(-.018,.015,z))*(1-smooth(.292,.326,y)),crown=smooth(.348,.390,y),fringe=smooth(.056,.103,z)*(1-smooth(.044,.072,x));
 return{lateral,low,temporal,sideburn,nape,crown,fringe};
}
export function anatomicalRegion(p){
 const w=zoneWeights(p);if(w.sideburn>.45)return 'sideburn';if(w.nape>.45)return 'nape';if(w.fringe>.4)return 'fringe';if(w.crown>.45)return 'crown';if(p[2]<.007)return 'occiput';return p[0]<0?'right-temple':'left-temple';
}
export function rootVisibility(p){
 const w=zoneWeights(p),side=smooth(.272,.286,p[1]),neck=smooth(.257,.271,p[1]);
 // Long top hair is not cut at an ear-height plane. Potential bindings survive.
 return mix(1,side,w.temporal*(1-smooth(.300,.320,p[1])))*mix(1,neck,w.nape);
}
export function trimLength(p,d,length){
 const w=zoneWeights(p),burn=Math.min(d.sideburnMM*.001,Math.max(.0025,p[1]-.278));
 length=mix(length,Math.min(length,burn),w.sideburn);
 const neck=Math.min(d.napeMM*.001,Math.max(.003,p[1]-.261));return mix(length,Math.min(length,neck),w.nape);
}
export function enforceTrim(root,points,d){
 const w=zoneWeights(root),floor=w.sideburn>.80&&root[1]>.278?.278:w.nape>.90&&root[1]>.261?.261:null;
 if(floor===null)return;
 let hit=-1;for(let j=1;j<points.length;j++)if(points[j][1]<floor){hit=j;break;}
 if(hit<0)return;
 // Cut at the first crossing; never squash a tail onto a horizontal plane.
 const a=points[hit-1],b=points[hit],t=(a[1]-floor)/Math.max(1e-12,a[1]-b[1]);
 const kept=points.slice(0,hit).map(p=>p.slice());kept.push(a.map((v,k)=>mix(v,b[k],t)));
 const arc=[0];for(let j=1;j<kept.length;j++)arc.push(arc.at(-1)+Math.hypot(...kept[j].map((v,k)=>v-kept[j-1][k])));
 const length=arc.at(-1);if(length<1e-9)return;let k=1;
 for(let j=1;j<points.length;j++){const s=length*j/(points.length-1);while(k<arc.length-1&&arc[k]<s)k++;const u=(s-arc[k-1])/Math.max(1e-12,arc[k]-arc[k-1]);points[j]=kept[k-1].map((v,c)=>mix(v,kept[k][c],u));}
}
export function growthDirection(p,root,d){
 const w=zoneWeights(root),side=partSign(root,d),part=finitePart(root,d);
 // Point whorl, not an ear-to-ear transition belt.
 const wx=-.008,wz=.005,dx=p[0]-wx,dz=p[2]-wz,rad=Math.hypot(dx,dz),turn=.32+1.20*Math.exp(-Math.pow(rad/.038,4))*Math.exp(-Math.pow(Math.hypot(p[0]-root[0],p[2]-root[2])/.030,2));
 let x=(dx*Math.cos(turn)-dz*Math.sin(turn))/.065,z=(dx*Math.sin(turn)+dz*Math.cos(turn))/.065,y=-.08-.7*(1-w.crown);
 // Separate growth from styling: roots keep the original whorl rather than
 // translating its source point. Existing mid-shafts, not a hidden cap, overlap.
 const travelled=Math.hypot(...p.map((v,k)=>v-root[k]));
 const cap=Math.exp(-Math.pow(Math.hypot(root[0]+.008,root[2]-.005)/.060,6))*smooth(.335,.380,root[1]);
 // Rear roots must keep descending over the occiput; combing them all forward
 // merely trades a crown gap for a posterior gap and standing tufts.
 const rearGuard=smooth(-.032,-.010,root[2]);
 const cover=(d.crownCover??86)*.01*cap*rearGuard*smooth(.003,.014,travelled);
 x=mix(x,.08+(d.flow-10)*.002,cover);z=mix(z,1,cover);
 const core=1-smooth(.0003,.0018,rad);x+=.06*core;z+=.04*core;
 let authored;
 if(d.style==='textured-fringe')authored=[.11+(d.flow-10)*.006+side*d.partOpen*.0025,-.16,1];
 else if(d.style==='side-flow')authored=[side*(.48+d.flow*.008+d.partOpen*.003),-.18,.67];
 else authored=[side*(.37+d.partOpen*.007+(d.flow-60)*.003),-.16,.82];
 const frontMask=part*(1-w.lateral*.60);x=mix(x,authored[0],frontMask);y=mix(y,authored[1],frontMask);z=mix(z,authored[2],frontMask);
 // Ear-side roots join the same descending field as the occiput.
 const flank=w.lateral*(.38+.62*w.low);x=mix(x,Math.sign(root[0])*.10,flank);y=mix(y,-1,flank);z=mix(z,-.14+.22*smooth(.025,.066,root[2]),flank);
 return unit([x,y,z]);
}
export function coherentPhase(p){return .75*Math.sin(p[0]*91+p[2]*34)+.55*Math.sin(p[1]*83-p[2]*71);}
export const TOPOLOGY_SPEC={version:'R14-root-topology@1',units:'metre',whorlXZ:[-.008,.005],partExtent:'frontal scalp only; fades behind z=8–33mm',sideburnMinimumTipY:.278,napeMinimumTipY:.261,sharedInnerOuterField:true,innerCapMeshes:0,rootCollarMetres:true,trimMethod:"first-crossing-cut-and-arc-resample",staticOnly:true};

// Adaptive guide sampling resolves a high-curvature flow without changing roots.
export function crownWeight(p){return Math.exp(-Math.pow(Math.hypot(p[0]+.008,p[2]-.005)/.038,4))*smooth(.350,.380,p[1]);}
export function guideSpacingAt(p){const r=Math.hypot(p[0]+.008,p[2]-.005);return mix(.008,mix(.0035,.007,smooth(.026,.070,r)),smooth(.350,.380,p[1]));}
