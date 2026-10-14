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

/* SKIN-PAINT-R02. Original paint/surface rules; not a copied scan.
   Coordinates and relief scales are artistic engineering settings. */
window.KAOPU_PAINT_R02={
  declarations:`
uniform float uPaintAmount,uPaintChroma,uPaintBeard,uPaintFlush;
float p2Head=0.,p2Cheek=0.,p2Nose=0.,p2Lid=0.,p2Beard=0.,p2Ear=0.,p2Tint=0.;
vec3 p2Albedo=vec3(0.);
float p2G(vec3 p,vec3 c,vec3 radius){vec3 d=(vec3(abs(p.x),p.y,p.z)-c)/radius;return exp(-dot(d,d));}
vec3 p2Values(vec3 mm,vec3 weights,float tile){
 vec3 a=texture(uSSGField,vec3(mm.yz/tile+vec2(.173,.419),2.)).rgb;
 vec3 b=texture(uSSGField,vec3(mm.zx/tile+vec2(.531,.127),2.)).rgb;
 vec3 c=texture(uSSGField,vec3(mm.xy/tile+vec2(.283,.617),2.)).rgb;
 return a*weights.x+b*weights.y+c*weights.z;
}
`,
  colour:`
 // Replaces the uniform overwrite with region-dependent chromophore paint.
 vec3 p2P=vFRest,p2MM=vCSRest*1000.;
 p2Head=clamp(vFA.x,0.,1.);
 float p2Front=smoothstep(-.005,.038,p2P.z);
 p2Cheek=p2G(p2P,vec3(.043,.275,.054),vec3(.023,.020,.050))*p2Front*p2Head;
 p2Nose=clamp(rfNose,0.,1.)*p2Head;
 float p2Ala=p2G(p2P,vec3(.016,.271,.077),vec3(.012,.011,.035))*p2Front*p2Head;
 p2Lid=p2G(p2P,vec3(.030,.291,.061),vec3(.022,.006,.032))*p2Head*p2Front;
 float p2Socket=p2G(p2P,vec3(.031,.313,.061),vec3(.025,.011,.035))*p2Front*p2Head;
 float p2Forehead=clamp(rfForehead,0.,1.)*p2Head;
 float p2Temple=p2G(p2P,vec3(.067,.319,.015),vec3(.019,.029,.045))*p2Head;
 float p2Muzzle=p2G(p2P,vec3(.017,.245,.065),vec3(.038,.015,.035))*p2Front*p2Head;
 float p2Chin=p2G(p2P,vec3(.018,.213,.049),vec3(.043,.020,.043))*p2Front*p2Head;
 float p2Jaw=p2G(p2P,vec3(.058,.235,.018),vec3(.024,.034,.050))*p2Head;
 p2Beard=clamp(max(p2Muzzle*.86,p2Chin*.84)+p2Jaw*.6,0.,1.)*(1.-clamp(lpMask,0.,1.));
 p2Ear=clamp(eaM,0.,1.);
 // Stable 3-D material paint: low contrast irregularities, never world-space.
 vec3 p2N=normalize(cross(dFdx(vCSRest),dFdy(vCSRest))+vec3(1e-15));
 vec3 p2W=pow(abs(p2N),vec3(8.));p2W/=max(dot(p2W,vec3(1.)),1e-6);
 vec3 p2Fine=p2Values(p2MM,p2W,18.);
 vec3 p2Broad=p2Values(p2MM+vec3(4.,19.,7.),p2W,83.);
 float p2PaintGain=uPaintChroma*mix(.45,1.,p2Head);
 float p2Mel=clamp(uSDMel+p2PaintGain*((p2Fine.r-.5)*.18+(p2Broad.b-.5)*.042)+uSDVariation*(.018*p2Forehead+.014*p2Temple-.018*p2Cheek)-csPalm*.07,0.,.98);
 float p2Blood=clamp(uSDBlood+uSDVariation*(.19*p2Cheek+.13*p2Nose+.20*p2Ala+.24*p2Lid+.12*p2Ear-.055*p2Forehead)+uPaintFlush*(.06+.32*p2Cheek+.10*p2Nose)+p2PaintGain*(p2Fine.g-.5)*.095,0.,1.);
 p2Albedo=sdBio(vec2(p2Mel,p2Blood));
 // Subtle observed warm/cool separation; no lighting or occlusion baked in.
 p2Albedo*=mix(vec3(1.),vec3(.955,1.018,1.13),uSDVariation*.45*(p2Lid*.9+p2Socket*.4+p2Temple*.2));
 p2Albedo*=mix(vec3(1.),vec3(1.025,1.01,.985),p2Forehead*uSDVariation*.45);
 p2Albedo*=1.+(p2Fine.b-.5)*.23*p2PaintGain;
 p2Albedo*=mix(vec3(1.),vec3(1.045,.875,.905),clamp((p2Cheek*.80+p2Ala*.62+p2Nose*.18)*uSDVariation,0.,.92));
 p2Albedo*=mix(vec3(1.),vec3(1.018,.875,.96),clamp(p2Lid*uSDVariation*.66,0.,.8));
 // Beard undertone is independent of the pore geometry and skin identity.
 p2Albedo*=mix(vec3(1.),vec3(.65,.74,.82),p2Beard*uPaintBeard*.42);
 float p2Root=pow(clamp(texture(uSSGField,vec3(p2MM.xy/16.+vec2(.283,.617),1.)).b,0.,1.),3.);
 p2Albedo*=1.-p2Root*p2Beard*uPaintBeard*.30;
 p2Albedo*=mix(vec3(1.),vec3(1.025,.925,.94),p2Ear*uSDVariation*.65);
 float p2Lip=clamp(lpMask,0.,1.);
 vec3 p2LipBase=sdBio(vec2(clamp(uSDMel*.70+.03,0.,1.),clamp(.64+uPaintFlush*.14,0.,1.)))*vec3(.89,.77,.87);
 // Keep specialist lip micro-relief and all geometry; only retarget its pigment.
 float p2LipDetail=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/max(dot(p2LipBase,vec3(.2126,.7152,.0722)),.035),.68,1.2);
 vec3 p2Paint=mix(p2Albedo,p2LipBase*mix(1.,p2LipDetail,.30),p2Lip);
 diffuseColor.rgb=mix(diffuseColor.rgb,p2Paint,sdCover*uPaintAmount);
 p2Tint=clamp(.4*p2Cheek+.4*p2Lid+.3*p2Ala+.3*p2Ear,0.,1.);
`,
  surface:`
 // The skin is not uniformly matte: oil is localized and broken by relief.
 float p2Oil=clamp(uSDOil*(.26+.65*rfNose+.48*rfForehead+.34*p2Chin),0.,1.);
 float p2PoreRough=ssgPoreField*.085+ssgLineField*.027;
 float p2Rough=clamp(.435+.15*(1.-uSDHydration)-.27*p2Oil+.044*rfCheek+.05*rfThin+p2PoreRough,.235,.74);
 roughnessFactor=mix(roughnessFactor,p2Rough,ssgMask*uPaintAmount);
 cLobeWeight=mix(cLobeWeight,.065+.19*p2Oil,ssgMask*uPaintAmount);
`,
  packColour(packed){
    const N=packed.width,size=N*N,out=new Uint8Array(size*12);out.set(packed.data);
    const rand=(seed)=>{let s=seed>>>0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};};
    const rnd=rand(packed.report.seed^0x3478fa);
    // Broad and fine organization are separate continuous value fields.
    const resolutions=[7,19,43,89,181];
    const grids=resolutions.map(n=>({n,data:Float32Array.from({length:n*n*3},()=>rnd())}));
    const interp=(g,x,y,c)=>{let xx=x/N*g.n,yy=y/N*g.n,i=Math.floor(xx),j=Math.floor(yy),u=xx-i,v=yy-j;u=u*u*(3-2*u);v=v*v*(3-2*v);const at=(a,b)=>g.data[((b%g.n)*g.n+(a%g.n))*3+c];return(at(i,j)*(1-u)+at(i+1,j)*u)*(1-v)+(at(i,j+1)*(1-u)+at(i+1,j+1)*u)*v;};
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const off=size*8+(y*N+x)*4;
      for(let c=0;c<3;c++){let v=0;const weights=c===0?[.22,.28,.30,.14,.06]:c===1?[.16,.34,.30,.15,.05]:[.05,.13,.24,.32,.26];for(let k=0;k<5;k++)v+=interp(grids[k],x,y,c)*weights[k];out[off+c]=Math.round(Math.max(0,Math.min(1,v))*255);}
      out[off+3]=255;
    }
    let h=2166136261;for(const v of out)h=Math.imul(h^v,16777619);
    return{...packed,data:out,layers:3,report:{...packed.report,paintLayers:1,textureLayers:3,textureBytes:out.byteLength,mipBytesEstimate:out.byteLength*4/3,paintFingerprint:(h>>>0).toString(16),colourSource:'own anatomically masked continuous pigment/blood fields; no source pixels',physiologicallyCalibrated:false}};
  }
};
