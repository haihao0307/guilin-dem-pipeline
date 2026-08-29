/* v3.3.2 watertight river repair: preserve broad valley form while sealing every water cross-section. */
const prepareRiverSectionsV332Base=prepareRiverSections;
prepareRiverSections=function(riverModel,localCenter,extent,data,candidate){
  const sections=prepareRiverSectionsV332Base(riverModel,localCenter,extent,data,candidate);
  if(!sections?.length)return sections;
  for(const section of sections)section.width=clamp(section.width,86,188);
  state.richRiverSections=sections;
  return sections;
};

carveRiverSampleV322=function(base,nearest,edge=1){
  if(!nearest)return{height:base,q:Infinity,clearance:0};
  const section=nearest.section,q=nearest.distance/(section.width*.5),channel=clamp(1-q,0,1),clearance=.42+3.18*Math.pow(channel,1.32);
  if(q<=1){
    const target=section.water-clearance;
    return{height:state.enhanceMix>0?Math.min(base,target):base,q,clearance};
  }
  const bankBlend=1-smoothstep(1.0,2.05,q);
  if(bankBlend<=0)return{height:base,q,clearance:0};
  const outer=smoothstep(1.0,2.05,q),curve=Math.min(1,Math.abs(section.curvature||0)*32),bankRise=1.15+outer*(6.1+curve*2.1);
  const target=section.water+bankRise,strength=state.enhanceMix*state.river*bankBlend*.78*edge;
  return{height:lerp(base,Math.min(base,target),strength),q,clearance:0};
};

const makeQAV332Base=makeQA;
makeQA=function(build){
  const qa=makeQAV332Base(build);
  qa.richTerrainPass='v3.3.2';
  qa.riverBedSeal='hard-cross-section-clearance';
  qa.riverWidthEnvelopeMeters=[86,188];
  return qa;
};

document.title='小王 · 桂林丰富地形蒸馏实验室 v3.3.2';
const brandSmallV332=document.querySelector('.brand small');if(brandSmallV332)brandSmallV332.textContent='XIAOWANG · GUILIN RICH TERRAIN DISTILLATION v3.3.2';
