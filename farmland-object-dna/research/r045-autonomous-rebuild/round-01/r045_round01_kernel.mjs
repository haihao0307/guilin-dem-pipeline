export const VERSION='R045.01';
export const WORLD={x0:-240,x1:240,z0:-320,z1:210,slope0:-175,slope1:20,plain1:150,river0:154,river1:188};
const C=(x,a,b)=>Math.max(a,Math.min(b,x)),M=(a,b,t)=>a+(b-a)*t,S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function Hs(x,z){const v=Math.sin(x*127.1+z*311.7)*43758.5453123;return v-Math.floor(v)}
function N(x,z){const i=Math.floor(x),j=Math.floor(z),u=S(0,1,x-i),v=S(0,1,z-j);return M(M(Hs(i,j),Hs(i+1,j),u),M(Hs(i,j+1),Hs(i+1,j+1),u),v)}
function F(x,z,L=5,b=.0046){let s=0,a=.5,n=0;for(let i=0;i<L;i++){const k=2**i;s+=a*(N((x+.12*z)*b*k,(z-.07*x)*b*k)-.5)*2;n+=a;a*=.5}return s/n}
function D(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return Math.hypot(px-x,pz-z)}
function DP(x,z,p){let d=1e9;for(let i=0;i<p.length-1;i++)d=Math.min(d,D(x,z,p[i],p[i+1]));return d}
const P=[[-205,-273,54,48,40],[-154,-286,79,59,48],[-94,-259,66,53,43],[-25,-293,96,68,55],[49,-271,76,59,48],[116,-288,82,61,51],[184,-265,60,52,44]];
function PH(x,z){let h=0;for(const[cx,cz,H,rx,rz]of P){const dx=(x-cx)/rx,dz=(z-cz)/rz,r=Math.hypot(dx,dz)/(1+.08*Math.sin(Math.atan2(dz,dx)*3+cx*.01));if(r<1.5)h=Math.max(h,H*Math.pow(Math.max(0,1-r**1.52),.62))}return h}
export const naturalStreams=[
{id:'A1',o:1,p:[[-198,-300],[-189,-279],[-181,-257],[-174,-236],[-169,-214]]},{id:'A2',o:1,p:[[-133,-302],[-141,-282],[-151,-260],[-159,-238],[-169,-214]]},{id:'A',o:2,p:[[-169,-214],[-160,-195],[-150,-177],[-142,-160],[-136,-143]]},
{id:'B1',o:1,p:[[-50,-310],[-43,-288],[-37,-267],[-32,-244],[-27,-222]]},{id:'B2',o:1,p:[[32,-309],[25,-288],[18,-267],[8,-246],[-1,-225],[-27,-222]]},{id:'B',o:2,p:[[-27,-222],[-21,-200],[-15,-181],[-9,-162],[-5,-143]]},
{id:'C1',o:1,p:[[113,-302],[120,-281],[130,-260],[139,-239],[146,-218]]},{id:'C2',o:1,p:[[190,-294],[181,-277],[169,-258],[157,-238],[146,-218]]},{id:'C',o:2,p:[[146,-218],[140,-198],[136,-179],[131,-160],[127,-143]]}];
export const riverZ=x=>171+6.5*Math.sin((x+18)*.020)+2.8*Math.sin(x*.054),riverW=x=>8.5+1.5*Math.sin((x+30)*.022);
const highZ=x=>-126+2.7*Math.sin(x*.015)+.9*Math.sin(x*.047),footZ=x=>18+2.4*Math.sin((x+10)*.016)+.8*Math.sin(x*.049),mainZ=x=>48+3.1*Math.sin((x-15)*.014)+Math.sin(x*.043),colZ=x=>139+2.7*Math.sin((x+22)*.013)+.8*Math.sin(x*.050);
const across=(f,n=33,a=-205,b=205)=>Array.from({length:n},(_,i)=>{const x=M(a,b,i/(n-1));return[x,f(x)]}),conn=(a,b,n=7,bend=0)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return[M(a[0],b[0],t)+bend*Math.sin(Math.PI*t),M(a[1],b[1],t)]});
const sx=[-165,-112,-58,-6,48,104,160],SD=sx.map((x,i)=>conn([x,highZ(x)],[x,footZ(x)],15,(i-3)*.7)),PL=sx.map((x,i)=>conn([x,mainZ(x)],[x,colZ(x)],15,(i-3)*.45));
export const nodes=[{id:'SRC-A',k:'source'},{id:'SRC-B',k:'source'},{id:'SRC-C',k:'source'},{id:'HIGH',k:'control_volume'},{id:'FOOT',k:'control_volume'},{id:'MAIN',k:'control_volume'},{id:'COL',k:'control_volume'},{id:'RIVER',k:'receiver'},...sx.map((_,i)=>({id:`SD${i+1}`,k:'control_volume'})),...sx.map((_,i)=>({id:`PL${i+1}`,k:'control_volume'}))];
export const edges=[];const E=(id,k,from,to,p,o,permit=true,role='transfer')=>edges.push({id,k,from,to,p,o,transportPermitted:permit,currentGateState:null,currentFlowM3s:null,storedVolumeM3:null,eventState:'not-supplied',role});
for(const s of naturalStreams)E(`NS-${s.id}`,'natural_stream',null,null,s.p,s.o,false,'geomorphic');
E('HIGH-GEOM','carrier',null,null,across(highZ),3,false,'carrier_geometry');E('FOOT-GEOM','carrier',null,null,across(footZ),3,false,'carrier_geometry');E('MAIN-GEOM','carrier',null,null,across(mainZ),3,false,'carrier_geometry');E('COL-GEOM','carrier',null,null,across(colZ),3,false,'carrier_geometry');E('RIVER-GEOM','receiver',null,'RIVER',across(riverZ,49,-230,230),4,false,'receiver_geometry');
for(const[id,x,b]of[['A',-136,3],['B',-5,0],['C',127,-3]])E(`CAP-${id}`,'source_capture',`SRC-${id}`,'HIGH',conn([x,-143],[x,highZ(x)],6,b),3);
for(let i=0;i<7;i++){E(`HIGH-SD${i+1}`,'distribution','HIGH',`SD${i+1}`,conn([0,highZ(0)],SD[i][0],8,(i-3)*.6),3);E(`SD${i+1}-FOOT`,'slope_distributor',`SD${i+1}`,'FOOT',SD[i],2)}
for(const[i,x]of[[1,-120],[2,0],[3,120]])E(`FOOT-MAIN${i}`,'foothill_transfer','FOOT','MAIN',conn([x,footZ(x)],[x,mainZ(x)],7,i===1?-2:i===3?2:0),3);
for(let i=0;i<7;i++){E(`MAIN-PL${i+1}`,'distribution','MAIN',`PL${i+1}`,conn([0,mainZ(0)],PL[i][0],8,(i-3)*.5),3);E(`PL${i+1}-COL`,'plain_lateral',`PL${i+1}`,'COL',PL[i],2)}
for(const[i,x]of[[1,-125],[2,0],[3,125]])E(`COL-RIVER${i}`,'collector_to_river','COL','RIVER',conn([x,colZ(x)],[x,riverZ(x)-riverW(x)*.25],7,i===1?-2:i===3?2:0),3);
export function height(x,z){let y;if(z>=20)y=1.3-.007*(z-20)+.1*Math.sin(x*.011)+.05*F(x,z,3,.009);else{const t=1-S(-175,20,z);y=1.35+30.5*t**1.18+3.2*Math.exp(-1*((x+12)/190)**2)*t**.9+1.9*F(x,z,5,.0045)*(.25+.75*t)+PH(x,z)}for(const s of naturalStreams)y-=Math.exp(-1*(DP(x,z,s.p)/(5.4+1.2*s.o))**2)*(1+1.05*s.o);y-=Math.exp(-1*((z-footZ(x))/10)**2)*.55;const rz=riverZ(x),d=Math.abs(z-rz),w=riverW(x);if(z>145)y=M(-1.05,y,S(w,w+6,d));return y}
export function slope(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return Math.hypot(dx,dz)}
export function suitability(x,z){if(z>=150||z<-175)return 0;const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s),src=z<-115?Math.min(...naturalStreams.map(q=>DP(x,z,q.p))):999,sp=1-S(7,18,src),rp=z>135?1-S(riverW(x)+4,riverW(x)+18,Math.abs(z-riverZ(x))):0;return C(base*(1-.82*sp)*(1-.95*rp),0,1)}
export function snapshot(){return{version:VERSION,composition:['rear_mountains','single_forward_slope','foothill','broad_plain','front_river'],physicsClaims:{realWeather:false,realSoilExchange:false,realGateStates:false,realFlowRates:false,regionalMicrotopography:false},waterSemantics:{permission:'potential interface only',gate:'unknown until event/control input',flow:'never inferred from visible geometry'},nodes:nodes.length,edges:edges.length}}
