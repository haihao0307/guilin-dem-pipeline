import {anatomicalTop as top,anatomicalPants as pants} from './anatomical-cloth.mjs';
import {fitProfile} from './surface-kernel.mjs';
import {T,PI,TAU,clamp,mix,smooth,V,lerp3,num,BODY,sample,cloth,plain,dispose,patch,line,trace,hem,band,get,shade} from './surface-kernel.mjs';
function skirt(group,row,color,topY){
 let type=get(row,'meta.bottom',row.style);if(type==='MetaGarmentDress'||!type)type='Skirt2';const wy=topY??BODY.anchors.waistY,mat=cloth(color),edge=plain(new T.Color(color).multiplyScalar(.77));
 const pencil=type==='PencilSkirt',godet=type==='GodetSkirt',tiered=type==='SkirtLevels',circle=['SkirtCircle','AsymmSkirtCircle'].includes(type),many=type==='SkirtManyPanels';
 const length=num(row,pencil||godet?'pencil-skirt.length':tiered?'levels-skirt.length':type==='Skirt2'?'skirt.length':'flare-skirt.length',.5);const h=clamp(.18+length*.99,.30,wy-.075),bY=wy-h,hipY=wy-.14;
 const n=many?num(row,'flare-skirt.skirt-many-panels.n_panels',6):godet?num(row,'godet-skirt.num_inserts',6):circle?14:18;
 const suns=num(row,'flare-skirt.suns',.75),ruffle=num(row,'skirt.ruffle',1.3),panelCurve=num(row,'flare-skirt.skirt-many-panels.panel_curve',.15);
 const hemW=pencil?.208*num(row,'pencil-skirt.flare',1):godet?.29+num(row,'godet-skirt.insert_w',15)*.002:tiered?.43:circle?.32+.19*suns:many?.31+.34*panelCurve:.255+num(row,'skirt.flare',5)*.009;
 const hipW=sample(hipY)[0]+.019,waistW=sample(wy)[0]+.015;const frontal=a=>Math.cos(a);
 const bottom=a=>bY+(type==='AsymmSkirtCircle'?.21*(1+frontal(a))/2*(1-num(row,'flare-skirt.asymm.front_length',.4)):0)+(pencil?Math.sin(a)*Math.tan(num(row,'pencil-skirt.low_angle',0)*PI/180)*.16:0);
 function ring(u,v,extra=0){const a=u*TAU,y=mix(wy,bottom(a),v),hip=smooth(wy,hipY,y);const lower=smooth(hipY,bY,y),base=mix(waistW,hipW,hip),t=clamp((wy-y)/h);let rx=mix(base,hemW,lower),rz=mix(Math.max(sample(y)[1],Math.abs(sample(y)[2]))+.012,hemW*.75,lower);if(pencil){rx=Math.max(sample(y)[0]+.017,rx);rz=Math.max(.13,rz)}let amp=pencil?.0018:circle?.030*lower:godet?.016*lower:many?.022*lower:.006+.018*Math.sin(t*PI/2)*ruffle;if(godet){const onset=1-num(row,'godet-skirt.insert_depth',20)*.01/h,g=smooth(onset,1,t);amp=.035*g;rx+=Math.pow(Math.max(0,Math.cos(a*n)),2)*.04*g}const fold=amp*Math.cos(a*n)+amp*.18*Math.sin(a*n*2+.4);rx+=fold+extra;rz+=fold*.8+extra;const p=[rx*Math.sin(a),y,rz*Math.cos(a)],f=fitProfile(y,Math.atan2(p[0],p[2]-.02)),r=Math.hypot(p[0],p[2]-f.cz),target=f.r+.026,rr=(r+target+Math.sqrt((r-target)**2+.000016))/2;if(r>1e-8){p[0]*=rr/r;p[2]=f.cz+(p[2]-f.cz)*rr/r}return p;}
 const frontSlit=num(row,'pencil-skirt.front_slit',0),backSlit=num(row,'pencil-skirt.back_slit',0),leftSlit=num(row,'pencil-skirt.left_slit',0),cut=!!get(row,'flare-skirt.cut.add',false);
 const mask=(u,v)=>{if(frontSlit&&v>1-frontSlit&&Math.min(u,1-u)<.010)return false;if(backSlit&&v>1-backSlit&&Math.abs(u-.5)<.012)return false;if(leftSlit&&v>1-leftSlit&&Math.abs(u-.25)<.015)return false;if(cut&&v>1-num(row,'flare-skirt.cut.depth',.25)&&Math.abs(u-(.25+num(row,'flare-skirt.cut.place',.35)*.25))<num(row,'flare-skirt.cut.width',.08)*.16)return false;return true;};
 patch(group,'skirt-'+type,ring,160,64,mat,false,mask);
 patch(group,'skirt-open-hem',(u,v)=>{const p=ring(u,1);return[p[0]*mix(1,.994,v),p[1]+v*.004,p[2]*mix(1,.994,v)]},160,2,mat,false,(u,v)=>mask(u,1));
 if(many||godet)for(let k=0;k<n;k++)line(group,trace(v=>ring((k+.5)/n,v),48),edge,.00085,'panel-seam');
 if(tiered){const count=num(row,'levels-skirt.num_levels',2),base=num(row,'levels-skirt.base_length_frac',.35),rr=num(row,'levels-skirt.level_ruffle',1.25);for(let k=0;k<count;k++){const start=base+(1-base)*k/count,end=base+(1-base)*(k+1)/count;const fn=(u,v)=>{const t=mix(start,Math.min(1,end+.008),v),p=ring(u,t,.003+Math.sin(u*TAU*22)*.004*v*rr);p[0]*=1+.012*v;p[2]*=1+.012*v;return p};patch(group,'overlapping-tier-'+k,fn,144,18,mat);line(group,trace(u=>fn(u,0),90),edge,.0012,'gathered-tier-seam');}}
 band(group,row,color,wy+.006);
}
export function garment(row,library,{neutral=false}={}){
 if(!BODY)throw Error('Anatomy must be loaded first');const group=new T.Group();group.name='resolved-garment-'+row.id;group.userData.sources=row.sources||[row.id];const color=neutral?'#b7b3a8':shade(row),wy=BODY.anchors.waistY;
 if(row.kind==='combination'){const a=library.find(x=>x.id===row.sources[0]),b=library.find(x=>x.id===row.sources[1]);if(!a||!b)throw Error('Unknown combination source');if(b.category==='裤装')pants(group,b,shade(b),wy);else skirt(group,b,shade(b),wy);top(group,a,shade(a),true);}
 else if(row.category==='上装'){pants(group,library.find(x=>x.id==='P01'),'#c5c0b4',wy);top(group,row,color);}
 else if(row.category==='裤装'||row.category==='半裙'){top(group,library.find(x=>x.id==='T02'),'#d7d1c4',true);if(row.category==='裤装')pants(group,row,color,wy);else skirt(group,row,color,wy);}
 else if(row.category==='连衣裙'){skirt(group,row,color,wy);top(group,row,color,true);}
 else if(row.category==='连体裤'){pants(group,row,color,wy);top(group,row,color,true);}
 else throw Error('Unsupported preserved category '+row.category);
 group.userData.metrics=metrics(group);return group;
}
function metrics(g){let vertices=0,triangles=0,panels=0,seams=0;const names=[];let hash=2166136261;g.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;vertices+=p.count;triangles+=(o.geometry.index?.count||p.count)/3;if(o.userData.structureLine)seams++;else{panels++;names.push(o.name);for(let k=0;k<p.array.length;k+=7){hash^=Math.round(p.array[k]*1e5);hash=Math.imul(hash,16777619)}}});return{vertices,triangles,panels,seams,topLowestY:g.userData.topLowestY,connectedShells:g.userData.connectedShells||0,surfaceNames:names,geometrySignature:(hash>>>0).toString(16),closedPrimitiveGarments:false};}
