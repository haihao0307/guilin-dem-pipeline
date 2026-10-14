import FIT from './ReferenceEnvironmentFit.json';
// Fit-derived radiance coefficients, reconstructed by a small periodic function.
// No HDR or photographic environment file is fetched by the application.
export function environmentPixels(w=512,h=256){
 const data=new Float32Array(w*h*4),W=FIT.width,H=FIT.height;
 const get=(x,y)=>FIT.coefficients[Math.max(0,Math.min(H-1,y))*W+(x%W+W)%W];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w*W-.5,v=(1-(y+.5)/h)*H-.5,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
  const a=get(ix,iy),b=get(ix+1,iy),c=get(ix,iy+1),d=get(ix+1,iy+1),j=(y*w+x)*4;
  for(let k=0;k<3;k++)data[j+k]=(a[k]*(1-fx)+b[k]*fx)*(1-fy)+(c[k]*(1-fx)+d[k]*fx)*fy;
  data[j+3]=1;
 }
 return data;
}
