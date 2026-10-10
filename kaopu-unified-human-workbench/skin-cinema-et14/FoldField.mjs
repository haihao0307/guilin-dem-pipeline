import * as THREE from '../full/source/registration-vendor/three.module.js';
import {paintTraitMaps} from '../identity-lab/TraitMaps.mjs';
import {foldedProfile} from './Schema.mjs';
const W=2048,H=2560,S=W/180,MAX_MM=1.5;
const WRINKLES=['forehead','frown','crowsFeet','underEye','nasolabial','lipLines'];
export function classifyPath(p){
 const mid=p[Math.floor(p.length/2)],x=Math.abs(mid[0]),y=mid[1];
 if(y>333)return 'forehead';if(y>308&&x<16)return 'frown';
 if(y>290&&x>47)return 'crowsFeet';if(y>276)return 'underEye';
 if(y<250&&x<23)return 'lipLines';return 'nasolabial';
}
function addPath(field,path,sigma,amplitude){
 if(!amplitude)return;const points=path.map(([x,y])=>[(x+90)*S,(y-180)*S]);
 const radius=Math.ceil(sigma*S*4.7)+2;
 const minX=Math.max(0,Math.floor(Math.min(...points.map(p=>p[0]))-radius)),maxX=Math.min(W-1,Math.ceil(Math.max(...points.map(p=>p[0]))+radius));
 const minY=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1]))-radius)),maxY=Math.min(H-1,Math.ceil(Math.max(...points.map(p=>p[1]))+radius));
 const width=maxX-minX+1,height=maxY-minY+1;if(width<=0||height<=0)return;
 const nearest=new Float32Array(width*height).fill(Infinity),along=new Float32Array(nearest.length);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<1e-12)continue;
  const x0=Math.max(minX,Math.floor(Math.min(a[0],b[0])-radius)),x1=Math.min(maxX,Math.ceil(Math.max(a[0],b[0])+radius));
  const y0=Math.max(minY,Math.floor(Math.min(a[1],b[1])-radius)),y1=Math.min(maxY,Math.ceil(Math.max(a[1],b[1])+radius));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const t=Math.max(0,Math.min(1,((x+.5-a[0])*dx+(y+.5-a[1])*dy)/l2)),d2=(x+.5-a[0]-t*dx)**2+(y+.5-a[1]-t*dy)**2,k=(y-minY)*width+x-minX;
   if(d2<nearest[k]){nearest[k]=d2;along[k]=(i-1+t)/(points.length-1);}
  }
 }
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  const k=(y-minY)*width+x-minX;if(!Number.isFinite(nearest[k]))continue;
  const t=along[k],taper=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.65),variation=.86+.1*Math.sin(t*11+path[0][0])+.04*Math.sin(t*29+path[0][1]);
  // Covariance of a pixel box, approximated by a Gaussian. Analytic convolution
  // of the second Gaussian derivative preserves its zero integral.
  const localSigma=sigma*(.82+.18*taper),filtered=Math.sqrt(localSigma*localSigma+1/(12*S*S));
  field[y*W+x]+=foldedProfile(Math.sqrt(nearest[k])/S,filtered,amplitude*taper*variation*(localSigma/filtered)**3);
 }
}
export function buildFoldField(identity,settings){
 const started=performance.now(),s=identity.traits;
 // Do not stack new folds over old grooves. Only the old wrinkle HEIGHT channels
 // are removed; freckles, lesions, scar height, seed, and pigment remain native.
 const noWrinkles={...s};for(const key of WRINKLES)noWrinkles[key]=0;
 const base=paintTraitMaps(noWrinkles);base.color.dispose();
 const field=new Float32Array(W*H),counts={};
 const stretch=settings.compression<0?1+settings.compression*.34:1+settings.compression*.58;
 for(const path of identity.maps.marks.wrinklePaths){
  const kind=classifyPath(path),amount=s[kind]||0;counts[kind]=(counts[kind]||0)+1;
  const regionScale={forehead:1,frown:.8,crowsFeet:.55,underEye:.40,nasolabial:1.7,lipLines:.38}[kind];
  const sigma=Math.max(.075,s.wrinkleWidth*regionScale*.55*settings.foldSpread*stretch);
  addPath(field,path,sigma,s.wrinkleDepth*amount*.48/stretch);
 }
 const bytes=new Uint8Array(W*H*4);let low=0,high=0,sum=0,clipped=0;
 for(let i=0;i<field.length;i++){
  const h=field[i];low=Math.min(low,h);high=Math.max(high,h);sum+=h;if(Math.abs(h)>MAX_MM)clipped++;
  const q=Math.round((Math.max(-MAX_MM,Math.min(MAX_MM,h))/MAX_MM*.5+.5)*65535),k=i*4;bytes[k]=q>>8;bytes[k+1]=q&255;bytes[k+2]=128;bytes[k+3]=255;
 }
 const texture=new THREE.DataTexture(bytes,W,H,THREE.RGBAFormat);texture.colorSpace=THREE.NoColorSpace;texture.flipY=false;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.needsUpdate=true;
 // Decoding is affine, so packed channel interpolation and mip averaging remain
 // valid. Remove the tiny encoded-zero offset (32768), not an arbitrary bias.
 return {texture,baseHeight:base.height,report:{size:[W,H],precision:'16-bit signed packed linear',minMM:low,maxMM:high,signedSumMM:sum,clippedPixels:clipped,paths:identity.maps.marks.wrinklePaths.length,groups:counts,manualStretch:stretch,buildMS:performance.now()-started,extraTextureBytes:W*H*4+1024*1280*4,geometryDisplacement:false},dispose(){texture.dispose();base.height.dispose();}};
}
