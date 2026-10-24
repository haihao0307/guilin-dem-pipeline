/** One fixed sampling grid for both gesture and rest. Pixel density is bounded
 * explicitly; this never changes model geometry or silently falls to 128px. */
export function chooseSampling({availableWidth,availableHeight,devicePixelRatio=1,maxCssWidth=640,maxDpr=1.5,maxPixels=550000}={}){
 for(const v of [availableWidth,availableHeight,devicePixelRatio,maxCssWidth,maxDpr,maxPixels])if(!Number.isFinite(v)||v<=0)throw Error('Positive finite viewport and sampling bounds required');
 const aspect=.85,cssWidth=Math.max(1,Math.min(maxCssWidth,availableWidth,availableHeight/aspect));
 const desiredDpr=Math.max(1,Math.min(devicePixelRatio,maxDpr));
 const width=Math.max(1,Math.floor(Math.min(cssWidth*desiredDpr,Math.sqrt(maxPixels/aspect))));
 const height=Math.max(1,Math.floor(width*aspect));
 return Object.freeze({width,height,cssWidth,cssHeight:cssWidth*aspect,devicePixelRatio,effectiveDpr:width/cssWidth,maxPixels,gestureWidth:width,settledWidth:width,geometryLod:false});
}
