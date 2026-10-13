const fs=require('fs'),path=require('path'),assert=require('assert/strict');
// One-time checked source migration. The released files remain ordinary editable
// JS; subsequent builds never repeat this migration or overwrite manual edits.
const marker=path.join(__dirname,'REFINEMENT_APPLIED.json');if(!fs.existsSync(marker)){
 const edits={
  'EarMaterial.mjs':[
   ['vec3(.27,.74,1.12),vec3(.22,.67,1.04)','vec3(.19,.43,.67),vec3(.17,.39,.61)'],
   ['strength*2.8','strength*2.4'],
   ['if(vETissue.y<.5&&eaM>.1)','if(vETissue.w<.5&&eaM>.1)'],
   ['vec3(.27,.74,1.12))*vETissue.y','vec3(.19,.43,.67))*vETissue.y'],
   ['if(eaM>.0001)etPore=','if(eaM>.0001&&uFPass<1.5&&etVisibility>.001)etPore=']
  ],
  'EarViewer.mjs':[
   [" setTissueLighting(mode){"," restoreTissueLights(){if(this.savedTissueLights)for(const {light,intensity}of this.savedTissueLights)light.intensity=intensity;this.tissueMode='neutral';if(this.earLight)this.earLight.intensity=0;}\n view(name){this.restoreTissueLights();return super.view(name);}\n setTissueLighting(mode){"],
   ["light.isHemisphereLight?.32:.18","light.isHemisphereLight?.52:.30"],
   ["this.earLight.intensity=back?7:4.0","this.earLight.intensity=back?5.0:4.0"]
  ],
  'Review.mjs':[
   ["function view(key){viewer.earLight.intensity=0;","function view(key){viewer.restoreTissueLights?.();viewer.skin.earTissueDebug?.(0);viewer.earLight.intensity=0;"]
  ],
  'TissueUI.mjs':[
   ["<button id=\"tissue-compare\">","<button id=\"tissue-macro\">毛孔近距观察</button><button id=\"tissue-compare\">"],
   ["else if(b.id==='tissue-compare')","else if(b.id==='tissue-macro'){earRootWorkbench.view(viewer.tissueSide>0?'left':'right');viewer.camera.zoom=3;viewer.camera.updateProjectionMatrix();viewer.render();sync();}else if(b.id==='tissue-compare')"]
  ],
  'verify.cjs':[
   ["tissueWorkbench.light('raking');earWorkbench.set({pores:0});","tissueWorkbench.light('raking');const v=__IDENTITY_QA__.viewer();v.camera.zoom=3;v.camera.updateProjectionMatrix();earWorkbench.set({pores:0});"],
   ["'surface pore strength changes pixels'","'surface pore strength changes pixels at resolved 3x macro scale'"],
   ["refinementWorkbench.view('lips');tissueWorkbench.light('neutral');tissueWorkbench.layer('beauty')","tissueWorkbench.light('neutral');tissueWorkbench.layer('beauty');refinementWorkbench.view('lips')"],
   ["await page.evaluate(()=>__IDENTITY_QA__.viewer().render());const opt=","await page.evaluate(()=>__IDENTITY_QA__.viewer().flushTissueRender());const opt="]
  ]
 };
 const staged=[];for(const [file,rows]of Object.entries(edits)){const p=path.join(__dirname,file);let s=fs.readFileSync(p,'utf8');for(const[a,b]of rows){assert(s.includes(a),'Refinement anchor missing in '+file+': '+a);s=s.replaceAll(a,b)}staged.push([p,s]);}
 for(const[p,s]of staged)fs.writeFileSync(p,s);
 fs.writeFileSync(marker,JSON.stringify({version:'EAR-R05.0',reason:'actual first-candidate surface pore test was subpixel; confidence boundaries also showed jagged bands',changes:['resolved 3x macro regression, no inflated pore depth','bounded colour attenuation calibration','ordinary light restoration when leaving ear inspection','confidence smoothing is in TissueField and never moves the mesh','coalesced settled-frame rendering and no pore evaluation in albedo-only pass']},null,2)+'\n');
}
