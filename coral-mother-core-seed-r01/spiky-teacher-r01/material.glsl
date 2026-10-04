// Coral Heart / Septa 01. Original procedural material by this workbench.
// Toroidal Voronoi corallites, radial septa, calcium rims, soft tissue and fine pores.
// No sampled photographs, imported image, third-party texture, or learned stock asset.
vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float scalarHash(vec2 p){return fract(sin(dot(p,vec2(41.7,289.3)))*43758.5453);}
vec2 periodic(vec2 p,float period){return mod(mod(p,period)+period,period);}
float cellNoise(vec2 p,float period){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(scalarHash(periodic(i,period)),scalarHash(periodic(i+vec2(1,0),period)),f.x),mix(scalarHash(periodic(i+vec2(0,1),period)),scalarHash(periodic(i+vec2(1,1),period)),f.x),f.y);}
vec3 originalCoralTexture(vec2 uv){
 const float N=9.;vec2 p=uv*N;
 p+=.075*vec2(sin(uv.y*6.283185*3.+sin(uv.x*6.283185*2.)),cos(uv.x*6.283185*3.+sin(uv.y*6.283185*2.)));
 vec2 grid=floor(p),f=fract(p),delta=vec2(0),cell=vec2(0);float first=8.,second=8.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(i,j),id=periodic(grid+g,N),r=g+(.18+.64*hash2(id))-f;float d=dot(r,r);if(d<first){second=first;first=d;delta=r;cell=id;}else second=min(second,d);}
 float r=sqrt(first),edge=sqrt(second)-r,angle=atan(delta.y,delta.x),seed=scalarHash(cell+17.);
 float tissue=cellNoise(uv*18.,18.)*.55+cellNoise(uv*54.,54.)*.27+cellNoise(uv*162.,162.)*.18;
 float pore=exp(-pow(r/(.072+.03*seed),2.));
 float wave=sin(angle*(18.+2.*floor(seed*4.))+r*8.+seed*8.);float ridges=pow(.5+.5*wave,8.)*smoothstep(.07,.15,r)*(1.-smoothstep(.38,.6,r));
 float rings=.5+.5*sin(r*87.+tissue*4.);
 float rim=exp(-pow((edge-.052)*26.,2.));float groove=exp(-edge*50.);
 float puncta=pow(cellNoise(uv*243.,243.),8.);
 vec3 calcium=vec3(.78,.71,.59),rose=vec3(.43,.235,.22),reef=vec3(.17,.40,.37);
 vec3 bed=mix(rose,reef,smoothstep(.38,.78,cellNoise(uv*9.,9.)));
 vec3 color=mix(bed,calcium,clamp(.26+tissue*.42+rim*.20,0.,1.));
 color+=vec3(.15,.145,.12)*ridges + vec3(.019,.014,.01)*(rings-.5);
 color*=1.-pore*.65-groove*.22-puncta*.30;
 color+=vec3(.025,.028,.020)*(cellNoise(uv*324.,324.)-.5);
 return clamp(color,.035,.89);
}
