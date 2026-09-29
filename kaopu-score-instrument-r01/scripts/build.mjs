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

const bundle = bundleResult.outputFiles[0].text.replaceAll('</script', '<\\/script');
if (!template.includes('<!--KAOPU_BUNDLE-->')) {
  throw new Error('index.template.html is missing <!--KAOPU_BUNDLE-->');
}

let instrumentBytes = 0;
let html = '';
for (let pass = 0; pass < 5; pass += 1) {
  html = template
    .replace('__INSTRUMENT_BYTES__', String(instrumentBytes))
    .replace('<!--KAOPU_BUNDLE-->', `<script>${bundle}</script>`);
  const measured = Buffer.byteLength(html, 'utf8');
  if (measured === instrumentBytes) break;
  instrumentBytes = measured;
}

html = template
  .replace('__INSTRUMENT_BYTES__', String(instrumentBytes))
  .replace('<!--KAOPU_BUNDLE-->', `<script>${bundle}</script>`);

const finalBytes = Buffer.byteLength(html, 'utf8');
if (finalBytes !== instrumentBytes) {
  instrumentBytes = finalBytes;
  html = template
    .replace('__INSTRUMENT_BYTES__', String(instrumentBytes))
    .replace('<!--KAOPU_BUNDLE-->', `<script>${bundle}</script>`);
}

await writeFile(outputPath, html, 'utf8');
console.log(`Built standalone KAOPU instrument: ${outputPath}`);
console.log(`Instrument bytes: ${Buffer.byteLength(html, 'utf8')}`);
