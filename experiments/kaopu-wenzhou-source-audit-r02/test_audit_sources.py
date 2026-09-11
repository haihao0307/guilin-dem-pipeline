import copy
import json
import unittest
from pathlib import Path
from audit_sources import audit, asset_identity


class SourceAuditTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads((Path(__file__).parent.parent /
            'kaopu-wenzhou-real-score-r01/FIXTURE_R01.json').read_text())

    def test_two_modalities_do_not_prove_independence(self):
        result = audit(self.fixture)
        self.assertEqual(len(result['reportedPhysicalFamilies']), 2)
        self.assertIsNone(result['verifiedIndependentPhysicalRootCount'])
        self.assertFalse(result['rawDataReplayPassed'])

    def test_publication_copies_do_not_add_assets(self):
        before = audit(self.fixture)
        copied = copy.deepcopy(self.fixture['observationRoots'][0])
        copied['rootId'] = 'COPIED-ROOT-WITH-NEW-LABEL'
        copied['evidenceAsset'] = ('https://www.frontiersin.org/journals/marine-science/'
            'articles/10.3389/fmars.2026.1898828/full?tracking=copy')
        self.fixture['observationRoots'].append(copied)
        self.assertEqual(before['distinctCitedAssetsForRoots'],
                         audit(self.fixture)['distinctCitedAssetsForRoots'])

    def test_shared_paper_does_not_prove_physical_dependence(self):
        result = audit(self.fixture)
        self.assertEqual(len(result['distinctCitedAssetsForRoots']), 1)
        self.assertEqual(result['independenceStatus'], 'unverified-not-proven-dependent')

    def test_self_reported_success_cannot_promote(self):
        self.fixture['boundaries']['productionReady'] = True
        self.fixture['rawDataReplayPassed'] = True
        result = audit(self.fixture)
        self.assertFalse(result['productionReady'])
        self.assertFalse(result['rawDataReplayPassed'])

    def test_unknowns_remain_blockers(self):
        result = audit(self.fixture)
        self.assertIn('station-location-unknown', result['blockers'])
        self.assertIn('wave-phase-unknown', result['blockers'])

    def test_legacy_independence_claims_are_not_promoted(self):
        result = audit(self.fixture)
        self.assertEqual(len(result['unverifiedInputClaims']), 2)
        self.assertTrue(all(r['effectiveStatus'] == 'unverified'
                            for r in result['unverifiedInputClaims']))

    def test_different_numbers_do_not_establish_conflict(self):
        result = audit(self.fixture)
        self.assertEqual(result['crossRootInterpretation'],
                         'reported-difference-not-demonstrated-conflict')
        self.assertIn('quantity-reference-frame-and-spatial-support-not-aligned',
                      result['blockers'])

    def test_doi_lookalike_not_collapsed(self):
        self.assertNotEqual(asset_identity('https://example.org/10.3389/fmars.2026.1898828'),
                            asset_identity('https://doi.org/10.3389/fmars.2026.1898828'))


if __name__ == '__main__':
    unittest.main()
