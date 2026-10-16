import {createTrainMatter} from '../original-matter/materials/matter.mjs';
import numberRecipe from './retained/branding/number88.mjs';
import companyRecipe from './retained/branding/company_plaque-gold.mjs';
import {D as BASE_D} from './dimensions.mjs';
import {kit} from './design/geometry.mjs';
import {createLettering} from './design/lettering.mjs';
import {createContinuousShell,sectionAt,sectionPoint,tAtZ,halfAt,shellPoint,shellNormal,cutAt,stripeAt} from './design/continuous-shell.mjs';
import {createRunningGear} from './running-gear.mjs';
import {createRailGeometry} from './retained/wheel-rail-profile.mjs';
import {createBackheadMother} from './retained/cab-mother/backhead-mother.mjs';
import {contourShapes} from './retained/branding/contours-injected.mjs';
import wordmark from './retained/branding/wordmark.mjs';
import angelL from './retained/branding/angel_left.mjs';
import angelR from './retained/branding/angel_right.mjs';
export function buildTrain(T,overrides={}){
 const D={...BASE_D,...overrides},root=new T.Group();root.name='A6 88 full detail R03 / no promotion';
 const mat=(color,metalness=.1,roughness=.35)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const M={paint:new T.MeshPhysicalMaterial({color:'#064630',metalness:.58,roughness:.25,clearcoat:1,clearcoatRoughness:.18,side:T.DoubleSide}),gold:mat('#e9bc63',.8,.24),brass:mat('#e9bc63',.8,.24),steel:mat('#acb5bb',.85,.25),iron:mat('#283239',.65,.4),black:mat('#11191c',.1,.6),rubber:mat('#1b2426',.05,.8),red:mat('#a22515',.4,.3),cream:mat('#d9c6a3',.05,.6),wood:mat('#76533b',.08,.44),seat:mat('#233f38',.05,.67),skin:mat('#b68b68',.02,.68),uniform:mat('#233444',.05,.65),glass:new T.MeshPhysicalMaterial({color:'#365a60',metalness:.05,roughness:.12,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.44,side:T.DoubleSide,depthWrite:false}),lamp:new T.MeshStandardMaterial({color:'#fff5d8',emissive:'#fff2ce',emissiveIntensity:1.5})};
 const originalMatter=createTrainMatter(T);Object.assign(M,{paint:originalMatter.paint,gold:originalMatter.brass,brass:originalMatter.brass,steel:originalMatter.steel,iron:originalMatter.iron,black:originalMatter.black,wood:originalMatter.wood,seat:originalMatter.leather});M.paint.side=T.DoubleSide;

 const group=(n,p=root)=>{const g=new T.Group();g.name=n;p.add(g);return g};
 const shell=group('01 continuous narrowed exterior'),interior=group('02 long forward cab and retained controls'),details=group('03 exterior contour details',shell),connections=group('05 articulated oil-water connections'),track=group('06 preserved metric track');
 const K=kit(T,M,root),E=kit(T,M,details),I=kit(T,M,interior),J=kit(T,M,connections),R=kit(T,M,track),L=createLettering(T,M);
 const skin=createContinuousShell(T,D,M);shell.add(skin.mesh);
 // Original contours only; every branding vertex follows the narrowed shell.
 function brand(recipe,width,at,side,material,name){const scale=width/recipe.size_px[0],g=new T.ExtrudeGeometry(contourShapes(T,recipe),{depth:.008/scale,bevelEnabled:false,curveSegments:1});g.scale(scale,scale,scale);g.translate(-width/2,width*recipe.size_px[1]/recipe.size_px[0]/2,0);g.applyMatrix4(L.sideMatrix(side,at));const pos=g.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),depth=side*(pos.getY(i)-at[1]);pos.setY(i,side*(halfAt(x,z)+.014+depth));}g.computeVertexNormals();const o=new T.Mesh(g,material);o.name=name;o.userData={originalContours:true,sourceSha256:recipe.source_sha256||recipe.asset,widthM:width,surfaceConformed:true};details.add(o);return o}
 for(const side of[-1,1]){
  for(const [a,b]of[[D.noseX,D.locoEnd],[D.tenderStart,D.tenderEnd]])E.pipe(Array.from({length:160},(_,i)=>{const x=a+(b-a)*i/159,z=stripeAt(x);return[x,side*(halfAt(x,z)+.018),z]}),.017,'gold','unbroken restrained gold waist line');
  E.pipe(Array.from({length:150},(_,i)=>{const x=D.cabStart+(D.cabEnd-D.cabStart)*i/149;return[x,side*(halfAt(x,D.cabGlassSill)+.009),D.cabGlassSill]}),.014,'black','flush long canopy sill seal');
  // Panoramic glass wraps continuously over the front. No opaque centre spine.
  for(const x of[D.cabStart,6.40,8.25,D.cabEnd]){const sec=sectionAt(x),ts=tAtZ(sec,D.cabGlassSill);E.pipe(Array.from({length:65},(_,i)=>{const t=ts*i/64,p=shellPoint(x,t,side),n=shellNormal(T,x,t,side);return p.map((v,k)=>v+n.getComponent(k)*.014)}),x===D.cabStart||x===D.cabEnd?.018:.009,'steel','flush canopy bow');}
  // Gills are behind the glass, laid back with the airflow, not vertical bars.
  for(let k=0;k<3;k++){const x=9.95+k*.29,pts=[[x-.11,2.72],[x+.07,3.16],[x+.18,3.18],[x,2.72]];surfacePatch(pts,side,M.black,'recessed swept shark gill '+k,.008);}
  brand(wordmark,7.60,[14.95,side*1.4,2.95],side,M.gold,'original Flying Hongkonger contour');
  brand(side>0?angelR:angelL,3.65,[24.35,side*1.4,2.40],side,M.red,'original rear red flying contour');
 }
 function surfacePatch(xz,side,material,name,offset=.01){const pts=[],idx=[],N=20,M=12;for(let i=0;i<=N;i++)for(let j=0;j<=M;j++){const u=i/N,v=j/M,weights=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v],x=xz.reduce((a,p,k)=>a+p[0]*weights[k],0),z=xz.reduce((a,p,k)=>a+p[1]*weights[k],0);pts.push(x,side*(halfAt(x,z)+offset),z)}for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*(M+1)+j,b=a+M+1;idx.push(a,b,a+1,b,b+1,a+1)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setIndex(idx);g.computeVertexNormals();const mat=material.clone();mat.side=T.DoubleSide;const o=new T.Mesh(g,mat);o.name=name;details.add(o);return o}

 // Sealed lamps are patches ON the actual forward upper nose, not side-mounted pods.
 for(const side of[-1,1]){
  const xc=2.08,tc=.25,points=[],normals=[],idx=[],rings=8,segments=64;
  for(let r=0;r<=rings;r++)for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,rr=r/rings,x=xc+.68*rr*Math.cos(a),t=tc+.078*rr*Math.sin(a),n=shellNormal(T,x,t,side),p=shellPoint(x,t,side);points.push(...p.map((v,k)=>v+n.getComponent(k)*.018));normals.push(...n.toArray());}
  for(let r=0;r<rings;r++)for(let j=0;j<segments;j++){const a=r*(segments+1)+j,b=a+segments+1;idx.push(a,b,a+1,b,b+1,a+1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(idx);const lens=new T.Mesh(g,new T.MeshPhysicalMaterial({color:'#142125',metalness:.2,roughness:.13,clearcoat:1,side:T.DoubleSide}));lens.name='sealed conformal forward-facing lamp lens';details.add(lens);
  E.pipe(Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2,x=xc+.68*Math.cos(a),t=tc+.078*Math.sin(a),n=shellNormal(T,x,t,side);return shellPoint(x,t,side).map((v,k)=>v+n.getComponent(k)*.023)}),.013,'steel','flush lamp perimeter');
  for(const dx of[-.24,.20]){const x=xc+dx,t=tc,n=shellNormal(T,x,t,side),p=new T.Vector3(...shellPoint(x,t,side)).addScaledVector(n,.025),a=p.clone().addScaledVector(n,.006);E.rod(p.toArray(),a.toArray(),dx<0?.083:.064,'lamp','sealed projector light',40);}
 }
 // Exact original traced number and company plaque; no newly typed company name.
 for(const side of[-1,1]){brand(numberRecipe,1.20,[4.55,side*1.3,1.16],side,M.gold,'original 88 under driver feet');brand(companyRecipe,1.05,[6.25,side*1.3,1.08],side,M.gold,'original company plaque behind 88');}
 // Two long wipers lie on the forward glass, below the driver's line of sight.
 for(const side of[-1,1]){const pts=Array.from({length:40},(_,i)=>{const x=4.12+.98*i/39,t=.18+.075*i/39,n=shellNormal(T,x,t,side);return shellPoint(x,t,side).map((v,k)=>v+n.getComponent(k)*.033)});E.pipe(pts,.014,'black','long curved front windscreen wiper');const p=pts[0];E.rod([p[0]+.16,p[1]*.77,p[2]-.03],p,.014,'steel','wiper drive arm');}
 // Cab deck is the old 2.18 m datum; feet stay below the sill. Keep full-scale occupants.
 I.box([7.75,0,D.cabFloor-.05],[6.8,2.38,.10],'iron','continuous structural cab floor');I.box([7.75,0,D.cabFloor+.012],[6.7,2.32,.025],'wood','long wood cab floor');
 function seat(x,y,fold=false){I.box([x,y,D.cabFloor+.36],[.47,.48,.11],'seat','full-size seat cushion');const b=I.box([x+.20,y,D.cabFloor+.72],[.10,.48,.65],'seat','ergonomic seat back');b.rotation.y=-.1;I.rod([x,y,D.cabFloor],[x,y,D.cabFloor+.30],.055,'steel','seat pedestal');if(fold)b.userData.foldable=true}
 seat(5.75,0);seat(8.25,.90,true);
 I.box([5.12,0,2.91],[.82,1.28,.13],'black','single forward driver desk');I.box([5.08,0,2.55],[.12,1.28,.62],'paint','concealed driver footwell front');
 for(let j=0;j<5;j++){I.rod([5.12,-.46+j*.23,2.97],[5.10,-.46+j*.23,3.01],.077,'gold','recessed driver instrument',28);I.rod([5.105,-.46+j*.23,3.007],[5.095,-.46+j*.23,3.017],.064,'cream','instrument face',28)}
 I.torus([5.45,0,3.03],.18,.018,'black','central driver control wheel',[1,0,0]);I.rod([5.22,0,2.82],[5.43,0,3.02],.025,'steel','control column');
 const backhead=createBackheadMother(T,{widthM:1.85,heightM:1.58,depthM:.40});backhead.root.position.set(11.07,0,D.cabFloor);interior.add(backhead.root);
 // This inherited control assembly is kept intact. Its fit is checked separately.
 I.rod([11.48,0,2.96],[19.25,0,2.96],.77,'iron','rear diesel-heated steam generator envelope');
 for(const x of[12,14.2,16.4,18.6])I.torus([x,0,2.96],.783,.018,'steel','generator cradle band',[1,0,0]);
 // Curved swept outlets: broad foot, narrower mouth, aft aerodynamic lean.
 for(const x of D.steamOutlets){const pos=[],idx=[],nu=48,nv=80;for(let i=0;i<=nu;i++){const u=i/nu,s=u*u*(3-2*u),rx=.48-(.48-.29)*s,ry=.32-(.32-.21)*s,cx=x+.15*s,z=3.80+.63*u;for(let j=0;j<=nv;j++){const a=j/nv*Math.PI*2;pos.push(cx+rx*Math.cos(a),ry*Math.sin(a),z);}}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;idx.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const outlet=new T.Mesh(g,M.paint);outlet.name='curved swept steam outlet broad foot narrow mouth';details.add(outlet);E.pipe(Array.from({length:81},(_,j)=>{const a=j/80*Math.PI*2;return[x+.15+.29*Math.cos(a),.21*Math.sin(a),4.43]}),.014,'gold','narrow elliptical outlet rolled lip');const throat=new T.Mesh(new T.CircleGeometry(1,80),M.black);throat.scale.set(.283,.203,1);throat.position.set(x+.15,0,4.413);throat.name='deep steam outlet throat';details.add(throat);}
 const ladder=group('pneumatic access ladder / retracted inside skirt',interior),A=kit(T,M,ladder);for(const side of[-1,1])A.rod([6.9,side*.27,.56],[6.9,side*.27,1.72],.024,'steel','telescoping ladder rail');for(const z of[.66,1.0,1.34])A.rod([6.9,-.27,z],[6.9,.27,z],.020,'steel','retracted ladder tread');A.rod([6.7,0,.7],[6.7,0,1.6],.052,'iron','ladder pneumatic actuator');ladder.userData={state:'retracted',deploymentClearance:'not yet tested'};
 I.box([24.3,0,1.08],[7.7,2.35,.16],'iron','tender structural platform');I.box([22.8,0,2.17],[4.1,2.10,1.65],'steel','enclosed water capacity envelope');I.box([26.5,0,2.17],[2.4,2.10,1.65],'iron','enclosed fuel capacity envelope');
 for(const x of[23.1,26.6]){E.rod([x,0,3.85],[x,0,3.93],.20,'paint','flush sealed oil-water filling cover',40);}

 function endCap(x,name){const pts=[];for(let j=-96;j<=96;j++){const side=j<0?-1:1,[y,z]=sectionPoint(sectionAt(x),Math.abs(j)/96);pts.push(new T.Vector2(side*y,z))}const g=new T.ShapeGeometry(new T.Shape(pts)),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,x,p.getX(i),p.getY(i));g.computeVertexNormals();const o=new T.Mesh(g,M.paint);o.name=name;details.add(o)}
 endCap(D.noseX,'continuous rounded nose closure pending reference clearance');endCap(D.tenderEnd,'flat matching rear oil-water bulkhead');
 const gear=createRunningGear(T,{...D,coachBogieCentres:[]},M);root.add(gear.root);const running=gear.root;
 // Forward frame extensions join the restored bored main plates at X=8.32.
 const F=kit(T,M,running);for(const side of[-1,1])F.box([6.95,side*.50,1.57],[2.74,.034,.42],'iron','forward frame extension to restored main plates');
 for(const s of[-1,1]){J.pipe([[20.04,s*.45,1.02],[20.14,s*.45,.64],[20.30,s*.45,.64],[20.40,s*.45,1.02]],.025,'black','articulated brake hose');J.rod([19.94,s*.32,1.00],[20.48,s*.32,1.00],.030,'steel','pinned longitudinal coupling link');}
 // Narrow seam covering the real articulated gap, matching the same analytic section.
 const seamMat=M.rubber.clone();const seamGeo=createContinuousShell(T,{...D,cabStart:-2,cabEnd:-1,locoEnd:0,tenderStart:0,tenderEnd:D.tenderEnd}, {...M,paint:seamMat});const sg=seamGeo.mesh.geometry;const pos=sg.attributes.position;const sourceIndex=sg.index.array,idx=[];for(let i=0;i<sourceIndex.length;i+=3){const xs=[0,1,2].map(j=>pos.getX(sourceIndex[i+j]));if(Math.min(...xs)>=20.099&&Math.max(...xs)<=20.321)idx.push(...sourceIndex.slice(i,i+3));}sg.setIndex(idx);sg.clearGroups();seamGeo.mesh.material=seamMat;seamGeo.mesh.name='continuous profile articulated tender seam';connections.add(seamGeo.mesh);
 J.rod([28.05,0,.88],[28.72,0,.88],.10,'iron','retained rear coupling interface');J.box([28.72,0,.88],[.23,.26,.2],'steel','rear coupler head');
 function human(x,y,z=0,seated=false){const h=group(seated?'full-size forward seated driver':'1.75m standing scale witness',seated?interior:root),H=kit(T,M,h);h.position.set(x,y,z);if(seated){H.box([0,0,.79],[.36,.24,.48],'uniform','seated torso');H.add(new T.SphereGeometry(.115,18,14),'skin','seated head',[0,0,1.155]);for(const s of[-1,1]){H.rod([0,s*.11,.55],[-.35,s*.11,.42],.065,'uniform','thigh');H.rod([-.35,s*.11,.42],[-.38,s*.11,.08],.055,'uniform','shin below sill');H.rod([-.05,s*.22,.91],[-.38,s*.24,.85],.045,'uniform','driver arm')}}else{for(const s of[-1,1]){H.rod([s*.1,0,.1],[s*.1,0,.85],.065,'uniform','leg');H.box([s*.1,-.04,.055],[.15,.27,.11],'black','shoe');H.rod([s*.24,0,1.30],[s*.25,0,.81],.045,'uniform','arm')}H.box([0,0,1.10],[.38,.22,.52],'uniform','torso');H.add(new T.SphereGeometry(.115,20,16),'skin','head',[0,0,1.635])}h.userData={seated,standingHeightM:1.75};return h}
 const comparisonHuman=human(6,-3.15),driver=human(5.75,0,D.cabFloor,true);
 for(const s of[-1,1]){const g=createRailGeometry(T,{lengthM:58,centerXM:25,centerZM:s*gear.dat.railCentreAbsM,railTopM:0,maxSegmentLengthM:4});g.rotateX(Math.PI/2);R.add(g,'steel','preserved 56E1 rail');}for(let x=-4;x<54;x+=.65)R.box([x,0,-.23],[.22,2.55,.13],'cream','track sleeper');
 function setPhase(a){gear.setPhase(a);root.userData.phase=a}function setCutaway(on){shell.visible=!on}setPhase(.30);root.updateMatrixWorld(true);root.userData={candidate:'a6-full-rebuild-r03',notApproved:true,notPublished:true,dimensions:D,originalLengthPreserved:false,wheelDiameterLocked:true,skirtHeightPendingReference:true,visualAcceptance:'pending',sourceBuffersLoaded:false};
 return{root,M,D,shell,interior,running,connections,track,comparisonHuman,driver,backhead,skin,gear,setPhase,setCutaway,...Object.fromEntries(['dat','contact','wheels','mains','rodLinks'].map(k=>[k,gear[k]]))};
}
