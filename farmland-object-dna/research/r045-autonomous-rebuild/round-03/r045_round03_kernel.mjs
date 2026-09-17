export const VERSION='R045.03';
export const WORLD={x0:-240,x1:240,z0:-320,z1:210,slope0:-175,slope1:20,plain1:150,river0:154,river1:188};
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));
function Hs(x,z){const v=Math.sin(x*127.1+z*311.7)*43758.5453123;return v-Math.floor(v)}
function N(x,z){const i=Math.floor(x),j=Math.floor(z),u=S(0,1,x-i),v=S(0,1,z-j);return M(M(Hs(i,j),Hs(i+1,j),u),M(Hs(i,j+1),Hs(i+1,j+1),u),v)}
function F(x,z,L=5,b=.0046){let s=0,a=.5,n=0;for(let i=0;i<L;i++){const k=2**i;s+=a*(N((x+.12*z)*b*k,(z-.07*x)*b*k)-.5)*2;n+=a;a*=.5}return s/(n||1)}
function D(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return Math.hypot(px-x,pz-z)}
function DP(x,z,p){let d=1e9;for(let i=0;i<p.length-1;i++)d=Math.min(d,D(x,z,p[i],p[i+1]));return d}
function signedDistanceToPolyline(x,z,p){let best=1e9,side=1;for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz||1,t=C(((x-a[0])*dx+(z-a[1])*dz)/len2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t),dd=Math.hypot(x-qx,z-qz);if(dd<best){best=dd;side=Math.sign(dx*(z-qz)-dz*(x-qx))||1}}return best*side}
function interpZAtX(path,x){if(x<=path[0][0])return path[0][1];if(x>=path.at(-1)[0])return path.at(-1)[1];for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1];if(x>=a[0]&&x<=b[0])return M(a[1],b[1],(x-a[0])/(b[0]-a[0]));}return path.at(-1)[1]}

// Round 03 correction: mountains are a connected crest/saddle/spur system, not a row of radial peak blobs.
export const mainRidge=[[-238,-286],[-211,-297],[-178,-304],[-146,-293],[-112,-300],[-77,-311],[-39,-306],[-2,-314],[37,-306],[72,-292],[107,-300],[145,-310],[182,-301],[214,-290],[238,-286]];
export const saddleXs=[-146,72];
export const spurRidges=[
{id:'AB-SPUR',p:[[-112,-300],[-106,-268],[-101,-233],[-96,-198],[-91,-161],[-87,-123],[-82,-82],[-78,-36],[-76,6]],amp:3.3,width:19},
{id:'BC-SPUR',p:[[44,-304],[47,-272],[50,-238],[52,-205],[55,-169],[57,-131],[60,-92],[62,-50],[66,6]],amp:3.8,width:20},
{id:'A-OUTER',p:[[-218,-294],[-211,-255],[-205,-215],[-202,-173],[-201,-127],[-198,-78],[-193,-24]],amp:2.0,width:18},
{id:'C-OUTER',p:[[211,-291],[207,-254],[202,-216],[198,-176],[196,-132],[193,-86],[190,-32]],amp:2.15,width:18}
];
export const ridgeCrestZ=x=>interpZAtX(mainRidge,x);
function crestAmplitude(x){
  let a=41+7*Math.sin((x+28)*.015)+4*Math.sin((x-40)*.041);
  // Real saddles are lowered sections of the same ridge, not gaps between disconnected mountains.
  a-=10*G(x+146,24);a-=10*G(x-72,22);
  a+=6*G(x+58,34)+5*G(x-155,36);
  return a;
}
function rearMountainMass(x,z){
  const d=DP(x,z,mainRidge),amp=crestAmplitude(x),width=58+8*(.5+.5*Math.sin(x*.019));
  const ridge=amp*G(d,width);
  // A broad backing mass prevents the crest from reading like a thin wall.
  const back=6*G(z-(ridgeCrestZ(x)-18),92)*(1-S(-205,-165,z));
  let spurs=0;for(const r of spurRidges)spurs+=.78*r.amp*G(DP(x,z,r.p),r.width+5)*S(-292,-245,z)*(1-S(-5,18,z));
  return ridge+back+spurs;
}

