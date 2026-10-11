/** Second visual pass after inspecting actual ET18 browser screenshots.
 * The first pass removed the red extension but looked too smooth. This patch
 * is replayable and commits its resulting editable sources with the build. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function patch(file,a,b){const p=path.join(__dirname,file),s=fs.readFileSync(p,'utf8');if(s.includes(b))return;assert.equal(s.split(a).length,2,'ET18 refinement anchor '+a);fs.writeFileSync(p,s.replace(a,()=>b));}
patch('LipMicrostructure.mjs','w=.050+rnd()*.055,d=.023+rnd()*.045','w=.072+rnd()*.080,d=.036+rnd()*.046');
patch('LipMicrostructure.mjs', '.004+.010*rnd(),1)', '.006+.015*rnd(),1)');
patch('LipMaterial.mjs','float lpTissue=(lpBroad*.95+lpMottle*.40)*uLVariation;','float lpWarmCenter=exp(-pow((lpU-.12)/.56,2.))*exp(-pow((lpV-.32)/.7,2.));\n   float lpTissue=(lpBroad*2.05+lpMottle*.64+lpWarmCenter*.11)*uLVariation;');
patch('LipMaterial.mjs','vec3(1.+lpTissue*.24+lpTone,1.-lpTissue*.32+lpTone,1.-lpTissue*.16+lpTone)','vec3(1.+lpTissue*.34+lpTone,1.-lpTissue*.51+lpTone,1.-lpTissue*.34+lpTone)');
patch('LipMaterial.mjs','lpColor=mix(lpColor,mix(lpColor,csBase,.24)*1.025,lpDryPatch*.42);','lpColor=mix(lpColor,mix(lpColor,csBase,.24)*1.025,lpDryPatch*.42);\n   float lpOuterFade=smoothstep(.58,1.,lpV)*(.08+.10*(lpBroad+.5));\n   lpColor=mix(lpColor,csBase,lpOuterFade+smoothstep(.60,1.,abs(lpU))*.045);');
patch('LipMaterial.mjs','ET18-bounded-graph-vermilion-v1','ET18-bounded-graph-vermilion-v2');
patch('LipUI.mjs','<button data-lip-action="macro">唇纹特写</button>','<button data-lip-action="macro">唇纹特写</button><button data-lip-action="micro">微距纹理</button>');
patch('LipUI.mjs',"which==='macro'?2.05:3.35","which==='micro'?1.4:which==='macro'?2.05:3.35");
patch('LipUI.mjs',"['front','oblique','profile','macro','face','eyes']","['front','oblique','profile','macro','micro','face','eyes']");
patch('verify-et18.cjs',"await shot('macro');await page.screenshot","await shot('macro');await page.evaluate(()=>lipWorkbench.view('micro'));await shot('micro');await page.evaluate(()=>lipWorkbench.view('macro'));await page.screenshot");
patch('verify-et18.cjs','await page.evaluate(([k,x,d])=>','await page.evaluate(k=>lipWorkbench.view(k===\'microRelief\'?\'micro\':\'macro\'),key);await page.evaluate(([k,x,d])=>');
patch('verify-et18.cjs',"'18 visible controls and three material presets'","'18 registered editable controls and three material presets'");
patch('verify.cjs',"version:'ET17-L1'","version:'ET18-L2'");
patch('verify.cjs',"'real rendered frozen-baseline comparison under identical camera and light'","'pre-lips-extension comparison under identical camera and light, not ET17 A/B'");
console.log('ET18 second visual calibration complete; no changed pass thresholds');
