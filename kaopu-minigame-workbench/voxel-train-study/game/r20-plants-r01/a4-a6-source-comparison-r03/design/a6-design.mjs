import {createTrainMatter} from './original-matter/materials/matter.mjs';
import numberRecipe from './retained/branding/number88.mjs';
import companyRecipe from './retained/branding/company_plaque-gold.mjs';
import {AUTHORING_D as BASE_D, DESIGN_LAYOUT, SOURCE_FIT, sourcePoint, sourceJacobian} from './source-fit.mjs';
import {SOURCE_SHELL_REPLACEMENTS, buildCompleteSourcePartMap, createSourceVisibilityController} from './source-parts.mjs';
import {kit} from './geometry.mjs';
import {createClosedOilWaterRoof} from './closed-oil-water-roof.mjs';
import {createContinuousShell,sectionAt,sectionPoint,tAtZ,halfAt,shellPoint,shellNormal,cutAt,stripeAt,glassBoundaryT,glassBoundaryPoint,GLASS_FRONT_X,GLASS_REAR_X} from './continuous-shell.mjs';
import {auditCabVisibility} from './driver-sight-audit.mjs';
import {contourShapes} from './retained/branding/contours-injected.mjs';
import wordmark from './retained/branding/wordmark.mjs';
import angelL from './retained/branding/angel_left.mjs';
import angelR from './retained/branding/angel_right.mjs';
export function createA6Design(T,original){
 if(!original?.g?.nodes||!original?.nodes||!original?.root)throw Error('A6_DESIGN_REQUIRES_COMPLETE_ORIGINAL_A4');
 if(original.key&&original.key!=='a4')throw Error('A6_DESIGN_REQUIRES_A4_MOTHER');
 const D={...BASE_D},B=DESIGN_LAYOUT.branding,cabSpan=D.cabEnd-D.cabStart,driverX=D.cabStart+DESIGN_LAYOUT.driverOffsetFromCabFront,cabShift=driverX-4.60,floorShift=D.cabFloor-DESIGN_LAYOUT.originalCabFloor,root=new T.Group();root.name='A6 88 design overlay on complete original A4 / source units';
 const mat=(color,metalness=.1,roughness=.35)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const M={paint:new T.MeshPhysicalMaterial({color:'#064630',metalness:.58,roughness:.25,clearcoat:1,clearcoatRoughness:.18,side:T.DoubleSide}),gold:mat('#e9bc63',.8,.24),brass:mat('#e9bc63',.8,.24),steel:mat('#acb5bb',.85,.25),iron:mat('#283239',.65,.4),black:mat('#11191c',.1,.6),rubber:mat('#1b2426',.05,.8),red:mat('#a22515',.4,.3),cream:mat('#d9c6a3',.05,.6),wood:mat('#76533b',.08,.44),seat:mat('#233f38',.05,.67),skin:mat('#b68b68',.02,.68),uniform:mat('#233444',.05,.65),glass:new T.MeshPhysicalMaterial({color:'#365a60',metalness:.05,roughness:.12,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.44,side:T.DoubleSide,depthWrite:false}),lamp:new T.MeshStandardMaterial({color:'#fff5d8',emissive:'#fff2ce',emissiveIntensity:1.5})};
 const originalMatter=createTrainMatter(T);Object.assign(M,{paint:originalMatter.paint,gold:originalMatter.brass,brass:originalMatter.brass,steel:originalMatter.steel,iron:originalMatter.iron,black:originalMatter.black,wood:originalMatter.wood,seat:originalMatter.leather,glass:originalMatter.glass});M.paint.side=T.DoubleSide;M.paint.color.set('#064631');M.paint.metalness=.38;M.paint.roughness=.22;M.paint.clearcoat=.92;
 // Candidate optical tuning: preserve the full dielectric shader and finite pane; no alpha substitute.
 M.glass=M.glass.clone();M.glass.name='A6 finite panoramic dielectric / low-reflection clear study';M.glass.color.set('#b0cbbb');M.glass.attenuationColor.set('#a8cabb');M.glass.attenuationDistance=2.5;M.glass.envMapIntensity=.10;M.glass.transmission=1;M.glass.roughness=.008;M.glass.ior=1.45;M.glass.specularIntensity=1;M.glass.clearcoat=0;M.glass.clearcoatRoughness=.1;M.glass.opacity=1;M.glass.depthWrite=true;M.glass.userData={...M.glass.userData,designOpticalRevision:'finite dielectric, reduced environment reflection, no alpha shortcut',sourceMaterialsUnchanged:true,opacityLocked:1};
 // QA-only field isolation. Default values preserve the original complete shader exactly.
 const paintKey=M.paint.customProgramCacheKey;M.paint.customProgramCacheKey=()=>paintKey()+'/r04-diagnostic-uniforms-default-exact';const paintCompile=M.paint.onBeforeCompile;M.paint.onBeforeCompile=(shader,...args)=>{paintCompile(shader,...args);shader.uniforms.r04RoughnessField={value:1};shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float r04RoughnessField;').replace('(kn(kq*9.)-.5)*.12','(kn(kq*9.)-.5)*.12*r04RoughnessField');M.paint.userData.diagnosticUniforms=shader.uniforms;};



 const group=(n,p=root)=>{const g=new T.Group();g.name=n;p.add(g);return g};
 const shell=group('01 continuous narrowed exterior'),interior=group('02 cab over original three driving axles with one rear switch row'),details=group('03 exterior contour details',shell),connections=group('05 small aerodynamic tender joint');
 const driverCab=group('new low-seat driver workstation / source X +0.30',interior);driverCab.position.y=-DESIGN_LAYOUT.driverSourceX/SOURCE_FIT.transverseScale;
 const K=kit(T,M,root),E=kit(T,M,details),I=kit(T,M,interior),C=kit(T,M,driverCab),J=kit(T,M,connections),L={sideMatrix:(side,at)=>new T.Matrix4().set(-side,0,0,at[0],0,0,side,at[1],0,1,0,at[2],0,0,0,1)};
 const skin=createContinuousShell(T,D,M);shell.add(skin.mesh);
 const oilWaterRoof=createClosedOilWaterRoof(T,skin,D,M.paint);shell.add(oilWaterRoof);
 // Preserve the finite-glass transport contract: exact outer surface + inward 14mm layer and sealed rim.
 {const source=skin.mesh.geometry,group=source.groups[1],p=source.attributes.position,n=source.attributes.normal,used=new Map(),positions=[],normals=[],ids=[],edges=new Map();for(let j=group.start;j<group.start+group.count;j++){const old=source.index.getX(j);if(!used.has(old)){used.set(old,used.size);positions.push(p.getX(old)-n.getX(old)*.014,p.getY(old)-n.getY(old)*.014,p.getZ(old)-n.getZ(old)*.014);normals.push(-n.getX(old),-n.getY(old),-n.getZ(old));}}for(let j=group.start;j<group.start+group.count;j+=3){const old=[0,1,2].map(k=>source.index.getX(j+k));ids.push(used.get(old[0]),used.get(old[2]),used.get(old[1]));for(let k=0;k<3;k++){const aa=old[k],bb=old[(k+1)%3],key=[aa,bb].sort((a,b)=>a-b).join(',');if(edges.has(key))edges.delete(key);else edges.set(key,[aa,bb]);}}for(const[aa,bb]of edges.values()){const a=used.get(aa),b=used.get(bb),i=positions.length/3;positions.push(p.getX(aa),p.getY(aa),p.getZ(aa),p.getX(bb),p.getY(bb),p.getZ(bb));normals.push(n.getX(aa),n.getY(aa),n.getZ(aa),n.getX(bb),n.getY(bb),n.getZ(bb));ids.push(a,i,b,i,i+1,b);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(ids);const pane=new T.Mesh(g,M.glass);pane.name='14mm finite canopy inner optical surface and sealed edge';pane.userData={finiteThicknessM:.014,outerSurface:skin.mesh.uuid,originalFiniteGlassTransport:true};shell.add(pane);}

 // Original contours only; every branding vertex follows the narrowed shell.
 function brand(recipe,width,at,side,material,name){const scale=width/recipe.size_px[0],g=new T.ExtrudeGeometry(contourShapes(T,recipe),{depth:.008/scale,bevelEnabled:false,curveSegments:1});g.scale(scale,scale,scale);g.translate(-width/2,width*recipe.size_px[1]/recipe.size_px[0]/2,0);g.applyMatrix4(L.sideMatrix(side,at));const pos=g.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),depth=side*(pos.getY(i)-at[1]);pos.setY(i,side*(halfAt(x,z)+.014+depth));}g.computeVertexNormals();const o=new T.Mesh(g,material);o.name=name;o.userData={originalContours:true,sourceSha256:recipe.source_sha256||recipe.asset,widthM:width,surfaceConformed:true};details.add(o);return o}
 for(const side of[-1,1]){
  for(const [a,b]of[[D.noseX,D.locoEnd],[D.tenderStart,D.tenderEnd]])E.pipe(Array.from({length:160},(_,i)=>{const x=a+(b-a)*i/159,z=stripeAt(x);return[x,side*(halfAt(x,z)+.018),z]}),.017,'gold','unbroken restrained gold waist line');
  E.pipe(Array.from({length:220},(_,i)=>{const x=GLASS_FRONT_X+(GLASS_REAR_X-GLASS_FRONT_X)*i/219,t=glassBoundaryT(x),n=shellNormal(T,x,t,side);return glassBoundaryPoint(x,side).map((v,k)=>v+n.getComponent(k)*.010)}),.012,'black','flush curved panoramic perimeter seal');
  // Curved front/rear returns are the shared material boundary; no rectangular end bows.
  for(const x of[D.cabStart+1.95,D.cabEnd-1.25]){const ts=glassBoundaryT(x);E.pipe(Array.from({length:65},(_,i)=>{const t=ts*i/64,p=shellPoint(x,t,side),n=shellNormal(T,x,t,side);return p.map((v,k)=>v+n.getComponent(k)*.012)}),.007,'steel','slender canopy transverse bow');}
  // Gills are behind the glass, laid back with the airflow, not vertical bars.
  for(let k=0;k<3;k++){const x=D.cabEnd+.63+k*.29,pts=[[x-.11,3.35],[x+.07,3.79],[x+.18,3.81],[x,3.35]];surfacePatch(pts,side,M.black,'recessed swept shark gill '+k,.008);}
  brand(wordmark,B.wordmarkWidth,[B.wordmarkX,side*1.4,B.wordmarkZ],side,M.gold,'original Flying Hongkonger contour');
  brand(side>0?angelR:angelL,B.redContourWidth,[B.redContourX,side*1.4,B.redContourZ],side,M.red,'original rear red flying contour');
 }
 function surfacePatch(xz,side,material,name,offset=.01){const pts=[],idx=[],N=20,M=12;for(let i=0;i<=N;i++)for(let j=0;j<=M;j++){const u=i/N,v=j/M,weights=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v],x=xz.reduce((a,p,k)=>a+p[0]*weights[k],0),z=xz.reduce((a,p,k)=>a+p[1]*weights[k],0);pts.push(x,side*(halfAt(x,z)+offset),z)}for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*(M+1)+j,b=a+M+1;idx.push(a,b,a+1,b,b+1,a+1)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setIndex(idx);g.computeVertexNormals();const mat=material.clone();mat.side=T.DoubleSide;const o=new T.Mesh(g,mat);o.name=name;details.add(o);return o}

 // Sealed lamps are patches ON the actual forward upper nose, not side-mounted pods.
 for(const side of[-1,1]){
  const xc=D.noseX+1.05,tc=.43,points=[],normals=[],idx=[],rings=8,segments=64;
  for(let r=0;r<=rings;r++)for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,rr=r/rings,x=xc+.48*rr*Math.cos(a),t=tc-.030*rr*Math.cos(a)+.023*rr*Math.sin(a),n=shellNormal(T,x,t,side),p=shellPoint(x,t,side);points.push(...p.map((v,k)=>v+n.getComponent(k)*.018));normals.push(...n.toArray());}
  for(let r=0;r<rings;r++)for(let j=0;j<segments;j++){const a=r*(segments+1)+j,b=a+segments+1;idx.push(a,b,a+1,b,b+1,a+1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(idx);const lens=new T.Mesh(g,new T.MeshPhysicalMaterial({color:'#142125',metalness:.2,roughness:.13,clearcoat:1,side:T.DoubleSide}));lens.name='sealed conformal forward-facing lamp lens';details.add(lens);
  E.pipe(Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2,x=xc+.48*Math.cos(a),t=tc-.030*Math.cos(a)+.023*Math.sin(a),n=shellNormal(T,x,t,side);return shellPoint(x,t,side).map((v,k)=>v+n.getComponent(k)*.023)}),.013,'steel','flush lamp perimeter');
  for(const dx of[-.20,.18]){const x=xc+dx,t=tc-.030*dx/.48,n=shellNormal(T,x,t,side),p=new T.Vector3(...shellPoint(x,t,side)).addScaledVector(n,.025),a=p.clone().addScaledVector(n,.006);E.rod(p.toArray(),a.toArray(),dx<0?.060:.050,'lamp','sealed projector light',40);}
 }
 // Exact original traced number and company plaque; no newly typed company name.
 for(const side of[-1,1]){brand(numberRecipe,B.numberWidth,[B.numberX,side*1.3,B.numberZ],side,M.gold,'original 88 scaled design instance below driver above wheel opening');brand(companyRecipe,B.companyWidth,[B.companyX,side*1.3,B.companyZ],side,M.gold,'complete original company plaque scaled instance aft of 88 above wheel opening');}
 // Wipers sit on the true sloping front windshield, outside the required eye rays.
 for(const side of[-1,1]){const pts=Array.from({length:40},(_,i)=>{const x=GLASS_FRONT_X+.65+1.05*i/39,t=glassBoundaryT(x)*.88,n=shellNormal(T,x,t,side);return shellPoint(x,t,side).map((v,k)=>v+n.getComponent(k)*.026)});E.pipe(pts,.011,'black','curved forward windshield wiper');}
 // R03 floor clears the ACTUAL original undercarriage27 top, not only the wheels.
 // Full-size driver, seat and instruments move together; source mechanical/floor nodes never move.
 I.box([(D.cabStart+D.cabEnd)/2,0,D.cabFloor-.05],[cabSpan-.12,2.38,.10],'iron','continuous structural cab floor');I.box([(D.cabStart+D.cabEnd)/2,0,D.cabFloor+.012],[cabSpan-.22,2.32,.025],'wood','long wood cab floor');
 function seat(x,y,fold=false){C.box([x,y,D.cabFloor+.24],[.47,.48,.11],'seat','full-size seat cushion');const b=C.box([x+.20,y,D.cabFloor+.60],[.10,.48,.65],'seat','ergonomic seat back');b.rotation.y=-.1;C.rod([x,y,D.cabFloor],[x,y,D.cabFloor+.18],.055,'steel','seat pedestal');if(fold)b.userData.foldable=true}
 seat(driverX,0); // Rear folding design seat removed from this revision: one switch row only.
 C.box([3.85+cabShift,0,2.91+floorShift-.12],[.50,1.28,.13],'black','single forward driver desk');C.box([3.93+cabShift,0,2.55+floorShift-.12],[.12,1.28,.62],'paint','concealed driver footwell front');
 for(let j=0;j<5;j++){C.rod([3.97+cabShift,-.46+j*.23,2.97+floorShift-.12],[3.95+cabShift,-.46+j*.23,3.01+floorShift-.12],.077,'gold','recessed driver instrument',28);C.rod([3.955+cabShift,-.46+j*.23,3.007+floorShift-.12],[3.945+cabShift,-.46+j*.23,3.017+floorShift-.12],.064,'cream','instrument face',28)}
 C.torus([4.30+cabShift,0,3.03+floorShift-.12],.18,.018,'black','central driver control wheel',[1,0,0]).rotation.y=.50;C.rod([4.07+cabShift,0,2.82+floorShift-.12],[4.28+cabShift,0,3.02+floorShift-.12],.025,'steel','control column');
 // One transverse rear switch row. Exact original multi-level controls remain intact
 // at their source placement, and a separate exact-geometry study copy stays hidden.
 const switchRow=group('single rear switch row / nine controls',interior),S=kit(T,M,switchRow),switchX=D.cabEnd-.35,switchZ=D.cabFloor+.72;
 S.box([switchX,0,switchZ],[.14,2.06,.26],'black','single-row recessed rear switch fascia');
 for(let j=0;j<DESIGN_LAYOUT.rearSwitchCount;j++){const y=-.84+j*.21;S.torus([switchX-.079,y,switchZ],.048,.008,'gold','rear switch bezel '+(j+1),[1,0,0]);S.rod([switchX-.085,y,switchZ-.015],[switchX-.15,y,switchZ+.025],.014,'steel','rear switch toggle '+(j+1),20);S.box([switchX-.078,y,switchZ-.088],[.009,.13,.023],'cream','rear switch index strip '+(j+1));}
 switchRow.userData={rows:1,switchCount:DESIGN_LAYOUT.rearSwitchCount,sourceControlReferenceRoots:[...SOURCE_CAB_DISPLAY_ROOTS],sourceControlsDeleted:false,controlLogic:'layout study only; no operating connections claimed'};
 // Full original A4 valve/gauge/fire-door source geometry is cloned after source-axis mapping below.
 // This inherited control assembly is kept intact. Its fit is checked separately.
 // Generator hardware is the retained source scene; no new mechanical replacement volume.
 // Curved swept outlets: broad foot, narrower mouth, aft aerodynamic lean.
 for(const x of D.steamOutlets){const crown=sectionAt(x)[2],outletBase=crown-.11,outletTop=outletBase+.63;const pos=[],idx=[],nu=48,nv=80;for(let i=0;i<=nu;i++){const u=i/nu,s=u*u*(3-2*u),rx=.48-(.48-.29)*s,ry=.32-(.32-.21)*s,cx=x+.15*s,z=outletBase+.63*u;for(let j=0;j<=nv;j++){const a=j/nv*Math.PI*2;pos.push(cx+rx*Math.cos(a),ry*Math.sin(a),z);}}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;idx.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const outlet=new T.Mesh(g,M.paint);outlet.name='curved swept steam outlet broad foot narrow mouth';details.add(outlet);E.pipe(Array.from({length:81},(_,j)=>{const a=j/80*Math.PI*2;return[x+.15+.29*Math.cos(a),.21*Math.sin(a),outletTop]}),.014,'gold','narrow elliptical outlet rolled lip');const throat=new T.Mesh(new T.CircleGeometry(1,80),M.black);throat.scale.set(.283,.203,1);throat.position.set(x+.15,0,outletTop-.017);throat.name='deep steam outlet throat';details.add(throat);}
 const ladder=group('pneumatic access ladder / retracted behind last drive-wheel envelope',interior),A=kit(T,M,ladder),ladderX=16.80;for(const side of[-1,1])A.rod([ladderX,side*.27,.56],[ladderX,side*.27,1.72],.024,'steel','telescoping ladder rail');for(const z of[.66,1.0,1.34])A.rod([ladderX,-.27,z],[ladderX,.27,z],.020,'steel','retracted ladder tread');A.rod([ladderX-.2,0,.7],[ladderX-.2,0,1.6],.052,'iron','ladder pneumatic actuator');ladder.userData={state:'retracted',deploymentClearance:'not yet tested'};
 // Source tender frame, tanks, suspension and fittings remain in original.root.
 for(const x of[23.1,26.6]){const crown=sectionAt(x)[2];E.rod([x,0,crown-.06],[x,0,crown+.02],.20,'paint','flush sealed oil-water filling cover',40);}

 function endCap(x,name){const pts=[];for(let j=-96;j<=96;j++){const side=j<0?-1:1,[y,z]=sectionPoint(sectionAt(x),Math.abs(j)/96);pts.push(new T.Vector2(side*y,z))}const g=new T.ShapeGeometry(new T.Shape(pts)),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,x,p.getX(i),p.getY(i));g.computeVertexNormals();const o=new T.Mesh(g,M.paint);o.name=name;details.add(o)}
 endCap(D.noseX,'sub-pixel terminal closure of continuous rounded nose');
 // Flush painted inspection closure belongs to the same analytic skin; only its narrow joint is marked.
 {const x=D.noseX+.80,pts=[];for(let j=-96;j<=96;j++){const side=j<0?-1:1,t=Math.abs(j)/96,n=shellNormal(T,x,t,side);pts.push(shellPoint(x,t,side).map((v,k)=>v+n.getComponent(k)*.0009));}E.pipe(pts,.0012,'black','fine flush nose inspection seam / shared curvature and paint');}endCap(D.tenderEnd,'flat matching rear oil-water bulkhead');
 // Narrow seam covering the real articulated gap, matching the same analytic section.
 const seamMat=M.rubber.clone();const seamGeo=createContinuousShell(T,{...D,cabStart:-2,cabEnd:-1,locoEnd:0,tenderStart:0,tenderEnd:D.tenderEnd,additionalRows:[D.locoEnd,D.tenderStart]}, {...M,paint:seamMat});const sg=seamGeo.mesh.geometry;const pos=sg.attributes.position;const sourceIndex=sg.index.array,idx=[];for(let i=0;i<sourceIndex.length;i+=3){const xs=[0,1,2].map(j=>pos.getX(sourceIndex[i+j]));if(Math.min(...xs)>=20.099&&Math.max(...xs)<=20.321)idx.push(...sourceIndex.slice(i,i+3));}sg.setIndex(idx);sg.clearGroups();seamGeo.mesh.geometry=sg.toNonIndexed();sg.dispose();seamGeo.mesh.material=seamMat;seamGeo.mesh.name='continuous profile articulated tender seam';connections.add(seamGeo.mesh);
 function human(x,y,z=0,seated=false){const h=group(seated?'unscaled authored driver / low-seat joint posture':'uncalibrated standing scale witness',seated?driverCab:root),H=kit(T,M,h);h.position.set(x,y,z);if(seated){
  H.box([0,0,.67],[.36,.24,.48],'uniform','seated torso');H.add(new T.SphereGeometry(.115,18,14),'skin','seated head',[0,0,1.035]);
  const knee=-Math.sqrt(Math.hypot(.35,.13)**2-.015**2),ankle=knee-.03;
  for(const side of[-1,1]){
   H.rod([0,side*.11,.43],[knee,side*.11,.445],.065,'uniform','thigh');
   H.rod([knee,side*.11,.445],[ankle,side*.11,.105],.055,'uniform','shin below sill');
   H.rod([.03+.11*Math.sin(.5),side*.13,.79+.11*Math.cos(.5)],[-.30+.11*Math.sin(.5),side*.15,.73+.11*Math.cos(.5)],.045,'uniform','driver arm');
   H.add(new T.SphereGeometry(.054,18,12),'skin','driver '+(side<0?'right':'left')+' hand',[-.30+.11*Math.sin(.5),side*.15,.73+.11*Math.cos(.5)]);
   H.box([ankle-.045,side*.11,.065],[.19,.12,.075],'black','driver '+(side<0?'right':'left')+' boot');
  }
 }else{for(const s of[-1,1]){H.rod([s*.1,0,.1],[s*.1,0,.85],.065,'uniform','leg');H.box([s*.1,-.04,.055],[.15,.27,.11],'black','shoe');H.rod([s*.24,0,1.30],[s*.25,0,.81],.045,'uniform','arm')}H.box([0,0,1.10],[.38,.22,.52],'uniform','torso');H.add(new T.SphereGeometry(.115,20,16),'skin','head',[0,0,1.635])}h.userData={seated,authoredStandingHeight:1.75,physicalHeightUncalibrated:true};return h}
 const driver=human(driverX,0,D.cabFloor,true);driver.userData={...driver.userData,facingSourceAxis:'+Z',sourceSeatPosition:sourcePoint(driverX,-DESIGN_LAYOUT.driverSourceX/SOURCE_FIT.transverseScale,D.cabFloor),occupantNotScaled:true,floorTranslationSourceY:floorShift};
 // All newly authored detail is converted to source axes. The original scene is never transformed.
 bakeDesignToSource(T,root);
 root.updateMatrixWorld(true);
 const landmarkRoot=group('source-local cab audit landmarks'),landmarks={};
 const localMeshes=[];driverCab.traverse(o=>{if(o.isMesh)localMeshes.push(o)});
 const landmark=(name,point,targetName=null)=>{const marker=new T.Object3D();marker.name='cab landmark / '+name;marker.position.fromArray(point);marker.userData={sourceLocal:true,targetMeshName:targetName};landmarkRoot.add(marker);landmarks[name]=marker;return marker;};
 landmark('eye',[DESIGN_LAYOUT.driverSourceX,D.cabFloor+SOURCE_FIT.verticalOffset+1.055,sourcePoint(driverX,0,0)[2]+.088]);
 for(const [key,name]of[['head','seated head'],['torso','seated torso'],['leftHand','driver left hand'],['rightHand','driver right hand'],['leftFoot','driver left boot'],['rightFoot','driver right boot']]){const obj=localMeshes.find(o=>o.name===name);if(!obj)throw Error('MISSING_DRIVER_LANDMARK '+name);landmark(key,new T.Box3().setFromObject(obj,true).getCenter(new T.Vector3()).toArray(),name);}
 const sourceCab=cloneSourceCab(T,original);sourceCab.visible=false;interior.add(sourceCab);
 root.updateMatrixWorld(true);
 root.userData={candidate:'a4-a6-source-comparison-r03/design',notApproved:true,notPublished:true,
   units:'SOURCE_UNITS_UNCALIBRATED',axes:'X transverse; Y up; Z forward',originalNodesUnchanged:true,actualEyeSource:landmarks.eye.position.toArray(),driverLandmarks:Object.fromEntries(Object.entries(landmarks).map(([k,v])=>[k,{source:v.position.toArray(),targetMeshName:v.userData.targetMeshName}])),driverPose:{newDesignOnly:true,sourceX:DESIGN_LAYOUT.driverSourceX,lowSeatDelta:-.12,headAndTorsoGeometryUnscaled:true,thighAuthoringLength:Math.hypot(.35,.13),shinAuthoringLength:Math.hypot(.03,.34),jointLengthsPreservedInAuthoringCoordinates:true,sourceUnitHumanCalibration:false},
   sourceBuffersUsedForMechanicalMother:true,generatedRunningGear:false,originalDriveAxles:3,
   sourceShellReplacementRoots:SOURCE_SHELL_REPLACEMENTS.map(x=>x.node),
   sourcePartMap:buildCompleteSourcePartMap(original),
   shellReplacementIsReversible:true,allUnknownSourceNodesRetained:true,
   finiteCanopyThicknessSourceUnits:.014,oilWaterRoofClosed:true,oilWaterRoofClosure:{everyEdgeUsedTwice:oilWaterRoof.userData.everyEdgeUsedTwice,manifoldEdgeCount:oilWaterRoof.userData.manifoldEdgeCount,perimeterEdges:oilWaterRoof.userData.perimeterEdges},sourceCoalLoad:{rootNode:311,primitiveNodes:[312,313,314,315,316],treatment:'retained source load, hidden only while closed diesel-steam design is enabled'},sourceCoalLoadReversiblyCovered:true,designCanopyOptics:{opacity:M.glass.opacity,transmission:M.glass.transmission,ior:M.glass.ior,roughness:M.glass.roughness,envMapIntensity:M.glass.envMapIntensity,specularIntensity:M.glass.specularIntensity,attenuationDistance:M.glass.attenuationDistance,finiteThickness:.014},sourceCabDisplayCopy:'HIDDEN_STUDY_ONLY',
   layoutRevision:DESIGN_LAYOUT,designCabFloor:{previousSourceY:DESIGN_LAYOUT.originalCabFloor+SOURCE_FIT.verticalOffset,newSourceY:D.cabFloor+SOURCE_FIT.verticalOffset,lowestSourceY:DESIGN_LAYOUT.newFloorLowestSourceY,translationSourceY:floorShift,staticWheelMaximumSourceY:2.5744,originalUndercarriageMaximumSourceY:2.986647754907608,staticUndercarriageVerticalMargin:DESIGN_LAYOUT.newFloorLowestSourceY-2.986647754907608,sourceFloorUnchanged:true},rearControlRows:1,fitStatus:'VISUAL_PROPOSAL_ONLY; static wheel/undercarriage margin under audit; suspension travel, source controls, structure and operating clearance are not certified',
   originalSourceRootNotIncludedInDesignGroup:true,visualAnchor:'retained R08/R01 continuous exterior plus user blue annotations 2026-10-17 07:23 and wheel-bottom crown reference'};
 root.designParts={shell,interior,connections,driver,driverCab,landmarks,skin,sourceCab,oilWaterRoof,switchRow};
 const visibility=createSourceVisibilityController(original,root);
 const auditVisibility=()=>auditCabVisibility(T,{root,original,driver,driverCab,landmarks,glassMaterial:M.glass});
 return{root,...visibility,shell,interior,connections,driver,driverCab,landmarks,auditVisibility,skin,oilWaterRoof,switchRow,designGlass:M.glass,sourceCabStudy:sourceCab,
  setSourceCabStudyVisible:on=>{sourceCab.visible=Boolean(on)},sourceFit:SOURCE_FIT};
}

