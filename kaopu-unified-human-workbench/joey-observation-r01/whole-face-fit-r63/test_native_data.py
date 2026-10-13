"""Original synthetic tests; these do not measure a photograph or likeness."""
import unittest
import numpy as np
from geometry import project_native
from native_data import camera_from_pose, calibrate_camera_envelope


class CalibrationTests(unittest.TestCase):
    def setUp(self):
        self.points = np.array([[-.03,-.14,.70],[.03,-.14,.70],[-.025,-.13,.67],[.025,-.13,.67],[0.,-.17,.67],[0.,-.12,.62],[-.05,-.10,.68],[.05,-.10,.68]])
        self.center = np.array([0.,-.12,.68])

    def test_known_perspective_camera_recovered_without_shape_change(self):
        original = self.points.copy()
        camera = camera_from_pose(600,800,1200,[.08,-.35,.10],self.center,[.03,-.02,-1.2])
        target = project_native(self.points,camera).pixels
        rows = calibrate_camera_envelope(self.points,target,np.ones(8)*2,600,800,focal_ratios=[2.],center_native=self.center)
        self.assertLess(rows[0]['rmsPixels'],1e-5)
        np.testing.assert_array_equal(self.points, original)
        self.assertFalse(rows[0]['physicalCameraKnown'])

    def test_separate_photo_viewports_and_focals(self):
        for width,height,ratio in [(600,887,2.),(800,1000,.8)]:
            c=camera_from_pose(width,height,width*ratio,[.04,.20,-.09],self.center,[0.,0.,-.9])
            p=project_native(self.points,c).pixels
            rows=calibrate_camera_envelope(self.points,p,2.,width,height,focal_ratios=[ratio],center_native=self.center)
            self.assertLess(rows[0]['rmsPixels'],1e-4)
            self.assertEqual(rows[0]['camera'].width,width)

    def test_focal_alternatives_retained_not_declared_unique(self):
        c=camera_from_pose(600,800,1200,[0.,.05,0.],self.center,[0.,0.,-2.])
        rows=calibrate_camera_envelope(self.points,project_native(self.points,c).pixels,3.,600,800,focal_ratios=[.8,2.,5.],center_native=self.center)
        self.assertEqual({x['focalRatio'] for x in rows},{.8,2.,5.})
        self.assertTrue(all(not x['physicalCameraKnown'] for x in rows))

    def test_invalid_camera_inputs_rejected(self):
        with self.assertRaises(ValueError):camera_from_pose(600,800,-1,[0,0,0],self.center,[0,0,-1])
        with self.assertRaises(ValueError):calibrate_camera_envelope(self.points[:4],np.zeros((4,2)),2.,600,800)
        with self.assertRaises(ValueError):calibrate_camera_envelope(self.points,np.zeros((8,2)),0.,600,800)

if __name__=='__main__':unittest.main()
