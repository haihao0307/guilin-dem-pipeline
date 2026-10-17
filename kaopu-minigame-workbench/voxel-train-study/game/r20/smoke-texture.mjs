import * as THREE from '../../vendor/three.module.js';
// The exact approved three-frequency density texture, shared by both smoke renderers.
export function makeSmokeTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),data=ctx.createImageData(128,128);
  const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+41.3)*43758.5453;return n-Math.floor(n);};
  const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;};
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const dx=(x-63.5)/61,dy=(y-63.5)/61,r=Math.hypot(dx,dy),n=.52*noise(x/17,y/17)+.29*noise(x/8,y/8)+.19*noise(x/3.4,y/3.4);
    const density=Math.max(0,Math.min(1,(.89-r+(n-.46)*.78)*3.6)),edge=Math.max(0,Math.min(1,(1.04-r)*9));
    const light=.72+.24*Math.sqrt(Math.max(0,1-r*r))-.10*dy+.035*(n-.5),i=(y*128+x)*4;
    data.data[i]=Math.min(255,249*light);data.data[i+1]=Math.min(255,253*light);data.data[i+2]=Math.min(255,255*light);data.data[i+3]=Math.round(255*density*edge*.78);
  }
  ctx.putImageData(data,0,0);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
