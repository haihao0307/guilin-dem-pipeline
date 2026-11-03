import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const assemblyDir = path.resolve(process.argv[2] ?? '.');
const {validateLiningBinding} = await import(pathToFileURL(path.join(assemblyDir, 'lining-binding.mjs')));
const lock = JSON.parse(fs.readFileSync(path.join(assemblyDir, 'GEOMETRY_LOCK.json'), 'utf8'));
const member = lock.members.find((entry) => entry.liningBindingPath);
const binding = JSON.parse(fs.readFileSync(path.join(assemblyDir, member.liningBindingPath), 'utf8'));
const ids = new Set([binding.componentID, binding.geometryViewID]);

assert.equal(validateLiningBinding(member, structuredClone(binding), ids).authority.moduleSHA256,
  binding.authority.moduleSHA256);

const wrongAuthority = structuredClone(binding);
wrongAuthority.authority.moduleSHA256 = '0'.repeat(64);
wrongAuthority.authority.parametersSHA256 = '1'.repeat(64);
wrongAuthority.authority.freezeSHA256 = '2'.repeat(64);
const wrongText = JSON.stringify(wrongAuthority);
const selfConsistentMember = structuredClone(member);
selfConsistentMember.liningBindingSHA256 = crypto.createHash('sha256').update(wrongText).digest('hex');
assert.equal(crypto.createHash('sha256').update(wrongText).digest('hex'),
  selfConsistentMember.liningBindingSHA256);
const accepted = validateLiningBinding(selfConsistentMember, JSON.parse(wrongText), ids);

assert.equal(accepted.authority.moduleSHA256, '0'.repeat(64));
assert.equal(accepted.authority.parametersSHA256, '1'.repeat(64));
assert.equal(accepted.authority.freezeSHA256, '2'.repeat(64));
console.log(JSON.stringify({
  result: 'ACCEPTED_WRONG_DECLARED_AUTHORITY_HASHES',
  outerBindingHashCheck: 'PASS',
  mutatedFields: [
    'authority.moduleSHA256',
    'authority.parametersSHA256',
    'authority.freezeSHA256'
  ]
}));
