// Sampling/allocation limits only. These limits do not change the field and do
// not constitute a claim that a particular device can render this workload.
export const PIXEL_BUDGETS = Object.freeze({
 conservative: Object.freeze({maxWidth:160,maxHeight:160,maxPixels:17920}),
 medium: Object.freeze({maxWidth:320,maxHeight:320,maxPixels:71680}),
 high: Object.freeze({maxWidth:840,maxHeight:840,maxPixels:560280})
});

function checkedBudget(budget){
 if(!budget||!['maxWidth','maxHeight','maxPixels'].every(key=>Number.isSafeInteger(budget[key])&&budget[key]>=1))throw new RangeError('Pixel budget requires positive safe integer width, height, and total pixel limits');
 return budget;
}

export function boundedResolution(width,height,budget=PIXEL_BUDGETS.conservative){
 const {maxWidth,maxHeight,maxPixels}=checkedBudget(budget);
 if(![width,height].every(value=>Number.isFinite(value)&&value>=1))throw new RangeError('Viewport dimensions must be finite and at least one pixel');
 // Dividing before multiplying avoids overflow for very large finite inputs.
 // Normalizing the long edge also avoids underflow in the area scale factor.
 const longest=Math.max(width,height),ratioW=width/longest,ratioH=height/longest;
 const longLimit=Math.min(longest,maxWidth/ratioW,maxHeight/ratioH,Math.sqrt(maxPixels/ratioW/ratioH));
 let w=Math.max(1,Math.floor(ratioW*longLimit)),h=Math.max(1,Math.floor(ratioH*longLimit));
 w=Math.min(w,maxWidth);h=Math.min(h,maxHeight);
 // At extreme ratios, clamping the short edge to one pixel can exceed the
 // area cap. Cap the long edge too, rather than allocating outside the budget.
 if(w>Math.floor(maxPixels/h)){
  if(w>=h)w=Math.max(1,Math.floor(maxPixels/h));
  else h=Math.max(1,Math.floor(maxPixels/w));
 }
 return {width:w,height:h};
}

export function validateExplicitResolution(width,height,budget=PIXEL_BUDGETS.high){
 const {maxWidth,maxHeight,maxPixels}=checkedBudget(budget);
 if(![width,height].every(value=>Number.isSafeInteger(value)&&value>=1))throw new RangeError('Explicit resolution requires positive safe integer dimensions');
 if(width>maxWidth||height>maxHeight||width>Math.floor(maxPixels/height))throw new RangeError(`Explicit resolution ${width} × ${height} exceeds the ${maxWidth} × ${maxHeight}, ${maxPixels}-pixel budget`);
 // Explicit requests are either honored exactly or rejected, never silently
 // rounded/downscaled and then reported as the originally requested size.
 return {width,height};
}
