// Test-only: all bare, relative vendor and file-URL Three imports resolve to
// the one original MP05 r170 module retained within this artifact. Its original
// object-ID offset is preserved. Browser rendering still uses original F13 B1.
// Load pinned F13 JSON captures without rewriting any original source file.
import {readFile} from 'node:fs/promises';
const commonThree = new URL('../cloth/upstream/vendor/three.module.js', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three' || /(?:^|\/)three\.module(?:\.min)?\.js$/.test(specifier)) {
    return {url: commonThree, shortCircuit: true};
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) return {format: 'module', source: 'export default ' + await readFile(new URL(url), 'utf8') + ';', shortCircuit: true};
  return nextLoad(url, context);
}
