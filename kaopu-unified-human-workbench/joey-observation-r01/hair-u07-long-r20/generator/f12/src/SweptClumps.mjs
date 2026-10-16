import {traceRootFlow} from './RootFlow.mjs';
import {clumpRule} from './ClumpRules.mjs';
import {point} from './NativeSurface.mjs';
import {add,sub,mul,mix,dot,cross,len,unit,smooth,clamp} from './approved/LegacyFoundation.mjs';
const project=(v,n)=>sub(v,mul(n,dot(v,n)));
function rotate(v,axis,a){return add(add(mul(v,Math.cos(a)),mul(cross(axis,v),Math.sin(a))),mul(axis,dot(axis,v)*(1-Math.cos(a))));}
function transport(w,a,b){const axis=cross(a,b),s=len(axis),c=clamp(dot(a,b),-1,1);if(s<1e-8)return unit(project(w,b));return unit(rotate(w,mul(axis,1/s),Math.atan2(s,c)));}
function dimensions(id){if(id==='bang-wisps')return [.0016,.0010,18];if(id==='bang-sweep')return [.008,.0035,24];if(id.startsWith('frame'))return [.012,.013,25];if(id.startsWith('outer'))return [.022,.018,20];if(id.startsWith('under'))return [.016,.011,12];if(id.startsWith('back'))return [.027,.018,10];return [.024,.012,8];}
// A volume is a continuous family of root-owned paths through nonzero 2D
// sections. Parallel transport and a separate authored twist prevent a flat
// ribbon from being mistaken for a volumetric bundle.
export function createSweptClump(region,guides,state,builder){
 const id=region.id,isFringe=state.recipe.family!=='u07-center-long'&&id.startsWith('bang'),axis=clumpRule(id,state.recipe)?.axis??0,longAxis=isFringe?2:1,origin=region.nodes.reduce((p,n)=>add(p,mul(n.p,1/region.nodes.length)),[0,0,0]);
 // Dense follicles cover the complete clipped source triangles, beyond the
 // sparse engineering guide samples. Use that complete domain for depth.
 const sourceSamples=[...region.nodes,...region.cells.flatMap(c=>c.v)],lo=Math.min(...sourceSamples.map(n=>n.chartP[axis])),hi=Math.max(...sourceSamples.map(n=>n.chartP[axis])),span=Math.max(.00001,hi-lo),bins=Array.from({length:17},()=>[Infinity,-Infinity]);
 // Intersect the complete source triangles at each chart column. Merely
 // binning vertices leaves false zero-width columns in narrow edge patches.
 for(let i=0;i<bins.length;i++){const x=lo+span*i/16;for(const cell of region.cells)for(let k=0;k<3;k++){const a=cell.v[k].chartP,b=cell.v[(k+1)%3].chartP,d=b[axis]-a[axis];if(Math.abs(d)<1e-12){if(Math.abs(x-a[axis])<1e-9){bins[i][0]=Math.min(bins[i][0],a[longAxis],b[longAxis]);bins[i][1]=Math.max(bins[i][1],a[longAxis],b[longAxis]);}continue;}const t=(x-a[axis])/d;if(t< -1e-8||t>1+1e-8)continue;const y=a[longAxis]+(b[longAxis]-a[longAxis])*t;bins[i][0]=Math.min(bins[i][0],y);bins[i][1]=Math.max(bins[i][1],y);}}
 for(let i=0;i<bins.length;i++)if(!Number.isFinite(bins[i][0])){let k=0;while(i-k>=0||i+k<bins.length){const b=bins[Math.max(0,i-k)],c=bins[Math.min(16,i+k)];if(Number.isFinite(b[0])){bins[i]=b.slice();break;}if(Number.isFinite(c[0])){bins[i]=c.slice();break;}k++;}}
 const coords=node=>{const q=clamp((node.chartP[axis]-lo)/span,0,1),x=q*16,i=Math.min(15,Math.floor(x)),limits=mix([bins[i][0],bins[i][1],0],[bins[i+1][0],bins[i+1][1],0],x-i),a=q*2-1,b=clamp((node.chartP[longAxis]-limits[0])/Math.max(.00001,limits[1]-limits[0])*2-1,-1,1);return [a*Math.sqrt(1-b*b*.5),b*Math.sqrt(1-a*a*.5)];};
 const rootPaths=new WeakMap(),pathOf=node=>{let path=rootPaths.get(node);if(!path){path=traceRootFlow(node,id,region.clumpId,state.recipe,builder);rootPaths.set(node,path);}return path;},guidePaths=guides.map(g=>pathOf(builder.roots[g.rootId]));
 const [width,thickness,twistDegrees]=dimensions(state.recipe.family==='u07-center-long'&&id.startsWith('bang')?'frame'+(id==='bang-sweep'?'-left':'-right'):id),steps=64,centers=Array.from({length:steps+1},(_,i)=>guidePaths.reduce((p,path)=>add(p,mul(path.at(i/steps),1/guidePaths.length)),[0,0,0])),sections=[];
 const sign=id.endsWith('left')||id==='bang-sweep'?-1:1,radial=isFringe?[0,0,1]:id.startsWith('back')||id==='nape'?[0,0,-1]:[sign,0,.1],childIndex=Number(region.clumpId.split('/')[1]),rollStrength=isFringe?0:id.startsWith('outer')?.55+.25*Math.sin(childIndex*1.3):id.startsWith('back')?.35:.20,rollWindow=u=>smooth((u-.16)/.18)*(1-smooth((u-.68)/.26));let previousW,previousT;
 for(let i=0;i<=steps;i++){const u=i/steps,tangent=unit(sub(centers[Math.min(steps,i+1)],centers[Math.max(0,i-1)]));let W=previousW?transport(previousW,previousT,tangent):unit(project(axis===2?[0,0,1]:[1,0,0],tangent));if(len(W)<.5)W=unit(cross(tangent,radial));let B=unit(cross(tangent,W));if(i===0&&dot(B,radial)<0){W=mul(W,-1);B=mul(B,-1);}previousW=W;previousT=tangent;
  const angle=sign*state.recipe.twistGain*Math.PI/180*(twistDegrees*(smooth((u-.10)/.45)-.68*smooth((u-.68)/.30))+18*rollStrength*rollWindow(u)),w=add(mul(W,Math.cos(angle)),mul(B,Math.sin(angle))),b=sub(mul(B,Math.cos(angle)),mul(W,Math.sin(angle))),growth=smooth(u/.24),taper=1-(isFringe?.90:.35)*smooth((u-(isFringe?.78:.90))/(isFringe?.22:.10)),thicknessTaper=1-(isFringe?.94:.50)*smooth((u-(isFringe?.80:.90))/(isFringe?.20:.10));
  sections.push({u,center:centers[i],tangent,widthAxis:w,thicknessAxis:b,halfWidth:width*growth*taper,halfThickness:thickness*growth*thicknessTaper,twistRadians:angle});
 }
 const shortSign=dot(sections[0].widthAxis,axis===2?[0,0,1]:[1,0,0])<0?-1:1;
 const section=u=>{const x=clamp(u)*steps,i=Math.min(steps-1,Math.floor(x)),t=x-i,a=sections[i],b=sections[i+1];return {center:mix(a.center,b.center,t),widthAxis:unit(mix(a.widthAxis,b.widthAxis,t)),thicknessAxis:unit(mix(a.thicknessAxis,b.thicknessAxis,t)),halfWidth:a.halfWidth+(b.halfWidth-a.halfWidth)*t,halfThickness:a.halfThickness+(b.halfThickness-a.halfThickness)*t};};
 function clear(p,u){if(u===0)return p;let q=p;for(let i=0;i<3;i++){const h=builder.bvh.nearest(q),n=unit(point(builder.head,h.t,h.b,builder.normals)),signed=dot(sub(q,h.p),n),gap=Math.min(.0012,u*.025);if(signed>=gap)break;q=add(q,mul(n,gap-signed));}return q;}
 function at(node,u,projectBody=true){if(!u)return node.p.slice();const flow=pathOf(node);const sectionData=section(u),[a,b]=coords(node),gain=smooth((flow.length*u-.025)/.090);let p=flow.at(u);p=add(p,add(mul(sectionData.widthAxis,a*shortSign*sectionData.halfWidth*.18*gain),mul(sectionData.thicknessAxis,b*sectionData.halfThickness*(isFringe?.60:.95)*gain)));p=add(p,mul(unit(radial),.0035*rollStrength*rollWindow(u)*Math.min(1,flow.length/.16)));return projectBody?clear(p,u):p;}

 const anchor=guides.reduce((a,b)=>len(sub(builder.roots[a.rootId].p,origin))<len(sub(builder.roots[b.rootId].p,origin))?a:b);
 return {at,section,metadata:{id:region.clumpId,sourceAreaCM2:region.area*1e4,anchorRootId:anchor.rootId,sourceMap:{axis,longAxis,shortSign,min:lo,max:hi,conditionalLongBounds:bins,mapping:'conditional rectangle to disk for transverse offsets; exact roots follow continuous full-length scalp flow'},crossSection:'elliptic 2D area, separate width and thickness',frameMethod:'minimal-rotation parallel transport + authored axial twist',twistMeaning:'static groom orientation; not simulated torsion',sections:structuredClone(sections),pathAuthority:'continuous root-specific scalp-relative flow; measured sections are inspection envelopes',peakWidthMM:width*2000,peakThicknessMM:thickness*2000},coords};
}
export function guideThroughClump(g,model,builder){
 const root=builder.roots[g.rootId],segments=Math.min(480,Math.max(40,Math.ceil(g.actualMM/1.0))),points=[...root.p];
 for(let i=1;i<=segments;i++){const wanted=model.at(root,i/segments);for(let j=0;j<3;j++){const p=points.slice(-3),distance=len(sub(wanted,p));if(distance<1e-6)break;const step=Math.min(.0015,distance),direction=unit(sub(wanted,p)),h=builder.bvh.nearest(p),n=unit(point(builder.head,h.t,h.b,builder.normals));let q=add(p,mul(direction,step));const valid=q=>{const hit=builder.bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q);if(hit)return false;const h=builder.bvh.nearest(q),normal=unit(point(builder.head,h.t,h.b,builder.normals));return dot(sub(q,h.p),normal)>=Math.min(.0008,i*.00012)-1e-7;};
   if(!valid(q)){const t=unit(project(direction,n));let found=false;for(const lift of [.12,.25,.45,.70,.95,1]){const v=unit(add(mul(t,1-lift),mul(n,lift))),candidate=add(p,mul(v,step));if(valid(candidate)){q=candidate;found=true;break;}}if(!found){if(i===1){q=add(p,mul(builder.frames.get(g.rootId).dir,step));if(builder.bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q))throw Error('体积导向出根失败 '+g.rootId);}else break;}}
   points.push(...q);if(distance<=step)break;
  }}
 if(points.length>3003)throw Error('体积导向路径过长 '+g.rootId);
 let length=0;for(let i=3;i<points.length;i+=3)length+=len(sub(points.slice(i,i+3),points.slice(i-3,i)));return {...g,points,actualMM:length*1000,requestedMM:length*1000,styleProfile:{...g.styleProfile,clumpId:model.metadata.id,authoredTarget:g.styleProfile.target,hem:points.at(-2),target:points.slice(-3),fieldEndpointErrorMM:len(sub(points.slice(-3),model.at(root,1)))*1000,pathAuthority:'same nonzero 2D section field; guide centerlines include local native-body avoidance',crossSectionModel:model.metadata.id}};
}
