"""Small audited R10 integration corrections; run after the frozen-source build."""
from pathlib import Path
p=Path(__file__).parent
f=p/'src/FacialHairLayer.js';s=f.read_text()
a="const oldLength=this.options.length,regionalChanged=setFusion(patch).some(k=>k.startsWith('beard'));"
b="const oldLength=this.options.length;setFusion(patch);const regionalSignature=JSON.stringify([fusion.beardSoftness,fusion.beardCurl,fusion.beardVariation]);const regionalChanged=this.fusionSignature!==regionalSignature;this.fusionSignature=regionalSignature;"
assert s.count(a)==1;s=s.replace(a,b)
a="if(value>=coverage)continue;"
b="const root=this.templateRoots.subarray(i*3,i*3+3),edge=this.name==='beard'?Math.pow(Math.max(.0001,Math.min(1,beardField(root).weight)),fusion.beardSoftness/100):1;if(value>=coverage*edge)continue;"
assert s.count(a)==1;s=s.replace(a,b);f.write_text(s)
f=p/'src/HairLayer.js';s=f.read_text()
a="if(styleChanged||changed('length')||regionChanged.length)this.prepareSupports();"
b="if(styleChanged||changed('length')||regionChanged.some(k=>['hairSideLength','hairNapeLength'].includes(k)))this.prepareSupports();"
assert s.count(a)==1;s=s.replace(a,b)
a="(styleChanged||regionChanged.length||['length','volume','frizz'].some(changed))"
b="(styleChanged||regionChanged.some(k=>['hairSideLength','hairNapeLength','hairFlyaways'].includes(k))||['length','volume','frizz'].some(changed))"
assert s.count(a)==1;s=s.replace(a,b);f.write_text(s)
# The test count was incorrectly estimated at 50: there are 24 inherited keys
# and exactly 25 new real controls. Check all new controls individually too.
f=p/'tests/verify.mjs';s=f.read_text().replace("d.fusion.controlCount>=50","d.fusion.controlCount===49")
a="async function frame(name){"
b="async function frame(name){"
start=s.index(a);end=s.index('\ntry{',start)
s=s[:start]+'''async function frame(name){
 const buffer=await page.screenshot();fs.writeFileSync(path.join(out,name+'.png'),buffer);
 const png=PNG.sync.read(buffer),r=await page.locator('#canvas').boundingBox();let min=255,max=0;
 assert(r&&r.width>100&&r.height>100,'visible canvas bounds');
 for(let y=Math.max(0,Math.ceil(r.y));y<Math.min(png.height,Math.floor(r.y+r.height));y++)for(let x=Math.max(0,Math.ceil(r.x));x<Math.min(png.width,Math.floor(r.x+r.width));x++){const i=(y*png.width+x)*4,v=(png.data[i]+png.data[i+1]+png.data[i+2])/3;min=Math.min(min,v);max=Math.max(max,v)}
 check(name+' nonblank actual canvas',max-min>45);return crypto.createHash('sha256').update(buffer).digest('hex');
}'''+s[end:]
a="const rootHash=d.legacyScalp.rootHash;"
b="check('all 25 new controls exist in DOM',await page.evaluate(()=>['hairLeftCoverage','hairRightCoverage','hairCrownCoverage','hairEarCoverage','hairNapeCoverage','hairTempleRecession','hairEdgeSoftness','hairSideLength','hairNapeLength','hairPart','hairWhorlX','hairWhorlZ','hairWhorl','hairShortFlow','hairClump','hairFrizz','hairFlyaways','hairRootFine','beardJawCoverage','beardCheekCoverage','beardSideburnCoverage','beardSoftness','beardCurl','beardVariation','beardRoughness'].every(k=>document.getElementById(k)?.tagName==='INPUT')));const rootHash=d.legacyScalp.rootHash;"
assert s.count(a)==1;s=s.replace(a,b)
a="const saved=await page.evaluate(()=>window.groomStudy.fusionSnapshot());"
b="await page.evaluate(()=>window.groomStudy.setGroom({beardSoftness:0}));const hardCount=(await diag()).facial.beard.activeCount;await page.evaluate(()=>window.groomStudy.setGroom({beardSoftness:100}));check('beard edge softness changes real selection',(await diag()).facial.beard.activeCount<hardCount);await page.evaluate(()=>window.groomStudy.setGroom({beardSoftness:65}));const saved=await page.evaluate(()=>window.groomStudy.fusionSnapshot());"
assert s.count(a)==1;s=s.replace(a,b);f.write_text(s)
print('Applied regional beard dirty tracking, real edge softness, selection-only performance, and exact test inventory')
