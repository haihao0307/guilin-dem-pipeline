/* SSG-01 kernel 2: one two-layer texture-array sampler, chain-rule bump
   transport. Derivatives are generated BEFORE filtering. No external pixels. */
window.KAOPU_SSG_KERNEL={
 version:'ssg-slope-array-v2',
 pack(result){
  const start=performance.now(),{data:height,width:N,height:H}=result,size=N*H,out=new Uint8Array(size*8),perMM=N/16;
  const at=(x,y,c)=>height[(((y+H)%H)*N+(x+N)%N)*4+c]/255;
  const enc=(v,range)=>Math.max(1,Math.min(255,Math.round(128+127*v/range)));
  let maxP=0,maxL=0,maxG=0;
  for(let y=0;y<H;y++)for(let x=0;x<N;x++){
   const i=y*N+x,k=i*4,kk=size*4+k;
   const px=(at(x+1,y,0)-at(x-1,y,0))*.5*perMM,py=(at(x,y+1,0)-at(x,y-1,0))*.5*perMM;
   const lx=(at(x+1,y,1)-at(x-1,y,1))*.5*perMM,ly=(at(x,y+1,1)-at(x,y-1,1))*.5*perMM;
   const gx=(at(x+1,y,2)-at(x-1,y,2))*.5*perMM,gy=(at(x,y+1,2)-at(x,y-1,2))*.5*perMM;
   out[k]=enc(px,24);out[k+1]=enc(py,24);out[k+2]=enc(lx,48);out[k+3]=enc(ly,48);
   out[kk]=enc(gx,4);out[kk+1]=enc(gy,4);out[kk+2]=height[k];out[kk+3]=height[k+1];
   maxP=Math.max(maxP,Math.abs(px),Math.abs(py));maxL=Math.max(maxL,Math.abs(lx),Math.abs(ly));maxG=Math.max(maxG,Math.abs(gx),Math.abs(gy));
  }
  let h=2166136261;for(const x of out)h=Math.imul(h^x,16777619);
  return {...result,data:out,layers:2,report:{...result.report,kernel:'ssg-slope-array-v2',heightFingerprint:result.report.fingerprint,fingerprint:(h>>>0).toString(16).padStart(8,'0'),textureBytes:out.byteLength,mipBytesEstimate:out.byteLength*4/3,textureLayers:2,gradientRanges:{pore:24,line:48,grain:4},measuredGradientMax:[maxP,maxL,maxG],heightDerivativeBeforeFiltering:true,packingMS:performance.now()-start}};
 },
 declarations:`
uniform highp sampler2DArray uSSGField;
uniform float uSSGOn,uSSGPore,uSSGWidth,uSSGMicro,uSSGGrain;
float ssgMask=0.,ssgHeight=0.,ssgFootprint=0.;
vec4 ssgSurface(vec2 uv,vec3 amplitude){
 vec4 a=texture(uSSGField,vec3(uv,0.)),b=texture(uSSGField,vec3(uv,1.));
 vec4 g=(a*255.-128.)/127.;vec2 grain=(b.rg*255.-128.)/127.;
 float exponent=1./max(uSSGWidth*uSSGWidth,.25);
 float widthGain=clamp(exponent*pow(max(b.b,.00392),exponent-1.),.15,4.);
 vec2 slope=-g.xy*24.*amplitude.x*widthGain-g.zw*48.*amplitude.y+grain*4.*amplitude.z;
 return vec4(slope,b.b,b.a);
}
`,
 surface:`
 ssgMask=sdSkin*uSSGOn;
 vec3 ssgP=vCSRest*1000.;
 vec3 ssgRestN=normalize(cross(dFdx(vCSRest),dFdy(vCSRest))+vec3(1e-15));
 vec3 ssgW=pow(abs(ssgRestN),vec3(6.));ssgW/=max(dot(ssgW,vec3(1.)),1e-8);
 ssgFootprint=max(length(dFdx(ssgP)),length(dFdy(ssgP)));
 float ssgThin=clamp(rfThin,0.,1.);
 float ssgRegion=mix(.52,1.,clamp(vFA.x,0.,1.))*mix(1.,.22,clamp(csPalm,0.,1.))*mix(1.,.34,ssgThin);
 vec3 ssgAmplitude=vec3(.014*(.75+.55*rfNose+.15*rfCheek)*uSSGPore,.0055*uSSGMicro*(1.-.36*rfNose),.0025*uSSGGrain)*ssgRegion;
 vec4 sx=ssgSurface(ssgP.yz/16.+vec2(.173,.419),ssgAmplitude);
 vec4 sy=ssgSurface(ssgP.zx/16.+vec2(.531,.127),ssgAmplitude);
 vec4 sz=ssgSurface(ssgP.xy/16.+vec2(.283,.617),ssgAmplitude);
 vec3 ssgGrad=vec3(0.,sx.x,sx.y)*ssgW.x+vec3(sy.y,0.,sy.x)*ssgW.y+vec3(sz.x,sz.y,0.)*ssgW.z;
 float ssgPoreField=dot(vec3(sx.z,sy.z,sz.z),ssgW),ssgLineField=dot(vec3(sx.w,sy.w,sz.w),ssgW);
 // Gradient is mm/mm; rest metre derivatives match view-space metre lengths.
 vec2 ssgDH=vec2(dot(ssgGrad,dFdx(vCSRest)),dot(ssgGrad,dFdy(vCSRest)));
 normal=normalize(mix(normal,nonPerturbedNormal,ssgMask));
 vec3 ssgDX=dFdx(-vViewPosition),ssgDY=dFdy(-vViewPosition),ssgR1=cross(ssgDY,normal),ssgR2=cross(normal,ssgDX);
 float ssgDet=dot(ssgDX,ssgR1);
 vec3 ssgSlope=sign(ssgDet)*(ssgDH.x*ssgR1+ssgDH.y*ssgR2)/max(abs(ssgDet),1e-14);
 ssgSlope*=min(1.,.30/max(length(ssgSlope),.0001));normal=normalize(normal-ssgSlope*ssgMask);
 float ssgUnresolved=1.-exp(-ssgFootprint*ssgFootprint/.012);
 float ssgOil=clamp(uSDOil*(.25+.75*csT),0.,1.);
 float ssgRough=clamp(.535+(1.-uSDHydration)*.08-ssgOil*.19+.025*rfCheek+.018*ssgThin+ssgLineField*.04+ssgUnresolved*(.012*uSSGPore+.014*uSSGMicro),.31,.77);
 roughnessFactor=mix(roughnessFactor,ssgRough,ssgMask);cLobeWeight=mix(cLobeWeight,.04+.08*ssgOil,ssgMask);
 // No added pigment speckles, age creases or changed body vertices.
`
};
