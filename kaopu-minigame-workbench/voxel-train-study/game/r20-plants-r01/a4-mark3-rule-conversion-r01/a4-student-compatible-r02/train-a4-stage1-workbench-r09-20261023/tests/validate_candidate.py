import json,pathlib,re,subprocess,hashlib,ast
ROOT=pathlib.Path(__file__).resolve().parents[1]
a=json.loads((ROOT/'data/anatomy.json').read_text())
assert len(a['groups'])==118 and len(a['systems'])==9
assert sorted(n for g in a['groups'] for n in g['mesh_nodes'])==sorted(m['node'] for g in a['groups'] for m in g['meshes'])
assert len(set(n for g in a['groups'] for n in g['mesh_nodes']))==200
assert sum(g['triangle_count'] for g in a['groups'])==1004013
assert len(set(g for s in a['systems'] for g in s['source_groups']))==118
sections=json.loads((ROOT/'data/sections-index.json').read_text());assert len(sections)==27
assert sum(s['count'] for s in sections)==10113
for s in sections:
 d=json.loads((ROOT/'data'/s['file']).read_text());assert len(d['segments'])==s['count']
 for seg in d['segments']:
  assert all(abs(p[s['axis']]-s['value'])<1e-9 for p in seg['p'])
  assert seg['w']['position_field']>=0 and seg['w']['triangle_index']>=0
n55=json.loads((ROOT/'data/n55.json').read_text());assert len(n55['components'])==496
assert sum(map(len,n55['triangle_component_map'].values()))==59488
assert set(x for arr in n55['triangle_component_map'].values() for x in arr)==set(c['geometry_component'] for c in n55['components'])
for p in ROOT.glob('*.mjs'):subprocess.run(['node','--check',str(p)],check=True)
html=(ROOT/'index.html').read_text()
for i,script in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',html,re.S)):
 try:json.loads(script);continue
 except:pass
 p=ROOT/'evidence'/f'inline-{i}.js';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True)
ast.parse((ROOT/'tests/browser-qa.py').read_text())
assert 'async def serve(route,request)' in (ROOT/'tests/browser-qa.py').read_text()
assert 'or \'index.html\'' in (ROOT/'tests/browser-qa.py').read_text()
assert '[hidden]{display:none!important}' in (ROOT/'style.css').read_text()
report={'passed':True,'counts':a['coverage'],'sections':27,'segments':10113,'n55_components':496,'n55_mapped_triangles':59488,'scope':'Data closure, planar witnesses, source ID mapping, all JS including inline and Python syntax. Browser not claimed by this test.'}
(ROOT/'evidence/CPU_CHECKS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
