import unittest
import numpy as np
from signed_response import SignedResponse,compose_native
class SignedResponseTests(unittest.TestCase):
 def setUp(self):self.r=SignedResponse(np.array([10.,20.]),np.array([9.,16.]),np.array([16.,18.]),-1.,1.)
 def test_negative_positive_independent(self):
  np.testing.assert_allclose(self.r.at(-.5),[9.5,18]);np.testing.assert_allclose(self.r.at(.5),[13,19])
 def test_cross_zero_is_not_negative_slope_extrapolation(self):
  np.testing.assert_allclose(self.r.delta(-.5,.5),[3.5,1]);self.assertNotAlmostEqual(self.r.delta(-.5,.5)[0],1.)
 def test_zero_and_zero_delta_exact(self):
  np.testing.assert_array_equal(self.r.at(0),self.r.zero);np.testing.assert_array_equal(self.r.delta(-.2,-.2),[0,0])
 def test_compose_uses_actual_anchor_without_mutation(self):
  a=np.array([100.,200.]);b=compose_native(a,[(self.r,-.5,.5)]);np.testing.assert_allclose(b,[103.5,201]);np.testing.assert_array_equal(a,[100,200])
 def test_unmeasured_or_nonfinite_rejected(self):
  for x in [1.01,-1.01,np.nan,np.inf]:
   with self.assertRaises(ValueError):self.r.at(x)
 def test_topology_mismatch_rejected(self):
  with self.assertRaises(ValueError):compose_native(np.zeros(3),[(self.r,0,1)])
 def test_invalid_response_rejected(self):
  with self.assertRaises(ValueError):SignedResponse([0],[0],[np.nan],-1,1)
if __name__=='__main__':unittest.main()
