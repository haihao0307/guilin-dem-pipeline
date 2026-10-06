"""Static contract checks only. Browser screenshot/navigation checks are separate."""
from html.parser import HTMLParser
from pathlib import Path
import json,re,hashlib
root=Path(__file__).resolve().parents[1]
class Parse(HTMLParser):
    def __init__(self): super().__init__();self.tags=[]
    def handle_starttag(self,tag,attrs): self.tags.append((tag,dict(attrs)))
p=Parse();p.feed((root/'index.html').read_text())
ids=[a['id'] for t,a in p.tags if 'id'in a]
assert len(ids)==len(set(ids)), 'Duplicate ID'
assert all(k in ids for k in ['people','clothing','animals','hair','shared-stage','ten24'])
assert len([1 for t,a in p.tags if t=='a' and 'data-entry' in a])==19
assert 'TEN24 接入待完成' in (root/'index.html').read_text()
assert not [t for t,a in p.tags if t in ('iframe','canvas','script')], 'Overview must remain static and lightweight'
for tag,a in p.tags:
    if tag=='img':
        assert a.get('alt') and len(a['alt'])>5
        assert (root/a['src']).is_file(),a['src']
    if tag=='a':
        assert a.get('target')!='_blank'
        assert a.get('href') not in ('#','',None)
        if a['href'].startswith('#'):assert a['href'][1:] in ids
        for attr in ['aria-labelledby','aria-describedby']:
            for value in a.get(attr,'').split():assert value in ids,value
assert any(t=='a' and a.get('href')=='../kaopu-face-workbench/?release=r02-41d46766#edit' for t,a in p.tags)
assert len([t for t,a in p.tags if t=='article' and 'workbench-card' in a.get('class','')])==3
css=(root/'style.css').read_text()
assert '@media(max-width:760px)' in css and ':focus-visible' in css
assert 'prefers-reduced-motion' in css
try:
    import tinycss2
    errs=[e for e in tinycss2.parse_stylesheet(css,skip_comments=True,skip_whitespace=True) if e.type=='error']
    assert not errs,errs
except ImportError:pass
print(json.dumps({'staticPassed':True,'browserExecuted':False,'route':'kaopu-human-overview/','files':[{'path':str(f.relative_to(root)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(root.rglob('*')) if f.is_file()]},ensure_ascii=False,indent=2))
