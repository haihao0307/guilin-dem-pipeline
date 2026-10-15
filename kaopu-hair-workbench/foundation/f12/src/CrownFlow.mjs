import {mul,mix,unit,smooth} from './approved/LegacyFoundation.mjs';
export function partCenter(z,recipe){return recipe.partMM*.001+.0018*Math.sin((z+.018)*32)+.00065*Math.sin(z*79+.7);}
export function crownVector(c,recipe,id){
 const part=partCenter(c[2],recipe),dx=c[0]-part,front=smooth((c[2]+.005)/.070),side=Math.tanh((dx+.0007*Math.sin(c[2]*173+c[0]*97))/.0022),rx=c[0]-recipe.whorlXMM*.001,rz=c[2]-recipe.whorlZMM*.001,r=Math.hypot(rx,rz),swirl=recipe.whorlTurn*Math.PI/180*Math.exp(-r/.045);
 let d=[side*.10,-.025,.018];
 const radial=unit([rx-rz*swirl,-.020,rz+rx*swirl]);d=mix(mul(radial,.10),d,front);
 if(id==='bang-sweep')d=mix(d,[-.075,-.035,.045],.55);
 if(id==='bang-wisps')d=mix(d,[.012,-.06,.035],.35);
 return d;
}
