/** R03 pilot: authored native morphology, separate identity and adiposity.
 * R01/R02 recipes, default engine, topology and skeletal weights stay immutable.
 * All controls retain native units and semantics. No viewport/mesh scaling.
 */
import {PRESETS as R2,createPresetState as priorState} from './PresetCatalogueR2.mjs';
export const PRESET_SCHEMA='kaopu-human-preset/3-pilot';
const builds=['short-slim','tall-slim','tall-sturdy','short-heavy','rounded','sturdy'];
const stages=['child','teen','young','adult','middle','senior'];
const pair=(o,k,v)=>{o['l-'+k]=v;o['r-'+k]=v};
// Identity is independent of adiposity: a stage-dependent permutation prevents
// every rounded or lean example inheriting one shared nose/eye/mouth identity.
const identities=[
 {label:'长鼻窄颏', 'nose-scale-depth-incr':.40,'nose-scale-vert-incr':.26,'nose-scale-horiz-incr':-.27,'nose-hump-incr':.17,'chin-width-incr':-.18,'chin-height-incr':.18,'chin-prominent-incr':.15,'mouth-scale-horiz-incr':-.18,'mouth-upperlip-volume-incr':-.12,'eye-trans-out':-.11,'eye-height1-incr':-.12,'eyebrows-angle-up':.12},
 {label:'短鼻宽唇', 'nose-scale-depth-incr':-.27,'nose-scale-vert-incr':-.22,'nose-scale-horiz-incr':.32,'nose-point-up':.21,'chin-width-incr':.25,'chin-height-incr':-.16,'mouth-scale-horiz-incr':.26,'mouth-upperlip-volume-incr':.18,'mouth-lowerlip-volume-incr':.16,'eye-trans-out':.13,'eye-height1-incr':.14,'eyebrows-angle-up':-.12},
 {label:'宽颌直鼻', 'nose-scale-depth-incr':.14,'nose-scale-vert-incr':.08,'nose-scale-horiz-incr':.16,'chin-width-incr':.36,'chin-height-incr':.04,'chin-prominent-incr':.22,'mouth-scale-horiz-incr':.16,'mouth-upperlip-volume-incr':-.15,'eye-trans-out':.07,'eye-height1-incr':-.16,'eyebrows-angle-up':-.05},
 {label:'圆颏小口', 'nose-scale-depth-incr':-.12,'nose-scale-vert-incr':-.12,'nose-scale-horiz-incr':-.10,'chin-width-incr':.06,'chin-height-incr':-.20,'chin-prominent-incr':-.10,'mouth-scale-horiz-incr':-.26,'mouth-upperlip-volume-incr':.15,'mouth-lowerlip-volume-incr':.20,'eye-trans-out':-.06,'eye-height1-incr':.20,'eyebrows-angle-up':.06},
 {label:'长颏拱鼻', 'nose-scale-depth-incr':.34,'nose-scale-vert-incr':.16,'nose-curve-convex':.24,'nose-scale-horiz-incr':-.08,'chin-width-incr':-.08,'chin-height-incr':.29,'chin-prominent-incr':.24,'mouth-scale-horiz-incr':.04,'mouth-upperlip-volume-incr':-.18,'eye-trans-out':.11,'eye-height1-incr':-.07,'eyebrows-angle-up':.15},
 {label:'扁宽鼻丰唇', 'nose-scale-depth-incr':-.23,'nose-scale-vert-incr':-.06,'nose-scale-horiz-incr':.38,'nose-point-width-incr':.22,'chin-width-incr':.18,'chin-height-incr':-.04,'mouth-scale-horiz-incr':.22,'mouth-upperlip-volume-incr':.22,'mouth-lowerlip-volume-incr':.24,'eye-trans-out':-.13,'eye-height1-incr':.08,'eyebrows-angle-up':-.16},
];
function identity(i,stage){const row=identities[(i+stages.indexOf(stage)*2)%6],gain=stage==='child'?.30:stage==='teen'?.65:1,o={};for(const[k,v]of Object.entries(row)){if(k==='label')continue;if(k.startsWith('eye-'))pair(o,k,v*gain*.18);else o[k]=v*gain*(k.startsWith('mouth-')?.50:1);}return {label:row.label,changes:o};}
function physique(i,stage){const o={},child=stage==='child',teen=stage==='teen',gain=child?.20:teen?.60:stage==='senior'?.82:1,lean=i<2,heavy=i===3||i===4;
 if(lean){Object.assign(o,{'measure-shoulder-dist-incr':-.30*gain,'torso-scale-horiz-incr':-.38*gain,'measure-waist-circ-incr':-.23*gain,'torso-scale-depth-incr':-.33*gain,'hip-scale-horiz-incr':-.13*gain,'measure-neck-circ-incr':-.23*gain});pair(o,'upperarm-fat-incr',-.46*gain);pair(o,'lowerarm-fat-incr',-.30*gain);pair(o,'upperleg-fat-incr',-.45*gain);pair(o,'lowerleg-fat-incr',-.26*gain);}
 if(heavy){Object.assign(o,{'measure-shoulder-dist-incr':.04*gain,'measure-waist-circ-incr':(i===4?.94:.87)*gain,'torso-scale-depth-incr':(i===4?.66:.74)*gain,'hip-scale-horiz-incr':(i===4?.43:.30)*gain,'measure-hips-circ-incr':(i===4?.60:.39)*gain,'buttocks-volume-incr':.30*gain,'measure-neck-circ-incr':.62*gain});pair(o,'upperarm-fat-incr',.72*gain);pair(o,'lowerarm-fat-incr',.48*gain);pair(o,'upperleg-fat-incr',.70*gain);pair(o,'lowerleg-fat-incr',.43*gain);}
 if(child){o['measure-shoulder-dist-incr']=lean?-.12:0;o['torso-scale-horiz-incr']=lean?-.24:0;o['torso-scale-depth-incr']=0;o['measure-neck-circ-incr']=heavy?.06:0;}
 return o;
}
function adiposity(i,stage){const child=stage==='child',teen=stage==='teen',heavy=i===3||i===4,lean=i<2,o={};
 // Cranial width belongs to identity, never body-fat. Preserve adult cranial
 // breadth while native cheek/under-chin/neck tissues respond to body-fat.
 o['head-scale-horiz-incr']=0;
 if(child){o['head-fat-incr']=heavy?.22:.07;pair(o,'cheek-volume-incr',heavy?.10:.04);o['neck-double-incr']=heavy?.07:0;return o;}
 const g=teen?.55:1;o['head-fat-incr']=teen?(heavy?.40:lean?-.08:.05):0;pair(o,'cheek-volume-incr',(heavy?.16:lean?-.24:.06)*g);pair(o,'cheek-bones-incr',(lean?.26:heavy?-.12:.15)*g);o['neck-double-incr']=teen&&heavy?.15:0;return o;
}
export const PRESETS=Object.freeze(R2.map(p=>{const i=builds.indexOf(p.build),id=identity(i,p.stage),phenotypes={...p.phenotypes};if(p.stage!=='child'&&p.stage!=='teen'&&i<2){phenotypes.weight=.015;phenotypes.muscle=.08;}if(p.stage==='child'){phenotypes.weight=i<2?.32:i===3||i===4?.82:p.phenotypes.weight;}
 const localChanges={...p.localChanges,...physique(i,p.stage),...id.changes,...adiposity(i,p.stage)};if(p.stage==='middle'&&i===3)localChanges['mouth-scale-horiz-incr']*=.35;
 return Object.freeze({...p,id:p.id.replace('r02-','r03-'),collection:'r03-pilot',previousPresetId:p.id,adiposeAmount:p.stage==='child'||p.stage==='teen'?0:i===3?2.1:i===4?1.7:i<2?-.45:0,identityLabel:id.label,label:p.label+' · '+id.label,phenotypes:Object.freeze(phenotypes),localChanges:Object.freeze(Object.fromEntries(Object.entries(localChanges).map(([k,v])=>[k,Number(v.toFixed(5))])))});}));
export const PILOT_IDS=Object.freeze(['r03-adult-male-tall-slim','r03-adult-male-short-heavy','r03-adult-female-rounded','r03-senior-female-short-slim','r03-child-male-tall-slim','r03-child-female-rounded']);
export function createPresetState(id,defaults){const p=PRESETS.find(p=>p.id===id);if(!p)throw new RangeError('Unknown R03 preset');const s=priorState(p.previousPresetId,defaults);s.anny.phenotypes={...p.phenotypes};s.anny.localChanges={...p.localChanges};return s;}

/** Same age/sex/stature and the same nose/eye/mouth/chin identity, fat only. */
export function sameIdentityAdiposityPair(id,defaults){const p=PRESETS.find(x=>x.id===id);if(!p||['child','teen'].includes(p.stage))throw Error('Adult identity pair required');return ['lean','heavy'].map((endpoint,j)=>{const i=j?3:1,s=createPresetState(id,defaults);s.anny.phenotypes.weight=j?1:.015;s.anny.phenotypes.muscle=.25;s.anny.localChanges={...s.anny.localChanges,...physique(i,p.stage),...adiposity(i,p.stage)};return {endpoint,identityPresetId:id,state:s,amount:j?2.1:-.45};});}
