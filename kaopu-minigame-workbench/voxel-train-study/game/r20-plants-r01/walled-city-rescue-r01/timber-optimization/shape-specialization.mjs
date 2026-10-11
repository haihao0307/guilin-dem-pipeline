// Separate probe: no bounded-skip code is imported or combined here.
// Each program keeps only the selected ORIGINAL coordinate/noise expressions.
import {createTimberMember,Original} from '../native/timber-adapter.mjs';
import {extractShaderFunctions,replaceShaderFunction} from './shader-functions.mjs';
export const SHAPE_SPECIALIZATION_ID='original-formula-shape-specialization-v1';
const names=['sideAnisotropicNoise','sideValueNoise'];
const originals=extractShaderFunctions(Original.fragmentShaderSource);
export const shapeSourceEvidence={};
function exactlyOne(text,regex,label){const matches=[...text.matchAll(regex)];if(matches.length!==1)throw Error('Audited shape helper changed: '+label);return matches[0][0];}
function specializeFunction(name,shape){
 const original=originals.get(name)?.text;if(!original)throw Error('Missing original '+name);
 const noise=name==='sideAnisotropicNoise'?'fbm':'valueNoise';
 const originalSelection=`  return mix(${noise}(planarCoordinate), ${noise}(roundCoordinate), step(0.5, u_shapeMode));`;
 if(!original.includes(originalSelection))throw Error('Original shape-selection expression changed');
 const coordinateName=shape==='planar'?'planarCoordinate':'roundCoordinate';
 const coordinate=exactlyOne(original,new RegExp('  vec3 '+coordinateName+' = vec3\\([\\s\\S]*?\\n  \\);','g'),coordinateName);
 const prelude=shape==='planar'
  ?exactlyOne(original,/  float planarAcross = [^\n]+;\n  float planarDepth = [^\n]+;\n/g,'planar prelude')
  :exactlyOne(original,/  float theta = [^\n]+;\n/g,'round prelude');
 const selectedNoiseExpression=`${noise}(${coordinateName})`;
 if(!originalSelection.includes(selectedNoiseExpression))throw Error('Selected noise call is not original');
 const specialized=original.slice(0,original.indexOf('{')+1)+'\n'+prelude+coordinate+'\n  return '+selectedNoiseExpression+';\n}';
 shapeSourceEvidence[shape]??={};shapeSourceEvidence[shape][name]={originalSelection,selectedPrelude:prelude,selectedCoordinate:coordinate,selectedNoiseExpression,originalFunction:original,specializedFunction:specialized};
 return specialized;
}
function makeSource(shape){let shader=Original.fragmentShaderSource;for(const name of names)shader=replaceShaderFunction(shader,name,specializeFunction(name,shape));return shader;}
export const shapeSpecializedFragmentSources=Object.freeze({planar:makeSource('planar'),round:makeSource('round')});
const stripVersion=source=>source.replace(/^#version 300 es\n/,'');
const rawSources={original:stripVersion(Original.fragmentShaderSource),planar:stripVersion(shapeSpecializedFragmentSources.planar),round:stripVersion(shapeSpecializedFragmentSources.round)};
const registrations=new WeakMap();
export function shapeVariantForUniform(value){return typeof value==='number'&&Number.isFinite(value)?(value<.5?'planar':'round'):'original';}

export function specializeTimberShape(made){
 if(registrations.has(made))return made;
 if(!made?.mesh?.material||!made?.proof?.originalUniformBinding||typeof made.mesh.onBeforeRender!=='function')throw Error('Expected original createTimberMember result');
 const mesh=made.mesh,material=mesh.material;
 if(material.fragmentShader!==rawSources.original||material.vertexShader!==stripVersion(Original.vertexShaderSource))throw Error('Shape probe accepts only the unmodified original shader; do not combine with bounded skip');
 const originalHook=mesh.onBeforeRender,originalName=material.name;
 const proof={id:SHAPE_SPECIALIZATION_ID,changedFunctions:[...names],coordinateExpressionsCopiedByteForByte:true,selectedNoiseCallsOriginal:true,originalFbmAndValueNoiseUnmodified:true,originalParallaxUnmodified:true,originalSidePhaseUnmodified:true,originalUniformBindingInvokedUnmodified:true,originalHookInvokedUnmodified:true,originalHookIdentityPreserved:false,shapeChangesReselectProgram:true,invalidShapeFallsBackToOriginal:true,currentVariant:'original',shapeUniform:null,programSelections:0,boundedSkipCombined:false,gpuVerified:false};
 mesh.onBeforeRender=function(...args){
  const returned=originalHook.apply(this,args);
  // Three invokes the object hook before renderBufferDirect/setProgram. Bind
  // first, then select using the ACTUAL original u_shapeMode for this draw.
  const value=material.uniforms.u_shapeMode?.value,variant=shapeVariantForUniform(value),shader=rawSources[variant];
  if(material.fragmentShader!==shader){material.fragmentShader=shader;material.needsUpdate=true;material.name=originalName+'/'+SHAPE_SPECIALIZATION_ID+'/'+variant;proof.programSelections++;}
  proof.currentVariant=variant;proof.shapeUniform=Number.isFinite(value)?value:null;
  return returned;
 };
 made.proof.originalShaderUnmodified=false;made.proof.gpuVerified=false;made.proof.shapeSpecialization=proof;
 registrations.set(made,{originalHook});return made;
}
export function createShapeSpecializedTimberMember(THREE,recipe={}){return specializeTimberShape(createTimberMember(THREE,recipe));}
