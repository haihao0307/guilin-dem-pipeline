'use strict';
const K=require('./karst_living_r1.js');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};

// Synthetic limestone slab with one spherical cave. Negative = rock, positive = void.
function sdf(x,y,z){
  const slab=Math.max(y-12,-8-y); // rock between -8 and 12
  const cave=Math.hypot(x,y-2,z)-2.8; // negative inside cavity
  return Math.max(slab,-cave); // subtract cave from rock
}

const anchors=[
  {x:0,z:0},{x:.7,z:.2},{x:-.8,z:.25},{x:.35,z:-.75},
  {x:1.2,z:.4},{x:-1.1,z:-.5},{x:3.8,z:0} // last should not reach cave roof
];
const args={sdf,anchors,seed:83,stage:.72,yTop:16,yBottom:-6,scanStep:.18,inputWater:1,maxSites:5,catchmentRadius:1.4,catchmentSamples:8,
  fractureField:(x,y,z)=>Math.max(0,Math.min(1,.55+.08*Math.sin(x*.7+z))),
  vulnerabilityField:(x,y,z)=>.68};
const a=K.buildDripSites(args), b=K.buildDripSites(args);
assert(JSON.stringify(a)===JSON.stringify(b),'same inputs must be bit-stable');
assert(a.sites.length>0&&a.sites.length<=5,'must select a small tracked site set');
assert(a.sites.every(s=>s.surfaceY>s.roofY),'surface must remain above cave roof');
assert(a.sites.every(s=>s.path.length===7),'each site needs a traceable infiltration path');
assert(Math.abs(a.totals.waterIn-1)<1e-9,'selected sites must share one water budget');
assert(a.totals.massBalanceError<1e-10,'calcite deposit and outgoing load must conserve dissolved-load proxy');
assert(K.checkInvariants(a,1e-9).passed,'invariants must pass');

const early=K.buildDripSites({...args,stage:.2});
const late=K.buildDripSites({...args,stage:.9});
assert(late.totals.dissolution>early.totals.dissolution,'relative stage must be reversible/monotone for dissolution proxy');
assert(late.totals.deposit>early.totals.deposit,'relative stage must be reversible/monotone for deposition proxy');
assert(late.calibratedYears===false,'must not claim geological years');
assert(late.geometryReadOnly===true,'process layer must not mutate macro geometry');

console.log(JSON.stringify({passed:true,version:K.VERSION,sites:a.sites.map(s=>s.id),totals:a.totals},null,2));
