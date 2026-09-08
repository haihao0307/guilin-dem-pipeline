"""Negative controls for the independent audit, without touching production files."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest

import gate


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.pilot = Path(self.temp.name)/'pilot'
        shutil.copytree(gate.PILOT, self.pilot)

    def change(self, relative, edit):
        path = self.pilot/relative
        data = json.loads(path.read_text())
        edit(data)
        path.write_text(json.dumps(data))

    def test_old_qa_flag_has_no_authority(self):
        self.change('05_QA/QA.json', lambda d: d.update(passed=False))
        report = gate.audit(self.pilot)
        self.assertTrue(report['independentExactDecodePassed'])
        self.assertFalse(report['expansionAllowed'])
        self.assertFalse(report['seams']['sharedEdgeContractPassed'])

    def test_score_corruption_rejected(self):
        p = self.pilot/'03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.wzscore'
        b = bytearray(p.read_bytes()); b[-1] ^= 1; p.write_bytes(b)
        with self.assertRaisesRegex(ValueError, 'score identity'):
            gate.audit(self.pilot)

    def test_conductor_identity_rejected(self):
        self.change('04_CONDUCTORS/visual-overview.json', lambda d: d.update(scoreId='other'))
        with self.assertRaisesRegex(ValueError, 'conductor identity'):
            gate.audit(self.pilot)

    def test_source_window_drift_rejected(self):
        self.change('03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.index.json',
                    lambda d: d['pages'][0].update(sourceRowOffset=0))
        with self.assertRaisesRegex(ValueError, 'source window drift'):
            gate.audit(self.pilot)

    def test_packet_offset_corruption_rejected(self):
        self.change('03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.index.json',
                    lambda d: d['packets'][0].update(offset=0))
        with self.assertRaisesRegex(ValueError, 'payload hash'):
            gate.audit(self.pilot)

    def test_unknown_packet_rejected(self):
        def edit(d):
            d['packetIds'][0] = 'unknown'
        self.change('04_CONDUCTORS/visual-overview.json', edit)
        with self.assertRaisesRegex(ValueError, 'unknown conductor packet'):
            gate.audit(self.pilot)

    def test_missing_mask_rejected(self):
        index = json.loads((self.pilot/'03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.index.json').read_text())
        score = (self.pilot/'03_SCORE'/index['scoreFile']).read_bytes()
        page = index['pages'][0]
        ids = [pid for pid in page['packetIds'] if not pid.endswith('/MASK')]
        with self.assertRaisesRegex(ValueError, 'missing NoData'):
            gate.decode(index, score, page, ids)

    def test_cross_page_reference_rejected(self):
        index = json.loads((self.pilot/'03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.index.json').read_text())
        score = (self.pilot/'03_SCORE'/index['scoreFile']).read_bytes()
        with self.assertRaisesRegex(ValueError, 'cross-page'):
            gate.decode(index, score, index['pages'][0], index['pages'][1]['packetIds'])

    def test_q64_bounds(self):
        for value in (-1, gate.U64, True, 1.0):
            with self.assertRaises(ValueError):
                gate.sample(value, 17662)
        self.assertEqual(gate.sample(0, 17662), 0)
        self.assertEqual(gate.sample(gate.U64-1, 17662), 17661)


if __name__ == '__main__':
    unittest.main()
