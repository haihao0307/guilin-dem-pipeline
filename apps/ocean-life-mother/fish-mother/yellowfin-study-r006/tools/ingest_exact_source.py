from __future__ import annotations
import argparse, hashlib, json, shutil, subprocess, sys
from pathlib import Path

KNOWN={
 "f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0":{"bytes":6137560,"variant":"geometry-rig-motion-1024","canonical":"tuna_fish.glb"},
 "5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe":{"bytes":58908280,"variant":"appearance-4096","canonical":"tuna_fish_4k.glb"},
}

def main():
 p=argparse.ArgumentParser(description="Verify and ingest exact FISH-REF-002 into a local evidence workspace")
 p.add_argument("source",type=Path)
 p.add_argument("--workspace",type=Path,required=True)
 a=p.parse_args()
 raw=a.source.read_bytes(); h=hashlib.sha256(raw).hexdigest(); n=len(raw)
 if h not in KNOWN or KNOWN[h]["bytes"]!=n:
  raise SystemExit(f"REJECTED: not exact FISH-REF-002: sha256={h} bytes={n}")
 meta=KNOWN[h]; a.workspace.mkdir(parents=True,exist_ok=True)
 srcdir=a.workspace/"source"; evdir=a.workspace/"evidence"; srcdir.mkdir(exist_ok=True); evdir.mkdir(exist_ok=True)
 dst=srcdir/meta["canonical"]; shutil.copyfile(a.source,dst)
 extractor=Path(__file__).with_name("extract_yellowfin_copy_evidence.py")
 packer=Path(__file__).with_name("build_kaopu_source_copy_package.py")
 subprocess.run([sys.executable,str(extractor),str(dst),"--out",str(evdir)],check=True)
 packagedir=a.workspace/"kaopu-reference-package"; packagedir.mkdir(exist_ok=True)
 subprocess.run([sys.executable,str(packer),str(dst),"--out",str(packagedir)],check=True)
 receipt={
  "schema":"kaopu.fish-mother.fish-ref-002-ingest/1.0",
  "sourceInput":str(a.source),
  "verifiedSha256":h,
  "verifiedBytes":n,
  "variant":meta["variant"],
  "workspaceSource":str(dst),
  "evidenceDirectory":str(evdir),
  "kaopuReferencePackage":str(packagedir),
  "sourceCopyUnlocked":False,
  "rule":"Evidence extraction is not Source Copy acceptance."
 }
 (a.workspace/"INGEST_RECEIPT.json").write_text(json.dumps(receipt,indent=2)+"\n")
 print(json.dumps(receipt,indent=2))

if __name__=="__main__":main()
