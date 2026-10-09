"""Optional source-contract test. Reads pinned definitions.py, never imports it.

Usage: python motion-architecture/tests/pinned-kimodo-schema.py <definitions.py>
The external source is not vendored here. This is NOT model inference.
"""
import ast
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from motion_contract import make_skeleton, validate_clip


def main(source):
    record = next(r for r in json.loads((ROOT/"SOURCE-INDEX.json").read_text())["files"]
                  if r["repo"]=="nv-tlabs/kimodo" and r["path"]=="kimodo/skeleton/definitions.py")
    raw = Path(source).read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != record["readTextSha256"]:
        raise ValueError("Pinned source text hash mismatch; inspect version before updating the source index")
    tree = ast.parse(raw.decode())
    cls = next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=="SOMASkeleton77")
    pairs = None
    for n in cls.body:
        if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=="bone_order_names_with_parents" for t in n.targets):
            pairs=ast.literal_eval(n.value)
    if pairs is None or len(pairs)!=77:
        raise ValueError("Expected explicit SOMASkeleton77 parent table")
    names=[name for name,parent in pairs]
    parents=[-1 if p is None else names.index(p) for n,p in pairs]
    skeleton=make_skeleton("somaskel77",names,parents)
    root=np.array([[0,1,0],[0,1,.05],[0,1,.1]],dtype=np.float32)
    points=np.tile(root[:,None,:],(1,77,1))
    # Analytical fixture only, preserving official topology/order. No source mocap.
    for j,p in enumerate(parents):
        if p>=0:points[:,j,:]=points[:,p,:]+np.array([.01,.02,.03],dtype=np.float32)
    rotations=np.tile(np.eye(3,dtype=np.float32),(3,77,1,1))
    metadata={"fps":30,"skeleton":skeleton,"units":"metres","coordinateSystem":"right-handed-Y-up-+Z-forward",
              "rotationConvention":"absolute-parent-local-matrix","source":{"kind":"synthetic-contract-fixture","neuralInferenceExecuted":False,"skeletonSource":record["url"]}}
    with tempfile.TemporaryDirectory() as td:
        td=Path(td)
        np.savez(td/"source.npz",root_positions=root,local_rot_mats=rotations,posed_joints=points,
                 foot_contacts=np.array([[True,False,True,False]]*3,dtype=np.bool_),smooth_root_pos=root+np.array([0,.1,0],dtype=np.float32))
        (td/"metadata.json").write_text(json.dumps(metadata))
        subprocess.run([sys.executable,str(ROOT/"motion_contract.py"),str(td/"source.npz"),str(td/"metadata.json"),str(td/"clip.json")],check=True,capture_output=True)
        clip=validate_clip(json.loads((td/"clip.json").read_text()))
    assert clip["skeleton"]==skeleton
    assert len(clip["frames"][0]["localRotations"])==77
    assert clip["frames"][0]["contacts"]==[True,False,True,False]
    assert abs(clip["frames"][-1]["rootPosition"][1]+.1)<1e-7
    assert abs(clip["frames"][0]["smoothRootPosition"][2]-1.1)<1e-7
    report={"schema":"kaopu-pinned-kimodo-schema-qa/1","testedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "passed":True,"source":record["url"],"sourceTextSha256":actual,"jointCount":77,"frames":3,
            "sourceSkeletonFingerprint":skeleton["fingerprint"],"inputDtypes":{"motion":"float32","contacts":"bool"},
            "upstreamCodeExecuted":False,"neuralInferenceExecuted":False,"weightsDownloaded":False,
            "fixture":"synthetic positions and identity rotations, official named parent table read statically; not a generated motion sample"}
    (ROOT/"KIMODO-SCHEMA-QA.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))


if __name__=="__main__":
    if len(sys.argv)!=2:raise SystemExit(__doc__)
    main(sys.argv[1])