// Irregular headwater organization: A and B have two first-order heads; C has three.
export const naturalStreams=[
{id:'A1',catchment:'A',o:1,depth:1.00,p:[[-221,-281],[-207,-268],[-194,-252],[-181,-238],[-169,-224],[-158,-211]]},
{id:'A2',catchment:'A',o:1,depth:.84,p:[[-147,-280],[-151,-264],[-154,-247],[-156,-229],[-158,-211]]},
{id:'A',catchment:'A',o:2,depth:1.21,p:[[-158,-211],[-153,-192],[-147,-174],[-141,-154],[-136,-132],[-132,-107],[-129,-78],[-126,-47],[-122,-17],[-118,7]]},
{id:'B1',catchment:'B',o:1,depth:1.10,p:[[-77,-294],[-69,-278],[-62,-260],[-55,-242],[-49,-223]]},
{id:'B2',catchment:'B',o:1,depth:.92,p:[[4,-299],[-5,-282],[-15,-264],[-27,-244],[-49,-223]]},
{id:'B',catchment:'B',o:2,depth:1.38,p:[[-49,-223],[-47,-201],[-44,-180],[-41,-157],[-38,-133],[-35,-106],[-32,-78],[-29,-48],[-24,-18],[-18,8]]},
{id:'C1',catchment:'C',o:1,depth:.78,p:[[86,-282],[99,-267],[110,-252],[121,-238],[132,-224]]},
{id:'C2',catchment:'C',o:1,depth:.94,p:[[151,-291],[147,-273],[143,-255],[139,-238],[132,-224]]},
{id:'C3',catchment:'C',o:1,depth:.67,p:[[218,-279],[202,-266],[185,-252],[169,-239],[151,-225],[132,-224]]},
{id:'C',catchment:'C',o:2,depth:1.05,p:[[132,-224],[133,-203],[132,-181],[130,-158],[128,-134],[126,-106],[124,-78],[121,-49],[117,-20],[112,8]]},
{id:'G1',catchment:'A',o:1,depth:.49,p:[[-226,-171],[-216,-148],[-207,-122],[-199,-94],[-190,-63],[-181,-30],[-172,-12]]},
{id:'G2',catchment:'B',o:1,depth:.63,p:[[30,-166],[27,-143],[28,-118],[32,-91],[38,-62],[44,-34],[51,-15]]},
{id:'G3',catchment:'C',o:1,depth:.43,p:[[211,-153],[199,-132],[191,-108],[186,-82],[181,-55],[174,-28],[168,-12]]}
];

export const divideLines=[
{id:'AB',p:[[-112,-300],[-106,-268],[-101,-233],[-96,-198],[-91,-161],[-87,-123],[-82,-82],[-78,-36],[-76,8]]},
{id:'BC',p:[[44,-304],[47,-272],[50,-238],[52,-205],[55,-169],[57,-131],[60,-92],[62,-50],[66,8]]},
{id:'LEFT',p:[[-232,-282],[-226,-245],[-220,-205],[-216,-162],[-212,-118],[-207,-72],[-202,-22]]},
{id:'RIGHT',p:[[228,-282],[220,-246],[215,-208],[211,-167],[207,-124],[202,-79],[197,-28]]}
];

export const riverZ=x=>171+6.5*Math.sin((x+18)*.020)+2.8*Math.sin(x*.054),riverW=x=>8.5+1.5*Math.sin((x+30)*.022);
const highZ=x=>-126+2.7*Math.sin(x*.015)+.9*Math.sin(x*.047),footZ=x=>18+2.4*Math.sin((x+10)*.016)+.8*Math.sin(x*.049),mainZ=x=>48+3.1*Math.sin((x-15)*.014)+Math.sin(x*.043),colZ=x=>139+2.7*Math.sin((x+22)*.013)+.8*Math.sin(x*.050);
const across=(f,n=33,a=-205,b=205)=>Array.from({length:n},(_,i)=>{const x=M(a,b,i/(n-1));return[x,f(x)]}),conn=(a,b,n=7,bend=0)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return[M(a[0],b[0],t)+bend*Math.sin(Math.PI*t),M(a[1],b[1],t)]});
const sx=[-173,-124,-70,-16,42,105,166],SD=sx.map((x,i)=>conn([x,highZ(x)],[x,footZ(x)],15,(i-3)*.7)),PL=sx.map((x,i)=>conn([x,mainZ(x)],[x,colZ(x)],15,(i-3)*.45));

