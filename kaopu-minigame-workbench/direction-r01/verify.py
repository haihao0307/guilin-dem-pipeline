#!/usr/bin/env python3
"""Validate the static R01 document with Python's standard library.
Run: python direction-r01/verify.py [--baseline /path/to/original/index.html]
This does not run game tests or claim that proposed features exist.
"""
from pathlib import Path
from html.parser import HTMLParser
import argparse, json, re, hashlib

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.ids=[];self.links=[];self.scripts=0;self.handlers=[];self.cases=[];self.images=[]
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='a' and 'href' in a:self.links.append(a['href'])
        if tag=='script':self.scripts+=1
        if tag=='img':self.images.append(a.get('src',''))
        self.handlers.extend(k for k in a if k.startswith('on'))
        if 'data-case' in a:self.cases.append(a['data-case'])

parser=argparse.ArgumentParser();parser.add_argument('--baseline',type=Path);args=parser.parse_args()
here=Path(__file__).resolve().parent
html=(here/'index.html').read_text();md=(here/'FOUNDATION.md').read_text();css=(here/'style.css').read_text();ref=json.loads((here/'references.json').read_text());parent=(here.parent/'index.html').read_text()
p=Page(html);q=Page(parent);checks=[]
def check(name,value):
    checks.append({'check':name,'passed':bool(value)})
check('document language and viewport','lang="zh-CN"' in html and 'name="viewport"' in html)
check('all nine sections have stable anchors',all(f's{i}' in p.ids for i in range(1,10)))
check('unique anchors',len(p.ids)==len(set(p.ids)))
check('internal anchors resolve',all(x=='#' or x[1:] in p.ids for x in p.links if x.startswith('#')))
check('document links exist',all((here/x).is_file() for x in p.links if x.startswith('./')))
check('stylesheet exists','href="./style.css"' in html and (here/'style.css').is_file())
check('full Markdown download','download="小游戏总控-R01.md"' in html)
check('no executable scripts or inline handlers',p.scripts==0 and not p.handlers)
check('no external media assets',not p.images and '@import' not in css and 'url(' not in css)
check('three original cases retain order',q.cases==['train','storm-orb','lost-found-bureau'])
check('one independent direction entry',q.links.count('./direction-r01/')==1)
check('original game links retained',all(x in q.links for x in ['./voxel-train-study/game/','./voxel-train-study/','./storm-orb-study/','./lost-found-bureau/']))
check('reference list has unique IDs',len(ref['references'])==len({x['id'] for x in ref['references']}))
check('reference URLs match Markdown',all(x['url'] in md and x['url'] in html for x in ref['references']))
check('current production anchor recorded','375dadb214f66bacfa1c9ff262957e53a911fb39' in md)
check('R10 remains candidate','R10：' in md and '处于候选验收' in md)
check('lost office is not playable','当前不是可玩版' in md)
check('network and replay remain unimplemented','真实联网、朋友活动数据、自动记录/回放/分享、模型训练服务、跨设备 VR 运行均未实现' in md)
check('three experiments are explicitly not wired','尚未接入原游戏' in md and all(x in md for x in ['A · 一站三拍','B · 一起做事','C · 开心回看']))
check('references do not imply rights','参考链接不等于已获发布授权' in md)
check('unknown references remain unknown','仍未确认' in md and '不猜成具体作品或人物' in md)
check('quality and decision anchors published',all((here/f).is_file() and f in html for f in ['QUALITY_ANCHORS.md','DECISIONS.md']))
check('no fake training claim','模型训练' in html and '候选验收' in html)
check('responsive and reduced motion styles','max-width:700px' in css and 'prefers-reduced-motion' in css)
check('no local workspace paths',all(x not in html+md for x in ['/workspace/','/tmp/']))
if args.baseline:
    baseline=args.baseline.read_text()
    original_cases=re.findall(r'<article class="case".*?</article>',baseline,flags=re.S)
    current_cases=re.findall(r'<article class="case".*?</article>',parent,flags=re.S)
    check('original case markup unchanged',current_cases==original_cases and len(current_cases)==3)
    added=r'<a class="direction-link".*?</a>'
    check('parent only gains small entry',re.sub(added,'',parent,flags=re.S)==baseline)
files=['index.html','style.css','FOUNDATION.md','references.json','verify.py','QUALITY_ANCHORS.md','DECISIONS.md']
result={'edition':'R01','passed':sum(x['passed'] for x in checks),'total':len(checks),'checks':checks,'files':{f:hashlib.sha256((here/f).read_bytes()).hexdigest() for f in files},'boundaries':'Static document checks only; does not test game features or real devices.'}
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(0 if all(x['passed'] for x in checks) else 1)
