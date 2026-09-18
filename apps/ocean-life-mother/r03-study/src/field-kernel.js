/* Continuous scalar field study. Canonical data contains only separable curves
 * and explicit parameter domains. Display samples are disposable GL_POINTS.
 * View-directed sampling evaluates the same continuous fields directly; it is
 * not a collection of pre-authored LOD assets. Parameter-domain interval
 * boundaries remain explicit so thin observed parts are not silently erased
 * merely because the view budget becomes coarse.
 * Geometric display normals are derived from the SAME continuous position
 * fields and never from an independently fitted normal field. This prevents
 * tangent-plane surfels from contradicting the displayed geometry while the
 * source-derived shading normal remains separate for material study.
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
function domainSpans(p,v){
 if(!p||!Number.isInteger(p.width)||p.width<2||!Number.isInteger(p.height)||p.height<2||!Array.isArray(p.domain)||p.domain.length!==p.height)throw Error('Invalid patch domain');
 const y=Math.round(clamp(v,0,1)*(p.height-1)),r=p.domain[y];if(!Array.isArray(r)||r.length%2)throw Error('Invalid domain row');const spans=[];
 for(let k=0;k<r.length;k+=2){const a=r[k],b=r[k+1];if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<a||b>p.width-1)throw Error('Invalid domain interval');spans.push([a/(p.width-1),b/(p.width-1)]);}
 return spans;
}
function valid(p,u,v){const x=clamp(u,0,1);return domainSpans(p,v).some(([a,b])=>x>=a&&x<=b)}
function normal(a){const l=Math.hypot(...a);return l>1e-18?a.map(x=>x/l):null}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function positionAt(p,u,v){return[field(p.fields.x,u,v),field(p.fields.y,u,v),field(p.fields.z,u,v)]}
function containingSpan(p,u,v){for(const span of domainSpans(p,v))if(u>=span[0]-1e-12&&u<=span[1]+1e-12)return span;return null}
function nearestValidV(p,u,v,dir,step,maxRows=6){
 if(!(dir===-1||dir===1)||!(step>0))throw Error('Invalid V-neighbour request');
 for(let k=1;k<=maxRows;k++){const q=clamp(v+dir*step*k,0,1);if(Math.abs(q-v)<1e-15)break;if(valid(p,u,q))return q;}
 return v;
}
function geometricFrame(p,u,v,steps={}){
 const span=containingSpan(p,u,v);if(!span)throw Error('Sample outside explicit parameter domain');
 const defaultU=1/Math.max(8,p.width-1),defaultV=1/Math.max(8,p.height-1),du=Math.max(1e-7,steps.du??defaultU),dv=Math.max(1e-7,steps.dv??defaultV);
 let ul=Math.max(span[0],u-du),ur=Math.min(span[1],u+du);if(ur-ul<1e-12){ul=span[0];ur=span[1];}
 const vd=nearestValidV(p,u,v,-1,dv),vu=nearestValidV(p,u,v,1,dv);
 const c=positionAt(p,u,v),L=positionAt(p,ul,v),R=positionAt(p,ur,v),D=positionAt(p,u,vd),U=positionAt(p,u,vu);
 const tu=(ur-ul)>1e-12?R.map((x,i)=>(x-L[i])/(ur-ul)):null;
 const tv=(vu-vd)>1e-12?U.map((x,i)=>(x-D[i])/(vu-vd)):null;
 let n=tu&&tv?normal(cross(tu,tv)):null;
 const q=patchAt(p,u,v),sourceGeo=normal(q.slice(14,17));
 if(!n)n=sourceGeo||[0,1,0];
 if(sourceGeo&&dot(n,sourceGeo)<0)n=n.map(x=>-x);
 const shading=normal(q.slice(8,11))||n;
 return{position:c,normal:n,shadingNormal:shading,sourceGeometricNormal:sourceGeo,tangentU:tu,tangentV:tv,span,vNeighbours:[vd,vu],normalAgreement:sourceGeo?dot(n,sourceGeo):null,shadingDeviation:Math.acos(clamp(dot(n,shading),-1,1))};
}
function conduct(projectedPixels,opts={}){
 if(!Number.isFinite(projectedPixels)||projectedPixels<0)throw Error('projectedPixels must be finite and nonnegative');
 const fullAtPixels=opts.fullAtPixels??420,minDetail=opts.minDetail??.045,maxDetail=opts.maxDetail??1;
 if(!(fullAtPixels>0&&minDetail>0&&maxDetail>=minDetail&&maxDetail<=1))throw Error('Invalid conduct settings');
 const raw=clamp(projectedPixels/fullAtPixels,minDetail,maxDetail);
 const detail=Math.max(minDetail,Math.min(maxDetail,Math.round(raw*64)/64));
 return{projectedPixels,detail,detailKey:detail.toFixed(5),fullAtPixels,minDetail,maxDetail,assetIdentity:'same-field'};
}
function resolution(p,plan){
 const detail=typeof plan==='number'?plan:(plan?.detail??1);if(!Number.isFinite(detail)||detail<=0||detail>1)throw Error('detail must be in (0,1]');
 return{W:Math.max(2,Math.round((p.width-1)*detail)+1),H:Math.max(2,Math.round((p.height-1)*detail)+1),detail};
}
function sampleCoordinates(p,plan=1){
 const {H,detail}=resolution(p,plan),coords=[],rows=[];
 for(let y=0;y<H;y++){
  const v=y/(H-1),spans=domainSpans(p,v),start=coords.length;
  for(const [u0,u1] of spans){
   const sourceCells=(u1-u0)*(p.width-1),count=sourceCells===0?1:Math.max(2,Math.round(sourceCells*detail)+1);
   for(let x=0;x<count;x++)coords.push([count===1?(u0+u1)*.5:u0+(u1-u0)*x/(count-1),v,u0,u1]);
  }
  rows.push({v,spanCount:spans.length,start,count:coords.length-start});
 }
 return{coords,rows,H,detail};
}
function fish(doc,plan=1){
 if(doc.schema!=='kaopu-source-chart-field-study/0.1')throw Error('Unsupported field study');const out=[];let validCount=0;const patchPlans=[];
 for(const p of doc.patches){const sampled=sampleCoordinates(p,plan),detail=sampled.detail,dvStep=1/Math.max(1,sampled.H-1);let boundarySamples=0,minGeoAgreement=1,maxShadeDeviation=0,geoFallbacks=0;
  for(const [u,v,u0,u1] of sampled.coords){const a=patchAt(p,u,v);if(a.some(x=>!Number.isFinite(x)))throw Error('Nonfinite generated field');
   const sourceCells=Math.max(1,(u1-u0)*(p.width-1)),duStep=Math.max(1e-6,(u1-u0)/Math.max(1,Math.round(sourceCells*detail)));
   const left=positionAt(p,Math.max(u0,u-duStep),v),right=positionAt(p,Math.min(u1,u+duStep),v),vd=nearestValidV(p,u,v,-1,dvStep),vu=nearestValidV(p,u,v,1,dvStep),down=positionAt(p,u,vd),up=positionAt(p,u,vu);
   const du=Math.hypot(...right.map((e,i)=>(e-left[i])*.5)),dv=Math.hypot(...up.map((e,i)=>(e-down[i])*.5));const radius=clamp(Math.max(du,dv)*.78,.00023,.018);if(Math.abs(u-u0)<1e-12||Math.abs(u-u1)<1e-12)boundarySamples++;
   const frame=geometricFrame(p,u,v,{du:duStep,dv:dvStep});if(frame.sourceGeometricNormal){minGeoAgreement=Math.min(minGeoAgreement,frame.normalAgreement);}else geoFallbacks++;maxShadeDeviation=Math.max(maxShadeDeviation,frame.shadingDeviation);
   for(const mirror of p.mirrorX?[1,-1]:[1]){const q=a.slice(),displayN=frame.shadingNormal.slice(),geoN=frame.normal.slice();q[0]*=mirror;displayN[0]*=mirror;geoN[0]*=mirror;
    out.push(q[0]/doc.sourceLengthUnits,q[1]/doc.sourceLengthUnits,(q[2]+.06)/doc.sourceLengthUnits,...displayN,...q.slice(3,6).map(c=>clamp(c,0,1)),clamp(q[6],0,1),clamp(q[7],.06,1),radius/doc.sourceLengthUnits,...geoN,...q.slice(11,14).map(c=>clamp(c,0,1)));validCount++;
   }
  }
  patchPlans.push({id:p.id,H:sampled.H,detail,parameterSamples:sampled.coords.length,boundarySamples,rows:sampled.rows.length,minDerivedVsFittedGeometricNormalDot:minGeoAgreement,maxShadingVsDerivedGeometricDeviationRadians:maxShadeDeviation,geometricNormalFallbacks:geoFallbacks});
 }
 return{data:new Float32Array(out),count:validCount,stride:18,patchPlans,detail:patchPlans.length?patchPlans[0].detail:1,canonical:'separable continuous scalar fields; domain-aware direct generated sample cache',sourceTriangleCount:0,intermediateRaster:false,boundaryPreserving:true,geometryNormalFromPositionField:true};
}
return{decode,field,patchAt,curve,valid,fish,reconstruct,sample,conduct,resolution,domainSpans,sampleCoordinates,positionAt,geometricFrame,nearestValidV};})();
if(typeof module!=='undefined')module.exports=FieldKernel;
