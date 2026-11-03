import {pathToFileURL} from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    if (!process.env.THREE_PATH) throw new Error('THREE_PATH must name the pinned Three.js ESM file.');
    return {url: pathToFileURL(process.env.THREE_PATH).href, shortCircuit: true};
  }
  return nextResolve(specifier, context);
}