export const fanHeads=[
{id:'FAN-A',x:-118,z:-8,azimuth:.10,amp:2.45,length:86,width0:8,width1:46},
{id:'FAN-B',x:-18,z:-8,azimuth:-.035,amp:2.95,length:94,width0:9,width1:54},
{id:'FAN-C',x:112,z:-8,azimuth:.07,amp:2.10,length:82,width0:8,width1:42}
];
function fanContribution(x,z,f){const dz=z-f.z;if(dz<-30||dz>f.length)return 0;const along=Math.max(0,dz),cx=f.x+Math.tan(f.azimuth)*along,width=M(f.width0,f.width1,S(0,f.length,along)),lateral=Math.abs(x-cx);if(lateral>width)return 0;const taper=Math.pow(1-lateral/width,1.7),approach=S(-30,-4,dz),profile=f.amp*Math.exp(-along/(f.length*.52));return approach*profile*taper}
function baseSurface(x,z){if(z>=20)return 1.3-.007*(z-20)+.1*Math.sin(x*.011)+.05*F(x,z,3,.009);const t=1-S(-175,20,z);return 1.35+30.5*t**1.18+3.2*Math.exp(-1*((x+12)/190)**2)*t**.9+1.15*F(x,z,5,.0045)*(.25+.75*t)+rearMountainMass(x,z)}
function valleyIncision(x,z){let v=0;for(const s of naturalStreams){const d=DP(x,z,s.p),width=4.4+1.55*s.o+(z>-150?1.2:0),down=S(-292,5,z),strength=(.70+1.27*down)*(1+.42*(s.o-1))*s.depth;const exitTaper=1-.72*S(-38,12,z);v+=G(d,width)*strength*exitTaper}return v}
function divideUplift(x,z){if(z>15||z<-300)return 0;const t=S(-300,-245,z)*(1-S(-15,20,z));let u=0;for(const d of divideLines){const sd=signedDistanceToPolyline(x,z,d.p),dist=Math.abs(sd),bias=d.id==='AB'?(.82+.18*Math.tanh(sd/18)):d.id==='BC'?(1.04-.16*Math.tanh(sd/20)):1;u+=G(dist,17.5)*1.48*bias}return u*t}
function shoulderBreaks(x,z){if(z<-178||z>18)return 0;const a=1.00*G(DP(x,z,[[-186,-150],[-176,-112],[-165,-74],[-151,-32]]),32);const b=.82*G(DP(x,z,[[-68,-155],[-60,-118],[-53,-80],[-46,-38]]),28);const c=1.12*G(DP(x,z,[[82,-154],[91,-118],[98,-78],[104,-35]]),34);const taper=S(-174,-148,z)*(1-S(6,22,z));return (a+b+c)*taper}
function fanApron(x,z){let s=0;for(const f of fanHeads)s+=fanContribution(x,z,f);return s}

