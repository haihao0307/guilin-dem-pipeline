import copy
import json
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from motion_contract import *


def fixture(joints=5, frames=5):
    # Analytic identity rotations and translating points: NEVER model inference.
    names = ["pelvis"] + [f"joint_{i}" for i in range(1,joints)]
    skel = make_skeleton("synthetic-test-rig", names, [-1]+[0]*(joints-1))
    metadata = {"fps":30,"skeleton":skel,"units":"metres","coordinateSystem":"right-handed-Y-up-+Z-forward",
                "rotationConvention":"absolute-parent-local-matrix","source":{"kind":"synthetic-contract-fixture","neuralInferenceExecuted":False}}
    root = [[0,1,t/30] for t in range(frames)]
    data = {"root_positions":root,"smooth_root_pos":[[x,y+.05,z] for x,y,z in root],
            "posed_joints":[[r]+[[i*.1,0,r[2]] for i in range(1,joints)] for r in root],
            "local_rot_mats":[[[[1,0,0],[0,1,0],[0,0,1]] for _ in names] for _ in root],
            "foot_contacts":[[1,1,1,1] for _ in root]}
    return data,metadata


class ContractTests(unittest.TestCase):
    def test_basis_and_root_travel(self):
        clip=import_kimodo(*fixture())
        self.assertEqual(clip["frames"][0]["rootPosition"],[0,0,1])
        self.assertAlmostEqual(clip["frames"][-1]["rootPosition"][1],-4/30)
        self.assertAlmostEqual(clip["frames"][0]["smoothRootPosition"][2],1.05)
        self.assertEqual(clip["durationSeconds"],4/30)
        self.assertFalse(clip["adaptation"]["retargetedToAnny"])

    def test_rotation_conjugation_and_pi(self):
        data,meta=fixture()
        data["local_rot_mats"][0][0]=[[-1,0,0],[0,1,0],[0,0,-1]] # 180deg Y -> 180deg Z
        r=import_kimodo(data,meta)["frames"][0]["localRotations"][0]
        self.assertEqual(r,[[-1,0,0],[0,-1,0],[0,0,1]])

    def test_no_silent_77_to_104(self):
        data,meta=fixture(77)
        clip=import_kimodo(data,meta)
        self.assertEqual(len(clip["frames"][0]["localRotations"]),77)
        self.assertEqual(clip["skeleton"],meta["skeleton"])

    def test_input_not_mutated(self):
        data,meta=fixture(); previous=copy.deepcopy((data,meta))
        clip=import_kimodo(data,meta); clip["frames"][0]["contacts"][0]=0
        self.assertEqual((data,meta),previous)

    def test_returned_basis_does_not_mutate_future_imports(self):
        clip=import_kimodo(*fixture());clip["adaptation"]["basis"][0][0]=800
        self.assertEqual(import_kimodo(*fixture())["adaptation"]["basis"][0][0],1)

    def test_reject_missing_fps(self):
        d,m=fixture(); del m["fps"]
        with self.assertRaisesRegex(ValueError,"fps"):
            import_kimodo(d,m)

    def test_reject_nonfinite(self):
        for bad in [float("nan"),float("inf"),True]:
            d,m=fixture(); d["root_positions"][0][0]=bad
            with self.assertRaises(ValueError): import_kimodo(d,m)

    def test_reject_wrong_units(self):
        d,m=fixture();m["units"]="centimetres"
        with self.assertRaisesRegex(ValueError,"units"): import_kimodo(d,m)

    def test_reject_euler_or_unlabelled_convention(self):
        d,m=fixture();m["rotationConvention"]="Euler-degrees"
        with self.assertRaisesRegex(ValueError,"convention"): import_kimodo(d,m)

    def test_reject_reflection_and_scaled_matrix(self):
        for val in [-1,2]:
            d,m=fixture();d["local_rot_mats"][0][0][0][0]=val
            with self.assertRaises(ValueError): import_kimodo(d,m)

    def test_reject_mixed_frames(self):
        d,m=fixture();d["foot_contacts"].pop()
        with self.assertRaisesRegex(ValueError,"time axis"): import_kimodo(d,m)

    def test_reject_mixed_joint_count(self):
        d,m=fixture();d["local_rot_mats"][0].pop()
        with self.assertRaisesRegex(ValueError,"joint count"): import_kimodo(d,m)

    def test_reject_wrong_root(self):
        d,m=fixture();d["root_positions"][0]=[8,1,0]
        with self.assertRaisesRegex(ValueError,"root and joint"): import_kimodo(d,m)

    def test_reject_bad_contacts(self):
        d,m=fixture();d["foot_contacts"][0][0]=2
        with self.assertRaisesRegex(ValueError,"contact probability"): import_kimodo(d,m)

    def test_actual_kimodo_boolean_contacts(self):
        d,m=fixture();d["foot_contacts"]=[[True,False,True,False] for _ in d["foot_contacts"]]
        self.assertEqual(import_kimodo(d,m)["frames"][0]["contacts"],[True,False,True,False])

    def test_reject_hierarchy_and_fingerprint(self):
        d,m=fixture();m["skeleton"]["names"][0]="changed"
        with self.assertRaisesRegex(ValueError,"fingerprint"): import_kimodo(d,m)
        with self.assertRaisesRegex(ValueError,"tree"): make_skeleton("cycle",["a","b"],[-1,1])

    def test_no_fake_inference(self):
        d,m=fixture();m["source"]["neuralInferenceExecuted"]=True
        with self.assertRaisesRegex(ValueError,"evidence"): import_kimodo(d,m)

    def test_contact_slip_detected(self):
        clip=import_kimodo(*fixture())
        report=audit_motion(clip,foot_joint_ids=[1,2,3,4],floor_z=0)
        self.assertEqual(report["status"],"flagged")
        self.assertAlmostEqual(report["rows"][1]["maxContactSpeed"],1.)
        self.assertFalse(report["neuralQualityModelExecuted"])

    def test_swing_does_not_count_as_slip(self):
        d,m=fixture();d["foot_contacts"]=[[0]*4 for _ in d["foot_contacts"]]
        report=audit_motion(import_kimodo(d,m),foot_joint_ids=[1,2,3,4])
        self.assertFalse(any(x["metric"]=="maxContactSpeed" for x in report["issues"]))

    def test_missing_floor_is_reported_unchecked(self):
        clip=import_kimodo(*fixture())
        qa=audit_motion(clip,foot_joint_ids=[1,2,3,4])
        self.assertIn("contact penetration",qa["unchecked"])
        self.assertNotIn("contact drift",qa["unchecked"])
        self.assertEqual(qa["measurementConfig"]["footJointIds"],[1,2,3,4])
        self.assertIsNone(qa["measurementConfig"]["floorZMetres"])

    def test_qa_records_measurement_conditions(self):
        clip=import_kimodo(*fixture())
        qa=audit_motion(clip,foot_joint_ids=[1,2,3,4],floor_z=-.1,expected_motion_mask=[False]*5)
        self.assertEqual(qa["measurementConfig"]["floorZMetres"],-.1)
        self.assertEqual(qa["measurementConfig"]["expectedMotionMask"],[False]*5)
        self.assertNotIn("contact penetration",qa["unchecked"])

    def test_static_is_not_automatically_corrupt(self):
        d,m=fixture();
        for k in d: d[k]=[copy.deepcopy(d[k][0]) for _ in d[k]]
        clip=import_kimodo(d,m)
        self.assertEqual(audit_motion(clip)["status"],"no-configured-flags")
        self.assertTrue(any(x["metric"]=="unexpectedFrozen" for x in audit_motion(clip,expected_motion_mask=[True]*5)["issues"]))

    def test_pop_and_bone_drift(self):
        d,m=fixture();d["posed_joints"][2][1][0]+=1
        report=audit_motion(import_kimodo(d,m))
        self.assertTrue(any(x["metric"]=="maxJointAcceleration" for x in report["issues"]))
        self.assertTrue(any(x["metric"]=="maxBoneLengthDrift" for x in report["issues"]))

    def test_rotational_motion_not_frozen(self):
        d,m=fixture()
        for k in d: d[k]=[copy.deepcopy(d[k][0]) for _ in d[k]]
        # A leaf can rotate in place without moving any tracked joint location.
        d["local_rot_mats"][1][-1]=[[-1,0,0],[0,1,0],[0,0,-1]]
        qa=audit_motion(import_kimodo(d,m),expected_motion_mask=[False,True,False,False,False])
        self.assertFalse(qa["rows"][1]["unexpectedFrozen"])

    def test_contact_penetration(self):
        d,m=fixture();d["posed_joints"][0][1][1]=-.01
        report=audit_motion(import_kimodo(d,m),foot_joint_ids=[1,2,3,4],floor_z=0)
        self.assertAlmostEqual(report["rows"][0]["maxContactPenetration"],.01)

    def test_archive_binds_exact_clip(self):
        clip=import_kimodo(*fixture()); qa=audit_motion(clip)
        rights={"codeLicense":"original","modelLicense":"not-used","inputRights":"synthetic","redistributionApproved":False}
        record=archive_record(clip,qa,source_asset_sha256="a"*64,rights=rights)
        self.assertEqual(record["publicationState"],"local-only")
        self.assertEqual(record["clipSha256"],digest(clip))
        clip["frames"][0]["contacts"][0]=0
        with self.assertRaisesRegex(ValueError,"different clip"): archive_record(clip,qa,source_asset_sha256="a"*64,rights=rights)

    def test_canonical_digest_order_independent(self):
        self.assertEqual(digest({"a":1,"b":2}),digest({"b":2,"a":1}))

    def test_npz_safe_numeric_roundtrip(self):
        import numpy as np
        import tempfile, subprocess
        d,m=fixture()
        with tempfile.TemporaryDirectory() as td:
            td=Path(td);np.savez(td/"test.npz",**{k:np.array(v) for k,v in d.items()})
            (td/"meta.json").write_text(json.dumps(m))
            result=subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/"motion_contract.py"),str(td/"test.npz"),str(td/"meta.json"),str(td/"clip.json")],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads((td/"clip.json").read_text()),import_kimodo(d,m))


if __name__ == "__main__":
    unittest.main(verbosity=2)
