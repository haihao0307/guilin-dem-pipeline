/** Idempotent exact-anchor migration from the frozen ET17 host. CI commits the
 * resulting editable runtime files as well as the built HTML. Never touches
 * any directory outside lip-structure. Not a replacement head or skin system. */
const fs=require('fs'),assert=require('assert/strict'),path=require('path');
function edit(file,fn){const p=path.join(__dirname,file),s=fs.readFileSync(p,'utf8');if(s.includes('ET18-L2'))return;fs.writeFileSync(p,fn(s));}
function replace(s,a,b){assert.equal(s.split(a).length,2,'Migration anchor '+a);return s.replace(a,()=>b);}
edit('LipState.mjs',s=>{
 s=replace(s,"export const LIP_SCHEMA='kaopu/lip-structure@1';","// ET18-L2: additive controls, explicit @1 -> @2 migration.\nexport const LIP_SCHEMA='kaopu/lip-structure@2';");
 s=replace(s,'eyeSmoothing:.35}', 'eyeSmoothing:.35,colorVariation:.65,upperShade:.45,dryness:.30,microRelief:.65,textureDensity:1,patternSeed:37}');
 s=replace(s,'eyeSmoothing:[0,1]}','eyeSmoothing:[0,1],colorVariation:[0,1],upperShade:[0,1],dryness:[0,1],microRelief:[0,1.5],textureDensity:[.6,1.5],patternSeed:[0,999]}');
 s=replace(s,'const s={...LIP_DEFAULTS,...input};',"if(input.schema&&!['kaopu/lip-structure@1',LIP_SCHEMA].includes(input.schema))throw Error('唇部档案版本不兼容');const s={...LIP_DEFAULTS,...input,schema:LIP_SCHEMA};");
 return replace(s,'return s;}','if(!Number.isInteger(s.patternSeed))throw Error("唇纹种子必须是整数");return s;}');
});
edit('LipViewer.mjs',s=>{
 s=s.replaceAll('ET17-L1','ET18-L2');
 return replace(s,'render(){if(this.inLipUpdate)return;return super.render();}', 'render(){if(this.inLipUpdate)return;if(this.model?.lipStructure?.debug){const settings=this.model.faceSurface.settings,old=settings.diffusion;settings.diffusion=0;try{return super.render();}finally{settings.diffusion=old;}}return super.render();}');
});
edit('LipUI.mjs',s=>{
 s=s.replaceAll('ET17-L1','ET18-L2').replaceAll('ET17','ET18').replaceAll('et17-person','et18-person');
 s=replace(s,"['eyeSmoothing','眼周表面微整']]", "['eyeSmoothing','眼周表面微整'],['colorVariation','自然唇色变化'],['upperShade','上下唇明暗差'],['dryness','局部干燥分布'],['microRelief','短细纹强度'],['textureDensity','主唇纹疏密'],['patternSeed','唇纹个体种子']]");
 s=replace(s,'step=".01" value="${s[k]}"','step="${k===\'patternSeed\'?1:0.01}" value="${s[k]}"');
 s=replace(s,'<p class="lip-note">','<div class="identity-tools"><button data-lip-action="natural">自然裸唇</button><button data-lip-action="dry">偏干</button><button data-lip-action="moist">偏湿</button></div><p class="lip-note">');
 s=s.replace('非重复唇纹','主唇沟深度').replace('切换原版对照','最初皮肤对照').replace('冻结原版对照','最初皮肤对照（非 ET17）');
 s=replace(s,'<small>唇色、肤色', '<details><summary>分层检查 / 固定原版</summary><div class="identity-tools"><button data-lip-action="mask">唇红范围</button><button data-lip-action="albedo">只看颜色</button><button data-lip-action="normals">法线</button><button data-lip-action="roughness">粗糙度</button><button data-lip-action="beauty">恢复材质</button></div><a target="_blank" rel="noopener" href="https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/7f90e53c1d114f65b08710d67d792d489719ee67/kaopu-unified-human-workbench/lip-structure/preview.html">打开你指定的 ET17 原网页</a></details><small>唇色、肤色');
 s=replace(s,' function open(){active=true;render();}', ' function inspect(value=0){api.debug=value;api.update();viewer.render();return value;}\n function open(){active=true;render();}');
 s=replace(s,"else if(action==='gray'||action==='beauty'){", "else if(['mask','albedo','normals','roughness'].includes(action)){inspect(['mask','albedo','normals','roughness'].indexOf(action)+1);}else if(['natural','dry','moist'].includes(action)){const presets={natural:{furrows:.65,wetness:.35,dryRoughness:.53,dryness:.30,microRelief:.65,colorVariation:.65,upperShade:.45},dry:{furrows:.82,wetness:.15,dryRoughness:.60,dryness:.72,microRelief:.85,colorVariation:.56,upperShade:.48},moist:{furrows:.55,wetness:.74,dryRoughness:.49,dryness:.15,microRelief:.45,colorVariation:.68,upperShade:.40}};inspect(0);set(presets[action]);render();}else if(action==='gray'||action==='beauty'){inspect(0);");
 s=replace(s,"set,view,open:()=>tab.click()", "set,view,inspect,open:()=>tab.click()");
 s=s.replace('Ten24 / 3D Scan Store：唇红边界、嘴角和微纹视觉参考；Proko：唇面转折与体块；USC Digital Emily：表情下的皮肤变化；Epic MetaHuman：颜色、法线与粗糙度分层。未复制其商业模型或贴图。','Disney Research 2023：图结构到微纹高度场（只借鉴组织原则，不复制皮肤毛孔网络）；USC ICT：多尺度微结构与形变边界；Pixar RenderMan：色彩、凹凸、粗糙度、湿膜分开；Kobayashi / Tagami：唇红与面颊表面的差异。生成器与参数为本项目原创，非扫描或完整论文复现。');
 return s;
});
edit('build.cjs',s=>{
 s=s.replaceAll('ET17-L1','ET18-L2').replaceAll('ET17','ET18').replaceAll('et17-app','et18-app');
 s=replace(s,"ANCHOR='7bc25d5e31808d0a5724f602d4a4ade42a14c385'", "ANCHOR='7f90e53c1d114f65b08710d67d792d489719ee67'");
 s=replace(s,'userBaseline:ANCHOR,','userBaseline:ANCHOR,baselineLipSHA256:"84c7a27d1e8765d41c640a0bc66075bcddd82e81af1590d4d296ca49659dbafa",lipProfileSchema:"kaopu/lip-structure@2",microstructure:"1024x512 RGBA curve-graph height atlas; mipmapped, no new source asset",');
 return s;
});
console.log('ET18-L2 host migration complete; only lips source files touched');
