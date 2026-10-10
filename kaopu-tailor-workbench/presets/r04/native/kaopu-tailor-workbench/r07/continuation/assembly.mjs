import {prepareAssembly} from '../assembly.mjs';
export function prepareContinuationAssembly(spec,body){
 const ids=new Set(spec.source.continuationExplicitPlacementPanels||[]),explicit=new Map();
 for(const panel of spec.panels)if(ids.has(panel.id))explicit.set(panel.id,[...panel.source.originalPlacement.translationMm]);
 prepareAssembly(spec,body);
 for(const panel of spec.panels)if(explicit.has(panel.id))panel.placement.translationMm=[...explicit.get(panel.id)];
 spec.source.r07Preparation.explicitEditedPlacementsPreserved=[...explicit.keys()];
 spec.source.r07Preparation.explicitPlacementCollisionAccepted=false;
}
