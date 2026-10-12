/** Explicit diagnostic target sizing. Production always uses live host dimensions. */
export function diagnosticDimensions({testResolution=null,testShadowResolution=null,testCompare=false}={}){
 const valid=d=>Array.isArray(d)&&d.length===2&&d.every(n=>Number.isInteger(n)&&n>=16);
 if(testResolution!==null&&!valid(testResolution))throw Error('Invalid diagnostic main dimensions');
 if(testShadowResolution!==null&&(!testResolution||!valid(testShadowResolution)))throw Error('Explicit diagnostic shadow dimensions require diagnostic mode');
 if(testCompare&&!testResolution)throw Error('ROI comparison requires explicit diagnostic mode');
 return{main:testResolution?.slice()??null,shadow:testResolution?(testShadowResolution||(testCompare?[96,64]:testResolution)).slice():null};
}
