// Millimetres. The centre curve, finite-difference frame, radius modulation
// and noncircular section follow the preserved P02 C2 source, not loop impostors.
uniform vec3 uCoefficients[40];
uniform vec3 uBoundsLow[10],uBoundsHigh[10];
uniform float uPitch,uRadius,uTwist,uFuzz,uMillimetresPerPixel;
uniform ivec2 uGrid;
uniform int uDesign,uDebug;
uniform vec3 uBaseDye,uInkDye;
uniform vec3 uKeyDirection,uRimDirection,uKeyEnergy,uRimEnergy,uEnvironmentDirection[8],uEnvironmentEnergy[8];
const float TAU=6.28318530718;
float p02Hash(int x){uint n=(uint(x)^4291u)*73244475u;n=(n^(n>>16u))*73244475u;return float(n^(n>>16u))/4294967296.;}
float p02Phase(float t,float lane){uint n=(uint(int(floor(t)+lane*4099.))^4291u)*73244475u;n=(n^(n>>16u))*73244475u;return float(n^(n>>16u))/4294967296.*TAU;}
vec3 p02Curve(float t){float v=fract(t)*10.;int i=min(9,int(floor(v)));float x=v-float(i);return ((uCoefficients[i*4+3]*x+uCoefficients[i*4+2])*x+uCoefficients[i*4+1])*x+uCoefficients[i*4];}
vec3 centre(float t,float lane){vec3 q=p02Curve(t);return vec3(floor(t)+q.x+.5,lane*.5+q.y,q.z)*uPitch;}
void frame(float t,float lane,out vec3 P,out vec3 T,out vec3 B,out vec3 W,out float radius){
 P=centre(t,lane);T=normalize(centre(t+.0005,lane)-centre(t-.0005,lane));
 B=normalize(cross(T,vec3(0.,0.,1.))+vec3(1.e-12));W=normalize(cross(B,T));
 radius=uRadius*(1.+.038*sin(fract(t)*21.+p02Phase(t,lane))+.022*sin(fract(t)*49.+p02Phase(t,lane)*3.));
}
vec3 yarn(float t,float theta,float lane){vec3 P,T,B,W;float radius;frame(t,lane,P,T,B,W,radius);
 float envelope=1.+.055*cos(3.*(theta+fract(t)*TAU*2.8*.55))+.022*sin(5.*theta+p02Phase(t,lane)+fract(t)*11.);
 return P+(B*cos(theta)+W*sin(theta))*radius*envelope;
}
vec2 boxSpan(vec3 o,vec3 d,vec3 lo,vec3 hi){vec3 a=(lo-o)/d,b=(hi-o)/d;return vec2(max(max(min(a.x,b.x),min(a.y,b.y)),min(a.z,b.z)),min(min(max(a.x,b.x),max(a.y,b.y)),max(a.z,b.z)));}
// Candidate solver. Residual acceptance is explicit; convergence of one seed
// alone is not a conservative certificate that all roots were found.
bool solveYarn(vec3 ro,vec3 rd,float lane,float lower,float upper,float seed,out vec3 hit){
 float t=mix(lower,upper,seed);vec3 P,T,B,W;float radius;frame(t,lane,P,T,B,W,radius);
 float theta=atan(dot(-rd,W),dot(-rd,B));float depth=dot(yarn(t,theta,lane)-ro,rd);
 for(int it=0;it<13;it++){
  vec3 S=yarn(t,theta,lane),r=S-ro-rd*depth;
  if(dot(r,r)<.00000025)break;
  vec3 du=(yarn(t+.00002,theta,lane)-yarn(t-.00002,theta,lane))/.00004;
  vec3 dv=(yarn(t,theta+.0002,lane)-yarn(t,theta-.0002,lane))/.0004;
  vec3 crossV=cross(dv,-rd);float det=dot(du,crossV);if(abs(det)<1.e-9)break;
  vec3 delta=vec3(dot(r,crossV),dot(du,cross(r,-rd)),dot(du,cross(dv,r)))/det;
  t-=clamp(delta.x,-.08,.08);theta-=clamp(delta.y,-.9,.9);depth-=clamp(delta.z,-uPitch,uPitch);
  if(t<lower-.12||t>upper+.12)break;
 }
 float residual=length(yarn(t,theta,lane)-ro-rd*depth);
 hit=vec3(t,theta,depth);return residual<.001&&t>=lower-.000001&&t<=upper+.000001&&depth>0.;
}
float motif(float col,float row){
 // Exact P02 mode 6 integer motif, evaluated directly; no pigment image.
 float cx=floor((col+.5)*uPitch/12.),cy=floor((row+.5)*uPitch*.5/6.);
 float band=mod(floor(cy/14.),3.),sx=mod(cx,16.)-7.5,sy=mod(cy,14.)-6.5;
 float cr=float(abs(sx)<=.6)+float(abs(sy)<=.6),diamond=float(abs(abs(sx)+abs(sy)-5.)<1.15);
 float snow=min(1.,cr*float(max(abs(sx),abs(sy))<=5.6)+diamond),dots=float(abs(mod(cx+cy,4.)-1.5)<.6);
 return band<.5?snow:band<1.5?float(mod(cy,14.)>=11.):dots*.6;
}
float stitchArc(float t){return 3.926862431999*t-.019512499729*sin(12.56637061436*t)+.012534954656*sin(25.13274122872*t)+.000256499088*sin(37.69911184308*t)-.000120229580*sin(50.26548245744*t)-.000009090432*sin(62.8318530718*t)+.000002920105*sin(75.39822368616*t);}
vec3 needlePalette(float t,float lane){float mask=uDesign==6?motif(floor(t),lane):0.;return mix(uBaseDye,uInkDye,mask);}
vec3 dyeAt(float t,float lane){return needlePalette(t,lane)*(1.+.028*sin(stitchArc(t)*uPitch*.67+lane*1.47));
}
vec3 fibreResponse(vec3 T,vec3 N,vec3 V,vec3 L,vec3 energy,vec3 dye){
 float nd=dot(N,L),sinTL=sqrt(max(0.,1.-pow(dot(T,L),2.))),longitudinal=exp(-pow(dot(L,T)+dot(V,T)-.055,2.)/.21);
 vec3 H=normalize(L+V+vec3(1.e-7));float fresnel=.045+.955*pow(1.-clamp(dot(H,V),0.,1.),5.);
 float diffuse=(.50*max(nd,0.)+.50*sinTL*clamp(.58+.42*nd,0.,1.))*.76/3.141592654;
 float reflection=fresnel*longitudinal*sinTL*.65,forward=pow(clamp(dot(-L,V),0.,1.),5.);
 float transmission=forward*sinTL*(.45+.55*sqrt(max(0.,1.-pow(dot(N,V),2.))))*.30;
 // The source's per-channel power visibly washes saturated red into pink.
 // This candidate conserves the dye chroma in diffuse short-path scattering;
 // the separately directional reflection/transmission retain their own tint.
 float dyeLuminance=max(.001,dot(dye,vec3(.2126,.7152,.0722)));
 vec3 shortPathDye=dye*pow(dyeLuminance,-.18);
 return energy*(shortPathDye*diffuse+mix(dye,vec3(1.),.6)*reflection+sqrt(max(dye,vec3(.001)))*transmission);
}
vec3 lightSourceFibre(vec3 T,vec3 N,vec3 V,vec3 dye,float tip){
 vec3 light=fibreResponse(T,N,V,uKeyDirection,uKeyEnergy,dye)+fibreResponse(T,N,V,uRimDirection,uRimEnergy,dye);
 float env=0.;for(int i=0;i<8;i++)env+=dot(uEnvironmentEnergy[i],vec3(.2126,.7152,.0722))/8.;
 float key=dot(uKeyEnergy,vec3(.2126,.7152,.0722)),dominance=key/(key+env*3.141592654+.001);
 float shade=1.-clamp(dominance*1.15*(.20+.80*max(0.,dot(N,uKeyDirection))),0.,1.),rootOcclusion=mix(.64,1.,pow(clamp(tip,0.,1.),.6));
 for(int i=0;i<8;i++){vec3 energy=uEnvironmentEnergy[i]*3.141592654,ordinary=fibreResponse(T,N,V,uEnvironmentDirection[i],energy,dye);
 float phase=.55+.45*sqrt(max(0.,1.-pow(dot(T,uEnvironmentDirection[i]),2.)));
 vec3 exchanged=energy*dye*pow(max(.001,dot(dye,vec3(.2126,.7152,.0722))),-.28)*(shade*.65)*phase*(.3+.7*pow(tip,.6))/3.141592654;
 light+=ordinary*rootOcclusion+exchanged;
 }return light+fibreResponse(T,N,V,normalize(vec3(.25,1.0,2.2)),vec3(.159,.164,.18),dye);
}
vec3 yarnLight(vec3 T,vec3 N,vec3 V,vec3 L,vec3 energy,vec3 dye){
 float nl=max(dot(N,L),0.),nv=max(dot(N,V),.02);vec3 H=normalize(L+V);
 float nh=max(dot(N,H),0.),vh=max(dot(V,H),0.),a=.88*.88,a2=a*a,den=nh*nh*(a2-1.)+1.;
 float D=a2/(3.141592654*den*den),gv=nl*sqrt(nv*nv*(1.-a2)+a2),gl=nv*sqrt(nl*nl*(1.-a2)+a2),G=.5/max(.0001,gv+gl),F=.04+.96*pow(1.-vh,5.);
 float transverse=sqrt(max(0.,1.-pow(dot(T,L),2.))),broad=.62*nl+.23*transverse*clamp(.55+.55*dot(N,L),0.,1.)+.15*nl/(nl+nv+.05);
 vec3 diffuse=mix(dye*nl/3.141592654,dye*broad/3.141592654,.3);
 float sheen=.07*pow(max(0.,1.-nh*nh),.58)*nl;
 return energy*(diffuse+vec3(D*G*F*nl*.7)+vec3(.855,.791,.651)*sheen);
}
vec3 shadeYarn(vec3 ro,vec3 rd,vec3 h,float lane){vec3 p=yarn(h.x,h.y,lane),P,T,B,W;float r;frame(h.x,lane,P,T,B,W,r);
 // Preserve the source's authored yarn normal. The source normal deliberately
 // differs from the gradient of its three-lobed geometric envelope; replacing
 // it by that gradient produces hard facets absent from the reference.
 vec3 n=normalize(B*cos(h.y)/r+W*sin(h.y)/r);if(dot(n,-rd)<0.)n=-n;vec3 v=-rd,dye=dyeAt(h.x,lane);
 // Source laid-fibre phase and actual pixel footprint. This is optical relief,
 // not a replacement surface or a claimed reconstruction of all 960 fibres.
 float arc=(3.926862431999*h.x-.019512499729*sin(12.56637061436*h.x)+.012534954656*sin(25.13274122872*h.x)+.000256499088*sin(37.69911184308*h.x)-.000120229580*sin(50.26548245744*h.x)-.000009090432*sin(62.8318530718*h.x)+.000002920105*sin(75.39822368616*h.x))*uPitch;
 // The source lays 96 separate longitudinal fibres around each resolved
 // needle. Evaluate the nearby angular IDs directly instead of painting noise.
 float turn=fract(h.x)*TAU*.55*1.6,coord=(h.y+turn)/TAU*96.,micro=0.,pigment=0.,weight=0.;
 float footprint=max(.0001,uMillimetresPerPixel/r/TAU*96.);
 for(int j=-2;j<=2;j++){float angular=floor(coord)+float(j),index=mod(mod(angular,96.)*85.,96.);
  int id=int(round(lane*997.+floor(h.x)*491.+index*37.));float seed=p02Hash(id+9);
  float atAngle=(angular+seed*.55)/96.*TAU-turn+.075*sin(fract(h.x)*57.+seed*27.);
  float delta=atan(sin(h.y-atAngle),cos(h.y-atAngle))*r;
  float sigma=max(.012,uMillimetresPerPixel*.43),w=exp(-.5*delta*delta/(sigma*sigma));
  micro+=w*delta/sigma;pigment+=w*(.72+.47*p02Hash(id+1));weight+=w;
 }
 float resolved=exp(-.5*pow(footprint*.42,2.));
 dye*=mix(.96,weight>.0001?pigment/weight:.86,resolved*.72);
 n=normalize(n+normalize(cross(T,n))*.24*micro*resolved);
 float groove=.5+.5*cos(3.*h.y-stitchArc(h.x)*uPitch*TAU/uTwist);
 float grooveResolved=exp(-.5*uMillimetresPerPixel*uMillimetresPerPixel*(9./(r*r)+TAU*TAU/(uTwist*uTwist)));
 dye*=1.-.045*groove*grooveResolved;
 vec3 col=yarnLight(T,n,v,uKeyDirection,uKeyEnergy,dye)+yarnLight(T,n,v,uRimDirection,uRimEnergy,dye);
 for(int i=0;i<8;i++)col+=yarnLight(T,n,v,uEnvironmentDirection[i],uEnvironmentEnergy[i]*3.141592654,dye);
 return col;
}
float surfaceDepth=1.e9;
vec3 sampleWorld(vec3 ro,vec3 rd){
 vec3 background=mix(vec3(.043,.051,.066),vec3(.10,.12,.145),clamp(rd.y*.7+.5,0.,1.));
 if(uDebug==2)return background;
 vec3 shift=vec3(-float(uGrid.x)*uPitch*.5,-float(uGrid.y)*uPitch*.25,0.);ro-=shift;
 vec3 lo=vec3(-uRadius,-uPitch*.5-uRadius,-uPitch*.3-uRadius*1.15),hi=vec3(float(uGrid.x)*uPitch+uRadius,float(uGrid.y)*uPitch*.5+uPitch*.7+uRadius,uPitch*.3+uRadius*1.15);
 vec2 span=boxSpan(ro,rd,lo,hi);if(span.x>span.y||span.y<0.)return background;
 vec3 a=ro+rd*max(0.,span.x),b=ro+rd*span.y;
 ivec2 low=max(ivec2(0),ivec2(floor(min(a.xy,b.xy)/vec2(uPitch,uPitch*.5)))-ivec2(1,2));
 ivec2 high=min(uGrid-1,ivec2(floor(max(a.xy,b.xy)/vec2(uPitch,uPitch*.5)))+ivec2(1,2));
 float best=1.e9,lane=0.;vec3 hit=vec3(0.);
 for(int yy=0;yy<16;yy++){int row=low.y+yy;if(row>high.y)break;
 for(int xx=0;xx<12;xx++){int col=low.x+xx;if(col>high.x)break;
 vec3 offset=vec3(float(col)*uPitch,float(row)*uPitch*.5,0.);
 for(int seg=0;seg<10;seg++){vec2 box=boxSpan(ro,rd,offset+uBoundsLow[seg],offset+uBoundsHigh[seg]);if(box.x>box.y||box.y<0.||box.x>best)continue;
 for(int trial=0;trial<3;trial++){vec3 h;float lower=float(col)+float(seg)*.1,upper=lower+.1;
 if(solveYarn(ro,rd,float(row),lower,upper,trial==0?.5:trial==1?.12:.88,h)&&h.z<best){best=h.z;hit=h;lane=float(row);}
 }
 }}}
 surfaceDepth=best;if(best>1.e8)return background;if(uDebug==1)return vec3(fract(hit.x),mod(lane,3.)*.3,.3);
 return shadeYarn(ro,rd,hit,lane);
}
