"""R02-only edits: assert frozen R01 inputs; generate readable source, never edit R01."""
from pathlib import Path
import hashlib,json
ROOT=Path('kaopu-unified-human-workbench');OLD=ROOT/'skin-folds-r01';NEW=ROOT/'skin-folds-r02'
manifest=json.loads((OLD/'BUILD.json').read_text())
assert manifest['previewSHA256']=='58b394a4f8ab129fe4ea50bde4cfd3e3f8d9de50a4f8047022a9d59de3670f9c'
for f in manifest['sources']:
 assert hashlib.sha256((OLD/Path(f['path']).name).read_bytes()).hexdigest()==f['sha256'],f['path']
NEW.mkdir(parents=True,exist_ok=True)
for p in OLD.iterdir():
 if p.suffix in ('.mjs','.cjs','.css'):(NEW/p.name).write_text(p.read_text().replace('skin-folds-r01','skin-folds-r02').replace('ET21-FOLD-R01','ET21-FOLD-R02'))
def edit(file,before,after,count=1):
 p=NEW/file;s=p.read_text();assert s.count(before)==count,(file,before,s.count(before));p.write_text(s.replace(before,after))
edit('FoldMath.mjs','const G=x=>Math.exp(-x*x);','''const G=x=>Math.exp(-x*x);
export const smoothC2=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(10+t*(-15+6*t));};
/** Smooth both normal and tangential deformation to exact zero at protected edges. */
export function boundaryWeight(x,y){
 let w=smoothC2(204,219,y)*(1-smoothC2(368,383,y))*(1-smoothC2(59,70,Math.abs(x)));
 for(const cx of [-31,31])w*=smoothC2(1,1.6,((x-cx)/18.2)**2+((y-301)/8.4)**2);
 return w*smoothC2(1,1.6,(x/27.8)**2+((y-232)/15.2)**2);
}
/** Single broad shoulder. Integral compensation is only 1D, NOT face-volume conservation. */
export function cheekRoll(d,width,compression){
 const x=d/(width*(1-.18*compression));
 return (G((x-.85)/1.35)-.40*G((x+.10)/.95)-((1.35-.40*.95)/8)*G((x-1.2)/8))*(.55+.45*compression);
}''')
edit('FoldMath.mjs','add(y-(arc-4.7),1.35,.26,gate*.65,side*.12,1);','add(y-(arc-5.1),1.75,.13,gate*.65,side*.12,1);')
edit('FoldMath.mjs','''const t=clamp((257-y)/34),line=20+14*t+3.0*Math.sin(Math.PI*t),gate=smooth(219,226,y)*(1-smooth(255,261,y))*s.nasolabial;
 add(a-line,2.65,.94,gate,side,.38);''','''const t=clamp((264-y)/51),line=18+19*t+3.2*Math.sin(Math.PI*t);
 const slope=-(19+3.2*Math.PI*Math.cos(Math.PI*t))/51,den=Math.hypot(1,slope),d=(a-line)/den;
 const gate=smoothC2(213,230,y)*(1-smoothC2(253,266,y))*s.nasolabial;
 const width=3.55+.65*t,amplitude=.76*gate;
 h+=cheekRoll(d,width,s.compression)*amplitude;
 const gather=-d*.070*s.compression*G(d/(width*1.8))*amplitude;
 dx+=gather*side/den;dy-=gather*slope/den;''')
edit('FoldMath.mjs','const gain=s.strength*s.slack*coverage;','const gain=s.strength*s.slack*coverage*boundaryWeight(x,y);')
edit('FoldSkin.mjs','uFoldMakeup*foldFinishMask*.26','uFoldMakeup*foldFinishMask*.10')
edit('FoldSkin.mjs','uFoldMakeup*foldFinishMask*.42','uFoldMakeup*foldFinishMask*.08')
edit('FoldSkin.mjs','roughnessFactor=mix(roughnessFactor,.48,uFoldMakeup*foldFinishMask*.65);','''roughnessFactor=clamp(roughnessFactor+uFoldMakeup*foldFinishMask*(.035-.018*csT),.30,.90);
   cLobeWeight*=1.-uFoldMakeup*foldFinishMask*.5;''')
edit('FoldSkin.mjs',"shader.fragmentShader=patch(shader.fragmentShader,'mix(fPores","""shader.fragmentShader=patch(shader.fragmentShader,'material.clearcoat*=1.-cSkinMask*.92;',`material.clearcoat*=1.-cSkinMask*.92;
   material.clearcoat*=1.-uFoldMakeup*foldFinishMask*.50;
   material.specularColor*=1.-uFoldMakeup*foldFinishMask*.12;`);
  shader.fragmentShader=patch(shader.fragmentShader,'mix(fPores""")
