/** Shared host rule: one opening belongs to one wall segment. Width/height,
 * wall thickness and sill drive the hole and its frame, never an unattached box.
 * Values are explicit case assumptions, not a building-code claim. */
export function hostOpening({a,b,center,width,height,sill=0,wallThickness,clampForInspection=false}){
 if([width,height,wallThickness].some(v=>!Number.isFinite(v)||v<=0)||!Number.isFinite(sill)||sill<0)throw Error('Invalid hosted opening dimensions');
 const dx=b[0]-a[0],dz=b[1]-a[1],span=Math.hypot(dx,dz);if(!(span>width))throw Error('Opening wider than host');const axis=[dx/span,dz/span],raw=(center[0]-a[0])*axis[0]+(center[1]-a[1])*axis[1];
 const at=clampForInspection?Math.max(width/2+.02,Math.min(span-width/2-.02,raw)):raw;
 if(at-width/2<-.00001||at+width/2>span+.00001)throw Error('Opening crosses host boundary');
 return {span,axis,at,left:at-width/2,right:at+width/2,bottom:sill,top:sill+height,width,height,wallThickness,frameDepth:wallThickness,center:[a[0]+axis[0]*at,a[1]+axis[1]*at],placementClamped:Math.abs(at-raw)>1e-8};
}
