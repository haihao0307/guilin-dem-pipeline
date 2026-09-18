/* Continuous scalar field study. Canonical data contains only separable curves
 * and explicit parameter domains. Display samples are disposable GL_POINTS.
 * View-directed sampling evaluates the same continuous fields directly; it is
 * not a collection of pre-authored LOD assets.
 * Not a replacement for KAOPU semantics or the approved ecology baseline. */
const FieldKernel=(()=>{
'use strict';
function decode(doc){
 if(!doc.coefficientBytes)return doc;
 const text=atob(doc.coefficientBytes),bytes=Uint8Array.from(text,c=>c.charCodeAt(0)),dv=new DataView(bytes.buffer);
 if(bytes.length>8*1024*1024)throw Error('Coefficient budget exceeded');
 for(const p of doc.patches)for(const f of Object.values(p.fields))for(const axis of ['rows','cols']){
  const info=f[axis];if(!Number.isInteger(info.offset)||info.offset<0||info.count!==f.rank*info.length||info.offset+2*info.count>bytes.length||info.scales.length!==f.rank||info.scales.some(x=>!Number.isFinite(x)))throw Error('Invalid factor bounds');
  f[axis]=Array.from({length:f.rank},(_,k)=>Array.from({length:info.length},(_,i)=>dv.getInt16(info.offset+2*(k*info.length+i),true)*info.scales[k]));
 }
 delete doc.coefficientBytes;return doc;
}
const names=['x','y','z','red','green','blue','alpha','roughness','nx','ny','nz','er','eg','eb','sx','sy','sz'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function cubic(p0,p1,p2,p3,t){return p1+.5*t*(p2-p0+t*(2*p0-5*p1+4*p2-p3+t*(3*(p1-p2)+p3-p0)))}
function curve(a,t){const x=clamp(t,0,1)*(a.length-1),i=Math.floor(x),f=x-i;return cubic(a[Math.max(0,i-1)],a[i],a[Math.min(i+1,a.length-1)],a[Math.min(i+2,a.length-1)],f)}
function field(coeff,u,v){let r=0;for(let k=0;k<coeff.rank;k++)r+=curve(coeff.rows[k],v)*curve(coeff.cols[k],u);return r}
function patchAt(p,u,v){return names.map(k=>field(p.fields[k],u,v))}
function reconstruct(patch){const W=patch.width,H=patch.height,out={};for(const name of names){const f=patch.fields[name],a=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)a[y*W+x]=field(f,x/(W-1),y/(H-1));out[name]=a}return out}
function sample(a,W,H,u,v){const x=clamp(u,0,1)*(W-1),y=clamp(v,0,1)*(H-1),ix=Math.floor(x),iy=Math.floor(y);const row=[];for(let j=-1;j<=2;j++){const yy=clamp(iy+j,0,H-1),q=[];for(let i=-1;i<=2;i++)q.push(a[yy*W+clamp(ix+i,0,W-1)]);row.push(cubic(...q,x-ix))}return cubic(...row,y-iy)}
function valid(p,u,v){const y=Math.round(clamp(v,0,1)*(p.height-1)),x=clamp(u,0,1)*(p.width-1),r=p.domain[y];for(let k=0;k<r.length;k+=2)if(x>=r[k]&&x<=r[k+1])return true;return false}
function normal(a){const l=Math.hypot(...a)||1;return a.map(x=>x/l)}
function conduct(projectedPixels,opts={}){
 if(!Number.isFinite(projectedPixels)||projectedPixels<0)throw Error('projectedPixels must be finite and nonnegative');
 const fullAtPixels=opts.fullAtPixels??420,minDetail=opts.minDetail??.045,maxDetail=opts.maxDetail??1;
 if(!(fullAtPixels>0&&minDetail>0&&maxDetail>=minDetail&&maxDetail<=1))throw Error('Invalid conduct settings');
 const raw=clamp(projectedPixels/fullAtPixels,minDetail,maxDetail);
 // Quantization limits buffer rebuild churn only. It does not select another asset.
 const detail=Math.max(minDetail,Math.min(maxDetail,Math.round(raw*64)/64));
 return{projectedPixels,detail,detailKey:detail.toFixed(5),fullAtPixels,minDetail,maxDetail,assetIdentity:'same-field'};
}
function resolution(p,plan){
 const detail=typeof plan==='number'?plan:(plan?.detail??1);if(!Number.isFinite(detail)||detail<=0||detail>1)throw Error('detail must be in (0,1]');
 return{W:Math.max(2,Math.round((p.width-1)*detail)+1),H:Math.max(2,Math.round((p.height-1)*detail)+1),detail};
}
function fish(doc,plan=1){
 if(doc.schema!=='kaopu-source-chart-field-study/0.1')throw Error('Unsupported field study');const out=[];let validCount=0;const patchPlans=[];
 for(const p of doc.patches){const {W,H,detail}=resolution(p,plan),duStep=1/Math.max(1,W-1),dvStep=1/Math.max(1,H-1);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const u=x/(W-1),v=y/(H-1);if(!valid(p,u,v))continue;const a=patchAt(p,u,v);if(a.some(x=>!Number.isFinite(x)))throw Error('Nonfinite generated field');
   const left=patchAt(p,clamp(u-duStep,0,1),v),right=patchAt(p,clamp(u+duStep,0,1),v),down=patchAt(p,u,clamp(v-dvStep,0,1)),up=patchAt(p,u,clamp(v+dvStep,0,1));
   const du=Math.hypot(...right.slice(0,3).map((e,i)=>(e-left[i])*.5)),dv=Math.hypot(...up.slice(0,3).map((e,i)=>(e-down[i])*.5));const radius=clamp(Math.max(du,dv)*.78,.00023,.018);
   for(const mirror of p.mirrorX?[1,-1]:[1]){const q=a.slice();q[0]*=mirror;q[8]*=mirror;q[14]*=mirror;const n=normal(q.slice(8,11)),s=normal(q.slice(14,17));
    out.push(q[0]/doc.sourceLengthUnits,q[1]/doc.sourceLengthUnits,(q[2]+.06)/doc.sourceLengthUnits,...n,...q.slice(3,6).map(c=>clamp(c,0,1)),clamp(q[6],0,1),clamp(q[7],.06,1),radius/doc.sourceLengthUnits,...s,...q.slice(11,14).map(c=>clamp(c,0,1)));validCount++;
   }
  }
  patchPlans.push({id:p.id,W,H,detail});
 }
 return{data:new Float32Array(out),count:validCount,stride:18,patchPlans,detail:patchPlans.length?patchPlans[0].detail:1,canonical:'separable continuous scalar fields; direct generated sample cache',sourceTriangleCount:0,intermediateRaster:false};
}
return{decode,field,patchAt,curve,valid,fish,reconstruct,sample,conduct,resolution};})();
if(typeof module!=='undefined')module.exports=FieldKernel;
