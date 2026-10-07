from html.parser import HTMLParser
from pathlib import Path
import json
class P(HTMLParser):
 def __init__(self):super().__init__();self.tags=[]
 def handle_starttag(self,t,a):self.tags.append((t,dict(a)))
r=Path('kaopu-human-overview');s=(r/'index.html').read_text();p=P();p.feed(s);ids=[a['id'] for t,a in p.tags if 'id' in a];assert len(ids)==len(set(ids));entries=[a for t,a in p.tags if t=='a' and 'data-entry' in a];assert len(entries)==20 and len({a['href'] for a in entries})==20;assert all(a.get('target')!='_blank' and a.get('data-return')=='direct' for a in entries);assert not [t for t,a in p.tags if t in ('canvas','iframe','script')]
for t,a in p.tags:
 if t=='img':assert (r/a['src']).is_file() and len(a.get('alt',''))>5
for case in ['swatch','structured','shorts','sleeveless','shortsleeve']:assert any(a['href']=='../kaopu-tailor-workbench/?case='+case for a in entries)
assert '需本地原件' in s and '材质等价与人工视觉验收尚未完成' in s;assert '1/45' in s and '未迁移 MHR 姿态与表情' in s
print(json.dumps({'passed':True,'entries':20,'sameTab':True,'noParallelModels':True}))
