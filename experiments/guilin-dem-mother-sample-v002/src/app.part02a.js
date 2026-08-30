const TERRAIN_FS_V21=`#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec4 vField0;
in vec4 vField1;
in vec4 vField2;
in vec4 vField3;
uniform int uMode;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uDetailStrength;
uniform float uColorStrength;
uniform vec3 uEye;
out vec4 outColor;
float sat(float v){return clamp(v,0.0,1.0);}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fb2(vec2 p){float s=0.0,a=.56;mat2 r=mat2(.80,.60,-.60,.80);for(int i=0;i<3;i++){s+=(n2(p)-.5)*2.0*a;p=r*p*2.07+vec2(9.3,5.7);a*=.48;}return s*.5+.5;}
float rg2(vec2 p){float s=0.0,a=.62;mat2 r=mat2(.72,.69,-.69,.72);for(int i=0;i<3;i++){float n=1.0-abs(n2(p)*2.0-1.0);s+=n*n*a;p=r*p*2.11+vec2(7.1,12.9);a*=.47;}return sat(s*.72);}
vec2 wc2(vec2 p){vec2 id=floor(p),f=fract(p);float d1=8.0,d2=8.0;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),j=vec2(h21(id+o),h21(id+o+19.7)),v=o+j-f;float d=dot(v,v);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return sqrt(vec2(d1,d2));}
float sharp(float v,float s){float w=mix(.28,.045,sat(s));return smoothstep(.5-w,.5+w,v);}
float clearField(float v,float a){float t=sat(v),m=t*t*(3.0-2.0*t);return sat(t+(t-m)*a);}
vec3 clut5(float t,vec3 a,vec3 b,vec3 c,vec3 d,vec3 e){float x=sat(t)*4.0;if(x<1.0)return mix(a,b,x);if(x<2.0)return mix(b,c,x-1.0);if(x<3.0)return mix(c,d,x-2.0);return mix(d,e,x-3.0);}
vec3 truthRamp(float t){return clut5(t,vec3(.075,.15,.11),vec3(.16,.28,.13),vec3(.34,.37,.18),vec3(.49,.43,.25),vec3(.72,.70,.60));}
void main(){
 float truth=vField0.x,slope=sat(vField0.y),curv=clamp(vField0.z,-1.0,1.0),karst=sat(vField0.w);
 float rock=sat(vField1.x),paddy=sat(vField1.y),wet=sat(vField1.z),bund=sat(vField1.w);
 float channel=sat(vField2.x),kDelta=vField2.y,fDelta=vField2.z,seed=vField2.w;
 float flow=sat(vField3.x),talus=sat(vField3.y),cliff=sat(vField3.z),terrace=sat(vField3.w);
 float elev=sat((truth-uMinElevation)/max(1.0,uMaxElevation-uMinElevation));
 vec2 p=vWorld.xz,warp=vec2(fb2(p*.0027+vec2(7.2,1.9)),fb2(p*.0027+vec2(2.3,11.7)))-.5;
 vec2 q=p+warp*34.0;
 float macro=fb2(q*.0017+vec2(3.7,9.1));
 float meso=fb2(q*.0082+vec2(17.3,4.6));
 float ridge=rg2(q*.0125+vec2(8.4,14.2));
 vec2 cell=wc2(q*.018+vec2(4.1,7.8));
 float plate=1.0-smoothstep(.035,.19,cell.y-cell.x);
 float strata=pow(1.0-abs(sin(vWorld.y*.072+q.x*.008+q.y*.003+(macro-.5)*2.1)),3.0);
 float streak=pow(1.0-abs(sin(vWorld.y*.18+q.x*.019+(meso-.5)*3.0)),5.0)*cliff;
 float fracture=sharp(ridge*.57+plate*.43,.72)*cliff;
 float micro=rg2(q*.085+vec2(21.1,3.2));
 float separation=smoothstep(.10,.40,abs(macro-ridge));
 float cavity=sat(fracture*.42+streak*.20+channel*.34+smoothstep(.82,.97,micro)*.22);
 float relief=(ridge-.51)*1.25*rock+strata*.52*rock-fracture*.65*rock+(micro-.48)*.12+bund*.18-channel*.16;
 vec3 baseN=normalize(vNormal),dp=vWorld+baseN*relief*uDetailStrength;
 vec3 N=normalize(cross(dFdx(dp),dFdy(dp)));if(dot(N,baseN)<0.0)N=-N;N=normalize(mix(baseN,N,sat(.26+uDetailStrength*.48)));
 vec3 soil=clut5(clearField(macro*.56+meso*.27+seed*.17,.62),vec3(.075,.055,.030),vec3(.18,.115,.050),vec3(.31,.215,.085),vec3(.43,.34,.14),vec3(.58,.49,.25));
 vec3 field=clut5(clearField(meso*.42+seed*.38+wet*.20,.72),vec3(.10,.13,.035),vec3(.25,.31,.065),vec3(.45,.49,.10),vec3(.64,.58,.15),vec3(.79,.70,.27));
 vec3 lime=clut5(clearField(ridge*.44+strata*.22+macro*.20+seed*.14,.84),vec3(.055,.057,.054),vec3(.17,.19,.19),vec3(.33,.35,.34),vec3(.52,.52,.47),vec3(.76,.74,.65));
 lime=mix(lime,vec3(.43,.28,.13),sharp(meso*.55+flow*.20+separation*.25,.56)*rock*.34);
 lime=mix(lime,vec3(.78,.72,.56),strata*rock*.22);
 lime*=mix(1.0,.66,wet*.52);soil*=mix(1.0,.61,wet*.72);field*=mix(1.04,.67,wet*.74);
 float fieldWeight=pow(paddy,.66),rockWeight=pow(rock,.70),soilWeight=sat(1.0-max(fieldWeight,rockWeight));
 vec3 color=soil*soilWeight+field*fieldWeight*(1.0-rockWeight)+lime*rockWeight;
 color=mix(color,mix(soil,lime,.52),talus*.44);color=mix(color,vec3(.13,.085,.038),bund*.72);color=mix(color,vec3(.045,.28,.34),channel*.78);color=mix(color,vec3(.045,.055,.047),cavity*rock*.38);color=mix(color,vec3(.69,.65,.51),separation*rock*.14);
 if(uMode==1)color=truthRamp(elev);
 else if(uMode==2){float pos=sat(kDelta/55.0),neg=sat(-kDelta/17.0);color=mix(vec3(.045,.065,.055),vec3(.87,.52,.13),karst);color=mix(color,vec3(.98,.84,.39),pos);color=mix(color,vec3(.18,.44,.71),neg*.85);}
 else if(uMode==3){color=mix(vec3(.055,.068,.040),field,pow(paddy,.48));color=mix(color,vec3(.38,.19,.045),pow(bund,.48));color=mix(color,vec3(.035,.42,.52),pow(channel,.45));}
 else if(uMode==4){color=clut5(pow(wet,.62),vec3(.13,.08,.04),vec3(.25,.18,.08),vec3(.12,.38,.32),vec3(.035,.53,.59),vec3(.17,.69,.72));color=mix(color,vec3(.035,.29,.51),channel*.76);}
 else if(uMode==5){color=clut5(pow(rock,.56),vec3(.055,.08,.055),vec3(.16,.19,.16),vec3(.36,.37,.34),vec3(.61,.59,.52),vec3(.84,.81,.71));color=mix(color,vec3(.065,.045,.035),fracture*.54);color=mix(color,vec3(.77,.66,.43),strata*.23);}
 float luma=dot(color,vec3(.2126,.7152,.0722));color=mix(vec3(luma),color,uColorStrength);
 vec3 L=normalize(vec3(-.48,.80,.36)),V=normalize(uEye-vWorld),H=normalize(L+V);
 float wrap=sat(dot(N,L)*.67+.33),sky=sat(N.y*.5+.5),ao=sat(1.0-cavity*.27-sat(-curv)*.10-fracture*.10-rock*.045);
 float rough=sat(.48+rock*.28+paddy*.10+talus*.14-wet*.23+micro*.07),spec=pow(max(dot(N,H),0.0),mix(50.0,8.0,rough))*mix(.18,.045,rough),rim=pow(1.0-max(dot(N,V),0.0),3.0)*.10;
 vec3 lit=color*(.23+.59*wrap+.18*sky)*mix(ao,1.0,.34)+vec3(.93,.88,.72)*spec+vec3(.13,.21,.18)*rim;
 float fog=smoothstep(1800.0,4300.0,length(uEye-vWorld));lit=mix(lit,vec3(.05,.078,.066),fog*.60);
 outColor=vec4(pow(clamp(lit,0.0,1.25),vec3(.90)),1.0);
}`;
