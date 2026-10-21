/* Own continuous field design. No mesh/assets/animation from the teacher.
 * Official baseline datums are separate from authored, editable surface choices.
 * These candidate skins do not certify hidden mechanical construction.
 */
export const SOURCE='https://theengineer.markallengroup.com/production/2018/09/Gresley-Silver-Jubilee.pdf#page=3';
export const DIMENSIONS=Object.freeze({driverDiameter:2.032,leadingDiameter:.9652,trailingDiameter:1.1176,tenderDiameter:1.27,overBuffers:21.421725,maxWidth:2.7432,maxHeight:3.9878,axisX:[3.5814,1.6764,0,-2.2098,-4.4196,-7.3152,-10.099675,-11.699875,-13.376275,-14.976475],railGaugeTarget:1.435,wheelBackToBack:null,wheelProfile:null});
export const MATERIALS=Object.freeze([
 {name:'authored green enamel',base:[.019,.12,.075],metallic:.12,roughness:.24,clearcoat:.6,basis:'specified; not measured teacher material'},
 {name:'authored graphite roof',base:[.035,.045,.046],metallic:.12,roughness:.36,clearcoat:.15,basis:'specified'},
 {name:'authored dark glass candidate',base:[.027,.047,.054],metallic:0,roughness:.095,clearcoat:1,basis:'specified opaque optical stand-in; no transmission simulation'},
 {name:'datum brass',base:[.72,.42,.12],metallic:.7,roughness:.32,clearcoat:0,basis:'diagnostic only, not physical part'}]);
export const DEFAULTS=Object.freeze({noseSweep:0,shoulderWidth:1,paint:[.019,.12,.075],roughness:.24,cabRoofRoundness:.22,tenderShoulder:.18});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function validateParameters(p){
 for(const k of ['noseSweep','shoulderWidth','roughness','cabRoofRoundness','tenderShoulder'])if(!Number.isFinite(p[k]))throw Error('NONFINITE '+k);
 if(p.noseSweep<-.25||p.noseSweep>.25||p.shoulderWidth<.9||p.shoulderWidth>1.05||p.roughness<.08||p.roughness>.7||p.cabRoofRoundness<.08||p.cabRoofRoundness>.3||p.tenderShoulder<.08||p.tenderShoulder>.3)throw Error('OUTSIDE_AUTHORED_ENVELOPE');
 if(!Array.isArray(p.paint)||p.paint.length!==3||p.paint.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('INVALID_MATERIAL');return p;
}
export function makeParts(options={}){
 const p=validateParameters({...DEFAULTS,...options,paint:options.paint??[...DEFAULTS.paint]});
 const rows=[[-6.2,1.20,2.75,1.10],[-5.5,1.24,2.80,1.06],[-3,1.18,2.86,.98],[0,1.08,2.82,.96],[1.5,.94,2.63,.94],[2.8,.70,2.17+p.noseSweep,.80],[3.8,.34,1.64+p.noseSweep,.48],[4.4,.035,1.23,.08]].map(a=>[a[0],a[1]*p.shoulderWidth,a[2],a[3]]);
 return [
  {id:'skin.main',label:'自有连续前罩/锅炉外罩',kind:1,material:0,bounds:[[-6.2,-1.31,1.0],[4.4,1.31,3.91]],sections:rows,position:[0,0,0],size:[0,0,0],rounding:0,subtractDriverClearance:true,basis:'specified exterior design within source envelope, NOT historical profile fit'},
  {id:'skin.cab',label:'自有驾驶室外壳',kind:2,material:0,bounds:[[-8.7,-1.28,1.70],[-6.18,1.28,3.9878]],sections:[],position:[-7.44,0,2.8439],size:[1.26,1.28,1.1439],rounding:p.cabRoofRoundness,basis:'specified cab shape, official maximum height; window cuts not surveyed'},
  {id:'skin.tender',label:'自有煤水车箱体',kind:3,material:0,bounds:[[-16.25,-1.28,1.28],[-9.2,1.28,3.75]],sections:[],position:[-12.725,0,2.515],size:[3.525,1.28,1.235],rounding:p.tenderShoulder,basis:'specified continuous tank exterior, official axle anchors remain independent'},
  {id:'cab.glass.design',label:'自有侧窗材质候选',kind:4,material:2,bounds:[[-8.01,-1.281,2.82],[-6.81,1.281,3.49]],sections:[],position:[-7.41,0,3.155],size:[.60,1.281,.335],rounding:.12,basis:'specified optical stand-in, window frame and transmission unresolved'}
 ];
}
export function profileAt(part,x){
 const a=part.sections;let i=0;while(i<a.length-2&&x>a[i+1][0])i++;
 const t=clamp((x-a[i][0])/(a[i+1][0]-a[i][0]),0,1),u=t*t*(3-2*t);
 return [1,2,3].map(k=>a[i][k]*(1-u)+a[i+1][k]*u);
}
export function roundedBox(q,b,r){const d=q.map((v,i)=>Math.abs(v)-(b[i]-r));return Math.hypot(...d.map(v=>Math.max(v,0)))+Math.min(Math.max(...d),0)-r;}
export function field(part,p){
 const q=p.map((v,i)=>v-part.position[i]);let d;
 if(part.kind===1){const[w,c,h]=profileAt(part,p[0]);const radial=(Math.pow(Math.pow(Math.abs(p[1]/w),2.4)+Math.pow(Math.abs((p[2]-c)/h),2.4),1/2.4)-1)*Math.min(w,h);d=Math.max(radial,-6.2-p[0],p[0]-4.4);for(const x of [0,-2.2098,-4.4196])d=Math.max(d,1.085-Math.hypot(p[0]-x,p[2]-1.016));return d;}
 d=roundedBox(q,part.size,part.rounding);
 if(part.kind===2){const cavity=roundedBox(q,[1.15,1.17,1.02],Math.max(.03,part.rounding-.04));d=Math.max(d,-cavity);const win=roundedBox([p[0]+7.41,p[1],p[2]-3.155],[.60,2,.335],.12);d=Math.max(d,-win);}
 if(part.kind===3){const coal=roundedBox([p[0]+10.65,p[1],p[2]-3.8],[1.05,1.08,.65],.16);d=Math.max(d,-coal);}
 if(part.kind===4){d=Math.max(d,.0-(Math.abs(p[1])-1.245));}
 return d;
}
export function wheelDatums(phase=0){
 const r=[.4826,.4826,1.016,1.016,1.016,.5588,.635,.635,.635,.635];
 return DIMENSIONS.axisX.map((x,i)=>({id:i<6?'loco.axis.'+(i+1):'tender.axis.'+(i-5),center:[x,0,r[i]],radius:r[i],phase:phase*1.016/r[i],lateralWheelBack:null,profile:null,role:'analytic datum, not rendered wheel solid'}));
}
export function safetyBound(part){
 if(part.kind!==1)return 1;
 let slope=0;for(let i=0;i<part.sections.length-1;i++){const a=part.sections[i],b=part.sections[i+1],dx=b[0]-a[0];slope=Math.max(slope,1.5*(Math.abs(b[1]-a[1])+Math.abs(b[2]-a[2])+Math.abs(b[3]-a[3]))/dx);}
 // Conservative practical distance estimate, NOT a certified exact signed distance.
 return 4+4*slope;
}
