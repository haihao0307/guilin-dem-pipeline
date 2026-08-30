/* v3.6.1 hierarchy contract repair: preserve compound karst masses while keeping every classified peak inside the approved height-footprint envelope. */

const detectPeaksRichV361Base=detectPeaksRichV330;
detectPeaksRichV330=function(analysis,maxPeaks=46){
  const peaks=detectPeaksRichV361Base(analysis,maxPeaks);
  for(const peak of peaks){
    const previous=Math.max(.05,peak.ratio||1),minimum=peak.kindV360==='tower'?1.22:peak.kindV360==='compound'?1.02:.94,maximum=peak.kindV360==='tower'?1.94:peak.kindV360==='compound'?1.48:1.24,next=clamp(previous,minimum,maximum),radiusScale=previous/next;
    peak.ratio=next;peak.radiusX*=radiusScale;peak.radiusY*=radiusScale;
  }
  return peaks;
};
detectPeaks=function(analysis,maxPeaks=46){const peaks=detectPeaksRichV330(analysis,maxPeaks);state.contextPeaksV346=peaks;return peaks};

const makeQAV361Base=makeQA;
makeQA=function(build){
  const qa=makeQAV361Base(build);qa.richTerrainPass='v3.6.1';qa.karstHierarchyRatioEnvelope=[.94,1.94];qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

const buildPresetV361Base=buildPreset;
buildPreset=async function(id,options={}){
  const result=await buildPresetV361Base(id,options);if(window.__terrainV320QA?.ready)window.__terrainV320QA.richTerrainPass='v3.6.1';return result;
};

document.title='小王 · 桂林多场地貌蒸馏实验室 v3.6.1';
const brandSmallV361=document.querySelector('.brand small');if(brandSmallV361)brandSmallV361.textContent='XIAOWANG · GUILIN MULTI-FIELD TERRAIN DISTILLATION v3.6.1';
