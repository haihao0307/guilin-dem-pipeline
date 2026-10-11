"""Inherit every existing acceptance assertion, with new version and extra display checks."""
from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parent
sources={'qa_r0433.py':'8f8c4f80a62c12b2811f329981a6a4491e6fae17911511d30f878831b984ec57','qa_fresh_r0433.py':'35c312fbe6d1625e9ac83e8d10052b80dacfc45ecbb4c99636648400b28a8637'}
for name,h in sources.items():assert hashlib.sha256((P/name).read_bytes()).hexdigest()==h,(name,'unexpected inherited test')
helper='''def audit_cards(p,name):
 old=p.evaluate('[scrollX,scrollY]');p.locator('#cards .card').first.scroll_into_view_if_needed()
 p.wait_for_function("[...document.querySelectorAll('#cards .thumb img')].filter(e=>{const b=e.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).every(e=>e.complete&&e.naturalWidth>0)")
 rows=p.evaluate("""[...document.querySelectorAll('#cards .thumb img')].filter(e=>{const b=e.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).map(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.querySelector(':scope>span')?.getBoundingClientRect();return{natural:[e.naturalWidth,e.naturalHeight],ratio:a.width/a.height,fit:getComputedStyle(e).objectFit,labelBelow:!!b&&b.top>=a.bottom-.5}})""")
 check(name,len(rows)>0 and all(r['natural']==[320,400] and abs(r['ratio']-.8)<.01 and r['fit']=='contain' and r['labelBelow'] for r in rows),rows)
 p.evaluate('p=>scrollTo(...p)',old)
'''
text=(P/'qa_r0433.py').read_text().replace('R0433','R0434').replace('r0433','r0434').replace('R04.3.3','R04.3.4')
def edit(a,b):
 global text
 assert text.count(a)==1,(a[:100],text.count(a))
 text=text.replace(a,b)
edit('try:\n with sync_playwright() as pw:',helper+'try:\n with sync_playwright() as pw:')
edit("  for row in CAT['rows']:","  check('original common runtime frozen without changing identity',state['personRuntimeCommit']=='537c0f619fb9391c6a1e72ee29d2f889b5d1782f')\n  audit_cards(page,'desktop outfit labels never cover garment images')\n  for row in CAT['rows']:")
edit("  page.evaluate('async()=>{await __R04.select(\"T01-P01\");__R04.focus(\"scene\");__R04.view(\"three\");}');page.screenshot", "   audit_cards(page,'desktop '+cat+' labels below complete garment images')\n  page.evaluate('async()=>{await __R04.select(\"T01-P01\");__R04.focus(\"scene\");__R04.view(\"three\");}');page.screenshot")
edit("  check('mobile no horizontal page overflow'", "  audit_cards(page,'mobile labels below complete garment images')\n  check('mobile no horizontal page overflow'")
(P/'qa_r0434.py').write_text(text)
(P/'qa_fresh_r0434.py').write_text((P/'qa_fresh_r0433.py').read_text().replace('R0433','R0434').replace('r0433','r0434').replace('R04.3.3','R04.3.4'))
(P/'R0434_QA_INHERITANCE.json').write_text(json.dumps({'inheritedSources':sources,'removedAssertions':0,'scope':'all original 60 garments, 432 outfits, native coordinates, body identity, 122 parameters, five categories, mobile viewport, graphics recovery and fresh native sewing; plus non-overlapping labels'},indent=2))
print('R0434_QA_PREPARED')
