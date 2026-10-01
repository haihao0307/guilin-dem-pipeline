import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (!target || !target.startsWith('https://')) throw new Error('Provide the published HTTPS URL.');
const response = await fetch(target, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(60000) });
const data = Buffer.from(await response.arrayBuffer());
const expected = fs.readFileSync(path.join(root, 'dist/KAOPU_FISH_TAIL_DRIVE_R07_WORKBENCH.html'));
const receipt = {
  verifiedAt: new Date().toISOString(),
  target,
  finalUrl: response.url,
  httpStatus: response.status,
  bytes: data.length,
  sha256: crypto.createHash('sha256').update(data).digest('hex'),
  expectedSha256: crypto.createHash('sha256').update(expected).digest('hex'),
  exactPayloadMatched: data.equals(expected),
  versionMarkerMatched: data.includes(Buffer.from('R07 · KFC7')),
};
receipt.passed = receipt.httpStatus === 200 && receipt.exactPayloadMatched && receipt.versionMarkerMatched;
fs.writeFileSync(path.join(root, 'evidence/PUBLIC_HTTP_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.passed) process.exitCode = 1;
