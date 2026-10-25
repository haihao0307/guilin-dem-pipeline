// All visible objects are evaluated as analytic fields. No object meshes or assets.
export const vertex=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
export const fragment=`#version 300 es
precision highp float;
out vec4 frag;uniform vec2 res;uniform vec3 eye,target;uniform vec4 dim;uniform vec4 surface;uniform int phase,mode,pick,selected,highway;
const float PI=3.14159265;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+vec2(47.2,13.7)));}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float waves(vec2 p){return .60*noise(p)+.28*noise(p*2.17+4.1)+.12*noise(p*5.43+19.7);}
float box(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float box2(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
float halfRoad(){return dim.x*dim.y*.5+(highway==1?.65:0.);}
float crown(float x){return .26-.025*max(abs(x)-(highway==1?.65:0.),0.);}
vec2 damageP(vec2 p){return p-vec2(-halfRoad()+dim.y*.5,2.);}
float crackDistance(vec2 p){vec2 q=damageP(p);float mainD=abs(q.x-.28*sin(q.y*2.1)-.09*sin(q.y*7.3));float branch=abs(q.y+.9-.75*q.x-.05*sin(q.x*13.));float branch2=abs(q.y-1.1+.55*q.x+.06*sin(q.x*9.));return min(max(mainD,abs(q.y)-3.5),min(max(branch,abs(q.x)-1.8),max(branch2,abs(q.x)-1.5)));}
float pitEdge(vec2 p){vec2 q=damageP(p);return length(q/vec2(.78,1.06))-(.90+.13*noise(q*11.)+.06*noise(q*28.));}
float damageHeight(vec2 p){if(phase!=1)return 0.;vec2 q=damageP(p);if(abs(q.x)>2.3||abs(q.y)>4.)return 0.;float edge=pitEdge(p);float bowl=surface.z*(1.-smoothstep(-.12,.12,edge));float bed=.008*(noise(q*28.)-.5)*(1.-smoothstep(-.3,-.05,edge));float cracks=.009*(1.-smoothstep(.006,.022,crackDistance(p)));return bowl-bed+cracks;}
float repairMask(vec2 p){return 1.-smoothstep(-.012,.015,box2(damageP(p),vec2(1.28,2.1)));}
float surfaceHeight(vec2 p){return crown(p.x)-damageHeight(p)+(phase==3?.005*repairMask(p):0.);}
float drainMask(vec3 p){float w=halfRoad();float z=clamp(round(p.z/8.),-2.,2.)*8.;return max(abs(abs(p.x)-(w-.22))-.18,abs(p.z-z)-.40);}
vec2 closer(vec2 a,vec2 b){return a.x<b.x?a:b;}
float flangeProfile(float y){return .041*cos((y+.156)*4.*PI/.312);}
vec2 scene(vec3 p){float w=halfRoad(),sh=surface.w,s=dim.z,c=dim.w;float top=surfaceHeight(p.xz);if(drainMask(p)<0.)top-=.055;vec2 h=vec2(box(p-vec3(0,top-.21,0),vec3(w,.21,18)),1.);
// Actual regional depressions and slab thickness, not a colour decal.
if(highway==0){float sy=crown(w)+.14;h=closer(h,vec2(box(p-vec3(-w-.2-s*.5,sy-.15,0),vec3(s*.5,.15,18)),2.));h=closer(h,vec2(box(p-vec3(w+.6+c+s*.5,sy-.15,0),vec3(s*.5,.15,18)),2.));h=closer(h,vec2(box(p-vec3(w+.3+c*.5,crown(w)-.10,0),vec3(c*.5,.13,18)),3.));
// Kerb joints and occasional chipped edges are local geometric recesses.
vec3 k=vec3(abs(p.x)-w-.10,p.y-(sy-.10),p.z);float curb=box(k,vec3(.10,.10,18));float joint=abs(fract((p.z+.5)/1.)-.5);if(joint<.012&&p.y>sy-.04)curb=max(curb,.007-abs(k.x));if(phase==1&&abs(p.z-2.)<1.1){float chip=.025*(1.-smoothstep(.3,1.1,abs(p.z-2.)))*noise(p.xz*16.);curb=max(curb,p.y-sy+chip);}h=closer(h,vec2(curb,4.));h=closer(h,vec2(box(p-vec3(w+.4+c,crown(w)+.04,0),vec3(.10,.10,18)),4.));
}else{
// Paved hard shoulder is a separate road component. No footway or cycle track on this example.
h=closer(h,vec2(box(vec3(abs(p.x)-w-sh*.5,p.y-(crown(w)-.16),p.z),vec3(sh*.5,.16,18)),10.));
// H2101-inspired double-face concrete profile: base .725m / top .20m / above-grade .80m.
float y=p.y-.26;float hw=.3625-.70*clamp(y,0.,.30)-.105*clamp(y-.30,0.,.50);float concrete=max((abs(p.x)-hw)*.8,max(y-.80,max(-y-.25,abs(p.z)-18.)));h=closer(h,vec2(concrete,13.));
// Nearest cell only: continuous W beam, 4m supports, footings, flared/ramped end anchored into a block.
float end=smoothstep(13.,17.2,abs(p.z));float railX=w+sh+.25+1.15*end;float railY=crown(w)+.60-.45*end;float by=p.y-railY;float corr=flangeProfile(by);float beam=max(abs(abs(p.x)-railX-corr)*.28-.0018,max(abs(by)-.156,abs(p.z)-17.2));h=closer(h,vec2(beam,11.));
float zs=clamp(round(p.z/4.),-4.,4.)*4.;float en=smoothstep(13.,17.2,abs(zs));float px=w+sh+.25+1.15*en+.08;float py=crown(w)+.60-.45*en;vec3 post=vec3(abs(p.x)-px,p.y-(crown(w)+py)*.5,p.z-zs);float pd=max(length(post.xz)-.0575,abs(post.y)-(py-crown(w))*.5);h=closer(h,vec2(pd,12.));h=closer(h,vec2(box(vec3(abs(p.x)-px,p.y-(crown(w)-.02),p.z-zs),vec3(.15,.06,.15)),12.));
vec3 anchor=vec3(abs(p.x)-(w+sh+1.4),p.y-(crown(w)+.08),abs(p.z)-17.15);h=closer(h,vec2(box(anchor,vec3(.42,.13,.48))-.025,16.));
// Splice/fastener heads at support cells.
vec3 bolt=vec3(abs(p.x)-(w+sh+.25+1.15*en-.045),abs(p.y-py)-.095,p.z-zs);h=closer(h,vec2(length(bolt)-.014,12.));}
// Drain grate bars sit across a real recessed inlet; section is not just a black stripe.
float dz=clamp(round(p.z/8.),-2.,2.)*8.;vec3 gr=vec3(abs(p.x)-(w-.22),p.y-(crown(w-.22)-.012),p.z-dz);float barZ=mod(gr.z+.035,.07)-.035;float grate=max(box(vec3(gr.x,gr.y,barZ),vec3(.18,.014,.012)),abs(gr.z)-.40);h=closer(h,vec2(grate,9.));
float lampZ=clamp(round(p.z/12.),-1.,1.)*12.;float lampX=highway==1?0.:-w-.2-s*.75;float ly=highway==1?1.06:crown(w)+.14;vec3 lp=p-vec3(lampX,ly,lampZ);h=closer(h,vec2(max(length(lp.xz)-.055,abs(lp.y-2.5)-2.5),6.));h=closer(h,vec2(box(lp-vec3(.65,4.95,0),vec3(.7,.055,.055)),6.));h=closer(h,vec2(box(lp-vec3(1.2,4.88,0),vec3(.30,.055,.12)),6.));
if(phase==2){vec3 q=p-vec3(-w+dim.y*.5,crown(-w+dim.y*.5),2.);h=closer(h,vec2(box(q-vec3(0,.012,0),vec3(dim.y*.36,.02,3.3)),8.));float zc=clamp(round(q.z/1.8),-2.,2.)*1.8;vec3 co=q-vec3(dim.y*.43,.35,zc);float cone=max(length(co.xz)-(.22-.20*clamp(co.y+.35,0.,.70)/.70),abs(co.y)-.35);h=closer(h,vec2(cone,7.));h=closer(h,vec2(box(co-vec3(0,-.32,0),vec3(.26,.035,.26)),7.));}
return vec2(h.x*.63,h.y);}
vec3 normalAt(vec3 p){float e=.0015;return normalize(vec3(scene(p+vec3(e,0,0)).x-scene(p-vec3(e,0,0)).x,scene(p+vec3(0,e,0)).x-scene(p-vec3(0,e,0)).x,scene(p+vec3(0,0,e)).x-scene(p-vec3(0,0,e)).x));}
vec3 palette(float id){if(id==1.)return vec3(.23,.45,.67);if(id==2.)return vec3(.75,.54,.29);if(id==3.)return vec3(.2,.56,.42);if(id==4.)return vec3(.61,.64,.64);if(id==5.)return vec3(.9,.83,.50);if(id==10.)return vec3(.53,.40,.27);if(id==11.)return vec3(.39,.64,.73);if(id==12.)return vec3(.49,.45,.65);if(id==13.)return vec3(.70,.68,.59);if(id==15.)return vec3(.46,.25,.17);if(id==14.)return vec3(.35,.43,.43);if(id==16.)return vec3(.75,.63,.46);return vec3(.68,.34,.16);}
// Voronoi-like aggregate: evaluated ONLY on hit surfaces and only where pixel footprint can resolve grains.
vec3 aggregate(vec2 p){vec2 i=floor(p),f=fract(p);float d=10.,value=0.;vec2 delta=vec2(0);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),o=.15+.7*hash2(i+g),v=g+o-f;float dd=dot(v,v);if(dd<d){d=dd;value=hash(i+g+93.);delta=v;}}return vec3(sqrt(d),value,0.);}
float shadow(vec3 p,vec3 l){float t=.03,sh=1.;for(int i=0;i<18;i++){float d=scene(p+l*t).x;sh=min(sh,12.*d/t);t+=clamp(d,.035,.65);if(t>5.||sh<.12)break;}return clamp(sh,.18,1.);}
vec3 shade(vec3 p,vec3 n,vec3 rd,inout float id){vec3 base=vec3(.105,.112,.116);float rough=surface.y,metal=0.;float fp=max(length(dFdx(p)),length(dFdy(p)));float w=halfRoad();float broad=waves(p.xz*.8);vec3 detailN=n;float grain=surface.x;
if(id==1.||id==10.||id==3.||id==8.){if(id==3.)base=vec3(.105,.16,.125);if(id==10.)base*=.82;if(id==8.)base=vec3(.16,.11,.065);float repairCoverage=phase==3?repairMask(p.xz):0.;if(repairCoverage>.5){base*=.62;grain*=.65;id=14.;}base*=.86+.22*broad;float filter=1.-smoothstep(grain*.4,grain*1.5,fp);if(filter>.01){vec3 a=aggregate(p.xz/grain);float stone=1.-smoothstep(.22,.50,a.x);base+=filter*(stone*(.045+.065*a.y)-.023);vec2 grad=vec2(noise(p.xz/grain+vec2(.13,0))-noise(p.xz/grain-vec2(.13,0)),noise(p.xz/grain+vec2(0,.13))-noise(p.xz/grain-vec2(0,.13)));detailN=normalize(n+vec3(grad.x,0,grad.y)*filter*.8);rough=clamp(rough+filter*(a.y-.5)*.20,.25,.98);}base+=.009*(noise(p.xz*15.)-.5)*(1.-smoothstep(.02,.10,fp));
if(id==1.){float edgeD=w-abs(p.x);base*=1.-.20*exp(-edgeD*4.)*(.5+noise(p.xz*2.));float laneCoord=highway==1?mod(abs(p.x)-.65,dim.y):mod(p.x+w,dim.y);float line=min(laneCoord,dim.y-laneCoord);float aa=max(fp*.7,.003);float paint=(1.-smoothstep(.055-aa,.055+aa,line))*step(.12,laneCoord)*0.; // assigned below
paint=(1.-smoothstep(.055-aa,.055+aa,line))*(1.-smoothstep(2.65,2.72,mod(p.z+18.,5.)));paint*=step(.22,edgeD);if(highway==1)paint*=step(.80,abs(p.x));float edgeLine=1.-smoothstep(.060-aa,.060+aa,abs(edgeD-.25));float wear=noise(p.xz*65.);paint*=.80+.20*wear;if(max(paint,edgeLine)>.05){float pm=max(paint,edgeLine);vec3 paintCol=highway==1?vec3(.67,.68,.62):edgeLine>paint?vec3(.65,.43,.07):vec3(.67,.68,.62);base=mix(base,paintCol,pm);rough=.65;if(pm>.5)id=5.;}
if(phase==1&&length(damageP(p.xz))<4.5){float edge=pitEdge(p.xz),cr=crackDistance(p.xz);if(edge<.12){base=mix(vec3(.12,.095,.065),vec3(.21,.19,.15),noise(p.xz*31.));rough=.97;float broken=smoothstep(-.2,.12,edge);base=mix(base,base*.42,broken*(.5+.5*noise(p.xz*53.)));detailN=normalize(n+vec3(noise(p.xz*41.)-.5,0,noise(p.zx*43.)-.5)*.20);id=15.;}else if(cr<.035){base*=.20+.65*smoothstep(.005,.035,cr);id=15.;}}
}if(id==14.){float d=abs(box2(damageP(p.xz),vec2(1.28,2.1)));base*=.75+.25*smoothstep(.0,.035,d);}}
if(id==2.){vec2 q=p.xz/vec2(.40,.60);q.y+=mod(floor(q.x),2.)*.5;vec2 cell=floor(q),f=abs(fract(q)-.5);float joint=smoothstep(.473,.492,max(f.x,f.y));float variant=hash(cell);base=mix(vec3(.36,.32,.26)*(1.+.16*(variant-.5)),vec3(.115,.115,.10),joint);base+=.018*(noise(p.xz*100.)-.5);rough=.91;detailN=normalize(n+vec3(noise(p.xz*80.)-.5,0,noise(p.zx*70.)-.5)*.08*(1.-smoothstep(.005,.025,fp)));}
if(id==4.||id==13.||id==16.){base=vec3(.43,.41,.36)*(.88+.22*waves(p.zy*2.));base-=.045*pow(1.-noise(p.zy*90.),7.);rough=.92;if(id==4.&&mod(p.z+.5,1.)<.015)base*=.55;if(id==13.&&mod(p.z+18.,4.)<.018)base*=.57;float stain=exp(-max(p.y,0.)*3.);base*=1.-.18*stain;detailN=normalize(n+.025*vec3(noise(p.yz*130.)-.5,noise(p.xz*100.)-.5,noise(p.xy*100.)-.5)*(1.-smoothstep(.006,.03,fp)));}
if(id==6.||id==11.||id==12.||id==9.){metal=id==9.?.65:.83;rough=id==9.?.7:.32;base=id==9.?vec3(.14,.15,.15):vec3(.46,.49,.50);float galvan=waves(p.yz*72.);base*=.88+.22*galvan;rough+=.12*(galvan-.5);if(id==11.){float sc=pow(abs(sin(p.z*13.+noise(p.yz*8.))),40.);base-=.025*sc;}detailN=normalize(n+.015*vec3(noise(p.yz*110.)-.5,noise(p.xz*95.)-.5,noise(p.xy*91.)-.5));}
if(id==7.){base=mod(p.y*5.,2.)>.9?vec3(.60,.59,.54):vec3(.72,.17,.035);base*=.96+.08*noise(p.xz*100.);rough=.56;}
if(mode==1){base=palette(id);rough=.9;metal=0.;detailN=n;}
vec3 L=normalize(vec3(-.6,1.,.45)),V=-rd,H=normalize(L+V);float NL=max(dot(detailN,L),0.),NV=max(dot(detailN,V),.001),NH=max(dot(detailN,H),0.),VH=max(dot(V,H),0.);float a=rough*rough,a2=a*a;float D=a2/(PI*pow(NH*NH*(a2-1.)+1.,2.)+.0001);float k=pow(rough+1.,2.)/8.;float G=NV/(NV*(1.-k)+k)*NL/(NL*(1.-k)+k);vec3 f0=mix(vec3(.04),base,metal),fr=f0+(1.-f0)*pow(1.-VH,5.);vec3 spec=D*G*fr/max(4.*NV*max(NL,.001),.001);float sh=shadow(p+n*.006,L);float ao=clamp(scene(p+n*.12).x/.075,.55,1.);vec3 col=base*vec3(.32,.35,.39)*ao+(base*(1.-metal)/PI+spec)*NL*vec3(2.1,1.98,1.78)*sh;col+=metal*base*.17*(.4+.6*max(n.y,0.));if(int(id)==selected)col*=1.04;return col;}
void main(){vec2 uv=(gl_FragCoord.xy-.5*res)/res.y;vec3 f=normalize(target-eye),r=normalize(cross(f,vec3(0,1,0))),up=cross(r,f),rd=normalize(f*1.7+r*uv.x+up*uv.y);float w=halfRoad();vec3 bounds=vec3(w+(highway==1?surface.w+2.:dim.z+dim.w+1.),7.,18.6);vec3 inv=1./rd;vec3 a=(-bounds-eye)*inv,b=(bounds-eye)*inv;vec3 mn=min(a,b),mx=max(a,b);float nearT=max(0.,max(mn.x,max(mn.y,mn.z))),farT=min(mx.x,min(mx.y,mx.z));float t=nearT;vec2 h=vec2(1,0);bool hit=false;if(farT>nearT){for(int i=0;i<150;i++){h=scene(eye+rd*t);if(h.x<max(.00065,t*.000025)){hit=true;break;}t+=max(h.x,.0005);if(t>farT)break;}}
float id=0.;vec3 col=vec3(.58,.60,.59);if(hit){vec3 p=eye+rd*t,n=normalAt(p);id=h.y;col=shade(p,n,rd,id);}else if(rd.y<-.001){float g=(-.30-eye.y)/rd.y;vec3 p=eye+rd*g;float d=length(vec2(max(abs(p.x)-w-2.,0.),max(abs(p.z)-18.,0.)));col*=.83+.17*smoothstep(0.,2.,d);}
if(pick==1){frag=vec4(id/255.,0,0,1);return;}col=col/(vec3(1.)+col*.40);frag=vec4(pow(max(col,0.),vec3(1./2.2)),1.);}`;
