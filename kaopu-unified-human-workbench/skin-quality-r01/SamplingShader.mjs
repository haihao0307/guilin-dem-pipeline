export function patchSkinSamplingShader(source){
 const replace=(a,b)=>{if(source.split(a).length!==2)throw new Error('Pinned ET13 sampling anchor is missing or ambiguous: '+a);source=source.replace(a,()=>b);};
 replace('uniform sampler2D uFAtlas,uFChroma;','uniform sampler2D uFAtlas,uFChroma;\nuniform highp sampler2DArray uSamplingAtlas,uSamplingChroma;\nuniform float uSamplingPoreFilter;\nvec2 fSamplingDX,fSamplingDY;');
 replace('vec3 fPatch(sampler2D tex,vec2 mm,float tile,vec2 span){return texture2D(tex,fAtlasUV(mm,tile,span)).rgb;}',`vec3 fPatch(highp sampler2DArray tex,vec2 mm,float tile,vec2 span){
  // Derivatives come from continuous rest millimetres BEFORE fract and the
  // region branches. Per-layer mip chains cannot mix nose/cheek/lip tiles.
  vec2 uv=(fract(mm/span)*252.+2.)/256.;
  vec2 dx=fSamplingDX/span*(252./256.),dy=fSamplingDY/span*(252./256.);
  return textureGrad(tex,vec3(uv,tile),dx,dy).rgb;
 }`);
 replace('fData=fBands(uFAtlas,fMM);fChroma=fBands(uFChroma,fMM);','fData=fBands(uSamplingAtlas,fMM);fChroma=fBands(uSamplingChroma,fMM);');
 replace('vec3 fBands(sampler2D tex,vec2 mm)','vec3 fBands(highp sampler2DArray tex,vec2 mm)');
 replace('vec2 fMM=vFRest.xy*1000.;float fMask=', 'vec2 fMM=vFRest.xy*1000.;fSamplingDX=dFdx(fMM);fSamplingDY=dFdy(fMM);float fMask=');
 replace('float fPores(vec2 mm){vec2 p=mm/.38;vec2 cell=floor(p),f=fract(p);float h=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=vec2(float(x),float(y)),r=fHash(cell+c),d=c+.2+.6*r-f;float angle=6.28*r.x;d=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;d*=vec2(1.35,.8+.35*r.y);float rr=dot(d,d);h+=(-exp(-rr*75.)+.2*exp(-rr*22.))*(.65+.5*r.x);}return h;}',`float fPoresOriginal(vec2 mm){vec2 p=mm/.38;vec2 cell=floor(p),f=fract(p);float h=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=vec2(float(x),float(y)),r=fHash(cell+c),d=c+.2+.6*r-f;float angle=6.28*r.x;d=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;d*=vec2(1.35,.8+.35*r.y);float rr=dot(d,d);h+=(-exp(-rr*75.)+.2*exp(-rr*22.))*(.65+.5*r.x);}return h;}
float fSamplingGaussian(vec2 d,float a,vec3 covariance){
 float xx=1.+2.*a*covariance.x,xy=2.*a*covariance.y,yy=1.+2.*a*covariance.z;
 float det=max(xx*yy-xy*xy,1.);
 return inversesqrt(det)*exp(-a*(yy*d.x*d.x-2.*xy*d.x*d.y+xx*d.y*d.y)/det);
}
float fPores(vec2 mm){
 if(uSamplingPoreFilter<.5)return fPoresOriginal(mm);
 if(max(length(fSamplingDX),length(fSamplingDY))>=.608)return 0.;
 vec2 p=mm/.38,cell=floor(p),f=fract(p),footDX=fSamplingDX/.38,footDY=fSamplingDY/.38;float h=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 c=vec2(float(x),float(y)),r=fHash(cell+c),d=c+.2+.6*r-f;float angle=6.28*r.x;
  mat2 rotation=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));vec2 shape=vec2(1.35,.8+.35*r.y);
  d=(rotation*d)*shape;vec2 dx=(rotation*footDX)*shape,dy=(rotation*footDY)*shape;
  // Match the covariance of a one-pixel box with an analytic Gaussian.
  // Each filtered kernel preserves its integrated height, not its peak height.
  vec3 covariance=vec3(dx.x*dx.x+dy.x*dy.x,dx.x*dx.y+dy.x*dy.y,dx.y*dx.y+dy.y*dy.y)/12.;
  h+=(-fSamplingGaussian(d,75.,covariance)+.2*fSamplingGaussian(d,22.,covariance))*(.65+.5*r.x);
 }
 return h;
}`);
 return source;
}
