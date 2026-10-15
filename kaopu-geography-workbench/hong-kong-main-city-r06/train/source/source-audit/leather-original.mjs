// Verbatim constants/GLSL extracted from R09 public-lite.html; export wrapper only.
// Original KAOPU procedural leather. R01 lineage retained; no Adobe asset data.
const VERSION='R02.0';
const PRESETS={
 tan:{name:'原色细粒',kind:0,color:'#946445',grain:.78,depth:.11,roughness:.49,coat:.10,wear:.16,wrinkles:.38,pores:.55,irregular:.78,damage:.05,finish:'aniline'},
 wax:{name:'油蜡棕革',kind:0,color:'#61341f',grain:1.1,depth:.12,roughness:.36,coat:.36,wear:.5,wrinkles:.52,pores:.48,irregular:.85,damage:.13,finish:'wax'},
 black:{name:'荔枝纹革',kind:1,color:'#27292b',grain:1.4,depth:.20,roughness:.47,coat:.17,wear:.13,wrinkles:.3,pores:.4,irregular:.72,damage:.02,finish:'pigmented'},
 nubuck:{name:'磨砂牛巴革',kind:2,color:'#8d7960',grain:.65,depth:.065,roughness:.87,coat:0,wear:.23,wrinkles:.16,pores:.2,irregular:.8,damage:.03,finish:'matte'},
 cross:{name:'交叉压纹',kind:3,color:'#30483c',grain:1.35,depth:.13,roughness:.42,coat:.23,wear:.1,wrinkles:.06,pores:.14,irregular:.15,damage:.04,finish:'pigmented'},
 croco:{name:'矩形鳞片压纹',kind:4,color:'#442920',grain:4.4,depth:.32,roughness:.38,coat:.30,wear:.38,wrinkles:.20,pores:.3,irregular:.65,damage:.14,finish:'wax'},
 ostrich:{name:'毛囊珠点压纹',kind:5,color:'#ad814e',grain:3.7,depth:.27,roughness:.5,coat:.14,wear:.2,wrinkles:.42,pores:.75,irregular:.85,damage:.02,finish:'aniline'},
 suede:{name:'绒面反绒革',kind:6,color:'#6d5842',grain:.7,depth:.09,roughness:.94,coat:0,wear:.32,wrinkles:.22,pores:.2,irregular:.9,damage:.06,finish:'matte'}
};
const FINISHES={aniline:{name:'透明染色',roughness:.49,coat:.1,metal:0,iridescence:0},pigmented:{name:'颜料涂饰',roughness:.44,coat:.22,metal:0,iridescence:0},wax:{name:'油蜡抛光',roughness:.34,coat:.4,metal:0,iridescence:0},matte:{name:'消光涂饰',roughness:.84,coat:0,metal:0,iridescence:0},patent:{name:'漆皮涂层',roughness:.26,coat:.95,metal:0,iridescence:0},metallic:{name:'金属箔涂饰',roughness:.35,coat:.3,metal:.78,iridescence:0},pearl:{name:'珠光涂饰',roughness:.31,coat:.55,metal:0,iridescence:.7}};
const DEFAULT={...PRESETS.wax,preset:'wax',seed:27,tileMM:96,resolution:2048,fold:1,stitches:true,object:'roll',light:'studio',exposure:1.0,rotation:0,craft:'plain',quiltMM:34,weaveMM:10,loft:4,thickness:1.4,stitch:'double',threadColor:'#cfb38a',threadMM:.30,pitchMM:3.4,piping:true,hole:'none',holeMM:1.6,holePitch:6,channel:'beauty'};
const vert=`varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const noise=`
float h(vec2 p){vec3 a=fract(vec3(p.xyx)*.1031+uSeed*.037);a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}
vec2 hash2(vec2 p){return vec2(h(p),h(p+vec2(19.7,41.3)));}
float n(vec2 p,vec2 period){vec2 i=floor(p),f=fract(p),w=f*f*(3.-2.*f);return mix(mix(h(mod(i,period)),h(mod(i+vec2(1,0),period)),w.x),mix(h(mod(i+vec2(0,1),period)),h(mod(i+1.,period)),w.x),w.y);}
float n(vec2 p,float period){return n(p,vec2(period));}
float fb(vec2 uv){return n(uv*4.,4.)*.53+n(uv*8.,8.)*.26+n(uv*16.,16.)*.14+n(uv*32.,32.)*.07;}
vec3 cells(vec2 p,float period){vec2 id=floor(p),f=fract(p);float a=8.,b=8.,v=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),rnd=hash2(mod(id+g,period)),d=g+.06+.88*rnd-f;float q=dot(d,d);if(q<a){b=a;a=q;v=rnd.x;}else if(q<b)b=q;}return vec3(sqrt(a),sqrt(b)-sqrt(a),v);}
`;
const field=`precision highp float;varying vec2 vUV;uniform float uSeed,uCells,uKind,uIrregular,uWrinkles,uPores,uDamage;${noise}
void main(){vec2 uv=vUV;float broad=fb(uv),m=n(uv*512.,512.);vec2 warp=vec2(n(uv*8.,8.),n(uv*8.+13.7,8.))-.5;
vec2 p=uv*uCells+warp*(1.+uIrregular*2.);p+=(vec2(n(p*2.,uCells*2.),n(p*2.+5.7,uCells*2.))-.5)*(.25+uIrregular*.65);
vec3 g=cells(p,uCells),fine=cells(p*4.,uCells*4.),wr=cells(uv*12.+warp*.6,12.);
float width=.18+.18*n(uv*32.,32.);float grain=smoothstep(.012,width,g.y);float islands=mix(grain,.5+.45*n(p*1.5,uCells*1.5),.22*uIrregular);
float pores=(1.-smoothstep(.018,.115,fine.x))*uPores;
float wrinkles=exp(-wr.y*wr.y*150.)*(.22+.78*n(uv*16.,16.))*uWrinkles;
float striation=pow(1.-abs(n(uv*vec2(192.,32.),vec2(192.,32.))-.5)*2.,18.);
float damage=uDamage*(.6*exp(-wr.y*wr.y*1500.)*smoothstep(.45,.65,broad)+.22*striation*smoothstep(.55,.75,n(uv*8.,8.)));
float height=.40+.24*islands+.085*n(p*3.,uCells*3.)+.04*m-.09*pores-.14*wrinkles-.21*damage;
if(uKind>.5&&uKind<1.5)height=.32+.40*pow(grain,.6)+.035*m-.09*pores-.12*wrinkles-.2*damage;
if(uKind>1.5&&uKind<2.5){height=.45+.18*m+.07*n(uv*1024.,1024.)-.06*wrinkles;grain=.7;pores=0.;}
if(uKind>2.5&&uKind<3.5){vec2 q=uv*uCells;float a=abs(sin(6.2831853*(q.x+q.y))),b=abs(sin(6.2831853*(q.x-q.y)));float rib=max(pow(a,9.),pow(b,9.));height=.34+.34*rib+.028*m-.05*wrinkles-.2*damage;grain=.3+.65*rib;}
if(uKind>3.5&&uKind<4.5){vec2 q=uv*uCells;float row=floor(q.y);q.x+=.22*h(vec2(mod(row,uCells),3.));q+=warp*.12;vec2 f=fract(q),edge=min(f,1.-f);float rib=smoothstep(.023,.14,min(edge.x,edge.y));height=.23+.50*rib+.05*n(p*5.,uCells*5.)-.05*wrinkles-.12*damage;grain=rib;}
if(uKind>4.5&&uKind<5.5){float bulge=exp(-g.x*g.x*30.)-.42*exp(-g.x*g.x*330.);height=.46+.36*bulge+.08*n(p*8.,uCells*8.)+.025*m-.10*wrinkles;grain=.6+.4*bulge;}
if(uKind>5.5){height=.42+.19*n(uv*vec2(1024.,256.),vec2(1024.,256.))+.12*m-.075*wrinkles;grain=.7;pores=0.;}
gl_FragColor=vec4(clamp(height,.02,.98),clamp(grain,0.,1.),clamp(pores+damage+wrinkles*.3,0.,1.),broad);
}`;
const maps=`precision highp float;varying vec2 vUV;uniform sampler2D uField;uniform vec3 uColor;uniform float uMode,uResolution,uDepthMM,uTileMM,uRough,uWear,uKind;
void main(){vec4 d=texture2D(uField,vUV);float wear=smoothstep(.38,.69,d.a)*uWear,polish=smoothstep(.48,.82,d.g);
if(uMode<.5){vec3 c=uColor*(.82+.06*d.g+.28*d.a);c*=1.-.07*d.b;c=mix(c,c*1.38+vec3(.012,.004,.001),wear*(.24+.30*polish));gl_FragColor=vec4(c,1.);}
else if(uMode<1.5){vec2 e=vec2(1./uResolution,0.);float dx=texture2D(uField,vUV-e.xy).r-texture2D(uField,vUV+e.xy).r,dy=texture2D(uField,vUV-e.yx).r-texture2D(uField,vUV+e.yx).r;vec3 nn=normalize(vec3(vec2(dx,dy)*uDepthMM*uResolution/(2.*uTileMM),1.));gl_FragColor=vec4(nn*.5+.5,1.);}
else if(uMode<2.5){float r=clamp(uRough+.095*(1.-d.g)+.035*d.b+.04*(d.a-.5)-wear*.16*polish,.08,.99);gl_FragColor=vec4(vec3(r),1.);}
else if(uMode<3.5){float v=floor(d.r*65535.+.5);gl_FragColor=vec4(floor(v/256.)/255.,mod(v,256.)/255.,d.r,1.);}
else{gl_FragColor=vec4(vec3(1.-.10*(1.-d.g)-.13*d.b),1.);}}
`;

export {VERSION,PRESETS,FINISHES,DEFAULT,vert,noise,field,maps};
