"""Positive and negative tests for the static gate; no physics claims."""
import hashlib
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('knowledge_gate',ROOT/'tools/validate_knowledge.py')
GATE=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)

class KnowledgePolicyTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)/'ocean-mother'
        shutil.copytree(ROOT,self.root,ignore=shutil.ignore_patterns('__pycache__'))
    def change_contract(self,mutator):
        f=self.root/'contracts/OCEAN_KNOWLEDGE_CONTRACT.json'
        obj=json.loads(f.read_text());mutator(obj);f.write_text(json.dumps(obj))
    def expect(self,code):
        report=GATE.check(self.root)
        self.assertFalse(report['passed'])
        self.assertIn(code,{x['code'] for x in report['failures']})
    def test_clean_knowledge_passes(self):
        self.assertTrue(GATE.check(self.root)['passed'])
    def test_image_extension_rejected(self):
        (self.root/'negative_fixture.png').write_text('negative test placeholder, no image')
        self.expect('NON_TEXT_ASSET_FORBIDDEN')
    def test_binary_disguised_as_text_rejected(self):
        (self.root/'negative_fixture.txt').write_bytes(bytes([137,80,78,71])+b'negative')
        self.expect('BINARY_IMAGE_OR_ARCHIVE_FORBIDDEN')
    def test_embedded_image_rejected(self):
        (self.root/'negative_fixture.md').write_text('data:'+ 'image/png;base64,negative')
        self.expect('EMBEDDED_IMAGE_FORBIDDEN')
    def test_loader_rejected(self):
        (self.root/'negative_fixture.mjs').write_text('const bad = new '+ 'TextureLoader();')
        self.expect('IMAGE_LOADER_FORBIDDEN')
    def test_label_fingerprint_rejected(self):
        fixture='example external label'
        fingerprint=hashlib.sha256(fixture.encode()).hexdigest()
        self.change_contract(lambda c:c['policy']['brandTokenSha256'].append(fingerprint))
        (self.root/'negative_fixture.txt').write_text(fixture)
        self.expect('EXTERNAL_LABEL_FORBIDDEN')
    def test_nonzero_image_policy_rejected(self):
        self.change_contract(lambda c:c['policy'].update(storedTextureImages=1))
        self.expect('ZERO_POLICY_CHANGED')
    def test_false_runtime_claim_rejected(self):
        self.change_contract(lambda c:c['claims'].update(buoyancySolverImplemented=True))
        self.expect('UNSUPPORTED_COMPLETION_CLAIM')
    def test_false_skill_validation_rejected(self):
        self.change_contract(lambda c:c['skills'][0].update(physicsValidated=True))
        self.expect('KNOWLEDGE_IS_NOT_RUNTIME_PROOF')
    def test_missing_evidence_rejected(self):
        self.change_contract(lambda c:c['skills'][0].update(evidence=['MISSING']))
        self.expect('MISSING_EVIDENCE_REFERENCE')
    def test_changed_upstream_ref_rejected(self):
        self.change_contract(lambda c:c.update(upstreamPublicationRef='0'*40))
        self.expect('UPSTREAM_REF_CHANGED')
    def test_frozen_bridge_change_rejected(self):
        f=self.root/'bridge-v1/environment-bridge.js'
        f.write_text(f.read_text()+'\n// negative test\n')
        self.expect('FROZEN_LOCAL_FILE_CHANGED')
    def test_incomplete_skill_rejected(self):
        self.change_contract(lambda c:c['skills'][3].update(limitations=[]))
        self.expect('INCOMPLETE_SKILL')
    def test_misattributed_buoyancy_rejected(self):
        self.change_contract(lambda c:c['sourceArticleCapabilities'].update(buoyancy=True))
        self.expect('SOURCE_SCOPE_MISATTRIBUTED')

if __name__=='__main__':
    unittest.main()
