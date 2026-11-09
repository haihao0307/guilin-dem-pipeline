import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

test('geometry-only reference reader preserves the pinned body bytes and identities',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const original=path.join(root,'reference/mp05-studio-r10');
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'tailor-reference-body-'));
  const savedFetch=globalThis.fetch,reads=[];
  try {
    await fs.symlink(original,path.join(temporary,'upstream'),'dir');
    await fs.copyFile(path.join(root,'src/reference-body.mjs'),path.join(temporary,'reference-body.mjs'));
    // CI runs the actual Python build before this test. Read its generated
    // package so the proof covers the builder's bytes, not a test-built copy.
    await fs.cp(path.join(root,'dist/reference-body'),path.join(temporary,'reference-body'),{recursive:true});
    // This Node test only resolves the already verified local reference assets.
    // No browser or network request is made, and production cache code is kept.
    globalThis.fetch=async input=>{
      const url=new URL(input);assert.equal(url.protocol,'file:');
      reads.push(fileURLToPath(url));
      return new Response(await fs.readFile(url));
    };
    const {loadReferenceBody}=await import(pathToFileURL(path.join(temporary,'reference-body.mjs')));
    const {loadPerson}=await import(pathToFileURL(path.join(original,'person/load-person.mjs')));
    const reference=await loadReferenceBody(),referenceReads=reads.slice(),retained=await loadPerson();
    const hash=array=>createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
    assert.equal(hash(reference.model.positions),hash(retained.model.positions));
    assert.equal(hash(reference.model.faces),hash(retained.model.faces));
    assert.deepEqual(reference.manifest,retained.manifest);
    assert.equal(hash(reference.model.positions),reference.manifest.geometrySHA256);
    assert.equal(hash(reference.model.faces),reference.manifest.topologySHA256);
    assert.deepEqual(Object.keys(reference.model).sort(),['faces','positions']);
    assert.equal('actor' in reference,false);
    assert.equal(reference.allocationAudit.avoidedTypedArrayBytes,1525020);
    assert.equal(reference.allocationAudit.networkPayloadChanged,true);
    assert.equal(reference.allocationAudit.geometryIdentityVerified,true);
    assert.equal(reference.allocationAudit.sourceCompressedBytes,3220845);
    assert.ok(reference.allocationAudit.loadedCompressedBytes<520000);
    assert.equal(reference.allocationAudit.avoidedCompressedPayloadBytes,
      reference.allocationAudit.sourceCompressedBytes-reference.allocationAudit.loadedCompressedBytes);
    assert.equal(referenceReads.length,2);
    assert.ok(referenceReads.every(file=>file.endsWith('/reference-body/manifest.json')||file.endsWith('/reference-body/geometry.bin.gz')));
    assert.ok(!referenceReads.some(file=>file.endsWith('/native-person.json.gz')));
  } finally {globalThis.fetch=savedFetch;await fs.rm(temporary,{recursive:true,force:true});}
});
