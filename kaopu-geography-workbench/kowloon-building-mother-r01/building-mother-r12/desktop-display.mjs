/** Desktop inspection policy only. Does not change source geometry or materials. */
export const DISPLAY_POLICY=Object.freeze({framebufferBudgetBytes:768*1024*1024,reserveBytes:64*1024*1024,bytesPerPixel:112,fitMargin:.88});
const positive=(v,fallback)=>Number.isFinite(v)&&v>0?v:fallback;
export function displayLimits(gl){
 const viewport=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
 return{maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxRenderbufferSize:gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),maxViewportWidth:viewport[0],maxViewportHeight:viewport[1],...DISPLAY_POLICY};
}
export function nativeDisplaySize({cssWidth,cssHeight,dpr=1,limits={}}){
 if(!Number.isFinite(cssWidth)||!Number.isFinite(cssHeight)||cssWidth<1||cssHeight<1)return{hidden:true,cssWidth,cssHeight,dpr};
 dpr=positive(dpr,1);const requestedWidth=Math.max(1,Math.round(cssWidth*dpr)),requestedHeight=Math.max(1,Math.round(cssHeight*dpr));
 const p={...DISPLAY_POLICY,...limits},maxWidth=Math.floor(Math.min(positive(p.maxTextureSize,16384),positive(p.maxRenderbufferSize,16384),positive(p.maxViewportWidth,16384))),maxHeight=Math.floor(Math.min(positive(p.maxTextureSize,16384),positive(p.maxRenderbufferSize,16384),positive(p.maxViewportHeight,16384)));
 const maxPixels=Math.max(1,Math.floor((p.framebufferBudgetBytes-p.reserveBytes)/p.bytesPerPixel));
 const scale=Math.min(1,maxWidth/requestedWidth,maxHeight/requestedHeight,Math.sqrt(maxPixels/(requestedWidth*requestedHeight)));
 const width=Math.max(1,Math.floor(requestedWidth*scale)),height=Math.max(1,Math.floor(requestedHeight*scale));
 const native=width===requestedWidth&&height===requestedHeight,reasons=[];
 if(requestedWidth>maxWidth||requestedHeight>maxHeight)reasons.push('WebGL 单边尺寸限制');
 if(requestedWidth*requestedHeight>maxPixels)reasons.push('保守帧缓冲内存预算');
 return{hidden:false,cssWidth,cssHeight,dpr,requestedWidth,requestedHeight,width,height,aspect:width/height,native,scale:Math.min(width/requestedWidth,height/requestedHeight),reasons,maxWidth,maxHeight,maxPixels,estimatedFramebufferBytes:width*height*p.bytesPerPixel,budgetBytes:p.framebufferBudgetBytes,reserveBytes:p.reserveBytes};
}
export function displayStatus(size){return`${size.width}×${size.height} 实际渲染 · CSS ${Math.round(size.cssWidth)}×${Math.round(size.cssHeight)} · DPR ${size.dpr}${size.native?' · 原生像素':' · 非原生：'+size.reasons.join(' / ')+`（目标 ${size.requestedWidth}×${size.requestedHeight}，未降几何精度）`}`;}
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],normalize=a=>{const l=Math.hypot(...a);if(!(l>0))throw Error('Invalid camera direction');return a.map(v=>v/l);};
export function boundsCorners(bounds){return Array.from({length:8},(_,i)=>[0,1,2].map(k=>(i&(1<<k))?bounds.max[k]:bounds.min[k]));}
export function unionBounds(list){const valid=list.filter(b=>b?.min?.length===3&&b?.max?.length===3&&b.min.every((v,k)=>Number.isFinite(v)&&Number.isFinite(b.max[k])&&v<=b.max[k]));if(!valid.length)throw Error('No finite scene bounds');return{min:[0,1,2].map(k=>Math.min(...valid.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...valid.map(b=>b.max[k])))};}
export function visibleSceneBounds({model,source,includeSource=true,includeDesign=true,railGroups=[]}){
 const all=[];if(includeSource)all.push(source.bounds,...source.patches.map(p=>p.bounds));
 if(includeDesign){all.push(model.bounds);for(const i of model.instances){all.push(i.bounds);const a=model.archetypes.find(a=>a.id===i.archetypeId),b=a?.spec?.bounds??a?.bounds;if(b)all.push({min:b.min.map((v,k)=>v+(i.translation?.[k]??0)),max:b.max.map((v,k)=>v+(i.translation?.[k]??0))});}
  for(const a of (model.floorStudy??model.hostedComponents)?.apertures??[])for(const p of a.primitives)all.push(p.bounds);
  for(const g of railGroups)for(const i of g.instances){const points=boundsCorners(g.template.bounds).map(p=>i.origin.map((v,k)=>v+p[0]*i.xAxis[k]+p[1]*(k===1?1:0)+p[2]*i.zAxis[k]));all.push({min:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...points.map(p=>p[k])))});}
 }
 return unionBounds(all);
}
export function cameraBasis(camera){const forward=normalize(sub(camera.target,camera.eye)),right=normalize(cross(forward,Math.abs(forward[1])>.999?[0,0,1]:[0,1,0])),up=cross(right,forward);return{forward,right,up};}
/** Solve all perspective inequalities at every AABB corner. A long diagonal
 * alone does not fit portrait views. Distance includes each corner's depth. */
