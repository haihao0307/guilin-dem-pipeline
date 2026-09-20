export const VERSION='R045.02';
export const WORLD={x0:-240,x1:240,z0:-320,z1:210,slope0:-175,slope1:20,plain1:150,river0:154,river1:188};
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));
function Hs(x,z){const v=Math.sin(x*127.1+z*311.7)*43758.5453123;return v-Math.floor(v)}
function N(x,z){const i=Math.floor(x),j=Math.floor(z),u=S(0,1,x-i),v=S(0,1,z-j);return M(M(Hs(i,j),Hs(i+1,j),u),M(Hs(i,j+1),Hs(i+1,j+1),u),v)}
function F(x,z,L=5,b=.0046){let s=0,a=.5,n=0;for(let i=0;i<L;i++){const k=2**i;s+=a*(N((x+.12*z)*b*k,(z-.07*x)*b*k)-.5)*2;n+=a;a*=.5}return s/n}
function D(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return Math.hypot(px-x,pz-z)}
function DP(x,z,p){let d=1e9;for(let i=0;i<p.length-1;i++)d=Math.min(d,D(x,z,p[i],p[i+1]));return d}
function signedDistanceToPolyline(x,z,p){let best=1e9,side=1;for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz||1,t=C(((x-a[0])*dx+(z-a[1])*dz)/len2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t),dd=Math.hypot(x-qx,z-qz);if(dd<best){best=dd;side=Math.sign(dx*(z-qz)-dz*(x-qx))||1}}return best*side}
const P=[[-205,-273,54,48,40],[-154,-286,79,59,48],[-94,-259,66,53,43],[-25,-293,96,68,55],[49,-271,76,59,48],[116,-288,82,61,51],[184,-265,60,52,44]];
function PH(x,z){let h=0;for(const[cx,cz,H,rx,rz]of P){const dx=(x-cx)/rx,dz=(z-cz)/rz,r=Math.hypot(dx,dz)/(1+.08*Math.sin(Math.atan2(dz,dx)*3+cx*.01));if(r<1.5)h=Math.max(h,H*Math.pow(Math.max(0,1-r**1.52),.62))}return h}

// Hydrology-first source network. The geometry is a geomorphic carrier only; it does not imply current water state.
export const naturalStreams=[
{id:'A1',catchment:'A',o:1,depth:1.00,p:[[-198,-300],[-189,-279],[-181,-257],[-174,-236],[-169,-214]]},{id:'A2',catchment:'A',o:1,depth:.86,p:[[-133,-302],[-141,-282],[-151,-260],[-159,-238],[-169,-214]]},{id:'A',catchment:'A',o:2,depth:1.18,p:[[-169,-214],[-160,-195],[-150,-177],[-142,-160],[-136,-143],[-132,-118],[-129,-88],[-126,-58],[-123,-28],[-120,7]]},
{id:'B1',catchment:'B',o:1,depth:1.12,p:[[-50,-310],[-43,-288],[-37,-267],[-32,-244],[-27,-222]]},{id:'B2',catchment:'B',o:1,depth:.96,p:[[32,-309],[25,-288],[18,-267],[8,-246],[-1,-225],[-27,-222]]},{id:'B',catchment:'B',o:2,depth:1.34,p:[[-27,-222],[-21,-200],[-15,-181],[-9,-162],[-5,-143],[-2,-116],[2,-86],[5,-55],[3,-25],[0,8]]},
{id:'C1',catchment:'C',o:1,depth:.84,p:[[113,-302],[120,-281],[130,-260],[139,-239],[146,-218]]},{id:'C2',catchment:'C',o:1,depth:.76,p:[[190,-294],[181,-277],[169,-258],[157,-238],[146,-218]]},{id:'C',catchment:'C',o:2,depth:1.02,p:[[146,-218],[140,-198],[136,-179],[131,-160],[127,-143],[124,-115],[122,-84],[119,-53],[116,-24],[112,9]]},
{id:'G1',catchment:'A',o:1,depth:.52,p:[[-215,-164],[-203,-139],[-196,-110],[-191,-80],[-185,-49],[-177,-17]]},
{id:'G2',catchment:'B',o:1,depth:.61,p:[[57,-165],[51,-140],[48,-111],[50,-82],[55,-51],[60,-18]]},
{id:'G3',catchment:'C',o:1,depth:.47,p:[[205,-158],[193,-136],[187,-108],[184,-78],[180,-47],[174,-15]]}
];

export const divideLines=[
{id:'AB',p:[[-98,-305],[-93,-270],[-88,-235],[-80,-200],[-72,-165],[-67,-130],[-62,-95],[-57,-60],[-52,-25],[-47,10]]},
{id:'BC',p:[[70,-306],[76,-270],[79,-235],[76,-200],[70,-165],[66,-130],[63,-95],[66,-60],[72,-25],[78,10]]},
{id:'LEFT',p:[[-232,-278],[-226,-235],[-222,-190],[-217,-145],[-213,-100],[-209,-55],[-205,-10]]},
{id:'RIGHT',p:[[227,-280],[220,-235],[216,-190],[213,-145],[210,-100],[206,-55],[202,-10]]}
];

