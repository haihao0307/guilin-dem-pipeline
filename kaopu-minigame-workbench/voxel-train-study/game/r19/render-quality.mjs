export const QUALITY_MODES=['clear','auto','smooth'];
export function normalizeQuality(mode){return QUALITY_MODES.includes(mode)?mode:'clear';}
export function qualityBounds({mode='clear',dpr=1,width=1,height=1,maxBufferSize=Infinity}={}){
 mode=normalizeQuality(mode);
 const device=Number.isFinite(dpr)&&dpr>0?dpr:1;
 const limit=Number.isFinite(maxBufferSize)&&maxBufferSize>0?maxBufferSize:Infinity;
 const native=Math.min(device,limit/Math.max(1,width),limit/Math.max(1,height));
 const floor=Math.min(native,1);
 return{mode,deviceRatio:device,max:native,min:mode==='smooth'?Math.min(native,.75):floor,initial:mode==='smooth'?Math.min(native,.75):native,hardwareLimited:native<device-1e-8};
}
export function nextRenderRatio({mode,ratio,max,min,frameMs}){
 if(normalizeQuality(mode)!=='auto')return ratio;
 const lower=Math.min(min,max);
 const next=frameMs>48?Math.max(lower,ratio*.9):frameMs<23?Math.min(max,ratio+.05):ratio;
 return Math.max(lower,Math.min(max,next));
}
