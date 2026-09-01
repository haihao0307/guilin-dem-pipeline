"""Intake metadata refusal tests; do not execute ocean physics or a viewer."""
import importlib.util
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('intake_gate', ROOT/'tools/validate_intake.py')
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)

class IntakeTest(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT/'adoption/UNIFIED_METHOD_V1_INTAKE.json').read_text())
    def rejects(self, mutate):
        mutate(self.data)
        self.assertFalse(GATE.check(self.data)['receiptValid'])
    def test_honest_incomplete_receipt(self):
        result = GATE.check(self.data)
        self.assertTrue(result['receiptValid'])
        self.assertFalse(result['runtimeIntegrated'])
        self.assertEqual(result['formalAdoptionStatus'], 'BLOCKED')
    def test_unknown_key(self):
        self.rejects(lambda d: d.update(hiddenOverride=True))
    def test_core_version_change(self):
        self.rejects(lambda d: d['commonMethod'].update(policyVersion='2.0.0'))
    def test_original_hash_fabrication(self):
        self.rejects(lambda d: d['commonMethod'].update(policySha256='0'*64))
    def test_false_full_read(self):
        self.rejects(lambda d: d['commonMethod'].update(fullDocumentReadVerified=True))
    def test_core_override(self):
        self.rejects(lambda d: d['localAuthority']['coreOverrides'].update(anything=True))
    def test_cross_line_write(self):
        self.rejects(lambda d: d['localAuthority'].update(crossMotherWrites=True))
    def test_missing_mode(self):
        self.rejects(lambda d: d['requiredPresentationModes'].pop())
    def test_false_viewer(self):
        self.rejects(lambda d: d['presentationImplementation'].update(studio_beauty='implemented'))
    def test_fake_runtime_hook(self):
        self.rejects(lambda d: d['runtimeEntryPoints'].append('imaginary.mjs'))
    def test_self_approval(self):
        self.rejects(lambda d: d['claims'].update(visualApproved=True))
    def test_pending_as_pass(self):
        self.rejects(lambda d: d['evidenceStatus'].update(causal_outputs='passed'))
    def test_false_supplementary_tests(self):
        self.rejects(lambda d: d['commonMethod'].update(original28TestsRerun=True))
    def test_not_an_object(self):
        self.assertFalse(GATE.check(None)['receiptValid'])

if __name__ == '__main__':
    unittest.main()
