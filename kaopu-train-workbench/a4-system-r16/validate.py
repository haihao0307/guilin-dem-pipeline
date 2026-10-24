import json,math,unittest
import numpy as np
from pathlib import Path
from system import *
g=json.loads(Path('SYSTEM_GRAPH.json').read_text()); ids={n['id'] for n in g['nodes']}
fixtures=[([0,1.7,4.3],[0,.11,0]),([.3,2.8,5.1],[.02,.19,-.01]),([0,2.2,4.1],[0,0,0])]
class T(unittest.TestCase):
 def test_refs(self):
  self.assertEqual(len(ids),len(g['nodes']))
  for e in g['edges']:
   self.assertIn(e['from'],ids);self.assertIn(e['to'],ids);self.assertIn(e['source'],g['sources'])
 def test_parallel_steam(self):
  for s in ['left','middle','right']:self.assertTrue(reachable(g,'superheater',s+'_cylinder','steam'))
  self.assertFalse(reachable(g,'left_cylinder','middle_cylinder','steam'))
 def test_medium_separation(self):
  self.assertTrue(reachable(g,'water','boiler_water','water'))
  self.assertFalse(reachable(g,'firebox','boiler_water','gas'))
  self.assertFalse(reachable(g,'gas_tubes','superheater','gas'))
 def test_drive_topology(self):
  for s in ['left','middle','right']:self.assertTrue(reachable(g,s+'_cylinder','driver_middle','mechanical'))
  for ax in ['driver_front','driver_rear']:self.assertTrue(reachable(g,'driver_middle',ax,'mechanical'))
 def test_support(self):
  self.assertTrue(reachable(g,'frame','rails','support'))
  self.assertFalse(reachable(g,'front_bogie','driver_middle','mechanical'))
 def test_control_not_power(self):
  self.assertTrue(reachable(g,'left_valve','middle_valve','control'))
  self.assertFalse(reachable(g,'left_valve','driver_middle','mechanical'))
 def test_rods_and_guides(self):
  for phases,inc in fixtures:
   for t in np.linspace(0,2*np.pi,721):
    q=system_pose(t,phases,inc)
    for i,s in enumerate(['left','middle','right']):
     self.assertAlmostEqual(np.linalg.norm(q[s]['big']-q[s]['small']),PARAMS['rod_length'],places=11)
     self.assertAlmostEqual(q[s]['small'][1]*math.cos(inc[i])-q[s]['small'][2]*math.sin(inc[i]),0,places=12)
 def test_coupling_lengths(self):
  for phases,inc in fixtures:
   for t in np.linspace(0,2*np.pi,721):
    q=system_pose(t,phases,inc)
    for s in ['left','right']:self.assertTrue(np.allclose(np.linalg.norm(np.diff(q['coupled_pins'][s],axis=0),axis=1),[2.5,2.5],atol=1e-12))
 def test_conjugate(self):
  for a,b in [(.1,.2),(-.2,.4),(0,0)]:self.assertAlmostEqual(conjugate(a,b)+a+b,0,places=12)
 def test_explicit_phases(self):
  with self.assertRaises(TypeError):system_pose(0)
 def test_reused_joint_frame(self):
  from r15_joint import joint_fields
  local=np.array([[0,.06,0],[.07,.04,0],[.147,0,0],[0,.049,0]])
  for phases,inc in fixtures:
   for t in np.linspace(0,2*np.pi,73):
    q=system_pose(t,phases,inc)
    for i,side in enumerate(['left','middle','right']):
     c=math.cos(inc[i]);s=math.sin(inc[i]);world=np.stack([local[:,0],local[:,1]*c+local[:,2]*s,-local[:,1]*s+local[:,2]*c],-1)+q[side]['small']
     self.assertTrue(np.allclose(joint_fields_world(world,t,side,phases,inc),joint_fields(local),atol=1e-12))
 def test_periodic(self):
  for phases,inc in fixtures:
   a=system_pose(0,phases,inc);b=system_pose(2*np.pi,phases,inc)
   for s in ['left','middle','right']:self.assertTrue(np.allclose(a[s]['small'],b[s]['small']))
if __name__=='__main__':
 r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(T))
 Path('VALIDATION.json').write_text(json.dumps({'version':'R16','tests_run':r.testsRun,'passed':r.wasSuccessful(),'fixtures':fixtures,'fixture_status':'synthetic stress tests NOT historical A4 angles','phase_samples':721,'mechanical_scope':'three closed sliders and two side couplings in fixed straight frame; not suspension or collision validation','thermal_scope':'graph reachability and medium separation only; no thermal solver'},indent=2))
 raise SystemExit(not r.wasSuccessful())
