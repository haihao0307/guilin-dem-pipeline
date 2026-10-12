/** R54 integration adaptation of the R14 rest-groom field. No new roots,
 * cap mesh, texture or extra noise. Preserve the source emergence direction;
 * guide front/top mid-shafts along the side/back sweep of retained R30 lengths.
 * R14's original three presets deliberately comb the crown forward. That source
 * behavior is unsuitable as a coverage overlay on this existing long hairstyle.
 */
import {growthDirection as originalDirection,partSign} from './GroomTopology.js';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const unit=v=>{const n=Math.hypot(...v);if(!(n>1e-12))throw Error('Degenerate R54 styling field');return v.map(x=>x/n);};
export function growthDirection(p,root,d){
 const original=originalDirection(p,root,d),travelled=Math.hypot(...p.map((x,k)=>x-root[k]));
 const frontTop=smooth(.318,.357,root[1])*smooth(-.015,.026,root[2]);
 const middle=smooth(.003,.018,travelled),weight=frontTop*middle;
 if(weight===0)return original;
 // Parting affects the cross-head sweep; the negative Z component is the
 // actual source-domain back direction. Leave low temples/nape on source flow.
 const side=partSign(root,d),desired=unit([side*(.28+d.partOpen*.0035),-.12,-1]);
 return unit(original.map((x,k)=>x*(1-weight)+desired[k]*weight));
}
