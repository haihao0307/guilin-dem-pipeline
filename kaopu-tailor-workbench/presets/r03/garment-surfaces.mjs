import {T,PI,TAU,clamp,mix,smooth,V,lerp3,num,BODY,sample,cloth,plain,dispose,patch,line,trace,hem,band,get,shade} from './surface-kernel.mjs';
function top(group,row,color,onePiece=false){
 const A=BODY.anchors,wy=A.waistY,sy=A.shoulderY,ax=A.shoulderX;
 const fitted=get(row,'meta.upper',row.style)==='FittedShirt'||row.style==='Strapless';
 const asym=!!get(row,'left.enable_asym',false),strapless=!!get(row,'shirt.strapless',false)||row.style==='Strapless';
 const leftStrapless=asym&&!!get(row,'left.shirt.strapless',false);
 const width=num(row,'shirt.width',1),length=num(row,'shirt.length',1),flare=num(row,'shirt.flare',1);
 const neckline=get(row,'collar.f_collar','CircleNeckHalf'),collar=get(row,'collar.component.style',null);
 const neckX=.058+num(row,'collar.width',.2)*.065;
 const depth=collar==='Turtle'?.035:collar==='SimpleLapel'?.14:.052+num(row,'collar.fc_depth',.4)*.18;
 const angledArmhole=get(row,'sleeve.armhole_shape','ArmholeCurve')==='ArmholeAngle';
 const underarm=sy-.15-(angledArmhole?.018:0),shoulderX=ax+.038-(angledArmhole?.014:0),hemY=onePiece?wy+.006:wy-.065-(length-1)*.19;
 const mat=cloth(color),edge=plain(new T.Color(color).multiplyScalar(.76));
 const topEdge=(u,back=false)=>{
  const x=u*shoulderX,ab=Math.abs(x),isLeft=u>0;let y;
  if(strapless||(leftStrapless&&isLeft))y=sy-.09+.012*Math.cos(u*PI);
  else if(ab<neckX){const q=ab/neckX;let shape=1-q*q;
   if(neckline==='VNeckHalf')shape=1-q;
   else if(neckline==='SquareNeckHalf')shape=1-Math.pow(q,12);
   else if(neckline==='TrapezoidNeckHalf')shape=clamp((1-q)*3.3);
   else if(neckline==='Bezier2NeckHalf')shape=(1-q)**(.7+num(row,'collar.f_bezier_x',.3)*1.8)*(1+num(row,'collar.f_bezier_y',.55)*.2*Math.sin(q*PI));
   y=sy+.038-(back?.017:depth)*shape;
  }else y=sy+.038-.074*(ab-neckX)/(shoulderX-neckX);
  return y;
 };
 const surf=(front,u,v)=>{
  const signed=u*2-1,utop=topEdge(signed,!front),y=mix(hemY,utop,v);
  const [bw,bf,bb]=sample(y),armpit=smooth(underarm,sy-.06,y);const ease=fitted?.009:.016+.045*(width-1);let w=bw+ease;
  if(y>underarm)w=mix(w,shoulderX,smooth(underarm,sy-.03,y));
  if(!fitted&&y<wy+.16)w=Math.max(w,(sample(wy+.16)[0]+ease)*(1+(flare-1)*smooth(wy+.16,hemY,y)));
  const x=signed*w;const sideHole=(angledArmhole?Math.min(1,Math.max(0,(y-underarm)/.1)):armpit)*.048;
  const depthZ=(front?bf:Math.abs(bb))+.012+(width-1)*.015;
  let z=(Math.pow(Math.max(0,1-signed*signed),.40)*depthZ+Math.pow(Math.abs(signed),10)*sideHole)*(front?1:-1);
  const low=1-smooth(wy,underarm,y),wave=Math.sin(signed*PI*5+.18)*.0028*low*(fitted?.25:1);z+=(front?1:-1)*wave;return[x,y,z];
 };
 for(const f of[true,false])patch(group,f?'bodice-front':'bodice-back',(u,v)=>surf(f,u,v),64,52,mat,!f);
 for(const s of[0,1]){const maxV=clamp((underarm-hemY)/(topEdge(s?1:-1)-hemY));
  patch(group,'bodice-side-below-armhole',(u,v)=>{const a=surf(true,s,v*maxV),b=surf(false,s,v*maxV);return a.map((x,i)=>mix(x,b[i],u))},4,32,mat,s===0);
  line(group,trace(t=>surf(true,s,t*maxV),30),edge,.0007,'side-seam');
 }
 if(!strapless){const neckU=neckX/shoulderX;for(const s of[-1,1]){if(leftStrapless&&s>0)continue;patch(group,'shoulder-bridge',(u,v)=>{const q=(s*mix(neckU,1,u)+1)/2,a=surf(true,q,1),b=surf(false,q,1);return a.map((x,i)=>mix(x,b[i],v))},24,10,mat,s<0);}}
 for(const f of[true,false]){line(group,trace(u=>surf(f,u,1)),edge,.0012,'neckline-and-shoulder-facing');hem(group,u=>surf(f,u,0),mat,.007);}
 if(fitted)for(const s of[-1,1])line(group,trace(v=>surf(true,(s*.45+1)/2,mix(.12,.72,v)),32),edge,.0007,'shaped-bodice-dart');
 if(collar==='Turtle'&&!strapless){const h=num(row,'collar.component.depth',5)*.01,y=sy+.023;
  const ring=(u,v)=>{const a=u*TAU;return[(neckX+.01-v*.004)*Math.sin(a),y+v*h,(.073-v*.003)*Math.cos(a)]};patch(group,'open-high-collar',ring,72,12,mat);hem(group,u=>ring(u,1),mat,.002,'collar-open-rim');
 }
 if(collar==='SimpleLapel'&&!strapless){
  for(const s of[-1,1])patch(group,'folded-lapel',(u,v)=>{const x=s*mix(.012,.115,u)*(1-v*.7),y=mix(sy+.035,sy-.18,v)+.02*u;const z=sample(y)[1]+.02+.026*Math.sin(u*PI);return[x,y,z]},24,24,mat,s<0);
  line(group,trace(t=>[0,mix(hemY+.015,sy-.18,t),sample(mix(hemY+.015,sy-.18,t))[1]+.018]),edge,.0014,'front-placket');
  for(let i=0;i<4;i++){const y=mix(hemY+.05,sy-.21,i/3),m=new T.Mesh(new T.CylinderGeometry(.0048,.0048,.0025,14),plain('#d0c5b3',.5));m.rotation.x=PI/2;m.position.set(0,y,sample(y)[1]+.02);m.name='fastening';group.add(m);}
 }
 if(collar==='Hood2Panels'&&!strapless){const len=num(row,'collar.component.hood_length',1),dep=num(row,'collar.component.hood_depth',1),y=sy-.01;
  patch(group,'two-panel-open-hood',(u,v)=>{const a=mix(PI*.13,PI*1.87,u),r=mix(.025,.137*dep,v);return[r*Math.sin(a),y+.08*Math.sin(v*PI)-.16*v*len,-.10-r*Math.cos(a)*.82-.045*v]},64,32,mat);
  line(group,trace(t=>[0,y-.17*t,-.11-.12*Math.sin(t*PI/2)]),edge,.001,'hood-centre-seam');
 }
 for(const side of[-1,1]){let sleeveless=get(row,'sleeve.sleeveless',true),len=num(row,'sleeve.length',.3),prefix='';if(asym&&side>0){prefix='left.';sleeveless=get(row,'left.sleeve.sleeveless',true);len=num(row,'left.sleeve.length',.3)}if(strapless||(leftStrapless&&side>0)||sleeveless)continue;sleeve(group,row,color,side,len,prefix);}
 return hemY;
}
function sleeve(group,row,color,side,length,prefix=''){
 const A=BODY.anchors,points=(side>0?A.armL:A.armR).map(p=>V(...p));const curve=new T.CatmullRomCurve3(points),mat=cloth(color),edge=plain(new T.Color(color).multiplyScalar(.76));
 const l=clamp(length,.1,1.02),cuff=get(row,prefix+'sleeve.cuff.type',null),end=num(row,prefix+'sleeve.end_width',1);
 const ring=(u,v)=>{const t=v*l,c=curve.getPoint(clamp(t)),d=curve.getTangent(clamp(t)).normalize(),e=V(0,0,1),f=new T.Vector3().crossVectors(e,d).normalize();const r=mix(.073,.044,t)+.012+(1-v)*.008;const ar=r*mix(1,clamp(end,.55,1.7),v*v);const fold=.0022*Math.sin(v*40+u*4*PI)*Math.exp(-1*((t-.58)/.16)**2)+.0016*Math.cos(u*TAU*7)*Math.sin(v*PI);const a=u*TAU,p=c.clone().addScaledVector(e,Math.cos(a)*(ar+fold)).addScaledVector(f,Math.sin(a)*(ar+fold));return p.toArray();};
 patch(group,'sleeve-'+side,ring,48,42,mat,side<0);hem(group,u=>ring(u,1),mat,.003,'open-sleeve-cuff');line(group,trace(v=>ring(.75,v),42),edge,.00075,'sleeve-underseam');
 if(cuff){const clen=num(row,prefix+'sleeve.cuff.cuff_len',.1)*.5,fl=num(row,prefix+'sleeve.cuff.skirt_flare',1.3),c=curve.getPoint(clamp(l)),d=curve.getTangent(clamp(l)),e=V(0,0,1),f=new T.Vector3().crossVectors(e,d).normalize(),r=mix(.073,.044,l)+.013;
  const fn=(u,v)=>{const a=u*TAU,frill=cuff==='CuffSkirt'||cuff==='CuffBandSkirt',k=frill?smooth(cuff==='CuffBandSkirt'?.35:0,1,v):0;const rr=r*mix(.96,fl,k)+Math.sin(a*10)*.006*k;return c.clone().addScaledVector(d,v*clen).addScaledVector(e,Math.cos(a)*rr).addScaledVector(f,Math.sin(a)*rr).toArray()};
  patch(group,'cuff-'+cuff+'-'+side,fn,72,18,mat,side<0);hem(group,u=>fn(u,1),mat,.002,'cuff-return');
 }
}
function skirt(group,row,color,topY){
 let type=get(row,'meta.bottom',row.style);if(type==='MetaGarmentDress'||!type)type='Skirt2';const wy=topY??BODY.anchors.waistY,mat=cloth(color),edge=plain(new T.Color(color).multiplyScalar(.77));
 const pencil=type==='PencilSkirt',godet=type==='GodetSkirt',tiered=type==='SkirtLevels',circle=['SkirtCircle','AsymmSkirtCircle'].includes(type),many=type==='SkirtManyPanels';
 const length=num(row,pencil||godet?'pencil-skirt.length':tiered?'levels-skirt.length':type==='Skirt2'?'skirt.length':'flare-skirt.length',.5);const h=clamp(.18+length*.99,.30,wy-.075),bY=wy-h,hipY=wy-.14;
 const n=many?num(row,'flare-skirt.skirt-many-panels.n_panels',6):godet?num(row,'godet-skirt.num_inserts',6):circle?14:18;
 const suns=num(row,'flare-skirt.suns',.75),ruffle=num(row,'skirt.ruffle',1.3),panelCurve=num(row,'flare-skirt.skirt-many-panels.panel_curve',.15);
 const hemW=pencil?.208*num(row,'pencil-skirt.flare',1):godet?.29+num(row,'godet-skirt.insert_w',15)*.002:tiered?.43:circle?.32+.19*suns:many?.31+.34*panelCurve:.255+num(row,'skirt.flare',5)*.009;
 const hipW=sample(hipY)[0]+.019,waistW=sample(wy)[0]+.015;const frontal=a=>Math.cos(a);
 const bottom=a=>bY+(type==='AsymmSkirtCircle'?.21*(1+frontal(a))/2*(1-num(row,'flare-skirt.asymm.front_length',.4)):0)+(pencil?Math.sin(a)*Math.tan(num(row,'pencil-skirt.low_angle',0)*PI/180)*.16:0);
 function ring(u,v,extra=0){const a=u*TAU,y=mix(wy,bottom(a),v),hip=smooth(wy,hipY,y);const lower=smooth(hipY,bY,y),base=mix(waistW,hipW,hip),t=clamp((wy-y)/h);let rx=mix(base,hemW,lower),rz=mix(Math.max(sample(y)[1],Math.abs(sample(y)[2]))+.012,hemW*.75,lower);if(pencil){rx=Math.max(sample(y)[0]+.017,rx);rz=Math.max(.13,rz)}let amp=pencil?.0018:circle?.030*lower:godet?.016*lower:many?.022*lower:.006+.018*Math.sin(t*PI/2)*ruffle;if(godet){const onset=1-num(row,'godet-skirt.insert_depth',20)*.01/h,g=smooth(onset,1,t);amp=.035*g;rx+=Math.pow(Math.max(0,Math.cos(a*n)),2)*.04*g}const fold=amp*Math.cos(a*n)+amp*.18*Math.sin(a*n*2+.4);rx+=fold+extra;rz+=fold*.8+extra;return[rx*Math.sin(a),y,rz*Math.cos(a)];}
 const frontSlit=num(row,'pencil-skirt.front_slit',0),backSlit=num(row,'pencil-skirt.back_slit',0),leftSlit=num(row,'pencil-skirt.left_slit',0),cut=!!get(row,'flare-skirt.cut.add',false);
 const mask=(u,v)=>{if(frontSlit&&v>1-frontSlit&&Math.min(u,1-u)<.010)return false;if(backSlit&&v>1-backSlit&&Math.abs(u-.5)<.012)return false;if(leftSlit&&v>1-leftSlit&&Math.abs(u-.25)<.015)return false;if(cut&&v>1-num(row,'flare-skirt.cut.depth',.25)&&Math.abs(u-(.25+num(row,'flare-skirt.cut.place',.35)*.25))<num(row,'flare-skirt.cut.width',.08)*.16)return false;return true;};
 patch(group,'skirt-'+type,ring,160,64,mat,false,mask);
 patch(group,'skirt-open-hem',(u,v)=>{const p=ring(u,1);return[p[0]*mix(1,.994,v),p[1]+v*.004,p[2]*mix(1,.994,v)]},160,2,mat,false,(u,v)=>mask(u,1));
 if(many||godet)for(let k=0;k<n;k++)line(group,trace(v=>ring((k+.5)/n,v),48),edge,.00085,'panel-seam');
 if(tiered){const count=num(row,'levels-skirt.num_levels',2),base=num(row,'levels-skirt.base_length_frac',.35),rr=num(row,'levels-skirt.level_ruffle',1.25);for(let k=0;k<count;k++){const start=base+(1-base)*k/count,end=base+(1-base)*(k+1)/count;const fn=(u,v)=>{const t=mix(start,Math.min(1,end+.008),v),p=ring(u,t,.003+Math.sin(u*TAU*22)*.004*v*rr);p[0]*=1+.012*v;p[2]*=1+.012*v;return p};patch(group,'overlapping-tier-'+k,fn,144,18,mat);line(group,trace(u=>fn(u,0),90),edge,.0012,'gathered-tier-seam');}}
 band(group,row,color,wy+.006);
}
function pants(group,row,color,topY){
 const A=BODY.anchors,wy=topY??A.waistY,mat=cloth(color),edge=plain(new T.Color(color).multiplyScalar(.75));const length=num(row,'pants.length',.85),width=num(row,'pants.width',1),flare=num(row,'pants.flare',1),cuff=get(row,'pants.cuff.type',null);
 const y0=wy-(.13+clamp(length,.2,1)*1.02),hemY=Math.max(.08,y0),crotch=A.crotchY-.035;const hipW=sample(wy-.12)[0]+.014+(width-1)*.035;const footOuter=.186+(width-1)*.20+(flare-1)*.16,footInner=flare<.8?.053:.028;
 const surface=(side,front,u,v)=>{const y=mix(wy,hemY,v),upper=smooth(crotch,crotch+.16,y),lower=smooth(crotch,hemY,y);const ow=mix(hipW,Math.max(.118,footOuter),lower),iw=y>=crotch?0:mix(.004,footInner,lower);const x=side*mix(iw,ow,u),legz=mix(.098,.053+(width-1)*.06+(flare-1)*.037,lower);const pelvis=(front?sample(Math.max(y,crotch+.02))[1]:Math.abs(sample(Math.max(y,crotch+.02))[2]))+.016;const zLeg=legz*Math.pow(Math.max(0,1-(2*u-1)**2),.46),zHip=pelvis*Math.pow(Math.max(0,1-u*u),.46);let z=mix(zLeg,zHip,upper);z+=(.0022*Math.cos(u*TAU*3)+.0015*Math.sin(v*19+u*5))*Math.sin(u*PI)*(1-upper);return[x,y,z*(front?1:-1)];};
 for(const side of[-1,1])for(const f of[true,false]){patch(group,'pants-'+side+'-'+(f?'front':'back'),(u,v)=>surface(side,f,u,v),42,76,mat,(side<0)===f);hem(group,u=>surface(side,f,u,1),mat,.008,'open-trouser-hem');line(group,trace(v=>surface(side,f,1,v),64),edge,.0007,'trouser-outseam');if(f)line(group,trace(v=>surface(side,f,.53,mix(.34,.95,v)),42),edge,.00045,'pressed-trouser-crease');}
 band(group,row,color,wy+.006);
 if(cuff)for(const side of[-1,1]){const h=num(row,'pants.cuff.cuff_len',.08)*.62,fl=num(row,'pants.cuff.skirt_flare',1.35),cx=side*(footOuter+footInner)/2,rx=(footOuter-footInner)/2,rz=.053+(width-1)*.06+(flare-1)*.037;const fn=(u,v)=>{const a=u*TAU,frill=cuff!=='CuffBand'?v:0,r=1+(fl-1)*frill+.055*Math.sin(a*10)*frill;return[cx+rx*Math.cos(a)*r,hemY-v*h,rz*Math.sin(a)*r]};patch(group,'trouser-cuff-'+side,fn,64,16,mat);hem(group,u=>fn(u,1),mat,.002,'trouser-cuff-return');}
}
export function garment(row,library,{neutral=false}={}){
 if(!BODY)throw Error('Anatomy must be loaded first');const group=new T.Group();group.name='resolved-garment-'+row.id;group.userData.sources=row.sources||[row.id];const color=neutral?'#b7b3a8':shade(row),wy=BODY.anchors.waistY;
 if(row.kind==='combination'){const a=library.find(x=>x.id===row.sources[0]),b=library.find(x=>x.id===row.sources[1]);if(!a||!b)throw Error('Unknown combination source');if(b.category==='裤装')pants(group,b,shade(b),wy);else skirt(group,b,shade(b),wy);top(group,a,shade(a));}
 else if(row.category==='上装'){pants(group,library.find(x=>x.id==='P01'),'#c5c0b4',wy);top(group,row,color);}
 else if(row.category==='裤装'||row.category==='半裙'){top(group,library.find(x=>x.id==='T02'),'#d7d1c4',true);if(row.category==='裤装')pants(group,row,color,wy);else skirt(group,row,color,wy);}
 else if(row.category==='连衣裙'){skirt(group,row,color,wy);top(group,row,color,true);}
 else if(row.category==='连体裤'){pants(group,row,color,wy);top(group,row,color,true);}
 else throw Error('Unsupported preserved category '+row.category);
 group.userData.metrics=metrics(group);return group;
}
function metrics(g){let vertices=0,triangles=0,panels=0,seams=0;const names=[];let hash=2166136261;g.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;vertices+=p.count;triangles+=(o.geometry.index?.count||p.count)/3;if(o.userData.structureLine)seams++;else{panels++;names.push(o.name);for(let k=0;k<p.array.length;k+=7){hash^=Math.round(p.array[k]*1e5);hash=Math.imul(hash,16777619)}}});return{vertices,triangles,panels,seams,surfaceNames:names,geometrySignature:(hash>>>0).toString(16),closedPrimitiveGarments:false};}
