import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScore } from '../src/instrument.js';
import { FULL_SCORE } from '../src/scores.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const [template, instrumentSource, license, instrumentResult, appResult] = await Promise.all([
  readFile(resolve(root, 'src/index.template.html'), 'utf8'),
  readFile(resolve(root, 'src/instrument.js'), 'utf8'),
  readFile(resolve(root, 'node_modules/three/LICENSE'), 'utf8'),
  build({
    entryPoints: [resolve(root, 'src/instrument.js')],
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    globalName: 'KAOPUInstrument',
    platform: 'browser',
    target: ['es2022'],
    legalComments: 'none',
    treeShaking: true,
    footer: { js: 'globalThis.KAOPUInstrument=KAOPUInstrument;' }
  }),
  build({
    entryPoints: [resolve(root, 'src/app.js')],
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    legalComments: 'none',
    treeShaking: true
  })
]);

const parsed = parseScore(FULL_SCORE);
if (parsed.count !== 259) throw new Error(`Full spatial score must expand to 259 objects, got ${parsed.count}`);
const scoreBytes = Buffer.byteLength(FULL_SCORE, 'utf8');
if (scoreBytes > 1200) throw new Error(`Full spatial score exceeded 1200 bytes: ${scoreBytes}`);

const safeLicense = license.replaceAll('*/', '* /');
const instrumentHeader = `/*! KAOPU_INSTRUMENT_K2 K2.0.0\nStandalone score-to-THREE.Group instrument. No UI, camera, controls, examples or embedded score.\nThird-party license: Three.js\n${safeLicense}\n*/\n`;
const instrumentFile = instrumentHeader + instrumentResult.outputFiles[0].text;
new Function(instrumentFile);
const instrumentBytes = Buffer.byteLength(instrumentFile, 'utf8');
const instrumentCoreBytes = Buffer.byteLength(instrumentSource, 'utf8');
const instrumentBase64 = Buffer.from(instrumentFile, 'utf8').toString('base64');
const appBundle = appResult.outputFiles[0].text.replaceAll('</script', '<\\/script');
new Function(appBundle);
const sourceSha = process.env.GITHUB_SHA || 'local';

const render = (workbenchBytes) => template
  .replace('__WORKBENCH_BYTES__', String(workbenchBytes))
  .replace('__INSTRUMENT_FILE_BYTES__', String(instrumentBytes))
  .replace('__INSTRUMENT_CORE_BYTES__', String(instrumentCoreBytes))
  .replace('__SOURCE_SHA__', sourceSha)
  .replace('__INSTRUMENT_BASE64__', instrumentBase64)
  .replace('__APP_BUNDLE__', () => appBundle);

let workbenchBytes = 0;
let html = '';
for (let pass = 0; pass < 12; pass += 1) {
  html = render(workbenchBytes);
  const measured = Buffer.byteLength(html, 'utf8');
  if (measured === workbenchBytes) break;
  workbenchBytes = measured;
}
html = render(workbenchBytes);
if (Buffer.byteLength(html, 'utf8') !== workbenchBytes) throw new Error('Workbench byte ledger did not converge');

const apiReadme = `KAOPU INSTRUMENT K2.0.0\n\nFile: KAOPU_INSTRUMENT_K2.js\nGlobal API: globalThis.KAOPUInstrument\n\nThe file contains the K2 parser, procedural geometry generator and its Three.js runtime.\nIt contains no page UI, camera, controls, example score or the R02 spatial composition.\n\nBrowser use:\n<script src="KAOPU_INSTRUMENT_K2.js"></script>\n<script>\n  const { THREE, buildScore, measure, dispose } = KAOPUInstrument;\n  const scene = new THREE.Scene();\n  const result = buildScore('K2|A12,2{s.1}');\n  scene.add(result.root);\n  console.log(measure(result.root, result.score));\n  // dispose(result.root) when finished.\n</script>\n\nVersion contract: a score beginning with K2| must be replayed by a compatible K2 instrument.\nUnits: metre. Axis: Y up.\n`;

await Promise.all([
  writeFile(resolve(dist, 'index.html'), html, 'utf8'),
  writeFile(resolve(dist, 'KAOPU_INSTRUMENT_K2.js'), instrumentFile, 'utf8'),
  writeFile(resolve(dist, 'KAOPU_SPATIAL_SCORE_K2.txt'), FULL_SCORE + '\n', 'utf8'),
  writeFile(resolve(dist, 'KAOPU_INSTRUMENT_K2_README.txt'), apiReadme, 'utf8')
]);

console.log(`WORKBENCH_BYTES ${workbenchBytes}`);
console.log(`INSTRUMENT_FILE_BYTES ${instrumentBytes}`);
console.log(`INSTRUMENT_CORE_BYTES ${instrumentCoreBytes}`);
console.log(`FULL_SCORE_BYTES ${scoreBytes}`);
console.log(`FULL_SCORE_OBJECTS ${parsed.count}`);
console.log(`SOURCE_SHA ${sourceSha}`);
