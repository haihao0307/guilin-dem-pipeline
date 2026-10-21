/** Evaluation scheduling only: no geometry LOD, mesh, voxel or source patch omission. */
export function qualityTiles(width,height,{samplesPerAxis=2,tileSide=64,maxOutputPixels=560280,maxOutputSide=840}={}){
 if(![width,height,samplesPerAxis,tileSide].every(Number.isSafeInteger)||width<1||height<1||![1,2].includes(samplesPerAxis)||tileSide<8||tileSide>128)throw new RangeError('Invalid bounded quality sampling request');
 if(width>maxOutputSide||height>maxOutputSide||width*height>maxOutputPixels)throw new RangeError('Quality output exceeds two-axis or total pixel budget');
 const traceWidth=width*samplesPerAxis,traceHeight=height*samplesPerAxis,tiles=[];
 for(let y=0;y<traceHeight;y+=tileSide)for(let x=0;x<traceWidth;x+=tileSide)tiles.push({x,y,width:Math.min(tileSide,traceWidth-x),height:Math.min(tileSide,traceHeight-y)});
 return {width,height,samplesPerAxis,traceWidth,traceHeight,outputPixels:width*height,tracedPixels:traceWidth*traceHeight,maximumRayPixelsPerDispatch:tileSide*tileSide,colorTargetBytes:traceWidth*traceHeight*4,tiles,interpretation:'2×2 true subpixel rays when samplesPerAxis=2; bounded scissored full-screen passes; no lower-detail geometry'};
}

/** Sampling accounting only; never changes model, material or requested target. */
export function samplingScale(bufferWidth,bufferHeight,displayWidth,displayHeight,dpr=1){
 if(![bufferWidth,bufferHeight,displayWidth,displayHeight,dpr].every(x=>Number.isFinite(x)&&x>0))throw RangeError('Positive sampling dimensions required');
 return {bufferWidth,bufferHeight,displayWidth,displayHeight,dpr,sourcePixelsPerCSSPixel:[bufferWidth/displayWidth,bufferHeight/displayHeight],sourcePixelsPerDevicePixel:[bufferWidth/(displayWidth*dpr),bufferHeight/(displayHeight*dpr)],upscaled:bufferWidth<displayWidth*dpr-.01||bufferHeight<displayHeight*dpr-.01};
}
