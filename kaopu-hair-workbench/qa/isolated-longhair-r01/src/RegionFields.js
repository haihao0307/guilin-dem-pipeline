/** R03 artistic region fields in fixed GNM native coordinates. Not anatomical
 * segmentation or universal human density measurements. Never use region 255
 * as a scalp label. Pinna guard is a conservative neutral-geometry approximation. */
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export function pinnaMargin([x,y,z]){const lateral=smooth(.058,.068,Math.abs(x));const d=Math.hypot((y-.277)/.041,(z-.021)/.034);return .05*(1-lateral)+(d-1.09)*.034*lateral;}
export function scalpPinnaMargin([x,y,z]){const lateral=smooth(.061,.070,Math.abs(x)),d=Math.hypot((y-.274)/.032,(z-.017)/.024);return .05*(1-lateral)+(d-1.06)*.024*lateral;}
export function scalpMargin(p){const [x,y,z]=p,a=Math.abs(x),front=smooth(.035,.095,z),rear=1-smooth(-.055,.005,z),side=smooth(.052,.075,a),temple=Math.exp(-(((z-.047)/.024)**2))*side;const napeDrop=.029*(1-smooth(.036,.068,a))+.010*smooth(.036,.068,a);const scallop=(.0012*Math.sin(x*55+.6)-.003*Math.exp(-(((x+.026)/.018)**2))+.0015*Math.exp(-(((x-.032)/.016)**2)))*rear;const base=.268+.075*front-.015*rear-.006*side*rear-.009*temple-napeDrop*rear+scallop;return Math.min(y-base,scalpPinnaMargin(p));}
export function scalpZone([x,y,z]){if(y>.343)return 'crown';if(z>.055)return 'frontal';if(z<-.035)return y<.295?'nape':'occipital';return z<.008?'retroauricular':'temple';}
export function scalpDensity(p){const [,y,z]=p,back=1-smooth(-.05,-.02,z),front=smooth(.035,.075,z),crown=smooth(.33,.355,y),nape=1-smooth(.28,.31,y);let v=.8+.12*smooth(-.004,.022,z);v=v*(1-back)+(1-.35*nape)*back;v=v*(1-front)+1.3*front;return v*(1-crown)+1.18*crown;}
export function beardField(p){const[x,y,z]=p,a=Math.abs(x),edge=(lo,hi,v,w=.004)=>smooth(lo,lo+w,v)*(1-smooth(hi-w,hi,v));if(pinnaMargin(p)<.001||z<.025)return {weight:0,zone:0};const zones=[
 {zone:4,weight:edge(.059,.085,a)*edge(.239,.307,y)*edge(.029,.076,z)},
 {zone:3,weight:edge(.027,.078,a)*edge(.222,.276-.18*a,y)*smooth(.034,.065,z)*.72},
 {zone:2,weight:edge(.026,.085,a)*edge(.177+.25*a,.239,y)*smooth(.022,.045,z)*.92},
 {zone:0,weight:edge(-.037,.037,x)*edge(.177,.223,y)*smooth(.077,.096,z)},
 {zone:1,weight:edge(-.029,.029,x)*edge(.232,.252-.27*a,y)*smooth(.10,.118,z)}
 ];return zones.reduce((a,b)=>b.weight>a.weight?b:a,{weight:0,zone:0});}
export const ZONE_NAMES=['chin','moustache','jaw','cheek','sideburn'];
