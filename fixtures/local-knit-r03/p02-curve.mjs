// The eleven Catmull–Rom controls from the byte-verified P02 C2 public specimen.
export const CONTROLS=Object.freeze([[-.5,-.39,-.08],[-.36,-.43,.13],[-.14,-.22,.29],[-.29,.2,.06],[-.28,.51,-.13],[0,.63,-.18],[.28,.51,-.13],[.29,.2,.06],[.14,-.22,.29],[.36,-.43,.13],[.5,-.39,-.08]].map(Object.freeze));
export const COURSE=.5;
export function curve(t){const u=t-Math.floor(t),v=u*10,i=Math.min(9,Math.floor(v)),x=v-i,a=CONTROLS[Math.max(0,i-1)],b=CONTROLS[i],c=CONTROLS[i+1],d=CONTROLS[Math.min(10,i+2)];return b.map((p,k)=>.5*(2*p+(-a[k]+c[k])*x+(2*a[k]-5*p+4*c[k]-d[k])*x*x+(-a[k]+3*p-3*c[k]+d[k])*x*x*x));}
export function stitchColour(col,row,pattern){if(!pattern)return 0;if(pattern===3)return((row%8+8)%8)<4?0:1;const x=(col%16+16)%16,y=(row%16+16)%16,d=Math.abs(x-7.5)+Math.abs(y-7.5);return Math.abs(d-6)<1.1?1:((x+y)%5<.5?1:0);}
const sm7=t=>{t=Math.max(0,Math.min(1,t));return t**4*(35+t*(-84+t*(70-20*t)));};
export function knitPoint(t,lane,pitch,pattern=0,carrier=0){const u=t-Math.floor(t),work=!pattern||Math.abs(stitchColour(Math.floor(t),lane,pattern)-carrier)<.1,p=work?curve(t):[u-.5,.63,-.18];if(!work){for(const v of[u,1-u])if(v<.3)p[1]-=.785398163397*v*v*(1-sm7(v/.3));}return[(Math.floor(t)+p[0]+.5)*pitch,(lane*COURSE+p[1])*pitch,p[2]*pitch];}
export const curveGLSL=`
vec3 p02Control(int i){${CONTROLS.map((p,i)=>`if(i==${i})return vec3(${p.map(x=>Number.isInteger(x)?x+'.':String(x)).join(',')});`).join('')}return vec3(.5,-.39,-.08);}
vec3 p02Curve(float t){float v=fract(t)*10.;int i=min(9,int(floor(v)));float x=v-float(i);vec3 a=p02Control(max(0,i-1)),b=p02Control(i),c=p02Control(i+1),d=p02Control(min(10,i+2));return .5*(2.*b+(-a+c)*x+(2.*a-5.*b+4.*c-d)*x*x+(-a+3.*b-3.*c+d)*x*x*x);}
float p02Phase(float t,float lane){uint n=(uint(int(floor(t)+lane*4099.))^4291u)*73244475u;n=(n^(n>>16u))*73244475u;return float(n^(n>>16u))/4294967296.*6.28318530718;}
`;
