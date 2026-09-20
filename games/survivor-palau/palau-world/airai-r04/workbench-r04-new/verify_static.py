from pathlib import Path
import hashlib, re, sys
p=Path(__file__).with_name('index.html')
s=p.read_text(encoding='utf-8')
required=[
 '134.5667427743189','7.349032638038719',
 "LNDARE.geojson","COALNE.geojson","OSM_SEMANTICS_CORE_R07.geojson","SOUNDG_NORMALIZED.geojson",
 'AIRAI_QA','PalauWorld','无传统 LOD','完整地图 R04'
]
missing=[x for x in required if x not in s]
if missing:
 print('missing',missing);sys.exit(1)
if '<script>' not in s or '</script>' not in s or '<canvas' not in s:
 print('structure invalid');sys.exit(1)
print({'bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'required':len(required),'status':'PASS'})
