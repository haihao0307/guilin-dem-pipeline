/* v3.3.5 bounded riverbed profile: every active cross-section follows the approved depth envelope. */
carveRiverSampleV322=function(base,nearest,edge=1){
  if(!nearest)return{height:base,q:Infinity,clearance:0};
  const section=nearest.section,q=nearest.distance/(section.width*.5),channel=clamp(1-q,0,1);
  const clearance=.42+3.18*Math.pow(channel,1.32);
  if(q<=1){
    const target=section.water-clearance;
    return{height:state.enhanceMix>0?target:base,q,clearance};
  }
  const bankBlend=1-smoothstep(1.0,2.05,q);
  if(bankBlend<=0)return{height:base,q,clearance:0};
  const outer=smoothstep(1.0,2.05,q),curve=Math.min(1,Math.abs(section.curvature||0)*32);
  const bankRise=1.15+outer*(6.1+curve*2.1),target=section.water+bankRise;
  const strength=state.enhanceMix*state.river*bankBlend*.78*edge;
  return{height:lerp(base,Math.min(base,target),strength),q,clearance:0};
};

const makeQAV335Base=makeQA;
makeQA=function(build){
  const qa=makeQAV335Base(build);
  qa.richTerrainPass='v3.3.5';
  qa.riverDepthEnvelopeMeters=[.42,3.60];
  qa.riverBedProfile='bounded-cross-section-target';
  return qa;
};

document.title='小王 · 桂林丰富地形蒸馏实验室 v3.3.5';
const brandSmallV335=document.querySelector('.brand small');if(brandSmallV335)brandSmallV335.textContent='XIAOWANG · GUILIN RICH TERRAIN DISTILLATION v3.3.5';