export const riverZ=x=>171+6.5*Math.sin((x+18)*.020)+2.8*Math.sin(x*.054),riverW=x=>8.5+1.5*Math.sin((x+30)*.022);
const highZ=x=>-126+2.7*Math.sin(x*.015)+.9*Math.sin(x*.047),footZ=x=>18+2.4*Math.sin((x+10)*.016)+.8*Math.sin(x*.049),mainZ=x=>48+3.1*Math.sin((x-15)*.014)+Math.sin(x*.043),colZ=x=>139+2.7*Math.sin((x+22)*.013)+.8*Math.sin(x*.050);
const across=(f,n=33,a=-205,b=205)=>Array.from({length:n},(_,i)=>{const x=M(a,b,i/(n-1));return[x,f(x)]}),conn=(a,b,n=7,bend=0)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return[M(a[0],b[0],t)+bend*Math.sin(Math.PI*t),M(a[1],b[1],t)]});
const sx=[-165,-112,-58,-6,48,104,160],SD=sx.map((x,i)=>conn([x,highZ(x)],[x,footZ(x)],15,(i-3)*.7)),PL=sx.map((x,i)=>conn([x,mainZ(x)],[x,colZ(x)],15,(i-3)*.45));

export const fanHeads=[
{id:'FAN-A',x:-120,z:-8,azimuth:.10,amp:2.45,length:86,width0:8,width1:46},
{id:'FAN-B',x:0,z:-8,azimuth:-.035,amp:2.95,length:94,width0:9,width1:54},
{id:'FAN-C',x:112,z:-8,azimuth:.07,amp:2.10,length:82,width0:8,width1:42}
];
function fanContribution(x,z,f){const dz=z-f.z;if(dz<-30||dz>f.length)return 0;const along=Math.max(0,dz),cx=f.x+Math.tan(f.azimuth)*along,width=M(f.width0,f.width1,S(0,f.length,along)),lateral=Math.abs(x-cx);if(lateral>width)return 0;const taper=Math.pow(1-lateral/width,1.7),approach=S(-30,-4,dz),profile=f.amp*Math.exp(-along/(f.length*.52));return approach*profile*taper}

function baseSurface(x,z){if(z>=20)return 1.3-.007*(z-20)+.1*Math.sin(x*.011)+.05*F(x,z,3,.009);const t=1-S(-175,20,z);return 1.35+30.5*t**1.18+3.2*Math.exp(-1*((x+12)/190)**2)*t**.9+1.45*F(x,z,5,.0045)*(.25+.75*t)+PH(x,z)}
function valleyIncision(x,z){let v=0;for(const s of naturalStreams){const d=DP(x,z,s.p),width=4.6+1.55*s.o+(z>-150?1.2:0),down=S(-285,5,z),strength=(.75+1.25*down)*(1+.42*(s.o-1))*s.depth;const exitTaper=1-.72*S(-38,12,z);v+=G(d,width)*strength*exitTaper}return v}
function divideUplift(x,z){if(z>15||z<-290)return 0;const t=S(-285,-220,z)*(1-S(-15,20,z));let u=0;for(const d of divideLines){const sd=signedDistanceToPolyline(x,z,d.p),dist=Math.abs(sd),sideBias=d.id==='AB'?(.82+.18*Math.tanh(sd/18)):d.id==='BC'?(1.04-.16*Math.tanh(sd/20)):1;u+=G(dist,16.5)*1.55*sideBias}return u*t}
function shoulderBreaks(x,z){if(z<-170||z>18)return 0;const band=.5+.5*Math.sin((z+150)*.075+F(x,z,2,.015)*1.6);const lateral=.65+.35*Math.sin(x*.022+z*.006);return .78*band*lateral*S(-165,-135,z)*(1-S(8,22,z))}
function fanApron(x,z){let s=0;for(const f of fanHeads)s+=fanContribution(x,z,f);return s}

export function height(x,z){let y=baseSurface(x,z);y+=divideUplift(x,z);y+=shoulderBreaks(x,z);y-=valleyIncision(x,z);if(z>=-45&&z<=100)y+=fanApron(x,z);y-=Math.exp(-1*((z-footZ(x))/8.5)**2)*.42;const rz=riverZ(x),d=Math.abs(z-rz),w=riverW(x);if(z>145)y=M(-1.05,y,S(w,w+6,d));return y}
export function slope(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return Math.hypot(dx,dz)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return Math.min(...naturalStreams.map(q=>DP(x,z,q.p)))}
export function nearestDivideDistance(x,z){return Math.min(...divideLines.map(q=>DP(x,z,q.p)))}
export function fanField(x,z){return fanApron(x,z)}

