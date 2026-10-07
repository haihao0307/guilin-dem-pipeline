import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('./classic-anchor.json',import.meta.url)));
for(const file of manifest.files){const bytes=readFileSync(new URL('../../'+file.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,'Classic anchor changed: '+file.path);}
console.log(JSON.stringify({status:'passed',classicFiles:manifest.files.length,source:manifest.source_commit}));
