import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'src/app.js');
const templatePath = resolve(root, 'src/index.template.html');
const distDir = resolve(root, 'dist');
const outputPath = resolve(distDir, 'index.html');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const [template, bundleResult] = await Promise.all([
  readFile(templatePath, 'utf8'),
  build({
    entryPoints: [sourcePath],
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    legalComments: 'none',
    sourcemap: false,
    treeShaking: true,
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  })
]);

const rawBundle = bundleResult.outputFiles[0].text;
new Function(rawBundle);

const bundle = rawBundle.replaceAll('</script', '<\\/script');
new Function(bundle);

const bundleMarker = '<!--KAOPU_BUNDLE-->';
if (!template.includes(bundleMarker)) {
  throw new Error(`index.template.html is missing ${bundleMarker}`);
}

const inlineScript = `<script>${bundle}</script>`;
const renderHtml = (instrumentBytes) => template
  .replace('__INSTRUMENT_BYTES__', String(instrumentBytes))
  .replace(bundleMarker, () => inlineScript);

let instrumentBytes = 0;
let html = '';
for (let pass = 0; pass < 5; pass += 1) {
  html = renderHtml(instrumentBytes);
  const measured = Buffer.byteLength(html, 'utf8');
  if (measured === instrumentBytes) break;
  instrumentBytes = measured;
}

html = renderHtml(instrumentBytes);
const finalBytes = Buffer.byteLength(html, 'utf8');
if (finalBytes !== instrumentBytes) {
  instrumentBytes = finalBytes;
  html = renderHtml(instrumentBytes);
}

if (html.includes(bundleMarker)) {
  throw new Error('Standalone HTML still contains an unresolved bundle marker.');
}

await writeFile(outputPath, html, 'utf8');
console.log(`Built standalone KAOPU instrument: ${outputPath}`);
console.log(`Instrument bytes: ${Buffer.byteLength(html, 'utf8')}`);
