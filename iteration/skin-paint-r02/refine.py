from pathlib import Path
import hashlib,json
root=Path('iteration/skin-paint-r02');out=Path('kaopu-unified-human-workbench/skin-paint-r02');p=out/'preview.html';s=p.read_text()
def one(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a))
 s=s.replace(a,b,1)
anatomy=(root/'anatomy.js').read_text()
one('/* SKIN-PAINT-R02. Original paint/surface rules;',anatomy+'\n/* SKIN-PAINT-R02. Original paint/surface rules;')
one('uniform float uPaintAmount,uPaintChroma,uPaintBeard,uPaintFlush;','uniform float uPaintAmount,uPaintChroma,uPaintBeard,uPaintFlush;\nuniform vec3 uP2Cheek,uP2Ala,uP2Lid,uP2Socket,uP2Temple,uP2Muzzle,uP2Chin,uP2Jaw;')
for a,b in {'vec3(.043,.275,.054)':'uP2Cheek','vec3(.016,.271,.077)':'uP2Ala','vec3(.030,.291,.061)':'uP2Lid','vec3(.031,.313,.061)':'uP2Socket','vec3(.067,.319,.015)':'uP2Temple','vec3(.017,.245,.065)':'uP2Muzzle','vec3(.018,.213,.049)':'uP2Chin','vec3(.058,.235,.018)':'uP2Jaw'}.items():one(a,b)
one('material.onBeforeCompile=s=>{prior(s);','Object.assign(U,window.KAOPU_PAINT_ANATOMY(model));\n material.onBeforeCompile=s=>{prior(s);')
one('(p2Fine.r-.5)*.18+(p2Broad.b-.5)*.042','(p2Fine.r-.5)*.070+(p2Broad.b-.5)*.018')
one('p2Albedo*=1.+(p2Fine.b-.5)*.23*p2PaintGain;','p2Albedo*=1.+(p2Fine.b-.5)*.10*p2PaintGain;')
one('vec3(.89,.77,.87)','vec3(.985,.87,.90)')
one('mix(vec3(1.),vec3(.65,.74,.82),p2Beard*uPaintBeard*.42)','mix(vec3(1.),vec3(.43,.52,.59),p2Beard*uPaintBeard*.68)')
one('p2Beard*uPaintBeard*.30','p2Beard*uPaintBeard*.42')
one('vec3(1.045,.875,.905)','vec3(1.04,.91,.915)')
one('vec3(1.018,.875,.96)','vec3(1.018,.88,.94)')
one('melanin:.66,blood:.18,oil:.52,hydration:.70','melanin:.76,blood:.16,oil:.24,hydration:.63')
one('field:fieldReport,shader:','anatomy:window.__PAINT_ANATOMY__,field:fieldReport,shader:')
one('seed:current.seed},comparison=','seed:current.seed,chroma:current.chroma,beard:current.beard,flush:current.flush},comparison=')
s=s.replace('ssg-paint-r02-v2','ssg-paint-r02-v3')
p.write_text(s);b=json.loads((out/'BUILD.json').read_text());b.update({'sha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode()),'kernel':'ssg-paint-r02-v3','anatomy':'own native barycentric landmark and semantic region anchors','userVisualAccepted':False});(out/'BUILD.json').write_text(json.dumps(b,indent=2));print(b)