edit('FoldSkin.mjs',"'/ET21-geometry-folds-surface-finish'","'/ET21-r02-pore-preserving-finish'")
edit('FoldSkin.mjs','newTextureBytes:0',"newTextureBytes:0,microNormalRetentionAtFullMakeup:.92,uniformRoughnessTarget:false,formulation:'R02 pore-preserving satin, not measured cosmetics'")
edit('FoldSurface.mjs','this.source=source;this.model=model;','this.prepared=[];this.cacheEnabled=true;this.cacheHits=0;this.cacheMisses=0;this.source=source;this.model=model;')
edit('FoldSurface.mjs',' update(settings){\n  const started=performance.now();let prev=this.source;',''' restorePrepared(){
  const P=this.source.attributes.position.array,N=this.source.attributes.normal.array;
  const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
  const index=this.cacheEnabled?this.prepared.findIndex(c=>same(c.sourceP,P)&&same(c.sourceN,N)):-1;
  if(index<0){this.cacheMisses++;return false;}
  const c=this.prepared.splice(index,1)[0];this.prepared.unshift(c);this.cacheHits++;
  this.geometry.attributes.position.array.set(c.p);this.geometry.attributes.normal.array.set(c.n);
  this.normalPolish.base.set(c.n);this.normalPolish.smooth.set(c.smooth);
  this.normalPolish.report={...c.polish};this.fairStats={...c.fair};
  let prev=this.source;for(const l of this.layers){const a=prev.attributes.color?.array,b=l.geometry.attributes.color?.array;
   if(a&&b){b.set(a);for(let j=0;j<l.pairs.length;j++)for(let q=0;q<3;q++)b[(l.n+j)*3+q]=(a[l.pairs[j][0]*3+q]+a[l.pairs[j][1]*3+q])*.5;l.geometry.attributes.color.needsUpdate=true;}prev=l.geometry;}
  return true;
 }
 savePrepared(){
  if(!this.cacheEnabled)return;
  this.prepared.unshift({sourceP:this.source.attributes.position.array.slice(),sourceN:this.source.attributes.normal.array.slice(),
   p:this.geometry.attributes.position.array.slice(),n:this.geometry.attributes.normal.array.slice(),smooth:this.normalPolish.smooth.slice(),
   polish:{...this.normalPolish.report},fair:{...this.fairStats}});
  if(this.prepared.length>2)this.prepared.pop();
 }
 cacheReport(){return{hits:this.cacheHits,misses:this.cacheMisses,entries:this.prepared.length,maxEntries:2,
  bytes:this.prepared.reduce((n,c)=>n+c.sourceP.byteLength+c.sourceN.byteLength+c.p.byteLength+c.n.byteLength+c.smooth.byteLength,0),
  match:'exact source position and normal values; not version-counter or hash-only',lastHit:this.lastCacheHit};}
 update(settings){
  const started=performance.now();this.lastCacheHit=this.restorePrepared();
  if(!this.lastCacheHit){let prev=this.source;''')
edit('FoldSurface.mjs','const g=this.geometry;this.fairStats=this.fair.apply(g.attributes.position.array,g.attributes.normal.array);g.computeVertexNormals();','''const g=this.geometry;this.fairStats=this.fair.apply(g.attributes.position.array,g.attributes.normal.array);g.computeVertexNormals();
  this.normalPolish.capture(g.attributes.normal.array);this.savePrepared();}
  const g=this.geometry;''')
edit('FoldSurface.mjs','this.base.set(Q);this.normalPolish.capture(N);','this.base.set(Q);')
edit('FoldSurface.mjs','this.stats={...this.stats,fairing:','this.stats={...this.stats,preparedCache:this.cacheReport(),fairing:')
edit('FoldSurface.mjs','dispose(){for(const l of this.layers)l.geometry.dispose();}','dispose(){this.prepared.length=0;for(const l of this.layers)l.geometry.dispose();}')
edit('FoldProfile.mjs',"schema:'kaopu/geometric-skin-folds@1'","schema:'kaopu/geometric-skin-folds@2'")
edit('FoldProfile.mjs',"if(p&&p.schema!==api.schema)","if(p&&p.schema!==api.schema&&p.schema!=='kaopu/geometric-skin-folds@1')")
edit('FoldUI.mjs','set(presets[id].shape);viewer.view',"const look={};for(const k of ['light','chroma','exposure','shadows','diffusion','gray'])look[k]=profile.settings[k];set({...presets[id].shape,...look});viewer.view")
edit('FoldUI.mjs','ET21 / GEOMETRIC SKIN','ET21 R02 / SOFT TISSUE')
edit('FoldUI.mjs','松弛 · 收缩 · 褶皱','软褶 · 连续过渡 · 留住毛孔')
edit('FoldUI.mjs','褶皱是当前人物网格的真实起伏。色斑与妆感独立，旧版画出来的皱纹已停用。','鼻唇软褶与眼口保护区连续相接。褶皱来自顶点起伏；妆感保留毛孔，不抹平形体。')
edit('FoldUI.mjs','几何 ${r.displayVertices.toLocaleString()} 顶点','R02 · 几何 ${r.displayVertices.toLocaleString()} 顶点')
edit('FoldUI.mjs','nativeAssetReplaced:false',"nativeAssetReplaced:false,formulation:'R02 C2 boundary + broad cheek shoulder',profileSchema:profile.schema")
edit('build.cjs','ET21 · 真实几何褶皱 / 冷暖光 / 原待机保留','ET21 R02 · 软褶连续过渡 / 冷暖光 / 原待机保留')
edit('build.cjs','共同人物 · ET21 真实褶皱与冷暖光','共同人物 · ET21 R02 软褶与细腻妆感')
print(json.dumps({'version':'ET21-FOLD-R02','baseline':'4a81a75abbcf35c280c2f1b25b7f30fb75b02b03','files':[str(p) for p in NEW.iterdir() if p.is_file()]},indent=2))
