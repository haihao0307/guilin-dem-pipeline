"""Validate actual browser-exported GLB/USDA with third-party readers."""
from pathlib import Path
import json,struct
from pxr import Usd, UsdGeom, UsdSkel
for folder in [Path('qa-chromium'),Path('qa-webkit')]:
 p=folder/'mhr-export.usda';stage=Usd.Stage.Open(str(p));assert stage
 sk=UsdSkel.Skeleton(stage.GetPrimAtPath('/MHR/Skeleton'));body=UsdGeom.Mesh(stage.GetPrimAtPath('/MHR/Body'))
 assert len(sk.GetJointsAttr().Get())==127;assert len(body.GetPointsAttr().Get())==18439
 cache=UsdSkel.Cache();cache.Populate(UsdSkel.Root(stage.GetPrimAtPath('/MHR')),Usd.PrimDefaultPredicate);query=cache.GetSkelQuery(sk);assert query and len(query.ComputeJointSkelTransforms(Usd.TimeCode.Default()))==127
 b=(folder/'mhr-export.glb').read_bytes();assert b[:4]==b'glTF';n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);assert len(g['skins'][0]['joints'])==127;assert g['accessors'][0]['count']==18439
 print(folder,'USD skeleton and mesh, GLB skin verified')
