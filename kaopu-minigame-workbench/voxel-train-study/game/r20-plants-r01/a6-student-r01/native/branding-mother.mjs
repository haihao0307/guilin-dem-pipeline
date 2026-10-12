import{a6SideYM}from'./a6-form-domain.mjs';
import{a6TenderHalfWidth}from'./a6-tender-domain.mjs';
// Exact approved owned 88 contour recipes, remapped to native shell surfaces.
import {contourGeometry as buildContourGeometry} from './retained/branding/contours-injected.mjs';
import number88 from './retained/branding/number88.mjs';
import wordmark from './retained/branding/wordmark.mjs';import wordGold from './retained/branding/wordmark-gold.mjs';import left from './retained/branding/angel_left.mjs';import right from './retained/branding/angel_right.mjs';import plaque from './retained/branding/company_plaque-gold.mjs';
export function createBrandingMother(T,{shell,cab,tender}={}){
 const root=new T.Group();root.name='88 retained approved contour identity';const gold=new T.MeshStandardMaterial({color:0xd6aa61,metalness:.45,roughness:.32,side:T.DoubleSide}),red=new T.MeshStandardMaterial({color:0xa22515,metalness:.3,roughness:.4,side:T.DoubleSide}),green=new T.MeshStandardMaterial({color:0x142b22,metalness:.4,roughness:.43,side:T.DoubleSide}),numberMaterial=new T.MeshStandardMaterial({color:0xffdea3,metalness:.35,roughness:.3,side:T.DoubleSide});
 const sourceCache=new Map();function contourGeometry(recipe){if(!sourceCache.has(recipe))sourceCache.set(recipe,buildContourGeometry(T,recipe));return sourceCache.get(recipe)}
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
 const records=[];for(const side of[-1,1]){
  const map=(u,v,d=0)=>{const x=-.80-side*u,z=2.99+v,q=shell.section(x),f=(z-q.lower)/(q.crown-q.lower);if(f<0||f>1)throw Error('BRAND_OUTSIDE_SHELL_DOMAIN');return[x,a6SideYM(x,z,side)+side*d,z]};word(root,6,map,'boiler original wordmark '+side);
  const planar=(cx,y,z)=>(u,v,d=0)=>{const x=cx-side*u,zz=z+v;return [x,cx>-8.5&&cx<-6.3?a6SideYM(x,zz,side)+side*(.008+d):y+side*d,zz]};root.add(shaped(side>0?left:right,3.5,((u,v,d=0)=>{const x=-12.57-side*u,z=2.60+v;return[x,side*(a6TenderHalfWidth(x+12.57,z)+.004+d),z]}),red,'retained tender angel '+side,.004));
  root.add(shaped(number88,.55,planar(-7.09,side*(cab.parameters.widthM/2-cab.parameters.wallInsetM+cab.parameters.wallThicknessM/2+.008),2.43),numberMaterial,'retained cab 88 '+side,.004));company(root,.43,planar(-7.09,side*(cab.parameters.widthM/2-cab.parameters.wallInsetM+cab.parameters.wallThicknessM/2+.008),2.02),'retained cab company '+side);
  const noseMap=(u,v,d=0)=>{const x=3.20-side*u,z=2.25+v,q=shell.section(x),f=(z-q.lower)/(q.crown-q.lower);return[x,a6SideYM(x,z,side)+side*d,z]};root.add(shaped(number88,.30,noseMap,numberMaterial,'retained nose original 88 '+side,.006));records.push({side,wordmarkWidthM:6,tenderAngelWidthM:3.5,cabNumberWidthM:.55,identityContoursUnchanged:true})
 }for(const m of root.children)m.userData.mountFamily=m.name.includes('cab')?'cab':m.name.includes('tender')?'tender':'shell';root.userData={mother:'retained-88-branding',sourceRecipesUnchanged:true,rasterTextures:0,records,materialStatus:'Retained original owned lettering colors; transferred conformally to new native shell.'};return{root,parts:root.children,records,coverageStatus:'approved-identity-preserved-placement-needs-visual-review'};
}
