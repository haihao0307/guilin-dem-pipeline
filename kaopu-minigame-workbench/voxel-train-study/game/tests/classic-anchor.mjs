import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('./classic-anchor.json',import.meta.url)));
for(const file of manifest.files){const bytes=readFileSync(new URL('../../'+file.path,import.meta.url));const actual=createHash('sha256').update(bytes).digest('hex'),allowed=manifest.qa_test_alternates?.[file.path]?.sha256;assert.ok(actual===file.sha256||actual===allowed,'Classic anchor changed: '+file.path);}
console.log(JSON.stringify({status:'passed',classicFiles:manifest.files.length,source:manifest.source_commit}));