export function terracePermission(x,z){if(z<-158||z>8||Math.abs(x)>205)return 0;const g=gradient(x,z),s=g.mag;const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));const streamClear=S(7,16,nearestStreamDistance(x,z));const divideClear=S(4,10,nearestDivideDistance(x,z));const faceForward=1-S(.45,.82,Math.abs(g.dx)/(Math.abs(g.dz)+.05));const curv=1-S(.018,.065,Math.abs(curvature(x,z)));const geom=S(-152,-132,z)*(1-S(0,12,z));return C(slopeBand*streamClear*(.58+.42*divideClear)*faceForward*curv*geom,0,1)}
export function suitability(x,z){if(z>=150||z<-175)return 0;const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s),src=z<-115?nearestStreamDistance(x,z):999,sp=1-S(7,18,src),rp=z>135?1-S(riverW(x)+4,riverW(x)+18,Math.abs(z-riverZ(x))):0;return C(base*(1-.82*sp)*(1-.95*rp),0,1)}

export const nodes=[{id:'SRC-A',k:'source'},{id:'SRC-B',k:'source'},{id:'SRC-C',k:'source'},{id:'HIGH',k:'control_volume'},{id:'FOOT',k:'control_volume'},{id:'MAIN',k:'control_volume'},{id:'COL',k:'control_volume'},{id:'RIVER',k:'receiver'},...sx.map((_,i)=>({id:`SD${i+1}`,k:'control_volume'})),...sx.map((_,i)=>({id:`PL${i+1}`,k:'control_volume'}))];
export const edges=[];const E=(id,k,from,to,p,o,permit=true,role='transfer')=>edges.push({id,k,from,to,p,o,transportPermitted:permit,currentGateState:null,currentFlowM3s:null,storedVolumeM3:null,eventState:'not-supplied',role});
for(const s of naturalStreams)E(`NS-${s.id}`,'natural_stream',null,null,s.p,s.o,false,'geomorphic');
E('HIGH-GEOM','carrier',null,null,across(highZ),3,false,'carrier_geometry');E('FOOT-GEOM','carrier',null,null,across(footZ),3,false,'carrier_geometry');E('MAIN-GEOM','carrier',null,null,across(mainZ),3,false,'carrier_geometry');E('COL-GEOM','carrier',null,null,across(colZ),3,false,'carrier_geometry');E('RIVER-GEOM','receiver',null,'RIVER',across(riverZ,49,-230,230),4,false,'receiver_geometry');
for(const[id,x,b]of[['A',-136,3],['B',-5,0],['C',127,-3]])E(`CAP-${id}`,'source_capture',`SRC-${id}`,'HIGH',conn([x,-143],[x,highZ(x)],6,b),3);
for(let i=0;i<7;i++){E(`HIGH-SD${i+1}`,'distribution','HIGH',`SD${i+1}`,conn([0,highZ(0)],SD[i][0],8,(i-3)*.6),3);E(`SD${i+1}-FOOT`,'slope_distributor',`SD${i+1}`,'FOOT',SD[i],2)}
for(const[i,x]of[[1,-120],[2,0],[3,120]])E(`FOOT-MAIN${i}`,'foothill_transfer','FOOT','MAIN',conn([x,footZ(x)],[x,mainZ(x)],7,i===1?-2:i===3?2:0),3);
for(let i=0;i<7;i++){E(`MAIN-PL${i+1}`,'distribution','MAIN',`PL${i+1}`,conn([0,mainZ(0)],PL[i][0],8,(i-3)*.5),3);E(`PL${i+1}-COL`,'plain_lateral',`PL${i+1}`,'COL',PL[i],2)}
for(const[i,x]of[[1,-125],[2,0],[3,125]])E(`COL-RIVER${i}`,'collector_to_river','COL','RIVER',conn([x,colZ(x)],[x,riverZ(x)-riverW(x)*.25],7,i===1?-2:i===3?2:0),3);

export function geomorphologyAt(x,z){const g=gradient(x,z);return{height:height(x,z),slope:g.mag,curvature:curvature(x,z),streamDistance:nearestStreamDistance(x,z),divideDistance:nearestDivideDistance(x,z),fanDepositProxy:fanField(x,z),terracePermission:terracePermission(x,z)} }
export function snapshot(){return{version:VERSION,composition:['rear_mountains','single_forward_slope','foothill_fan_apron','broad_plain','front_river'],geomorphicFields:['catchment_asymmetry','stream_distance','divide_distance','valley_incision','ridge_uplift','foothill_fan_proxy','terrace_permission'],physicsClaims:{realWeather:false,realSoilExchange:false,realGateStates:false,realFlowRates:false,regionalMicrotopography:false,sedimentTransportSimulation:false},waterSemantics:{permission:'potential interface only',gate:'unknown until event/control input',flow:'never inferred from visible geometry'},nodes:nodes.length,edges:edges.length}}
