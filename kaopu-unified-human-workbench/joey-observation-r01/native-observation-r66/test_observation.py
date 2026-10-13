import unittest
import numpy as np
from observation import observed_arcs,normal_errors,summary

def curve(name,part,points):
    return dict(name=name,part=part,points_xy=points,usage='fit',silhouette_eligible=True,weight=.8,tolerance_px=4)

class ObservationTests(unittest.TestCase):
    def test_split_same_physical_region_keeps_budget(self):
        o=observed_arcs([curve('a','image_right_arc',[[2,0],[2,10]]),curve('b','image_right_arc',[[2,20],[2,30]]),curve('left','image_left_arc',[[0,0],[0,30]])])
        self.assertAlmostEqual(o.weights[o.parts=='image_right_arc'].sum(),.8)
        self.assertAlmostEqual(o.weights[o.parts=='image_left_arc'].sum(),.8)
        self.assertFalse(((o.pixels[:,1]>10)&(o.pixels[:,1]<20)&(o.parts=='image_right_arc')).any())
    def test_no_endpoint_duplication(self):
        o=observed_arcs([curve('a','image_left_arc',[[0,0],[0,10]]),curve('b','chin',[[0,10],[10,10]])],spacing=2)
        self.assertEqual(len(np.unique(o.pixels,axis=0)),len(o.pixels))
        self.assertFalse(np.any(np.all(o.pixels==[0,10],axis=1)))
    def test_redundant_sample_density_no_gain(self):
        a=observed_arcs([curve('a','image_right_arc',[[0,0],[0,30]])],spacing=2)
        b=observed_arcs([curve('b','image_right_arc',[[0,0],[0,10],[0,20],[0,30]])],spacing=5)
        for o in [a,b]:
            e=normal_errors(o.pixels+[3,7],o)
            self.assertAlmostEqual(summary(e,o)['image_right_arc']['rmsPixels'],3)
    def test_oriented_outward_normals(self):
        for part,pts,want in [('image_left_arc',[[0,0],[0,10]],[-1,0]),('image_right_arc',[[0,0],[0,10]],[1,0]),('chin',[[0,10],[10,10]],[0,1])]:
            o=observed_arcs([curve('a',part,pts)])
            np.testing.assert_allclose(o.normals,np.tile(want,(len(o.normals),1)))
    def test_excluded_stays_missing(self):
        c=curve('a','chin',[[0,0],[10,10]]);c['silhouette_eligible']=False
        self.assertEqual(len(observed_arcs([c]).pixels),0)
    def test_invalid_values_rejected(self):
        for pts in [[[0,0],[float('nan'),1]],[[0,0]]]:
            with self.assertRaises(ValueError):observed_arcs([curve('a','chin',pts)])
    def test_zero_length_not_new_observation(self):
        o=observed_arcs([curve('a','chin',[[0,0],[0,0],[10,0]])])
        self.assertAlmostEqual(o.weights.sum(),.8)

if __name__=='__main__':unittest.main()
