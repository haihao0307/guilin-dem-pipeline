import copy
from fractions import Fraction
from math import sqrt
import unittest

from hydraulic_sections import ChannelSection, BundSection, Opening
from hydraulic_step import Pool, shared_boundary_registry, step
from water_ledger import SnapshotKey, Transfer, advance


class SectionTests(unittest.TestCase):
    def test_channel_cross_section_has_soil_sides_and_freeboard(self):
        s = ChannelSection(.4, 1.5, .5)
        self.assertEqual(s.profile(), ((-.95,.5),(-.2,0.),(.2,0.),(.95,.5)))
        m = s.measure(.2)
        self.assertAlmostEqual(m["area_m2"], .14)
        self.assertAlmostEqual(m["top_width_m"], 1.)
        self.assertAlmostEqual(m["freeboard_m"], .3)
        with self.assertRaisesRegex(ValueError, "overtopping"):
            s.measure(.6)

    def test_manning_known_rectangular_example_and_scope(self):
        s = ChannelSection(2.,0.,2.)
        q = s.normal_discharge(water_depth_m=1., manning_n=.025,
                               energy_slope=.01, uniform_flow_confirmed=True)
        self.assertAlmostEqual(q, 5.039684199579493)
        with self.assertRaisesRegex(ValueError, "backwater"):
            s.normal_discharge(water_depth_m=1., manning_n=.025,
                               energy_slope=.01, uniform_flow_confirmed=False)

    def test_bund_keeps_distinct_toes_and_walkable_crest(self):
        s = BundSection(.5, 1., .7, .1, 1., 1.5)
        p = s.profile()
        self.assertAlmostEqual(p[0][0], -.55)
        self.assertEqual(p[0][1], .7)
        self.assertAlmostEqual(p[-1][0], 1.6)
        self.assertEqual(p[-1][1], .1)
        self.assertAlmostEqual(p[2][0]-p[1][0], .5)
        with self.assertRaises(ValueError):
            BundSection(.5, 1., 1., .1, 1., 1.5)

    def test_shared_semantic_boundary_built_once(self):
        r = shared_boundary_registry({"A":["a","b","c","d"], "B":["b","e","f","c"]})
        self.assertEqual(len(r["boundaries"]), 7)
        shared = [x for x in r["boundaries"] if len(x["served_fields"])==2]
        self.assertEqual(shared, [{"vertices":("b","c"),"served_fields":("A","B")}])
        reverse = shared_boundary_registry({"B":["c","f","e","b"], "A":["d","c","b","a"]})
        self.assertEqual(r["boundaries"], reverse["boundaries"])

    def test_nonmanifold_boundary_rejected(self):
        with self.assertRaisesRegex(ValueError, "non-manifold"):
            shared_boundary_registry({"A":["a","b","c"],"B":["b","a","d"],"C":["a","b","e"]})


class OpeningTests(unittest.TestCase):
    def test_fully_submerged_analytic_oracle(self):
        o = Opening("o","a","b",0.,.2,.1,1.)
        self.assertAlmostEqual(o.discharge(.5,.3), .02*sqrt(2*9.80665*.2))
        self.assertAlmostEqual(o.discharge(.3,.5), -.02*sqrt(2*9.80665*.2))

    def test_integral_against_independent_midpoint_quadrature(self):
        o = Opening("o","a","b",.05,.2,.2,1.)
        for high,low in ((.1,0.),(.3,.1),(.4,.35)):
            with self.subTest(high=high,low=low):
                top = min(high,.25)
                dz = (top-.05)/20000
                q = sum(sqrt(2*9.80665*(high-max(low,.05+(i+.5)*dz))) * .2*dz for i in range(20000))
                self.assertAlmostEqual(o.discharge(high,low), q, delta=1e-8)

    def test_equal_heads_dry_and_blocked(self):
        o = Opening("o","a","b",.1,.2,.2,1.)
        self.assertEqual(o.discharge(.4,.4),0.)
        self.assertEqual(o.discharge(.05,0.),0.)
        self.assertEqual(Opening("o","a","b",.1,.2,.2,1.,blockage=1).discharge(.4,.2),0.)

    def test_partial_blockage_is_declared_open_width(self):
        base = Opening("o","a","b",.1,.2,.2,1.)
        narrow = Opening("o","a","b",.1,.2,.2,1.,blockage=.75)
        self.assertAlmostEqual(narrow.discharge(.4,.2),base.discharge(.4,.2)/4)

    def test_no_unjustified_field_coefficient(self):
        with self.assertRaisesRegex(ValueError, "calibration"):
            Opening("o","a","b",.1,.2,.2,.61)


class IntegrationTests(unittest.TestCase):
    def args(self):
        key = SnapshotKey("synthetic","SI-frame","r022",0)
        return dict(pools=[Pool("a",0.,100.,1.),Pool("b",-2.,1e6,2.)],
                    openings=[Opening("drain","a","b",0.,.05,1.,1.)],
                    storage_m3={"a":10.,"b":0.},snapshot=key,expected_snapshot=key,
                    end_time_s=Fraction(1,4))

    def test_exact_fractional_clock_and_forcing_once(self):
        a = self.args()
        a.update(openings=[],source_budgets_m3={"rain":1.},forcing_edges=[("rain","a")],
                 forcing_transfers=[Transfer("forcing:rain","rain","a",1.)])
        r = step(**a)
        self.assertEqual(r["storage_m3"]["a"],11.)
        self.assertEqual(r["external_in_m3"],1.)
        self.assertEqual(r["interval_rational_s"],[[0,1],[1,4]])
        self.assertEqual(r["mass_balance_error_m3"],0.)

    def test_free_tank_drainage_matches_closed_form(self):
        a = self.args()
        for tick in range(2400):
            t = Fraction(tick,4)
            key = SnapshotKey("synthetic","SI-frame",str(t),t)
            a.update(snapshot=key,expected_snapshot=key,end_time_s=t+Fraction(1,4))
            a["storage_m3"] = step(**a)["storage_m3"]
        coefficient = 2/3*.05*sqrt(2*9.80665)
        expected_h = (.1**(-.5)+coefficient*600/(2*100))**(-2)
        self.assertAlmostEqual(a["storage_m3"]["a"]/100,expected_h,delta=1e-8)
        self.assertAlmostEqual(sum(a["storage_m3"].values()),10.,places=10)

    def test_immutable_inputs_and_link_order(self):
        a = self.args()
        a["pools"].append(Pool("c",-1.,100.,1.))
        a["storage_m3"]["c"]=5.
        a["openings"].append(Opening("other","a","c",0.,.02,.1,1.))
        original=copy.deepcopy(a)
        r=step(**a)
        self.assertEqual(a,original)
        a["openings"].reverse()
        a["pools"].reverse()
        self.assertEqual(r,step(**a))

    def test_invalid_snapshot_and_subsurface_opening_rejected(self):
        a=self.args()
        a["expected_snapshot"]=SnapshotKey("other","SI-frame","r022",0)
        with self.assertRaisesRegex(ValueError,"snapshot"):
            step(**a)
        a=self.args()
        a["openings"]=[Opening("drain","a","b",-.1,.05,1.,1.)]
        with self.assertRaisesRegex(ValueError,"below"):
            step(**a)

    def test_large_step_remains_nonnegative_without_water_loss(self):
        a=self.args()
        a["end_time_s"]=100000
        r=step(**a)
        self.assertGreaterEqual(min(r["storage_m3"].values()),0.)
        self.assertAlmostEqual(sum(r["storage_m3"].values()),10.)
        self.assertTrue(r["links"][0]["limited"])


if __name__ == "__main__":
    unittest.main()
