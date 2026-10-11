/** ET18. Original deterministic curve-graph synthesis, not a scanned lip map.
 * Coordinates/depths are millimetres; the authored ranges are artistic, not
 * clinical measurements. Upper/lower graphs are independent and non-periodic.
 * Two signed height bands occupy R/G in a padded, mipmapped 1024x512 atlas.
 * See RESEARCH_ET18.md for inspirations, differences and license boundaries. */
export function buildLipAtlas({widthMM=50,upperMM=7,lowerMM=9,seed=37,density=1}={}){
 for(const v of [widthMM,upperMM,lowerMM,seed,density])if(!Number.isFinite(v))throw Error('Invalid lip atlas input');
 if(widthMM<=0||upperMM<=0||lowerMM<=0||density<.6||density>1.5)throw Error('Lip atlas range');
 const W=1024,H=512,half=256,bands=[new Float32Array(W*H),new Float32Array(W*H)];
 let state=(Math.round(seed)+1)>>>0,primary=0,branches=0,secondary=0;
 const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const mix=(a,b,t)=>a+(b-a)*t;
 for(let upper=0;upper<2;upper++){
  const span=upper?upperMM:lowerMM,px=W/widthMM,py=half*.88/span;
  // Continuous Gaussian cross-section and low, broad banks. Segment deposition
  // uses min/max, never additive stamps (which would make dots at sample points).
  function stroke(fn,v0,v1,width,depth,band){
   const values=bands[band],steps=Math.max(12,Math.ceil((v1-v0)*half*1.2));
   for(let i=0;i<=steps;i++){
    const t=i/steps,v=mix(v0,v1,t),x=fn(v,t),X=(x/widthMM+.5)*W,Y=(upper+.06+.88*v)*half;
    const taper=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.58),rad=width*2.8;
    const x0=Math.max(0,Math.floor(X-rad*px)),x1=Math.min(W-1,Math.ceil(X+rad*px)),y0=Math.max(upper*half,Math.floor(Y-rad*py)),y1=Math.min((upper+1)*half-1,Math.ceil(Y+rad*py));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const q=((x+.5-X)/px)**2+((y+.5-Y)/py)**2,d=q/(width*width),h=depth*taper*(-Math.exp(-d*1.7)+.105*Math.exp(-d*.22)),k=y*W+x;
     if(h<0)values[k]=Math.min(values[k],h);else if(values[k]>=0)values[k]=Math.max(values[k],h);
    }
   }
  }
  let root=-widthMM*.485;
  while(root<widthMM*.485){
   root+=(.52+1.25*rnd())/density;const x=root,phase=rnd()*6.283,bend=(rnd()-.5)*.9,fan=x/(widthMM*.5)*(.35+.55*rnd());
   const v0=.005+rnd()*.26,v1=Math.min(.99,v0+.34+rnd()*.62),w=.050+rnd()*.055,d=.023+rnd()*.045;
   const fn=v=>x+fan*(v-.3)+bend*Math.sin(v*3.9+phase)+.045*Math.sin(v*15.+phase);
   stroke(fn,v0,v1,w,d,0);primary++;
   const count=rnd()<.22?0:1+(rnd()>.55?1:0);
   for(let b=0;b<count;b++){
    const start=mix(v0,v1,.18+.5*rnd()),end=Math.min(.98,start+.10+.22*rnd()),side=rnd()<.5?-1:1,reach=side*(.17+.58*rnd()),origin=fn(start);
    stroke((v,t)=>mix(origin,fn(v)+reach,t*t*(3-2*t)),start,end,w*(.48+.28*rnd()),d*(.28+.27*rnd()),0);branches++;
   }
  }
  for(let j=0;j<Math.round(widthMM*2.4*density);j++){
   const x=(rnd()-.5)*widthMM*.96,a=.05+.78*rnd(),b=Math.min(.97,a+.065+.23*rnd()),reach=(rnd()-.5)*.9,phase=rnd()*6.283;
   stroke((v,t)=>x+reach*t+.04*Math.sin(phase+t*5),a,b,.026+.033*rnd(),.004+.010*rnd(),1);secondary++;
  }
 }
 const data=new Uint8Array(W*H*4);let min=0,max=0;
 for(let i=0;i<W*H;i++){
  data[i*4]=Math.max(0,Math.min(255,Math.round(128+bands[0][i]/.25*255)));
  data[i*4+1]=Math.max(0,Math.min(255,Math.round(128+bands[1][i]/.10*255)));
  data[i*4+2]=128;data[i*4+3]=255;min=Math.min(min,bands[0][i]+bands[1][i]);max=Math.max(max,bands[0][i]+bands[1][i]);
 }
 return {data,width:W,height:H,stats:{seed:Math.round(seed),density,primary,branches,secondary,minHeightMM:min,maxHeightMM:max,baseBytes:data.byteLength,estimatedMipBytes:Math.ceil(data.byteLength*4/3),source:'authored curve graph; no donor texture',periodicTiling:false}};
}
