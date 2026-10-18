import {rebuildSourceRod} from './rules/rod/generator.mjs';
import {rebuildSourceWheel} from './rules/wheel/wheel-surface-rules.mjs';
export function applyRebuilds(T,source,candidateNodes){
 const originals={};for(const id of [8,9,10])originals[id]=source.nodes[id].geometry;
 const wheel=rebuildSourceWheel(T,originals);
 const rod=rebuildSourceRod(T,source.nodes[103].geometry);
 for(const [id,g]of Object.entries(wheel.geometriesByNode))candidateNodes.get(Number(id)).geometry=g;
 candidateNodes.get(103).geometry=rod.geometry;
 return{wheel:wheel.report,rod:rod.report,summary:{changedGeometryNodes:[8,9,10,103],unchangedOtherPrimitiveCount:196,completeWheelGenerated:false,completeRodGenerated:false,originalMaterialsRetained:true,sourceUnitsNotMetres:true,sourceEccentricAxleEndCapsAndUnconvertedRodDetailsRetained:true,hub21StationPatchGenerated:true,animationMode:"originalCurvesReplayedIdenticallyNotReconstructed",wheelTopologyNormalsUV:"sourceRetained",conversionStage:"partialShapeFunctionsWithExplicitSourceFallback",sourceTrianglesNeverRemovedWithoutReplacement:true}};
}