export function fitBoundsCamera(bounds,{aspect=1,direction=[.95,.65,-1.15],fov=Math.PI/4,margin=DISPLAY_POLICY.fitMargin}={}){
 if(!(aspect>0)||!(fov>0&&fov<Math.PI)||!(margin>0&&margin<1))throw Error('Invalid perspective fit');
 const target=bounds.min.map((v,k)=>(v+bounds.max[k])/2),offset=normalize(direction),basis=cameraBasis({target,eye:target.map((v,k)=>v+offset[k])}),tanY=Math.tan(fov/2),tanX=tanY*aspect;
 let distance=.1;for(const p of boundsCorners(bounds)){const q=sub(p,target),z=dot(q,basis.forward);distance=Math.max(distance,Math.abs(dot(q,basis.right))/(tanX*margin)-z,Math.abs(dot(q,basis.up))/(tanY*margin)-z,-z+.1);}
 const camera={target,eye:target.map((v,k)=>v+offset[k]*distance),fov};return{...camera,fit:{bounds,aspect,margin,distance,projected:projectBounds(bounds,camera,aspect)}};
}
export function projectBounds(bounds,camera,aspect){const basis=cameraBasis(camera),tanY=Math.tan(camera.fov/2),points=boundsCorners(bounds).map(p=>{const q=sub(p,camera.eye),depth=dot(q,basis.forward);return{x:dot(q,basis.right)/(depth*tanY*aspect),y:dot(q,basis.up)/(depth*tanY),depth};});return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y)),minDepth:Math.min(...points.map(p=>p.depth)),points};}
/** Observe actual CSS size, screen DPR and fullscreen, with one queued callback.
 * A resize never cancels an in-flight coherent frame; the app coalesces it. */
export function observeDisplay(element,onChange,{window:win=globalThis.window,document:doc=globalThis.document,ResizeObserver:Observer=globalThis.ResizeObserver}={}){
 let disposed=false,raf=null,media=null,lastKey='';
 const sample=()=>{raf=null;if(disposed)return;const r=element.getBoundingClientRect(),key=[r.width,r.height,win.devicePixelRatio||1,doc.visibilityState].join(':');if(key!==lastKey){lastKey=key;onChange({width:r.width,height:r.height,dpr:win.devicePixelRatio||1,visible:doc.visibilityState!=='hidden'});}};
 const queue=()=>{if(!disposed&&raf===null)raf=win.requestAnimationFrame(sample);};
 const dprChanged=()=>{watchDpr();queue();};
 const watchDpr=()=>{media?.removeEventListener?.('change',dprChanged);media=win.matchMedia?.(`(resolution: ${win.devicePixelRatio||1}dppx)`);media?.addEventListener?.('change',dprChanged);};
 const observer=Observer?new Observer(queue):null;observer?.observe(element);win.addEventListener('resize',queue);doc.addEventListener('fullscreenchange',queue);doc.addEventListener('visibilitychange',queue);watchDpr();queue();
 return()=>{if(disposed)return;disposed=true;if(raf!==null)win.cancelAnimationFrame(raf);observer?.disconnect();media?.removeEventListener?.('change',dprChanged);win.removeEventListener('resize',queue);doc.removeEventListener('fullscreenchange',queue);doc.removeEventListener('visibilitychange',queue);};
}
