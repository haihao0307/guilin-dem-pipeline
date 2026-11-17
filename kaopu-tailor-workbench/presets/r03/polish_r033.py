"""R03.3: true armhole cuts, wrist-safe sleeves, tucked combinations and joined lapels."""
from pathlib import Path
p=Path(__file__).resolve().parent
f=p/'anatomical-cloth.mjs';s=f.read_text()
if 'R03.3 static tailoring' not in s:
 s=s.replace('(k===0?Math.min(1,u):clamp(u))','(k===0?Math.min(1,u):k===A.a.length-2?Math.max(0,u):clamp(u))')
 s=s.replace('cut-t+(1-aw)*1.25-angled','cut-t+Math.min(5,(1-aw)*.15/(aw+.015))-angled')
 s=s.replace("deep=.065+num(row,'collar.fc_depth',.4)*.19","deep=.045+num(row,'collar.fc_depth',.4)*.135")
 s=s.replace('nx=.065+neck*.058','nx=.079+neck*.058')
 old='target=Math.max(r,target);q.x=mix(q.x,target*Math.sin(a),torsoWeight);'
 new="""// R03.3 static tailoring: suspend cloth between bust and waist rather than reproducing the under-bust indentation.
   const bust=Math.max(...[1.32,1.36,1.40].map(y=>fitProfile(y,a).r)),wr=fitProfile(wy,a).r,tension=mix(wr,bust,smooth(wy,1.365,q.y))+ease+.007;
   if(q.y<1.42)target=Math.max(target,tension);
   if(onePiece)target=mix(target,f.r+.021,smooth(wy+.14,wy+.015,q.y));
   else target+=.013*smooth(wy+.055,wy-.04,q.y);
   target=Math.max(r,target);q.x=mix(q.x,target*Math.sin(a),torsoWeight);"""
 assert old in s;s=s.replace(old,new)
 old="const x=s*mix(.105,.019,v)+s*u*.046*(1-v*.4),y=mix(1.593,1.422,v)+u*.018,p=front(x,y,.024);p[2]+=.020*Math.sin(u*PI);return p"
 new="const xi=mix(.067,.015,v),xo=mix(.137,.052,v),x=s*mix(xi,xo,u),y=mix(mix(1.580,1.544,u),mix(1.488,1.440,u),v),p=front(x,y,.049);p[2]+=.009*Math.sin(u*PI);return p"
 assert old in s;s=s.replace(old,new)
 s=s.replace("const g=shell(group,row,color,'top',onePiece),mat=g.mat,edge=","const g=shell(group,row,color,'top',onePiece);g.mesh.geometry.computeBoundingBox();group.userData.topLowestY=g.mesh.geometry.boundingBox.min.y;const mat=g.mat,edge=")
 f.write_text(s)
f=p/'garment-surfaces.mjs';s=f.read_text().replace('top(group,a,shade(a));}','top(group,a,shade(a),true);}')
s=s.replace('return{vertices,triangles,panels,seams,surfaceNames:names,','return{vertices,triangles,panels,seams,topLowestY:g.userData.topLowestY,connectedShells:g.userData.connectedShells||0,surfaceNames:names,');f.write_text(s)
f=p/'app.mjs';s=f.read_text().replace("version:'R03.1'","version:'R03.3'").replace("version:'R03.2'","version:'R03.3'")
s=s.replace("'独立设计组合 · '+r.sources.join(' + ')","'收腰搭配 · '+r.sources.join(' + ')")
s=s.replace("$('selected-intent').textContent=row.intent;","$('selected-intent').textContent=row.intent+(row.kind==='combination'?' 上衣按收进腰头的方式展示，原纸样衣长不改写。':'');");f.write_text(s)
f=p/'index.html';s=f.read_text().replace('三维服装橱柜 <b>R03</b>','三维服装橱柜 <b>R03.3</b>').replace('搭配来自原有两套设计，不计作新纸样。','搭配来自原有两套设计，采用上衣收进腰头的展示方式，不计作新纸样。');f.write_text(s)
f=p/'qa_browser.py';s=f.read_text()
if 'Sleeve hems do not extend over fingers' not in s:
 marker="check('All 432 combination geometries built from original members',len(mesh)==492 and all(r['vertices']>0 and r['triangles']>0 for r in mesh))"
 extra="""
  m11=next(r for r in mesh if r['id']=='T11')
  check('Sleeve hems do not extend over fingers',m11.get('topLowestY',0)>.91,m11.get('topLowestY'))
  check('Every preset has an actual connected garment shell',all(r.get('connectedShells',0)>=1 for r in mesh))
  check('Runtime identifies the reviewed R03.3 revision',state['version']=='R03.3')"""
 assert marker in s;s=s.replace(marker,marker+extra);f.write_text(s)
f=p/'README.md';s=f.read_text()
if 'R03.3 收腰搭配' not in s:f.write_text(s+'\n## R03.3 收腰搭配\n\n长袖裁切沿腕骨方向继续计算，不再把手指都饱和为同一个袖长参数。无袖与短袖使用独立开口阈值。搭配上衣采用收进腰头的静态造型，并在界面明确标注；源纸样衣长和配方身份没有改写。单款展示仍保留原衣长差异。新增袖口不覆盖手指、连续衣壳及运行版本检查。\n')
print('R03_3_POLISH_COMPLETE')
