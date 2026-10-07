from pathlib import Path
import sys,json,unittest,copy,math
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pattern_catalogue import *
ROOT=Path(__file__).resolve().parents[1]
class Contract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.body=json.loads((ROOT/'examples/body-anny-cm.json').read_text());cls.basic=generatePattern({'bodyCm':cls.body,'design':{'style':'Skirt2'}})
 def test_input_immutable(self):
  request={'bodyCm':copy.deepcopy(self.body),'design':{'style':'Pants'}};old=copy.deepcopy(request);generatePattern(request);self.assertEqual(old,request)
 def test_rules_and_unknowns(self):
  for design in [{},{'style':'absent'},{'meta.bottom':'SkirtCircle'},{'style':'Shirt','pants.nope':2},{'style':'Pants','pants.length':2},{'style':'Pants','pants.length':float('nan')}]:
   with self.assertRaises((PatternError,BaseException)):generatePattern({'bodyCm':self.body,'design':design})
 def test_schema_immutable(self):
  a=parameterSchema();a['parameters'][0]['samplingRange'].clear();self.assertTrue(parameterSchema()['parameters'][0]['samplingRange'])
  a=listStyles();a[0]['overrides']['meta.upper']='bad';self.assertEqual(listStyles()[0]['overrides']['meta.upper'],'Shirt')
 def test_missing_measurement(self):
  b=self.body.copy();del b['bum_points']
  with self.assertRaises(PatternError):generatePattern({'bodyCm':b,'design':{'style':'Pants'}})
 def test_mm_and_curve_units(self):
  r=self.basic;raw=r['officialOracleCm']['pattern']['panels']
  for p in r['panels']:
   for a,b in zip(p['verticesMm'],raw[p['id']]['vertices']):
    for x,y in zip(a,b):self.assertAlmostEqual(x,y*10,places=10)
   for e,src in zip(p['edges'],raw[p['id']]['edges']):
    self.assertEqual(e['endpoints'],src['endpoints'])
    if e['curvature']:
     c=src['curvature']
     if c['type']=='circle':self.assertAlmostEqual(e['curvature']['params'][0],c['params'][0]*10)
     else:self.assertEqual(e['curvature']['params'],c['params'])
 def test_seam_metadata(self):
  r=self.basic;panels={p['id']:p for p in r['panels']}
  for s in r['seams']:
   self.assertIsNotNone(s['gathering'])
   for end in [s['a'],s['b']]:self.assertLess(end['edge'],len(panels[end['panelId']]['edges']))
   self.assertAlmostEqual(s['easeMm'],s['lengthAMm']-s['lengthBMm'])
 def test_real_parameter_changes(self):
  b=generatePattern({'bodyCm':self.body,'design':{'style':'Skirt2','skirt.length':.33}})
  self.assertNotEqual(self.basic['geometryHash'],b['geometryHash']);self.assertNotEqual(self.basic['recipeHash'],b['recipeHash'])
 def test_schema_complete(self):self.assertEqual(len(parameterSchema()['parameters']),122);self.assertEqual(len(listStyles()),23)
 def test_invalid_sample_retained(self):
  p=generatePattern({'bodyCm':self.body,'design':{'style':'SkirtManyPanels','flare-skirt.skirt-many-panels.panel_curve':-.35}})
  self.assertFalse(p['validation']['analytic2DPass']);self.assertTrue(any(x['code']=='SAMPLED_SELF_INTERSECTION' for x in p['validation']['errors']))
if __name__=='__main__':unittest.main()