export function height(x,z){let y=baseSurface(x,z);y+=divideUplift(x,z);y+=shoulderBreaks(x,z);y-=valleyIncision(x,z);if(z>=-45&&z<=100)y+=fanApron(x,z);y-=Math.exp(-1*((z-footZ(x))/8.5)**2)*.42;const rz=riverZ(x),d=Math.abs(z-rz),w=riverW(x);if(z>145)y=M(-1.05,y,S(w,w+6,d));return y}
export function slope(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return Math.hypot(dx,dz)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return Math.min(...naturalStreams.map(q=>DP(x,z,q.p)))}
export function nearestDivideDistance(x,z){return Math.min(...divideLines.map(q=>DP(x,z,q.p)))}
export function fanField(x,z){return fanApron(x,z)}
export function terracePermission(x,z){if(z<-158||z>8||Math.abs(x)>205)return 0;const g=gradient(x,z),s=g.mag;const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));const streamClear=S(7,16,nearestStreamDistance(x,z));const divideClear=S(5,12,nearestDivideDistance(x,z));const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));const curv=1-S(.018,.060,Math.abs(curvature(x,z)));const geom=S(-152,-132,z)*(1-S(0,12,z));return C(slopeBand*streamClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1)}
export function suitability(x,z){if(z>=150||z<-175)return 0;const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s),src=z<-115?nearestStreamDistance(x,z):999,sp=1-S(7,18,src),rp=z>135?1-S(riverW(x)+4,riverW(x)+18,Math.abs(z-riverZ(x))):0;return C(base*(1-.82*sp)*(1-.95*rp),0,1)}

// Water-state contract remains explicit: geometry != permitted transfer != current flow/state.
export const nodes=[{id:'SRC-A',k:'source'},{id:'SRC-B',k:'source'},{id:'SRC-C',k:'source'},{id:'HIGH',k:'control_volume'},{id:'FOOT',k:'control_volume'},{id:'MAIN',k:'control_volume'},{id:'COL',k:'control_volume'},{id:'RIVER',k:'receiver'},...sx.map((_,i)=>({id:`SD${i+1}`,k:'control_volume'})),...sx.map((_,i)=>({id:`PL${i+1}`,k:'control_volume'}))];
export const edges=[];
const E=(id,k,from,to,p,o,permit=true,role='transfer')=>edges.push({id,k,from,to,p,o,transportPermitted:permit,currentGateState:null,currentFlowM3s:null,storedVolumeM3:null,eventState:'not-supplied',role});
for(const s of naturalStreams)E(`NS-${s.id}`,'natural_stream',null,null,s.p,s.o,false,'geomorphic');
E('HIGH-GEOM','carrier',null,null,across(highZ),3,false,'carrier_geometry');E('FOOT-GEOM','carrier',null,null,across(footZ),3,false,'carrier_geometry');E('MAIN-GEOM','carrier',null,null,across(mainZ),3,false,'carrier_geometry');E('COL-GEOM','carrier',null,null,across(colZ),3,false,'carrier_geometry');E('RIVER-GEOM','receiver',null,'RIVER',across(riverZ,49,-230,230),4,false,'receiver_geometry');
for(const[id,x,b]of[['A',-136,3],['B',-38,0],['C',128,-3]])E(`CAP-${id}`,'source_capture',`SRC-${id}`,'HIGH',conn([x,-143],[x,highZ(x)],6,b),3);
for(let i=0;i<7;i++){E(`HIGH-SD${i+1}`,'distribution','HIGH',`SD${i+1}`,conn([0,highZ(0)],SD[i][0],8,(i-3)*.6),3);E(`SD${i+1}-FOOT`,'slope_distributor',`SD${i+1}`,'FOOT',SD[i],2)}
for(const[i,x]of[[1,-120],[2,-18],[3,112]])E(`FOOT-MAIN${i}`,'foothill_transfer','FOOT','MAIN',conn([x,footZ(x)],[x,mainZ(x)],7,i===1?-2:i===3?2:0),3);
for(let i=0;i<7;i++){E(`MAIN-PL${i+1}`,'distribution','MAIN',`PL${i+1}`,conn([0,mainZ(0)],PL[i][0],8,(i-3)*.5),3);E(`PL${i+1}-COL`,'plain_transfer',`PL${i+1}`,'COL',PL[i],2)}
for(const[i,x]of[[1,-145],[2,8],[3,146]])E(`COL-RIVER${i}`,'drainage','COL','RIVER',conn([x,colZ(x)],[x,riverZ(x)],7,i===1?-2:i===3?2:0),3);

export const snapshot={version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,sedimentTransportSimulation:false,regionalMicrotopographyTruth:false,parcelGenerationEnabled:false,terraceGeometryEnabled:false,waterStateKnown:false};
