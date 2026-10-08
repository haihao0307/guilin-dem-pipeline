// Changes justified by actual run 37737377646 screenshots and test failure.
// The new material passed; inherited test selector was ambiguous after a
// second parameter drawer was added. Do not edit or disable the old tests.
const fs=require('fs'),path=require('path');
const dir=__dirname,old=path.resolve(dir,'../skin-r01');
function patch(file,marker,replacements){const p=path.join(dir,file);let text=fs.readFileSync(p,'utf8');if(text.includes(marker))return;for(const [a,b]of replacements){if(!text.includes(a))throw Error('Review anchor missing in '+file+': '+a);text=text.replaceAll(a,()=>b);}fs.writeFileSync(p,text+'\n// '+marker+'\n');}
patch('UHLayer.mjs','uh-render-review-lip-locality',[
 ['for(let c=0;c<4;c++){let total=0;for(const j of adj[i])total+=sm[j*4+c];','for(let c=0;c<4;c++){if(c===2&&it>=2)continue;let total=0;for(const j of adj[i])total+=sm[j*4+c];']
]);
patch('qa.cjs','uh-render-review-observed-strain',[
 ["check('pose deformation measured without new geometry',r.tension.calibrated&&r.geometryChanged===false);","check('pose deformation measured without new geometry',r.tension.calibrated&&r.geometryChanged===false&&r.tension.activeVertices>0&&r.tension.maxCompression>.05&&r.tension.maxStretch>.05);"],
 ["await shot('semantic-regions');await p.evaluate(()=>uhSkin.set({layer:'beauty'}));","await shot('semantic-regions');await p.evaluate(()=>uhSkin.set({layer:'beauty',lipMix:.8,lipGloss:.5}));await shot('lip-layer-stress');await p.evaluate(()=>uhSkin.set(uhSkin.presets.natural));"],
 ["check('skin remains excluded from eye and internal meshes',report.skin.regions.counts[0]>0&&report.skin.regions.counts[2]>0);","const leaks=await p.evaluate(()=>{const g=commonSkin._viewer().geometry,mask=g.attributes.skinCoverage.array,region=g.attributes.uhRegion.array;let count=0;for(let i=0;i<mask.length;i++)if(mask[i]===0&&region.slice(i*4,i*4+4).some(v=>v>1e-6))count++;return count;});report.nonSkinRegionLeakVertices=leaks;check('skin remains excluded from eye and internal meshes',leaks===0&&report.skin.regions.counts[0]>0&&report.skin.regions.counts[2]>0);"]
]);
let original=fs.readFileSync(old+'/qa.cjs','utf8');
if(!original.includes("'#skin-panel summary'"))throw Error('Original regression drawer anchor changed');
original=original.replaceAll("'#skin-panel summary'","'#skin-panel > .skin-row > details > summary'");
fs.writeFileSync(dir+'/native-regression.cjs',original);
console.log('Lip mask retains local edge; original regression assertions preserved with disambiguated UI selector.');
