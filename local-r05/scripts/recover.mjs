import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) throw new Error('Provide the original R05 workbench HTML path.');
const original = fs.readFileSync(input);
const html = original.toString('utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if (scripts.length !== 2 || !scripts[0][1].includes("ABI:'KFC5'")) {
  throw new Error('Expected the two inline script blocks of the R05 KFC5 workbench.');
}
const payload = scripts[1][1].match(/const KFS5_SCORE_B64="([A-Za-z0-9+/=]+)";/);
if (!payload) throw new Error('R05 score payload missing.');
const score = Buffer.from(payload[1], 'base64');
const metadataLength = score.readUInt32LE(8);
const metadata = JSON.parse(score.subarray(16, 16 + metadataLength).toString('utf8'));
if (metadata.instrument.abi !== 'KFC5') throw new Error('Unexpected score ABI.');
for (const dir of ['baseline', 'src', 'data', 'evidence', 'dist']) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}
fs.writeFileSync(path.join(root, 'baseline', path.basename(input)), original);
fs.writeFileSync(path.join(root, 'src/instrument.js'), scripts[0][1]);
fs.writeFileSync(path.join(root, 'src/app.js'), scripts[1][1].replace(payload[1], '__KFC5_SCORE_BASE64__'));
let template = html;
for (let index = scripts.length - 1; index >= 0; index--) {
  const match = scripts[index];
  const bodyStart = match.index + match[0].indexOf('>') + 1;
  template = template.slice(0, bodyStart) + (index === 0 ? '__KFC5_INSTRUMENT__' : '__KFC5_APP__') + template.slice(bodyStart + match[1].length);
}
fs.writeFileSync(path.join(root, 'src/workbench.template.html'), template);
fs.writeFileSync(path.join(root, 'data/MUSKELLUNGE_RESOLVED_WEIGHTED_EYE_SCORE_R05.kfc5'), score);
fs.writeFileSync(path.join(root, 'data/score-metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
const receipt = {
  scope: 'Recovery of existing R05 baseline for local development; no visual or motion change',
  originalPath: input,
  sourceHtmlSha256: crypto.createHash('sha256').update(original).digest('hex'),
  scoreSha256: crypto.createHash('sha256').update(score).digest('hex'),
  scoreBytes: score.length,
  instrumentAbi: metadata.instrument.abi,
  counts: metadata.counts,
  recoveredAt: new Date().toISOString(),
  provenance: 'Runtime, application, template and resolved binary score recovered directly from the downloaded standalone HTML. Original build-time generators and historical test reports are not present.',
  sourceDelta: false,
  visualAcceptance: false,
  motionAcceptance: false,
  productionReady: false,
};
fs.writeFileSync(path.join(root, 'evidence/RECOVERY_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
