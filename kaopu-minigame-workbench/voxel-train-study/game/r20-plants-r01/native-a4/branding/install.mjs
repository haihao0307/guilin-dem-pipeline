import * as T from '../../../../vendor/three.module.js';
import wordmark from './wordmark.mjs';import wordGold from './wordmark-gold.mjs';import left from './angel_left.mjs';import right from './angel_right.mjs';import plaque from './company_plaque-gold.mjs';
import {TRACK,COACH_LAYOUT,COACH_DIMENSIONS} from '../../metre-scale.mjs';
const gold=new T.MeshStandardMaterial({color:0xd6aa61,metalness:.75,roughness:.32,side:T.DoubleSide}),red=new T.MeshStandardMaterial({color:0xa22515,metalness:.3,roughness:.4,side:T.DoubleSide}),green=new T.MeshStandardMaterial({color:0x142b22,metalness:.4,roughness:.43,side:T.DoubleSide});
const sourceCache=new Map();
function contourGeometry(recipe){
 if(sourceCache.has(recipe))return sourceCache.get(recipe);
 const path=new T.ShapePath();for(const ring of recipe.rings){const pts=ring.points;path.moveTo(pts[0][0],-pts[0][1]);for(const p of pts.slice(1))path.lineTo(p[0],-p[1]);path.currentPath.closePath();}
 const shapes=path.toShapes(false),g=new T.ShapeGeometry(shapes,1);sourceCache.set(recipe,g);return g;
}
function shaped(recipe,width,map,material,name,depth=0){
 const input=contourGeometry(recipe),[W,H]=recipe.size_px,s=width/W,p=input.attributes.position,idx=input.index;
 const uv=i=>[(p.getX(i)-W/2)*s,(p.getY(i)+H/2)*s],points=[],mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
 function emit(a,b,c,level=0){const A=map(...a,depth),B=map(...b,depth),C=map(...c,depth),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
 const error=(P,Q,q)=>{const exact=map(...q,depth);return Math.hypot(...exact.map((v,i)=>v-(P[i]+Q[i])/2));};
 if(level<5&&Math.max(error(A,B,ab),error(B,C,bc),error(C,A,ca))>.0015){emit(a,ab,ca,level+1);emit(ab,b,bc,level+1);emit(ca,bc,c,level+1);emit(ab,bc,ca,level+1);}else points.push(...A,...B,...C);}
 for(let i=0;i<(idx?idx.count:p.count);i+=3)emit(...[0,1,2].map(j=>uv(idx?idx.getX(i+j):i+j)));
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();g.computeBoundingSphere();const mesh=new T.Mesh(g,material);mesh.name=name;mesh.userData={nativeBrand:true,sourceSha256:recipe.source_sha256,noRaster:true,widthM:width,readableFromOutside:true};return mesh;
}
const sideMap=(side,at)=>(u,v,d=0)=>[at[0]+side*u,at[1]+v,at[2]+side*d];
function word(parent,width,map,name){parent.add(shaped(wordmark,width,map,red,name+' original red outline',.006),shaped(wordGold,width,map,gold,name+' original gold lettering',.009));}
function company(parent,width,map,name){
 const h=width*1024/1536,points=[[-width/2,-h/2],[width/2,-h/2],[width/2,h/2],[-width/2,h/2]],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flatMap(p=>map(...p,.002)),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();const bg=new T.Mesh(g,green);bg.name=name+' enamel base';parent.add(bg,shaped(plaque,width,map,gold,name+' original lettering and six spoke wheel',.004));
}
export function installBranding(train){
 const parent=new T.Group();parent.name='Flying Hongkonger approved native branding';train.root.add(parent);const loco=train.steam,{bodyScales,sourceBounds,nativeSource}=loco.model,p=nativeSource.spec.parameters,{lengthScale:ls,widthScale:ws,heightScale:hs}=bodyScales,first=p.driverZ[0],offset=loco.frontOffset,L=p.boilerLength,Y=p.boilerY,R=p.boilerRadius;
 const panelAt=source=>loco.point(source),marks=[];
 const register=(name,at,width)=>marks.push({name,anchorM:at,widthM:width});
 for(const side of [-1,1]){
  const center=panelAt([0,Y,-.6]),map=(u,v,d=0)=>{const x=center[0]+side*u,y=center[1]+v,srcZ=(x-offset)/ls+first,srcY=(y-TRACK.railHead)/hs+.08,t=(srcZ+L/2+1.2)/(L+2.25),tip=1-Math.pow(Math.max(0,(t-.68)/.32),2.2)*.78,vertical=(srcY-Y)/((R+.22)*tip),lateral=(R+.24)*tip*Math.sqrt(Math.max(0,1-vertical*vertical));return[x,y,side*(lateral*ws+d)];};
  word(parent,6,map,'boiler '+side);register('boiler wordmark '+side,center,6);
  const tender=panelAt([-side*1.112,2.02,-L/2-3.7]);const angel=side>0?right:left;parent.add(shaped(angel,3.5,sideMap(side,tender),red,'tender C angel '+side,.008));register('tender angel '+side,tender,3.5);
  const cab=panelAt([-side*1.162,1.86,-L/2-.15]);company(parent,.48,sideMap(side,cab),'cab company below 88 '+side);register('cab company '+side,cab,.48);
  for(let i=0;i<train.coaches.length;i++){
   const c=COACH_LAYOUT[i],z=side*(COACH_DIMENSIONS.bodyAndStepsWidth/2+.01),at=[c.x,TRACK.railHead+1.73,z];
   word(parent,4.8,sideMap(side,at),'coach '+i+' wordmark '+side);register('coach '+i+' wordmark '+side,at,4.8);
   parent.add(shaped(angel,1.45,sideMap(side,[c.x-6.4,TRACK.railHead+1.73,z]),red,'coach '+i+' C angel '+side,.004));
   company(parent,.75,sideMap(side,[c.x+6.4,TRACK.railHead+1.73,z]),'coach '+i+' company '+side);
  }
 }
 const tail=COACH_LAYOUT.at(-1).x-COACH_DIMENSIONS.bodyLength/2-.014,tailMap=at=>(u,v,d=0)=>[at[0]-d,at[1]+v,at[2]+u];
 word(parent,2.20,tailMap([tail,3.30,0]),'train rear wordmark');company(parent,1.05,tailMap([tail,2.65,0]),'train rear company');parent.add(shaped(right,1.55,tailMap([tail,1.88,0]),red,'train rear C angel',.008));register('rear wordmark',[tail,3.3,0],2.2);
 train.proof.branding={nativeContours:true,rasterTextures:0,originalTypefacePreserved:true,wordmarkLayers:['red original alpha silhouette','gold color-family contour'],companySource:'User-approved Grand Southern Continental Railway plaque, original lettering and six-spoke silhouette traced',companyLimits:plaque.cleanup,marks,tail:true,coaches:2};
 return parent;
}
