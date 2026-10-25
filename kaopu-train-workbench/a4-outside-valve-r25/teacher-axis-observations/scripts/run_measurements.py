#!/usr/bin/env python3
"""Run read-only numeric teacher observations against an independently obtained source.
Does not fetch, edit, copy or package source assets. All mesh use is in memory.
"""
import argparse, os, subprocess, sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',required=True,help='Directory containing original object.json and fields.bin.gz');p.add_argument('--output',required=True,help='Writable result directory, separate from source');a=p.parse_args()
source=Path(a.source).resolve();out=Path(a.output).resolve();scripts=Path(__file__).resolve().parent
if source==out or source in out.parents:raise SystemExit('Output must not be the source directory or its descendant.')
out.mkdir(parents=True,exist_ok=True);(out/'results').mkdir(exist_ok=True)
env=dict(os.environ,A4_MEASURE_SOURCE=str(source),A4_MEASURE_OUTPUT=str(out),MPLCONFIGDIR='/tmp/a4-teacher-mpl',XDG_CACHE_HOME='/tmp/a4-teacher-cache')
subprocess.run([sys.executable,str(scripts/'analyze_teacher.py'),str(source),str(out/'results')],check=True,env=env)
for name in ['inspect_components.py','screen_center.py','measure_axes.py','measure_axle_detail.py']:
 subprocess.run([sys.executable,str(scripts/name)],check=True,env=env)
print('Measurements complete. Numeric results:',out/'results')
print('Private source-geometry inspection plots:',out/'private-inspection')
