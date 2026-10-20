// Test-only: load the pinned F13 JSON captures without bundler syntax changes.
import {readFile} from 'node:fs/promises';
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return {url: new URL('../../../perf-audit/hair/f13/vendor/three.module.js', import.meta.url).href, shortCircuit: true};
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) return {format: 'module', source: 'export default ' + await readFile(new URL(url), 'utf8') + ';', shortCircuit: true};
  return nextLoad(url, context);
}
