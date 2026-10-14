// 0.65 is the user's calibration for this frozen person, not a biological constant.
export const NATIVE_CLOSURE_LIMIT=.65;
export function closureWeight(value){if(!Number.isFinite(value)||value<0||value>1)throw Error('闭眼值必须在 0–1');return value*NATIVE_CLOSURE_LIMIT;}
export function lashEnvelope(u){if(!Number.isFinite(u)||u<0||u>1)throw Error('睫毛位置必须在 0–1');return .22+.78*Math.pow(Math.sin(Math.PI*u),1.8);}
export function polylineLength(points){let sum=0;for(let i=1;i<points.length;i++)sum+=Math.hypot(...points[i].map((v,k)=>v-points[i-1][k]));return sum;}
export function normalizeLength(points,length){const actual=polylineLength(points);if(!(actual>0&&length>0))throw Error('睫毛长度必须大于零');const root=points[0],scale=length/actual;return points.map(p=>p.map((v,k)=>root[k]+(v-root[k])*scale));}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
// Authored reference baseline, NOT universal human constants or a scanned follicle map.
export function domainWidth(u){u=clamp(u);return Math.pow(smooth(0,.045,u),.5)*Math.pow(1-smooth(.90,1,u),.65)*(1-.79*smooth(.48,1,u))*(.88+.12*Math.sin(Math.PI*clamp(u/.62)));}
export const BROW_REGIONS=Object.freeze([{id:'head',label:'眉头',a:0,b:.15,color:'#e7b974'},{id:'body',label:'眉身',a:.15,b:.75,color:'#73cbc5'},{id:'tail',label:'眉尾',a:.75,b:1,color:'#bca5e5'}]);
