import unittest
from scan_eye_components import evaluate_image, compare_boundaries

def image(top=5, bottom=12):
    a=[(140,140,140)]*(70*30)
    for lo,hi,col in [(5,25,(255,0,0)),(40,60,(0,255,0))]:
        for y in range(top,bottom+1):
            for x in range(lo,hi+1): a[y*70+x]=col
    return a

class ContourTests(unittest.TestCase):
    def test_static_is_zero(self):
        x=evaluate_image(image(),70,30);r=compare_boundaries(x,x)
        self.assertTrue(all(p[e]['deltaPx']==0 for v in r.values()for p in v['segments']for e in ('upper','lower')))
    def test_only_upper_boundary_moves(self):
        r=compare_boundaries(evaluate_image(image(),70,30),evaluate_image(image(top=7),70,30))
        self.assertTrue(all(p['upper']['deltaPx']==2 and p['lower']['deltaPx']==0 for v in r.values()for p in v['segments']))
    def test_missing_eye_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'resolved'): evaluate_image([(140,140,140)]*(70*30),70,30)
    def test_size_mismatch_is_rejected(self):
        x=evaluate_image(image(),70,30);y={**x,'height':31}
        with self.assertRaisesRegex(ValueError,'sizes'): compare_boundaries(x,y)
    def test_black_unknown_above_eye_is_not_a_skin_lid(self):
        pixels=image()
        for x in range(5,26):pixels[4*70+x]=(0,0,0)
        a=evaluate_image(image(),70,30);b=evaluate_image(pixels,70,30)
        with self.assertRaisesRegex(ValueError,'gray-skin-supported'):compare_boundaries(a,b)
    def test_blue_other_component_above_eye_is_not_a_skin_lid(self):
        pixels=image()
        for x in range(5,26):pixels[4*70+x]=(0,0,255)
        a=evaluate_image(image(),70,30);b=evaluate_image(pixels,70,30)
        with self.assertRaisesRegex(ValueError,'gray-skin-supported'):compare_boundaries(a,b)

if __name__=='__main__':unittest.main()
