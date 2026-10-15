"""Fault injection targets silent acceptance of damaged pattern handoffs."""
import copy,json,pathlib,unittest
from validate_pattern import audit,digest
ROOT=pathlib.Path(__file__).resolve().parent
class PatternHandoff(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack=json.loads((ROOT/'data/all-patterns.json').read_text(encoding='utf8'))
        cls.pattern=cls.pack['patterns'][0]['pattern']
    def reject(self,mutate,code):
        p=copy.deepcopy(self.pattern);mutate(p);result=audit(p)
        self.assertFalse(result['passed']);self.assertIn(code,[e['code'] for e in result['errors']])
    def test_all_frozen_records_roundtrip(self):
        self.assertEqual(len(self.pack['patterns']),60)
        for t in self.pack['patterns']:
            with self.subTest(id=t['id']):
                t=copy.deepcopy(t);expected=t.pop('contentSHA256');self.assertEqual(expected,digest(t))
                self.assertTrue(audit(t['pattern'])['passed'])
                self.assertFalse(t['downstream']['manufacturingReady'])
                self.assertIsNone(t['downstream']['layerOrder'])
                covered=[s for g in t['sewingPlan']['groups'] for s in g['sourceSeams']]
                self.assertEqual(len(covered),len(set(covered)))
                self.assertEqual(set(covered),{s['id'] for s in t['pattern']['seams']})
                self.assertFalse(t['sewingPlan']['sourceDimensionsAltered'])
    def test_declared_gathering_survives_separate_from_raw_source(self):
        for pid,path in [('S12','levels-skirt.level_ruffle'),('P07','pants.cuff.top_ruffle')]:
            t=next(t for t in self.pack['patterns'] if t['id']==pid)
            groups=[g for g in t['sewingPlan']['groups'] if any(d['path']==path for d in g['constructionDeclarations'])]
            self.assertTrue(groups)
            for g in groups:
                self.assertLess(abs(g['groupDifferenceMm']),1e-5)
                self.assertTrue(all(s['rawRuffleA']==1 and s['rawRuffleB']==1 for s in g['segments']))
                self.assertFalse(g['automaticEdgeScalingAllowed'])
    def test_unknown_seam_panel_rejected(self):
        self.reject(lambda p:p['seams'][0]['a'].update(panelId='absent'),'MISSING_SEAM_REFERENCE')
    def test_double_sewing_rejected(self):
        def change(p):s=copy.deepcopy(p['seams'][0]);s['id']='duplicate';p['seams'].append(s)
        self.reject(change,'EDGE_SEWN_MULTIPLE_TIMES')
    def test_reverse_direction_rejected(self):
        self.reject(lambda p:p['seams'][0]['b'].update(reverse=False),'SEAM_DIRECTION_CONFLICT')
    def test_forged_equal_lengths_rejected(self):
        self.reject(lambda p:p['panels'][0]['edges'][0].update(lengthMm=1),'INDEPENDENT_EDGE_LENGTH')
    def test_missing_gathering_rejected(self):
        self.reject(lambda p:p['seams'][0].update(gathering=None),'MISSING_GATHERING_PROVENANCE')
    def test_modified_curve_endpoint_rejected(self):
        def change(p):
            e=next(e for panel in p['panels'] for e in panel['edges'] if e['kind']=='circle')
            e['arc']['centerMm'][0]+=12
        self.reject(change,'CURVE_ENDPOINT_MISMATCH')
    def test_disconnected_piece_rejected(self):
        def change(p):q=copy.deepcopy(p['panels'][0]);q['id']='unsewn-extra';p['panels'].append(q)
        self.reject(change,'DISCONNECTED_SEWING_COMPONENTS')
    def test_wrong_units_rejected(self):
        self.reject(lambda p:p.update(units='cm'),'PATTERN_SCHEMA_OR_UNITS')
    def test_skipped_source_check_rejected(self):
        self.reject(lambda p:p['validation'].update(intersectionCheckRun=False),'SOURCE_CROSSING_CHECK_SKIPPED')
if __name__=='__main__':unittest.main()
