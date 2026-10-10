import assert from 'node:assert/strict';
// Independent double-precision reference for the original analytic Gaussian
// convolution. This tests filtering, not physiological accuracy of pore shape.
const gaussian=(x,y,a)=>Math.exp(-a*(x*x+y*y));
function filtered(x,y,a,c){const xx=1+2*a*c[0],xy=2*a*c[1],yy=1+2*a*c[2],det=xx*yy-xy*xy;return Math.exp(-a*(yy*x*x-2*xy*x*y+xx*y*y)/det)/Math.sqrt(det);}
for(const a of [22,75])for(const [x,y]of [[0,0],[.01,.12],[.31,-.21]])assert(Math.abs(filtered(x,y,a,[0,0,0])-gaussian(x,y,a))<1e-15);
const results=[];
for(const footprint of [.05,.2,.5]){
 let oldError=0,newError=0,count=0;const variance=footprint*footprint/12,N=32;
 for(let iy=-10;iy<=10;iy++)for(let ix=-10;ix<=10;ix++){
  const x=ix/20,y=iy/20;let truth=0;
  for(let sy=0;sy<N;sy++)for(let sx=0;sx<N;sx++)truth+=gaussian(x+((sx+.5)/N-.5)*footprint,y+((sy+.5)/N-.5)*footprint,75);
  truth/=N*N;oldError+=(gaussian(x,y,75)-truth)**2;newError+=(filtered(x,y,75,[variance,0,variance])-truth)**2;count++;
 }
 const before=Math.sqrt(oldError/count),after=Math.sqrt(newError/count);assert(after<before*.5);results.push({pixelWidthMM:footprint*.38,pointSampleRMSE:before,filteredRMSE:after,errorReduction:1-after/before});
}
// Numerical area conservation for an anisotropic rotated pixel covariance.
let area=0;const step=.002,c=[.002,.001,.004],a=75;
for(let iy=-600;iy<=600;iy++)for(let ix=-600;ix<=600;ix++)area+=filtered(ix*step,iy*step,a,c)*step*step;
assert(Math.abs(area-Math.PI/a)<1e-8);
console.log(JSON.stringify({passed:true,scope:'Gaussian approximation to a pixel-box filter; independent supersampled reference; no BRDF energy-conservation claim',results,area,expectedArea:Math.PI/a},null,2));
