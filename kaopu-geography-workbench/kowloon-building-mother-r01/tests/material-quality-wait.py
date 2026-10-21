#!/usr/bin/env python3
"""Read-only bounded log/marker observer for one already-running QA process."""
import argparse,pathlib,time,sys
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--marker',choices=['first-ready','done'],required=True);p.add_argument('--seconds',type=int,required=True);a=p.parse_args();out=pathlib.Path(a.output);log=pathlib.Path('/tmp/window-corner-live.log');seen=0;end=time.monotonic()+a.seconds
while True:
 text=log.read_text() if log.exists() else ''
 if len(text)>seen:print(text[seen:],end='',flush=True);seen=len(text)
 if (out/a.marker).exists():
  if a.marker=='done' and not (out/'done').read_text().startswith('actual_'):raise SystemExit(1)
  print('EVIDENCE_MARKER_READY '+a.marker,flush=True);break
 if (out/'done').exists():print('Study ended before requested image marker',flush=True);raise SystemExit(1)
 if time.monotonic()>end:print('Bounded observer deadline; no image completion claimed',flush=True);raise SystemExit(1)
 time.sleep(2)