function bakeDesignToSource(T,root){
 root.updateMatrixWorld(true);
 const targets=[];root.traverse(o=>{if(o.isMesh)targets.push(o)});
 for(const o of targets){
  const geometry=o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);
  const p=geometry.attributes.position,n=geometry.attributes.normal;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),q=sourcePoint(x,y,z);p.setXYZ(i,...q);
   if(n){const jac=sourceJacobian(x),normal=new T.Vector3(-n.getY(i)/jac.transverse,n.getZ(i),n.getX(i)/jac.longitudinal).normalize();n.setXYZ(i,...normal.toArray());}
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();o.geometry=geometry;
  o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);o.updateMatrix();
  o.userData={...o.userData,geometrySpace:'A4_SOURCE_UNITS_UNCALIBRATED',designGeometryOnly:true};
  for(const key of Object.keys(o.userData))if(key.endsWith('M')&&typeof o.userData[key]==='number'){o.userData[key.replace(/M$/,'SourceUnits')]=o.userData[key];delete o.userData[key];}
 }
 // Authored groups carried object offsets which have now been baked into mesh vertices.
 root.traverse(o=>{if(!o.isMesh){o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);o.updateMatrix();}});
}

export const SOURCE_CAB_DISPLAY_ROOTS=Object.freeze([144,152,157,160,164,166,169,171,173,175,177,179]);
function cloneSourceCab(T,original){
 const group=new T.Group();group.name='exact original A4 controls / additional forward-cab display copy';
 original.root.updateMatrixWorld(true);
 const inverse=new T.Matrix4().copy(original.root.matrixWorld).invert();
 const sourceBox=new T.Box3();for(const id of SOURCE_CAB_DISPLAY_ROOTS)sourceBox.expandByObject(original.nodes[id],true);sourceBox.applyMatrix4(inverse);const targetSourceZ=(DESIGN_LAYOUT.cabFrontSourceZ+DESIGN_LAYOUT.cabRearSourceZ)/2,shiftSourceZ=targetSourceZ-sourceBox.getCenter(new T.Vector3()).z;const shift=new T.Matrix4().makeTranslation(0,0,shiftSourceZ);
 for(const id of SOURCE_CAB_DISPLAY_ROOTS){
  const src=original.nodes[id];if(!src)throw Error('MISSING_A4_CONTROL_NODE '+id);
  src.traverse(o=>{if(!o.isMesh)return;const c=o.clone(false);c.name='source control display copy / '+o.name;
   c.matrixAutoUpdate=false;c.matrix.copy(shift).multiply(inverse).multiply(o.matrixWorld);
   c.userData={...o.userData,exactSourceGeometryDisplayCopy:true,sourceRoot:id,originalAtSourcePositionRetained:true};group.add(c);});
 }
 group.userData={sourceRoots:[...SOURCE_CAB_DISPLAY_ROOTS],geometrySharedWithUnmodifiedSource:true,additionalDisplayCopy:true,shiftSourceZ,targetSourceZ};
 return group;
}
