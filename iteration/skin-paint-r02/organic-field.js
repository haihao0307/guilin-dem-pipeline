/* SSG-PAINT R02: own periodic inhibition sampling. No scan pixels.
   A bounded artistic process, not a tissue measurement or Disney solver. */
window.KAOPU_ORGANIC_FIELD=function(seed,N=1024){
 const t=performance.now();let state=(seed^0x213fad)>>>0;const rnd=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
 const span=16,scale=N/span,min=.29,cells=55,buckets=Array.from({length:cells*cells},()=>[]),pts=[];
 const wrap=(v,n)=>(v%n+n)%n,grid=(x,y)=>buckets[wrap(y,cells)*cells+wrap(x,cells)];
 for(let tries=0;pts.length<810&&tries<20000;tries++){
  const x=rnd()*span,y=rnd()*span,gx=Math.floor(x/span*cells),gy=Math.floor(y/span*cells);let valid=true;
  for(let j=-2;j<=2&&valid;j++)for(let i=-2;i<=2&&valid;i++)for(const id of grid(gx+i,gy+j)){const p=pts[id];let dx=Math.abs(p.x-x),dy=Math.abs(p.y-y);dx=Math.min(dx,span-dx);dy=Math.min(dy,span-dy);if(dx*dx+dy*dy<min*min){valid=false;break;}}
  if(!valid)continue;const p={x,y,r:Math.max(.035,Math.min(.135,.070*Math.exp((rnd()-.5)*1.55))),depth:.15+Math.pow(rnd(),2)*.77,aspect:.62+rnd()*.80,angle:rnd()*Math.PI};grid(gx,gy).push(pts.length);pts.push(p);
 }
 const pore=new Float32Array(N*N),line=new Float32Array(N*N),grain=new Float32Array(N*N),at=(x,y)=>wrap(y,N)*N+wrap(x,N);
 for(const p of pts){const cx=p.x*scale,cy=p.y*scale,rx=p.r*scale,ry=rx*p.aspect,R=Math.ceil(Math.max(rx,ry)*2.8),c=Math.cos(p.angle),s=Math.sin(p.angle);for(let yy=Math.floor(cy)-R;yy<cy+R;yy++)for(let xx=Math.floor(cx)-R;xx<cx+R;xx++){const dx=xx-cx,dy=yy-cy,d=((dx*c+dy*s)/rx)**2+((-dx*s+dy*c)/ry)**2;if(d>7)continue;const k=at(xx,yy);pore[k]=Math.max(pore[k],Math.exp(-d)*p.depth);}}
 let edges=0;const used=new Set();
 function segment(a,b){const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy),samples=Math.max(2,Math.ceil(l*scale/1.6)),width=(.009+rnd()*.014)*scale,depth=.08+rnd()*.31,bend=(rnd()-.5)*.18,R=Math.ceil(width*2.6);for(let i=0;i<=samples;i++){const u=i/samples,taper=Math.sin(u*Math.PI)**.8,cx=(a.x+dx*u-dy/l*bend*Math.sin(u*Math.PI))*scale,cy=(a.y+dy*u+dx/l*bend*Math.sin(u*Math.PI))*scale;for(let y=Math.floor(cy)-R;y<=cy+R;y++)for(let x=Math.floor(cx)-R;x<=cx+R;x++){const d=((x-cx)**2+(y-cy)**2)/(width*width);if(d>6.5)continue;const k=at(x,y);line[k]=Math.max(line[k],Math.exp(-d)*depth*taper);}}}
 for(let id=0;id<pts.length;id++){const a=pts[id],gx=Math.floor(a.x/span*cells),gy=Math.floor(a.y/span*cells),near=[];for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)for(const k of grid(gx+x,gy+y)){if(k===id)continue;const b=pts[k];let dx=b.x-a.x,dy=b.y-a.y;if(dx>span/2)dx-=span;if(dx<-span/2)dx+=span;if(dy>span/2)dy-=span;if(dy<-span/2)dy+=span;const d=Math.hypot(dx,dy);if(d<.82)near.push({k,x:a.x+dx,y:a.y+dy,d});}near.sort((a,b)=>a.d-b.d);for(const b of near.slice(0,2)){const key=[id,b.k].sort((a,b)=>a-b).join('/');if(used.has(key)||rnd()>.66)continue;used.add(key);segment(a,b);edges++;}}
 const levels=[20,53,113],grids=levels.map(n=>({n,v:Float32Array.from({length:n*n},()=>rnd())}));
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){let v=0;for(let k=0;k<3;k++){const g=grids[k],gx=x/N*g.n,gy=y/N*g.n,ix=Math.floor(gx),iy=Math.floor(gy);let u=gx-ix,w=gy-iy;u=u*u*(3-2*u);w=w*w*(3-2*w);const f=(i,j)=>g.v[wrap(j,g.n)*g.n+wrap(i,g.n)];v+=((f(ix,iy)*(1-u)+f(ix+1,iy)*u)*(1-w)+(f(ix,iy+1)*(1-u)+f(ix+1,iy+1)*u)*w)*[.45,.35,.20][k];}grain[y*N+x]=v;}
 const data=new Uint8Array(N*N*4);let sumP=0,sumL=0;for(let i=0;i<N*N;i++){data[i*4]=Math.round(pore[i]*255);data[i*4+1]=Math.round(line[i]*255);data[i*4+2]=Math.round(grain[i]*255);data[i*4+3]=255;sumP+=pore[i];sumL+=line[i];}
 let h=2166136261;for(const v of data)h=Math.imul(h^v,16777619);
 return{data,width:N,height:N,report:{algorithm:'periodic inhibited pores, variable ellipse/depth and sparse curved micro-lines',seed,nodes:pts.length,edges,spanMM:span,meanPore:sumP/(N*N),meanLine:sumL/(N*N),fingerprint:(h>>>0).toString(16),generationMS:performance.now()-t,measuredTissue:false,sourcePixelsCopied:false,fullDisneySolver:false,squareGridPlacement:false}};
};
