import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const score = fs.readFileSync(path.join(root, 'data/MUSKELLUNGE_RESOLVED_WEIGHTED_EYE_SCORE_R05.kfc5'));
const app = read('src/app.js').replace('__KFC5_SCORE_BASE64__', score.toString('base64'));
const html = read('src/workbench.template.html')
  .replace('__KFC5_INSTRUMENT__', () => read('src/instrument.js'))
  .replace('__KFC5_APP__', () => app);
const output = path.join(root, 'dist/KAOPU_FISH_WEIGHTED_EYE_R05_WORKBENCH.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
const baseline = fs.readFileSync(path.join(root, 'baseline/KAOPU_FISH_WEIGHTED_EYE_R05_WORKBENCH.html'));
const built = fs.readFileSync(output);
const receipt = {
  builtAt: new Date().toISOString(),
  output,
  sha256: crypto.createHash('sha256').update(built).digest('hex'),
  baselineSha256: crypto.createHash('sha256').update(baseline).digest('hex'),
  byteIdenticalToDownloadedR05: built.equals(baseline),
  singleFileHtml: true,
  sourceDelta: false,
};
fs.writeFileSync(path.join(root, 'evidence/BUILD_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
