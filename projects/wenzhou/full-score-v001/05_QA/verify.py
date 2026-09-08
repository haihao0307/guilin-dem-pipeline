#!/usr/bin/env python3
import json,hashlib,sys
from pathlib import Path
r=Path(__file__).resolve().parents[1];q=json.loads((r/'05_QA/QA.json').read_text());i=json.loads((r/'03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.index.json').read_text());p=r/'03_SCORE'/i['scoreFile'];ok=q['passed'] and p.stat().st_size==i['scoreFileBytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==i['scoreFileSha256'];print(json.dumps({'passed':ok,'scoreId':i['header']['scoreId'],'scoreBytes':p.stat().st_size},indent=2));sys.exit(0 if ok else 2)
