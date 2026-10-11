"""Hash-guarded finishing patch: unobstructed previews and exact current-preview acceptance."""
from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parent
EXPECTED={
 'style.css':'a530c151926b595f103e808ff2d4b8c1a2ae3b0112f36131c739373ebf0f3121',
 'qa_r0433.py':'f2cf864d1be6817fa6cb8b8a01218af123959f4ba6e50cc66ba015b5c2d56a5a',
 'release_r0433.py':'a4a1c486ae91751af5a93467ef56a0bf27251e611c28bf556621d6640617d8c1'}
texts={n:(P/n).read_text() for n in EXPECTED}
for n,h in EXPECTED.items():assert hashlib.sha256((P/n).read_bytes()).hexdigest()==h,('Unexpected source; no overwrite',n)
def edit(n,a,b):
 assert texts[n].count(a)==1,(n,a[:90],texts[n].count(a))
 texts[n]=texts[n].replace(a,b)
texts['style.css']+='''\n/* R0433 final: quality labels must never cover a real sleeve or hem. */
.thumb{aspect-ratio:auto}
.thumb img{height:auto;aspect-ratio:4/5;object-fit:contain}
.thumb>span{position:static;display:block}
.thumb>.pending{height:auto;min-height:150px;aspect-ratio:4/5}
'''
helper='''def audit_cards(p,name):
 old=p.evaluate('[scrollX,scrollY]');p.locator('#cards .card').first.scroll_into_view_if_needed()
 p.wait_for_function("[...document.querySelectorAll('#cards .thumb img')].filter(e=>{const b=e.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).every(e=>e.complete&&e.naturalWidth>0)")
 rows=p.evaluate("""[...document.querySelectorAll('#cards .thumb img')].filter(e=>{const b=e.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).map(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.querySelector(':scope>span')?.getBoundingClientRect();return{src:e.getAttribute('src'),natural:[e.naturalWidth,e.naturalHeight],ratio:a.width/a.height,fit:getComputedStyle(e).objectFit,labelBelow:!!b&&b.top>=a.bottom-.5}})""")
 check(name,len(rows)>0 and all(r['natural']==[320,400] and abs(r['ratio']-.8)<.01 and r['fit']=='contain' and r['labelBelow'] for r in rows),rows)
 p.evaluate('p=>scrollTo(...p)',old)
'''
edit('qa_r0433.py','try:\n with sync_playwright() as pw:',helper+'try:\n with sync_playwright() as pw:')
edit('qa_r0433.py',"  for row in CAT['rows']:","  audit_cards(page,'desktop outfit previews: complete image and non-overlapping state label')\n  for row in CAT['rows']:")
edit('qa_r0433.py',"  page.evaluate('async()=>{await __R04.select(\"T01-P01\");__R04.focus(\"scene\");__R04.view(\"three\");}');page.screenshot", "   audit_cards(page,'desktop '+cat+' previews: state label outside garment image')\n  page.evaluate('async()=>{await __R04.select(\"T01-P01\");__R04.focus(\"scene\");__R04.view(\"three\");}');page.screenshot")
edit('qa_r0433.py',"  check('mobile no horizontal page overflow'", "  audit_cards(page,'mobile outfit previews: complete image and non-overlapping state label')\n  check('mobile no horizontal page overflow'")
edit('release_r0433.py'," def check(t):\n  name,meta=t;", " active_previews={'assets/results/'+r['thumb'] for r in load('assets/results/index.json')['rows'].values()}|{'assets/outfits/'+r['id']+'.png' for r in load('R0433_BROWSER_REPORT.json')['outfits']}\n assert len(active_previews)==492 and active_previews<=set(m['files'])\n def check(t):\n  name,meta=t;")
edit('release_r0433.py',"  png=name.startswith(('assets/results/','assets/outfits/')) and name.endswith('.png')", "  # Legacy checkpoint screenshots are retained and hash-checked, not mislabelled as current previews.\n  png=name in active_previews")
edit('release_r0433.py',"'decodedNonemptyPreviewCount':492,'checked':rows", "'decodedNonemptyPreviewCount':492,'previewScope':'exact 60 indexed native thumbnails plus 432 indexed outfits; retained history still byte-verified','checked':rows")
for n,t in texts.items():(P/n).write_text(t)
(P/'R0433_FINAL_PATCH.json').write_text(json.dumps({'before':EXPECTED,'after':{n:hashlib.sha256((P/n).read_bytes()).hexdigest() for n in texts},'garmentDataChanged':False,'qualityLabelsRemoved':False,'legacyEvidenceAltered':False,'thumbnailStatusLabels':'moved outside original 4:5 image','publicPreviewScope':'60 active native previews plus 432 outfits; verify byte hashes for all legacy evidence too'},indent=2))
print('Finishing patch applied: unoccluded garment cards and exact public preview registry')
