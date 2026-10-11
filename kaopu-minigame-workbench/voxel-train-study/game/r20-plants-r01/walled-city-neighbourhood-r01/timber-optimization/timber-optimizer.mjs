import {createTimberMember, Original} from '../native/timber-adapter.mjs';
import {extractShaderFunctions, replaceShaderFunction} from './shader-functions.mjs';

export const TIMBER_OPTIMIZATION_ID = 'original-height-empty-prefix-v1';
export const AUDITED_ORIGINAL_CORE_SHA256 = 'ce6a10b73516cb3fe64b389c167daab6625354e2ea9a67c08ca6ab94c8b5df9c';
// coarseRelief <= 0.68, hence depth >= 0.32. The 0.01 safety margin
// avoids treating floating-point equality at the bound as a proof.
export const CONSERVATIVE_MINIMUM_DEPTH = 0.31;
const bound = CONSERVATIVE_MINIMUM_DEPTH.toFixed(2);
const originalFunction = extractShaderFunctions(Original.fragmentShaderSource).get('applyParallax').text;
const originalInitial = '  float currentDepth = 1.0 - coarseRelief(currentGrain, localNormal, surfaceClass);';
const originalLoop = '    currentDepth = 1.0 - coarseRelief(currentGrain, localNormal, surfaceClass);';
function replaceOnce(text, old, next) {
  if (text.split(old).length !== 2) throw new Error('Audited applyParallax shape changed');
  return text.replace(old,next);
}
let optimizedFunction = replaceOnce(originalFunction, originalInitial,
  `  float currentDepth = ${bound};\n  if (layerStep >= ${bound}) {\n    currentDepth = 1.0 - coarseRelief(currentGrain, localNormal, surfaceClass);\n  }`);
// Replace the loop occurrence only. The inserted initial occurrence deliberately
// has the same original call text, so anchor on the preceding original line.
optimizedFunction = replaceOnce(optimizedFunction,
  '    currentLayer += layerStep;\n' + originalLoop,
  `    currentLayer += layerStep;\n    currentDepth = ${bound};\n    if (currentLayer + layerStep >= ${bound}) {\n      currentDepth = 1.0 - coarseRelief(currentGrain, localNormal, surfaceClass);\n    }`);

export const optimizedFragmentShaderSource = replaceShaderFunction(Original.fragmentShaderSource,'applyParallax',optimizedFunction);
export const optimizationSource = Object.freeze({originalFunction,optimizedFunction});

export function optimizeTimberMaterial(made) {
  if (!made?.mesh?.material || !made?.proof?.originalUniformBinding) throw new Error('Expected the original createTimberMember result');
  if (made.proof.optimization?.id === TIMBER_OPTIMIZATION_ID) return made;
  const material = made.mesh.material;
  const stripVersion = s => s.replace(/^#version 300 es\n/,'');
  if (material.fragmentShader !== stripVersion(Original.fragmentShaderSource) || material.vertexShader !== stripVersion(Original.vertexShaderSource)) {
    throw new Error('Refusing to optimize an already modified timber shader');
  }
  material.fragmentShader = stripVersion(optimizedFragmentShaderSource);
  material.needsUpdate = true;
  material.name += '/' + TIMBER_OPTIMIZATION_ID;
  made.proof.originalShaderUnmodified = false;
  made.proof.optimization = {
    id:TIMBER_OPTIMIZATION_ID,
    coreFileUnmodified:true,
    auditedOriginalCoreSha256:AUDITED_ORIGINAL_CORE_SHA256,
    changedFunctions:['applyParallax'],
    coarseReliefUnmodified:true,
    finalSignalsUnmodified:true,
    uniformBindingUnmodified:true,
    originalHookPreserved:true,
    heightUpperBound:0.68,
    physicalReliefAmplitudeUnchanged:true,
    conservativeDepthLowerBound:CONSERVATIVE_MINIMUM_DEPTH,
    skippedCoarseSamples:{steps12:3,steps6:1,steps3:0},
    samplingGridAndIntersectionInterpolationUnchanged:true,
    frequencyDecimation:false,
    gpuVerified:false,
  };
  made.proof.gpuVerified = false;
  return made;
}
export function createOptimizedTimberMember(THREE,recipe={}) {
  return optimizeTimberMaterial(createTimberMember(THREE,recipe));
}

// Optional DIAGNOSTIC shader only. It is never used for timing or beauty frames.
// Red byte = actual coarseRelief invocation count, alpha marks covered fragments.
// Same applyParallax source and original coarseRelief remain in the diagnostic.
export function makeParallaxSampleCountShader(fragmentShaderSource) {
  const funcs=extractShaderFunctions(fragmentShaderSource), parallax=funcs.get('applyParallax');
  if (!parallax) throw new Error('Missing applyParallax');
  const instrumented=parallax.text.replaceAll('coarseRelief(', 'countedCoarseRelief(');
  const helper='float timberCoarseSampleCount = 0.0;\nfloat countedCoarseRelief(vec3 g, vec3 n, float c) {\n  timberCoarseSampleCount += 1.0;\n  return coarseRelief(g, n, c);\n}\n\n';
  let shader=replaceShaderFunction(fragmentShaderSource,'applyParallax',helper+instrumented);
  const main=extractShaderFunctions(shader).get('main');
  if (!main) throw new Error('Missing main');
  shader=replaceShaderFunction(shader,'main',main.text.slice(0,-1)+
    '  outColor = vec4(timberCoarseSampleCount / 255.0, 0.0, 0.0, 1.0);\n}');
  return shader;
}
